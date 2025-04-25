import React from 'react';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { AlertCircle, Download, FileText, Mail, Printer, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const OptimizedFinancialReview: React.FC = () => {
  const {
    quotationData,
    updateFinancials,
    baseCost,
    complexityAdjustment,
    markupAmount,
    totalAmount
  } = useOptimizedQuote();

  // Formatear moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Calcular porcentajes para comparativas
  const platformCostPercentage = quotationData.financials.platformCost > 0 
    ? (quotationData.financials.platformCost / baseCost) * 100 
    : 0;

  const discountPercentage = quotationData.financials.discount;
  const discountAmount = (totalAmount * discountPercentage) / 100;
  const finalAmount = totalAmount - discountAmount;

  // Lista de conceptos de costo
  const costBreakdown = [
    {
      name: 'Costo Base',
      description: 'Costo inicial basado en la plantilla seleccionada y el equipo asignado',
      amount: baseCost
    },
    {
      name: 'Ajuste por Complejidad',
      description: 'Ajuste basado en la complejidad del proyecto y la plantilla',
      amount: complexityAdjustment
    },
    {
      name: 'Costo de Plataforma',
      description: 'Costos asociados a licencias y herramientas de análisis',
      amount: quotationData.financials.platformCost
    },
    {
      name: 'Margen Operativo',
      description: 'Margen operativo aplicado sobre el total de costos',
      amount: markupAmount
    }
  ];

  return (
    <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-2">
      <div className="mb-2">
        <h2 className="text-lg font-semibold">Revisión Financiera</h2>
        <p className="text-sm text-neutral-500">
          Revisa y ajusta los aspectos financieros de la cotización.
        </p>
      </div>

      {/* Resumen del proyecto */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center">
            <FileText className="h-4 w-4 mr-2 text-primary" />
            Resumen del Proyecto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-neutral-700">Cliente:</p>
              <p className="text-sm text-neutral-600">{quotationData.client?.name || 'No seleccionado'}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-neutral-700">Nombre del Proyecto:</p>
              <p className="text-sm text-neutral-600">{quotationData.project.name || 'Sin nombre'}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-neutral-700">Plantilla:</p>
              <p className="text-sm text-neutral-600">{quotationData.template?.name || 'No seleccionada'}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-neutral-700">Complejidad:</p>
              <p className="text-sm text-neutral-600">
                {quotationData.complexity === 'low' ? 'Baja' :
                 quotationData.complexity === 'medium' ? 'Media' :
                 quotationData.complexity === 'high' ? 'Alta' : 'No definida'}
              </p>
            </div>
            <div className="space-y-2 col-span-2">
              <p className="text-sm font-medium text-neutral-700">Miembros del Equipo:</p>
              <p className="text-sm text-neutral-600">
                {quotationData.teamMembers.length} miembros •
                {quotationData.teamMembers.reduce((sum, member) => sum + member.hours, 0)} horas totales
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Desglose de costos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Desglose de Costos</CardTitle>
          <CardDescription>Detalle de todos los conceptos incluidos</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Concepto</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costBreakdown.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-sm text-neutral-600">{item.description}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Subtotal y descuento */}
          <div className="mt-4 border-t pt-4">
            <div className="flex justify-between items-center mb-3">
              <span className="font-medium">Subtotal:</span>
              <span className="text-lg">{formatCurrency(totalAmount)}</span>
            </div>
            
            <div className="space-y-4 mb-4">
              <div className="flex justify-between items-center">
                <Label htmlFor="discount" className="flex items-center">
                  Descuento ({discountPercentage.toFixed(1)}%):
                </Label>
                <span className="text-neutral-700">{formatCurrency(discountAmount)}</span>
              </div>
              <Slider
                id="discount"
                value={[discountPercentage]}
                min={0}
                max={30}
                step={0.5}
                onValueChange={(value) => updateFinancials({ discount: value[0] })}
                className="max-w-md"
              />
            </div>
            
            <div className="flex justify-between items-center border-t pt-4">
              <span className="font-bold text-lg">Total Final:</span>
              <span className="font-bold text-xl text-primary">{formatCurrency(finalAmount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuración de costos adicionales */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Costos Adicionales y Ajustes</CardTitle>
          <CardDescription>Personaliza los costos adicionales del proyecto</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Costo de plataforma */}
            <div className="space-y-3">
              <Label htmlFor="platform-cost">Costo de Plataforma ({platformCostPercentage.toFixed(1)}% del costo base)</Label>
              <Input
                id="platform-cost"
                type="number"
                min="0"
                step="0.01"
                value={quotationData.financials.platformCost}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  updateFinancials({ platformCost: isNaN(value) ? 0 : value });
                }}
              />
              <p className="text-xs text-neutral-500">
                Costos asociados a licencias de software, herramientas de análisis y servicios en la nube.
              </p>
            </div>
            
            {/* Porcentaje de desviación */}
            <div className="space-y-3">
              <Label htmlFor="deviation">Porcentaje de Desviación</Label>
              <Input
                id="deviation"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={quotationData.financials.deviationPercentage}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  updateFinancials({ deviationPercentage: isNaN(value) ? 0 : value });
                }}
              />
              <p className="text-xs text-neutral-500">
                Margen adicional para cubrir posibles desviaciones durante la ejecución del proyecto.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Acciones adicionales */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="space-x-2">
          <Button variant="outline" className="flex items-center">
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
          <Button variant="outline" className="flex items-center">
            <Download className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
        </div>
        
        <div className="space-x-2">
          <Button variant="outline" className="flex items-center">
            <Mail className="h-4 w-4 mr-2" />
            Enviar por Email
          </Button>
          <Button variant="outline" className="flex items-center">
            <Share2 className="h-4 w-4 mr-2" />
            Compartir
          </Button>
        </div>
      </div>

      {/* Notas adicionales */}
      {quotationData.template && !quotationData.customization && (
        <Alert className="bg-amber-50 text-amber-800 border-amber-200">
          <AlertCircle className="h-4 w-4 mr-2" />
          <AlertTitle>Personalización no especificada</AlertTitle>
          <AlertDescription>
            No has agregado notas de personalización para este proyecto. 
            Considera regresar al Paso 2 para agregar detalles específicos.
          </AlertDescription>
        </Alert>
      )}

      {/* Información de contacto */}
      {quotationData.client && (
        <Card className="bg-slate-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Información de Contacto</CardTitle>
            <CardDescription>Datos para el envío de la cotización</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm">
                <span className="font-medium">Contacto:</span> {quotationData.client.contactName || 'No especificado'}
              </p>
              {quotationData.client.contactEmail && (
                <p className="text-sm">
                  <span className="font-medium">Email:</span> {quotationData.client.contactEmail}
                </p>
              )}
              {quotationData.client.contactPhone && (
                <p className="text-sm">
                  <span className="font-medium">Teléfono:</span> {quotationData.client.contactPhone}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OptimizedFinancialReview;