import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest, authFetch } from "@/lib/queryClient";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { FolderOpen, Clock, ChevronRight, CalendarIcon, Check, Plus } from "lucide-react";
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

// ── Animated circle checkbox ──────────────────────────────────────────
function CircleCheck({
  checked,
  pending,
  onClick,
}: {
  checked: boolean;
  pending?: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center",
        "transition-all duration-200 ease-in-out focus:outline-none",
        "hover:scale-110 active:scale-95",
        checked
          ? "bg-green-500 border-green-500 shadow-sm shadow-green-200"
          : "border-muted-foreground/40 hover:border-primary/60 hover:bg-primary/5",
        pending && "opacity-60 cursor-wait"
      )}
      disabled={pending}
    >
      {checked && (
        <Check
          className="h-2.5 w-2.5 text-white"
          strokeWidth={3}
        />
      )}
    </button>
  );
}

// ── Inline date picker button ─────────────────────────────────────────
function DateButton({
  date,
  taskId,
  onSet,
  isOverdue: overdue,
}: {
  date?: string | null;
  taskId: number;
  onSet: (taskId: number, date: Date | undefined) => void;
  isOverdue: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={e => { e.stopPropagation(); setOpen(true); }}
          className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-all duration-150",
            "opacity-0 group-hover:opacity-100",
            date ? (
              overdue
                ? "text-red-500 font-medium opacity-100 hover:bg-red-50"
                : "text-muted-foreground opacity-100 hover:bg-accent"
            ) : "text-muted-foreground/50 hover:text-primary hover:bg-accent"
          )}
        >
          {date ? (
            <span>{format(new Date(date), "d MMM", { locale: es })}</span>
          ) : (
            <CalendarIcon className="h-3.5 w-3.5" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 shadow-lg" onClick={e => e.stopPropagation()}>
        <Calendar
          mode="single"
          selected={date ? new Date(date) : undefined}
          onSelect={d => {
            onSet(taskId, d);
            setOpen(false);
          }}
          locale={es}
          initialFocus
        />
        {date && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs text-muted-foreground"
              onClick={() => { onSet(taskId, undefined); setOpen(false); }}
            >
              Quitar fecha
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── Task row in home widget ───────────────────────────────────────────
function HomeTaskRow({
  task,
  onToggle,
  onDateSet,
  toggling,
  hidingId,
}: {
  task: Task;
  onToggle: (task: Task) => void;
  onDateSet: (taskId: number, date: Date | undefined) => void;
  toggling: boolean;
  hidingId: number | null;
}) {
  const isDone = task.status === "done";
  const overdue = !!isOverdue(task);
  const isHiding = hidingId === task.id;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 hover:bg-accent/20 transition-all duration-200 group",
        isHiding && "opacity-0 scale-95 pointer-events-none",
      )}
    >
      <CircleCheck
        checked={isDone}
        pending={toggling}
        onClick={e => { e.stopPropagation(); onToggle(task); }}
      />

      <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden">
        <span className={cn(
          "text-sm truncate transition-all duration-200 leading-5",
          isDone ? "line-through text-muted-foreground" : "text-foreground"
        )}>
          {task.title}
        </span>
        {(task.clientName || task.projectName) && (
          <span className="text-[11px] text-muted-foreground/50 flex-shrink-0 truncate hidden sm:inline">
            · {task.clientName || task.projectName}
          </span>
        )}
      </div>

      <DateButton
        date={task.dueDate}
        taskId={task.id}
        onSet={onDateSet}
        isOverdue={overdue}
      />
    </div>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────
function TabBar({
  active,
  onChange,
  counts,
}: {
  active: string;
  onChange: (v: "upcoming" | "overdue" | "done") => void;
  counts: { upcoming: number; overdue: number; done: number };
}) {
  return (
    <div className="flex gap-0 border-b border-border">
      {([
        ["upcoming", "Próximas"],
        ["overdue", "Con retraso"],
        ["done", "Finalizadas"],
      ] as const).map(([val, label]) => (
        <button
          key={val}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors",
            active === val
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          onClick={() => onChange(val)}
        >
          {label}
          {counts[val] > 0 && val !== "done" && (
            <span className={cn(
              "px-1.5 py-0.5 rounded-full text-[10px] font-bold",
              val === "overdue"
                ? "bg-red-100 text-red-600"
                : "bg-primary/10 text-primary"
            )}>
              {counts[val] > 99 ? "99+" : counts[val]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────
export default function TasksHomePage() {
  const { user } = useAuth();
  const [myTab, setMyTab] = useState<"upcoming" | "overdue" | "done">("upcoming");
  const [assignedTab, setAssignedTab] = useState<"upcoming" | "overdue" | "done">("upcoming");
  const [showAllMy, setShowAllMy] = useState(false);
  const [showAllAssigned, setShowAllAssigned] = useState(false);
  const [hidingTaskId, setHidingTaskId] = useState<number | null>(null);

  const { data: myTasksResponse, refetch: refetchMyTasks } = useQuery({
    queryKey: ["/api/tasks/my-tasks"],
    queryFn: () => authFetch("/api/tasks/my-tasks").then(r => r.json()),
  });

  const { data: allTasksData } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    queryFn: () => authFetch("/api/tasks").then(r => r.json()),
  });

  const { data: rawProjects } = useQuery({
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
    onSuccess: () => {
      setTimeout(() => {
        setHidingTaskId(null);
        refetchMyTasks();
      }, 300);
    },
  });

  const dateMutation = useMutation({
    mutationFn: ({ taskId, date }: { taskId: number; date: Date | undefined }) =>
      apiRequest(`/api/tasks/${taskId}`, "PUT", {
        dueDate: date ? date.toISOString() : null,
      }),
    onSuccess: () => refetchMyTasks(),
  });

  const handleToggle = useCallback((task: Task) => {
    if (task.status !== "done") {
      setHidingTaskId(task.id);
    }
    toggleMutation.mutate(task);
  }, [toggleMutation]);

  const handleDateSet = useCallback((taskId: number, date: Date | undefined) => {
    dateMutation.mutate({ taskId, date });
  }, [dateMutation]);

  const raw = myTasksResponse as any;
  const myTasks: Task[] = Array.isArray(raw) ? raw : Array.isArray(raw?.tasks) ? raw.tasks : [];
  const allTasks: Task[] = Array.isArray(allTasksData) ? allTasksData : [];
  const projects: TaskProject[] = Array.isArray(rawProjects) ? rawProjects : [];

  const myPersonnel = personnel.find(p => user?.email && p.email === user.email);

  const taskCounts = {
    upcoming: myTasks.filter(t => t.status !== "done" && !isOverdue(t)).length,
    overdue: myTasks.filter(t => !!isOverdue(t)).length,
    done: myTasks.filter(t => t.status === "done").length,
  };

  const filteredMyTasks = myTasks.filter(t => {
    if (myTab === "done") return t.status === "done";
    if (myTab === "overdue") return isOverdue(t);
    return t.status !== "done" && !isOverdue(t);
  });

  const assignedByMe = allTasks.filter(t =>
    myPersonnel && t.assigneeId && t.assigneeId !== myPersonnel.id
  );
  const assignedCounts = {
    upcoming: assignedByMe.filter(t => t.status !== "done" && !isOverdue(t)).length,
    overdue: assignedByMe.filter(t => !!isOverdue(t)).length,
    done: assignedByMe.filter(t => t.status === "done").length,
  };
  const filteredAssigned = assignedByMe.filter(t => {
    if (assignedTab === "done") return t.status === "done";
    if (assignedTab === "overdue") return isOverdue(t);
    return t.status !== "done" && !isOverdue(t);
  });

  const recentProjects = projects.slice(0, 6);
  const firstName = user?.firstName || "Usuario";
  const MY_LIMIT = 6;
  const ASSIGNED_LIMIT = 6;

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Greeting header */}
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10 ring-2 ring-primary/20 flex-shrink-0">
          <AvatarImage src={(user as any)?.avatar || ""} />
          <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
            {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-xs text-muted-foreground">{capitalize(formatDateFull())}</p>
          <h1 className="text-xl font-bold text-foreground leading-tight">
            {getGreeting()}, {firstName}
          </h1>
        </div>
      </div>

      {/* Top two-column widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* My Tasks widget */}
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 pt-4 pb-1">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={(user as any)?.avatar || ""} />
                <AvatarFallback className="bg-primary text-primary-foreground text-[9px] font-bold">
                  {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-sm font-semibold">Mis tareas</h2>
            </div>
            <Link href="/tasks/my-tasks">
              <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground hover:text-primary px-2">
                Ver todo <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>
            </Link>
          </div>
          <div className="px-4">
            <TabBar active={myTab} onChange={t => { setMyTab(t); setShowAllMy(false); }} counts={taskCounts} />
          </div>

          {/* Quick create */}
          <Link href="/tasks/my-tasks">
            <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer border-b border-border/50">
              <Plus className="h-3.5 w-3.5" />
              <span>Crear tarea</span>
            </div>
          </Link>

          <div className="flex-1 divide-y divide-border/60 min-h-[160px]">
            {filteredMyTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <div className="w-8 h-8 rounded-full border-2 border-muted-foreground/20 flex items-center justify-center mb-2">
                  <Check className="h-4 w-4 text-muted-foreground/30" />
                </div>
                <p className="text-xs text-muted-foreground">
                  {myTab === "done" ? "Sin tareas completadas" : myTab === "overdue" ? "Sin tareas vencidas" : "No tenés tareas pendientes"}
                </p>
              </div>
            ) : (
              <>
                {(showAllMy ? filteredMyTasks : filteredMyTasks.slice(0, MY_LIMIT)).map(task => (
                  <HomeTaskRow
                    key={task.id}
                    task={task}
                    onToggle={handleToggle}
                    onDateSet={handleDateSet}
                    toggling={toggleMutation.isPending && hidingTaskId === task.id}
                    hidingId={hidingTaskId}
                  />
                ))}
                {filteredMyTasks.length > MY_LIMIT && (
                  <button
                    className="w-full px-4 py-2.5 text-xs text-muted-foreground hover:text-primary transition-colors text-left"
                    onClick={() => setShowAllMy(!showAllMy)}
                  >
                    {showAllMy
                      ? "Mostrar menos"
                      : `Mostrar ${filteredMyTasks.length - MY_LIMIT} más`}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Projects widget */}
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden flex flex-col">
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
            <div className="flex flex-col items-center justify-center flex-1 py-10 px-4 text-center">
              <FolderOpen className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">Sin proyectos con tareas activas</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 px-4 pb-2 flex-1">
              {recentProjects.map(proj => (
                <Link key={proj.id} href={`/tasks/projects/${proj.id}`}>
                  <div className="rounded-lg border border-border/60 hover:border-primary/40 hover:shadow-sm hover:bg-accent/20 transition-all duration-200 p-3 cursor-pointer group h-full">
                    <div className="flex items-start gap-2 mb-2">
                      <span className={cn(
                        "inline-flex w-7 h-7 rounded-lg flex-shrink-0 items-center justify-center text-white text-xs font-bold shadow-sm",
                        getProjectColor(proj.id)
                      )}>
                        {getInitial(proj.clientName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold leading-tight truncate group-hover:text-primary transition-colors">{proj.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">{proj.clientName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {proj.pendingCount > 0 ? (
                        <span className="text-[10px] text-muted-foreground">
                          <span className="font-semibold text-foreground">{proj.pendingCount}</span> pendientes
                        </span>
                      ) : (
                        <span className="text-[10px] text-green-600 font-medium flex items-center gap-0.5">
                          <Check className="h-2.5 w-2.5" />Al día
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <div className="px-4 py-3 border-t mt-auto">
            <Link href="/tasks/projects">
              <Button size="sm" variant="outline" className="h-7 w-full text-xs">
                <FolderOpen className="h-3 w-3 mr-1.5" />Ver todos los proyectos
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Assigned by me widget */}
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-1">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Tareas que asigné</h2>
            <span className="text-xs text-muted-foreground hidden sm:inline">· supervisá el avance del equipo</span>
          </div>
        </div>
        <div className="px-4">
          <TabBar active={assignedTab} onChange={t => { setAssignedTab(t); setShowAllAssigned(false); }} counts={assignedCounts} />
        </div>

        <div className="divide-y divide-border/60 min-h-[80px]">
          {filteredAssigned.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
              <Clock className="h-6 w-6 text-muted-foreground/30 mb-1.5" />
              <p className="text-xs text-muted-foreground">
                {assignedTab === "done"
                  ? "Ninguna tarea asignada ha sido completada aún"
                  : assignedTab === "overdue"
                  ? "Ninguna tarea asignada está vencida"
                  : "No hay tareas pendientes que hayas asignado a otros"}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {(showAllAssigned ? filteredAssigned : filteredAssigned.slice(0, ASSIGNED_LIMIT)).map(task => {
                  const overdue = !!isOverdue(task);
                  const isDone = task.status === "done";
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/20 transition-colors border-b border-border/40 last:border-0 group"
                    >
                      <div className={cn(
                        "flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center",
                        isDone
                          ? "bg-green-500 border-green-500"
                          : "border-muted-foreground/30"
                      )}>
                        {isDone && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                      </div>
                      <div className="flex-1 min-w-0 flex items-center gap-1 overflow-hidden">
                        <span className={cn("text-sm truncate leading-5", isDone && "line-through text-muted-foreground")}>
                          {task.title}
                        </span>
                        {(task.clientName || task.projectName) && (
                          <span className="text-[11px] text-muted-foreground/50 flex-shrink-0 hidden sm:inline">
                            · {task.clientName || task.projectName}
                          </span>
                        )}
                      </div>
                      {task.dueDate && (
                        <span className={cn(
                          "text-[11px] flex-shrink-0",
                          overdue ? "text-red-500 font-medium" : "text-muted-foreground"
                        )}>
                          {format(new Date(task.dueDate), "d MMM", { locale: es })}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {filteredAssigned.length > ASSIGNED_LIMIT && (
                <button
                  className="w-full px-4 py-2.5 text-xs text-muted-foreground hover:text-primary transition-colors text-left"
                  onClick={() => setShowAllAssigned(!showAllAssigned)}
                >
                  {showAllAssigned
                    ? "Mostrar menos"
                    : `Mostrar ${filteredAssigned.length - ASSIGNED_LIMIT} más`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
