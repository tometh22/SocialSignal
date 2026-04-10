import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { DollarSign, Info, ArrowRight, CheckCircle, Target, Save, Loader2 } from 'lucide-react';
import { useCurrency } from '@/hooks/use-currency';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';

const CurrencySelection: React.FC = () => {
  const { quotationData, updateQuotationData, totalAmount, nextStep, baseCost, complexityAdjustment, markupAmount } = useOptimizedQuote();
  const { exchangeRate, formatCurrency } = useCurrency();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [isFinalizingDirect, setIsFinalizingDirect] = useState(false);

  const handleCurrencyChange = (currency: 'ARS' | 'USD') => {
    // Snapshot del tipo de cambio al momento de seleccionar la moneda
    updateQuotationData({ quotationCurrency: currency, exchangeRateSnapshot: exchangeRate });
  };

  const handleDirectFinalize = async () => {
    try {
      setIsFinalizingDirect(true);

      // Validaciones básicas
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
          description: "Debe especificar el nombre del proyecto.",
          variant: "destructive",
        });
        return;
      }

      // Los valores ya están disponibles desde el contexto

      // Ajustar los montos según la moneda seleccionada
      let finalTotalAmount = totalAmount;
      let finalBaseCost = baseCost;
      let finalComplexityAdjustment = complexityAdjustment; 
      let finalMarkupAmount = markupAmount;

      if (quotationData.quotationCurrency === 'ARS') {
        // Internal values are in USD, convert to ARS for storage
        finalTotalAmount = totalAmount * exchangeRate;
        finalBaseCost = baseCost * exchangeRate;
        finalComplexityAdjustment = complexityAdjustment * exchangeRate;
        finalMarkupAmount = markupAmount * exchangeRate;
      }
      // If USD, values are already in USD - no conversion needed

      // Crear cotización con el formato correcto que espera el API
      const finalQuotationData = {
        clientId: quotationData.client.id,
        projectName: quotationData.project.name,
        analysisType: quotationData.analysisType,
        projectType: quotationData.project.type,
        mentionsVolume: quotationData.mentionsVolume,
        countriesCovered: quotationData.countriesCovered,
        clientEngagement: quotationData.clientEngagement,
        templateId: quotationData.template?.id || null,
        baseCost: finalBaseCost,
        complexityAdjustment: finalComplexityAdjustment,
        markupAmount: finalMarkupAmount,
        marginFactor: quotationData.financials.marginFactor,
        platformCost: quotationData.financials.platformCost,
        deviationPercentage: quotationData.financials.deviationPercentage,
        discountPercentage: quotationData.financials.discountPercentage || 0,
        totalAmount: finalTotalAmount,
        toolsCost: quotationData.financials.toolsCost,
        priceMode: quotationData.financials.priceMode,
        manualPrice: quotationData.financials.manualPrice,
        status: 'pending',
        projectStartDate: quotationData.inflation.projectStartDate || null,
        applyInflationAdjustment: quotationData.inflation.applyInflationAdjustment,
        inflationMethod: quotationData.inflation.inflationMethod,
        manualInflationRate: quotationData.inflation.manualInflationRate,
        quotationCurrency: quotationData.quotationCurrency,
        exchangeRateAtQuote: exchangeRate,
        usdExchangeRate: exchangeRate,
        createdBy: user?.id ?? 1
      };

      console.log('🚀 Sending quotation data:', finalQuotationData);

      const response = await apiRequest('/api/quotations', {
        method: 'POST',
        body: finalQuotationData,
      });

      toast({
        title: "¡Cotización finalizada!",
        description: `Cotización creada exitosamente con ID ${response.id}`,
        variant: "default",
      });

      // Redirigir al listado
      setLocation('/manage-quotes');

    } catch (error: any) {
      console.error('Error al finalizar cotización:', error);
      const errorMessage = error.message || 'Error desconocido';
      
      toast({
        title: "Error al finalizar",
        description: `No se pudo finalizar la cotización: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsFinalizingDirect(false);
    }
  };

  const totalInUSD = totalAmount;
  const totalInARS = totalAmount * exchangeRate;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Seleccionar Moneda de Cotización
        </h2>
        <p className="text-gray-600">
          Elige la moneda en la que quieres presentar la cotización al cliente
        </p>
      </div>

      {/* Información del tipo de cambio actual */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-blue-800">
            <Info className="h-4 w-4" />
            <span className="text-sm font-medium">
              Tipo de cambio actual: 1 USD = {exchangeRate.toLocaleString('es-AR')} ARS
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Opciones de moneda */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Opción USD */}
        <Card 
          className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
            quotationData.quotationCurrency === 'USD' 
              ? 'border-green-500 bg-green-50 ring-2 ring-green-200' 
              : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={() => handleCurrencyChange('USD')}
        >
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Dólares (USD)</CardTitle>
                  <CardDescription>Moneda internacional</CardDescription>
                </div>
              </div>
              {quotationData.quotationCurrency === 'USD' && (
                <Badge className="bg-green-500">Seleccionada</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">
                ${totalInUSD.toLocaleString('en-US', { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 2 
                })}
              </div>
              <p className="text-sm text-gray-600">
                Ideal para clientes internacionales o contratos en dólares
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Opción ARS */}
        <Card 
          className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
            quotationData.quotationCurrency === 'ARS' 
              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
              : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={() => handleCurrencyChange('ARS')}
        >
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-xl font-bold text-blue-600">$</span>
                </div>
                <div>
                  <CardTitle className="text-lg">Pesos Argentinos (ARS)</CardTitle>
                  <CardDescription>Moneda local</CardDescription>
                </div>
              </div>
              {quotationData.quotationCurrency === 'ARS' && (
                <Badge className="bg-blue-500">Seleccionada</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                ${totalInARS.toLocaleString('es-AR', { 
                  minimumFractionDigits: 0, 
                  maximumFractionDigits: 0 
                })}
              </div>
              <p className="text-sm text-gray-600">
                Ideal para clientes locales argentinos
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumen de la selección */}
      {quotationData.quotationCurrency && (
        <Card className="bg-gray-50">
          <CardContent className="pt-4">
            <div className="text-center">
              <h3 className="font-semibold text-gray-900 mb-2">
                Cotización seleccionada en {quotationData.quotationCurrency}
              </h3>
              <div className="text-2xl font-bold text-gray-900">
                {quotationData.quotationCurrency === 'USD' 
                  ? `USD ${totalInUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                  : `ARS ${totalInARS.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                }
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {quotationData.quotationCurrency === 'USD' 
                  ? `Equivalente: ARS ${totalInARS.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` 
                  : `Equivalente: USD ${totalInUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Opciones de finalización */}
      {quotationData.quotationCurrency && (
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              ¿Cómo deseas continuar?
            </h3>
            <p className="text-sm text-gray-600">
              Puedes generar variantes de precios o finalizar directamente con este monto
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={nextStep}
              variant="outline"
              size="lg"
              className="px-8 py-3 border-2 border-blue-500 text-blue-600 hover:bg-blue-50"
            >
              <Target className="mr-2 h-4 w-4" />
              Generar Variantes
            </Button>
            
            <Button 
              onClick={handleDirectFinalize}
              disabled={isFinalizingDirect}
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3"
            >
              {isFinalizingDirect ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Finalizando...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Finalizar Directamente
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CurrencySelection;