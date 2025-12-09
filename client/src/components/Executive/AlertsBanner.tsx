import { AlertTriangle, AlertCircle, Info, CheckCircle, X } from "lucide-react";
import { useState } from "react";

interface Alert {
  type: 'critical' | 'warning' | 'info';
  message: string;
  metric: string;
}

interface AlertsBannerProps {
  alerts: Alert[];
  viewName?: string;
}

export default function AlertsBanner({ alerts, viewName }: AlertsBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  
  const visibleAlerts = alerts.filter(a => !dismissed.has(a.metric));
  
  const criticalAlerts = visibleAlerts.filter(a => a.type === 'critical');
  const warningAlerts = visibleAlerts.filter(a => a.type === 'warning');
  const infoAlerts = visibleAlerts.filter(a => a.type === 'info');
  
  const handleDismiss = (metric: string) => {
    setDismissed(prev => new Set(prev).add(metric));
  };
  
  if (visibleAlerts.length === 0) {
    return (
      <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2" data-testid="alerts-banner-clear">
        <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
        <span className="text-sm text-emerald-800">
          Sin alertas críticas. Los indicadores {viewName ? `de ${viewName}` : ''} están dentro de rangos normales.
        </span>
      </div>
    );
  }
  
  const getAlertStyles = (type: Alert['type']) => {
    switch (type) {
      case 'critical':
        return {
          bg: 'bg-red-50 border-red-200',
          text: 'text-red-800',
          icon: <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
        };
      case 'warning':
        return {
          bg: 'bg-amber-50 border-amber-200',
          text: 'text-amber-800',
          icon: <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
        };
      case 'info':
        return {
          bg: 'bg-blue-50 border-blue-200',
          text: 'text-blue-800',
          icon: <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />
        };
    }
  };
  
  const renderAlertGroup = (alerts: Alert[], type: Alert['type']) => {
    if (alerts.length === 0) return null;
    const styles = getAlertStyles(type);
    
    return (
      <div className={`p-3 rounded-lg border ${styles.bg}`} data-testid={`alerts-${type}`}>
        <div className="space-y-1.5">
          {alerts.map((alert, idx) => (
            <div key={`${alert.metric}-${idx}`} className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                {idx === 0 && styles.icon}
                {idx !== 0 && <span className="w-4" />}
                <span className={`text-sm ${styles.text}`}>{alert.message}</span>
              </div>
              <button
                onClick={() => handleDismiss(alert.metric)}
                className="p-0.5 rounded hover:bg-black/5 transition-colors flex-shrink-0"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5 text-gray-400" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  return (
    <div className="mb-4 space-y-2" data-testid="alerts-banner">
      {renderAlertGroup(criticalAlerts, 'critical')}
      {renderAlertGroup(warningAlerts, 'warning')}
      {renderAlertGroup(infoAlerts, 'info')}
    </div>
  );
}
