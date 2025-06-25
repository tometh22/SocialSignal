import React, { useEffect, useState } from "react";
import { useOptimizedQuote } from "@/context/optimized-quote-context";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InflationAdjustmentCard } from "@/components/optimized/inflation-adjustment-card";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Users, 
  Calculator, 
  TrendingUp, 
  DollarSign, 
  Globe, 
  BarChart3,
  CheckCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Settings
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

  const [isInflationOpen, setIsInflationOpen] = useState(false);

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
    <div className="max-w-5xl mx-auto space-y-6 p-4">
      {/* Compact Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <CheckCircle className="h-6 w-6 text-green-600" />
          <h1 className="text-2xl font-bold text-gray-900">Cotización Finalizada</h1>
        </div>
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          Listo para presentar
        </Badge>
      </div>

      {/* Compact Project Overview */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <div>
                <span className="font-medium text-gray-900">Cliente:</span>
                <p className="text-gray-700">{quotationData.client?.name || 'No seleccionado'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-600" />
              <div>
                <span className="font-medium text-gray-900">Proyecto:</span>
                <p className="text-gray-700">{quotationData.project.name || 'Sin nombre'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-600" />
              <div>
                <span className="font-medium text-gray-900">Complejidad:</span>
                <Badge variant="secondary" className="ml-1">+{getComplexityPercentage()}%</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compact Team & Financial Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Compact Team */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-4 w-4" />
              Equipo ({quotationData.teamMembers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {quotationData.teamMembers.map((member, index) => (
              <div key={member.id || index} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded text-sm">
                <div>
                  <span className="font-medium">
                    {member.personnelId 
                      ? getPersonnelName(member.personnelId) 
                      : getRoleName(member.roleId)
                    }
                  </span>
                  <span className="text-gray-600 ml-2">
                    {member.hours}h × ${member.rate}
                  </span>
                </div>
                <span className="font-semibold">{formatCurrency(member.cost)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Compact Complexity Factors */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Factores de Complejidad
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between p-2 bg-amber-50 rounded">
                <span>Tipo Análisis</span>
                <Badge variant="outline" className="text-xs">
                  +{(complexityFactors.analysisTypeFactor * 100).toFixed(1)}%
                </Badge>
              </div>
              <div className="flex justify-between p-2 bg-green-50 rounded">
                <span>Menciones</span>
                <Badge variant="outline" className="text-xs">
                  +{(complexityFactors.mentionsVolumeFactor * 100).toFixed(1)}%
                </Badge>
              </div>
              <div className="flex justify-between p-2 bg-purple-50 rounded">
                <span>Países</span>
                <Badge variant="outline" className="text-xs">
                  +{(complexityFactors.countriesFactor * 100).toFixed(1)}%
                </Badge>
              </div>
              <div className="flex justify-between p-2 bg-blue-50 rounded">
                <span>Compromiso</span>
                <Badge variant="outline" className="text-xs">
                  +{(complexityFactors.clientEngagementFactor * 100).toFixed(1)}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compact Financial Waterfall */}
      <Card className="border-green-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Desglose Financiero
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">

          {/* Financial Steps - Compact */}
          <div className="space-y-2">
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded border border-blue-200">
              <span className="font-medium text-blue-900">1. Costo Base del Equipo</span>
              <span className="text-lg font-bold text-blue-900">{formatCurrency(teamBaseCost)}</span>
            </div>

            <div className="flex justify-between items-center p-3 bg-amber-50 rounded border border-amber-200">
              <span className="font-medium text-amber-900">
                2. Ajuste Complejidad (+{getComplexityPercentage()}%)
              </span>
              <span className="text-lg font-bold text-amber-900">+{formatCurrency(teamComplexityAdjustment)}</span>
            </div>

            {/* Subtotal before inflation */}
            <div className="flex justify-between items-center p-3 bg-gray-100 rounded border">
              <span className="font-medium">Subtotal (Base + Complejidad)</span>
              <span className="text-lg font-bold">{formatCurrency(subtotalWithComplexity)}</span>
            </div>

            {/* Inflation - Only show if applied */}
            {quotationData.inflation.applyInflationAdjustment && inflationAdjustment > 0 && (
              <div className="flex justify-between items-center p-3 bg-orange-50 rounded border border-orange-200">
                <span className="font-medium text-orange-900">3. Ajuste Inflación</span>
                <span className="text-lg font-bold text-orange-900">+{formatCurrency(inflationAdjustment)}</span>
              </div>
            )}

            <div className="flex justify-between items-center p-3 bg-green-50 rounded border border-green-200">
              <span className="font-medium text-green-900">4. Margen Comercial (100%)</span>
              <span className="text-lg font-bold text-green-900">+{formatCurrency(teamMarkupAmount)}</span>
            </div>

            {/* Platform, deviation, discount - only if they exist */}
            {platformCost > 0 && (
              <div className="flex justify-between items-center p-3 bg-purple-50 rounded border border-purple-200">
                <span className="font-medium text-purple-900">5. Costo Plataforma</span>
                <span className="text-lg font-bold text-purple-900">+{formatCurrency(platformCost)}</span>
              </div>
            )}

            {deviationPercentage !== 0 && (
              <div className={`flex justify-between items-center p-3 rounded border ${
                deviationPercentage > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
              }`}>
                <span className={`font-medium ${deviationPercentage > 0 ? 'text-red-900' : 'text-green-900'}`}>
                  6. Ajuste ({deviationPercentage > 0 ? '+' : ''}{deviationPercentage}%)
                </span>
                <span className={`text-lg font-bold ${deviationPercentage > 0 ? 'text-red-900' : 'text-green-900'}`}>
                  {deviationPercentage > 0 ? '+' : ''}{formatCurrency(deviationAmount)}
                </span>
              </div>
            )}

            {discountPercentage > 0 && (
              <div className="flex justify-between items-center p-3 bg-green-50 rounded border border-green-200">
                <span className="font-medium text-green-900">7. Descuento ({discountPercentage}%)</span>
                <span className="text-lg font-bold text-green-900">-{formatCurrency(discountAmount)}</span>
              </div>
            )}
          </div>

          <Separator className="my-4" />

          {/* Compact Final Total */}
          <div className="flex justify-between items-center p-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded text-white">
            <div>
              <h3 className="text-xl font-bold">TOTAL FINAL</h3>
              <p className="text-indigo-100 text-sm">
                {quotationData.inflation.quotationCurrency === 'USD' ? 'USD' : 'ARS'}
                {quotationData.inflation.applyInflationAdjustment && inflationAdjustment > 0 && 
                  ' (incluye inflación)'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">
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

      {/* Collapsible Inflation Configuration */}
      <Collapsible open={isInflationOpen} onOpenChange={setIsInflationOpen}>
        <Card className="border-orange-200">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-orange-50/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5 text-orange-600" />
                  Configuración de Inflación
                  <Badge variant={quotationData.inflation.applyInflationAdjustment ? "default" : "secondary"} className="ml-2">
                    {quotationData.inflation.applyInflationAdjustment ? 'Activada' : 'Desactivada'}
                  </Badge>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {quotationData.inflation.applyInflationAdjustment && inflationAdjustment > 0 
                      ? `+${formatCurrency(inflationAdjustment)}`
                      : 'Sin ajuste'
                    }
                  </span>
                  {isInflationOpen ? (
                    <ChevronUp className="h-4 w-4 text-gray-600" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-600" />
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
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
              <div className="mt-4 p-3 bg-amber-50 rounded border border-amber-200">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-amber-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800">¿Cómo funciona la inflación?</p>
                    <p className="text-amber-700 mt-1">
                      Cuando activas la inflación, se aplica un ajuste al subtotal (base + complejidad) 
                      basado en la fecha de inicio del proyecto. Este ajuste se suma antes del margen comercial.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Compact Action Buttons */}
      <div className="flex justify-center gap-3 pt-4">
        <Button variant="outline" size="default">
          Exportar PDF
        </Button>
        <Button size="default" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
          <CheckCircle className="h-4 w-4 mr-2" />
          Guardar Cotización
        </Button>
      </div>
    </div>
  );
}