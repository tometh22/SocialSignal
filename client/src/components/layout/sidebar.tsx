import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import logoImage from "../../../src/assets/epicaldigital_logo.jpeg";
import {
  PlusCircle,
  ListChecks,
  Users,
  Cog,
  Menu,
  X,
  ChevronRight,
  Activity,
  PieChart,
  LayoutDashboard,
  FileText,
  Folder,
  ChevronDown,
  Briefcase,
  ClipboardList,
  Search,
  LogOut
} from "lucide-react";

export default function Sidebar() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Elementos de navegación organizados por categorías
  const navCategories = {
    general: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, description: "Panel de control principal" }
    ],
    cotizaciones: [
      { href: "/optimized-quote", label: "Nueva Cotización", icon: PlusCircle, highlight: true, description: "Crear nueva cotización" },
      { href: "/manage-quotes", label: "Gestionar Cotizaciones", icon: ListChecks, description: "Ver y administrar cotizaciones" }
    ],
    proyectos: [
      { href: "/active-projects", label: "Proyectos Activos", icon: Briefcase, highlight: true, description: "Ver proyectos en curso" }
    ],
    datos: [
      { href: "/clients", label: "Clientes", icon: Users, description: "Administrar clientes" },
      { href: "/statistics", label: "Estadísticas y Análisis", icon: PieChart, description: "Ver informes y análisis" }
    ],
    sistema: [
      { href: "/admin", label: "Panel Admin", icon: Cog, description: "Configuración del sistema" }
    ]
  };
  
  // Gestionar la sección expandida
  const toggleSection = (section: string) => {
    if (expandedSection === section) {
      setExpandedSection(null);
    } else {
      setExpandedSection(section);
    }
  };
  
  // Activar búsqueda
  const activateSearch = () => {
    setIsSearchActive(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };
  
  // Desactivar búsqueda
  const deactivateSearch = () => {
    if (searchQuery === "") {
      setIsSearchActive(false);
    }
  };
  
  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  // Close mobile menu when a link is clicked
  const handleNavigation = () => {
    if (mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  };

  // Determinar si una sección tiene elementos activos
  const sectionHasActiveItem = (items: Array<any>) => {
    return items.some(item => location === item.href);
  };

  // Filtrar elementos según la búsqueda
  const filterNavItems = () => {
    if (!searchQuery) return null;
    
    const allItems = Object.values(navCategories).flat();
    return allItems.filter(item => 
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  };
  
  // Elementos filtrados por búsqueda
  const filteredItems = filterNavItems();

  // Detectar clic fuera del campo de búsqueda
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
        deactivateSearch();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const renderNavLink = (item: any, mobile = false) => {
    const Icon = item.icon;
    const isActive = location === item.href;
    
    return (
      <TooltipProvider key={item.href} delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link 
              href={item.href}
              onClick={mobile ? handleNavigation : undefined}
              className={cn(
                "group flex items-center px-3 py-2.5 my-1 text-sm font-medium rounded-lg transition-all duration-300",
                isActive 
                  ? "bg-sidebar-primary/15 text-sidebar-primary shadow-[inset_0_0_0_1px_rgba(var(--sidebar-primary)/0.2),_0_1px_2px_rgba(0,0,0,0.1)]" 
                  : "text-sidebar-foreground/90 hover:bg-sidebar-border/20 hover:text-sidebar-foreground hover:shadow-[inset_0_0_0_1px_rgba(var(--sidebar-border)/0.5)]",
                item.highlight && !isActive && "bg-sidebar-accent/10 border border-sidebar-accent/20",
                isCollapsed && "justify-center px-2"
              )}
            >
              <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-md transition-all duration-300",
                isActive 
                  ? "bg-sidebar-primary text-white shadow-[0_2px_5px_rgba(var(--sidebar-primary)/0.5)]" 
                  : "bg-sidebar-border/30 text-sidebar-foreground/70 group-hover:text-sidebar-foreground group-hover:bg-sidebar-border/50"
              )}>
                <Icon className="h-4 w-4" />
              </div>
              
              {!isCollapsed && (
                <>
                  <span className="ml-3 font-medium tracking-tight">{item.label}</span>
                  {item.highlight && !isActive && (
                    <Badge variant="outline" className="ml-auto bg-sidebar-accent/10 border-sidebar-accent/30 text-sidebar-accent text-[10px] px-1.5 py-0 h-5">
                      Nuevo
                    </Badge>
                  )}
                  {isActive && (
                    <ChevronRight className="ml-auto h-3.5 w-3.5 text-sidebar-primary/70" />
                  )}
                </>
              )}
            </Link>
          </TooltipTrigger>
          {isCollapsed && (
            <TooltipContent side="right">
              <div className="flex flex-col">
                <span>{item.label}</span>
                {item.description && (
                  <span className="text-xs text-muted-foreground">{item.description}</span>
                )}
              </div>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  };



  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-0 left-0 z-20 m-4">
        <Button
          variant="outline"
          size="icon"
          onClick={toggleMobileMenu}
          className="rounded-full shadow-md bg-white/90 backdrop-blur-sm border-gray-200"
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-10 lg:hidden"
          onClick={toggleMobileMenu}
        />
      )}

      {/* Sidebar for mobile & desktop */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className={cn(
          "fixed inset-y-0 left-0 z-10 bg-sidebar/95 backdrop-blur-md text-sidebar-foreground transform transition-all duration-300 ease-in-out shadow-xl",
          isCollapsed ? "w-20" : "w-72",
          "lg:shadow-lg lg:shadow-primary/5 lg:translate-x-0 lg:static",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header with logo and title */}
          <div className="flex items-center justify-between px-5 py-6 border-b border-sidebar-border/30">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center h-10 w-10 bg-white rounded-xl shadow-lg border border-primary/10 overflow-hidden">
                <img 
                  src={logoImage} 
                  alt="Epical Digital" 
                  className="h-full w-full object-cover"
                />
              </div>
              {!isCollapsed && (
                <div>
                  <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-sidebar-accent bg-clip-text text-transparent">
                    Sistema de Gestión
                  </h1>
                  <p className="text-[11px] text-sidebar-foreground/60">Epical Digital</p>
                </div>
              )}
            </div>
            
            {/* Collapse toggle button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={cn(
                "h-8 w-8 rounded-lg hover:bg-sidebar-border/20",
                isCollapsed && "rotate-180"
              )}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Search bar */}
          <div className={cn(
            "px-5 py-4",
            isCollapsed && "flex justify-center"
          )}>
            {isSearchActive ? (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-sidebar-foreground/50" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full h-9 pl-10 pr-4 rounded-lg text-sm bg-sidebar-border/20 focus:bg-sidebar-border/30 border border-sidebar-border/30 focus:border-sidebar-primary/30 focus:outline-none focus:ring-1 focus:ring-sidebar-primary/20"
                  onBlur={() => {
                    if (searchQuery === "") deactivateSearch();
                  }}
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-5 w-5 text-sidebar-foreground/50 hover:text-sidebar-foreground"
                    onClick={() => {
                      setSearchQuery("");
                      deactivateSearch();
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ) : (
              <Button
                variant="outline"
                size={isCollapsed ? "icon" : "default"}
                onClick={activateSearch}
                className={cn(
                  "text-xs w-full h-9 justify-start bg-sidebar-border/10 hover:bg-sidebar-border/20 border-sidebar-border/20",
                  isCollapsed ? "w-9 p-0" : "pl-10 relative"
                )}
              >
                <Search className={cn(
                  "h-4 w-4 text-sidebar-foreground/60",
                  !isCollapsed && "absolute left-3"
                )} />
                {!isCollapsed && <span className="ml-1">Buscar...</span>}
              </Button>
            )}
          </div>

          {/* Main navigation */}
          <div className="flex flex-col flex-grow overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-sidebar-border/20 scrollbar-track-transparent">
            {filteredItems ? (
              /* Search results */
              <div className="px-2">
                <h3 className="text-xs font-medium text-sidebar-foreground/70 mb-3">
                  Resultados ({filteredItems.length})
                </h3>
                <nav className="space-y-1">
                  {filteredItems.map((item) => renderNavLink(item))}
                </nav>
                {filteredItems.length === 0 && (
                  <div className="text-center py-6 text-sidebar-foreground/50 text-sm">
                    No se encontraron resultados
                  </div>
                )}
              </div>
            ) : (
              /* Regular navigation */
              <>
                {/* General */}
                <div>
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
                      <div className="h-1 w-5 rounded-full bg-sidebar-foreground/20"></div>
                    )}
                  </div>
                  <nav className="space-y-1">
                    {navCategories.general.map((item) => renderNavLink(item))}
                  </nav>
                </div>
                
                {/* Cotizaciones */}
                <div>
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
                      <div className="h-1 w-5 rounded-full bg-sidebar-foreground/20"></div>
                    )}
                  </div>
                  <nav className={cn(
                    "space-y-1 transition-all duration-300 overflow-hidden",
                    !isCollapsed && expandedSection !== 'cotizaciones' && navCategories.cotizaciones.length > 1 && "max-h-12 opacity-75"
                  )}>
                    {navCategories.cotizaciones.map((item) => renderNavLink(item))}
                  </nav>
                </div>
                
                {/* Proyectos */}
                <div>
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
                      <div className="h-1 w-5 rounded-full bg-sidebar-foreground/20"></div>
                    )}
                  </div>
                  <nav className="space-y-1">
                    {navCategories.proyectos.map((item) => renderNavLink(item))}
                  </nav>
                </div>
                
                {/* Datos */}
                <div>
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
                      <div className="h-1 w-5 rounded-full bg-sidebar-foreground/20"></div>
                    )}
                  </div>
                  <nav className={cn(
                    "space-y-1 transition-all duration-300 overflow-hidden",
                    !isCollapsed && expandedSection !== 'datos' && navCategories.datos.length > 1 && "max-h-12 opacity-75"
                  )}>
                    {navCategories.datos.map((item) => renderNavLink(item))}
                  </nav>
                </div>
                
                {/* Sistema */}
                <div>
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
                      <div className="h-1 w-5 rounded-full bg-sidebar-foreground/20"></div>
                    )}
                  </div>
                  <nav className="space-y-1">
                    {navCategories.sistema.map((item) => renderNavLink(item))}
                  </nav>
                </div>
              </>
            )}
            
            {/* Actividad Reciente - Solo visible cuando no hay búsqueda y no está colapsado */}
            {!filteredItems && !isCollapsed && (
              <div className="mt-auto">
                <div className="flex items-center justify-between px-2 mb-2">
                  <h3 className="text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
                    Actividad Reciente
                  </h3>
                </div>
                <div className="bg-gradient-to-r from-sidebar-primary/5 to-sidebar-accent/5 rounded-xl p-4 border border-sidebar-border/30 shadow-inner">
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

          {/* User profile section */}
          <div className="flex-shrink-0 p-4 border-t border-sidebar-border/30 backdrop-blur-sm bg-sidebar-border/5">
            <div className={cn(
              "flex items-center",
              isCollapsed && "justify-center"
            )}>
              {isCollapsed ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Avatar className="h-10 w-10 border-2 border-sidebar-border/30 shadow-md cursor-pointer">
                        <AvatarFallback className="bg-gradient-to-br from-primary/80 to-sidebar-accent/80 text-white">
                          JS
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <div className="flex flex-col">
                        <span className="font-medium">Jane Smith</span>
                        <span className="text-xs text-muted-foreground">Administrador</span>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <>
                  <Avatar className="h-9 w-9 border-2 border-sidebar-border/30 shadow-md">
                    <AvatarFallback className="bg-gradient-to-br from-primary/80 to-sidebar-accent/80 text-white text-sm">
                      JS
                    </AvatarFallback>
                  </Avatar>
                  <div className="ml-3 min-w-0">
                    <p className="text-sm font-medium truncate">Jane Smith</p>
                    <p className="text-[11px] text-sidebar-foreground/60 truncate">Administrador</p>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="ml-auto h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-border/20 rounded-full"
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