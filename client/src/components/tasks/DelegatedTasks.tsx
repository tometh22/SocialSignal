import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { authFetchJson } from "@/lib/queryClient";
import { taskDateBucket } from "@shared/utils/task-date-bucket";
import { taskWorkflowBucket, TASK_DATE_LABELS } from "@shared/utils/task-workflow";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DelegatedTask = {
  id: number; title: string; projectId: number; status: string;
  startDate?: string | null; dueDate?: string | null;
  projectName?: string | null; clientName?: string | null;
  assigneeName?: string | null; collaboratorNames?: string[];
};

type Filter = "active" | "overdue" | "blocked" | "done";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "active", label: "Pendientes" }, { value: "overdue", label: "Con retraso" },
  { value: "blocked", label: "Bloqueadas" }, { value: "done", label: "Finalizadas" },
];

export default function DelegatedTasks({ full = false }: { full?: boolean }) {
  const [filter, setFilter] = useState<Filter>("active");
  const { data, isLoading, isError, refetch } = useQuery<{ delegatedTasks: DelegatedTask[] }>({
    queryKey: ["/api/tasks/my-tasks"],
    queryFn: () => authFetchJson("/api/tasks/my-tasks"),
  });
  const tasks = data?.delegatedTasks ?? [];
  const matches = (task: DelegatedTask, value: Filter) => value === "active"
    ? !["done", "cancelled"].includes(task.status)
    : value === "overdue" ? taskDateBucket(task) === "overdue"
    : task.status === value;
  const filtered = tasks.filter(task => matches(task, filter));
  const visible = full ? filtered : filtered.slice(0, 5);

  return <section className="mind-panel overflow-hidden" aria-label="Asignadas por mí">
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
      <div>
        <h2 className="text-sm font-semibold">Asignadas por mí</h2>
        <p className="mt-1 text-xs text-muted-foreground">Seguimiento de tareas que delegaste a otras personas.</p>
      </div>
      {!full && <Link href="/tasks/my-tasks?scope=delegated" className="text-xs text-primary hover:underline">Ver todas</Link>}
    </div>
    <div className="flex flex-wrap gap-2 p-4" aria-label="Filtrar tareas delegadas">
      {FILTERS.map(({ value, label }) => <Button key={value} size="sm" variant={filter === value ? "secondary" : "ghost"}
        aria-pressed={filter === value} className="h-8 text-xs" onClick={() => setFilter(value)}>
        {label}{!isLoading && !isError && ` · ${tasks.filter(task => matches(task, value)).length}`}
      </Button>)}
    </div>
    {isLoading ? <p className="px-4 pb-4 text-sm text-muted-foreground" role="status">Cargando tareas delegadas…</p>
      : isError ? <div className="px-4 pb-4 text-sm">No se pudieron cargar las tareas. <Button variant="link" onClick={() => refetch()}>Reintentar</Button></div>
      : visible.length === 0 ? <p className="px-4 pb-4 text-sm text-muted-foreground">No hay tareas delegadas en este grupo.</p>
      : <ul className="divide-y divide-border">
        {visible.map(task => <li key={task.id}>
          <Link href={`/tasks/projects/${task.projectId}?taskId=${task.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_7rem_8rem] hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
            <div className="col-span-2 min-w-0 sm:col-span-1">
              <p className="truncate text-sm font-medium">{task.title}</p>
              <p className="truncate text-xs text-muted-foreground">{[task.clientName, task.projectName].filter(Boolean).join(" · ")}</p>
              <p className="truncate text-xs text-muted-foreground">{task.assigneeName || "Sin responsable"}{task.collaboratorNames?.length ? ` · Colaboran: ${task.collaboratorNames.join(", ")}` : ""}</p>
            </div>
            <span className={cn("text-xs", task.status === "blocked" ? "text-orange-700" : "text-muted-foreground")}>{TASK_DATE_LABELS[taskWorkflowBucket(task) ?? "no_date"]}</span>
            <span className="text-xs text-muted-foreground">{task.dueDate ? `Vence ${task.dueDate.slice(0, 10).split("-").reverse().join("/")}` : "Sin vencimiento"}</span>
          </Link>
        </li>)}
      </ul>}
    {!full && filtered.length > visible.length && <Link href="/tasks/my-tasks?scope=delegated" className="block px-4 py-3 text-xs text-primary hover:underline">Ver las {filtered.length} tareas</Link>}
    <p className="border-t px-4 py-3 text-[11px] text-muted-foreground">Incluye tareas cuya última asignación hiciste vos. Las asignaciones anteriores a este registro no tienen autor identificado.</p>
  </section>;
}
