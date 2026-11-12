import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { civilDate, money, pct, pendingText } from "./ui";

// Solo se muestran estos campos, en este orden y con las etiquetas de la ficha.
// Los identificadores internos (leadId, clientId, inputHash…) quedan fuera.
export const fieldLabels: Record<string, string> = {
  account: "Cuenta",
  project: "Proyecto",
  stage: "Etapa",
  stageReason: "Fundamento de la etapa",
  status: "Estado",
  scope: "Alcance",
  exclusionReason: "Motivo de exclusión",
  eligible: "Vigencia",
  usd: "Valor USD",
  valueNote: "Fundamento del importe",
  originalAmount: "Precio original",
  currency: "Moneda original",
  priceBasis: "Base del precio",
  durationMonths: "Duración · meses",
  probability: "Probabilidad",
  probabilityReason: "Motivo de probabilidad",
  probabilitySource: "Fuente de probabilidad",
  closeDate: "Fecha objetivo",
  next: "Próximo paso",
  nextDate: "Fecha próximo paso",
  owner: "Responsable",
  contact: "Contacto",
  confidence: "Confianza",
  warner: "Grupo Warner",
  warnerBasis: "Fundamento del vínculo Warner",
  evidence: "Evidencia",
  evidenceDate: "Fecha de evidencia",
  sources: "Fuentes",
  notes: "Notas",
  threshold: "Umbral operativo",
  steps: "Checklist",
  period: "Período",
};
const order = Object.keys(fieldLabels);
const byOrder = (a: { key: string }, b: { key: string }) =>
  order.indexOf(a.key) - order.indexOf(b.key);
const shown = (k: string) => k in fieldLabels;
const empty = (v: unknown) =>
  v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length);

export function formatValue(key: string, v: unknown): string {
  if (empty(v)) return "vacío";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (key === "usd") return `USD ${money(v)}`;
  if (key === "originalAmount") return money(v);
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
export type ChangeSet = {
  /** edit: antes → después · create: datos iniciales · values: valores registrados. */
  mode: "edit" | "create" | "values";
  items: Change[];
};
/** Normaliza los distintos formatos auditados (edición, alta, conciliación, umbral…). */
export function describeChanges(changes: any): ChangeSet {
  if (!changes || typeof changes !== "object")
    return { mode: "values", items: [] };
  const after = changes.after;
  if (after && typeof after === "object") {
    const before = changes.before;
    if (!before || typeof before !== "object")
      return {
        mode: "create",
        items: Object.keys(after)
          .filter((k) => shown(k) && !empty(after[k]))
          .map((k) => ({ key: k, after: after[k] }))
          .sort(byOrder),
      };
    return {
      mode: "edit",
      items: Object.keys({ ...before, ...after })
        .filter(
          (k) =>
            shown(k) &&
            JSON.stringify(after[k] ?? null) !==
              JSON.stringify(before[k] ?? null),
        )
        .map((k) => ({
          key: k,
          before: before[k] ?? null,
          after: after[k] ?? null,
        }))
        .sort(byOrder),
    };
  }
  return {
    mode: "values",
    items: Object.keys(changes)
      .filter((k) => shown(k) && !empty(changes[k]))
      .map((k) => ({ key: k, after: changes[k] }))
      .sort(byOrder),
  };
}

export function ChangeList({ changes }: { changes: any }) {
  const { items: list } = describeChanges(changes);
  if (!list.length)
    return (
      <p className={cn("text-xs", pendingText)}>Sin campos para mostrar.</p>
    );
  return (
    <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-slate-50/50 text-sm">
      {list.map(({ key, before, after }) => (
        <div
          key={key}
          className="grid gap-x-4 gap-y-1 px-3 py-2 sm:grid-cols-[170px_minmax(0,1fr)]"
        >
          <dt className="font-medium text-slate-600">{fieldLabels[key]}</dt>
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
