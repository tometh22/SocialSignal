import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, GripVertical, Loader2 } from "lucide-react";
import { authFetch, apiRequest } from "@/lib/queryClient";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WorkflowStage = "aprobado" | "listo_para_empezar" | "empezado" | "bloqueado" | "finalizado";
type Project = {
  id: number;
  name: string;
  clientName: string | null;
  workflowStage?: WorkflowStage;
  taskCount: number;
  pendingCount: number;
  members: Array<{ personnelId: number; name: string; role: string }>;
};

const STAGES: Array<{ value: WorkflowStage; label: string; color: string }> = [
  { value: "aprobado", label: "Aprobado", color: "border-slate-300" },
  { value: "listo_para_empezar", label: "Listo para empezar", color: "border-blue-300" },
  { value: "empezado", label: "Empezado", color: "border-emerald-300" },
  { value: "bloqueado", label: "Bloqueado", color: "border-amber-300" },
  { value: "finalizado", label: "Finalizado", color: "border-violet-300" },
];

export default function ProjectsKanbanPage() {
  const { isOperations } = usePermissions();
  const queryClient = useQueryClient();
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/tasks/projects", "kanban", isOperations],
    queryFn: async () => {
      const response = await authFetch(`/api/tasks/projects?status=active&scope=${isOperations ? "all" : "mine"}`);
      if (!response.ok) throw new Error("No se pudieron cargar los proyectos");
      return response.json();
    },
    staleTime: 0,
  });
  const moveMutation = useMutation({
    mutationFn: ({ projectId, workflowStage }: { projectId: number; workflowStage: WorkflowStage }) =>
      apiRequest(`/api/tasks/projects/${projectId}/workflow-stage`, "PATCH", { workflowStage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/projects"] });
    },
  });
  const grouped = useMemo(() => {
    const map = new Map<WorkflowStage, Project[]>();
    for (const stage of STAGES) map.set(stage.value, []);
    for (const project of projects) (map.get(project.workflowStage ?? "aprobado") ?? map.get("aprobado")!).push(project);
    return map;
  }, [projects]);

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/tasks/projects" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Volver a proyectos
          </Link>
          <h1 className="text-xl font-bold">Kanban de proyectos</h1>
          <p className="text-sm text-muted-foreground">Etapa operativa independiente del estado financiero.</p>
        </div>
        <span className="rounded-full border bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
          {projects.length} proyectos visibles
        </span>
      </div>

      <div className="grid min-h-[520px] grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {STAGES.map((stage) => (
          <section
            key={stage.value}
            className={cn("rounded-xl border-t-4 bg-muted/20 p-3", stage.color)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (draggedId != null) moveMutation.mutate({ projectId: draggedId, workflowStage: stage.value });
              setDraggedId(null);
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{stage.label}</h2>
              <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">{grouped.get(stage.value)?.length ?? 0}</span>
            </div>
            <div className="space-y-2">
              {(grouped.get(stage.value) ?? []).map((project) => (
                <article
                  key={project.id}
                  draggable
                  onDragStart={() => setDraggedId(project.id)}
                  className="cursor-grab rounded-lg border bg-card p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing"
                >
                  <div className="flex items-start gap-2">
                    <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
                    <div className="min-w-0 flex-1">
                      <Link href={`/tasks/projects/${project.id}`} className="block truncate text-sm font-medium hover:text-primary">
                        {project.name || "Sin nombre"}
                      </Link>
                      {project.clientName && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{project.clientName}</p>}
                      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{project.pendingCount}/{project.taskCount} tareas pendientes</span>
                        <span>{project.members.length} miembros</span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
              {(grouped.get(stage.value) ?? []).length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">Soltá proyectos acá</p>}
            </div>
          </section>
        ))}
      </div>
      {moveMutation.isError && <p className="text-sm text-destructive">No se pudo actualizar la etapa. Intentá nuevamente.</p>}
    </div>
  );
}
