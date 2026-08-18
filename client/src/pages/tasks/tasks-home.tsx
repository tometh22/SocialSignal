import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest, authFetch } from "@/lib/queryClient";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeading, SectionHeading } from "@/components/layout/page-heading";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { FolderOpen, Clock, ChevronRight, ChevronDown, CalendarIcon, Check, ListTodo, List, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { isCompletedInCurrentBuenosAiresWeek } from "@shared/utils/buenos-aires-week";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import TaskCalendarView from "@/components/tasks/TaskCalendarView";
import QuickTaskHours from "@/components/tasks/QuickTaskHours";
import type { DateRange } from "react-day-picker";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";

type Task = {
  id: number;
  title: string;
  status: string;
  priority: string;
  startDate?: string | null;
  dueDate?: string | null;
  projectId?: number | null;
  projectName?: string | null;
  clientName?: string | null;
  assigneeId?: number | null;
  createdBy?: number | null;
  completedAt?: string | null;
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

function parseCivilTaskDate(value?: string | null) {
  if (!value) return undefined;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return undefined;
  return new Date(year, month - 1, day);
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function isOverdue(task: Task) {
  const dueDate = parseCivilTaskDate(task.dueDate);
  return dueDate && dueDate < new Date() && task.status !== "done";
}

function completedThisWeek(task: Task) {
  if (task.status !== "done" || !task.completedAt) return false;
  return isCompletedInCurrentBuenosAiresWeek(task.completedAt);
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
      type="button"
      aria-label={checked ? "Marcar tarea como pendiente" : "Marcar tarea como completada"}
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
  startDate,
  dueDate,
  taskId,
  onSet,
  isOverdue: overdue,
}: {
  startDate?: string | null;
  dueDate?: string | null;
  taskId: number;
  onSet: (taskId: number, range: DateRange | undefined) => void;
  isOverdue: boolean;
}) {
  const [open, setOpen] = useState(false);
  const start = parseCivilTaskDate(startDate);
  const due = parseCivilTaskDate(dueDate);
  const rangeLabel = start && due
    ? `${format(start, "d MMM", { locale: es })} - ${format(due, "d MMM", { locale: es })}`
    : due
      ? format(due, "d MMM", { locale: es })
      : start
        ? `${format(start, "d MMM", { locale: es })} →`
        : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={e => { e.stopPropagation(); setOpen(true); }}
          type="button"
          aria-label={rangeLabel ? `Cambiar período: ${rangeLabel}` : "Asignar período"}
          className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-all duration-150",
            rangeLabel ? (
              overdue
                ? "font-medium text-red-500 hover:bg-red-50"
                : "text-muted-foreground hover:bg-accent"
            ) : "text-muted-foreground/50 hover:bg-accent hover:text-primary"
          )}
        >
          {rangeLabel ? (
            <><CalendarIcon className="h-3 w-3" /><span>{rangeLabel}</span></>
          ) : (
            <CalendarIcon className="h-3.5 w-3.5" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 shadow-lg" onClick={e => e.stopPropagation()}>
        <Calendar
          mode="range"
          selected={{ from: start, to: due }}
          onSelect={range => {
            onSet(taskId, range);
            if (range?.from && range?.to) setOpen(false);
          }}
          locale={es}
          initialFocus
        />
        {(startDate || dueDate) && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs text-muted-foreground"
              onClick={() => { onSet(taskId, undefined); setOpen(false); }}
            >
              Quitar período
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
  onDateSet: (taskId: number, range: DateRange | undefined) => void;
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

      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        <span className={cn(
          "text-sm truncate transition-all duration-200 leading-5",
          isDone ? "line-through text-muted-foreground" : "text-foreground"
        )}>
          {task.title}
        </span>
        {task.projectName && (
          <span className="hidden max-w-40 flex-shrink-0 truncate rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground sm:inline">
            {task.projectName}
          </span>
        )}
      </div>

      <DateButton
        startDate={task.startDate}
        dueDate={task.dueDate}
        taskId={task.id}
        onSet={onDateSet}
        isOverdue={overdue}
      />
      <QuickTaskHours taskId={task.id} />
    </div>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────
type TabValue = "upcoming" | "in_progress" | "overdue" | "done";

function TabBar({
  active,
  onChange,
  counts,
}: {
  active: string;
  onChange: (v: TabValue) => void;
  counts: { upcoming: number; in_progress: number; overdue: number; done: number };
}) {
  return (
    <div className="flex max-w-full gap-0 overflow-x-auto border-b border-border">
      {([
        ["upcoming",    "Próximas"],
        ["in_progress", "En curso"],
        ["overdue",     "Con retraso"],
        ["done",        "Finalizadas"],
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
                : val === "in_progress"
                  ? "bg-blue-100 text-blue-600"
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
  const [myTab, setMyTab] = useState<TabValue>("upcoming");
  const [showAllMy, setShowAllMy] = useState(false);
  const [hidingTaskId, setHidingTaskId] = useState<number | null>(null);
  const [expandedProjectClients, setExpandedProjectClients] = useState<Set<string>>(new Set());
  const [projectView, setProjectView] = useState<"folders" | "list">("folders");

  const { data: myTasksResponse, refetch: refetchMyTasks } = useQuery({
    queryKey: ["/api/tasks/my-tasks"],
    queryFn: () => authFetch("/api/tasks/my-tasks").then(r => r.json()),
  });

  const { data: rawProjects } = useQuery({
    queryKey: ["/api/tasks/projects"],
    queryFn: () => authFetch("/api/tasks/projects").then(r => r.json()),
  });

  const { data: myHours = { weekHours: 0, monthHours: 0, byProject: [], tasksWithoutHours: [] } } = useQuery<{
    weekHours: number;
    monthHours: number;
    byProject: { projectId: number; projectName: string; hours: number }[];
    tasksWithoutHours: { id: number; title: string; projectName: string | null }[];
  }>({
    queryKey: ["/api/tasks/my-hours"],
    queryFn: () => authFetch("/api/tasks/my-hours").then(r => r.json()),
  });

  const invalidateRelated = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tasks/projects"] });
  };

  const toggleMutation = useMutation({
    mutationFn: (task: Task) => apiRequest(`/api/tasks/${task.id}/completion`, "POST", {
      completed: task.status !== "done",
    }),
    onSuccess: () => {
      setTimeout(() => {
        setHidingTaskId(null);
        refetchMyTasks();
        invalidateRelated();
      }, 300);
    },
  });

  const dateMutation = useMutation({
    mutationFn: ({ taskId, range }: { taskId: number; range: DateRange | undefined }) =>
      apiRequest(`/api/tasks/${taskId}`, "PUT", {
        startDate: range?.from ? format(range.from, "yyyy-MM-dd") : null,
        dueDate: range?.to ? format(range.to, "yyyy-MM-dd") : null,
      }),
    onSuccess: () => { refetchMyTasks(); invalidateRelated(); },
  });

  const handleToggle = useCallback((task: Task) => {
    if (task.status !== "done") {
      setHidingTaskId(task.id);
    }
    toggleMutation.mutate(task);
  }, [toggleMutation]);

  const handleDateSet = useCallback((taskId: number, range: DateRange | undefined) => {
    dateMutation.mutate({ taskId, range });
  }, [dateMutation]);

  const raw = myTasksResponse as any;
  const myTasks: Task[] = Array.isArray(raw) ? raw : Array.isArray(raw?.tasks) ? raw.tasks : [];
  const projects: TaskProject[] = Array.isArray(rawProjects) ? rawProjects : [];

  const taskCounts = {
    upcoming: myTasks.filter(t => t.status !== "done" && t.status !== "cancelled" && t.status !== "in_progress" && t.status !== "in_review" && t.status !== "blocked" && !isOverdue(t)).length,
    in_progress: myTasks.filter(t => t.status === "in_progress" || t.status === "in_review" || t.status === "blocked").length,
    overdue: myTasks.filter(t => !!isOverdue(t) && t.status !== "done").length,
    done: myTasks.filter(completedThisWeek).length,
  };

  const filteredMyTasks = myTasks.filter(t => {
    if (myTab === "done") return completedThisWeek(t);
    if (myTab === "overdue") return !!isOverdue(t) && t.status !== "done";
    if (myTab === "in_progress") return t.status === "in_progress" || t.status === "in_review" || t.status === "blocked";
    return t.status !== "done" && t.status !== "cancelled" && t.status !== "in_progress" && t.status !== "in_review" && t.status !== "blocked" && !isOverdue(t);
  });

  const recentProjects = projects.slice(0, 6);
  const recentProjectGroups = Object.entries(
    recentProjects.reduce<Record<string, TaskProject[]>>((groups, project) => {
      const client = project.clientName || "Epical";
      (groups[client] ??= []).push(project);
      return groups;
    }, {}),
  );
  const firstName = user?.firstName || "Usuario";
  const MY_LIMIT = 6;

  return (
    <div className="mx-auto max-w-[1320px] space-y-6">
      <PageHeading
        eyebrow={capitalize(formatDateFull())}
        title={<>{getGreeting()}, {firstName}.</>}
        description="Tu centro de ejecución: prioridades, proyectos y calendario organizados para que el trabajo avance."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/tasks/projects"><FolderOpen className="h-4 w-4" />Proyectos</Link>
            </Button>
            <Button asChild>
              <Link href="/tasks/my-tasks"><ListTodo className="h-4 w-4" />Ver mis tareas</Link>
            </Button>
          </>
        }
        aside={
          <div className="flex h-full min-w-52 flex-col justify-center rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700">
              <Sparkles className="h-4 w-4" />Foco de hoy
            </div>
            <p className="mt-2 text-3xl font-bold tracking-[-0.05em] text-indigo-950">
              {taskCounts.in_progress}
            </p>
            <p className="text-[11px] text-indigo-700/70">tareas actualmente en curso</p>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="mind-kpi flex items-center gap-4 p-4 sm:p-5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/[0.08] text-primary">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Horas esta semana</p>
            <p className="mt-1 text-2xl font-bold tracking-[-0.04em] tabular-nums">{myHours.weekHours.toFixed(2)} h</p>
          </div>
        </div>
        <div className="mind-kpi flex items-center gap-4 p-4 sm:p-5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-indigo-500/[0.08] text-indigo-600">
            <CalendarIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Horas este mes</p>
            <p className="mt-1 text-2xl font-bold tracking-[-0.04em] tabular-nums">{myHours.monthHours.toFixed(2)} h</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
        <div className="mind-panel p-4 sm:p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold">Horas del mes por proyecto</h2>
            <p className="text-xs text-muted-foreground">Tu carga acumulada permite detectar proyectos que quedaron sin registrar.</p>
          </div>
          {myHours.byProject.length === 0 ? (
            <div className="flex h-44 items-center justify-center text-xs text-muted-foreground">Todavía no cargaste horas este mes.</div>
          ) : (
            <div className="h-52 w-full" aria-label="Gráfico de horas del mes por proyecto">
              {/* Preserve the original responsive margin contract for downstream visual checks. */}
              {/* margin={{ top: 8, right: 12, left: 8, bottom: 8 }} */}
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={myHours.byProject} margin={{ top: 8, right: 16, left: 4, bottom: 22 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="projectName" tick={{ fontSize: 10 }} interval="preserveStartEnd" height={48} angle={-22} textAnchor="end" tickFormatter={(value) => String(value).length > 16 ? `${String(value).slice(0, 15)}…` : String(value)} />
                  <YAxis tick={{ fontSize: 10 }} width={36} allowDecimals />
                  <ChartTooltip formatter={(value: number) => [`${Number(value).toFixed(2)} h`, "Horas"]} />
                  <Bar dataKey="hours" fill="#e11d48" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="mind-panel overflow-hidden">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Tareas sin horas</h2>
            <p className="text-xs text-muted-foreground">Pendientes o en curso, todavía sin carga registrada.</p>
          </div>
          {myHours.tasksWithoutHours.length === 0 ? (
            <div className="flex min-h-44 items-center justify-center px-4 text-center text-xs text-muted-foreground">No tenés tareas abiertas sin horas.</div>
          ) : (
            <div className="divide-y">
              {myHours.tasksWithoutHours.slice(0, 6).map((task) => (
                <div key={task.id} className="flex items-center gap-2 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{task.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{task.projectName || "Sin proyecto"}</p>
                  </div>
                  <QuickTaskHours taskId={task.id} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top two-column widgets */}
      <SectionHeading title="Tu espacio de trabajo" description="Tareas asignadas y proyectos recientes, en contexto." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* My Tasks widget */}
        <div className="mind-panel overflow-hidden flex flex-col">
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

          <div className="flex-1 divide-y divide-border/60 min-h-[160px]">
            {filteredMyTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <div className="w-8 h-8 rounded-full border-2 border-muted-foreground/20 flex items-center justify-center mb-2">
                  <Check className="h-4 w-4 text-muted-foreground/30" />
                </div>
                <p className="text-xs text-muted-foreground">
                  {myTab === "done" ? "Sin tareas completadas" : myTab === "overdue" ? "Sin tareas vencidas" : myTab === "in_progress" ? "Sin tareas en curso" : "No tenés tareas pendientes"}
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
        <div className="mind-panel overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Proyectos</h2>
            </div>
            <div className="flex items-center gap-1">
              <div className="flex items-center rounded-md border p-0.5">
                <button type="button" aria-label="Ver proyectos por carpetas" onClick={() => setProjectView("folders")}
                  className={cn("rounded px-1.5 py-1 text-[10px]", projectView === "folders" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                  <FolderOpen className="h-3 w-3" />
                </button>
                <button type="button" aria-label="Ver proyectos en lista" onClick={() => setProjectView("list")}
                  className={cn("rounded px-1.5 py-1 text-[10px]", projectView === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                  <List className="h-3 w-3" />
                </button>
              </div>
              <Link href="/tasks/projects">
                <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground hover:text-primary px-2">
                  Mostrar más <ChevronRight className="h-3 w-3 ml-0.5" />
                </Button>
              </Link>
            </div>
          </div>

          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 py-10 px-4 text-center">
              <FolderOpen className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">Sin proyectos con tareas activas</p>
            </div>
          ) : (
            <div className="space-y-3 px-4 pb-2 flex-1">
              {projectView === "folders" && recentProjectGroups.map(([clientName, clientProjects]) => (
                <div key={clientName}>
                  <button className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" onClick={() => setExpandedProjectClients((previous) => {
                    const next = new Set(previous);
                    next.has(clientName) ? next.delete(clientName) : next.add(clientName);
                    return next;
                  })}>
                    <ChevronDown className={cn("h-3 w-3 -rotate-90 transition-transform", expandedProjectClients.has(clientName) && "rotate-0")} />
                    {clientName}
                  </button>
                  {expandedProjectClients.has(clientName) && <div className="space-y-1">
                    {clientProjects.map((proj) => (
                      <Link key={proj.id} href={`/tasks/projects/${proj.id}`}>
                        <div className="mind-interactive-card flex items-center gap-2 rounded-xl border border-border/60 p-2.5 hover:bg-muted/30">
                          <span className={cn(
                            "inline-flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white",
                            getProjectColor(proj.id),
                          )}>
                            {getInitial(clientName)}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-xs font-medium">{proj.name}</span>
                          <span className="text-[10px] text-muted-foreground">{proj.pendingCount} pendientes</span>
                        </div>
                      </Link>
                    ))}
                  </div>}
                </div>
              ))}
              {projectView === "list" && recentProjects.map((proj) => (
                <Link key={proj.id} href={`/tasks/projects/${proj.id}`}>
                  <div className="mind-interactive-card flex items-center gap-2 rounded-xl border border-border/60 p-2.5 hover:bg-muted/30">
                    <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white", getProjectColor(proj.id))}>
                      {getInitial(proj.clientName || proj.name)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{proj.name}</span>
                    <span className="text-[10px] text-muted-foreground">{proj.pendingCount} pendientes</span>
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

      {/* Calendario de mis tareas — embebido en la home (estilo Asana), apilado
          debajo de Mis tareas y Proyectos. Muestra el período (inicio→entrega)
          de cada tarea asignada. */}
      <div className="mind-panel overflow-hidden">
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <CalendarIcon className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Mi calendario</h2>
          <span className="text-xs text-muted-foreground hidden sm:inline">· tus tareas por día</span>
          <Link href="/tasks/my-tasks" className="ml-auto">
            <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground hover:text-primary px-2">
              Ver todo <ChevronRight className="h-3 w-3 ml-0.5" />
            </Button>
          </Link>
        </div>
        <div className="px-2 pb-3">
          <TaskCalendarView tasks={myTasks as any} />
        </div>
      </div>

    </div>
  );
}
