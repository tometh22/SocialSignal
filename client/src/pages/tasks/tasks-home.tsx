import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { queryClient, apiRequest, authFetch } from "@/lib/queryClient";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, CheckSquare, FolderOpen, Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type Task = {
  id: number;
  title: string;
  status: string;
  priority: string;
  dueDate?: string | null;
  projectId?: number | null;
  projectName?: string | null;
  clientName?: string | null;
  assigneeId?: number | null;
};

type TaskProject = {
  id: number;
  name: string;
  clientName: string;
  status: string;
  taskCount: number;
  pendingCount: number;
  members: { personnelId: number; name: string; role: string }[];
};

const PROJECT_PALETTE_BG = [
  "bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500",
  "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-rose-500",
];

function getProjectColor(id: number) {
  return PROJECT_PALETTE_BG[id % PROJECT_PALETTE_BG.length];
}

function getInitial(name: string) {
  return name.charAt(0).toUpperCase();
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function formatDateFull() {
  return format(new Date(), "EEEE, d 'de' MMMM", { locale: es });
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function isOverdue(task: Task) {
  return task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done";
}

export default function TasksHomePage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [myTab, setMyTab] = useState<"upcoming" | "overdue" | "done">("upcoming");
  const [assignedTab, setAssignedTab] = useState<"upcoming" | "overdue" | "done">("upcoming");

  const { data: myTasksResponse, refetch: refetchMyTasks } = useQuery<{ tasks: Task[]; personnelId: number | null } | Task[]>({
    queryKey: ["/api/tasks/my-tasks"],
    queryFn: () => authFetch("/api/tasks/my-tasks").then(r => r.json()),
  });

  const { data: allTasksData } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    queryFn: () => authFetch("/api/tasks").then(r => r.json()),
  });

  const { data: rawProjects } = useQuery<TaskProject[]>({
    queryKey: ["/api/tasks/projects"],
    queryFn: () => authFetch("/api/tasks/projects").then(r => r.json()),
  });

  const { data: personnel = [] } = useQuery<{ id: number; name: string; email?: string | null }[]>({
    queryKey: ["/api/tasks-personnel"],
    queryFn: () => authFetch("/api/tasks-personnel").then(r => r.json()),
  });

  const toggleMutation = useMutation({
    mutationFn: (task: Task) => apiRequest(`/api/tasks/${task.id}`, "PUT", {
      status: task.status === "done" ? "todo" : "done",
    }),
    onSuccess: () => refetchMyTasks(),
  });

  const myTasksData = myTasksResponse as any;
  const myTasks: Task[] = Array.isArray(myTasksData)
    ? myTasksData
    : Array.isArray(myTasksData?.tasks) ? myTasksData.tasks : [];
  const allTasks: Task[] = Array.isArray(allTasksData) ? allTasksData : [];
  const projects: TaskProject[] = Array.isArray(rawProjects) ? rawProjects : [];

  const myPersonnel = personnel.find(p => user?.email && p.email === user.email);

  const filteredMyTasks = myTasks.filter(t => {
    if (myTab === "done") return t.status === "done";
    if (myTab === "overdue") return isOverdue(t);
    return t.status !== "done" && !isOverdue(t);
  });

  const assignedByMe = allTasks.filter(t =>
    myPersonnel && t.assigneeId && t.assigneeId !== myPersonnel.id
  );
  const filteredAssigned = assignedByMe.filter(t => {
    if (assignedTab === "done") return t.status === "done";
    if (assignedTab === "overdue") return isOverdue(t);
    return t.status !== "done" && !isOverdue(t);
  });

  const recentProjects = projects.slice(0, 6);
  const firstName = user?.firstName || "Usuario";

  const TabBar = ({
    active, onChange,
  }: { active: string; onChange: (v: "upcoming" | "overdue" | "done") => void }) => (
    <div className="flex gap-0 border-b border-border">
      {([["upcoming", "Próximas"], ["overdue", "Con retraso"], ["done", "Finalizadas"]] as const).map(([val, label]) => (
        <button
          key={val}
          className={cn(
            "px-3 py-1.5 text-xs font-medium border-b-2 transition-colors",
            active === val
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          onClick={() => onChange(val)}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Greeting header */}
      <div>
        <p className="text-xs text-muted-foreground mb-0.5">{capitalize(formatDateFull())}</p>
        <h1 className="text-2xl font-bold text-foreground">
          {getGreeting()}, {firstName}
        </h1>
      </div>

      {/* Top two-column widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* My Tasks widget */}
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Mis tareas</h2>
            </div>
            <Link href="/tasks/my-tasks">
              <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground hover:text-primary px-2">
                Ver todo <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>
            </Link>
          </div>
          <div className="px-4 pb-2">
            <TabBar active={myTab} onChange={setMyTab} />
          </div>
          <div className="divide-y divide-border min-h-[180px]">
            {filteredMyTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <CheckSquare className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">
                  {myTab === "done" ? "Sin tareas completadas" : myTab === "overdue" ? "Sin tareas vencidas" : "No tenés tareas pendientes"}
                </p>
              </div>
            ) : (
              filteredMyTasks.slice(0, 8).map(task => (
                <div
                  key={task.id}
                  className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-accent/30 transition-colors group cursor-pointer"
                  onClick={() => {}}
                >
                  <div onClick={e => { e.stopPropagation(); toggleMutation.mutate(task); }}>
                    <Checkbox
                      checked={task.status === "done"}
                      className="h-3.5 w-3.5"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm truncate", task.status === "done" && "line-through text-muted-foreground")}>
                      {task.title}
                    </p>
                    {task.projectName && (
                      <p className="text-xs text-muted-foreground truncate">{task.clientName || task.projectName}</p>
                    )}
                  </div>
                  {task.dueDate && (
                    <span className={cn(
                      "text-xs flex-shrink-0",
                      isOverdue(task) ? "text-red-500 font-medium" : "text-muted-foreground"
                    )}>
                      {format(new Date(task.dueDate), "d MMM", { locale: es })}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="px-4 py-2.5 border-t">
            <Link href="/tasks/my-tasks">
              <Button size="sm" variant="outline" className="h-7 w-full text-xs">
                <Plus className="h-3 w-3 mr-1" />Crear tarea
              </Button>
            </Link>
          </div>
        </div>

        {/* Projects widget */}
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Proyectos</h2>
            </div>
            <Link href="/tasks/projects">
              <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground hover:text-primary px-2">
                Mostrar más <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>
            </Link>
          </div>
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <FolderOpen className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">Sin proyectos con tareas activas</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 px-4 pb-4">
              {recentProjects.map(proj => (
                <Link key={proj.id} href={`/tasks/projects/${proj.id}`}>
                  <div className="rounded-lg border hover:border-primary/40 hover:bg-accent/30 transition-all p-3 cursor-pointer group">
                    <div className="flex items-start gap-2 mb-1.5">
                      <span className={cn(
                        "inline-flex w-6 h-6 rounded-md flex-shrink-0 items-center justify-center text-white text-[10px] font-bold",
                        getProjectColor(proj.id)
                      )}>
                        {getInitial(proj.clientName)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium leading-tight truncate group-hover:text-primary transition-colors">{proj.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{proj.clientName}</p>
                      </div>
                    </div>
                    {proj.pendingCount > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                        {proj.pendingCount} pendientes
                      </Badge>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
          <div className="px-4 py-2.5 border-t">
            <Link href="/tasks/projects">
              <Button size="sm" variant="outline" className="h-7 w-full text-xs">
                <FolderOpen className="h-3 w-3 mr-1" />Ver todos los proyectos
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Assigned by me widget */}
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Tareas que asigné</h2>
            <span className="text-xs text-muted-foreground">· tareas asignadas a otros miembros</span>
          </div>
        </div>
        <div className="px-4 pb-2">
          <TabBar active={assignedTab} onChange={setAssignedTab} />
        </div>
        <div className="divide-y divide-border min-h-[100px]">
          {filteredAssigned.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
              <Clock className="h-7 w-7 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">
                {assignedTab === "done"
                  ? "Ninguna tarea asignada ha sido completada aún"
                  : assignedTab === "overdue"
                  ? "Ninguna tarea asignada está vencida"
                  : "No tenés tareas asignadas a otros en estado pendiente"}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Asigná tareas a tus compañeros y supervizá el avance acá
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 divide-y md:divide-y-0">
              {filteredAssigned.slice(0, 6).map(task => (
                <div
                  key={task.id}
                  className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-accent/30 transition-colors"
                >
                  <Checkbox
                    checked={task.status === "done"}
                    className="h-3.5 w-3.5"
                    disabled
                  />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm truncate", task.status === "done" && "line-through text-muted-foreground")}>
                      {task.title}
                    </p>
                    {task.projectName && (
                      <p className="text-xs text-muted-foreground truncate">{task.clientName || task.projectName}</p>
                    )}
                  </div>
                  {task.dueDate && (
                    <span className={cn(
                      "text-xs flex-shrink-0",
                      isOverdue(task) ? "text-red-500 font-medium" : "text-muted-foreground"
                    )}>
                      {format(new Date(task.dueDate), "d MMM", { locale: es })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
