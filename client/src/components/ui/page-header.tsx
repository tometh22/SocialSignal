
import React from "react";
import { cn } from "@/lib/utils";
import { PageHeading } from "@/components/layout/page-heading";
import { useLocation } from "wouter";

export interface BreadcrumbItem {
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
  const eyebrow = showBreadcrumbs && breadcrumbs.length > 0
    ? breadcrumbs.map((item) => item.label).join(" / ")
    : "Mind workspace";

  return (
    <div className={cn("mx-auto w-full max-w-[1440px] px-0 pb-1", className)}>
      <div className="page-header-content">
        <PageHeading
          eyebrow={eyebrow}
          title={title}
          description={description}
          actions={actions}
        />
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
