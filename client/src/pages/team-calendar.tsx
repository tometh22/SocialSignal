import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/queryClient";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, isSameMonth, isToday, addMonths, subMonths, isWithinInterval, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";

type Task = {
  id: number;
  title: string;
  projectId?: number | null;
  assigneeId?: number | null;
  assigneeName?: string | null;
  projectName?: string | null;
  clientName?: string | null;
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

function taskIsOnDay(task: Task, day: Date): boolean {
  const due = task.dueDate ? parseISO(task.dueDate) : null;
  const start = task.startDate ? parseISO(task.startDate) : null;
  if (!due && !start) return false;
  if (start && due) return isWithinInterval(day, { start, end: due });
  if (due) return isSameDay(day, due);
  if (start) return isSameDay(day, start);
  return false;
}

export default function TeamCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [overflowDay, setOverflowDay] = useState<string | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const allCalDays = eachDayOfInterval({ start: calStart, end: calEnd });

  const { data: tasks = [], isLoading, refetch } = useQuery<Task[]>({
    queryKey: ["/api/tasks/team-calendar", format(currentMonth, "yyyy-MM"), selectedAssigneeId, selectedProjectId],
    queryFn: () => {
      const params = new URLSearchParams({
        dateFrom: calStart.toISOString(),
        dateTo: calEnd.toISOString(),
      });
      if (selectedAssigneeId !== "all") params.set("assigneeId", selectedAssigneeId);
      if (selectedProjectId !== "all") params.set("projectId", selectedProjectId);
      return authFetch(`/api/tasks/team-calendar?${params}`).then(r => r.json());
    },
  });

  const { data: allPersonnel = [] } = useQuery<Personnel[]>({
    queryKey: ["/api/tasks-personnel"],
    queryFn: () => authFetch("/api/tasks-personnel").then(r => r.json()),
  });

  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/tasks-projects"],
    queryFn: () => authFetch("/api/tasks-projects").then(r => r.json()),
  });

  const tasksByDay = (day: Date) => tasks.filter(t => taskIsOnDay(t, day));

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.status === "done").length;

  const activeAssigneeIds = Array.from(new Set(tasks.map(t => t.assigneeId).filter(Boolean))) as number[];

  const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const MAX_VISIBLE = 3;

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
            <Select value={selectedAssigneeId} onValueChange={setSelectedAssigneeId}>
              <SelectTrigger className="h-8 w-44 text-xs">
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
              <SelectTrigger className="h-8 w-48 text-xs">
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
                const taskCount = tasks.filter(t => t.assigneeId === aid).length;
                return (
                  <button
                    key={aid}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors",
                      selectedAssigneeId === aid.toString()
                        ? `${style.bg} ${style.text} border-transparent font-medium`
                        : "bg-card border-border hover:border-primary/50"
                    )}
                    onClick={() => setSelectedAssigneeId(selectedAssigneeId === aid.toString() ? "all" : aid.toString())}
                  >
                    <Avatar className="h-4 w-4">
                      <AvatarFallback className={cn("text-[8px] text-white", style.avatar)}>
                        {getInitials(person.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span>{person.name.split(" ")[0]}</span>
                    <Badge variant="secondary" className="h-3.5 px-1 text-[9px]">{taskCount}</Badge>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Calendar */}
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <span className="font-semibold capitalize text-sm">{format(currentMonth, "MMMM yyyy", { locale: es })}</span>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setCurrentMonth(new Date())}>
                Hoy
              </Button>
              {totalTasks > 0 && (
                <span className="text-xs text-muted-foreground">
                  {doneTasks}/{totalTasks} completadas
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b bg-muted/10">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center py-2 text-xs font-semibold text-muted-foreground">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-7 divide-x divide-y divide-border">
              {allCalDays.map(day => {
                const dayTasks = tasksByDay(day);
                const isCurrentDay = isToday(day);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const dayKey = day.toISOString();
                const visibleTasks = dayTasks.slice(0, MAX_VISIBLE);
                const overflow = dayTasks.length - MAX_VISIBLE;
                const isOverflowOpen = overflowDay === dayKey;

                return (
                  <div
                    key={dayKey}
                    className={cn(
                      "min-h-[110px] p-1",
                      !isCurrentMonth && "bg-muted/20 opacity-60",
                      isCurrentDay && "bg-primary/5"
                    )}
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mb-1 mx-auto",
                      isCurrentDay ? "bg-primary text-primary-foreground font-bold" : "text-foreground"
                    )}>
                      {format(day, "d")}
                    </div>

                    <div className="space-y-0.5">
                      {visibleTasks.map(task => {
                        const person = allPersonnel.find(p => p.id === task.assigneeId);
                        const style = getPersonStyle(task.assigneeId);
                        return (
                          <Tooltip key={task.id}>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  "text-[10px] leading-tight px-1 py-0.5 rounded cursor-pointer border-l-2 hover:brightness-95 transition-all flex items-center gap-1",
                                  style.bg, style.border,
                                  task.status === "done" && "opacity-50"
                                )}
                                onClick={() => setSelectedTaskId(task.id)}
                              >
                                {person && (
                                  <Avatar className="h-3.5 w-3.5 flex-shrink-0">
                                    <AvatarFallback className={cn("text-[7px] text-white", style.avatar)}>
                                      {getInitials(person.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                )}
                                <div className="min-w-0">
                                  <p className={cn("truncate font-medium", style.text, task.status === "done" && "line-through")}>
                                    {task.title}
                                  </p>
                                  {task.projectName && (
                                    <p className={cn("truncate opacity-60", style.text)}>{task.clientName}</p>
                                  )}
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-[200px]">
                              <p className="font-medium">{task.title}</p>
                              {person && <p className="text-xs opacity-80">{person.name}</p>}
                              {task.projectName && <p className="text-xs opacity-70">{task.clientName} · {task.projectName}</p>}
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
                                const person = allPersonnel.find(p => p.id === task.assigneeId);
                                const style = getPersonStyle(task.assigneeId);
                                return (
                                  <div
                                    key={task.id}
                                    className={cn("text-xs px-2 py-1 rounded cursor-pointer border-l-2 flex items-center gap-1.5", style.bg, style.border)}
                                    onClick={() => { setSelectedTaskId(task.id); setOverflowDay(null); }}
                                  >
                                    {person && (
                                      <Avatar className="h-4 w-4 flex-shrink-0">
                                        <AvatarFallback className={cn("text-[8px] text-white", style.avatar)}>
                                          {getInitials(person.name)}
                                        </AvatarFallback>
                                      </Avatar>
                                    )}
                                    <div className="min-w-0">
                                      <p className={cn("font-medium truncate", style.text)}>{task.title}</p>
                                      {person && <p className={cn("text-[10px] opacity-70", style.text)}>{person.name}</p>}
                                    </div>
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
          )}
        </div>

        {/* Person legend */}
        {activeAssigneeIds.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Color por persona:</span>
            {activeAssigneeIds.map(aid => {
              const person = allPersonnel.find(p => p.id === aid);
              if (!person) return null;
              const style = getPersonStyle(aid);
              return (
                <div key={aid} className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border-l-2", style.bg, style.border, style.text)}>
                  <span className="font-medium">{person.name.split(" ")[0]}</span>
                </div>
              );
            })}
          </div>
        )}

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
