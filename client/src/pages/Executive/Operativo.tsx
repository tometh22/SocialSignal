import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  FolderOpen, 
  Clock, 
  Target,
  Zap,
  BarChart3
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface OperativoData {
  periodKey: string;
  label: string;
  devengadoUsd: number;
  directosUsd: number;
  overheadOperativoUsd: 0;
  ebitOperativoUsd: number;
  margenOperativoPct: number;
  markupOperativo: number;
  tarifaEfectivaUsd: number;
  horasFacturablesPct: number;
  horasTrabajadas: number;
  personasActivas: number;
  proyectosActivos: number;
  formula: {
    ebit: string;
    margen: string;
    markup: string;
    tarifa: string;
  };
  source: {
    devengado: string;
    directos: string;
    horas: string;
  };
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  formula: string;
  source: string;
  notes?: string;
  isBigCard?: boolean;
}

function MetricCard({ title, value, subtitle, icon, formula, source, notes, isBigCard }: MetricCardProps) {
  const cardClass = isBigCard 
    ? "bg-gradient-to-br from-[#C9F0E8] to-[#E9FFF4] border-0 row-span-2" 
    : "bg-white border";
  
  const valueClass = isBigCard ? "text-3xl font-semibold" : "text-2xl font-bold";
  const iconSize = isBigCard ? "w-6 h-6" : "w-5 h-5";
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className={`${cardClass} cursor-help transition-shadow hover:shadow-md`} data-testid={`card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
              <div className={`${iconSize} text-emerald-600`}>{icon}</div>
            </CardHeader>
            <CardContent>
              <div className={valueClass}>{value}</div>
              {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">Fórmula: {formula}</p>
            <p className="text-xs text-gray-400">Fuente: {source}</p>
            {notes && <p className="text-xs text-amber-600">{notes}</p>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface ExecutiveOperativoProps {
  period?: string;
}

export default function ExecutiveOperativo({ period }: ExecutiveOperativoProps) {
  const { data, isLoading, error } = useQuery<OperativoData>({
    queryKey: ['/api/v1/executive/operativo', period],
    queryFn: async () => {
      const url = period 
        ? `/api/v1/executive/operativo?period=${period}` 
        : '/api/v1/executive/operativo';
      const res = await authFetch(url);
      if (!res.ok) throw new Error('Failed to fetch operativo data');
      return res.json();
    }
  });
  
  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-lg">
        Error al cargar datos operativos: {String(error)}
      </div>
    );
  }
  
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;
  
  const formatMultiplier = (value: number) => `${value.toFixed(2)}×`;
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Vista Operativa</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(9)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }
  
  if (!data) return null;
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Vista Operativa</h2>
        <span className="text-sm text-gray-500">{data.label}</span>
      </div>
      
      <p className="text-sm text-gray-600">
        Productividad real del trabajo, sin contabilidad ni impuestos.
      </p>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Devengado"
          value={formatCurrency(data.devengadoUsd)}
          subtitle="Ingreso ganado en el mes"
          icon={<DollarSign />}
          formula="Facturado - Provisión Facturación Adelantada"
          source={data.source.devengado}
          isBigCard
        />
        
        <MetricCard
          title="EBIT Operativo"
          value={formatCurrency(data.ebitOperativoUsd)}
          subtitle={formatPercent(data.margenOperativoPct)}
          icon={<TrendingUp />}
          formula={data.formula.ebit}
          source="Calculado"
          notes="Sin overhead ni provisiones"
          isBigCard
        />
        
        <MetricCard
          title="Tarifa Efectiva"
          value={`${formatCurrency(data.tarifaEfectivaUsd)}/h`}
          icon={<Zap />}
          formula={data.formula.tarifa}
          source={data.source.horas}
        />
        
        <MetricCard
          title="Markup"
          value={formatMultiplier(data.markupOperativo)}
          icon={<BarChart3 />}
          formula={data.formula.markup}
          source="Calculado"
          notes="Indicador de pricing real"
        />
        
        <MetricCard
          title="% Horas Facturables"
          value={formatPercent(data.horasFacturablesPct)}
          icon={<Target />}
          formula="Horas facturables / Horas totales"
          source={data.source.horas}
        />
        
        <MetricCard
          title="Horas Trabajadas"
          value={data.horasTrabajadas.toFixed(0)}
          icon={<Clock />}
          formula="SUM(asana_hours)"
          source={data.source.horas}
        />
        
        <MetricCard
          title="Personas Activas"
          value={data.personasActivas}
          icon={<Users />}
          formula="COUNT(DISTINCT person_id)"
          source={data.source.horas}
        />
        
        <MetricCard
          title="Proyectos Activos"
          value={data.proyectosActivos}
          icon={<FolderOpen />}
          formula="COUNT(*) WHERE status='active'"
          source="active_projects"
        />
      </div>
      
      <Card className="bg-gradient-to-r from-[#C9F0E8]/30 to-[#E9FFF4]/30 border-0">
        <CardHeader>
          <CardTitle className="text-sm">Composición de Costos Operativos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="h-4 bg-emerald-500 rounded" style={{ width: '100%' }} />
            </div>
            <span className="text-sm font-medium">Directos: {formatCurrency(data.directosUsd)}</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Vista operativa muestra solo costos directos del equipo (sin overhead ni provisiones)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
