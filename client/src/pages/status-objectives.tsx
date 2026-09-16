import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  Check,
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
} from "@/lib/objectives-api";

type ViewId = "summary" | "objectives" | "week" | "people" | "accounts";

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
  { id: "summary", label: "Resumen" },
  { id: "objectives", label: "Objetivos" },
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

function GoalCard({ objective, onUpdate, isUpdating }: { objective: Objective; onUpdate: (id: string | number, currentValue: string, progressPercent: number | null) => Promise<void>; isUpdating: boolean }) {
  const [editing, setEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(String(objective.currentValue ?? ""));
  const [progressPercent, setProgressPercent] = useState(objective.progressPercent == null ? "" : String(objective.progressPercent));
  const progress = typeof objective.progressPercent === "number" && Number.isFinite(objective.progressPercent) ? Math.max(0, Math.min(100, objective.progressPercent)) : null;
  const save = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const parsedProgress = progressPercent.trim() === "" ? null : Number(progressPercent); if (parsedProgress !== null && (!Number.isFinite(parsedProgress) || parsedProgress < 0 || parsedProgress > 100)) return; await onUpdate(objective.id, currentValue, parsedProgress); setEditing(false); };
  return (
    <article className="rounded-2xl border border-border/75 bg-card p-4 shadow-[0_10px_24px_-24px_rgba(15,23,42,0.55)] transition-shadow hover:shadow-[0_18px_32px_-24px_rgba(15,23,42,0.48)]">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-1.5"><Badge variant="outline" className={cn("px-2 py-1 text-[10px]", levelClass(objective.level))}>{levelLabel(objective.level)}</Badge><Badge variant="outline" className={cn("px-2 py-1 text-[10px]", statusClass(objective.status))}>{statusLabel(objective.status)}</Badge></div><h3 className="text-sm font-bold leading-5 text-foreground">{objective.title}</h3><p className="mt-1 text-xs text-muted-foreground">{objective.metric || "Métrica aún no definida"}</p></div><Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" /></div>
      <div className="mt-4 flex items-start justify-between gap-3 text-xs"><div><span className="block font-medium text-foreground">Meta: {valueText(objective.target, "Meta aún no definida")}</span><span className="mt-1 block text-muted-foreground">Avance actual: {objective.currentValue === null || objective.currentValue === undefined || objective.currentValue === "" ? "sin avance cargado" : valueText(objective.currentValue)}</span></div>{progress === null ? <span className="font-semibold text-muted-foreground">Avance no cargado</span> : <span className="font-bold text-primary">{progress}%</span>}</div>
      {progress === null ? <div className="mt-2 rounded-full bg-muted px-3 py-1.5 text-[11px] text-muted-foreground">Esta métrica todavía no tiene avance informado por la API.</div> : <Progress value={progress} className="mt-2 h-1.5 bg-muted" indicatorClassName={statusLabel(objective.status) === "En riesgo" ? "bg-amber-500" : "bg-primary"} />}
      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-[11px] text-muted-foreground"><span>Responsable</span><span className="font-semibold text-foreground">{ownerLabel(objective.owner)}</span></div>
      {editing ? <form onSubmit={save} className="mt-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-3"><div className="grid gap-2 sm:grid-cols-[1fr_9rem_auto_auto]"><div><Label htmlFor={`objective-value-${objective.id}`} className="text-xs">Avance actual</Label><Input id={`objective-value-${objective.id}`} value={currentValue} onChange={(event) => setCurrentValue(event.target.value)} placeholder="Ej. USD 42K" autoFocus /></div><div><Label htmlFor={`objective-progress-${objective.id}`} className="text-xs">Avance %</Label><Input id={`objective-progress-${objective.id}`} type="number" min="0" max="100" step="0.1" value={progressPercent} onChange={(event) => setProgressPercent(event.target.value)} placeholder="0–100" /></div><Button type="submit" size="sm" className="self-end" disabled={isUpdating}>{isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}</Button><Button type="button" size="sm" variant="ghost" className="self-end" onClick={() => setEditing(false)}>Cancelar</Button></div></form> : <Button type="button" variant="ghost" size="sm" className="mt-2 h-8 px-2 text-xs" onClick={() => setEditing(true)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Actualizar avance</Button>}
    </article>
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
  const queryClient = useQueryClient();
  const [view, setView] = useState<ViewId>("summary");
  const [objectiveLevelFilter, setObjectiveLevelFilter] = useState("all");
  const [objectiveSearch, setObjectiveSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("Todos");
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
  const currentWeekActions = useMemo(() => !currentWeekStart ? [] : actions.filter((action) => normalizeDate(action.weekStart) === normalizeDate(currentWeekStart)), [actions, currentWeekStart]);
  const filteredActions = useMemo(() => ownerFilter === "Todos" ? actions : actions.filter((action) => ownerKey(action.accountableOwner) === ownerFilter), [actions, ownerFilter]);
  const directoryObjectives = useMemo(() => objectives.filter((objective) => {
    const matchesLevel = objectiveLevelFilter === "all" || objective.level === objectiveLevelFilter;
    const query = objectiveSearch.trim().toLowerCase();
    const matchesSearch = !query || [objective.title, objective.metric, objective.areaKey, ownerLabel(objective.owner)].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
    return matchesLevel && matchesSearch;
  }), [objectives, objectiveLevelFilter, objectiveSearch]);
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
    {mutationError && <div role="alert" className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/[0.03] px-3 py-2 text-xs text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{mutationError instanceof Error ? mutationError.message : "No se pudo guardar el cambio."}</div>}
    <div role="tablist" aria-label="Vista de objetivos" className="flex items-center gap-1 overflow-x-auto border-b border-border/80 pb-px">{viewTabs.map((tab) => <button key={tab.id} id={`objectives-tab-${tab.id}`} type="button" role="tab" aria-selected={view === tab.id} aria-controls={`objectives-panel-${tab.id}`} tabIndex={view === tab.id ? 0 : -1} onClick={() => setView(tab.id)} className={cn("whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition-colors", view === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{tab.label}</button>)}</div>
    {view === "summary" && <div id="objectives-panel-summary" role="tabpanel" aria-labelledby="objectives-tab-summary" tabIndex={0} className="space-y-5"><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores principales"><MetricCard label="Objetivos" value={summary?.totalObjectives} detail="Total informado por la API" icon={BarChart3} tone="text-primary" /><MetricCard label="Acciones" value={summary?.totalActions} detail="Total informado por la API" icon={ListChecks} tone="text-violet-600" /><MetricCard label="Acciones completadas" value={summary?.completedActions} detail={summary ? `${summary.completedActions} de ${summary.totalActions}` : "Sin resumen disponible"} icon={Check} tone="text-emerald-600" /><MetricCard label="Objetivos en riesgo" value={summary?.atRiskObjectives} detail="Total informado por la API" icon={TrendingUp} tone="text-amber-600" /></section><StrategicSummary objectives={objectives} actions={actions} onOpenDirectory={(level) => { if (level) setObjectiveLevelFilter(level); setView("objectives"); }} /><section className="rounded-2xl border border-border/75 bg-card p-5"><div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-base font-bold text-foreground">Foco de esta semana</h2><p className="mt-1 text-xs text-muted-foreground">{currentWeekStart ? `${currentWeekLabel} · ${currentWeekActions.length} acciones` : "El backend no informó la semana actual."}</p></div><ListChecks className="h-5 w-5 text-emerald-600" /></div>{currentWeekActions.length === 0 ? <EmptyState title="Sin acciones esta semana" description={currentWeekStart ? "No hay acciones con ese weekStart." : "La API todavía no definió currentWeekStart."} /> : <div className="grid gap-2 md:grid-cols-2">{currentWeekActions.map((action) => <ActionCheck key={String(action.id)} action={action} onToggle={() => toggleAction(action)} isPending={updateActionMutation.isPending && updateActionMutation.variables?.id === action.id} />)}</div>}<button type="button" onClick={() => setView("week")} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Ver todas las acciones de la semana <ArrowUpRight className="h-3.5 w-3.5" /></button></section></div>}
    {view === "objectives" && <div id="objectives-panel-objectives" role="tabpanel" aria-labelledby="objectives-tab-objectives" tabIndex={0}><section className="rounded-2xl border border-border/75 bg-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-bold text-foreground">Todos los objetivos</h2><p className="mt-1 text-xs text-muted-foreground">Listado completo del plan, filtrable por nivel y búsqueda. La pantalla diaria queda en Resumen.</p></div><div className="flex flex-wrap gap-2"><Label htmlFor="objective-level-filter" className="sr-only">Filtrar por nivel</Label><select id="objective-level-filter" value={objectiveLevelFilter} onChange={(event) => setObjectiveLevelFilter(event.target.value)} className="h-9 rounded-lg border border-border bg-background px-2 text-xs font-semibold text-foreground"><option value="all">Todos los niveles</option><option value="company">Empresa</option><option value="area">Áreas</option><option value="person">Personas</option></select><Label htmlFor="objective-search" className="sr-only">Buscar objetivo</Label><Input id="objective-search" value={objectiveSearch} onChange={(event) => setObjectiveSearch(event.target.value)} placeholder="Buscar objetivo…" className="h-9 w-48 text-xs" /></div></div><p className="mt-4 text-xs text-muted-foreground">Mostrando {directoryObjectives.length} de {objectives.length} objetivos</p>{directoryObjectives.length === 0 ? <div className="mt-5"><EmptyState title="No hay coincidencias" description="Probá cambiar el nivel o la búsqueda." /></div> : <div className="mt-4 grid gap-3 md:grid-cols-2">{directoryObjectives.map((objective) => <GoalCard key={String(objective.id)} objective={objective} onUpdate={updateCurrentValue} isUpdating={updateObjectiveMutation.isPending && updateObjectiveMutation.variables?.id === objective.id} />)}</div>}</section></div>}
    {view === "week" && <div id="objectives-panel-week" role="tabpanel" aria-labelledby="objectives-tab-week" tabIndex={0}><section className="rounded-2xl border border-border/75 bg-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-bold text-foreground">Acciones por semana</h2><p className="mt-1 text-xs text-muted-foreground">Todos los registros del backend, con owner, objetivo, semana y cuenta.</p></div><div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /><Label htmlFor="owner-filter" className="sr-only">Filtrar por owner</Label><select id="owner-filter" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)} className="h-9 rounded-lg border border-border bg-background px-2 text-xs font-semibold text-foreground"><option value="Todos">Todos los owners</option>{ownerOptions.map((owner, index) => <option key={`${ownerKey(owner)}-${index}`} value={ownerKey(owner)}>{ownerLabel(owner)}</option>)}</select></div></div><ActionTable actions={filteredActions} onToggle={toggleAction} pendingId={updateActionMutation.isPending ? updateActionMutation.variables?.id ?? null : null} /></section></div>}
    {view === "people" && <div id="objectives-panel-people" role="tabpanel" aria-labelledby="objectives-tab-people" tabIndex={0}><section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{people.length === 0 ? <EmptyState title="No hay owners" description="La API no devolvió owners ni registros con responsable." /> : people.map(({ owner, objectives: personObjectives, actions: personActions }) => <article key={ownerKey(owner)} className="rounded-2xl border border-border/75 bg-card p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Persona</p><h2 className="mt-1 text-base font-bold text-foreground">{ownerLabel(owner)}</h2></div><Users className="h-5 w-5 text-primary" /></div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-muted/50 p-3"><span className="text-[11px] text-muted-foreground">Objetivos</span><strong className="mt-1 block text-xl text-foreground">{personObjectives.length}</strong></div><div className="rounded-xl bg-muted/50 p-3"><span className="text-[11px] text-muted-foreground">Acciones</span><strong className="mt-1 block text-xl text-foreground">{personActions.length}</strong></div></div><div className="mt-4 space-y-2">{personObjectives.length > 0 ? personObjectives.map((objective) => <div key={String(objective.id)} className="rounded-lg border border-border/60 px-3 py-2 text-xs"><span className="font-semibold text-foreground">{objective.title}</span><span className="mt-1 block text-muted-foreground">{objective.metric || "Métrica aún no definida"}</span></div>) : <p className="text-xs text-muted-foreground">Sin objetivos asignados.</p>}</div></article>)}</section></div>}
    {view === "accounts" && <div id="objectives-panel-accounts" role="tabpanel" aria-labelledby="objectives-tab-accounts" tabIndex={0}><section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]"><div className="rounded-2xl border border-border/75 bg-card p-5"><div className="flex items-center gap-2"><BriefcaseBusiness className="h-5 w-5 text-primary" /><h2 className="text-base font-bold">Cuentas</h2></div><p className="mt-1 text-xs text-muted-foreground">Cuentas devueltas por la API y acciones asociadas.</p><div className="mt-5 space-y-3">{accountRows.length === 0 ? <EmptyState title="No hay cuentas" description="La API no devolvió cuentas ni acciones asociadas a una cuenta." /> : accountRows.map(({ account, actions: accountActions }) => <div key={String(account.id)} className="rounded-xl border border-border/70 p-3"><div className="flex items-center justify-between gap-3"><div><div className="text-sm font-semibold">{account.name}</div><div className="mt-1 text-[11px] text-muted-foreground">{accountActions.length} acciones asociadas</div></div><Badge variant="outline" className="border-primary/20 bg-primary/[0.06] text-primary">{accountActions.length}</Badge></div>{accountActions.length > 0 && <div className="mt-3 space-y-1.5">{accountActions.map((action) => <div key={String(action.id)} className="text-xs text-muted-foreground">{action.title}</div>)}</div>}</div>)}</div></div><div className="rounded-2xl border border-border/75 bg-card p-5"><div className="flex items-center gap-2"><WalletCards className="h-5 w-5 text-amber-600" /><h2 className="text-base font-bold">Acciones sin cuenta</h2></div><div className="mt-6 text-3xl font-bold tracking-tight">{actions.filter((action) => (action.accountId === null || action.accountId === undefined) && !action.accountName).length}</div><p className="mt-1 text-xs text-muted-foreground">Cantidad derivada de los registros recibidos; no es una métrica simulada.</p></div></section></div>}
  </PageShell>;
}

function StrategicSummary({ objectives, actions, onOpenDirectory }: { objectives: Objective[]; actions: ObjectiveAction[]; onOpenDirectory: (level?: string) => void }) {
  const levels = [
    { key: "company", label: "Empresa", description: "Norte y resultados del cierre", tone: "text-violet-700 bg-violet-50 border-violet-200" },
    { key: "area", label: "Áreas", description: "Palancas de ejecución", tone: "text-sky-700 bg-sky-50 border-sky-200" },
    { key: "person", label: "Personas", description: "Responsabilidades individuales", tone: "text-slate-700 bg-slate-100 border-slate-200" },
  ];
  return <section className="rounded-2xl border border-border/75 bg-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-bold text-foreground">Mapa estratégico</h2><p className="mt-1 text-xs text-muted-foreground">La cascada completa queda disponible en Objetivos; este resumen muestra sólo la estructura para decidir rápido.</p></div><Button type="button" variant="outline" size="sm" onClick={() => onOpenDirectory()}>Ver todos los objetivos <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" /></Button></div><div className="mt-4 grid gap-2 md:grid-cols-3">{levels.map((level) => { const levelObjectives = objectives.filter((objective) => objective.level === level.key); const levelActions = actions.filter((action) => levelObjectives.some((objective) => String(objective.id) === String(action.objectiveId))); return <button type="button" key={level.key} onClick={() => onOpenDirectory(level.key)} className="rounded-xl border border-border/70 p-4 text-left transition-colors hover:bg-muted/40"><div className="flex items-center justify-between gap-3"><span className={cn("rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide", level.tone)}>{level.label}</span><span className="text-xl font-bold text-foreground">{levelObjectives.length}</span></div><p className="mt-3 text-sm font-semibold text-foreground">{level.description}</p><p className="mt-1 text-xs text-muted-foreground">{levelActions.length} acciones vinculadas</p></button>; })}</div></section>;
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
