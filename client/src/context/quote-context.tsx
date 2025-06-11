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
  platformCost: number;
  deviationPercentage: number;
  complexityFactors: ComplexityFactors;
  quotationData: QuotationData;
  quoteOption: "roles" | "team";
  updateProjectDetails: (details: Partial<ProjectDetails>) => void;
  addTeamMember: (member: Omit<TeamMember, "id">) => void;
  updateTeamMember: (id: string, member: TeamMember) => void;
  removeTeamMember: (id: string) => void;
  setTeamMembers: (members: TeamMember[]) => void;
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
  const [platformCost, setPlatformCost] = useState(0);
  const [deviationPercentage, setDeviationPercentage] = useState(0);
  
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
    // Si seleccionamos la misma plantilla, no hacemos nada para evitar recargas innecesarias
    if (selectedTemplateId === templateId) {
      return;
    }
    
    
    // Limpiamos el equipo actual para evitar duplicidades
    setTeamMembers([]);
    
    // Actualizamos la plantilla seleccionada
    setSelectedTemplateId(templateId);
    
    // Reiniciamos el costo base ya que el equipo está vacío ahora
    setBaseCost(0);
    
    // Update template complexity factor
    if (templates && roles) {
      const template = templates.find(t => t.id === templateId);
      
      if (template) {
        // Actualizar factor de complejidad
        const templateFactor = getTemplateFactor(template.complexity);
        setComplexityFactors(prev => ({
          ...prev,
          templateFactor
        }));
        setQuotationData(prev => ({
          ...prev,
          templateComplexity: template.complexity
        }));
        
        // Actualizar costos y desviación de la plantilla
        const platformCost = typeof template.platformCost === 'number' ? template.platformCost : 0;
        const deviationPercentage = typeof template.deviationPercentage === 'number' ? template.deviationPercentage : 0;
        
        setPlatformCost(platformCost);
        setDeviationPercentage(deviationPercentage);
        
        try {
          // Cargar las asignaciones de roles para esta plantilla desde la API
          // Esta llamada obtiene qué roles están asignados a la plantilla seleccionada
          apiRequest(`/api/template-roles/${templateId}`)
            .then(response => {
              
              if (response && Array.isArray(response)) {
                // Extraer los IDs de roles de las asignaciones
                const recommendedIds = response.map(assignment => assignment.roleId);
                
                // Guardar los roles recomendados en el estado
                setRecommendedRoleIds(recommendedIds);
              } else {
                generarRolesRecomendadosPorComplejidad(template, roles);
              }
            })
            .catch(error => {
              console.error("[TEMPLATE] Error al cargar asignaciones de roles:", error);
              generarRolesRecomendadosPorComplejidad(template, roles);
            });
        } catch (error) {
          console.error("[TEMPLATE] Error general al cargar roles:", error);
          generarRolesRecomendadosPorComplejidad(template, roles);
        }
      }
    }
  }, [templates, roles, selectedTemplateId]);
  
  // Función auxiliar para generar roles recomendados basados en complejidad
  const generarRolesRecomendadosPorComplejidad = (template: ReportTemplate, allRoles: Role[]) => {
    
    const analistaId = allRoles.find(r => r.name.toLowerCase().includes("analista") && r.name.toLowerCase().includes("senior"))?.id;
    const cientificoId = allRoles.find(r => r.name.toLowerCase().includes("data") || r.name.toLowerCase().includes("científico"))?.id;
    const especialistaId = allRoles.find(r => r.name.toLowerCase().includes("contenido") || r.name.toLowerCase().includes("content"))?.id;
    const gerenteId = allRoles.find(r => r.name.toLowerCase().includes("gerente") || r.name.toLowerCase().includes("manager"))?.id;
    
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
    
    setRecommendedRoleIds(recommendedIds);
  };

  const updateTemplateCustomization = useCallback((customization: string) => {
    setTemplateCustomization(customization);
  }, []);
  
  // Update quote option
  const updateQuoteOption = useCallback((option: "roles" | "team") => {
    setQuoteOption(option);
    
    // Al cambiar la opción, reseteamos el equipo para empezar de nuevo
    setTeamMembers([]);
    
    // Reiniciamos el costo base ya que el equipo está vacío ahora
    setBaseCost(0);
    
    // Cuando cambiamos a opción por equipo, debemos reflejar correctamente
    // que se usarán tarifas personalizadas por miembro en lugar de tarifas estándar
    if (option === "team") {
    } else {
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
    
    // Si el costo base es 0 pero hay miembros en el equipo, hay un problema
    if (baseTeamCost === 0 && teamMembers.length > 0) {
      console.warn("[COST] ⚠️ Costo base es 0 pero hay", teamMembers.length, "miembros en el equipo");
      // Calcular manualmente el costo base sumando los costos de los miembros
      const manualBaseCost = teamMembers.reduce((sum, member) => sum + member.cost, 0);
      
      // Actualizar el costo base con el valor calculado manualmente
      if (manualBaseCost > 0) {
        setBaseCost(manualBaseCost);
      }
    }
    
    // Usar el valor actualizado
    const finalBaseCost = baseTeamCost > 0 ? baseTeamCost : baseCost;
    
    // Calculate complexity adjustment
    const complexityAdj = calculateComplexityAdjustment(finalBaseCost, complexityFactors);
    setComplexityAdjustment(complexityAdj);
    
    // Calculate markup (minimum 2x)
    const adjusted = finalBaseCost + complexityAdj;
    const markup = calculateMarkup(adjusted);
    setMarkupAmount(markup);
    
    // Obtener los costos adicionales de la plantilla seleccionada
    let currentPlatformCost = platformCost;
    let currentDeviationPercentage = deviationPercentage;
    
    if (selectedTemplateId && templates) {
      const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
      if (selectedTemplate) {
        currentPlatformCost = selectedTemplate.platformCost || 0;
        currentDeviationPercentage = selectedTemplate.deviationPercentage || 0;
        
        // Actualizar los estados
        setPlatformCost(currentPlatformCost);
        setDeviationPercentage(currentDeviationPercentage);
      }
    }
    
    
    // Calculate total with platform costs and deviation percentage
    const total = calculateTotalAmount(
      finalBaseCost, 
      complexityAdj, 
      markup, 
      currentPlatformCost, 
      currentDeviationPercentage
    );
    
    setTotalAmount(total);
    
    return total;
  }, [calculateBaseCost, complexityFactors, selectedTemplateId, templates, teamMembers, baseCost, platformCost, deviationPercentage]);
  
  // Función para añadir roles recomendados al equipo basado en la plantilla seleccionada
  const addRecommendedRoles = useCallback(() => {
    try {
      
      // Siempre limpiamos roles existentes al añadir los recomendados
      setTeamMembers([]);
      
      if (!roles || !selectedTemplateId) {
        return;
      }
      
      // Primero cargaremos las asignaciones de roles para obtener las horas asociadas
      apiRequest(`/api/template-roles/${selectedTemplateId}`)
        .then(assignments => {
          if (selectedTemplateId === 17) {
          }
          
          if (!Array.isArray(assignments) || assignments.length === 0) {
            if (templates) {
              const template = templates.find(t => t.id === selectedTemplateId);
              if (template) {
                useDefaultRolesBasedOnComplexity(template);
              }
            }
            return;
          }
          
          // Tenemos asignaciones, vamos a añadir los roles con sus horas correspondientes
          // Convertimos a array después de eliminar duplicados
          const rolesToAdd = Array.from(new Set(recommendedRoleIds)); 
          
          let addedMembers: TeamMember[] = [];
          let addedRoleCount = 0;
          
          // Para cada rol recomendado, buscamos sus asignaciones
          rolesToAdd.forEach(roleId => {
            // Encontrar el rol en la lista de roles disponibles
            const role = roles.find(r => r.id === roleId);
            if (!role) {
              return;
            }
            
            // Encontrar todas las asignaciones para este rol
            const roleAssignments = assignments.filter(a => a.roleId === roleId);
            
            if (roleAssignments.length === 0) {
              // Usar horas predeterminadas
              addedMembers.push({
                id: uuidv4(),
                roleId: role.id,
                personnelId: null,
                hours: 10,
                rate: role.defaultRate,
                cost: 10 * role.defaultRate
              });
              addedRoleCount++;
            } else {
              // Para cada asignación, añadir una entrada al equipo
              roleAssignments.forEach(assignment => {
                const hours = parseInt(assignment.hours);
                
                addedMembers.push({
                  id: uuidv4(),
                  roleId: role.id,
                  personnelId: null,
                  hours: hours,
                  rate: role.defaultRate,
                  cost: hours * role.defaultRate
                });
                addedRoleCount++;
              });
            }
          });
          
          // Actualizar el estado con todos los miembros añadidos de una vez
          if (addedMembers.length > 0) {
            setTeamMembers(addedMembers);
            
            // Recalcular los costos después de añadir los roles
            // Primero calculamos costo base para asegurar que tenga valor correcto
            const newBaseCost = addedMembers.reduce((sum, member) => sum + member.cost, 0);
            setBaseCost(newBaseCost);
            
            // Luego calculamos costo total
            setTimeout(() => {
              calculateTotalCost();
            }, 100);
          } else {
            if (templates) {
              const template = templates.find(t => t.id === selectedTemplateId);
              if (template) {
                useDefaultRolesBasedOnComplexity(template);
              }
            }
          }
        })
        .catch(error => {
          console.error("Error al cargar asignaciones de roles:", error);
          // En caso de error, utilizar los roles recomendados con horas predeterminadas
          if (recommendedRoleIds.length > 0) {
            const rolesToAdd = Array.from(new Set(recommendedRoleIds)); // Eliminamos duplicados
            let addedMembers: TeamMember[] = [];
            
            rolesToAdd.forEach(roleId => {
              const role = roles.find(r => r.id === roleId);
              if (role) {
                const hours = 10; // Horas predeterminadas en caso de error
                
                addedMembers.push({
                  id: uuidv4(),
                  roleId: role.id,
                  personnelId: null,
                  hours: hours,
                  rate: role.defaultRate,
                  cost: hours * role.defaultRate
                });
              }
            });
            
            if (addedMembers.length > 0) {
              setTeamMembers(addedMembers);
              
              // Recalcular costos después de añadir los roles en modo recuperación
              const newBaseCost = addedMembers.reduce((sum, member) => sum + member.cost, 0);
              setBaseCost(newBaseCost);
              
              setTimeout(() => {
                calculateTotalCost();
              }, 100);
            } else if (templates) {
              const template = templates.find(t => t.id === selectedTemplateId);
              if (template) {
                useDefaultRolesBasedOnComplexity(template);
              }
            }
          } else {
            if (templates) {
              const template = templates.find(t => t.id === selectedTemplateId);
              if (template) {
                useDefaultRolesBasedOnComplexity(template);
              }
            }
          }
        });
    } catch (error) {
      console.error("Error general en addRecommendedRoles:", error);
      
      // Añadir al menos un rol por defecto para evitar que el usuario se quede sin opciones
      if (roles && roles.length > 0) {
        // Buscar roles prioritarios que son casi siempre necesarios
        const analistaRole = roles.find(r => r.name.toLowerCase().includes("analista"));
        const managerRole = roles.find(r => r.name.toLowerCase().includes("manager") || r.name.toLowerCase().includes("gerente"));
        
        const roleToAdd = analistaRole || managerRole || roles[0];
        
        if (roleToAdd) {
          const hours = 10;
          setTeamMembers([{
            id: uuidv4(),
            roleId: roleToAdd.id,
            personnelId: null,
            hours: hours, 
            rate: roleToAdd.defaultRate,
            cost: hours * roleToAdd.defaultRate
          }]);
          
        }
      }
    }
  }, [recommendedRoleIds, roles, selectedTemplateId, templates, calculateTotalCost]);
  
  // Función auxiliar para usar roles predeterminados basados en la complejidad
  const useDefaultRolesBasedOnComplexity = (template: ReportTemplate) => {
    if (!roles) return;
    
    
    try {
      // Buscar roles por nombre
      const analistaId = roles.find(r => r.name.toLowerCase().includes("analista"))?.id;
      const dataId = roles.find(r => r.name.toLowerCase().includes("data"))?.id;
      const managerId = roles.find(r => r.name.toLowerCase().includes("manager") || r.name.toLowerCase().includes("gerente"))?.id;
      const diseñadorId = roles.find(r => r.name.toLowerCase().includes("diseñador") || r.name.toLowerCase().includes("designer"))?.id;
      
      // Filtrar los que existan
      const availableRoles = [analistaId, dataId, managerId, diseñadorId].filter(id => id !== undefined) as number[];
      
      // Si no encontramos roles específicos, usamos los primeros de la lista completa
      const defaultRoleIds = availableRoles.length > 0 
        ? availableRoles 
        : roles.slice(0, 3).map(r => r.id);
      
      
      // Determinar cuántos roles usar según complejidad
      let roleIdsToUse: number[];
      
      if (template.complexity === "high") {
        // Para proyectos complejos usamos todos los roles disponibles (máx 4)
        roleIdsToUse = defaultRoleIds.slice(0, Math.min(4, defaultRoleIds.length));
      } else if (template.complexity === "medium") {
        // Para proyectos medios usamos hasta 3 roles
        roleIdsToUse = defaultRoleIds.slice(0, Math.min(3, defaultRoleIds.length));
      } else {
        // Para proyectos simples usamos hasta 2 roles
        roleIdsToUse = defaultRoleIds.slice(0, Math.min(2, defaultRoleIds.length));
      }
      
      // Añadir los roles seleccionados al equipo
      roleIdsToUse.forEach(roleId => {
        const role = roles.find(r => r.id === roleId);
        if (role) {
          const hours = 10; // Horas predeterminadas
          
          setTeamMembers(prev => [...prev, {
            id: uuidv4(),
            roleId: role.id,
            personnelId: null,
            hours: hours,
            rate: role.defaultRate,
            cost: hours * role.defaultRate
          }]);
        }
      });
      
      
      // Recalcular costos después de añadir roles predeterminados
      setTimeout(() => {
        calculateBaseCost();
        calculateTotalCost();
      }, 100);
    } catch (error) {
      console.error("Error al generar roles predeterminados:", error);
      
      // En caso de error extremo, añadir el primer rol de la lista
      if (roles.length > 0) {
        const role = roles[0];
        const hours = 10;
        
        setTeamMembers([{
          id: uuidv4(),
          roleId: role.id,
          personnelId: null,
          hours: hours,
          rate: role.defaultRate,
          cost: hours * role.defaultRate
        }]);
        
        
        // Recalcular costos después de añadir el rol de emergencia
        setTimeout(() => {
          calculateBaseCost();
          calculateTotalCost();
        }, 100);
      }
    }
  };

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
    platformCost,
    deviationPercentage,
    complexityFactors,
    quotationData,
    quoteOption,
    updateProjectDetails,
    addTeamMember,
    updateTeamMember,
    removeTeamMember,
    setTeamMembers,
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
