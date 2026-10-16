import OptionalDelegatedTasks from "@/components/tasks/OptionalDelegatedTasks";
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/queryClient";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/layout/page-heading";
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
  FolderOpen, List, ChevronDown, ArrowUpRight, FileText, FilePen, ShieldAlert, Sparkles
} from "lucide-react";

type HomeProject = {
  id: number;
  name: string;
  clientName: string | null;
  pendingCount: number;
  taskCount: number;
  status: string;
};

type KpiTone = "rose" | "amber" | "slate" | "emerald" | "red";

const KPI_TONES: Record<KpiTone, { chip: string; value: string; glow: string }> = {
  rose: { chip: "bg-rose-50 text-rose-600 ring-rose-100", value: "text-rose-600", glow: "from-rose-500/[0.10]" },
  amber: { chip: "bg-amber-50 text-amber-600 ring-amber-100", value: "text-amber-600", glow: "from-amber-500/[0.10]" },
  slate: { chip: "bg-slate-100 text-slate-600 ring-slate-200", value: "text-slate-700", glow: "from-slate-500/[0.08]" },
  emerald: { chip: "bg-emerald-50 text-emerald-600 ring-emerald-100", value: "text-emerald-600", glow: "from-emerald-500/[0.10]" },
  red: { chip: "bg-red-50 text-red-600 ring-red-100", value: "text-red-600", glow: "from-red-500/[0.10]" },
};

function KpiTile({ label, value, icon, tone, href }: { label: string; value: number; icon: ReactNode; tone: KpiTone; href: string }) {
  const t = KPI_TONES[tone];
  return (
    <Link
      href={href}
      className="group mind-kpi mind-interactive-card block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent to-transparent opacity-80", t.glow)} />
      <div className="relative p-3.5 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <span className={cn("grid size-9 place-items-center rounded-xl ring-1", t.chip)} aria-hidden="true">{icon}</span>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden="true" />
        </div>
        <div className={cn("mt-3 text-3xl font-bold tracking-[-0.05em] tabular-nums sm:text-4xl", t.value)}>{value}</div>
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      </div>
    </Link>
  );
}

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
  // Los próximos 3 cumpleaños, sin importar cuán lejos caigan (366 días cubre todo el ciclo anual).
  const upcoming = upcomingBirthdays(teamBirthdays, new Date(), 366).slice(0, 3);
  // El propio cumpleaños ya figura en la lista del equipo; la tarjeta personal sólo sirve de respaldo.
  const showOwnBirthday = Boolean(birthday) && upcoming.length === 0;

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

  const todayLabel = (() => {
    const label = format(new Date(), "EEEE d 'de' MMMM", { locale: es });
    return label.charAt(0).toUpperCase() + label.slice(1);
  })();

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
      <header
        data-ui="home-hero"
        aria-labelledby="home-hero-title"
        className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-[#0b0f17] text-white shadow-[0_30px_70px_-40px_rgba(15,23,42,0.75)]"
      >
        <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-rose-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 right-10 h-96 w-96 rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="pointer-events-none absolute right-1/3 top-0 h-40 w-40 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35] [mask-image:linear-gradient(to_bottom_right,black,transparent_75%)]"
          style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.22) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        />
        <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:p-10">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-white/70 backdrop-blur">
              <Sparkles className="h-3 w-3 text-rose-300" aria-hidden="true" />
              {todayLabel}
            </div>
            <h1 id="home-hero-title" className="mt-4 text-balance text-3xl font-bold leading-[1.08] tracking-[-0.04em] sm:text-4xl lg:text-5xl">
              {greeting()},{" "}
              <span className="bg-gradient-to-r from-rose-300 via-rose-400 to-fuchsia-300 bg-clip-text text-transparent">
                {user?.firstName || "Usuario"}
              </span>
              .
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/60 sm:text-base">
              Tus prioridades, tareas y señales importantes para avanzar hoy.
            </p>
            {(canAccessTasks || canCreateQuotation) && (
              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                {canAccessTasks && (
                  <Button asChild size="lg" className="rounded-xl shadow-lg shadow-rose-500/20">
                    <Link href="/tasks"><CheckSquare className="h-4 w-4" />Ver mis tareas</Link>
                  </Button>
                )}
                {canCreateQuotation && (
                  <Button
                    asChild
                    size="lg"
                    variant={canAccessTasks ? "outline" : "default"}
                    className={cn("rounded-xl", canAccessTasks && "border-white/15 bg-white/[0.06] text-white backdrop-blur hover:bg-white/[0.12] hover:text-white")}
                  >
                    <Link href="/optimized-quote"><Plus className="h-4 w-4" />Nueva cotización</Link>
                  </Button>
                )}
              </div>
            )}
          </div>
          {myPersonnelId ? (
            <div className="grid grid-cols-2 gap-3 sm:min-w-[18rem]" data-testid="home-hero-hours">
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
                <div className="flex items-center gap-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-white/50"><Clock className="h-3 w-3" aria-hidden="true" />Esta semana</div>
                <div className="mt-1.5 text-3xl font-bold tracking-[-0.04em] tabular-nums">{myWeekHours.toFixed(1)}<span className="ml-0.5 text-base font-medium text-white/50">h</span></div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
                <div className="flex items-center gap-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-white/50"><BarChart2 className="h-3 w-3" aria-hidden="true" />Este mes</div>
                <div className="mt-1.5 text-3xl font-bold tracking-[-0.04em] tabular-nums">{myMonthHours.toFixed(1)}<span className="ml-0.5 text-base font-medium text-white/50">h</span></div>
              </div>
            </div>
          ) : null}
        </div>
      </header>
      {upcoming.length > 0 && (
        <Card className="border-pink-200 bg-pink-50/60" data-testid="home-team-birthdays">
          <CardContent className="p-4 text-sm text-pink-950 sm:p-4 sm:pt-4">
            <div className="mb-2 flex items-center gap-2 font-semibold"><span aria-hidden="true">🎂</span>Cumpleaños del equipo</div>
            <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-3">
              {upcoming.map((entry, index) => (
                <li key={`${entry.name}-${entry.month}-${entry.day}-${index}`} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate">{entry.name}</span>
                  <span className="shrink-0 text-xs text-pink-900/80">
                    {entry.daysUntil === 0 ? "¡hoy!" : entry.daysUntil === 1 ? "mañana" : `${entry.date.toLocaleDateString("es-AR", { day: "numeric", month: "short" })} · en ${entry.daysUntil} días`}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Dos tarjetas comparten fila; una sola ocupa todo el ancho, como el resto de las tarjetas del Home
          (con media fila quedaba desalineada respecto de los indicadores y de Señales del portfolio). */}
      {(showOwnBirthday || absenceBalance?.configured) && (
        <div className={cn("grid gap-3", showOwnBirthday && absenceBalance?.configured && "lg:grid-cols-2")} data-testid="home-personal-cards">
          {showOwnBirthday && birthday && <Card className="border-pink-200 bg-pink-50/60"><CardContent className="flex items-center gap-3 p-4 text-sm text-pink-950 sm:p-4 sm:pt-4"><span aria-hidden="true">🎂</span><span><strong>Tu cumpleaños:</strong> {birthday.date}{birthday.days === 0 ? " · ¡hoy!" : birthday.days === 1 ? " · mañana" : ` · en ${birthday.days} días`}</span></CardContent></Card>}
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
          <KpiTile label="Proyectos activos" value={projectCount || 0} tone="rose" href="/tasks/projects" icon={<Briefcase className="h-[18px] w-[18px]" />} />
        )}
        {hasPermission('quotations') && (
          <KpiTile label="Cotizaciones pendientes" value={quotationStats?.pending || 0} tone="amber" href="/quotations" icon={<FileText className="h-[18px] w-[18px]" />} />
        )}
        {hasPermission('quotations') && (
          <KpiTile label="Borradores" value={quotationStats?.draft || 0} tone="slate" href="/quotations" icon={<FilePen className="h-[18px] w-[18px]" />} />
        )}
        {hasPermission('projects') && (
          <KpiTile label="Alertas críticas" value={summary.critical} tone={summary.critical > 0 ? "red" : "emerald"} href="/tasks/projects" icon={<ShieldAlert className="h-[18px] w-[18px]" />} />
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

      {canAccessTasks && <OptionalDelegatedTasks />}

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
