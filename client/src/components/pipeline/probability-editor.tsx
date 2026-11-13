import type { ReactNode } from "react";
import { Check, Gauge, ThumbsDown, ThumbsUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  isOpenOpportunity,
  localDay,
  usableProbability,
  type Opportunity,
} from "@shared/pipeline";
import {
  scoreOpportunity,
  type ModelScore,
  type ProbabilityModel,
} from "@shared/pipeline-probability";
import { pct, pendingText } from "./ui";

export type Methodology = {
  version: number;
  model: ProbabilityModel;
  basis: string;
  approvedBy: string | null;
  approvedAt: string;
};

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/** Probabilidad congelada en un corte guardado (la calculó el servidor al guardarlo). */
export type FrozenScore = (ModelScore & { version?: number }) | null;

/** Probabilidad del modelo para la ficha que se está editando. */
export function draftScore(
  draft: Opportunity,
  methodology: Methodology | null | undefined,
  existingClient: boolean,
) {
  if (!methodology || !isOpenOpportunity(draft)) return null;
  return scoreOpportunity(draft, methodology.model, {
    existingClient,
    today: localDay(),
  });
}

function Toggle({
  checked,
  disabled,
  onChange,
  children,
  points,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  points: number;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-default",
        checked
          ? "border-primary/30 bg-primary/5 text-slate-900"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
      )}
    >
      <span className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
            checked
              ? "border-primary bg-primary text-white"
              : "border-slate-300",
          )}
        >
          {checked && <Check className="h-3 w-3" />}
        </span>
        {children}
      </span>
      <span
        className={cn(
          "shrink-0 text-xs font-semibold tabular-nums",
          points >= 0 ? "text-emerald-700" : "text-red-700",
        )}
      >
        {signed(points)}
      </span>
    </button>
  );
}

export function ProbabilityEditor({
  draft,
  change,
  readOnly,
  methodology,
  existingClient,
  userName,
  ownProbabilityFields,
  frozen,
}: {
  draft: Opportunity;
  change: (key: keyof Opportunity, value: any) => void;
  readOnly: boolean;
  methodology: Methodology | null | undefined;
  existingClient: boolean;
  userName: string;
  ownProbabilityFields: ReactNode;
  /**
   * En un corte guardado se muestra lo que quedó congelado, nunca un recálculo
   * con la metodología o la fecha actuales. `undefined` = ficha editable.
   */
  frozen?: FrozenScore;
}) {
  const isFrozen = frozen !== undefined;
  const model = isFrozen ? undefined : methodology?.model;
  const score = isFrozen
    ? frozen
    : draftScore(draft, methodology, existingClient);
  const own = usableProbability(draft);
  const open = isOpenOpportunity(draft);
  const manual = draft.manualAdjustment;
  const setManual = (points: number, reason: string) =>
    change(
      "manualAdjustment",
      !points && !reason.trim()
        ? null
        : { points, reason, by: userName || null, at: localDay() },
    );
  const manualAge = manual
    ? Math.round((Date.parse(localDay()) - Date.parse(manual.at)) / 86_400_000)
    : 0;
  return (
    <div className="space-y-5 border-t pt-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <Gauge className="h-4 w-4 text-slate-500" />
            Probabilidad de cierre
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {isFrozen
              ? frozen
                ? `Valor congelado en el corte${frozen.version ? ` con la metodología v${frozen.version}` : ""}.`
                : "Este corte se guardó sin probabilidad del modelo."
              : methodology
                ? `Modelo v${methodology.version} aprobado por ${methodology.approvedBy ?? "el equipo"}. Una probabilidad propia respaldada lo reemplaza.`
                : "Sin metodología aprobada: solo cuenta una probabilidad propia respaldada."}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums">
            {own ? (
              pct(draft.probability)
            ) : score?.probability != null ? (
              `${score.probability}%`
            ) : (
              <span className={cn("text-lg font-medium", pendingText)}>
                Pendiente
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {own
              ? "propia"
              : score
                ? "estimada por el modelo"
                : open
                  ? ""
                  : "solo para el pipeline abierto"}
          </p>
        </div>
      </div>

      {score && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
            Cómo se calcula
          </p>
          <dl className="space-y-1 text-sm">
            {score.parts.map((p) => (
              <div
                key={p.key}
                className="flex items-baseline justify-between gap-4"
              >
                <dt
                  className={cn(
                    "min-w-0",
                    p.kind === "team" || p.kind === "manual"
                      ? "text-indigo-700"
                      : "text-slate-600",
                  )}
                >
                  {p.kind === "team" || p.kind === "manual" ? "Equipo · " : ""}
                  {p.label}
                </dt>
                <dd className="shrink-0 font-medium tabular-nums">
                  {p.kind === "base" ? `${p.points}%` : signed(p.points)}
                </dd>
              </div>
            ))}
            {score.teamTotal !==
              score.parts
                .filter((p) => p.kind === "team" || p.kind === "manual")
                .reduce((s, p) => s + p.points, 0) && (
              <p className="text-xs text-muted-foreground">
                El criterio del equipo se limita a {signed(score.teamTotal)}
                {model ? ` (tope ±${model.maxTeamAdjustment})` : ""}.
              </p>
            )}
            <div className="flex items-baseline justify-between gap-4 border-t border-slate-200 pt-2 font-semibold">
              <dt>Probabilidad del modelo</dt>
              <dd className="tabular-nums">{score.probability}%</dd>
            </div>
          </dl>
          {own && (
            <p className="mt-2 text-xs text-amber-700">
              Se usa la probabilidad propia ({pct(draft.probability)}) porque
              está respaldada.
            </p>
          )}
        </div>
      )}

      {model && open && (
        <>
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">
              Señales de la oportunidad
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Toggle
                checked={!!draft.renewal}
                disabled={readOnly}
                points={model.automatic.renewal}
                onChange={(v) => change("renewal", v)}
              >
                Renovación de un servicio vigente
              </Toggle>
              <Toggle
                checked={!!draft.decisionMakerConfirmed}
                disabled={readOnly}
                points={model.automatic.decisionMaker}
                onChange={(v) => change("decisionMakerConfirmed", v)}
              >
                Decisor y presupuesto confirmados
              </Toggle>
              <Toggle
                checked={!!draft.competition}
                disabled={readOnly}
                points={model.automatic.competition}
                onChange={(v) => change("competition", v)}
              >
                Licitación o compite con otros
              </Toggle>
            </div>
            <p className="text-xs text-muted-foreground">
              Automáticas: cliente actual{" "}
              {signed(model.automatic.existingClient)} · decisión en{" "}
              {model.automatic.closeDateWithinDays} días o menos{" "}
              {signed(model.automatic.knownCloseDate)} · sin novedades hace más
              de {model.automatic.staleAfterDays} días{" "}
              {signed(model.automatic.stalePenalty)}.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">
              Criterio del equipo{" "}
              <span className="font-normal text-muted-foreground">
                (tope ±{model.maxTeamAdjustment})
              </span>
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {model.teamSignals.map((t) => {
                const on = (draft.teamSignals ?? []).includes(t.key);
                return (
                  <Toggle
                    key={t.key}
                    checked={on}
                    disabled={readOnly}
                    points={t.points}
                    onChange={(v) =>
                      change(
                        "teamSignals",
                        v
                          ? [...(draft.teamSignals ?? []), t.key]
                          : (draft.teamSignals ?? []).filter(
                              (k) => k !== t.key,
                            ),
                      )
                    }
                  >
                    {t.label}
                  </Toggle>
                );
              })}
            </div>
            <div className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)]">
              <label className="space-y-1">
                <span className="block text-xs font-medium text-slate-600">
                  Ajuste libre (±{model.manualRange})
                </span>
                <Input
                  type="number"
                  min={-model.manualRange}
                  max={model.manualRange}
                  step={1}
                  value={manual?.points ?? ""}
                  placeholder="0"
                  readOnly={readOnly}
                  onChange={(e) => {
                    const v = Math.max(
                      -model.manualRange,
                      Math.min(
                        model.manualRange,
                        Math.round(Number(e.target.value) || 0),
                      ),
                    );
                    setManual(v, manual?.reason ?? "");
                  }}
                />
              </label>
              <label className="space-y-1">
                <span className="block text-xs font-medium text-slate-600">
                  Motivo del ajuste
                </span>
                <Input
                  value={manual?.reason ?? ""}
                  placeholder="Ej.: la gerente nos adelantó que el comité ya nos eligió"
                  readOnly={readOnly}
                  onChange={(e) =>
                    setManual(manual?.points ?? 0, e.target.value)
                  }
                />
              </label>
            </div>
            {manual && (
              <p
                className={cn(
                  "text-xs",
                  manualAge > model.manualExpiryDays
                    ? "text-amber-700"
                    : "text-muted-foreground",
                )}
              >
                {manual.points && manual.reason.trim().length < 3
                  ? "Escribí el motivo para que el ajuste cuente."
                  : manualAge > model.manualExpiryDays
                    ? `Ajuste vencido (${manualAge} días): reconfirmalo para que vuelva a contar.`
                    : `Firmado por ${manual.by ?? "el equipo"} · vence en ${model.manualExpiryDays - manualAge} días.`}
              </p>
            )}
          </div>
        </>
      )}

      <details className="rounded-xl border p-4" open={!!draft.probability}>
        <summary className="cursor-pointer text-sm font-medium">
          Probabilidad propia (reemplaza al modelo)
        </summary>
        <p className="mb-4 mt-2 text-xs text-muted-foreground">
          Usala cuando hay un dato concreto del cliente. Requiere motivo y una
          fuente de evidencia.
        </p>
        {ownProbabilityFields}
      </details>

      {open && !readOnly && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-slate-200 p-3">
          <span className="text-sm text-slate-600">Cerrar la oportunidad:</span>
          <Button
            type="button"
            variant="outline"
            className="h-8 gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            onClick={() => {
              change("stage", "Confirmada");
              change("status", "Confirmada");
              change("scope", "Cerrada / confirmada");
            }}
          >
            <ThumbsUp className="h-3.5 w-3.5" /> Ganada
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-8 gap-1.5 border-red-200 text-red-700 hover:bg-red-50"
            onClick={() => {
              change("status", "Descartada");
              change("scope", "Descartada");
            }}
          >
            <ThumbsDown className="h-3.5 w-3.5" /> Perdida
          </Button>
          <span className="w-full text-xs text-muted-foreground">
            Guardá con el motivo (por ejemplo "eligieron otro proveedor" o
            "dejaron de responder"): queda registrado y el modelo aprende de
            cada cierre.
          </span>
        </div>
      )}
    </div>
  );
}
