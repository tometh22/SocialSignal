import React from "react";
import { useOptimizedQuote } from "@/context/optimized-quote-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Calculator, DollarSign, Users } from "lucide-react";

export default function FinancialReviewSimple() {
  const {
    quotationData,
    baseCost,
    totalAmount,
    saveQuotation,
  } = useOptimizedQuote();

  const handleFinalize = async () => {
    try {
      await saveQuotation('approved');
      console.log('Cotización finalizada exitosamente');
    } catch (error) {
      console.error('Error al finalizar:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return `ARS ${amount.toLocaleString('es-AR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })}`;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Revisión Financiera</h2>
        <p className="text-gray-600">Revisa los detalles financieros antes de finalizar</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Resumen del Equipo */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-blue-600" />
              Equipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-gray-900">
                {quotationData.teamMembers.length}
              </p>
              <p className="text-sm text-gray-600">Miembros del equipo</p>
              {quotationData.teamMembers.map((member, index) => (
                <div key={index} className="text-xs text-gray-500">
                  {member.hours}h × {formatCurrency(member.rate)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Costo Base */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calculator className="h-5 w-5 text-green-600" />
              Costo Base
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(baseCost)}
              </p>
              <p className="text-sm text-gray-600">Costo total del equipo</p>
            </div>
          </CardContent>
        </Card>

        {/* Total Final */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              Total Final
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-emerald-600">
                {formatCurrency(totalAmount)}
              </p>
              <p className="text-sm text-gray-600">Incluye márgenes y ajustes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Información del Proyecto */}
      <Card>
        <CardHeader>
          <CardTitle>Detalles del Proyecto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Cliente:</p>
              <p className="text-gray-900">{quotationData.client?.name || 'No seleccionado'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Proyecto:</p>
              <p className="text-gray-900">{quotationData.project.name || 'Sin nombre'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Tipo:</p>
              <p className="text-gray-900">{quotationData.project.type || 'No especificado'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Moneda:</p>
              <p className="text-gray-900">{quotationData.quotationCurrency}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botón de Finalizar */}
      <div className="flex justify-center pt-6">
        <Button
          onClick={handleFinalize}
          size="lg"
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-12 py-3"
        >
          <CheckCircle className="mr-2 h-5 w-5" />
          Finalizar Cotización
        </Button>
      </div>
    </div>
  );
}