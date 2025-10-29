import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, Clock, Calendar, BarChart3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface LifetimeMetricsProps {
  projectId: number;
  currentPeriod: string;
}

interface LifetimeData {
  projectId: number;
  projectName: string;
  isOneShot: boolean;
  currencyNative: string;
  dateRange: {
    firstPeriod: string;
    lastPeriod: string;
    totalPeriods: number;
  };
  periodWithRevenue: string | null;
  lifetime: {
    revenueUSD: number;
    costUSD: number;
    profitUSD: number;
    revenueDisplay: number;
    costDisplay: number;
    profitDisplay: number;
    currencyNative: string;
    quoteNative: number;
    markup: number;
    margin: number;
    budgetUtilization: number;
    totalAsanaHours: number;
    totalBillingHours: number;
    totalTargetHours: number;
  };
  monthly: Array<{
    periodKey: string;
    revenueDisplay: number;
    costDisplay: number;
    asanaHours: number;
    billingHours: number;
    teamSize: number;
    hasRevenue: boolean;
    hasCost: boolean;
  }>;
  hasData: boolean;
}

export function ProjectLifetimeMetrics({ projectId, currentPeriod }: LifetimeMetricsProps) {
  const { data, isLoading, error } = useQuery<LifetimeData>({
    queryKey: ['/api/projects', projectId, 'lifetime-metrics'],
    enabled: !!projectId
  });

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950 border-indigo-200 dark:border-indigo-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-indigo-900 dark:text-indigo-100">
            <BarChart3 className="h-5 w-5" />
            Métricas del Proyecto Completo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-indigo-200 dark:bg-indigo-800 rounded w-3/4"></div>
            <div className="h-4 bg-indigo-200 dark:bg-indigo-800 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data?.hasData) {
    return null;
  }

  const { lifetime, dateRange, currencyNative, monthly } = data;
  const currencySymbol = currencyNative === 'USD' ? '$' : '$';
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatPeriod = (periodKey: string) => {
    const [year, month] = periodKey.split('-');
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  const getResultColor = () => {
    if (lifetime.profitDisplay > 0) return "text-green-600 dark:text-green-400";
    if (lifetime.profitDisplay < 0) return "text-red-600 dark:text-red-400";
    return "text-gray-600 dark:text-gray-400";
  };

  const getBudgetUtilColor = () => {
    const util = lifetime.budgetUtilization * 100;
    if (util <= 70) return "text-green-600 dark:text-green-400";
    if (util <= 90) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950 border-indigo-200 dark:border-indigo-800">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-indigo-900 dark:text-indigo-100">
              <BarChart3 className="h-5 w-5" />
              Métricas del Proyecto Completo
            </CardTitle>
            <CardDescription className="text-indigo-700 dark:text-indigo-300 mt-1">
              Resultados acumulados de {formatPeriod(dateRange.firstPeriod)} a {formatPeriod(dateRange.lastPeriod)}
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 border-indigo-300">
            {dateRange.totalPeriods} {dateRange.totalPeriods === 1 ? 'mes' : 'meses'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Financial Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-indigo-100 dark:border-indigo-800">
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-1">
              <DollarSign className="h-3 w-3" />
              <span>Ingreso Total</span>
            </div>
            <div className="text-lg font-bold text-indigo-900 dark:text-indigo-100">
              {currencySymbol} {formatCurrency(lifetime.revenueDisplay)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {currencyNative}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-indigo-100 dark:border-indigo-800">
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-1">
              <DollarSign className="h-3 w-3" />
              <span>Costo Total</span>
            </div>
            <div className="text-lg font-bold text-indigo-900 dark:text-indigo-100">
              {currencySymbol} {formatCurrency(lifetime.costDisplay)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Utilización: {getBudgetUtilColor() && (
                <span className={getBudgetUtilColor()}>
                  {(lifetime.budgetUtilization * 100).toFixed(1)}%
                </span>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-indigo-100 dark:border-indigo-800">
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-1">
              <TrendingUp className="h-3 w-3" />
              <span>Resultado</span>
            </div>
            <div className={`text-lg font-bold ${getResultColor()}`}>
              {currencySymbol} {formatCurrency(lifetime.profitDisplay)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Margen: {(lifetime.margin * 100).toFixed(1)}%
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-indigo-100 dark:border-indigo-800">
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-1">
              <Clock className="h-3 w-3" />
              <span>Horas Totales</span>
            </div>
            <div className="text-lg font-bold text-indigo-900 dark:text-indigo-100">
              {lifetime.totalBillingHours.toFixed(0)}h
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Asana: {lifetime.totalAsanaHours.toFixed(0)}h
            </div>
          </div>
        </div>

        {/* Monthly Timeline */}
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100 mb-2 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Evolución mensual
          </h4>
          <div className="space-y-1">
            {monthly.map((month) => {
              const isCurrentPeriod = month.periodKey === currentPeriod;
              return (
                <div
                  key={month.periodKey}
                  className={`flex items-center justify-between p-2 rounded text-sm ${
                    isCurrentPeriod
                      ? 'bg-indigo-100 dark:bg-indigo-900 border border-indigo-300 dark:border-indigo-700'
                      : 'bg-white dark:bg-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-indigo-900 dark:text-indigo-100">
                      {formatPeriod(month.periodKey)}
                    </span>
                    {month.hasRevenue && (
                      <Badge variant="secondary" className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                        Facturación
                      </Badge>
                    )}
                    {isCurrentPeriod && (
                      <Badge variant="outline" className="text-xs">
                        Actual
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    {month.hasRevenue && (
                      <span className="text-green-600 dark:text-green-400 font-semibold">
                        +{currencySymbol}{formatCurrency(month.revenueDisplay)}
                      </span>
                    )}
                    {month.hasCost && (
                      <span className="text-gray-600 dark:text-gray-400">
                        {currencySymbol}{formatCurrency(month.costDisplay)}
                      </span>
                    )}
                    <span className="text-gray-500 dark:text-gray-400">
                      {month.billingHours.toFixed(0)}h
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
