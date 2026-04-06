import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useOptimizedQuote } from "@/context/optimized-quote-context";
import { useCurrency } from "@/hooks/use-currency";
import { Calculator, Wrench, DollarSign, ArrowRight } from "lucide-react";

const ToolsAndPricing: React.FC = () => {
  const {
    quotationData,
    baseCost,
    complexityAdjustment,
    markupAmount,
    totalAmount,
    updateToolsCost,
    updatePriceMode,
    updateManualPrice
  } = useOptimizedQuote();

  const { convertFromUSD, exchangeRate } = useCurrency();
  const subtotalBeforeTools = baseCost + complexityAdjustment;
  // Convert tools cost from USD to ARS for display
  const toolsCostUSD = quotationData.financials.toolsCost || 0;
  const toolsCostARS = exchangeRate ? convertFromUSD(toolsCostUSD, 'ARS') : 0;
  const subtotalWithTools = subtotalBeforeTools + toolsCostARS;
  
  const isManualMode = quotationData.financials.priceMode === 'manual';
  const effectiveMarginPercentage = quotationData.financials.marginPercentage || 0;

  const handleToolsCostChange = (value: string) => {
    const cost = parseFloat(value) || 0;
    updateToolsCost(cost);
  };

  const handlePriceModeToggle = (checked: boolean) => {
    const newMode = checked ? 'manual' : 'auto';
    updatePriceMode(newMode);
    
    // Si cambiamos a modo manual, establecer el precio actual como punto de partida
    if (newMode === 'manual' && !quotationData.financials.manualPrice) {
      updateManualPrice(totalAmount);
    }
  };

  const handleManualPriceChange = (value: string) => {
    const price = parseFloat(value) || 0;
    updateManualPrice(price);
  };

  return (
    <div className="space-y-6">
      {/* Sección de Costos de Herramientas */}
      <Card className="border-amber-200 bg-amber-50/30">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-lg text-amber-900">Costos de Herramientas</CardTitle>
          </div>
          <p className="text-sm text-amber-700">
            Agrega costos de software, licencias o herramientas específicas para este proyecto
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tools-cost">Costo de Herramientas (USD)</Label>
              <Input
                id="tools-cost"
                type="number"
                step="0.01"
                value={quotationData.financials.toolsCost || ''}
                onChange={(e) => handleToolsCostChange(e.target.value)}
                placeholder="0.00"
                className="text-right"
              />
            </div>
            <div className="space-y-2">
              <Label>Cálculo</Label>
              <div className="p-3 bg-white rounded-md border text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Base + Complejidad:</span>
                  <span className="font-mono">ARS {subtotalBeforeTools.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>+ Herramientas (USD {toolsCostUSD.toFixed(2)}):</span>
                  <span className="font-mono">ARS {toolsCostARS.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between font-medium">
                  <span>Subtotal:</span>
                  <span className="font-mono">ARS {subtotalWithTools.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sección de Pricing Manual */}
      <Card className="border-green-200 bg-green-50/30">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-green-600" />
              <CardTitle className="text-lg text-green-900">Modo de Pricing</CardTitle>
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="price-mode" className="text-sm font-medium">
                {isManualMode ? "Manual" : "Automático"}
              </Label>
              <Switch
                id="price-mode"
                checked={isManualMode}
                onCheckedChange={handlePriceModeToggle}
              />
            </div>
          </div>
          <p className="text-sm text-green-700">
            {isManualMode 
              ? "Establece un precio final y el margen se calculará automáticamente"
              : "El precio se calcula automáticamente basado en costos + margen"
            }
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {isManualMode ? (
            // Modo Manual
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="manual-price">Precio Final Deseado (USD)</Label>
                <Input
                  id="manual-price"
                  type="number"
                  step="0.01"
                  value={quotationData.financials.manualPrice || ''}
                  onChange={(e) => handleManualPriceChange(e.target.value)}
                  placeholder="0.00"
                  className="text-right text-lg font-medium"
                />
              </div>
              <div className="space-y-2">
                <Label>Margen Calculado</Label>
                <div className="p-3 bg-white rounded-md border text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Costos base:</span>
                    <span className="font-mono">${subtotalWithTools.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Precio manual:</span>
                    <span className="font-mono">${(quotationData.financials.manualPrice || 0).toFixed(2)}</span>
                  </div>
                  <Separator className="my-1" />
                  <div className="flex justify-between items-center">
                    <span>Margen efectivo:</span>
                    <Badge variant={effectiveMarginPercentage > 0 ? "default" : "destructive"}>
                      {effectiveMarginPercentage.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Modo Automático
            <div className="p-4 bg-white rounded-md border">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="font-medium text-sm">Cálculo Automático</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span>Costos base: ${subtotalWithTools.toFixed(2)}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span>Margen: {effectiveMarginPercentage.toFixed(1)}%</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="font-bold">Total: ${totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumen del Impacto */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-blue-900">Resumen del Impacto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-xs text-blue-600 mb-1">Herramientas</div>
              <div className="font-mono text-sm font-medium">
                USD {toolsCostUSD.toFixed(2)}
              </div>
              <div className="text-xs text-blue-500">
                ARS {toolsCostARS.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
            <div>
              <div className="text-xs text-blue-600 mb-1">Modo</div>
              <Badge variant={isManualMode ? "default" : "secondary"} className="text-xs">
                {isManualMode ? "Manual" : "Auto"}
              </Badge>
            </div>
            <div>
              <div className="text-xs text-blue-600 mb-1">Margen</div>
              <div className="font-mono text-sm font-medium">
                {effectiveMarginPercentage.toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-blue-600 mb-1">Total Final</div>
              <div className="font-mono text-lg font-bold text-blue-900">
                ${totalAmount.toFixed(2)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ToolsAndPricing;