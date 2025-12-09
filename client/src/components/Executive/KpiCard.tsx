import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface TrendData {
  months: string[];
  values: number[];
}

interface DiffData {
  vsPrevMonth: number | null;
  vs3mAvg: number | null;
}

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  formula?: string;
  diffPrev?: number | null;
  diff3m?: number | null;
  trend?: TrendData;
  tone?: 'positive' | 'negative' | 'neutral';
  size?: 'xl' | 'lg' | 'md' | 'sm';
  colorScheme?: 'green' | 'blue' | 'violet' | 'neutral';
  icon?: React.ReactNode;
}

function Sparkline({ data, color = '#10b981' }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return null;
  
  const maxVal = Math.max(...data);
  const minVal = Math.min(...data);
  const range = maxVal - minVal || 1;
  
  const width = 80;
  const height = 24;
  const padding = 2;
  
  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((val - minVal) / range) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <svg width={width} height={height} className="opacity-70">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function DiffBadge({ value, label, small = false }: { value: number | null; label?: string; small?: boolean }) {
  if (value === null) {
    return (
      <span className={`inline-flex items-center font-medium rounded-full bg-gray-100 text-gray-500 ${
        small ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
      }`}>
        {label || '—%'}
      </span>
    );
  }
  
  const isPositive = value >= 0;
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
  
  return (
    <span className={`inline-flex items-center font-medium rounded-full ${
      isPositive 
        ? 'bg-emerald-100 text-emerald-700' 
        : 'bg-red-100 text-red-700'
    } ${small ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'}`}>
      <Icon className={small ? 'h-2.5 w-2.5 mr-0.5' : 'h-3 w-3 mr-0.5'} />
      {isPositive ? '+' : ''}{value.toFixed(0)}%
      {label && <span className="ml-0.5 opacity-70">{label}</span>}
    </span>
  );
}

const colorSchemes = {
  green: {
    gradient: 'from-emerald-50 via-green-50 to-white',
    accent: 'text-emerald-600',
    icon: 'bg-emerald-100/80 text-emerald-600',
    sparkline: '#10b981'
  },
  blue: {
    gradient: 'from-blue-50 via-indigo-50 to-white',
    accent: 'text-blue-600',
    icon: 'bg-blue-100/80 text-blue-600',
    sparkline: '#3b82f6'
  },
  violet: {
    gradient: 'from-violet-50 via-purple-50 to-white',
    accent: 'text-violet-600',
    icon: 'bg-violet-100/80 text-violet-600',
    sparkline: '#8b5cf6'
  },
  neutral: {
    gradient: 'from-gray-50 via-slate-50 to-white',
    accent: 'text-gray-600',
    icon: 'bg-gray-100/80 text-gray-600',
    sparkline: '#6b7280'
  }
};

const sizeStyles = {
  xl: {
    padding: 'p-6',
    title: 'text-xs',
    value: 'text-4xl',
    subtitle: 'text-sm'
  },
  lg: {
    padding: 'p-5',
    title: 'text-xs',
    value: 'text-3xl',
    subtitle: 'text-sm'
  },
  md: {
    padding: 'p-4',
    title: 'text-[11px]',
    value: 'text-2xl',
    subtitle: 'text-xs'
  },
  sm: {
    padding: 'p-3',
    title: 'text-[10px]',
    value: 'text-xl',
    subtitle: 'text-xs'
  }
};

export default function KpiCard({
  title,
  value,
  subtitle,
  formula,
  diffPrev,
  diff3m,
  trend,
  tone = 'neutral',
  size = 'md',
  colorScheme = 'neutral',
  icon
}: KpiCardProps) {
  const colors = colorSchemes[colorScheme];
  const styles = sizeStyles[size];
  
  return (
    <Card className={`border-0 shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br ${colors.gradient}`}>
      <CardContent className={styles.padding}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`${styles.title} font-semibold ${colors.accent} uppercase tracking-wider`}>
                {title}
              </span>
              {formula && (
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[260px]">
                    <p className="text-xs font-medium mb-1">{title}</p>
                    <p className="text-xs text-gray-300">{formula}</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {diffPrev !== undefined && (
                <DiffBadge value={diffPrev} small={size === 'sm'} />
              )}
            </div>
            
            <div className={`${styles.value} font-bold text-gray-900 tracking-tight`} data-testid={`kpi-${title.toLowerCase().replace(/\s+/g, '-')}`}>
              {value}
            </div>
            
            {subtitle && (
              <p className={`${styles.subtitle} text-gray-500 mt-1.5`}>{subtitle}</p>
            )}
            
            {diff3m !== undefined && diff3m !== null && (
              <div className="flex items-center gap-1 mt-2">
                <span className="text-[10px] text-gray-400">vs 3m:</span>
                <DiffBadge value={diff3m} small />
              </div>
            )}
          </div>
          
          <div className="flex flex-col items-end gap-2">
            {icon && (
              <div className={`p-2 rounded-xl ${colors.icon}`}>
                {icon}
              </div>
            )}
            {trend && trend.values && trend.values.length > 1 && (
              <Sparkline data={trend.values} color={colors.sparkline} />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export { DiffBadge, Sparkline };
