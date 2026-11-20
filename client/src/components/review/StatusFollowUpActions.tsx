import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { usePermissions, TASK_ACCESS_SECTIONS } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, authFetchJson } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { statusProjectDraftKey, type StatusSource } from "@/lib/status-source";
type Project = { id: number; name: string; clientName?: string; members: { personnelId: number; name: string }[] };

export default function StatusFollowUpActions({ source }: { source: StatusSource }) {
  const { hasAnyPermission, hasPermission, isOperations } = usePermissions();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [taskDraft, setTaskDraft] = useState<StatusSource | null>(null);
  const canCreateProject = isOperations && hasPermission("projects");
  const canCreateTask = hasAnyPermission(TASK_ACCESS_SECTIONS);

  function openProject() {
    try {
      sessionStorage.setItem(statusProjectDraftKey, JSON.stringify(source));
      navigate("/active-projects/new?fromStatus=1");
    } catch {
      toast({ title: "No se pudo abrir el formulario con el tema", variant: "destructive" });
    }
  }

  if (!canCreateProject && !canCreateTask) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {canCreateTask && <Button type="button" size="sm" variant="outline" onClick={() => setTaskDraft(source)}>Crear tarea</Button>}
      {canCreateProject && <Button type="button" size="sm" variant="outline" onClick={openProject}>Crear proyecto</Button>}
      {taskDraft && <StatusTaskDialog source={taskDraft} isOperations={isOperations} onClose={() => setTaskDraft(null)} />}
    </div>
  );
}

function StatusTaskDialog({ source, isOperations, onClose }: { source: StatusSource; isOperations: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(source.title.slice(0, 255));
  const [description, setDescription] = useState(source.text);
  const [projectId, setProjectId] = useState(source.projectId ?? 0);
  const [assigneeId, setAssigneeId] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [created, setCreated] = useState<{ id: number; projectId: number } | null>(null);
  const projects = useQuery({
    queryKey: ["/api/tasks/projects", "status-follow-up", isOperations],
    queryFn: () => authFetchJson<Project[]>(`/api/tasks/projects?scope=${isOperations ? "all" : "mine"}&status=active`),
  });
  const project = projects.data?.find(item => item.id === projectId);
  const create = useMutation({
    mutationFn: (): Promise<{ id: number; projectId: number }> =>
      apiRequest("/api/tasks", "POST", {
        title: title.trim(), projectId, assigneeId: assigneeId || null,
        dueDate: dueDate || null, description: [description.trim(), `Status: ${source.path}`].filter(Boolean).join("\n\n"),
      }),
    onSuccess: task => {
      setCreated(task);
      void queryClient.invalidateQueries({ queryKey: ["/api/tasks/project", task.projectId] });
      void queryClient.invalidateQueries({ queryKey: ["/api/tasks/my-tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/tasks/projects"] });
    },
    onError: (error: Error) => toast({ title: "No se pudo crear la tarea", description: error.message, variant: "destructive" }),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (project && title.trim() && !create.isPending && !created) create.mutate();
  }

  return (
    <Dialog open onOpenChange={open => { if (!open && !create.isPending) onClose(); }}>
      <DialogContent data-status-task-dialog className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{created ? "Tarea creada" : "Crear tarea desde Status"}</DialogTitle>
          <DialogDescription>{created ? "La tarea quedó guardada en Tareas." : "La descripción se comparte con quienes tienen acceso al proyecto."}</DialogDescription>
        </DialogHeader>
        {created ? <DialogFooter>
          <Button variant="outline" onClick={onClose}>Volver al tema</Button>
          <Button asChild><a href={`/tasks/projects/${created.projectId}?taskId=${created.id}`} target="_blank" rel="noreferrer">Abrir tarea</a></Button>
        </DialogFooter> : <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="status-task-title">Título</Label><Input id="status-task-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={255} required /></div>
          <div className="space-y-1.5"><Label htmlFor="status-task-project">Proyecto</Label>
            <select id="status-task-project" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={project?.id ?? 0} onChange={event => { setProjectId(Number(event.target.value)); setAssigneeId(0); }} disabled={projects.isPending} required>
              <option value={0}>{projects.isPending ? "Cargando proyectos…" : "Elegí un proyecto"}</option>
              {(projects.data ?? []).map(item => <option key={item.id} value={item.id}>{item.clientName ? `${item.clientName} · ` : ""}{item.name}</option>)}
            </select>
            {projects.isError && <Button variant="link" type="button" onClick={() => void projects.refetch()}>Reintentar carga de proyectos</Button>}
            {projects.isSuccess && !projects.data.length && <p className="text-sm text-muted-foreground">No tenés proyectos activos disponibles.</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="status-task-assignee">Responsable</Label>
              <select id="status-task-assignee" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={assigneeId} onChange={event => setAssigneeId(Number(event.target.value))} disabled={!project}>
                <option value={0}>Sin asignar</option>
                {(project?.members ?? []).map(member => <option key={member.personnelId} value={member.personnelId}>{member.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="status-task-due">Fecha de entrega</Label><Input id="status-task-due" type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="status-task-description">Descripción</Label><Textarea id="status-task-description" value={description} onChange={event => setDescription(event.target.value)} rows={4} /></div>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose} disabled={create.isPending}>Cancelar</Button><Button type="submit" disabled={!project || !title.trim() || create.isPending}>Crear tarea</Button></DialogFooter>
        </form>}
      </DialogContent>
    </Dialog>
  );
}
