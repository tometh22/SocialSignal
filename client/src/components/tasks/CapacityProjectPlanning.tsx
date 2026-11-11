import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronRight } from "lucide-react";
import { capacityProjectHours, type CapacityPlanning, type CapacityMode } from "@shared/utils/capacity-planning";

export function CapacityHoursEditor({ hours, label, onSave }: { hours: number; label: string; onSave: (hours: number) => Promise<unknown> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const { toast } = useToast();
  const number = Number(value.replace(",", "."));
  const valid = value.trim() !== "" && Number.isFinite(number) && number >= 0 && number <= 10000;
  const mutation = useMutation({ mutationFn: () => onSave(number), onSuccess: () => setEditing(false),
    onError: (error: Error) => toast({ title: "No se pudo guardar la estimación", description: error.message, variant: "destructive" }) });
  if (!editing) return <Button variant="ghost" size="sm" className="h-7 shrink-0 text-xs" aria-label={label} onClick={() => { setValue(hours ? String(hours) : ""); setEditing(true); }}>{hours ? `${hours} h` : "+ estimar"}</Button>;
  return <form className="flex flex-wrap items-center gap-1" onSubmit={event => { event.preventDefault(); if (valid && !mutation.isPending) mutation.mutate(); }}>
    <Input aria-label={label} className="h-8 w-24" inputMode="decimal" value={value} onChange={event => setValue(event.target.value)} autoFocus disabled={mutation.isPending} />
    <Button size="sm" type="submit" disabled={!valid || mutation.isPending}>Guardar</Button>
    <Button size="sm" variant="ghost" type="button" disabled={mutation.isPending} onClick={() => setEditing(false)}>Cancelar</Button>
  </form>;
}

const modeLabels: Record<CapacityMode, string> = { task: "Por tarea", section: "Por sección", project: "Proyecto completo" };

export default function CapacityProjectPlanning({ planning, personnelId, weekStart, isOperations }: {
  planning: CapacityPlanning; personnelId: number; weekStart: string; isOperations: boolean;
}) {
  const [collapsedProjects, setCollapsedProjects] = useState<Set<number>>(new Set());
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/capacity/weekly"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/project"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/hours-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/team-calendar"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
    ]);
  };
  const mode = useMutation({ mutationFn: ({ id, value }: { id: number; value: string }) => apiRequest(`/api/capacity/projects/${id}/mode`, "PUT", { mode: value, weekStart }),
    onSuccess: refresh, onError: (error: Error) => toast({ title: "No se pudo cambiar la modalidad", description: error.message, variant: "destructive" }) });
  const extra = useMutation({ mutationFn: ({ taskId, value }: { taskId: number; value: boolean }) => apiRequest(`/api/capacity/tasks/${taskId}/extra`, "PUT", { weekStart, isExtra: value }),
    onSuccess: refresh, onError: (error: Error) => toast({ title: "No se pudo cambiar el extra", description: error.message, variant: "destructive" }) });
  const projects = planning.projects.filter(project => project.memberIds.includes(personnelId)
    || planning.tasks.some(task => task.projectId === project.id && task.personnelId === personnelId)
    || planning.groups.some(group => group.projectId === project.id && group.personnelId === personnelId));
  if (!projects.length) return <p className="py-2 text-xs text-muted-foreground">Sin proyectos activos asignados.</p>;
  return <div className="space-y-4">
    {projects.map(project => {
      const tasks = planning.tasks.filter(task => task.projectId === project.id && task.personnelId === personnelId);
      const groups = planning.groups.filter(group => group.projectId === project.id && group.personnelId === personnelId);
      const collapsed = collapsedProjects.has(project.id);
      const sections = [...new Set([...project.sectionNames, ...tasks.map(task => task.sectionName || "General"), ...groups.filter(group => group.scope === "section").map(group => group.sectionName)])];
      const saveGroup = async (sectionName: string, estimatedHours: number) => {
        await apiRequest("/api/capacity/group-estimates", "PUT", { projectId: project.id, personnelId, weekStart, scope: project.mode, sectionName, estimatedHours });
        await refresh();
      };
      return <div key={project.id} className="min-w-0 rounded-lg border bg-background p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" className="flex min-w-0 items-center gap-1.5 text-left text-sm font-semibold" data-testid="capacity-project-toggle" aria-expanded={!collapsed} onClick={() => setCollapsedProjects(previous => {
            const next = new Set(previous); if (next.has(project.id)) next.delete(project.id); else next.add(project.id); return next;
          })}>
            {collapsed ? <ChevronRight className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
            <span className="break-words">{project.clientName ? `${project.clientName} · ` : ""}{project.name}</span>
            <span className="shrink-0 font-normal text-muted-foreground">{capacityProjectHours(project.mode, tasks, groups)} h est.</span>
          </button>
          {isOperations ? <label className="flex flex-wrap items-center gap-2 text-xs">Estimar
            <select aria-label={`Modalidad de estimación de ${project.name}`} className="h-8 max-w-full rounded-md border bg-background px-2" value={project.mode} disabled={mode.isPending} onChange={event => mode.mutate({ id: project.id, value: event.target.value })}>
              {Object.entries(modeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label> : <span className="text-xs text-muted-foreground">{modeLabels[project.mode]}</span>}
        </div>
        {!collapsed && <div className="mt-3 space-y-2">
          {isOperations && <p className="text-xs text-muted-foreground">La modalidad se aplica a esta semana y se comparte con todo el equipo del proyecto. Cambiarla no modifica otras semanas. Las estimaciones de las otras modalidades se conservan y no se suman.</p>}
          {project.mode === "project" && <div className="flex flex-wrap items-center justify-between gap-2 rounded bg-muted/30 p-2"><span>Base del proyecto · esta persona</span><CapacityHoursEditor key={`${weekStart}:project`} label={`Horas base de ${project.name}`} hours={groups.find(group => group.scope === "project")?.estimatedHours ?? 0} onSave={hours => saveGroup("", hours)} /></div>}
          {project.mode === "section" && (sections.length ? sections.map(section => <div key={section} className="flex flex-wrap items-center justify-between gap-2 rounded bg-muted/30 p-2"><span className="min-w-0 break-words">{section}</span><CapacityHoursEditor key={`${weekStart}:${section}`} label={`Horas de ${section} en ${project.name}`} hours={groups.find(group => group.scope === "section" && group.sectionName === section)?.estimatedHours ?? 0} onSave={hours => saveGroup(section, hours)} /></div>) : <p className="text-xs text-muted-foreground">Agregá una sección en el proyecto para estimarla.</p>)}
          {project.mode !== "task" && <p className="pt-2 text-xs text-muted-foreground">Extras por tarea: sólo las marcadas como Extra se suman a la base de esta semana. Al estimar una tarea aquí se agrega como extra.</p>}
          {tasks.map(task => <div key={task.id} className="flex flex-wrap items-center gap-2 border-t py-1 text-xs" data-testid="capacity-task-row">
            <span className="min-w-0 flex-1 basis-48 break-words">{task.title}{task.status === "done" && <span className="ml-2 text-muted-foreground">Finalizada</span>}<span className="ml-2 text-muted-foreground">{task.sectionName || "General"}</span></span>
            {project.mode !== "task" && <label className="flex items-center gap-1"><input type="checkbox" aria-label={`Extra: ${task.title}`} checked={task.isExtra} disabled={!task.estimatedHours || extra.isPending} onChange={event => extra.mutate({ taskId: task.id, value: event.target.checked })} />Extra</label>}
            <CapacityHoursEditor key={`${weekStart}:${project.mode}:${task.id}`} label={`${project.mode === "task" ? "Estimar" : "Estimar extra"}: ${task.title}`} hours={task.estimatedHours} onSave={async estimatedHours => {
              if (estimatedHours === 0) await apiRequest(`/api/tasks/${task.id}/weekly-estimates/${weekStart}`, "DELETE");
              else await apiRequest(`/api/tasks/${task.id}/weekly-estimates`, "POST", { weekStart, estimatedHours, isExtra: project.mode === "task" ? task.isExtra : true });
              await refresh();
            }} />
          </div>)}
          {project.mode === "task" && !tasks.length && <p className="text-xs text-muted-foreground">Sin tareas para esta persona en la semana elegida.</p>}
        </div>}
      </div>;
    })}
  </div>;
}
