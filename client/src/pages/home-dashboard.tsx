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
import { parseBirthdayMonthDay, nextBirthday, upcomingBirthdays, type BirthdayEntry } from "@shared/utils/birthdays";
import { useAuth } from "@/hooks/use-auth";
import { computeAlerts, type Alert } from "@/lib/smart-alerts";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { taskDateBucket, taskCompletedThisWeek, type TaskDateBucket } from "@shared/utils/task-date-bucket";
import { TASK_STATUS_CONFIG, type TaskStatus } from "@/constants/task-statuses";
import TaskCalendarView from "@/components/tasks/TaskCalendarView";
import {
  Briefcase, BarChart2, Plus, CheckSquare, Calendar, AlertTriangle,
  AlertCircle, Info, Lightbulb, ChevronRight, Zap, Clock, ListTodo,
  FolderOpen, List, ChevronDown
} from "lucide-react";

type HomeProject = {
  id: number;
  name: string;
  clientName: string | null;
  pendingCount: number;
  taskCount: number;
  status: string;
};

export default function HomeDashboard() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const canAccessTasks = hasPermission("projects") || hasPermission("operations") || hasPermission("task_manager");
  const canCreateQuotation = hasPermission("quotations");

  const { data: projectCount } = useQuery<number>({
    queryKey: ["/api/tasks/projects", "home-count"],
    queryFn: () => authFetch("/api/tasks/projects?status=active&scope=mine")
      .then(r => r.json()).then((projects: any[]) => Array.isArray(projects) ? projects.length : 0).catch(() => 0),
    enabled: canAccessTasks,
  });

  const { data: personnel = [] } = useQuery<any[]>({
    queryKey: ["/api/personnel", "birthday"],
    queryFn: () => authFetch("/api/personnel").then(r => r.ok ? r.json() : []),
  });
  const myPersonnel = personnel.find((person) => person.id === (user as any)?.personnelId)
    ?? personnel.find((person) => person.email?.trim().toLowerCase() === user?.email?.trim().toLowerCase());
  const myBirthdayParts = parseBirthdayMonthDay(myPersonnel?.birthday);
  const birthday = myBirthdayParts ? (() => {
    const { date, daysUntil } = nextBirthday(myBirthdayParts, new Date());
    return { date: date.toLocaleDateString("es-AR", { day: "numeric", month: "long" }), days: daysUntil };
  })() : null;

  const { data: teamBirthdays = [] } = useQuery<BirthdayEntry[]>({
    queryKey: ["/api/birthdays"],
    queryFn: () => authFetch("/api/birthdays").then(r => r.ok ? r.json() : []).catch(() => []),
    staleTime: 5 * 60_000,
  });
  const upcoming = upcomingBirthdays(teamBirthdays, new Date(), 30).slice(0, 6);

  const { data: absenceBalance } = useQuery<{ configured: boolean; vacationDays: number | null; vacationCarryoverDays: number; vacationAdvanceDebtDays: number; vacationBalanceDays: number; epicalDays: number | null; used: { vacation: number; epical: number } }>({
    queryKey: ["/api/absence-allowances", myPersonnel?.id, new Date().getFullYear()],
    queryFn: async () => {
      const response = await authFetch(`/api/absence-allowances/${myPersonnel.id}/${new Date().getFullYear()}`);
      if (!response.ok) throw new Error("No se pudo cargar el saldo de vacaciones");
      return response.json();
    },
    enabled: Boolean(myPersonnel),
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
    markup: typeof p.markup === 'number' && Number.isFinite(p.markup) ? p.markup : null,
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
  const { data: personalHours } = useQuery<{ personnelId: number | null; weekHours: number; monthHours: number }>({
    queryKey: ["/api/tasks/my-hours"],
    queryFn: () => authFetch("/api/tasks/my-hours").then(r => { if (!r.ok) throw new Error("No se pudieron consultar tus horas"); return r.json(); }),
    enabled: canAccessTasks,
  });
  const myPersonnelId = personalHours?.personnelId;
  const myWeekHours = personalHours?.weekHours ?? 0;
  const myMonthHours = personalHours?.monthHours ?? 0;
  // Enriched tasks (with project/client names) for the member's active projects + calendar
  const { data: myCalendarTasks = [] } = useQuery<any[]>({
    queryKey: ["/api/tasks/team-calendar", "me", myPersonnelId],
    queryFn: async () => {
      const response = await authFetch(`/api/tasks/team-calendar?assigneeId=${myPersonnelId}`);
      if (!response.ok) return [];
      const payload = await response.json();
      return Array.isArray(payload) ? payload : [];
    },
    enabled: !!myPersonnelId,
  });

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
      {upcoming.length > 0 && (
        <Card className="border-pink-200 bg-pink-50/60" data-testid="home-team-birthdays">
          <CardContent className="p-4 text-sm text-pink-950 sm:p-4 sm:pt-4">
            <div className="mb-2 flex items-center gap-2 font-semibold"><span aria-hidden="true">🎂</span>Cumpleaños del equipo</div>
            <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((entry, index) => (
                <li key={`${entry.name}-${entry.month}-${entry.day}-${index}`} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate">{entry.name}</span>
                  <span className="shrink-0 text-xs text-pink-900/80">
                    {entry.daysUntil === 0 ? "¡hoy!" : entry.daysUntil === 1 ? "mañana" : entry.date.toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Dos tarjetas comparten fila; una sola ocupa todo el ancho, como el resto de las tarjetas del Home
          (con media fila quedaba desalineada respecto de los indicadores y de Señales del portfolio). */}
      {(birthday || absenceBalance?.configured) && (
        <div className={cn("grid gap-3", birthday && absenceBalance?.configured && "lg:grid-cols-2")} data-testid="home-personal-cards">
          {birthday && <Card className="border-pink-200 bg-pink-50/60"><CardContent className="flex items-center gap-3 p-4 text-sm text-pink-950 sm:p-4 sm:pt-4"><span aria-hidden="true">🎂</span><span><strong>Tu cumpleaños:</strong> {birthday.date}{birthday.days === 0 ? " · ¡hoy!" : birthday.days === 1 ? " · mañana" : ` · en ${birthday.days} días`}</span></CardContent></Card>}
          {absenceBalance?.configured && <Card><CardContent className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 p-4 text-sm sm:p-4 sm:pt-4">
            <div className="min-w-0 flex-1 space-y-1">
              <div><strong>Vacaciones disponibles: {absenceBalance.vacationBalanceDays} días</strong></div>
              <div className="text-xs leading-5 text-muted-foreground">Año actual: {absenceBalance.vacationDays ?? 0} · Traslado: {absenceBalance.vacationCarryoverDays} · Adelanto anterior: {absenceBalance.vacationAdvanceDebtDays} · Usados: {absenceBalance.used.vacation}</div>
              {absenceBalance.epicalDays != null && <div data-testid="home-epical-balance"><strong>Días Epical disponibles: {Math.max(0, absenceBalance.epicalDays - absenceBalance.used.epical)} días</strong><span className="ml-2 text-xs text-muted-foreground">Cupo: {absenceBalance.epicalDays} · Usados: {absenceBalance.used.epical}</span></div>}
            </div>
            <Link href="/absences" className="shrink-0 text-primary hover:underline">Mis ausencias</Link>
          </CardContent></Card>}
        </div>
      )}

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
                    href={`/tasks/projects/${alert.projectId}`}
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
          <CardContent className="p-4 sm:p-4 sm:pt-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-indigo-100">
                <Lightbulb className="h-4 w-4 text-indigo-600" />
              </div>
              <span className="text-sm font-semibold text-indigo-900">Señales del portfolio</span>
            </div>
            <ul className="space-y-1.5">
              {insights.slice(0, 3).map((insight, i) => (
                <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                  <span className="shrink-0 text-indigo-400" aria-hidden="true">•</span>
                  <span className="min-w-0 flex-1 leading-5">{insight}</span>
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
      {canAccessTasks && user?.personnelLinked === false && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
            <div>
              <p className="font-medium">Tu usuario todavía no está vinculado a Personal.</p>
              <p className="mt-0.5 text-xs text-amber-800">Pedile a Operaciones que configure el mismo email en Personal para ver tareas y cargar horas.</p>
            </div>
          </div>
        </div>
      )}
      {myPersonnelId && (
        <div className="space-y-3">
          <SectionHeading icon={<ListTodo className="h-4 w-4" />} title="Mi semana" description="Horas y calendario de la semana actual." />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          </div>
          {/* Calendario de mis tareas */}
          <div className="bg-card rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-medium text-foreground">Mi calendario</span>
              <Link href="/tasks" className="ml-auto text-xs text-primary hover:underline">Ir a Tareas</Link>
            </div>
            <TaskCalendarView tasks={myCalendarTasks} view="current-week" showUndated={false} />
          </div>
        </div>
      )}
    </PageShell>
  );
}
