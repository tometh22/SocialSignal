import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronRight, Home } from "lucide-react";
import { useLocation } from "wouter";

interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs = [],
  actions,
  className = ""
}: PageHeaderProps) {
  const [, navigate] = useLocation();

  const handleBreadcrumbClick = (href: string) => {
    if (href) {
      navigate(href);
    }
  };

  return (
    <div className={`bg-white border-b border-gray-200 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumbs */}
        {breadcrumbs.length > 0 && (
          <nav className="flex items-center space-x-2 text-sm py-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="p-0 h-auto font-normal text-gray-500 hover:text-gray-900 transition-colors"
            >
              <Home className="h-4 w-4 mr-1" />
              Inicio
            </Button>
            
            {breadcrumbs.map((item, index) => (
              <React.Fragment key={index}>
                <ChevronRight className="h-4 w-4 text-gray-400" />
                {item.current ? (
                  <span className="text-gray-900 font-medium">{item.label}</span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => item.href && handleBreadcrumbClick(item.href)}
                    className="p-0 h-auto font-normal text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    {item.label}
                  </Button>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        {/* Title and Actions */}
        <div className="flex items-center justify-between py-6">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:leading-9">
              {title}
            </h1>
            {description && (
              <p className="mt-1 text-sm text-gray-500">
                {description}
              </p>
            )}
          </div>
          
          {actions && (
            <div className="flex items-center space-x-3 ml-4">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Hook para generar breadcrumbs automáticamente basado en la ruta
export function useBreadcrumbs(customBreadcrumbs?: BreadcrumbItem[]) {
  const [location] = useLocation();
  
  if (customBreadcrumbs) {
    return customBreadcrumbs;
  }

  // Mapeo de rutas a breadcrumbs
  const routeMap: Record<string, BreadcrumbItem[]> = {
    "/active-projects": [
      { label: "Proyectos Activos", current: true }
    ],
    "/manage-quotes": [
      { label: "Gestión de Cotizaciones", current: true }
    ],
    "/optimized-quote": [
      { label: "Gestión de Cotizaciones", href: "/manage-quotes" },
      { label: "Nueva Cotización", current: true }
    ],
    "/clients": [
      { label: "Clientes", current: true }
    ],
    "/statistics": [
      { label: "Estadísticas", current: true }
    ],
    "/admin": [
      { label: "Administración", current: true }
    ]
  };

  return routeMap[location] || [];
}