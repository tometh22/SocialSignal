import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import {
  FINANCE_SUMMARY_ACCESS_SECTIONS,
  HOME_ACCESS_SECTIONS,
  HOURS_DASHBOARD_ACCESS_SECTIONS,
  usePermissions,
  AppSection,
} from "@/hooks/use-permissions";
import { Badge } from "@/components/ui/badge";
import { authFetch } from "@/lib/queryClient";
import { reviewApi, reviewKeys, type ReviewRoomSummary } from "@/lib/review-api";
import BrandMark from "@/components/layout/brand-mark";

import {
  ChevronRight,
  LayoutDashboard,
  FileText,
  Briefcase,
  Building2,
  Settings,
  Target,
  Users,
  CheckSquare,
  BarChart2,
  Home,
  ClipboardList,
  Gauge,
  CalendarCheck,
  Calendar,
  Receipt,
  UserX,
  CircleArrowDown,
  CircleArrowUp,
  Wallet,
  ShieldAlert,
  Database,
  BookOpen,
} from "lucide-react";

type NavItem = {
  href: string;
  title: string;
  icon: any;
  badge?: string;
  status?: 'new';
  description?: string;
  permission?: AppSection;
  anyPermissions?: readonly AppSection[];
};

interface SidebarFixedProps {
  mobileMode?: boolean;
}

export default function SidebarFixed({ mobileMode = false }: SidebarFixedProps = {}) {
  const { user } = useAuth();
  const { hasPermission, hasAnyPermission, isOperations } = usePermissions();
  const [currentPath] = useLocation();
  // En mobile (dentro del drawer) nunca está colapsado - el cierre se hace cerrando el drawer
  const [isCollapsedState, setIsCollapsed] = useState(false);
  const isCollapsed = mobileMode ? false : isCollapsedState;
  const [projectCount, setProjectCount] = useState(0);
  const [crmOverdue, setCrmOverdue] = useState(0);
  const canSeeProjects = hasPermission("projects") && isOperations;
  const canSeeCrm = hasPermission("crm");

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
    if (canSeeProjects) fetchProjectCount();
    else setProjectCount(0);
    if (canSeeCrm) fetchCrmStats();
    else setCrmOverdue(0);
    if (!canSeeProjects && !canSeeCrm) return;

    const interval = setInterval(() => {
      if (canSeeProjects) fetchProjectCount();
      if (canSeeCrm) fetchCrmStats();
    }, 60000);
    return () => clearInterval(interval);
  }, [canSeeCrm, canSeeProjects]);

  const getUserInitials = () => {
    if (!user) return "US";
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;
  };

  const { data: rawReviewRooms } = useQuery<ReviewRoomSummary[]>({
    queryKey: reviewKeys.list(),
    queryFn: reviewApi.listRooms,
    staleTime: 60000,
    enabled: hasPermission('status'),
  });
  const reviewRooms: ReviewRoomSummary[] = Array.isArray(rawReviewRooms) ? rawReviewRooms : [];
  const totalReviewPending = reviewRooms.reduce((acc, r) => acc + (r.pendingCount || 0), 0);

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
        { href: "/", title: "Inicio", icon: Home, description: "Resumen personal", anyPermissions: HOME_ACCESS_SECTIONS },
        { href: "/absences", title: "Mis ausencias", icon: UserX, description: "Solicitudes y saldos", anyPermissions: HOME_ACCESS_SECTIONS },
      ]
    },
    {
      title: "Comercial",
      items: [
        { href: "/crm", title: "CRM", icon: Target, badge: crmOverdue > 0 ? crmOverdue.toString() : undefined, description: "Pipeline comercial", permission: 'crm' as AppSection },
        { href: "/clients", title: "Clientes", icon: Building2, description: "Base de clientes", permission: 'crm' as AppSection },
        { href: "/quotations", title: "Cotizaciones", icon: FileText, description: "Gestionar cotizaciones", permission: 'quotations' as AppSection },
      ]
    },
    {
      title: "Proyectos",
      items: [
        { href: isOperations ? "/active-projects" : "/tasks/projects", title: isOperations ? "Proyectos" : "Mis proyectos", icon: Briefcase, badge: projectCount > 0 ? projectCount.toString() : undefined, description: isOperations ? "Gestión y rentabilidad" : "Proyectos activos asignados", permission: 'projects' as AppSection },
        { href: "/tasks", title: "Tareas", icon: CheckSquare, description: "Gestión de tareas", permission: 'projects' as AppSection },
        { href: "/review", title: "Status", icon: ClipboardList, badge: totalReviewPending > 0 ? totalReviewPending.toString() : undefined, description: "Seguimiento y decisiones", permission: 'status' as AppSection },
      ]
    },
    {
      title: "Operaciones",
      items: [
        { href: "/tasks/hours-dashboard", title: "Panel de horas", icon: BarChart2, description: "Horas por persona y proyecto", anyPermissions: HOURS_DASHBOARD_ACCESS_SECTIONS },
        { href: "/operations/capacity", title: "Capacidad", icon: Gauge, description: "Capacidad semanal del equipo", permission: 'operations' as AppSection },
        { href: "/operations/monthly-closing", title: "Cierre mensual", icon: CalendarCheck, description: "Cierre de horas del mes", permission: 'operations' as AppSection },
        { href: "/operations/holidays", title: "Feriados", icon: Calendar, description: "Gestión de feriados", permission: 'operations' as AppSection },
      ]
    },
    {
      title: "Finanzas",
      items: [
        { href: "/dashboard", title: "Resumen financiero", icon: LayoutDashboard, description: "KPIs económicos y operativos", anyPermissions: FINANCE_SUMMARY_ACCESS_SECTIONS },
        { href: "/finance/cashflow", title: "Cashflow", icon: Wallet, description: "Movimientos y saldos bancarios", permission: 'finance' as AppSection },
        { href: "/finance/activo", title: "Activo", icon: CircleArrowUp, description: "Cuentas a cobrar y activos líquidos", permission: 'finance' as AppSection },
        { href: "/finance/pasivo", title: "Pasivo", icon: CircleArrowDown, description: "Cuentas a pagar y deudas", permission: 'finance' as AppSection },
        { href: "/finance/provisions", title: "Provisiones", icon: ShieldAlert, description: "Provisiones y contingencias", permission: 'finance' as AppSection },
      ]
    },
    {
      title: "Administración",
      items: [
        { href: "/admin", title: "Configuración", icon: Settings, description: "Administración general", permission: 'admin' as AppSection },
        { href: "/admin/users", title: "Usuarios", icon: Users, description: "Usuarios y permisos", permission: 'admin' as AppSection },
        { href: "/admin/providers", title: "Proveedores", icon: Building2, description: "Proveedores externos y su acceso a proyectos", permission: 'admin' as AppSection },
        { href: "/admin/data-sources", title: "Fuentes de datos", icon: Database, description: "Origen de los datos", permission: 'admin' as AppSection },
        { href: "/admin/definitions", title: "Definiciones", icon: BookOpen, description: "Reglas de producto versionadas", permission: 'admin' as AppSection },
      ]
    }
  ];

  const filteredNavSections = navSections.map(section => ({
    ...section,
    items: section.items.filter((item: NavItem) =>
      (!item.permission || hasPermission(item.permission))
      && (!item.anyPermissions || hasAnyPermission(item.anyPermissions))
    )
  })).filter(section => section.items.length > 0);
  const visibleNavItems = filteredNavSections.flatMap(section => section.items);

  const renderNavLink = (item: NavItem) => {
    const Icon = item.icon || LayoutDashboard;
    const matchesPath = (href: string) =>
      currentPath === href || (href !== "/" && currentPath.startsWith(`${href}/`));
    const isActive = matchesPath(item.href)
      && !visibleNavItems.some(candidate =>
        candidate.href !== item.href
        && candidate.href.length > item.href.length
        && matchesPath(candidate.href)
      );

    return (
      <TooltipProvider key={item.href}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={item.href}
              title={isCollapsed ? item.title : undefined}
              className={cn(
                "relative flex min-h-11 items-center rounded-xl px-3 py-2 text-[13px] transition-all duration-200 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50",
                isActive
                  ? "bg-gradient-to-r from-white/[0.14] to-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  : "text-white/[0.68] hover:text-white hover:bg-white/[0.075]",
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
                className="h-11 w-11 p-0 text-white/50 hover:bg-white/10 hover:text-white"
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
                  <h3 className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.15em] text-white/[0.58]">
                    {section.title}
                  </h3>
                )}
                <div className="space-y-1">
                  {section.items.map((item) => renderNavLink(item))}
                </div>
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
                <p className="truncate text-[9px] uppercase tracking-[0.12em] text-white/[0.52]">Powered by Epical</p>
              </div>
            </div>
          )}
        </div>
      </div>

    </TooltipProvider>
  );
}
