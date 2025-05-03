import React, { useState, useEffect } from 'react';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { useQuery } from '@tanstack/react-query';
import { ReportTemplate } from '@shared/schema';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Check, Search, FileText, BarChart, Info, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ComplexityFactorsCard } from './complexity-factors-card';
import { FinancialSummary } from './financial-summary';

const TemplateSelectionRedesigned: React.FC = () => {
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
  const [templateSelected, setTemplateSelected] = useState(false);

  // Consultar plantillas disponibles
  const { data: templates, isLoading } = useQuery<ReportTemplate[]>({
    queryKey: ['/api/report-templates'],
  });

  // Filtrar plantillas según la búsqueda
  const filteredTemplates = templates?.filter(template => 
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (template.description && template.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Efecto para actualizar el estado de selección
  useEffect(() => {
    if (quotationData.template !== undefined) {
      setTemplateSelected(true);
    } else {
      setTemplateSelected(false);
    }
  }, [quotationData.template]);

  // Seleccionar una plantilla
  const handleTemplateSelect = (template: ReportTemplate) => {
    // Asegurarse de que el costo base de la plantilla sea un número válido
    console.log("Plantilla seleccionada:", template);
    
    // Al seleccionar una plantilla, establecer también su nivel de complejidad
    let templateComplexity: 'low' | 'medium' | 'high' = 'medium';
    if (template.complexity === 'low' || template.complexity === 'medium' || template.complexity === 'high') {
      templateComplexity = template.complexity;
    }
    
    // Ahora actualizar la plantilla para que se considere el costo base
    updateTemplate(template);
    
    // Luego establecer la complejidad y otros valores
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
    
    setTemplateSelected(true);
  };

  // Seleccionar opción personalizada
  const handleCustomSelect = () => {
    console.log("✅ Seleccionando opción 'Personalizado / Sin Plantilla'");
    
    // Establecer valores por defecto
    updateAnalysisType('standard');
    updateMentionsVolume('medium');
    updateCountriesCovered('1');
    updateClientEngagement('medium');
    updateComplexity('medium');
    
    // Marcar como personalizado (usar null para representar "Sin plantilla")
    updateTemplate(null);
    setTemplateSelected(true);
  };

  // Obtener color para niveles de complejidad
  const getComplexityColor = (complexity?: string): string => {
    switch (complexity) {
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100';
      case 'medium':
        return 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100';
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100';
      default:
        return 'bg-neutral-100 text-neutral-800 border-neutral-200 hover:bg-neutral-100';
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

  // Renderizar una tarjeta de plantilla en estilo compacto
  const renderCompactTemplate = (template: ReportTemplate) => {
    const isSelected = quotationData.template?.id === template.id;
    
    return (
      <div 
        key={template.id}
        className={`border rounded-md p-4 cursor-pointer transition-all hover:border-gray-300 hover:shadow ${
          isSelected ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : 'border-gray-200'
        }`}
        onClick={() => handleTemplateSelect(template)}
      >
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-medium">{template.name}</h3>
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{template.description}</p>
          </div>
          <Badge className={getComplexityColor(template.complexity)}>
            {getComplexityLabel(template.complexity)}
          </Badge>
        </div>
        
        <div className="mt-3 grid grid-cols-2 text-xs text-gray-600 gap-y-1">
          <div>Páginas:</div>
          <div className="text-right font-medium">{template.pageRange || 'N/A'}</div>
          
          <div>Costo Base:</div>
          <div className="text-right font-medium">${template.baseCost?.toFixed(2) || '0.00'}</div>
          
          <div>Costo Plataforma:</div>
          <div className="text-right font-medium">${template.platformCost?.toFixed(2) || '0.00'}</div>
        </div>
        
        <div className="mt-3 text-center">
          {isSelected ? (
            <div className="py-1 text-xs font-medium text-primary bg-primary/10 rounded flex items-center justify-center">
              <Check className="h-3 w-3 mr-1" />
              ¡Plantilla seleccionada correctamente!
            </div>
          ) : (
            <div className="py-1 text-xs text-gray-500 border border-dashed border-gray-300 rounded">
              Click para seleccionar
            </div>
          )}
        </div>
      </div>
    );
  };

  // Renders para la sección de personalización
  const renderCustomizationFields = () => {
    if (!templateSelected) return null;
    
    return (
      <div className="space-y-4 mt-6">
        <h3 className="text-base font-medium flex items-center">
          <FileText className="h-4 w-4 mr-2 text-primary" />
          Notas de Personalización
        </h3>
        
        <Textarea
          placeholder="Agrega detalles específicos, requerimientos particulares o cualquier información adicional para este proyecto..."
          className="min-h-[120px]"
          value={quotationData.customization || ''}
          onChange={(e) => updateCustomization(e.target.value)}
        />
        
        {!quotationData.customization && (
          <Alert className="bg-amber-50 text-amber-800 border-amber-200">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Recomendación</AlertTitle>
            <AlertDescription>
              Agregar notas de personalización ayuda a definir mejor el alcance 
              del proyecto y evitar malentendidos con el cliente.
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <h2 className="text-lg font-semibold">Selección de Plantilla</h2>
        <p className="text-sm text-neutral-500">
          Elige una plantilla o configura un proyecto personalizado.
        </p>
      </div>

      {/* Pestañas principales */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <div className="flex justify-between items-center">
          <TabsList className="grid grid-cols-2 w-fit">
            <TabsTrigger value="list" className="text-xs px-3">
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Lista de Plantillas
            </TabsTrigger>
            <TabsTrigger value="details" className="text-xs px-3" disabled={!templateSelected}>
              <BarChart className="h-3.5 w-3.5 mr-1.5" />
              Detalles y Ajustes
            </TabsTrigger>
          </TabsList>
          
          {/* Buscador */}
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="Buscar plantillas..."
              className="pl-8 h-8 text-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        <TabsContent value="list" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Opción personalizada */}
            <div 
              className={`border border-dashed rounded-md p-4 cursor-pointer transition-all hover:border-gray-300 hover:shadow ${
                quotationData.template === null ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : 'border-gray-200'
              }`}
              onClick={handleCustomSelect}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">Personalizado / Sin Plantilla</h3>
                  <p className="text-xs text-gray-500 mt-1">Configura tu proyecto manualmente sin usar una plantilla predefinida</p>
                </div>
                <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">
                  Personalizado
                </Badge>
              </div>
              
              <div className="mt-3 text-xs text-gray-600">
                <p>Configura tu proyecto manualmente sin usar una plantilla predefinida para obtener mayor flexibilidad en la definición de alcance y requisitos.</p>
              </div>
              
              <div className="mt-3 text-center">
                {quotationData.template === null ? (
                  <div className="py-1 text-xs font-medium text-primary bg-primary/10 rounded flex items-center justify-center">
                    <Check className="h-3 w-3 mr-1" />
                    Seleccionado
                  </div>
                ) : (
                  <div className="py-1 text-xs text-gray-500 border border-dashed border-gray-300 rounded">
                    Click para seleccionar
                  </div>
                )}
              </div>
            </div>
            
            {/* Plantillas */}
            {isLoading ? (
              <div className="col-span-full flex justify-center p-4">
                <p className="text-sm text-gray-500">Cargando plantillas...</p>
              </div>
            ) : (
              filteredTemplates && filteredTemplates.length > 0 ? (
                filteredTemplates.map(renderCompactTemplate)
              ) : (
                <div className="col-span-full flex flex-col items-center justify-center p-6 border border-dashed rounded-md">
                  <Search className="h-6 w-6 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">No se encontraron plantillas que coincidan con tu búsqueda.</p>
                  <Button 
                    variant="link" 
                    onClick={() => setSearchQuery('')}
                    className="mt-1 text-xs"
                  >
                    Limpiar búsqueda
                  </Button>
                </div>
              )
            )}
          </div>
          
          {templateSelected && (
            <Alert className="bg-green-50 border-green-200">
              <Check className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">¡Plantilla seleccionada correctamente!</AlertTitle>
              <AlertDescription className="text-green-700">
                Ahora puedes pasar a la pestaña "Detalles y Ajustes" para configurar los parámetros específicos.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
        
        <TabsContent value="details" className="space-y-4">
          {quotationData.template === null ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center">
                  <Info className="h-4 w-4 mr-2 text-primary" />
                  Configuración Personalizada
                </CardTitle>
                <CardDescription>
                  Proyecto configurado sin usar una plantilla predefinida
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm">
                    Has seleccionado crear un proyecto completamente personalizado sin usar una plantilla predefinida.
                    Configura las opciones a continuación según tus necesidades específicas.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                    <div>
                      <p className="font-medium text-gray-700">Tipo:</p>
                      <Badge className="mt-1 bg-blue-100 text-blue-800 border-blue-200">
                        Personalizado
                      </Badge>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Ventajas:</p>
                      <p className="mt-1 text-sm">Flexibilidad total en la configuración</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base flex items-center">
                      <Info className="h-4 w-4 mr-2 text-primary" />
                      {quotationData.template.name}
                    </CardTitle>
                    <CardDescription>
                      {quotationData.template.description}
                    </CardDescription>
                  </div>
                  <Badge className={getComplexityColor(quotationData.template.complexity)}>
                    {getComplexityLabel(quotationData.template.complexity)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="font-medium text-gray-700">Páginas:</p>
                    <p className="mt-1">{quotationData.template.pageRange || 'No especificado'}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">Costo Base:</p>
                    <p className="mt-1">${quotationData.template.baseCost?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">Costo Plataforma:</p>
                    <p className="mt-1">${quotationData.template.platformCost?.toFixed(2) || '0.00'}</p>
                  </div>
                  {quotationData.template.features && (
                    <div className="col-span-full">
                      <p className="font-medium text-gray-700">Características:</p>
                      <p className="mt-1">{quotationData.template.features}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Factores de complejidad */}
          <ComplexityFactorsCard
            analysisType={quotationData.analysisType}
            mentionsVolume={quotationData.mentionsVolume}
            countriesCovered={quotationData.countriesCovered}
            clientEngagement={quotationData.clientEngagement}
          />
          
          {/* Resumen financiero */}
          <FinancialSummary 
            baseCost={baseCost} 
            complexityAdjustment={complexityAdjustment} 
            totalAmount={totalAmount} 
          />
          
          {/* Campo de personalización */}
          {renderCustomizationFields()}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TemplateSelectionRedesigned;