import { z } from "zod";
import {
  effectiveProbability,
  metrics,
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
export const shareTokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const publicShareRequestSchema = z.object({ token: shareTokenSchema });
/** Cabecera con la que la vista compartida envía el token (nunca en la URL). */
export const shareTokenHeader = "x-pipeline-share";

/** Universo visible desde un enlace: solo el pipeline comercial. */
export const isSharedUniverse = (r: Opportunity) => r.scope === "Pipeline";

export type PublicPipelineRow = ReturnType<typeof publicRow>;
/**
 * Lo único que sale de cada oportunidad por un enlace público. Es una lista
 * explícita: notas, evidencia, fuentes, contactos, cotizaciones, vínculos con
 * el CRM y facturación nunca se incluyen. Importes y probabilidades solo
 * cuando están respaldados.
 */
export function publicRow(
  r: Opportunity & { alerts?: string[]; modelProbability?: number | null },
) {
  return {
    id: r.id,
    account: r.account,
    project: r.project ?? null,
    stage: r.stage,
    status: r.status,
    scope: r.scope,
    usd: usableValue(r) ? r.usd : null,
    // Solo el número y su origen: el desglose (señales del equipo) no sale del equipo.
    probability: effectiveProbability(r).value,
    probabilityBasis: effectiveProbability(r).basis,
    weighted: metrics([r]).weighted,
    closeDate: r.closeDate ?? null,
    evidenceDate: r.evidenceDate ?? null,
    next: r.next ?? null,
    nextDate: r.nextDate ?? null,
    owner: r.owner ?? null,
    warner: !!r.warner,
    alerts: r.alerts ?? [],
  };
}
