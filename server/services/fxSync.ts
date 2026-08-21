import { db } from "../db";
import { exchangeRates, systemConfig } from "../../shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { fetchLiveBlueRates } from "./liveFx";

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
