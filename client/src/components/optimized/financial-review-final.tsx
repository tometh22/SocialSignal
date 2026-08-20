
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
import { CommercialTermsCard } from "@/components/quotation/commercial-terms-card";
import ToolsAndPricing from "@/components/optimized/tools-and-pricing";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getApiErrorMessage } from "@/lib/api-error";
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

type FinancialReviewFinalProps = {
  revealAdvanced?: boolean;
  validationMessage?: string;
};

export default function FinancialReviewFinal({ revealAdvanced = false, validationMessage }: FinancialReviewFinalProps) {
  const {
    quotationData,
    baseCost,
    complexityAdjustment,
    markupAmount,
    totalAmount,
    pricingResult,
    complexityFactors,
    availableRoles,
    availablePersonnel,
    forceRecalculate,
    updateInflation,
    updateFinancials,
    saveQuotation,
    getPersonnelRate
  } = useOptimizedQuote();
  const { data: inflationHistory = [] } = useQuery<Array<{ year: number; month: number; inflationRate: number }>>({
    queryKey: ['/api/inflation/data'],
  });
  const automaticAnnualInflationRate = React.useMemo(() => {
    const latest = [...inflationHistory]
      .sort((left, right) => right.year - left.year || right.month - left.month)
      .slice(0, 12);
    if (latest.length === 0) return null;
    return (latest.reduce((factor, item) => factor * (1 + Number(item.inflationRate || 0)), 1) - 1) * 100;
  }, [inflationHistory]);

  useEffect(() => {
    if (quotationData.inflation.inflationMethod !== 'automatic' || automaticAnnualInflationRate == null) return;
    if (Math.abs((quotationData.inflation.automaticInflationRate ?? -1) - automaticAnnualInflationRate) < 0.0001) return;
    updateInflation({ automaticInflationRate: automaticAnnualInflationRate });
  }, [automaticAnnualInflationRate, quotationData.inflation.automaticInflationRate, quotationData.inflation.inflationMethod, updateInflation]);

  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  useEffect(() => {
    if (revealAdvanced) setShowAdvanced(true);
  }, [revealAdvanced]);
  const advancedVisible = showAdvanced || revealAdvanced;
  const markupMultiplier = quotationData.financials?.marginFactor || 2.0;
  const discountPercentage = quotationData.financials?.discountPercentage || 0;

  // Force recalculation when component mounts or data changes
  useEffect(() => {
    if (quotationData.teamMembers.length > 0) {
      forceRecalculate();
    }
  }, [quotationData.teamMembers, forceRecalculate]);

  // Declare currency hook early so safeRate is available for toolsCostARS conversion below
  const { convertToUSD, exchangeRate } = useCurrency();
  const safeRate = quotationData.exchangeRateSnapshot && quotationData.exchangeRateSnapshot > 0
    ? quotationData.exchangeRateSnapshot
    : (typeof exchangeRate === 'number' && exchangeRate > 0 ? exchangeRate : 1);

  const currencyLabel = quotationData.quotationCurrency || 'ARS';
  const formatFinalCurrency = (amount: number) => 
    `${currencyLabel} ${amount.toLocaleString(currencyLabel === 'USD' ? 'en-US' : 'es-AR', {
      minimumFractionDigits: currencyLabel === 'USD' ? 2 : 0,
      maximumFractionDigits: currencyLabel === 'USD' ? 2 : 0,
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

  const getComplexityPercentage = () => {
    const totalFactor = Object.values(complexityFactors).reduce((sum, factor) => sum + factor, 0);
    return (totalFactor * 100).toFixed(1);
  };

  // All financial screens consume the exact same pricing result from context.
  const canonical = pricingResult.canonicalARS;
  const displayed = pricingResult.display;
  const teamBaseCostARS = canonical.baseCost;
  const teamComplexityAdjustmentARS = canonical.complexityAdjustment;
  const subtotalWithComplexityARS = teamBaseCostARS + teamComplexityAdjustmentARS;

  // Calculate inflation if applicable - in ARS
  const baseForInflation = subtotalWithComplexityARS;
  let monthlyInflationRate = 0;
  let totalInflationPercentage = 0;
  let monthsToProject = 0;

  const rateMode = quotationData.inflation.rateProjectionMode === "annual_avg" ? "annual_avg" : "current";

  let inflationFactor = 1;
  if (quotationData.inflation.applyInflationAdjustment) {
    const annualInflationRate = quotationData.inflation.inflationMethod === 'manual'
      ? quotationData.inflation.manualInflationRate
      : quotationData.inflation.automaticInflationRate;
    if (annualInflationRate == null || !Number.isFinite(annualInflationRate) || annualInflationRate < 0) {
      inflationFactor = 1;
    } else {
    const monthlyRateDecimal = Math.pow(1 + (annualInflationRate / 100), 1/12) - 1;
    monthlyInflationRate = monthlyRateDecimal * 100;
    if (rateMode === "annual_avg") {
      monthsToProject = 6;
    } else if (quotationData.inflation.projectStartDate) {
      const start = new Date(quotationData.inflation.projectStartDate);
      const now = new Date();
      monthsToProject = Math.max(0, (start.getFullYear() - now.getFullYear()) * 12 + start.getMonth() - now.getMonth());
    }
    inflationFactor = Math.pow(1 + monthlyRateDecimal, monthsToProject);
    totalInflationPercentage = (inflationFactor - 1) * 100;
    }
  }
  const preInflationTotalARS = inflationFactor > 0 ? canonical.total / inflationFactor : canonical.total;
  const inflationAdjustmentARS = canonical.total - preInflationTotalARS;
  const finalBaseAfterInflationARS = subtotalWithComplexityARS;
  const platformCostARS = canonical.platformCost;
  const toolsCostARS = canonical.toolsCost;
  const subtotalWithPlatformARS = finalBaseAfterInflationARS + platformCostARS;
  const marginAmountARS = canonical.markupAmount;
  const discountAmountARS = canonical.discountAmount;
  const subtotalWithMarginARS = subtotalWithComplexityARS + marginAmountARS;
  const subtotalWithPlatformAndToolsARS = subtotalWithMarginARS + toolsCostARS + platformCostARS + canonical.deviationAmount;
  const finalTotalARS = canonical.total;

  // Create USD equivalents for calculations that need them
  // useCurrency() and safeRate are declared near the top of this component
  const subtotalWithPlatformUSD = safeRate > 1 ? convertToUSD(subtotalWithPlatformARS, 'ARS') : 0;
  const subtotalWithMarginUSD = safeRate > 1 ? convertToUSD(subtotalWithMarginARS, 'ARS') : 0;
  const inflationAdjustmentUSD = safeRate > 1 ? convertToUSD(inflationAdjustmentARS, 'ARS') : 0;
  
  // All values are already in ARS - no conversion needed for display
  const teamBaseCostDisplay = displayed.baseCost;
  const teamComplexityAdjustmentDisplay = displayed.complexityAdjustment;
  const subtotalWithComplexityDisplay = teamBaseCostDisplay + teamComplexityAdjustmentDisplay;
  const platformCostDisplay = displayed.platformCost;
  const toolsCostDisplay = displayed.toolsCost;
  const finalBaseAfterInflationDisplay = teamBaseCostDisplay + teamComplexityAdjustmentDisplay;
  const subtotalWithPlatformDisplay = finalBaseAfterInflationDisplay + platformCostDisplay;
  const subtotalWithMarginDisplay = subtotalWithComplexityDisplay + displayed.markupAmount;
  const subtotalWithPlatformAndToolsDisplay = subtotalWithMarginDisplay + toolsCostDisplay + platformCostDisplay + displayed.deviationAmount;
  const marginAmountDisplay = displayed.markupAmount;
  const discountAmountDisplay = displayed.discountAmount;
  const finalTotalDisplay = displayed.total;
  const inflationAdjustmentDisplay = quotationData.quotationCurrency === "USD" ? inflationAdjustmentARS / safeRate : inflationAdjustmentARS;

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



      await saveQuotation('draft');

      toast({
        title: "Cotización guardada",
        description: "La cotización se ha guardado correctamente.",
      });

      navigate('/manage-quotes');
    } catch (error) {
      console.error("Error al guardar:", error);
      const errorMessage = getApiErrorMessage(error, "Error desconocido");
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
        description: "El borrador se guardó correctamente. Podés continuar editándolo más tarde.",
      });

    } catch (error) {
      console.error("❌ Error al guardar borrador:", error);
      const errorMessage = getApiErrorMessage(error, "Error desconocido");

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

  return (
    <TooltipProvider>
      <div className="bg-white">
      {/* Header removido - los botones de finalización ahora están solo en el último paso */}

      <div className="mx-auto max-w-7xl py-6">
        {validationMessage && (
          <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {validationMessage}
          </div>
        )}
        {/* Executive Summary Cards */}
        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="h-full border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100 cursor-help">
              <CardContent className="flex h-full items-center justify-center p-4 text-center">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-200 flex items-center justify-center">
                    <Users className="h-4 w-4 text-blue-700" />
                  </div>
                  <div className="text-center">
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
            <Card className="h-full border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100 cursor-help">
              <CardContent className="flex h-full items-center justify-center p-4 text-center">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-200 flex items-center justify-center">
                    <Target className="h-4 w-4 text-amber-700" />
                  </div>
                  <div className="text-center">
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

        <Card className={`h-full border-0 shadow-sm ${
          quotationData.inflation.applyInflationAdjustment 
            ? 'bg-gradient-to-br from-orange-50 to-orange-100' 
            : 'bg-gradient-to-br from-gray-50 to-gray-100'
        }`}>
          <CardContent className="flex h-full items-center justify-center p-4 text-center">
            <div className="flex items-center justify-center gap-3">
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
              <div className="text-center">
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
            <Card className="h-full border-0 shadow-sm bg-gradient-to-br from-green-50 to-green-100 cursor-help">
              <CardContent className="flex h-full items-center justify-center p-4 text-center">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-200 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-green-700" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-green-800">Multiplicador</p>
                    <p className="text-lg font-bold text-green-900">
                      {quotationData.financials.priceMode === 'manual' && quotationData.financials.manualPrice 
                        ? `${((subtotalWithMarginARS / subtotalWithPlatformARS) || 1).toFixed(1)}x`
                        : `${markupMultiplier.toFixed(1)}x`}
                    </p>
                    <p className="text-xs text-green-600">+{formatFinalCurrency(marginAmountDisplay)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs">Multiplicador comercial aplicado al costo. Un valor de {markupMultiplier}x significa que el precio equivale a {markupMultiplier} veces la base calculada.</p>
          </TooltipContent>
        </Tooltip>
        </div>

        <div className="mb-6 flex flex-col items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
          <div>
            <p className="font-medium text-slate-900">Precio comercial</p>
            <p className="text-sm text-slate-500">El resumen está listo. Abrí los ajustes solo si necesitás cambiar margen, descuento, herramientas o inflación.</p>
          </div>
          <Button
            type="button"
            variant={advancedVisible ? 'secondary' : 'outline'}
            onClick={() => setShowAdvanced((current) => !current)}
            aria-expanded={advancedVisible}
            aria-controls="advanced-pricing-controls"
            className="shrink-0"
          >
            <Settings className="mr-2 h-4 w-4" />
            {advancedVisible ? 'Ocultar ajustes' : 'Ajustar precio'}
          </Button>
        </div>

        {/* Main Content - Responsive Layout */}
        <div className={`grid grid-cols-1 gap-4 lg:gap-6 ${advancedVisible ? 'lg:grid-cols-2 xl:grid-cols-3' : 'lg:grid-cols-2'}`}>

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
        {advancedVisible && <div id="advanced-pricing-controls" className="space-y-4 lg:space-y-6">
          {/* Margin and Discount Controls */}
          <Card id="pricing-config" className="shadow-sm border-0 bg-white" tabIndex={-1}>
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
                      ? "Multiplicador calculado"
                      : "Multiplicador comercial"}
                  </Label>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    {quotationData.financials.priceMode === 'manual' && quotationData.financials.manualPrice 
                      ? `${((subtotalWithMarginUSD / subtotalWithPlatformUSD) || 1).toFixed(2)}x calc.`
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
                              aria-label="Multiplicador comercial"
                              value={[currentMarkup]}
                              onValueChange={(value) => {
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
                        `Multiplicador calculado: ${((subtotalWithMarginUSD / subtotalWithPlatformUSD) || 1).toFixed(2)}x (${formatFinalCurrency(subtotalWithPlatformDisplay)} → ${formatFinalCurrency(subtotalWithMarginDisplay)})`
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
                    aria-label="Descuento al cliente"
                    value={[discountPercentage]}
                    onValueChange={(value) => {
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
                  {discountPercentage >= 20 && (
                    <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Descuento elevado: documentá la justificación y obtené aprobación comercial antes de finalizar.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {/* Tools Cost Section */}
                <Separator className="my-4" />
                <div className="space-y-3">
                  <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Costos de Herramientas (USD)
                  </Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={quotationData.financials.toolsCost || 0}
                    onChange={(e) => updateFinancials({ toolsCost: Number(e.target.value) || 0 })}
                    className="text-right font-mono"
                  />
                  <p className="text-xs text-gray-500">
                    Costos adicionales de software, licencias o herramientas específicas
                  </p>
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
                        // Use the current displayed total in the selected quotation currency.
                        if (!quotationData.financials.manualPrice) {
                          updateFinancials({
                            manualPrice: finalTotalDisplay,
                            manualPriceCurrency: currencyLabel === 'USD' ? 'USD' : 'ARS',
                          });
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
                              Precio objetivo ({currencyLabel})
                            </Label>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4 text-blue-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-xs">
                                <p>Ingresá el precio que querés cobrar. El sistema calculará automáticamente el multiplicador necesario.</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-500 font-semibold">$</span>
                            <Input
                              id="manual-price"
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
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <div className="bg-gray-50 rounded-lg p-2 text-center">
                            <p className="text-xs text-gray-600">Costo Base</p>
                            <p className="font-mono text-sm font-semibold text-gray-900">
                              {formatFinalCurrency(subtotalWithPlatformDisplay + toolsCostDisplay)}
                            </p>
                          </div>
                          <div className="bg-blue-50 rounded-lg p-2 text-center">
                            <p className="text-xs text-blue-600">Multiplicador</p>
                            <p className="font-mono text-sm font-semibold text-blue-900">
                              {quotationData.financials.manualPrice && subtotalWithPlatformDisplay > 0
                                ? `${(((quotationData.financials.manualPrice - toolsCostDisplay) / (1 - (discountPercentage / 100))) / subtotalWithPlatformDisplay).toFixed(2)}x`
                                : '—'}
                            </p>
                          </div>
                          <div className="bg-green-50 rounded-lg p-2 text-center">
                            <p className="text-xs text-green-600">Ganancia</p>
                            <p className="font-mono text-sm font-semibold text-green-900">
                              {quotationData.financials.manualPrice
                                ? formatFinalCurrency(Math.max(0, quotationData.financials.manualPrice - subtotalWithPlatformDisplay - toolsCostDisplay))
                                : '—'}
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
                      {inflationAdjustmentUSD > 0 ? `+${formatFinalCurrency(inflationAdjustmentDisplay)}` : 'Configurando...'}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-medium">Fuente del valor hora</Label>
                    <Select
                      value={quotationData.inflation.rateProjectionMode === "annual_avg" ? "annual_avg" : "current"}
                      onValueChange={(value) =>
                        updateInflation({ rateProjectionMode: value as "current" | "annual_avg" })
                      }
                    >
                      <SelectTrigger className="border-orange-200 focus:border-orange-400">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="current">Valor actual (foto del mes)</SelectItem>
                        <SelectItem value="annual_avg">Promedio anual</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-orange-700/80">
                      Seleccioná si el valor hora debe ser la foto del mes o el promedio anual estimado del equipo.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-medium">Fecha de inicio del proyecto</Label>
                      <Input
                        id="inflation-start-date"
                        type="date"
                        value={quotationData.inflation.projectStartDate}
                        onChange={(e) => updateInflation({ projectStartDate: e.target.value })}
                        min={new Date().toISOString().split('T')[0]}
                        className="border-orange-200 focus:border-orange-400"
                        disabled={quotationData.inflation.rateProjectionMode === "annual_avg"}
                      />
                      {quotationData.inflation.rateProjectionMode === "annual_avg" && (
                        <p className="text-[11px] text-orange-600/80">No aplica en modo promedio anual.</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="font-medium">Moneda confirmada</Label>
                      <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-900">
                        {currencyLabel} · TC guardado: 1 USD = {safeRate.toLocaleString('es-AR')} ARS
                      </div>
                      <p className="text-[11px] text-orange-700/80">La moneda se define en la fase Proyecto para evitar recálculos accidentales.</p>
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
                    {quotationData.inflation.inflationMethod === 'automatic' && (
                      <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
                        {automaticAnnualInflationRate == null
                          ? 'No hay 12 meses de inflación configurados. Completá la serie antes de aprobar.'
                          : `Tasa anual compuesta guardada: ${automaticAnnualInflationRate.toFixed(2)}% (${Math.min(inflationHistory.length, 12)} meses).`}
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
        </div>}

        {advancedVisible && <CommercialTermsCard />}

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
              {(quotationData.inflation.applyInflationAdjustment && inflationAdjustmentUSD > 0) || platformCostDisplay > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 text-xs">2</div>
                    Ajustes
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
                    {quotationData.inflation.applyInflationAdjustment && inflationAdjustmentUSD > 0 && (
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
                    {platformCostDisplay > 0 && (
                      <div className={`flex justify-between items-center ${quotationData.inflation.applyInflationAdjustment && inflationAdjustmentUSD > 0 ? 'mt-2 pt-2 border-t border-orange-100' : ''}`}>
                        <span className="text-sm text-orange-800">Costos de Plataforma</span>
                        <span className="font-semibold text-orange-900">+{formatFinalCurrency(platformCostDisplay)}</span>
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
                        Multiplicador {quotationData.financials.priceMode === 'manual' && quotationData.financials.manualPrice
                          ? (subtotalWithPlatformUSD > 0 ? `${(subtotalWithMarginUSD / subtotalWithPlatformUSD).toFixed(2)}x calc.` : '—')
                          : `${markupMultiplier}x`}
                      </span>
                    </div>
                    <span className="font-semibold text-green-900">+{formatFinalCurrency(marginAmountDisplay)}</span>
                  </div>
                  {toolsCostDisplay > 0 && (
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-green-100">
                      <span className="text-sm text-green-800">Costos de Herramientas</span>
                      <span className="font-semibold text-green-900">+{formatFinalCurrency(toolsCostDisplay)}</span>
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
            {/* Botones de finalización removidos - ahora están solo en el último paso */}
            <div className="text-center text-sm text-gray-500 py-4">
              Continúa al siguiente paso para finalizar la cotización
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
    </TooltipProvider>
  );
}
