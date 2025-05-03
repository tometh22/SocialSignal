import React, { useEffect } from 'react';
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
  
  // Usar un efecto para ajustar estilos de scroll
  useEffect(() => {
    // Eliminar cualquier restricción de altura o overflow en los contenedores padres
    const updateScrollStyles = () => {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
      document.documentElement.style.height = 'auto';
      document.body.style.height = 'auto';
    };
    
    updateScrollStyles();
    window.addEventListener('resize', updateScrollStyles);
    
    return () => {
      window.removeEventListener('resize', updateScrollStyles);
    };
  }, []);

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
    <div className="space-y-6 pb-10 w-full">
      <div className="flex items-center space-x-2 mb-4">
        <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">4</div>
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Revisión Financiera</h2>
          <p className="text-sm text-gray-500">
            Revisa y ajusta los aspectos financieros de la cotización.
          </p>
        </div>
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
          <div className="mb-4 bg-gray-50 border border-gray-100 rounded-md p-3">
            <h3 className="font-medium text-blue-700 mb-2 flex items-center">
              <AlertCircle className="h-4 w-4 mr-2" />
              Análisis de Ajustes por Complejidad
            </h3>
            <div className="text-sm text-gray-700 grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 font-medium">Factores que afectan el costo:</p>
                <ul className="list-disc list-inside space-y-1 pl-2">
                  <li>Tipo de análisis: {quotationData.analysisType === 'standard' ? 'Estándar' : quotationData.analysisType === 'deep' ? 'Profundo' : 'Básico'}</li>
                  <li>Volumen de menciones: {quotationData.mentionsVolume === 'small' ? 'Bajo' : quotationData.mentionsVolume === 'medium' ? 'Medio' : 'Alto'}</li>
                  <li>Países cubiertos: {quotationData.countriesCovered === '1' ? 'Un país' : quotationData.countriesCovered === '2-5' ? '2-5 países' : 'Más de 5 países'}</li>
                  <li>Interacción con cliente: {quotationData.clientEngagement === 'low' ? 'Baja' : quotationData.clientEngagement === 'medium' ? 'Media' : 'Alta'}</li>
                </ul>
              </div>
              <div>
                <p className="mb-1 font-medium">Impacto en el costo total:</p>
                <div className="flex items-center justify-between mb-1">
                  <span>Costo Base:</span>
                  <span className="font-medium">{formatCurrency(baseCost)}</span>
                </div>
                <div className="flex items-center justify-between mb-1">
                  <span>Ajuste de Complejidad:</span>
                  <span className="font-medium text-amber-700">{formatCurrency(complexityAdjustment)}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t">
                  <span>Porcentaje de Ajuste:</span>
                  <span className="font-medium">{((complexityAdjustment / baseCost) * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>

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
                <TableRow key={index} className={item.name === 'Ajuste por Complejidad' ? 'bg-amber-50' : ''}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-sm text-neutral-600">{item.description}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(item.amount)}</TableCell>
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
                onValueChange={(value) => {
                  // Actualización inmediata
                  updateFinancials({ discount: value[0] });
                  
                  // Forzar actualización después de que se complete el cambio
                  setTimeout(() => {
                    // Crear y disparar un evento para forzar la actualización de la UI
                    const event = new Event('change', { bubbles: true });
                    document.getElementById('discount')?.dispatchEvent(event);
                  }, 50);
                }}
                className="max-w-md focus:ring-2 focus:ring-primary"
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
                  // Actualización inmediata con actualización forzada
                  updateFinancials({ platformCost: isNaN(value) ? 0 : value });
                  // Forzar recálculo después de un breve momento para asegurar que se propague el cambio
                  setTimeout(() => {
                    const event = new Event('input', { bubbles: true });
                    e.target.dispatchEvent(event);
                  }, 50);
                }}
                // Agregar evento onBlur para garantizar actualización al salir del campo
                onBlur={(e) => {
                  const value = parseFloat(e.target.value);
                  updateFinancials({ platformCost: isNaN(value) ? 0 : value });
                }}
                className="transition-all focus:ring-2 focus:ring-primary"
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
                  // Actualización inmediata con actualización forzada
                  updateFinancials({ deviationPercentage: isNaN(value) ? 0 : value });
                  // Forzar recálculo después de un breve momento para asegurar que se propague el cambio
                  setTimeout(() => {
                    const event = new Event('input', { bubbles: true });
                    e.target.dispatchEvent(event);
                  }, 50);
                }}
                // Agregar evento onBlur para garantizar actualización al salir del campo
                onBlur={(e) => {
                  const value = parseFloat(e.target.value);
                  updateFinancials({ deviationPercentage: isNaN(value) ? 0 : value });
                }}
                className="transition-all focus:ring-2 focus:ring-primary"
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