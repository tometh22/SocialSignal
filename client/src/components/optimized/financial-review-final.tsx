import React, { useEffect } from "react";
import { useOptimizedQuote } from "@/context/optimized-quote-context";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
    forceRecalculate
  } = useOptimizedQuote();

  // Debug log para verificar valores
  useEffect(() => {
    console.log('Financial Review - Current values:', {
      baseCost,
      complexityAdjustment,
      markupAmount,
      totalAmount,
      complexityFactors,
      teamMembers: quotationData.teamMembers
    });
  }, [baseCost, complexityAdjustment, markupAmount, totalAmount, complexityFactors, quotationData.teamMembers]);

  // Force recalculation when component mounts or data changes
  useEffect(() => {
    if (quotationData.teamMembers.length > 0) {
      forceRecalculate();
    }
  }, [quotationData.teamMembers, forceRecalculate]);

  // Calculate total complexity factor for display
  const totalComplexityFactor = Object.values(complexityFactors).reduce((sum, factor) => sum + factor, 0);

  const runDiagnostic = () => {
    console.log('🔍 === MANUAL DIAGNOSTIC ===');
    console.log('💰 Current values:', {
      baseCost,
      complexityAdjustment,
      markupAmount,
      totalAmount
    });
    console.log('👥 Team members:', quotationData.teamMembers);
    console.log('🧮 Complexity factors:', complexityFactors);
    console.log('📋 Template:', quotationData.template);

    // Force recalculation
    forceRecalculate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Revisión Financiera Final</h2>
        <div className="flex gap-2">
          <Button onClick={runDiagnostic} variant="outline" size="sm">
            🔍 Diagnóstico
          </Button>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            Paso 4 de 4
          </Badge>
        </div>
      </div>

      {/* Complexity Factors Display */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Factores de Complejidad</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <div className="text-sm text-gray-600">Tipo de Análisis</div>
              <div className="flex items-center gap-2">
                <Badge variant={quotationData.analysisType === "Estándar" ? "default" : quotationData.analysisType === "Avanzado" ? "destructive" : "secondary"}>
                  {quotationData.analysisType || "No seleccionado"}
                </Badge>
                <span className="text-xs text-gray-500">
                  +{(complexityFactors.analysisTypeFactor * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-gray-600">Volumen de Menciones</div>
              <div className="flex items-center gap-2">
                <Badge variant={quotationData.mentionsVolume === "Medio" ? "default" : quotationData.mentionsVolume === "Alto" ? "destructive" : "secondary"}>
                  {quotationData.mentionsVolume || "No seleccionado"}
                </Badge>
                <span className="text-xs text-gray-500">
                  +{(complexityFactors.mentionsVolumeFactor * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-gray-600">Países Cubiertos</div>
              <div className="flex items-center gap-2">
                <Badge variant={quotationData.countriesCovered === "4+ países" ? "destructive" : quotationData.countriesCovered === "2-3 países" ? "default" : "secondary"}>
                  {quotationData.countriesCovered || "No seleccionado"}
                </Badge>
                <span className="text-xs text-gray-500">
                  +{(complexityFactors.countriesFactor * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-gray-600">Compromiso del Cliente</div>
              <div className="flex items-center gap-2">
                <Badge variant={quotationData.clientEngagement === "Alto" ? "destructive" : quotationData.clientEngagement === "Medio" ? "default" : "secondary"}>
                  {quotationData.clientEngagement || "No seleccionado"}
                </Badge>
                <span className="text-xs text-gray-500">
                  +{(complexityFactors.clientEngagementFactor * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Members Cost Breakdown */}
      {quotationData.teamMembers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Desglose del Equipo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {quotationData.teamMembers.map((member) => (
                <div key={member.id} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-md">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">
                      {member.personnelId ? `Personal #${member.personnelId}` : `Rol #${member.roleId}`}
                    </span>
                    <span className="text-xs text-gray-500">
                      {member.hours}h × ${member.rate}/h
                    </span>
                  </div>
                  <span className="text-sm font-mono font-medium">
                    {formatCurrency(member.cost)}
                  </span>
                </div>
              ))}
              <div className="border-t pt-2 mt-3">
                <div className="flex justify-between items-center font-medium">
                  <span>Costo Base del Equipo</span>
                  <span className="font-mono">{formatCurrency(baseCost)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Financial Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumen Financiero</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Base Cost */}
            <div className="flex justify-between items-center py-3 border-b">
              <div>
                <span className="text-sm font-medium">Costo Base</span>
                <div className="text-xs text-gray-500">Equipo + Plantilla</div>
              </div>
              <span className="text-lg font-mono font-semibold">
                {formatCurrency(baseCost)}
              </span>
            </div>

            {/* Complexity Adjustment */}
            {complexityAdjustment > 0 && (
              <div className="flex justify-between items-center py-3 border-b">
                <div>
                  <span className="text-sm font-medium">Ajuste por Complejidad</span>
                  <div className="text-xs text-gray-500">
                    Total: +{(totalComplexityFactor * 100).toFixed(1)}%
                  </div>
                </div>
                <span className="text-lg font-mono font-semibold text-blue-600">
                  +{formatCurrency(complexityAdjustment)}
                </span>
              </div>
            )}

            {/* Platform Costs */}
            {quotationData.financials.platformCost > 0 && (
              <div className="flex justify-between items-center py-3 border-b">
                <div>
                  <span className="text-sm font-medium">Costo de Plataforma</span>
                  <div className="text-xs text-gray-500">Herramientas y licencias</div>
                </div>
                <span className="text-lg font-mono font-semibold text-orange-600">
                  +{formatCurrency(quotationData.financials.platformCost)}
                </span>
              </div>
            )}

            {/* Markup */}
            <div className="flex justify-between items-center py-3 border-b">
              <div>
                <span className="text-sm font-medium">Margen</span>
                <div className="text-xs text-gray-500">
                  Factor: x{quotationData.financials.marginFactor.toFixed(1)}
                </div>
              </div>
              <span className="text-lg font-mono font-semibold text-green-600">
                +{formatCurrency(markupAmount)}
              </span>
            </div>

            {/* Discount */}
            {quotationData.financials.discount > 0 && (
              <div className="flex justify-between items-center py-3 border-b">
                <div>
                  <span className="text-sm font-medium">Descuento</span>
                  <div className="text-xs text-gray-500">
                    -{quotationData.financials.discount}%
                  </div>
                </div>
                <span className="text-lg font-mono font-semibold text-red-600">
                  -{formatCurrency(totalAmount * (quotationData.financials.discount / 100))}
                </span>
              </div>
            )}

            {/* Total */}
            <div className="flex justify-between items-center py-4 bg-blue-50 rounded-lg px-4">
              <div>
                <span className="text-lg font-semibold text-blue-900">Total</span>
                <div className="text-sm text-blue-600">Cotización final</div>
              </div>
              <span className="text-2xl font-mono font-bold text-blue-900">
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Debug Information (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <Card className="border-dashed border-gray-300">
          <CardHeader>
            <CardTitle className="text-sm text-gray-500">Debug Info</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-500">
            <div>Base Cost: {baseCost}</div>
            <div>Complexity Adjustment: {complexityAdjustment}</div>
            <div>Markup Amount: {markupAmount}</div>
            <div>Total Amount: {totalAmount}</div>
            <div>Team Members: {quotationData.teamMembers.length}</div>
            <div>Complexity Factors: {JSON.stringify(complexityFactors, null, 2)}</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}