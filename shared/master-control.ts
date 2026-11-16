/** Monthly control between the Máster spreadsheet and Mind. Amounts in USD. */
export type MasterControlCheck = {
  id: string;
  /** "sync": Mind must equal the Máster detail. "master": the Máster summary must agree with its own detail. */
  kind: "sync" | "master";
  label: string;
  /** What the person should do when the check fails. */
  hint: string;
  expectedLabel: string;
  expectedUsd: number | null;
  actualLabel: string;
  actualUsd: number | null;
  differenceUsd: number | null;
  ok: boolean;
};

export type MasterControlReport = {
  period: string;
  source: "master" | "mind";
  checkedAt: string;
  checks: MasterControlCheck[];
  /** Pending items reported by the monthly reconciliation (e.g. costs without amount). */
  pending: string[];
};

export const MASTER_CONTROL_TOLERANCE_USD = 1;

export function controlCheck(input: Omit<MasterControlCheck, "differenceUsd" | "ok">, tolerance = MASTER_CONTROL_TOLERANCE_USD): MasterControlCheck {
  const round = (value: number) => Math.round(value * 100) / 100;
  const expected = input.expectedUsd == null ? null : round(input.expectedUsd);
  const actual = input.actualUsd == null ? null : round(input.actualUsd);
  // A month without data on either side (e.g. not yet loaded) is not a difference.
  if (!expected && !actual) return { ...input, expectedUsd: expected, actualUsd: actual, differenceUsd: 0, ok: true };
  const differenceUsd = round((actual ?? 0) - (expected ?? 0));
  return { ...input, expectedUsd: expected, actualUsd: actual, differenceUsd, ok: Math.abs(differenceUsd) <= tolerance };
}
