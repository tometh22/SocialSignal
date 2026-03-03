import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions, AppSection } from "@/hooks/use-permissions";
import { Badge } from "@/components/ui/badge";
import { authFetch } from "@/lib/queryClient";

import {
  ChevronRight,
  LayoutDashboard,
  FileText,
  Briefcase,
  Building2,
  Settings,
  LogOut,
  Target,
  Plus,
  Bell,
  AlertCircle,
  Clock,
  Users,
  CheckSquare,
  CalendarDays,
  BarChart2,
} from "lucide-react";

type NavItem = {
  href: string;
  title: string;
  icon: any;
  badge?: string;
  status?: 'new';
  description?: string;
  permission?: AppSection;
};

type DueReminder = {
  id: number;
  description: string;
  dueDate: string;
  leadId: number;
  leadName: string | null;
  isOverdue: boolean;
};

export default function SidebarFixed() {
  const { user, logoutMutation } = useAuth();
  const { hasPermission } = usePermissions();
  const [currentPath] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [projectCount, setProjectCount] = useState(0);
  const [crmOverdue, setCrmOverdue] = useState(0);
  const [dueReminders, setDueReminders] = useState<DueReminder[]>([]);
  const [bellOpen, setBellOpen] = useState(false);

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

  const fetchDueReminders = async () => {
    try {
      const response = await authFetch('/api/crm/reminders/due');
      if (response.ok) {
        const data = await response.json();
        setDueReminders(data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchProjectCount();
    fetchCrmStats();
    fetchDueReminders();
    const interval = setInterval(() => {
      fetchProjectCount();
      fetchCrmStats();
      fetchDueReminders();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const getUserInitials = () => {
    if (!user) return "US";
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;
  };

  const isAdmin = (user as any)?.isAdmin;

  const navSections = [
    {
      title: "Principal",
      items: [
        { href: "/", title: "Dashboard Ejecutivo", icon: LayoutDashboard, description: "Resumen general y KPIs", permission: 'dashboard' as AppSection }
      ]
    },
    {
      title: "Gestión Comercial",
      items: [
        { href: "/optimized-quote", title: "Nueva Cotización", icon: Plus, status: 'new' as const, description: "Crear cotización", permission: 'quotations' as AppSection },
        { href: "/crm", title: "CRM Ventas", icon: Target, badge: crmOverdue > 0 ? crmOverdue.toString() : undefined, description: "Pipeline y seguimiento de prospectos", permission: 'crm' as AppSection },
        { href: "/quotations", title: "Cotizaciones", icon: FileText, description: "Gestionar cotizaciones", permission: 'quotations' as AppSection },
        { href: "/clients", title: "Clientes", icon: Building2, description: "Base de clientes", permission: 'crm' as AppSection }
      ]
    },
    {
      title: "Gestión Operacional",
      items: [
        { href: "/active-projects", title: "Proyectos Activos", icon: Briefcase, badge: projectCount.toString(), description: "Proyectos en curso", permission: 'projects' as AppSection }
      ]
    },
    {
      title: "Gestión de Tareas",
      items: [
        { href: "/tasks/my-tasks", title: "Mis Tareas", icon: CheckSquare, description: "Tus tareas asignadas", permission: 'projects' as AppSection },
        { href: "/tasks/team-calendar", title: "Calendario Equipo", icon: CalendarDays, description: "Vista de tareas del equipo", permission: 'projects' as AppSection },
        { href: "/tasks/hours-dashboard", title: "Panel de Horas", icon: BarChart2, description: "Horas consolidadas por persona y proyecto", permission: 'projects' as AppSection },
      ]
    },
    {
      title: "Herramientas",
      items: [
        { href: "/admin/users", title: "Gestión de Usuarios", icon: Users, description: "Usuarios y permisos", permission: 'admin' as AppSection },
        { href: "/admin", title: "Configuración", icon: Settings, description: "Administración", permission: 'admin' as AppSection }
      ]
    }
  ];

  const filteredNavSections = navSections.map(section => ({
    ...section,
    items: section.items.filter(item =>
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
              className={cn(
                "flex items-center px-3 py-2.5 rounded-xl text-sm transition-all duration-200 relative group",
                isActive
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "text-muted-foreground hover:text-white hover:bg-gradient-to-r hover:from-purple-500 hover:to-purple-600 border border-transparent",
                isCollapsed && "justify-center px-2"
              )}
            >
              <div className="flex items-center flex-1 min-w-0">
                <Icon className={cn("h-4 w-4 flex-shrink-0", isCollapsed ? "mx-auto" : "mr-3")} />

                {!isCollapsed && (
                  <div className="flex items-center justify-between flex-1">
                    <span className="truncate font-medium">{item.title}</span>
                    <div className="flex items-center gap-1.5 ml-2">
                      {item.badge && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "h-4 px-1.5 text-xs font-medium",
                            isActive
                              ? "bg-primary-foreground/20 text-primary-foreground"
                              : "bg-primary/10 text-primary"
                          )}
                        >
                          {item.badge}
                        </Badge>
                      )}
                      {item.status === 'new' && (
                        <div className={cn(
                          "h-2 w-2 rounded-full",
                          isActive ? "bg-primary-foreground" : "bg-green-500"
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

  const totalDue = dueReminders.length;
  const overdueCount = dueReminders.filter(r => r.isOverdue).length;

  return (
    <TooltipProvider>
      <div className={cn(
        "flex flex-col h-screen bg-background border-r border-border transition-all duration-300 shadow-sm",
        isCollapsed ? "w-16" : "w-64"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-2.5 border-b border-border">
          {!isCollapsed && (
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center shadow-sm">
                <span className="text-primary-foreground text-sm font-bold">M</span>
              </div>
              <h1 className="text-base font-bold text-foreground">Mind</h1>
            </div>
          )}

          <div className="flex items-center gap-1">
            {/* Bell icon with popover */}
            <Popover open={bellOpen} onOpenChange={setBellOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-accent relative"
                >
                  <Bell className={cn("h-3.5 w-3.5", totalDue > 0 ? "text-amber-500" : "text-muted-foreground")} />
                  {totalDue > 0 && (
                    <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                      {totalDue > 9 ? "9+" : totalDue}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side="right"
                align="start"
                className="w-80 p-0 shadow-lg"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-amber-500" />
                    <span className="font-semibold text-sm">Recordatorios</span>
                  </div>
                  {totalDue > 0 && (
                    <Badge variant="destructive" className="text-xs h-5 px-1.5">
                      {totalDue}
                    </Badge>
                  )}
                </div>

                {totalDue === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                    <Bell className="h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">Sin recordatorios pendientes</p>
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto divide-y divide-border">
                    {dueReminders.map((reminder) => (
                      <Link
                        key={reminder.id}
                        href={`/crm/${reminder.leadId}`}
                        onClick={() => setBellOpen(false)}
                        className="block px-4 py-3 hover:bg-accent transition-colors cursor-pointer"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className={cn(
                            "mt-0.5 flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center",
                            reminder.isOverdue
                              ? "bg-red-100 text-red-600"
                              : "bg-amber-100 text-amber-600"
                          )}>
                            {reminder.isOverdue
                              ? <AlertCircle className="h-3 w-3" />
                              : <Clock className="h-3 w-3" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-xs font-semibold truncate",
                              reminder.isOverdue ? "text-red-600" : "text-amber-600"
                            )}>
                              {reminder.leadName || `Lead #${reminder.leadId}`}
                            </p>
                            <p className="text-xs text-foreground truncate mt-0.5">
                              {reminder.description}
                            </p>
                            <p className={cn(
                              "text-xs mt-1 font-medium",
                              reminder.isOverdue ? "text-red-500" : "text-amber-500"
                            )}>
                              {reminder.isOverdue ? "Vencido — " : "Vence "}{new Date(reminder.dueDate).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </PopoverContent>
            </Popover>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-6 w-6 p-0 hover:bg-accent"
            >
              <ChevronRight className={cn("h-3 w-3 transition-transform text-muted-foreground", isCollapsed ? "" : "rotate-180")} />
            </Button>
          </div>
        </div>

        {/* Navegación principal organizada por secciones */}
        <div className="flex-1 px-2 py-3 overflow-y-auto">
          <nav className="space-y-4">
            {filteredNavSections.map((section) => (
              <div key={section.title}>
                {!isCollapsed && (
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
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

        {/* Footer */}
        <div className="border-t border-border p-2">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={user?.avatar || ""} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>

            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <div className="flex items-center gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500"></div>
                  <span className="text-xs text-muted-foreground">
                    {isAdmin ? "Administrador" : "Online"}
                  </span>
                </div>
              </div>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => logoutMutation.mutate()}
                  className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Cerrar sesión
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
