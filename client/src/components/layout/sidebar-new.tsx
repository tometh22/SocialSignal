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
import { useQuery, useQueryClient } from "@tanstack/react-query";

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
  highlight?: boolean;
};

export default function Sidebar() {
  const { user, logoutMutation } = useAuth();
  const [currentPath] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Consulta para obtener el número real de proyectos activos usando la ruta específica
  const { data: projectCountData = { count: 0 } } = useQuery({
    queryKey: ['/api/active-projects/count'],
    queryFn: async () => {
      try {
        console.log('Fetching project count...');
        const response = await fetch('/api/active-projects/count');
        if (!response.ok) throw new Error('Error fetching project count');
        const data = await response.json();
        console.log('Project count response:', data);
        return data;
      } catch (error) {
        console.error('Error fetching project count:', error);
        return { count: 0 };
      }
    },
    staleTime: 5000, // 5 segundos para testing
    refetchInterval: 10000, // Actualizar cada 10 segundos para testing
  });

  // Debug query para verificar datos
  const { data: debugData } = useQuery({
    queryKey: ['/api/active-projects/debug'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/active-projects/debug');
        if (!response.ok) return null;
        const data = await response.json();
        console.log('Debug data:', data);
        return data;
      } catch (error) {
        console.error('Debug query error:', error);
        return null;
      }
    },
    staleTime: 5000,
  });

  const projectCount = projectCountData.count;

  // Log para debugging
  console.log('Sidebar - Project count:', projectCount);
  console.log('Sidebar - Debug data:', debugData);

  // Toggle para secciones expandibles
  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Función para obtener las iniciales del usuario
  const getUserInitials = () => {
    if (!user) return "US";
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;
  };

  // Categorías de navegación modernizadas
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

  // Renderizar enlace de navegación modernizado
  const renderNavLink = (item: NavItem) => {
    const Icon = item.icon || LayoutDashboard;
    const isActive = currentPath === item.href;

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "group flex items-center px-3 py-2.5 my-1 text-sm font-medium rounded-lg transition-all duration-200 ease-in-out relative overflow-hidden",
          isActive
            ? "bg-gradient-to-r from-sidebar-primary/20 to-sidebar-primary/10 text-sidebar-primary shadow-[inset_0_0_0_1px_rgba(var(--sidebar-primary)/0.3),_0_2px_8px_rgba(var(--sidebar-primary)/0.15)] before:absolute before:inset-0 before:bg-gradient-to-r before:from-sidebar-primary/5 before:to-transparent"
            : "text-sidebar-foreground/80 hover:bg-gradient-to-r hover:from-purple-500/90 hover:to-purple-600/90 hover:text-white hover:shadow-[0_2px_8px_rgba(147,51,234,0.25)] hover:scale-[1.02] hover:translate-x-1",
          isCollapsed && "justify-center px-2"
        )}
      >
        <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 ease-in-out relative",
                isActive 
                  ? "bg-gradient-to-br from-sidebar-primary to-sidebar-primary/80 text-white shadow-[0_4px_12px_rgba(var(--sidebar-primary)/0.4),_inset_0_1px_0_rgba(255,255,255,0.2)]" 
                  : "bg-sidebar-border/20 text-sidebar-foreground/70 group-hover:text-white group-hover:bg-gradient-to-br group-hover:from-purple-400/30 group-hover:to-purple-500/30 group-hover:shadow-[0_2px_8px_rgba(147,51,234,0.3)] group-hover:scale-110"
              )}>
          <Icon className="h-4 w-4" />
        </div>

        {!isCollapsed && (
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className={cn(
                "truncate font-medium transition-colors duration-200",
                isActive ? "text-blue-600" : "text-gray-900 group-hover:text-white"
              )}>
                {item.title}
              </span>
              <div className="flex items-center gap-2">
                {item.badge && (
                  <Badge variant="secondary" className="text-xs">
                    {item.badge}
                  </Badge>
                )}
                {item.status === 'new' && (
                  <Badge variant="default" className="text-xs bg-blue-600">
                    Nuevo
                  </Badge>
                )}
              </div>
            </div>
            {item.description && (
              <p className={cn(
                "text-xs truncate transition-colors duration-200",
                isActive ? "text-blue-600/70" : "text-gray-500 group-hover:text-white/90"
              )}>
                {item.description}
              </p>
            )}
          </div>
        )}

        {isCollapsed && item.status === 'new' && (
          <span className="absolute right-0.5 top-0.5 w-1.5 h-1.5 rounded-full bg-blue-600"></span>
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Overlay para móvil - visible cuando la barra lateral está abierta */}
      {isOpen && !isCollapsed && (
        <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
           onClick={() => setIsOpen(false)} />
      )}

      {/* Barra lateral modernizada */}
      <motion.div
        className={cn(
          "sidebar fixed top-0 bottom-0 left-0 z-50 h-screen flex-col flex-shrink-0 bg-white border-r border-gray-200 shadow-xl md:shadow-lg md:relative md:z-0 md:flex",
          isCollapsed ? "w-[72px]" : "w-[280px]",
          isOpen ? "flex" : "hidden md:flex"
        )}
        initial={false}
        animate={{ 
          width: isCollapsed ? 72 : 280,
          transition: { duration: 0.2 }
        }}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header modernizado con logo */}
          <div className={cn(
            "flex items-center justify-between py-5 px-4 border-b border-gray-200",
            isCollapsed && "justify-center"
          )}>
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                <span className="text-white font-bold text-lg">M</span>
              </div>
              {!isCollapsed && (
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-gray-900 tracking-tight">
                    Mind
                  </span>
                  <span className="text-xs text-gray-500 font-medium">
                    Epical Digital
                  </span>
                </div>
              )}
            </Link>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={cn(
                "h-8 w-8 rounded-md hover:bg-sidebar-border/20",
                isCollapsed && "rotate-180"
              )}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Navegación principal */}
          <div className="flex flex-col flex-grow overflow-y-auto py-5 space-y-6">
            {/* General */}
            <div className="px-3">
              <div className={cn(
                "flex items-center mb-2 px-2",
                isCollapsed && "justify-center"
              )}>
                <h3 className={cn(
                  "text-xs font-semibold text-sidebar-foreground/70 tracking-wider",
                  isCollapsed ? "sr-only" : "uppercase"
                )}>
                  Principal
                </h3>
                {isCollapsed && (
                  <div className="h-0.5 w-5 rounded-full bg-sidebar-foreground/20"></div>
                )}
              </div>
              <nav className="space-y-1">
                {navCategories.principal.map((item) => renderNavLink(item))}
              </nav>
            </div>

            {/* Operaciones */}
            <div className="px-3">
              <div 
                className={cn(
                  "flex items-center justify-between mb-2 px-2 py-1 group cursor-pointer rounded-md transition-all duration-200 hover:bg-sidebar-border/10",
                  isCollapsed && "justify-center"
                )}
                onClick={() => !isCollapsed && toggleSection('operaciones')}
              >
                <h3 className={cn(
                  "text-xs font-semibold text-sidebar-foreground/70 tracking-wider",
                  isCollapsed ? "sr-only" : "uppercase"
                )}>
                  Operaciones
                </h3>
                {!isCollapsed && (
                  <ChevronDown 
                    className={cn(
                      "h-3.5 w-3.5 text-sidebar-foreground/40 transition-transform group-hover:text-sidebar-foreground/70",
                      expandedSection === 'operaciones' ? "transform rotate-180" : ""
                    )}
                  />
                )}
                {isCollapsed && (
                  <div className="h-0.5 w-5 rounded-full bg-sidebar-foreground/20"></div>
                )}
              </div>
              <nav className="space-y-1">
                {navCategories.operaciones.map((item) => renderNavLink(item))}
              </nav>
            </div>

            {/* Clientes */}
            <div className="px-3">
              <div 
                    className={cn(
                      "flex items-center justify-between mb-2 px-2 py-1 group cursor-pointer rounded-md transition-all duration-200 hover:bg-sidebar-border/10",
                      isCollapsed && "justify-center"
                    )}
                    onClick={() => !isCollapsed && toggleSection('clientes')}
                  >
                <h3 className={cn(
                  "text-xs font-semibold text-sidebar-foreground/70 tracking-wider",
                  isCollapsed ? "sr-only" : "uppercase"
                )}>
                  Clientes & Análisis
                </h3>
                {!isCollapsed && (
                  <ChevronDown 
                    className={cn(
                      "h-3.5 w-3.5 text-sidebar-foreground/40 transition-transform group-hover:text-sidebar-foreground/70",
                      expandedSection === 'clientes' ? "transform rotate-180" : ""
                    )}
                  />
                )}
                {isCollapsed && (
                  <div className="h-0.5 w-5 rounded-full bg-sidebar-foreground/20"></div>
                )}
              </div>
              <nav className="space-y-1">
                {navCategories.clientes.map((item) => renderNavLink(item))}
              </nav>
            </div>

            {/* Automatización */}
            <div className="px-3">
              <div className={cn(
                "flex items-center mb-2 px-2",
                isCollapsed && "justify-center"
              )}>
                <h3 className={cn(
                  "text-xs font-semibold text-sidebar-foreground/70 tracking-wider",
                  isCollapsed ? "sr-only" : "uppercase"
                )}>
                  Automatización
                </h3>
                {isCollapsed && (
                  <div className="h-0.5 w-5 rounded-full bg-sidebar-foreground/20"></div>
                )}
              </div>
              <nav className="space-y-1">
                {navCategories.automatizacion.map((item) => renderNavLink(item))}
              </nav>
            </div>

            {/* Sistema */}
            <div className="px-3">
              <div className={cn(
                "flex items-center mb-2 px-2",
                isCollapsed && "justify-center"
              )}>
                <h3 className={cn(
                  "text-xs font-semibold text-sidebar-foreground/70 tracking-wider",
                  isCollapsed ? "sr-only" : "uppercase"
                )}>
                  Sistema
                </h3>
                {isCollapsed && (
                  <div className="h-0.5 w-5 rounded-full bg-sidebar-foreground/20"></div>
                )}
              </div>
              <nav className="space-y-1">
                {navCategories.sistema.map((item) => renderNavLink(item))}
              </nav>
            </div>

            {/* Actividad Reciente - Solo visible cuando no está colapsado */}
            {!isCollapsed && (
              <div className="mt-auto px-3">
                <div className="flex items-center justify-between px-2 mb-2">
                  <h3 className="text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
                    Actividad Reciente
                  </h3>
                </div>
                <div className="bg-sidebar-border/10 rounded-md p-4 border border-sidebar-border/20">
                  <div className="flex items-center text-sm text-sidebar-foreground mb-2">
                    <div className="h-7 w-7 rounded-full bg-sidebar-primary/10 flex items-center justify-center mr-3">
                      <Activity className="h-3.5 w-3.5 text-sidebar-primary" />
                    </div>
                    <span className="font-medium">2 cotizaciones pendientes</span>
                  </div>
                  <div className="text-xs text-sidebar-foreground/60 pl-10">
                    Última actualización: hace 20 min
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sección de perfil de usuario */}
          <div className="flex-shrink-0 p-4 border-t border-sidebar-border/30 bg-sidebar-border/5">
            <div className={cn(
              "flex items-center",
              isCollapsed && "justify-center"
            )}>
              {isCollapsed ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Avatar className="h-9 w-9 border border-sidebar-border/30 cursor-pointer">
                        <AvatarFallback className="bg-sidebar-primary/80 text-white text-sm">
                          {getUserInitials()}
                        </AvatarFallback>
                        {user?.avatar && <AvatarImage src={user.avatar} />}
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <div className="flex flex-col">
                        <span className="font-medium">{user ? `${user.firstName} ${user.lastName}` : 'Usuario'}</span>
                        <span className="text-xs text-muted-foreground">{user?.isAdmin ? 'Administrador' : 'Usuario'}</span>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <>
                  <Avatar className="h-9 w-9 border border-sidebar-border/30">
                    <AvatarFallback className="bg-sidebar-primary/80 text-white text-sm">
                      {getUserInitials()}
                    </AvatarFallback>
                    {user?.avatar && <AvatarImage src={user.avatar} />}
                  </Avatar>
                  <div className="ml-3 min-w-0">
                    <p className="text-sm font-medium truncate">{user ? `${user.firstName} ${user.lastName}` : 'Usuario'}</p>
                    <p className="text-[11px] text-sidebar-foreground/60 truncate">{user?.isAdmin ? 'Administrador' : 'Usuario'}</p>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="ml-auto h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-gradient-to-br hover:from-red-500/10 hover:to-red-600/5 hover:shadow-md rounded-full transition-all duration-200 hover:scale-110"
                        >
                          <LogOut className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <span>Cerrar sesión</span>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}