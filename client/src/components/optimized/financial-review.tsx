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
    totalAmount,
    availableRoles,
    availablePersonnel
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

  // Lista de conceptos de costo con cálculos mejorados
  const costBreakdown = React.useMemo(() => {
    // Cálculo del costo operativo (costo base + ajuste de complejidad + plataforma)
    const baseCostWithAdjustment = baseCost + complexityAdjustment;
    const operativeCost = baseCostWithAdjustment + quotationData.financials.platformCost;
    
    // Cálculo del porcentaje de margen basado en el factor
    const marginFactor = quotationData.financials.marginFactor || 1.0;
    const marginPercentage = ((marginFactor - 1.0) * 100).toFixed(1);
    
    // Cálculo del monto de desviación
    const deviationPercentage = quotationData.financials.deviationPercentage;
    const subtotalWithMargin = operativeCost + markupAmount;
    const deviationAmount = (subtotalWithMargin * deviationPercentage) / 100;
    
    return [
      {
        name: 'Costo Base',
        description: 'Costo base asociado al equipo de trabajo asignado',
        amount: baseCost
      },
      {
        name: 'Ajuste por Complejidad',
        description: 'Ajuste basado en la complejidad del proyecto y sus factores',
        amount: complexityAdjustment
      },
      {
        name: 'Costo de Plataforma',
        description: 'Costos asociados a licencias y herramientas de análisis',
        amount: quotationData.financials.platformCost
      },
      {
        name: 'Subtotal Operativo',
        description: 'Suma de todos los costos operativos del proyecto',
        amount: operativeCost,
        isSubtotal: true
      },
      {
        name: `Margen Operativo (${marginPercentage}%)`,
        description: `Margen aplicado al costo operativo total con factor ${marginFactor}x`,
        amount: markupAmount
      },
      {
        name: 'Subtotal con Margen',
        description: 'Costos operativos más margen de ganancia',
        amount: subtotalWithMargin,
        isSubtotal: true
      },
      {
        name: `Desviación (${deviationPercentage.toFixed(1)}%)`,
        description: 'Ajuste para cubrir posibles contingencias y desviaciones',
        amount: deviationAmount,
        isDeviation: true
      }
    ];
  }, [
    baseCost, 
    complexityAdjustment, 
    quotationData.financials.platformCost,
    quotationData.financials.marginFactor,
    quotationData.financials.deviationPercentage,
    markupAmount
  ]);

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
              <p className="text-sm text-neutral-600">{quotationData.projectName || 'Sin nombre'}</p>
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

      {/* Configuración de costos adicionales y detalle del equipo en un sólo componente */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Configuración Financiera y Equipo</CardTitle>
          <CardDescription>Ajusta costos adicionales y visualiza el detalle del equipo asignado</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Ajustes financieros */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-gray-50 rounded-md border border-gray-100">
            {/* Costo de plataforma */}
            <div className="space-y-2">
              <Label htmlFor="platform-cost" className="text-sm font-medium">
                Costo de Plataforma ({platformCostPercentage.toFixed(1)}%)
              </Label>
              <Input
                id="platform-cost"
                type="number"
                min="0"
                step="0.01"
                value={quotationData.financials.platformCost}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  updateFinancials({ platformCost: isNaN(value) ? 0 : value });
                  setTimeout(() => {
                    const event = new Event('input', { bubbles: true });
                    e.target.dispatchEvent(event);
                  }, 50);
                }}
                onBlur={(e) => {
                  const value = parseFloat(e.target.value);
                  updateFinancials({ platformCost: isNaN(value) ? 0 : value });
                }}
                className="h-9 transition-all focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-neutral-500">
                Licencias y herramientas de análisis
              </p>
            </div>
            
            {/* Porcentaje de desviación */}
            <div className="space-y-2">
              <Label htmlFor="deviation" className="text-sm font-medium">
                Porcentaje de Desviación
              </Label>
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
                  setTimeout(() => {
                    const event = new Event('input', { bubbles: true });
                    e.target.dispatchEvent(event);
                  }, 50);
                }}
                onBlur={(e) => {
                  const value = parseFloat(e.target.value);
                  updateFinancials({ deviationPercentage: isNaN(value) ? 0 : value });
                }}
                className="h-9 transition-all focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-neutral-500">
                Ajuste para posibles contingencias
              </p>
            </div>
            
            {/* Factor de margen operativo */}
            <div className="space-y-2">
              <Label htmlFor="margin-factor" className="text-sm font-medium">
                Factor de Margen: {quotationData.financials.marginFactor?.toFixed(1) || "1.0"}x
              </Label>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">1.0x</span>
                <Slider
                  id="margin-factor"
                  value={[quotationData.financials.marginFactor || 1.0]}
                  min={1.0}
                  max={10.0}
                  step={0.1}
                  onValueChange={(value) => {
                    updateFinancials({ marginFactor: value[0] });
                    setTimeout(() => {
                      const event = new Event('change', { bubbles: true });
                      document.getElementById('margin-factor')?.dispatchEvent(event);
                    }, 50);
                  }}
                  className="flex-1 focus:ring-2 focus:ring-primary"
                />
                <span className="text-xs text-gray-500">10.0x</span>
              </div>
              <p className="text-xs text-neutral-500">
                Multiplicador del margen operativo
              </p>
            </div>
          </div>
          
          {/* Detalle del equipo */}
          <div className="mt-4 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium flex items-center text-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary mr-1">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                Detalle del Equipo Asignado
              </h3>
              <span className="text-xs text-slate-500">Total: ${baseCost.toFixed(2)}</span>
            </div>
            
            {quotationData.teamMembers.length > 0 ? (
              <div className="overflow-x-auto max-h-56 border border-gray-100 rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="py-2 px-3 text-xs font-medium">Rol</TableHead>
                      <TableHead className="py-2 px-3 text-xs font-medium">Personal</TableHead>
                      <TableHead className="py-2 px-3 text-xs font-medium text-right">Horas</TableHead>
                      <TableHead className="py-2 px-3 text-xs font-medium text-right">Tarifa</TableHead>
                      <TableHead className="py-2 px-3 text-xs font-medium text-right">Costo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotationData.teamMembers.map((member, index) => {
                      const role = availableRoles?.find((r: {id: number}) => r.id === member.roleId);
                      const person = availablePersonnel?.find((p: {id: number}) => p.id === member.personnelId);
                      
                      return (
                        <TableRow key={index} className="hover:bg-gray-50">
                          <TableCell className="py-1.5 px-3 text-xs font-medium">{role?.name || 'Rol no especificado'}</TableCell>
                          <TableCell className="py-1.5 px-3 text-xs">{person?.name || 'No asignado'}</TableCell>
                          <TableCell className="py-1.5 px-3 text-xs text-right">{member.hours}</TableCell>
                          <TableCell className="py-1.5 px-3 text-xs text-right">${member.rate.toFixed(2)}</TableCell>
                          <TableCell className="py-1.5 px-3 text-xs text-right font-medium">${member.cost.toFixed(2)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-3 text-gray-500 text-sm border border-gray-100 rounded-md">
                <p>No hay miembros en el equipo asignado.</p>
                <p className="text-xs mt-1">Regresa al paso anterior para configurar el equipo.</p>
              </div>
            )}
            <p className="text-xs mt-1 text-slate-500 italic">
              Nota: El costo base del proyecto se deriva de la suma de los costos del equipo asignado.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Desglose de costos - Puesto en tercer lugar */}
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
                <TableRow 
                  key={index} 
                  className={
                    item.isSubtotal ? 'bg-slate-100 border-t border-b border-slate-200' : 
                    item.isDeviation ? 'bg-purple-50' :
                    item.name.includes('Margen Operativo') ? 'bg-blue-50' :
                    item.name === 'Ajuste por Complejidad' ? 'bg-amber-50' : ''
                  }
                >
                  <TableCell className={`font-medium ${item.isSubtotal ? 'font-semibold' : ''}`}>
                    {item.name}
                  </TableCell>
                  <TableCell className="text-sm text-neutral-600">{item.description}</TableCell>
                  <TableCell className={`text-right font-medium ${item.isSubtotal ? 'font-semibold' : ''}${item.isDeviation ? ' text-purple-700' : ''}`}>
                    {formatCurrency(item.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Precio final y descuento - Ubicado al final */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Precio Final</CardTitle>
          <CardDescription>Ajuste el descuento y vea el total final</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 p-3 rounded-md border border-gray-100 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Subtotal */}
              <div className="col-span-2">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Subtotal:</span>
                  <span className="text-sm font-medium">{formatCurrency(totalAmount)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-700">Descuento ({discountPercentage.toFixed(1)}%):</span>
                  <span className="text-sm text-red-600">-{formatCurrency(discountAmount)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="text-sm font-bold text-gray-900">Total Final:</span>
                  <span className="text-sm font-bold text-primary">{formatCurrency(finalAmount)}</span>
                </div>
              </div>
              
              {/* Slider de descuento */}
              <div className="space-y-2">
                <Label htmlFor="discount" className="text-sm font-medium">
                  Ajustar Descuento
                </Label>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500">0%</span>
                  <Slider
                    id="discount"
                    value={[discountPercentage]}
                    min={0}
                    max={30}
                    step={0.5}
                    onValueChange={(value) => {
                      updateFinancials({ discount: value[0] });
                      setTimeout(() => {
                        const event = new Event('change', { bubbles: true });
                        document.getElementById('discount')?.dispatchEvent(event);
                      }, 50);
                    }}
                    className="flex-1 focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-xs text-gray-500">30%</span>
                </div>
                <p className="text-xs text-neutral-500">
                  Ajusta el descuento aplicado al precio total
                </p>
              </div>
            </div>
          </div>
          
          {/* Total final destacado */}
          <div className="bg-primary bg-opacity-5 p-4 rounded-md text-center">
            <div className="text-lg text-gray-700 mb-1">Total a Facturar</div>
            <div className="text-3xl font-bold text-primary mb-1">{formatCurrency(finalAmount)}</div>
            <div className="text-xs text-gray-500">Todos los impuestos incluidos</div>
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