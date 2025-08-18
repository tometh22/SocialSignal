import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useOptimizedQuote } from "@/context/optimized-quote-context";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/use-currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { InflationAdjustmentCard } from "@/components/optimized/inflation-adjustment-card";
import ToolsAndPricing from "@/components/optimized/tools-and-pricing";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  Save,
  Zap,
  Shield,
  Loader2,
  Percent,
  HelpCircle,
  AlertCircle,
  Edit
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
    updateQuotationCurrency,
    saveQuotation,
    getPersonnelRate
  } = useOptimizedQuote();

  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [markupMultiplier, setMarkupMultiplier] = useState(quotationData.financials?.marginFactor || 2.0); // Use saved markup or default 2x
  const [discountPercentage, setDiscountPercentage] = useState(quotationData.financials?.discountPercentage || 0); // Use saved discount or default 0%

  // Obtenemos datos de inflación y tipo de cambio
  const { data: inflationData = [] } = useQuery({
    queryKey: ['/api/inflation/data'],
    staleTime: 1000 * 60 * 5
  });

  const { data: systemConfig = [] } = useQuery({
    queryKey: ['/api/admin/system-config'],
    staleTime: 1000 * 60 * 5
  });

  // Obtener el tipo de cambio desde la configuración del sistema
  const exchangeRateConfig = (systemConfig as any[]).find((config: any) => config.configKey === 'usd_exchange_rate');
  const currentExchangeRate = exchangeRateConfig?.configValue || 1200;

  // Obtener datos de tipos de cambio para obtener el más reciente
  const { data: exchangeRatesData = [] } = useQuery({
    queryKey: ['/api/exchange-rates', { year: 2025 }],
    queryFn: async () => {
      const response = await fetch('/api/exchange-rates?year=2025');
      if (!response.ok) throw new Error('Failed to fetch exchange rates');
      return response.json();
    },
    staleTime: 1000 * 60 * 5
  });

  // Obtener el tipo de cambio más reciente de la configuración histórica
  const latestExchangeRate = exchangeRatesData.length > 0
    ? exchangeRatesData[0].exchangeRate
    : currentExchangeRate;

  // Force recalculation when component mounts or data changes
  useEffect(() => {
    if (quotationData.teamMembers.length > 0) {
      forceRecalculate();
    }
  }, [quotationData.teamMembers, forceRecalculate]);

  // Update markup and discount when quotation data changes
  useEffect(() => {
    if (quotationData.financials?.marginFactor) {
      setMarkupMultiplier(quotationData.financials.marginFactor);
    }
    if (quotationData.financials?.discountPercentage !== undefined) {
      setDiscountPercentage(quotationData.financials.discountPercentage);
    }
  }, [quotationData.financials?.marginFactor, quotationData.financials?.discountPercentage]);

  // Helper function to format currency in ARS
  const formatFinalCurrency = (amount: number) =>
    `ARS ${amount.toLocaleString('es-AR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })}`;

  // Helper function to get role name
  const getRoleName = (roleId: number) => {
    const role = availableRoles.find((r) => r.id === roleId);
    return role ? role.name : `Rol #${roleId}`;
  };

  // Helper function to get personnel name
  const getPersonnelName = (personnelId: number) => {
    const person = availablePersonnel.find((p) => p.id === personnelId);
    return person ? person.name : `Personal #${personnelId}`;
  };

  const calculateTeamBaseCost = () => {
    let cost = 0;
    quotationData.teamMembers.forEach(member => {
      // Calculate cost directly from hours and rate in ARS
      const memberHours = Number(member.hours) || 0;
      let memberRate = Number(member.rate) || 0;

      // If we have personnelId, get the rate in ARS
      if (member.personnelId) {
        memberRate = getPersonnelRate(member.personnelId);
      }

      const memberCost = memberHours * memberRate;
      cost += memberCost;
      console.log('💰 Team member:', member.id, 'hours:', memberHours, 'rate:', memberRate, 'cost:', memberCost);
    });
    console.log('💰 Total team base cost calculated:', cost);
    console.log('💰 baseCost from context:', baseCost);
    return cost;
  };

  const calculateComplexityAdjustment = (teamBaseCost: number) => {
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

  // Calculate base values in ARS
  const teamBaseCostARS = calculateTeamBaseCost();
  console.log('🔍 Financial Review - baseCost from context:', baseCost);
  console.log('🔍 Financial Review - teamBaseCost calculated:', teamBaseCostARS);
  console.log('🔍 Financial Review - teamMembers:', quotationData.teamMembers);

  const teamComplexityAdjustmentARS = calculateComplexityAdjustment(teamBaseCostARS);
  const subtotalWithComplexityARS = teamBaseCostARS + teamComplexityAdjustmentARS;

  // Calculate inflation if applicable - in ARS
  const baseForInflation = subtotalWithComplexityARS;
  let inflationAdjustmentARS = 0;
  let inflationProjectedCostARS = baseForInflation;
  let monthlyInflationRate = 0;
  let totalInflationPercentage = 0;
  let monthsToProject = 0;

  if (quotationData.inflation.applyInflationAdjustment && quotationData.inflation.projectStartDate) {
    const startDate = new Date(quotationData.inflation.projectStartDate);
    const currentDate = new Date();
    monthsToProject = (startDate.getFullYear() - currentDate.getFullYear()) * 12 +
      (startDate.getMonth() - currentDate.getMonth());

    if (monthsToProject > 0) {
      // Get annual inflation rate
      let annualInflationRate;
      if (quotationData.inflation.inflationMethod === 'manual') {
        annualInflationRate = quotationData.inflation.manualInflationRate || 25;
      } else {
        annualInflationRate = 25; // Default automatic
      }

      // Calculate monthly compound rate: (1 + annual_rate)^(1/12) - 1
      const monthlyRateDecimal = Math.pow(1 + (annualInflationRate / 100), 1 / 12) - 1;
      monthlyInflationRate = monthlyRateDecimal * 100;

      // Compound inflation factor for N months
      const inflationFactor = Math.pow(1 + monthlyRateDecimal, monthsToProject);
      totalInflationPercentage = (inflationFactor - 1) * 100;

      // Apply inflation directly to base cost in ARS
      inflationProjectedCostARS = baseForInflation * inflationFactor;
      inflationAdjustmentARS = inflationProjectedCostARS - baseForInflation;

      console.log('🏦 Inflation calculation in ARS:');
      console.log('💰 Base:', baseForInflation, 'ARS');
      console.log('📊 Inflation factor:', inflationFactor.toFixed(4));
      console.log('💰 Projected:', inflationProjectedCostARS.toFixed(2), 'ARS');
      console.log('💰 Adjustment:', inflationAdjustmentARS.toFixed(2), 'ARS');
    }
  }

  // Calculate final base after inflation (if any)
  let finalBaseAfterInflationARS = inflationProjectedCostARS;

  // If inflation wasn't applied, use the original subtotal
  if (!quotationData.inflation.applyInflationAdjustment) {
    finalBaseAfterInflationARS = subtotalWithComplexityARS;
  }

  // Platform cost in ARS (tools will be added AFTER markup)
  const platformCostARS = quotationData.financials.platformCost || 0;
  const toolsCostUSD = quotationData.financials.toolsCost || 0;
  const toolsCostARS = toolsCostUSD * latestExchangeRate;

  const subtotalWithPlatformARS = finalBaseAfterInflationARS + platformCostARS;

  // Check if we're in manual pricing mode
  let finalTotalARS, marginAmountARS, discountAmountARS, subtotalWithMarginARS, subtotalWithPlatformAndToolsARS;
  let subtotalWithPlatformUSD = 0; // Placeholder, will be calculated if needed
  let subtotalWithMarginUSD = 0; // Placeholder, will be calculated if needed
  let inflationAdjustmentUSD = 0; // Placeholder, will be calculated if needed

  // If the quotation currency is USD, we need to calculate the equivalent values in USD
  if (quotationData.quotationCurrency === 'USD') {
    subtotalWithPlatformUSD = (finalBaseAfterInflationARS + platformCostARS) / latestExchangeRate;
    subtotalWithMarginUSD = (subtotalWithPlatformARS * markupMultiplier) / latestExchangeRate;
    inflationAdjustmentUSD = (quotationData.inflation.applyInflationAdjustment && inflationAdjustmentARS > 0)
      ? inflationAdjustmentARS / latestExchangeRate
      : 0;
  }

  if (quotationData.financials.priceMode === 'manual' && quotationData.financials.manualPrice) {
    // Manual pricing mode - work backwards from final price
    // The manual price is the final price AFTER discount and tools
    finalTotalARS = quotationData.financials.manualPrice; // Assuming manualPrice is in ARS if currency is ARS, or USD if currency is USD
    if (quotationData.quotationCurrency === 'USD') {
      finalTotalARS = finalTotalARS * latestExchangeRate; // Convert to ARS for consistency in internal calculations
    }

    // Calculate subtotal before discount: final / (1 - discount_rate)
    subtotalWithMarginARS = finalTotalARS / (1 - (discountPercentage / 100));
    discountAmountARS = subtotalWithMarginARS - finalTotalARS;
    marginAmountARS = subtotalWithMarginARS - subtotalWithPlatformARS;
    // Add tools back at the end
    subtotalWithPlatformAndToolsARS = subtotalWithMarginARS + toolsCostARS;

  } else {
    // Automatic pricing mode - work forwards from costs
    // Apply markup BEFORE adding tools
    subtotalWithMarginARS = subtotalWithPlatformARS * markupMultiplier;
    marginAmountARS = subtotalWithMarginARS - subtotalWithPlatformARS;
    // Add tools AFTER markup
    subtotalWithPlatformAndToolsARS = subtotalWithMarginARS + toolsCostARS;
    discountAmountARS = subtotalWithPlatformAndToolsARS * (discountPercentage / 100);
    finalTotalARS = subtotalWithPlatformAndToolsARS - discountAmountARS;
  }

  // All values are already in ARS - no conversion needed
  const teamBaseCostDisplay = teamBaseCostARS;
  const teamComplexityAdjustmentDisplay = teamComplexityAdjustmentARS;
  const subtotalWithComplexityDisplay = teamBaseCostDisplay + teamComplexityAdjustmentDisplay;
  const platformCostDisplay = platformCostARS;
  // const toolsCostDisplay = toolsCostARS; // Already calculated
  const finalBaseAfterInflationDisplay = finalBaseAfterInflationARS;
  const subtotalWithPlatformDisplay = subtotalWithPlatformARS;
  const subtotalWithPlatformAndToolsDisplay = subtotalWithPlatformAndToolsARS;
  const subtotalWithMarginDisplay = subtotalWithMarginARS;
  const marginAmountDisplay = marginAmountARS;
  const discountAmountDisplay = discountAmountARS;
  const finalTotalDisplay = finalTotalARS;
  const inflationAdjustmentDisplay = inflationAdjustmentARS;

  // Update discount percentage when it changes
  React.useEffect(() => {
    console.log('💰 Updating financials with markup:', markupMultiplier, 'discount:', discountPercentage);
    updateFinancials({
      discountPercentage: discountPercentage,
      marginFactor: markupMultiplier,
    });
  }, [discountPercentage, markupMultiplier, updateFinancials]);

  const handleSaveQuotation = async () => {
    try {
      setIsSaving(true);
      console.log('💾 Guardando cotización...');

      // Validaciones básicas antes de guardar
      if (!quotationData.client) {
        toast({
          title: "Cliente requerido",
          description: "Debe seleccionar un cliente antes de guardar.",
          variant: "destructive",
        });
        return;
      }

      if (!quotationData.project.name?.trim()) {
        toast({
          title: "Nombre de proyecto requerido",
          description: "Debe ingresar el nombre del proyecto antes de guardar.",
          variant: "destructive",
        });
        return;
      }



      // Usar la función de guardado del contexto con estado 'pending'
      await saveQuotation('pending');

      toast({
        title: "Cotización guardada",
        description: "La cotización se ha guardado correctamente.",
      });

      navigate('/manage-quotes');
    } catch (error) {
      console.error("Error al guardar:", error);
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      toast({
        title: "Error al guardar",
        description: `No se pudo guardar la cotización: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Función para guardar como borrador
  const handleSaveDraft = async () => {
    try {
      setIsSavingDraft(true);
      console.log('💾 Guardando borrador...');
      console.log('🔍 Current quotationData:', quotationData);
      console.log('👥 Team members to save:', quotationData.teamMembers);
      console.log('📊 Team members count:', quotationData.teamMembers?.length || 0);

      // Validaciones mínimas para borrador
      if (!quotationData.client) {
        toast({
          title: "Cliente requerido",
          description: "Debe seleccionar un cliente antes de guardar el borrador.",
          variant: "destructive",
        });
        return;
      }

      if (!quotationData.project.name?.trim()) {
        toast({
          title: "Nombre de proyecto requerido",
          description: "Debe ingresar el nombre del proyecto antes de guardar el borrador.",
          variant: "destructive",
        });
        return;
      }

      // Usar la función de guardado del contexto como borrador
      await saveQuotation('draft');

      toast({
        title: "Borrador guardado",
        description: "El borrador se ha guardado correctamente. Puedes continuar editándolo más tarde.",
      });

    } catch (error) {
      console.error("❌ Error al guardar borrador:", error);
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";

      // Verificar si es un error de sesión
      if (errorMessage.includes('No autenticado') || errorMessage.includes('401')) {
        toast({
          title: "Sesión expirada",
          description: "Tu sesión ha expirado. Por favor, inicia sesión nuevamente.",
          variant: "destructive",
        });
        navigate('/auth');
        return;
      }

      // Verificar si es un error de cotización no encontrada
      if (errorMessage.includes('not found') || errorMessage.includes('404')) {
        toast({
          title: "Error al guardar borrador",
          description: "La cotización no fue encontrada. Se creará una nueva cotización.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Error al guardar borrador",
        description: `No se pudo guardar el borrador: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Función para finalizar cotización
  const handleFinalizeQuotation = async () => {
    try {
      setIsFinalizing(true);
      console.log('✅ Finalizando cotización...');
      console.log('🔍 Current quotationData:', quotationData);

      // Validaciones completas para finalización
      if (!quotationData.client) {
        toast({
          title: "Cliente requerido",
          description: "Debe seleccionar un cliente antes de finalizar.",
          variant: "destructive",
        });
        return;
      }

      if (!quotationData.project.name?.trim()) {
        toast({
          title: "Nombre de proyecto requerido",
          description: "Debe ingresar el nombre del proyecto antes de finalizar.",
          variant: "destructive",
        });
        return;
      }

      if (quotationData.teamMembers.length === 0) {
        toast({
          title: "Equipo requerido",
          description: "Debe agregar al menos un miembro al equipo antes de finalizar.",
          variant: "destructive",
        });
        return;
      }

      // Usar la función de guardado del contexto como cotización finalizada
      await saveQuotation('pending');

      toast({
        title: "Cotización finalizada",
        description: "La cotización ha sido finalizada y está lista para el cliente.",
      });

      navigate('/manage-quotes');
    } catch (error) {
      console.error("❌ Error al finalizar cotización:", error);
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";

      // Verificar si es un error de sesión
      if (errorMessage.includes('No autenticado') || errorMessage.includes('401')) {
        toast({
          title: "Sesión expirada",
          description: "Tu sesión ha expirado. Por favor, inicia sesión nuevamente.",
          variant: "destructive",
        });
        navigate('/auth');
        return;
      }

      // Verificar si es un error de cotización no encontrada
      if (errorMessage.includes('not found') || errorMessage.includes('404')) {
        toast({
          title: "Error al finalizar",
          description: "La cotización no fue encontrada. Se creará una nueva cotización.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Error al finalizar",
        description: `No se pudo finalizar la cotización: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsFinalizing(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
        {/* Modern Sticky Header */}
        <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 lg:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  onClick={() => navigate("/quotations")}
                  className="hover:bg-gray-100"
                  size="sm"
                >
                  ← Volver
                </Button>
                <div className="h-6 w-px bg-gray-300" />
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-gray-900">Editar Cotización</h1>
                    <p className="text-xs text-gray-500">
                      Crea y gestiona cotizaciones de manera optimizada
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft}
                  className="border-gray-200 hover:bg-gray-50"
                  size="sm"
                >
                  {isSavingDraft ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Guardar
                </Button>
                <Button
                  onClick={handleFinalizeQuotation}
                  disabled={isFinalizing}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                  size="sm"
                >
                  {isFinalizing ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-1" />
                  )}
                  Finalizar Cotización
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8">
          {/* Executive Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Tooltip>
              <TooltipTrigger asChild>
                <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100 cursor-help">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-200 flex items-center justify-center">
                        <Users className="h-4 w-4 text-blue-700" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-blue-800">Equipo</p>
                        <p className="text-lg font-bold text-blue-900">{quotationData.teamMembers.length} miembros</p>
                        <p className="text-xs text-blue-600">{formatFinalCurrency(teamBaseCostDisplay)} base</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">Costo base del equipo sin ajustes por complejidad o markup. Este es el costo directo de las horas de trabajo.</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100 cursor-help">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-200 flex items-center justify-center">
                        <Target className="h-4 w-4 text-amber-700" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-amber-800">Complejidad</p>
                        <p className="text-lg font-bold text-amber-900">+{getComplexityPercentage()}%</p>
                        <p className="text-xs text-amber-600">+{formatFinalCurrency(teamComplexityAdjustmentDisplay)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">Ajuste por complejidad del proyecto basado en tipo de análisis, volumen de menciones, países cubiertos y compromiso del cliente.</p>
              </TooltipContent>
            </Tooltip>

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
                      {inflationAdjustmentARS > 0 ? `+${formatFinalCurrency(inflationAdjustmentDisplay)}` : 'N/A'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Tooltip>
              <TooltipTrigger asChild>
                <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-green-100 cursor-help">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-green-200 flex items-center justify-center">
                        <TrendingUp className="h-4 w-4 text-green-700" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-green-800">Markup</p>
                        <p className="text-lg font-bold text-green-900">
                          {quotationData.financials.priceMode === 'manual' && quotationData.financials.manualPrice
                            ? `${((subtotalWithMarginUSD / subtotalWithPlatformUSD) || 1).toFixed(1)}x`
                            : `${markupMultiplier.toFixed(1)}x`}
                        </p>
                        <p className="text-xs text-green-600">+{formatFinalCurrency(marginAmountDisplay)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">Multiplicador de ganancia aplicado al costo base. El markup {markupMultiplier}x significa que el precio es {markupMultiplier} veces el costo.</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Main Content - Responsive Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">

            {/* Left: Team Breakdown */}
            <div className="space-y-4 lg:space-y-6">
              {/* Team Composition - Collapsible */}
              <Collapsible defaultOpen={true}>
                <Card className="shadow-sm border-0 bg-white overflow-hidden">
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="pb-4 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Users className="h-5 w-5 text-blue-600" />
                          Composición del Equipo
                          <Badge variant="secondary" className="ml-2">
                            {quotationData.teamMembers.length} miembros
                          </Badge>
                        </CardTitle>
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
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
                                    {member.hours}h × ${(member.personnelId
                                      ? getPersonnelRate(member.personnelId)
                                      : member.rate
                                    ).toFixed(1)}/h
                                  </p>
                                </div>
                              </div>
                              <span className="text-sm font-bold text-gray-900">
                                {formatFinalCurrency(
                                  member.hours * (member.personnelId
                                    ? getPersonnelRate(member.personnelId)
                                    : member.rate
                                  )
                                )}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="p-4 bg-blue-50 border-t border-blue-100">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-blue-900">Subtotal Base</span>
                          <span className="text-lg font-bold text-blue-900">{formatFinalCurrency(teamBaseCostDisplay)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* Complexity Factors - Collapsible */}
              <Collapsible defaultOpen={false}>
                <Card className="shadow-sm border-0 bg-white overflow-hidden">
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="pb-4 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Calculator className="h-5 w-5 text-amber-600" />
                          Factores de Complejidad
                          <Badge variant="outline" className="ml-auto text-amber-700 border-amber-200">
                            +{getComplexityPercentage()}%
                          </Badge>
                        </CardTitle>
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
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
                        <span className="text-lg font-bold text-amber-900">+{formatFinalCurrency(teamComplexityAdjustmentDisplay)}</span>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
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
                        {quotationData.financials.priceMode === 'manual' && quotationData.financials.manualPrice
                          ? "Markup Calculado (Automático)"
                          : "Multiplicador de Markup"}
                      </Label>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        {quotationData.financials.priceMode === 'manual' && quotationData.financials.manualPrice
                          ? `${((subtotalWithMarginUSD / subtotalWithPlatformUSD) || 1).toFixed(2)}x`
                          : `${markupMultiplier}x`}
                      </Badge>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        {(() => {
                          const isManualMode = quotationData.financials.priceMode === 'manual' && Boolean(quotationData.financials.manualPrice);
                          const currentMarkup = isManualMode
                            ? (subtotalWithMarginUSD / subtotalWithPlatformUSD) || 1
                            : markupMultiplier;

                          return (
                            <>
                              <div className="flex-1">
                                <Slider
                                  value={[currentMarkup]}
                                  onValueChange={(value) => {
                                    setMarkupMultiplier(value[0]);
                                    updateFinancials({ marginFactor: value[0] });
                                  }}
                                  min={1.0}
                                  max={6.0}
                                  step={0.1}
                                  className="w-full"
                                  disabled={isManualMode}
                                />
                              </div>
                              <div className="w-24">
                                <Input
                                  type="number"
                                  value={currentMarkup.toFixed(1)}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value);
                                    if (!isNaN(value) && value >= 1.0 && value <= 6.0) {
                                      setMarkupMultiplier(value);
                                      updateFinancials({ marginFactor: value });
                                    }
                                  }}
                                  min="1.0"
                                  max="6.0"
                                  step="0.1"
                                  disabled={isManualMode}
                                  className="text-center font-mono text-sm"
                                  placeholder="2.0"
                                />
                              </div>
                              <span className="text-sm font-medium text-gray-600">x</span>
                            </>
                          );
                        })()}
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>1.0x (Sin ganancia)</span>
                        <span>3.5x</span>
                        <span>6.0x</span>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-green-900">Ganancia Generada:</span>
                          <span className="text-lg font-bold text-green-900">+{formatFinalCurrency(marginAmountDisplay)}</span>
                        </div>
                        <p className="text-xs text-green-700 mt-1">
                          {quotationData.financials.priceMode === 'manual' && quotationData.financials.manualPrice ? (
                            `Markup calculado: ${((subtotalWithMarginUSD / subtotalWithPlatformUSD) || 1).toFixed(2)}x (${formatFinalCurrency(subtotalWithPlatformDisplay)} → ${formatFinalCurrency(subtotalWithMarginDisplay)})`
                          ) : (
                            `Base: ${formatFinalCurrency(subtotalWithPlatformDisplay)} × ${markupMultiplier} = ${formatFinalCurrency(subtotalWithMarginDisplay)}`
                          )}
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
                        onValueChange={(value) => {
                          setDiscountPercentage(value[0]);
                          updateFinancials({ discountPercentage: value[0] });
                        }}
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
                            <span className="text-lg font-bold text-red-900">-{formatFinalCurrency(discountAmountDisplay)}</span>
                          </div>
                          <p className="text-xs text-red-700 mt-1">
                            Se aplica sobre: {formatFinalCurrency(subtotalWithMarginDisplay)} (subtotal + margen)
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Tools Cost Section */}
                    <Separator className="my-4" />
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="toolsCost" className="text-sm font-medium">
                          Costos de Herramientas (USD)
                        </Label>
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">
                        Costos adicionales de software, licencias o herramientas específicas
                        <br />
                        <span className="font-medium text-blue-600">
                          Tipo de cambio: ARS {latestExchangeRate.toLocaleString('es-AR')}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <Input
                          id="toolsCost"
                          type="number"
                          min="0"
                          step="1"
                          value={quotationData.financials.toolsCost || 0}
                          onChange={(e) => updateFinancials({ toolsCost: parseFloat(e.target.value) || 0 })}
                          className="text-right"
                          placeholder="0"
                        />
                        {toolsCostUSD > 0 && (
                          <div className="text-xs text-muted-foreground text-right">
                            ≈ ARS {toolsCostARS.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Price Mode Section */}
                    <Separator className="my-4" />
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <Calculator className="h-4 w-4" />
                        Modo de Cálculo de Precio
                      </Label>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant={quotationData.financials.priceMode === 'auto' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            updateFinancials({ priceMode: 'auto' });
                            // Limpiar precio manual al cambiar a automático
                            updateFinancials({ manualPrice: undefined });
                          }}
                          className="flex-1"
                        >
                          <Zap className="h-4 w-4 mr-1" />
                          Automático
                        </Button>
                        <Button
                          variant={quotationData.financials.priceMode === 'manual' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            updateFinancials({ priceMode: 'manual' });
                            // Si no hay precio manual, usar el precio actual como punto de partida
                            if (!quotationData.financials.manualPrice) {
                              updateFinancials({ manualPrice: finalTotalARS });
                            }
                          }}
                          className="flex-1"
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          Manual
                        </Button>
                      </div>

                      {quotationData.financials.priceMode === 'manual' && (
                        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between mb-1">
                                <Label className="text-sm font-medium text-blue-900">
                                  Precio objetivo (USD)
                                </Label>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="h-4 w-4 text-blue-400 cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-xs">
                                    <p>Ingrese el precio que desea cobrar al cliente. El sistema calculará automáticamente el markup necesario.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-blue-500" />
                                <Input
                                  type="number"
                                  placeholder="0.00"
                                  value={quotationData.financials.manualPrice || ''}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value);
                                    updateFinancials({ manualPrice: isNaN(value) ? 0 : value });
                                  }}
                                  className="text-right font-mono text-xl pl-10 pr-3 h-12 border-blue-200 focus:border-blue-400 bg-blue-50/50"
                                  min="0"
                                  step="0.01"
                                />
                              </div>
                            </div>

                            {/* Métricas calculadas */}
                            <div className="grid grid-cols-3 gap-2">
                              <div className="bg-gray-50 rounded-lg p-2 text-center">
                                <p className="text-xs text-gray-600">Costo Base</p>
                                <p className="font-mono text-sm font-semibold text-gray-900">
                                  ${(subtotalWithPlatformUSD + toolsCostUSD).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </p>
                              </div>
                              <div className="bg-blue-50 rounded-lg p-2 text-center">
                                <p className="text-xs text-blue-600">Markup</p>
                                <p className="font-mono text-sm font-semibold text-blue-900">
                                  {quotationData.financials.manualPrice
                                    ? `${(((quotationData.financials.manualPrice - toolsCostUSD) / (1 - (discountPercentage / 100))) / subtotalWithPlatformUSD).toFixed(2)}x`
                                    : '0.00x'}
                                </p>
                              </div>
                              <div className="bg-green-50 rounded-lg p-2 text-center">
                                <p className="text-xs text-green-600">Ganancia</p>
                                <p className="font-mono text-sm font-semibold text-green-900">
                                  ${quotationData.financials.manualPrice
                                    ? Math.max(0, quotationData.financials.manualPrice - (subtotalWithPlatformUSD + toolsCostUSD)).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                                    : '0'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  </CardContent>
                </Card>
              </div>
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
                          {inflationAdjustmentUSD > 0 ? `+${formatCurrency(inflationAdjustmentDisplay)}` : 'Configurando...'}
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
                            value={quotationData.quotationCurrency}
                            onValueChange={(value) => {
                              console.log('💱 Currency selector changed to:', value);
                              updateQuotationCurrency(value);
                            }}
                          >
                            <SelectTrigger className="border-orange-200 focus:border-orange-400">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ARS">Pesos Argentinos (ARS)</SelectItem>
                              <SelectItem value="USD">Dólares Estadounidenses (USD)</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="text-xs text-orange-600 mt-1">
                            Tipo de cambio: 1 USD = ${latestExchangeRate.toLocaleString()} ARS
                          </div>
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

                      {quotationData.inflation.projectStartDate && inflationAdjustmentUSD > 0 && (
                        <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-green-900">Impacto Proyectado:</span>
                            <span className="text-lg font-bold text-green-900">
                              +{formatFinalCurrency(inflationAdjustmentDisplay)}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                            <div className="space-y-1">
                              <p className="text-green-700">
                                <strong>Período:</strong> {monthsToProject} meses
                              </p>
                              <p className="text-green-700">
                                <strong>Tasa mensual:</strong> {monthlyInflationRate.toFixed(4)}%
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-green-700">
                                <strong>Inflación total:</strong> {totalInflationPercentage.toFixed(2)}%
                              </p>
                              <p className="text-green-700">
                                <strong>Moneda:</strong> {quotationData.quotationCurrency}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm text-green-700 mt-2 pt-2 border-t border-green-200">
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
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-emerald-600" />
                      Resumen de Cálculo
                    </CardTitle>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs">
                        <p>Este desglose muestra cómo se calcula el precio final paso a paso, desde el costo base hasta el precio final al cliente.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-2">

                  {/* Sección 1: Costo Base */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs">1</div>
                      Costo Base
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-blue-800">Equipo</span>
                        <span className="font-semibold text-blue-900">{formatFinalCurrency(teamBaseCostDisplay)}</span>
                      </div>
                      {teamComplexityAdjustmentDisplay > 0 && (
                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-blue-100">
                          <span className="text-sm text-blue-800">+ Complejidad ({getComplexityPercentage()}%)</span>
                          <span className="font-semibold text-blue-900">+{formatFinalCurrency(teamComplexityAdjustmentDisplay)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sección 2: Ajustes */}
                  {(quotationData.inflation.applyInflationAdjustment && inflationAdjustmentARS > 0) || platformCostARS > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 text-xs">2</div>
                        Ajustes
                      </div>
                      <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
                        {quotationData.inflation.applyInflationAdjustment && inflationAdjustmentARS > 0 && (
                          <div className="flex justify-between items-center">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-sm text-orange-800">Protección Inflacionaria</span>
                              <span className="text-xs text-orange-600">
                                {totalInflationPercentage.toFixed(2)}% en {monthsToProject} meses
                              </span>
                            </div>
                            <span className="font-semibold text-orange-900">+{formatFinalCurrency(inflationAdjustmentDisplay)}</span>
                          </div>
                        )}
                        {platformCostARS > 0 && (
                          <div className={`flex justify-between items-center ${quotationData.inflation.applyInflationAdjustment && inflationAdjustmentARS > 0 ? 'mt-2 pt-2 border-t border-orange-100' : ''}`}>
                            <span className="text-sm text-orange-800">Costos de Plataforma</span>
                            <span className="font-semibold text-orange-900">+{formatFinalCurrency(platformCostARS)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {/* Sección 3: Margen y Herramientas */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-xs">3</div>
                      Precio de Venta
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                      <div className="flex justify-between items-center">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm text-green-800">Margen de Ganancia</span>
                          <span className="text-xs text-green-600">
                            Markup {quotationData.financials.priceMode === 'manual' && quotationData.financials.manualPrice
                              ? `${((subtotalWithMarginUSD / subtotalWithPlatformUSD) || 1).toFixed(2)}x calc.`
                              : `${markupMultiplier}x`}
                          </span>
                        </div>
                        <span className="font-semibold text-green-900">+{formatFinalCurrency(marginAmountDisplay)}</span>
                      </div>
                      {toolsCostARS > 0 && (
                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-green-100">
                          <div className="flex flex-col">
                            <span className="text-sm text-green-800">Costos de Herramientas</span>
                            <span className="text-xs text-green-600">
                              USD {toolsCostUSD.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} × {latestExchangeRate.toLocaleString('es-AR')}
                            </span>
                          </div>
                          <span className="font-semibold text-green-800">
                            +ARS {toolsCostARS.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sección 4: Descuento (si aplica) */}
                  {discountPercentage > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-red-700 text-xs">4</div>
                        Descuento
                      </div>
                      <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-red-800">Descuento ({discountPercentage}%)</span>
                          <span className="font-semibold text-red-900">-{formatFinalCurrency(discountAmountDisplay)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Separador visual */}
                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200"></div>
                    </div>
                  </div>

                  {/* Total Final */}
                  <div className="p-4 bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border-2 border-emerald-200 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-700" />
                        <span className="text-lg font-bold text-emerald-900">Resumen Final</span>
                      </div>
                      <span className="text-2xl font-bold text-emerald-900">
                        {formatFinalCurrency(finalTotalDisplay)}
                      </span>
                    </div>
                    <p className="text-sm text-emerald-700 mt-1">
                      {quotationData.quotationCurrency} • {quotationData.teamMembers.length} miembros • {quotationData.client?.name}
                    </p>
                  </div>

                </CardContent>
              </Card>

              <div className="flex flex-col gap-3">
                {/* Botón Guardar Borrador */}
                <Button
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft || !quotationData.client || !quotationData.project.name?.trim()}
                  size="lg"
                  variant="outline"
                  className="w-full border-2 border-gray-300 hover:border-gray-400 text-gray-700 font-semibold py-3 px-8 rounded-xl transition-all"
                >
                  {isSavingDraft ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Guardando borrador...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-5 w-5" />
                      Guardar Borrador
                    </>
                  )}
                </Button>

                {/* Botón Finalizar Cotización */}
                <Button
                  onClick={handleFinalizeQuotation}
                  disabled={isFinalizing}
                  size="lg"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all"
                >
                  {isFinalizing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Finalizando cotización...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-5 w-5" />
                      Finalizar Cotización
                      <div className="text-sm opacity-90">
                        {formatFinalCurrency(finalTotalDisplay)}
                      </div>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}