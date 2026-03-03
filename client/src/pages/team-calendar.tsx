import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, authFetch } from "@/lib/queryClient";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, isSameMonth, isToday, addMonths, subMonths, getDay } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const PROJECT_COLORS = [
  "bg-blue-100 border-blue-300 text-blue-800",
  "bg-purple-100 border-purple-300 text-purple-800",
  "bg-green-100 border-green-300 text-green-800",
  "bg-orange-100 border-orange-300 text-orange-800",
  "bg-pink-100 border-pink-300 text-pink-800",
  "bg-teal-100 border-teal-300 text-teal-800",
  "bg-indigo-100 border-indigo-300 text-indigo-800",
  "bg-amber-100 border-amber-300 text-amber-800",
];

function getProjectClass(projectId?: number | null) {
  if (!projectId) return "bg-gray-100 border-gray-200 text-gray-700";
  return PROJECT_COLORS[projectId % PROJECT_COLORS.length];
}

function getInitials(name: string) {
  return name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ["bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500", "bg-pink-500", "bg-teal-500"];
function getAvatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }

export default function TeamCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

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

  const tasksByDay = (day: Date) => {
    return tasks.filter(t => {
      if (!t.dueDate && !t.startDate) return false;
      const taskDate = t.dueDate ? new Date(t.dueDate) : new Date(t.startDate!);
      return isSameDay(taskDate, day);
    });
  };

  // Stats
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.status === "done").length;

  // Unique assignees in current view
  const activeAssignees = Array.from(new Set(tasks.map(t => t.assigneeId).filter(Boolean)));

  const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Calendario del Equipo</h1>
          <p className="text-sm text-muted-foreground">Vista de tareas de todos los colaboradores</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Filters */}
          <Select value={selectedAssigneeId} onValueChange={setSelectedAssigneeId}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="Todos los colaboradores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {allPersonnel.map(p => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="h-8 w-44 text-xs">
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

      {/* Assignee avatars */}
      {activeAssignees.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">En este período:</span>
          <div className="flex items-center gap-1.5">
            {activeAssignees.map(aid => {
              const person = allPersonnel.find(p => p.id === aid);
              if (!person) return null;
              const taskCount = tasks.filter(t => t.assigneeId === aid).length;
              return (
                <button
                  key={aid}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border transition-colors",
                    selectedAssigneeId === aid!.toString() ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/50"
                  )}
                  onClick={() => setSelectedAssigneeId(selectedAssigneeId === aid!.toString() ? "all" : aid!.toString())}
                >
                  <Avatar className="h-4 w-4">
                    <AvatarFallback className={cn("text-[8px] text-white", getAvatarColor(aid!))}>{getInitials(person.name)}</AvatarFallback>
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
              const MAX_VISIBLE = 3;

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-[110px] p-1",
                    !isCurrentMonth && "bg-muted/20 opacity-60",
                    isCurrentDay && "bg-primary/5"
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mb-1 mx-auto",
                    isCurrentDay ? "bg-primary text-primary-foreground" : "text-foreground"
                  )}>
                    {format(day, "d")}
                  </div>

                  <div className="space-y-0.5">
                    {dayTasks.slice(0, MAX_VISIBLE).map(task => {
                      const person = allPersonnel.find(p => p.id === task.assigneeId);
                      return (
                        <div
                          key={task.id}
                          className={cn(
                            "text-[10px] leading-tight px-1 py-0.5 rounded cursor-pointer border hover:shadow-sm transition-shadow flex items-center gap-1",
                            getProjectClass(task.projectId),
                            task.status === "done" && "opacity-50"
                          )}
                          onClick={() => setSelectedTaskId(task.id)}
                          title={`${task.title} — ${person?.name || "Sin asignar"}`}
                        >
                          {person && (
                            <Avatar className="h-3 w-3 flex-shrink-0">
                              <AvatarFallback className={cn("text-[7px] text-white", getAvatarColor(person.id))}>
                                {getInitials(person.name)}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <span className={cn("truncate flex-1", task.status === "done" && "line-through")}>
                            {task.title}
                          </span>
                        </div>
                      );
                    })}
                    {dayTasks.length > MAX_VISIBLE && (
                      <div className="text-[10px] text-muted-foreground px-1 font-medium">
                        +{dayTasks.length - MAX_VISIBLE} más
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Project legend */}
      {allProjects.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Proyectos:</span>
          {allProjects.slice(0, 8).map(p => (
            <div key={p.id} className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border", getProjectClass(p.id))}>
              <span className="font-medium">{p.client_name}</span>
              <span className="opacity-70">· {p.name}</span>
            </div>
          ))}
        </div>
      )}

      <TaskDetailPanel
        taskId={selectedTaskId}
        open={!!selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onUpdate={refetch}
      />
    </div>
  );
}
