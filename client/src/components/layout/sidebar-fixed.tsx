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
    { href: "/recurring-templates", title: "Always-On", icon: Zap, status: 'new' as const },
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
                  ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/25"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-transparent",
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
                              ? "bg-white/20 text-white border-white/30" 
                              : "bg-blue-100 text-blue-700"
                          )}
                        >
                          {item.badge}
                        </Badge>
                      )}
                      {item.status === 'new' && (
                        <div className={cn(
                          "h-2 w-2 rounded-full",
                          isActive ? "bg-white" : "bg-green-500"
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
        "flex flex-col h-screen bg-gradient-to-b from-slate-50 to-white border-r border-slate-200/60 transition-all duration-300 shadow-xl",
        isCollapsed ? "w-16" : "w-64"
      )}>
        {/* Header ultra compacto */}
        <div className="flex items-center justify-between p-3 border-b border-slate-200/50">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
                <span className="text-white text-sm font-bold">M</span>
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-900">Mind</h1>
                <p className="text-xs text-slate-500">Epical Digital</p>
              </div>
            </div>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-7 w-7 p-0 hover:bg-slate-100"
          >
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform text-slate-500", isCollapsed ? "" : "rotate-180")} />
          </Button>
        </div>

        {/* Navegación principal - sin scroll, altura fija */}
        <div className="flex-1 px-2 py-3">
          <nav className="space-y-1">
            {navItems.map((item) => renderNavLink(item))}
          </nav>
        </div>

        {/* Status bar compacto */}
        {!isCollapsed && (
          <div className="px-3 py-2 border-t border-slate-200/50">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <span>Sistema operativo</span>
            </div>
          </div>
        )}

        {/* Footer ultra compacto */}
        <div className="border-t border-slate-200/50 p-2">
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7">
              <AvatarImage src={user?.avatar || ""} />
              <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-white text-xs font-semibold">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-900 truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-slate-500 truncate">Admin</p>
              </div>
            )}
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => logoutMutation.mutate()}
                  className="h-7 w-7 p-0 hover:bg-red-50 hover:text-red-600"
                >
                  <LogOut className="h-3.5 w-3.5" />
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