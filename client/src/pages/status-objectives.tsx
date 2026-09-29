import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Flag,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Star,
  Target,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompactPageHeader } from "@/components/ui/compact-page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageShell } from "@/components/ui/page-shell";
import { useAuth } from "@/hooks/use-auth";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  createObjectiveAction,
  getObjectives,
  objectivesQueryKey,
  Objective,
  ObjectiveAction,
  ObjectiveAccount,
  ObjectiveRef,
  updateObjective,
  UpdateObjectiveInput,
  updateObjectiveAction,
  updateObjectivesProgress,
} from "@/lib/objectives-api";
import {
  awaitingAnswer,
  buildObjectivesMap,
  childrenOfNode,
  deadlineOf,
  formatDeadline,
  isClosedObjective,
  isGroup,
  ObjectiveNode,
  tierOf,
  todayISO,
  TreeItem,
} from "@/lib/objectives-tree";
import { FRONTS, frontOf, type FrontId } from "@shared/objectives-fronts";

// La pantalla responde tres preguntas —¿vamos bien?, ¿qué hago esta semana?,
// ¿qué necesita una respuesta?— y todo lo demás queda en "Plan completo".
// Cada ronda anterior sumó una pestaña o un concepto y ninguna sacó otro:
// llegó a siete pestañas y siete palabras propias. Esto es la vuelta a poco.
type ViewId = "focus" | "plan";
type PlanViewId = "fronts" | "calendar" | "actions" | "habits" | "load";

type ActionForm = {
  title: string;
  objectiveId: string;
  owner: string;
  weekLabel: string;
  weekStart: string;
  dueDate: string;
  accountId: string;
  focus: string;
};

type ObjectivesMap = ReturnType<typeof buildObjectivesMap>;
type UpdateObjectiveFn = (id: string | number, input: UpdateObjectiveInput) => Promise<void>;
type IsMineFn = (owner: ObjectiveRef | null | undefined) => boolean;

const YEAR = 2026;

const planTabs: Array<{ id: PlanViewId; label: string }> = [
  { id: "fronts", label: "Por frente" },
  { id: "calendar", label: "Calendario" },
  { id: "actions", label: "Todas las acciones" },
  { id: "habits", label: "Hábitos" },
  { id: "load", label: "Cargar avance" },
];

const emptyActionForm: ActionForm = {
  title: "",
  objectiveId: "",
  owner: "",
  weekLabel: "",
  weekStart: "",
  dueDate: "",
  accountId: "",
  focus: "",
};

function valueText(value: unknown, empty = "—") {
  if (value === null || value === undefined || value === "") return empty;
  if (typeof value === "object") return ownerLabel(value as ObjectiveRef);
  return String(value);
}

function ownerLabel(owner: ObjectiveRef | null | undefined) {
  if (owner === null || owner === undefined || owner === "") return "Sin responsable";
  if (typeof owner === "object") return owner.name ?? owner.title ?? (owner.id !== null && owner.id !== undefined ? String(owner.id) : "Sin responsable");
  return String(owner);
}

function ownerKey(owner: ObjectiveRef | null | undefined) {
  if (owner === null || owner === undefined || owner === "") return "";
  if (typeof owner === "object") return owner.id !== null && owner.id !== undefined ? String(owner.id) : ownerLabel(owner);
  return String(owner);
}

function normalizeDate(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function formatWeek(start: string | null | undefined) {
  if (!start) return "sin fecha";
  const date = new Date(`${normalizeDate(start)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return start;
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" }).format(date);
}

function isDone(action: ObjectiveAction) {
  return ["done", "completed", "complete", "closed", "logrado", "cerrada", "completada"].includes((action.status ?? "").toLowerCase());
}

function levelLabel(level: string) {
  const normalized = level.toLowerCase();
  if (["company", "empresa", "organization", "org"].includes(normalized)) return "Empresa";
  if (["area", "área", "team"].includes(normalized)) return "Área";
  if (["person", "persona", "individual"].includes(normalized)) return "Persona";
  return level || "Sin nivel";
}

function progressOf(objective: Objective): number | null {
  return typeof objective.progressPercent === "number" && Number.isFinite(objective.progressPercent)
    ? Math.max(0, Math.min(100, objective.progressPercent))
    : null;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center"><Target className="mx-auto h-6 w-6 text-muted-foreground" /><h2 className="mt-3 text-sm font-bold text-foreground">{title}</h2><p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{description}</p></div>;
}

function ProgressForm({ objective, onUpdate, isUpdating, tone = "light" }: { objective: Objective; onUpdate: UpdateObjectiveFn; isUpdating: boolean; tone?: "light" | "dark" }) {
  const [editing, setEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(String(objective.currentValue ?? ""));
  const [progressPercent, setProgressPercent] = useState(objective.progressPercent == null ? "" : String(objective.progressPercent));
  const save = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const parsedProgress = progressPercent.trim() === "" ? null : Number(progressPercent); if (parsedProgress !== null && (!Number.isFinite(parsedProgress) || parsedProgress < 0 || parsedProgress > 100)) return; await onUpdate(objective.id, { currentValue, progressPercent: parsedProgress }); setEditing(false); };
  if (!editing) {
    return <Button type="button" variant="ghost" size="sm" className={cn("mt-2 h-8 px-2 text-xs", tone === "dark" && "text-white/80 hover:bg-white/10 hover:text-white")} onClick={() => setEditing(true)}><Pencil className="mr-1.5 h-3.5 w-3.5" />{progressOf(objective) === null ? "Cargar avance" : "Actualizar avance"}</Button>;
  }
  return <form onSubmit={save} className={cn("mt-3 rounded-xl border p-3", tone === "dark" ? "border-white/20 bg-white/5" : "border-primary/20 bg-primary/[0.04]")}><div className="grid gap-2 sm:grid-cols-[1fr_9rem_auto_auto]"><div><Label htmlFor={`objective-value-${objective.id}`} className="text-xs">Dónde estamos hoy</Label><Input id={`objective-value-${objective.id}`} value={currentValue} onChange={(event) => setCurrentValue(event.target.value)} placeholder="Ej. USD 42K" autoFocus className="text-foreground" /></div><div><Label htmlFor={`objective-progress-${objective.id}`} className="text-xs">Avance %</Label><Input id={`objective-progress-${objective.id}`} type="number" min="0" max="100" step="0.1" value={progressPercent} onChange={(event) => setProgressPercent(event.target.value)} placeholder="0–100" className="text-foreground" /></div><Button type="submit" size="sm" className="self-end" disabled={isUpdating}>{isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}</Button><Button type="button" size="sm" variant="ghost" className="self-end" onClick={() => setEditing(false)}>Cancelar</Button></div></form>;
}

/** Prioridad del mes: el plan la declara, no se deduce. Una estrella alcanza. */
function PriorityStar({ objective }: { objective: Objective }) {
  if (tierOf(objective) !== "innegociable") return null;
  return <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" aria-label="Prioridad del mes"><title>Prioridad del mes</title></Star>;
}

function DeadlineBadge({ objective }: { objective: Objective }) {
  const status = String(objective.status ?? "").toLowerCase();
  if (status === "done") return <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Logrado</span>;
  if (status === "missed") return <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">No se logró</span>;
  if (isClosedObjective(objective)) return <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Cerrado</span>;
  if (objective.targetKind === "continuous") {
    return <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Hábito</span>;
  }
  const deadline = deadlineOf(objective);
  if (!deadline) return null;
  const tone = deadline.overdue
    ? "border-red-200 bg-red-50 text-red-700"
    : deadline.soon
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-border bg-muted/40 text-muted-foreground";
  return <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", tone)}>{formatDeadline(deadline)}{objective.rescheduled ? " · reprogramado" : ""}</span>;
}

// ── Foco ───────────────────────────────────────────────────────────────────

function GoalPanel({ northStar, support, onUpdate, updatingId }: { northStar: ObjectiveNode | null; support: ObjectiveNode[]; onUpdate: UpdateObjectiveFn; updatingId: string | number | null }) {
  if (!northStar) return null;
  const objective = northStar.objective;
  const progress = progressOf(objective);
  return (
    <section aria-label="Meta del año" className="rounded-2xl bg-slate-900 p-5 text-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">Meta del año</span>
          <h2 className="mt-1 text-lg font-bold leading-6">{objective.title}</h2>
          <p className="mt-1 text-xs text-white/70">{valueText(objective.target, "Meta sin definir")}</p>
        </div>
        <div className="shrink-0 text-right">
          {progress === null
            ? <span className="text-xs font-semibold text-white/60">Sin avance cargado</span>
            : <><span className="text-2xl font-bold">{progress}%</span>{objective.currentValue ? <span className="block text-[11px] text-white/60">{String(objective.currentValue)}</span> : null}</>}
        </div>
      </div>
      {progress !== null && <Progress value={progress} className="mt-3 h-1.5 bg-white/15" />}
      <ProgressForm key={`${objective.id}-${objective.progressPercent}`} objective={objective} onUpdate={onUpdate} isUpdating={updatingId === objective.id} tone="dark" />
      {support.length > 0 && (
        <div className="mt-3 border-t border-white/15 pt-3">
          {support.map((node) => (
            <div key={String(node.objective.id)} className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-white/80">{node.objective.title}</span>
              <span className="text-white/55">{valueText(node.objective.target, "—")}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function WeekFocus({ actions, weekLabel, onToggle, pendingId, isMine, hasIdentity }: { actions: ObjectiveAction[]; weekLabel: string; onToggle: (action: ObjectiveAction) => void; pendingId: string | number | null; isMine: IsMineFn; hasIdentity: boolean }) {
  // "Mías" es lo que tenés a cargo. Si también contara donde sos apoyo, la
  // lista mezclaría acciones de otros y dejaría de responder "qué hago yo".
  const mine = actions.filter((action) => isMine(action.accountableOwner));
  const [onlyMine, setOnlyMine] = useState(false);
  // Arranca en "Mías" si hay algo tuyo esta semana; si no, mostrar una lista
  // vacía sería peor que mostrar la del equipo.
  useEffect(() => { setOnlyMine(mine.length > 0); }, [mine.length > 0]);
  const shown = onlyMine ? mine : actions;
  const pending = shown.filter((action) => !isDone(action)).length;
  return (
    <section aria-label="Acciones de esta semana" className="rounded-2xl border border-border/75 bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-foreground">Esta semana</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Semana del {weekLabel} · {shown.length === 0 ? "nada anotado" : pending === 0 ? "todo hecho" : `${pending} por hacer de ${shown.length}`}</p>
        </div>
        {hasIdentity && (
          <div role="group" aria-label="Qué acciones mostrar" className="flex items-center gap-1 rounded-lg border border-border/80 p-0.5 text-xs font-semibold">
            <button type="button" aria-pressed={onlyMine} onClick={() => setOnlyMine(true)} className={cn("rounded-md px-2.5 py-1", onlyMine ? "bg-slate-900 text-white" : "text-muted-foreground hover:bg-muted")}>Mías ({mine.length})</button>
            <button type="button" aria-pressed={!onlyMine} onClick={() => setOnlyMine(false)} className={cn("rounded-md px-2.5 py-1", !onlyMine ? "bg-slate-900 text-white" : "text-muted-foreground hover:bg-muted")}>Todas ({actions.length})</button>
          </div>
        )}
      </div>
      {shown.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">{onlyMine ? "No tenés acciones anotadas esta semana." : "No hay acciones anotadas para esta semana."}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border/60">
          {shown.map((action) => <li key={String(action.id)}><ActionCheck action={action} onToggle={() => onToggle(action)} isPending={pendingId === action.id} /></li>)}
        </ul>
      )}
    </section>
  );
}

function ActionCheck({ action, onToggle, isPending }: { action: ObjectiveAction; onToggle: () => void; isPending: boolean }) {
  const done = isDone(action);
  const due = action.dueDate ? formatWeek(action.dueDate) : null;
  return (
    <button type="button" onClick={onToggle} disabled={isPending} aria-pressed={done} aria-label={`${done ? "Reabrir" : "Marcar como hecha"}: ${action.title}`} className="flex w-full items-start gap-3 py-2.5 text-left transition-colors hover:bg-muted/40 disabled:cursor-wait disabled:opacity-60">
      <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border", done ? "border-emerald-500 bg-emerald-500 text-white" : "border-border bg-background text-transparent")} aria-hidden="true"><Check className="h-3 w-3" /></span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm font-semibold leading-5", done && "text-muted-foreground line-through")}>{action.title}</span>
        {action.objectiveTitle && <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">Para: {action.objectiveTitle}</span>}
      </span>
      <span className="shrink-0 text-right text-[11px] text-muted-foreground">
        <span className="block font-semibold text-foreground/80">{ownerLabel(action.accountableOwner)}</span>
        {due && <span className="block">{due}</span>}
      </span>
    </button>
  );
}

function AnswerRow({ objective, onUpdate, isUpdating }: { objective: Objective; onUpdate: UpdateObjectiveFn; isUpdating: boolean }) {
  const [moving, setMoving] = useState(false);
  const [date, setDate] = useState("");
  const deadline = deadlineOf(objective);
  const move = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!date) return; await onUpdate(objective.id, { targetDate: date }); setMoving(false); };
  return (
    <li className="py-3">
      <div>
        <div className="flex items-start gap-1.5">
          <PriorityStar objective={objective} />
          <p className="text-sm font-semibold leading-5 text-foreground">{objective.title}</p>
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{ownerLabel(objective.owner)}{deadline ? <> · <span className="font-semibold text-red-600">{formatDeadline(deadline)}</span></> : null}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {isUpdating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Button type="button" size="sm" variant="outline" className="h-8 border-emerald-300 text-emerald-700 hover:bg-emerald-50" disabled={isUpdating} onClick={() => onUpdate(objective.id, { status: "done" })}>Se logró</Button>
          <Button type="button" size="sm" variant="outline" className="h-8" disabled={isUpdating} onClick={() => onUpdate(objective.id, { status: "missed" })}>No se logró</Button>
          <Button type="button" size="sm" variant="ghost" className="h-8" disabled={isUpdating} onClick={() => setMoving((value) => !value)}>Mover fecha</Button>
        </div>
      </div>
      {moving && (
        <form onSubmit={move} className="mt-2 flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor={`move-${objective.id}`} className="text-xs">Nueva fecha</Label>
            <Input id={`move-${objective.id}`} type="date" min={todayISO()} value={date} onChange={(event) => setDate(event.target.value)} className="h-8 w-44 text-xs" autoFocus required />
          </div>
          <Button type="submit" size="sm" className="h-8" disabled={!date || isUpdating}>Guardar</Button>
          <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setMoving(false)}>Cancelar</Button>
        </form>
      )}
    </li>
  );
}

function AttentionPanel({ overdue, upcoming, nextCheckpoint, onUpdate, updatingId }: { overdue: Objective[]; upcoming: Objective[]; nextCheckpoint: { date: string; label: string } | null; onUpdate: UpdateObjectiveFn; updatingId: string | number | null }) {
  return (
    <section aria-label="Lo que necesita atención" className="rounded-2xl border border-border/75 bg-card p-5">
      {overdue.length > 0 ? (
        <>
          <h2 className="text-base font-bold text-foreground">Necesita una respuesta</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{overdue.length === 1 ? "Venció 1 objetivo" : `Vencieron ${overdue.length} objetivos`} y nadie dijo cómo terminó. Un clic cada uno.</p>
          <ul className="mt-1 divide-y divide-border/60">
            {overdue.map((objective) => <AnswerRow key={String(objective.id)} objective={objective} onUpdate={onUpdate} isUpdating={updatingId === objective.id} />)}
          </ul>
        </>
      ) : (
        <>
          <h2 className="text-base font-bold text-foreground">Nada vencido sin respuesta</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Todo lo que ya venció tiene cierre.</p>
        </>
      )}
      <div className="mt-4 border-t border-border/60 pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-bold text-foreground">Vence en las próximas dos semanas</h3>
          {nextCheckpoint && <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground"><Flag className="h-3 w-3" />{nextCheckpoint.label} · {formatWeek(nextCheckpoint.date)}</span>}
        </div>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">Nada vence en los próximos 14 días.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {upcoming.map((objective) => {
              const deadline = deadlineOf(objective);
              return (
                <li key={String(objective.id)} className="flex items-start gap-2 text-xs">
                  <span className="w-20 shrink-0 font-semibold text-amber-700">{deadline ? formatDeadline(deadline).replace("Vence ", "") : ""}</span>
                  <PriorityStar objective={objective} />
                  <span className="min-w-0 flex-1 text-foreground">{objective.title}</span>
                  <span className="shrink-0 text-muted-foreground">{ownerLabel(objective.owner)}</span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground"><Star className="h-3 w-3 fill-amber-400 text-amber-500" aria-hidden="true" />= prioridad del mes</p>
      </div>
    </section>
  );
}

function frontStatus(front: ObjectivesMap["fronts"][number]) {
  if (front.overdue > 0) return { tone: "bg-red-500", text: `${front.overdue} vencido${front.overdue === 1 ? "" : "s"}` };
  if (front.dueSoon > 0) return { tone: "bg-amber-400", text: `${front.dueSoon} vence${front.dueSoon === 1 ? "" : "n"} pronto` };
  return { tone: "bg-emerald-500", text: "Al día" };
}

function FrontsSummary({ fronts, onOpen }: { fronts: ObjectivesMap["fronts"]; onOpen: (id: FrontId) => void }) {
  return (
    <section aria-label="Los cinco frentes" className="rounded-2xl border border-border/75 bg-card p-5">
      <h2 className="text-base font-bold text-foreground">Los cinco frentes</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Dónde se juega la meta del año. Abrí uno para ver sus objetivos.</p>
      <ul className="mt-3 divide-y divide-border/60">
        {fronts.map((front) => {
          const status = frontStatus(front);
          return (
            <li key={front.id}>
              <button type="button" onClick={() => onOpen(front.id)} className="flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-muted/40">
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", status.tone)} aria-hidden="true" />
                <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">{front.label}</span>
                <span className="hidden text-[11px] text-muted-foreground sm:block">{front.objectives_} {front.objectives_ === 1 ? "objetivo" : "objetivos"}</span>
                <span className="w-44 shrink-0 text-right text-[11px] font-semibold text-muted-foreground">{front.progress === null ? status.text : `${front.progress}% · ${status.text}`}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Plan completo ──────────────────────────────────────────────────────────

function ObjectiveBranch({ item, expanded, onToggle, onUpdate, updatingId, isMine }: { item: TreeItem; expanded: Set<string>; onToggle: (id: string) => void; onUpdate: UpdateObjectiveFn; updatingId: string | number | null; isMine: IsMineFn }) {
  if (isGroup(item)) {
    const open = expanded.has(item.id);
    return (
      <div className="border-l border-border/70 pl-3">
        <button type="button" onClick={() => onToggle(item.id)} aria-expanded={open} className="flex w-full items-center gap-2 py-2 text-left">
          {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className="text-xs font-bold text-foreground">{item.label}</span>
          <span className="text-[11px] text-muted-foreground">{item.descendants}</span>
        </button>
        {open && <div className="space-y-1 pb-1">{item.children.map((child) => <ObjectiveBranch key={String(child.objective.id)} item={child} expanded={expanded} onToggle={onToggle} onUpdate={onUpdate} updatingId={updatingId} isMine={isMine} />)}</div>}
      </div>
    );
  }

  const node = item;
  const id = String(node.objective.id);
  const kids = childrenOfNode(node);
  const open = expanded.has(id);
  const progress = progressOf(node.objective);
  const mine = isMine(node.objective.owner);
  const closed = isClosedObjective(node.objective);
  const updating = updatingId === node.objective.id;
  return (
    <div className="border-l border-border/70 pl-3">
      <div className={cn("flex items-start gap-2 py-2", mine && "-mx-2 rounded-lg bg-primary/[0.05] px-2 ring-1 ring-primary/20")}>
        {kids.length > 0 ? (
          <button type="button" onClick={() => onToggle(id)} aria-expanded={open} aria-label={`${open ? "Contraer" : "Expandir"} ${node.objective.title}`} className="mt-0.5 shrink-0 text-muted-foreground">
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : <span className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <PriorityStar objective={node.objective} />
            <DeadlineBadge objective={node.objective} />
            {node.objective.level !== "company" && <span className="text-[10px] font-semibold text-muted-foreground">{levelLabel(node.objective.level)}</span>}
          </div>
          <h4 className={cn("mt-1 text-[13px] font-semibold leading-5 text-foreground", closed && "text-muted-foreground")}>{node.objective.title}</h4>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{valueText(node.objective.target, "Meta sin definir")}</p>
          {progress !== null && <Progress value={progress} className="mt-1.5 h-1" />}
          {closed
            ? <Button type="button" variant="ghost" size="sm" className="mt-2 h-8 px-2 text-xs" disabled={updating} onClick={() => onUpdate(node.objective.id, { status: "planned" })}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Reabrir</Button>
            : <ProgressForm objective={node.objective} onUpdate={onUpdate} isUpdating={updating} />}
        </div>
        <span className="shrink-0 text-right text-[10px] text-muted-foreground">{ownerLabel(node.objective.owner)}</span>
      </div>
      {open && kids.length > 0 && <div className="space-y-1 pb-1">{kids.map((child) => <ObjectiveBranch key={isGroup(child) ? child.id : String(child.objective.id)} item={child} expanded={expanded} onToggle={onToggle} onUpdate={onUpdate} updatingId={updatingId} isMine={isMine} />)}</div>}
    </div>
  );
}

function FrontCard({ front, active, onSelect }: { front: ObjectivesMap["fronts"][number]; active: boolean; onSelect: () => void }) {
  const status = frontStatus(front);
  return (
    <button type="button" onClick={onSelect} aria-pressed={active} className={cn("rounded-2xl border p-4 text-left transition-colors", active ? "border-primary bg-primary/[0.06]" : "border-border/75 bg-card hover:bg-muted/40")}>
      <span className="block text-sm font-bold leading-5 text-foreground">{front.label}</span>
      <span className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
        <span className={cn("h-2 w-2 rounded-full", status.tone)} aria-hidden="true" />
        {status.text}{front.progress !== null ? ` · ${front.progress}%` : ""}
      </span>
    </button>
  );
}

function FrontsView({ map, openFront, onOpenFront, isMine, onUpdate, updatingId }: { map: ObjectivesMap; openFront: FrontId | null; onOpenFront: (id: FrontId | null) => void; isMine: IsMineFn; onUpdate: UpdateObjectiveFn; updatingId: string | number | null }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setExpanded((current) => {
    const next = new Set(current);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const front = map.fronts.find((candidate) => candidate.id === openFront) ?? null;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {map.fronts.map((candidate) => (
          <FrontCard key={candidate.id} front={candidate} active={candidate.id === openFront} onSelect={() => onOpenFront(candidate.id === openFront ? null : candidate.id)} />
        ))}
      </div>
      {front ? (
        <section className="rounded-2xl border border-primary/25 bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-foreground">{front.label}</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Lo que tenés a cargo aparece resaltado.</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenFront(null)}>Cerrar</Button>
          </div>
          <div className="mt-2 space-y-1">
            {front.objectives.map((node) => <ObjectiveBranch key={String(node.objective.id)} item={node} expanded={expanded} onToggle={toggle} onUpdate={onUpdate} updatingId={updatingId} isMine={isMine} />)}
          </div>
        </section>
      ) : (
        <p className="text-xs text-muted-foreground">Elegí un frente para ver sus objetivos y quién los lleva.</p>
      )}
      {map.unplaced.length > 0 && (
        <section className="rounded-2xl border border-border/75 bg-card p-4">
          <h3 className="text-sm font-bold text-foreground">Otros objetivos de empresa</h3>
          <ul className="mt-2 space-y-0.5">{map.unplaced.map((objective) => <li key={String(objective.id)} className="text-xs text-foreground">· {objective.title}</li>)}</ul>
        </section>
      )}
    </div>
  );
}

function SearchResults({ objectives, query, breadcrumbOf, onUpdate, updatingId }: { objectives: Objective[]; query: string; breadcrumbOf: (objective: Objective) => string; onUpdate: UpdateObjectiveFn; updatingId: string | number | null }) {
  const text = query.trim().toLowerCase();
  const matches = objectives.filter((objective) =>
    !objective.retiredAt && [objective.title, objective.metric, objective.target, objective.areaKey, ownerLabel(objective.owner)]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(text)),
  );
  if (matches.length === 0) return <EmptyState title="Sin coincidencias" description={`Ningún objetivo menciona "${query.trim()}".`} />;
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{matches.length} {matches.length === 1 ? "coincidencia" : "coincidencias"}</p>
      {matches.map((objective) => (
        <div key={String(objective.id)} className="rounded-xl border border-border/70 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{breadcrumbOf(objective)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <PriorityStar objective={objective} />
            <DeadlineBadge objective={objective} />
          </div>
          <h4 className="mt-1 text-[13px] font-semibold text-foreground">{objective.title}</h4>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{valueText(objective.target, "Meta sin definir")} · {ownerLabel(objective.owner)}</p>
          <ProgressForm objective={objective} onUpdate={onUpdate} isUpdating={updatingId === objective.id} />
        </div>
      ))}
    </div>
  );
}

function CalendarView({ timeline, objectives }: { timeline: ObjectivesMap["timeline"]; objectives: Objective[] }) {
  const conFecha = objectives
    .filter((objective) => !objective.retiredAt && objective.targetDate && objective.targetKind !== "continuous")
    .sort((a, b) => String(a.targetDate).localeCompare(String(b.targetDate)));
  const marcadores = [...timeline].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <section className="rounded-2xl border border-border/75 bg-card p-5">
      <p className="text-xs text-muted-foreground">Cada objetivo aparece en el tramo en que vence. Las banderas oscuras son los puntos de control duros.</p>
      <div className="mt-4 space-y-4">
        {marcadores.map((marcador, index) => {
          const desde = index === 0 ? "0000-01-01" : marcadores[index - 1].date;
          const enVentana = conFecha.filter((objective) => {
            const fecha = String(objective.targetDate).slice(0, 10);
            return fecha > desde && fecha <= marcador.date;
          });
          return (
            <div key={`${marcador.date}-${marcador.label}`}>
              <div className={cn("flex items-center gap-2 rounded-xl px-3 py-2", marcador.hard ? "border-l-4 border-slate-900 bg-slate-100" : "border-l-4 border-border bg-muted/40")}>
                <Flag className={cn("h-3.5 w-3.5", marcador.hard ? "text-slate-900" : "text-muted-foreground")} />
                <span className="text-xs font-bold text-foreground">{marcador.label}</span>
                <span className="ml-auto text-[11px] text-muted-foreground">{formatWeek(marcador.date)}</span>
              </div>
              {enVentana.length === 0 ? (
                <p className="mt-1 pl-4 text-[11px] text-muted-foreground">Nada vence en este tramo.</p>
              ) : (
                <ul className="mt-1 space-y-0.5 pl-4">
                  {enVentana.map((objective) => (
                    <li key={String(objective.id)} className="flex items-center gap-2 text-[11px]">
                      <span className="w-14 shrink-0 text-muted-foreground">{formatWeek(String(objective.targetDate))}</span>
                      <PriorityStar objective={objective} />
                      <span className={cn("truncate text-foreground", isClosedObjective(objective) && "text-muted-foreground line-through")}>{objective.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function HabitsView({ map }: { map: ObjectivesMap }) {
  const breached = new Set(map.standardsBreached.map((objective) => String(objective.id)));
  const unmeasured = new Set(map.standardsUnmeasured.map((objective) => String(objective.id)));
  const ok = map.standards.length - breached.size - unmeasured.size;
  return (
    <section aria-label="Hábitos del equipo" className="rounded-2xl border border-border/75 bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-xs text-muted-foreground">Cosas que se sostienen todo el año, sin fecha de llegada.</p>
        <div className="flex items-center gap-3 text-[11px] font-semibold">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />{ok} se cumplen</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" />{breached.size} no se cumplen</span>
          <span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-full bg-slate-300" />{unmeasured.size} sin medir</span>
        </div>
      </div>
      <ul className="mt-3 divide-y divide-border/60">
        {map.standards.map((objective) => {
          const id = String(objective.id);
          const estado = breached.has(id) ? "rojo" : unmeasured.has(id) ? "gris" : "verde";
          return (
            <li key={id} className="flex items-start gap-2 py-2">
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", estado === "rojo" ? "bg-red-500" : estado === "gris" ? "bg-slate-300" : "bg-emerald-500")} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold leading-4 text-foreground">{objective.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{valueText(objective.target, "Sin definir")}</p>
              </div>
              <span className="shrink-0 text-[10px] text-muted-foreground">{ownerLabel(objective.owner)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function BulkProgressView({ objectives, onSaved }: { objectives: Objective[]; onSaved: () => void }) {
  const [draft, setDraft] = useState<Record<string, { currentValue: string; progressPercent: string }>>({});
  const [query, setQuery] = useState("");
  const [soloSinMedir, setSoloSinMedir] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: updateObjectivesProgress,
    onSuccess: () => { setDraft({}); setError(null); onSaved(); },
    onError: (mutationError: unknown) => setError(mutationError instanceof Error ? mutationError.message : "No se pudo guardar el avance"),
  });

  const active = objectives.filter((objective) => !objective.retiredAt);
  const rows = active.filter((objective) => {
    if (soloSinMedir && progressOf(objective) !== null) return false;
    const text = query.trim().toLowerCase();
    if (!text) return true;
    return [objective.title, objective.metric, objective.target, ownerLabel(objective.owner)]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(text));
  });

  const valueOf = (objective: Objective, field: "currentValue" | "progressPercent") => {
    const entry = draft[String(objective.id)];
    if (entry) return entry[field];
    if (field === "currentValue") return String(objective.currentValue ?? "");
    return objective.progressPercent == null ? "" : String(objective.progressPercent);
  };

  const set = (objective: Objective, field: "currentValue" | "progressPercent", value: string) => {
    const id = String(objective.id);
    setDraft((current) => ({
      ...current,
      [id]: {
        currentValue: field === "currentValue" ? value : current[id]?.currentValue ?? String(objective.currentValue ?? ""),
        progressPercent: field === "progressPercent" ? value : current[id]?.progressPercent ?? (objective.progressPercent == null ? "" : String(objective.progressPercent)),
      },
    }));
  };

  const pendientes = Object.keys(draft).length;
  const guardar = () => {
    const updates = Object.entries(draft).map(([id, entry]) => {
      const percent = entry.progressPercent.trim();
      const parsed = percent === "" ? null : Number(percent);
      return { id, currentValue: entry.currentValue.trim() === "" ? null : entry.currentValue.trim(), progressPercent: parsed };
    });
    const invalido = updates.find((update) => update.progressPercent !== null && (!Number.isFinite(update.progressPercent) || update.progressPercent < 0 || update.progressPercent > 100));
    if (invalido) { setError("El avance tiene que ser un número entre 0 y 100."); return; }
    mutation.mutate(updates);
  };

  return (
    <section className="rounded-2xl border border-border/75 bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-xs text-muted-foreground">Cargá todo de una vez: pasá de un campo al otro con Tab y guardá al final.</p>
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="bulk-search" className="sr-only">Buscar objetivo</Label>
          <Input id="bulk-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar objetivo…" className="h-9 w-52 text-xs" />
          <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <input type="checkbox" checked={soloSinMedir} onChange={(event) => setSoloSinMedir(event.target.checked)} />
            Sólo sin medir
          </label>
          <Button type="button" size="sm" onClick={guardar} disabled={pendientes === 0 || mutation.isPending}>
            {mutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Guardar {pendientes > 0 ? `(${pendientes})` : ""}
          </Button>
        </div>
      </div>
      {error && <div role="alert" className="mt-3 rounded-xl border border-destructive/20 bg-destructive/[0.04] px-3 py-2 text-xs text-destructive">{error}</div>}
      <p className="mt-3 text-xs text-muted-foreground">Mostrando {rows.length} de {active.length}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="pb-2">Objetivo</th>
              <th className="pb-2">Meta</th>
              <th className="w-44 pb-2">Dónde estamos hoy</th>
              <th className="w-24 pb-2">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((objective) => (
              <tr key={String(objective.id)} className="border-b border-border/60 last:border-0">
                <td className="py-2 pr-3">
                  <p className="text-xs font-semibold leading-4 text-foreground">{objective.title}</p>
                  <p className="text-[10px] text-muted-foreground">{ownerLabel(objective.owner)}</p>
                </td>
                <td className="py-2 pr-3 text-[11px] text-muted-foreground">{valueText(objective.target, "—")}</td>
                <td className="py-2 pr-2">
                  <Label htmlFor={`bulk-value-${objective.id}`} className="sr-only">Avance de {objective.title}</Label>
                  <Input id={`bulk-value-${objective.id}`} value={valueOf(objective, "currentValue")} onChange={(event) => set(objective, "currentValue", event.target.value)} placeholder="Ej. USD 42K" className="h-8 text-xs" />
                </td>
                <td className="py-2">
                  <Label htmlFor={`bulk-pct-${objective.id}`} className="sr-only">Porcentaje de {objective.title}</Label>
                  <Input id={`bulk-pct-${objective.id}`} type="number" min="0" max="100" step="1" value={valueOf(objective, "progressPercent")} onChange={(event) => set(objective, "progressPercent", event.target.value)} placeholder="0–100" className="h-8 text-xs" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">No hay objetivos para esos filtros.</p>}
      </div>
    </section>
  );
}

function ActionsView({ actions, owners, onToggle, pendingId }: { actions: ObjectiveAction[]; owners: ObjectiveRef[]; onToggle: (action: ObjectiveAction) => void; pendingId: string | number | null }) {
  const [ownerFilter, setOwnerFilter] = useState("Todos");
  const shown = ownerFilter === "Todos" ? actions : actions.filter((action) => ownerKey(action.accountableOwner) === ownerFilter);
  const weeks = useMemo(() => {
    const byWeek = new Map<string, ObjectiveAction[]>();
    for (const action of shown) {
      const key = normalizeDate(action.weekStart) || "sin-semana";
      byWeek.set(key, [...(byWeek.get(key) ?? []), action]);
    }
    return [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [shown]);
  return (
    <section className="rounded-2xl border border-border/75 bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Las acciones de todas las semanas, en orden.</p>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="owner-filter" className="sr-only">Filtrar por responsable</Label>
          <select id="owner-filter" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)} className="h-9 rounded-lg border border-border bg-background px-2 text-xs font-semibold text-foreground">
            <option value="Todos">Todos</option>
            {owners.map((owner, index) => <option key={`${ownerKey(owner)}-${index}`} value={ownerKey(owner)}>{ownerLabel(owner)}</option>)}
          </select>
        </div>
      </div>
      {weeks.length === 0 ? <p className="mt-4 text-xs text-muted-foreground">No hay acciones para ese filtro.</p> : weeks.map(([week, list]) => (
        <div key={week} className="mt-4">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{week === "sin-semana" ? "Sin semana" : `Semana del ${formatWeek(week)}`}</h3>
          <ul className="divide-y divide-border/60">{list.map((action) => <li key={String(action.id)}><ActionCheck action={action} onToggle={() => onToggle(action)} isPending={pendingId === action.id} /></li>)}</ul>
        </div>
      ))}
    </section>
  );
}

function ActionFormPanel({ form, setForm, objectives, owners, accounts, onSubmit, onClose, isPending, error }: { form: ActionForm; setForm: (value: ActionForm) => void; objectives: Objective[]; owners: ObjectiveRef[]; accounts: ObjectiveAccount[]; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onClose: () => void; isPending: boolean; error: string | null }) {
  const set = (key: keyof ActionForm, value: string) => setForm({ ...form, [key]: value });
  return <form onSubmit={onSubmit} className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4" aria-label="Crear nueva acción"><div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-sm font-bold text-foreground">Nueva acción</h2><p className="mt-1 text-xs text-muted-foreground">Algo concreto para hacer en una semana, que empuja un objetivo.</p></div><Button type="button" variant="ghost" size="sm" onClick={onClose}>Cerrar</Button></div>{error && <div role="alert" className="mb-3 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><div className="md:col-span-2 xl:col-span-2"><Label htmlFor="action-title">Qué hay que hacer *</Label><Input id="action-title" value={form.title} onChange={(event) => set("title", event.target.value)} required className="mt-1.5" placeholder="Ej. Reenviar Radar a destinatarios prioritarios" /></div><div><Label htmlFor="action-objective">Para qué objetivo *</Label><select id="action-objective" value={form.objectiveId} onChange={(event) => set("objectiveId", event.target.value)} required className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Elegir objetivo</option>{objectives.map((objective) => <option key={String(objective.id)} value={String(objective.id)}>{objective.title}</option>)}</select></div><div><Label htmlFor="action-owner">Responsable *</Label>{owners.length > 0 ? <select id="action-owner" value={form.owner} onChange={(event) => set("owner", event.target.value)} required className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Elegir responsable</option>{owners.map((owner, index) => <option key={`${ownerKey(owner)}-${index}`} value={ownerKey(owner)}>{ownerLabel(owner)}</option>)}</select> : <Input id="action-owner" value={form.owner} onChange={(event) => set("owner", event.target.value)} required className="mt-1.5" placeholder="Nombre del responsable" />}</div><div><Label htmlFor="action-week">Semana *</Label><Input id="action-week" value={form.weekLabel} onChange={(event) => set("weekLabel", event.target.value)} required className="mt-1.5" placeholder="Ej. 29 sep – 3 oct" /></div><div><Label htmlFor="action-week-start">Empieza el</Label><Input id="action-week-start" type="date" value={form.weekStart} onChange={(event) => set("weekStart", event.target.value)} className="mt-1.5" /></div><div><Label htmlFor="action-due-date">Fecha límite</Label><Input id="action-due-date" type="date" value={form.dueDate} onChange={(event) => set("dueDate", event.target.value)} className="mt-1.5" /></div><div><Label htmlFor="action-account">Cliente</Label><select id="action-account" value={form.accountId} onChange={(event) => set("accountId", event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Ninguno</option>{accounts.map((account) => <option key={String(account.id)} value={String(account.id)}>{account.name}</option>)}</select></div></div><div className="mt-4 flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={isPending || objectives.length === 0}>{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar acción</Button></div></form>;
}

export default function StatusObjectivesPage() {
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState<ViewId>("focus");
  const [planView, setPlanView] = useState<PlanViewId>("fronts");
  const [openFront, setOpenFront] = useState<FrontId | null>(null);
  const [objectiveSearch, setObjectiveSearch] = useState("");
  const [showActionForm, setShowActionForm] = useState(false);
  const [form, setForm] = useState<ActionForm>(emptyActionForm);
  const [formError, setFormError] = useState<string | null>(null);
  const queryKey = objectivesQueryKey(YEAR);
  const objectivesQuery = useQuery({ queryKey, queryFn: () => getObjectives(YEAR) });
  const data = objectivesQuery.data;
  const objectives = data?.objectives ?? [];
  const actions = data?.actions ?? [];
  const accounts = data?.accounts ?? [];
  const owners = data?.owners ?? [];
  const currentWeekStart = data?.summary?.currentWeekStart ?? null;

  const ownerOptions = useMemo(() => {
    const all = [...objectives.map((objective) => objective.owner), ...actions.map((action) => action.accountableOwner)].filter(Boolean) as ObjectiveRef[];
    const seen = new Set<string>();
    return all.filter((owner) => { const key = ownerKey(owner); if (!key || seen.has(key)) return false; seen.add(key); return true; })
      .sort((a, b) => ownerLabel(a).localeCompare(ownerLabel(b), "es"));
  }, [actions, objectives]);
  const formOwners = owners.length > 0 ? owners : ownerOptions;

  // "Lo mío" resalta, no filtra el árbol: persona y jerarquía son dos ejes
  // distintos, y filtrar uno por el otro dejaba ramas sin raíz.
  const myPersonnelId = authUser?.personnelId ?? null;
  const isMine = useMemo<IsMineFn>(() => {
    if (myPersonnelId == null) return () => false;
    return (owner) => String(ownerKey(owner)) === String(myPersonnelId);
  }, [myPersonnelId]);
  const objectivesMap = useMemo(() => buildObjectivesMap(objectives), [objectives]);
  const activeObjectives = useMemo(() => objectives.filter((objective) => !objective.retiredAt), [objectives]);
  const overdue = useMemo(() => awaitingAnswer(objectives), [objectives]);
  const upcoming = useMemo(() => objectivesMap.dueSoon.filter((objective) => !deadlineOf(objective)?.overdue), [objectivesMap]);
  const nextCheckpoint = useMemo(() => {
    const today = todayISO();
    return objectivesMap.timeline.find((entry) => entry.date >= today) ?? null;
  }, [objectivesMap]);

  // Ruta legible de un objetivo, para que un resultado de búsqueda diga de
  // dónde cuelga en vez de aparecer sin contexto.
  const breadcrumbOf = useMemo(() => {
    const byId = new Map(objectives.map((objective) => [String(objective.id), objective]));
    return (objective: Objective) => {
      const chain: string[] = [];
      let current: Objective | undefined = objective;
      let root: Objective = objective;
      const seen = new Set<string>();
      while (current && !seen.has(String(current.id))) {
        seen.add(String(current.id));
        root = current;
        const parentId: string | null = current.parentObjectiveId != null ? String(current.parentObjectiveId) : null;
        current = parentId ? byId.get(parentId) : undefined;
        if (current) chain.unshift(current.title);
      }
      const front = frontOf(root.slug);
      const label = front ? FRONTS[front] : null;
      return [label, ...chain].filter(Boolean).join(" › ") || "Objetivo de empresa";
    };
  }, [objectives]);
  const currentWeekActions = useMemo(() => !currentWeekStart ? [] : actions.filter((action) => normalizeDate(action.weekStart) === normalizeDate(currentWeekStart)), [actions, currentWeekStart]);

  const updateActionMutation = useMutation({ mutationFn: ({ id, status }: { id: string | number; status: string }) => updateObjectiveAction(id, { status }), onSuccess: () => queryClient.invalidateQueries({ queryKey }) });
  const updateObjectiveMutation = useMutation({ mutationFn: ({ id, input }: { id: string | number; input: UpdateObjectiveInput }) => updateObjective(id, input), onSuccess: () => queryClient.invalidateQueries({ queryKey }) });
  const createActionMutation = useMutation({ mutationFn: createObjectiveAction, onSuccess: () => { queryClient.invalidateQueries({ queryKey }); setShowActionForm(false); setForm(emptyActionForm); setFormError(null); }, onError: (error) => setFormError(error instanceof Error ? error.message : "No se pudo crear la acción.") });
  const mutationError = updateActionMutation.error ?? updateObjectiveMutation.error;
  const updatingObjectiveId = updateObjectiveMutation.isPending ? updateObjectiveMutation.variables?.id ?? null : null;
  const pendingActionId = updateActionMutation.isPending ? updateActionMutation.variables?.id ?? null : null;

  const openActionForm = () => { setForm({ ...emptyActionForm, objectiveId: "", owner: myPersonnelId != null ? String(myPersonnelId) : "", weekStart: normalizeDate(currentWeekStart), weekLabel: currentWeekStart ? formatWeek(currentWeekStart) : "" }); setFormError(null); setShowActionForm(true); };
  const submitAction = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setFormError(null); createActionMutation.mutate({ title: form.title.trim(), objectiveId: form.objectiveId, accountableOwner: form.owner, weekLabel: form.weekLabel.trim(), ...(form.weekStart ? { weekStart: form.weekStart } : {}), ...(form.dueDate ? { dueDate: form.dueDate } : {}), ...(form.accountId ? { accountId: form.accountId } : {}), ...(form.focus.trim() ? { focus: form.focus.trim() } : {}) }); };
  const toggleAction = (action: ObjectiveAction) => updateActionMutation.mutate({ id: action.id, status: isDone(action) ? "pending" : "done" });
  const updateObjectiveFields: UpdateObjectiveFn = async (id, input) => { await updateObjectiveMutation.mutateAsync({ id, input }); };
  const openFrontInPlan = (id: FrontId) => { setOpenFront(id); setPlanView("fronts"); setObjectiveSearch(""); setView("plan"); };

  if (objectivesQuery.isLoading) return <PageShell width="wide" spacing="compact" className="pb-8"><LoadingState /></PageShell>;
  if (objectivesQuery.isError) return <PageShell width="wide" spacing="compact" className="pb-8"><ErrorState message={objectivesQuery.error instanceof Error ? objectivesQuery.error.message : "No se pudieron cargar los objetivos."} onRetry={() => objectivesQuery.refetch()} /></PageShell>;

  const searching = objectiveSearch.trim().length > 0;

  return <PageShell width="wide" spacing="compact" className="pb-8">
    <CompactPageHeader title={`Objetivos ${YEAR}`} description="Qué perseguimos este año y qué hacemos esta semana para llegar." icon={<Target className="h-5 w-5" />} actions={<Button size="sm" onClick={openActionForm} disabled={objectives.length === 0}><Plus className="h-4 w-4" />Nueva acción</Button>} />
    {showActionForm && <ActionFormPanel form={form} setForm={setForm} objectives={activeObjectives} owners={formOwners} accounts={accounts} onSubmit={submitAction} onClose={() => setShowActionForm(false)} isPending={createActionMutation.isPending} error={formError} />}
    {mutationError && <div role="alert" className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/[0.03] px-3 py-2 text-xs text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{mutationError instanceof Error ? mutationError.message : "No se pudo guardar el cambio."}</div>}
    <div role="tablist" aria-label="Vista de objetivos" className="flex items-center gap-1 border-b border-border/80 pb-px">
      {([{ id: "focus", label: "Foco" }, { id: "plan", label: "Plan completo" }] as Array<{ id: ViewId; label: string }>).map((tab) => <button key={tab.id} id={`objectives-tab-${tab.id}`} type="button" role="tab" aria-selected={view === tab.id} aria-controls={`objectives-panel-${tab.id}`} tabIndex={view === tab.id ? 0 : -1} onClick={() => setView(tab.id)} className={cn("whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition-colors", view === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{tab.label}</button>)}
    </div>

    {view === "focus" && <div id="objectives-panel-focus" role="tabpanel" aria-labelledby="objectives-tab-focus" className="space-y-4">
      <GoalPanel northStar={objectivesMap.northStar} support={objectivesMap.northSupport} onUpdate={updateObjectiveFields} updatingId={updatingObjectiveId} />
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <WeekFocus actions={currentWeekActions} weekLabel={formatWeek(currentWeekStart)} onToggle={toggleAction} pendingId={pendingActionId} isMine={isMine} hasIdentity={myPersonnelId != null} />
        <AttentionPanel overdue={overdue} upcoming={upcoming} nextCheckpoint={nextCheckpoint} onUpdate={updateObjectiveFields} updatingId={updatingObjectiveId} />
      </div>
      <FrontsSummary fronts={objectivesMap.fronts} onOpen={openFrontInPlan} />
    </div>}

    {view === "plan" && <div id="objectives-panel-plan" role="tabpanel" aria-labelledby="objectives-tab-plan" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1">
          {planTabs.map((tab) => <button key={tab.id} type="button" aria-pressed={!searching && planView === tab.id} onClick={() => { setPlanView(tab.id); setObjectiveSearch(""); }} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors", !searching && planView === tab.id ? "bg-slate-900 text-white" : "text-muted-foreground hover:bg-muted")}>{tab.label}</button>)}
        </div>
        <div className="flex w-full max-w-sm items-center gap-2">
          <Label htmlFor="objective-search" className="sr-only">Buscar objetivo</Label>
          <Input id="objective-search" value={objectiveSearch} onChange={(event) => setObjectiveSearch(event.target.value)} placeholder="Buscar por nombre, meta o responsable…" className="h-9 text-xs" />
          {searching && <Button type="button" variant="ghost" size="sm" onClick={() => setObjectiveSearch("")}>Limpiar</Button>}
        </div>
      </div>
      {searching
        ? <SearchResults objectives={objectives} query={objectiveSearch} breadcrumbOf={breadcrumbOf} onUpdate={updateObjectiveFields} updatingId={updatingObjectiveId} />
        : <>
          {planView === "fronts" && <FrontsView map={objectivesMap} openFront={openFront} onOpenFront={setOpenFront} isMine={isMine} onUpdate={updateObjectiveFields} updatingId={updatingObjectiveId} />}
          {planView === "calendar" && <CalendarView timeline={objectivesMap.timeline} objectives={objectives} />}
          {planView === "actions" && <ActionsView actions={actions} owners={ownerOptions} onToggle={toggleAction} pendingId={pendingActionId} />}
          {planView === "habits" && <HabitsView map={objectivesMap} />}
          {planView === "load" && <BulkProgressView objectives={objectives} onSaved={() => queryClient.invalidateQueries({ queryKey })} />}
        </>}
    </div>}
  </PageShell>;
}

function LoadingState() {
  return <div role="status" aria-live="polite" className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-border/75 bg-card p-8 text-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /><p className="mt-3 text-sm font-semibold text-foreground">Cargando objetivos</p></div>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div role="alert" className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/[0.03] p-8 text-center"><AlertCircle className="h-7 w-7 text-destructive" /><p className="mt-3 text-sm font-semibold text-foreground">No se pudieron cargar los objetivos</p><p className="mt-1 max-w-md text-xs text-muted-foreground">{message}</p><Button type="button" variant="outline" size="sm" className="mt-4" onClick={onRetry}><RefreshCw className="mr-2 h-4 w-4" />Reintentar</Button></div>;
}
