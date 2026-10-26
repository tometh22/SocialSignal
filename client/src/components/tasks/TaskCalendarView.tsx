import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetchJson } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { clientCalendarColor } from "@/lib/client-calendar-color";
import { civilDateInBuenosAires, currentBuenosAiresWeek } from "@shared/utils/buenos-aires-week";
import { taskDateBucket } from "@shared/utils/task-date-bucket";
import { assignCalendarLanes } from "@shared/utils/calendar-lanes";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";

interface CalTask {
  id: number; title: string; dueDate?: string | null; startDate?: string | null; status: string;
  parentTaskId?: number | null; clientId?: number | null; clientName?: string | null;
  projectName?: string | null; assigneeName?: string | null; blockedReason?: string | null;
}
interface Props { projectId?: number; view?: "month" | "current-week"; showUndated?: boolean; tasks?: CalTask[] }
const WEEK_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const localDate = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00`);
const range = (task: CalTask) => [task.startDate, task.dueDate].filter((date, i, dates) => date && dates.indexOf(date) === i).map(date => format(localDate(date!), "d MMM", { locale: es })).join(" – ");

export default function TaskCalendarView({ projectId, tasks: tasksProp, view = "month", showUndated = true }: Props) {
  const [currentMonth, setCurrentMonth] = useState(localDate(civilDateInBuenosAires(new Date())));
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<number | null>(null);
  const { data, refetch } = useQuery<{ tasks: CalTask[] }>({
    queryKey: ["/api/tasks/project", projectId],
    queryFn: () => authFetchJson(`/api/tasks/project/${projectId}?layout=flat`),
    staleTime: 30_000, enabled: tasksProp === undefined && projectId !== undefined,
  });
  const sourceTasks = Array.isArray(tasksProp) ? tasksProp : Array.isArray(data?.tasks) ? data.tasks : [];
  const dated = sourceTasks.filter(t => t.status !== "cancelled" && (t.startDate || t.dueDate));
  const undated = sourceTasks.filter(t => !t.startDate && !t.dueDate && !["done", "cancelled"].includes(t.status));
  const civilWeek = currentBuenosAiresWeek();
  const first = view === "current-week" ? localDate(civilWeek.from) : startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
  const last = view === "current-week" ? localDate(civilWeek.to) : endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
  const weeks: Date[][] = [];
  for (let day = first; day <= last;) { const days: Date[] = []; for (let i = 0; i < 7; i++) { days.push(day); day = addDays(day, 1); } weeks.push(days); }
  const toggle = (key: string) => setExpandedWeeks(previous => { const next = new Set(previous); next.has(key) ? next.delete(key) : next.add(key); return next; });
  const move = (date: Date) => { setCurrentMonth(date); setExpandedWeeks(new Set()); };
  const today = localDate(civilDateInBuenosAires(new Date()));
  const renderTask = (task: CalTask, expanded: boolean) => <button key={task.id} type="button" onClick={() => setSelectedTask(task.id)}
    aria-label={`Abrir tarea: ${task.title}`} title={[task.title, task.clientName, task.projectName, range(task)].filter(Boolean).join(" · ")}
    className={cn("block w-full min-w-0 rounded border px-1.5 py-1 text-left text-[10px] leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", clientCalendarColor(task.clientId), task.status === "done" && "opacity-60", taskDateBucket(task) === "overdue" && "border-red-400")}>
    <span className={cn("block font-medium", expanded ? "break-words" : "truncate", task.status === "done" && "line-through")}>{task.status === "blocked" && "⊘ "}{task.title}</span>
    {expanded && <span className="mt-1 block space-y-0.5 break-words opacity-80">
      {task.assigneeName && <span className="block">{task.assigneeName}</span>}
      {task.projectName && <span className="block">{task.projectName}</span>}
      <span className="block">{range(task)}</span>
      {task.status === "blocked" && <span className="block">{task.blockedReason || "Bloqueada"}</span>}
    </span>}
  </button>;
  return <div className="min-w-0 pb-6 pt-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold capitalize">{view === "current-week" ? `${format(first, "d MMM", { locale: es })} – ${format(last, "d MMM", { locale: es })}` : format(currentMonth, "MMMM yyyy", { locale: es })}</h3>
      {view === "month" && <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Mes anterior" onClick={() => move(addMonths(currentMonth, -1))}><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={() => move(today)}>Hoy</Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Mes siguiente" onClick={() => move(addMonths(currentMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
      </div>}
    </div>
    <div className="mb-2 flex flex-wrap gap-2 text-[10px]">{Array.from(new Map(sourceTasks.map(t => [t.clientId, t.clientName || "Sin cliente"]))).map(([id, name]) => <span key={id ?? "none"} className={cn("rounded border px-2 py-0.5", clientCalendarColor(id))}>{name}</span>)}</div>
    <p className="mb-2 text-xs text-muted-foreground">Seleccioná un día o «más» para desplegar la semana. Tocá una tarea para abrirla.</p>
    <div className="max-w-full overflow-x-auto rounded-xl border" role="region" aria-label="Calendario de tareas" tabIndex={0}>
      <div className="min-w-[770px]">
        <div className="grid grid-cols-7 border-b">{WEEK_DAYS.map(day => <div key={day} className="py-2 text-center text-xs text-muted-foreground">{day}</div>)}</div>
        {weeks.map(week => {
          const key = format(week[0], "yyyy-MM-dd"); const expanded = expandedWeeks.has(key);
          const lanes = assignCalendarLanes(dated, week.map(d => format(d, "yyyy-MM-dd")));
          return <div key={key} className="border-b last:border-b-0">
            <div id={`personal-week-${key}`} className="grid grid-cols-7 divide-x">
              {week.map(day => {
                const tasks = dated.filter(task => { const start = localDate(task.startDate || task.dueDate!); const end = localDate(task.dueDate || task.startDate!); return day >= start && day <= end; }).sort((a,b) => (lanes.get(a.id) ?? 0) - (lanes.get(b.id) ?? 0));
                const byLane = new Map<number, CalTask>();
                const overflow: CalTask[] = [];
                for (const task of tasks) { const lane = lanes.get(task.id) ?? 3; if (lane < 3) byLane.set(lane,task); else overflow.push(task); }
                for (let lane=0; lane<3 && overflow.length; lane++) if (!byLane.has(lane)) byLane.set(lane,overflow.shift()!);
                const visible: Array<CalTask | null> = expanded ? tasks : Array.from({length:byLane.size ? Math.max(...byLane.keys())+1 : 0},(_,lane)=>byLane.get(lane) ?? null);
                return <div key={day.toISOString()} className={cn("min-w-0 p-1.5", !isSameMonth(day,currentMonth) && "bg-muted/30")}>
                  <button type="button" aria-expanded={expanded} aria-controls={`personal-week-${key}`} aria-label={`${format(day, "EEEE d MMMM", {locale:es})}: ${expanded ? "contraer" : "expandir"} semana`} onClick={() => toggle(key)} className={cn("mb-2 flex h-7 w-full items-center justify-center rounded text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary", isSameDay(day,today) && "bg-primary text-primary-foreground")}>{format(day,"d")}</button>
                  <div className="space-y-1">{visible.map((task,index) => task ? renderTask(task,expanded) : <div key={`gap-${index}`} className="h-[24px]" aria-hidden="true" />)}</div>
                  {!expanded && overflow.length > 0 && <button type="button" aria-expanded={false} aria-controls={`personal-week-${key}`} onClick={() => toggle(key)} className="mt-1 w-full rounded px-1 py-1 text-left text-xs text-primary hover:bg-muted">+{overflow.length} más</button>}
                  {expanded && tasks.length === 0 && <p className="py-3 text-center text-[10px] text-muted-foreground">Sin tareas</p>}
                </div>;
              })}
            </div>
            {expanded && <div className="flex items-center justify-between border-t bg-muted/20 px-3 py-2"><span className="text-xs text-muted-foreground">Todas las tareas del {format(week[0],"d MMM",{locale:es})} al {format(week[6],"d MMM",{locale:es})}</span><Button variant="ghost" size="sm" onClick={() => toggle(key)}>Contraer semana</Button></div>}
          </div>;
        })}
      </div>
    </div>
    {showUndated && undated.length > 0 && <div className="mt-4 rounded-xl border p-3"><p className="mb-2 text-xs text-muted-foreground">Sin fecha ({undated.length})</p><div className="grid gap-2 sm:grid-cols-2">{undated.map(task => renderTask(task,true))}</div></div>}
    {selectedTask != null && <TaskDetailPanel taskId={selectedTask} open onClose={() => setSelectedTask(null)} onUpdate={() => { void refetch(); }} onNavigateToTask={setSelectedTask} />}
  </div>;
}
