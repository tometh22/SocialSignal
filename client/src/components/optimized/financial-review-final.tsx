import React, { useEffect } from "react";
import { useOptimizedQuote } from "@/context/optimized-quote-context";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InflationAdjustmentCard } from "@/components/optimized/inflation-adjustment-card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

export default function FinancialReviewFinal() {
  const {
    quotationData,
    baseCost,
    complexityAdjustment,
    markupAmount,
    totalAmount,
    complexityFactors,
    availableRoles,
    availablePersonnel,
    forceRecalculate,
    updateInflation,
    updateFinancials
  } = useOptimizedQuote();

  // Debug log para verificar valores
  useEffect(() => {
    console.log('Financial Review - Current values:', {
      baseCost,
      complexityAdjustment,
      markupAmount,
      totalAmount,
      complexityFactors,
      teamMembers: quotationData.teamMembers
    });
  }, [baseCost, complexityAdjustment, markupAmount, totalAmount, complexityFactors, quotationData.teamMembers]);

  // Force recalculation when component mounts or data changes
  useEffect(() => {
    if (quotationData.teamMembers.length > 0) {
      forceRecalculate();
    }
  }, [quotationData.teamMembers, forceRecalculate]);

  // Calculate total complexity factor for display
  const totalComplexityFactor = Object.values(complexityFactors).reduce((sum, factor) => sum + factor, 0);

  const runDiagnostic = () => {
    console.log('🔍 === MANUAL DIAGNOSTIC ===');
    console.log('💰 Current values:', {
      baseCost,
      complexityAdjustment,
      markupAmount,
      totalAmount
    });
    console.log('👥 Team members:', quotationData.teamMembers);
    console.log('🧮 Complexity factors:', complexityFactors);
    console.log('📋 Template:', quotationData.template);

    // Force recalculation
    forceRecalculate();
  };

  // Helper function to get role name
  const getRoleName = (roleId) => {
    const role = availableRoles.find((r) => r.id === roleId);
    return role ? role.name : `Rol #${roleId}`;
  };

  // Helper function to get personnel name
  const getPersonnelName = (personnelId) => {
    const person = availablePersonnel.find((p) => p.id === personnelId);
    return person ? person.name : `Personal #${personnelId}`;
  };

    const calculateBaseCost = () => {
        let cost = 0;
        quotationData.teamMembers.forEach(member => {
            cost += member.cost;
        });
        return cost;
    };

    const calculateComplexityAdjustment = (baseCost) => {
        let adjustment = 0;
        adjustment += baseCost * complexityFactors.analysisTypeFactor;
        adjustment += baseCost * complexityFactors.mentionsVolumeFactor;
        adjustment += baseCost * complexityFactors.countriesFactor;
        adjustment += baseCost * complexityFactors.clientEngagementFactor;
        return adjustment;
    };

    const getComplexityPercentage = (level) => {
        if (level === 'low') return 0;
        if (level === 'medium') return 10;
        return 25;
    };
    
    // Calculate values
  const baseCost = calculateBaseCost();
  const complexityAdjustment = calculateComplexityAdjustment(baseCost);
  const subtotalWithComplexity = baseCost + complexityAdjustment;

  // Calculate inflation if applicable
  const baseForInflation = subtotalWithComplexity; // Base cost + complexity, BEFORE markup
  let inflationAdjustment = 0;
  let inflationProjectedCost = baseForInflation;

  if (quotationData.inflation.applyInflationAdjustment && quotationData.inflation.projectStartDate) {
    const startDate = new Date(quotationData.inflation.projectStartDate);
    const currentDate = new Date();
    const monthsDifference = (startDate.getFullYear() - currentDate.getFullYear()) * 12 + 
                           (startDate.getMonth() - currentDate.getMonth());

    if (monthsDifference > 0) {
      // Convert to ARS if needed
      const exchangeRate = 1100; // This should come from API
      let baseCostInARS = quotationData.inflation.quotationCurrency === 'USD' ? 
                         baseForInflation * exchangeRate : baseForInflation;

      // Calculate inflation
      let inflationRate;
      if (quotationData.inflation.inflationMethod === 'manual') {
        inflationRate = quotationData.inflation.manualInflationRate || 25;
      } else {
        inflationRate = 25; // This should come from API average
      }

      const annualRateDecimal = inflationRate / 100;
      const monthlyRateDecimal = annualRateDecimal / 12;
      const inflationFactor = Math.pow(1 + monthlyRateDecimal, monthsDifference);

      inflationProjectedCost = baseCostInARS * inflationFactor;
      inflationAdjustment = inflationProjectedCost - baseCostInARS;
    }
  }

  // Continue with markup calculation using inflated base
  const markupAmount = inflationProjectedCost; // 2x markup on inflated cost
  const subtotalWithMarkup = inflationProjectedCost + markupAmount;

  // Platform cost and adjustments
  const platformCost = quotationData.financials.platformCost || 0;
  const deviationPercentage = quotationData.financials.deviationPercentage || 0;
  const discountPercentage = quotationData.financials.discountPercentage || 0;

  const subtotalWithPlatform = subtotalWithMarkup + platformCost;
  const deviationAmount = subtotalWithPlatform * (deviationPercentage / 100);
  const subtotalWithDeviation = subtotalWithPlatform + deviationAmount;
  const discountAmount = subtotalWithDeviation * (discountPercentage / 100);
  const finalTotal = subtotalWithDeviation - discountAmount;

  // Update totals
  React.useEffect(() => {
    updateFinancials({
      baseCost,
      totalCost: finalTotal,
      complexityAdjustment,
      markupAmount,
      inflationAdjustment, // Include inflation adjustment
    });
  }, [baseCost, finalTotal, complexityAdjustment, markupAmount, inflationAdjustment, updateFinancials]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Revisión Financiera Final</h2>
        <div className="flex gap-2">
          <Button onClick={runDiagnostic} variant="outline" size="sm">
            🔍 Diagnóstico
          </Button>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            Paso 4 de 4
          </Badge>
        </div>
      </div>

      {/* Complexity Factors Display */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Factores de Complejidad</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <div className="text-sm text-gray-600">Tipo de Análisis</div>
              <div className="flex items-center gap-2">
                <Badge variant={quotationData.analysisType === "Estándar" ? "default" : quotationData.analysisType === "Avanzado" ? "destructive" : "secondary"}>
                  {quotationData.analysisType || "No seleccionado"}
                </Badge>
                <span className="text-xs text-gray-500">
                  +{(complexityFactors.analysisTypeFactor * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-gray-600">Volumen de Menciones</div>
              <div className="flex items-center gap-2">
                <Badge variant={quotationData.mentionsVolume === "Medio" ? "default" : quotationData.mentionsVolume === "Alto" ? "destructive" : "secondary"}>
                  {quotationData.mentionsVolume || "No seleccionado"}
                </Badge>
                <span className="text-xs text-gray-500">
                  +{(complexityFactors.mentionsVolumeFactor * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-gray-600">Países Cubiertos</div>
              <div className="flex items-center gap-2">
                <Badge variant={quotationData.countriesCovered === "4+ países" ? "destructive" : quotationData.countriesCovered === "2-3 países" ? "default" : "secondary"}>
                  {quotationData.countriesCovered || "No seleccionado"}
                </Badge>
                <span className="text-xs text-gray-500">
                  +{(complexityFactors.countriesFactor * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-gray-600">Compromiso del Cliente</div>
              <div className="flex items-center gap-2">
                <Badge variant={quotationData.clientEngagement === "Alto" ? "destructive" : quotationData.clientEngagement === "Medio" ? "default" : "secondary"}>
                  {quotationData.clientEngagement || "No seleccionado"}
                </Badge>
                <span className="text-xs text-gray-500">
                  +{(complexityFactors.clientEngagementFactor * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Members Cost Breakdown */}
      {quotationData.teamMembers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Desglose del Equipo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {quotationData.teamMembers.map((member, index) => (
                <div key={member.id || index} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-md">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">
                      {member.personnelId 
                        ? getPersonnelName(member.personnelId) 
                        : getRoleName(member.roleId)
                      }
                    </span>
                    <span className="text-xs text-gray-500">
                      {member.hours}h × ${member.rate}/h
                    </span>
                  </div>
                  <span className="text-sm font-mono font-medium">
                    {formatCurrency(member.cost)}
                  </span>
                </div>
              ))}
              <div className="border-t pt-2 mt-3">
                <div className="flex justify-between items-center font-medium">
                  <span>Costo Base del Equipo</span>
                  <span className="font-mono">{formatCurrency(baseCost)}</span>
                </div>
              </div>
              <div className="border-t pt-3 mt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700">Subtotal (sin margen):</span>
                  <span className="font-mono">{formatCurrency(subtotalWithComplexity)}</span>
                </div>

                {quotationData.inflation.applyInflationAdjustment && inflationAdjustment > 0 && (
                  <div className="flex justify-between text-sm text-orange-700 bg-orange-50 px-2 py-1 rounded">
                    <span className="font-medium">+ Ajuste por inflación:</span>
                    <span className="font-mono">{formatCurrency(inflationAdjustment)}</span>
                  </div>
                )}

                {quotationData.inflation.applyInflationAdjustment && inflationAdjustment > 0 && (
                  <div className="flex justify-between text-sm border-t pt-2">
                    <span className="font-medium text-gray-700">Subtotal proyectado:</span>
                    <span className="font-mono font-semibold">{formatCurrency(inflationProjectedCost)}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Markup Control */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center text-lg text-blue-800">
            Configuración de Margen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Factor de Margen</Label>
                <span className="text-sm font-mono bg-blue-100 px-2 py-1 rounded">
                  {quotationData.financials.marginFactor.toFixed(1)}x
                </span>
              </div>
              <Slider
                value={[quotationData.financials.marginFactor]}
                onValueChange={([value]) => 
                  updateFinancials({ marginFactor: value })
                }
                min={1.0}
                max={4.0}
                step={0.1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>1.0x (Sin margen)</span>
                <span>2.0x (100% margen)</span>
                <span>4.0x (300% margen)</span>
              </div>
            </div>

            <div className="bg-white p-3 rounded-lg border">
              <div className="flex justify-between items-center text-sm">
                <span>Margen aplicado:</span>
                <span className="font-mono font-medium text-blue-600">
                  +{formatCurrency(markupAmount)}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Factor {quotationData.financials.marginFactor.toFixed(1)}x sobre costo base + plataforma
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financial Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumen Financiero</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg border">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Costo Base (Equipo)</span>
                <span className="text-lg font-mono font-semibold text-gray-900">
                  {formatCurrency(baseCost)}
                </span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">
                  Ajuste por Complejidad ({getComplexityPercentage(quotationData.complexity.level)}%)
                </span>
                <span className="text-lg font-mono font-semibold text-gray-900">
                  {formatCurrency(complexityAdjustment)}
                </span>
              </div>
            </div>

            {quotationData.inflation.applyInflationAdjustment && inflationAdjustment > 0 && (
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-orange-800">Ajuste por Inflación</span>
                    <span className="text-xs text-orange-600">
                      {quotationData.inflation.inflationMethod === 'manual' 
                        ? `${quotationData.inflation.manualInflationRate}% anual` 
                        : 'Promedio 12 meses'}
                    </span>
                  </div>
                  <span className="text-lg font-mono font-semibold text-orange-800">
                    +{formatCurrency(inflationAdjustment)}
                  </span>
                </div>
              </div>
            )}

            <div className="bg-white p-4 rounded-lg border">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">
                  Margen Estándar (100%)
                  {quotationData.inflation.applyInflationAdjustment && inflationAdjustment > 0 && (
                    <span className="text-xs text-orange-600 block">Aplicado sobre costo con inflación</span>
                  )}
                </span>
                <span className="text-lg font-mono font-semibold text-gray-900">
                  {formatCurrency(markupAmount)}
                </span>
              </div>
            </div>

            {platformCost > 0 && (
              <div className="bg-white p-4 rounded-lg border">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Costo de Plataforma</span>
                  <span className="text-lg font-mono font-semibold text-gray-900">
                    {formatCurrency(platformCost)}
                  </span>
                </div>
              </div>
            )}

            {deviationPercentage !== 0 && (
              <div className="bg-white p-4 rounded-lg border">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">
                    Ajuste ({deviationPercentage > 0 ? '+' : ''}{deviationPercentage}%)
                  </span>
                  <span className={`text-lg font-mono font-semibold ${deviationPercentage > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {deviationPercentage > 0 ? '+' : ''}{formatCurrency(deviationAmount)}
                  </span>
                </div>
              </div>
            )}

            {discountPercentage > 0 && (
              <div className="bg-white p-4 rounded-lg border">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Descuento ({discountPercentage}%)</span>
                  <span className="text-lg font-mono font-semibold text-green-600">
                    -{formatCurrency(discountAmount)}
                  </span>
                </div>
              </div>
            )}

            <div className="bg-primary/10 p-4 rounded-lg border-2 border-primary/20">
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-primary">Total Final</span>
                  {quotationData.inflation.applyInflationAdjustment && inflationAdjustment > 0 && (
                    <span className="text-xs text-primary/70">Incluye ajuste por inflación</span>
                  )}
                </div>
                <span className="text-2xl font-mono font-bold text-primary">
                  {quotationData.inflation.quotationCurrency === 'USD' 
                  ? new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(finalTotal)
                  : new Intl.NumberFormat('es-AR', {
                      style: 'currency',
                      currency: 'ARS',
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(finalTotal)
                }
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inflation Adjustment */}
      <InflationAdjustmentCard
        applyInflationAdjustment={quotationData.inflation.applyInflationAdjustment}
        inflationMethod={quotationData.inflation.inflationMethod}
        manualInflationRate={quotationData.inflation.manualInflationRate}
        projectStartDate={quotationData.inflation.projectStartDate}
        totalCost={baseCost + complexityAdjustment + quotationData.financials.platformCost} // Costo SIN margen para inflación
        quotationCurrency={quotationData.inflation.quotationCurrency}
        projectType={quotationData.project.type}
        projectDuration={quotationData.project.duration}
        onApplyInflationChange={(value) => updateInflation({ applyInflationAdjustment: value })}
        onInflationMethodChange={(value) => updateInflation({ inflationMethod: value })}
        onManualInflationRateChange={(value) => updateInflation({ manualInflationRate: value })}
        onProjectStartDateChange={(value) => updateInflation({ projectStartDate: value })}
        onQuotationCurrencyChange={(value) => updateInflation({ quotationCurrency: value })}
      />

      {/* Project Information Summary */}
      <Card className="border-slate-200 bg-slate-50/30">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center text-lg text-slate-800">
            Resumen del Proyecto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-slate-600">Cliente:</span>
                <div className="text-base font-semibold">{quotationData.client?.name || 'No seleccionado'}</div>
              </div>
              <div>
                <span className="text-sm font-medium text-slate-600">Proyecto:</span>
                <div className="text-base font-semibold">{quotationData.project.name || 'Sin nombre'}</div>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-slate-600">Tipo de Proyecto:</span>
                <div className="text-base font-semibold">
                  {quotationData.project.type === 'on-demand' ? 'On Demand (Proyecto Único)' : 
                   quotationData.project.type === 'fee-mensual' ? 'Fee Mensual (Contrato Recurrente)' : 
                   'No especificado'}
                </div>
              </div>
              <div>
                <span className="text-sm font-medium text-slate-600">Duración:</span>
                <div className="text-base font-semibold">
                  {quotationData.project.duration || 'No especificada'}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}