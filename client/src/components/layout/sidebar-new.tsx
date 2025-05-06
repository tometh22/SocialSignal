import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";

import {
  ChevronRight,
  Activity,
  LayoutDashboard,
  PlusCircle,
  ListChecks,
  Briefcase,
  Users,
  PieChart,
  Cog,
  ChevronDown,
  LogOut,
} from "lucide-react";

// Tipo para elementos de navegación
type NavItem = {
  href: string;
  title: string;
  icon: any;
  badge?: string;
  status?: 'new';
};

export default function Sidebar() {
  const { user, logoutMutation } = useAuth();
  const [currentPath] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  
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
    general: [
      { href: "/", title: "Dashboard", icon: LayoutDashboard },
    ],
    cotizaciones: [
      { href: "/optimized-quote", title: "Nueva Cotización", icon: PlusCircle, status: 'new' as const },
      { href: "/manage-quotes", title: "Gestionar Cotizaciones", icon: ListChecks },
    ],
    proyectos: [
      { href: "/active-projects", title: "Proyectos Activos", icon: Briefcase, status: 'new' as const },
    ],
    datos: [
      { href: "/clients", title: "Clientes", icon: Users },
      { href: "/statistics", title: "Estadísticas y Análisis", icon: PieChart },
    ],
    sistema: [
      { href: "/admin", title: "Panel Admin", icon: Cog },
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
          "flex items-center px-3 py-2.5 rounded-md text-sm transition-colors relative group",
          isActive
            ? "bg-sidebar-active-bg text-sidebar-active-fg font-medium border-l-2 border-l-primary"
            : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-border/20 border-l-2 border-transparent",
          isCollapsed && "justify-center py-2.5"
        )}
      >
        <Icon className={cn(
          "h-4 w-4 flex-shrink-0", 
          isCollapsed ? "m-0" : "mr-3"
        )} />
        
        {!isCollapsed && (
          <span className="truncate">{item.title}</span>
        )}
        
        {!isCollapsed && item.status === 'new' && (
          <span className="ml-auto rounded-full text-[10px] bg-sidebar-accent/10 text-sidebar-accent px-1.5 py-0.5">
            Nuevo
          </span>
        )}
        
        {isCollapsed && item.status === 'new' && (
          <span className="absolute right-0.5 top-0.5 w-1.5 h-1.5 rounded-full bg-sidebar-accent"></span>
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
    
      {/* Barra lateral */}
      <motion.div
        className={cn(
          "sidebar fixed top-0 bottom-0 left-0 z-50 h-screen flex-col flex-shrink-0 bg-sidebar-background border-r border-sidebar-border shadow-lg md:shadow-none md:relative md:z-0 md:flex",
          isCollapsed ? "w-[72px]" : "w-[260px]",
          isOpen ? "flex" : "hidden md:flex"
        )}
        initial={false}
        animate={{ 
          width: isCollapsed ? 72 : 260,
          transition: { duration: 0.2 }
        }}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header con logo */}
          <div className={cn(
            "flex items-center justify-between py-4 border-b border-sidebar-border/30",
            isCollapsed ? "px-3 justify-center" : "px-5"
          )}>
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex-shrink-0 h-9 w-9 flex items-center justify-center">
                <img 
                  src="/images/epical-logo.jpeg" 
                  alt="Epical" 
                  className="h-full w-full object-contain rounded-sm"
                />
              </div>
              {!isCollapsed && (
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-sidebar-foreground tracking-wide">
                    Sistema de Gestión
                  </span>
                  <span className="text-[11px] text-sidebar-foreground/60">
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
                {navCategories.general.map((item) => renderNavLink(item))}
              </nav>
            </div>
            
            {/* Cotizaciones */}
            <div className="px-3">
              <div 
                className={cn(
                  "flex items-center justify-between mb-2 px-2 group cursor-pointer",
                  isCollapsed && "justify-center"
                )}
                onClick={() => !isCollapsed && toggleSection('cotizaciones')}
              >
                <h3 className={cn(
                  "text-xs font-semibold text-sidebar-foreground/70 tracking-wider",
                  isCollapsed ? "sr-only" : "uppercase"
                )}>
                  Cotizaciones
                </h3>
                {!isCollapsed && (
                  <ChevronDown 
                    className={cn(
                      "h-3.5 w-3.5 text-sidebar-foreground/40 transition-transform group-hover:text-sidebar-foreground/70",
                      expandedSection === 'cotizaciones' ? "transform rotate-180" : ""
                    )}
                  />
                )}
                {isCollapsed && (
                  <div className="h-0.5 w-5 rounded-full bg-sidebar-foreground/20"></div>
                )}
              </div>
              <nav className="space-y-1">
                {navCategories.cotizaciones.map((item) => renderNavLink(item))}
              </nav>
            </div>
            
            {/* Proyectos */}
            <div className="px-3">
              <div 
                className={cn(
                  "flex items-center justify-between mb-2 px-2 group cursor-pointer",
                  isCollapsed && "justify-center"
                )}
                onClick={() => !isCollapsed && toggleSection('proyectos')}
              >
                <h3 className={cn(
                  "text-xs font-semibold text-sidebar-foreground/70 tracking-wider",
                  isCollapsed ? "sr-only" : "uppercase"
                )}>
                  Proyectos
                </h3>
                {!isCollapsed && (
                  <ChevronDown 
                    className={cn(
                      "h-3.5 w-3.5 text-sidebar-foreground/40 transition-transform group-hover:text-sidebar-foreground/70",
                      expandedSection === 'proyectos' ? "transform rotate-180" : ""
                    )}
                  />
                )}
                {isCollapsed && (
                  <div className="h-0.5 w-5 rounded-full bg-sidebar-foreground/20"></div>
                )}
              </div>
              <nav className="space-y-1">
                {navCategories.proyectos.map((item) => renderNavLink(item))}
              </nav>
            </div>
            
            {/* Datos */}
            <div className="px-3">
              <div 
                className={cn(
                  "flex items-center justify-between mb-2 px-2 group cursor-pointer",
                  isCollapsed && "justify-center"
                )}
                onClick={() => !isCollapsed && toggleSection('datos')}
              >
                <h3 className={cn(
                  "text-xs font-semibold text-sidebar-foreground/70 tracking-wider",
                  isCollapsed ? "sr-only" : "uppercase"
                )}>
                  Datos e Informes
                </h3>
                {!isCollapsed && (
                  <ChevronDown 
                    className={cn(
                      "h-3.5 w-3.5 text-sidebar-foreground/40 transition-transform group-hover:text-sidebar-foreground/70",
                      expandedSection === 'datos' ? "transform rotate-180" : ""
                    )}
                  />
                )}
                {isCollapsed && (
                  <div className="h-0.5 w-5 rounded-full bg-sidebar-foreground/20"></div>
                )}
              </div>
              <nav className="space-y-1">
                {navCategories.datos.map((item) => renderNavLink(item))}
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
                          className="ml-auto h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-border/20 rounded-full"
                          onClick={() => logoutMutation.mutate()}
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