import { z } from "zod";
import {
  isOpenOpportunity,
  localDay,
  metrics,
  stages,
  summarize,
  usableProbability,
  usableValue,
  type Opportunity,
} from "./pipeline";

/** Vencimientos ofrecidos al crear un enlace de solo lectura. `null` = sin vencimiento. */
export const shareExpiryDays = [7, 30, 90] as const;
export const createShareLinkSchema = z.object({
  label: z.string().trim().min(1).max(80),
  expiresInDays: z
    .union([z.literal(7), z.literal(30), z.literal(90), z.null()])
    .default(30),
});
export const publicShareRequestSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
});

export type PublicPipelineRow = {
  account: string;
  project: string | null;
  stage: string;
  status: string;
  usd: string | null;
  probability: string | null;
  weighted: string | null;
  closeDate: string | null;
  next: string | null;
  nextDate: string | null;
  owner: string | null;
  warner: boolean;
};
export type PublicPipeline = ReturnType<typeof publicPipeline>;

/**
 * Lo único que ve quien abre un enlace público: el pipeline abierto, con
 * importes y probabilidades solo cuando están respaldados. Es una lista
 * explícita de campos: notas, evidencia, fuentes, contactos, identificadores,
 * cotizaciones y facturación nunca salen por aquí.
 */
export function publicPipeline(
  rows: Opportunity[],
  generatedAt: string,
  label: string,
  expiresAt: string | null,
) {
  const day = localDay(new Date(generatedAt));
  const s = summarize(rows, day);
  const open = rows.filter(isOpenOpportunity);
  const stageOrder = (stage: string) =>
    stages.indexOf(stage as (typeof stages)[number]);
  return {
    label,
    generatedAt,
    expiresAt,
    summary: {
      open: s.open,
      gross: s.gross,
      weighted: s.weighted,
      valueCoverage: s.valueCoverage,
      weightedCoverage: s.weightedCoverage,
      stages: s.stages
        .filter((x) => x.open > 0)
        .map(
          ({
            stage,
            open,
            gross,
            weighted,
            valueCoverage,
            weightedCoverage,
          }) => ({
            stage,
            open,
            gross,
            weighted,
            valueCoverage,
            weightedCoverage,
          }),
        ),
      warner: { open: s.warner.open, valuePct: s.warner.valuePct },
    },
    rows: open
      .map((r): PublicPipelineRow => ({
        account: r.account,
        project: r.project ?? null,
        stage: r.stage,
        status: r.status,
        usd: usableValue(r) ? r.usd : null,
        probability: usableProbability(r) ? r.probability : null,
        weighted: metrics([r]).weighted,
        closeDate: r.closeDate ?? null,
        next: r.next ?? null,
        nextDate: r.nextDate ?? null,
        owner: r.owner ?? null,
        warner: !!r.warner,
      }))
      .sort(
        (a, b) =>
          stageOrder(b.stage) - stageOrder(a.stage) ||
          Number(b.usd ?? -1) - Number(a.usd ?? -1) ||
          a.account.localeCompare(b.account, "es"),
      ),
  };
}
