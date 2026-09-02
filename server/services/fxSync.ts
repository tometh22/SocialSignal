import { db } from "../db";
import { exchangeRates, systemConfig } from "../../shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { fetchLiveBlueRates } from "./liveFx";
import { isClosedPeriod } from "../../shared/utils/fx-periods";

export { isClosedPeriod };

type UpsertInput = {
  year: number;
  month: number;
  rate: number;
  rateType: "end_of_month" | "daily" | "average" | "estimated";
  source: "Blue" | "REM" | "BCRA" | "MEP" | "CCL" | "Manual";
  specificDate?: Date | null;
  notes?: string | null;
  createdBy: number;
};

async function upsertRate(input: UpsertInput) {
  if (input.rateType !== "estimated") {
    await db.update(exchangeRates).set({
      isActive: false,
      updatedAt: new Date(),
      updatedBy: input.createdBy,
    }).where(and(
      eq(exchangeRates.year, input.year),
      eq(exchangeRates.month, input.month),
      eq(exchangeRates.rateType, "estimated"),
      eq(exchangeRates.isActive, true),
    ));
  }
  const existing = await db
    .select()
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.year, input.year),
        eq(exchangeRates.month, input.month),
        eq(exchangeRates.rateType, input.rateType),
        eq(exchangeRates.source as any, input.source),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(exchangeRates)
      .set({
        rate: String(input.rate),
        specificDate: input.specificDate ?? null,
        notes: input.notes ?? null,
        updatedBy: input.createdBy,
        updatedAt: new Date(),
      })
      .where(eq(exchangeRates.id, existing[0].id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(exchangeRates)
    .values({
      year: input.year,
      month: input.month,
      rate: String(input.rate),
      rateType: input.rateType,
      source: input.source,
      specificDate: input.specificDate ?? null,
      notes: input.notes ?? null,
      isActive: true,
      createdBy: input.createdBy,
    })
    .returning();
  return created;
}

/**
 * Trae el dólar blue actual desde dolarapi.com (API pública, sin autenticación).
 * Retorna el valor de venta del último día hábil y upsertea en exchangeRates
 * como rate daily + source Blue para el mes y año en curso.
 */
export async function syncBlueToday(createdBy: number) {
  const verification = await fetchLiveBlueRates();
  const rate = verification.recommended.sell;
  const fetchedAt = verification.recommended.updatedAt
    ? new Date(verification.recommended.updatedAt)
    : new Date();
  const year = fetchedAt.getFullYear();
  const month = fetchedAt.getMonth() + 1;

  const saved = await upsertRate({
    year,
    month,
    rate,
    rateType: "daily",
    source: "Blue",
    specificDate: fetchedAt,
    notes: `Auto-sync ${verification.recommended.source} · compra ${verification.recommended.buy} / venta ${rate} · verificación ${verification.status}`,
    createdBy,
  });
  await db.insert(systemConfig)
    .values({
      configKey: "usd_exchange_rate",
      configValue: rate,
      description: `${verification.recommended.source} Blue venta · verificación ${verification.status}`,
      updatedBy: createdBy,
    })
    .onConflictDoUpdate({
      target: systemConfig.configKey,
      set: {
        configValue: rate,
        description: `${verification.recommended.source} Blue venta · verificación ${verification.status}`,
        updatedAt: new Date(),
        updatedBy: createdBy,
      },
    });
  return { rate, fetchedAt, saved, verification };
}

/**
 * Registra un tipo de cambio observado (Máster, BCRA, cierre manual) y retira la
 * proyección del mismo período. Sin esto un mes importado como REM seguía
 * rotulado "proyectado" para siempre aunque después llegara el valor real.
 */
export async function recordObservedRate(input: {
  year: number;
  month: number;
  rate: number;
  source: string;
  createdBy: number;
  notes?: string | null;
}) {
  if (!Number.isFinite(input.rate) || input.rate <= 0) {
    throw new Error(`Tipo de cambio inválido para ${input.month}/${input.year}: ${input.rate}`);
  }
  const rateType = isClosedPeriod(input.year, input.month) ? "end_of_month" : "daily";
  await db.update(exchangeRates).set({
    isActive: false,
    updatedAt: new Date(),
    updatedBy: input.createdBy,
  }).where(and(
    eq(exchangeRates.year, input.year),
    eq(exchangeRates.month, input.month),
    eq(exchangeRates.rateType, "estimated"),
    eq(exchangeRates.isActive, true),
  ));

  const [existing] = await db.select().from(exchangeRates).where(and(
    eq(exchangeRates.year, input.year),
    eq(exchangeRates.month, input.month),
    eq(exchangeRates.source as any, input.source),
    sql`${exchangeRates.rateType} <> 'estimated'`,
  )).limit(1);

  // El tipo de cambio "vigente" que usa el resto de la app (useCurrency, la
  // confirmación de cotizaciones nuevas) vive aparte, en system_config, y
  // sólo lo actualizaba el botón manual de "Sincronizar dólar blue". Si nadie
  // lo clickeaba, esa referencia quedaba vieja o vacía aunque la sync
  // automática del Máster sí estuviera trayendo datos al día. Se actualiza acá
  // también, sólo para el mes en curso (rateType "daily"): un mes ya cerrado
  // que se está registrando en el histórico no debe pisar la referencia de hoy.
  if (rateType === "daily") {
    await db.insert(systemConfig).values({
      configKey: "usd_exchange_rate",
      configValue: input.rate,
      description: `${input.source} · sincronización automática del Máster`,
      updatedBy: input.createdBy,
    }).onConflictDoUpdate({
      target: systemConfig.configKey,
      set: {
        configValue: input.rate,
        description: `${input.source} · sincronización automática del Máster`,
        updatedAt: new Date(),
        updatedBy: input.createdBy,
      },
    });
  }

  if (existing) {
    const [updated] = await db.update(exchangeRates).set({
      rate: String(input.rate),
      rateType,
      isActive: true,
      notes: input.notes ?? existing.notes,
      updatedAt: new Date(),
      updatedBy: input.createdBy,
    }).where(eq(exchangeRates.id, existing.id)).returning();
    return updated;
  }

  const [created] = await db.insert(exchangeRates).values({
    year: input.year,
    month: input.month,
    rate: String(input.rate),
    rateType,
    source: input.source,
    notes: input.notes ?? null,
    isActive: true,
    createdBy: input.createdBy,
  }).returning();
  return created;
}

/**
 * Reclasifica como cierre real toda proyección activa de un período ya cerrado
 * que además tenga un valor observado. Corre después de cada sincronización para
 * que "proyectado" signifique siempre "mes que todavía no terminó".
 */
export async function demoteStaleProjections(actorUserId: number) {
  const { rowCount } = await db.execute(sql`
    UPDATE exchange_rates AS projection
    SET is_active = FALSE, updated_at = NOW(), updated_by = ${actorUserId}
    WHERE projection.rate_type = 'estimated'
      AND projection.is_active = TRUE
      AND (projection.year * 100 + projection.month) < (
        EXTRACT(YEAR FROM (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires'))::int * 100
        + EXTRACT(MONTH FROM (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires'))::int
      )
      AND EXISTS (
        SELECT 1 FROM exchange_rates AS observed
        WHERE observed.year = projection.year
          AND observed.month = projection.month
          AND observed.rate_type <> 'estimated'
          AND observed.is_active = TRUE
      )
  `);
  return rowCount ?? 0;
}

type RemEstimate = { year: number; month: number; rate: number };

/**
 * Importa un set de estimaciones REM (BCRA) en bloque. El BCRA no expone API
 * pública para REM, por eso el input se provee desde el Excel oficial.
 * Upsertea cada estimación como rateType "estimated" + source "REM".
 */
export async function importRemEstimates(estimates: RemEstimate[], createdBy: number) {
  const saved = [];
  for (const est of estimates) {
    if (
      !Number.isFinite(est.year) ||
      !Number.isFinite(est.month) ||
      est.month < 1 ||
      est.month > 12 ||
      !Number.isFinite(est.rate) ||
      est.rate <= 0
    ) {
      continue;
    }
    // Un mes que ya terminó no admite proyección: o hay dato observado o queda
    // vacío, pero nunca se rotula como estimación a futuro.
    if (isClosedPeriod(est.year, est.month)) continue;
    const [observed] = await db.select({ id: exchangeRates.id }).from(exchangeRates).where(and(
      eq(exchangeRates.year, est.year),
      eq(exchangeRates.month, est.month),
      eq(exchangeRates.isActive, true),
      sql`${exchangeRates.rateType} <> 'estimated'`,
    )).limit(1);
    if (observed) continue;
    const row = await upsertRate({
      year: est.year,
      month: est.month,
      rate: est.rate,
      rateType: "estimated",
      source: "REM",
      notes: "REM BCRA · importado",
      createdBy,
    });
    saved.push(row);
  }
  return saved;
}
