import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeltaBadgeProps {
  currentValue: number;
  previousValue: number;
  format?: 'number' | 'percentage' | 'currency' | 'multiplier' | 'hours';
  reverse?: boolean;
  className?: string;
  showValue?: boolean;
}

export function DeltaBadge({
  currentValue,
  previousValue,
  format = 'number',
  reverse = false,
  className,
  showValue = true
}: DeltaBadgeProps) {
  if (previousValue === 0 || !isFinite(previousValue) || !isFinite(currentValue)) {
    return null;
  }

  const delta = currentValue - previousValue;
  const deltaPercentage = (delta / Math.abs(previousValue)) * 100;
  
  const isPositive = delta > 0;
  const isNeutral = Math.abs(deltaPercentage) < 0.5;
  
  const isImprovement = reverse ? !isPositive : isPositive;

  const formatValue = (value: number): string => {
    switch (format) {
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'currency':
        return `$${value.toFixed(0)}`;
      case 'multiplier':
        return `${value.toFixed(1)}x`;
      case 'hours':
        return `${value.toFixed(1)}h`;
      default:
        return value.toFixed(1);
    }
  };

  if (isNeutral) {
    return (
      <div className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium", className)}>
        <Minus className="h-3 w-3" />
        <span>Sin cambios</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
      isImprovement 
        ? "bg-green-100 text-green-700" 
        : "bg-red-100 text-red-700",
      className
    )}>
      {isPositive ? (
        <ArrowUp className="h-3 w-3" />
      ) : (
        <ArrowDown className="h-3 w-3" />
      )}
      <span>
        {showValue && formatValue(Math.abs(delta))}
        {' '}
        ({Math.abs(deltaPercentage).toFixed(1)}%)
      </span>
    </div>
  );
}

export function DeltaIndicator({
  label,
  currentValue,
  previousValue,
  format = 'number',
  reverse = false,
  className
}: DeltaBadgeProps & { label: string }) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <span className="text-xs text-gray-500">{label}</span>
      <DeltaBadge
        currentValue={currentValue}
        previousValue={previousValue}
        format={format}
        reverse={reverse}
      />
    </div>
  );
}
