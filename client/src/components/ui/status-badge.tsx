import React from 'react';
import { cn } from '@/lib/utils';
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Edit, 
  Info,
  Tag
} from 'lucide-react';

export type StatusVariant = 
  | 'success' 
  | 'warning' 
  | 'error' 
  | 'primary' 
  | 'neutral' 
  | 'info';

export interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  children?: React.ReactNode;
  text?: string;
  icon?: React.ReactNode;
  className?: string;
  glassEffect?: boolean;
  animated?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const variantClasses: Record<StatusVariant, string> = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  error: 'bg-destructive/10 text-destructive',
  primary: 'bg-primary/10 text-primary',
  neutral: 'bg-neutral-200 text-neutral-700',
  info: 'bg-blue-100 text-blue-700'
};

const variantIcons: Record<StatusVariant, React.ReactNode> = {
  success: <CheckCircle className="h-3.5 w-3.5" />,
  warning: <Clock className="h-3.5 w-3.5" />,
  error: <AlertCircle className="h-3.5 w-3.5" />,
  primary: <Edit className="h-3.5 w-3.5" />,
  neutral: <Tag className="h-3.5 w-3.5" />,
  info: <Info className="h-3.5 w-3.5" />
};

export const StatusBadge = ({
  status,
  variant = 'neutral',
  children,
  text,
  icon,
  className,
  glassEffect = false,
  animated = false,
  size = 'md'
}: StatusBadgeProps) => {
  // Determinar el contenido a mostrar
  const displayText = children || text || status;
  
  // Determinar el icono a mostrar
  const displayIcon = icon || variantIcons[variant];
  
  // Determinar las clases de tamaño
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-caption px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5'
  };
  
  const animationClass = animated ? 'animate-pulse' : '';
  const glassClass = glassEffect ? 'backdrop-blur-md' : '';
  
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium transition-all',
        variantClasses[variant],
        sizeClasses[size],
        animationClass,
        glassClass,
        'shadow-sm',
        className
      )}
    >
      {displayIcon && (
        <span className="mr-1.5 flex-shrink-0">{displayIcon}</span>
      )}
      {displayText}
    </span>
  );
};

// Helper para mapear estados comunes de cotizaciones
export const getStatusBadgeForQuote = (status: string) => {
  switch (status) {
    case 'approved':
      return <StatusBadge status="Aprobada" variant="success" glassEffect />;
    case 'rejected':
      return <StatusBadge status="Rechazada" variant="error" glassEffect />;
    case 'pending':
      return <StatusBadge status="Pendiente" variant="warning" glassEffect />;
    case 'in-negotiation':
      return <StatusBadge status="En Negociación" variant="primary" glassEffect />;
    default:
      return <StatusBadge status={status} variant="neutral" glassEffect />;
  }
};

// Helper para mapear estados comunes de proyectos
export const getStatusBadgeForProject = (status: string) => {
  switch (status) {
    case 'active':
      return <StatusBadge status="Activo" variant="success" glassEffect />;
    case 'completed':
      return <StatusBadge status="Completado" variant="primary" glassEffect />;
    case 'on-hold':
      return <StatusBadge status="En Pausa" variant="warning" glassEffect />;
    case 'cancelled':
      return <StatusBadge status="Cancelado" variant="error" glassEffect />;
    default:
      return <StatusBadge status={status} variant="neutral" glassEffect />;
  }
};