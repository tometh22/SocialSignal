
import React from "react";
import { PageHeader, BreadcrumbItem } from "./page-header";
import { cn } from "@/lib/utils";

interface PageLayoutProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  showBreadcrumbs?: boolean;
  headerClassName?: string;
  contentClassName?: string;
}

export function PageLayout({
  title,
  description,
  breadcrumbs,
  actions,
  children,
  className,
  showBreadcrumbs = true,
  headerClassName,
  contentClassName
}: PageLayoutProps) {
  return (
    <div className={cn("min-h-screen bg-gray-50", className)}>
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={breadcrumbs}
        actions={actions}
        showBreadcrumbs={showBreadcrumbs}
        className={headerClassName}
      />
      
      <main className={cn("max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6", contentClassName)}>
        {children}
      </main>
    </div>
  );
}

export default PageLayout;
