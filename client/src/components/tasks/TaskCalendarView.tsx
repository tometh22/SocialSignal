import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, isSameMonth, isSameDay, addMonths, subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface CalTask {
  id: number;
  title: string;
  dueDate?: string | null;
  startDate?: string | null;
  status: string;
  parentTaskId?: number | null;
}

interface Props {
  projectId: number;
}

const STATUS_CHIP: Record<string, string> = {
  todo:        "bg-gray-100 text-gray-700 border-gray-200",
  in_progress: "bg-blue-100 text-blue-700 border-blue-200",
  done:        "bg-green-100 text-green-700 border-green-200 line-through",
  cancelled:   "bg-red-50 text-red-400 border-red-200 line-through",
};

const WEEK_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function TaskCalendarView({ projectId }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data } = useQuery<{ tasks: CalTask[] }>({
    queryKey: ["/api/tasks/project", projectId],
    queryFn: () => authFetch(`/api/tasks/project/${projectId}`).then(r => r.json()),
    staleTime: 30_000,
  });

  // Only root tasks (no subtasks) with or without a date
  const rootTasks = (data?.tasks || []).filter(t => !t.parentTaskId);
  const tasksWithDate = rootTasks.filter(t => t.dueDate);
  const tasksWithoutDate = rootTasks.filter(t => !t.dueDate && t.status !== "cancelled" && t.status !== "done");

  // Build calendar grid weeks
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

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

  const getTasksForDay = (d: Date) =>
    tasksWithDate.filter(t => isSameDay(new Date(t.dueDate!.slice(0, 10) + "T00:00:00"), d));

  const today = new Date();

  return (
    <div className="pt-4 pb-8">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: es })}
        </h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setCurrentMonth(new Date())}>
            Hoy
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
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
                    {dayTasks.slice(0, 3).map(t => (
                      <div
                        key={t.id}
                        className={cn(
                          "text-[9px] px-1 py-0.5 rounded border truncate leading-tight cursor-default",
                          STATUS_CHIP[t.status] || "bg-gray-100 text-gray-700 border-gray-200"
                        )}
                        title={t.title}
                      >
                        {t.title}
                      </div>
                    ))}
                    {dayTasks.length > 3 && (
                      <div className="text-[9px] text-muted-foreground px-1">
                        +{dayTasks.length - 3} más
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Tasks without a due date */}
      {tasksWithoutDate.length > 0 && (
        <div className="mt-4 border border-border rounded-xl p-3">
          <p className="text-xs text-muted-foreground font-medium mb-2">
            Sin fecha de vencimiento ({tasksWithoutDate.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {tasksWithoutDate.map(t => (
              <div
                key={t.id}
                className="text-[10px] px-2 py-0.5 rounded-full border bg-muted/50 text-muted-foreground truncate max-w-[180px]"
                title={t.title}
              >
                {t.title}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
