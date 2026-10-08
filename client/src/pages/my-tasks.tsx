import DelegatedTasks from "@/components/tasks/DelegatedTasks";
import { civilDateInBuenosAires } from "@shared/utils/buenos-aires-week";
import { taskDateBucket } from "@shared/utils/task-date-bucket";
import { clientCalendarColor } from "@/lib/client-calendar-color";
import { taskPersonalBucket, TASK_DATE_LABELS } from "@shared/utils/task-workflow";
import { useState } from "react";
import { Link, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, authFetch } from "@/lib/queryClient";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay, isToday, isWithinInterval, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ChevronLeft, ChevronRight, Calendar, List, Clock, Flag, Loader2, Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";

type Task = {
  id: number;
  title: string;
  description?: string | null;
  projectId?: number | null;
  sectionName?: string | null;
  assigneeId?: number | null;
  dueDate?: string | null;
  startDate?: string | null;
  estimatedHours?: number | null;
  loggedHours?: number;
  status: string;
  clientId?: number | null;
  clientName?: string | null;
  blockedReason?: string | null;
  projectName?: string | null;
  priority: string;
};

type Project = { id: number; name: string; clientName: string | null; source?: string };

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-gray-400",
  medium: "text-yellow-500",
  high: "text-orange-500",
  urgent: "text-red-500",
};

function CircleCheck({ checked, onClick, pending }: { checked: boolean; onClick: (e: React.MouseEvent) => void; pending?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className={cn(
        "flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center",
        "transition-all duration-200 ease-in-out focus:outline-none hover:scale-110 active:scale-95",
        checked
          ? "bg-green-500 border-green-500 shadow-sm shadow-green-200"
          : "border-muted-foreground/40 hover:border-primary/60 hover:bg-primary/5",
        pending && "opacity-60 cursor-wait"
      )}
    >
      {checked && <Check className="h-2 w-2 text-white" strokeWidth={3} />}
    </button>
  );
}

function parseLocalDate(s: string): Date {
  return new Date(s.slice(0, 10) + 'T00:00:00');
}

function taskIsOnDay(task: Task, day: Date): boolean {
  const due = task.dueDate ? parseLocalDate(task.dueDate) : null;
  const start = task.startDate ? parseLocalDate(task.startDate) : null;

  if (!due && !start) return false;

  if (start && due) {
    return isWithinInterval(day, { start, end: due }) ||
      isSameDay(day, start) || isSameDay(day, due);
  }

  if (due) return isSameDay(day, due);
  if (start) return isSameDay(day, start);
  return false;
}

export default function MyTasksPage() {
  const search = useSearch();
  const delegated = new URLSearchParams(search).get("scope") === "delegated";
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [currentWeek, setCurrentWeek] = useState(parseLocalDate(civilDateInBuenosAires(new Date())));
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("active");
  const [overflowDay, setOverflowDay] = useState<string | null>(null);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: myData, isLoading, refetch } = useQuery<{ tasks: Task[]; personnelId: number | null }>({
    queryKey: ["/api/tasks/my-tasks"],
    queryFn: () => authFetch("/api/tasks/my-tasks").then(r => r.json()),
  });

  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/tasks/projects"],
    queryFn: () => authFetch("/api/tasks/projects").then(r => r.json()),
  });

  const toggleMutation = useMutation({
    mutationFn: (task: Task) => apiRequest(`/api/tasks/${task.id}/completion`, "POST", {
      completed: task.status !== "done",
    }),
    onSuccess: () => refetch(),
  });

  const tasks = myData?.tasks || [];
  const activeTasks = statusFilter === "active"
    ? tasks.filter(t => t.status !== "done" && t.status !== "cancelled")
    : tasks.filter(t => t.status !== "cancelled" && (statusFilter === "all" || taskPersonalBucket(t) === statusFilter));

  const tasksByDay = (day: Date) => activeTasks.filter(t => taskIsOnDay(t, day));

  // Tareas activas sin fecha: no caen en ningún día del calendario.
  const datelessTasks = activeTasks.filter(t => !t.startDate && !t.dueDate);

  const tasksByProject: Record<string, Task[]> = {};
  for (const task of activeTasks) {
    const proj = allProjects.find(p => p.id === task.projectId);
    const key = task.projectName ? `${task.clientName ?? "Sin cliente"} · ${task.projectName}` : proj ? `${proj.clientName ?? "Sin cliente"} · ${proj.name}` : "Sin proyecto";
    if (!tasksByProject[key]) tasksByProject[key] = [];
    tasksByProject[key].push(task);
  }

  const MAX_VISIBLE = 4;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Page header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Mis Tareas</h1>
            <p className="text-sm text-muted-foreground">{delegated ? "Seguimiento de las tareas que delegaste" : "Tus tareas asignadas"}</p>
          </div>
          {!delegated && <div className="flex flex-wrap items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Activas</SelectItem>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="upcoming">Próximas</SelectItem>
                <SelectItem value="in_progress">En curso</SelectItem>
                <SelectItem value="overdue">Con retraso</SelectItem>
                <SelectItem value="no_date">Sin fecha</SelectItem>
                <SelectItem value="done">Finalizadas</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center rounded-lg border">
              <Button variant={view === "calendar" ? "secondary" : "ghost"} size="sm" className="h-8 rounded-r-none text-xs" onClick={() => setView("calendar")}>
                <Calendar className="h-3.5 w-3.5 mr-1.5" />Calendario
              </Button>
              <Button variant={view === "list" ? "secondary" : "ghost"} size="sm" className="h-8 rounded-l-none text-xs border-l" onClick={() => setView("list")}>
                <List className="h-3.5 w-3.5 mr-1.5" />Lista
              </Button>
            </div>

          </div>}
        </div>

        <nav className="flex flex-wrap gap-2" aria-label="Relación con las tareas">
          <Button asChild variant={!delegated ? "secondary" : "ghost"}><Link href="/tasks/my-tasks" aria-current={!delegated ? "page" : undefined}>Asignadas a mí</Link></Button>
          <Button asChild variant={delegated ? "secondary" : "ghost"}><Link href="/tasks/my-tasks?scope=delegated" aria-current={delegated ? "page" : undefined}>Asignadas por mí</Link></Button>
        </nav>
        {delegated ? <DelegatedTasks full /> : <>
        <div className="flex flex-wrap gap-2 text-xs" aria-label="Clientes">
          {[...new Map(tasks.map(t => [t.clientId ?? null, t.clientName ?? "Sin cliente"])).entries()].map(([id, name]) => <span key={id ?? "none"} className={cn("rounded border px-2 py-1", clientCalendarColor(id))}>{name}</span>)}
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {view === "calendar" && (
              <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
                {/* Calendar navigation */}
                <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-sm text-foreground capitalize">
                      {format(weekStart, "dd MMM", { locale: es })} – {format(weekEnd, "dd MMM yyyy", { locale: es })}
                    </span>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setCurrentWeek(parseLocalDate(civilDateInBuenosAires(new Date())))}>
                      Hoy
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* Week grid */}
                <div className="grid grid-cols-7 divide-x divide-border">
                  {weekDays.map(day => {
                    const dayTasks = tasksByDay(day);
                    const isCurrentDay = isSameDay(day, parseLocalDate(civilDateInBuenosAires(new Date())));
                    const dayKey = day.toISOString();
                    const visibleTasks = dayTasks.slice(0, MAX_VISIBLE);
                    const overflow = dayTasks.length - MAX_VISIBLE;
                    const isOverflowOpen = overflowDay === dayKey;

                    return (
                      <div key={dayKey} className={cn("min-h-[200px]", isCurrentDay && "bg-primary/[0.03]")}>
                        {/* Day header */}
                        <div className={cn("px-2 py-2 border-b text-center", isCurrentDay && "bg-primary/5")}>
                          <p className="text-xs text-muted-foreground uppercase font-medium">{format(day, "EEE", { locale: es })}</p>
                          <div className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center mx-auto mt-0.5 text-sm font-bold",
                            isCurrentDay ? "bg-primary text-primary-foreground" : "text-foreground"
                          )}>
                            {format(day, "d")}
                          </div>
                        </div>

                        {/* Day tasks */}
                        <div className="p-1 space-y-0.5">
                          {visibleTasks.map(task => {
                            const proj = allProjects.find(p => p.id === task.projectId);
                            const style = { bg: clientCalendarColor(task.clientId), border: "", text: "text-inherit" };
                            const isStart = task.startDate && isSameDay(parseISO(task.startDate), day);
                            const isEnd = task.dueDate && isSameDay(parseISO(task.dueDate), day);
                            const isSpanning = task.startDate && task.dueDate &&
                              !isSameDay(parseISO(task.startDate), parseISO(task.dueDate));

                            return (
                              <Tooltip key={task.id}>
                                <TooltipTrigger asChild>
                                  <div
                                    className={cn(
                                      "text-xs px-1.5 py-1 cursor-pointer border-l-2 transition-all hover:brightness-95",
                                      style.bg, style.border,
                                      task.status === "done" && "opacity-50",
                                      isSpanning && !isStart && !isEnd ? "rounded-none -mx-px" :
                                        isSpanning && isStart ? "rounded-l rounded-r-none" :
                                          isSpanning && isEnd ? "rounded-r rounded-l-none -ml-px" :
                                            "rounded"
                                    )}
                                    onClick={() => setSelectedTaskId(task.id)}
                                  >
                                    <p className={cn(
                                      "font-medium leading-tight truncate",
                                      style.text,
                                      task.status === "done" && "line-through"
                                    )}>
                                      {task.status === "blocked" && <span title={task.blockedReason || "Motivo pendiente"} aria-label="Bloqueada">⊘ </span>}{task.title}
                                    </p>
                                    {proj && <p className="text-[10px] opacity-70 truncate">{proj.clientName}</p>}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[200px]">
                                  <p className="font-medium">{task.title}</p>
                                  {proj && <p className="text-xs opacity-80">{proj.clientName} · {proj.name}</p>}
                                  {task.dueDate && <p className="text-xs opacity-70">Vence: {format(parseLocalDate(task.dueDate), "dd/MM/yyyy")}</p>}
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}

                          {overflow > 0 && (
                            <Popover open={isOverflowOpen} onOpenChange={(o) => setOverflowDay(o ? dayKey : null)}>
                              <PopoverTrigger asChild>
                                <button className="w-full text-[10px] text-muted-foreground hover:text-primary px-1 py-0.5 rounded hover:bg-accent/50 transition-colors text-left font-medium">
                                  +{overflow} más
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 p-2" side="bottom" align="start">
                                <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">
                                  {format(day, "EEEE d MMMM", { locale: es })}
                                </p>
                                <div className="space-y-0.5">
                                  {dayTasks.map(task => {
                                    const proj = allProjects.find(p => p.id === task.projectId);
                                    const style = { bg: clientCalendarColor(task.clientId), border: "", text: "text-inherit" };
                                    return (
                                      <div
                                        key={task.id}
                                        className={cn("text-xs px-2 py-1 rounded cursor-pointer border-l-2", style.bg, style.border)}
                                        onClick={() => { setSelectedTaskId(task.id); setOverflowDay(null); }}
                                      >
                                        <p className={cn("font-medium truncate", style.text)}>{task.title}</p>
                                        {proj && <p className="text-[10px] opacity-70">{proj.clientName}</p>}
                                      </div>
                                    );
                                  })}
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}

                        </div>
                      </div>
                    );
                  })}
                </div>

                {datelessTasks.length > 0 && (
                  <div className="border-t px-4 py-3 bg-muted/10">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">
                      Sin fecha ({datelessTasks.length}) — no aparecen en el calendario hasta asignarles fecha
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {datelessTasks.map(task => {
                        const proj = allProjects.find(p => p.id === task.projectId);
                        const style = { bg: clientCalendarColor(task.clientId), border: "", text: "text-inherit" };
                        return (
                          <button
                            key={task.id}
                            className={cn("text-xs px-2 py-1 rounded cursor-pointer border-l-2", style.bg, style.border, style.text)}
                            onClick={() => setSelectedTaskId(task.id)}
                            title={proj ? `${proj.clientName} · ${proj.name}` : undefined}
                          >
                            {task.title}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {view === "list" && (
              <div className="space-y-3">
                {Object.keys(tasksByProject).length === 0 ? (
                  <div className="text-center py-12 bg-card rounded-xl border">
                    <Calendar className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No tenés tareas asignadas</p>
                    <Link href="/tasks/projects">
                      <Button size="sm" className="mt-3">Ir a proyectos</Button>
                    </Link>
                  </div>
                ) : (
                  Object.entries(tasksByProject).map(([projectLabel, projectTasks]) => {
                    const firstTask = projectTasks[0];
                    const proj = allProjects.find(p => p.id === firstTask.projectId);
                    const style = { bg: clientCalendarColor(firstTask.clientId), border: "", text: "text-inherit" };
                    return (
                      <div key={projectLabel} className="bg-card rounded-xl border overflow-hidden">
                        {/* Project header */}
                        <div className={cn("flex items-center gap-2 px-4 py-2.5 border-b", style.bg)}>
                          <span className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", style.border.replace("border-l-", "bg-"))} />
                          <span className={cn("font-semibold text-sm", style.text)}>{projectLabel}</span>
                          <Badge variant="secondary" className="h-4 px-1.5 text-[10px] ml-auto">
                            {projectTasks.filter(t => t.status !== "done").length} pendientes
                          </Badge>
                        </div>

                        {/* Tasks */}
                        <div>
                          {/* List header */}
                          <div className="grid text-xs font-semibold text-muted-foreground border-b bg-muted/10 px-4 py-1.5" style={{ gridTemplateColumns: "24px 1fr 100px 80px 80px" }}>
                            <span />
                            <span>Tarea</span>
                            <span>Proyecto</span>
                            <span className="text-center">Vence</span>
                            <span className="text-right">Horas</span>
                          </div>
                          <div className="divide-y divide-border">
                            {projectTasks.map(task => (
                              <div
                                key={task.id}
                                className="grid items-center gap-2 px-4 py-2.5 hover:bg-accent/30 cursor-pointer group"
                                style={{ gridTemplateColumns: "24px 1fr 100px 80px 80px" }}
                              >
                                <div onClick={e => { e.stopPropagation(); toggleMutation.mutate(task); }}>
                                  <CircleCheck
                                    checked={task.status === "done"}
                                    pending={toggleMutation.isPending}
                                    onClick={e => { e.stopPropagation(); toggleMutation.mutate(task); }}
                                  />
                                </div>
                                <div className="min-w-0 flex items-center gap-1.5" onClick={() => setSelectedTaskId(task.id)}>
                                  <Flag className={cn("h-2.5 w-2.5 flex-shrink-0", PRIORITY_COLORS[task.priority])} />
                                  <span className={cn("text-sm truncate", task.status === "done" ? "line-through text-muted-foreground" : "")}>
                                    {task.title}
                                  </span>
                                </div>
                                <span className="text-xs text-muted-foreground truncate" onClick={() => setSelectedTaskId(task.id)}>
                                  {proj?.clientName || "—"}
                                </span>
                                <span
                                  className={cn("text-xs text-center", task.dueDate && taskDateBucket(task) === "overdue" ? "text-red-500 font-medium" : "text-muted-foreground")}
                                  onClick={() => setSelectedTaskId(task.id)}
                                >
                                  {task.dueDate ? format(parseLocalDate(task.dueDate), "dd/MM", { locale: es }) : "—"}
                                </span>
                                <span className="text-xs text-right text-muted-foreground flex items-center justify-end gap-0.5" onClick={() => setSelectedTaskId(task.id)}>
                                  {task.loggedHours ? (
                                    <><Clock className="h-3 w-3" />{task.loggedHours.toFixed(1)}h</>
                                  ) : "—"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}

        </>}

        <TaskDetailPanel
          taskId={selectedTaskId}
          open={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={refetch}
        />
      </div>
    </TooltipProvider>
  );
}
