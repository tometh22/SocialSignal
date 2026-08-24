import cron from "node-cron";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db";
import { ipcIndexValues, quotationPriceAdjustments, quotationVariants, quotations } from "@shared/schema";
import { blueprintDefinitionSchema } from "@shared/quotation-professional";
import {
  buildPriceAdjustmentProposal,
  clampToMonthStart,
  type AdjustmentCadence,
  type MonthlyIpcValue,
} from "@shared/utils/quotation-ipc-adjustment";
import { syncIpcIndex } from "../services/ipcSync";

const ADJUSTABLE_CADENCES: AdjustmentCadence[] = ["ipc_quarterly", "annual_review"];
// Techo defensivo: hoy son unas pocas decenas de cuentas recurrentes en ARS.
// Si algún día se supera, hay que paginar esta corrida en vez de subir el
// número — hasta entonces, evita que la query crezca sin límite en silencio.
const MAX_CANDIDATE_QUOTATIONS = 2_000;

/**
 * Busca cotizaciones aceptadas, recurrentes, en ARS, cuya receta trae la
 * cláusula ipc_quarterly/annual_review desde que se cotizaron (nunca se
 * agrega retroactivamente), y crea una fila "pending_approval" para cada
 * ciclo vencido. No cambia ningún precio ni manda ningún email — sólo dejar
 * la propuesta lista para que alguien la revise.
 */
export async function detectDuePriceAdjustments(now = new Date()): Promise<{ created: number; skippedDuplicate: number }> {
  const candidates = await db.select().from(quotations).where(and(
    eq(quotations.status, "approved"),
    inArray(quotations.quotationType, ["recurring", "fee"]),
    eq(quotations.quotationCurrency, "ARS"),
    isNull(quotations.archivedAt),
  )).limit(MAX_CANDIDATE_QUOTATIONS);
  if (candidates.length === 0) return { created: 0, skippedDuplicate: 0 };

  // Si el cliente aceptó una variante puntual, esa variante — no la
  // cotización base — es la fuente de verdad del alcance (mismo criterio
  // que ya usa server/routes.ts al materializar un proyecto: scopeSnapshot
  // de la variante seleccionada, con fallback a la base). totalAmount de la
  // cotización ya se sincroniza al aceptar una variante, pero scopeSnapshot
  // no — así que hay que ir a buscarlo acá para no perderse una cláusula de
  // IPC que sólo vive en la variante aceptada.
  const acceptedVariantIds = candidates.map((q) => q.acceptedVariantId).filter((id): id is number => id != null);
  const acceptedVariants = acceptedVariantIds.length
    ? await db.select({ id: quotationVariants.id, scopeSnapshot: quotationVariants.scopeSnapshot })
        .from(quotationVariants).where(inArray(quotationVariants.id, acceptedVariantIds))
    : [];
  const variantScopeById = new Map(acceptedVariants.map((v) => [v.id, v.scopeSnapshot]));
  const resolvedScopeByQuotation = new Map(candidates.map((quotation) => [
    quotation.id,
    (quotation.acceptedVariantId ? variantScopeById.get(quotation.acceptedVariantId) : null) ?? quotation.scopeSnapshot,
  ]));

  // ipc_index_values tiene unique(year, month, source) a propósito — el
  // modelo ya contempla más de una fuente el día de mañana. Para que el
  // cálculo sea determinístico incluso si eso pasa, se ordena por
  // fetchedAt más reciente y se queda con el primer valor visto por
  // período (en vez de dejar que gane "lo que la consulta devuelva último",
  // que con Postgres no tiene un orden garantizado).
  const monthlyValues = dedupeMostRecentPerPeriod(
    await db.select().from(ipcIndexValues).where(eq(ipcIndexValues.isActive, true)).orderBy(desc(ipcIndexValues.fetchedAt)),
  );

  const eligibleQuotations = candidates.filter((quotation) => {
    const scope = resolvedScopeByQuotation.get(quotation.id);
    if (!scope || !quotation.acceptedAt) return false;
    const parsed = blueprintDefinitionSchema.safeParse(scope);
    return parsed.success && ADJUSTABLE_CADENCES.includes(parsed.data.priceAdjustment as AdjustmentCadence);
  });
  if (eligibleQuotations.length === 0) return { created: 0, skippedDuplicate: 0 };

  // Un solo select para TODOS los candidatos en vez de 2 por candidato — el
  // resto se resuelve agrupando en memoria.
  const quotationIds = eligibleQuotations.map((quotation) => quotation.id);
  const existingAdjustments = await db.select().from(quotationPriceAdjustments)
    .where(inArray(quotationPriceAdjustments.quotationId, quotationIds))
    .orderBy(desc(quotationPriceAdjustments.periodEnd));
  const adjustmentsByQuotation = new Map<number, typeof existingAdjustments>();
  for (const adjustment of existingAdjustments) {
    const list = adjustmentsByQuotation.get(adjustment.quotationId) ?? [];
    list.push(adjustment);
    adjustmentsByQuotation.set(adjustment.quotationId, list);
  }

  let created = 0;
  let skippedDuplicate = 0;

  for (const quotation of eligibleQuotations) {
    const parsed = blueprintDefinitionSchema.parse(resolvedScopeByQuotation.get(quotation.id));
    const cadence = parsed.priceAdjustment as AdjustmentCadence;
    const forQuotation = adjustmentsByQuotation.get(quotation.id) ?? [];

    // Si ya hay un ajuste sin resolver para esta cotización, no proponemos
    // otro encima — que se resuelva ese primero. (También hay un índice
    // único parcial en la migración que garantiza esto a nivel de base, por
    // si alguna vez corren dos instancias del cron a la vez.)
    if (forQuotation.some((adjustment) => adjustment.status === "pending_approval")) continue;

    // El endpoint de aprobación actualiza quotations.totalAmount al aplicar
    // un ajuste, así que el precio vigente real siempre es este campo — no
    // hace falta reconstruirlo desde el historial (y encadenar desde un
    // ajuste RECHAZADO sería incorrecto: ese precio nunca se cobró).
    const lastResolved = forQuotation.find((adjustment) => adjustment.status === "approved_applied" || adjustment.status === "rejected");
    // periodEnd de un ajuste anterior ya cae siempre el día 1 de un mes
    // (addCalendarMonths lo construye así), pero acceptedAt es un timestamp
    // real con el día en que el cliente aceptó. Sin este clamp, el primer
    // ciclo arrancaba, por ejemplo, el 15/01 pero calculateAccumulatedIpc
    // igual computaba desde el 01/01 (redondea puertas adentro): se contaba
    // medio mes de IPC que el contrato todavía no cubría, y el ciclo vencía
    // ~2,5 meses después en vez de 3. Se clampea acá para que periodStart
    // sea siempre consistente con lo que realmente se calcula y se le
    // muestra a quien aprueba.
    const sinceDate = lastResolved ? new Date(lastResolved.periodEnd) : clampToMonthStart(new Date(quotation.acceptedAt!));

    const proposal = buildPriceAdjustmentProposal({
      cadence,
      sinceDate,
      now,
      previousTotalAmount: quotation.totalAmount,
      monthlyValues,
    });
    if (!proposal) {
      // O todavía no vence, o vence pero falta que se sincronice el IPC de
      // algún mes del período — nunca calculamos con datos parciales.
      continue;
    }

    // onConflictDoNothing (sobre el unique de quotationId+periodStart) es la
    // protección real ante una carrera entre dos corridas del cron; no hace
    // falta un select previo.
    const inserted = await db.insert(quotationPriceAdjustments).values({
      quotationId: quotation.id,
      cadence: proposal.cadence,
      periodStart: proposal.periodStart.toISOString().slice(0, 10),
      periodEnd: proposal.periodEnd.toISOString().slice(0, 10),
      ipcAccumulatedPercentage: proposal.accumulatedIpcPercentage,
      previousTotalAmount: proposal.previousTotalAmount,
      proposedTotalAmount: proposal.proposedTotalAmount,
      status: "pending_approval",
    }).onConflictDoNothing().returning({ id: quotationPriceAdjustments.id });
    if (inserted.length === 0) {
      skippedDuplicate += 1;
    } else {
      created += 1;
    }
  }

  return { created, skippedDuplicate };
}

function dedupeMostRecentPerPeriod(
  rows: Array<{ year: number; month: number; monthlyPercentage: string | number }>,
): MonthlyIpcValue[] {
  const seen = new Map<string, MonthlyIpcValue>();
  for (const row of rows) {
    const key = `${row.year}-${row.month}`;
    if (seen.has(key)) continue; // ya vino uno más nuevo (orderBy fetchedAt desc)
    seen.set(key, { year: row.year, month: row.month, monthlyPercentage: Number(row.monthlyPercentage) });
  }
  return Array.from(seen.values());
}

export async function syncAndDetectIpcAdjustments(): Promise<void> {
  const { synced } = await syncIpcIndex();
  const { created } = await detectDuePriceAdjustments();
  // `synced` es la serie completa reprocesada (upsert idempotente), no
  // "cuántos cambiaron" — casi siempre es el mismo número. Loguear sólo
  // cuando hay algo para revisar (un ajuste nuevo) evita ruido diario que
  // termina tapando una falla real de sincronización.
  if (created > 0) {
    console.log(`[IPC price adjustments] ${synced} meses de IPC verificados, ${created} ajustes nuevos pendientes de aprobación`);
  }
}

export function startIpcPriceAdjustmentsJob(): void {
  // Una vez por día alcanza de sobra: el IPC se publica mensualmente.
  cron.schedule("30 6 * * *", async () => {
    try {
      await syncAndDetectIpcAdjustments();
    } catch (error) {
      console.error("[IPC price adjustments] Error sincronizando/detectando ajustes:", error);
    }
  }, { timezone: "America/Argentina/Buenos_Aires" });
}
