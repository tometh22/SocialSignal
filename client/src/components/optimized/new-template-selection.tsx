import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOptimizedQuote } from "@/context/optimized-quote-context";
import { useQuery } from "@tanstack/react-query";
import { ReportTemplate } from "@shared/schema";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, FileText, BarChart, Check, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AnalysisType } from "./analysis-type";
import { MentionsVolume } from "./mentions-volume";
import { CountriesCovered } from "./countries-covered";
import { ClientEngagement } from "./client-engagement";
import { ComplexityLevel } from "./complexity-level";

type DetailsTab = "list" | "details";

/**
 * Componente para la selección de plantilla y configuración de complejidad
 */
export const OptimizedTemplateSelection = () => {
  // Estado para alternar entre lista de plantillas y detalles/ajustes
  const [selectedTab, setSelectedTab] = useState<DetailsTab>("list");
  const [searchQuery, setSearchQuery] = useState("");

  // Obtener contexto de la cotización optimizada
  const { 
    quotationData, 
    updateTemplate, 
    updateAnalysisType,
    updateMentionsVolume,
    updateCountriesCovered,
    updateClientEngagement,
    updateComplexity
  } = useOptimizedQuote();

  // Consultar plantillas de informe disponibles
  const { data: templates, isLoading } = useQuery<ReportTemplate[]>({
    queryKey: ['/api/report-templates']
  });

  // Filtrar plantillas basadas en la búsqueda
  const filteredTemplates = templates?.filter(template => 
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (template.description && template.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Si se selecciona una plantilla, cambiar a la pestaña de detalles
  useEffect(() => {
    if (quotationData.template && selectedTab === "list") {
      // Pequeño retraso para asegurar que el usuario vea que su selección tuvo efecto
      setTimeout(() => setSelectedTab("details"), 500);
    }
  }, [quotationData.template, selectedTab]);

  /**
   * Renderizar tarjeta de plantilla individual
   */
  const renderTemplateCard = (template: ReportTemplate) => {
    const isSelected = quotationData.template?.id === template.id;
    
    return (
      <Card 
        key={template.id} 
        className={`cursor-pointer transition-all ${isSelected ? 'border-primary ring-2 ring-primary/20 bg-blue-50/30' : 'hover:border-gray-300'}`}
        onClick={() => {
          // Configurar valores predeterminados basados en la plantilla
          updateAnalysisType(template.defaultAnalysisType || 'standard');
          updateMentionsVolume(template.defaultMentionsVolume || 'medium');
          updateCountriesCovered(template.defaultCountriesCovered || '1');
          updateClientEngagement(template.defaultClientEngagement || 'medium');
          updateComplexity(template.defaultComplexity || 'medium');
          
          // Actualizar la plantilla seleccionada
          updateTemplate(template);
        }}
      >
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <CardTitle className="text-base">{template.name}</CardTitle>
            {template.badge && (
              <Badge className={
                template.badge === "Básico" ? "bg-green-100 text-green-800 border-green-200" :
                template.badge === "Estándar" ? "bg-blue-100 text-blue-800 border-blue-200" :
                "bg-purple-100 text-purple-800 border-purple-200"
              }>
                {template.badge}
              </Badge>
            )}
          </div>
          <CardDescription className="line-clamp-2">
            {template.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-2 pt-0">
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-neutral-500">Tipo:</span>
              <span>{template.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Duración:</span>
              <span>{template.duration}</span>
            </div>
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

  /**
   * Renderizar el contenido de la pestaña de detalles y ajustes
   */
  const renderDetailsContent = () => {
    // Si no hay plantilla seleccionada (y no estamos en modo personalizado)
    if (!quotationData.template && quotationData.template !== null) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-12 w-12 text-neutral-300 mb-3" />
          <h3 className="text-lg font-medium mb-2 text-neutral-800">Selecciona una plantilla primero</h3>
          <p className="text-neutral-500 max-w-md">
            Por favor, selecciona una plantilla de la lista o elige la opción "Personalizado / Sin Plantilla" para 
            continuar con la configuración de los parámetros adicionales.
          </p>
          <Button 
            variant="outline" 
            onClick={() => setSelectedTab("list")}
            className="mt-4"
          >
            <FileText className="h-4 w-4 mr-2" />
            Ir a la lista de plantillas
          </Button>
        </div>
      );
    }

    // Si estamos en modo personalizado o hay una plantilla seleccionada
    return (
      <div className="space-y-8">
        {/* Sección de información de la configuración */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="text-blue-500 mt-1">
              <Info className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-medium text-blue-700">
                {quotationData.template 
                  ? `Configurando: ${quotationData.template.name}` 
                  : 'Configuración Personalizada'}
              </h4>
              <p className="text-sm text-blue-600 mt-1">
                {quotationData.template 
                  ? quotationData.template.description
                  : 'Configura los factores de complejidad según tus necesidades específicas.'}
              </p>
            </div>
          </div>
        </div>

        {/* Factores de complejidad - Usando componentes independientes para mejor rendimiento */}
        <div>
          <h3 className="text-lg font-medium mb-4 flex items-center">
            <span className="bg-blue-100 p-1 rounded-full mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                <line x1="6" y1="6" x2="6.01" y2="6"></line>
                <line x1="6" y1="18" x2="6.01" y2="18"></line>
              </svg>
            </span>
            Factores de Complejidad
          </h3>
          <p className="text-sm text-neutral-500 mb-4">
            Selecciona los factores para calcular el precio final
          </p>

          <div className="space-y-6">
            {/* Análisis Type */}
            <AnalysisType 
              value={quotationData.analysisType} 
              onChange={updateAnalysisType} 
            />
            
            {/* Mentions Volume */}
            <MentionsVolume 
              value={quotationData.mentionsVolume} 
              onChange={updateMentionsVolume} 
            />
            
            {/* Countries Covered */}
            <CountriesCovered 
              value={quotationData.countriesCovered} 
              onChange={updateCountriesCovered} 
            />
            
            {/* Client Engagement */}
            <ClientEngagement 
              value={quotationData.clientEngagement} 
              onChange={updateClientEngagement} 
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="mb-4">
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

        <TabsContent value="details" className="relative">
          <div className="space-y-6">
            {renderDetailsContent()}
          </div>
          
          {/* Nivel de Complejidad del Proyecto - Componente separado */}
          <ComplexityLevel 
            value={quotationData.complexity || 'medium'} 
            onChange={updateComplexity}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};