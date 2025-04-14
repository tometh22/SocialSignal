import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQuoteContext } from "@/context/quote-context";
import { ReportTemplate } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import CostBreakdown from "./cost-breakdown";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

export default function ReportTemplates({ onPrevious, onNext }: { onPrevious: () => void; onNext: () => void }) {
  const { toast } = useToast();
  const {
    selectedTemplateId,
    templateCustomization,
    teamMembers,
    recommendedRoleIds,
    updateReportTemplate,
    updateTemplateCustomization,
    addRecommendedRoles,
    calculateTotalCost,
    complexityFactors,
    quotationData
  } = useQuoteContext();

  // Get templates from API
  const { data: originalTemplates } = useQuery<ReportTemplate[]>({
    queryKey: ["/api/templates"],
  });
  
  // Función para traducir textos
  const translateText = (text: string | null, translations: Record<string, string>): string => {
    if (!text) return "";
    return translations[text] || text;
  };
  
  // Traducciones para las plantillas
  const nameTranslations: Record<string, string> = {
    "Executive Dashboard": "Panel Ejecutivo",
    "Comprehensive Analysis": "Análisis Completo",
    "Campaign Performance": "Rendimiento de Campaña",
    "Custom Template": "Plantilla Personalizada"
  };
  
  const descriptionTranslations: Record<string, string> = {
    "Concise, high-level metrics with key insights and strategic recommendations. Ideal for executive stakeholders.": 
      "Métricas concisas de alto nivel con ideas clave y recomendaciones estratégicas. Ideal para directivos.",
    "Detailed evaluation with extensive metrics, audience segmentation, and demographic breakdown.": 
      "Evaluación detallada con métricas extensas, segmentación de audiencia y desglose demográfico.",
    "Pre, during, and post campaign analysis with KPI tracking and comparative benchmark data.": 
      "Análisis previo, durante y posterior a la campaña con seguimiento de KPI y datos comparativos de referencia.",
    "Build a custom report structure based on specific client requirements and project goals.": 
      "Crea una estructura de informe personalizada basada en requisitos específicos del cliente y objetivos del proyecto."
  };
  
  const featuresTranslations: Record<string, string> = {
    "Core metrics only": "Solo métricas principales",
    "Advanced metrics": "Métricas avanzadas",
    "Trend analysis": "Análisis de tendencias",
    "Custom metrics": "Métricas personalizadas"
  };
  
  const pageRangeTranslations: Record<string, string> = {
    "5-10 pages": "5-10 páginas",
    "15-25 pages": "15-25 páginas",
    "20-30 pages": "20-30 páginas",
    "Variable length": "Longitud variable"
  };
  
  // Traducción de plantillas
  const templates = originalTemplates?.map(template => ({
    ...template,
    name: translateText(template.name, nameTranslations),
    description: translateText(template.description, descriptionTranslations),
    features: translateText(template.features, featuresTranslations),
    pageRange: translateText(template.pageRange, pageRangeTranslations)
  }));

  // Update cost calculations when template changes
  useEffect(() => {
    calculateTotalCost();
  }, [selectedTemplateId, calculateTotalCost]);

  // Check if form is valid
  const validateForm = () => {
    if (!selectedTemplateId) {
      toast({
        title: "Plantilla Requerida",
        description: "Por favor, selecciona una plantilla de informe.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  // Prepare data for cost factors chart
  const getCostFactorsData = () => {
    const factorsData = [
      { name: "Tipo de Análisis", value: complexityFactors.analysisTypeFactor || 0 },
      { name: "Volumen de Menciones", value: complexityFactors.mentionsVolumeFactor || 0 },
      { name: "Países", value: complexityFactors.countriesFactor || 0 },
      { name: "Participación del Cliente", value: complexityFactors.clientEngagementFactor || 0 },
      { name: "Plantilla", value: complexityFactors.templateFactor || 0 },
    ].filter(factor => factor.value > 0);
    
    return factorsData;
  };

  // Chart colors
  const COLORS = ['#1976d2', '#ff6d00', '#4caf50', '#f44336', '#9c27b0'];

  // Handle continue button click
  const handleContinue = () => {
    if (validateForm()) {
      calculateTotalCost();
      onNext();
    }
  };
  
  // Esta función avisará al usuario que se utilizarán los roles recomendados en el siguiente paso
  const handleRecommendedContinue = () => {
    if (validateForm()) {
      toast({
        title: "Roles Recomendados",
        description: "Se utilizarán roles recomendados basados en la plantilla seleccionada.",
      });
      calculateTotalCost();
      onNext();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-xl font-semibold text-neutral-900 mb-6">Plantillas de Informe</h3>
      
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
        <h4 className="text-base font-medium text-blue-700">¿Cuál es la diferencia?</h4>
        <p className="text-sm text-blue-600 mt-1">
          En el paso 1 seleccionaste el <strong>Tipo de Análisis</strong> (metodología y enfoque analítico).
          Ahora debes elegir una <strong>Plantilla de Informe</strong> específica que define la estructura,
          formato y presentación del entregable final al cliente.
        </p>
      </div>
      
      <p className="text-sm text-neutral-600 mb-6">Selecciona una plantilla de informe que mejor se adapte a los requisitos de tu proyecto. La selección de la plantilla puede afectar la cotización general según la complejidad y la personalización requerida.</p>
      
      <div className="mb-6">
        <RadioGroup 
          value={selectedTemplateId?.toString() || ""} 
          onValueChange={(value) => updateReportTemplate(parseInt(value))}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {templates?.map(template => (
            <div
              key={template.id}
              className={cn(
                "card-select p-4 border border-neutral-300 rounded-lg hover:bg-neutral-50 cursor-pointer",
                selectedTemplateId === template.id && "selected"
              )}
              onClick={() => updateReportTemplate(template.id)}
            >
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <RadioGroupItem value={template.id.toString()} id={`template-${template.id}`} className="h-5 w-5" />
                </div>
                <div className="ml-3 flex-1">
                  <Label
                    htmlFor={`template-${template.id}`}
                    className="text-base font-medium text-neutral-800 cursor-pointer"
                  >
                    {template.name}
                  </Label>
                  <p className="text-sm text-neutral-600 mt-1">{template.description}</p>
                  
                  <div className="mt-3 flex items-center text-sm">
                    {template.pageRange && (
                      <span className="inline-flex items-center mr-3 px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800">
                        {template.pageRange}
                      </span>
                    )}
                    {template.features && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800">
                        {template.features}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </RadioGroup>
      </div>
      
      <div className="p-4 bg-neutral-100 rounded-lg mb-6">
        <h4 className="text-base font-medium text-neutral-800 mb-3">Personalización de Plantilla</h4>
        <p className="text-sm text-neutral-600 mb-3">Especifica cualquier requisito personalizado o modificación necesaria para la plantilla seleccionada.</p>
        
        <Textarea
          className="w-full"
          rows={3}
          placeholder="Describe cualquier requisito especial o personalización necesaria..."
          value={templateCustomization || ""}
          onChange={(e) => updateTemplateCustomization(e.target.value)}
        />
      </div>
      
      <div className="pt-4 border-t border-neutral-200">
        <div className="flex items-center justify-between mb-4">
          <Button type="button" variant="outline" onClick={onPrevious} className="flex items-center">
            <span className="mr-1">←</span>
            Atrás
          </Button>
          
          <div className="flex space-x-3">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => {
                if (validateForm()) {
                  // Primero configuramos para usar roles recomendados
                  addRecommendedRoles();
                  toast({
                    title: "Roles Recomendados",
                    description: `Se aplicarán ${recommendedRoleIds.length} roles recomendados basados en la plantilla seleccionada.`,
                  });
                  calculateTotalCost();
                  onNext();
                }
              }}
              className="flex items-center"
            >
              <span className="mr-1">✓</span>
              Usar Roles Recomendados
            </Button>
            
            <Button type="button" onClick={handleContinue} className="flex items-center">
              Continuar
              <span className="ml-1">→</span>
            </Button>
          </div>
        </div>
        
        {recommendedRoleIds.length > 0 && (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
            <h5 className="text-base font-medium text-blue-700">Roles Recomendados Disponibles</h5>
            <p className="text-sm text-blue-600 mt-1">
              La plantilla seleccionada sugiere {recommendedRoleIds.length} roles específicos para este proyecto.
              Puedes aplicar estos roles automáticamente o configurar el equipo manualmente en el siguiente paso.
            </p>
          </div>
        )}
      </div>

      {/* Cost breakdown with chart visualization */}
      <div className="bg-white rounded-lg shadow mt-6 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-neutral-800">Desglose de Costos</h3>
          <div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Actualizado
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <h4 className="text-base font-medium text-neutral-700 mb-3">Factores de Costo</h4>
            <div className="overflow-hidden rounded-lg border border-neutral-200">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Categoría</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Elemento</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Impacto</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {quotationData.analysisType && (
                    <tr>
                      <td className="px-4 py-2 text-sm text-neutral-900">Tipo de Análisis</td>
                      <td className="px-4 py-2 text-sm text-neutral-900">{quotationData.analysisType}</td>
                      <td className="px-4 py-2">
                        {complexityFactors.analysisTypeFactor > 0 && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning bg-opacity-10 text-warning">
                            +{(complexityFactors.analysisTypeFactor * 100).toFixed(0)}% costo
                          </span>
                        )}
                      </td>
                    </tr>
                  )}
                  {quotationData.mentionsVolume && (
                    <tr>
                      <td className="px-4 py-2 text-sm text-neutral-900">Volumen de Menciones</td>
                      <td className="px-4 py-2 text-sm text-neutral-900">{quotationData.mentionsVolume}</td>
                      <td className="px-4 py-2">
                        {complexityFactors.mentionsVolumeFactor > 0 && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning bg-opacity-10 text-warning">
                            +{(complexityFactors.mentionsVolumeFactor * 100).toFixed(0)}% costo
                          </span>
                        )}
                      </td>
                    </tr>
                  )}
                  {quotationData.countriesCovered && (
                    <tr>
                      <td className="px-4 py-2 text-sm text-neutral-900">Países</td>
                      <td className="px-4 py-2 text-sm text-neutral-900">{quotationData.countriesCovered}</td>
                      <td className="px-4 py-2">
                        {complexityFactors.countriesFactor > 0 && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning bg-opacity-10 text-warning">
                            +{(complexityFactors.countriesFactor * 100).toFixed(0)}% costo
                          </span>
                        )}
                      </td>
                    </tr>
                  )}
                  {selectedTemplateId && templates && (
                    <tr>
                      <td className="px-4 py-2 text-sm text-neutral-900">Plantilla</td>
                      <td className="px-4 py-2 text-sm text-neutral-900">
                        {templates.find(t => t.id === selectedTemplateId)?.name}
                      </td>
                      <td className="px-4 py-2">
                        {complexityFactors.templateFactor > 0 && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning bg-opacity-10 text-warning">
                            +{(complexityFactors.templateFactor * 100).toFixed(0)}% costo
                          </span>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="lg:col-span-1">
            <h4 className="text-base font-medium text-neutral-700 mb-3">Distribución de Costos</h4>
            <div className="bg-neutral-100 p-4 rounded-lg h-60">
              {getCostFactorsData().length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={getCostFactorsData()}
                      cx="50%"
                      cy="50%"
                      outerRadius={50}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      labelLine={true}
                      label
                    >
                      {getCostFactorsData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => [`+${(value * 100).toFixed(0)}%`, "Impacto"]} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-sm text-neutral-500">No hay factores de complejidad aplicados</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="mt-6">
          <CostBreakdown teamMembers={teamMembers} showComplexity={true} />
        </div>
      </div>
    </div>
  );
}
