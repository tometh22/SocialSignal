import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { Logo } from "@/components/ui/logo";
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
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
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

  // Toggle para secciones expandibles
  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };
  
  // Función para obtener las iniciales del usuario
  const getUserInitials = () => {
    if (!user) return "US";
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;
  };

  // Categorías de navegación
  const navCategories = {
    principal: [
      { href: "/", title: "Dashboard Ejecutivo", icon: LayoutDashboard, description: "Vista general del negocio" },
    ],
    operaciones: [
      { href: "/optimized-quote", title: "Nueva Cotización", icon: Plus, status: 'new' as const, description: "Crear propuesta comercial" },
      { href: "/manage-quotes", title: "Gestionar Cotizaciones", icon: FileText, description: "Revisar propuestas" },
      { href: "/active-projects", title: "Proyectos Activos", icon: Briefcase, badge: projectCount.toString(), description: "Proyectos en curso" },
    ],
    clientes: [
      { href: "/clients", title: "Clientes", icon: Building2, description: "Base de clientes" },
      { href: "/statistics", title: "Análisis", icon: BarChart3, description: "Métricas y reportes" },
    ],
    automatizacion: [
      { href: "/recurring-templates", title: "Always-On", icon: Zap, status: 'new' as const, description: "Servicios recurrentes" },
    ],
    sistema: [
      { href: "/admin", title: "Configuración", icon: Settings, description: "Panel administrativo" },
    ],
  };

  // Renderizar enlace de navegación
  const renderNavLink = (item: NavItem) => {
    const Icon = item.icon || LayoutDashboard;
    const isActive = currentPath === item.href;
    
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center px-3 py-3 rounded-lg text-sm transition-all duration-200 relative group",
          isActive
            ? "bg-blue-50 text-blue-700 font-medium shadow-sm border border-blue-200"
            : "text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-transparent",
          isCollapsed && "justify-center py-3"
        )}
      >
        <div className="flex items-center flex-1 min-w-0">
          <Icon className={cn("h-5 w-5 flex-shrink-0", isCollapsed ? "mx-auto" : "mr-3")} />
          
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="truncate font-medium">{item.title}</span>
                <div className="flex items-center gap-1 ml-2">
                  {item.badge && (
                    <Badge 
                      variant="secondary" 
                      className="h-5 px-1.5 text-xs bg-gray-200 text-gray-700 hover:bg-gray-300"
                    >
                      {item.badge}
                    </Badge>
                  )}
                  {item.status === 'new' && (
                    <Badge 
                      variant="default" 
                      className="h-5 px-1.5 text-xs bg-green-500 text-white"
                    >
                      Nuevo
                    </Badge>
                  )}
                </div>
              </div>
              {item.description && (
                <p className="text-xs text-gray-500 mt-0.5 truncate">{item.description}</p>
              )}
            </div>
          )}
        </div>
      </Link>
    );
  };

  return (
    <TooltipProvider>
      <div className={cn(
        "flex flex-col h-screen bg-white border-r border-gray-200 transition-all duration-300",
        isCollapsed ? "w-16" : "w-72"
      )}>
        {/* Header con logo y controles */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              <Logo className="h-8 w-8" />
              <div>
                <h1 className="text-lg font-bold text-gray-900">Mind</h1>
                <p className="text-xs text-gray-500">Epical Digital</p>
              </div>
            </div>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className={cn("h-4 w-4 transition-transform", isCollapsed ? "" : "rotate-180")} />
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex flex-col flex-grow overflow-y-auto px-3 py-5 space-y-6">
          {/* Principal */}
          <div>
            <div className={cn("flex items-center mb-2 px-2", isCollapsed && "justify-center")}>
              <h3 className={cn("text-xs font-semibold text-gray-500 tracking-wider", isCollapsed ? "sr-only" : "uppercase")}>
                Principal
              </h3>
            </div>
            <nav className="space-y-2">
              {navCategories.principal.map((item) => renderNavLink(item))}
            </nav>
          </div>
          
          {/* Operaciones */}
          <div>
            <div className={cn("flex items-center mb-2 px-2", isCollapsed && "justify-center")}>
              <h3 className={cn("text-xs font-semibold text-gray-500 tracking-wider", isCollapsed ? "sr-only" : "uppercase")}>
                Flujo de Trabajo
              </h3>
            </div>
            <nav className="space-y-2">
              {navCategories.operaciones.map((item) => renderNavLink(item))}
            </nav>
          </div>
          
          {/* Clientes */}
          <div>
            <div className={cn("flex items-center mb-2 px-2", isCollapsed && "justify-center")}>
              <h3 className={cn("text-xs font-semibold text-gray-500 tracking-wider", isCollapsed ? "sr-only" : "uppercase")}>
                Clientes
              </h3>
            </div>
            <nav className="space-y-2">
              {navCategories.clientes.map((item) => renderNavLink(item))}
            </nav>
          </div>
          
          {/* Automatización */}
          <div>
            <div className={cn("flex items-center mb-2 px-2", isCollapsed && "justify-center")}>
              <h3 className={cn("text-xs font-semibold text-gray-500 tracking-wider", isCollapsed ? "sr-only" : "uppercase")}>
                Automatización
              </h3>
            </div>
            <nav className="space-y-2">
              {navCategories.automatizacion.map((item) => renderNavLink(item))}
            </nav>
          </div>
          
          {/* Sistema */}
          <div>
            <div className={cn("flex items-center mb-2 px-2", isCollapsed && "justify-center")}>
              <h3 className={cn("text-xs font-semibold text-gray-500 tracking-wider", isCollapsed ? "sr-only" : "uppercase")}>
                Sistema
              </h3>
            </div>
            <nav className="space-y-2">
              {navCategories.sistema.map((item) => renderNavLink(item))}
            </nav>
          </div>
        </div>

        {/* Footer con usuario */}
        <div className="border-t border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.avatar || ""} />
              <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-semibold">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-500 truncate">Administrador</p>
              </div>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              className="h-8 w-8 p-0"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}