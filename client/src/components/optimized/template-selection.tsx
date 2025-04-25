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
import { ComplexityFactorsCard } from './complexity-factors-card';

const OptimizedTemplateSelection: React.FC = () => {
  const {
    quotationData,
    updateTemplate,
    updateComplexity,
    updateCustomization,
    updateAnalysisType,
    updateMentionsVolume,
    updateCountriesCovered,
    updateClientEngagement,
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
    // Al seleccionar una plantilla, establecer también su nivel de complejidad
    let templateComplexity: 'low' | 'medium' | 'high' = 'medium';
    if (template.complexity === 'low' || template.complexity === 'medium' || template.complexity === 'high') {
      templateComplexity = template.complexity;
    }
    updateComplexity(templateComplexity);
    
    // Si no se han establecido los factores de complejidad, poner valores por defecto
    if (!quotationData.analysisType) {
      updateAnalysisType('standard');
    }
    
    if (!quotationData.mentionsVolume) {
      updateMentionsVolume('medium');
    }
    
    if (!quotationData.countriesCovered) {
      updateCountriesCovered('1');
    }
    
    if (!quotationData.clientEngagement) {
      updateClientEngagement('medium');
    }
  };

  // Obtener color para niveles de complejidad
  const getComplexityColor = (complexity?: string): string => {
    switch (complexity) {
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'medium':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-neutral-100 text-neutral-800 border-neutral-200';
    }
  };

  // Obtener etiqueta para niveles de complejidad
  const getComplexityLabel = (complexity?: string): string => {
    switch (complexity) {
      case 'low':
        return 'Baja';
      case 'medium':
        return 'Media';
      case 'high':
        return 'Alta';
      default:
        return 'No definida';
    }
  };

  // Renderizar una tarjeta de plantilla
  const renderTemplateCard = (template: ReportTemplate) => {
    const isSelected = quotationData.template?.id === template.id;
    
    return (
      <Card 
        key={template.id}
        className={`cursor-pointer transition-all ${isSelected ? 'border-primary ring-2 ring-primary/20 bg-blue-50/30' : 'hover:border-gray-300'}`}
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

  // Renderizar el contenido de detalles y configuración
  const renderDetailsContent = () => {
    if (quotationData.template === null) {
      return (
        // Vista para el caso de "Personalizado / Sin Plantilla"
        <div className="space-y-6">
          {/* Información para el caso personalizado */}
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

          {/* Resumen de Factores de Complejidad */}
          <ComplexityFactorsCard
            analysisType={quotationData.analysisType}
            mentionsVolume={quotationData.mentionsVolume}
            countriesCovered={quotationData.countriesCovered}
            clientEngagement={quotationData.clientEngagement}
          />
          
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
          
          {/* Notas de personalización */}
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
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Información de la plantilla seleccionada */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plantilla Seleccionada: {quotationData.template.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
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
        
        {/* Resumen de Factores de Complejidad */}
        <ComplexityFactorsCard
          analysisType={quotationData.analysisType}
          mentionsVolume={quotationData.mentionsVolume}
          countriesCovered={quotationData.countriesCovered}
          clientEngagement={quotationData.clientEngagement}
        />
        
        {/* Visualización de costos */}
        <Card className="border-primary/20">
          <CardHeader className="pb-2 bg-primary/5">
            <CardTitle className="text-base flex items-center">
              <span className="text-primary mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M12 8v8"></path>
                  <path d="M8 12h8"></path>
                </svg>
              </span>
              Resumen de Costos
            </CardTitle>
            <CardDescription>Vista previa del impacto de tus selecciones</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-1 gap-x-4 gap-y-2 text-sm">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-neutral-600">Costo Base:</span>
                <span className="font-medium text-base">${baseCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <div>
                  <span className="text-neutral-600">Ajuste por Complejidad:</span>
                  <div className="text-xs text-neutral-500">Basado en tus selecciones</div>
                </div>
                <span className="font-medium text-base text-blue-600">${complexityAdjustment.toFixed(2)}</span>
              </div>
              <div className="pt-4 mt-2 border-t flex justify-between items-center bg-primary/5 p-3 rounded-md">
                <div>
                  <span className="font-medium">Total Estimado:</span>
                  <div className="text-xs text-neutral-500">Costo Base + Ajustes</div>
                </div>
                <span className="font-bold text-xl text-primary">${totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="h-40 mt-6">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Valor']} />
                  <Bar 
                    dataKey="valor" 
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]} 
                  />
                </RechartsBarChart>
              </ResponsiveContainer>
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
        
        {/* Tipo de análisis */}
        <div className="space-y-3 bg-blue-50 p-4 rounded-lg border border-blue-100">
          <div className="flex items-center mb-2">
            <div className="bg-blue-100 p-1 rounded-full mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-700">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
              </svg>
            </div>
            <Label className="font-medium text-blue-800">Tipo de Análisis *</Label>
          </div>
          <RadioGroup 
            value={quotationData.analysisType} 
            onValueChange={(value) => updateAnalysisType(value)}
            className="flex flex-col space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="basic" id="analysis-basic" />
              <Label htmlFor="analysis-basic" className="cursor-pointer">
                <span className="font-medium">Básico</span> - Análisis general sin profundidad
                <span className="ml-2 text-xs text-blue-600">(+0%)</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="standard" id="analysis-standard" />
              <Label htmlFor="analysis-standard" className="cursor-pointer">
                <span className="font-medium">Estándar</span> - Análisis detallado con métricas completas 
                <span className="ml-2 text-xs text-blue-600">(+10%)</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="deep" id="analysis-deep" />
              <Label htmlFor="analysis-deep" className="cursor-pointer">
                <span className="font-medium">Avanzado</span> - Análisis profundo con metodologías especializadas
                <span className="ml-2 text-xs text-blue-600">(+15%)</span>
              </Label>
            </div>
          </RadioGroup>
          <div className="text-xs text-blue-600 mt-2 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 16v-4"></path>
              <path d="M12 8h.01"></path>
            </svg>
            El tipo de análisis determina la profundidad metodológica y afecta directamente al costo.
          </div>
        </div>
        
        {/* Volumen de menciones */}
        <div className="space-y-3 bg-indigo-50 p-4 rounded-lg border border-indigo-100">
          <div className="flex items-center mb-2">
            <div className="bg-indigo-100 p-1 rounded-full mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-700">
                <path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973"></path>
                <path d="m13 12-3 5h4l-3 5"></path>
              </svg>
            </div>
            <Label className="font-medium text-indigo-800">Volumen de Menciones *</Label>
          </div>
          <RadioGroup 
            value={quotationData.mentionsVolume} 
            onValueChange={(value) => updateMentionsVolume(value)}
            className="flex flex-col space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="small" id="volume-small" />
              <Label htmlFor="volume-small" className="cursor-pointer">
                <span className="font-medium">Pequeño</span> - Menos de 1,000 menciones
                <span className="ml-2 text-xs text-indigo-600">(+0%)</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="medium" id="volume-medium" />
              <Label htmlFor="volume-medium" className="cursor-pointer">
                <span className="font-medium">Medio</span> - Entre 1,000 y 10,000 menciones
                <span className="ml-2 text-xs text-indigo-600">(+10%)</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="large" id="volume-large" />
              <Label htmlFor="volume-large" className="cursor-pointer">
                <span className="font-medium">Grande</span> - Entre 10,000 y 50,000 menciones
                <span className="ml-2 text-xs text-indigo-600">(+20%)</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="xlarge" id="volume-xlarge" />
              <Label htmlFor="volume-xlarge" className="cursor-pointer">
                <span className="font-medium">Extra grande</span> - Más de 50,000 menciones
                <span className="ml-2 text-xs text-indigo-600">(+30%)</span>
              </Label>
            </div>
          </RadioGroup>
          <div className="text-xs text-indigo-600 mt-2 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 16v-4"></path>
              <path d="M12 8h.01"></path>
            </svg>
            El volumen de menciones determina la cantidad de datos que se procesarán.
          </div>
        </div>
        
        {/* Países cubiertos */}
        <div className="space-y-3 bg-green-50 p-4 rounded-lg border border-green-100">
          <div className="flex items-center mb-2">
            <div className="bg-green-100 p-1 rounded-full mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-700">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
            </div>
            <Label className="font-medium text-green-800">Países Cubiertos *</Label>
          </div>
          <RadioGroup 
            value={quotationData.countriesCovered} 
            onValueChange={(value) => updateCountriesCovered(value)}
            className="flex flex-col space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="1" id="countries-1" />
              <Label htmlFor="countries-1" className="cursor-pointer">
                <span className="font-medium">1 país</span> - Cobertura de un solo país
                <span className="ml-2 text-xs text-green-600">(+0%)</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="2-5" id="countries-2-5" />
              <Label htmlFor="countries-2-5" className="cursor-pointer">
                <span className="font-medium">2-5 países</span> - Cobertura regional limitada
                <span className="ml-2 text-xs text-green-600">(+5%)</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="6-10" id="countries-6-10" />
              <Label htmlFor="countries-6-10" className="cursor-pointer">
                <span className="font-medium">6-10 países</span> - Cobertura regional amplia
                <span className="ml-2 text-xs text-green-600">(+15%)</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="10+" id="countries-10+" />
              <Label htmlFor="countries-10+" className="cursor-pointer">
                <span className="font-medium">Más de 10 países</span> - Cobertura global
                <span className="ml-2 text-xs text-green-600">(+25%)</span>
              </Label>
            </div>
          </RadioGroup>
          <div className="text-xs text-green-600 mt-2 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 16v-4"></path>
              <path d="M12 8h.01"></path>
            </svg>
            El número de países afecta la complejidad y alcance del análisis.
          </div>
        </div>
        
        {/* Nivel de interacción con el cliente */}
        <div className="space-y-3 bg-purple-50 p-4 rounded-lg border border-purple-100">
          <div className="flex items-center mb-2">
            <div className="bg-purple-100 p-1 rounded-full mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-700">
                <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z"></path>
                <path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"></path>
              </svg>
            </div>
            <Label className="font-medium text-purple-800">Nivel de Interacción con el Cliente *</Label>
          </div>
          <RadioGroup 
            value={quotationData.clientEngagement} 
            onValueChange={(value) => updateClientEngagement(value)}
            className="flex flex-col space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="low" id="engagement-low" />
              <Label htmlFor="engagement-low" className="cursor-pointer">
                <span className="font-medium">Bajo</span> - Entrega del informe final sin reuniones adicionales
                <span className="ml-2 text-xs text-purple-600">(+0%)</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="medium" id="engagement-medium" />
              <Label htmlFor="engagement-medium" className="cursor-pointer">
                <span className="font-medium">Medio</span> - Incluye reunión inicial y presentación de resultados
                <span className="ml-2 text-xs text-purple-600">(+5%)</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="high" id="engagement-high" />
              <Label htmlFor="engagement-high" className="cursor-pointer">
                <span className="font-medium">Alto</span> - Colaboración continua con reuniones semanales
                <span className="ml-2 text-xs text-purple-600">(+15%)</span>
              </Label>
            </div>
          </RadioGroup>
          <div className="text-xs text-purple-600 mt-2 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 16v-4"></path>
              <path d="M12 8h.01"></path>
            </svg>
            El nivel de interacción determina la cantidad de reuniones y colaboración.
          </div>
        </div>
        
        {/* Notas de personalización */}
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
      </div>
    );
  };

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

          {/* Opción para usar personalizado / sin plantilla */}
          <Card 
            className={`cursor-pointer transition-all border-dashed mb-4 ${quotationData.template === null ? 'border-primary ring-2 ring-primary/20 bg-blue-50/30' : 'hover:border-gray-300'}`}
            onClick={() => {
              console.log("✅ Seleccionando opción 'Personalizado / Sin Plantilla'");
              
              // Establecer valores por defecto siempre para garantizar estado consistente
              updateAnalysisType('standard');
              updateMentionsVolume('medium');
              updateCountriesCovered('1');
              updateClientEngagement('medium');
              
              // Asignar complejidad media por defecto
              updateComplexity('medium');
              
              // Cambiar a pestaña de detalles para mostrar opciones adicionales
              setSelectedTab('details');
              
              // Marcar como personalizado (usar null para representar "Sin plantilla")
              updateTemplate(null);
              
              // Ir siempre a la pestaña de detalles
              setTimeout(() => setSelectedTab('details'), 50);
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
            <>
              <ScrollArea className="h-[300px] pr-4">
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
              
              {/* Mensaje guía después de seleccionar plantilla o personalizado */}
              {(quotationData.template || quotationData.template === null) && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
                  <div className="text-blue-500 mt-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <path d="M12 16v-4"></path>
                      <path d="M12 8h.01"></path>
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-blue-700">
                      {quotationData.template ? '¡Plantilla seleccionada correctamente!' : '¡Opción "Personalizado" seleccionada!'}
                    </h4>
                    <p className="text-sm text-blue-600 mt-1">
                      Ahora continúa con la configuración de parámetros adicionales en la pestaña "Detalles y Ajustes".
                    </p>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="mt-2 bg-white border-blue-300 text-blue-700 hover:bg-blue-100"
                      onClick={() => {
                        // Asegurarse de que el usuario configure estas variables
                        setSelectedTab('details');
                      }}
                    >
                      Ir a Detalles y Ajustes
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <div className="pr-2 space-y-8 pb-20">
            {renderDetailsContent()}
            
            {/* Nivel de Complejidad del Proyecto */}
            <div className="mt-8 border rounded-lg p-4" id="nivel-complejidad">
              <h3 className="text-lg font-medium mb-4">Nivel de Complejidad del Proyecto</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input type="radio" id="complejidad-baja" name="complejidad" 
                    checked={quotationData.complexity === 'low'} 
                    onChange={() => updateComplexity('low')}
                    className="h-4 w-4 text-blue-600" />
                  <label htmlFor="complejidad-baja" className="text-sm cursor-pointer">
                    Baja - Proyecto simple con requisitos estándar
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="radio" id="complejidad-media" name="complejidad" 
                    checked={quotationData.complexity === 'medium'} 
                    onChange={() => updateComplexity('medium')}
                    className="h-4 w-4 text-blue-600" />
                  <label htmlFor="complejidad-media" className="text-sm cursor-pointer">
                    Media - Proyecto complejo con algunos requisitos específicos
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="radio" id="complejidad-alta" name="complejidad" 
                    checked={quotationData.complexity === 'high'} 
                    onChange={() => updateComplexity('high')}
                    className="h-4 w-4 text-blue-600" />
                  <label htmlFor="complejidad-alta" className="text-sm cursor-pointer">
                    Alta - Proyecto muy complejo con muchos requisitos específicos
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="radio" id="complejidad-variable" name="complejidad" 
                    checked={quotationData.complexity === 'variable'} 
                    onChange={() => updateComplexity('variable')}
                    className="h-4 w-4 text-blue-600" />
                  <label htmlFor="complejidad-variable" className="text-sm cursor-pointer">
                    Variable - Complejidad cambiante durante el desarrollo
                  </label>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OptimizedTemplateSelection;