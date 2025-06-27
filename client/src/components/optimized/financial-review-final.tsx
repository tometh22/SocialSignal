
import React, { useEffect, useState } from "react";
import { useOptimizedQuote } from "@/context/optimized-quote-context";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
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
  Shield,
  Loader2,
  Percent
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
    updateFinancials,
    saveQuotation
  } = useOptimizedQuote();
  const navigate = "";
  const toast = (props) => {console.log(props)};

  const [isSaving, setIsSaving] = useState(false);
  const [markupMultiplier, setMarkupMultiplier] = useState(2.0); // Default 2x markup
  const [discountPercentage, setDiscountPercentage] = useState(0); // Default 0% discount

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

  // Platform cost
  const platformCost = quotationData.financials.platformCost || 0;
  const subtotalWithPlatform = finalBaseAfterInflation + platformCost;

  // Apply dynamic markup multiplier
  const subtotalWithMargin = subtotalWithPlatform * markupMultiplier;
  const marginAmount = subtotalWithMargin - subtotalWithPlatform;

  // Apply dynamic discount
  const discountAmount = subtotalWithMargin * (discountPercentage / 100);
  const finalTotal = subtotalWithMargin - discountAmount;

  // Update totals
  React.useEffect(() => {
    updateFinancials({
      baseCost: teamBaseCost,
      totalCost: finalTotal,
      complexityAdjustment: teamComplexityAdjustment,
      markupAmount: marginAmount,
      inflationAdjustment,
    });
  }, [teamBaseCost, finalTotal, teamComplexityAdjustment, marginAmount, inflationAdjustment, updateFinancials]);

  const handleSaveQuotation = async () => {
    try {
      setIsSaving(true);
      console.log('💾 Guardando cotización...');

      // Usar la función de guardado del contexto
      await saveQuotation();

      toast({
        title: "Cotización guardada",
        description: "La cotización se ha guardado correctamente.",
      });

      navigate('/manage-quotes');
    } catch (error) {
      console.error("Error al guardar:", error);
      toast({
        title: "Error al guardar",
        description: "No se pudo guardar la cotización. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const formatFinalCurrency = (amount) => {
    if (quotationData.inflation.quotationCurrency === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } else {
      return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 p-4 lg:p-6">
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
              {formatFinalCurrency(finalTotal)}
            </p>
            <p className="text-xs text-gray-500">
              {quotationData.inflation.quotationCurrency} • {quotationData.client?.name}
            </p>
          </div>
        </div>
      </div>

      {/* Level 2: Executive Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
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
                <p className="text-xs font-medium text-green-800">Markup</p>
                <p className="text-lg font-bold text-green-900">{markupMultiplier}x</p>
                <p className="text-xs text-green-600">+{formatCurrency(marginAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Level 3: Main Content - Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">

        {/* Left: Team Breakdown */}
        <div className="space-y-4 lg:space-y-6">
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

        {/* Center: Controls and Inflation */}
        <div className="space-y-4 lg:space-y-6">
          {/* Margin and Discount Controls */}
          <Card className="shadow-sm border-0 bg-white">
            <CardHeader className="pb-4 border-b border-gray-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <Percent className="h-5 w-5 text-indigo-600" />
                Ajustes Financieros
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Markup Control */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-900">
                    Multiplicador de Markup
                  </Label>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    {markupMultiplier}x
                  </Badge>
                </div>
                <div className="space-y-3">
                  <Slider
                    value={[markupMultiplier]}
                    onValueChange={(value) => setMarkupMultiplier(value[0])}
                    min={1.0}
                    max={6.0}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>1.0x (Sin ganancia)</span>
                    <span>3.5x</span>
                    <span>6.0x</span>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-green-900">Ganancia Generada:</span>
                      <span className="text-lg font-bold text-green-900">+{formatCurrency(marginAmount)}</span>
                    </div>
                    <p className="text-xs text-green-700 mt-1">
                      Base: {formatCurrency(subtotalWithPlatform)} × {markupMultiplier} = {formatCurrency(subtotalWithMargin)}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Discount Control */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-900">
                    Descuento al Cliente
                  </Label>
                  <Badge variant="outline" className={discountPercentage > 0 
                    ? "bg-red-50 text-red-700 border-red-200" 
                    : "bg-gray-50 text-gray-700 border-gray-200"
                  }>
                    {discountPercentage}%
                  </Badge>
                </div>
                <div className="space-y-3">
                  <Slider
                    value={[discountPercentage]}
                    onValueChange={(value) => setDiscountPercentage(value[0])}
                    min={0}
                    max={50}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                  </div>
                  {discountPercentage > 0 && (
                    <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-red-900">Descuento Aplicado:</span>
                        <span className="text-lg font-bold text-red-900">-{formatCurrency(discountAmount)}</span>
                      </div>
                      <p className="text-xs text-red-700 mt-1">
                        Se aplica sobre: {formatCurrency(subtotalWithMargin)} (subtotal + margen)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inflation Card */}
          <Card className="shadow-sm border-0 bg-white">
            <CardHeader className="pb-4 border-b border-gray-100">
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-orange-600" />
                  Protección Inflacionaria
                </div>
                <Button
                  variant={quotationData.inflation.applyInflationAdjustment ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateInflation({ 
                    applyInflationAdjustment: !quotationData.inflation.applyInflationAdjustment 
                  })}
                  className={quotationData.inflation.applyInflationAdjustment 
                    ? "bg-orange-600 hover:bg-orange-700" 
                    : "border-orange-200 text-orange-600 hover:bg-orange-50"
                  }
                >
                  {quotationData.inflation.applyInflationAdjustment ? (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Activada
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 mr-2" />
                      Activar
                    </>
                  )}
                </Button>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4">
              {!quotationData.inflation.applyInflationAdjustment ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <Shield className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Sin Protección Inflacionaria
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    La cotización se mantiene en valores actuales sin proyección inflacionaria
                  </p>
                  <Button
                    onClick={() => updateInflation({ applyInflationAdjustment: true })}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Activar Protección
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                        <Zap className="h-5 w-5 text-orange-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-orange-900">Protección Activada</h3>
                        <p className="text-sm text-orange-700">
                          Cotización protegida contra inflación argentina
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                      {inflationAdjustment > 0 ? `+${formatCurrency(inflationAdjustment)}` : 'Configurando...'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-medium">Fecha de inicio del proyecto</Label>
                      <Input
                        type="date"
                        value={quotationData.inflation.projectStartDate}
                        onChange={(e) => updateInflation({ projectStartDate: e.target.value })}
                        min={new Date().toISOString().split('T')[0]}
                        className="border-orange-200 focus:border-orange-400"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="font-medium">Moneda de cotización</Label>
                      <Select 
                        value={quotationData.inflation.quotationCurrency} 
                        onValueChange={(value) => updateInflation({ quotationCurrency: value })}
                      >
                        <SelectTrigger className="border-orange-200 focus:border-orange-400">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ARS">Pesos Argentinos (ARS)</SelectItem>
                          <SelectItem value="USD">Dólares Estadounidenses (USD)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="font-medium">Método de cálculo</Label>
                      <Select 
                        value={quotationData.inflation.inflationMethod} 
                        onValueChange={(value) => updateInflation({ inflationMethod: value })}
                      >
                        <SelectTrigger className="border-orange-200 focus:border-orange-400">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="automatic">Automático (Promedio 12 meses)</SelectItem>
                          <SelectItem value="manual">Manual (Tasa personalizada)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {quotationData.inflation.inflationMethod === 'manual' && (
                      <div className="space-y-2">
                        <Label className="font-medium">Tasa inflación anual (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={quotationData.inflation.manualInflationRate || 0}
                          onChange={(e) => updateInflation({ manualInflationRate: Number(e.target.value) })}
                          placeholder="Ej: 25.5"
                          className="border-orange-200 focus:border-orange-400"
                        />
                      </div>
                    )}
                  </div>

                  {quotationData.inflation.projectStartDate && inflationAdjustment > 0 && (
                    <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-green-900">Impacto Proyectado:</span>
                        <span className="text-lg font-bold text-green-900">
                          +{formatCurrency(inflationAdjustment)}
                        </span>
                      </div>
                      <p className="text-sm text-green-700">
                        Proyección desde {new Date().toLocaleDateString('es-AR')} hasta{' '}
                        {new Date(quotationData.inflation.projectStartDate).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                  )}

                  <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-yellow-800">
                      Las proyecciones son estimativas basadas en datos históricos
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Financial Waterfall */}
        <div className="space-y-4 lg:space-y-6">
          <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-emerald-50/30 h-fit">
            <CardHeader className="pb-4 border-b border-emerald-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-emerald-600" />
                Desglose Financiero
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">

              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-blue-900">1. Costo Base Equipo</span>
                  <span className="font-bold text-blue-900">{formatCurrency(teamBaseCost)}</span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-amber-900">2. + Complejidad ({getComplexityPercentage()}%)</span>
                  <span className="font-bold text-amber-900">+{formatCurrency(teamComplexityAdjustment)}</span>
                </div>
              </div>

              <div className="p-3 bg-gray-100 rounded-lg border border-gray-300">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-900">Subtotal (Base + Complejidad)</span>
                  <span className="font-bold text-gray-900">{formatCurrency(subtotalWithComplexity)}</span>
                </div>
              </div>

              {quotationData.inflation.applyInflationAdjustment && inflationAdjustment > 0 && (
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-orange-900">3. + Protección Inflacionaria</span>
                    <span className="font-bold text-orange-900">+{formatCurrency(inflationAdjustment)}</span>
                  </div>
                </div>
              )}

              {platformCost > 0 && (
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-purple-900">4. + Costos de Plataforma</span>
                    <span className="font-bold text-purple-900">+{formatCurrency(platformCost)}</span>
                  </div>
                </div>
              )}

              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-green-900">5. + Margen ({markupMultiplier}x)</span>
                  <span className="font-bold text-green-900">+{formatCurrency(marginAmount)}</span>
                </div>
              </div>

              <div className="p-3 bg-gray-100 rounded-lg border border-gray-300">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-900">Subtotal con Margen</span>
                  <span className="font-bold text-gray-900">{formatCurrency(subtotalWithMargin)}</span>
                </div>
              </div>

              {discountPercentage > 0 && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-red-900">6. - Descuento ({discountPercentage}%)</span>
                    <span className="font-bold text-red-900">-{formatCurrency(discountAmount)}</span>
                  </div>
                </div>
              )}

              <Separator className="my-4" />

              <div className="p-4 bg-gradient-to-r from-emerald-100 to-green-100 rounded-xl border-2 border-emerald-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-emerald-700" />
                    <span className="text-lg font-bold text-emerald-900">TOTAL FINAL PROYECTO</span>
                  </div>
                  <span className="text-2xl font-bold text-emerald-900">
                    {formatFinalCurrency(finalTotal)}
                  </span>
                </div>
                <p className="text-sm text-emerald-700 mt-1">
                  {quotationData.inflation.quotationCurrency} • 6 miembros • {quotationData.client?.name}
                </p>
              </div>

            </CardContent>
          </Card>

          <div className="flex justify-center">
            <Button 
              onClick={handleSaveQuotation}
              disabled={isSaving}
              size="lg"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Guardando cotización...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-5 w-5" />
                  TOTAL FINAL PROYECTO
                  <br />
                  ${finalTotal.toFixed(2)}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
