import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Objective, ObjectiveAction, ObjectiveRef, UpdateObjectiveActionInput, UpdateObjectiveInput } from "@/lib/objectives-api";
import type { ObjectivePickerGroup } from "@/lib/objectives-tree";

export type PersonOption = { id: string; name: string };

const selectClass = "mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

function refId(owner: ObjectiveRef | null | undefined): string {
  if (owner && typeof owner === "object" && owner.id != null) return String(owner.id);
  return "";
}

function refName(owner: ObjectiveRef | null | undefined): string {
  if (owner && typeof owner === "object") return owner.name ?? owner.title ?? "";
  return owner != null ? String(owner) : "";
}

/** La lista del equipo, con el responsable actual aunque ya no esté activo. */
function withCurrent(people: PersonOption[], current: ObjectiveRef | null | undefined): PersonOption[] {
  const id = refId(current);
  if (!id || people.some((person) => person.id === id)) return people;
  return [{ id, name: refName(current) || `Persona ${id}` }, ...people];
}

/**
 * Los objetivos agrupados por frente. Si la acción ya cuelga de algo que no
 * está en la lista (una bajada, un hábito), se muestra aparte para no perderlo.
 */
export function ObjectiveSelect({ id, value, onChange, groups, current, required, className }: { id: string; value: string; onChange: (value: string) => void; groups: ObjectivePickerGroup[]; current?: { id: string; title: string } | null; required?: boolean; className?: string }) {
  const listed = groups.some((group) => group.options.some((option) => option.id === value));
  const showCurrent = Boolean(current && current.id === value && !listed);
  return (
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)} required={required} className={className ?? selectClass}>
      {!value && <option value="">Elegir objetivo</option>}
      {showCurrent && current && <optgroup label="Actual"><option value={current.id}>{current.title}</option></optgroup>}
      {groups.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.options.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

function DeleteConfirm({ what, consequence, isPending, onCancel, onConfirm }: { what: string; consequence: string | null; isPending: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/[0.04] p-3">
      <p className="text-sm font-semibold text-foreground">¿Eliminar {what}?</p>
      {consequence && <p className="mt-1 text-xs text-muted-foreground">{consequence}</p>}
      <p className="mt-1 text-xs text-muted-foreground">Vas a poder deshacerlo justo después.</p>
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>No, volver</Button>
        <Button type="button" variant="destructive" size="sm" onClick={onConfirm} disabled={isPending}>{isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Sí, eliminar</Button>
      </div>
    </div>
  );
}

export function EditObjectiveDialog({ objective, people, dependents, onClose, onSave, onDelete }: {
  objective: Objective | null;
  people: PersonOption[];
  /** Cuánto se va con él: objetivos que cuelgan y acciones de toda la rama. */
  dependents: { objectives: number; actions: number };
  onClose: () => void;
  onSave: (id: string | number, input: UpdateObjectiveInput) => Promise<void>;
  onDelete: (objective: Objective) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [owner, setOwner] = useState("");
  const [date, setDate] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!objective) return;
    setTitle(objective.title ?? "");
    setTarget(objective.target != null ? String(objective.target) : "");
    setOwner(refId(objective.owner));
    setDate(objective.targetDate ? String(objective.targetDate).slice(0, 10) : "");
    setConfirming(false);
    setPending(null);
    setError(null);
  }, [objective]);

  const options = useMemo(() => withCurrent(people, objective?.owner), [people, objective]);
  if (!objective) return null;

  const hasDate = objective.targetKind !== "continuous";
  const planDate = objective.planTargetDate ? String(objective.planTargetDate).slice(0, 10) : "";
  const currentDate = objective.targetDate ? String(objective.targetDate).slice(0, 10) : "";

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) { setError("El objetivo necesita un nombre."); return; }
    const input: UpdateObjectiveInput = {};
    if (title.trim() !== objective.title) input.title = title.trim();
    if (target.trim() !== (objective.target != null ? String(objective.target) : "")) input.target = target.trim() || null;
    if (owner !== refId(objective.owner)) input.ownerPersonnelId = owner ? Number(owner) : null;
    // Volver a la fecha del plan es borrar la reprogramación, no fijarla igual.
    if (hasDate && date !== currentDate) input.targetDate = date && date !== planDate ? date : null;
    if (Object.keys(input).length === 0) { onClose(); return; }
    setPending("save");
    setError(null);
    try { await onSave(objective.id, input); onClose(); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : "No se pudo guardar."); }
    finally { setPending(null); }
  };

  const remove = async () => {
    setPending("delete");
    setError(null);
    try { await onDelete(objective); onClose(); }
    catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar."); setPending(null); }
  };

  const consequence = dependents.objectives > 0 || dependents.actions > 0
    ? `También se elimina lo que depende de él: ${[
        dependents.objectives > 0 ? `${dependents.objectives} ${dependents.objectives === 1 ? "objetivo" : "objetivos"}` : null,
        dependents.actions > 0 ? `${dependents.actions} ${dependents.actions === 1 ? "acción" : "acciones"}` : null,
      ].filter(Boolean).join(" y ")}.`
    : null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar objetivo</DialogTitle>
          <DialogDescription>Corregí lo que haga falta. El plan no pisa estos cambios.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div>
            <Label htmlFor="edit-objective-title">Objetivo</Label>
            <Input id="edit-objective-title" value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1.5" autoFocus />
          </div>
          <div>
            <Label htmlFor="edit-objective-target">Meta</Label>
            <Textarea id="edit-objective-target" value={target} onChange={(event) => setTarget(event.target.value)} className="mt-1.5 min-h-[64px]" placeholder="Ej. Al menos USD 10.000 por mes al 30 de noviembre" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="edit-objective-owner">Responsable</Label>
              <select id="edit-objective-owner" value={owner} onChange={(event) => setOwner(event.target.value)} className={selectClass}>
                <option value="">Sin responsable</option>
                {options.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
            </div>
            {hasDate && (
              <div>
                <Label htmlFor="edit-objective-date">Vence</Label>
                <Input id="edit-objective-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1.5" />
                {objective.rescheduled && planDate && (
                  <button type="button" onClick={() => setDate(planDate)} className="mt-1 text-[11px] font-semibold text-primary hover:underline">Volver a la fecha del plan</button>
                )}
              </div>
            )}
          </div>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          {confirming
            ? <DeleteConfirm what="este objetivo" consequence={consequence} isPending={pending === "delete"} onCancel={() => setConfirming(false)} onConfirm={remove} />
            : (
              <DialogFooter className="gap-2 sm:justify-between">
                <Button type="button" variant="ghost" className="text-destructive hover:bg-destructive/5 hover:text-destructive" onClick={() => setConfirming(true)}><Trash2 className="mr-1.5 h-4 w-4" />Eliminar</Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                  <Button type="submit" disabled={pending !== null}>{pending === "save" && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Guardar</Button>
                </div>
              </DialogFooter>
            )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditActionDialog({ action, people, objectiveGroups, onClose, onSave, onDelete }: {
  action: ObjectiveAction | null;
  people: PersonOption[];
  objectiveGroups: ObjectivePickerGroup[];
  onClose: () => void;
  onSave: (id: string | number, input: UpdateObjectiveActionInput) => Promise<void>;
  onDelete: (action: ObjectiveAction) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [objectiveId, setObjectiveId] = useState("");
  const [owner, setOwner] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!action) return;
    setTitle(action.title ?? "");
    setObjectiveId(action.objectiveId != null ? String(action.objectiveId) : "");
    setOwner(refId(action.accountableOwner));
    setDueDate(action.dueDate ? String(action.dueDate).slice(0, 10) : "");
    setConfirming(false);
    setPending(null);
    setError(null);
  }, [action]);

  const options = useMemo(() => withCurrent(people, action?.accountableOwner), [people, action]);
  if (!action) return null;

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) { setError("La acción necesita un nombre."); return; }
    const input: UpdateObjectiveActionInput = {};
    if (title.trim() !== action.title) input.title = title.trim();
    if (objectiveId && objectiveId !== String(action.objectiveId ?? "")) input.objectiveId = objectiveId;
    if (owner && owner !== refId(action.accountableOwner)) input.accountableOwner = owner;
    const currentDue = action.dueDate ? String(action.dueDate).slice(0, 10) : "";
    if (dueDate !== currentDue) input.dueDate = dueDate || null;
    if (Object.keys(input).length === 0) { onClose(); return; }
    setPending("save");
    setError(null);
    try { await onSave(action.id, input); onClose(); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : "No se pudo guardar."); }
    finally { setPending(null); }
  };

  const remove = async () => {
    setPending("delete");
    setError(null);
    try { await onDelete(action); onClose(); }
    catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar."); setPending(null); }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar acción</DialogTitle>
          <DialogDescription>Corregí lo que haga falta. El plan no pisa estos cambios.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div>
            <Label htmlFor="edit-action-title">Qué hay que hacer</Label>
            <Input id="edit-action-title" value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1.5" autoFocus />
          </div>
          <div>
            <Label htmlFor="edit-action-objective">Para qué objetivo</Label>
            <ObjectiveSelect id="edit-action-objective" value={objectiveId} onChange={setObjectiveId} groups={objectiveGroups} current={action.objectiveId != null ? { id: String(action.objectiveId), title: action.objectiveTitle ?? "Objetivo actual" } : null} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="edit-action-owner">Responsable</Label>
              <select id="edit-action-owner" value={owner} onChange={(event) => setOwner(event.target.value)} className={selectClass}>
                {!owner && <option value="">Sin responsable</option>}
                {options.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="edit-action-due">Fecha límite</Label>
              <Input id="edit-action-due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-1.5" />
            </div>
          </div>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          {confirming
            ? <DeleteConfirm what="esta acción" consequence={null} isPending={pending === "delete"} onCancel={() => setConfirming(false)} onConfirm={remove} />
            : (
              <DialogFooter className="gap-2 sm:justify-between">
                <Button type="button" variant="ghost" className="text-destructive hover:bg-destructive/5 hover:text-destructive" onClick={() => setConfirming(true)}><Trash2 className="mr-1.5 h-4 w-4" />Eliminar</Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                  <Button type="submit" disabled={pending !== null}>{pending === "save" && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Guardar</Button>
                </div>
              </DialogFooter>
            )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
