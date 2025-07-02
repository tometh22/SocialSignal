
import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronRight, Home } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

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
  showBreadcrumbs?: boolean;
}

export function PageHeader({
  title,
  description,
  breadcrumbs = [],
  actions,
  className = "",
  showBreadcrumbs = true
}: PageHeaderProps) {
  const [, navigate] = useLocation();

  const handleBreadcrumbClick = (href: string) => {
    if (href) {
      navigate(href);
    }
  };

  return (
    <div className={cn("page-header", className)}>
      <div className="page-header-content">
        {/* Breadcrumbs */}
        {showBreadcrumbs && breadcrumbs.length > 0 && (
          <nav className="page-breadcrumbs">
            <div className="breadcrumb-item">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
                className="p-0 h-auto font-normal breadcrumb-link hover:text-gray-900 transition-colors"
              >
                <Home className="h-4 w-4 mr-1" />
                Dashboard
              </Button>
            </div>
            
            {breadcrumbs.map((item, index) => (
              <React.Fragment key={index}>
                <ChevronRight className="h-4 w-4 breadcrumb-separator" />
                <div className="breadcrumb-item">
                  {item.current ? (
                    <span className="breadcrumb-current">{item.label}</span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => item.href && handleBreadcrumbClick(item.href)}
                      className="p-0 h-auto font-normal breadcrumb-link hover:text-gray-900 transition-colors"
                    >
                      {item.label}
                    </Button>
                  )}
                </div>
              </React.Fragment>
            ))}
          </nav>
        )}

        {/* Title and Actions */}
        <div className="page-title-section">
          <div className="page-title-content">
            <h1 className="page-title">
              {title}
            </h1>
            {description && (
              <p className="page-description">
                {description}
              </p>
            )}
          </div>
          
          {actions && (
            <div className="page-actions">
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
      { label: "Estadísticas y Análisis", current: true }
    ],
    "/admin": [
      { label: "Panel de Administración", current: true }
    ]
  };

  return routeMap[location] || [];
}
