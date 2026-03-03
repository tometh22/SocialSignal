import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  FolderOpen, 
  Flame,
  Building2,
  PiggyBank,
  Receipt,
  ArrowDownUp,
  Wallet
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface FinancieroData {
  periodKey: string;
  label: string;
  facturadoUsd: number;
  directosUsd: number;
  overheadUsd: number;
  provisionesUsd: number;
  totalContableUsd: number;
  ebitContableUsd: number;
  margenContablePct: number;
  burnRateUsd: number;
  beneficioNetoUsd: number;
  personasActivas: number;
  proyectosActivos: number;
  formula: {
    totalContable: string;
    ebit: string;
    margen: string;
    burnRate: string;
    beneficioNeto: string;
  };
  source: {
    facturado: string;
    directos: string;
    overhead: string;
    provisiones: string;
  };
}

interface CashflowData {
  periodKey: string;
  label: string;
  cashInUsd: number;
  cashOutUsd: number;
  cashFlowNetoUsd: number;
  cajaTotalUsd: number;
  movementCount: number;
  formula: {
    neto: string;
  };
  source: {
    movements: string;
    cajaTotal: string;
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
  isNegative?: boolean;
}

function MetricCard({ title, value, subtitle, icon, formula, source, notes, isBigCard, isNegative }: MetricCardProps) {
  const cardClass = isBigCard 
    ? "bg-gradient-to-br from-[#F4E8FF] to-[#FFEEEE] border-0 row-span-2" 
    : "bg-white border";
  
  const valueClass = isBigCard ? "text-3xl font-semibold" : "text-2xl font-bold";
  const iconSize = isBigCard ? "w-6 h-6" : "w-5 h-5";
  const valueColor = isNegative ? "text-red-600" : "";
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className={`${cardClass} cursor-help transition-shadow hover:shadow-md`} data-testid={`card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
              <div className={`${iconSize} text-purple-600`}>{icon}</div>
            </CardHeader>
            <CardContent>
              <div className={`${valueClass} ${valueColor}`}>{value}</div>
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

interface ExecutiveFinancieroProps {
  period?: string;
}

export default function ExecutiveFinanciero({ period }: ExecutiveFinancieroProps) {
  const { data, isLoading, error } = useQuery<FinancieroData>({
    queryKey: ['/api/v1/executive/financiero', period],
    queryFn: async () => {
      const url = period 
        ? `/api/v1/executive/financiero?period=${period}` 
        : '/api/v1/executive/financiero';
      const res = await authFetch(url);
      if (!res.ok) throw new Error('Failed to fetch financiero data');
      return res.json();
    }
  });
  
  const { data: cashflow } = useQuery<CashflowData>({
    queryKey: ['/api/v1/executive/cashflow', period],
    queryFn: async () => {
      const url = period 
        ? `/api/v1/executive/cashflow?period=${period}` 
        : '/api/v1/executive/cashflow';
      const res = await authFetch(url);
      if (!res.ok) throw new Error('Failed to fetch cashflow data');
      return res.json();
    }
  });
  
  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-lg">
        Error al cargar datos financieros: {String(error)}
      </div>
    );
  }
  
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Vista Financiera</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(10)].map((_, i) => (
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
        <h2 className="text-xl font-bold text-gray-900">Vista Financiera</h2>
        <span className="text-sm text-gray-500">{data.label}</span>
      </div>
      
      <p className="text-sm text-gray-600">
        Foto contable con costos reales totales (para socios e impuestos).
      </p>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Facturado"
          value={formatCurrency(data.facturadoUsd)}
          subtitle="Ingresos facturados"
          icon={<DollarSign />}
          formula="SUM(facturacion_total)"
          source={data.source.facturado}
          isBigCard
        />
        
        <MetricCard
          title="EBIT Contable"
          value={formatCurrency(data.ebitContableUsd)}
          subtitle={formatPercent(data.margenContablePct)}
          icon={<TrendingUp />}
          formula={data.formula.ebit}
          source="Calculado"
          notes="Incluye provisiones"
          isBigCard
          isNegative={data.ebitContableUsd < 0}
        />
        
        <MetricCard
          title="Directos"
          value={formatCurrency(data.directosUsd)}
          icon={<Users />}
          formula="SUM(direct_usd)"
          source={data.source.directos}
        />
        
        <MetricCard
          title="Overhead"
          value={formatCurrency(data.overheadUsd)}
          icon={<Building2 />}
          formula="SUM(indirect_usd)"
          source={data.source.overhead}
        />
        
        <MetricCard
          title="Provisiones"
          value={formatCurrency(data.provisionesUsd)}
          icon={<PiggyBank />}
          formula="SUM(provisions_usd)"
          source={data.source.provisiones}
        />
        
        <MetricCard
          title="Burn Rate"
          value={formatCurrency(data.burnRateUsd)}
          icon={<Flame />}
          formula={data.formula.burnRate}
          source="Calculado"
          notes="Gasto total mensual"
        />
        
        {cashflow && (
          <>
            <MetricCard
              title="Cash In / Out"
              value={`${formatCurrency(cashflow.cashInUsd)} / ${formatCurrency(cashflow.cashOutUsd)}`}
              icon={<ArrowDownUp />}
              formula="SUM(IN) / SUM(OUT)"
              source={cashflow.source.movements}
            />
            
            <MetricCard
              title="Cash Flow Neto"
              value={formatCurrency(cashflow.cashFlowNetoUsd)}
              icon={<Receipt />}
              formula={cashflow.formula.neto}
              source={cashflow.source.movements}
              isNegative={cashflow.cashFlowNetoUsd < 0}
            />
            
            <MetricCard
              title="Caja Total"
              value={formatCurrency(cashflow.cajaTotalUsd)}
              icon={<Wallet />}
              formula="Snapshot Excel Maestro"
              source={cashflow.source.cajaTotal}
              notes="Siempre del Excel, nunca calculado"
            />
          </>
        )}
        
        <MetricCard
          title="Personas Activas"
          value={data.personasActivas}
          icon={<Users />}
          formula="COUNT(DISTINCT person_id)"
          source="fact_labor_month"
        />
        
        <MetricCard
          title="Proyectos"
          value={data.proyectosActivos}
          icon={<FolderOpen />}
          formula="COUNT(*)"
          source="active_projects"
        />
      </div>
      
      <Card className="bg-gradient-to-r from-[#F4E8FF]/30 to-[#FFEEEE]/30 border-0">
        <CardHeader>
          <CardTitle className="text-sm">Composición de Costos Contables</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-3 bg-purple-500 rounded" style={{ width: `${(data.directosUsd / data.totalContableUsd) * 100}%` }} />
              <span className="text-xs">Directos: {formatCurrency(data.directosUsd)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 bg-pink-400 rounded" style={{ width: `${(data.overheadUsd / data.totalContableUsd) * 100}%` }} />
              <span className="text-xs">Overhead: {formatCurrency(data.overheadUsd)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 bg-red-300 rounded" style={{ width: `${(data.provisionesUsd / data.totalContableUsd) * 100}%` }} />
              <span className="text-xs">Provisiones: {formatCurrency(data.provisionesUsd)}</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Total Contable: {formatCurrency(data.totalContableUsd)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
