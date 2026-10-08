import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { invalidateTaskQueries } from "@/lib/task-cache";
import { taskDateBucket } from "@shared/utils/task-date-bucket";
import { TASK_DATE_LABELS } from "@shared/utils/task-workflow";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

export default function TaskWorkflowControl({ task, onUpdate }: { task: { id: number; title?: string; status: string; startDate?: string | null; dueDate?: string | null; blockedReason?: string | null }; onUpdate?: () => void }) {
  const [open, setOpen] = useState(false), [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: (blocked: boolean) => apiRequest(`/api/tasks/${task.id}`, "PUT", { status: blocked ? "blocked" : "todo", blockedReason: blocked ? reason.trim() : null }),
    onSuccess: () => { setOpen(false); void invalidateTaskQueries(); onUpdate?.(); },
    onError: (error: Error) => toast({ title: "No se pudo cambiar el bloqueo", description: error.message, variant: "destructive" }),
  });
  const bucket = taskDateBucket(task);
  return <div className="flex flex-wrap items-center gap-1 text-[11px]" onClick={e => e.stopPropagation()}>
    <span className="text-muted-foreground">{task.status === "done" ? "Finalizadas" : bucket ? TASK_DATE_LABELS[bucket] : "Cancelada"}</span>
    {!["done", "cancelled"].includes(task.status) && <Button size="sm" variant="ghost" className="h-6 px-1 text-[11px]" disabled={mutation.isPending}
      title={task.status === "blocked" ? task.blockedReason || "Motivo pendiente" : "Bloquear tarea con motivo"}
      onClick={() => { if (task.status === "blocked") mutation.mutate(false); else { setReason(""); setOpen(true); } }}>
      {task.status === "blocked" ? "Bloqueada · Desbloquear" : "Bloquear"}
    </Button>}
    {task.status === "blocked" && <span className="max-w-48 truncate text-orange-700" title={task.blockedReason || "Motivo pendiente"}>{task.blockedReason || "Motivo pendiente"}</span>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Bloquear {task.title || "tarea"}</DialogTitle></DialogHeader>
      <Textarea aria-label="Motivo del bloqueo" value={reason} onChange={e => setReason(e.target.value)} maxLength={2000} placeholder="Explicá qué impide avanzar" />
      <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={!reason.trim() || mutation.isPending} onClick={() => mutation.mutate(true)}>Bloquear</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}

