
import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
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
import { CommercialTermsCard } from "@/components/quotation/commercial-terms-card";
import { CreditProgramCard } from "@/components/quotation/credit-program-card";
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
    updateFinancials,
    saveQuotation,
    getPersonnelRate
  } = useOptimizedQuote();
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

  const platformCostARS = canonical.platformCost;
  const toolsCostARS = canonical.toolsCost;
  const subtotalWithPlatformARS = subtotalWithComplexityARS + platformCostARS;
  const marginAmountARS = canonical.markupAmount;
  const discountAmountARS = canonical.discountAmount;
  const subtotalWithMarginARS = subtotalWithComplexityARS + marginAmountARS;
  const subtotalWithPlatformAndToolsARS = subtotalWithMarginARS + toolsCostARS + platformCostARS + canonical.deviationAmount;
  const finalTotalARS = canonical.total;

  // Create USD equivalents for calculations that need them
  // useCurrency() and safeRate are declared near the top of this component
  const subtotalWithPlatformUSD = safeRate > 1 ? convertToUSD(subtotalWithPlatformARS, 'ARS') : 0;
  const subtotalWithMarginUSD = safeRate > 1 ? convertToUSD(subtotalWithMarginARS, 'ARS') : 0;
  
  // All values are already in ARS - no conversion needed for display
  const teamBaseCostDisplay = displayed.baseCost;
  const teamComplexityAdjustmentDisplay = displayed.complexityAdjustment;
  const subtotalWithComplexityDisplay = teamBaseCostDisplay + teamComplexityAdjustmentDisplay;
  const platformCostDisplay = displayed.platformCost;
  const toolsCostDisplay = displayed.toolsCost;
  const subtotalWithPlatformDisplay = subtotalWithComplexityDisplay + platformCostDisplay;
  const subtotalWithMarginDisplay = subtotalWithComplexityDisplay + displayed.markupAmount;
  const subtotalWithPlatformAndToolsDisplay = subtotalWithMarginDisplay + toolsCostDisplay + platformCostDisplay + displayed.deviationAmount;
  const marginAmountDisplay = displayed.markupAmount;
  const discountAmountDisplay = displayed.discountAmount;
  const finalTotalDisplay = displayed.total;

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
        {quotationData.creditProgram?.enabled && <div className="mb-6"><CreditProgramCard /></div>}
        {/* Executive Summary Cards */}
        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="h-full border-slate-200 cursor-help">
              <CardContent className="flex h-full items-center justify-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                  <Users className="h-4 w-4 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Equipo</p>
                  <p className="text-lg font-semibold tabular-nums text-slate-950">{quotationData.teamMembers.length} miembros</p>
                  <p className="text-xs text-slate-500">{formatFinalCurrency(teamBaseCostDisplay)} base</p>
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
            <Card className="h-full border-slate-200 cursor-help">
              <CardContent className="flex h-full items-center justify-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                  <Target className="h-4 w-4 text-amber-700" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Complejidad</p>
                  <p className="text-lg font-semibold tabular-nums text-slate-950">+{getComplexityPercentage()}%</p>
                  <p className="text-xs text-slate-500">+{formatFinalCurrency(teamComplexityAdjustmentDisplay)}</p>
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs">Ajuste por complejidad basado en el volumen de menciones y la cobertura geográfica.</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="h-full border-slate-200 cursor-help">
              <CardContent className="flex h-full items-center justify-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
                  <TrendingUp className="h-4 w-4 text-emerald-700" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Multiplicador</p>
                  <p className="text-lg font-semibold tabular-nums text-slate-950">
                    {quotationData.creditProgram?.enabled
                      ? `${pricingResult.effectiveMarginFactor.toFixed(1)}x`
                      : quotationData.financials.priceMode === 'manual' && quotationData.financials.manualPrice
                      ? `${((subtotalWithMarginARS / subtotalWithPlatformARS) || 1).toFixed(1)}x`
                      : `${markupMultiplier.toFixed(1)}x`}
                  </p>
                  <p className="text-xs text-slate-500">+{formatFinalCurrency(marginAmountDisplay)}</p>
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
            <Card className="border-slate-200 bg-white overflow-hidden">
              <CollapsibleTrigger className="w-full">
                <CardHeader className="pb-4 border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5 text-indigo-600" />
                      Composición del Equipo
                      <Badge variant="secondary" className="ml-2">
                        {quotationData.teamMembers.length} miembros
                      </Badge>
                    </CardTitle>
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {quotationData.teamMembers.map((member, index) => (
                  <div key={member.id || index} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
                          <span className="text-xs font-semibold text-indigo-700">
                            {(member.personnelId
                              ? getPersonnelName(member.personnelId)
                              : getRoleName(member.roleId)
                            ).charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {member.personnelId
                              ? getPersonnelName(member.personnelId)
                              : getRoleName(member.roleId)
                            }
                          </p>
                          <p className="text-xs text-slate-500">
                            {member.hours}h × ${(member.personnelId
                              ? getPersonnelRate(member.personnelId)
                              : member.rate
                            ).toFixed(1)}/h
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-slate-900">
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

              <div className="p-4 bg-slate-50 border-t border-slate-200">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-900">Subtotal Base</span>
                  <span className="text-lg font-semibold tabular-nums text-slate-950">{formatFinalCurrency(teamBaseCostDisplay)}</span>
                </div>
              </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Complexity Factors - Collapsible */}
          <Collapsible defaultOpen={false}>
            <Card className="border-slate-200 bg-white overflow-hidden">
              <CollapsibleTrigger className="w-full">
                <CardHeader className="pb-4 border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calculator className="h-5 w-5 text-amber-600" />
                      Factores de Complejidad
                      <Badge variant="outline" className="ml-auto text-amber-700 border-amber-200">
                        +{getComplexityPercentage()}%
                      </Badge>
                    </CardTitle>
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-sm font-medium text-slate-700">Volumen de Menciones</span>
                  <Badge variant="outline" className="text-xs text-slate-600 border-slate-300">
                    +{(complexityFactors.mentionsVolumeFactor * 100).toFixed(1)}%
                  </Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-sm font-medium text-slate-700">Países Cubiertos</span>
                  <Badge variant="outline" className="text-xs text-slate-600 border-slate-300">
                    +{(complexityFactors.countriesFactor * 100).toFixed(1)}%
                  </Badge>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg border border-amber-200">
                <span className="font-semibold text-amber-900">Total Ajuste Complejidad</span>
                <span className="text-lg font-semibold tabular-nums text-amber-900">+{formatFinalCurrency(teamComplexityAdjustmentDisplay)}</span>
              </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>

        {/* Center: financial controls */}
        {advancedVisible && <div id="advanced-pricing-controls" className="space-y-4 lg:space-y-6">
          {/* Margin and Discount Controls */}
          <Card id="pricing-config" className="border-slate-200 bg-white" tabIndex={-1}>
            <CardHeader className="pb-4 border-b border-slate-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <Percent className="h-5 w-5 text-indigo-600" />
                Ajustes Financieros
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Markup Control */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-slate-900">
                    {quotationData.financials.priceMode === 'manual' && quotationData.financials.manualPrice
                      ? "Multiplicador calculado"
                      : "Multiplicador comercial"}
                  </Label>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
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
                          <span className="text-sm font-medium text-slate-600">x</span>
                        </>
                      );
                    })()}
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>1.0x (Sin ganancia)</span>
                    <span>3.5x</span>
                    <span>6.0x</span>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-emerald-900">Ganancia Generada:</span>
                      <span className="text-lg font-semibold tabular-nums text-emerald-900">+{formatFinalCurrency(marginAmountDisplay)}</span>
                    </div>
                    <p className="text-xs text-emerald-700 mt-1">
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
                  <Label className="text-sm font-medium text-slate-900">
                    Descuento al Cliente
                  </Label>
                  <Badge variant="outline" className={discountPercentage > 0
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-slate-50 text-slate-700 border-slate-200"
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
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                  </div>
                  {discountPercentage > 0 && (
                    <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-red-900">Descuento Aplicado:</span>
                        <span className="text-lg font-semibold tabular-nums text-red-900">-{formatFinalCurrency(discountAmountDisplay)}</span>
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
                  <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
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
                  <p className="text-xs text-slate-500">
                    Costos adicionales de software, licencias o herramientas específicas
                  </p>
                </div>

                {/* Price Mode Section */}
                <Separator className="my-4" />
                <div className="space-y-3">
                  <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
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
                    <div className="mt-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between mb-1">
                            <Label className="text-sm font-medium text-indigo-900">
                              Precio objetivo ({currencyLabel})
                            </Label>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4 text-indigo-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-xs">
                                <p>Ingresá el precio que querés cobrar. El sistema calculará automáticamente el multiplicador necesario.</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-indigo-500 font-semibold">$</span>
                            <Input
                              id="manual-price"
                              type="number"
                              placeholder="0.00"
                              value={quotationData.financials.manualPrice || ''}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value);
                                updateFinancials({ manualPrice: isNaN(value) ? 0 : value });
                              }}
                              className="text-right font-mono text-xl pl-10 pr-3 h-12 border-indigo-200 focus:border-indigo-400 bg-white"
                              min="0"
                              step="0.01"
                            />
                          </div>
                        </div>

                        {/* Métricas calculadas */}
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <div className="rounded-lg bg-slate-50 p-2 text-center">
                            <p className="text-xs text-slate-500">Costo Base</p>
                            <p className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                              {formatFinalCurrency(subtotalWithPlatformDisplay + toolsCostDisplay)}
                            </p>
                          </div>
                          <div className="rounded-lg bg-indigo-50 p-2 text-center">
                            <p className="text-xs text-indigo-600">Multiplicador</p>
                            <p className="font-mono text-sm font-semibold tabular-nums text-indigo-900">
                              {quotationData.financials.manualPrice && subtotalWithPlatformDisplay > 0
                                ? `${(((quotationData.financials.manualPrice - toolsCostDisplay) / (1 - (discountPercentage / 100))) / subtotalWithPlatformDisplay).toFixed(2)}x`
                                : '—'}
                            </p>
                          </div>
                          <div className="rounded-lg bg-emerald-50 p-2 text-center">
                            <p className="text-xs text-emerald-600">Ganancia</p>
                            <p className="font-mono text-sm font-semibold tabular-nums text-emerald-900">
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



        </div>}

        {advancedVisible && <CommercialTermsCard />}

        {/* Right: Financial Waterfall */}
        <div className="space-y-4 lg:space-y-6">
          <Card className="border-slate-200 h-fit">
            <CardHeader className="pb-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-emerald-600" />
                  Resumen de Cálculo
                </CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-slate-400 cursor-help" />
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
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs">1</div>
                  Costo Base
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Equipo</span>
                    <span className="font-semibold tabular-nums text-slate-900">{formatFinalCurrency(teamBaseCostDisplay)}</span>
                  </div>
                  {teamComplexityAdjustmentDisplay > 0 && (
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200">
                      <span className="text-sm text-slate-600">+ Complejidad ({getComplexityPercentage()}%)</span>
                      <span className="font-semibold tabular-nums text-slate-900">+{formatFinalCurrency(teamComplexityAdjustmentDisplay)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Sección 2: Ajustes */}
              {platformCostDisplay > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs">2</div>
                    Ajustes
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    {platformCostDisplay > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Costos de Plataforma</span>
                        <span className="font-semibold tabular-nums text-slate-900">+{formatFinalCurrency(platformCostDisplay)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Sección 3: Margen y Herramientas */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs">3</div>
                  Precio de Venta
                </div>
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm text-emerald-800">Margen de Ganancia</span>
                      <span className="text-xs text-emerald-600">
                        Multiplicador {quotationData.financials.priceMode === 'manual' && quotationData.financials.manualPrice
                          ? (subtotalWithPlatformUSD > 0 ? `${(subtotalWithMarginUSD / subtotalWithPlatformUSD).toFixed(2)}x calc.` : '—')
                          : `${markupMultiplier}x`}
                      </span>
                    </div>
                    <span className="font-semibold tabular-nums text-emerald-900">+{formatFinalCurrency(marginAmountDisplay)}</span>
                  </div>
                  {toolsCostDisplay > 0 && (
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-emerald-100">
                      <span className="text-sm text-emerald-800">Costos de Herramientas</span>
                      <span className="font-semibold tabular-nums text-emerald-900">+{formatFinalCurrency(toolsCostDisplay)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Sección 4: Descuento (si aplica) */}
              {discountPercentage > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-red-700 text-xs">4</div>
                    Descuento
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-red-800">Descuento ({discountPercentage}%)</span>
                      <span className="font-semibold tabular-nums text-red-900">-{formatFinalCurrency(discountAmountDisplay)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Separador visual */}
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
              </div>

              {/* Total Final */}
              <div className="rounded-xl bg-slate-950 p-4 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-emerald-400" />
                    <span className="text-sm font-medium text-slate-300">Resumen Final</span>
                  </div>
                  <span className="text-2xl font-semibold tabular-nums">
                    {formatFinalCurrency(finalTotalDisplay)}
                  </span>
                </div>
                <p className="text-sm text-slate-400 mt-1">
                  {quotationData.quotationCurrency} • {quotationData.teamMembers.length} miembros • {quotationData.client?.name}
                </p>
              </div>

            </CardContent>
          </Card>

          <div className="flex flex-col gap-3">
            {/* Botones de finalización removidos - ahora están solo en el último paso */}
            <div className="text-center text-sm text-slate-500 py-4">
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
