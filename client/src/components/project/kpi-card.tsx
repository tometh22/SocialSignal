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
  progress
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

  return (
    <Card className="border bg-card shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={cn("p-2 rounded-md", colorStyles[color])}>
                {icon}
              </div>
              <h3 className="font-medium">{title}</h3>
            </div>
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
                indicatorClassName={cn(
                  color === "red" ? "bg-red-500" : 
                  color === "amber" ? "bg-amber-500" : 
                  color === "green" ? "bg-green-500" : 
                  color === "blue" ? "bg-blue-500" :
                  color === "purple" ? "bg-purple-500" : "bg-primary"
                )}
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