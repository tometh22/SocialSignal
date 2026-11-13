import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, authFetchJson, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  modelStages,
  type Learning,
  type ProbabilityModel,
} from "@shared/pipeline-probability";
import { cardBase, civilDate, pendingText, tableHead } from "./ui";

const base = "/api/crm/pipeline";
type MethodologyResponse = {
  version: number;
  model: ProbabilityModel;
  basis: string;
  approvedBy: string | null;
  approvedAt: string;
  history: {
    version: number;
    basis: string;
    approvedBy: string | null;
    approvedAt: string;
  }[];
} | null;
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "senal";

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={cn(cardBase, "overflow-hidden")}>
      <div className="flex items-start justify-between gap-4 border-b border-border/60 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}
function Num({
  value,
  edit,
  onChange,
  suffix,
  min = -50,
  max = 100,
}: {
  value: number;
  edit: boolean;
  onChange: (v: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
}) {
  return edit ? (
    <Input
      type="number"
      className="ml-auto h-8 w-20 text-right tabular-nums"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(Math.round(Number(e.target.value) || 0))}
    />
  ) : (
    <span className="font-medium tabular-nums">
      {suffix === "%"
        ? `${value}%`
        : suffix
          ? `${value} ${suffix}`
          : signed(value)}
    </span>
  );
}

export function ProbabilityPanel({ isAdmin }: { isAdmin: boolean }) {
  const methodology = useQuery<MethodologyResponse>({
    queryKey: [base, "/methodology"],
    queryFn: () => authFetchJson(base + "/methodology"),
  });
  const learning = useQuery<{
    learning: Learning;
    suggested: ProbabilityModel;
  } | null>({
    queryKey: [base, "/learning"],
    queryFn: () => authFetchJson(base + "/learning"),
  });
  const [draft, setDraft] = useState<ProbabilityModel | null>(null);
  const [basis, setBasis] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const m = methodology.data;
  if (methodology.isLoading)
    return (
      <div
        className="h-64 animate-pulse rounded-2xl bg-slate-100"
        role="status"
        aria-label="Cargando metodología"
      />
    );
  if (!m)
    return (
      <Section title="Probabilidad de cierre">
        <p className="px-5 py-6 text-sm text-muted-foreground">
          Todavía no hay una metodología aprobada. Solo cuentan las
          probabilidades propias respaldadas.
        </p>
      </Section>
    );
  const edit = !!draft;
  const model = draft ?? m.model;
  const set = (fn: (d: ProbabilityModel) => void) =>
    setDraft((d) => {
      const next = structuredClone(d ?? m.model);
      fn(next);
      return next;
    });
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await apiRequest(base + "/methodology", "POST", {
        model: draft,
        basis,
        expectedVersion: m.version,
      });
      await queryClient.invalidateQueries({ queryKey: [base] });
      setDraft(null);
      setBasis("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const l = learning.data?.learning;
  const a = model.automatic;
  const row = "flex items-center justify-between gap-4 px-5 py-2.5";
  return (
    <div className="space-y-4">
      <Section
        title={
          edit
            ? `Nueva versión (v${m.version + 1})`
            : `Metodología v${m.version}`
        }
        description={
          edit
            ? "Editá los valores y aprobá la versión. Las oportunidades se recalculan al instante; los cortes guardados conservan su versión."
            : `Aprobada por ${m.approvedBy ?? "el equipo"} el ${civilDate(m.approvedAt)}. ${m.basis}`
        }
        action={
          isAdmin && !edit ? (
            <Button
              variant="outline"
              className="h-9 text-sm"
              onClick={() => setDraft(structuredClone(m.model))}
            >
              Editar valores
            </Button>
          ) : undefined
        }
      >
        <div className="grid gap-px bg-slate-100 lg:grid-cols-3">
          <div className="bg-card">
            <p className={cn(tableHead, "px-5 py-3")}>Base por etapa</p>
            {modelStages.map((s) => (
              <div key={s} className={row}>
                <span className="text-sm text-slate-700">{s}</span>
                <Num
                  value={model.stageBase[s]}
                  suffix="%"
                  edit={edit}
                  min={0}
                  max={100}
                  onChange={(v) => set((d) => (d.stageBase[s] = v))}
                />
              </div>
            ))}
          </div>
          <div className="bg-card">
            <p className={cn(tableHead, "px-5 py-3")}>Señales automáticas</p>
            {(
              [
                ["Cliente actual", "existingClient"],
                ["Renovación de un servicio vigente", "renewal"],
                ["Decisor y presupuesto confirmados", "decisionMaker"],
                [
                  `Decisión en ${a.closeDateWithinDays} días o menos`,
                  "knownCloseDate",
                ],
                [
                  `Sin novedades hace más de ${a.staleAfterDays} días`,
                  "stalePenalty",
                ],
                ["Licitación o compite con otros", "competition"],
              ] as const
            ).map(([label, key]) => (
              <div key={key} className={row}>
                <span className="text-sm text-slate-700">{label}</span>
                <Num
                  value={a[key]}
                  edit={edit}
                  onChange={(v) => set((d) => (d.automatic[key] = v))}
                />
              </div>
            ))}
          </div>
          <div className="bg-card">
            <p className={cn(tableHead, "px-5 py-3")}>Criterio del equipo</p>
            {model.teamSignals.map((t, i) => (
              <div key={t.key} className={row}>
                {edit ? (
                  <Input
                    className="h-8 text-sm"
                    value={t.label}
                    onChange={(e) =>
                      set((d) => (d.teamSignals[i].label = e.target.value))
                    }
                  />
                ) : (
                  <span className="text-sm text-slate-700">{t.label}</span>
                )}
                <span className="flex items-center gap-1">
                  <Num
                    value={t.points}
                    edit={edit}
                    onChange={(v) => set((d) => (d.teamSignals[i].points = v))}
                  />
                  {edit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400"
                      aria-label={`Quitar ${t.label}`}
                      onClick={() => set((d) => d.teamSignals.splice(i, 1))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </span>
              </div>
            ))}
            {edit && (
              <div className="px-5 py-2.5">
                <Button
                  variant="ghost"
                  className="h-8 gap-1.5 px-2 text-sm"
                  onClick={() =>
                    set((d) => {
                      const label = "Nueva señal";
                      let key = slug(label),
                        n = 2;
                      while (d.teamSignals.some((t) => t.key === key))
                        key = `${slug(label)}-${n++}`;
                      d.teamSignals.push({ key, label, points: 5 });
                    })
                  }
                >
                  <Plus className="h-4 w-4" /> Agregar señal
                </Button>
              </div>
            )}
          </div>
        </div>
        <div className="grid gap-x-6 gap-y-1 border-t border-border/60 px-5 py-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ["Tope del criterio del equipo (±)", "maxTeamAdjustment", "pts"],
              ["Rango del ajuste libre (±)", "manualRange", "pts"],
              ["Vencimiento del ajuste libre", "manualExpiryDays", "días"],
              ["Probabilidad mínima", "floor", "%"],
              ["Probabilidad máxima", "ceiling", "%"],
              ["Peso de la referencia al aprender", "priorWeight", "casos"],
              [
                "Cierres para recalibrar señales",
                "minOutcomesForSignals",
                "cierres",
              ],
            ] as const
          ).map(([label, key, suffix]) => (
            <div
              key={key}
              className="flex items-center justify-between gap-3 py-1"
            >
              <span className="text-slate-600">{label}</span>
              <Num
                value={model[key]}
                suffix={suffix}
                edit={edit}
                min={0}
                max={500}
                onChange={(v) => set((d) => ((d as any)[key] = v))}
              />
            </div>
          ))}
        </div>
        {edit && (
          <div className="space-y-3 border-t border-border/60 bg-slate-50/60 px-5 py-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">
                Fundamento de la versión
              </span>
              <Textarea
                value={basis}
                onChange={(e) => setBasis(e.target.value)}
                rows={2}
                placeholder="Qué cambió y por qué (por ejemplo: recalibración con los cierres de noviembre)."
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                className="h-9 text-sm"
                disabled={busy || basis.trim().length < 10}
                onClick={() => void save()}
              >
                Aprobar versión {m.version + 1}
              </Button>
              <Button
                variant="outline"
                className="h-9 text-sm"
                onClick={() => {
                  setDraft(null);
                  setError("");
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
        {!edit && m.history.length > 1 && (
          <details className="border-t border-border/60 px-5 py-3">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              Versiones anteriores
            </summary>
            <ul className="mt-2 space-y-1 text-sm">
              {m.history.map((h) => (
                <li key={h.version}>
                  <span className="font-medium">v{h.version}</span>{" "}
                  <span className="text-muted-foreground">
                    · {h.approvedBy ?? "—"} · {civilDate(h.approvedAt)} ·{" "}
                    {h.basis}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Section>

      <Section
        title="Aprendizaje del modelo"
        description="Cada oportunidad que sale del pipeline como ganada o perdida suma un caso. Los valores sugeridos mezclan la referencia con lo que realmente pasó."
        action={
          isAdmin && l && l.total > 0 && !edit ? (
            <Button
              variant="outline"
              className="h-9 gap-2 text-sm"
              onClick={() => {
                setDraft(structuredClone(learning.data!.suggested));
                setBasis(
                  `Recalibración con ${l.total} cierres (${l.won} ganados, ${l.lost} perdidos).`,
                );
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <Sparkles className="h-4 w-4" /> Usar sugerencias
            </Button>
          ) : undefined
        }
      >
        {learning.isLoading ? (
          <div className="m-5 h-24 animate-pulse rounded-xl bg-slate-100" />
        ) : !l || l.total === 0 ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-400">
              <GraduationCap className="h-6 w-6" />
            </div>
            <p className="font-semibold">Todavía no hay cierres registrados</p>
            <p className="mt-1 max-w-lg text-sm text-muted-foreground">
              Marcá cada oportunidad como ganada o perdida desde su ficha, con
              el motivo. Con los primeros cierres aparecen las tasas reales de
              Epical y, desde {model.minOutcomesForSignals} cierres, el peso
              real de cada señal.
            </p>
          </div>
        ) : (
          <div className="space-y-5 p-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                ["Cierres", l.total],
                ["Ganadas", l.won],
                ["Perdidas", l.lost],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-2xl font-semibold tabular-nums">{v}</p>
                  <p className="text-xs text-muted-foreground">{k}</p>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className={tableHead}>
                  <tr>
                    {[
                      "Etapa",
                      "Cierres",
                      "Ganadas",
                      "Tasa real",
                      "Actual",
                      "Sugerida",
                    ].map((h, i) => (
                      <th
                        key={h}
                        className={cn(
                          "px-3 py-2 font-medium",
                          i ? "text-right" : "text-left",
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {l.stages.map((s) => (
                    <tr key={s.stage}>
                      <td className="px-3 py-2">{s.stage}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {s.n}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {s.wins}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {s.observed === null ? (
                          <span className={pendingText}>—</span>
                        ) : (
                          `${Math.round(s.observed)}%`
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {s.current}%
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right font-medium tabular-nums",
                          s.suggested !== s.current && "text-primary",
                        )}
                      >
                        {s.suggested}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="overflow-x-auto">
              <p className="mb-2 text-sm font-medium">
                Señales{" "}
                {!l.signalsReady && (
                  <span className="font-normal text-muted-foreground">
                    · se recalibran desde {model.minOutcomesForSignals} cierres
                    (faltan {model.minOutcomesForSignals - l.total})
                  </span>
                )}
              </p>
              <table className="w-full text-sm">
                <thead className={tableHead}>
                  <tr>
                    {[
                      "Señal",
                      "Casos",
                      "Gana con",
                      "Gana sin",
                      "Efecto real",
                      "Actual",
                      "Sugerido",
                    ].map((h, i) => (
                      <th
                        key={h}
                        className={cn(
                          "px-3 py-2 font-medium",
                          i ? "text-right" : "text-left",
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {l.signals.map((s) => (
                    <tr key={s.key}>
                      <td className="px-3 py-2">{s.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {s.n}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {s.winRateWith === null
                          ? "—"
                          : `${Math.round(s.winRateWith)}%`}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {s.winRateWithout === null
                          ? "—"
                          : `${Math.round(s.winRateWithout)}%`}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {s.observedEffect === null
                          ? "—"
                          : signed(s.observedEffect)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {signed(s.current)}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right font-medium tabular-nums",
                          s.suggested !== s.current && "text-primary",
                        )}
                      >
                        {signed(s.suggested)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">
                Precisión: lo que dijo el modelo contra lo que pasó
              </p>
              <div className="grid grid-cols-5 gap-2 text-center text-xs">
                {l.calibration.buckets.map((b) => (
                  <div
                    key={b.range}
                    className="rounded-lg border border-slate-200 p-2"
                  >
                    <p className="font-medium text-slate-600">{b.range}</p>
                    <p className="mt-1 tabular-nums">
                      {b.n ? `cerró ${b.actual}%` : "—"}
                    </p>
                    <p className="text-muted-foreground">{b.n} casos</p>
                  </div>
                ))}
              </div>
              {l.calibration.brierFinal !== null && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Error del número final: {l.calibration.brierFinal.toFixed(3)}
                  {l.calibration.brierModel !== null &&
                    ` · solo modelo: ${l.calibration.brierModel.toFixed(3)}`}{" "}
                  (0 = perfecto; 0,25 = como tirar una moneda).{" "}
                  {l.calibration.brierModel !== null &&
                    l.total >= 10 &&
                    (l.calibration.brierFinal < l.calibration.brierModel
                      ? "El criterio del equipo está mejorando la precisión."
                      : "Por ahora el criterio del equipo no mejora la precisión.")}
                </p>
              )}
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
