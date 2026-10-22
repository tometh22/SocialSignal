import { civilDateInBuenosAires } from "@shared/utils/buenos-aires-week";
import { clientCalendarColor } from "@/lib/client-calendar-color";
import { parseTaskCivilDate, taskIsOnCivilDay } from "@shared/utils/task-civil-date";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetchJson } from "@/lib/queryClient";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, addMonths, addWeeks } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";

type Task = {
  id: number;
  title: string;
  projectId?: number | null;
  assigneeId?: number | null;
  collaboratorIds?: number[];
  assigneeName?: string | null;
  projectName?: string | null;
  clientName?: string | null;
  clientId?: number | null;
  blockedReason?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  status: string;
  priority: string;
};

type Personnel = { id: number; name: string };
type Project = { id: number; name: string; client_name: string };

// 10+ person colors
const PERSON_PALETTE = [
  { bg: "bg-blue-100 dark:bg-blue-950/60", border: "border-l-blue-500", text: "text-blue-800 dark:text-blue-200", avatar: "bg-blue-500" },
  { bg: "bg-purple-100 dark:bg-purple-950/60", border: "border-l-purple-500", text: "text-purple-800 dark:text-purple-200", avatar: "bg-purple-500" },
  { bg: "bg-green-100 dark:bg-green-950/60", border: "border-l-green-500", text: "text-green-800 dark:text-green-200", avatar: "bg-green-500" },
  { bg: "bg-orange-100 dark:bg-orange-950/60", border: "border-l-orange-500", text: "text-orange-800 dark:text-orange-200", avatar: "bg-orange-500" },
  { bg: "bg-pink-100 dark:bg-pink-950/60", border: "border-l-pink-500", text: "text-pink-800 dark:text-pink-200", avatar: "bg-pink-500" },
  { bg: "bg-teal-100 dark:bg-teal-950/60", border: "border-l-teal-500", text: "text-teal-800 dark:text-teal-200", avatar: "bg-teal-500" },
  { bg: "bg-indigo-100 dark:bg-indigo-950/60", border: "border-l-indigo-500", text: "text-indigo-800 dark:text-indigo-200", avatar: "bg-indigo-500" },
  { bg: "bg-rose-100 dark:bg-rose-950/60", border: "border-l-rose-500", text: "text-rose-800 dark:text-rose-200", avatar: "bg-rose-500" },
  { bg: "bg-amber-100 dark:bg-amber-950/60", border: "border-l-amber-500", text: "text-amber-800 dark:text-amber-200", avatar: "bg-amber-500" },
  { bg: "bg-cyan-100 dark:bg-cyan-950/60", border: "border-l-cyan-500", text: "text-cyan-800 dark:text-cyan-200", avatar: "bg-cyan-500" },
];

function getPersonStyle(personnelId?: number | null) {
  if (!personnelId) return PERSON_PALETTE[0];
  return PERSON_PALETTE[personnelId % PERSON_PALETTE.length];
}

function getInitials(name: string) {
  return name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
}

function taskDateRange(task: Task): string {
  const start = task.startDate?.slice(0, 10);
  const due = task.dueDate?.slice(0, 10);
  const label = (day: string) => format(parseTaskCivilDate(day), "d MMM yyyy", { locale: es });
  if (start && due && start !== due) return `${label(start)} – ${label(due)}`;
  return start || due ? label((start || due)!) : "Sin fecha";
}

function taskIsOnDay(task: Task, day: Date): boolean {
  return taskIsOnCivilDay(task, format(day, "yyyy-MM-dd"));
}

export default function TeamCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date(`${civilDateInBuenosAires(new Date())}T00:00:00`));
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [view, setView] = useState<"month" | "week">("month");
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(view === "month" ? monthStart : currentDate, { weekStartsOn: 1 });
  const calEnd = endOfWeek(view === "month" ? monthEnd : currentDate, { weekStartsOn: 1 });
  const allCalDays = eachDayOfInterval({ start: calStart, end: calEnd });

  const { data: tasks = [], isLoading, isError, refetch } = useQuery<Task[]>({
    queryKey: ["/api/tasks/team-calendar", format(calStart, "yyyy-MM-dd"), format(calEnd, "yyyy-MM-dd"), selectedAssigneeId, selectedProjectId],
    queryFn: () => {
      const params = new URLSearchParams({
        dateFrom: format(calStart, "yyyy-MM-dd"),
        dateTo: format(calEnd, "yyyy-MM-dd"),
      });
      if (selectedAssigneeId !== "all") params.set("assigneeId", selectedAssigneeId);
      if (selectedProjectId !== "all") params.set("projectId", selectedProjectId);
      return authFetchJson<Task[]>(`/api/tasks/team-calendar?${params}`);
    },
  });

  const { data: allPersonnel = [] } = useQuery<Personnel[]>({
    queryKey: ["/api/tasks-personnel"],
    queryFn: () => authFetchJson("/api/tasks-personnel"),
  });

  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/tasks-projects"],
    queryFn: () => authFetchJson("/api/tasks-projects"),
  });

  const tasksByDay = (day: Date) => tasks.filter(t => t.status !== "cancelled" && taskIsOnDay(t, day));

  const activeTasks = tasks.filter(t => t.status !== "cancelled");
  const totalTasks = activeTasks.length;
  const doneTasks = activeTasks.filter(t => t.status === "done").length;

  const activeAssigneeIds = Array.from(new Set(
    activeTasks.flatMap(t => [t.assigneeId, ...(t.collaboratorIds || [])]).filter(Boolean),
  )) as number[];

  const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const MAX_VISIBLE = 3;
  const weeks = Array.from({ length: allCalDays.length / 7 }, (_, index) => allCalDays.slice(index * 7, index * 7 + 7));
  const toggleWeek = (key: string) => setExpandedWeeks(previous => {
    const next = new Set(previous);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const navigate = (direction: number) => {
    setCurrentDate(previous => view === "month" ? addMonths(previous, direction) : addWeeks(previous, direction));
    setExpandedWeeks(new Set());
  };

  const renderTask = (task: Task, expanded: boolean) => {
    const person = allPersonnel.find(p => p.id === task.assigneeId);
    const assigneeName = person?.name || task.assigneeName || "Sin responsable";
    const collaborators = (task.collaboratorIds || []).filter(id => id !== task.assigneeId)
      .map(id => allPersonnel.find(p => p.id === id)?.name).filter(Boolean);
    const people = [assigneeName, ...collaborators].join(" · ");
    const style = getPersonStyle(task.assigneeId);
    return (
      <Tooltip key={task.id}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "w-full text-left leading-tight px-1.5 py-1 rounded border-l-2 hover:brightness-95 transition-colors flex items-start gap-1",
              expanded ? "text-xs" : "text-[10px]",
              clientCalendarColor(task.clientId),
              task.status === "done" && "opacity-60"
            )}
            onClick={() => setSelectedTaskId(task.id)}
          >
            {person && <Avatar className="h-3.5 w-3.5 flex-shrink-0 mt-0.5">
              <AvatarFallback className={cn("text-[7px] text-white", style.avatar)}>{getInitials(person.name)}</AvatarFallback>
            </Avatar>}
            <div className="min-w-0 flex-1">
              <p className={cn("font-medium", expanded ? "break-words" : "truncate", task.status === "done" && "line-through")}>
                {task.status === "blocked" && <span title={task.blockedReason || "Motivo pendiente"} aria-label="Bloqueada">⊘ </span>}{task.title}{expanded && <span className="ml-1 text-[10px] font-normal opacity-80">· {taskDateRange(task)}</span>}
              </p>
              <p className={cn("text-[10px] opacity-80", expanded ? "break-words" : "truncate")}>{expanded ? people : assigneeName}</p>
              {expanded && <>
                {(task.clientName || task.projectName) && <p className="text-[10px] opacity-70 break-words mt-0.5">{[task.clientName, task.projectName].filter(Boolean).join(" · ")}</p>}
              </>}
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <p className="font-medium">{task.title}</p>
          <p className="text-xs opacity-80">{people}</p>
          {(task.clientName || task.projectName) && <p className="text-xs opacity-70">{[task.clientName, task.projectName].filter(Boolean).join(" · ")}</p>}
          <p className="text-xs mt-1">{taskDateRange(task)}</p>
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Page header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold text-foreground">Calendario del Equipo</h1>
            <p className="text-sm text-muted-foreground">Vista de tareas de todos los colaboradores</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <ToggleGroup type="single" value={view} onValueChange={value => {
              if (value === "month" || value === "week") { setView(value); setExpandedWeeks(new Set()); }
            }} variant="outline" size="sm" aria-label="Vista del calendario">
              <ToggleGroupItem value="month" className="h-8 text-xs">Mes</ToggleGroupItem>
              <ToggleGroupItem value="week" className="h-8 text-xs">Semana</ToggleGroupItem>
            </ToggleGroup>
            <Select value={selectedAssigneeId} onValueChange={setSelectedAssigneeId}>
              <SelectTrigger className="h-8 w-44 text-xs" aria-label="Filtrar por colaborador">
                <SelectValue placeholder="Todos los colaboradores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los colaboradores</SelectItem>
                {allPersonnel.map(p => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="h-8 w-48 text-xs" aria-label="Filtrar por proyecto">
                <SelectValue placeholder="Todos los proyectos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los proyectos</SelectItem>
                {allProjects.map(p => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.client_name} · {p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Person filter pills */}
        {activeAssigneeIds.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Colaboradores en el período:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {activeAssigneeIds.map(aid => {
                const person = allPersonnel.find(p => p.id === aid);
                if (!person) return null;
                const style = getPersonStyle(aid);
                const taskCount = activeTasks.filter(t => t.assigneeId === aid || t.collaboratorIds?.includes(aid)).length;
                return (
                  <button
                    key={aid}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors",
                      selectedAssigneeId === aid.toString()
                        ? `${style.bg} ${style.text} border-transparent font-medium`
                        : "bg-card border-border hover:border-slate-200 hover:shadow-sm"
                    )}
                    onClick={() => setSelectedAssigneeId(selectedAssigneeId === aid.toString() ? "all" : aid.toString())}
                  >
                    <Avatar className="h-4 w-4">
                      <AvatarFallback className={cn("text-[8px] text-white", style.avatar)}>
                        {getInitials(person.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span>{(person.name || '').split(" ")[0]}</span>
                    <Badge variant="secondary" className="h-3.5 px-1 text-[9px]">{taskCount}</Badge>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Calendar */}
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-muted/20">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" aria-label={view === "month" ? "Mes anterior" : "Semana anterior"} onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <span className="font-semibold capitalize text-sm" aria-live="polite">
                {view === "month" ? format(currentDate, "MMMM yyyy", { locale: es }) : `${format(calStart, "d MMM yyyy", { locale: es })} – ${format(calEnd, "d MMM yyyy", { locale: es })}`}
              </span>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
                setCurrentDate(new Date(`${civilDateInBuenosAires(new Date())}T00:00:00`));
                setExpandedWeeks(new Set());
              }}>Hoy</Button>
              {totalTasks > 0 && <span className="text-xs text-muted-foreground">{doneTasks}/{totalTasks} completadas</span>}
            </div>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" aria-label={view === "month" ? "Mes siguiente" : "Semana siguiente"} onClick={() => navigate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : isError ? (
            <div className="p-6 text-sm text-destructive">No se pudo cargar el calendario. <Button variant="outline" size="sm" onClick={() => refetch()}>Reintentar</Button></div>
          ) : (
            <div className="overflow-x-auto">
              <div className={view === "week" ? "min-w-[1120px]" : "min-w-[840px]"}>
                <div className="grid grid-cols-7 border-b bg-muted/10">
                  {WEEKDAYS.map(d => <div key={d} className="text-center py-2 text-xs font-semibold text-muted-foreground">{d}</div>)}
                </div>
                {weeks.map(week => {
                  const weekKey = format(week[0], "yyyy-MM-dd");
                  const expanded = view === "week" || expandedWeeks.has(weekKey);
                  const weekId = `calendar-week-${weekKey}`;
                  return (
                    <div key={weekKey} className="border-b last:border-b-0">
                      <div id={weekId} className="grid grid-cols-7 divide-x divide-border">
                        {week.map(day => {
                          const dayKey = format(day, "yyyy-MM-dd");
                          const dayTasks = tasksByDay(day);
                          const isCurrentDay = dayKey === civilDateInBuenosAires(new Date());
                          const isCurrentMonth = isSameMonth(day, currentDate);
                          const overflow = dayTasks.length - MAX_VISIBLE;
                          return (
                            <div key={dayKey} className={cn("min-h-[150px] p-1", view === "month" && !isCurrentMonth && "bg-muted/20", isCurrentDay && "bg-primary/5")}>
                              <button
                                type="button"
                                className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium mb-1 mx-auto", isCurrentDay ? "bg-primary text-primary-foreground font-bold" : "text-foreground hover:bg-muted")}
                                aria-label={`${format(day, "EEEE d MMMM yyyy", { locale: es })}${view === "month" ? ": " + (expanded ? "contraer" : "expandir") + " semana" : ""}`}
                                disabled={view === "week"}
                                aria-expanded={view === "month" ? expanded : undefined}
                                aria-controls={view === "month" ? weekId : undefined}
                                onClick={() => { if (view === "month") toggleWeek(weekKey); }}
                              >{format(day, "d")}</button>
                              <div className="space-y-1">
                                {(expanded ? dayTasks : dayTasks.slice(0, MAX_VISIBLE)).map(task => renderTask(task, expanded))}
                                {!expanded && overflow > 0 && <button
                                  type="button"
                                  className="w-full text-[10px] text-muted-foreground hover:text-primary px-1 py-1 rounded hover:bg-accent/50 text-left font-medium"
                                  aria-label={`Ver ${overflow} tareas más del ${format(day, "d MMMM", { locale: es })} y expandir toda la semana`}
                                  aria-expanded={false}
                                  aria-controls={weekId}
                                  onClick={() => toggleWeek(weekKey)}
                                >+{overflow} más</button>}
                                {expanded && dayTasks.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-3">Sin tareas</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {view === "month" && expanded && <div className="flex items-center justify-between gap-2 px-3 py-2 border-t bg-muted/10">
                        <span className="text-xs text-muted-foreground">Todas las tareas del {format(week[0], "d MMM", { locale: es })} al {format(week[6], "d MMM", { locale: es })}</span>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" aria-expanded={true} aria-controls={weekId} onClick={() => toggleWeek(weekKey)}>Contraer semana</Button>
                      </div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 text-xs"><span>Color por cliente:</span>{[...new Map(activeTasks.map(t => [t.clientId, t.clientName || "Sin cliente"]))].map(([id, name]) => <span key={id ?? "none"} className={cn("rounded border px-2 py-1", clientCalendarColor(id))}>{name}</span>)}</div>

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
