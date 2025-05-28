import React from 'react';
import { cn } from '@/lib/utils';

// ========================================
// COMPONENTES ESTÁNDAR REUTILIZABLES
// ========================================

interface StandardCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'standard' | 'compact';
  children: React.ReactNode;
}

export const StandardCard: React.FC<StandardCardProps> = ({ 
  variant = 'standard', 
  children, 
  className,
  ...props 
}) => {
  const baseClass = variant === 'compact' ? 'card-compact' : 'card-standard';
  return (
    <div className={cn(baseClass, className)} {...props}>
      {children}
    </div>
  );
};

interface StandardHeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level: 'page' | 'section' | 'card';
  children: React.ReactNode;
}

export const StandardHeading: React.FC<StandardHeadingProps> = ({ 
  level, 
  children, 
  className,
  ...props 
}) => {
  const headingClass = `heading-${level}`;
  const Component = level === 'page' ? 'h1' : level === 'section' ? 'h2' : 'h3';
  
  return React.createElement(Component, {
    className: cn(headingClass, className),
    ...props
  }, children);
};

interface StandardTextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  variant?: 'body' | 'body-sm' | 'muted' | 'caption';
  children: React.ReactNode;
}

export const StandardText: React.FC<StandardTextProps> = ({ 
  variant = 'body', 
  children, 
  className,
  ...props 
}) => {
  const textClass = variant === 'body' ? 'text-body' : 
                   variant === 'body-sm' ? 'text-body-sm' :
                   variant === 'muted' ? 'text-muted' : 'text-caption';
  
  return (
    <p className={cn(textClass, className)} {...props}>
      {children}
    </p>
  );
};

interface StandardLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  children: React.ReactNode;
}

export const StandardLabel: React.FC<StandardLabelProps> = ({ 
  required = false, 
  children, 
  className,
  ...props 
}) => {
  return (
    <label className={cn('label-standard', required && 'label-required', className)} {...props}>
      {children}
    </label>
  );
};

interface StandardButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: React.ReactNode;
}

export const StandardButton: React.FC<StandardButtonProps> = ({ 
  variant = 'primary', 
  children, 
  className,
  ...props 
}) => {
  const buttonClass = 'btn-standard';
  const variantClass = variant === 'primary' ? 'bg-primary text-primary-foreground hover:bg-primary/90' :
                      variant === 'secondary' ? 'bg-secondary text-secondary-foreground border-border hover:bg-secondary/80' :
                      'hover:bg-accent hover:text-accent-foreground';
  
  return (
    <button className={cn(buttonClass, variantClass, className)} {...props}>
      {children}
    </button>
  );
};

interface StandardInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const StandardInput: React.FC<StandardInputProps> = ({ 
  className,
  ...props 
}) => {
  return (
    <input className={cn('input-standard', className)} {...props} />
  );
};

interface StandardContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'page' | 'wide';
  children: React.ReactNode;
}

export const StandardContainer: React.FC<StandardContainerProps> = ({ 
  variant = 'page', 
  children, 
  className,
  ...props 
}) => {
  const containerClass = variant === 'wide' ? 'page-container-wide' : 'page-container';
  return (
    <div className={cn(containerClass, className)} {...props}>
      {children}
    </div>
  );
};

interface StandardGridProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'standard' | 'compact' | 'tight';
  children: React.ReactNode;
}

export const StandardGrid: React.FC<StandardGridProps> = ({ 
  variant = 'standard', 
  children, 
  className,
  ...props 
}) => {
  const gridClass = `grid-${variant}`;
  return (
    <div className={cn(gridClass, className)} {...props}>
      {children}
    </div>
  );
};

interface StandardFlexProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'between' | 'center' | 'start';
  children: React.ReactNode;
}

export const StandardFlex: React.FC<StandardFlexProps> = ({ 
  variant = 'start', 
  children, 
  className,
  ...props 
}) => {
  const flexClass = `flex-${variant}`;
  return (
    <div className={cn(flexClass, className)} {...props}>
      {children}
    </div>
  );
};

// Componente de mensaje de estado estándar
interface StandardMessageProps {
  type: 'error' | 'success' | 'warning' | 'info';
  children: React.ReactNode;
  className?: string;
}

export const StandardMessage: React.FC<StandardMessageProps> = ({ 
  type, 
  children, 
  className 
}) => {
  const messageClass = type === 'error' ? 'error-message' : 
                      type === 'success' ? 'success-message' :
                      'text-muted';
  
  return (
    <div className={cn(messageClass, className)}>
      {children}
    </div>
  );
};

// Separador estándar
interface StandardDividerProps {
  variant?: 'standard' | 'compact';
  className?: string;
}

export const StandardDivider: React.FC<StandardDividerProps> = ({ 
  variant = 'standard', 
  className 
}) => {
  const dividerClass = variant === 'compact' ? 'divider-compact' : 'divider';
  return <hr className={cn(dividerClass, className)} />;
};