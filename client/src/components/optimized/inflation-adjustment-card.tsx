import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, Calendar, Percent, DollarSign } from "lucide-react";
import { formatARS, formatUSD, getMinimumProjectDate, getDefaultProjectDate } from "@/lib/inflation-calculator";

interface InflationAdjustmentCardProps {
  applyInflationAdjustment: boolean;
  inflationMethod: string;
  manualInflationRate: number;
  projectStartDate: string;
  totalCost: number;
  quotationCurrency: string;
  onApplyInflationChange: (apply: boolean) => void;
  onInflationMethodChange: (method: string) => void;
  onManualInflationRateChange: (rate: number) => void;
  onProjectStartDateChange: (date: string) => void;
  onQuotationCurrencyChange: (currency: string) => void;
}

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

  // Calcular proyección de costo
  useEffect(() => {
    if (!applyInflationAdjustment || !projectStartDate) {
      setProjectedCost(totalCost);
      return;
    }

    const startDate = new Date(projectStartDate);
    const currentDate = new Date();
    const monthsDifference = Math.max(0, 
      (startDate.getFullYear() - currentDate.getFullYear()) * 12 + 
      (startDate.getMonth() - currentDate.getMonth())
    );

    if (monthsDifference === 0) {
      setProjectedCost(totalCost);
      return;
    }

    let inflationToApply = 0;

    if (inflationMethod === 'automatic') {
      // Usar promedio histórico mensual
      const monthlyAverage = averageInflation / 100 / 12; // Convertir a decimal mensual
      inflationToApply = Math.pow(1 + monthlyAverage, monthsDifference) - 1;
    } else {
      // Usar tasa manual
      const monthlyManual = (manualInflationRate / 100) / 12; // Convertir a decimal mensual
      inflationToApply = Math.pow(1 + monthlyManual, monthsDifference) - 1;
    }

    const projected = totalCost * (1 + inflationToApply);
    setProjectedCost(projected);
  }, [applyInflationAdjustment, inflationMethod, manualInflationRate, projectStartDate, totalCost, averageInflation]);

  const inflationPercentageApplied = ((projectedCost - totalCost) / totalCost) * 100;

  return (
    <Card className="mb-6" id="ajuste-inflacion">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center">
          <span className="text-orange-600 mr-2">
            <TrendingUp className="h-5 w-5" />
          </span>
          Ajuste por Inflación Argentina
        </CardTitle>
        <CardDescription>
          Proyecta el costo del proyecto considerando la inflación hasta la fecha de inicio
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Switch para activar ajuste */}
        <div className="flex items-center space-x-3">
          <Switch
            id="apply-inflation"
            checked={applyInflationAdjustment}
            onCheckedChange={onApplyInflationChange}
          />
          <Label htmlFor="apply-inflation" className="font-medium">
            Aplicar ajuste por inflación
          </Label>
          {averageInflation > 0 && (
            <Badge variant="secondary" className="text-xs">
              Promedio 12m: {averageInflation.toFixed(1)}%
            </Badge>
          )}
        </div>

        {applyInflationAdjustment && (
          <>
            <Separator />
            
            {/* Fecha de inicio del proyecto */}
            <div className="space-y-2">
              <Label htmlFor="project-start" className="font-medium flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-blue-600" />
                Fecha de inicio del proyecto
              </Label>
              <Input
                id="project-start"
                type="date"
                value={projectStartDate || getDefaultProjectDate()}
                onChange={(e) => onProjectStartDateChange(e.target.value)}
                min={getMinimumProjectDate()}
              />
            </div>

            {/* Método de cálculo */}
            <div className="space-y-2">
              <Label className="font-medium flex items-center">
                <Percent className="h-4 w-4 mr-2 text-purple-600" />
                Método de cálculo
              </Label>
              <RadioGroup 
                value={inflationMethod || 'automatic'} 
                onValueChange={onInflationMethodChange}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="automatic" id="method-auto" />
                  <Label htmlFor="method-auto" className="text-sm">
                    <div>
                      <span className="font-medium">Automático</span>
                      <span className="text-gray-500 ml-2">
                        (Promedio últimos 12 meses: {averageInflation.toFixed(1)}% anual)
                      </span>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="manual" id="method-manual" />
                  <Label htmlFor="method-manual" className="text-sm font-medium">
                    Manual (especificar tasa proyectada)
                  </Label>
                </div>
              </RadioGroup>
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

            {/* Mostrar proyección */}
            {projectStartDate && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-orange-800">Proyección de Costo</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Costo actual</p>
                    <p className="font-bold text-gray-900">
                      {quotationCurrency === 'USD' 
                        ? formatUSD(totalCost / exchangeRate)
                        : formatARS(totalCost)
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Costo proyectado</p>
                    <p className="font-bold text-orange-700">
                      {quotationCurrency === 'USD' 
                        ? formatUSD(projectedCost / exchangeRate)
                        : formatARS(projectedCost)
                      }
                    </p>
                  </div>
                </div>
                {inflationPercentageApplied > 0 && (
                  <div className="pt-2 border-t border-orange-200">
                    <p className="text-xs text-orange-600">
                      Inflación aplicada: +{inflationPercentageApplied.toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Moneda de cotización */}
            <div className="space-y-2">
              <Label className="font-medium flex items-center">
                <DollarSign className="h-4 w-4 mr-2 text-green-600" />
                Mostrar presupuesto en
              </Label>
              <RadioGroup 
                value={quotationCurrency || 'ARS'} 
                onValueChange={onQuotationCurrencyChange}
                className="flex space-x-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ARS" id="currency-ars" />
                  <Label htmlFor="currency-ars" className="text-sm">
                    Pesos Argentinos (ARS)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="USD" id="currency-usd" />
                  <Label htmlFor="currency-usd" className="text-sm">
                    Dólares (USD) - TC: ${exchangeRate.toLocaleString()}
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}