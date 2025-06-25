
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
  Sparkles,
  Clock,
  Zap,
  Shield
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
    <div className="max-w-7xl mx-auto space-y-8 p-6">
      {/* Level 1: Compact Success Header */}
      <div className="bg-gradient-to-r from-emerald-50 via-blue-50 to-indigo-50 rounded-2xl p-6 border border-emerald-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Cotización Finalizada</h1>
              <p className="text-sm text-gray-600">Lista para presentar al cliente</p>
            </div>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 ml-4">
              <Sparkles className="h-3 w-3 mr-1" />
              Completa
            </Badge>
          </div>
          
          <div className="text-right">
            <p className="text-sm text-gray-600 mb-1">Total Proyecto</p>
            <p className="text-3xl font-bold text-gray-900">
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
            <p className="text-xs text-gray-500">
              {quotationData.inflation.quotationCurrency} • {quotationData.client?.name}
            </p>
          </div>
        </div>
      </div>

      {/* Level 2: Executive Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-200 flex items-center justify-center">
                <Users className="h-4 w-4 text-blue-700" />
              </div>
              <div>
                <p className="text-xs font-medium text-blue-800">Equipo</p>
                <p className="text-lg font-bold text-blue-900">{quotationData.teamMembers.length} miembros</p>
                <p className="text-xs text-blue-600">{formatCurrency(teamBaseCost)} base</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-200 flex items-center justify-center">
                <Target className="h-4 w-4 text-amber-700" />
              </div>
              <div>
                <p className="text-xs font-medium text-amber-800">Complejidad</p>
                <p className="text-lg font-bold text-amber-900">+{getComplexityPercentage()}%</p>
                <p className="text-xs text-amber-600">+{formatCurrency(teamComplexityAdjustment)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-0 shadow-sm ${
          quotationData.inflation.applyInflationAdjustment 
            ? 'bg-gradient-to-br from-orange-50 to-orange-100' 
            : 'bg-gradient-to-br from-gray-50 to-gray-100'
        }`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                quotationData.inflation.applyInflationAdjustment 
                  ? 'bg-orange-200' 
                  : 'bg-gray-200'
              }`}>
                <Clock className={`h-4 w-4 ${
                  quotationData.inflation.applyInflationAdjustment 
                    ? 'text-orange-700' 
                    : 'text-gray-700'
                }`} />
              </div>
              <div>
                <p className={`text-xs font-medium ${
                  quotationData.inflation.applyInflationAdjustment 
                    ? 'text-orange-800' 
                    : 'text-gray-800'
                }`}>Inflación</p>
                <p className={`text-lg font-bold ${
                  quotationData.inflation.applyInflationAdjustment 
                    ? 'text-orange-900' 
                    : 'text-gray-900'
                }`}>
                  {quotationData.inflation.applyInflationAdjustment ? 'Aplicada' : 'Sin ajuste'}
                </p>
                <p className={`text-xs ${
                  quotationData.inflation.applyInflationAdjustment 
                    ? 'text-orange-600' 
                    : 'text-gray-600'
                }`}>
                  {inflationAdjustment > 0 ? `+${formatCurrency(inflationAdjustment)}` : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-200 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-green-700" />
              </div>
              <div>
                <p className="text-xs font-medium text-green-800">Margen</p>
                <p className="text-lg font-bold text-green-900">100%</p>
                <p className="text-xs text-green-600">+{formatCurrency(teamMarkupAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Level 3: Main Content - Three Column Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left: Team Breakdown (4 columns) */}
        <div className="xl:col-span-4 space-y-6">
          <Card className="shadow-sm border-0 bg-white">
            <CardHeader className="pb-4 border-b border-gray-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Composición del Equipo
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-50">
                {quotationData.teamMembers.map((member, index) => (
                  <div key={member.id || index} className="p-4 hover:bg-gray-25 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                          <span className="text-xs font-semibold text-blue-700">
                            {(member.personnelId 
                              ? getPersonnelName(member.personnelId) 
                              : getRoleName(member.roleId)
                            ).charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {member.personnelId 
                              ? getPersonnelName(member.personnelId) 
                              : getRoleName(member.roleId)
                            }
                          </p>
                          <p className="text-xs text-gray-500">
                            {member.hours}h × ${member.rate}/h
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-gray-900">{formatCurrency(member.cost)}</span>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="p-4 bg-blue-50 border-t border-blue-100">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-blue-900">Subtotal Base</span>
                  <span className="text-lg font-bold text-blue-900">{formatCurrency(teamBaseCost)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Complexity Factors */}
          <Card className="shadow-sm border-0 bg-white">
            <CardHeader className="pb-4 border-b border-gray-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calculator className="h-5 w-5 text-amber-600" />
                Factores de Complejidad
                <Badge variant="outline" className="ml-auto text-amber-700 border-amber-200">
                  +{getComplexityPercentage()}%
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-100">
                  <span className="text-sm font-medium text-amber-900">Tipo de Análisis</span>
                  <Badge variant="outline" className="text-xs text-amber-700 border-amber-300">
                    +{(complexityFactors.analysisTypeFactor * 100).toFixed(1)}%
                  </Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100">
                  <span className="text-sm font-medium text-green-900">Volumen de Menciones</span>
                  <Badge variant="outline" className="text-xs text-green-700 border-green-300">
                    +{(complexityFactors.mentionsVolumeFactor * 100).toFixed(1)}%
                  </Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg border border-purple-100">
                  <span className="text-sm font-medium text-purple-900">Países Cubiertos</span>
                  <Badge variant="outline" className="text-xs text-purple-700 border-purple-300">
                    +{(complexityFactors.countriesFactor * 100).toFixed(1)}%
                  </Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-100">
                  <span className="text-sm font-medium text-blue-900">Compromiso Cliente</span>
                  <Badge variant="outline" className="text-xs text-blue-700 border-blue-300">
                    +{(complexityFactors.clientEngagementFactor * 100).toFixed(1)}%
                  </Badge>
                </div>
              </div>
              
              <Separator className="my-4" />
              
              <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg border border-amber-200">
                <span className="font-semibold text-amber-900">Total Ajuste Complejidad</span>
                <span className="text-lg font-bold text-amber-900">+{formatCurrency(teamComplexityAdjustment)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Center: Inflation Configuration (4 columns) - CRITICAL SECTION */}
        <div className="xl:col-span-4 space-y-6">
          <div className={`relative ${
            quotationData.inflation.applyInflationAdjustment 
              ? 'ring-2 ring-orange-200 ring-offset-2 ring-offset-white' 
              : 'ring-1 ring-gray-200'
          } rounded-xl transition-all duration-200`}>
            <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-orange-50/30">
              <CardHeader className="pb-4 border-b border-orange-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                      quotationData.inflation.applyInflationAdjustment 
                        ? 'bg-orange-100' 
                        : 'bg-gray-100'
                    }`}>
                      <Shield className={`h-4 w-4 ${
                        quotationData.inflation.applyInflationAdjustment 
                          ? 'text-orange-600' 
                          : 'text-gray-600'
                      }`} />
                    </div>
                    Protección Inflacionaria
                    {quotationData.inflation.applyInflationAdjustment && (
                      <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                        <Zap className="h-3 w-3 mr-1" />
                        Activa
                      </Badge>
                    )}
                  </CardTitle>
                </div>
                <p className="text-sm text-gray-600">
                  {quotationData.inflation.applyInflationAdjustment 
                    ? 'Cotización protegida contra inflación argentina'
                    : 'Configurar protección para proyectos futuros'
                  }
                </p>
              </CardHeader>
              <CardContent className="p-0">
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

                {/* Impact Summary */}
                <div className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 border-t border-orange-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-orange-600" />
                      <span className="text-sm font-medium text-orange-900">
                        {quotationData.inflation.applyInflationAdjustment 
                          ? 'Impacto en cotización:' 
                          : 'Sin protección inflacionaria'
                        }
                      </span>
                    </div>
                    <Badge variant={quotationData.inflation.applyInflationAdjustment ? "default" : "secondary"} className="text-sm">
                      {quotationData.inflation.applyInflationAdjustment && inflationAdjustment > 0
                        ? `+${formatCurrency(inflationAdjustment)}`
                        : 'No aplicada'
                      }
                    </Badge>
                  </div>
                  
                  {quotationData.inflation.applyInflationAdjustment && (
                    <div className="mt-3 p-2 bg-white/50 rounded-lg">
                      <p className="text-xs text-orange-700">
                        ✅ Cotización protegida hasta {quotationData.inflation.projectStartDate ? 
                          new Date(quotationData.inflation.projectStartDate).toLocaleDateString('es-AR') : 
                          'fecha del proyecto'
                        }
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right: Financial Waterfall (4 columns) */}
        <div className="xl:col-span-4 space-y-6">
          <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-emerald-50/30">
            <CardHeader className="pb-4 border-b border-emerald-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-emerald-600" />
                Desglose Financiero
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">

              {/* Step 1: Base Cost */}
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-blue-900">1. Costo Base Equipo</span>
                  <span className="font-bold text-blue-900">{formatCurrency(teamBaseCost)}</span>
                </div>
              </div>

              {/* Step 2: Complexity */}
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-amber-900">2. + Complejidad ({getComplexityPercentage()}%)</span>
                  <span className="font-bold text-amber-900">+{formatCurrency(teamComplexityAdjustment)}</span>
                </div>
              </div>

              {/* Subtotal */}
              <div className="p-3 bg-gray-100 rounded-lg border border-gray-300">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-900">Subtotal (Base + Complejidad)</span>
                  <span className="font-bold text-gray-900">{formatCurrency(subtotalWithComplexity)}</span>
                </div>
              </div>

              {/* Step 3: Inflation (if applicable) */}
              {quotationData.inflation.applyInflationAdjustment && inflationAdjustment > 0 && (
                <>
                  <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-orange-900">3. + Protección Inflación</span>
                      <span className="font-bold text-orange-900">+{formatCurrency(inflationAdjustment)}</span>
                    </div>
                  </div>
                  <div className="p-3 bg-orange-100 rounded-lg border border-orange-300">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-orange-900">Base Protegida</span>
                      <span className="font-bold text-orange-900">{formatCurrency(finalBaseAfterInflation)}</span>
                    </div>
                  </div>
                </>
              )}

              {/* Step 4: Markup */}
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-green-900">
                    {quotationData.inflation.applyInflationAdjustment && inflationAdjustment > 0 ? '4.' : '3.'} + Margen (100%)
                  </span>
                  <span className="font-bold text-green-900">+{formatCurrency(teamMarkupAmount)}</span>
                </div>
              </div>

              {/* Additional costs */}
              {platformCost > 0 && (
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-purple-900">+ Plataforma</span>
                    <span className="font-bold text-purple-900">+{formatCurrency(platformCost)}</span>
                  </div>
                </div>
              )}

              {deviationPercentage !== 0 && (
                <div className={`p-3 rounded-lg border ${
                  deviationPercentage > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className={`text-sm font-medium ${deviationPercentage > 0 ? 'text-red-900' : 'text-green-900'}`}>
                      Ajuste ({deviationPercentage > 0 ? '+' : ''}{deviationPercentage}%)
                    </span>
                    <span className={`font-bold ${deviationPercentage > 0 ? 'text-red-900' : 'text-green-900'}`}>
                      {deviationPercentage > 0 ? '+' : ''}{formatCurrency(deviationAmount)}
                    </span>
                  </div>
                </div>
              )}

              {discountPercentage > 0 && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-green-900">- Descuento ({discountPercentage}%)</span>
                    <span className="font-bold text-green-900">-{formatCurrency(discountAmount)}</span>
                  </div>
                </div>
              )}

              <Separator className="my-4" />

              {/* Final Total */}
              <div className="p-6 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl text-white text-center">
                <p className="text-xs text-indigo-100 mb-1">TOTAL FINAL PROYECTO</p>
                <p className="text-3xl font-bold mb-2">
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
                <div className="flex items-center justify-center gap-2 text-indigo-200 text-xs">
                  <span>{quotationData.inflation.quotationCurrency}</span>
                  <span>•</span>
                  <span>{quotationData.teamMembers.length} miembros</span>
                  {quotationData.inflation.applyInflationAdjustment && inflationAdjustment > 0 && (
                    <>
                      <span>•</span>
                      <span>Protegida</span>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Level 4: Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-8 border-t border-gray-200">
        <Button variant="outline" size="lg" className="px-8 shadow-sm">
          <FileText className="h-4 w-4 mr-2" />
          Exportar PDF
        </Button>
        <Button size="lg" className="bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 px-12 shadow-lg">
          <CheckCircle className="h-4 w-4 mr-2" />
          Guardar Cotización
        </Button>
      </div>
    </div>
  );
}
