import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, Calculator, AlertTriangle, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';

interface MonthlyInflation {
  id: number;
  year: number;
  month: number;
  inflationRate: number;
  source?: string;
}

interface SystemConfig {
  id: number;
  configKey: string;
  configValue: number;
  description?: string;
}

interface InflationAdjustmentCardProps {
  applyInflationAdjustment: boolean;
  inflationMethod: string;
  manualInflationRate: number;
  projectStartDate: string;
  totalCost: number;
  quotationCurrency: string;
  onApplyInflationChange: (value: boolean) => void;
  onInflationMethodChange: (value: string) => void;
  onManualInflationRateChange: (value: number) => void;
  onProjectStartDateChange: (value: string) => void;
  onQuotationCurrencyChange: (value: string) => void;
}

export function InflationAdjustmentCard({
  applyInflationAdjustment,
  inflationMethod,
  manualInflationRate,
  projectStartDate,
  totalCost,
  quotationCurrency,
  onApplyInflationChange,
  onInflationMethodChange,
  onManualInflationRateChange,
  onProjectStartDateChange,
  onQuotationCurrencyChange
}: InflationAdjustmentCardProps) {
  const [projectedCost, setProjectedCost] = useState(totalCost);

  // Obtener datos de inflación histórica
  const { data: inflationData = [] } = useQuery<MonthlyInflation[]>({
    queryKey: ['/api/admin/monthly-inflation'],
    select: (data: MonthlyInflation[]) => data.sort((a, b) => 
      b.year - a.year || b.month - a.month
    )
  });

  // Obtener configuración del sistema
  const { data: systemConfig = [] } = useQuery<SystemConfig[]>({
    queryKey: ['/api/admin/system-config']
  });

  const exchangeRate = systemConfig.find((c: SystemConfig) => c.configKey === 'usd_exchange_rate')?.configValue || 1200;

  // Calcular promedio de inflación de los últimos 12 meses
  const calculateAverageInflation = () => {
    const recentData = inflationData.slice(0, 12);
    if (recentData.length === 0) return 0;
    
    const average = recentData.reduce((sum, item) => sum + item.inflationRate, 0) / recentData.length;
    return average * 100; // Convertir a porcentaje
  };

  const averageInflation = calculateAverageInflation();

  // Calcular proyección de costo con inflación
  const calculateInflationProjection = () => {
    if (!applyInflationAdjustment || !projectStartDate) return totalCost;

    const startDate = new Date(projectStartDate);
    const currentDate = new Date();
    const monthsDifference = (startDate.getFullYear() - currentDate.getFullYear()) * 12 + 
                           (startDate.getMonth() - currentDate.getMonth());

    if (monthsDifference <= 0) return totalCost;

    const inflationRate = inflationMethod === 'manual' ? manualInflationRate : averageInflation;
    const monthlyInflation = inflationRate / 100 / 12;
    const inflationFactor = Math.pow(1 + monthlyInflation, monthsDifference);
    
    return totalCost * inflationFactor;
  };

  React.useEffect(() => {
    setProjectedCost(calculateInflationProjection());
  }, [totalCost, applyInflationAdjustment, inflationMethod, manualInflationRate, projectStartDate, averageInflation]);

  const inflationAdjustment = projectedCost - totalCost;
  const inflationPercentage = totalCost > 0 ? (inflationAdjustment / totalCost) * 100 : 0;

  return (
    <Card className="border-orange-200 bg-orange-50/30">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center text-lg text-orange-800">
          <TrendingUp className="mr-2 h-5 w-5" />
          Ajuste por Inflación Proyectada
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Toggle principal */}
        <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
          <div className="space-y-1">
            <Label className="font-medium">Aplicar ajuste por inflación</Label>
            <p className="text-sm text-gray-600">
              Ajusta el costo total según la inflación proyectada hasta la fecha de inicio
            </p>
          </div>
          <Switch
            checked={applyInflationAdjustment}
            onCheckedChange={onApplyInflationChange}
          />
        </div>

        {applyInflationAdjustment && (
          <>
            {/* Configuración de inflación */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Método de inflación */}
              <div className="space-y-2">
                <Label className="font-medium">Método de cálculo</Label>
                <Select value={inflationMethod} onValueChange={onInflationMethodChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="automatic">
                      Automático (Promedio 12 meses)
                    </SelectItem>
                    <SelectItem value="manual">
                      Manual (Tasa personalizada)
                    </SelectItem>
                  </SelectContent>
                </Select>
                {inflationMethod === 'automatic' && (
                  <div className="text-xs text-gray-500">
                    Promedio actual: {averageInflation.toFixed(1)}% anual
                  </div>
                )}
              </div>

              {/* Fecha de inicio del proyecto */}
              <div className="space-y-2">
                <Label className="font-medium">Fecha de inicio del proyecto</Label>
                <Input
                  type="date"
                  value={projectStartDate}
                  onChange={(e) => onProjectStartDateChange(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            {/* Tasa manual */}
            {inflationMethod === 'manual' && (
              <div className="space-y-2">
                <Label htmlFor="manual-rate" className="font-medium">
                  Tasa de inflación proyectada (% anual)
                </Label>
                <Input
                  id="manual-rate"
                  type="number"
                  step="0.1"
                  value={manualInflationRate || 0}
                  onChange={(e) => onManualInflationRateChange(Number(e.target.value))}
                  placeholder="Ej: 25.5"
                />
              </div>
            )}

            {/* Moneda de cotización */}
            <div className="space-y-2">
              <Label className="font-medium">Moneda de cotización</Label>
              <Select value={quotationCurrency} onValueChange={onQuotationCurrencyChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">Pesos Argentinos (ARS)</SelectItem>
                  <SelectItem value="USD">Dólares Estadounidenses (USD)</SelectItem>
                </SelectContent>
              </Select>
              {quotationCurrency === 'USD' && (
                <div className="text-xs text-gray-500">
                  Tipo de cambio: 1 USD = ${exchangeRate.toLocaleString()} ARS
                </div>
              )}
            </div>

            {/* Resumen de proyección */}
            {projectStartDate && (
              <div className="bg-white p-4 rounded-lg border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">Costo base</span>
                  <span className="font-mono">
                    {quotationCurrency === 'USD' 
                      ? `$${(totalCost / exchangeRate).toFixed(2)} USD`
                      : formatCurrency(totalCost)
                    }
                  </span>
                </div>
                
                {inflationAdjustment > 0 && (
                  <>
                    <div className="flex items-center justify-between text-orange-600">
                      <span className="font-medium">Ajuste por inflación</span>
                      <span className="font-mono">
                        +{quotationCurrency === 'USD' 
                          ? `$${(inflationAdjustment / exchangeRate).toFixed(2)} USD`
                          : formatCurrency(inflationAdjustment)
                        } (+{inflationPercentage.toFixed(1)}%)
                      </span>
                    </div>
                    
                    <div className="border-t pt-3">
                      <div className="flex items-center justify-between font-semibold text-lg">
                        <span>Costo proyectado</span>
                        <span className="text-primary font-mono">
                          {quotationCurrency === 'USD' 
                            ? `$${(projectedCost / exchangeRate).toFixed(2)} USD`
                            : formatCurrency(projectedCost)
                          }
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Warning sobre volatilidad */}
            <div className="flex items-start space-x-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Aviso importante:</p>
                <p>
                  Las proyecciones de inflación son estimativas basadas en datos históricos 
                  y pueden diferir de la realidad económica futura.
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}