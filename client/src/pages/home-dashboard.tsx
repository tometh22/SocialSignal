import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/queryClient";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeading, SectionHeading } from "@/components/layout/page-heading";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/hooks/use-auth";
import { computeAlerts, THRESHOLDS, type Alert } from "@/lib/smart-alerts";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { TASK_STATUS_CONFIG, type TaskStatus } from "@/constants/task-statuses";
import TaskCalendarView from "@/components/tasks/TaskCalendarView";
import {
  Briefcase, FileText, Target, Users, ClipboardList, BarChart2,
  Plus, Gauge, CalendarCheck, LayoutDashboard, Building2,
  CheckSquare, Calendar, ArrowRight, AlertTriangle, AlertCircle,
  Info, Lightbulb, ChevronRight, Zap, Clock, ListTodo, UserX
} from "lucide-react";

interface QuickLink {
  href: string;
  title: string;
  description: string;
  icon: any;
  color: string;
  permission?: string;
}

export default function HomeDashboard() {
  const { user } = useAuth();
  const { isOperations, hasPermission } = usePermissions();

  const { data: projectCount } = useQuery<number>({
    queryKey: ["/api/active-projects/count"],
    queryFn: () => authFetch("/api/active-projects/count")
      .then(r => r.json()).then(d => d.count || 0).catch(() => 0),
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
  const { data: projectsRaw } = useQuery<any[] | { projects: any[] }>({
    queryKey: ["/api/projects/alerts-data"],
    queryFn: () => authFetch("/api/active-projects")
      .then(r => r.ok ? r.json() : []).catch(() => []),
    enabled: hasPermission('projects'),
  });

  // Compute alerts from project data - ensure we have an array
  const projectsList = Array.isArray(projectsRaw) ? projectsRaw : (projectsRaw?.projects || []);
  const projectsForAlerts = projectsList.map((p: any) => ({
    projectId: p.projectId || p.id,
    projectName: p.projectName || p.name || 'Sin nombre',
    clientName: p.clientName || '',
    revenue: p.metrics?.revenueDisplay || p.metrics?.revenue || 0,
    cost: p.metrics?.costDisplay || p.metrics?.cost || 0,
    markup: p.metrics?.markup || p.metrics?.markupRatio || 0,
    margin: p.metrics?.margin || 0,
    budget: p.metrics?.budget || 0,
    budgetUsed: p.metrics?.budgetUtilization || 0,
    totalHours: p.metrics?.totalHours || 0,
    estimatedHours: p.metrics?.estimatedHours || 0,
    teamSize: p.metrics?.teamSize || 0,
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
  });
  const { data: myTodoData } = useQuery<{ tasks: any[]; personnelId: number | null }>({
    queryKey: ["/api/tasks/my-tasks", "todo"],
    queryFn: () => authFetch("/api/tasks/my-tasks?status=todo").then(r => r.json()),
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
    if (hour < 12) return "Buenos dias";
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

  const commercialLinks: QuickLink[] = [
    { href: "/optimized-quote", title: "Nueva Cotización", description: "Crear una cotización", icon: Plus, color: "bg-[#D72638]", permission: "quotations" },
    { href: "/quotations", title: "Cotizaciones", description: `${quotationStats?.pending || 0} pendientes`, icon: FileText, color: "bg-[#D72638]", permission: "quotations" },
    { href: "/crm", title: "CRM Ventas", description: "Pipeline de prospectos", icon: Target, color: "bg-[#D72638]", permission: "crm" },
    { href: "/clients", title: "Clientes", description: "Base de clientes", icon: Building2, color: "bg-[#D72638]", permission: "crm" },
  ];

  const projectLinks: QuickLink[] = [
    { href: "/active-projects", title: "Rentabilidad", description: `${projectCount || 0} proyectos activos`, icon: Briefcase, color: "bg-slate-600", permission: "projects" },
    { href: "/review", title: "Review", description: "Salas colaborativas de seguimiento semanal", icon: ClipboardList, color: "bg-slate-600", permission: "status" },
    { href: "/tasks", title: "Tareas", description: "Gestión de tareas", icon: CheckSquare, color: "bg-slate-600", permission: "projects" },
    { href: "/tasks/hours-dashboard", title: "Panel de Horas", description: "Horas por persona", icon: BarChart2, color: "bg-slate-600", permission: "projects" },
  ];

  const operationsLinks: QuickLink[] = [
    { href: "/operations/capacity", title: "Capacidad Semanal", description: "Capacidad por persona", icon: Gauge, color: "bg-indigo-600" },
    { href: "/operations/monthly-closing", title: "Cierre Mensual", description: "Reconciliación de horas", icon: CalendarCheck, color: "bg-indigo-600" },
    { href: "/operations/holidays", title: "Feriados", description: "Gestión de feriados", icon: Calendar, color: "bg-indigo-600" },
    { href: "/operations/absences", title: "Ausencias", description: "Vacaciones y licencias", icon: UserX, color: "bg-indigo-600" },
  ];

  const renderLinkCard = (link: QuickLink) => (
    <Link key={link.href} href={link.href}>
      <Card className="mind-interactive-card group h-full cursor-pointer overflow-hidden">
        <CardContent className="flex items-center gap-3.5 p-4">
          <div className={`${link.color} grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl text-white shadow-lg shadow-slate-900/10 transition-transform duration-200 group-hover:scale-105`}>
            <link.icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold tracking-[-0.01em] text-foreground transition-colors group-hover:text-primary">{link.title}</div>
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{link.description}</div>
          </div>
          <ArrowRight className="h-4 w-4 flex-shrink-0 -translate-x-1 text-primary opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
        </CardContent>
      </Card>
    </Link>
  );

  const renderSection = (title: string, links: QuickLink[]) => {
    const filtered = links.filter(l => !l.permission || hasPermission(l.permission as any));
    if (filtered.length === 0) return null;
    return (
      <section key={title} className="space-y-3">
        <SectionHeading title={title} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {filtered.map(renderLinkCard)}
        </div>
      </section>
    );
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-8">
      <PageHeading
        eyebrow="Workspace personal"
        title={<>{greeting()}, {user?.firstName || "Usuario"}.</>}
        description="Tu operación, proyectos y prioridades en un solo lugar. Empezá por lo que necesita atención hoy."
        actions={
          <>
            {hasPermission("projects") && (
              <Button asChild variant="outline">
                <Link href="/tasks"><CheckSquare className="h-4 w-4" />Mis tareas</Link>
              </Button>
            )}
            {hasPermission("quotations") && (
              <Button asChild>
                <Link href="/optimized-quote"><Plus className="h-4 w-4" />Nueva cotización</Link>
              </Button>
            )}
          </>
        }
        aside={
          summary.critical > 0 ? (
            <div className="flex h-full min-w-44 flex-col justify-center rounded-2xl border border-red-100 bg-red-50/70 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-red-700">
                <AlertTriangle className="h-4 w-4" />Atención requerida
              </div>
              <p className="mt-2 text-3xl font-bold tracking-[-0.05em] text-red-700">{summary.critical}</p>
              <p className="text-[11px] text-red-600/80">alertas críticas activas</p>
            </div>
          ) : (
            <div className="flex h-full min-w-44 flex-col justify-center rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                <Zap className="h-4 w-4" />Portfolio saludable
              </div>
              <p className="mt-2 text-sm font-semibold text-emerald-900">Sin alertas críticas</p>
              <p className="mt-1 text-[11px] text-emerald-700/70">Todo bajo control</p>
            </div>
          )
        }
      />

      {/* Smart Alerts */}
      {alerts.length > 0 && hasPermission('projects') && (
        <div className="space-y-3">
          <SectionHeading
            icon={<Zap className="h-4 w-4" />}
            title="Alertas inteligentes"
            description="Señales que conviene revisar antes de que se conviertan en desvíos."
            action={<Badge variant="secondary" className="text-xs">
              {summary.critical > 0 && <span className="text-red-600 mr-1">{summary.critical} criticas</span>}
              {summary.warning > 0 && <span className="text-amber-600">{summary.warning} warnings</span>}
            </Badge>}
          />
          <div className="grid gap-2 lg:grid-cols-2">
            {alerts.slice(0, 5).map(alert => (
              <div key={alert.id} className={`mind-interactive-card flex items-start gap-3 rounded-xl border p-3.5 ${alertBg(alert.type)}`}>
                {alertIcon(alert.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
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
                  <Link href={`/active-projects/${alert.projectId}`}>
                    <ChevronRight className="h-4 w-4 text-muted-foreground hover:text-primary cursor-pointer flex-shrink-0" />
                  </Link>
                )}
              </div>
            ))}
            {alerts.length > 5 && (
              <p className="text-xs text-muted-foreground text-center">
                +{alerts.length - 5} alertas más
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
              <span className="text-sm font-semibold text-indigo-900">Insights del Portfolio</span>
            </div>
            <ul className="space-y-1.5">
              {insights.map((insight, i) => (
                <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                  <span className="text-indigo-400 mt-1">·</span>
                  {insight}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {hasPermission('projects') && (
          <Card className="mind-kpi">
            <CardContent className="p-4 sm:p-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Proyectos activos</div>
              <div className="mt-2 text-3xl font-bold tracking-[-0.05em] tabular-nums text-primary">{projectCount || 0}</div>
            </CardContent>
          </Card>
        )}
        {hasPermission('quotations') && (
          <Card className="mind-kpi">
            <CardContent className="p-4 sm:p-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Cotizaciones pendientes</div>
              <div className="mt-2 text-3xl font-bold tracking-[-0.05em] tabular-nums text-amber-600">{quotationStats?.pending || 0}</div>
            </CardContent>
          </Card>
        )}
        {hasPermission('quotations') && (
          <Card className="mind-kpi">
            <CardContent className="p-4 sm:p-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Borradores</div>
              <div className="mt-2 text-3xl font-bold tracking-[-0.05em] tabular-nums text-slate-700">{quotationStats?.draft || 0}</div>
            </CardContent>
          </Card>
        )}
        {hasPermission('projects') && (
          <Card className="mind-kpi">
            <CardContent className="p-4 sm:p-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Alertas críticas</div>
              <div className="mt-2 text-3xl font-bold tracking-[-0.05em] tabular-nums">
                {summary.critical > 0 ? (
                  <span className="text-red-600">{summary.critical}</span>
                ) : (
                  <span className="text-emerald-600">0</span>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

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

      {/* Sections */}
      {renderSection("Comercial", commercialLinks)}
      {renderSection("Proyectos", projectLinks)}
      {isOperations && renderSection("Operaciones", operationsLinks)}
      {renderSection("Dashboard y Admin", [
        { href: "/dashboard", title: "Dashboard Ejecutivo", description: "KPIs financieros", icon: LayoutDashboard, color: "bg-slate-600", permission: "dashboard" },
        { href: "/admin/users", title: "Usuarios", description: "Usuarios y permisos", icon: Users, color: "bg-slate-500", permission: "admin" },
      ])}
    </div>
  );
}
