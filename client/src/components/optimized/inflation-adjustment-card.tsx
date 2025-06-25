import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, Calculator, AlertTriangle, DollarSign, Shield } from 'lucide-react';
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
  projectType: string;
  projectDuration: string;
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
  projectType,
  projectDuration,
  onApplyInflationChange,
  onInflationMethodChange,
  onManualInflationRateChange,
  onProjectStartDateChange,
  onQuotationCurrencyChange,
}: InflationAdjustmentCardProps) {
  const [projectedCost, setProjectedCost] = useState(totalCost);
  const [displayCurrency, setDisplayCurrency] = useState<'ARS' | 'USD'>('ARS');

  // Fetch inflation data
  const { data: inflationData = [] } = useQuery<MonthlyInflation[]>({
    queryKey: ['/api/inflation/data'],
  });

  // Fetch exchange rate
  const { data: exchangeRateData = { rate: 1100 } } = useQuery<{ rate: number }>({
    queryKey: ['/api/exchange-rate'],
  });

  const exchangeRate = exchangeRateData?.rate || 1100;

  // Calculate average inflation from last 12 months
  const calculateAverageInflation = () => {
    if (!inflationData || inflationData.length === 0) {
      return 25; // Default fallback
    }

    // Get last 12 months
    const sortedData = [...inflationData].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });

    const recentData = sortedData.slice(0, 12);

    const average = recentData.reduce((sum, item) => sum + item.inflationRate, 0) / recentData.length;
    return average * 100; // Convertir a porcentaje
  };

  const averageInflation = calculateAverageInflation();

  // Calcular proyección de costo con inflación - SIEMPRE EN ARS
  const calculateInflationProjection = () => {
    console.log('🏦 === INFLATION CALCULATION START ===');
    console.log('Applied:', applyInflationAdjustment, 'Date:', projectStartDate);
    console.log('💰 Total cost received:', totalCost);
    console.log('💱 Currency:', quotationCurrency, 'Exchange rate:', exchangeRate);

    if (!applyInflationAdjustment || !projectStartDate) {
      console.log('❌ Not applying inflation - missing data');
      return totalCost;
    }

    if (totalCost <= 0) {
      console.log('❌ Invalid total cost:', totalCost);
      return totalCost;
    }

    const startDate = new Date(projectStartDate);
    const currentDate = new Date();
    const monthsDifference = (startDate.getFullYear() - currentDate.getFullYear()) * 12 + 
                           (startDate.getMonth() - currentDate.getMonth());

    console.log('📅 Current date:', currentDate.toISOString().split('T')[0]);
    console.log('📅 Start date:', startDate.toISOString().split('T')[0]);
    console.log('📅 Months difference:', monthsDifference);

    if (monthsDifference <= 0) {
      console.log('❌ Project starts in past or now - no inflation');
      return totalCost;
    }

    // PASO 1: Convertir el costo base a ARS si está en USD
    let baseCostInARS = totalCost;
    if (quotationCurrency === 'USD') {
      baseCostInARS = totalCost * exchangeRate;
      console.log('💱 Converting USD to ARS:', totalCost, 'USD =', baseCostInARS, 'ARS');
    }

    // PASO 2: Aplicar inflación argentina sobre el monto en ARS
    let inflationRate;
    if (inflationMethod === 'manual') {
      inflationRate = manualInflationRate; // Ya viene como porcentaje
    } else {
      inflationRate = averageInflation; // Ya viene como porcentaje
    }

    // Convertir a decimal y calcular factor mensual
    const annualRateDecimal = inflationRate / 100;
    const monthlyRateDecimal = annualRateDecimal / 12;
    const inflationFactor = Math.pow(1 + monthlyRateDecimal, monthsDifference);

    console.log('📊 Method:', inflationMethod);
    console.log('📊 Annual rate:', inflationRate.toFixed(2) + '%');
    console.log('📊 Monthly rate:', (monthlyRateDecimal * 100).toFixed(4) + '%');
    console.log('📊 Inflation factor:', inflationFactor.toFixed(6));
    console.log('📊 Months to project:', monthsDifference);

    const projectedCostInARS = baseCostInARS * inflationFactor;
    const adjustmentInARS = projectedCostInARS - baseCostInARS;

    console.log('💰 Base cost (ARS):', baseCostInARS.toLocaleString('es-AR'));
    console.log('💵 Projected cost (ARS):', projectedCostInARS.toLocaleString('es-AR'));
    console.log('💵 Inflation adjustment (ARS):', adjustmentInARS.toLocaleString('es-AR'));
    console.log('💵 Inflation percentage:', ((adjustmentInARS / baseCostInARS) * 100).toFixed(2) + '%');

    // RETORNAR SIEMPRE EN ARS - No convertir de vuelta
    console.log('🏦 === INFLATION CALCULATION END ===');

    return projectedCostInARS;
  };

  React.useEffect(() => {
    setProjectedCost(calculateInflationProjection());
  }, [totalCost, applyInflationAdjustment, inflationMethod, manualInflationRate, projectStartDate, averageInflation]);

  // Convertir costo base a ARS para los cálculos de inflación
  const baseCostInARS = quotationCurrency === 'USD' ? totalCost * exchangeRate : totalCost;
  const inflationAdjustmentInARS = projectedCost - baseCostInARS;
  const inflationPercentage = baseCostInARS > 0 ? (inflationAdjustmentInARS / baseCostInARS) * 100 : 0;

  // Para mostrar: siempre mostrar los valores de inflación en ARS
  const baseCostDisplay = baseCostInARS;
  const originalBaseCost = totalCost; // Guardar el costo original para referencia
  const projectedCostDisplay = projectedCost;
  const inflationAdjustmentDisplay = inflationAdjustmentInARS;

  // Funciones para convertir entre monedas
  const getARSEquivalent = (usdAmount: number) => {
    return usdAmount * exchangeRate;
  };

  const getUSDEquivalent = (arsAmount: number) => {
    return arsAmount / exchangeRate;
  };

  // Formatear valores - todo en ARS, opcionalmente mostrar equivalente en USD
  const formatInflationAmount = (amountInARS: number) => {
    if (displayCurrency === 'ARS') {
      return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amountInARS);
    } else {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(getUSDEquivalent(amountInARS));
    }
  };

  const formatBaseCostDisplay = (amountInARS: number) => {
    if (displayCurrency === 'ARS') {
      return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amountInARS);
    } else {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(getUSDEquivalent(amountInARS));
    }
  };

  return (
    <Card className="border-orange-200 bg-orange-50/30">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-lg text-orange-800">
            <TrendingUp className="mr-2 h-5 w-5" />
            Configuración de Inflación
            <Badge variant="secondary" className="ml-3 bg-orange-100 text-orange-700">
              {applyInflationAdjustment ? 'Activado' : 'Desactivado'}
            </Badge>
          </CardTitle>

          {/* Toggle para alternar moneda de visualización */}
          <div className="flex items-center space-x-2">
            <DollarSign className="h-4 w-4 text-gray-500" />
            <Label className="text-sm text-gray-600">Ver inflación en:</Label>
            <Select value={displayCurrency} onValueChange={(value: 'ARS' | 'USD') => setDisplayCurrency(value)}>
              <SelectTrigger className="w-20 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ARS">ARS</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-gray-500">(cálculo en ARS)</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toggle principal - más prominente */}
        <div className="flex items-center justify-between p-4 bg-white rounded-lg border-2 border-orange-200 shadow-sm">
          <div className="space-y-1">
            <Label className="font-semibold text-base">Aplicar ajuste por inflación</Label>
            <p className="text-sm text-gray-600">
              Proyecta costos futuros considerando la inflación argentina
            </p>
            <div className="text-xs text-orange-600 font-medium">
              {projectType === 'fee-mensual' 
                ? `Contrato recurrente (${projectDuration}) - Inflación durante toda la duración`
                : `Proyecto único (${projectDuration}) - Inflación hasta fecha de inicio`
              }
            </div>
          </div>
          <Switch
            checked={applyInflationAdjustment}
            onCheckedChange={onApplyInflationChange}
            className="data-[state=checked]:bg-orange-500"
          />
        </div>

        {/* Configuración de inflación - Solo visible cuando está activada */}
        {applyInflationAdjustment && (
          <div className="space-y-4 pt-2 border-t border-orange-100">
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
          {applyInflationAdjustment && projectStartDate && (
            <div className="bg-white p-4 rounded-lg border space-y-3">
              {/* Información del cálculo */}
              <div className="text-xs text-gray-500 mb-3">
                Proyección desde {new Date().toLocaleDateString('es-AR')} hasta {new Date(projectStartDate).toLocaleDateString('es-AR')} 
                ({Math.max(0, (new Date(projectStartDate).getFullYear() - new Date().getFullYear()) * 12 + 
                (new Date(projectStartDate).getMonth() - new Date().getMonth()))} meses)
              </div>

              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="font-medium text-gray-700">
                      Costo base (sin margen)
                    </span>
                    <span className="text-xs text-gray-500">
                      Sobre este costo se aplica la inflación
                    </span>
                  </div>
                <div className="text-right">
                    <div className="font-mono text-base">
                      {formatBaseCostDisplay(baseCostDisplay)}
                    </div>
                    {quotationCurrency === 'USD' && displayCurrency === 'ARS' && (
                      <div className="text-xs text-gray-500">
                        (Equivale a {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }).format(originalBaseCost)})
                      </div>
                    )}
                  </div>
              </div>

              {inflationAdjustmentInARS > 0 && (
                <>
                  <div className="flex items-center justify-between text-orange-600">
                    <div className="flex flex-col">
                      <span className="font-medium">Ajuste por inflación</span>
                      <span className="text-xs text-orange-500">Calculado en ARS</span>
                    </div>
                    <span className="font-mono">
                      +{formatInflationAmount(inflationAdjustmentDisplay)} (+{inflationPercentage.toFixed(1)}%)
                    </span>
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex items-center justify-between font-semibold text-lg">
                      <div className="flex flex-col">
                        <span>Costo proyectado (con inflación)</span>
                        <span className="text-xs font-normal text-gray-500">
                          Cálculo en pesos argentinos
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-primary font-mono">
                          {formatInflationAmount(projectedCostDisplay)}
                        </div>
                        {displayCurrency === 'ARS' && (
                          <div className="text-xs font-normal text-gray-500">
                            (≈ {new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: 'USD',
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }).format(getUSDEquivalent(projectedCostDisplay))})
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Warning sobre volatilidad - compacto */}
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
          </div>
        )}

        {/* Resumen cuando está desactivada */}
        {!applyInflationAdjustment && (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Sin protección inflacionaria</span>
              </div>
              <Badge variant="secondary" className="text-gray-600">
                No aplicada
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              La cotización se mantiene en valores actuales sin proyección inflacionaria
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}