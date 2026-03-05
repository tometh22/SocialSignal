import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/queryClient";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { type LucideIcon, Loader2, AlertCircle, CheckCircle2, Clock, ListTodo, Users, Layers, Flag, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { isAfter, parseISO, startOfDay } from "date-fns";

type Task = {
  id: number;
  title: string;
  status: string;
  priority: string;
  sectionName?: string | null;
  assigneeId?: number | null;
  dueDate?: string | null;
  estimatedHours?: number | null;
  loggedHours?: number;
  parentTaskId?: number | null;
};

type ProjectMember = { personnelId: number; name: string; role: string };

interface Props {
  projectId: number;
  members: ProjectMember[];
  projectColor: string;
}

const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgente",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-400",
  low: "bg-gray-300",
};

const STATUS_LABEL: Record<string, string> = {
  todo: "Pendiente",
  in_progress: "En progreso",
  done: "Completada",
  cancelled: "Cancelada",
};

function getInitials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function formatHours(h: number) {
  if (h === 0) return "—";
  if (h < 1) return `${Math.round(h * 60)}m`;
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: LucideIcon; label: string; value: number | string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", color || "bg-muted")}>
        <Icon className={cn("h-4 w-4", color ? "text-white" : "text-muted-foreground")} />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function ProjectOverviewPanel({ projectId, members, projectColor }: Props) {
  const { data, isLoading } = useQuery<{ tasks: Task[]; sections: Record<string, Task[]> }>({
    queryKey: ["/api/tasks/project", projectId],
    queryFn: () => authFetch(`/api/tasks/project/${projectId}`).then((r) => r.json()),
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const allTasks: Task[] = (data?.tasks || []).filter((t) => !t.parentTaskId);
  const today = startOfDay(new Date());

  const total = allTasks.length;
  const done = allTasks.filter((t) => t.status === "done").length;
  const inProgress = allTasks.filter((t) => t.status === "in_progress").length;
  const pending = allTasks.filter((t) => t.status === "todo").length;
  const overdue = allTasks.filter(
    (t) => t.status !== "done" && t.status !== "cancelled" && t.dueDate && isAfter(today, startOfDay(parseISO(t.dueDate)))
  ).length;
  const unassigned = allTasks.filter((t) => !t.assigneeId && t.status !== "done").length;
  const totalLogged = allTasks.reduce((s, t) => s + (t.loggedHours || 0), 0);
  const totalEstimated = allTasks.reduce((s, t) => s + (t.estimatedHours || 0), 0);

  const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;

  const sections = data?.sections || {};
  const sectionNames = Object.keys(sections);

  const priorityBreakdown = ["urgent", "high", "medium", "low"].map((p) => ({
    key: p,
    label: PRIORITY_LABEL[p],
    count: allTasks.filter((t) => t.priority === p).length,
    color: PRIORITY_COLOR[p],
  }));
  const maxPriority = Math.max(...priorityBreakdown.map((p) => p.count), 1);

  const memberStats = members.map((m) => {
    const mTasks = allTasks.filter((t) => t.assigneeId === m.personnelId);
    const mDone = mTasks.filter((t) => t.status === "done").length;
    const mPending = mTasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length;
    const mLogged = mTasks.reduce((s, t) => s + (t.loggedHours || 0), 0);
    const mEstimated = mTasks.reduce((s, t) => s + (t.estimatedHours || 0), 0);
    return { ...m, total: mTasks.length, done: mDone, pending: mPending, logged: mLogged, estimated: mEstimated };
  }).sort((a, b) => b.total - a.total);

  const sectionBreakdown = sectionNames.map((name) => {
    const sTasks = (sections[name] || []).filter((t) => !t.parentTaskId);
    const sDone = sTasks.filter((t) => t.status === "done").length;
    const sLogged = sTasks.reduce((s, t) => s + (t.loggedHours || 0), 0);
    return { name, total: sTasks.length, done: sDone, logged: sLogged };
  });

  return (
    <div className="space-y-6 py-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard icon={ListTodo} label="Total tareas" value={total} />
        <StatCard icon={Clock} label="Pendientes" value={pending} color="bg-blue-500" />
        <StatCard icon={AlertCircle} label="En progreso" value={inProgress} color="bg-amber-500" />
        <StatCard icon={CheckCircle2} label="Completadas" value={done} color="bg-green-500" />
        <StatCard icon={Timer} label="Horas registradas" value={formatHours(totalLogged)} sub={totalEstimated > 0 ? `de ${formatHours(totalEstimated)} estimadas` : undefined} />
      </div>

      {/* Overdue + unassigned alerts */}
      {(overdue > 0 || unassigned > 0) && (
        <div className="flex flex-wrap gap-2">
          {overdue > 0 && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span><strong>{overdue}</strong> tarea{overdue !== 1 ? "s" : ""} vencida{overdue !== 1 ? "s" : ""}</span>
            </div>
          )}
          {unassigned > 0 && (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <Users className="h-4 w-4 flex-shrink-0" />
              <span><strong>{unassigned}</strong> tarea{unassigned !== 1 ? "s" : ""} sin asignar</span>
            </div>
          )}
        </div>
      )}

      {/* Progress + Priority row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Progress */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Progreso general</h3>
          <div className="flex items-end gap-3 mb-3">
            <span className="text-4xl font-bold text-foreground">{completionPct}%</span>
            <span className="text-sm text-muted-foreground mb-1">{done} de {total} completadas</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{ width: `${completionPct}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { label: "Pendiente", count: pending, color: "bg-blue-400/20 text-blue-700" },
              { label: "En progreso", count: inProgress, color: "bg-amber-400/20 text-amber-700" },
              { label: "Completada", count: done, color: "bg-green-400/20 text-green-700" },
            ].map((s) => (
              <div key={s.label} className={cn("rounded-lg px-2 py-2 text-center", s.color)}>
                <p className="text-lg font-bold">{s.count}</p>
                <p className="text-[10px] leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Priority breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Flag className="h-3.5 w-3.5 text-muted-foreground" />
            Por prioridad
          </h3>
          <div className="space-y-3">
            {priorityBreakdown.map((p) => (
              <div key={p.key} className="flex items-center gap-3">
                <div className={cn("w-2 h-2 rounded-full flex-shrink-0", p.color)} />
                <span className="text-xs text-muted-foreground w-14 flex-shrink-0">{p.label}</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", p.color)}
                    style={{ width: `${maxPriority > 0 ? (p.count / maxPriority) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-foreground w-5 text-right flex-shrink-0">{p.count}</span>
              </div>
            ))}
            {priorityBreakdown.every((p) => p.count === 0) && (
              <p className="text-sm text-muted-foreground italic">Sin tareas con prioridad asignada</p>
            )}
          </div>
        </div>
      </div>

      {/* Members table */}
      {memberStats.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Personas involucradas</h3>
            <span className="text-xs text-muted-foreground">({memberStats.length})</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-2.5 font-medium">Persona</th>
                  <th className="text-left px-3 py-2.5 font-medium hidden md:table-cell">Rol</th>
                  <th className="text-center px-3 py-2.5 font-medium">Total</th>
                  <th className="text-center px-3 py-2.5 font-medium">Completadas</th>
                  <th className="text-center px-3 py-2.5 font-medium">Pendientes</th>
                  <th className="text-center px-3 py-2.5 font-medium hidden sm:table-cell">Progreso</th>
                  <th className="text-right px-5 py-2.5 font-medium">Horas</th>
                </tr>
              </thead>
              <tbody>
                {memberStats.map((m, i) => {
                  const pct = m.total > 0 ? Math.round((m.done / m.total) * 100) : 0;
                  return (
                    <tr key={m.personnelId} className={cn("border-b border-border last:border-0", i % 2 === 0 ? "" : "bg-muted/20")}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-7 w-7 flex-shrink-0">
                            <AvatarFallback className={cn("text-[10px] font-bold text-white", projectColor)}>
                              {getInitials(m.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-foreground truncate">{m.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell">
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                          {m.role === "owner" ? "Responsable" : "Miembro"}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-center font-medium text-foreground">{m.total}</td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-green-600 font-medium">{m.done}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={cn("font-medium", m.pending > 0 ? "text-amber-600" : "text-muted-foreground")}>{m.pending}</span>
                      </td>
                      <td className="px-3 py-3 hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-foreground font-medium">{formatHours(m.logged)}</span>
                        {m.estimated > 0 && (
                          <span className="text-muted-foreground text-xs"> / {formatHours(m.estimated)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {memberStats.every((m) => m.total === 0) && (
                  <tr>
                    <td colSpan={7} className="px-5 py-6 text-center text-sm text-muted-foreground">
                      Sin tareas asignadas a miembros del equipo
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section breakdown */}
      {sectionBreakdown.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Por sección</h3>
          </div>
          <div className="divide-y divide-border">
            {sectionBreakdown.map((s) => {
              const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
              return (
                <div key={s.name} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                  <span className="text-sm font-medium text-foreground w-36 flex-shrink-0 truncate">{s.name}</span>
                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/60 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-20 text-right flex-shrink-0">
                      {s.done}/{s.total} tareas
                    </span>
                  </div>
                  <span className="text-xs font-medium text-foreground w-12 text-right flex-shrink-0">
                    {pct}%
                  </span>
                  {s.logged > 0 && (
                    <span className="text-xs text-muted-foreground w-14 text-right flex-shrink-0">
                      {formatHours(s.logged)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {total === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Este proyecto no tiene tareas todavía. Las métricas aparecerán aquí cuando agregues tareas.
        </div>
      )}
    </div>
  );
}
