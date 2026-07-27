import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions, AppSection } from "@/hooks/use-permissions";
import { Badge } from "@/components/ui/badge";
import { authFetch } from "@/lib/queryClient";
import CreateReviewDialog from "@/components/review/CreateReviewDialog";
import { reviewApi, reviewKeys, roomColor, type ReviewRoomSummary } from "@/lib/review-api";
import BrandMark from "@/components/layout/brand-mark";

import {
  ChevronRight,
  ChevronDown,
  LayoutDashboard,
  FileText,
  Briefcase,
  Building2,
  Settings,
  LogOut,
  Target,
  Plus,
  Users,
  CheckSquare,
  CalendarDays,
  BarChart2,
  FolderOpen,
  Home,
  ClipboardList,
  Gauge,
  CalendarCheck,
  Calendar,
  Receipt,
  MessageSquare,
  UserX,
  CircleArrowDown,
  CircleArrowUp,
  Wallet,
  ShieldAlert,
  Database,
} from "lucide-react";

const PROJECT_ICON_COLORS = [
  { bg: "bg-blue-500", text: "text-white" },
  { bg: "bg-purple-500", text: "text-white" },
  { bg: "bg-green-500", text: "text-white" },
  { bg: "bg-orange-500", text: "text-white" },
  { bg: "bg-pink-500", text: "text-white" },
  { bg: "bg-teal-500", text: "text-white" },
  { bg: "bg-indigo-500", text: "text-white" },
  { bg: "bg-rose-500", text: "text-white" },
];

function getProjectIconColor(id: number) {
  return PROJECT_ICON_COLORS[id % PROJECT_ICON_COLORS.length];
}

type TaskProjectSummary = {
  id: number;
  name: string;
  clientName: string;
  pendingCount: number;
};

type NavItem = {
  href: string;
  title: string;
  icon: any;
  badge?: string;
  status?: 'new';
  description?: string;
  permission?: AppSection;
};

interface SidebarFixedProps {
  mobileMode?: boolean;
}

export default function SidebarFixed({ mobileMode = false }: SidebarFixedProps = {}) {
  const { user, logoutMutation } = useAuth();
  const { hasPermission } = usePermissions();
  const [currentPath, setLocation] = useLocation();
  // En mobile (dentro del drawer) nunca está colapsado - el cierre se hace cerrando el drawer
  const [isCollapsedState, setIsCollapsed] = useState(false);
  const isCollapsed = mobileMode ? false : isCollapsedState;
  const [projectCount, setProjectCount] = useState(0);
  const [crmOverdue, setCrmOverdue] = useState(0);
  const [projectsExpanded, setProjectsExpanded] = useState(false);
  const [reviewsExpanded, setReviewsExpanded] = useState(true);
  const [newReviewOpen, setNewReviewOpen] = useState(false);

  const fetchProjectCount = async () => {
    try {
      const response = await authFetch('/api/active-projects/count?' + Date.now());
      if (response.ok) {
        const data = await response.json();
        setProjectCount(data.count);
      }
    } catch (error) {
      setProjectCount(0);
    }
  };

  const fetchCrmStats = async () => {
    try {
      const response = await authFetch('/api/crm/stats');
      if (response.ok) {
        const data = await response.json();
        setCrmOverdue(data.overdueReminders || 0);
      }
    } catch {}
  };

  useEffect(() => {
    fetchProjectCount();
    fetchCrmStats();
    const interval = setInterval(() => {
      fetchProjectCount();
      fetchCrmStats();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const getUserInitials = () => {
    if (!user) return "US";
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;
  };

  const isAdmin = (user as any)?.isAdmin;

  const { data: rawTaskProjects } = useQuery<TaskProjectSummary[]>({
    queryKey: ["/api/tasks/projects"],
    queryFn: () => authFetch("/api/tasks/projects").then(r => r.json()),
    staleTime: 60000,
  });
  const taskProjects: TaskProjectSummary[] = Array.isArray(rawTaskProjects) ? rawTaskProjects : [];
  const MAX_SIDEBAR_PROJECTS = 8;
  const sidebarProjects = taskProjects.slice(0, MAX_SIDEBAR_PROJECTS);

  const { data: rawReviewRooms } = useQuery<ReviewRoomSummary[]>({
    queryKey: reviewKeys.list(),
    queryFn: reviewApi.listRooms,
    staleTime: 60000,
    enabled: hasPermission('status'),
  });
  const reviewRooms: ReviewRoomSummary[] = Array.isArray(rawReviewRooms) ? rawReviewRooms : [];
  const MAX_SIDEBAR_ROOMS = 5;
  const sidebarRooms = [...reviewRooms]
    .sort((a, b) => {
      const av = a.lastVisitedAt ? new Date(a.lastVisitedAt).getTime() : 0;
      const bv = b.lastVisitedAt ? new Date(b.lastVisitedAt).getTime() : 0;
      return bv - av;
    })
    .slice(0, MAX_SIDEBAR_ROOMS);
  const totalReviewPending = reviewRooms.reduce((acc, r) => acc + (r.pendingCount || 0), 0);
  const isStatusActive = currentPath === '/review' || currentPath.startsWith('/review/');

  // Si el usuario es un proveedor externo, mostramos un sidebar restringido
  // con solo el panel del proveedor y sus facturas.
  const isProvider = (user as any)?.role === 'external_provider';

  const providerSections = [
    {
      title: "Proveedor",
      items: [
        { href: "/provider/dashboard", title: "Mi panel", icon: Briefcase, description: "Tus proyectos asignados" },
        { href: "/my-invoices", title: "Mis facturas", icon: Receipt, description: "Subí tu factura mensual" },
      ]
    },
  ];

  const navSections = isProvider ? providerSections : [
    {
      title: "",
      items: [
        { href: "/", title: "Inicio", icon: Home, description: "Accesos directos y resumen", permission: 'dashboard' as AppSection },
        { href: "/dashboard", title: "Dashboard Ejecutivo", icon: LayoutDashboard, description: "KPIs financieros y operativos", permission: 'dashboard' as AppSection },
      ]
    },
    {
      title: "Comercial",
      items: [
        { href: "/crm", title: "CRM Ventas", icon: Target, badge: crmOverdue > 0 ? crmOverdue.toString() : undefined, description: "Pipeline de prospectos", permission: 'crm' as AppSection },
        { href: "/quotations", title: "Cotizaciones", icon: FileText, description: "Gestionar cotizaciones", permission: 'quotations' as AppSection },
        { href: "/clients", title: "Clientes", icon: Building2, description: "Base de clientes", permission: 'crm' as AppSection },
      ]
    },
    {
      title: "Proyectos",
      items: [
        { href: "/active-projects", title: "Vista de Proyectos", icon: Briefcase, badge: projectCount > 0 ? projectCount.toString() : undefined, description: "Proyectos activos y rentabilidad", permission: 'projects' as AppSection },
        { href: "/tasks", title: "Tareas", icon: CheckSquare, description: "Gestión de tareas", permission: 'projects' as AppSection },
      ]
    },
    {
      title: "Operaciones",
      items: [
        { href: "/tasks/hours-dashboard", title: "Panel de Horas", icon: BarChart2, description: "Horas por persona y proyecto", permission: 'projects' as AppSection },
        { href: "/operations/capacity", title: "Capacidad Semanal", icon: Gauge, description: "Capacidad operativa por persona", permission: 'operations' as AppSection },
        { href: "/operations/monthly-closing", title: "Cierre Mensual", icon: CalendarCheck, description: "Cierre de horas del mes", permission: 'operations' as AppSection },
        { href: "/operations/holidays", title: "Feriados", icon: Calendar, description: "Gestión de feriados", permission: 'operations' as AppSection },
        { href: "/operations/absences", title: "Ausencias", icon: UserX, description: "Vacaciones y licencias del equipo", permission: 'operations' as AppSection },
      ]
    },
    {
      title: "Finanzas",
      items: [
        { href: "/finance/activo", title: "Activo", icon: CircleArrowUp, description: "Cuentas a cobrar y activos líquidos", permission: 'finance' as AppSection },
        { href: "/finance/pasivo", title: "Pasivo", icon: CircleArrowDown, description: "Cuentas a pagar y deudas", permission: 'finance' as AppSection },
        { href: "/finance/provisions", title: "Provisiones", icon: ShieldAlert, description: "Provisiones y contingencias", permission: 'finance' as AppSection },
        { href: "/finance/cashflow", title: "Cashflow", icon: Wallet, description: "Movimientos y saldos bancarios", permission: 'finance' as AppSection },
      ]
    },
    {
      title: "Mi cuenta",
      items: [
        { href: "/my-invoices", title: "Mis facturas", icon: Receipt, description: "Subí tu factura mensual" },
      ]
    },
    {
      title: "Admin",
      items: [
        { href: "/admin/users", title: "Usuarios", icon: Users, description: "Usuarios y permisos", permission: 'admin' as AppSection },
        { href: "/admin/providers", title: "Proveedores", icon: Building2, description: "Proveedores externos y su acceso a proyectos", permission: 'admin' as AppSection },
        { href: "/admin/data-sources", title: "Fuente de datos", icon: Database, description: "Toggle Excel / Registros de la app", permission: 'admin' as AppSection },
        { href: "/admin", title: "Configuración", icon: Settings, description: "Administración", permission: 'admin' as AppSection }
      ]
    }
  ];

  const filteredNavSections = navSections.map(section => ({
    ...section,
    items: section.items.filter((item: NavItem) =>
      !item.permission || hasPermission(item.permission)
    )
  })).filter(section => section.items.length > 0);

  const renderNavLink = (item: NavItem) => {
    const Icon = item.icon || LayoutDashboard;
    const isActive = currentPath === item.href;

    return (
      <TooltipProvider key={item.href}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={item.href}
              title={isCollapsed ? item.title : undefined}
              className={cn(
                "flex min-h-10 items-center rounded-xl px-3 py-2 text-[13px] transition-all duration-200 relative group",
                isActive
                  ? "bg-gradient-to-r from-white/[0.14] to-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  : "text-white/58 hover:text-white hover:bg-white/[0.075]",
                isCollapsed && "justify-center px-2"
              )}
            >
              {isActive && <span className="absolute -left-0.5 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[#f43f5e] shadow-[0_0_12px_rgba(244,63,94,0.75)]" />}
              <div className="flex items-center flex-1 min-w-0">
                <Icon className={cn("h-[17px] w-[17px] flex-shrink-0 transition-transform duration-200 group-hover:scale-105", isCollapsed ? "mx-auto" : "mr-3")} />

                {!isCollapsed && (
                  <div className="flex items-center justify-between flex-1">
                    <span className="truncate font-medium tracking-[-0.01em]">{item.title}</span>
                    <div className="flex items-center gap-1.5 ml-2">
                      {item.badge && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "h-4 px-1.5 text-xs font-medium",
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-white/10 text-white/70"
                          )}
                        >
                          {item.badge}
                        </Badge>
                      )}
                      {item.status === 'new' && (
                        <div className={cn(
                          "h-2 w-2 rounded-full",
                          isActive ? "bg-white" : "bg-green-400"
                        )} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Link>
          </TooltipTrigger>
          {isCollapsed && (
            <TooltipContent side="right" className="font-medium">
              {item.title}
              {item.badge && ` (${item.badge})`}
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <TooltipProvider>
      <div className={cn(
        "relative flex flex-col overflow-hidden bg-[#0b0f17] shadow-[12px_0_40px_-30px_rgba(15,23,42,0.65)]",
        mobileMode
          ? "h-full w-full"
          : "h-screen border-r border-white/[0.07] transition-[width] duration-300 ease-out",
        !mobileMode && (isCollapsed ? "w-[72px]" : "w-[264px]")
      )}>
        <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-rose-500/[0.06] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -right-24 h-64 w-64 rounded-full bg-indigo-500/[0.05] blur-3xl" />
        {/* Header */}
        <div className="relative z-10 flex h-[72px] items-center justify-between border-b border-white/[0.07] px-3.5">
          {!isCollapsed && (
            <BrandMark />
          )}
          {isCollapsed && (
            <div className="mx-auto">
              <BrandMark showWordmark={false} compact />
            </div>
          )}

          <div className="flex items-center gap-1">
            {!mobileMode && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="h-8 w-8 p-0 text-white/50 hover:bg-white/10 hover:text-white"
                aria-label={isCollapsed ? "Expandir navegación" : "Contraer navegación"}
              >
                <ChevronRight className={cn("h-3 w-3 transition-transform text-white/50", isCollapsed ? "" : "rotate-180")} />
              </Button>
            )}
          </div>
        </div>

        {/* Navegación principal */}
        <div className="relative z-10 flex-1 min-h-0">
        <div className="h-full px-2.5 py-4 overflow-y-auto">
          <nav className="space-y-5">
            {filteredNavSections.map((section) => (
              <div key={section.title || '__top__'}>
                {!isCollapsed && section.title && (
                  <h3 className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-white/28">
                    {section.title}
                  </h3>
                )}
                <div className="space-y-1">
                  {section.items.map((item) => renderNavLink(item))}
                </div>

                {/* Collapsible project list — only under Tareas section */}
                {section.title === "Tareas" && taskProjects.length > 0 && (
                  <div className="mt-1">
                    {!isCollapsed ? (
                      <>
                        <div className="flex items-center px-3 py-1">
                          <button
                            onClick={() => setProjectsExpanded(v => !v)}
                            className="flex items-center gap-1 text-[10px] font-semibold text-white/30 uppercase tracking-widest hover:text-white/60 transition-colors flex-1"
                          >
                            <span>Proyectos</span>
                            {projectsExpanded
                              ? <ChevronDown className="h-3 w-3 ml-1" />
                              : <ChevronRight className="h-3 w-3 ml-1" />
                            }
                          </button>
                        </div>

                        {projectsExpanded && (
                          <div className="space-y-0.5 mt-0.5 ml-1">
                            {sidebarProjects.map(proj => {
                              const color = getProjectIconColor(proj.id);
                              const isActive = currentPath === `/tasks/projects/${proj.id}`;
                              const initial = proj.clientName.charAt(0).toUpperCase();
                              return (
                                <Link
                                  key={proj.id}
                                  href={`/tasks/projects/${proj.id}`}
                                  className={cn(
                                    "flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all duration-150",
                                    isActive
                                      ? "bg-white/10 text-[#D72638] font-semibold"
                                      : "text-white/60 hover:text-white hover:bg-white/10"
                                  )}
                                >
                                  <span className={cn(
                                    "inline-flex flex-shrink-0 items-center justify-center rounded-md font-bold w-5 h-5 text-[9px]",
                                    color.bg, color.text
                                  )}>
                                    {initial}
                                  </span>
                                  <span className="truncate flex-1 font-medium">{proj.name}</span>
                                  {proj.pendingCount > 0 && (
                                    <span className={cn(
                                      "h-4 min-w-[16px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center flex-shrink-0",
                                      isActive ? "bg-[#D72638] text-white" : "bg-white/10 text-white/60"
                                    )}>
                                      {proj.pendingCount}
                                    </span>
                                  )}
                                </Link>
                              );
                            })}
                            <Link
                              href="/tasks/projects"
                              className="flex items-center gap-2 px-2 py-1 rounded-lg text-xs text-white/30 hover:text-white/60 transition-colors"
                            >
                              <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" />
                              <span>Ver todos</span>
                            </Link>
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                )}

                {/* Status group — single collapsible nav with rooms + create CTA */}
                {section.title === 'Proyectos' && hasPermission('status') && (
                  <div className="mt-1">
                    {!isCollapsed ? (
                      <>
                        <div
                          className={cn(
                            "flex items-stretch rounded-xl text-sm transition-all duration-200 group relative",
                            isStatusActive && !currentPath.includes('/')
                              ? "bg-white/10 text-white"
                              : "text-white/60 hover:text-white hover:bg-white/10",
                          )}
                        >
                          <Link
                            href="/review"
                            className="flex items-center flex-1 min-w-0 px-3 py-2.5 rounded-l-xl"
                          >
                            <ClipboardList className="h-4 w-4 flex-shrink-0 mr-3" />
                            <span className="truncate font-medium flex-1">Status</span>
                            {totalReviewPending > 0 && (
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "h-4 px-1.5 text-xs font-medium ml-2",
                                  currentPath === '/review'
                                    ? "bg-white/20 text-white"
                                    : "bg-amber-500/20 text-amber-300",
                                )}
                              >
                                {totalReviewPending}
                              </Badge>
                            )}
                          </Link>
                          <button
                            onClick={() => setReviewsExpanded((v) => !v)}
                            className="flex items-center justify-center px-2 rounded-r-xl hover:bg-black/10 transition-colors"
                            aria-label={reviewsExpanded ? 'Colapsar salas' : 'Expandir salas'}
                          >
                            {reviewsExpanded
                              ? <ChevronDown className="h-3.5 w-3.5" />
                              : <ChevronRight className="h-3.5 w-3.5" />}
                          </button>
                        </div>

                        {reviewsExpanded && (
                          <div className="space-y-0.5 mt-1 ml-2 pl-2 border-l border-white/10">
                            {sidebarRooms.length === 0 && (
                              <div className="px-2 py-1 text-[10px] text-white/30 italic">
                                Sin salas todavía
                              </div>
                            )}
                            {sidebarRooms.map((room) => {
                              const color = roomColor(room.colorIndex);
                              const isActive = currentPath === `/review/${room.id}`;
                              const isPrivate = room.privacy === 'private';
                              return (
                                <Link
                                  key={room.id}
                                  href={`/review/${room.id}`}
                                  className={cn(
                                    "flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all duration-150",
                                    isActive
                                      ? "bg-white/10 text-white font-semibold"
                                      : "text-white/60 hover:text-white hover:bg-white/10",
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "inline-flex flex-shrink-0 items-center justify-center rounded-md text-white font-bold w-5 h-5 text-[10px]",
                                      color.chip,
                                    )}
                                  >
                                    {room.emoji || room.name.charAt(0).toUpperCase()}
                                  </span>
                                  <span className="truncate flex-1 font-medium">{room.name}</span>
                                  {isPrivate && (
                                    <span
                                      className="text-[9px] font-semibold uppercase tracking-wide text-white/40 flex-shrink-0"
                                      title="Sala personal"
                                    >
                                      Tú
                                    </span>
                                  )}
                                  {room.unreadCommentsCount > 0 && (
                                    <span
                                      className={cn(
                                        "inline-flex items-center gap-0.5 h-4 px-1.5 rounded-full text-[9px] font-bold flex-shrink-0",
                                        isActive ? "bg-white/20 text-white" : "bg-white/10 text-white/60",
                                      )}
                                      title={`${room.unreadCommentsCount} comentario${room.unreadCommentsCount === 1 ? '' : 's'} nuevo${room.unreadCommentsCount === 1 ? '' : 's'}`}
                                    >
                                      <MessageSquare className="h-2.5 w-2.5" />
                                      {room.unreadCommentsCount}
                                    </span>
                                  )}
                                  {room.pendingCount > 0 && (
                                    <span
                                      className={cn(
                                        "h-4 min-w-[16px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center flex-shrink-0",
                                        isActive ? "bg-white/20 text-white" : "bg-amber-500/20 text-amber-300",
                                      )}
                                      title={`${room.pendingCount} decisión${room.pendingCount === 1 ? '' : 'es'} pendiente${room.pendingCount === 1 ? '' : 's'}`}
                                    >
                                      {room.pendingCount}
                                    </span>
                                  )}
                                </Link>
                              );
                            })}
                            {reviewRooms.length > MAX_SIDEBAR_ROOMS && (
                              <Link
                                href="/review"
                                className="flex items-center gap-2 px-2 py-1 rounded-lg text-xs text-white/30 hover:text-white/60 transition-colors"
                              >
                                <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" />
                                <span>Ver todas ({reviewRooms.length})</span>
                              </Link>
                            )}
                            <button
                              onClick={() => setNewReviewOpen(true)}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 transition-colors font-medium"
                            >
                              <span className="inline-flex flex-shrink-0 items-center justify-center rounded-md w-5 h-5 border border-dashed border-indigo-300 text-indigo-500">
                                <Plus className="h-3 w-3" />
                              </span>
                              <span>Nueva sala de status</span>
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link
                              href="/review"
                              className={cn(
                                "flex items-center justify-center px-2 py-2.5 rounded-xl transition-all duration-200 relative",
                                isStatusActive
                                  ? "bg-white/10 text-white"
                                  : "text-white/60 hover:text-white hover:bg-white/10",
                              )}
                            >
                              <ClipboardList className="h-4 w-4" />
                              {totalReviewPending > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 h-3.5 min-w-[14px] px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
                                  {totalReviewPending}
                                </span>
                              )}
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="right">Status{totalReviewPending > 0 ? ` (${totalReviewPending})` : ''}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#0b0f17] to-transparent" />
        </div>

        {/* Footer */}
        <div className="relative z-10 border-t border-white/[0.07] px-3 py-3">
          {!isCollapsed && (
            <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.035] px-2.5 py-2">
              <Avatar className="h-7 w-7 border border-white/10">
                <AvatarFallback className="bg-white/10 text-[9px] font-bold text-white">
                  {getUserInitials()}
                </AvatarFallback>
                {user?.avatar && <AvatarImage src={user.avatar} />}
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold text-white/75">
                  {user ? `${user.firstName} ${user.lastName}` : "Mind"}
                </p>
                <p className="truncate text-[9px] uppercase tracking-[0.12em] text-white/28">Powered by Epical</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <CreateReviewDialog open={newReviewOpen} onClose={() => setNewReviewOpen(false)} />
    </TooltipProvider>
  );
}
