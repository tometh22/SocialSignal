import React, { createContext, useContext, useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { useQuery } from "@tanstack/react-query";
import { ReportTemplate, Role } from "@shared/schema";
import {
  getAnalysisTypeFactor,
  getMentionsVolumeFactor,
  getCountriesFactor,
  getClientEngagementFactor,
  getTemplateFactor,
  calculateComplexityAdjustment,
  calculateMarkup,
  calculateTotalAmount,
  ComplexityFactors
} from "@/lib/calculation";
import { apiRequest } from "@/lib/queryClient";

export interface TeamMember {
  id: string;
  roleId: number;
  personnelId: number | null;
  hours: number;
  rate: number;
  cost: number;
}

interface ProjectDetails {
  clientId?: number;
  projectName?: string;
  analysisType?: string;
  projectType?: string;
  mentionsVolume?: string;
  countriesCovered?: string;
  clientEngagement?: string;
}

interface QuotationData {
  analysisType: string;
  projectType: string;
  mentionsVolume: string;
  countriesCovered: string;
  clientEngagement: string;
  templateComplexity: string;
}

interface QuoteContextType {
  projectDetails: ProjectDetails;
  teamMembers: TeamMember[];
  selectedTemplateId: number | null;
  templateCustomization: string | null;
  recommendedRoleIds: number[];
  baseCost: number;
  complexityAdjustment: number;
  markupAmount: number;
  totalAmount: number;
  complexityFactors: ComplexityFactors;
  quotationData: QuotationData;
  quoteOption: "roles" | "team";
  updateProjectDetails: (details: Partial<ProjectDetails>) => void;
  addTeamMember: (member: Omit<TeamMember, "id">) => void;
  updateTeamMember: (id: string, member: TeamMember) => void;
  removeTeamMember: (id: string) => void;
  updateReportTemplate: (templateId: number) => void;
  updateTemplateCustomization: (customization: string) => void;
  updateQuoteOption: (option: "roles" | "team") => void;
  addRecommendedRoles: () => void;
  analyzeInputs: () => void;
  calculateBaseCost: () => void;
  calculateTotalCost: () => void;
}

const QuoteContext = createContext<QuoteContextType | undefined>(undefined);

export const QuoteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Project details
  const [projectDetails, setProjectDetails] = useState<ProjectDetails>({});
  
  // Team members
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  
  // Quote option
  const [quoteOption, setQuoteOption] = useState<"roles" | "team">("roles");
  
  // Report template
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [templateCustomization, setTemplateCustomization] = useState<string | null>(null);
  
  // Recommended roles based on selected template
  const [recommendedRoleIds, setRecommendedRoleIds] = useState<number[]>([]);
  
  // Cost calculation
  const [baseCost, setBaseCost] = useState(0);
  const [complexityAdjustment, setComplexityAdjustment] = useState(0);
  const [markupAmount, setMarkupAmount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  
  // Complexity factors
  const [complexityFactors, setComplexityFactors] = useState<ComplexityFactors>({
    analysisTypeFactor: 0,
    mentionsVolumeFactor: 0,
    countriesFactor: 0,
    clientEngagementFactor: 0,
    templateFactor: 0
  });
  
  // Quotation data for calculation
  const [quotationData, setQuotationData] = useState<QuotationData>({
    analysisType: "",
    projectType: "",
    mentionsVolume: "",
    countriesCovered: "",
    clientEngagement: "",
    templateComplexity: ""
  });

  // Get template info
  const { data: templates } = useQuery<ReportTemplate[]>({
    queryKey: ["/api/templates"],
  });
  
  // Get roles info
  const { data: roles } = useQuery<any[]>({
    queryKey: ["/api/roles"],
  });

  // Project details update
  const updateProjectDetails = useCallback((details: Partial<ProjectDetails>) => {
    setProjectDetails(prev => ({ ...prev, ...details }));
  }, []);

  // Team members operations
  const addTeamMember = useCallback((member: Omit<TeamMember, "id">) => {
    const newMember: TeamMember = {
      ...member,
      id: uuidv4()
    };
    setTeamMembers(prev => [...prev, newMember]);
  }, []);

  const updateTeamMember = useCallback((id: string, member: TeamMember) => {
    setTeamMembers(prev => prev.map(m => m.id === id ? member : m));
  }, []);

  const removeTeamMember = useCallback((id: string) => {
    setTeamMembers(prev => prev.filter(m => m.id !== id));
  }, []);

  // Report template operations
  const updateReportTemplate = useCallback((templateId: number) => {
    console.log("Actualizando plantilla a:", templateId);
    setSelectedTemplateId(templateId);
    
    // Update template complexity factor
    if (templates && roles) {
      const template = templates.find(t => t.id === templateId);
      console.log("Plantilla encontrada:", template);
      
      if (template) {
        const templateFactor = getTemplateFactor(template.complexity);
        setComplexityFactors(prev => ({
          ...prev,
          templateFactor
        }));
        setQuotationData(prev => ({
          ...prev,
          templateComplexity: template.complexity
        }));
        
        // Cargar las asignaciones de roles para esta plantilla desde la API
        // Esta llamada obtiene qué roles están asignados a la plantilla seleccionada
        apiRequest(`/api/template-roles/${templateId}`)
          .then(response => {
            console.log("Asignaciones de roles cargadas:", response);
            
            if (response && Array.isArray(response)) {
              // Extraer los IDs de roles de las asignaciones
              const recommendedIds = response.map(assignment => assignment.roleId);
              console.log("Roles recomendados basados en asignaciones:", recommendedIds);
              
              // Guardar los roles recomendados en el estado
              setRecommendedRoleIds(recommendedIds);
            } else {
              console.log("No se encontraron asignaciones de roles para esta plantilla");
              
              // Si no hay asignaciones configuradas, usamos la lógica anterior basada en complejidad
              // Buscar roles por nombre en lugar de usar IDs fijos
              console.log("Roles disponibles para recomendación:", roles.map(r => ({ id: r.id, name: r.name })));
              
              const analistaId = roles.find(r => r.name.toLowerCase().includes("analista") && r.name.toLowerCase().includes("senior"))?.id;
              const cientificoId = roles.find(r => r.name.toLowerCase().includes("data") || r.name.toLowerCase().includes("científico"))?.id;
              const especialistaId = roles.find(r => r.name.toLowerCase().includes("contenido") || r.name.toLowerCase().includes("content"))?.id;
              const gerenteId = roles.find(r => r.name.toLowerCase().includes("gerente") || r.name.toLowerCase().includes("manager"))?.id;
              
              // Crear array con los IDs encontrados (excluyendo undefined)
              const roleIds = [analistaId, cientificoId, especialistaId, gerenteId].filter(id => id !== undefined) as number[];
              
              // Asignar según la complejidad
              let recommendedIds: number[] = [];
              if (template.complexity === "high") {
                // Para informes complejos, recomendamos todos los roles disponibles
                recommendedIds = roleIds;
              } else if (template.complexity === "medium") {
                // Para informes medianos, excluimos algunos roles
                recommendedIds = roleIds.slice(0, 3);  // Usar los primeros 3 roles
              } else {
                // Para informes básicos, solo los roles principales
                recommendedIds = roleIds.slice(0, 2);  // Usar los primeros 2 roles
              }
              
              console.log("Configurando roles recomendados por complejidad:", recommendedIds);
              setRecommendedRoleIds(recommendedIds);
            }
          })
          .catch(error => {
            console.error("Error al cargar asignaciones de roles:", error);
          });
      }
    }
  }, [templates, roles]);

  const updateTemplateCustomization = useCallback((customization: string) => {
    setTemplateCustomization(customization);
  }, []);
  
  // Update quote option
  const updateQuoteOption = useCallback((option: "roles" | "team") => {
    setQuoteOption(option);
    
    // Al cambiar la opción, reseteamos el equipo para empezar de nuevo
    setTeamMembers([]);
    
    // Cuando cambiamos a opción por equipo, debemos reflejar correctamente
    // que se usarán tarifas personalizadas por miembro en lugar de tarifas estándar
    if (option === "team") {
      console.log("Cambiando a cotización por miembros específicos");
    } else {
      console.log("Cambiando a cotización por roles estándar");
    }
  }, []);

  // Analyze inputs to determine complexity factors
  const analyzeInputs = useCallback(() => {
    if (
      projectDetails.analysisType &&
      projectDetails.mentionsVolume &&
      projectDetails.countriesCovered &&
      projectDetails.clientEngagement
    ) {
      const analysisTypeFactor = getAnalysisTypeFactor(projectDetails.analysisType);
      const mentionsVolumeFactor = getMentionsVolumeFactor(projectDetails.mentionsVolume);
      const countriesFactor = getCountriesFactor(projectDetails.countriesCovered);
      const clientEngagementFactor = getClientEngagementFactor(projectDetails.clientEngagement);
      
      setComplexityFactors(prev => ({
        ...prev,
        analysisTypeFactor,
        mentionsVolumeFactor,
        countriesFactor,
        clientEngagementFactor
      }));
      
      setQuotationData({
        analysisType: projectDetails.analysisType,
        projectType: projectDetails.projectType || "",
        mentionsVolume: projectDetails.mentionsVolume,
        countriesCovered: projectDetails.countriesCovered,
        clientEngagement: projectDetails.clientEngagement,
        templateComplexity: quotationData.templateComplexity
      });
    }
  }, [
    projectDetails.analysisType,
    projectDetails.mentionsVolume,
    projectDetails.countriesCovered,
    projectDetails.clientEngagement,
    projectDetails.projectType,
    quotationData.templateComplexity
  ]);

  // Calculate base cost from team members
  const calculateBaseCost = useCallback(() => {
    const total = teamMembers.reduce((sum, member) => sum + member.cost, 0);
    setBaseCost(total);
    return total;
  }, [teamMembers]);

  // Calculate total cost with complexity adjustments and markup
  const calculateTotalCost = useCallback(() => {
    // Calculate base cost from team members
    const baseTeamCost = calculateBaseCost();
    
    // Calculate complexity adjustment
    const complexityAdj = calculateComplexityAdjustment(baseTeamCost, complexityFactors);
    setComplexityAdjustment(complexityAdj);
    
    // Calculate markup (minimum 2x)
    const adjusted = baseTeamCost + complexityAdj;
    const markup = calculateMarkup(adjusted);
    setMarkupAmount(markup);
    
    // Calculate total
    const total = calculateTotalAmount(baseTeamCost, complexityAdj, markup);
    setTotalAmount(total);
  }, [calculateBaseCost, complexityFactors]);
  
  // Función para añadir roles recomendados al equipo basado en la plantilla seleccionada
  const addRecommendedRoles = useCallback(() => {
    console.log("Añadiendo roles recomendados:", recommendedRoleIds);
    
    // Siempre limpiamos roles existentes al añadir los recomendados
    setTeamMembers([]);
    
    if (roles && selectedTemplateId) {
      // Cargar las asignaciones de roles desde la API para obtener las horas asignadas
      apiRequest(`/api/template-roles/${selectedTemplateId}`)
        .then(response => {
          console.log("Asignaciones de roles para configuración de horas:", response);
          
          if (response && Array.isArray(response)) {
            // Para cada rol recomendado, añadirlo al equipo si existe
            recommendedRoleIds.forEach(roleId => {
              const role = roles.find(r => r.id === roleId);
              console.log("Procesando rol recomendado:", roleId, role);
              
              if (role) {
                // Buscar si hay una asignación específica para este rol en esta plantilla
                const roleAssignment = response.find(assignment => assignment.roleId === roleId);
                // Determinar horas asignadas (usar las horas de la asignación si existe, o un valor predeterminado)
                const assignedHours = roleAssignment ? parseInt(roleAssignment.hours) : 10;
                
                // Añadir el rol con las horas asignadas según la asignación de la plantilla
                const newMember = {
                  roleId: role.id,
                  personnelId: null,
                  hours: assignedHours,
                  rate: role.defaultRate,
                  cost: assignedHours * role.defaultRate
                };
                
                console.log("Añadiendo miembro con horas asignadas:", newMember);
                
                // Usamos directamente la función en lugar de la versión memorizada
                // para evitar problemas de dependencias en useCallback
                setTeamMembers(prev => [...prev, {
                  ...newMember,
                  id: uuidv4()
                }]);
              }
            });
            
            console.log("Roles recomendados añadidos con horas asignadas");
          } else {
            // Usar lógica predeterminada si no hay asignaciones disponibles
            recommendedRoleIds.forEach(roleId => {
              const role = roles.find(r => r.id === roleId);
              if (role) {
                const newMember = {
                  roleId: role.id,
                  personnelId: null,
                  hours: 10, // Horas predeterminadas
                  rate: role.defaultRate,
                  cost: 10 * role.defaultRate
                };
                
                setTeamMembers(prev => [...prev, {
                  ...newMember,
                  id: uuidv4()
                }]);
              }
            });
            
            console.log("Roles recomendados añadidos con horas predeterminadas");
          }
        })
        .catch(error => {
          console.error("Error al cargar asignaciones para horas:", error);
          
          // En caso de error, usar lógica predeterminada
          recommendedRoleIds.forEach(roleId => {
            const role = roles.find(r => r.id === roleId);
            if (role) {
              const newMember = {
                roleId: role.id,
                personnelId: null,
                hours: 10, // Horas predeterminadas
                rate: role.defaultRate,
                cost: 10 * role.defaultRate
              };
              
              setTeamMembers(prev => [...prev, {
                ...newMember,
                id: uuidv4()
              }]);
            }
          });
        });
    } else {
      console.log("No hay roles disponibles o no se ha seleccionado plantilla");
    }
  }, [recommendedRoleIds, roles, selectedTemplateId]);

  const value = {
    projectDetails,
    teamMembers,
    selectedTemplateId,
    templateCustomization,
    recommendedRoleIds,
    baseCost,
    complexityAdjustment,
    markupAmount,
    totalAmount,
    complexityFactors,
    quotationData,
    quoteOption,
    updateProjectDetails,
    addTeamMember,
    updateTeamMember,
    removeTeamMember,
    updateReportTemplate,
    updateTemplateCustomization,
    updateQuoteOption,
    addRecommendedRoles,
    analyzeInputs,
    calculateBaseCost,
    calculateTotalCost
  };

  return <QuoteContext.Provider value={value}>{children}</QuoteContext.Provider>;
};

export const useQuoteContext = () => {
  const context = useContext(QuoteContext);
  if (context === undefined) {
    throw new Error("useQuoteContext must be used within a QuoteProvider");
  }
  return context;
};
