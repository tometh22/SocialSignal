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
  const [markupMultiplier, setMarkupMultiplier] = useState(quotationData.financials?.marginFactor || 2.0);
  const [discountPercentage, setDiscountPercentage] = useState(quotationData.financials?.discountPercentage || 0);

  // Obtenemos datos de inflación y tipo de cambio
  const { data: inflationData } = useQuery({
    queryKey: ['/api/inflation'],
    staleTime: 5 * 60 * 1000,
  });

  const { data: exchangeRateData } = useQuery({
    queryKey: ['/api/exchange-rate'],
    staleTime: 5 * 60 * 1000,
  });

  const { formatPrice } = useCurrency();

  // Estado para configuraciones avanzadas
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [isEditingMarkup, setIsEditingMarkup] = useState(false);

  // Funciones de cálculo
  const calculateTotalHours = () => {
    return quotationData.teamMembers.reduce((total, member) => total + member.hours, 0);
  };

  const calculateProjectDurationWeeks = () => {
    const totalHours = calculateTotalHours();
    const weeklyHours = 40; // Asumiendo 40 horas por semana
    return Math.ceil(totalHours / weeklyHours);
  };

  const getComplexityPercentage = () => {
    const totalFactor = Object.values(complexityFactors).reduce((sum, factor) => sum + factor, 0);
    return (totalFactor * 100).toFixed(1);
  };

  // Cálculos financieros base en ARS
  const subtotalARS = baseCost;
  const complexityAdjustmentARS = complexityAdjustment;
  const subtotalWithComplexityARS = subtotalARS + complexityAdjustmentARS;
  const markupAmountARS = subtotalWithComplexityARS * (markupMultiplier - 1);
  const subtotalWithMarginARS = subtotalWithComplexityARS + markupAmountARS;

  // Aplicar descuento
  const discountAmountARS = subtotalWithMarginARS * (discountPercentage / 100);
  const finalTotalARS = subtotalWithMarginARS - discountAmountARS;

  // Variables para mostrar según moneda de cotización
  const isUSDQuotation = quotationData.quotationCurrency === 'USD';
  const exchangeRate = exchangeRateData?.rate || 1000; // Rate por defecto

  let subtotalDisplay, complexityAdjustmentDisplay, subtotalWithComplexityDisplay;
  let markupAmountDisplay, subtotalWithMarginDisplay, discountAmountDisplay, finalTotalDisplay;

  if (isUSDQuotation) {
    subtotalDisplay = subtotalARS / exchangeRate;
    complexityAdjustmentDisplay = complexityAdjustmentARS / exchangeRate;
    subtotalWithComplexityDisplay = subtotalWithComplexityARS / exchangeRate;
    markupAmountDisplay = markupAmountARS / exchangeRate;
    subtotalWithMarginDisplay = subtotalWithMarginARS / exchangeRate;
    discountAmountDisplay = discountAmountARS / exchangeRate;
    finalTotalDisplay = finalTotalARS / exchangeRate;
  } else {
    subtotalDisplay = subtotalARS;
    complexityAdjustmentDisplay = complexityAdjustmentARS;
    subtotalWithComplexityDisplay = subtotalWithComplexityARS;
    markupAmountDisplay = markupAmountARS;
    subtotalWithMarginDisplay = subtotalWithMarginARS;
    discountAmountDisplay = discountAmountARS;
    finalTotalDisplay = finalTotalARS;
  }

  const formatFinalCurrency = (amount: number) => {
    if (isUSDQuotation) {
      return `USD ${amount.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      })}`;
    } else {
      return `ARS ${amount.toLocaleString('es-AR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      })}`;
    }
  };

  // Handlers para guardar
  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    try {
      await saveQuotation('draft');
      toast({
        title: "Borrador guardado",
        description: "La cotización se guardó como borrador exitosamente.",
      });
    } catch (error) {
      toast({
        title: "Error al guardar",
        description: "No se pudo guardar el borrador de la cotización.",
        variant: "destructive",
      });
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleFinalizeQuotation = async () => {
    setIsFinalizing(true);
    try {
      // Actualizar financials antes de finalizar
      updateFinancials({
        marginFactor: markupMultiplier,
        discountPercentage: discountPercentage,
        finalTotal: finalTotalARS,
        exchangeRateUsed: isUSDQuotation ? exchangeRate : null
      });

      await saveQuotation('approved');
      
      toast({
        title: "¡Cotización finalizada!",
        description: "La cotización se finalizó exitosamente.",
      });
      
      navigate('/quotations');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        toast({
          title: "Sesión expirada",
          description: "Tu sesión ha expirado. Por favor, inicia sesión nuevamente.",
          variant: "destructive",
        });
        navigate('/auth');
        return;
      }

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
                  <h1 className="text-lg font-bold text-gray-900">Revisión Financiera</h1>
                  <p className="text-xs text-gray-500">
                    Revisa los detalles financieros antes de finalizar
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
                Guardar Borrador
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Panel izquierdo - Resumen financiero */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Cards principales de resumen */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Equipo */}
              <Card className="border-blue-200 bg-blue-50/30">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg text-blue-700">
                    <Users className="h-5 w-5" />
                    Equipo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-2xl font-bold text-blue-900">
                      {quotationData.teamMembers.length}
                    </p>
                    <p className="text-sm text-blue-600">Miembros del equipo</p>
                    <div className="space-y-1">
                      {quotationData.teamMembers.map((member, index) => {
                        const rate = getPersonnelRate(member.personnelId, quotationData.project.startMonth);
                        return (
                          <div key={index} className="text-xs text-blue-600">
                            {member.hours}h × {formatFinalCurrency(rate)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Costo Base */}
              <Card className="border-green-200 bg-green-50/30">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg text-green-700">
                    <Calculator className="h-5 w-5" />
                    Costo Base
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-2xl font-bold text-green-900">
                      {formatFinalCurrency(subtotalDisplay)}
                    </p>
                    <p className="text-sm text-green-600">Costo total del equipo</p>
                  </div>
                </CardContent>
              </Card>

              {/* Total Final */}
              <Card className="border-emerald-200 bg-emerald-50/30">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg text-emerald-700">
                    <DollarSign className="h-5 w-5" />
                    Total Final
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-2xl font-bold text-emerald-900">
                      {formatFinalCurrency(finalTotalDisplay)}
                    </p>
                    <p className="text-sm text-emerald-600">Incluye márgenes y ajustes</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detalles del Proyecto */}
            <Card>
              <CardHeader>
                <CardTitle>Detalles del Proyecto</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Cliente:</Label>
                    <p className="text-gray-900">{quotationData.client?.name || 'No seleccionado'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Proyecto:</Label>
                    <p className="text-gray-900">{quotationData.project.name || 'Sin nombre'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Tipo:</Label>
                    <p className="text-gray-900">{quotationData.project.type || 'No especificado'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Moneda:</Label>
                    <p className="text-gray-900">{quotationData.quotationCurrency}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Panel derecho - Configuración financiera */}
          <div className="space-y-6">
            
            {/* Configuración de Markup */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Configuración de Margen
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Factor de margen: {markupMultiplier.toFixed(1)}x</Label>
                  <Slider
                    value={[markupMultiplier]}
                    onValueChange={([value]) => setMarkupMultiplier(value)}
                    max={5}
                    min={1}
                    step={0.1}
                    className="mt-2"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>1x</span>
                    <span>5x</span>
                  </div>
                </div>

                <div>
                  <Label>Descuento: {discountPercentage.toFixed(0)}%</Label>
                  <Slider
                    value={[discountPercentage]}
                    onValueChange={([value]) => setDiscountPercentage(value)}
                    max={50}
                    min={0}
                    step={1}
                    className="mt-2"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0%</span>
                    <span>50%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Resumen de cálculos */}
            <Card>
              <CardHeader>
                <CardTitle>Resumen de Cálculos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Subtotal:</span>
                  <span className="font-medium">{formatFinalCurrency(subtotalDisplay)}</span>
                </div>
                {complexityAdjustmentDisplay > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm">Ajuste complejidad:</span>
                    <span className="font-medium text-orange-600">
                      +{formatFinalCurrency(complexityAdjustmentDisplay)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm">Margen ({markupMultiplier.toFixed(1)}x):</span>
                  <span className="font-medium text-green-600">
                    +{formatFinalCurrency(markupAmountDisplay)}
                  </span>
                </div>
                {discountPercentage > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm">Descuento ({discountPercentage}%):</span>
                    <span className="font-medium text-red-600">
                      -{formatFinalCurrency(discountAmountDisplay)}
                    </span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total Final:</span>
                  <span className="text-emerald-600">
                    {formatFinalCurrency(finalTotalDisplay)}
                  </span>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>

        {/* Botón de Finalizar - Centrado */}
        <div className="flex justify-center pt-8">
          <div className="flex flex-col items-center gap-4">
            <div className="flex gap-4">
              {/* Botón Guardar Borrador */}
              <Button
                onClick={handleSaveDraft}
                disabled={isSavingDraft}
                variant="outline"
                size="lg"
                className="px-8 py-3 border-gray-300 hover:bg-gray-50"
              >
                {isSavingDraft ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Guardando...
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
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all"
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
                    <div className="text-sm opacity-90 ml-2">
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
  );
}