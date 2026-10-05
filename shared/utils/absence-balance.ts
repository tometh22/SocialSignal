import { businessDaysByYear } from "./absence";

export type VacationAllowanceLedgerRow = { year: number; vacationDays: number; vacationCarryoverDays: number };
export type VacationAbsenceLedgerRow = { startDate: string; endDate: string };
export type VacationLedgerYear = { advanceDebtDays: number; usedDays: number; availableDays: number; balanceDays: number };

/**
 * Libro de vacaciones por año. Un único pool por año:
 *   disponible(Y) = vacationDays(Y) + vacationCarryoverDays(Y) − deudaEntrante(Y)
 *   saldo(Y)      = disponible(Y) − usados(Y)
 * Lo trasladado se suma al cupo del año (no hay orden de consumo ni vencimiento) y lo que
 * excede el disponible (override de Admin) pasa como deuda al año siguiente.
 */
export function calculateVacationLedger(
  throughYear: number,
  allowances: VacationAllowanceLedgerRow[],
  absences: VacationAbsenceLedgerRow[],
  holidayDates: ReadonlySet<string>,
): Record<number, VacationLedgerYear> {
  const allowanceByYear = new Map(allowances.map((row) => [row.year, row]));
  const usedByYear = new Map<number, number>();
  for (const absence of absences) {
    for (const [year, days] of Object.entries(businessDaysByYear(absence.startDate, absence.endDate, holidayDates))) {
      const numericYear = Number(year);
      usedByYear.set(numericYear, (usedByYear.get(numericYear) ?? 0) + days);
    }
  }

  const firstYear = allowances.reduce((min, row) => Math.min(min, row.year), throughYear);
  const ledger: Record<number, VacationLedgerYear> = {};
  let debt = 0;
  for (let year = firstYear; year <= throughYear; year++) {
    const allowance = allowanceByYear.get(year);
    const usedDays = usedByYear.get(year) ?? 0;
    if (allowance) {
      const availableDays = allowance.vacationDays + allowance.vacationCarryoverDays - debt;
      debt = Math.max(0, -availableDays + usedDays);
      ledger[year] = {
        advanceDebtDays: Math.max(0, allowance.vacationDays + allowance.vacationCarryoverDays - availableDays),
        usedDays,
        availableDays,
        balanceDays: availableDays - usedDays,
      };
    }
  }
  return ledger;
}

export type AbsenceBalanceInput = {
  year: number;
  allowances: Array<VacationAllowanceLedgerRow & { epicalDays: number | null }>;
  /** Sólo ausencias que descuentan (approved / cancellation_requested). */
  takenAbsences: Array<{ type: string; startDate: string; endDate: string }>;
  /** Ausencias pending: se informan aparte, no descuentan saldo. */
  pendingAbsences?: Array<{ type: string; startDate: string; endDate: string }>;
  holidayDates: ReadonlySet<string>;
};

export type AbsenceBalanceSummary = {
  year: number;
  configured: boolean;
  vacation: { quota: number | null; carryover: number; advanceDebt: number; available: number; used: number; balance: number; pending: number };
  epical: { quota: number | null; used: number; balance: number | null; pending: number };
  /** Días que no contabilizan contra cupo: se muestran para decidir al aprobar. */
  notCounted: { sick: number; other: number };
};

export function summarizeAbsenceBalance(input: AbsenceBalanceInput): AbsenceBalanceSummary {
  const { year, holidayDates } = input;
  const allowance = input.allowances.find((row) => row.year === year);
  const daysInYear = (row: { startDate: string; endDate: string }) => businessDaysByYear(row.startDate, row.endDate, holidayDates)[year] ?? 0;
  const sum = (rows: Array<{ type: string; startDate: string; endDate: string }>, type: string) =>
    rows.filter((row) => row.type === type).reduce((total, row) => total + daysInYear(row), 0);

  const ledger = calculateVacationLedger(
    year,
    input.allowances,
    input.takenAbsences.filter((row) => row.type === "vacation"),
    holidayDates,
  )[year];
  const epicalQuota = allowance?.epicalDays ?? null;
  const epicalUsed = sum(input.takenAbsences, "epical_day");
  const pending = input.pendingAbsences ?? [];

  return {
    year,
    configured: Boolean(allowance),
    vacation: {
      quota: allowance?.vacationDays ?? null,
      carryover: allowance?.vacationCarryoverDays ?? 0,
      advanceDebt: ledger?.advanceDebtDays ?? 0,
      available: ledger?.availableDays ?? 0,
      used: sum(input.takenAbsences, "vacation"),
      balance: ledger?.balanceDays ?? 0,
      pending: sum(pending, "vacation"),
    },
    epical: {
      quota: epicalQuota,
      used: epicalUsed,
      balance: epicalQuota == null ? null : Math.max(0, epicalQuota - epicalUsed),
      pending: sum(pending, "epical_day"),
    },
    notCounted: { sick: sum(input.takenAbsences, "sick"), other: sum(input.takenAbsences, "other") },
  };
}
