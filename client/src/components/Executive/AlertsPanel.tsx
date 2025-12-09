import { AlertTriangle, TrendingDown, DollarSign, Flame, Info, CheckCircle } from "lucide-react";

interface Alert {
  id: string;
  type: 'warning' | 'danger' | 'info' | 'success';
  code: string;
  title: string;
  description: string;
  metric?: string;
}

interface AlertsPanelProps {
  period: string;
  data: {
    devengadoUsd: number;
    facturadoUsd: number;
    directosUsd: number;
    overheadUsd: number;
    ebitOperativoUsd: number;
    ebitContableUsd: number;
    cashFlowNetUsd: number;
    devengadoVariation?: number | null;
    facturadoVariation?: number | null;
  };
}

export function AlertsPanel({ period, data }: AlertsPanelProps) {
  const alerts: Alert[] = [];
  
  if (data.facturadoUsd === 0 && data.directosUsd > 0) {
    alerts.push({
      id: 'no_billing',
      type: 'danger',
      code: 'NO_BILLING_WITH_COSTS',
      title: 'Sin facturación con costos activos',
      description: `Se registran $${data.directosUsd.toLocaleString()} en costos directos pero $0 facturados`,
      metric: `$${data.directosUsd.toLocaleString()} USD`
    });
  }

  if (data.facturadoVariation !== null && data.facturadoVariation !== undefined && data.facturadoVariation < -30) {
    alerts.push({
      id: 'billable_drop',
      type: 'warning',
      code: 'BILLABLE_DROP',
      title: 'Caída significativa en facturación',
      description: `La facturación bajó ${Math.abs(data.facturadoVariation).toFixed(0)}% vs mes anterior`,
      metric: `${data.facturadoVariation.toFixed(0)}%`
    });
  }

  const burnRate = data.directosUsd + data.overheadUsd;
  const revenue = data.devengadoUsd || data.facturadoUsd;
  if (revenue > 0 && burnRate > revenue * 0.9) {
    alerts.push({
      id: 'over_burn',
      type: 'warning',
      code: 'OVER_BURN',
      title: 'Burn rate elevado',
      description: `Los costos representan ${((burnRate / revenue) * 100).toFixed(0)}% del ingreso`,
      metric: `${((burnRate / revenue) * 100).toFixed(0)}%`
    });
  }

  if (data.cashFlowNetUsd < 0 && Math.abs(data.cashFlowNetUsd) > 50000) {
    alerts.push({
      id: 'negative_cashflow',
      type: 'danger',
      code: 'NEGATIVE_CASHFLOW',
      title: 'Flujo de caja negativo significativo',
      description: `El flujo neto es -$${Math.abs(data.cashFlowNetUsd).toLocaleString()} USD`,
      metric: `-$${Math.abs(data.cashFlowNetUsd).toLocaleString()}`
    });
  }

  if (data.ebitOperativoUsd > 0 && data.ebitContableUsd < 0) {
    alerts.push({
      id: 'accounting_gap',
      type: 'info',
      code: 'OPERATING_VS_ACCOUNTING_GAP',
      title: 'Brecha operativo vs contable',
      description: 'EBIT operativo positivo pero EBIT contable negativo - revisar provisiones/overhead',
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: 'all_clear',
      type: 'success',
      code: 'ALL_CLEAR',
      title: 'Sin alertas críticas',
      description: 'Los indicadores del período están dentro de rangos normales',
    });
  }

  const getIcon = (type: Alert['type']) => {
    switch (type) {
      case 'danger': return <AlertTriangle className="h-4 w-4" />;
      case 'warning': return <Flame className="h-4 w-4" />;
      case 'info': return <Info className="h-4 w-4" />;
      case 'success': return <CheckCircle className="h-4 w-4" />;
    }
  };

  const getStyles = (type: Alert['type']) => {
    switch (type) {
      case 'danger': return 'bg-red-50 border-red-200 text-red-800';
      case 'warning': return 'bg-amber-50 border-amber-200 text-amber-800';
      case 'info': return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'success': return 'bg-emerald-50 border-emerald-200 text-emerald-800';
    }
  };

  const getIconStyles = (type: Alert['type']) => {
    switch (type) {
      case 'danger': return 'text-red-500';
      case 'warning': return 'text-amber-500';
      case 'info': return 'text-blue-500';
      case 'success': return 'text-emerald-500';
    }
  };

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-600">Alertas Inteligentes</span>
        <span className="text-xs text-gray-400">• {period}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {alerts.map(alert => (
          <div 
            key={alert.id}
            className={`rounded-lg border px-4 py-3 ${getStyles(alert.type)}`}
            data-testid={`alert-${alert.code.toLowerCase()}`}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 ${getIconStyles(alert.type)}`}>
                {getIcon(alert.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{alert.title}</span>
                  {alert.metric && (
                    <span className="text-xs font-mono bg-white/50 px-1.5 py-0.5 rounded">
                      {alert.metric}
                    </span>
                  )}
                </div>
                <p className="text-xs mt-0.5 opacity-80">{alert.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
