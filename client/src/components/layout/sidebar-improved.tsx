import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PlusCircle,
  List,
  Users,
  History,
  Settings,
  Menu,
  X,
  Home,
  BarChart,
  ChevronRight,
  Activity,
  PieChart,
  LineChart,
  ClipboardList,
  LogOut
} from "lucide-react";

export default function Sidebar() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [time, setTime] = useState(new Date());
  
  // Actualizar tiempo cada minuto
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 60000);
    
    return () => {
      clearInterval(timer);
    };
  }, []);

  // Elementos de navegación organizados por categorías
  const navCategories = {
    general: [
      { href: "/", label: "Dashboard", icon: BarChart }
    ],
    cotizaciones: [
      { href: "/optimized-quote", label: "Nueva Cotización", icon: PlusCircle, highlight: false },
      { href: "/manage-quotes", label: "Gestionar Cotizaciones", icon: List }
    ],
    proyectos: [
      { href: "/active-projects", label: "Proyectos Activos", icon: ClipboardList, highlight: true }
    ],
    datos: [
      { href: "/clients", label: "Clientes", icon: Users },
      { href: "/statistics", label: "Estadísticas y Análisis", icon: PieChart }
    ],
    sistema: [
      { href: "/admin", label: "Panel Admin", icon: Settings }
    ]
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

  const renderNavLink = (item: any, mobile = false) => {
    const Icon = item.icon;
    const isActive = location === item.href;
    
    return (
      <Link 
        key={item.href} 
        href={item.href}
        onClick={mobile ? handleNavigation : undefined}
        className={cn(
          "group flex items-center px-4 py-3 my-1 text-sm font-medium rounded-lg transition-all duration-300",
          isActive 
            ? "bg-gradient-to-r from-blue-900/70 to-slate-800 text-blue-300 shadow-md" 
            : "text-slate-300 hover:bg-slate-800/70 hover:text-white",
          item.highlight && !isActive && "bg-gradient-to-r from-blue-900/20 to-slate-800/20"
        )}
      >
        <div className={cn(
          "flex items-center justify-center w-9 h-9 rounded-lg mr-3 transition-all duration-300",
          isActive 
            ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30 scale-110" 
            : "bg-slate-800 text-slate-400 group-hover:text-blue-300 group-hover:bg-slate-700 transform group-hover:scale-110"
        )}>
          <Icon className={cn(
            "h-5 w-5 transition-transform duration-300",
            !isActive && "group-hover:rotate-3"
          )} />
        </div>
        <span>{item.label}</span>
        {item.highlight && !isActive && (
          <Badge variant="outline" className="ml-auto border-blue-500 text-blue-400 text-xs px-2 py-0 animate-pulse">
            Nuevo
          </Badge>
        )}
        {isActive && (
          <ChevronRight className="ml-auto h-4 w-4 text-blue-400 animate-pulse" />
        )}
      </Link>
    );
  };

  // Formateador de tiempo
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    });
  };

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-0 left-0 z-20 m-4">
        <Button
          variant="outline"
          size="icon"
          onClick={toggleMobileMenu}
          className="rounded-full shadow-sm"
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
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

      {/* Sidebar for mobile & desktop (unified for consistency) */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-10 w-80 bg-gradient-to-b from-slate-900 to-slate-950 text-white transform transition-transform duration-500 ease-in-out shadow-xl",
          "lg:shadow-blue-900/10 lg:translate-x-0 lg:static lg:block",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header with logo and title */}
          <div className="flex items-center h-24 px-6 border-b border-blue-900/20 bg-gradient-to-r from-slate-900 to-slate-900/90">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center h-12 w-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg shadow-lg border border-blue-500/30 text-white font-bold text-xl">
                ED
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">
                  Sistema de Cotización
                </h1>
                <p className="text-xs text-slate-400">Epical Digital</p>
              </div>
            </div>
          </div>

          {/* Main navigation */}
          <div className="flex flex-col flex-grow overflow-y-auto px-4 py-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
            {/* Fecha y hora actual */}
            <div className="mb-6 px-2">
              <div className="flex justify-between items-center bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                <div className="text-xs text-slate-400">
                  {time.toLocaleDateString('es-ES', { 
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long' 
                  })}
                </div>
                <div className="text-sm font-mono text-blue-400">
                  {formatTime(time)}
                </div>
              </div>
            </div>
            
            {/* General */}
            <div className="mb-4">
              <div className="px-3 mb-2">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Principal
                </h3>
              </div>
              <nav className="space-y-1">
                {navCategories.general.map((item) => renderNavLink(item))}
              </nav>
            </div>
            
            <div className="h-px bg-gradient-to-r from-blue-900/30 via-slate-700/20 to-blue-900/30 my-4 mx-1"></div>
            
            {/* Cotizaciones */}
            <div className="mb-4">
              <div className="px-3 mb-2">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Cotizaciones
                </h3>
              </div>
              <nav className="space-y-1">
                {navCategories.cotizaciones.map((item) => renderNavLink(item))}
              </nav>
            </div>
            
            {/* Proyectos */}
            <div className="mb-4">
              <div className="px-3 mb-2">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Proyectos
                </h3>
              </div>
              <nav className="space-y-1">
                {navCategories.proyectos.map((item) => renderNavLink(item))}
              </nav>
            </div>
            
            <div className="h-px bg-gradient-to-r from-blue-900/30 via-slate-700/20 to-blue-900/30 my-4 mx-1"></div>
            
            {/* Datos */}
            <div className="mb-4">
              <div className="px-3 mb-2">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Datos e Informes
                </h3>
              </div>
              <nav className="space-y-1">
                {navCategories.datos.map((item) => renderNavLink(item))}
              </nav>
            </div>
            
            <div className="h-px bg-gradient-to-r from-blue-900/30 via-slate-700/20 to-blue-900/30 my-4 mx-1"></div>
            
            {/* Sistema */}
            <div className="mb-4">
              <div className="px-3 mb-2">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Sistema
                </h3>
              </div>
              <nav className="space-y-1">
                {navCategories.sistema.map((item) => renderNavLink(item))}
              </nav>
            </div>
            
            {/* Actividad Reciente */}
            <div className="mt-auto mb-4">
              <div className="px-3 mb-2">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Actividad Reciente
                </h3>
              </div>
              <div className="bg-slate-800/70 rounded-lg p-3 border border-slate-700/50 shadow-inner">
                <div className="flex items-center text-sm text-slate-300 mb-2">
                  <Activity className="h-4 w-4 mr-2 text-blue-400" />
                  <span>2 cotizaciones pendientes</span>
                </div>
                <div className="text-xs text-slate-400">
                  Última actualización: hace 20 min
                </div>
              </div>
            </div>
          </div>

          {/* User profile section */}
          <div className="flex-shrink-0 p-4 border-t border-blue-900/20 bg-gradient-to-b from-slate-900/50 to-slate-900">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-medium text-sm shadow-lg ring-2 ring-blue-600/20">
                  JS
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-slate-200">Jane Smith</p>
                <p className="text-xs text-slate-400">Administrador</p>
              </div>
              <Button variant="ghost" size="icon" className="ml-auto h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}