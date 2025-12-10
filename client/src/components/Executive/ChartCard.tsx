import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip as RechartsTooltip, Legend, PieChart, Pie, Cell
} from "recharts";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  tooltip?: string;
  color: 'emerald' | 'blue' | 'violet';
  children: React.ReactNode;
}

export function ChartCard({ title, subtitle, tooltip, color, children }: ChartCardProps) {
  const colorMap = {
    emerald: 'from-emerald-50 to-white',
    blue: 'from-blue-50 to-white',
    violet: 'from-violet-50 to-white'
  };
  
  return (
    <Card className={`border-0 shadow-sm bg-gradient-to-br ${colorMap[color]}`} data-testid={`chart-${title.toLowerCase().replace(/\s/g, '-')}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger><Info className="h-3.5 w-3.5 text-gray-400" /></TooltipTrigger>
              <TooltipContent className="max-w-[200px]">
                <p className="text-xs">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="h-[180px]">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

interface TrendData {
  months: string[];
  values: number[];
}

interface MultiSeriesTrend {
  months: string[];
  series: { [key: string]: number[] };
}

interface LineChartSimpleProps {
  data: TrendData;
  color: string;
  formatValue?: (v: number) => string;
  showArea?: boolean;
}

export function LineChartSimple({ data, color, formatValue, showArea }: LineChartSimpleProps) {
  if (!data?.months?.length || !data?.values?.length) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">Sin datos</div>;
  }
  const chartData = data.months.map((m, i) => ({
    month: m.slice(5),
    value: data.values[i] || 0
  }));
  
  const format = formatValue || ((v: number) => `$${(v/1000).toFixed(0)}k`);
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      {showArea ? (
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#9ca3af" />
          <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" tickFormatter={format} width={45} />
          <RechartsTooltip 
            formatter={(v: number) => [format(v), '']}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Area type="monotone" dataKey="value" stroke={color} fill={`url(#gradient-${color})`} strokeWidth={2} />
        </AreaChart>
      ) : (
        <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#9ca3af" />
          <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" tickFormatter={format} width={45} />
          <RechartsTooltip 
            formatter={(v: number) => [format(v), '']}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}

interface StackedBarChartProps {
  data: MultiSeriesTrend;
  colors: { [key: string]: string };
  labels: { [key: string]: string };
  formatValue?: (v: number) => string;
}

export function StackedBarChart({ data, colors, labels, formatValue }: StackedBarChartProps) {
  if (!data?.months?.length || !data?.series) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">Sin datos</div>;
  }
  const seriesKeys = Object.keys(data.series);
  const chartData = data.months.map((m, i) => {
    const point: any = { month: m.slice(5) };
    seriesKeys.forEach(k => {
      point[k] = data.series[k]?.[i] || 0;
    });
    return point;
  });
  
  const format = formatValue || ((v: number) => `${v.toFixed(0)}`);
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#9ca3af" />
        <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" tickFormatter={format} width={40} />
        <RechartsTooltip 
          formatter={(v: number, name: string) => [format(v), labels[name] || name]}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Legend 
          formatter={(value: string) => labels[value] || value}
          wrapperStyle={{ fontSize: 10 }}
        />
        {seriesKeys.map((key) => (
          <Bar key={key} dataKey={key} stackId="a" fill={colors[key]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

interface GroupedBarChartProps {
  data: MultiSeriesTrend;
  colors: { [key: string]: string };
  labels: { [key: string]: string };
  formatValue?: (v: number) => string;
}

export function GroupedBarChart({ data, colors, labels, formatValue }: GroupedBarChartProps) {
  if (!data?.months?.length || !data?.series) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">Sin datos</div>;
  }
  const seriesKeys = Object.keys(data.series);
  const chartData = data.months.map((m, i) => {
    const point: any = { month: m.slice(5) };
    seriesKeys.forEach(k => {
      point[k] = data.series[k]?.[i] || 0;
    });
    return point;
  });
  
  const format = formatValue || ((v: number) => `$${(v/1000).toFixed(0)}k`);
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#9ca3af" />
        <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" tickFormatter={format} width={45} />
        <RechartsTooltip 
          formatter={(v: number, name: string) => [format(v), labels[name] || name]}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Legend 
          formatter={(value: string) => labels[value] || value}
          wrapperStyle={{ fontSize: 10 }}
        />
        {seriesKeys.map((key) => (
          <Bar key={key} dataKey={key} fill={colors[key]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

interface CashFlowBarChartProps {
  data: TrendData;
}

export function CashFlowBarChart({ data }: CashFlowBarChartProps) {
  if (!data?.months?.length || !data?.values?.length) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">Sin datos</div>;
  }
  const chartData = data.months.map((m, i) => ({
    month: m.slice(5),
    value: data.values[i] || 0,
    fill: (data.values[i] || 0) >= 0 ? '#10b981' : '#ef4444'
  }));
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#9ca3af" />
        <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} width={45} />
        <RechartsTooltip 
          formatter={(v: number) => [`$${(v/1000).toFixed(1)}k`, 'Cash Flow']}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

interface BreakdownItem {
  label: string;
  value: number;
  pct: number;
}

interface PieChartSimpleProps {
  data: BreakdownItem[];
  colors: string[];
  formatValue?: (v: number) => string;
}

export function PieChartSimple({ data, colors, formatValue }: PieChartSimpleProps) {
  if (!data?.length) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">Sin datos</div>;
  }
  const format = formatValue || ((v: number) => `$${(v/1000).toFixed(0)}k`);
  const validData = data.filter(d => d.value > 0);
  if (!validData.length) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">Sin datos positivos</div>;
  }
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={validData}
          cx="50%"
          cy="50%"
          innerRadius={40}
          outerRadius={65}
          paddingAngle={2}
          dataKey="value"
          nameKey="label"
          label={({ name, pct }) => `${name}: ${pct?.toFixed(0) || 0}%`}
          labelLine={false}
        >
          {validData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <RechartsTooltip 
          formatter={(v: number, name: string) => [format(Math.abs(v)), name]}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Legend 
          formatter={(value: string, entry: any) => {
            const pct = entry?.payload?.pct;
            return `${value || 'N/A'} (${pct?.toFixed(0) || 0}%)`;
          }}
          wrapperStyle={{ fontSize: 10 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

interface HorizontalBarChartProps {
  data: BreakdownItem[];
  color: string;
  formatValue?: (v: number) => string;
  maxItems?: number;
}

export function HorizontalBarChart({ data, color, formatValue, maxItems = 6 }: HorizontalBarChartProps) {
  if (!data?.length) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">Sin datos</div>;
  }
  const format = formatValue || ((v: number) => `${v.toFixed(0)}h`);
  const displayData = data.slice(0, maxItems);
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart 
        data={displayData} 
        layout="vertical" 
        margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis type="number" tick={{ fontSize: 10 }} stroke="#9ca3af" tickFormatter={format} />
        <YAxis 
          type="category" 
          dataKey="label" 
          tick={{ fontSize: 10 }} 
          stroke="#9ca3af"
          width={55}
          tickFormatter={(v: string) => v.length > 8 ? v.slice(0, 8) + '...' : v}
        />
        <RechartsTooltip 
          formatter={(v: number, name: string) => [format(v), 'Horas']}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default ChartCard;
