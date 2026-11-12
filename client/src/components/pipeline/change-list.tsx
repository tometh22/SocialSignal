import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { civilDate, money, pct, pendingText } from "./ui";

export const fieldLabels: Record<string, string> = {
  account: "Cuenta",
  project: "Proyecto",
  stage: "Etapa",
  status: "Estado",
  scope: "Alcance",
  usd: "Valor USD",
  probability: "Probabilidad",
  probabilityReason: "Motivo de probabilidad",
  probabilitySource: "Fuente de probabilidad",
  closeDate: "Fecha objetivo",
  next: "Próximo paso",
  nextDate: "Fecha próximo paso",
  owner: "Responsable",
  ownerId: "Responsable",
  contact: "Contacto",
  evidence: "Evidencia",
  evidenceDate: "Fecha de evidencia",
  sources: "Fuentes",
  notes: "Notas",
  confidence: "Confianza",
  warner: "Grupo Warner",
  eligible: "Vigencia",
  valueNote: "Fundamento del importe",
  threshold: "Umbral operativo",
  steps: "Checklist",
  period: "Período",
};
// Campos técnicos que no aportan a la lectura del cambio.
const hidden = new Set([
  "id",
  "version",
  "reason",
  "requestKey",
  "payload",
  "created_at",
  "created_by",
  "updated_at",
  "updated_by",
  "importKey",
  "alerts",
]);
const empty = (v: unknown) =>
  v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length);

export function formatValue(key: string, v: unknown): string {
  if (empty(v)) return "vacío";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (key === "usd") return `USD ${money(v)}`;
  if (key === "probability" || key === "threshold") return pct(v);
  if (key === "steps" && Array.isArray(v))
    return `${v.filter(Boolean).length}/${v.length} pasos`;
  if (key === "sources" && Array.isArray(v))
    return `${v.length} ${v.length === 1 ? "fuente" : "fuentes"}`;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v))
    return civilDate(v);
  if (typeof v === "object") {
    const json = JSON.stringify(v);
    return json.length > 80 ? `${json.slice(0, 80)}…` : json;
  }
  const text = String(v);
  return text.length > 140 ? `${text.slice(0, 140)}…` : text;
}

type Change = { key: string; before?: unknown; after: unknown };
/** Normaliza los distintos formatos auditados (edición, alta, umbral, corte…). */
export function describeChanges(changes: any): Change[] {
  if (!changes || typeof changes !== "object") return [];
  if (changes.after && typeof changes.after === "object") {
    return Object.keys(changes.after)
      .filter(
        (k) =>
          !hidden.has(k) &&
          JSON.stringify(changes.after[k]) !==
            JSON.stringify(changes.before?.[k]),
      )
      .map((k) => ({
        key: k,
        before: changes.before?.[k] ?? null,
        after: changes.after[k],
      }));
  }
  return Object.keys(changes)
    .filter((k) => !hidden.has(k) && !empty(changes[k]))
    .map((k) => ({ key: k, after: changes[k] }));
}

export function ChangeList({ changes }: { changes: any }) {
  const list = describeChanges(changes);
  if (!list.length)
    return (
      <p className={cn("text-xs", pendingText)}>
        Sin cambios de campos: es un registro de decisión.
      </p>
    );
  return (
    <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-slate-50/50 text-sm">
      {list.map(({ key, before, after }) => (
        <div
          key={key}
          className="grid gap-x-4 gap-y-1 px-3 py-2 sm:grid-cols-[170px_minmax(0,1fr)]"
        >
          <dt className="font-medium text-slate-600">
            {fieldLabels[key] ?? key}
          </dt>
          <dd className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            {before !== undefined && (
              <>
                <span
                  className={cn(
                    "break-words",
                    empty(before)
                      ? pendingText
                      : "text-slate-500 line-through decoration-slate-300",
                  )}
                >
                  {formatValue(key, before)}
                </span>
                <ArrowRight
                  className="h-3.5 w-3.5 shrink-0 self-center text-slate-400"
                  aria-label="pasa a"
                />
              </>
            )}
            <span
              className={cn(
                "break-words",
                empty(after) ? pendingText : "font-medium text-slate-900",
              )}
            >
              {formatValue(key, after)}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
