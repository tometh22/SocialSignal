import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/queryClient";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/layout/page-heading";
import { CompactPageHeader } from "@/components/ui/compact-page-header";
import { PageShell } from "@/components/ui/page-shell";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/hooks/use-auth";
import { computeAlerts, type Alert } from "@/lib/smart-alerts";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { TASK_STATUS_CONFIG, type TaskStatus } from "@/constants/task-statuses";
import TaskCalendarView from "@/components/tasks/TaskCalendarView";
import {
  Briefcase, BarChart2, Plus, CheckSquare, Calendar, AlertTriangle,
  AlertCircle, Info, Lightbulb, ChevronRight, Zap, Clock, ListTodo
} from "lucide-react";

export default function HomeDashboard() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const canAccessTasks = hasPermission("projects");
  const canCreateQuotation = hasPermission("quotations");

  const { data: projectCount } = useQuery<number>({
    queryKey: ["/api/active-projects/count"],
    queryFn: () => authFetch("/api/active-projects/count")
      .then(r => r.json()).then(d => d.count || 0).catch(() => 0),
    enabled: canAccessTasks,
  });

  const { data: quotationStats } = useQuery<{ total: number; pending: number; draft: number }>({
    queryKey: ["/api/quotations/stats"],
    queryFn: () => authFetch("/api/quotations")
      .then(r => r.json()).then((qs: any[]) => ({
        total: qs?.length || 0,
        pending: qs?.filter((q: any) => q.status === 'pending').length || 0,
        draft: qs?.filter((q: any) => q.status === 'draft').length || 0,
      })).catch(() => ({ total: 0, pending: 0, draft: 0 })),
    enabled: hasPermission('quotations'),
  });

  // Fetch projects for smart alerts
  const { data: projectsRaw } = useQuery<{ projects: any[] }>({
    queryKey: ["/api/projects/alerts-summary"],
    queryFn: () => authFetch("/api/projects/alerts-summary")
      .then(r => r.ok ? r.json() : { projects: [] }).catch(() => ({ projects: [] })),
    enabled: hasPermission('projects'),
  });

  const projectsList = projectsRaw?.projects || [];
  const projectsForAlerts = projectsList.map((p: any) => ({
    projectId: p.projectId || p.id,
    projectName: p.projectName || p.name || 'Sin nombre',
    clientName: p.clientName || '',
    revenue: p.revenue || 0,
    cost: p.cost || 0,
    markup: p.markup || 0,
    margin: p.margin || 0,
    budget: p.budget || 0,
    budgetUsed: p.budgetUsed || 0,
    totalHours: p.totalHours || 0,
    estimatedHours: p.estimatedHours || 0,
    teamSize: p.teamSize || 0,
    status: p.status || 'active',
  }));

  const { alerts, insights, summary } = computeAlerts(projectsForAlerts);

  // Personal data for "Mi semana"
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const { data: myTasksData } = useQuery<{ tasks: any[]; personnelId: number | null }>({
    queryKey: ["/api/tasks/my-tasks", "active"],
    queryFn: () => authFetch("/api/tasks/my-tasks?status=in_progress").then(r => r.json()),
    enabled: canAccessTasks,
  });
  const { data: myTodoData } = useQuery<{ tasks: any[]; personnelId: number | null }>({
    queryKey: ["/api/tasks/my-tasks", "todo"],
    queryFn: () => authFetch("/api/tasks/my-tasks?status=todo").then(r => r.json()),
    enabled: canAccessTasks,
  });

  const myPersonnelId = myTasksData?.personnelId;

  const weekParams = new URLSearchParams({
    dateFrom: weekStart.toISOString(), dateTo: weekEnd.toISOString(),
    ...(myPersonnelId ? { personnelId: String(myPersonnelId) } : {}),
  });
  const monthParams = new URLSearchParams({
    dateFrom: monthStart.toISOString(), dateTo: monthEnd.toISOString(),
    ...(myPersonnelId ? { personnelId: String(myPersonnelId) } : {}),
  });

  const { data: weekHours } = useQuery<{ byPerson: { hours: number }[] }>({
    queryKey: ["/api/tasks/hours-summary", "week", myPersonnelId],
    queryFn: () => authFetch(`/api/tasks/hours-summary?${weekParams}`).then(r => r.json()),
    enabled: !!myPersonnelId,
  });
  const { data: monthHours } = useQuery<{ byPerson: { hours: number }[] }>({
    queryKey: ["/api/tasks/hours-summary", "month", myPersonnelId],
    queryFn: () => authFetch(`/api/tasks/hours-summary?${monthParams}`).then(r => r.json()),
    enabled: !!myPersonnelId,
  });

  const myWeekHours = weekHours?.byPerson?.reduce((s, p) => s + p.hours, 0) ?? 0;
  const myMonthHours = monthHours?.byPerson?.reduce((s, p) => s + p.hours, 0) ?? 0;

  // Enriched tasks (with project/client names) for the member's active projects + calendar
  const { data: myCalendarTasks = [] } = useQuery<any[]>({
    queryKey: ["/api/tasks/team-calendar", "me", myPersonnelId],
    queryFn: () => authFetch(`/api/tasks/team-calendar?assigneeId=${myPersonnelId}`).then(r => r.json()),
    enabled: !!myPersonnelId,
  });

  // Distinct active projects from the member's non-done tasks
  const myActiveProjects = (() => {
    const map = new Map<string, { name: string; clientName: string | null; pending: number }>();
    for (const t of myCalendarTasks) {
      if (t.status === "done" || t.parentTaskId) continue;
      const name = t.projectName || "Sin proyecto";
      const key = `${t.projectId}:${name}`;
      const entry = map.get(key) || { name, clientName: t.clientName ?? null, pending: 0 };
      entry.pending += 1;
      map.set(key, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.pending - a.pending);
  })();

  const myActiveTasks = (myTasksData?.tasks || []).filter(t => !t.parentTaskId);
  const myTodoTasks = (myTodoData?.tasks || []).filter(t => !t.parentTaskId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const myOverdueTasks = [...myActiveTasks, ...myTodoTasks].filter(t =>
    t.dueDate && new Date(t.dueDate.slice(0, 10) + 'T00:00:00') < today
  );
  const myPendingTasks = [...myActiveTasks, ...myTodoTasks].filter(t =>
    !t.dueDate || new Date(t.dueDate.slice(0, 10) + 'T00:00:00') >= today
  );

  const [taskTab, setTaskTab] = useState<'active' | 'overdue'>('active');
  const [showAllMyTasks, setShowAllMyTasks] = useState(false);
  const tabTasks = taskTab === 'overdue' ? myOverdueTasks : myPendingTasks;
  const displayedMyTasks = showAllMyTasks ? tabTasks : tabTasks.slice(0, 5);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 18) return "Buenas tardes";
    return "Buenas noches";
  };

  const alertIcon = (type: Alert['type']) => {
    if (type === 'critical') return <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />;
    if (type === 'warning') return <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />;
    return <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />;
  };

  const alertBg = (type: Alert['type']) => {
    if (type === 'critical') return "border-red-200 bg-red-50/50";
    if (type === 'warning') return "border-amber-200 bg-amber-50/50";
    return "border-blue-200 bg-blue-50/50";
  };

  return (
    <PageShell spacing="compact">
      <CompactPageHeader
        eyebrow="Workspace personal"
        title={<>{greeting()}, {user?.firstName || "Usuario"}.</>}
        description="Tus prioridades, tareas y señales importantes para avanzar hoy."
        actions={(canAccessTasks || canCreateQuotation) ? (
          <>
            {canAccessTasks && (
              <Button asChild>
                <Link href="/tasks"><CheckSquare className="h-4 w-4" />Ver mis tareas</Link>
              </Button>
            )}
            {canCreateQuotation && canAccessTasks && (
              <Button asChild variant="outline">
                <Link href="/optimized-quote"><Plus className="h-4 w-4" />Nueva cotización</Link>
              </Button>
            )}
            {canCreateQuotation && !canAccessTasks && (
              <Button asChild>
                <Link href="/optimized-quote"><Plus className="h-4 w-4" />Nueva cotización</Link>
              </Button>
            )}
          </>
        ) : undefined}
      />

      {/* Resumen operativo */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {hasPermission('projects') && (
          <Card className="mind-kpi">
            <CardContent className="p-3.5 sm:p-4">
              <div className="min-h-8 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Proyectos activos</div>
              <div className="mt-1 text-2xl font-bold tracking-[-0.05em] tabular-nums text-primary sm:text-3xl">{projectCount || 0}</div>
            </CardContent>
          </Card>
        )}
        {hasPermission('quotations') && (
          <Card className="mind-kpi">
            <CardContent className="p-3.5 sm:p-4">
              <div className="min-h-8 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Cotizaciones pendientes</div>
              <div className="mt-1 text-2xl font-bold tracking-[-0.05em] tabular-nums text-amber-600 sm:text-3xl">{quotationStats?.pending || 0}</div>
            </CardContent>
          </Card>
        )}
        {hasPermission('quotations') && (
          <Card className="mind-kpi">
            <CardContent className="p-3.5 sm:p-4">
              <div className="min-h-8 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Borradores</div>
              <div className="mt-1 text-2xl font-bold tracking-[-0.05em] tabular-nums text-slate-700 sm:text-3xl">{quotationStats?.draft || 0}</div>
            </CardContent>
          </Card>
        )}
        {hasPermission('projects') && (
          <Card className="mind-kpi">
            <CardContent className="p-3.5 sm:p-4">
              <div className="min-h-8 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Alertas críticas</div>
              <div className="mt-1 text-2xl font-bold tracking-[-0.05em] tabular-nums sm:text-3xl">
                <span className={summary.critical > 0 ? "text-red-600" : "text-emerald-600"}>
                  {summary.critical}
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Smart Alerts */}
      {alerts.length > 0 && hasPermission('projects') && (
        <div className="space-y-3">
          <SectionHeading
            icon={<Zap className="h-4 w-4" />}
            title="Alertas inteligentes"
            description="Señales que conviene revisar antes de que se conviertan en desvíos."
            action={<Badge variant="secondary" className="text-xs">
              {summary.critical > 0 && <span className="mr-1 text-red-600">{summary.critical} críticas</span>}
              {summary.warning > 0 && <span className="text-amber-600">{summary.warning} preventivas</span>}
            </Badge>}
          />
          <div className="grid gap-2 xl:grid-cols-2">
            {alerts.slice(0, 4).map(alert => (
              <div key={alert.id} className={`mind-interactive-card flex items-start gap-3 rounded-xl border p-3.5 ${alertBg(alert.type)}`}>
                {alertIcon(alert.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-sm font-medium">{alert.title}</span>
                    {alert.clientName && (
                      <span className="text-xs text-muted-foreground">· {alert.clientName}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
                  {alert.action && (
                    <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                      <Lightbulb className="h-3 w-3" /> {alert.action}
                    </p>
                  )}
                </div>
                {alert.projectId && (
                  <Link
                    href={`/active-projects/${alert.projectId}`}
                    aria-label={`Abrir proyecto ${alert.projectName}`}
                    className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-white/70 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    <ChevronRight className="h-4 w-4 text-muted-foreground hover:text-primary cursor-pointer flex-shrink-0" />
                  </Link>
                )}
              </div>
            ))}
            {alerts.length > 4 && (
              <p className="mx-auto text-center text-xs text-muted-foreground xl:col-span-2">
                +{alerts.length - 4} alertas más
              </p>
            )}
          </div>
        </div>
      )}

      {/* AI Insights */}
      {projectsForAlerts.length > 0 && insights.length > 0 && hasPermission('projects') && (
        <Card className="border-indigo-100 bg-gradient-to-r from-indigo-50/30 to-purple-50/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-indigo-100">
                <Lightbulb className="h-4 w-4 text-indigo-600" />
              </div>
              <span className="text-sm font-semibold text-indigo-900">Señales del portfolio</span>
            </div>
            <ul className="space-y-1.5">
              {insights.slice(0, 3).map((insight, i) => (
                <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                  <span className="text-indigo-400 mt-1">·</span>
                  {insight}
                </li>
              ))}
            </ul>
            {insights.length > 3 && (
              <p className="mt-2 text-xs font-medium text-indigo-700/70">
                +{insights.length - 3} señales adicionales
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Mi semana */}
      {myPersonnelId && (
        <div className="space-y-3">
          <SectionHeading icon={<ListTodo className="h-4 w-4" />} title="Mi semana" description="Horas, foco y entregas de tu agenda actual." />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-card rounded-xl border p-4 flex items-center gap-3">
              <div className="bg-primary/10 p-2.5 rounded-lg">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Horas esta semana</p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">{myWeekHours.toFixed(1)}h</p>
              </div>
            </div>
            <div className="bg-card rounded-xl border p-4 flex items-center gap-3">
              <div className="bg-slate-500/10 p-2.5 rounded-lg">
                <BarChart2 className="h-5 w-5 text-slate-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Horas este mes</p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">{myMonthHours.toFixed(1)}h</p>
              </div>
            </div>
            <div className="bg-card rounded-xl border p-4 flex items-center gap-3">
              <div className="bg-indigo-500/10 p-2.5 rounded-lg">
                <CheckSquare className="h-5 w-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tareas en curso</p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">{myActiveTasks.length}</p>
              </div>
            </div>
          </div>
          {(myPendingTasks.length > 0 || myOverdueTasks.length > 0) && (
            <div className="bg-card rounded-xl border overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/20 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setTaskTab('active'); setShowAllMyTasks(false); }}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-md font-medium transition-colors",
                      taskTab === 'active' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Activas {myPendingTasks.length > 0 && <span className="ml-1 opacity-70">({myPendingTasks.length})</span>}
                  </button>
                  <button
                    onClick={() => { setTaskTab('overdue'); setShowAllMyTasks(false); }}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-md font-medium transition-colors",
                      taskTab === 'overdue' ? "bg-red-600 text-white" : "text-muted-foreground hover:text-foreground",
                      myOverdueTasks.length > 0 && taskTab !== 'overdue' && "text-red-600"
                    )}
                  >
                    Vencidas {myOverdueTasks.length > 0 && <span className="ml-1 opacity-80">({myOverdueTasks.length})</span>}
                  </button>
                </div>
                <Link href="/tasks">
                  <span className="text-xs text-primary hover:underline cursor-pointer flex items-center gap-0.5">
                    Ver todas <ChevronRight className="h-3 w-3" />
                  </span>
                </Link>
              </div>
              {displayedMyTasks.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                  {taskTab === 'overdue' ? "Sin tareas vencidas" : "Sin tareas activas"}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {displayedMyTasks.map((t: any) => {
                    const cfg = TASK_STATUS_CONFIG[t.status as TaskStatus];
                    const isOverdue = t.dueDate && new Date(t.dueDate.slice(0, 10) + 'T00:00:00') < today && t.status !== 'done';
                    return (
                      <div key={t.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-accent/20 transition-colors">
                        <span className={cn("w-2 h-2 rounded-full flex-shrink-0", cfg?.dot || "bg-gray-400")} />
                        <span className="flex-1 text-sm text-foreground truncate">{t.title}</span>
                        {t.estimatedHours > 0 && (
                          <span className="text-xs text-muted-foreground flex-shrink-0">{t.estimatedHours}h est.</span>
                        )}
                        {t.dueDate && (
                          <span className={cn("text-xs flex-shrink-0", isOverdue ? "text-red-600 font-medium" : "text-muted-foreground")}>
                            {format(new Date(t.dueDate.slice(0, 10) + 'T00:00:00'), "d MMM", { locale: es })}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {tabTasks.length > 5 && (
                <div className="px-4 py-2 border-t bg-muted/10">
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={() => setShowAllMyTasks(v => !v)}
                  >
                    {showAllMyTasks ? "Ver menos" : `+${tabTasks.length - 5} más`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Proyectos activos del miembro */}
          {myActiveProjects.length > 0 && (
            <div className="bg-card rounded-xl border overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/20 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-medium text-foreground">Proyectos activos</span>
                <span className="text-xs text-muted-foreground">({myActiveProjects.length})</span>
              </div>
              <div className="divide-y divide-border">
                {myActiveProjects.map((p, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center gap-3 hover:bg-accent/20 transition-colors">
                    <span className="flex-1 text-sm text-foreground truncate">
                      {p.clientName ? <span className="text-muted-foreground">{p.clientName} · </span> : null}
                      {p.name}
                    </span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{p.pending} pendiente{p.pending !== 1 ? "s" : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Calendario de mis tareas */}
          <div className="bg-card rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-medium text-foreground">Mi calendario</span>
            </div>
            <TaskCalendarView tasks={myCalendarTasks} />
          </div>
        </div>
      )}
    </PageShell>
  );
}
