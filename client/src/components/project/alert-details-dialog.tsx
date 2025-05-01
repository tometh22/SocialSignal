import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, DollarSign, Timer, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface AlertDetail {
  type: 'budget' | 'schedule' | 'variance';
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  value: string | number;
}

interface AlertDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: AlertDetail[];
}

export const AlertDetailsDialog = ({
  isOpen,
  onClose,
  alerts
}: AlertDetailsDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <AlertTriangle className="h-5 w-5 text-red-500" /> 
            Alertas Activas del Proyecto
          </DialogTitle>
          <DialogDescription>
            Información detallada sobre las alertas detectadas en el proyecto
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {alerts.map((alert, index) => (
            <div 
              key={index}
              className={`p-4 rounded-lg border ${
                alert.severity === 'high' 
                  ? 'bg-red-50 border-red-200' 
                  : alert.severity === 'medium'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-blue-50 border-blue-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-full ${
                  alert.type === 'budget' 
                    ? 'bg-green-100' 
                    : alert.type === 'schedule'
                      ? 'bg-amber-100'
                      : 'bg-blue-100'
                }`}>
                  {alert.type === 'budget' && <DollarSign className="h-5 w-5 text-green-600" />}
                  {alert.type === 'schedule' && <Timer className="h-5 w-5 text-amber-600" />}
                  {alert.type === 'variance' && <AlertCircle className="h-5 w-5 text-blue-600" />}
                </div>
                <div className="flex-1">
                  <h4 className={`font-medium ${
                    alert.severity === 'high' 
                      ? 'text-red-700' 
                      : alert.severity === 'medium'
                        ? 'text-amber-700'
                        : 'text-blue-700'
                  }`}>{alert.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
                  
                  <div className="mt-2 text-sm font-medium">
                    {typeof alert.value === 'number' && alert.type === 'budget' 
                      ? formatCurrency(alert.value)
                      : alert.value}
                  </div>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${
                  alert.severity === 'high' 
                    ? 'bg-red-100 text-red-800' 
                    : alert.severity === 'medium'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-800'
                }`}>
                  {alert.severity === 'high' ? 'Alto' : alert.severity === 'medium' ? 'Medio' : 'Bajo'}
                </div>
              </div>
            </div>
          ))}
          
          {alerts.length === 0 && (
            <div className="p-4 text-center text-muted-foreground">
              No hay alertas activas en este momento
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AlertDetailsDialog;