import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  AlertCircle,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  Flag,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Target,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  updateObjectiveAction,
  updateObjectivesProgress,
} from "@/lib/objectives-api";
import {
  buildObjectivesMap,
  childrenOfNode,
  deadlineOf,
  formatDeadline,
  isGroup,
  ObjectiveNode,
  tierOf,
  TreeItem,
} from "@/lib/objectives-tree";
import { FRONTS, frontOf, planRoleOf, type FrontId } from "@shared/objectives-fronts";

type ViewId = "summary" | "objectives" | "timeline" | "load" | "week" | "people" | "accounts";

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

const YEAR = 2026;

const viewTabs: Array<{ id: ViewId; label: string }> = [
  { id: "objectives", label: "Mapa" },
  { id: "summary", label: "Qué mirar" },
  { id: "timeline", label: "Línea de tiempo" },
  { id: "load", label: "Cargar avance" },
  { id: "week", label: "Esta semana" },
  { id: "people", label: "Personas" },
  { id: "accounts", label: "Cuentas" },
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
  if (owner === null || owner === undefined || owner === "") return "Sin owner asignado";
  if (typeof owner === "object") return owner.name ?? owner.title ?? (owner.id !== null && owner.id !== undefined ? String(owner.id) : "Sin owner asignado");
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
  if (!start) return "Semana actual sin fecha";
  const date = new Date(`${normalizeDate(start)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return start;
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" }).format(date);
}

function isDone(action: ObjectiveAction) {
  return ["done", "completed", "complete", "closed", "logrado", "cerrada", "completada"].includes((action.status ?? "").toLowerCase());
}

function statusLabel(status: string | null | undefined) {
  const normalized = (status ?? "").toLowerCase();
  if (["done", "completed", "complete", "closed", "logrado", "cerrada", "completada"].includes(normalized)) return "Completada";
  if (["at_risk", "risk", "en riesgo", "blocked", "bloqueada"].includes(normalized)) return "En riesgo";
  if (["in_progress", "in progress", "en curso", "active", "open"].includes(normalized)) return "En curso";
  // "planned" es el estado con el que el plan siembra todo, y "pending" es a
  // lo que vuelve una acción al reabrirla: sin estas dos, la pantalla muestra
  // el valor crudo de la base en inglés.
  if (["planned", "pending", "not_started", "todo", "planificada", "pendiente"].includes(normalized)) return "Planificada";
  if (["cancelled", "canceled", "cancelada"].includes(normalized)) return "Cancelada";
  return status || "Sin estado";
}

function statusClass(status: string | null | undefined) {
  const label = statusLabel(status);
  if (label === "Completada") return "border-blue-200 bg-blue-50 text-blue-700";
  if (label === "En riesgo") return "border-amber-200 bg-amber-50 text-amber-700";
  if (label === "En curso") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-border bg-muted/40 text-muted-foreground";
}

function levelLabel(level: string) {
  const normalized = level.toLowerCase();
  if (["company", "empresa", "organization", "org"].includes(normalized)) return "Empresa";
  if (["area", "área", "team"].includes(normalized)) return "Área";
  if (["person", "persona", "individual"].includes(normalized)) return "Persona";
  return level || "Sin nivel";
}

function levelClass(level: string) {
  const label = levelLabel(level);
  if (label === "Empresa") return "bg-violet-50 text-violet-700 border-violet-200";
  if (label === "Área") return "bg-sky-50 text-sky-700 border-sky-200";
  if (label === "Persona") return "bg-slate-100 text-slate-700 border-slate-200";
  return "bg-muted text-muted-foreground border-border";
}

function SectionNav({ active }: { active: "status" | "objectives" }) {
  return (
    <div className="flex w-fit items-center gap-1 rounded-xl border border-border/80 bg-card/80 p-1 shadow-sm">
      <Link href="/review" className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors", active === "status" ? "bg-slate-900 text-white" : "text-muted-foreground hover:bg-muted")}>Status semanal</Link>
      <Link href="/review/objectives" className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors", active === "objectives" ? "bg-slate-900 text-white" : "text-muted-foreground hover:bg-muted")}>Objetivos</Link>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center"><Target className="mx-auto h-6 w-6 text-muted-foreground" /><h2 className="mt-3 text-sm font-bold text-foreground">{title}</h2><p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{description}</p></div>;
}


function ProgressForm({ objective, onUpdate, isUpdating }: { objective: Objective; onUpdate: (id: string | number, currentValue: string, progressPercent: number | null) => Promise<void>; isUpdating: boolean }) {
  const [editing, setEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(String(objective.currentValue ?? ""));
  const [progressPercent, setProgressPercent] = useState(objective.progressPercent == null ? "" : String(objective.progressPercent));
  const save = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const parsedProgress = progressPercent.trim() === "" ? null : Number(progressPercent); if (parsedProgress !== null && (!Number.isFinite(parsedProgress) || parsedProgress < 0 || parsedProgress > 100)) return; await onUpdate(objective.id, currentValue, parsedProgress); setEditing(false); };
  return <>{editing ? <form onSubmit={save} className="mt-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-3"><div className="grid gap-2 sm:grid-cols-[1fr_9rem_auto_auto]"><div><Label htmlFor={`objective-value-${objective.id}`} className="text-xs">Avance actual</Label><Input id={`objective-value-${objective.id}`} value={currentValue} onChange={(event) => setCurrentValue(event.target.value)} placeholder="Ej. USD 42K" autoFocus /></div><div><Label htmlFor={`objective-progress-${objective.id}`} className="text-xs">Avance %</Label><Input id={`objective-progress-${objective.id}`} type="number" min="0" max="100" step="0.1" value={progressPercent} onChange={(event) => setProgressPercent(event.target.value)} placeholder="0–100" /></div><Button type="submit" size="sm" className="self-end" disabled={isUpdating}>{isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}</Button><Button type="button" size="sm" variant="ghost" className="self-end" onClick={() => setEditing(false)}>Cancelar</Button></div></form> : <Button type="button" variant="ghost" size="sm" className="mt-2 h-8 px-2 text-xs" onClick={() => setEditing(true)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Actualizar avance</Button>}</>;
}

function DeadlineBadge({ objective }: { objective: Objective }) {
  if (objective.targetKind === "continuous") {
    return <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Estándar sostenido</span>;
  }
  const deadline = deadlineOf(objective);
  if (!deadline) return null;
  const tone = deadline.overdue
    ? "border-red-200 bg-red-50 text-red-700"
    : deadline.soon
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-border bg-muted/40 text-muted-foreground";
  return <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", tone)}>{formatDeadline(deadline)}</span>;
}


function TierBadge({ objective }: { objective: Objective }) {
  if (tierOf(objective) !== "innegociable") return null;
  return <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">Innegociable</span>;
}

function ObjectiveBranch({ item, expanded, onToggle, onUpdate, updatingId, isMine }: { item: TreeItem; expanded: Set<string>; onToggle: (id: string) => void; onUpdate: (id: string | number, currentValue: string, progressPercent: number | null) => Promise<void>; updatingId: string | number | null; isMine: (owner: ObjectiveRef | null | undefined) => boolean }) {
  if (isGroup(item)) {
    const open = expanded.has(item.id);
    return (
      <div className="border-l border-border/70 pl-3">
        <button
          type="button"
          onClick={() => onToggle(item.id)}
          aria-expanded={open}
          className="flex w-full items-center gap-2 py-2 text-left"
        >
          {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className="text-xs font-bold text-foreground">{item.label}</span>
          <span className="text-[11px] text-muted-foreground">{item.descendants} {item.descendants === 1 ? "objetivo" : "objetivos"}</span>
        </button>
        {open && <div className="space-y-1 pb-1">{item.children.map((child) => <ObjectiveBranch key={String(child.objective.id)} item={child} expanded={expanded} onToggle={onToggle} onUpdate={onUpdate} updatingId={updatingId} isMine={isMine} />)}</div>}
      </div>
    );
  }

  const node = item;
  const id = String(node.objective.id);
  const kids = childrenOfNode(node);
  const open = expanded.has(id);
  const progress = typeof node.objective.progressPercent === "number" && Number.isFinite(node.objective.progressPercent)
    ? Math.max(0, Math.min(100, node.objective.progressPercent))
    : null;
  const mine = isMine(node.objective.owner);
  const role = planRoleOf(node.objective.slug, node.objective.level, node.objective.targetKind);
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
            <TierBadge objective={node.objective} />
            <DeadlineBadge objective={node.objective} />
            {role === "bajada"
              ? <span className="rounded-full border border-border bg-muted/50 px-1.5 py-0 text-[9px] font-semibold text-muted-foreground">Bajada · {levelLabel(node.objective.level)}</span>
              : <Badge variant="outline" className={cn("px-1.5 py-0 text-[9px]", levelClass(node.objective.level))}>{levelLabel(node.objective.level)}</Badge>}
          </div>
          <h4 className="mt-1 text-[13px] font-semibold leading-5 text-foreground">{node.objective.title}</h4>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{valueText(node.objective.target, "Meta aún no definida")}</p>
          {progress !== null && <Progress value={progress} className="mt-1.5 h-1" />}
          <ProgressForm objective={node.objective} onUpdate={onUpdate} isUpdating={updatingId === node.objective.id} />
        </div>
        <span className="shrink-0 text-right text-[10px] text-muted-foreground">{ownerLabel(node.objective.owner)}</span>
      </div>
      {open && kids.length > 0 && <div className="space-y-1 pb-1">{kids.map((child) => <ObjectiveBranch key={isGroup(child) ? child.id : String(child.objective.id)} item={child} expanded={expanded} onToggle={onToggle} onUpdate={onUpdate} updatingId={updatingId} isMine={isMine} />)}</div>}
    </div>
  );
}

function NorthStarPanel({ northStar, support, onLoadProgress }: { northStar: ObjectiveNode | null; support: ObjectiveNode[]; onLoadProgress: () => void }) {
  if (!northStar) return null;
  const objective = northStar.objective;
  const progress = typeof objective.progressPercent === "number" && Number.isFinite(objective.progressPercent) ? Math.max(0, Math.min(100, objective.progressPercent)) : null;
  return (
    <section aria-label="El norte del plan" className="rounded-2xl border border-slate-900/15 bg-slate-900 p-5 text-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">El norte</span>
          <h2 className="mt-1 text-lg font-bold leading-6">{objective.title}</h2>
          <p className="mt-1 text-xs text-white/70">{valueText(objective.target, "Meta aún no definida")}</p>
        </div>
        <div className="shrink-0 text-right">
          <span className="block text-[10px] uppercase tracking-wide text-white/55">Avance</span>
          {progress === null
            ? <span className="text-xs font-semibold text-white/70">Sin cargar</span>
            : <span className="text-2xl font-bold">{progress}%</span>}
        </div>
      </div>
      {progress === null
        ? <button type="button" onClick={onLoadProgress} className="mt-3 w-full rounded-xl border border-dashed border-white/25 px-3 py-2 text-left text-xs text-white/70 transition-colors hover:bg-white/5">
            Nadie cargó avance todavía. <span className="font-semibold text-white">Cargá el primero →</span>
          </button>
        : <Progress value={progress} className="mt-3 h-1.5 bg-white/15" />}
      {support.length > 0 && (
        <div className="mt-4 border-t border-white/15 pt-3">
          {support.map((node) => (
            <div key={String(node.objective.id)} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-white/80">{node.objective.title}</span>
              <span className="text-white/55">{valueText(node.objective.target, "—")}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function FrontCard({ front, active, onSelect }: { front: ReturnType<typeof buildObjectivesMap>["fronts"][number]; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "rounded-2xl border p-4 text-left transition-colors",
        active ? "border-primary bg-primary/[0.06]" : "border-border/75 bg-card hover:bg-muted/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-bold leading-5 text-foreground">{front.label}</span>
        {front.progress === null
          ? <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">sin medir</span>
          : <span className="shrink-0 text-lg font-bold text-foreground">{front.progress}%</span>}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {front.objectives_} {front.objectives_ === 1 ? "objetivo" : "objetivos"}
        {front.standards_ > 0 && <span className="text-muted-foreground/70"> · {front.standards_} estándar{front.standards_ === 1 ? "" : "es"}</span>}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {front.overdue > 0 && <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">{front.overdue} vencido{front.overdue === 1 ? "" : "s"}</span>}
        {front.dueSoon > 0 && <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">{front.dueSoon} vence{front.dueSoon === 1 ? "" : "n"} pronto</span>}
        {front.nonNegotiable > 0 && <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">{front.nonNegotiable} innegociable{front.nonNegotiable === 1 ? "" : "s"}</span>}
        {front.objectives_ === 0 && front.standards_ === 0
          ? <span className="text-[10px] text-muted-foreground">Sin objetivos cargados</span>
          : front.overdue === 0 && front.dueSoon === 0 && front.nonNegotiable === 0 && <span className="text-[10px] text-muted-foreground">Sin urgencias</span>}
      </div>
    </button>
  );
}

function StandardsPanel({ map }: { map: ReturnType<typeof buildObjectivesMap> }) {
  const breached = new Set(map.standardsBreached.map((objective) => String(objective.id)));
  const unmeasured = new Set(map.standardsUnmeasured.map((objective) => String(objective.id)));
  const ok = map.standards.length - breached.size - unmeasured.size;
  return (
    <section aria-label="Estándares sostenidos" className="rounded-2xl border border-border/75 bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground">Estándares</h2>
          <p className="mt-1 text-xs text-muted-foreground">No vencen: se sostienen. El semáforo mira cumplimiento, no avance.</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-semibold">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />{ok} en verde</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" />{breached.size} en rojo</span>
          <span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-full bg-slate-300" />{unmeasured.size} sin medir</span>
        </div>
      </div>
      <div className="mt-4 grid gap-1.5 md:grid-cols-2">
        {map.standards.map((objective) => {
          const id = String(objective.id);
          const estado = breached.has(id) ? "rojo" : unmeasured.has(id) ? "gris" : "verde";
          return (
            <div key={id} className="flex items-start gap-2 rounded-xl border border-border/60 px-3 py-2">
              <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", estado === "rojo" ? "bg-red-500" : estado === "gris" ? "bg-slate-300" : "bg-emerald-500")} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs font-semibold leading-4 text-foreground">{objective.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{valueText(objective.target, "Sin estándar definido")}</p>
                <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
                  {estado === "rojo" ? "Incumplido" : estado === "gris" ? "Nadie lo midió" : "En cumplimiento"} · {ownerLabel(objective.owner)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TimelineView({ timeline, objectives }: { timeline: ReturnType<typeof buildObjectivesMap>["timeline"]; objectives: Objective[] }) {
  const conFecha = objectives
    .filter((objective) => objective.targetDate && objective.targetKind !== "continuous")
    .sort((a, b) => String(a.targetDate).localeCompare(String(b.targetDate)));
  const marcadores = [...timeline].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <section className="rounded-2xl border border-border/75 bg-card p-5">
      <h2 className="text-base font-bold text-foreground">Línea de tiempo</h2>
      <p className="mt-1 text-xs text-muted-foreground">Cada objetivo cae por su fecha de corte. Los estándares no caen: viven en su propio panel.</p>
      <div className="mt-5 space-y-4">
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
                      <TierBadge objective={objective} />
                      <span className="truncate text-foreground">{objective.title}</span>
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

function MondayView({ map, onLoadProgress }: { map: ReturnType<typeof buildObjectivesMap>; onLoadProgress: () => void }) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-border/75 bg-card p-5">
        <h2 className="text-base font-bold text-foreground">Vence en 14 días</h2>
        <p className="mt-1 text-xs text-muted-foreground">Primero lo innegociable del mes, después por fecha.</p>
        {map.dueSoon.length === 0 ? (
          <p className="mt-4 text-xs text-muted-foreground">Nada vence en los próximos 14 días.</p>
        ) : (
          <ul className="mt-4 space-y-1.5">
            {map.dueSoon.map((objective) => {
              const deadline = deadlineOf(objective);
              return (
                <li key={String(objective.id)} className="flex items-start gap-2 border-b border-border/50 pb-1.5 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <TierBadge objective={objective} />
                      {deadline && <span className={cn("text-[10px] font-bold", deadline.overdue ? "text-red-600" : "text-amber-600")}>{formatDeadline(deadline)}</span>}
                    </div>
                    <p className="text-xs font-semibold leading-4 text-foreground">{objective.title}</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{ownerLabel(objective.owner)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="rounded-2xl border border-border/75 bg-card p-5">
        <h2 className="text-base font-bold text-foreground">Estándares en rojo</h2>
        <p className="mt-1 text-xs text-muted-foreground">Lo que se sostiene y hoy se está incumpliendo.</p>
        {map.standardsBreached.length === 0 ? (
          <p className="mt-4 text-xs text-muted-foreground">
            {map.standardsUnmeasured.length === map.standards.length
              ? "Ningún estándar está medido todavía, así que no se puede saber."
              : "Ningún estándar medido está incumplido."}
          </p>
        ) : (
          <ul className="mt-4 space-y-1.5">
            {map.standardsBreached.map((objective) => (
              <li key={String(objective.id)} className="flex items-start gap-2 border-b border-border/50 pb-1.5 last:border-0">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold leading-4 text-foreground">{objective.title}</p>
                  <p className="text-[10px] text-muted-foreground">{ownerLabel(objective.owner)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {map.standardsUnmeasured.length > 0 && (
          <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/30 p-3">
            <p className="text-xs font-semibold text-foreground">{map.standardsUnmeasured.length} estándares sin medir</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Gris no es rojo: no sabemos si se están cumpliendo.</p>
            <Button type="button" variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={onLoadProgress}>Cargar avance</Button>
          </div>
        )}
      </div>
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

  const rows = objectives.filter((objective) => {
    if (soloSinMedir && typeof objective.progressPercent === "number") return false;
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
        <div>
          <h2 className="text-base font-bold text-foreground">Cargar avance</h2>
          <p className="mt-1 text-xs text-muted-foreground">Toda la tanda de una vez. Tabulá entre campos y guardá al final.</p>
        </div>
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
      <p className="mt-3 text-xs text-muted-foreground">Mostrando {rows.length} de {objectives.length} objetivos</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="pb-2">Objetivo</th>
              <th className="pb-2">Meta</th>
              <th className="w-44 pb-2">Avance actual</th>
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

function SearchResults({ objectives, query, breadcrumbOf, onUpdate, updatingId }: { objectives: Objective[]; query: string; breadcrumbOf: (objective: Objective) => string; onUpdate: (id: string | number, currentValue: string, progressPercent: number | null) => Promise<void>; updatingId: string | number | null }) {
  const text = query.trim().toLowerCase();
  const matches = objectives.filter((objective) =>
    [objective.title, objective.metric, objective.target, objective.areaKey, ownerLabel(objective.owner)]
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
            <TierBadge objective={objective} />
            <DeadlineBadge objective={objective} />
            <Badge variant="outline" className={cn("px-1.5 py-0 text-[9px]", levelClass(objective.level))}>{levelLabel(objective.level)}</Badge>
          </div>
          <h4 className="mt-1 text-[13px] font-semibold text-foreground">{objective.title}</h4>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{valueText(objective.target, "Meta aún no definida")}</p>
          <ProgressForm objective={objective} onUpdate={onUpdate} isUpdating={updatingId === objective.id} />
        </div>
      ))}
    </div>
  );
}

function FrontsView({ map, objectives, query, onQueryChange, breadcrumbOf, onUpdate, updatingId, isMine }: { map: ReturnType<typeof buildObjectivesMap>; objectives: Objective[]; query: string; onQueryChange: (value: string) => void; breadcrumbOf: (objective: Objective) => string; onUpdate: (id: string | number, currentValue: string, progressPercent: number | null) => Promise<void>; updatingId: string | number | null; isMine: (owner: ObjectiveRef | null | undefined) => boolean }) {
  const [openFront, setOpenFront] = useState<FrontId | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const searching = query.trim().length > 0;
  const toggle = (id: string) => setExpanded((current) => {
    const next = new Set(current);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const front = map.fronts.find((candidate) => candidate.id === openFront) ?? null;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor="objective-search" className="sr-only">Buscar objetivo</Label>
        <Input id="objective-search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Buscar un objetivo por nombre, meta o responsable…" className="h-9 w-full max-w-md text-xs" />
        {searching && <Button type="button" variant="ghost" size="sm" onClick={() => onQueryChange("")}>Limpiar búsqueda</Button>}
      </div>
      {searching ? (
        <SearchResults objectives={objectives} query={query} breadcrumbOf={breadcrumbOf} onUpdate={onUpdate} updatingId={updatingId} />
      ) : (
      <>
      <section aria-label="Frentes del plan">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-bold text-foreground">Cinco frentes</h2>
          <p className="text-[11px] text-muted-foreground">
            El plan son <strong className="text-foreground">{map.counts.objetivo} objetivos</strong> y {map.counts.bajada} bajadas a área y persona.
            Aparte: {map.counts.estandar} estándares y {map.counts.checkpoint} puntos de control.
          </p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Abrí un frente para ver sus objetivos. La bajada aparece adentro de cada uno.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {map.fronts.map((candidate) => (
            <FrontCard
              key={candidate.id}
              front={candidate}
              active={candidate.id === openFront}
              onSelect={() => setOpenFront(candidate.id === openFront ? null : candidate.id)}
            />
          ))}
        </div>
      </section>
      {front && (
        <section className="rounded-2xl border border-primary/25 bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-foreground">{front.label}</h3>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpenFront(null)}>Cerrar</Button>
          </div>
          <div className="mt-2 space-y-1">
            {front.objectives.map((node) => (
              <ObjectiveBranch key={String(node.objective.id)} item={node} expanded={expanded} onToggle={toggle} onUpdate={onUpdate} updatingId={updatingId} isMine={isMine} />
            ))}
          </div>
        </section>
      )}
      {map.unplaced.length > 0 && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50/60 p-4">
          <h3 className="text-sm font-bold text-amber-900">Sin frente asignado</h3>
          <p className="mt-1 text-xs text-amber-800">Estos objetivos de empresa todavía no están dentro de ningún frente del plan.</p>
          <ul className="mt-2 space-y-0.5">
            {map.unplaced.map((objective) => <li key={String(objective.id)} className="text-xs text-amber-900">· {objective.title}</li>)}
          </ul>
        </section>
      )}
      <StandardsPanel map={map} />
      </>
      )}
    </div>
  );
}

function CurrentWeekBand({ actions, weekLabel, onToggle, pendingId, isMine }: { actions: ObjectiveAction[]; weekLabel: string; onToggle: (action: ObjectiveAction) => void; pendingId: string | number | null; isMine: (owner: ObjectiveRef | null | undefined) => boolean }) {
  const pending = actions.filter((action) => !isDone(action));
  const mineCount = actions.filter((action) => isMine(action.accountableOwner)).length;
  return (
    <section aria-label="Acciones de la semana vigente" className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Esta semana · {weekLabel}</h2>
        </div>
        <span className="text-[11px] font-semibold text-muted-foreground">
          {pending.length === 0
            ? `${actions.length} ${actions.length === 1 ? "acción" : "acciones"} · todo cerrado`
            : `${pending.length} ${pending.length === 1 ? "pendiente" : "pendientes"} de ${actions.length}`}
          {mineCount > 0 && <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-primary">{mineCount} tuya{mineCount === 1 ? "" : "s"}</span>}
        </span>
      </div>
      {actions.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">No hay acciones fechadas en la semana vigente.</p>
      ) : (
        <div className="mt-3 grid gap-1.5 md:grid-cols-2">
          {actions.map((action) => (
            <div key={String(action.id)} className={cn(isMine(action.accountableOwner) && "rounded-lg bg-primary/[0.06] ring-1 ring-primary/20")}><ActionCheck action={action} onToggle={() => onToggle(action)} isPending={pendingId === action.id} /></div>
          ))}
        </div>
      )}
    </section>
  );
}

function ActionCheck({ action, onToggle, isPending }: { action: ObjectiveAction; onToggle: () => void; isPending: boolean }) {
  const done = isDone(action);
  const supportLabel = action.supportingOwners?.length ? ` · apoyo: ${action.supportingOwners.map(ownerLabel).join(", ")}` : "";
  return <button type="button" onClick={onToggle} disabled={isPending} aria-pressed={done} aria-label={`${done ? "Reabrir" : "Completar"} acción: ${action.title}`} className="flex w-full items-start gap-3 rounded-xl border border-border/70 p-3 text-left transition-colors hover:bg-muted/50 disabled:cursor-wait disabled:opacity-60"><span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border", done ? "border-emerald-500 bg-emerald-500 text-white" : "border-border bg-background text-transparent")} aria-hidden="true"><Check className="h-3 w-3" /></span><span className="min-w-0 flex-1"><span className={cn("block text-sm font-semibold", done && "text-muted-foreground line-through")}>{action.title}</span><span className="mt-1 block text-[11px] text-muted-foreground">{ownerLabel(action.accountableOwner)}{supportLabel}{action.focus ? ` · ${action.focus}` : ""}</span></span><Badge variant="outline" className={cn("shrink-0 text-[10px]", statusClass(action.status))}>{statusLabel(action.status)}</Badge></button>;
}

function ActionTable({ actions, onToggle, pendingId }: { actions: ObjectiveAction[]; onToggle: (action: ObjectiveAction) => void; pendingId: string | number | null }) {
  if (actions.length === 0) return <EmptyState title="No hay acciones para mostrar" description="La API no devolvió acciones para los filtros actuales." />;
  return <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[840px] text-left text-sm"><thead><tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground"><th className="pb-3 pl-2">Acción</th><th className="pb-3">Objetivo</th><th className="pb-3">Semana</th><th className="pb-3">Responsable</th><th className="pb-3">Cuenta</th><th className="pb-3 pr-2 text-right">Estado</th></tr></thead><tbody>{actions.map((action) => { const done = isDone(action); const pending = pendingId === action.id; return <tr key={String(action.id)} className="border-b border-border/60 last:border-0"><td className="py-3 pl-2"><button type="button" onClick={() => onToggle(action)} disabled={pending} aria-pressed={done} aria-label={`${done ? "Reabrir" : "Completar"} acción: ${action.title}`} className="flex items-start gap-2 text-left disabled:opacity-60"><span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border", done ? "border-emerald-500 bg-emerald-500 text-white" : "border-border text-transparent")} aria-hidden="true"><Check className="h-3 w-3" /></span><span className={cn("font-semibold", done && "text-muted-foreground line-through")}>{action.title}</span></button>{action.focus && <div className="ml-7 mt-1 text-[11px] text-muted-foreground">{action.focus}</div>}</td><td className="max-w-[220px] py-3 text-xs text-muted-foreground">{action.objectiveTitle || "Objetivo sin título"}</td><td className="py-3 text-xs text-muted-foreground">{action.weekLabel || "Semana sin etiqueta"}{action.dueDate && <div className="mt-1 text-[10px]">Vence {action.dueDate}</div>}</td><td className="py-3 text-xs font-semibold">{ownerLabel(action.accountableOwner)}</td><td className="py-3 text-xs text-muted-foreground">{action.accountName || "Sin cuenta"}</td><td className="py-3 pr-2 text-right"><Badge variant="outline" className={cn("text-[10px]", statusClass(action.status))}>{statusLabel(action.status)}</Badge></td></tr>; })}</tbody></table></div>;
}

function ActionForm({ form, setForm, objectives, owners, accounts, onSubmit, onClose, isPending, error }: { form: ActionForm; setForm: (value: ActionForm) => void; objectives: Objective[]; owners: ObjectiveRef[]; accounts: ObjectiveAccount[]; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onClose: () => void; isPending: boolean; error: string | null }) {
  const set = (key: keyof ActionForm, value: string) => setForm({ ...form, [key]: value });
  return <form onSubmit={onSubmit} className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4" aria-label="Crear nueva acción"><div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-sm font-bold text-foreground">Nueva acción</h2><p className="mt-1 text-xs text-muted-foreground">La acción se guarda en el seguimiento persistente y queda vinculada a un objetivo.</p></div><Button type="button" variant="ghost" size="sm" onClick={onClose}>Cerrar</Button></div>{error && <div role="alert" className="mb-3 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><div className="md:col-span-2 xl:col-span-2"><Label htmlFor="action-title">Título *</Label><Input id="action-title" value={form.title} onChange={(event) => set("title", event.target.value)} required className="mt-1.5" placeholder="Ej. Reenviar Radar a destinatarios prioritarios" /></div><div><Label htmlFor="action-objective">Objetivo *</Label><select id="action-objective" value={form.objectiveId} onChange={(event) => set("objectiveId", event.target.value)} required className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Seleccionar objetivo</option>{objectives.map((objective) => <option key={String(objective.id)} value={String(objective.id)}>{objective.title}</option>)}</select></div><div><Label htmlFor="action-owner">Owner *</Label>{owners.length > 0 ? <select id="action-owner" value={form.owner} onChange={(event) => set("owner", event.target.value)} required className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Seleccionar owner</option>{owners.map((owner, index) => <option key={`${ownerKey(owner)}-${index}`} value={ownerKey(owner)}>{ownerLabel(owner)}</option>)}</select> : <Input id="action-owner" value={form.owner} onChange={(event) => set("owner", event.target.value)} required className="mt-1.5" placeholder="Nombre del owner" />}</div><div><Label htmlFor="action-week">Semana *</Label><Input id="action-week" value={form.weekLabel} onChange={(event) => set("weekLabel", event.target.value)} required className="mt-1.5" placeholder="Ej. 15–19 sep" /></div><div><Label htmlFor="action-week-start">Inicio de semana</Label><Input id="action-week-start" type="date" value={form.weekStart} onChange={(event) => set("weekStart", event.target.value)} className="mt-1.5" /></div><div><Label htmlFor="action-due-date">Fecha límite</Label><Input id="action-due-date" type="date" value={form.dueDate} onChange={(event) => set("dueDate", event.target.value)} className="mt-1.5" /></div><div><Label htmlFor="action-account">Cuenta</Label><select id="action-account" value={form.accountId} onChange={(event) => set("accountId", event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Sin cuenta</option>{accounts.map((account) => <option key={String(account.id)} value={String(account.id)}>{account.name}</option>)}</select></div><div><Label htmlFor="action-focus">Foco</Label><Input id="action-focus" value={form.focus} onChange={(event) => set("focus", event.target.value)} className="mt-1.5" placeholder="Ej. Conversión" /></div></div><div className="mt-4 flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={isPending || objectives.length === 0}>{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar acción</Button></div></form>;
}

export default function StatusObjectivesPage() {
  const [location] = useLocation();
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  // El plan entra por su mapa: el norte arriba y los cinco frentes. La vista
  // del lunes queda a un clic, en Resumen.
  const [view, setView] = useState<ViewId>("objectives");
  const [ownerFilter, setOwnerFilter] = useState("Todos");
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
  const summary = data?.summary;
  const currentWeekStart = summary?.currentWeekStart ?? null;
  const currentWeekLabel = formatWeek(currentWeekStart);

  const ownerOptions = useMemo(() => {
    const all = [...owners, ...objectives.map((objective) => objective.owner), ...actions.map((action) => action.accountableOwner)].filter(Boolean) as ObjectiveRef[];
    const seen = new Set<string>();
    return all.filter((owner) => { const key = ownerKey(owner); if (!key || seen.has(key)) return false; seen.add(key); return true; });
  }, [actions, objectives, owners]);
  // "¿Qué me toca a mí?" es la pregunta más frecuente, así que la pantalla
  // arranca mostrando lo del usuario logueado si su cuenta está vinculada a
  // una persona del equipo. Un clic muestra todo.
  // "Lo mío" resalta, no filtra. Filtrar el árbol por persona lo dejaba lleno
  // de agujeros —el norte desaparecía si era de otro, quedaban ramas sin raíz
  // y frentes vacíos que decían "sin urgencias"— porque persona y jerarquía
  // son dos ejes distintos. El mapa siempre muestra el plan completo.
  const myPersonnelId = authUser?.personnelId ?? null;
  const [highlightMine, setHighlightMine] = useState<boolean>(false);
  useEffect(() => { if (myPersonnelId != null) setHighlightMine(true); }, [myPersonnelId]);
  const isMine = useMemo(() => {
    if (myPersonnelId == null) return () => false;
    return (owner: ObjectiveRef | null | undefined) => String(ownerKey(owner)) === String(myPersonnelId);
  }, [myPersonnelId]);
  const objectivesMap = useMemo(() => buildObjectivesMap(objectives), [objectives]);
  const mineCount = useMemo(() => objectives.filter((objective) => isMine(objective.owner)).length, [objectives, isMine]);

  // Ruta legible de un objetivo, para que un resultado de búsqueda diga de
  // dónde cuelga en vez de aparecer sin contexto.
  const breadcrumbOf = useMemo(() => {
    const byId = new Map(objectives.map((objective) => [String(objective.id), objective]));
    return (objective: Objective) => {
      const chain: string[] = [];
      let current: Objective | undefined = objective;
      const seen = new Set<string>();
      while (current && !seen.has(String(current.id))) {
        seen.add(String(current.id));
        const parentId: string | null = current.parentObjectiveId != null ? String(current.parentObjectiveId) : null;
        current = parentId ? byId.get(parentId) : undefined;
        if (current) chain.unshift(current.title);
      }
      const front = chain.length ? frontOf(objectives.find((candidate) => candidate.title === chain[0])?.slug) : frontOf(objective.slug);
      const label = front ? FRONTS[front] : null;
      return [label, ...chain].filter(Boolean).join(" › ") || "Raíz del plan";
    };
  }, [objectives]);
  const currentWeekActions = useMemo(() => !currentWeekStart ? [] : actions.filter((action) => normalizeDate(action.weekStart) === normalizeDate(currentWeekStart)), [actions, currentWeekStart]);
  const filteredActions = useMemo(() => ownerFilter === "Todos" ? actions : actions.filter((action) => ownerKey(action.accountableOwner) === ownerFilter), [actions, ownerFilter]);
  const people = useMemo(() => ownerOptions.map((owner) => { const key = ownerKey(owner); return { owner, objectives: objectives.filter((objective) => ownerKey(objective.owner) === key), actions: actions.filter((action) => [action.accountableOwner, ...(action.supportingOwners ?? [])].some((candidate) => ownerKey(candidate) === key)) }; }), [actions, objectives, ownerOptions]);
  const accountRows = useMemo(() => {
    const rows = accounts.map((account) => ({ account, actions: actions.filter((action) => String(action.accountId ?? "") === String(account.id) || action.accountName === account.name) }));
    const known = new Set(rows.map(({ account }) => String(account.id)));
    actions.filter((action) => action.accountId !== null && action.accountId !== undefined && !known.has(String(action.accountId))).forEach((action) => { rows.push({ account: { id: action.accountId as string | number, name: action.accountName || "Cuenta sin nombre" }, actions: actions.filter((candidate) => String(candidate.accountId ?? "") === String(action.accountId)) }); known.add(String(action.accountId)); });
    return rows;
  }, [accounts, actions]);

  const updateActionMutation = useMutation({ mutationFn: ({ id, status }: { id: string | number; status: string }) => updateObjectiveAction(id, { status }), onSuccess: () => queryClient.invalidateQueries({ queryKey }) });
  const updateObjectiveMutation = useMutation({ mutationFn: ({ id, currentValue, progressPercent }: { id: string | number; currentValue: string; progressPercent: number | null }) => updateObjective(id, { currentValue, progressPercent }), onSuccess: () => queryClient.invalidateQueries({ queryKey }) });
  const createActionMutation = useMutation({ mutationFn: createObjectiveAction, onSuccess: () => { queryClient.invalidateQueries({ queryKey }); setShowActionForm(false); setForm(emptyActionForm); setFormError(null); }, onError: (error) => setFormError(error instanceof Error ? error.message : "No se pudo crear la acción.") });
  const mutationError = updateActionMutation.error ?? updateObjectiveMutation.error;

  const openActionForm = () => { setForm({ ...emptyActionForm, objectiveId: objectives[0] ? String(objectives[0].id) : "", owner: ownerOptions[0] ? ownerKey(ownerOptions[0]) : "", weekStart: normalizeDate(currentWeekStart), weekLabel: currentWeekStart ? currentWeekLabel : "" }); setFormError(null); setShowActionForm(true); };
  const submitAction = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setFormError(null); createActionMutation.mutate({ title: form.title.trim(), objectiveId: form.objectiveId, accountableOwner: form.owner, weekLabel: form.weekLabel.trim(), ...(form.weekStart ? { weekStart: form.weekStart } : {}), ...(form.dueDate ? { dueDate: form.dueDate } : {}), ...(form.accountId ? { accountId: form.accountId } : {}), ...(form.focus.trim() ? { focus: form.focus.trim() } : {}) }); };
  const toggleAction = (action: ObjectiveAction) => updateActionMutation.mutate({ id: action.id, status: isDone(action) ? "pending" : "done" });
  const updateCurrentValue = async (id: string | number, currentValue: string, progressPercent: number | null) => { await updateObjectiveMutation.mutateAsync({ id, currentValue, progressPercent }); };

  if (objectivesQuery.isLoading) return <PageShell width="wide" spacing="compact" className="pb-8"><LoadingState /></PageShell>;
  if (objectivesQuery.isError) return <PageShell width="wide" spacing="compact" className="pb-8"><ErrorState message={objectivesQuery.error instanceof Error ? objectivesQuery.error.message : "No se pudieron cargar los objetivos."} onRetry={() => objectivesQuery.refetch()} /></PageShell>;

  return <PageShell width="wide" spacing="compact" className="pb-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><SectionNav active={location.startsWith("/review/objectives") ? "objectives" : "status"} /><div className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /><span>Plan Cierre {YEAR}</span>{currentWeekStart && <><span className="text-border">·</span><span>Semana desde {formatWeek(currentWeekStart)}</span></>}</div></div>
    <CompactPageHeader eyebrow="Status · seguimiento integrado" title="Objetivos y acciones" description="Objetivos y acciones persistentes, conectados por owner, semana, cuenta y foco." icon={<Target className="h-5 w-5" />} actions={<Button size="sm" onClick={openActionForm} disabled={objectives.length === 0}><Plus className="h-4 w-4" />Nueva acción</Button>} meta={<><Badge variant="outline" className="gap-1.5 border-primary/20 bg-primary/[0.06] text-primary"><CircleDashed className="h-3 w-3" />API persistente</Badge><span className="inline-flex items-center gap-1.5"><Flag className="h-3.5 w-3.5" />Datos del backend</span></>} />
    {showActionForm && <ActionForm form={form} setForm={setForm} objectives={objectives} owners={ownerOptions} accounts={accounts} onSubmit={submitAction} onClose={() => setShowActionForm(false)} isPending={createActionMutation.isPending} error={formError} />}
    {myPersonnelId != null && mineCount > 0 && (
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border/80 bg-card/80 px-3 py-1.5 text-xs font-semibold shadow-sm">
          <input type="checkbox" checked={highlightMine} onChange={(event) => setHighlightMine(event.target.checked)} />
          Resaltar lo mío ({mineCount})
        </label>
        <span className="text-[11px] text-muted-foreground">El mapa muestra siempre el plan completo. Tu lista está en <button type="button" onClick={() => setView("people")} className="font-semibold text-primary hover:underline">Personas</button>.</span>
      </div>
    )}
    <NorthStarPanel northStar={objectivesMap.northStar} support={objectivesMap.northSupport} onLoadProgress={() => setView("load")} />
    <CurrentWeekBand actions={currentWeekActions} weekLabel={currentWeekLabel} isMine={highlightMine ? isMine : () => false} onToggle={toggleAction} pendingId={updateActionMutation.isPending ? updateActionMutation.variables?.id ?? null : null} />
    {mutationError && <div role="alert" className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/[0.03] px-3 py-2 text-xs text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{mutationError instanceof Error ? mutationError.message : "No se pudo guardar el cambio."}</div>}
    <div role="tablist" aria-label="Vista de objetivos" className="flex items-center gap-1 overflow-x-auto border-b border-border/80 pb-px">{viewTabs.map((tab) => <button key={tab.id} id={`objectives-tab-${tab.id}`} type="button" role="tab" aria-selected={view === tab.id} aria-controls={`objectives-panel-${tab.id}`} tabIndex={view === tab.id ? 0 : -1} onClick={() => setView(tab.id)} className={cn("whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition-colors", view === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{tab.label}</button>)}</div>
    {view === "summary" && <div id="objectives-panel-summary" role="tabpanel" aria-labelledby="objectives-tab-summary" tabIndex={0} className="space-y-5"><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores principales"><MetricCard label="Objetivos" value={summary?.totalObjectives} detail="Total informado por la API" icon={BarChart3} tone="text-primary" /><MetricCard label="Acciones" value={summary?.totalActions} detail="Total informado por la API" icon={ListChecks} tone="text-violet-600" /><MetricCard label="Acciones completadas" value={summary?.completedActions} detail={summary ? `${summary.completedActions} de ${summary.totalActions}` : "Sin resumen disponible"} icon={Check} tone="text-emerald-600" /><MetricCard label="Objetivos en riesgo" value={summary?.atRiskObjectives} detail="Total informado por la API" icon={TrendingUp} tone="text-amber-600" /></section><MondayView map={objectivesMap} onLoadProgress={() => setView("load")} /></div>}
    {view === "objectives" && <div id="objectives-panel-objectives" role="tabpanel" aria-labelledby="objectives-tab-objectives" tabIndex={0}><FrontsView map={objectivesMap} objectives={objectives} query={objectiveSearch} onQueryChange={setObjectiveSearch} breadcrumbOf={breadcrumbOf} isMine={highlightMine ? isMine : () => false} onUpdate={updateCurrentValue} updatingId={updateObjectiveMutation.isPending ? updateObjectiveMutation.variables?.id ?? null : null} /></div>}
    {view === "week" && <div id="objectives-panel-week" role="tabpanel" aria-labelledby="objectives-tab-week" tabIndex={0}><section className="rounded-2xl border border-border/75 bg-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-bold text-foreground">Acciones por semana</h2><p className="mt-1 text-xs text-muted-foreground">Todos los registros del backend, con owner, objetivo, semana y cuenta.</p></div><div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /><Label htmlFor="owner-filter" className="sr-only">Filtrar por owner</Label><select id="owner-filter" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)} className="h-9 rounded-lg border border-border bg-background px-2 text-xs font-semibold text-foreground"><option value="Todos">Todos los owners</option>{ownerOptions.map((owner, index) => <option key={`${ownerKey(owner)}-${index}`} value={ownerKey(owner)}>{ownerLabel(owner)}</option>)}</select></div></div><ActionTable actions={filteredActions} onToggle={toggleAction} pendingId={updateActionMutation.isPending ? updateActionMutation.variables?.id ?? null : null} /></section></div>}
    {view === "timeline" && <div id="objectives-panel-timeline" role="tabpanel" aria-labelledby="objectives-tab-timeline" tabIndex={0}><TimelineView timeline={objectivesMap.timeline} objectives={objectives} /></div>}
    {view === "load" && <div id="objectives-panel-load" role="tabpanel" aria-labelledby="objectives-tab-load" tabIndex={0}><BulkProgressView objectives={objectives} onSaved={() => queryClient.invalidateQueries({ queryKey })} /></div>}
    {view === "people" && <div id="objectives-panel-people" role="tabpanel" aria-labelledby="objectives-tab-people" tabIndex={0}><section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{people.length === 0 ? <EmptyState title="No hay owners" description="La API no devolvió owners ni registros con responsable." /> : people.map(({ owner, objectives: personObjectives, actions: personActions }) => <article key={ownerKey(owner)} className="rounded-2xl border border-border/75 bg-card p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Persona</p><h2 className="mt-1 text-base font-bold text-foreground">{ownerLabel(owner)}</h2></div><Users className="h-5 w-5 text-primary" /></div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-muted/50 p-3"><span className="text-[11px] text-muted-foreground">Objetivos</span><strong className="mt-1 block text-xl text-foreground">{personObjectives.length}</strong></div><div className="rounded-xl bg-muted/50 p-3"><span className="text-[11px] text-muted-foreground">Acciones</span><strong className="mt-1 block text-xl text-foreground">{personActions.length}</strong></div></div><div className="mt-4 space-y-2">{personObjectives.length > 0 ? personObjectives.map((objective) => <div key={String(objective.id)} className="rounded-lg border border-border/60 px-3 py-2 text-xs"><span className="font-semibold text-foreground">{objective.title}</span><span className="mt-1 block text-muted-foreground">{objective.metric || "Métrica aún no definida"}</span></div>) : <p className="text-xs text-muted-foreground">Sin objetivos asignados.</p>}</div></article>)}</section></div>}
    {view === "accounts" && <div id="objectives-panel-accounts" role="tabpanel" aria-labelledby="objectives-tab-accounts" tabIndex={0}><section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]"><div className="rounded-2xl border border-border/75 bg-card p-5"><div className="flex items-center gap-2"><BriefcaseBusiness className="h-5 w-5 text-primary" /><h2 className="text-base font-bold">Cuentas</h2></div><p className="mt-1 text-xs text-muted-foreground">Cuentas devueltas por la API y acciones asociadas.</p><div className="mt-5 space-y-3">{accountRows.length === 0 ? <EmptyState title="No hay cuentas" description="La API no devolvió cuentas ni acciones asociadas a una cuenta." /> : accountRows.map(({ account, actions: accountActions }) => <div key={String(account.id)} className="rounded-xl border border-border/70 p-3"><div className="flex items-center justify-between gap-3"><div><div className="text-sm font-semibold">{account.name}</div><div className="mt-1 text-[11px] text-muted-foreground">{accountActions.length} acciones asociadas</div></div><Badge variant="outline" className="border-primary/20 bg-primary/[0.06] text-primary">{accountActions.length}</Badge></div>{accountActions.length > 0 && <div className="mt-3 space-y-1.5">{accountActions.map((action) => <div key={String(action.id)} className="text-xs text-muted-foreground">{action.title}</div>)}</div>}</div>)}</div></div><div className="rounded-2xl border border-border/75 bg-card p-5"><div className="flex items-center gap-2"><WalletCards className="h-5 w-5 text-amber-600" /><h2 className="text-base font-bold">Acciones sin cuenta</h2></div><div className="mt-6 text-3xl font-bold tracking-tight">{actions.filter((action) => (action.accountId === null || action.accountId === undefined) && !action.accountName).length}</div><p className="mt-1 text-xs text-muted-foreground">Cantidad derivada de los registros recibidos; no es una métrica simulada.</p></div></section></div>}
  </PageShell>;
}


function MetricCard({ label, value, detail, icon: Icon, tone }: { label: string; value: number | undefined; detail: string; icon: typeof BarChart3; tone: string }) {
  return <div className="rounded-2xl border border-border/75 bg-card p-4 shadow-[0_10px_24px_-24px_rgba(15,23,42,0.55)]"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">{label}</span><Icon className={cn("h-4 w-4", tone)} /></div><div className="mt-3 text-2xl font-bold tracking-tight text-foreground">{value === undefined ? "—" : value}</div><div className="mt-1 text-xs text-muted-foreground">{detail}</div></div>;
}

function LoadingState() {
  return <div role="status" aria-live="polite" className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-border/75 bg-card p-8 text-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /><p className="mt-3 text-sm font-semibold text-foreground">Cargando objetivos</p><p className="mt-1 text-xs text-muted-foreground">Consultando el seguimiento persistente de 2026.</p></div>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div role="alert" className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/[0.03] p-8 text-center"><AlertCircle className="h-7 w-7 text-destructive" /><p className="mt-3 text-sm font-semibold text-foreground">No se pudo cargar objetivos</p><p className="mt-1 max-w-md text-xs text-muted-foreground">{message}</p><Button type="button" variant="outline" size="sm" className="mt-4" onClick={onRetry}><RefreshCw className="mr-2 h-4 w-4" />Reintentar</Button></div>;
}
