import React, { useEffect } from 'react';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { AlertCircle, Download, Mail, Printer, Share2, Users, Settings, Tag, FileBarChart2, Banknote, PieChart, FileText, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

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

  // Cálculos para costos totales
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

  // Calcular total del equipo
  const teamTotal = quotationData.teamMembers.reduce((sum, member) => sum + member.cost, 0);
  const teamHours = quotationData.teamMembers.reduce((sum, member) => sum + member.hours, 0);
  
  // Funciones para editar miembros del equipo
  const {updateTeamMember, removeTeamMember, addTeamMember, applyRecommendedTeam} = useOptimizedQuote();

  return (
    <div className="p-6 space-y-6 w-full max-w-full">
      {/* Panel principal con pestañas */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="overview" className="text-xs">
            <FileBarChart2 className="h-3.5 w-3.5 mr-1.5 text-primary/70" />
            Resumen Financiero
          </TabsTrigger>
          <TabsTrigger value="details" className="text-xs">
            <PieChart className="h-3.5 w-3.5 mr-1.5 text-primary/70" />
            Desglose de Costos
          </TabsTrigger>
          <TabsTrigger value="team" className="text-xs">
            <Users className="h-3.5 w-3.5 mr-1.5 text-primary/70" />
            Equipo Asignado
          </TabsTrigger>
        </TabsList>
        
        {/* Pestaña de Resumen Financiero */}
        <TabsContent value="overview" className="space-y-4">
          {/* Mini-resumen del proyecto */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-white p-3 border border-gray-100 rounded-md shadow-sm">
              <div className="text-xs text-gray-500 flex items-center mb-1">
                <Info className="h-3 w-3 mr-1 text-primary/70" />
                Cliente
              </div>
              <div className="text-sm font-medium truncate">{quotationData.client?.name || 'No seleccionado'}</div>
            </div>
            
            <div className="bg-white p-3 border border-gray-100 rounded-md shadow-sm">
              <div className="text-xs text-gray-500 flex items-center mb-1">
                <FileText className="h-3 w-3 mr-1 text-primary/70" />
                Proyecto
              </div>
              <div className="text-sm font-medium truncate">{quotationData.project.name || 'Sin nombre'}</div>
            </div>
            
            <div className="bg-white p-3 border border-gray-100 rounded-md shadow-sm">
              <div className="text-xs text-gray-500 flex items-center mb-1">
                <Settings className="h-3 w-3 mr-1 text-primary/70" />
                Plantilla
              </div>
              <div className="text-sm font-medium truncate">{quotationData.template?.name || 'Personalizada'}</div>
            </div>
            
            <div className="bg-white p-3 border border-gray-100 rounded-md shadow-sm">
              <div className="text-xs text-gray-500 flex items-center mb-1">
                <Tag className="h-3 w-3 mr-1 text-primary/70" />
                Complejidad
              </div>
              <div className="flex items-center">
                <Badge className={
                  quotationData.complexity === 'high' ? 'bg-red-100 text-red-800 hover:bg-red-100' :
                  quotationData.complexity === 'medium' ? 'bg-amber-100 text-amber-800 hover:bg-amber-100' :
                  'bg-green-100 text-green-800 hover:bg-green-100'
                }>
                  {quotationData.complexity === 'low' ? 'Baja' :
                   quotationData.complexity === 'medium' ? 'Media' :
                   quotationData.complexity === 'high' ? 'Alta' : 'No definida'}
                </Badge>
              </div>
            </div>
          </div>
          
          {/* Panel de factores financieros y precio final */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Configuración de factores financieros */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center">
                  <Settings className="h-4 w-4 mr-2 text-primary" />
                  Factores Financieros
                </CardTitle>
                <CardDescription>Ajusta los parámetros financieros para la cotización</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3">
                  {/* Costo de plataforma */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <Label htmlFor="platform-cost" className="text-sm font-medium">
                        Costo de Plataforma
                      </Label>
                      <Badge variant="outline" className="text-xs font-normal">
                        {platformCostPercentage.toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="flex space-x-2">
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
                        className="h-8 text-sm"
                      />
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-xs whitespace-nowrap"
                        onClick={() => {
                          const platformCost = quotationData.template?.platformCost || 0;
                          updateFinancials({ platformCost });
                        }}
                      >
                        Valor default
                      </Button>
                    </div>
                    <p className="text-xs text-neutral-500">
                      Licencias y herramientas de análisis necesarias
                    </p>
                  </div>
                  
                  {/* Porcentaje de desviación */}
                  <div className="space-y-1.5 pt-2 border-t border-gray-100">
                    <div className="flex justify-between">
                      <Label htmlFor="deviation" className="text-sm font-medium">
                        Porcentaje de Desviación
                      </Label>
                      <span className="text-xs text-primary font-medium">
                        {quotationData.financials.deviationPercentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">0%</span>
                      <Slider
                        id="deviation"
                        value={[quotationData.financials.deviationPercentage]}
                        min={0}
                        max={20}
                        step={0.5}
                        onValueChange={(value) => {
                          updateFinancials({ deviationPercentage: value[0] });
                        }}
                        className="flex-1"
                      />
                      <span className="text-xs text-gray-500">20%</span>
                    </div>
                    <p className="text-xs text-neutral-500">
                      Ajuste para cubrir posibles contingencias en el proyecto
                    </p>
                  </div>
                  
                  {/* Factor de margen operativo */}
                  <div className="space-y-1.5 pt-2 border-t border-gray-100">
                    <div className="flex justify-between">
                      <Label htmlFor="margin-factor" className="text-sm font-medium">
                        Factor de Margen
                      </Label>
                      <span className="text-xs text-primary font-medium">
                        {quotationData.financials.marginFactor?.toFixed(1) || "1.0"}x
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">1.0x</span>
                      <Slider
                        id="margin-factor"
                        value={[quotationData.financials.marginFactor || 1.0]}
                        min={1.0}
                        max={5.0}
                        step={0.1}
                        onValueChange={(value) => {
                          updateFinancials({ marginFactor: value[0] });
                        }}
                        className="flex-1"
                      />
                      <span className="text-xs text-gray-500">5.0x</span>
                    </div>
                    <p className="text-xs text-neutral-500">
                      Multiplicador del margen operativo del proyecto
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Precio final y descuento */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center">
                  <Banknote className="h-4 w-4 mr-2 text-primary" />
                  Precio Final
                </CardTitle>
                <CardDescription>Resumen del precio y descuento aplicado</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Resumen de costos */}
                <div className="space-y-4">
                  <div className="p-3 bg-gray-50 rounded-md border border-gray-100">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-600">Subtotal:</span>
                      <span className="text-sm font-medium">{formatCurrency(totalAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <div className="flex items-center">
                        <span className="text-sm text-gray-600">Descuento:</span>
                        <div className="flex items-center space-x-2 ml-2">
                          <Slider
                            id="discount"
                            value={[discountPercentage]}
                            min={0}
                            max={30}
                            step={0.5}
                            className="w-20"
                            onValueChange={(value) => {
                              updateFinancials({ discount: value[0] });
                            }}
                          />
                          <span className="text-xs text-primary font-medium">{discountPercentage.toFixed(1)}%</span>
                        </div>
                      </div>
                      <span className="text-sm text-red-600">-{formatCurrency(discountAmount)}</span>
                    </div>
                    <div className="flex justify-between pt-2 mt-2 border-t border-gray-200">
                      <span className="text-sm font-bold text-gray-800">Total Final:</span>
                      <span className="text-sm font-bold text-primary">{formatCurrency(finalAmount)}</span>
                    </div>
                  </div>

                  {/* Total final destacado */}
                  <div className="bg-primary/5 p-4 rounded-md text-center">
                    <div className="text-sm text-gray-700 mb-1">TOTAL A FACTURAR</div>
                    <div className="text-2xl font-bold text-primary">{formatCurrency(finalAmount)}</div>
                    <div className="text-xs text-gray-500 mt-1">Impuestos incluidos • Validez: 30 días</div>
                  </div>
                  
                  {/* Acciones rápidas */}
                  <div className="flex justify-center space-x-2 pt-2">
                    <Button variant="outline" size="sm" className="text-xs h-8">
                      <Printer className="h-3.5 w-3.5 mr-1" />
                      Imprimir
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-8">
                      <Download className="h-3.5 w-3.5 mr-1" />
                      PDF
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-8">
                      <Mail className="h-3.5 w-3.5 mr-1" />
                      Email
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Pestaña de Desglose de Costos */}
        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center">
                <PieChart className="h-4 w-4 mr-2 text-primary" />
                Desglose Detallado de Costos
              </CardTitle>
              <CardDescription>Análisis completo de los componentes del costo</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="py-2 px-3 text-xs font-medium">Concepto</TableHead>
                    <TableHead className="py-2 px-3 text-xs font-medium">Descripción</TableHead>
                    <TableHead className="py-2 px-3 text-xs font-medium text-right">Monto</TableHead>
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
                      <TableCell className="text-xs text-neutral-600">{item.description}</TableCell>
                      <TableCell className={`text-right font-medium ${item.isSubtotal ? 'font-semibold' : ''}${item.isDeviation ? ' text-purple-700' : ''}`}>
                        {formatCurrency(item.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-primary/5 border-t border-b border-primary/20">
                    <TableCell className="font-bold">PRECIO TOTAL</TableCell>
                    <TableCell className="text-xs">Suma de todos los componentes y ajustes</TableCell>
                    <TableCell className="text-right font-bold text-primary">{formatCurrency(totalAmount)}</TableCell>
                  </TableRow>
                  {discountPercentage > 0 && (
                    <>
                      <TableRow className="bg-red-50">
                        <TableCell className="font-medium text-red-700">Descuento ({discountPercentage.toFixed(1)}%)</TableCell>
                        <TableCell className="text-xs text-red-600">Descuento comercial aplicado</TableCell>
                        <TableCell className="text-right font-medium text-red-700">-{formatCurrency(discountAmount)}</TableCell>
                      </TableRow>
                      <TableRow className="bg-green-50 border-t border-b border-green-200">
                        <TableCell className="font-bold text-green-800">PRECIO FINAL</TableCell>
                        <TableCell className="text-xs text-green-700">Precio con descuento aplicado</TableCell>
                        <TableCell className="text-right font-bold text-green-800">{formatCurrency(finalAmount)}</TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
              
              {/* Gráfico simplificado de costos */}
              <div className="mt-4 p-3 bg-gray-50 rounded-md">
                <div className="text-xs font-medium text-gray-700 mb-2">Distribución de Costos</div>
                <div className="h-6 w-full bg-gray-200 rounded overflow-hidden flex">
                  <div 
                    className="h-full bg-blue-500 transition-all"
                    style={{width: `${(baseCost / totalAmount) * 100}%`}}
                    title={`Costo Base: ${formatCurrency(baseCost)}`}
                  ></div>
                  <div 
                    className="h-full bg-amber-500 transition-all"
                    style={{width: `${(complexityAdjustment / totalAmount) * 100}%`}}
                    title={`Ajuste por Complejidad: ${formatCurrency(complexityAdjustment)}`}
                  ></div>
                  <div 
                    className="h-full bg-green-500 transition-all"
                    style={{width: `${(quotationData.financials.platformCost / totalAmount) * 100}%`}}
                    title={`Costo de Plataforma: ${formatCurrency(quotationData.financials.platformCost)}`}
                  ></div>
                  <div 
                    className="h-full bg-indigo-500 transition-all"
                    style={{width: `${(markupAmount / totalAmount) * 100}%`}}
                    title={`Margen Operativo: ${formatCurrency(markupAmount)}`}
                  ></div>
                </div>
                <div className="flex text-xs mt-2 justify-between text-gray-600">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-1"></div>
                    <span>Costo Base</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-amber-500 rounded-full mr-1"></div>
                    <span>Complejidad</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                    <span>Plataforma</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full mr-1"></div>
                    <span>Margen</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Pestaña de Equipo Asignado */}
        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-base flex items-center">
                    <Users className="h-4 w-4 mr-2 text-primary" />
                    Equipo Asignado al Proyecto
                  </CardTitle>
                  <CardDescription>Integrantes del equipo y sus roles</CardDescription>
                </div>
                <div className="flex space-x-4">
                  <div className="text-center">
                    <div className="text-xs text-gray-500">Integrantes</div>
                    <div className="text-sm font-medium">{quotationData.teamMembers.length}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500">Total Horas</div>
                    <div className="text-sm font-medium">{teamHours}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500">Costo</div>
                    <div className="text-sm font-medium text-primary">{formatCurrency(teamTotal)}</div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {quotationData.teamMembers.length > 0 ? (
                <div className="overflow-x-auto border rounded-md mb-4">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="py-2 px-3 text-xs font-medium">Rol</TableHead>
                        <TableHead className="py-2 px-3 text-xs font-medium">Personal</TableHead>
                        <TableHead className="py-2 px-3 text-xs font-medium text-right">Horas</TableHead>
                        <TableHead className="py-2 px-3 text-xs font-medium text-right">Tarifa</TableHead>
                        <TableHead className="py-2 px-3 text-xs font-medium text-right">Costo</TableHead>
                        <TableHead className="py-2 px-3 text-xs font-medium text-center w-20">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quotationData.teamMembers.map((member, index) => {
                        const role = availableRoles?.find((r: {id: number}) => r.id === member.roleId);
                        const person = availablePersonnel?.find((p: {id: number}) => p.id === member.personnelId);
                        
                        return (
                          <TableRow key={index} className="hover:bg-gray-50 group">
                            <TableCell className="py-1.5 px-3 text-xs font-medium">{role?.name || 'Rol no especificado'}</TableCell>
                            <TableCell className="py-1.5 px-3 text-xs">{person?.name || 'No asignado'}</TableCell>
                            <TableCell className="py-1.5 px-3 text-xs text-right">
                              <Input
                                type="number"
                                value={member.hours}
                                onChange={(e) => {
                                  const hours = parseInt(e.target.value) || 0;
                                  updateTeamMember(member.id, { 
                                    hours: hours,
                                    cost: hours * member.rate
                                  });
                                }}
                                className="h-6 text-xs px-2 py-1 w-16 inline-block text-right"
                                min="1"
                              />
                            </TableCell>
                            <TableCell className="py-1.5 px-3 text-xs text-right">
                              <Input
                                type="number"
                                value={member.rate}
                                onChange={(e) => {
                                  const rate = parseFloat(e.target.value) || 0;
                                  updateTeamMember(member.id, { 
                                    rate: rate,
                                    cost: member.hours * rate
                                  });
                                }}
                                className="h-6 text-xs px-2 py-1 w-16 inline-block text-right"
                                min="0"
                                step="0.01"
                              />
                            </TableCell>
                            <TableCell className="py-1.5 px-3 text-xs text-right font-medium">
                              ${member.cost.toFixed(2)}
                            </TableCell>
                            <TableCell className="py-1.5 px-2 text-center">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => removeTeamMember(member.id)}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
                                  <path d="M3 6h18"></path>
                                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                </svg>
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="bg-gray-50 border-t">
                        <TableCell colSpan={2} className="py-1.5 px-3 text-xs font-medium">TOTALES</TableCell>
                        <TableCell className="py-1.5 px-3 text-xs text-right font-medium">{teamHours}</TableCell>
                        <TableCell className="py-1.5 px-3 text-xs text-right"></TableCell>
                        <TableCell className="py-1.5 px-3 text-xs text-right font-medium">${teamTotal.toFixed(2)}</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center text-sm text-gray-500 py-8 border rounded-md mb-4">
                  No hay miembros en el equipo asignado.
                </div>
              )}
              
              {/* Controles para agregar roles y actualizar equipo */}
              <div className="flex justify-between items-center mb-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs h-7"
                  onClick={applyRecommendedTeam}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1 text-primary">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                  Recomendar equipo óptimo
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs h-7 text-green-600 border-green-200 hover:bg-green-50"
                  onClick={() => {
                    if (availableRoles && availableRoles.length > 0) {
                      // Encontrar el primer rol disponible y el primer personal
                      const firstRole = availableRoles[0];
                      const firstPersonId = availablePersonnel && availablePersonnel.length > 0 
                        ? availablePersonnel[0].id 
                        : null;
                        
                      // Calcular tarifa y costo
                      const rate = firstRole.defaultRate || 10;
                      const hours = 10;
                      
                      // Añadir con valores por defecto
                      addTeamMember({
                        roleId: firstRole.id,
                        personnelId: firstPersonId,
                        hours: hours,
                        rate: rate,
                        cost: hours * rate
                      });
                    }
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1 text-green-600">
                    <path d="M12 5v14"></path>
                    <path d="M5 12h14"></path>
                  </svg>
                  Agregar rol
                </Button>
              </div>
              
              {/* Análisis del equipo */}
              <div className="mt-4 p-3 bg-blue-50 rounded-md border border-blue-100">
                <div className="flex items-center text-sm font-medium text-blue-800 mb-1">
                  <Info className="h-4 w-4 mr-1.5" />
                  Análisis de Costos
                </div>
                <p className="text-xs text-blue-700">
                  El costo del equipo ({formatCurrency(teamTotal)}) representa el {((teamTotal / totalAmount) * 100).toFixed(0)}% del costo total 
                  del proyecto. Incluye {quotationData.teamMembers.length} roles distribuidos en {teamHours} horas totales, 
                  con una tarifa promedio de {formatCurrency(teamHours > 0 ? teamTotal / teamHours : 0)} por hora.
                </p>
              </div>
            </CardContent>
          </Card>
          
          {/* Información de contacto */}
          {quotationData.client && (
            <Card className="bg-slate-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center">
                  <Mail className="h-4 w-4 mr-2 text-primary" />
                  Información de Contacto
                </CardTitle>
                <CardDescription>Datos para el envío de la cotización</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-xs text-gray-500">Contacto:</span>
                      <div className="font-medium">{quotationData.client.contactName || 'No especificado'}</div>
                    </div>
                    {quotationData.client.contactEmail && (
                      <div>
                        <span className="text-xs text-gray-500">Email:</span>
                        <div className="font-medium">{quotationData.client.contactEmail}</div>
                      </div>
                    )}
                    {quotationData.client.contactPhone && (
                      <div>
                        <span className="text-xs text-gray-500">Teléfono:</span>
                        <div className="font-medium">{quotationData.client.contactPhone}</div>
                      </div>
                    )}
                    <div>
                      <span className="text-xs text-gray-500">Empresa:</span>
                      <div className="font-medium">{quotationData.client.name}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
          
      {/* Alerta de notas de personalización */}
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
    </div>
  );
};

export default OptimizedFinancialReview;