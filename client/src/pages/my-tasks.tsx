import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, authFetch } from "@/lib/queryClient";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay, isToday, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft, ChevronRight, Plus, Calendar, List, Clock, Flag, Loader2
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
  priority: string;
};

type Project = { id: number; name: string; client_name: string };
type Personnel = { id: number; name: string };

const STATUS_COLORS: Record<string, string> = {
  todo: "border-gray-300",
  in_progress: "border-blue-400 bg-blue-50",
  done: "border-green-400 bg-green-50",
  cancelled: "border-red-300 bg-red-50",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-gray-400",
  medium: "text-yellow-500",
  high: "text-orange-500",
  urgent: "text-red-500",
};

const PROJECT_COLORS = ["bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500", "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-amber-500"];

function getProjectColor(projectId?: number | null) {
  if (!projectId) return "bg-gray-400";
  return PROJECT_COLORS[projectId % PROJECT_COLORS.length];
}

export default function MyTasksPage() {
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("active");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskProjectId, setNewTaskProjectId] = useState<string>("none");

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: myData, isLoading, refetch } = useQuery<{ tasks: Task[]; personnelId: number | null }>({
    queryKey: ["/api/tasks/my-tasks", statusFilter],
    queryFn: () => authFetch(`/api/tasks/my-tasks${statusFilter !== "all" && statusFilter !== "active" ? `?status=${statusFilter}` : ""}`).then(r => r.json()),
  });

  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/tasks-projects"],
    queryFn: () => authFetch("/api/tasks-projects").then(r => r.json()),
  });

  const toggleMutation = useMutation({
    mutationFn: (task: Task) => apiRequest(`/api/tasks/${task.id}`, "PUT", {
      status: task.status === "done" ? "todo" : "done",
    }),
    onSuccess: () => refetch(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/tasks", "POST", data),
    onSuccess: () => { refetch(); setShowCreateModal(false); setNewTaskTitle(""); setCreateDate(null); },
  });

  const tasks = myData?.tasks || [];
  const activeTasks = statusFilter === "active" ? tasks.filter(t => t.status !== "done" && t.status !== "cancelled") : tasks;

  // Tasks by day for calendar view
  const tasksByDay = (day: Date) => {
    return activeTasks.filter(t => {
      if (!t.dueDate && !t.startDate) return false;
      const taskDate = t.dueDate ? new Date(t.dueDate) : new Date(t.startDate!);
      return isSameDay(taskDate, day);
    });
  };

  // Tasks by project for list view
  const tasksByProject: Record<string, Task[]> = {};
  for (const task of activeTasks) {
    const proj = allProjects.find(p => p.id === task.projectId);
    const key = proj ? `${proj.client_name} · ${proj.name}` : "Sin proyecto";
    if (!tasksByProject[key]) tasksByProject[key] = [];
    tasksByProject[key].push(task);
  }

  const handleQuickCreate = (date: Date) => {
    setCreateDate(date.toISOString());
    setShowCreateModal(true);
  };

  const handleCreateTask = () => {
    if (!newTaskTitle.trim()) return;
    createMutation.mutate({
      title: newTaskTitle.trim(),
      projectId: newTaskProjectId !== "none" ? parseInt(newTaskProjectId) : null,
      dueDate: createDate,
      assigneeId: myData?.personnelId,
      status: "todo",
      priority: "medium",
    });
  };

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Mis Tareas</h1>
          <p className="text-sm text-muted-foreground">Tus tareas asignadas</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Activas</SelectItem>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="todo">Pendientes</SelectItem>
              <SelectItem value="in_progress">En curso</SelectItem>
              <SelectItem value="done">Completadas</SelectItem>
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

          <Button size="sm" className="h-8 text-xs" onClick={() => { setCreateDate(null); setShowCreateModal(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1" />Nueva tarea
          </Button>
        </div>
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
                    {format(weekStart, "MMMM yyyy", { locale: es })}
                  </span>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setCurrentWeek(new Date())}>
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
                  const isCurrentDay = isToday(day);
                  return (
                    <div key={day.toISOString()} className={cn("min-h-[180px]", isCurrentDay && "bg-primary/3")}>
                      {/* Day header */}
                      <div className={cn("px-2 py-2 border-b text-center", isCurrentDay && "bg-primary/10")}>
                        <p className="text-xs text-muted-foreground uppercase">{format(day, "EEE", { locale: es })}</p>
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center mx-auto mt-0.5 text-sm font-semibold",
                          isCurrentDay ? "bg-primary text-primary-foreground" : "text-foreground"
                        )}>
                          {format(day, "d")}
                        </div>
                      </div>

                      {/* Day tasks */}
                      <div className="p-1 space-y-1">
                        {dayTasks.map(task => {
                          const proj = allProjects.find(p => p.id === task.projectId);
                          return (
                            <div
                              key={task.id}
                              className={cn(
                                "text-xs p-1.5 rounded cursor-pointer border-l-2 bg-card hover:shadow-sm transition-shadow",
                                getProjectColor(task.projectId).replace("bg-", "border-l-").replace("-500", "-400"),
                                task.status === "done" && "opacity-50"
                              )}
                              onClick={() => setSelectedTaskId(task.id)}
                            >
                              <p className={cn("font-medium leading-tight", task.status === "done" && "line-through")}>{task.title}</p>
                              {proj && <p className="text-[10px] text-muted-foreground mt-0.5">{proj.client_name}</p>}
                            </div>
                          );
                        })}

                        <button
                          className="w-full text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5 px-1 py-0.5 rounded hover:bg-accent/50 transition-colors opacity-0 hover:opacity-100 group"
                          onClick={() => handleQuickCreate(day)}
                        >
                          <Plus className="h-2.5 w-2.5" />Agregar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === "list" && (
            <div className="space-y-4">
              {Object.keys(tasksByProject).length === 0 ? (
                <div className="text-center py-12 bg-card rounded-xl border">
                  <Calendar className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No tenés tareas asignadas</p>
                  <Button size="sm" className="mt-3" onClick={() => setShowCreateModal(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Crear primera tarea
                  </Button>
                </div>
              ) : (
                Object.entries(tasksByProject).map(([projectLabel, projectTasks]) => {
                  const firstTask = projectTasks[0];
                  const proj = allProjects.find(p => p.id === firstTask.projectId);
                  return (
                    <div key={projectLabel} className="bg-card rounded-xl border overflow-hidden">
                      <div className={cn("flex items-center gap-2 px-4 py-2.5 border-b", proj ? "bg-muted/30" : "bg-muted/10")}>
                        {proj && <span className={cn("w-2.5 h-2.5 rounded-full", getProjectColor(proj.id))} />}
                        <span className="font-semibold text-sm">{projectLabel}</span>
                        <Badge variant="secondary" className="h-4 px-1.5 text-[10px] ml-auto">
                          {projectTasks.filter(t => t.status !== "done").length} pendientes
                        </Badge>
                      </div>

                      <div className="divide-y divide-border">
                        {projectTasks.map(task => (
                          <div
                            key={task.id}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30 cursor-pointer group"
                          >
                            <div onClick={e => { e.stopPropagation(); toggleMutation.mutate(task); }}>
                              <Checkbox checked={task.status === "done"} className="h-4 w-4" />
                            </div>
                            <span
                              className={cn("flex-1 text-sm", task.status === "done" ? "line-through text-muted-foreground" : "")}
                              onClick={() => setSelectedTaskId(task.id)}
                            >
                              {task.title}
                            </span>
                            <Flag className={cn("h-3 w-3 flex-shrink-0", PRIORITY_COLORS[task.priority])} />
                            {task.estimatedHours && (
                              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                <Clock className="h-3 w-3" />{(task.loggedHours || 0).toFixed(1)}/{task.estimatedHours}h
                              </span>
                            )}
                            {task.dueDate && (
                              <span className={cn("text-xs", new Date(task.dueDate) < new Date() && task.status !== "done" ? "text-red-500 font-medium" : "text-muted-foreground")}>
                                {format(new Date(task.dueDate), "dd/MM", { locale: es })}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}

      {/* Quick create modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl border w-full max-w-md p-5">
            <h3 className="font-bold text-base mb-4">Nueva tarea</h3>
            <div className="space-y-3">
              <Input
                autoFocus
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCreateTask(); if (e.key === "Escape") { setShowCreateModal(false); setNewTaskTitle(""); } }}
                placeholder="Nombre de la tarea..."
                className="h-9"
              />
              <Select value={newTaskProjectId} onValueChange={setNewTaskProjectId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Seleccionar proyecto (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin proyecto</SelectItem>
                  {allProjects.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.client_name} · {p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {createDate && (
                <p className="text-xs text-muted-foreground">Fecha: {format(new Date(createDate), "dd MMMM yyyy", { locale: es })}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" size="sm" onClick={() => { setShowCreateModal(false); setNewTaskTitle(""); }}>Cancelar</Button>
              <Button size="sm" onClick={handleCreateTask} disabled={!newTaskTitle.trim() || createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear tarea"}
              </Button>
            </div>
          </div>
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
