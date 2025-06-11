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
    
    // Cambiar automáticamente a la pestaña de detalles y ajustes
    setTimeout(() => {
      setSelectedTab('details');
    }, 300);
  };

  // Seleccionar opción personalizada
  const handleCustomSelect = () => {
    
    // Establecer valores por defecto
    updateAnalysisType('standard');
    updateMentionsVolume('medium');
    updateCountriesCovered('1');
    updateClientEngagement('medium');
    updateComplexity('medium');
    
    // Marcar como personalizado (usar null para representar "Sin plantilla")
    updateTemplate(null);
    setTemplateSelected(true);
    
    // Cambiamos a la pestaña "Detalles y Ajustes" y nos quedamos ahí para permitir
    // que el usuario modifique los factores de complejidad antes de continuar
    setSelectedTab('details');
    
    // NO avanzamos automáticamente al paso 3, el usuario debe hacerlo manualmente
    // cuando haya terminado de configurar los factores de complejidad
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
    
    // Determinar la apariencia de la etiqueta de complejidad
    let complexityBadge = null;
    if (template.complexity === 'high') {
      complexityBadge = <div className="absolute top-0 right-0 bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-bl-md rounded-tr-md font-medium">Alta</div>;
    } else if (template.complexity === 'medium') {
      complexityBadge = <div className="absolute top-0 right-0 bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-bl-md rounded-tr-md font-medium">Media</div>;
    } else if (template.complexity === 'low') {
      complexityBadge = <div className="absolute top-0 right-0 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-bl-md rounded-tr-md font-medium">Baja</div>;
    }
    
    return (
      <div 
        key={template.id}
        className={`relative border ${isSelected ? 'border-primary' : 'border-gray-200'} rounded-md cursor-pointer transition-all hover:shadow-sm ${
          isSelected ? 'ring-1 ring-primary/20 bg-gray-50' : ''
        }`}
        onClick={() => handleTemplateSelect(template)}
      >
        {complexityBadge}
        
        <div className="p-3 pt-4">
          <h3 className="text-sm font-medium mb-1 pr-12">{template.name}</h3>
          <p className="text-xs text-gray-500 line-clamp-2 mb-3 h-8">{template.description}</p>
          
          <div className="grid grid-cols-2 gap-x-1 text-xs mb-1">
            <div className="text-gray-500">Páginas:</div>
            <div className="text-right font-medium">{template.pageRange || '-'}</div>
            
            <div className="text-gray-500">Costo Base:</div>
            <div className="text-right font-medium">${template.baseCost?.toFixed(2) || '0.00'}</div>
            
            <div className="text-gray-500">Plataforma:</div>
            <div className="text-right font-medium">${template.platformCost?.toFixed(2) || '0.00'}</div>
          </div>
        </div>
        
        {isSelected ? (
          <div className="py-0.5 text-xs text-primary border-t border-primary/20 bg-primary/5 text-center">
            <Check className="h-3 w-3 inline-block mr-1" />
            Seleccionada
          </div>
        ) : (
          <div className="py-0.5 text-xs text-gray-500 border-t border-dashed border-gray-200 text-center hover:bg-gray-50">
            Click para seleccionar
          </div>
        )}
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
          {/* Buscador de escritorio está en la esquina superior derecha */}
          
          {/* Mostrar la tarjeta de personalizado y las plantillas en un grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 bg-white rounded-md border border-gray-200">
            {/* Opción personalizada */}
            <div 
              className={`relative border ${quotationData.template === null ? 'border-primary' : 'border-gray-200'} rounded-md cursor-pointer transition-all hover:shadow-sm ${
                quotationData.template === null ? 'ring-1 ring-primary/20 bg-gray-50' : ''
              }`}
              onClick={handleCustomSelect}
            >
              <div className="absolute top-0 right-0 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-bl-md rounded-tr-md font-medium">
                Personalizado
              </div>
              
              <div className="p-3 pt-4">
                <h3 className="text-sm font-medium mb-1 pr-12">Personalizado / Sin Plantilla</h3>
                <p className="text-xs text-gray-500 line-clamp-2 mb-3 h-8">
                  Configura tu proyecto manualmente sin usar plantilla predefinida
                </p>
                
                <div className="grid grid-cols-2 gap-x-1 text-xs mb-1">
                  <div className="text-gray-500">Tipo:</div>
                  <div className="text-right font-medium">Flexible</div>
                  
                  <div className="text-gray-500">Ventaja:</div>
                  <div className="text-right font-medium">Mayor personalización</div>
                </div>
              </div>
              
              {quotationData.template === null ? (
                <div className="py-0.5 text-xs text-primary border-t border-primary/20 bg-primary/5 text-center">
                  <Check className="h-3 w-3 inline-block mr-1" />
                  Seleccionada
                </div>
              ) : (
                <div className="py-0.5 text-xs text-gray-500 border-t border-dashed border-gray-200 text-center hover:bg-gray-50">
                  Click para seleccionar
                </div>
              )}
            </div>
            
            {/* Plantillas */}
            {isLoading ? (
              <div className="col-span-full flex justify-center p-3">
                <p className="text-xs text-gray-500">Cargando plantillas...</p>
              </div>
            ) : (
              filteredTemplates && filteredTemplates.length > 0 ? (
                filteredTemplates.map(renderCompactTemplate)
              ) : (
                <div className="col-span-full flex flex-col items-center justify-center p-4 border border-dashed rounded-md">
                  <Search className="h-5 w-5 text-gray-400 mb-1" />
                  <p className="text-xs text-gray-500">No se encontraron plantillas para: "{searchQuery}"</p>
                  <Button 
                    variant="link" 
                    onClick={() => setSearchQuery('')}
                    className="mt-1 text-xs h-6 p-0"
                  >
                    Limpiar búsqueda
                  </Button>
                </div>
              )
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="details" className="space-y-4">
          <div className="p-4 bg-white rounded-md border border-gray-200">
            {/* Encabezado con información de la plantilla */}
            <div className="flex items-start gap-4 border-b border-gray-100 pb-3 mb-4">
              <div className="flex-1">
                {quotationData.template === null ? (
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                      <FileText className="h-4 w-4 text-blue-700" />
                    </div>
                    <div>
                      <h3 className="font-medium text-sm">Configuración Personalizada</h3>
                      <p className="text-xs text-gray-500">Mayor flexibilidad en la configuración del proyecto</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium text-sm">{quotationData.template.name}</h3>
                      <p className="text-xs text-gray-500 line-clamp-1">{quotationData.template.description}</p>
                    </div>
                  </div>
                )}
              </div>
              
              {quotationData.template !== null && (
                <Badge className={`${getComplexityColor(quotationData.template.complexity)} px-2 py-1`}>
                  {getComplexityLabel(quotationData.template.complexity)}
                </Badge>
              )}
            </div>
            
            {/* Información de costos y detalles en formato compacto */}
            {quotationData.template !== null && (
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-gray-50 rounded p-2 text-center">
                  <div className="text-xs text-gray-500 mb-1">Páginas</div>
                  <div className="font-medium text-sm">{quotationData.template.pageRange || 'N/A'}</div>
                </div>
                <div className="bg-gray-50 rounded p-2 text-center">
                  <div className="text-xs text-gray-500 mb-1">Costo Base</div>
                  <div className="font-medium text-sm">${quotationData.template.baseCost?.toFixed(2) || '0.00'}</div>
                </div>
                <div className="bg-gray-50 rounded p-2 text-center">
                  <div className="text-xs text-gray-500 mb-1">Costo Plataforma</div>
                  <div className="font-medium text-sm">${quotationData.template.platformCost?.toFixed(2) || '0.00'}</div>
                </div>
              </div>
            )}
            
            {/* Factores de complejidad en formato horizontal más compacto */}
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-3 flex items-center">
                <BarChart className="h-4 w-4 mr-2 text-primary" />
                Factores de Complejidad
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white border border-gray-200 rounded-md p-2">
                  <div className="text-xs text-gray-500 mb-1">Tipo de Análisis</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <button 
                      onClick={() => updateAnalysisType('basic')}
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        quotationData.analysisType === 'basic' 
                          ? 'bg-primary/10 border-primary text-primary font-medium' 
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      Básico
                    </button>
                    <button 
                      onClick={() => updateAnalysisType('standard')}
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        quotationData.analysisType === 'standard' 
                          ? 'bg-primary/10 border-primary text-primary font-medium' 
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      Estándar
                    </button>
                    <button 
                      onClick={() => updateAnalysisType('advanced')}
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        quotationData.analysisType === 'advanced' 
                          ? 'bg-primary/10 border-primary text-primary font-medium' 
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      Avanzado
                    </button>
                  </div>
                </div>
                
                <div className="bg-white border border-gray-200 rounded-md p-2">
                  <div className="text-xs text-gray-500 mb-1">Volumen de Menciones</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <button 
                      onClick={() => updateMentionsVolume('low')}
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        quotationData.mentionsVolume === 'low' 
                          ? 'bg-primary/10 border-primary text-primary font-medium' 
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      Bajo
                    </button>
                    <button 
                      onClick={() => updateMentionsVolume('medium')}
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        quotationData.mentionsVolume === 'medium' 
                          ? 'bg-primary/10 border-primary text-primary font-medium' 
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      Medio
                    </button>
                    <button 
                      onClick={() => updateMentionsVolume('high')}
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        quotationData.mentionsVolume === 'high' 
                          ? 'bg-primary/10 border-primary text-primary font-medium' 
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      Alto
                    </button>
                  </div>
                </div>
                
                <div className="bg-white border border-gray-200 rounded-md p-2">
                  <div className="text-xs text-gray-500 mb-1">Países Cubiertos</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <button 
                      onClick={() => updateCountriesCovered('1')}
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        quotationData.countriesCovered === '1' 
                          ? 'bg-primary/10 border-primary text-primary font-medium' 
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      1 país
                    </button>
                    <button 
                      onClick={() => updateCountriesCovered('2-3')}
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        quotationData.countriesCovered === '2-3' 
                          ? 'bg-primary/10 border-primary text-primary font-medium' 
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      2-3 países
                    </button>
                    <button 
                      onClick={() => updateCountriesCovered('4+')}
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        quotationData.countriesCovered === '4+' 
                          ? 'bg-primary/10 border-primary text-primary font-medium' 
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      4+ países
                    </button>
                  </div>
                </div>
                
                <div className="bg-white border border-gray-200 rounded-md p-2">
                  <div className="text-xs text-gray-500 mb-1">Compromiso del Cliente</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <button 
                      onClick={() => updateClientEngagement('low')}
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        quotationData.clientEngagement === 'low' 
                          ? 'bg-primary/10 border-primary text-primary font-medium' 
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      Bajo
                    </button>
                    <button 
                      onClick={() => updateClientEngagement('medium')}
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        quotationData.clientEngagement === 'medium' 
                          ? 'bg-primary/10 border-primary text-primary font-medium' 
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      Medio
                    </button>
                    <button 
                      onClick={() => updateClientEngagement('high')}
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        quotationData.clientEngagement === 'high' 
                          ? 'bg-primary/10 border-primary text-primary font-medium' 
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      Alto
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Resumen financiero en formato visual más amigable */}
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-3 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary mr-2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M16 8h-6.5a2.5 2.5 0 0 0 0 5h3a2.5 2.5 0 0 1 0 5H6"></path>
                  <path d="M12 18v2"></path>
                  <path d="M12 6v2"></path>
                </svg>
                Resumen Financiero
              </h3>
              
              <div className="bg-gray-100 rounded-md overflow-hidden p-1 mt-1">
                <div className="relative h-10 rounded-md overflow-hidden flex">
                  <div className="bg-green-200 flex items-center justify-start pl-3 h-full z-10 transition-all duration-300" 
                    style={{ 
                      width: `${baseCost ? Math.max((baseCost / (totalAmount || 1)) * 100, 25) : 0}%`,
                    }}>
                    <div className="flex flex-col items-start">
                      <span className="text-[10px] font-medium text-green-700">Costo Base</span>
                      <span className="text-xs font-bold text-green-800">${baseCost?.toFixed(2) || '0.00'}</span>
                    </div>
                  </div>
                  <div className="bg-blue-200 flex items-center justify-center h-full absolute z-20 transition-all duration-300" 
                    style={{ 
                      width: `${complexityAdjustment ? Math.max((complexityAdjustment / (totalAmount || 1)) * 100, 15) : 0}%`,
                      left: `${baseCost ? (baseCost / (totalAmount || 1)) * 100 : 0}%`
                    }}>
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-medium text-blue-700">Ajuste</span>
                      <span className="text-xs font-bold text-blue-800">${complexityAdjustment?.toFixed(2) || '0.00'}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center mt-2 px-1">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-green-500 mr-1"></div>
                      <span className="text-xs text-gray-600">Base</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mr-1"></div>
                      <span className="text-xs text-gray-600">Complejidad</span>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-purple-800 bg-purple-50 px-2 py-1 rounded">
                    Total: ${totalAmount?.toFixed(2) || '0.00'}
                  </div>
                </div>
              </div>
              
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div 
                  className="bg-gray-50 border border-gray-200 rounded-md p-2 transition-all cursor-pointer hover:shadow-sm hover:border-gray-300"
                  title="El costo base refleja el precio inicial de la plantilla seleccionada"
                >
                  <div className="flex justify-between items-center mb-1">
                    <div className="text-xs text-gray-500">Costo Base</div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                  <div className="font-medium text-sm">${baseCost?.toFixed(2) || '0.00'}</div>
                </div>
                
                <div 
                  className="bg-gray-50 border border-gray-200 rounded-md p-2 transition-all cursor-pointer hover:shadow-sm hover:border-gray-300"
                  title="El ajuste de complejidad se basa en los factores seleccionados"
                >
                  <div className="flex justify-between items-center mb-1">
                    <div className="text-xs text-gray-500">Ajuste</div>
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  </div>
                  <div className="font-medium text-sm">${complexityAdjustment?.toFixed(2) || '0.00'}</div>
                </div>
                
                <div 
                  className="bg-[#f7f5fe] border border-[#e2ddf5] rounded-md p-3 transition-all cursor-pointer hover:shadow-sm hover:border-[#d0caed] relative overflow-hidden"
                  title="Costo total del proyecto"
                >
                  <div className="absolute -right-6 -top-6 w-12 h-12 rounded-full bg-[#9c8ce7]/10"></div>
                  <div className="absolute right-4 top-4 w-8 h-8 rounded-full bg-[#9c8ce7]/10"></div>
                  
                  <div className="flex justify-between items-center mb-1 relative z-10">
                    <div className="font-medium text-[#6a5b9d]">Costo estimado</div>
                    <div className="w-4 h-4 rounded-full bg-[#9c8ce7] flex items-center justify-center">
                      <span className="text-white text-[8px] font-medium">$</span>
                    </div>
                  </div>
                  <div className="font-bold text-lg text-[#6a5b9d] relative z-10">${totalAmount?.toFixed(2) || '0.00'}</div>
                  <div className="h-1 w-24 bg-[#9c8ce7]/20 absolute bottom-0 left-0 rounded-tr-md"></div>
                </div>
              </div>
            </div>
            
            {/* Campo de personalización */}
            <div className="mt-4">
              <h3 className="text-sm font-medium mb-2 flex items-center">
                <FileText className="h-4 w-4 mr-2 text-primary" />
                Notas de Personalización
              </h3>
              
              <Textarea
                placeholder="Agrega detalles específicos, requerimientos particulares o cualquier información adicional para este proyecto..."
                className="min-h-[100px] text-sm"
                value={quotationData.customization || ''}
                onChange={(e) => updateCustomization(e.target.value)}
              />
              
              {!quotationData.customization && (
                <div className="flex gap-2 items-start mt-2 p-2 bg-amber-50 text-amber-800 border border-amber-200 rounded text-xs">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Recomendación</p>
                    <p>Agregar notas de personalización ayuda a definir mejor el alcance del proyecto y evitar malentendidos con el cliente.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TemplateSelectionRedesigned;