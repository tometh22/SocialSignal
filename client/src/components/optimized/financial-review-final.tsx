
import React, { useEffect } from "react";
import { useOptimizedQuote } from "@/context/optimized-quote-context";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InflationAdjustmentCard } from "@/components/optimized/inflation-adjustment-card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  Users, 
  Calculator, 
  TrendingUp, 
  DollarSign, 
  Globe, 
  MessageCircle,
  BarChart3,
  CheckCircle,
  AlertTriangle,
  Info
} from "lucide-react";

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

  // Force recalculation when component mounts or data changes
  useEffect(() => {
    if (quotationData.teamMembers.length > 0) {
      forceRecalculate();
    }
  }, [quotationData.teamMembers, forceRecalculate]);

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

  const calculateTeamBaseCost = () => {
    let cost = 0;
    quotationData.teamMembers.forEach(member => {
      cost += member.cost;
    });
    return cost;
  };

  const calculateComplexityAdjustment = (teamBaseCost) => {
    let adjustment = 0;
    adjustment += teamBaseCost * complexityFactors.analysisTypeFactor;
    adjustment += teamBaseCost * complexityFactors.mentionsVolumeFactor;
    adjustment += teamBaseCost * complexityFactors.countriesFactor;
    adjustment += teamBaseCost * complexityFactors.clientEngagementFactor;
    return adjustment;
  };

  const getComplexityPercentage = () => {
    const totalFactor = Object.values(complexityFactors).reduce((sum, factor) => sum + factor, 0);
    return (totalFactor * 100).toFixed(1);
  };
    
  // Calculate values
  const teamBaseCost = calculateTeamBaseCost();
  const teamComplexityAdjustment = calculateComplexityAdjustment(teamBaseCost);
  const subtotalWithComplexity = teamBaseCost + teamComplexityAdjustment;

  // Calculate inflation if applicable
  const baseForInflation = subtotalWithComplexity;
  let inflationAdjustment = 0;
  let inflationProjectedCost = baseForInflation;

  if (quotationData.inflation.applyInflationAdjustment && quotationData.inflation.projectStartDate) {
    const startDate = new Date(quotationData.inflation.projectStartDate);
    const currentDate = new Date();
    const monthsDifference = (startDate.getFullYear() - currentDate.getFullYear()) * 12 + 
                           (startDate.getMonth() - currentDate.getMonth());

    if (monthsDifference > 0) {
      const exchangeRate = 1100;
      let baseCostInARS = quotationData.inflation.quotationCurrency === 'USD' ? 
                         baseForInflation * exchangeRate : baseForInflation;

      let inflationRate;
      if (quotationData.inflation.inflationMethod === 'manual') {
        inflationRate = quotationData.inflation.manualInflationRate || 25;
      } else {
        inflationRate = 25;
      }

      const annualRateDecimal = inflationRate / 100;
      const monthlyRateDecimal = annualRateDecimal / 12;
      const inflationFactor = Math.pow(1 + monthlyRateDecimal, monthsDifference);

      inflationProjectedCost = baseCostInARS * inflationFactor;
      inflationAdjustment = inflationProjectedCost - baseCostInARS;
    }
  }

  // Continue with markup calculation using inflated base
  const teamMarkupAmount = inflationProjectedCost;
  const subtotalWithMarkup = inflationProjectedCost + teamMarkupAmount;

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
      baseCost: teamBaseCost,
      totalCost: finalTotal,
      complexityAdjustment: teamComplexityAdjustment,
      markupAmount: teamMarkupAmount,
      inflationAdjustment,
    });
  }, [teamBaseCost, finalTotal, teamComplexityAdjustment, teamMarkupAmount, inflationAdjustment, updateFinancials]);

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-6">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <CheckCircle className="h-8 w-8 text-green-600" />
          <h1 className="text-3xl font-bold text-gray-900">Cotización Finalizada</h1>
        </div>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Revisión completa de tu proyecto con todos los ajustes aplicados
        </p>
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 px-4 py-2">
          <CheckCircle className="h-4 w-4 mr-2" />
          Paso 4 de 4 - Listo para presentar
        </Badge>
      </div>

      {/* Project Overview */}
      <Card className="border-2 border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <Info className="h-6 w-6 text-blue-600" />
            Resumen del Proyecto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-gray-900">Cliente</span>
              </div>
              <p className="text-lg text-gray-700">{quotationData.client?.name || 'Cliente no seleccionado'}</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-gray-900">Proyecto</span>
              </div>
              <p className="text-lg text-gray-700">{quotationData.project.name || 'Proyecto sin nombre'}</p>
              <Badge variant="secondary">
                {quotationData.project.type === 'on-demand' ? 'Proyecto Único' : 
                 quotationData.project.type === 'fee-mensual' ? 'Fee Mensual' : 
                 'Tipo no especificado'}
              </Badge>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-gray-900">Complejidad</span>
              </div>
              <div className="space-y-2">
                <p className="text-lg text-gray-700">{quotationData.analysisType}</p>
                <Badge variant={getComplexityPercentage() > 20 ? "destructive" : getComplexityPercentage() > 10 ? "default" : "secondary"}>
                  +{getComplexityPercentage()}% ajuste total
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team & Cost Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Team Composition */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Users className="h-5 w-5 text-gray-700" />
              Composición del Equipo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {quotationData.teamMembers.map((member, index) => (
              <div key={member.id || index} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border">
                <div className="space-y-1">
                  <h4 className="font-semibold text-gray-900">
                    {member.personnelId 
                      ? getPersonnelName(member.personnelId) 
                      : getRoleName(member.roleId)
                    }
                  </h4>
                  <p className="text-sm text-gray-600">
                    {member.hours} horas × ${member.rate}/hora
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">
                    {formatCurrency(member.cost)}
                  </p>
                </div>
              </div>
            ))}
            
            <Separator />
            
            <div className="flex justify-between items-center py-2">
              <span className="text-lg font-semibold text-gray-900">Costo Base del Equipo</span>
              <span className="text-xl font-bold text-blue-600">{formatCurrency(teamBaseCost)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Complexity Factors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Calculator className="h-5 w-5 text-gray-700" />
              Factores de Complejidad
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Tipo de Análisis</p>
                  <p className="text-sm text-gray-600">{quotationData.analysisType}</p>
                </div>
                <Badge variant="outline">
                  +{(complexityFactors.analysisTypeFactor * 100).toFixed(1)}%
                </Badge>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Volumen de Menciones</p>
                  <p className="text-sm text-gray-600">{quotationData.mentionsVolume}</p>
                </div>
                <Badge variant="outline">
                  +{(complexityFactors.mentionsVolumeFactor * 100).toFixed(1)}%
                </Badge>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Países Cubiertos</p>
                  <p className="text-sm text-gray-600">{quotationData.countriesCovered}</p>
                </div>
                <Badge variant="outline">
                  +{(complexityFactors.countriesFactor * 100).toFixed(1)}%
                </Badge>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Compromiso del Cliente</p>
                  <p className="text-sm text-gray-600">{quotationData.clientEngagement}</p>
                </div>
                <Badge variant="outline">
                  +{(complexityFactors.clientEngagementFactor * 100).toFixed(1)}%
                </Badge>
              </div>
            </div>
            
            <Separator />
            
            <div className="flex justify-between items-center py-2">
              <span className="text-lg font-semibold text-gray-900">Ajuste por Complejidad</span>
              <span className="text-xl font-bold text-amber-600">+{formatCurrency(teamComplexityAdjustment)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Waterfall */}
      <Card className="border-2 border-green-100">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl">
            <DollarSign className="h-6 w-6 text-green-600" />
            Desglose Financiero Completo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Base Cost */}
          <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div>
              <h4 className="font-semibold text-blue-900">1. Costo Base del Equipo</h4>
              <p className="text-sm text-blue-700">Suma de horas × tarifas de todos los miembros</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-900">{formatCurrency(teamBaseCost)}</p>
            </div>
          </div>

          {/* Complexity Adjustment */}
          <div className="flex justify-between items-center p-4 bg-amber-50 rounded-lg border border-amber-200">
            <div>
              <h4 className="font-semibold text-amber-900">2. Ajuste por Complejidad</h4>
              <p className="text-sm text-amber-700">+{getComplexityPercentage()}% basado en factores del proyecto</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-amber-900">+{formatCurrency(teamComplexityAdjustment)}</p>
            </div>
          </div>

          {/* Subtotal before markup */}
          <div className="flex justify-between items-center p-4 bg-gray-100 rounded-lg border border-gray-300">
            <div>
              <h4 className="font-semibold text-gray-900">Subtotal (Base + Complejidad)</h4>
              <p className="text-sm text-gray-600">Costo real del proyecto antes de márgenes</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(subtotalWithComplexity)}</p>
            </div>
          </div>

          {/* Inflation Adjustment */}
          {quotationData.inflation.applyInflationAdjustment && inflationAdjustment > 0 && (
            <div className="flex justify-between items-center p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div>
                <h4 className="font-semibold text-orange-900">3. Ajuste por Inflación</h4>
                <p className="text-sm text-orange-700">
                  {quotationData.inflation.inflationMethod === 'manual' 
                    ? `${quotationData.inflation.manualInflationRate}% anual aplicado` 
                    : 'Promedio histórico de 12 meses'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-orange-900">+{formatCurrency(inflationAdjustment)}</p>
              </div>
            </div>
          )}

          {/* Markup */}
          <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg border border-green-200">
            <div>
              <h4 className="font-semibold text-green-900">4. Margen Comercial</h4>
              <p className="text-sm text-green-700">100% de margen estándar aplicado</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-green-900">+{formatCurrency(teamMarkupAmount)}</p>
            </div>
          </div>

          {/* Platform Cost */}
          {platformCost > 0 && (
            <div className="flex justify-between items-center p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div>
                <h4 className="font-semibold text-purple-900">5. Costo de Plataforma</h4>
                <p className="text-sm text-purple-700">Herramientas y servicios externos</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-purple-900">+{formatCurrency(platformCost)}</p>
              </div>
            </div>
          )}

          {/* Deviation */}
          {deviationPercentage !== 0 && (
            <div className={`flex justify-between items-center p-4 rounded-lg border ${
              deviationPercentage > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
            }`}>
              <div>
                <h4 className={`font-semibold ${deviationPercentage > 0 ? 'text-red-900' : 'text-green-900'}`}>
                  6. Ajuste {deviationPercentage > 0 ? 'Adicional' : 'Descuento'}
                </h4>
                <p className={`text-sm ${deviationPercentage > 0 ? 'text-red-700' : 'text-green-700'}`}>
                  {deviationPercentage > 0 ? '+' : ''}{deviationPercentage}% sobre subtotal
                </p>
              </div>
              <div className="text-right">
                <p className={`text-2xl font-bold ${deviationPercentage > 0 ? 'text-red-900' : 'text-green-900'}`}>
                  {deviationPercentage > 0 ? '+' : ''}{formatCurrency(deviationAmount)}
                </p>
              </div>
            </div>
          )}

          {/* Discount */}
          {discountPercentage > 0 && (
            <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg border border-green-200">
              <div>
                <h4 className="font-semibold text-green-900">7. Descuento Aplicado</h4>
                <p className="text-sm text-green-700">{discountPercentage}% de descuento especial</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-900">-{formatCurrency(discountAmount)}</p>
              </div>
            </div>
          )}

          <Separator className="my-6" />

          {/* Final Total */}
          <div className="flex justify-between items-center p-6 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg text-white">
            <div>
              <h3 className="text-2xl font-bold">TOTAL FINAL</h3>
              <p className="text-indigo-100">
                {quotationData.inflation.quotationCurrency === 'USD' ? 'Dólares Americanos' : 'Pesos Argentinos'}
              </p>
              {quotationData.inflation.applyInflationAdjustment && inflationAdjustment > 0 && (
                <p className="text-sm text-indigo-200 mt-1">Incluye proyección inflacionaria</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold">
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
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inflation Configuration */}
      <InflationAdjustmentCard
        applyInflationAdjustment={quotationData.inflation.applyInflationAdjustment}
        inflationMethod={quotationData.inflation.inflationMethod}
        manualInflationRate={quotationData.inflation.manualInflationRate}
        projectStartDate={quotationData.inflation.projectStartDate}
        totalCost={subtotalWithComplexity}
        quotationCurrency={quotationData.inflation.quotationCurrency}
        projectType={quotationData.project.type}
        projectDuration={quotationData.project.duration}
        onApplyInflationChange={(value) => updateInflation({ applyInflationAdjustment: value })}
        onInflationMethodChange={(value) => updateInflation({ inflationMethod: value })}
        onManualInflationRateChange={(value) => updateInflation({ manualInflationRate: value })}
        onProjectStartDateChange={(value) => updateInflation({ projectStartDate: value })}
        onQuotationCurrencyChange={(value) => updateInflation({ quotationCurrency: value })}
      />

      {/* Action Buttons */}
      <div className="flex justify-center gap-4 pt-8">
        <Button variant="outline" size="lg" className="px-8">
          Exportar PDF
        </Button>
        <Button size="lg" className="px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
          <CheckCircle className="h-5 w-5 mr-2" />
          Guardar Cotización
        </Button>
      </div>
    </div>
  );
}
