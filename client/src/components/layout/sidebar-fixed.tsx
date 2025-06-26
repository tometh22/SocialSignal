import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";

import {
  ChevronRight,
  Activity,
  LayoutDashboard,
  FileText,
  ListChecks,
  Briefcase,
  Users,
  BarChart3,
  Settings,
  ChevronDown,
  LogOut,
  Star,
  Zap,
  Building2,
  Target,
  TrendingUp,
  Calendar,
  Plus,
  Layers,
} from "lucide-react";

// Tipo para elementos de navegación
type NavItem = {
  href: string;
  title: string;
  icon: any;
  badge?: string;
  status?: 'new';
  description?: string;
};

export default function SidebarFixed() {
  const { user, logoutMutation } = useAuth();
  const [currentPath] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [projectCount, setProjectCount] = useState(0);

  // Función para obtener el conteo real
  const fetchProjectCount = async () => {
    try {
      const response = await fetch('/api/active-projects/count?' + Date.now());
      if (response.ok) {
        const data = await response.json();
        setProjectCount(data.count);
      }
    } catch (error) {
      console.error('Error fetching project count:', error);
      setProjectCount(0);
    }
  };

  // Actualizar inmediatamente y cada 2 segundos
  useEffect(() => {
    fetchProjectCount();
    const interval = setInterval(fetchProjectCount, 2000);
    return () => clearInterval(interval);
  }, []);

  // Función para obtener las iniciales del usuario
  const getUserInitials = () => {
    if (!user) return "US";
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;
  };

  // Navegación compacta sin secciones expandibles
  const navItems = [
    { href: "/", title: "Dashboard", icon: LayoutDashboard },
    { href: "/optimized-quote", title: "Nueva Cotización", icon: Plus, status: 'new' as const },
    { href: "/manage-quotes", title: "Cotizaciones", icon: FileText },
    { href: "/active-projects", title: "Proyectos", icon: Briefcase, badge: projectCount.toString() },
    { href: "/clients", title: "Clientes", icon: Building2 },
    { href: "/statistics", title: "Análisis", icon: BarChart3 },
    { href: "/admin", title: "Configuración", icon: Settings },
  ];

  // Renderizar enlace de navegación compacto
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

  return (
    <TooltipProvider>
      <div className={cn(
        "flex flex-col h-screen bg-background border-r border-border transition-all duration-300 shadow-sm",
        isCollapsed ? "w-16" : "w-64"
      )}>
        {/* Header minimalista */}
        <div className="flex items-center justify-between p-2.5 border-b border-border">
          {!isCollapsed && (
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center shadow-sm">
                <span className="text-primary-foreground text-sm font-bold">M</span>
              </div>
              <h1 className="text-base font-bold text-foreground">Mind</h1>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-6 w-6 p-0 hover:bg-accent"
          >
            <ChevronRight className={cn("h-3 w-3 transition-transform text-muted-foreground", isCollapsed ? "" : "rotate-180")} />
          </Button>
        </div>

        {/* Navegación principal - sin scroll, altura fija */}
        <div className="flex-1 px-2 py-3">
          <nav className="space-y-1">
            {navItems.map((item) => renderNavLink(item))}
          </nav>
        </div>

        {/* Footer minimalista */}
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
                  <span className="text-xs text-muted-foreground">Online</span>
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