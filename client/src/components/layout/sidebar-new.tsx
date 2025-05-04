import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import {
  Calendar,
  LayoutGrid,
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
  ChevronDown,
  Briefcase,
  Search,
  Home,
  BarChart3,
  Settings,
  LogOut
} from "lucide-react";
import logoImage from "../../../src/assets/epicaldigital_logo.jpeg";

// Interfaces para el tipado
type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  badge?: string;
  badgeColor?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
};

type NavCategory = {
  id: string;
  label: string;
  items: NavItem[];
};

export default function SidebarNew() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>("dashboard");

  // Definición de las categorías y elementos de navegación
  const categories: NavCategory[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      items: [
        { 
          href: "/", 
          label: "Panel General", 
          icon: LayoutDashboard,
          description: "Vista general del sistema"
        },
      ]
    },
    {
      id: "cotizaciones",
      label: "Cotizaciones",
      items: [
        {
          href: "/optimized-quote",
          label: "Nueva Cotización",
          icon: PlusCircle,
          description: "Crear nueva cotización",
          badge: "Nuevo",
          badgeColor: "blue"
        },
        {
          href: "/manage-quotes",
          label: "Gestionar Cotizaciones",
          icon: ListChecks,
          description: "Ver y administrar cotizaciones"
        }
      ]
    },
    {
      id: "proyectos",
      label: "Proyectos",
      items: [
        {
          href: "/active-projects",
          label: "Proyectos Activos",
          icon: Briefcase,
          description: "Ver proyectos en curso"
        }
      ]
    },
    {
      id: "analytics",
      label: "Analytics",
      items: [
        {
          href: "/clients",
          label: "Clientes",
          icon: Users,
          description: "Gestionar clientes"
        },
        {
          href: "/statistics",
          label: "Estadísticas",
          icon: BarChart3,
          description: "Análisis de datos"
        }
      ]
    },
    {
      id: "system",
      label: "Sistema",
      items: [
        {
          href: "/admin",
          label: "Configuración",
          icon: Settings,
          description: "Ajustes del sistema"
        }
      ]
    }
  ];
  
  // Encontrar categoría activa basada en la ruta actual
  const findActiveCategoryFromRoute = () => {
    for (const category of categories) {
      if (category.items.some(item => item.href === location)) {
        return category.id;
      }
    }
    return null;
  };
  
  // Cambiar categoría activa
  const toggleCategory = (categoryId: string) => {
    setActiveCategory(activeCategory === categoryId ? null : categoryId);
  };

  // Activar/desactivar menú móvil
  const toggleMobileMenu = () => {
    setMobileOpen(!mobileOpen);
  };

  // Función para obtener la clase del badge según el color
  const getBadgeClasses = (color: string = 'blue') => {
    const baseClasses = "ml-auto text-[10px] px-1.5 py-px font-medium rounded";
    const colorClasses = {
      blue: "bg-blue-50 text-blue-600 border border-blue-200",
      green: "bg-green-50 text-green-600 border border-green-200",
      yellow: "bg-amber-50 text-amber-600 border border-amber-200",
      red: "bg-red-50 text-red-600 border border-red-200",
      purple: "bg-purple-50 text-purple-600 border border-purple-200"
    };
    
    return `${baseClasses} ${colorClasses[color as keyof typeof colorClasses] || colorClasses.blue}`;
  };

  // Verificar si la ruta actual está en la categoría
  const isCategoryActive = (category: NavCategory) => {
    return category.items.some(item => item.href === location);
  };

  return (
    <>
      {/* Botón de menú móvil */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={toggleMobileMenu}
          className="w-10 h-10 rounded-lg bg-white border border-gray-200 shadow-md"
        >
          {mobileOpen ? <X /> : <Menu />}
        </Button>
      </div>

      {/* Overlay para móvil */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-20 lg:hidden"
          onClick={toggleMobileMenu}
        />
      )}

      {/* Sidebar principal */}
      <div 
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex flex-col w-64 bg-white border-r border-gray-200 shadow-md",
          "lg:relative lg:z-0",
          "transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Cabecera con logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-gray-100">
          <div className="flex-shrink-0 w-8 h-8 rounded-md overflow-hidden shadow-sm border border-gray-200">
            <img 
              src={logoImage} 
              alt="Epical Digital"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">
              Sistema de Gestión
            </h1>
            <p className="text-xs text-gray-500">
              Epical Digital
            </p>
          </div>
        </div>

        {/* Área de navegación */}
        <ScrollArea className="flex-1 py-4">
          <div className="space-y-6 px-3">
            {categories.map((category) => (
              <div key={category.id} className="space-y-1">
                {/* Título de la categoría */}
                {category.id !== "dashboard" && (
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium tracking-wide",
                      "hover:text-gray-900",
                      isCategoryActive(category) ? "text-gray-900" : "text-gray-500"
                    )}
                  >
                    <span className="uppercase">{category.label}</span>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform",
                        activeCategory === category.id && "transform rotate-180"
                      )}
                    />
                  </button>
                )}
                
                {/* Elementos de navegación */}
                <div
                  className={cn(
                    "space-y-1 overflow-hidden transition-all",
                    (activeCategory === category.id || category.id === "dashboard" || isCategoryActive(category))
                      ? "max-h-96"
                      : "max-h-0"
                  )}
                >
                  {category.items.map((item) => {
                    const isActive = location === item.href;
                    const Icon = item.icon;
                    
                    return (
                      <TooltipProvider key={item.href} delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link
                              href={item.href}
                              onClick={() => mobileOpen && setMobileOpen(false)}
                              className={cn(
                                "flex items-center h-10 w-full rounded-md px-2.5 text-sm transition-colors relative group",
                                isActive
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                              )}
                            >
                              {/* Indicador lateral activo */}
                              {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />
                              )}
                              
                              {/* Icono */}
                              <div className={cn(
                                "mr-3 h-8 w-8 flex items-center justify-center rounded-md transition-colors",
                                isActive
                                  ? "bg-primary text-white"
                                  : "text-gray-500 group-hover:text-gray-700"
                              )}>
                                <Icon className="h-4 w-4" />
                              </div>
                              
                              {/* Etiqueta */}
                              <span className="truncate">{item.label}</span>
                              
                              {/* Badge (si existe) */}
                              {item.badge && (
                                <span className={getBadgeClasses(item.badgeColor)}>
                                  {item.badge}
                                </span>
                              )}
                            </Link>
                          </TooltipTrigger>
                          
                          <TooltipContent side="right" className="z-50">
                            {item.description || item.label}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Perfil de usuario */}
        <div className="flex items-center gap-3 p-4 border-t border-gray-100">
          <Avatar className="h-8 w-8 border border-gray-200">
            <AvatarFallback className="bg-primary text-white text-xs">JS</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">Jane Smith</p>
            <p className="text-xs text-gray-500 truncate">Administrator</p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-700">
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Cerrar sesión</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </>
  );
}