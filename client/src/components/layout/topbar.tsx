import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Command,
  Loader2,
  LogOut,
  Mail,
  Menu,
  Monitor,
  Receipt,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { apiRequest, authFetch, queryClient } from "@/lib/queryClient";
import { disableWebPush, enableWebPush } from "@/lib/notification-push";
import { reviewApi, reviewKeys, type ReviewRoomSummary } from "@/lib/review-api";
import { GlobalSearch } from "@/components/features/global-search";
import { MessagesPopup } from "@/components/features/messages-popup";
import { HelpPopup } from "@/components/features/help-popup";
import BrandMark from "@/components/layout/brand-mark";

type ProductNotification = {
  id: number;
  type: string;
  title: string;
  message: string;
  entityId: number | null;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};
type NotificationPreferences = { desktopEnabled: boolean; emailEnabled: boolean; setupCompletedAt: string | null; discreetMode?: boolean; categoryPreferences?: Record<string, { desktop?: boolean; email?: boolean }> };
type NotificationResponse = { items: ProductNotification[]; unreadCount: number; hasMore: boolean; nextCursor: number | null };

function notificationHref(notification: ProductNotification) {
  if (notification.actionUrl?.startsWith("/") && !notification.actionUrl.startsWith("//")) return notification.actionUrl;
  if (notification.type.startsWith("mind_")) return notification.entityId ? `/review/${notification.entityId}` : "/review";
  if (notification.type.startsWith("task_")) return "/tasks/my-tasks";
  if (notification.type.startsWith("crm_")) return notification.entityId ? `/crm/${notification.entityId}` : "/crm";
  if (notification.type.startsWith("absence")) return "/absences";
  return "/";
}

function notificationIconClass(type: string) {
  if (type.startsWith("mind_")) return "bg-violet-100 text-violet-700";
  if (type.startsWith("task_")) return "bg-sky-100 text-sky-700";
  if (type.startsWith("crm_")) return "bg-amber-100 text-amber-700";
  if (type.startsWith("absence")) return "bg-emerald-100 text-emerald-700";
  return "bg-slate-100 text-slate-600";
}

interface TopbarProps {
  onMenuClick?: () => void;
}

const routeLabels: Record<string, string> = {
  "optimized-quote": "Nueva cotización",
  "manage-quotes": "Cotizaciones",
  quotations: "Cotizaciones",
  quote: "Cotización",
  quotation: "Cotización",
  "active-projects": "Proyectos",
  "project-details": "Detalle del proyecto",
  clients: "Clientes",
  statistics: "Análisis",
  admin: "Configuración",
  "project-summary": "Resumen de proyecto",
  "project-analytics": "Analytics del proyecto",
  "client-summary": "Resumen de cliente",
  "time-entries": "Registro de horas",
  "quality-scores": "Calidad",
  "quarterly-nps": "NPS trimestral",
  "edit-deliverable": "Editar entregable",
  "edit-indicators": "Editar indicadores",
  "always-on-project": "Proyecto Always-On",
  "recurring-templates": "Always-On",
  projects: "Proyectos",
  new: "Nuevo",
  history: "Historial",
  review: "Status",
  objectives: "Objetivos",
  operations: "Operaciones",
  capacity: "Capacidad semanal",
  "monthly-closing": "Cierre mensual",
  "estimated-rates": "Valor hora",
  holidays: "Feriados",
  absences: "Ausencias",
  tasks: "Tareas",
  "my-tasks": "Mis tareas",
  "team-calendar": "Calendario",
  "hours-dashboard": "Panel de horas",
  finance: "Finanzas",
  notifications: "Notificaciones",
  activo: "Activo",
  pasivo: "Pasivo",
  provisions: "Provisiones",
  cashflow: "Cashflow",
  crm: "CRM",
  dashboard: "Resumen financiero",
  "my-invoices": "Mis facturas",
  "liquidaciones-equipo": "Liquidaciones equipo",
  "facturas-equipo": "Facturas equipo",
};

const standalonePages = new Set([
  "quotations",
  "manage-quotes",
  "optimized-quote",
  "active-projects",
  "clients",
  "statistics",
  "admin",
  "recurring-templates",
  "tasks",
  "crm",
  "dashboard",
  "review",
]);

export default function Topbar({ onMenuClick }: TopbarProps = {}) {
  const [location] = useLocation();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [notificationSetupSaving, setNotificationSetupSaving] = useState(false);
  const [notificationSetupError, setNotificationSetupError] = useState("");
  const { user, logoutMutation, isLoading } = useAuth();
  const { hasPermission } = usePermissions();

  const { data: reviewRooms = [] } = useQuery<ReviewRoomSummary[]>({
    queryKey: reviewKeys.list(),
    queryFn: reviewApi.listRooms,
    staleTime: 60_000,
    enabled: hasPermission("status"),
  });

  const { data: notificationData } = useQuery<NotificationResponse>({
    queryKey: ["/api/notifications", (user as any)?.id],
    queryFn: async () => {
      const response = await authFetch("/api/notifications?limit=50");
      if (!response.ok) throw new Error("No se pudieron cargar las notificaciones");
      return response.json();
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: Boolean(user),
  });
  const notifications = notificationData?.items ?? [];
  const { data: notificationPreferences, refetch: refetchNotificationPreferences } = useQuery<NotificationPreferences>({
    queryKey: ["/api/notifications/preferences", (user as any)?.id],
    queryFn: async () => {
      const response = await authFetch("/api/notifications/preferences");
      if (!response.ok) throw new Error("No se pudieron cargar las preferencias");
      return response.json();
    },
    enabled: Boolean(user),
  });
  const saveNotificationPreferences = async (next: NotificationPreferences) => {
    await apiRequest("/api/notifications/preferences", "PUT", { desktopEnabled: next.desktopEnabled, emailEnabled: next.emailEnabled, categoryPreferences: next.categoryPreferences ?? {}, discreetMode: next.discreetMode ?? true });
    await refetchNotificationPreferences();
  };
  const toggleDesktopNotifications = async () => {
    if (!notificationPreferences) return;
    let enabled = !notificationPreferences.desktopEnabled;
    setNotificationSetupError("");
    try {
      if (enabled) await enableWebPush();
      else await disableWebPush();
      await saveNotificationPreferences({ ...notificationPreferences, desktopEnabled: enabled });
    } catch (error) {
      setNotificationSetupError(error instanceof Error ? error.message : "No pudimos guardar la preferencia. Volvé a intentarlo.");
    }
  };
  const enableDesktopDuringSetup = async () => {
    if (!notificationPreferences) return;
    setNotificationSetupError("");
    try {
      await enableWebPush();
      await saveNotificationPreferences({ ...notificationPreferences, desktopEnabled: true });
    } catch (error) {
      setNotificationSetupError(error instanceof Error ? error.message : "No pudimos guardar la preferencia de escritorio. Volvé a intentarlo.");
    }
  };
  const enableEmailDuringSetup = async () => {
    if (!notificationPreferences) return;
    setNotificationSetupError("");
    try {
      await saveNotificationPreferences({ ...notificationPreferences, emailEnabled: true });
    } catch {
      setNotificationSetupError("No pudimos guardar la preferencia de email. Volvé a intentarlo.");
    }
  };
  const completeNotificationSetup = async () => {
    if (!notificationPreferences || (!notificationPreferences.desktopEnabled && !notificationPreferences.emailEnabled)) return;
    setNotificationSetupSaving(true);
    setNotificationSetupError("");
    try {
      await apiRequest("/api/notifications/preferences", "PUT", {
        desktopEnabled: notificationPreferences.desktopEnabled,
        emailEnabled: notificationPreferences.emailEnabled,
        categoryPreferences: notificationPreferences.categoryPreferences ?? {},
        discreetMode: notificationPreferences.discreetMode ?? true,
        setupCompleted: true,
      });
      await refetchNotificationPreferences();
    } catch {
      setNotificationSetupError("No pudimos guardar la configuración. Volvé a intentarlo.");
    } finally {
      setNotificationSetupSaving(false);
    }
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const breadcrumbs = useMemo(() => {
    // Project task pages render a richer in-page breadcrumb with the project name.
    // The generic route breadcrumb only knows the numeric id, so showing both is noisy.
    if (/^\/tasks\/projects\/\d+$/.test(location)) return [];
    if (location === "/") return [{ name: "Inicio", path: "/" }];
    const paths = location.split("/").filter(Boolean);
    const result: { name: string; path: string }[] = [];
    let currentPath = "";

    paths.forEach((path, index) => {
      currentPath += `/${path}`;
      const previous = paths[index - 1];
      if (previous === "review" && /^\d+$/.test(path)) {
        const room = reviewRooms.find((item) => item.id === Number(path));
        result.push({ name: room?.name ?? `Sala #${path}`, path: currentPath });
        return;
      }
      if (/^\d+$/.test(path)) {
        result.push({ name: `#${path}`, path: currentPath });
        return;
      }
      result.push({
        name: routeLabels[path] || path.charAt(0).toUpperCase() + path.slice(1).replaceAll("-", " "),
        path: currentPath,
      });
    });

    return standalonePages.has(paths[0]) ? result : [{ name: "Inicio", path: "/" }, ...result];
  }, [location, reviewRooms]);

  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : "--";
  const unreadNotifications = notifications.filter((notification) => !notification.readAt);
  const alertCount = notificationData?.unreadCount ?? unreadNotifications.length;
  const markNotificationRead = async (id: number) => {
    await apiRequest(`/api/notifications/${id}/read`, "PATCH");
    await queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
  };
  const markAllNotificationsRead = async () => {
    await apiRequest("/api/notifications/read-all", "PATCH");
    await queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
  };
  const isProvider = (user as any)?.role === "external_provider";

  return (
    <>
      <header className="topbar sticky top-0 z-30 flex h-[72px] w-full items-center gap-2 border-b border-slate-200/70 bg-white/80 px-3 shadow-[0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl sm:px-5">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 lg:hidden"
          onClick={onMenuClick}
          aria-label="Abrir navegación"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <Link href="/" className="mr-1 flex shrink-0 items-center gap-2 lg:hidden" aria-label="Ir al inicio">
          <span className="rounded-xl bg-[#0b0f17] p-0.5">
            <BrandMark showWordmark={false} compact />
          </span>
          <span className="hidden text-sm font-bold tracking-[-0.03em] text-slate-900 xs:block">mind</span>
        </Link>

        <nav className="flex min-w-0 flex-1 items-center" aria-label="Migas de pan">
          <div className="hidden min-w-0 items-center sm:flex">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.path} className="flex min-w-0 items-center">
                {index > 0 && <ChevronRight className="mx-1.5 h-3.5 w-3.5 shrink-0 text-slate-300" />}
                {index < breadcrumbs.length - 1 ? (
                  <Link
                    href={crumb.path}
                    className="truncate text-xs font-medium text-slate-500 transition-colors hover:text-slate-900"
                  >
                    {crumb.name}
                  </Link>
                ) : (
                  <span className="truncate text-sm font-semibold tracking-[-0.01em] text-slate-900">
                    {crumb.name}
                  </span>
                )}
              </div>
            ))}
          </div>
          <span className="truncate text-sm font-semibold text-slate-900 sm:hidden">
            {breadcrumbs.at(-1)?.name}
          </span>
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="hidden h-9 min-w-52 items-center gap-2 rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 text-left text-xs font-medium text-slate-500 shadow-sm transition-all hover:border-slate-300 hover:bg-white hover:text-slate-700 xl:flex"
            aria-label="Abrir búsqueda global"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="flex-1">Buscar en Mind</span>
            <span className="inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-semibold text-slate-400">
              <Command className="h-2.5 w-2.5" />K
            </span>
          </button>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 xl:hidden"
                  onClick={() => setIsSearchOpen(true)}
                  aria-label="Buscar"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Buscar</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="hidden sm:flex"><MessagesPopup /></div>
          <div className="hidden sm:flex"><HelpPopup /></div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 text-slate-500"
                  aria-label={`Notificaciones${alertCount ? `, ${alertCount} pendientes` : ""}`}
              >
                <Bell className="h-4 w-4" />
                {alertCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 grid h-3.5 min-w-3.5 place-items-center rounded-full border-2 border-white bg-primary px-0.5 text-[8px] font-bold leading-none text-white">
                  {alertCount > 99 ? "99+" : alertCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl p-0 shadow-xl">
              <div className="flex items-center justify-between border-b border-border/70 px-4 py-3.5">
                <div>
                  <p className="text-sm font-semibold text-foreground">Notificaciones</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {alertCount === 0
                      ? "No tenés novedades sin leer"
                      : `${alertCount} sin leer`}
                  </p>
                </div>
                {alertCount > 0 && <DropdownMenuItem asChild className="h-8 cursor-pointer gap-1 px-2 text-[11px] font-semibold text-primary focus:text-primary"><button type="button" onClick={() => void markAllNotificationsRead()}><CheckCheck className="h-3.5 w-3.5" />Marcar leídas</button></DropdownMenuItem>}
              </div>

              {notifications.length === 0 ? (
                <div className="mind-empty-state min-h-[9rem]">
                  <Sparkles className="h-6 w-6 text-emerald-500" />
                  <p className="text-sm font-semibold text-foreground">Todo al día</p>
                  <p className="mt-1 text-xs">Cuando haya una novedad para vos, la vas a encontrar acá.</p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto p-2">
                  {notifications.slice(0, 8).map((notification) => (
                    <DropdownMenuItem key={notification.id} asChild className={cn("mb-1 cursor-pointer rounded-xl p-0", !notification.readAt && "bg-indigo-50/70")}>
                      <Link href={notificationHref(notification)} onClick={() => void markNotificationRead(notification.id)} className="flex w-full items-start gap-3 px-3 py-3">
                        <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl", notificationIconClass(notification.type))}><Bell className="h-4 w-4" /></span>
                        <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="block truncate text-xs font-semibold text-foreground">{notification.title}</span>{!notification.readAt && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />}</span><span className="mt-1 block line-clamp-2 text-[11px] leading-4 text-muted-foreground">{notification.message}</span></span>
                        <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                      </Link>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem asChild className="mt-1 cursor-pointer justify-center rounded-xl px-3 py-2.5 text-xs font-semibold text-indigo-700 focus:text-indigo-700"><Link href="/notifications">Ver toda la actividad <ChevronRight className="ml-1 h-3.5 w-3.5" /></Link></DropdownMenuItem>
                </div>
              )}

              {notificationPreferences && (
                <>
                  <DropdownMenuSeparator className="m-0" />
                  <div className="space-y-1.5 px-4 py-3">
                    <p className="text-[11px] font-semibold text-muted-foreground">Avisarme también por</p>
                    <button type="button" aria-pressed={notificationPreferences.desktopEnabled} className="flex w-full items-center justify-between text-xs" onClick={() => void toggleDesktopNotifications()}>
                      <span>Escritorio</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px]", notificationPreferences.desktopEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                        {notificationPreferences.desktopEnabled ? "Activado" : "Desactivado"}
                      </span>
                    </button>
                    <button type="button" aria-pressed={notificationPreferences.emailEnabled} className="flex w-full items-center justify-between text-xs" onClick={() => void saveNotificationPreferences({ ...notificationPreferences, emailEnabled: !notificationPreferences.emailEnabled })}>
                      <span>Email</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px]", notificationPreferences.emailEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                        {notificationPreferences.emailEnabled ? "Activado" : "Desactivado"}
                      </span>
                    </button>
                    {notificationSetupError && <p role="alert" className="text-[10px] text-destructive">{notificationSetupError}</p>}
                    <Link href="/notifications#preferencias" className="inline-flex items-center gap-1 pt-1 text-[11px] font-semibold text-primary hover:underline">Configurar categorías <ChevronRight className="h-3 w-3" /></Link>
                  </div>
                </>
              )}

            </DropdownMenuContent>
          </DropdownMenu>

          <div className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-10 gap-2 rounded-xl px-1.5 sm:pr-2">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <Avatar className="h-7 w-7 border border-slate-200 shadow-sm">
                      <AvatarFallback className="bg-slate-900 text-[10px] font-bold text-white">{initials}</AvatarFallback>
                      {user?.avatar && <AvatarImage src={user.avatar} />}
                    </Avatar>
                    <span className="hidden max-w-28 truncate text-xs font-semibold text-slate-700 sm:inline">
                      {user?.firstName || "Usuario"}
                    </span>
                    <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 sm:block" />
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-2xl p-1.5 shadow-xl">
              {user && (
                <>
                  <div className="flex items-center gap-3 px-2.5 py-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-slate-900 text-xs font-bold text-white">{initials}</AvatarFallback>
                      {user.avatar && <AvatarImage src={user.avatar} />}
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{user.firstName} {user.lastName}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  {!isProvider && (
                    <DropdownMenuItem asChild className="rounded-xl">
                      <Link href="/my-invoices" className="flex items-center gap-2">
                        <Receipt className="h-4 w-4" />
                        <span>Mis facturas</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {(user as any).isAdmin && (
                    <DropdownMenuItem asChild className="rounded-xl">
                      <Link href="/admin" className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        <span>Configuración</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onSelect={() => logoutMutation.mutate()}
                    className="rounded-xl text-destructive focus:text-destructive"
                  >
                    {logoutMutation.isPending
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <LogOut className="h-4 w-4" />}
                    <span>{logoutMutation.isPending ? "Cerrando sesión…" : "Cerrar sesión"}</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      <Dialog open={Boolean(user && notificationPreferences && !notificationPreferences.setupCompletedAt)} onOpenChange={() => {}}>
        <DialogContent
          className="max-w-lg overflow-hidden rounded-[1.75rem] border-0 bg-white p-0 shadow-2xl [&>button:first-of-type]:hidden"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-6 py-7 text-white sm:px-8">
            <div className="pointer-events-none absolute -right-8 -top-16 h-48 w-48 rounded-full bg-indigo-400/20 blur-3xl" />
            <div className="relative mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-white/10 text-sky-200 shadow-inner"><Bell className="h-5 w-5" /></div>
            <div className="relative mb-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300"><Sparkles className="h-3 w-3 text-sky-300" /> Mind te mantiene al tanto</div>
            <DialogTitle className="relative text-2xl font-semibold tracking-tight text-white">No te pierdas lo importante</DialogTitle>
            <DialogDescription className="relative max-w-md text-sm leading-6 text-slate-300">
              Elegí cómo querés enterarte cuando respondan en Mind, se complete una daily o te asignen una tarea.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 px-6 pt-5 sm:px-8">
            <div className={cn("flex items-center justify-between gap-3 rounded-2xl border p-4 transition-colors", notificationPreferences?.desktopEnabled ? "border-indigo-200 bg-indigo-50/70" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70")}>
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><Monitor className="h-4 w-4" /></div>
                <div>
                  <p className="text-sm font-medium">Escritorio</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">Avisos del navegador incluso con Mind cerrado.</p>
                </div>
              </div>
              <Button size="sm" className="shrink-0 rounded-lg" variant={notificationPreferences?.desktopEnabled ? "secondary" : "outline"} disabled={!notificationPreferences || notificationPreferences.desktopEnabled || notificationSetupSaving} onClick={() => void enableDesktopDuringSetup()}>
                {notificationPreferences?.desktopEnabled ? <><CheckCheck className="mr-1.5 h-3.5 w-3.5" />Activado</> : "Activar"}
              </Button>
            </div>
            <div className={cn("flex items-center justify-between gap-3 rounded-2xl border p-4 transition-colors", notificationPreferences?.emailEnabled ? "border-indigo-200 bg-indigo-50/70" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70")}>
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><Mail className="h-4 w-4" /></div>
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">Un correo cuando haya una novedad para vos.</p>
                </div>
              </div>
              <Button size="sm" className="shrink-0 rounded-lg" variant={notificationPreferences?.emailEnabled ? "secondary" : "outline"} disabled={!notificationPreferences || notificationPreferences.emailEnabled || notificationSetupSaving} onClick={() => void enableEmailDuringSetup()}>
                {notificationPreferences?.emailEnabled ? <><CheckCheck className="mr-1.5 h-3.5 w-3.5" />Activado</> : "Activar"}
              </Button>
            </div>
          </div>

          {notificationSetupError && <p role="alert" className="mx-6 mt-3 text-sm text-destructive sm:mx-8">{notificationSetupError}</p>}

          <DialogFooter className="mt-5 border-t border-slate-100 bg-slate-50/80 px-6 py-5 sm:flex-col sm:px-8">
            <Button className="h-11 w-full rounded-xl bg-slate-900 font-semibold text-white shadow-sm hover:bg-indigo-700" disabled={!notificationPreferences?.desktopEnabled && !notificationPreferences?.emailEnabled || notificationSetupSaving} onClick={() => void completeNotificationSetup()}>
              {notificationSetupSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Continuar a Mind <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
            <p className="w-full text-center text-xs leading-5 text-muted-foreground">Tus notificaciones se pueden pausar o ajustar por categoría desde Preferencias.</p>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
