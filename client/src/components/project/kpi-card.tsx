import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string | number;
  description?: string | React.ReactNode;
  icon: React.ReactNode;
  color?: "blue" | "green" | "red" | "amber" | "purple" | "default";
  trend?: number;
  trendDirection?: "up" | "down" | "neutral";
  trendText?: string;
  progress?: number;
  variant?: "standard" | "compact" | "ribbon";
  onClick?: () => void;
  helpTip?: string;
  onHelpClick?: () => void;
}

export const KpiCard: React.FC<KpiCardProps> = ({ 
  title,
  value,
  description,
  icon,
  color = "default",
  trend,
  trendDirection = "neutral",
  trendText,
  progress,
  variant = "standard",
  onClick,
  helpTip,
  onHelpClick
}) => {
  const colorStyles = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    green: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
    red: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
    default: "bg-primary/10 text-primary"
  };

  const trendColorStyles = {
    up: "text-red-600",
    down: "text-green-600",
    neutral: "text-blue-600"
  };
  
  const progressColorClasses = 
    color === "red" ? "bg-red-500" : 
    color === "amber" ? "bg-amber-500" : 
    color === "green" ? "bg-green-500" : 
    color === "blue" ? "bg-blue-500" :
    color === "purple" ? "bg-purple-500" : "bg-primary";

  // Variante ribbon para el nuevo diseño horizontal
  if (variant === "ribbon") {
    return (
      <div 
        className={cn(
          "flex flex-col border rounded-lg p-3 bg-card hover:shadow-sm transition-all",
          onClick ? "cursor-pointer hover:border-primary/50" : ""
        )}
        onClick={onClick}
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-md", colorStyles[color])}>
              {icon}
            </div>
            <span className="font-medium text-sm whitespace-nowrap">{title}</span>
          </div>
          
          {helpTip && onHelpClick && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onHelpClick();
              }}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-muted"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                <path d="M12 17h.01"></path>
              </svg>
            </button>
          )}
        </div>
        
        <div className="text-2xl font-bold">{value}</div>
        
        {progress !== undefined && (
          <div className="mt-1 mb-1">
            <Progress
              value={progress}
              className="h-1.5"
              indicatorClassName={progressColorClasses}
            />
          </div>
        )}
        
        {description && (
          <div className="text-xs text-muted-foreground mt-1">{description}</div>
        )}
        
        {trend !== undefined && trendText && (
          <div className="mt-1.5">
            <div className={cn("flex items-center text-xs gap-1", trendColorStyles[trendDirection])}>
              {trendDirection === "up" ? (
                <TrendingUp className="h-3 w-3" />
              ) : trendDirection === "down" ? (
                <TrendingDown className="h-3 w-3" />
              ) : null}
              <span>{trend}% {trendText}</span>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  // Variante compacta para espacios reducidos
  if (variant === "compact") {
    return (
      <Card className={cn(
        "border bg-card hover:shadow-sm transition-shadow overflow-hidden",
        onClick ? "cursor-pointer hover:border-primary/50" : ""
      )}
      onClick={onClick}>
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-md", colorStyles[color])}>
              {icon}
            </div>
            <div>
              <h3 className="font-medium text-sm">{title}</h3>
              <div className="text-xl font-bold">{value}</div>
            </div>
          </div>
          
          {progress !== undefined && (
            <div className="mt-2">
              <Progress
                value={progress}
                className="h-1"
                indicatorClassName={progressColorClasses}
              />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
  
  // Variante estándar (original)
  return (
    <Card className={cn(
      "border bg-card shadow-sm hover:shadow-md transition-shadow", 
      onClick ? "cursor-pointer hover:border-primary/50" : ""
    )}
    onClick={onClick}>
      <CardContent className="p-5">
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={cn("p-2 rounded-md", colorStyles[color])}>
                {icon}
              </div>
              <h3 className="font-medium">{title}</h3>
            </div>
            
            {helpTip && onHelpClick && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onHelpClick();
                }}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-muted"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                  <path d="M12 17h.01"></path>
                </svg>
              </button>
            )}
          </div>
          
          <div className="mb-2">
            <div className="text-3xl font-bold tracking-tight">{value}</div>
            {description && (
              <div className="text-sm text-muted-foreground mt-1">{description}</div>
            )}
          </div>
          
          {progress !== undefined && (
            <div className="mt-2 mb-1">
              <Progress
                value={progress}
                className="h-1.5"
                indicatorClassName={progressColorClasses}
              />
            </div>
          )}
          
          {trend !== undefined && trendText && (
            <div className="mt-2">
              <div className={cn("flex items-center text-xs gap-1", trendColorStyles[trendDirection])}>
                {trendDirection === "up" ? (
                  <TrendingUp className="h-3 w-3" />
                ) : trendDirection === "down" ? (
                  <TrendingDown className="h-3 w-3" />
                ) : null}
                <span>{trend}% {trendText}</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};