import { FormEvent, useState } from "react";
import { CheckSquare, Flag, Loader2, Pencil, Repeat, RefreshCw, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Objective, UpdateObjectiveInput } from "@/lib/objectives-api";
import { isClosedObjective } from "@/lib/objectives-tree";

// El plan mezcla tres cosas que se miden distinto, y tratarlas igual —un
// mismo "Cargar avance" para todas— no deja entender ninguna:
// - Objetivo: un número a alcanzar ("3 suscripciones", "USD 655.000").
// - Hito: pasa o no pasa antes de una fecha ("BCRA llevado a decisión").
// - Hábito: se sostiene todo el año, sin llegada ("responder en 48 horas").
// Las acciones son la cuarta: lo que se hace en una semana para llegar.
export type ObjectiveKind = "objetivo" | "hito" | "habito";

export function kindOf(objective: Objective): ObjectiveKind {
  if (objective.targetKind === "continuous") return "habito";
  if (objective.targetKind === "milestone") return "hito";
  return "objetivo";
}

const KIND = {
  objetivo: { label: "Objetivo", icon: Target, className: "border-sky-200 bg-sky-50 text-sky-700" },
  hito: { label: "Hito", icon: Flag, className: "border-violet-200 bg-violet-50 text-violet-700" },
  habito: { label: "Hábito", icon: Repeat, className: "border-slate-200 bg-slate-50 text-slate-600" },
  accion: { label: "Acción", icon: CheckSquare, className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
} as const;

export const KIND_HELP: Record<keyof typeof KIND, string> = {
  objetivo: "Un número a alcanzar",
  hito: "Pasa o no pasa antes de una fecha",
  habito: "Se sostiene todo el año",
  accion: "Lo que se hace en una semana",
};

export function KindBadge({ kind, className }: { kind: keyof typeof KIND; className?: string }) {
  const { label, icon: Icon, className: tone } = KIND[kind];
  return (
    <span title={KIND_HELP[kind]} className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold", tone, className)}>
      <Icon className="h-3 w-3" aria-hidden="true" />{label}
    </span>
  );
}

function toNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const direct = Number(raw);
  if (Number.isFinite(direct)) return direct;
  // "1.500,5" escrito a mano, en formato argentino.
  const local = Number(String(raw).trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(local) ? local : null;
}

export function formatAmount(value: number, unit: string | null | undefined): string {
  const number = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value);
  if (!unit) return number;
  if (unit.toUpperCase() === "USD") return `USD ${number}`;
  return `${number} ${unit}`;
}

function targetOf(objective: Objective): number | null {
  const value = typeof objective.targetValue === "number" ? objective.targetValue : toNumber(objective.targetValue);
  return value != null && value > 0 ? value : null;
}

/** Dónde está hoy, dicho en su propia unidad. */
export function measureOf(objective: Objective): { text: string; tone: "done" | "missed" | "open" | "unknown" | "ok" | "bad" } {
  const status = String(objective.status ?? "").toLowerCase();
  const kind = kindOf(objective);
  if (kind === "hito") {
    if (status === "done") return { text: "Logrado", tone: "done" };
    if (status === "missed") return { text: "No se logró", tone: "missed" };
    return { text: "Pendiente", tone: "open" };
  }
  if (kind === "habito") {
    if (objective.progressPercent == null) return { text: "Sin medir", tone: "unknown" };
    return objective.progressPercent >= 100 ? { text: "Se cumple", tone: "ok" } : { text: "No se cumple", tone: "bad" };
  }
  if (status === "done") return { text: "Logrado", tone: "done" };
  if (status === "missed") return { text: "No se logró", tone: "missed" };
  const target = targetOf(objective);
  const current = toNumber(objective.currentValue);
  if (target != null) {
    if (current == null) return { text: `Sin medir · meta ${formatAmount(target, objective.targetUnit)}`, tone: "unknown" };
    return { text: `${formatAmount(current, null)} de ${formatAmount(target, objective.targetUnit)}`, tone: "open" };
  }
  return objective.currentValue ? { text: String(objective.currentValue), tone: "open" } : { text: "Sin medir", tone: "unknown" };
}

const MEASURE_TONE: Record<ReturnType<typeof measureOf>["tone"], string> = {
  done: "text-emerald-700",
  ok: "text-emerald-700",
  missed: "text-slate-500",
  bad: "text-red-600",
  open: "text-foreground",
  unknown: "text-muted-foreground",
};

export function MeasureText({ objective, className }: { objective: Objective; className?: string }) {
  const measure = measureOf(objective);
  return <span className={cn("font-semibold", MEASURE_TONE[measure.tone], className)}>{measure.text}</span>;
}

/**
 * El control de avance según qué es. Un objetivo pregunta "¿cuánto va?" y
 * calcula el porcentaje solo; un hito se contesta sí o no; un hábito, si se
 * está cumpliendo.
 */
export function ProgressControl({ objective, onUpdate, isUpdating, tone = "light" }: {
  objective: Objective;
  onUpdate: (id: string | number, input: UpdateObjectiveInput) => Promise<void>;
  isUpdating: boolean;
  tone?: "light" | "dark";
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [freeValue, setFreeValue] = useState("");
  const [freePercent, setFreePercent] = useState("");
  const kind = kindOf(objective);
  const dark = tone === "dark";
  const ghost = cn("h-8 px-2 text-xs", dark && "text-white/80 hover:bg-white/10 hover:text-white");
  const outline = cn("h-8 text-xs", dark && "border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white");
  const spinner = isUpdating ? <Loader2 className={cn("h-4 w-4 animate-spin", dark ? "text-white/70" : "text-muted-foreground")} /> : null;

  if (kind !== "habito" && isClosedObjective(objective)) {
    return <div className="mt-2 flex items-center gap-2">{spinner}<Button type="button" variant="ghost" size="sm" className={ghost} disabled={isUpdating} onClick={() => onUpdate(objective.id, { status: "planned" })}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Reabrir</Button></div>;
  }

  if (kind === "hito") {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Button type="button" size="sm" variant="outline" className={cn(outline, !dark && "border-emerald-300 text-emerald-700 hover:bg-emerald-50")} disabled={isUpdating} onClick={() => onUpdate(objective.id, { status: "done" })}>Se logró</Button>
        <Button type="button" size="sm" variant="outline" className={outline} disabled={isUpdating} onClick={() => onUpdate(objective.id, { status: "missed" })}>No se logró</Button>
        {spinner}
      </div>
    );
  }

  if (kind === "habito") {
    const measure = measureOf(objective);
    return (
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={cn("text-[11px]", dark ? "text-white/60" : "text-muted-foreground")}>¿Se está cumpliendo?</span>
        <Button type="button" size="sm" variant={measure.tone === "ok" ? "default" : "outline"} className={cn(outline, measure.tone === "ok" && "bg-emerald-600 text-white hover:bg-emerald-700")} disabled={isUpdating} onClick={() => onUpdate(objective.id, { progressPercent: 100, currentValue: "Se cumple" })}>Sí</Button>
        <Button type="button" size="sm" variant={measure.tone === "bad" ? "default" : "outline"} className={cn(outline, measure.tone === "bad" && "bg-red-600 text-white hover:bg-red-700")} disabled={isUpdating} onClick={() => onUpdate(objective.id, { progressPercent: 0, currentValue: "No se cumple" })}>No</Button>
        {spinner}
      </div>
    );
  }

  const target = targetOf(objective);
  const current = toNumber(objective.currentValue);
  if (!editing) {
    return <Button type="button" variant="ghost" size="sm" className={cn("mt-2", ghost)} onClick={() => { setValue(current != null ? String(current) : ""); setFreeValue(String(objective.currentValue ?? "")); setFreePercent(objective.progressPercent == null ? "" : String(objective.progressPercent)); setEditing(true); }}><Pencil className="mr-1.5 h-3.5 w-3.5" />{current == null && objective.progressPercent == null ? "Cargar cuánto va" : "Actualizar cuánto va"}</Button>;
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (target != null) {
      const number = toNumber(value);
      if (number == null || number < 0) return;
      // El porcentaje se deriva del número: nadie tiene que calcularlo.
      const percent = Math.round(Math.min(100, (number / target) * 100) * 10) / 10;
      await onUpdate(objective.id, { currentValue: String(number), progressPercent: percent });
    } else {
      const percent = freePercent.trim() === "" ? null : Number(freePercent);
      if (percent !== null && (!Number.isFinite(percent) || percent < 0 || percent > 100)) return;
      await onUpdate(objective.id, { currentValue: freeValue, progressPercent: percent });
    }
    setEditing(false);
  };

  const box = cn("mt-3 rounded-xl border p-3", dark ? "border-white/20 bg-white/5" : "border-primary/20 bg-primary/[0.04]");
  if (target != null) {
    return (
      <form onSubmit={save} className={box}>
        <Label htmlFor={`count-${objective.id}`} className="text-xs">¿Cuánto va?</Label>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <Input id={`count-${objective.id}`} type="number" min="0" step="any" value={value} onChange={(event) => setValue(event.target.value)} className="h-9 w-32 text-foreground" autoFocus />
          <span className={cn("text-sm", dark ? "text-white/80" : "text-muted-foreground")}>de {formatAmount(target, objective.targetUnit)}</span>
          <Button type="submit" size="sm" disabled={isUpdating || value.trim() === ""}>{isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}</Button>
          <Button type="button" size="sm" variant="ghost" className={cn(dark && "text-white/80 hover:bg-white/10 hover:text-white")} onClick={() => setEditing(false)}>Cancelar</Button>
        </div>
      </form>
    );
  }
  return (
    <form onSubmit={save} className={box}>
      <div className="grid gap-2 sm:grid-cols-[1fr_8rem_auto_auto]">
        <div><Label htmlFor={`free-${objective.id}`} className="text-xs">Dónde estamos hoy</Label><Input id={`free-${objective.id}`} value={freeValue} onChange={(event) => setFreeValue(event.target.value)} className="mt-1 text-foreground" autoFocus /></div>
        <div><Label htmlFor={`free-pct-${objective.id}`} className="text-xs">Avance %</Label><Input id={`free-pct-${objective.id}`} type="number" min="0" max="100" value={freePercent} onChange={(event) => setFreePercent(event.target.value)} className="mt-1 text-foreground" /></div>
        <Button type="submit" size="sm" className="self-end" disabled={isUpdating}>{isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}</Button>
        <Button type="button" size="sm" variant="ghost" className="self-end" onClick={() => setEditing(false)}>Cancelar</Button>
      </div>
    </form>
  );
}
