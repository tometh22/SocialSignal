import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export const KpiCard: React.FC<KpiCardProps> = ({ 
  title,
  value,
  subtitle,
  icon,
  trend
}) => {
  return (
    <Card className="border bg-background shadow-sm">
      <CardContent className="p-5">
        <div className="flex flex-col">
          <div className="text-sm text-muted-foreground mb-2">{title}</div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold">{value}</span>
            <div className="rounded-full p-1.5 bg-primary/10">{icon}</div>
          </div>
          {subtitle && (
            <div className="text-sm text-muted-foreground mt-1">{subtitle}</div>
          )}
          {trend && (
            <div className="mt-2 text-xs">
              {trend.isPositive ? (
                <div className="flex items-center text-green-600">
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                  <span>+{trend.value}% semana anterior</span>
                </div>
              ) : (
                <div className="flex items-center text-red-600">
                  <ArrowDownRight className="h-3 w-3 mr-1" />
                  <span>{trend.value}% semana anterior</span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};