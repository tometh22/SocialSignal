
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
  Settings,
  FileText,
  Target,
  Sparkles
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

  // Calculate final base after inflation (if any)
  const finalBaseAfterInflation = inflationProjectedCost;
  
  // Continue with markup calculation using the final base
  const teamMarkupAmount = finalBaseAfterInflation;
  const subtotalWithMarkup = finalBaseAfterInflation + teamMarkupAmount;

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
    <div className="max-w-6xl mx-auto space-y-6 p-4">
      {/* Header compacto con información clave */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <h1 className="text-xl font-bold text-gray-900">Cotización Finalizada</h1>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              Lista para presentar
            </Badge>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-900">Cliente</p>
              <p className="text-sm text-gray-600">{quotationData.client?.name || 'No seleccionado'}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <FileText className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-900">Proyecto</p>
              <p className="text-sm text-gray-600">{quotationData.project.name || 'Sin nombre'}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Target className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-900">Complejidad</p>
              <Badge variant="secondary" className="text-xs">+{getComplexityPercentage()}%</Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-900">Total</p>
              <p className="text-lg font-bold text-green-600">
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
        </div>
      </div>

      {/* Main Content Grid - Más compacto */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Team & Complexity */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Team Section */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Equipo Asignado
                <Badge variant="outline" className="ml-auto">{quotationData.teamMembers.length} miembros</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {quotationData.teamMembers.map((member, index) => (
                <div key={member.id || index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-xs font-medium text-blue-600">
                        {(member.personnelId 
                          ? getPersonnelName(member.personnelId) 
                          : getRoleName(member.roleId)
                        ).charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {member.personnelId 
                          ? getPersonnelName(member.personnelId) 
                          : getRoleName(member.roleId)
                        }
                      </p>
                      <p className="text-xs text-gray-600">
                        {member.hours}h × ${member.rate}/h
                      </p>
                    </div>
                  </div>
                  <span className="text-base font-semibold text-gray-900">{formatCurrency(member.cost)}</span>
                </div>
              ))}
              
              <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                <span className="font-medium text-gray-900">Subtotal Equipo</span>
                <span className="text-lg font-bold text-blue-600">{formatCurrency(teamBaseCost)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Complexity Breakdown */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calculator className="h-5 w-5 text-amber-600" />
                Factores de Complejidad
                <Badge variant="outline" className="ml-auto text-amber-600">+{getComplexityPercentage()}%</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg border border-amber-100">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-amber-900">Tipo Análisis</span>
                    <Badge variant="outline" className="text-xs text-amber-700 border-amber-300">
                      +{(complexityFactors.analysisTypeFactor * 100).toFixed(1)}%
                    </Badge>
                  </div>
                </div>
                <div className="p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-100">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-green-900">Menciones</span>
                    <Badge variant="outline" className="text-xs text-green-700 border-green-300">
                      +{(complexityFactors.mentionsVolumeFactor * 100).toFixed(1)}%
                    </Badge>
                  </div>
                </div>
                <div className="p-3 bg-gradient-to-br from-purple-50 to-violet-50 rounded-lg border border-purple-100">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-purple-900">Países</span>
                    <Badge variant="outline" className="text-xs text-purple-700 border-purple-300">
                      +{(complexityFactors.countriesFactor * 100).toFixed(1)}%
                    </Badge>
                  </div>
                </div>
                <div className="p-3 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg border border-blue-100">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-blue-900">Compromiso</span>
                    <Badge variant="outline" className="text-xs text-blue-700 border-blue-300">
                      +{(complexityFactors.clientEngagementFactor * 100).toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center pt-4 border-t border-gray-200 mt-4">
                <span className="font-medium text-gray-900">Ajuste por Complejidad</span>
                <span className="text-lg font-bold text-amber-600">+{formatCurrency(teamComplexityAdjustment)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Financial Waterfall */}
        <div className="space-y-4">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Resumen Financiero
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">

              {/* Financial Steps */}
              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="text-sm font-medium text-blue-900">1. Costo Base del Equipo</span>
                  <span className="font-bold text-blue-900">{formatCurrency(teamBaseCost)}</span>
                </div>

                <div className="flex justify-between items-center p-2 bg-amber-50 rounded-lg border border-amber-200">
                  <span className="text-sm font-medium text-amber-900">2. + Ajuste Complejidad ({getComplexityPercentage()}%)</span>
                  <span className="font-bold text-amber-900">+{formatCurrency(teamComplexityAdjustment)}</span>
                </div>

                <div className="flex justify-between items-center p-2 bg-gray-100 rounded-lg border border-gray-300">
                  <span className="text-sm font-medium text-gray-900">Subtotal (Base + Complejidad)</span>
                  <span className="font-bold text-gray-900">{formatCurrency(subtotalWithComplexity)}</span>
                </div>

                {/* Inflation - Only show if applied */}
                {quotationData.inflation.applyInflationAdjustment && inflationAdjustment > 0 && (
                  <>
                    <div className="flex justify-between items-center p-2 bg-orange-50 rounded-lg border border-orange-200">
                      <span className="text-sm font-medium text-orange-900">3. + Ajuste Inflación</span>
                      <span className="font-bold text-orange-900">+{formatCurrency(inflationAdjustment)}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-gray-100 rounded-lg border border-gray-300">
                      <span className="text-sm font-medium text-gray-900">Base Ajustada con Inflación</span>
                      <span className="font-bold text-gray-900">{formatCurrency(finalBaseAfterInflation)}</span>
                    </div>
                  </>
                )}

                <div className="flex justify-between items-center p-2 bg-green-50 rounded-lg border border-green-200">
                  <span className="text-sm font-medium text-green-900">
                    {quotationData.inflation.applyInflationAdjustment && inflationAdjustment > 0 ? '4.' : '3.'} + Margen Comercial (100%)
                  </span>
                  <span className="font-bold text-green-900">+{formatCurrency(teamMarkupAmount)}</span>
                </div>

                {/* Additional costs - only if they exist */}
                {platformCost > 0 && (
                  <div className="flex justify-between items-center p-2 bg-purple-50 rounded-lg border border-purple-200">
                    <span className="text-sm font-medium text-purple-900">+ Plataforma</span>
                    <span className="font-bold text-purple-900">+{formatCurrency(platformCost)}</span>
                  </div>
                )}

                {deviationPercentage !== 0 && (
                  <div className={`flex justify-between items-center p-2 rounded-lg border ${
                    deviationPercentage > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                  }`}>
                    <span className={`text-sm font-medium ${deviationPercentage > 0 ? 'text-red-900' : 'text-green-900'}`}>
                      Ajuste ({deviationPercentage > 0 ? '+' : ''}{deviationPercentage}%)
                    </span>
                    <span className={`font-bold ${deviationPercentage > 0 ? 'text-red-900' : 'text-green-900'}`}>
                      {deviationPercentage > 0 ? '+' : ''}{formatCurrency(deviationAmount)}
                    </span>
                  </div>
                )}

                {discountPercentage > 0 && (
                  <div className="flex justify-between items-center p-2 bg-green-50 rounded-lg border border-green-200">
                    <span className="text-sm font-medium text-green-900">- Descuento ({discountPercentage}%)</span>
                    <span className="font-bold text-green-900">-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
              </div>

              <Separator className="my-4" />

              {/* Final Total - Hero Style */}
              <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl text-white text-center">
                <p className="text-xs text-indigo-100 mb-1">TOTAL FINAL</p>
                <p className="text-2xl font-bold mb-1">
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
                <p className="text-xs text-indigo-200">
                  {quotationData.inflation.quotationCurrency === 'USD' ? 'USD' : 'ARS'}
                  {quotationData.inflation.applyInflationAdjustment && inflationAdjustment > 0 && 
                    ' • Incluye inflación'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Inflation Configuration - Collapsible */}
      <Collapsible open={isInflationOpen} onOpenChange={setIsInflationOpen}>
        <Card className="border-orange-200 bg-orange-50/30">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-4 cursor-pointer hover:bg-orange-50/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5 text-orange-600" />
                  Configuración de Inflación
                  <Badge variant={quotationData.inflation.applyInflationAdjustment ? "default" : "secondary"} className="ml-2">
                    {quotationData.inflation.applyInflationAdjustment ? 'Activada' : 'Desactivada'}
                  </Badge>
                </CardTitle>
                <div className="flex items-center gap-3">
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
              
              <div className="mt-4 space-y-3">
                {/* Status indicator */}
                <div className={`p-3 rounded-lg border ${
                  quotationData.inflation.applyInflationAdjustment 
                    ? 'bg-blue-50 border-blue-200' 
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Estado actual:</span>
                    <Badge variant={quotationData.inflation.applyInflationAdjustment ? "default" : "secondary"}>
                      {quotationData.inflation.applyInflationAdjustment 
                        ? `Inflación aplicada: +${formatCurrency(inflationAdjustment)}` 
                        : 'Sin ajuste de inflación'
                      }
                    </Badge>
                  </div>
                </div>

                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-800 mb-1">¿Cómo funciona la inflación?</p>
                      <p className="text-amber-700">
                        La inflación se aplica al subtotal (base + complejidad) basándose en la fecha de inicio del proyecto. 
                        El ajuste se suma antes del margen comercial para proteger contra la depreciación monetaria.
                        {!quotationData.inflation.applyInflationAdjustment && (
                          <span className="block mt-2 font-medium">
                            ⚠️ Actualmente desactivada - todos los cálculos usan valores base sin inflación.
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Action Buttons - Nivel 4 */}
      <div className="flex justify-center gap-4 pt-4 border-t border-gray-200">
        <Button variant="outline" size="lg" className="px-8">
          <FileText className="h-4 w-4 mr-2" />
          Exportar PDF
        </Button>
        <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-8">
          <CheckCircle className="h-4 w-4 mr-2" />
          Guardar Cotización
        </Button>
      </div>
    </div>
  );
}
