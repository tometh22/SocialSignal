import { and, eq } from "drizzle-orm";
import { db } from "../db";
import {
  personnel,
  personnelCostSyncWarnings,
  personnelHistoricalCosts,
  type Personnel,
} from "@shared/schema";
import { deriveMonthlySalariesFromHourlyRates } from "@shared/utils/personnel-cost";
import {
  allowedSublevelsForRole,
  normalizePersonnelArea,
  normalizePersonnelRole,
  normalizePersonnelSublevel,
} from "@shared/utils/personnel-classification";
import { findPersonnelIdFuzzy, type ParsedSheetRow } from "./personnelSheetsSync";

const MONTH_NUMBER: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

export type PersonnelCostSyncWarning = {
  personnelId: number;
  personnelName: string;
  year: number;
  month: number;
  currency: "ARS" | "USD";
  code: "missing_monthly_hours" | "monthly_salary_mismatch";
  message: string;
};

export type PersonnelCostSyncResult = {
  updatedPersonnel: number;
  cellsUpdated: number;
  skipped: string[];
  warnings: PersonnelCostSyncWarning[];
};

function canonicalWarningKey(parts: Array<string | number | null | undefined>) {
  return parts.map((value) => String(value ?? "null").replace(/[^a-zA-Z0-9_.:-]/g, "_")).join(":");
}

async function persistWarning(input: {
  historicalCostId: number | null;
  person: Personnel;
  year: number;
  month: number;
  source: string;
  currency: "ARS" | "USD";
  code: PersonnelCostSyncWarning["code"];
  hourlyRate: number | null;
  suppliedMonthlySalary: number | null;
  derivedMonthlySalary: number | null;
  monthlyHoursSnapshot: number | null;
}) {
  const warningKey = canonicalWarningKey([
    "personnel-cost-sync",
    input.source,
    input.person.id,
    input.year,
    input.month,
    input.currency,
    input.code,
    input.hourlyRate,
    input.suppliedMonthlySalary,
    input.derivedMonthlySalary,
    input.monthlyHoursSnapshot,
  ]);
  await db.insert(personnelCostSyncWarnings).values({
    warningKey,
    historicalCostId: input.historicalCostId,
    personnelId: input.person.id,
    year: input.year,
    month: input.month,
    source: input.source,
    currency: input.currency,
    warningCode: input.code,
    hourlyRate: input.hourlyRate == null ? null : String(input.hourlyRate),
    suppliedMonthlySalary: input.suppliedMonthlySalary == null ? null : String(input.suppliedMonthlySalary),
    derivedMonthlySalary: input.derivedMonthlySalary == null ? null : String(input.derivedMonthlySalary),
    monthlyHoursSnapshot: input.monthlyHoursSnapshot,
  }).onConflictDoNothing({ target: personnelCostSyncWarnings.warningKey });
}

/**
 * Canonical Google Master -> personnel history synchronization.
 *
 * The source rate updates only its contractual currency. The other currency is
 * preserved, which is essential for mixed contracts. Salaries are always
 * derived from the merged hourly rates and the period snapshot. Any salary
 * supplied by the Master is comparison-only and can never overwrite the
 * derived result.
 */
export async function applyCanonicalPersonnelRateRows(
  sheetRows: ParsedSheetRow[],
  applyToSet: Set<string> | null,
  year: number,
  aliasBySheetName: Map<string, number | null>,
  personnelByName: Map<string, number>,
  allPersonnel: Personnel[],
  source = "google-master",
): Promise<PersonnelCostSyncResult> {
  let updatedPersonnel = 0;
  let cellsUpdated = 0;
  const skipped: string[] = [];
  const warnings: PersonnelCostSyncWarning[] = [];

  for (const row of sheetRows) {
    if (applyToSet !== null && !applyToSet.has(row.sheetName)) continue;

    const personnelId = aliasBySheetName.has(row.sheetName)
      ? aliasBySheetName.get(row.sheetName) ?? null
      : personnelByName.get(row.sheetName.trim().toLowerCase())
        ?? findPersonnelIdFuzzy(row.sheetName, personnelByName);
    const person = personnelId == null
      ? undefined
      : allPersonnel.find((candidate) => candidate.id === personnelId);
    if (!person) {
      skipped.push(row.sheetName);
      continue;
    }

    const currentRole = normalizePersonnelRole(row.currentRole)
      ?? (person.contractType === "freelance" ? normalizePersonnelRole(row.legacyRole) : null)
      ?? normalizePersonnelRole(person.currentRole)
      ?? person.currentRole;
    const candidateSublevel = normalizePersonnelSublevel(row.sublevel) ?? normalizePersonnelSublevel(person.sublevel);
    const sublevel = currentRole && candidateSublevel && allowedSublevelsForRole(currentRole).includes(candidateSublevel)
      ? candidateSublevel
      : person.sublevel;
    const metadata = {
      currentRole,
      sublevel,
      legacyRole: row.legacyRole ?? person.legacyRole,
      area: normalizePersonnelArea(row.area) ?? normalizePersonnelArea(person.area) ?? person.area,
    };
    const hasMetadata = Boolean(row.currentRole || row.sublevel || row.legacyRole || row.area);
    if (hasMetadata) {
      await db.update(personnel).set(metadata).where(eq(personnel.id, person.id));
    }

    let rowChanged = hasMetadata;
    for (const [periodKey, rate] of Object.entries(row.monthlyRates)) {
      const match = periodKey.match(/^([a-z]{3})(\d{4})$/);
      if (!match) continue;
      const month = MONTH_NUMBER[match[1]];
      const periodYear = Number(match[2]);
      if (!month || periodYear !== year || !Number.isFinite(rate)) continue;

      const [existing] = await db.select()
        .from(personnelHistoricalCosts)
        .where(and(
          eq(personnelHistoricalCosts.personnelId, person.id),
          eq(personnelHistoricalCosts.year, periodYear),
          eq(personnelHistoricalCosts.month, month),
          eq(personnelHistoricalCosts.isActive, true),
        ))
        .limit(1);

      // The Master exposes one adjusted rate column. USD contracts map it to
      // USD; ARS and mixed contracts map it to ARS without erasing the other
      // currency already stored for the period.
      const currency: "ARS" | "USD" = String(person.billingCurrency).toUpperCase() === "USD" ? "USD" : "ARS";
      const hourlyRateARS = currency === "ARS" ? rate : existing?.hourlyRateARS == null ? null : Number(existing.hourlyRateARS);
      const hourlyRateUSD = currency === "USD" ? rate : existing?.hourlyRateUSD == null ? null : Number(existing.hourlyRateUSD);
      const monthlyHoursSnapshot = existing?.monthlyHoursSnapshot ?? person.monthlyHours ?? null;
      const derived = deriveMonthlySalariesFromHourlyRates({
        monthlyHours: monthlyHoursSnapshot,
        hourlyRateARS,
        hourlyRateUSD,
      });

      let historicalCostId: number;
      if (existing) {
        const [updated] = await db.update(personnelHistoricalCosts).set({
          hourlyRateARS: hourlyRateARS == null ? null : String(hourlyRateARS),
          hourlyRateUSD: hourlyRateUSD == null ? null : String(hourlyRateUSD),
          monthlySalaryARS: derived.monthlySalaryARS == null ? null : String(derived.monthlySalaryARS),
          monthlySalaryUSD: derived.monthlySalaryUSD == null ? null : String(derived.monthlySalaryUSD),
          monthlyHoursSnapshot: derived.monthlyHoursSnapshot ?? null,
          updatedAt: new Date(),
        }).where(eq(personnelHistoricalCosts.id, existing.id)).returning({ id: personnelHistoricalCosts.id });
        historicalCostId = updated.id;
      } else {
        const [created] = await db.insert(personnelHistoricalCosts).values({
          personnelId: person.id,
          year: periodYear,
          month,
          hourlyRateARS: hourlyRateARS == null ? null : String(hourlyRateARS),
          hourlyRateUSD: hourlyRateUSD == null ? null : String(hourlyRateUSD),
          monthlySalaryARS: derived.monthlySalaryARS == null ? null : String(derived.monthlySalaryARS),
          monthlySalaryUSD: derived.monthlySalaryUSD == null ? null : String(derived.monthlySalaryUSD),
          monthlyHoursSnapshot: derived.monthlyHoursSnapshot ?? null,
          adjustmentReason: "Sync desde Valor Hora Real y Estimada",
        }).returning({ id: personnelHistoricalCosts.id });
        historicalCostId = created.id;
      }

      const suppliedMonthlySalary = row.monthlySalaries?.[periodKey] ?? null;
      const derivedMonthlySalary = currency === "USD"
        ? derived.monthlySalaryUSD ?? null
        : derived.monthlySalaryARS ?? null;
      if (derived.monthlyHoursSnapshot == null) {
        const warning: PersonnelCostSyncWarning = {
          personnelId: person.id,
          personnelName: person.name,
          year: periodYear,
          month,
          currency,
          code: "missing_monthly_hours",
          message: `${person.name}: ${month}/${periodYear} quedó sin sueldo derivado porque no hay horas mensuales configuradas.`,
        };
        warnings.push(warning);
        await persistWarning({
          historicalCostId,
          person,
          year: periodYear,
          month,
          source,
          currency,
          code: warning.code,
          hourlyRate: rate,
          suppliedMonthlySalary,
          derivedMonthlySalary,
          monthlyHoursSnapshot: null,
        });
      } else if (
        suppliedMonthlySalary != null
        && derivedMonthlySalary != null
        && Math.abs(suppliedMonthlySalary - derivedMonthlySalary) > 0.01
      ) {
        const warning: PersonnelCostSyncWarning = {
          personnelId: person.id,
          personnelName: person.name,
          year: periodYear,
          month,
          currency,
          code: "monthly_salary_mismatch",
          message: `${person.name}: el sueldo ${currency} recibido para ${month}/${periodYear} no coincide; prevaleció valor hora × horas.`,
        };
        warnings.push(warning);
        await persistWarning({
          historicalCostId,
          person,
          year: periodYear,
          month,
          source,
          currency,
          code: warning.code,
          hourlyRate: rate,
          suppliedMonthlySalary,
          derivedMonthlySalary,
          monthlyHoursSnapshot: derived.monthlyHoursSnapshot,
        });
      }

      cellsUpdated += 1;
      rowChanged = true;
    }
    if (rowChanged) updatedPersonnel += 1;
  }

  return { updatedPersonnel, cellsUpdated, skipped, warnings };
}
