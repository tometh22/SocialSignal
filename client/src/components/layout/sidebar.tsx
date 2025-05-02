import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import logoImage from "../../../src/assets/epicaldigital_logo.jpeg";
import {
  PlusCircle,
  List,
  Users,
  Settings,
  Menu,
  X,
  BarChart,
  ChevronRight,
  Activity,
  PieChart,
  ClipboardList,
  LogOut
} from "lucide-react";

export default function Sidebar() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
          "group flex items-center px-4 py-3 my-1.5 text-sm font-medium rounded-lg transition-all duration-300 hover-lift",
          isActive 
            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-soft" 
            : "text-sidebar-foreground/90 hover:bg-sidebar-border/30 hover:text-sidebar-foreground",
          item.highlight && !isActive && "bg-sidebar-accent/10 border border-sidebar-accent/20"
        )}
      >
        <div className={cn(
          "flex items-center justify-center w-9 h-9 rounded-lg mr-3 transition-all duration-300",
          isActive 
            ? "bg-sidebar-primary-foreground/10 text-sidebar-primary-foreground backdrop-blur-sm" 
            : "bg-sidebar-border/30 text-sidebar-foreground/70 group-hover:text-sidebar-foreground"
        )}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="font-semibold">{item.label}</span>
        {item.highlight && !isActive && (
          <Badge variant="outline" className="ml-auto bg-sidebar-accent/10 border-sidebar-accent/30 text-sidebar-accent-foreground text-xs px-2 py-0">
            Nuevo
          </Badge>
        )}
        {isActive && (
          <ChevronRight className="ml-auto h-4 w-4 text-sidebar-primary-foreground/70" />
        )}
      </Link>
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
          "fixed inset-y-0 left-0 z-10 w-80 bg-sidebar text-sidebar-foreground transform transition-transform duration-500 ease-in-out shadow-xl",
          "lg:shadow-primary/10 lg:translate-x-0 lg:static lg:block",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header with logo and title */}
          <div className="flex items-center h-24 px-6 border-b border-sidebar-border bg-sidebar">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center h-12 w-12 bg-white rounded-lg shadow-soft border border-sidebar-primary/20 overflow-hidden">
                <img 
                  src={logoImage} 
                  alt="Epical Digital" 
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-sidebar-primary to-sidebar-accent bg-clip-text text-transparent">
                  Sistema de Gestión
                </h1>
                <p className="text-xs text-sidebar-foreground/60">Epical</p>
              </div>
            </div>
          </div>

          {/* Main navigation */}
          <div className="flex flex-col flex-grow overflow-y-auto px-4 py-6 scrollbar-thin scrollbar-thumb-sidebar-border scrollbar-track-sidebar-background">

            
            {/* General */}
            <div className="mb-4">
              <div className="px-3 mb-2">
                <h3 className="text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
                  Principal
                </h3>
              </div>
              <nav className="space-y-1">
                {navCategories.general.map((item) => renderNavLink(item))}
              </nav>
            </div>
            
            <div className="h-px bg-sidebar-border/50 my-4 mx-1"></div>
            
            {/* Cotizaciones */}
            <div className="mb-4">
              <div className="px-3 mb-2">
                <h3 className="text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
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
                <h3 className="text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
                  Proyectos
                </h3>
              </div>
              <nav className="space-y-1">
                {navCategories.proyectos.map((item) => renderNavLink(item))}
              </nav>
            </div>
            
            <div className="h-px bg-sidebar-border/50 my-4 mx-1"></div>
            
            {/* Datos */}
            <div className="mb-4">
              <div className="px-3 mb-2">
                <h3 className="text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
                  Datos e Informes
                </h3>
              </div>
              <nav className="space-y-1">
                {navCategories.datos.map((item) => renderNavLink(item))}
              </nav>
            </div>
            
            <div className="h-px bg-sidebar-border/50 my-4 mx-1"></div>
            
            {/* Sistema */}
            <div className="mb-4">
              <div className="px-3 mb-2">
                <h3 className="text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
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
                <h3 className="text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
                  Actividad Reciente
                </h3>
              </div>
              <div className="bg-sidebar-accent/10 rounded-lg p-4 border border-sidebar-border shadow-inner">
                <div className="flex items-center text-sm text-sidebar-foreground mb-2">
                  <Activity className="h-4 w-4 mr-2 text-sidebar-accent" />
                  <span className="font-medium">2 cotizaciones pendientes</span>
                </div>
                <div className="text-xs text-sidebar-foreground/60">
                  Última actualización: hace 20 min
                </div>
              </div>
            </div>
          </div>

          {/* User profile section */}
          <div className="flex-shrink-0 p-4 border-t border-sidebar-border bg-sidebar">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-sidebar-primary/80 flex items-center justify-center text-white font-semibold text-sm shadow-soft border border-sidebar-primary/30">
                  JS
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-sidebar-foreground">Jane Smith</p>
                <p className="text-xs text-sidebar-foreground/60">Administrador</p>
              </div>
              <Button variant="outline" size="icon" className="ml-auto h-8 w-8 text-sidebar-foreground/70 border-sidebar-border hover:text-sidebar-foreground hover:bg-sidebar-border/30 hover:border-sidebar-primary/50 rounded-full">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}