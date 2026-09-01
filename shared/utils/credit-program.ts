export type CreditProgram = {
  enabled: boolean;
  totalCredits: number;
  validityStart: string;
  validityEnd: string;
  carryoverPercentage: number;
  graceMonths: number;
  executiveCreditValueUSD: number;
  deepStudyCreditValueUSD: number;
  packagePriceUSD: number;
  hasActiveFee: boolean;
};

export const CREDIT_PROGRAM_DEFAULTS: Omit<CreditProgram, "packagePriceUSD"> = {
  enabled: false,
  totalCredits: 47,
  validityStart: "",
  validityEnd: "",
  carryoverPercentage: 20,
  graceMonths: 4,
  executiveCreditValueUSD: 500,
  deepStudyCreditValueUSD: 1500,
  hasActiveFee: true,
};

export const CREDIT_PROGRAM_LIMITS = {
  carryoverPercentage: { min: 0, max: 20 },
  graceMonths: { min: 0, max: 4 },
  executiveCreditValueUSD: { min: 500, max: 1900 },
  deepStudyCreditValueUSD: { min: 1500, max: 5800 },
} as const;

export function createDefaultCreditProgram(today = new Date()): CreditProgram {
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 12, 0);
  return {
    ...CREDIT_PROGRAM_DEFAULTS,
    validityStart: toDateInput(start),
    validityEnd: toDateInput(end),
    packagePriceUSD: CREDIT_PROGRAM_DEFAULTS.totalCredits * CREDIT_PROGRAM_DEFAULTS.executiveCreditValueUSD,
  };
}

export function calculateCreditProgramTotals(program: Pick<CreditProgram, "totalCredits" | "carryoverPercentage" | "graceMonths" | "packagePriceUSD">) {
  const totalCredits = Math.max(0, Math.floor(Number(program.totalCredits) || 0));
  const carryoverPercentage = Math.min(CREDIT_PROGRAM_LIMITS.carryoverPercentage.max, Math.max(0, Number(program.carryoverPercentage) || 0));
  return {
    totalCredits,
    carryoverCredits: Math.floor(totalCredits * carryoverPercentage / 100),
    graceMonths: Math.min(CREDIT_PROGRAM_LIMITS.graceMonths.max, Math.max(0, Math.floor(Number(program.graceMonths) || 0))),
    packagePriceUSD: Math.max(0, Number(program.packagePriceUSD) || 0),
  };
}

export function toDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
