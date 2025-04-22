import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState } from "react";
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
  Activity
} from "lucide-react";

export default function Sidebar() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigationItems = [
    { href: "/", label: "Dashboard", icon: BarChart },
    { href: "/new-quote", label: "Nueva Cotización", icon: PlusCircle, highlight: true },
    { href: "/manage-quotes", label: "Gestionar Cotizaciones", icon: List },
    { href: "/clients", label: "Clientes", icon: Users },
    { href: "/history", label: "Historial", icon: History },
    { href: "/admin", label: "Panel Admin", icon: Settings },
  ];

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
          "group flex items-center px-4 py-3 my-1 text-sm font-medium rounded-lg transition-all",
          isActive 
            ? "bg-primary/10 text-primary" 
            : "text-slate-700 hover:bg-slate-100",
          item.highlight && !isActive && "bg-primary/5"
        )}
      >
        <div className={cn(
          "flex items-center justify-center w-9 h-9 rounded-lg mr-3",
          isActive 
            ? "bg-primary text-white" 
            : "bg-slate-100 text-slate-500 group-hover:text-primary group-hover:bg-slate-200 transition-colors"
        )}>
          <Icon className="h-5 w-5" />
        </div>
        <span>{item.label}</span>
        {item.highlight && !isActive && (
          <Badge variant="outline" className="ml-auto border-primary text-primary text-xs px-2 py-0">
            Nuevo
          </Badge>
        )}
        {isActive && (
          <ChevronRight className="ml-auto h-4 w-4 text-primary" />
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

      {/* Sidebar for mobile */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-10 w-80 bg-white transform transition-transform duration-300 ease-in-out lg:hidden shadow-xl",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center h-20 px-6 border-b">
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary/90 to-indigo-600 bg-clip-text text-transparent">
              Sistema de Cotización
            </h1>
          </div>

          <div className="flex flex-col flex-grow overflow-y-auto px-4 py-6">
            <div className="mb-6">
              <div className="px-3 mb-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Menú Principal
                </h3>
              </div>
              <nav className="space-y-1">
                {navigationItems.map((item) => renderNavLink(item, true))}
              </nav>
            </div>
            
            <div>
              <div className="px-3 mb-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Actividad Reciente
                </h3>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="flex items-center text-sm text-slate-600 mb-2">
                  <Activity className="h-4 w-4 mr-2 text-primary" />
                  <span>2 cotizaciones pendientes</span>
                </div>
                <div className="text-xs text-slate-500">
                  Última actualización: hace 20 min
                </div>
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 p-4 border-t">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-primary flex items-center justify-center text-white font-medium text-sm">
                  JS
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-slate-700">Jane Smith</p>
                <p className="text-xs text-slate-500">Administrador</p>
              </div>
              <Button variant="ghost" size="icon" className="ml-auto h-8 w-8">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <div className="flex flex-col w-80 border-r bg-white">
          <div className="flex items-center h-20 px-6 border-b">
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary/90 to-indigo-600 bg-clip-text text-transparent">
              Sistema de Cotización
            </h1>
          </div>

          <div className="flex flex-col flex-grow overflow-y-auto px-4 py-6">
            <div className="mb-6">
              <div className="px-3 mb-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Menú Principal
                </h3>
              </div>
              <nav className="space-y-1">
                {navigationItems.map((item) => renderNavLink(item))}
              </nav>
            </div>
            
            <div>
              <div className="px-3 mb-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Actividad Reciente
                </h3>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="flex items-center text-sm text-slate-600 mb-2">
                  <Activity className="h-4 w-4 mr-2 text-primary" />
                  <span>2 cotizaciones pendientes</span>
                </div>
                <div className="text-xs text-slate-500">
                  Última actualización: hace 20 min
                </div>
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 p-4 border-t">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-primary flex items-center justify-center text-white font-medium text-sm">
                  JS
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-slate-700">Jane Smith</p>
                <p className="text-xs text-slate-500">Administrador</p>
              </div>
              <Button variant="ghost" size="icon" className="ml-auto h-8 w-8">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
