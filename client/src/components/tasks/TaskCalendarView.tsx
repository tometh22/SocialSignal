import { clientCalendarColor } from "@/lib/client-calendar-color";
import { civilDateInBuenosAires, currentBuenosAiresWeek } from "@shared/utils/buenos-aires-week";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetchJson } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, isSameMonth, isSameDay, addMonths, subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { taskDateBucket } from "@shared/utils/task-date-bucket";
import { TASK_STATUS_CONFIG, TaskStatus } from "@/constants/task-statuses";

interface CalTask {
  id: number;
  title: string;
  dueDate?: string | null;
  startDate?: string | null;
  status: string;
  parentTaskId?: number | null;
  clientId?: number | null;
  clientName?: string | null;
  projectName?: string | null;
}

interface Props {
  projectId?: number;
  view?: "month" | "current-week";
  showUndated?: boolean;
  // When provided, render these tasks directly instead of fetching by project.
  tasks?: CalTask[];
}

const STATUS_CHIP: Record<string, string> = {
  todo:        "bg-gray-100 text-gray-700 border-gray-200",
  in_progress: "bg-blue-100 text-blue-700 border-blue-200",
  blocked:     "bg-orange-100 text-orange-700 border-orange-200",
  done:        "bg-green-100 text-green-700 border-green-200 line-through",
};

const WEEK_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function TaskCalendarView({ projectId, tasks: tasksProp, view = "month", showUndated = true }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date(`${civilDateInBuenosAires(new Date())}T00:00:00`));

  const { data } = useQuery<{ tasks: CalTask[] }>({
    queryKey: ["/api/tasks/project", projectId],
    queryFn: () => authFetchJson(`/api/tasks/project/${projectId}?layout=flat`),
    staleTime: 30_000,
    enabled: tasksProp === undefined && projectId !== undefined,
  });

  // Calendar endpoints can return an error object when a protected query
  // fails. Keep the Home usable instead of calling `.filter` on that object
  // and taking down the whole application error boundary.
  const sourceTasks = Array.isArray(tasksProp)
    ? tasksProp
    : Array.isArray(data?.tasks)
      ? data.tasks
      : [];
  // El calendario representa trabajo asignado, no sólo tareas raíz. Las
  // subtareas también pueden tener fechas propias y antes desaparecían de la
  // Home por este filtro.
  const tasksWithDate = sourceTasks.filter(t => t.status !== "cancelled" && (t.dueDate || t.startDate));
  const tasksWithoutDate = sourceTasks.filter(t => !t.dueDate && !t.startDate && t.status !== "cancelled" && t.status !== "done");

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const week = currentBuenosAiresWeek();
  const calStart = view === "current-week" ? new Date(`${week.from}T00:00:00`) : startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = view === "current-week" ? new Date(`${week.to}T23:59:59`) : endOfWeek(monthEnd, { weekStartsOn: 1 });

  const weeks: Date[][] = [];
  let day = calStart;
  while (day <= calEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  const today = new Date(`${civilDateInBuenosAires(new Date())}T00:00:00`);
  today.setHours(0, 0, 0, 0);

  const isTaskOverdue = (t: CalTask, _d: Date) => taskDateBucket(t) === "overdue";

  const parseLocalDate = (s: string) => new Date(s.slice(0, 10) + "T00:00:00");

  const getRangeInfo = (t: CalTask, d: Date) => {
    if (!t.startDate || !t.dueDate) return null;
    const s = parseLocalDate(t.startDate);
    const e = parseLocalDate(t.dueDate);
    if (isSameDay(s, e)) return null;
    const atStart   = isSameDay(d, s);
    const atEnd     = isSameDay(d, e);
    const isMon     = d.getDay() === 1;
    const isSun     = d.getDay() === 0;
    const roundLeft  = atStart || isMon;
    const roundRight = atEnd   || isSun;
    return { atStart, atEnd, isMid: !atStart && !atEnd, roundLeft, roundRight };
  };

  const getTasksForDay = (d: Date) =>
    tasksWithDate.filter(t => {
      const due   = t.dueDate   ? parseLocalDate(t.dueDate)   : null;
      const start = t.startDate ? parseLocalDate(t.startDate) : null;
      if (due && start) return d >= start && d <= due;
      if (due)          return isSameDay(due, d);
      if (start)        return isSameDay(start, d);
      return false;
    });

  return (
    <div className="pt-4 pb-8">
      <div className="mb-2 flex flex-wrap gap-2 text-[10px]">{Array.from(new Map(sourceTasks.map(t => [t.clientId, t.clientName || "Sin cliente"]))).map(([id, name]) => <span key={id ?? "none"} className={cn("rounded border px-2 py-0.5", clientCalendarColor(id))}>{name}</span>)}</div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold capitalize">
          {view === "current-week" ? `${format(calStart, "d MMM", { locale: es })} – ${format(calEnd, "d MMM", { locale: es })}` : format(currentMonth, "MMMM yyyy", { locale: es })}
        </h3>
        {view === "month" && <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setCurrentMonth(new Date())}>
            Hoy
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>}
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-0.5">
        {WEEK_DAYS.map(d => (
          <div key={d} className="text-center text-[10px] text-muted-foreground font-medium py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="border border-border rounded-xl overflow-hidden">
        {weeks.map((week, wi) => (
          <div key={wi} className={cn("grid grid-cols-7", wi > 0 && "border-t border-border")}>
            {week.map((d, di) => {
              const dayTasks = getTasksForDay(d);
              const isToday = isSameDay(d, today);
              const inMonth = isSameMonth(d, currentMonth);
              return (
                <div
                  key={di}
                  className={cn(
                    "min-h-[80px] p-1.5 align-top",
                    di > 0 && "border-l border-border",
                    !inMonth && "bg-muted/30"
                  )}
                >
                  <div className={cn(
                    "text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full mb-1 mx-auto",
                    isToday
                      ? "bg-primary text-primary-foreground"
                      : inMonth
                        ? "text-foreground"
                        : "text-muted-foreground/40"
                  )}>
                    {format(d, "d")}
                  </div>
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, 3).map(t => {
                      const overdue = isTaskOverdue(t, d);
                      const dot = overdue ? undefined : TASK_STATUS_CONFIG[t.status as TaskStatus]?.dot;
                      const rangeInfo = getRangeInfo(t, d);
                      if (rangeInfo) {
                        return (
                          <div
                            key={t.id}
                            className={cn(
                              "text-[9px] py-0.5 leading-tight cursor-default h-4 flex items-center",
                              clientCalendarColor(t.clientId), t.status === "done" && "line-through opacity-60", overdue && "underline decoration-red-500", t.status === "blocked" && "border-dashed border",
                              rangeInfo.roundLeft ? "rounded-l pl-1" : "-ml-1.5 pl-0",
                              rangeInfo.roundRight ? "rounded-r pr-1" : "-mr-1.5 pr-0",
                            )}
                            title={[t.title, t.clientName, t.projectName, t.status === "blocked" ? "Bloqueada" : ""].filter(Boolean).join(" · ")}
                          >
                            {(rangeInfo.atStart || rangeInfo.roundLeft) && (
                              <span className="truncate px-0.5">{t.title}</span>
                            )}
                          </div>
                        );
                      }
                      return (
                        <div
                          key={t.id}
                          className={cn(
                            "text-[9px] px-1 py-0.5 rounded border leading-tight cursor-default flex items-center gap-0.5",
                            clientCalendarColor(t.clientId), t.status === "done" && "line-through opacity-60", overdue && "underline decoration-red-500"
                          )}
                          title={[t.title, t.clientName, t.projectName, t.status === "blocked" ? "Bloqueada" : ""].filter(Boolean).join(" · ")}
                        >
                          {dot && (
                            <span className={cn("inline-block w-1.5 h-1.5 rounded-full flex-shrink-0", dot)} />
                          )}
                          <span className="truncate">{t.title}</span>
                        </div>
                      );
                    })}
                    {dayTasks.length > 3 && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="text-[9px] text-muted-foreground hover:text-foreground px-1 w-full text-left transition-colors">
                            +{dayTasks.length - 3} más
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-52 p-2" align="start">
                          <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
                            {format(d, "d 'de' MMMM", { locale: es })}
                          </p>
                          <div className="space-y-1">
                            {dayTasks.map(t => {
                              const overdue = isTaskOverdue(t, d);
                              const dot = overdue ? undefined : TASK_STATUS_CONFIG[t.status as TaskStatus]?.dot;
                              return (
                                <div
                                  key={t.id}
                                  className={cn(
                                    "text-[10px] px-1.5 py-1 rounded border leading-tight flex items-center gap-1",
                                    clientCalendarColor(t.clientId), t.status === "done" && "line-through opacity-60"
                                  )}
                                  title={[t.title, t.clientName, t.projectName, t.status === "blocked" ? "Bloqueada" : ""].filter(Boolean).join(" · ")}
                                >
                                  {dot && (
                                    <span className={cn("inline-block w-1.5 h-1.5 rounded-full flex-shrink-0", dot)} />
                                  )}
                                  <span className="truncate">{t.title}</span>
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
        ))}
      </div>

      {/* Tasks without a due date */}
      {showUndated && tasksWithoutDate.length > 0 && (
        <div className="mt-4 border border-border rounded-xl p-3">
          <p className="text-xs text-muted-foreground font-medium mb-2">
            Sin fecha de vencimiento ({tasksWithoutDate.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {tasksWithoutDate.map(t => {
              const dot = TASK_STATUS_CONFIG[t.status as TaskStatus]?.dot;
              return (
                <div
                  key={t.id}
                  className="text-[10px] px-2 py-0.5 rounded-full border bg-muted/50 text-muted-foreground truncate max-w-[180px] flex items-center gap-1"
                  title={[t.title, t.clientName, t.projectName, t.status === "blocked" ? "Bloqueada" : ""].filter(Boolean).join(" · ")}
                >
                  {dot && <span className={cn("inline-block w-1.5 h-1.5 rounded-full flex-shrink-0", dot)} />}
                  {t.title}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
