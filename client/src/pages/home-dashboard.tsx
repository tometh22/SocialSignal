import OptionalDelegatedTasks from "@/components/tasks/OptionalDelegatedTasks";
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/queryClient";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/use-permissions";
import { parseBirthdayMonthDay, nextBirthday, upcomingBirthdays, type BirthdayEntry } from "@shared/utils/birthdays";
import { useAuth } from "@/hooks/use-auth";
import { computeAlerts, type Alert } from "@/lib/smart-alerts";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { civilDateInBuenosAires, currentBuenosAiresWeek } from "@shared/utils/buenos-aires-week";
import { taskDateBucket } from "@shared/utils/task-date-bucket";
import TaskCalendarView from "@/components/tasks/TaskCalendarView";
import {
  Plus, CheckSquare, Calendar, AlertTriangle, AlertCircle, Info, Lightbulb,
  ChevronRight, Zap, ArrowUpRight,
} from "lucide-react";

type CapacityWeekly = {
  totals?: { avgUtilization: number };
  personnel?: { isOverloaded: boolean; isAbsent: boolean }[];
};

/** Bloque del tablero: título en versalitas + contenido. Todas las tarjetas comparten este marco. */
function Tile({ label, action, className, tone = "light", children, ...rest }: {
  label: ReactNode; action?: ReactNode; className?: string; tone?: "light" | "dark" | "red"; children: ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      {...rest}
      className={cn(
        "relative flex min-w-0 flex-col overflow-hidden rounded-2xl border p-5",
        tone === "light" && "border-slate-200/80 bg-white",
        tone === "dark" && "border-transparent bg-[#14151a] text-white",
        tone === "red" && "border-transparent bg-primary text-primary-foreground",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className={cn(
          "text-[0.6875rem] font-semibold uppercase tracking-[0.12em]",
          tone === "light" && "text-slate-500", tone === "dark" && "text-slate-400", tone === "red" && "text-red-100",
        )}>{label}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const TILE_LINK = "inline-flex items-center gap-1 text-xs font-medium transition-colors";

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

  const todayCivil = civilDateInBuenosAires(new Date());
  // «Hoy»: lo vencido y lo que está en curso, primero lo más atrasado.
  const todayTasks = myCalendarTasks
    .map((task) => ({ task, bucket: taskDateBucket(task) }))
    .filter(({ bucket }) => bucket === "overdue" || bucket === "in_progress")
    .sort((a, b) => (a.task.dueDate?.slice(0, 10) ?? "9999").localeCompare(b.task.dueDate?.slice(0, 10) ?? "9999"))
    .map(({ task }) => task);
  const daysLate = (due: string) => Math.round((Date.parse(`${todayCivil}T00:00:00Z`) - Date.parse(`${due.slice(0, 10)}T00:00:00Z`)) / 86_400_000);

  // Capacidad del equipo: sólo para quien ya accede a Operaciones.
  const canSeeCapacity = hasPermission("operations");
  const { data: capacity } = useQuery<CapacityWeekly>({
    queryKey: ["/api/capacity/weekly", "home", currentBuenosAiresWeek().from],
    queryFn: () => authFetch(`/api/capacity/weekly?weekStart=${currentBuenosAiresWeek().from}`).then(r => r.ok ? r.json() : {}).catch(() => ({})),
    enabled: canSeeCapacity,
    staleTime: 5 * 60_000,
  });
  const overloadedCount = capacity?.personnel?.filter((person) => person.isOverloaded && !person.isAbsent).length ?? 0;

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
  // Día de la semana actual (0 = lunes) para marcar la tira de la tarjeta de horas.
  const weekdayIndex = (new Date(`${todayCivil}T12:00:00Z`).getUTCDay() + 6) % 7;

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

  // Qué bloques existen depende de lo que la persona puede ver: los demás no dejan hueco.
  const showToday = canAccessTasks && Boolean(myPersonnelId);
  const showHours = Boolean(myPersonnelId);
  const showQuotations = hasPermission('quotations');
  const showPortfolio = hasPermission('projects');
  const hasRightColumn = showHours || showQuotations || showPortfolio;
  const shownToday = todayTasks.slice(0, 6);
  const showOwnBirthdayCard = showOwnBirthday && birthday;
  const hasFooterTiles = upcoming.length > 0 || showOwnBirthdayCard || absenceBalance?.configured || (canSeeCapacity && capacity?.totals);

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1440px] space-y-4 sm:space-y-5" data-ui="home-board">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3" aria-labelledby="home-title">
        <div className="min-w-0">
          <h1 id="home-title" className="text-balance text-3xl font-bold leading-tight tracking-[-0.035em] text-foreground sm:text-[2rem]">
            {greeting()}, <span className="text-primary">{user?.firstName || "Usuario"}</span>
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {todayLabel}
            {showToday && ` · ${todayTasks.length === 0 ? "sin tareas pendientes para hoy" : `${todayTasks.length} ${todayTasks.length === 1 ? "tarea" : "tareas"} para hoy`}`}
          </p>
        </div>
        {(canAccessTasks || canCreateQuotation) && (
          <div className="flex flex-wrap items-center gap-2">
            {canAccessTasks && (
              <Button asChild variant={canCreateQuotation ? "outline" : "default"}>
                <Link href="/tasks"><CheckSquare className="h-4 w-4" />Ver mis tareas</Link>
              </Button>
            )}
            {canCreateQuotation && (
              <Button asChild>
                <Link href="/optimized-quote"><Plus className="h-4 w-4" />Nueva cotización</Link>
              </Button>
            )}
          </div>
        )}
      </header>

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

      {(showToday || hasRightColumn) && (
        <div className="grid gap-3 lg:grid-cols-12 sm:gap-4" data-testid="home-primary-tiles">
          {showToday && (
            <Tile
              label="Hoy"
              className={cn("lg:col-span-7", !hasRightColumn && "lg:col-span-12")}
              action={<Link href="/tasks" className={cn(TILE_LINK, "text-primary hover:underline")}>Ver todas<ChevronRight className="h-3.5 w-3.5" /></Link>}
              data-testid="home-today"
            >
              {shownToday.length === 0 ? (
                <p className="mt-6 text-sm text-muted-foreground">Nada vencido ni en curso. Buen momento para planificar la semana.</p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100">
                  {shownToday.map((task) => {
                    const due = typeof task.dueDate === "string" ? task.dueDate.slice(0, 10) : null;
                    const late = due && due < todayCivil ? daysLate(due) : 0;
                    return (
                      <li key={task.id} className="flex items-center gap-3 py-2.5">
                        <span className="h-4 w-4 shrink-0 rounded-[5px] border-[1.5px] border-slate-300" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-foreground">{task.title}</div>
                          {(task.clientName || task.projectName) && (
                            <div className="truncate text-xs text-muted-foreground">{[task.clientName, task.projectName].filter(Boolean).join(" · ")}</div>
                          )}
                        </div>
                        {late > 0 ? (
                          <span className="shrink-0 rounded-md bg-red-50 px-2 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide text-red-700">Atrasada {late}d</span>
                        ) : due === todayCivil ? (
                          <span className="shrink-0 rounded-md bg-red-50 px-2 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide text-red-700">Vence hoy</span>
                        ) : due ? (
                          <span className="shrink-0 text-xs text-muted-foreground">{format(new Date(`${due}T12:00:00`), "d MMM", { locale: es })}</span>
                        ) : (
                          <span className="shrink-0 text-xs text-muted-foreground">sin fecha</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {todayTasks.length > shownToday.length && (
                <Link href="/tasks" className="mt-2 text-xs font-medium text-muted-foreground hover:text-foreground">+{todayTasks.length - shownToday.length} más</Link>
              )}
            </Tile>
          )}

          {hasRightColumn && (
            <div className={cn("grid min-w-0 gap-3 sm:gap-4 lg:grid-cols-2", showToday ? "lg:col-span-5" : "lg:col-span-12 lg:grid-cols-4")}>
              {showHours && (
                <Tile label="Horas" tone="dark" className={cn("min-h-[9rem]", showToday ? "lg:col-span-2" : "lg:col-span-2")} data-testid="home-hours">
                  <div className="mt-3 flex items-end gap-6">
                    <div>
                      <div className="text-5xl font-bold leading-none tracking-[-0.05em] tabular-nums">{myWeekHours.toFixed(1)}<span className="ml-1 text-lg font-medium tracking-normal text-slate-400">h</span></div>
                      <div className="mt-1.5 text-xs text-slate-400">esta semana</div>
                    </div>
                    <div className="pb-0.5">
                      <div className="text-xl font-semibold tabular-nums text-slate-200">{myMonthHours.toFixed(1)}<span className="ml-0.5 text-sm font-normal text-slate-400">h</span></div>
                      <div className="mt-0.5 text-xs text-slate-400">este mes</div>
                    </div>
                  </div>
                  <div className="mt-auto flex gap-1.5 pt-5" aria-hidden="true">
                    {["L", "M", "X", "J", "V"].map((day, index) => (
                      <span key={day} className={cn("h-1 flex-1 rounded-full", index === weekdayIndex ? "bg-primary" : index < weekdayIndex ? "bg-slate-500" : "bg-slate-700")} />
                    ))}
                  </div>
                </Tile>
              )}
              {showQuotations && (
                <Link href="/quotations" className="group block min-w-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                  <Tile label="Cotizaciones" tone="red" className="h-full min-h-[9.5rem]" action={<ArrowUpRight className="h-4 w-4 text-red-100 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />}>
                    <div className="mt-3 text-5xl font-bold leading-none tracking-[-0.05em] tabular-nums">{quotationStats?.pending || 0}</div>
                    <div className="mt-1.5 text-xs text-red-100">pendientes</div>
                    <div className="mt-auto pt-4 text-xs text-red-100">{quotationStats?.draft || 0} {quotationStats?.draft === 1 ? "borrador" : "borradores"}</div>
                  </Tile>
                </Link>
              )}
              {showPortfolio && (
                <Link href="/tasks/projects" className="group block min-w-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                  <Tile label="Portfolio" className="h-full min-h-[9.5rem]" action={<ArrowUpRight className="h-4 w-4 text-slate-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />}>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-5xl font-bold leading-none tracking-[-0.05em] tabular-nums text-foreground">{projectCount || 0}</span>
                      <span className="text-xs text-muted-foreground">proyectos activos</span>
                    </div>
                    <div className={cn("mt-auto pt-4 text-xs font-semibold", summary.critical > 0 ? "text-red-600" : "text-emerald-600")}>
                      ● {summary.critical > 0 ? `${summary.critical} ${summary.critical === 1 ? "alerta crítica" : "alertas críticas"}` : "Sin alertas críticas"}
                    </div>
                  </Tile>
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* Smart Alerts */}
      {alerts.length > 0 && hasPermission('projects') && (
        <Tile
          label="Alertas inteligentes"
          action={<Badge variant="secondary" className="text-xs">
            {summary.critical > 0 && <span className="mr-1 text-red-600">{summary.critical} críticas</span>}
            {summary.warning > 0 && <span className="text-amber-600">{summary.warning} preventivas</span>}
          </Badge>}
        >
          <p className="mt-1 text-xs text-muted-foreground">Señales que conviene revisar antes de que se conviertan en desvíos.</p>
          <div className="mt-3 grid gap-2 xl:grid-cols-2">
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
        </Tile>
      )}

      {/* AI Insights */}
      {projectsForAlerts.length > 0 && insights.length > 0 && hasPermission('projects') && (
        <Tile label="Señales del portfolio">
          <ul className="mt-3 space-y-1.5">
            {insights.slice(0, 3).map((insight, i) => (
              <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                <span className="shrink-0 text-primary" aria-hidden="true">●</span>
                <span className="min-w-0 flex-1 leading-5">{insight}</span>
              </li>
            ))}
          </ul>
          {insights.length > 3 && (
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              +{insights.length - 3} señales adicionales
            </p>
          )}
        </Tile>
      )}

      {hasFooterTiles && (
        <div className="grid gap-3 sm:gap-4 [grid-template-columns:repeat(auto-fit,minmax(16rem,1fr))]" data-testid="home-personal-cards">
          {upcoming.length > 0 && (
            <Tile label="Equipo" data-testid="home-team-birthdays">
              <ul className="mt-3 space-y-2 text-sm">
                {upcoming.map((entry, index) => (
                  <li key={`${entry.name}-${entry.month}-${entry.day}-${index}`} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate"><span aria-hidden="true">🎂 </span>{entry.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {entry.daysUntil === 0 ? "¡hoy!" : entry.daysUntil === 1 ? "mañana" : `${entry.date.toLocaleDateString("es-AR", { day: "numeric", month: "short" })} · en ${entry.daysUntil} días`}
                    </span>
                  </li>
                ))}
              </ul>
            </Tile>
          )}
          {showOwnBirthdayCard && birthday && (
            <Tile label="Tu cumpleaños">
              <p className="mt-3 text-sm"><span aria-hidden="true">🎂 </span>{birthday.date}{birthday.days === 0 ? " · ¡hoy!" : birthday.days === 1 ? " · mañana" : ` · en ${birthday.days} días`}</p>
            </Tile>
          )}
          {absenceBalance?.configured && (
            <Tile label="Mis ausencias" action={<Link href="/absences" className={cn(TILE_LINK, "text-primary hover:underline")}>Ver<ChevronRight className="h-3.5 w-3.5" /></Link>}>
              <div className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between gap-3"><span>Vacaciones disponibles</span><strong className="tabular-nums">{absenceBalance.vacationBalanceDays} días</strong></div>
                {absenceBalance.epicalDays != null && (
                  <div className="flex justify-between gap-3" data-testid="home-epical-balance"><span>Días Epical disponibles</span><strong className="tabular-nums">{Math.max(0, absenceBalance.epicalDays - absenceBalance.used.epical)} días</strong></div>
                )}
              </div>
              <div className="mt-auto pt-3 text-xs leading-5 text-muted-foreground">
                Año actual: {absenceBalance.vacationDays ?? 0} · Traslado: {absenceBalance.vacationCarryoverDays} · Adelanto anterior: {absenceBalance.vacationAdvanceDebtDays} · Usados: {absenceBalance.used.vacation}
                {absenceBalance.epicalDays != null && <> · Cupo Epical: {absenceBalance.epicalDays} · Usados: {absenceBalance.used.epical}</>}
              </div>
            </Tile>
          )}
          {canSeeCapacity && capacity?.totals && (
            <Link href="/operations/capacity" className="group block min-w-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
              <Tile label="Capacidad del equipo" className="h-full" action={<ArrowUpRight className="h-4 w-4 text-slate-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />}>
                <div className="mt-3 text-4xl font-bold leading-none tracking-[-0.05em] tabular-nums">{capacity.totals.avgUtilization}%</div>
                <div className="mt-1.5 text-xs text-muted-foreground">utilización promedio esta semana</div>
                <div className={cn("mt-auto pt-3 text-xs font-semibold", overloadedCount > 0 ? "text-red-600" : "text-emerald-600")}>
                  ● {overloadedCount > 0 ? `${overloadedCount} ${overloadedCount === 1 ? "persona" : "personas"} sobre su capacidad` : "Nadie sobre su capacidad"}
                </div>
              </Tile>
            </Link>
          )}
        </div>
      )}

      {canAccessTasks && <OptionalDelegatedTasks />}

      {/* Mi semana */}
      {myPersonnelId && (
        <Tile label="Mi semana" action={<Link href="/tasks" className={cn(TILE_LINK, "text-primary hover:underline")}><Calendar className="h-3.5 w-3.5" />Ir a Tareas</Link>}>
          <p className="mt-1 text-xs text-muted-foreground">Calendario de la semana actual.</p>
          <div className="mt-3">
            <TaskCalendarView tasks={myCalendarTasks} view="current-week" showUndated={false} />
          </div>
        </Tile>
      )}
    </div>
  );
}
