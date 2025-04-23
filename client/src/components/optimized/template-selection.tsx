import React, { useState } from 'react';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { useQuery } from '@tanstack/react-query';
import { ReportTemplate } from '@shared/schema';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Check, Search, FileText, BarChart } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const OptimizedTemplateSelection: React.FC = () => {
  const {
    quotationData,
    updateTemplate,
    updateComplexity,
    updateCustomization,
    baseCost,
    complexityAdjustment,
    totalAmount
  } = useOptimizedQuote();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('list');

  // Consultar plantillas disponibles
  const { data: templates, isLoading } = useQuery<ReportTemplate[]>({
    queryKey: ['/api/report-templates'],
  });

  // Filtrar plantillas según la búsqueda
  const filteredTemplates = templates?.filter(template => 
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (template.description && template.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Manejar la selección de una plantilla
  const handleTemplateSelect = (template: ReportTemplate) => {
    updateTemplate(template);
  };

  const getComplexityLabel = (complexity: string) => {
    switch (complexity) {
      case 'low': return 'Baja';
      case 'medium': return 'Media';
      case 'high': return 'Alta';
      default: return 'No definida';
    }
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Renderizar una tarjeta de plantilla
  const renderTemplateCard = (template: ReportTemplate) => {
    const isSelected = quotationData.template?.id === template.id;
    
    return (
      <Card 
        key={template.id}
        className={`cursor-pointer transition-all ${isSelected ? 'border-primary ring-2 ring-primary/20' : 'hover:border-gray-300'}`}
        onClick={() => handleTemplateSelect(template)}
      >
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <CardTitle className="text-base">{template.name}</CardTitle>
            <Badge className={`${getComplexityColor(template.complexity)}`}>
              {getComplexityLabel(template.complexity)}
            </Badge>
          </div>
          <CardDescription className="line-clamp-2">
            {template.description || 'Sin descripción'}
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-2 pt-0">
          <div className="text-sm space-y-1">
            {template.pageRange && (
              <div className="flex justify-between">
                <span className="text-neutral-500">Páginas:</span>
                <span>{template.pageRange}</span>
              </div>
            )}
            {template.platformCost !== null && (
              <div className="flex justify-between">
                <span className="text-neutral-500">Costo Plataforma:</span>
                <span>${template.platformCost.toFixed(2)}</span>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="pt-2">
          {isSelected ? (
            <div className="w-full flex items-center justify-center py-1 bg-primary/10 text-primary font-medium rounded-md text-sm">
              <Check className="h-4 w-4 mr-2" />
              Seleccionada
            </div>
          ) : (
            <div className="w-full flex items-center justify-center py-1 border border-dashed border-neutral-300 rounded-md text-neutral-500 text-sm">
              Click para seleccionar
            </div>
          )}
        </CardFooter>
      </Card>
    );
  };

  // Datos para la visualización
  const chartData = [
    { name: 'Costo Base', valor: baseCost },
    { name: 'Ajuste', valor: complexityAdjustment },
    { name: 'Total', valor: totalAmount }
  ];

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <h2 className="text-lg font-semibold">Selección de Plantilla y Configuración</h2>
        <p className="text-sm text-neutral-500">
          Selecciona una plantilla de informe y configura la complejidad del proyecto.
        </p>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="list" className="flex items-center">
            <FileText className="h-4 w-4 mr-2" />
            Lista de Plantillas
          </TabsTrigger>
          <TabsTrigger value="details" className="flex items-center">
            <BarChart className="h-4 w-4 mr-2" />
            Detalles y Ajustes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {/* Buscador */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input
              placeholder="Buscar plantillas..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Opción para no usar plantilla */}
          <Card 
            className={`cursor-pointer transition-all border-dashed mb-4 ${quotationData.template === null ? 'border-primary ring-2 ring-primary/20 bg-blue-50/30' : 'hover:border-gray-300'}`}
            onClick={() => {
              // Usar null para representar "Sin plantilla"
              updateTemplate(null);
              // Usar un nivel de complejidad por defecto
              updateComplexity('medium');
            }}
          >
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-base">Personalizado / Sin Plantilla</CardTitle>
                <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                  Personalizado
                </Badge>
              </div>
              <CardDescription className="line-clamp-2">
                Configura tu proyecto manualmente sin usar una plantilla predefinida
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-2 pt-0">
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Tipo:</span>
                  <span>Completamente personalizado</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-2">
              {quotationData.template === null ? (
                <div className="w-full flex items-center justify-center py-1 bg-primary/10 text-primary font-medium rounded-md text-sm">
                  <Check className="h-4 w-4 mr-2" />
                  Seleccionada
                </div>
              ) : (
                <div className="w-full flex items-center justify-center py-1 border border-dashed border-neutral-300 rounded-md text-neutral-500 text-sm">
                  Click para seleccionar
                </div>
              )}
            </CardFooter>
          </Card>

          {/* Lista de plantillas */}
          {isLoading ? (
            <div className="flex justify-center p-8">
              <p>Cargando plantillas...</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTemplates?.map(renderTemplateCard)}
              </div>
              {filteredTemplates?.length === 0 && (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <Search className="h-8 w-8 text-neutral-400 mb-2" />
                  <p className="text-neutral-600">No se encontraron plantillas que coincidan con tu búsqueda.</p>
                  <Button 
                    variant="link" 
                    onClick={() => setSearchQuery('')}
                    className="mt-2"
                  >
                    Limpiar búsqueda
                  </Button>
                </div>
              )}
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          {quotationData.template === null ? (
            // Vista para el caso de "Personalizado / Sin Plantilla"
            <div className="space-y-6">
              {/* Información para el caso sin plantilla */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Personalizado / Sin Plantilla</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium text-base">Configuración Personalizada</h3>
                      <p className="text-sm text-neutral-600 mt-1">
                        Has seleccionado crear un proyecto completamente personalizado sin usar una plantilla predefinida.
                        Configura las opciones a continuación según tus necesidades específicas.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-medium text-neutral-700">Tipo:</p>
                        <Badge className="mt-1 bg-blue-100 text-blue-800 border-blue-200">
                          Personalizado
                        </Badge>
                      </div>
                      <div>
                        <p className="font-medium text-neutral-700">Ventajas:</p>
                        <p className="mt-1">Flexibilidad total en la configuración</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Selección de complejidad para el caso personalizado */}
              <div className="space-y-3">
                <Label>Nivel de Complejidad del Proyecto</Label>
                <RadioGroup 
                  value={quotationData.complexity || 'medium'} 
                  onValueChange={(value) => updateComplexity(value as 'low' | 'medium' | 'high')}
                  className="flex flex-col space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="low" id="complexity-custom-low" />
                    <Label htmlFor="complexity-custom-low" className="cursor-pointer">Baja - Proyecto simple con requisitos estándar</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="medium" id="complexity-custom-medium" />
                    <Label htmlFor="complexity-custom-medium" className="cursor-pointer">Media - Proyecto con algunas personalizaciones</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="high" id="complexity-custom-high" />
                    <Label htmlFor="complexity-custom-high" className="cursor-pointer">Alta - Proyecto complejo con muchas personalizaciones</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Customización para el caso personalizado */}
              <div className="space-y-3">
                <Label htmlFor="customization-custom">Notas de Personalización</Label>
                <Textarea
                  id="customization-custom"
                  placeholder="Ingresa cualquier detalle adicional o requisitos específicos para la personalización del informe..."
                  value={quotationData.customization}
                  onChange={(e) => updateCustomization(e.target.value)}
                  rows={4}
                />
              </div>
              
              {/* Visualización de costos */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Resumen de Costos</CardTitle>
                  <CardDescription>Vista previa del impacto de tus selecciones</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Valor']} />
                        <Bar 
                          dataKey="valor" 
                          fill="#94a3b8"
                          radius={[4, 4, 0, 0]} 
                        />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Costo Base:</span>
                      <span className="font-medium">${baseCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Ajuste de Complejidad:</span>
                      <span className="font-medium">${complexityAdjustment.toFixed(2)}</span>
                    </div>
                    <div className="col-span-2 pt-2 mt-2 border-t flex justify-between">
                      <span className="font-medium">Total Estimado:</span>
                      <span className="font-bold text-primary">${totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : quotationData.template ? (
            <div className="space-y-6">
              {/* Información de la plantilla seleccionada */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Plantilla Seleccionada</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium text-base">{quotationData.template.name}</h3>
                      <p className="text-sm text-neutral-600 mt-1">
                        {quotationData.template.description || 'Sin descripción disponible'}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-medium text-neutral-700">Complejidad:</p>
                        <Badge className={`mt-1 ${getComplexityColor(quotationData.template.complexity)}`}>
                          {getComplexityLabel(quotationData.template.complexity)}
                        </Badge>
                      </div>
                      {quotationData.template.pageRange && (
                        <div>
                          <p className="font-medium text-neutral-700">Rango de páginas:</p>
                          <p className="mt-1">{quotationData.template.pageRange}</p>
                        </div>
                      )}
                      {quotationData.template.features && (
                        <div className="col-span-2">
                          <p className="font-medium text-neutral-700">Características:</p>
                          <p className="mt-1">{quotationData.template.features}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Selección de complejidad */}
              <div className="space-y-3">
                <Label>Nivel de Complejidad del Proyecto</Label>
                <RadioGroup 
                  value={quotationData.complexity || 'medium'} 
                  onValueChange={(value) => updateComplexity(value as 'low' | 'medium' | 'high')}
                  className="flex flex-col space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="low" id="complexity-low" />
                    <Label htmlFor="complexity-low" className="cursor-pointer">Baja - Proyecto simple con requisitos estándar</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="medium" id="complexity-medium" />
                    <Label htmlFor="complexity-medium" className="cursor-pointer">Media - Proyecto con algunas personalizaciones</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="high" id="complexity-high" />
                    <Label htmlFor="complexity-high" className="cursor-pointer">Alta - Proyecto complejo con muchas personalizaciones</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Customización */}
              <div className="space-y-3">
                <Label htmlFor="customization">Notas de Personalización</Label>
                <Textarea
                  id="customization"
                  placeholder="Ingresa cualquier detalle adicional o requisitos específicos para la personalización del informe..."
                  value={quotationData.customization}
                  onChange={(e) => updateCustomization(e.target.value)}
                  rows={4}
                />
              </div>

              {/* Visualización de costos */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Resumen de Costos</CardTitle>
                  <CardDescription>Vista previa del impacto de tus selecciones</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Valor']} />
                        <Bar 
                          dataKey="valor" 
                          fill="#94a3b8"
                          radius={[4, 4, 0, 0]} 
                        />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Costo Base:</span>
                      <span className="font-medium">${baseCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Ajuste de Complejidad:</span>
                      <span className="font-medium">${complexityAdjustment.toFixed(2)}</span>
                    </div>
                    <div className="col-span-2 pt-2 mt-2 border-t flex justify-between">
                      <span className="font-medium">Total Estimado:</span>
                      <span className="font-bold text-primary">${totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed rounded-lg">
              <FileText className="h-12 w-12 text-neutral-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">No hay plantilla seleccionada</h3>
              <p className="text-neutral-500 mb-4 max-w-md">
                Para ver los detalles y configurar los ajustes, selecciona primero una plantilla en la pestaña "Lista de Plantillas".
              </p>
              <Button onClick={() => setSelectedTab('list')}>
                Seleccionar Plantilla
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OptimizedTemplateSelection;