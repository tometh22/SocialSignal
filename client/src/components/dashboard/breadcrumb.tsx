
import { useLocation } from 'wouter';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbProps {
  items: { label: string; href?: string }[];
}

export const Breadcrumb = ({ items }: BreadcrumbProps) => {
  const [, setLocation] = useLocation();

  return (
    <div className="flex items-center text-sm text-muted-foreground mb-4">
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index === 0 && (
            <Home className="h-4 w-4 mr-2" />
          )}
          {index > 0 && <ChevronRight className="h-4 w-4 mx-2" />}
          {item.href ? (
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
      ))}
    </div>
  );
};

export default Breadcrumb;