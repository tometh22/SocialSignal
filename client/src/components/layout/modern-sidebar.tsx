import { Link, useLocation } from "wouter";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  PlusCircle,
  ListChecks,
  Briefcase,
  Users,
  PieChart,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronsLeft,
  Activity,
  Cloud,
  BarChart3,
  CreditCard
} from "lucide-react";
import logoImage from "../../../src/assets/epicaldigital_logo.jpeg";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<any>;
  badge?: string;
  badgeColor?: "blue" | "green" | "yellow" | "red" | "purple";
  active?: boolean;
};

type NavSection = {
  title: string;
  items: NavItem[];
  collapsible?: boolean;
};

export default function ModernSidebar() {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'principal': true,
    'cotizaciones': true,
    'proyectos': true,
    'datos': true,
    'sistema': true
  });

  // Definir estructura de navegación
  const navSections: NavSection[] = [
    {
      title: "Principal",
      items: [
        {
          href: "/",
          label: "Dashboard",
          icon: LayoutDashboard,
          active: location === "/"
        }
      ],
      collapsible: false
    },
    {
      title: "Cotizaciones",
      items: [
        {
          href: "/optimized-quote",
          label: "Nueva Cotización",
          icon: PlusCircle,
          badge: "Nuevo",
          badgeColor: "blue",
          active: location === "/optimized-quote"
        },
        {
          href: "/manage-quotes",
          label: "Gestionar Cotizaciones",
          icon: ListChecks,
          active: location === "/manage-quotes"
        }
      ],
      collapsible: true
    },
    {
      title: "Proyectos",
      items: [
        {
          href: "/active-projects",
          label: "Proyectos Activos",
          icon: Briefcase,
          active: location === "/active-projects"
        }
      ],
      collapsible: true
    },
    {
      title: "Datos e Informes",
      items: [
        {
          href: "/clients",
          label: "Clientes",
          icon: Users,
          active: location === "/clients"
        },
        {
          href: "/statistics",
          label: "Estadísticas",
          icon: BarChart3,
          active: location === "/statistics"
        }
      ],
      collapsible: true
    },
    {
      title: "Sistema",
      items: [
        {
          href: "/admin",
          label: "Configuración",
          icon: Settings,
          active: location === "/admin"
        }
      ],
      collapsible: true
    }
  ];

  // Toggle para sección
  const toggleSection = (section: string) => {
    setExpandedSections({
      ...expandedSections,
      [section]: !expandedSections[section]
    });
  };

  // Toggle para sidebar colapsada
  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
  };

  // Toggle para menú móvil
  const toggleMobile = () => {
    setMobileOpen(!mobileOpen);
  };

  // Cerrar menú móvil al navegar
  const closeMobileMenu = () => {
    if (mobileOpen) {
      setMobileOpen(false);
    }
  };

  // Renderizar badge
  const renderBadge = (text: string, color: string = "blue") => {
    const colorStyles = {
      blue: "bg-blue-50 text-blue-700 border-blue-100",
      green: "bg-green-50 text-green-700 border-green-100",
      yellow: "bg-amber-50 text-amber-700 border-amber-100",
      red: "bg-red-50 text-red-700 border-red-100",
      purple: "bg-purple-50 text-purple-700 border-purple-100"
    };

    return (
      <Badge 
        variant="outline" 
        className={cn(
          "ml-auto text-[10px] py-0 px-1.5 h-5 font-medium", 
          colorStyles[color as keyof typeof colorStyles]
        )}
      >
        {text}
      </Badge>
    );
  };

  return (
    <>
      {/* Botón de menú móvil */}
      <div className="lg:hidden fixed top-0 left-0 z-50 p-4">
        <Button
          variant="outline"
          size="icon"
          onClick={toggleMobile}
          className="h-10 w-10 rounded-full border-gray-200 shadow-sm bg-white"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Overlay para móvil */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={toggleMobile}
        />
      )}

      {/* Sidebar principal */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ease-in-out",
          collapsed ? "w-[70px]" : "w-[280px]",
          "lg:z-0 lg:translate-x-0 lg:shadow-none",
          "transform",
          mobileOpen ? "translate-x-0 shadow-xl" : "-translate-x-full lg:translate-x-0",
          "flex-shrink-0 overflow-hidden"
        )}
      >
        {/* Cabecera con logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-gray-100">
          <div className="flex items-center">
            <div className="w-8 h-8 overflow-hidden rounded-md bg-white shadow-sm border border-gray-100 flex-shrink-0">
              <img 
                src={logoImage} 
                alt="Epical Digital" 
                className="w-full h-full object-cover"
              />
            </div>
            {!collapsed && (
              <div className="ml-3">
                <h1 className="text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Sistema de Gestión
                </h1>
                <p className="text-[10px] text-gray-500">Epical Digital</p>
              </div>
            )}
          </div>

          {/* Botón para colapsar/expandir */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleCollapsed}
            className="h-8 w-8 p-0 rounded-md"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronsLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Área de navegación principal */}
        <ScrollArea className="flex-1 px-3 py-3">
          <div className="space-y-6">
            {navSections.map((section, index) => (
              <div key={index} className="space-y-1">
                {/* Encabezado de sección */}
                {(section.title !== "Principal" || !collapsed) && (
                  <div 
                    className={cn(
                      "flex items-center px-2 py-1.5",
                      section.collapsible && !collapsed && "cursor-pointer hover:text-gray-900",
                      collapsed && "justify-center"
                    )}
                    onClick={() => section.collapsible && !collapsed && toggleSection(section.title.toLowerCase())}
                  >
                    {!collapsed ? (
                      <>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          {section.title}
                        </span>
                        {section.collapsible && (
                          <ChevronDown 
                            className={cn(
                              "ml-auto h-4 w-4 text-gray-400 transition-transform",
                              expandedSections[section.title.toLowerCase()] && "transform rotate-180"
                            )} 
                          />
                        )}
                      </>
                    ) : (
                      <div className="h-[1px] w-5 bg-gray-200 rounded-full" />
                    )}
                  </div>
                )}

                {/* Elementos de navegación */}
                <div 
                  className={cn(
                    "space-y-1 overflow-hidden transition-all duration-200",
                    (!expandedSections[section.title.toLowerCase()] && !collapsed && section.collapsible) && "max-h-0"
                  )}
                >
                  {section.items.map((item, itemIndex) => (
                    <TooltipProvider key={itemIndex} delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link
                            href={item.href}
                            onClick={closeMobileMenu}
                            className={cn(
                              "group flex items-center px-2 py-2 text-sm font-medium rounded-lg transition-colors relative",
                              item.active
                                ? "text-primary bg-primary/5"
                                : "text-gray-700 hover:text-gray-900 hover:bg-gray-100",
                                collapsed && "justify-center"
                            )}
                          >
                            {/* Indicador de activo */}
                            {item.active && (
                              <span className="absolute inset-y-0 left-0 w-1 bg-primary rounded-r-full" />
                            )}
                            
                            {/* Icono */}
                            <span
                              className={cn(
                                "flex items-center justify-center rounded-md w-8 h-8",
                                item.active
                                  ? "text-primary bg-primary/10"
                                  : "text-gray-500 bg-gray-100/80 group-hover:text-primary group-hover:bg-gray-200/50",
                              )}
                            >
                              <item.icon className="h-[18px] w-[18px]" />
                            </span>
                            
                            {/* Etiqueta y badge */}
                            {!collapsed && (
                              <>
                                <span className="ml-3 flex-1 truncate">{item.label}</span>
                                {item.badge && renderBadge(item.badge, item.badgeColor)}
                              </>
                            )}
                          </Link>
                        </TooltipTrigger>
                        
                        {collapsed && (
                          <TooltipContent side="right">
                            <div className="flex items-center">
                              <span>{item.label}</span>
                              {item.badge && (
                                <span className="ml-2 text-xs font-medium py-0.5 px-1.5 rounded-full bg-blue-50 text-blue-700">
                                  {item.badge}
                                </span>
                              )}
                            </div>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Widget de actividad */}
        {!collapsed && (
          <div className="px-4 py-3">
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
              <div className="flex items-center mb-2">
                <Activity className="h-4 w-4 text-blue-600 mr-2" />
                <span className="text-sm font-medium text-blue-700">Actividad reciente</span>
              </div>
              <p className="text-xs text-blue-600">2 cotizaciones pendientes</p>
            </div>
          </div>
        )}

        {/* Perfil de usuario */}
        <div className={cn(
          "border-t border-gray-100 p-3",
          collapsed ? "flex justify-center" : "px-4"
        )}>
          {collapsed ? (
            <Avatar className="h-9 w-9 border border-gray-200">
              <AvatarFallback className="bg-primary/10 text-primary text-xs">JS</AvatarFallback>
            </Avatar>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Avatar className="h-8 w-8 border border-gray-200">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">JS</AvatarFallback>
                </Avatar>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-700">Jane Smith</p>
                  <p className="text-xs text-gray-500">Administrador</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}