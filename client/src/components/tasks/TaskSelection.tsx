import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { invalidateTaskQueries } from "@/lib/task-cache";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

type Selection = { selected: Set<number>; toggle: (id: number, range: boolean, additive: boolean) => void };
const Context = createContext<Selection | null>(null);
const editableTarget = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest('input:not([data-task-select]), textarea, select, [contenteditable="true"], [role="dialog"], [data-radix-popper-content-wrapper]'));

export function TaskSelectionCheckbox({ taskId }: { taskId: number }) {
  const selection = useContext(Context);
  if (!selection) return null;
  return <input data-task-select={taskId} type="checkbox" aria-label={`Seleccionar tarea ${taskId}`} checked={selection.selected.has(taskId)} className="mx-1 h-4 w-4 shrink-0 accent-primary"
    onChange={() => {}} onClick={e => { e.stopPropagation(); selection.toggle(taskId, e.shiftKey, e.metaKey || e.ctrlKey); }} />;
}

export function TaskSelectionProvider({ projectId, canDelete, onDeleted, children }: { projectId: number; canDelete: boolean; onDeleted: () => void; children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null), anchor = useRef<number | null>(null);
  const [selected, setSelected] = useState(new Set<number>()), [confirm, setConfirm] = useState(false);
  useEffect(() => { setSelected(new Set()); anchor.current = null; }, [projectId]);
  const visible = () => [...new Set(Array.from(root.current?.querySelectorAll<HTMLInputElement>('input[data-task-select]') ?? []).filter(el => el.getClientRects().length > 0).map(el => Number(el.dataset.taskSelect)))];
  const toggle = (id: number, range: boolean, additive: boolean) => {
    setSelected(previous => {
      const next = new Set(previous), order = visible();
      if (range && anchor.current != null && order.includes(anchor.current) && order.includes(id)) {
        if (!additive) next.clear();
        const a = order.indexOf(anchor.current), b = order.indexOf(id);
        order.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(id => next.add(id));
      } else { next.has(id) ? next.delete(id) : next.add(id); anchor.current = id; }
      return next;
    });
  };
  const mutation = useMutation({
    mutationFn: () => apiRequest("/api/tasks/bulk-delete", "POST", { projectId, taskIds: [...selected] }),
    onSuccess: () => { setConfirm(false); setSelected(new Set()); anchor.current = null; void invalidateTaskQueries(); onDeleted(); toast({ title: "Tareas eliminadas" }); },
    onError: (error: Error) => toast({ title: "No se pudieron eliminar las tareas", description: error.message, variant: "destructive" }),
  });
  return <Context.Provider value={canDelete ? { selected, toggle } : null}>
    <div ref={root} tabIndex={0} onClickCapture={e => {
      if (!canDelete || editableTarget(e.target) || !(e.target instanceof Element) || e.target.closest('button,a,input')) return;
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        const row = e.target.closest('[data-task-row]');
        if (row) { e.preventDefault(); e.stopPropagation(); toggle(Number(row.getAttribute('data-task-row')), e.shiftKey, e.metaKey || e.ctrlKey); }
      }
    }} onKeyDown={e => {
      if (!canDelete || editableTarget(e.target) || confirm) return;
      if (e.key === "Escape") { setSelected(new Set()); anchor.current = null; }
      if ((e.key === "Delete" || e.key === "Backspace") && selected.size) { e.preventDefault(); setConfirm(true); }
      if (e.shiftKey && ["ArrowUp", "ArrowDown"].includes(e.key)) {
        const order = visible(), focused = e.target instanceof HTMLElement ? Number(e.target.dataset.taskSelect) : anchor.current;
        const idx = order.indexOf(focused ?? -1), id = order[idx + (e.key === "ArrowDown" ? 1 : -1)];
        if (id != null) { e.preventDefault(); if (anchor.current == null) anchor.current = focused ?? id; toggle(id, true, false); root.current?.querySelector<HTMLInputElement>(`input[data-task-select="${id}"]`)?.focus(); }
      }
    }}>
      {selected.size > 0 && <div className="sticky top-0 z-20 mb-2 flex items-center gap-3 rounded border bg-background p-2 text-sm"><span>{selected.size} seleccionada(s)</span><Button size="sm" variant="destructive" onClick={() => setConfirm(true)}>Eliminar</Button><Button size="sm" variant="ghost" onClick={() => { setSelected(new Set()); anchor.current = null; }}>Limpiar selección</Button></div>}
      {children}
    </div>
    <Dialog open={confirm} onOpenChange={setConfirm}><DialogContent><DialogHeader><DialogTitle>Eliminar {selected.size} tarea(s)</DialogTitle></DialogHeader>
      <p className="text-sm">Se incluyen sus subtareas. Si alguna tiene horas registradas o historial importado, se rechazará toda la selección. Las secciones se conservan.</p>
      <DialogFooter><Button variant="ghost" onClick={() => setConfirm(false)}>Cancelar</Button><Button variant="destructive" disabled={mutation.isPending} onClick={() => mutation.mutate()}>Eliminar</Button></DialogFooter>
    </DialogContent></Dialog>
  </Context.Provider>;
}
