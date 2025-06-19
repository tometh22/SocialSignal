import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useOptimizedQuote } from "@/context/optimized-quote-context";
import { useQuery } from "@tanstack/react-query";
import { ReportTemplate } from "@shared/schema";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, Check } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * Componente simplificado para selección de plantillas únicamente
 * Sin pestañas de "Detalles y Ajustes" - eso va en el paso 4 (Complejidad)
 */
export const OptimizedTemplateSelection = () => {
  const { quotationData, updateTemplate } = useOptimizedQuote();
  const [searchQuery, setSearchQuery] = useState("");

  // Consultar plantillas disponibles
  const { data: templates, isLoading } = useQuery<ReportTemplate[]>({
    queryKey: ['/api/report-templates']
  });

  // Filtrar plantillas según búsqueda
  const filteredTemplates = templates?.filter(template => 
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (template.description && template.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Manejar selección de plantilla
  const handleTemplateSelect = (template: ReportTemplate | null) => {
    updateTemplate(template);
  };

  // Obtener color para complejidad
  const getComplexityColor = (complexity?: string) => {
    switch (complexity) {
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-neutral-100 text-neutral-800 border-neutral-200';
    }
  };

  // Obtener etiqueta para complejidad
  const getComplexityLabel = (complexity?: string) => {
    switch (complexity) {
      case 'low': return 'Baja';
      case 'medium': return 'Media';
      case 'high': return 'Alta';
      default: return 'No definida';
    }
  };

  // Renderizar tarjeta de plantilla
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
            <Badge className={getComplexityColor(template.complexity)}>
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
            {template.features && (
              <div className="flex justify-between">
                <span className="text-neutral-500">Características:</span>
                <span className="capitalize">{template.features}</span>
              </div>
            )}
            {template.baseCost && (
              <div className="flex justify-between">
                <span className="text-neutral-500">Costo base:</span>
                <span className="font-medium">${template.baseCost}</span>
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

  return (
    <div className="space-y-6">
      {/* Búsqueda de plantillas */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 h-4 w-4" />
        <Input
          placeholder="Buscar plantillas..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Opción personalizada */}
      <Card 
        className={`cursor-pointer transition-all ${quotationData.template === null ? 'border-primary ring-2 ring-primary/20 bg-blue-50/30' : 'hover:border-gray-300'}`}
        onClick={() => handleTemplateSelect(null)}
      >
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <CardTitle className="text-base">
              <span className="bg-primary/5 p-2 rounded-sm mr-3 inline-block">
                <FileText className="h-4 w-4 text-primary" />
              </span>
              Configuración Personalizada
            </CardTitle>
            <Badge className="bg-blue-100 text-blue-800 border-blue-200">
              Personalizado
            </Badge>
          </div>
          <CardDescription className="line-clamp-2">
            Mayor flexibilidad en la configuración del proyecto
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-2 pt-0">
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-neutral-500">Tipo:</span>
              <span>Completamente personalizado</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Ventajas:</span>
              <span>Máxima flexibilidad</span>
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
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-neutral-200 rounded w-3/4"></div>
                <div className="h-3 bg-neutral-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-neutral-200 rounded w-full mb-2"></div>
                <div className="h-3 bg-neutral-200 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {filteredTemplates?.map(renderTemplateCard)}
        </div>
      )}

      {filteredTemplates?.length === 0 && !isLoading && (
        <div className="text-center py-8 text-neutral-500">
          <FileText className="h-12 w-12 mx-auto mb-4 text-neutral-300" />
          <p>No se encontraron plantillas que coincidan con tu búsqueda.</p>
        </div>
      )}
    </div>
  );
};

export default OptimizedTemplateSelection;