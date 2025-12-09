import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface TooltipInfo {
  title: string;
  formula?: string;
  source?: string;
  note?: string;
}

interface KPICardProps {
  tier: 1 | 2 | 3;
  label: string;
  value: string | number;
  sublabel?: string;
  suffix?: string;
  icon?: ReactNode;
  tooltip?: TooltipInfo;
  variant?: 'green' | 'blue' | 'purple' | 'red' | 'amber' | 'neutral' | 'success' | 'danger';
  gradient?: boolean;
  className?: string;
  dataTestId?: string;
}

const tierStyles = {
  1: {
    card: "border-0 shadow-lg",
    content: "p-6",
    label: "text-sm font-medium uppercase tracking-wide mb-1",
    value: "text-3xl font-semibold",
    sublabel: "text-xs mb-3",
    icon: "p-3 rounded-full",
    iconSize: "h-6 w-6"
  },
  2: {
    card: "border-0 shadow-md",
    content: "p-4",
    label: "text-sm font-medium mb-1",
    value: "text-2xl font-bold",
    sublabel: "text-xs mt-1",
    icon: "p-2 rounded-lg",
    iconSize: "h-5 w-5"
  },
  3: {
    card: "border-0 shadow-md",
    content: "p-4",
    label: "text-xs uppercase",
    value: "text-xl font-bold",
    sublabel: "text-xs mt-1",
    icon: "p-2 rounded-lg",
    iconSize: "h-5 w-5"
  }
};

const variantColors = {
  green: {
    gradient: "bg-gradient-to-br from-emerald-50 to-green-50",
    solid: "bg-emerald-50",
    label: "text-emerald-700",
    value: "text-emerald-800",
    icon: "bg-emerald-100",
    iconColor: "text-emerald-600",
    info: "text-emerald-500"
  },
  blue: {
    gradient: "bg-gradient-to-br from-blue-50 to-slate-50",
    solid: "bg-blue-50",
    label: "text-blue-700",
    value: "text-blue-800",
    icon: "bg-blue-100",
    iconColor: "text-blue-600",
    info: "text-blue-500"
  },
  purple: {
    gradient: "bg-gradient-to-br from-violet-50 to-purple-50",
    solid: "bg-purple-50",
    label: "text-purple-700",
    value: "text-purple-800",
    icon: "bg-purple-100",
    iconColor: "text-purple-600",
    info: "text-purple-500"
  },
  red: {
    gradient: "bg-gradient-to-br from-red-50 to-rose-50",
    solid: "bg-red-50",
    label: "text-red-700",
    value: "text-red-700",
    icon: "bg-red-100",
    iconColor: "text-red-600",
    info: "text-red-400"
  },
  amber: {
    gradient: "bg-gradient-to-br from-amber-50 to-yellow-50",
    solid: "bg-amber-50",
    label: "text-amber-700",
    value: "text-amber-800",
    icon: "bg-amber-100",
    iconColor: "text-amber-600",
    info: "text-amber-500"
  },
  neutral: {
    gradient: "bg-white",
    solid: "bg-gray-50",
    label: "text-gray-600",
    value: "text-gray-800",
    icon: "bg-gray-200",
    iconColor: "text-gray-600",
    info: "text-gray-400"
  },
  success: {
    gradient: "bg-gradient-to-br from-green-50 to-emerald-50",
    solid: "bg-green-50",
    label: "text-green-700",
    value: "text-green-800",
    icon: "bg-green-100",
    iconColor: "text-green-600",
    info: "text-green-500"
  },
  danger: {
    gradient: "bg-gradient-to-br from-red-50 to-rose-50",
    solid: "bg-red-50",
    label: "text-red-700",
    value: "text-red-700",
    icon: "bg-red-100",
    iconColor: "text-red-600",
    info: "text-red-400"
  }
};

export function KPICard({
  tier,
  label,
  value,
  sublabel,
  suffix,
  icon,
  tooltip,
  variant = 'neutral',
  gradient = false,
  className,
  dataTestId
}: KPICardProps) {
  const styles = tierStyles[tier];
  const colors = variantColors[variant];

  return (
    <Card className={cn(
      styles.card,
      gradient ? colors.gradient : (tier === 1 ? colors.gradient : colors.solid),
      className
    )}>
      <CardContent className={styles.content}>
        <div className={tier === 1 ? "flex items-start justify-between" : (tier === 3 ? "flex items-center gap-3" : "")}>
          {tier === 3 && icon && (
            <div className={cn(styles.icon, colors.icon)}>
              <span className={cn(styles.iconSize, colors.iconColor)}>{icon}</span>
            </div>
          )}
          
          <div className={tier === 3 ? "" : "flex-1"}>
            <div className="flex items-center gap-2">
              <span className={cn(styles.label, colors.label)}>{label}</span>
              {tooltip && (
                <Tooltip>
                  <TooltipTrigger>
                    <Info className={cn("h-4 w-4", colors.info)} />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[280px]">
                    <p className="text-xs font-medium mb-1">{tooltip.title}</p>
                    {tooltip.formula && (
                      <p className="text-xs text-gray-300">{tooltip.formula}</p>
                    )}
                    {tooltip.note && (
                      <p className="text-xs text-gray-400 mt-1">{tooltip.note}</p>
                    )}
                    {tooltip.source && (
                      <p className="text-xs text-gray-400 mt-1">Fuente: {tooltip.source}</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            
            {tier === 1 && sublabel && (
              <p className={cn(styles.sublabel, "text-gray-600")}>{sublabel}</p>
            )}
            
            <div className={cn(styles.value, colors.value)} data-testid={dataTestId}>
              {value}{suffix && <span className="text-lg font-normal ml-2">{suffix}</span>}
            </div>
            
            {tier !== 1 && sublabel && (
              <p className={cn(styles.sublabel, "text-gray-500")}>{sublabel}</p>
            )}
          </div>
          
          {tier === 1 && icon && (
            <div className={cn(styles.icon, colors.icon)}>
              <span className={colors.iconColor}>{icon}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function formatCurrency(value: number, decimals = 1): string {
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(decimals)}k`;
  }
  return `$${value.toFixed(0)}`;
}

export function formatPct(value: number): string {
  return `${value.toFixed(0)}%`;
}

export function formatNumber(value: number): string {
  return value.toFixed(0);
}
