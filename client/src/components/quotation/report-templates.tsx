import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQuoteContext } from "@/context/quote-context";
import { ReportTemplate, Role } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import CostBreakdown from "./cost-breakdown";
import { v4 as uuidv4 } from "uuid";
import { TeamMember } from "@/context/quote-context";
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
    setTeamMembers,
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
  
  // Obtener roles para utilizarlos en la creación directa de miembros del equipo
  const { data: roles } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });
  
  // Ya no necesitamos traducir las plantillas porque vienen en español desde la base de datos
  const templates = originalTemplates;

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
        <h4 className="text-base font-medium text-blue-700">¿Cuál es la diferencia entre tipo de proyecto y plantilla?</h4>
        <p className="text-sm text-blue-600 mt-1">
          <strong>Tipo de Proyecto</strong> (seleccionado anteriormente): Define el propósito general del entregable 
          (ej. Informe Demo, Informe Ejecutivo, Always On, etc.).
        </p>
        <p className="text-sm text-blue-600 mt-2">
          <strong>Plantilla de Informe</strong> (a seleccionar ahora): Define la estructura específica, 
          formato y presentación del entregable final al cliente.
        </p>
        <p className="text-sm text-blue-600 mt-2 italic">
          Por ejemplo, podrías necesitar un "Informe Exhaustivo" (tipo de proyecto) presentado como 
          "Panel Ejecutivo" (plantilla) para un cliente que requiere información detallada pero en formato visual.
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
                  // Implementación directa para añadir roles recomendados
                  console.log("[TEST] Implementando método directo para añadir roles desde template.tsx");
                  
                  try {
                    if (!selectedTemplateId) {
                      console.error("No hay plantilla seleccionada");
                      toast({
                        title: "Error",
                        description: "Debes seleccionar una plantilla primero",
                        variant: "destructive"
                      });
                      return;
                    }
                    
                    if (!roles || roles.length === 0) {
                      console.error("No hay roles disponibles");
                      toast({
                        title: "Error",
                        description: "No hay roles disponibles en el sistema",
                        variant: "destructive"
                      });
                      return;
                    }
                    
                    if (!recommendedRoleIds || recommendedRoleIds.length === 0) {
                      console.error("No hay roles recomendados para esta plantilla");
                      toast({
                        title: "Sin roles recomendados",
                        description: "Esta plantilla no tiene roles recomendados definidos",
                        variant: "destructive"
                      });
                      return;
                    }
                    
                    console.log("Procesando roles recomendados:", recommendedRoleIds);
                    
                    // Obtener roles únicos
                    const uniqueRoleIds = Array.from(new Set(recommendedRoleIds));
                    
                    // Crear nuevos miembros del equipo
                    const newTeamMembers: TeamMember[] = [];
                    
                    // Procesar cada rol único
                    uniqueRoleIds.forEach(roleId => {
                      const role = roles.find(r => r.id === roleId);
                      
                      if (!role) {
                        console.warn(`Rol ID ${roleId} no encontrado`);
                        return;
                      }
                      
                      // Usar 40 horas por defecto
                      const hours = 40;
                      
                      newTeamMembers.push({
                        id: uuidv4(),
                        roleId: role.id,
                        personnelId: null,
                        hours: hours,
                        rate: role.defaultRate,
                        cost: hours * role.defaultRate
                      });
                    });
                    
                    // Limpiar los roles actuales
                    setTeamMembers([]);
                    
                    // Agregar los nuevos roles 
                    console.log("[DEBUGGING] Actualizando team members con:", newTeamMembers.length, "roles");
                    setTeamMembers(newTeamMembers);
                    
                    // Verificamos que el estado se ha actualizado correctamente
                    setTimeout(() => {
                      console.log("[DEBUGGING] Estado de teamMembers después de actualizar:", teamMembers.length);
                    }, 100);
                    
                    console.log("Roles añadidos:", newTeamMembers);
                    
                    // Recalcular costos - ejecutar después que team members se haya actualizado
                    setTimeout(() => {
                      console.log("[DEBUGGING] Ejecutando cálculo de costos después de actualizar team members");
                      calculateTotalCost();
                    }, 200);
                    
                    toast({
                      title: "Roles Recomendados Aplicados",
                      description: `Se han aplicado ${newTeamMembers.length} roles recomendados basados en la plantilla seleccionada.`,
                    });
                    
                    // Continuar al siguiente paso
                    setTimeout(() => {
                      onNext();
                    }, 300);
                  } catch (error) {
                    console.error("Error crítico al añadir roles recomendados:", error);
                    toast({
                      title: "Error al aplicar roles",
                      description: "Hubo un problema al aplicar los roles recomendados. Por favor, inténtalo de nuevo.",
                      variant: "destructive"
                    });
                  }
                }
              }}
              className="flex items-center bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
            >
              <span className="mr-1">✓</span>
              Usar {recommendedRoleIds.length} Roles Recomendados
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
