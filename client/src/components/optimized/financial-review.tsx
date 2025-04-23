import React, { useState } from 'react';
import { useQuoteContext } from '@/context/quote-context';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { formatCurrency } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { Role, Personnel, Client } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer 
} from 'recharts';
import { 
  FileText, 
  DollarSign, 
  Calendar, 
  Users, 
  BarChart3, 
  Check, 
  Download,
  Save
} from 'lucide-react';

// Componente para el Paso 4: Revisión y Ajustes Financieros
const OptimizedFinancialReview: React.FC = () => {
  const {
    quotationData,
    baseCost,
    complexityAdjustment,
    markupAmount,
    totalAmount,
    recommendedRoleIds,
    updateFinancials,
    availableRoles,
    availablePersonnel,
    saveQuotation
  } = useOptimizedQuote();
  
  const [activeTab, setActiveTab] = useState('summary');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  
  // Obtener roles y personal si no están disponibles en el contexto
  const { data: rolesData } = useQuery<Role[]>({
    queryKey: ['/api/roles'],
    enabled: !availableRoles,
  });
  
  const { data: personnelData } = useQuery<Personnel[]>({
    queryKey: ['/api/personnel'],
    enabled: !availablePersonnel,
  });
  
  // Obtener cliente si es necesario
  const { data: clientData } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
    enabled: !!quotationData.client,
  });
  
  // Usar datos del contexto o de las consultas
  const roles = availableRoles || rolesData;
  const personnel = availablePersonnel || personnelData;
  
  // Manejar cambios en los ajustes financieros
  const handleFinancialChange = (field: keyof typeof quotationData.financials, value: number) => {
    updateFinancials({ [field]: value });
  };
  
  // Manejar exportación a PDF
  const handleExportPDF = () => {
    toast({
      title: "Exportación a PDF",
      description: "La funcionalidad de exportación a PDF estará disponible próximamente.",
    });
  };
  
  // Manejar guardado de cotización
  const handleSaveQuotation = async () => {
    setIsSaving(true);
    try {
      const quotationId = await saveQuotation();
      toast({
        title: "Cotización guardada",
        description: `La cotización ha sido guardada con éxito (ID: ${quotationId}).`,
      });
    } catch (error) {
      toast({
        title: "Error al guardar",
        description: "No se pudo guardar la cotización. Por favor, intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Preparar datos para el gráfico de desglose de costos
  const costBreakdownData = [
    { name: 'Costo Base', value: baseCost },
    { name: 'Ajuste por Complejidad', value: complexityAdjustment },
    { name: 'Margen Estándar', value: markupAmount },
    { name: 'Costo de Plataformas', value: quotationData.financials.platformCost },
    { name: 'Ajuste por Desvío', value: totalAmount * (quotationData.financials.deviationPercentage / 100) },
  ];
  
  // Calcular subtotal sin descuento
  const subtotalBeforeDiscount = costBreakdownData.reduce((sum, item) => sum + item.value, 0);
  
  // Calcular importe del descuento
  const discountAmount = subtotalBeforeDiscount * (quotationData.financials.discount / 100);
  
  // Validar si tenemos todos los datos mínimos necesarios
  const hasRequiredData = 
    quotationData.client && 
    quotationData.project.name && 
    quotationData.template && 
    quotationData.teamMembers.length > 0;
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Revisión y Ajustes Financieros</h2>
          <p className="text-sm text-neutral-500">
            Revisa los detalles de la cotización y realiza ajustes finales antes de finalizar.
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExportPDF}
            className="flex items-center"
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>
          
          <Button
            onClick={handleSaveQuotation}
            disabled={isSaving || !hasRequiredData}
            className="flex items-center bg-green-600 hover:bg-green-700"
          >
            <Save className="mr-2 h-4 w-4" />
            Guardar Cotización
          </Button>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 mb-6">
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Resumen
          </TabsTrigger>
          <TabsTrigger value="financial" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Ajustes Financieros
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Vista Previa
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="summary" className="space-y-6">
          {/* Datos básicos */}
          <Card>
            <CardHeader>
              <CardTitle>Información del Proyecto</CardTitle>
              <CardDescription>
                Datos básicos de la cotización
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm text-neutral-500">Cliente</Label>
                  <p className="font-medium">{quotationData.client?.name || 'No seleccionado'}</p>
                  {quotationData.client?.contactName && (
                    <p className="text-sm text-neutral-600 mt-1">
                      Contacto: {quotationData.client.contactName}
                    </p>
                  )}
                </div>
                
                <div>
                  <Label className="text-sm text-neutral-500">Nombre del Proyecto</Label>
                  <p className="font-medium">{quotationData.project.name || 'Sin nombre'}</p>
                  {quotationData.project.type && (
                    <p className="text-sm text-neutral-600 mt-1">
                      Tipo: {quotationData.project.type}
                    </p>
                  )}
                </div>
                
                <div>
                  <Label className="text-sm text-neutral-500">Plantilla</Label>
                  <p className="font-medium">{quotationData.template?.name || 'No seleccionada'}</p>
                  {quotationData.template?.complexity && (
                    <p className="text-sm text-neutral-600 mt-1">
                      Complejidad: {quotationData.template.complexity === 'high' ? 'Alta' : 
                                   quotationData.template.complexity === 'medium' ? 'Media' : 'Baja'}
                    </p>
                  )}
                </div>
                
                <div>
                  <Label className="text-sm text-neutral-500">Duración</Label>
                  <p className="font-medium">
                    {quotationData.project.duration === 'short' ? 'Corto Plazo (1-4 semanas)' : 
                     quotationData.project.duration === 'medium' ? 'Medio Plazo (1-3 meses)' : 
                     quotationData.project.duration === 'long' ? 'Largo Plazo (+3 meses)' : 'No especificada'}
                  </p>
                </div>
              </div>
              
              {quotationData.customization && (
                <div className="mt-4 pt-4 border-t">
                  <Label className="text-sm text-neutral-500">Notas de Personalización</Label>
                  <p className="text-sm mt-1">{quotationData.customization}</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Equipo */}
          <Card>
            <CardHeader>
              <CardTitle>Equipo del Proyecto</CardTitle>
              <CardDescription>
                Roles y recursos asignados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {quotationData.teamMembers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rol</TableHead>
                      <TableHead>Miembro</TableHead>
                      <TableHead>Horas</TableHead>
                      <TableHead>Tarifa</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotationData.teamMembers.map(member => {
                      const role = roles?.find(r => r.id === member.roleId);
                      const person = personnel?.find(p => p.id === member.personnelId);
                      
                      return (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">{role?.name || 'Rol desconocido'}</TableCell>
                          <TableCell>{person?.name || 'No asignado'}</TableCell>
                          <TableCell>{member.hours}h</TableCell>
                          <TableCell>{formatCurrency(member.rate)}/h</TableCell>
                          <TableCell className="text-right">{formatCurrency(member.cost)}</TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow>
                      <TableCell colSpan={4} className="font-medium text-right">Total</TableCell>
                      <TableCell className="font-medium text-right">{formatCurrency(baseCost)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-4">
                  <p className="text-neutral-500">No hay miembros en el equipo.</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Costos */}
          <Card>
            <CardHeader>
              <CardTitle>Resumen de Costos</CardTitle>
              <CardDescription>
                Desglose detallado de costos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-neutral-600">Costo Base</span>
                      <span className="font-medium">{formatCurrency(baseCost)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-neutral-600">Ajuste por Complejidad</span>
                      <span className="font-medium">{formatCurrency(complexityAdjustment)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-neutral-600">Margen Estándar (2×)</span>
                      <span className="font-medium">{formatCurrency(markupAmount)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-neutral-600">Costo de Plataformas</span>
                      <span className="font-medium">{formatCurrency(quotationData.financials.platformCost)}</span>
                    </div>
                    
                    {quotationData.financials.deviationPercentage > 0 && (
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-neutral-600">
                          Ajuste por Desvío ({quotationData.financials.deviationPercentage}%)
                        </span>
                        <span className="font-medium">
                          {formatCurrency(totalAmount * (quotationData.financials.deviationPercentage / 100))}
                        </span>
                      </div>
                    )}
                    
                    {quotationData.financials.discount > 0 && (
                      <div className="flex justify-between items-center py-2 border-b text-green-600">
                        <span>
                          Descuento ({quotationData.financials.discount}%)
                        </span>
                        <span className="font-medium">
                          -{formatCurrency(discountAmount)}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center py-3 font-semibold text-lg">
                      <span>Total</span>
                      <span>{formatCurrency(totalAmount)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={costBreakdownData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <RechartsTooltip formatter={(value) => formatCurrency(value as number)} />
                      <Bar dataKey="value" fill="#3b82f6" name="Importe" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="financial" className="space-y-6">
          {/* Ajustes financieros */}
          <Card>
            <CardHeader>
              <CardTitle>Ajustes Financieros</CardTitle>
              <CardDescription>
                Personaliza los parámetros financieros de la cotización
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Costo de plataformas */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label htmlFor="platformCost">Costo de Plataformas</Label>
                  <div className="w-32">
                    <Input
                      id="platformCost"
                      type="number"
                      value={quotationData.financials.platformCost}
                      onChange={(e) => handleFinancialChange('platformCost', parseFloat(e.target.value) || 0)}
                      className="text-right"
                    />
                  </div>
                </div>
                <div className="bg-neutral-100 p-4 rounded-md text-sm">
                  <p className="text-neutral-600">
                    Este costo representa las herramientas de software, suscripciones y servicios
                    necesarios para ejecutar el proyecto. Ejemplos incluyen herramientas de monitoreo,
                    análisis de datos, acceso a APIs, etc.
                  </p>
                </div>
              </div>
              
              {/* Porcentaje de desvío */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label htmlFor="deviationPercentage">Porcentaje de Desvío</Label>
                    <span className="text-sm font-medium">{quotationData.financials.deviationPercentage}%</span>
                  </div>
                  <Slider
                    id="deviationPercentage"
                    min={0}
                    max={30}
                    step={1}
                    value={[quotationData.financials.deviationPercentage]}
                    onValueChange={(value) => handleFinancialChange('deviationPercentage', value[0])}
                  />
                </div>
                <div className="bg-neutral-100 p-4 rounded-md text-sm">
                  <p className="text-neutral-600">
                    El porcentaje de desvío permite ajustar el costo final para compensar riesgos,
                    complejidades no previstas o factores externos que puedan afectar al proyecto.
                    Valores típicos oscilan entre 0-15%.
                  </p>
                </div>
              </div>
              
              {/* Descuento */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label htmlFor="discount">Descuento</Label>
                    <span className="text-sm font-medium">{quotationData.financials.discount}%</span>
                  </div>
                  <Slider
                    id="discount"
                    min={0}
                    max={40}
                    step={1}
                    value={[quotationData.financials.discount]}
                    onValueChange={(value) => handleFinancialChange('discount', value[0])}
                  />
                </div>
                <div className="bg-neutral-100 p-4 rounded-md text-sm">
                  <p className="text-neutral-600">
                    Aplica un descuento porcentual al total de la cotización. Útil para clientes
                    recurrentes, proyectos estratégicos o como incentivo para cerrar la venta.
                    Considera que descuentos superiores al 20% pueden afectar la rentabilidad.
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-blue-50 flex justify-between">
              <span className="text-blue-800 font-medium">Resumen de ajustes financieros</span>
              <span className="text-blue-800 font-medium">
                Total ajustado: {formatCurrency(totalAmount)}
              </span>
            </CardFooter>
          </Card>
          
          {/* Impacto de ajustes */}
          <Card>
            <CardHeader>
              <CardTitle>Impacto en la Cotización</CardTitle>
              <CardDescription>
                Visualiza cómo los ajustes afectan al precio final
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 p-4 rounded-md border border-green-100">
                  <div className="text-xs text-green-600 mb-1">Sin Ajustes</div>
                  <div className="text-xl font-medium text-green-800">
                    {formatCurrency(baseCost + complexityAdjustment + markupAmount)}
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    Costo base + Complejidad + Margen
                  </div>
                </div>
                
                <div className="bg-amber-50 p-4 rounded-md border border-amber-100">
                  <div className="text-xs text-amber-600 mb-1">Con Plataformas y Desvío</div>
                  <div className="text-xl font-medium text-amber-800">
                    {formatCurrency(subtotalBeforeDiscount)}
                  </div>
                  <div className="text-xs text-amber-600 mt-1">
                    Sin aplicar descuentos
                  </div>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
                  <div className="text-xs text-blue-600 mb-1">Precio Final</div>
                  <div className="text-xl font-medium text-blue-800">
                    {formatCurrency(totalAmount)}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    {quotationData.financials.discount > 0 
                      ? `Incluye descuento del ${quotationData.financials.discount}%` 
                      : 'Sin descuentos aplicados'}
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t">
                <h4 className="font-medium mb-2">Análisis de Sensibilidad</h4>
                <p className="text-sm text-neutral-600 mb-4">
                  Cómo cambiaría el precio con diferentes niveles de descuento:
                </p>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descuento</TableHead>
                      <TableHead>Precio Final</TableHead>
                      <TableHead>Diferencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[0, 5, 10, 15, 20].map(discount => {
                      const priceWithDiscount = subtotalBeforeDiscount * (1 - discount / 100);
                      const difference = subtotalBeforeDiscount - priceWithDiscount;
                      
                      return (
                        <TableRow key={discount} className={discount === quotationData.financials.discount ? 'bg-blue-50' : ''}>
                          <TableCell>{discount}%</TableCell>
                          <TableCell>{formatCurrency(priceWithDiscount)}</TableCell>
                          <TableCell className="text-green-600">
                            {discount > 0 ? `-${formatCurrency(difference)}` : '$0.00'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="preview" className="space-y-6">
          {/* Vista previa del documento */}
          <Card>
            <CardHeader>
              <CardTitle>Vista Previa de Documento</CardTitle>
              <CardDescription>
                Así se verá el documento PDF generado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden bg-white">
                {/* Cabecera del documento */}
                <div className="bg-blue-600 text-white p-6">
                  <div className="flex justify-between">
                    <div>
                      <h2 className="text-2xl font-bold">Propuesta de Servicios</h2>
                      <p className="opacity-90">Social Listening Projects</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg">Cotización #{Math.floor(Math.random() * 10000)}</p>
                      <p className="opacity-90">Fecha: {new Date().toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
                
                {/* Información del cliente y proyecto */}
                <div className="p-6 border-b">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-medium text-neutral-500 mb-2">CLIENTE</h3>
                      <p className="font-semibold text-lg">{quotationData.client?.name || 'Cliente no especificado'}</p>
                      {quotationData.client?.contactName && (
                        <p>{quotationData.client.contactName}</p>
                      )}
                      {quotationData.client?.email && (
                        <p>{quotationData.client.email}</p>
                      )}
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-neutral-500 mb-2">PROYECTO</h3>
                      <p className="font-semibold text-lg">{quotationData.project.name || 'Proyecto sin nombre'}</p>
                      <p>Tipo: {quotationData.project.type || 'No especificado'}</p>
                      <p>Duración: {
                        quotationData.project.duration === 'short' ? 'Corto Plazo (1-4 semanas)' : 
                        quotationData.project.duration === 'medium' ? 'Medio Plazo (1-3 meses)' : 
                        quotationData.project.duration === 'long' ? 'Largo Plazo (+3 meses)' : 'No especificada'
                      }</p>
                    </div>
                  </div>
                </div>
                
                {/* Descripción */}
                <div className="p-6 border-b">
                  <h3 className="font-medium text-neutral-500 mb-2">DESCRIPCIÓN DEL SERVICIO</h3>
                  <p className="mb-4">
                    {quotationData.template?.description || 'No se ha seleccionado una plantilla para este proyecto.'}
                  </p>
                  
                  {quotationData.customization && (
                    <div className="mt-3">
                      <h4 className="font-medium">Personalización:</h4>
                      <p className="text-neutral-600">{quotationData.customization}</p>
                    </div>
                  )}
                </div>
                
                {/* Equipo asignado */}
                <div className="p-6 border-b">
                  <h3 className="font-medium text-neutral-500 mb-2">EQUIPO ASIGNADO</h3>
                  
                  {quotationData.teamMembers.length > 0 ? (
                    <table className="min-w-full">
                      <thead className="bg-neutral-50">
                        <tr>
                          <th className="text-left py-2 px-3">Rol</th>
                          <th className="text-left py-2 px-3">Horas</th>
                          <th className="text-left py-2 px-3">Tarifa</th>
                          <th className="text-right py-2 px-3">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quotationData.teamMembers.map((member, index) => {
                          const role = roles?.find(r => r.id === member.roleId);
                          
                          return (
                            <tr key={index} className={index % 2 === 0 ? 'bg-neutral-50' : ''}>
                              <td className="py-2 px-3">{role?.name || 'Rol desconocido'}</td>
                              <td className="py-2 px-3">{member.hours}h</td>
                              <td className="py-2 px-3">${member.rate}/h</td>
                              <td className="text-right py-2 px-3">${member.cost.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-neutral-500">No hay miembros asignados al equipo.</p>
                  )}
                </div>
                
                {/* Resumen financiero */}
                <div className="p-6">
                  <h3 className="font-medium text-neutral-500 mb-4">RESUMEN FINANCIERO</h3>
                  
                  <div className="mb-6">
                    <div className="flex justify-between py-2 border-b">
                      <span>Costo Base de Equipo</span>
                      <span>${baseCost.toFixed(2)}</span>
                    </div>
                    
                    <div className="flex justify-between py-2 border-b">
                      <span>Ajuste por Complejidad</span>
                      <span>${complexityAdjustment.toFixed(2)}</span>
                    </div>
                    
                    <div className="flex justify-between py-2 border-b">
                      <span>Margen Estándar</span>
                      <span>${markupAmount.toFixed(2)}</span>
                    </div>
                    
                    <div className="flex justify-between py-2 border-b">
                      <span>Costo de Plataformas</span>
                      <span>${quotationData.financials.platformCost.toFixed(2)}</span>
                    </div>
                    
                    {quotationData.financials.deviationPercentage > 0 && (
                      <div className="flex justify-between py-2 border-b">
                        <span>Ajuste por Desvío ({quotationData.financials.deviationPercentage}%)</span>
                        <span>${(totalAmount * quotationData.financials.deviationPercentage / 100).toFixed(2)}</span>
                      </div>
                    )}
                    
                    {quotationData.financials.discount > 0 && (
                      <div className="flex justify-between py-2 border-b text-green-600">
                        <span>Descuento ({quotationData.financials.discount}%)</span>
                        <span>-${discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center py-3 text-lg border-t border-b border-blue-500">
                    <span className="font-bold">TOTAL</span>
                    <span className="font-bold">${totalAmount.toFixed(2)}</span>
                  </div>
                </div>
                
                {/* Términos y condiciones */}
                <div className="p-6 text-xs text-neutral-500 border-t">
                  <p className="mb-2">Términos y condiciones:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Esta cotización es válida por 30 días a partir de la fecha de emisión.</li>
                    <li>Los precios no incluyen impuestos aplicables.</li>
                    <li>El cronograma de trabajo se definirá una vez aceptada la propuesta.</li>
                    <li>El pago se realizará en tres etapas: 30% inicial, 40% intermedio y 30% al finalizar.</li>
                  </ul>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={handleExportPDF}>
                <Download className="mr-2 h-4 w-4" />
                Exportar PDF
              </Button>
              
              <Button
                onClick={handleSaveQuotation}
                disabled={isSaving || !hasRequiredData}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="mr-2 h-4 w-4" />
                Finalizar Cotización
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OptimizedFinancialReview;