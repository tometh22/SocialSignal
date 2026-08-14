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
  ChevronDown,
  ChevronRight,
  Command,
  Loader2,
  LogOut,
  Menu,
  Receipt,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { apiRequest, authFetch, queryClient } from "@/lib/queryClient";
import { reviewApi, reviewKeys, type ReviewRoomSummary } from "@/lib/review-api";
import { GlobalSearch } from "@/components/features/global-search";
import { MessagesPopup } from "@/components/features/messages-popup";
import { HelpPopup } from "@/components/features/help-popup";
import BrandMark from "@/components/layout/brand-mark";

type DueReminder = {
  id: number | string;
  description: string;
  dueDate: string;
  leadId: number;
  leadName: string | null;
  isOverdue: boolean;
  type?: "manual" | "inactivity";
  daysSince?: number;
};

type ProductNotification = {
  id: number;
  title: string;
  message: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

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
  activo: "Activo",
  pasivo: "Pasivo",
  provisions: "Provisiones",
  cashflow: "Cashflow",
  crm: "CRM",
  dashboard: "Resumen financiero",
  "my-invoices": "Mis facturas",
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
  const { user, logoutMutation, isLoading } = useAuth();
  const { hasPermission } = usePermissions();

  const { data: reviewRooms = [] } = useQuery<ReviewRoomSummary[]>({
    queryKey: reviewKeys.list(),
    queryFn: reviewApi.listRooms,
    staleTime: 60_000,
    enabled: hasPermission("status"),
  });

  const { data: reminders = [] } = useQuery<DueReminder[]>({
    queryKey: ["/api/crm/reminders/due", "topbar"],
    queryFn: async () => {
      const response = await authFetch("/api/crm/reminders/due");
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60_000,
    enabled: hasPermission("crm"),
  });

  const { data: notifications = [] } = useQuery<ProductNotification[]>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const response = await authFetch("/api/notifications");
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: Boolean(user),
  });

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
  const overdueCount = reminders.filter((reminder) => reminder.isOverdue).length;
  const unreadNotifications = notifications.filter((notification) => !notification.readAt);
  const alertCount = unreadNotifications.length + reminders.length;
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
                    {alertCount > 9 ? "9+" : alertCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl p-0 shadow-xl">
              <div className="flex items-center justify-between border-b border-border/70 px-4 py-3.5">
                <div>
                  <p className="text-sm font-semibold text-foreground">Notificaciones</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {unreadNotifications.length === 0
                      ? "No tenés novedades sin leer"
                      : `${unreadNotifications.length} sin leer`}
                  </p>
                </div>
                {unreadNotifications.length > 0 && (
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-primary hover:underline"
                    onClick={() => void markAllNotificationsRead()}
                  >
                    Marcar todas
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="mind-empty-state min-h-[9rem]">
                  <Sparkles className="h-6 w-6 text-emerald-500" />
                  <p className="text-sm font-semibold text-foreground">Sin novedades</p>
                  <p className="mt-1 text-xs">Las decisiones sobre tus solicitudes aparecerán acá.</p>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto p-1.5">
                  {notifications.slice(0, 8).map((notification) => (
                    <DropdownMenuItem key={notification.id} asChild className="rounded-xl p-0">
                      <Link
                        href={notification.actionUrl || "/absences"}
                        onClick={() => void markNotificationRead(notification.id)}
                        className={cn("flex w-full items-start gap-3 px-3 py-2.5", !notification.readAt && "bg-primary/[0.04]")}
                      >
                        <span className={cn(
                          "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg",
                          notification.readAt ? "bg-slate-50 text-slate-500" : "bg-primary/10 text-primary",
                        )}>
                          <Bell className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-foreground">
                            {notification.title}
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                            {notification.message}
                          </span>
                        </span>
                        <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </div>
              )}

              {hasPermission("crm") && reminders.length > 0 && (
                <>
                  <DropdownMenuSeparator className="m-0" />
                  <Link
                    href="/crm"
                    className="flex items-center justify-between gap-2 px-4 py-2.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-50"
                  >
                    <span>{reminders.length} alerta{reminders.length === 1 ? "" : "s"} CRM · {overdueCount} vencida{overdueCount === 1 ? "" : "s"}</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
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
    </>
  );
}
