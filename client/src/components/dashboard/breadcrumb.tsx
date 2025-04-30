import React from 'react';
import { useLocation } from 'wouter';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbProps {
  items: { label: string; href?: string }[];
}

export const Breadcrumb = ({ items }: BreadcrumbProps) => {
  const [, setLocation] = useLocation();

  return (
    <div className="flex items-center text-sm text-muted-foreground mb-4">
      {items.map((item, index) => {
        const isFirst = index === 0;
        const isNotFirst = index > 0;
        const hasHref = !!item.href;
        
        return (
          <React.Fragment key={index}>
            {isFirst && <Home className="h-4 w-4 mr-2" />}
            {isNotFirst && <ChevronRight className="h-4 w-4 mx-2" />}
            {hasHref ? (
              <button
                className="hover:text-foreground transition-colors"
                onClick={() => item.href && setLocation(item.href)}
              >
                {item.label}
              </button>
            ) : (
              <span className="text-foreground font-medium">{item.label}</span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default Breadcrumb;