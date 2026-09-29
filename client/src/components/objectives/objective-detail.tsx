import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Loader2, Pencil, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { statusLabel } from "@/lib/status-labels";
import type { Objective, ObjectiveAction, ObjectiveRef, UpdateObjectiveInput } from "@/lib/objectives-api";
import { deadlineOf, formatDeadline, tierOf } from "@/lib/objectives-tree";
import { KindBadge, MeasureText, ProgressControl, kindOf } from "./objective-kind";

function name(owner: ObjectiveRef | null | undefined): string {
  if (!owner) return "Sin responsable";
  if (typeof owner === "object") return owner.name ?? owner.title ?? "Sin responsable";
  return String(owner);
}

function day(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function isActionDone(action: ObjectiveAction): boolean {
  return String(action.status ?? "").toLowerCase() === "done";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{children}</dd>
    </div>
  );
}

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="border-t border-border/60 pt-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {aside}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function ActionLine({ action, onToggle, isPending, onOpen }: { action: ObjectiveAction; onToggle: () => void; isPending: boolean; onOpen: () => void }) {
  const done = isActionDone(action);
  return (
    <li className="flex items-start gap-2 py-1.5">
      <button type="button" onClick={onToggle} disabled={isPending} aria-pressed={done} aria-label={`${done ? "Reabrir" : "Marcar como hecha"}: ${action.title}`} className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border", done ? "border-emerald-500 bg-emerald-500 text-white" : "border-border text-transparent hover:border-emerald-400")}>
        {isPending ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /> : <Check className="h-3 w-3" />}
      </button>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className={cn("block text-sm font-semibold leading-5 hover:underline", done && "text-muted-foreground line-through")}>{action.title}</span>
        <span className="block text-[11px] text-muted-foreground">{name(action.accountableOwner)}{action.weekLabel ? ` · ${action.weekLabel}` : ""}</span>
      </button>
    </li>
  );
}

export function ObjectiveDetailSheet({ objective, breadcrumb, objectives, actions, onClose, onUpdate, isUpdating, onToggleAction, pendingActionId, onEdit, onOpenObjective, onOpenAction }: {
  objective: Objective | null;
  breadcrumb: string;
  objectives: Objective[];
  actions: ObjectiveAction[];
  onClose: () => void;
  onUpdate: (id: string | number, input: UpdateObjectiveInput) => Promise<void>;
  isUpdating: boolean;
  onToggleAction: (action: ObjectiveAction) => void;
  pendingActionId: string | number | null;
  onEdit: (objective: Objective) => void;
  onOpenObjective: (objective: Objective) => void;
  onOpenAction: (action: ObjectiveAction) => void;
}) {
  const children = useMemo(() => !objective ? [] : objectives.filter((candidate) => !candidate.retiredAt && String(candidate.parentObjectiveId ?? "") === String(objective.id)), [objective, objectives]);
  // Las acciones de toda la rama: lo que se hace para las bajadas también
  // empuja a este objetivo.
  const branchActions = useMemo(() => {
    if (!objective) return [];
    const branch = new Set<string>([String(objective.id)]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const candidate of objectives) {
        const parent = candidate.parentObjectiveId != null ? String(candidate.parentObjectiveId) : null;
        if (parent && branch.has(parent) && !branch.has(String(candidate.id))) { branch.add(String(candidate.id)); grew = true; }
      }
    }
    return actions
      .filter((action) => action.objectiveId != null && branch.has(String(action.objectiveId)))
      .sort((a, b) => Number(isActionDone(a)) - Number(isActionDone(b)) || String(a.weekStart ?? "").localeCompare(String(b.weekStart ?? "")));
  }, [objective, objectives, actions]);
  if (!objective) return null;

  const kind = kindOf(objective);
  const deadline = deadlineOf(objective);
  const done = branchActions.filter(isActionDone).length;

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="text-left">
          <div className="flex flex-wrap items-center gap-1.5 pr-6">
            <KindBadge kind={kind} />
            {tierOf(objective) === "innegociable" && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700"><Star className="h-3 w-3 fill-amber-400 text-amber-500" />Prioridad del mes</span>}
          </div>
          <SheetTitle className="text-lg leading-6">{objective.title}</SheetTitle>
          <SheetDescription>{breadcrumb}</SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-4">
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Responsable">{name(objective.owner)}</Field>
            <Field label={kind === "habito" ? "Vence" : "Vence"}>
              {kind === "habito" ? "No vence: se sostiene" : objective.targetDate ? (
                <>
                  {day(objective.targetDate)}
                  {deadline && <span className={cn("block text-[11px]", deadline.overdue ? "text-red-600" : deadline.soon ? "text-amber-700" : "text-muted-foreground")}>{formatDeadline(deadline)}</span>}
                  {objective.rescheduled && objective.planTargetDate && <span className="block text-[11px] text-muted-foreground">Reprogramado; el plan decía {day(objective.planTargetDate)}</span>}
                </>
              ) : "Sin fecha"}
            </Field>
          </dl>

          <Section title="Qué mide">
            <p className="text-sm text-foreground">{objective.metric || "Sin definir"}</p>
          </Section>

          <Section title="Meta">
            <p className="text-sm text-foreground">{objective.target ? String(objective.target) : "Sin definir"}</p>
          </Section>

          <Section title="Dónde estamos">
            <MeasureText objective={objective} className="text-sm" />
            <ProgressControl key={`${objective.id}-${objective.status}-${objective.progressPercent}`} objective={objective} onUpdate={onUpdate} isUpdating={isUpdating} />
          </Section>

          {children.length > 0 && (
            <Section title="Qué lo sostiene" aside={<span className="text-[11px] text-muted-foreground">{children.length}</span>}>
              <ul className="divide-y divide-border/60">
                {children.map((child) => (
                  <li key={String(child.id)}>
                    <button type="button" onClick={() => onOpenObjective(child)} className="flex w-full items-start gap-2 py-2 text-left hover:bg-muted/40">
                      <KindBadge kind={kindOf(child)} className="mt-0.5 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold leading-5">{child.title}</span>
                        <span className="block text-[11px] text-muted-foreground">{name(child.owner)} · <MeasureText objective={child} className="font-normal" /></span>
                      </span>
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Acciones" aside={branchActions.length > 0 ? <span className="text-[11px] text-muted-foreground">{done} de {branchActions.length} hechas</span> : undefined}>
            {branchActions.length === 0
              ? <p className="text-sm text-muted-foreground">Todavía no tiene acciones. Sin acciones, nadie lo está empujando esta semana.</p>
              : <ul>{branchActions.map((action) => <ActionLine key={String(action.id)} action={action} onToggle={() => onToggleAction(action)} isPending={pendingActionId === action.id} onOpen={() => onOpenAction(action)} />)}</ul>}
          </Section>

          <div className="flex justify-end border-t border-border/60 pt-4">
            <Button type="button" variant="outline" onClick={() => onEdit(objective)}><Pencil className="mr-1.5 h-4 w-4" />Editar</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ActionDetailSheet({ action, objectives, actions, onClose, onToggle, isPending, onEdit, onOpenObjective, onOpenAction, onSaveEvidence }: {
  action: ObjectiveAction | null;
  objectives: Objective[];
  actions: ObjectiveAction[];
  onClose: () => void;
  onToggle: (action: ObjectiveAction) => void;
  isPending: boolean;
  onEdit: (action: ObjectiveAction) => void;
  onOpenObjective: (objective: Objective) => void;
  onOpenAction: (action: ObjectiveAction) => void;
  onSaveEvidence: (action: ObjectiveAction, evidence: string | null) => Promise<void>;
}) {
  const [evidence, setEvidence] = useState("");
  const [editingEvidence, setEditingEvidence] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setEvidence(action?.evidence ?? ""); setEditingEvidence(false); }, [action]);
  if (!action) return null;

  const done = isActionDone(action);
  const parent = objectives.find((objective) => String(objective.id) === String(action.objectiveId ?? ""));
  const dependencies = (action.dependencyActionIds ?? [])
    .map((id) => actions.find((candidate) => String(candidate.id) === String(id)))
    .filter((candidate): candidate is ObjectiveAction => Boolean(candidate));
  const support = (action.supportingOwners ?? []).map(name).filter(Boolean);
  const events = action.events ?? [];

  const saveEvidence = async () => {
    setSaving(true);
    try { await onSaveEvidence(action, evidence.trim() || null); setEditingEvidence(false); }
    finally { setSaving(false); }
  };

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="text-left">
          <div className="flex flex-wrap items-center gap-1.5 pr-6">
            <KindBadge kind="accion" />
            <span className={cn("text-[11px] font-semibold", done ? "text-emerald-700" : "text-muted-foreground")}>{done ? "Hecha" : statusLabel(action.status)}</span>
          </div>
          <SheetTitle className="text-lg leading-6">{action.title}</SheetTitle>
          {action.description && <SheetDescription className="text-sm text-foreground/80">{action.description}</SheetDescription>}
        </SheetHeader>

        <div className="mt-5 space-y-4">
          <Button type="button" variant={done ? "outline" : "default"} onClick={() => onToggle(action)} disabled={isPending} className="w-full">
            {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
            {done ? "Reabrir" : "Marcar como hecha"}
          </Button>

          {parent && (
            <Section title="Para qué">
              <button type="button" onClick={() => onOpenObjective(parent)} className="flex w-full items-start gap-2 rounded-lg p-1 text-left hover:bg-muted/40">
                <KindBadge kind={kindOf(parent)} className="mt-0.5 shrink-0" />
                <span className="min-w-0 flex-1 text-sm font-semibold leading-5">{parent.title}</span>
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </Section>
          )}

          <dl className="grid grid-cols-2 gap-4 border-t border-border/60 pt-4">
            <Field label="Responsable">{name(action.accountableOwner)}</Field>
            <Field label="Apoyo">{support.length ? support.join(", ") : "—"}</Field>
            <Field label="Semana">{action.weekLabel || (action.weekStart ? day(action.weekStart) : "—")}</Field>
            <Field label="Fecha límite">{action.dueDate ? day(action.dueDate) : "—"}</Field>
            <Field label="Cliente">{action.accountName || "—"}</Field>
            <Field label="Foco">{action.focus || "—"}</Field>
          </dl>

          {dependencies.length > 0 && (
            <Section title="Depende de">
              <ul className="space-y-1">
                {dependencies.map((dependency) => (
                  <li key={String(dependency.id)}>
                    <button type="button" onClick={() => onOpenAction(dependency)} className="flex w-full items-start gap-2 text-left text-sm hover:underline">
                      <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", isActionDone(dependency) ? "bg-emerald-500" : "bg-amber-400")} aria-hidden="true" />
                      <span className={cn(isActionDone(dependency) && "text-muted-foreground line-through")}>{dependency.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Cómo sabemos que se hizo" aside={!editingEvidence ? <button type="button" onClick={() => setEditingEvidence(true)} className="text-[11px] font-semibold text-primary hover:underline">{action.evidence ? "Editar" : "Agregar"}</button> : undefined}>
            {editingEvidence ? (
              <div className="space-y-2">
                <Textarea value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Ej. Link a la propuesta enviada, acta de la reunión, mail de confirmación…" className="min-h-[72px]" autoFocus />
                <div className="flex justify-end gap-2">
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setEvidence(action.evidence ?? ""); setEditingEvidence(false); }}>Cancelar</Button>
                  <Button type="button" size="sm" onClick={saveEvidence} disabled={saving}>{saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Guardar</Button>
                </div>
              </div>
            ) : <p className={cn("whitespace-pre-wrap text-sm", action.evidence ? "text-foreground" : "text-muted-foreground")}>{action.evidence || "Sin evidencia cargada."}</p>}
          </Section>

          {events.length > 0 && (
            <Section title="Historial">
              <ul className="space-y-1">
                {events.map((event) => (
                  <li key={String(event.id)} className="text-[12px] text-muted-foreground">
                    <span className="font-semibold text-foreground">{event.userName || "Alguien"}</span> la pasó de {statusLabel(event.fromStatus).toLowerCase()} a {statusLabel(event.toStatus).toLowerCase()}{event.createdAt ? ` · ${day(event.createdAt)}` : ""}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <div className="flex justify-end border-t border-border/60 pt-4">
            <Button type="button" variant="outline" onClick={() => onEdit(action)}><Pencil className="mr-1.5 h-4 w-4" />Editar</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
