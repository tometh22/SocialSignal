import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Client, ReportTemplate, Role, Personnel } from '@shared/schema';
import { 
  calculateComplexityAdjustment, 
  calculateMarkup, 
  calculateTotalAmount,
  getAnalysisTypeFactor,
  getMentionsVolumeFactor, 
  getCountriesFactor, 
  getClientEngagementFactor,
  getTemplateFactor
} from '@/lib/calculation';
import { apiRequest } from '@/lib/queryClient';

// Definiciones de tipos

export type ProjectDuration = 'short' | 'medium' | 'long';

export interface TeamMember {
  id: string;
  roleId: number;
  personnelId: number | null;
  hours: number;
  rate: number;
  cost: number;
}

export interface ComplexityFactors {
  analysisTypeFactor: number;
  mentionsVolumeFactor: number;
  countriesFactor: number;
  clientEngagementFactor: number;
  templateFactor: number;
}

export interface FinancialSettings {
  platformCost: number;
  deviationPercentage: number;
  discount: number;
}

export interface QuotationData {
  // Paso 1: Información básica
  client: Client | null;
  project: {
    name: string;
    type: string;
    duration: ProjectDuration | '';
  };
  // Paso 2: Plantilla y configuración
  template: ReportTemplate | null;
  complexity: 'low' | 'medium' | 'high' | '';
  customization: string;
  // Paso 3: Equipo
  teamOption: 'auto' | 'manual';
  teamMembers: TeamMember[];
  // Paso 4: Financials
  financials: FinancialSettings;
}

interface OptimizedQuoteContextType {
  // Estado principal
  quotationData: QuotationData;
  // Estados derivados
  baseCost: number;
  complexityAdjustment: number;
  markupAmount: number;
  totalAmount: number;
  recommendedRoleIds: number[];
  // Métodos paso 1
  updateClient: (client: Client | null) => void;
  updateProjectName: (name: string) => void;
  updateProjectType: (type: string) => void;
  updateProjectDuration: (duration: ProjectDuration) => void;
  // Métodos paso 2
  updateTemplate: (template: ReportTemplate | null) => void;
  updateComplexity: (complexity: 'low' | 'medium' | 'high') => void;
  updateCustomization: (customization: string) => void;
  // Métodos paso 3
  setTeamOption: (option: 'auto' | 'manual') => void;
  addTeamMember: (member: Omit<TeamMember, 'id'>) => void;
  updateTeamMember: (id: string, updates: Partial<Omit<TeamMember, 'id'>>) => void;
  removeTeamMember: (id: string) => void;
  applyRecommendedTeam: () => void;
  // Métodos paso 4
  updateFinancials: (updates: Partial<FinancialSettings>) => void;
  // Método para guardar la cotización
  saveQuotation: () => Promise<number>;
  // Estado del wizard
  currentStep: number;
  goToStep: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  // Gestión de roles
  availableRoles: Role[] | null;
  availablePersonnel: Personnel[] | null;
  loadRoles: () => Promise<void>;
  loadPersonnel: () => Promise<void>;
}

// Valores iniciales
const initialQuotationData: QuotationData = {
  client: null,
  project: {
    name: '',
    type: '',
    duration: '',
  },
  template: null,
  complexity: '',
  customization: '',
  teamOption: 'auto',
  teamMembers: [],
  financials: {
    platformCost: 0,
    deviationPercentage: 0,
    discount: 0,
  },
};

// Crear el contexto
const OptimizedQuoteContext = createContext<OptimizedQuoteContextType | undefined>(undefined);

// Proveedor del contexto
export const OptimizedQuoteProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  // Estado principal
  const [quotationData, setQuotationData] = useState<QuotationData>(initialQuotationData);
  
  // Estados adicionales
  const [baseCost, setBaseCost] = useState(0);
  const [complexityAdjustment, setComplexityAdjustment] = useState(0);
  const [markupAmount, setMarkupAmount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [recommendedRoleIds, setRecommendedRoleIds] = useState<number[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [availableRoles, setAvailableRoles] = useState<Role[] | null>(null);
  const [availablePersonnel, setAvailablePersonnel] = useState<Personnel[] | null>(null);
  
  // Cálculo de complejidad basado en el estado actual
  const complexityFactors = useMemo((): ComplexityFactors => {
    // Derivar factores de complejidad en base a los datos actuales
    return {
      analysisTypeFactor: quotationData.complexity === 'high' ? 0.2 : 
                         quotationData.complexity === 'medium' ? 0.1 : 0,
      mentionsVolumeFactor: quotationData.project.duration === 'long' ? 0.15 :
                           quotationData.project.duration === 'medium' ? 0.1 : 0.05,
      countriesFactor: 0,
      clientEngagementFactor: 0,
      templateFactor: quotationData.template?.complexity === 'high' ? 0.25 :
                     quotationData.template?.complexity === 'medium' ? 0.15 : 0.05,
    };
  }, [quotationData.complexity, quotationData.project.duration, quotationData.template]);

  // Métodos para el Paso 1: Información Básica
  const updateClient = useCallback((client: Client | null) => {
    setQuotationData(prev => ({...prev, client}));
  }, []);

  const updateProjectName = useCallback((name: string) => {
    setQuotationData(prev => ({
      ...prev, 
      project: {...prev.project, name}
    }));
  }, []);

  const updateProjectType = useCallback((type: string) => {
    setQuotationData(prev => ({
      ...prev, 
      project: {...prev.project, type}
    }));
  }, []);

  const updateProjectDuration = useCallback((duration: ProjectDuration) => {
    setQuotationData(prev => ({
      ...prev, 
      project: {...prev.project, duration}
    }));
  }, []);

  // Métodos para el Paso 2: Selección de Plantilla
  const updateTemplate = useCallback((template: ReportTemplate | null) => {
    // Si seleccionamos la misma plantilla, no hacemos nada
    if (quotationData.template?.id === template?.id) {
      return;
    } else if (quotationData.template === null && template === null) {
      return;
    }
    
    // Limpiar equipos anteriores para evitar duplicidades
    setQuotationData(prev => ({
      ...prev, 
      template,
      teamMembers: [] // Limpiar equipos anteriores
    }));

    // Reiniciar los roleIds recomendados
    setRecommendedRoleIds([]);

    if (template) {
      // Actualizar financials con valores de la plantilla
      setQuotationData(prev => ({
        ...prev,
        financials: {
          ...prev.financials,
          platformCost: template.platformCost || 0,
          deviationPercentage: template.deviationPercentage || 0,
        }
      }));

      // Cargar roles recomendados
      apiRequest(`/api/template-roles/${template.id}`)
        .then(response => {
          if (response && Array.isArray(response)) {
            const recommendedIds = response.map(assignment => assignment.roleId);
            // Eliminar duplicados
            setRecommendedRoleIds(Array.from(new Set(recommendedIds)));
          }
        })
        .catch(error => {
          console.error("[TEMPLATE] Error al cargar roles recomendados:", error);
        });
    } else {
      // Caso "Personalizado / Sin Plantilla"
      // Reiniciar los financials a valores predeterminados
      setQuotationData(prev => ({
        ...prev,
        financials: {
          ...prev.financials,
          platformCost: 0,
          deviationPercentage: 0,
        }
      }));
    }
  }, [quotationData.template]);

  const updateComplexity = useCallback((complexity: 'low' | 'medium' | 'high') => {
    setQuotationData(prev => ({...prev, complexity}));
  }, []);

  const updateCustomization = useCallback((customization: string) => {
    setQuotationData(prev => ({...prev, customization}));
  }, []);

  // Métodos para el Paso 3: Configuración del Equipo
  const setTeamOption = useCallback((teamOption: 'auto' | 'manual') => {
    setQuotationData(prev => ({...prev, teamOption}));
    
    // Si cambiamos a opción automática, limpiar equipos manuales
    if (teamOption === 'auto') {
      setQuotationData(prev => ({...prev, teamMembers: []}));
    }
  }, []);

  // Función para verificar y evitar duplicados en el equipo
  const removeDuplicateMembers = useCallback((members: TeamMember[]): TeamMember[] => {
    const uniqueMap = new Map();
    
    members.forEach(member => {
      const key = `${member.roleId}_${member.personnelId || 'unassigned'}`;
      
      // Si ya existe, actualizar solo si tiene más horas
      if (uniqueMap.has(key)) {
        const existing = uniqueMap.get(key);
        if (member.hours > existing.hours) {
          uniqueMap.set(key, member);
        }
      } else {
        uniqueMap.set(key, member);
      }
    });
    
    return Array.from(uniqueMap.values());
  }, []);

  const addTeamMember = useCallback((member: Omit<TeamMember, 'id'>) => {
    setQuotationData(prev => {
      // Crear un nuevo miembro con ID único
      const newMember: TeamMember = { 
        ...member, 
        id: uuidv4() 
      };
      
      // Añadir al equipo evitando duplicados
      const updatedTeam = removeDuplicateMembers([...prev.teamMembers, newMember]);
      
      return {
        ...prev,
        teamMembers: updatedTeam
      };
    });
  }, [removeDuplicateMembers]);

  const updateTeamMember = useCallback((id: string, updates: Partial<Omit<TeamMember, 'id'>>) => {
    setQuotationData(prev => {
      // Encontrar el miembro a actualizar
      const updatedMembers = prev.teamMembers.map(member => {
        if (member.id === id) {
          // Recalcular el costo si se actualiza la tarifa o las horas
          const hours = updates.hours !== undefined ? updates.hours : member.hours;
          const rate = updates.rate !== undefined ? updates.rate : member.rate;
          const cost = hours * rate;
          
          return { 
            ...member, 
            ...updates,
            cost // Actualizar costo automáticamente
          };
        }
        return member;
      });
      
      return {
        ...prev,
        teamMembers: updatedMembers
      };
    });
  }, []);

  const removeTeamMember = useCallback((id: string) => {
    setQuotationData(prev => ({
      ...prev,
      teamMembers: prev.teamMembers.filter(member => member.id !== id)
    }));
  }, []);

  const applyRecommendedTeam = useCallback(() => {
    // Si no hay roles disponibles o recomendados, no hacemos nada
    if (!availableRoles || !recommendedRoleIds.length || !quotationData.template) {
      return;
    }

    // Limpiar equipo actual
    setQuotationData(prev => ({...prev, teamMembers: []}));

    // Cargar asignaciones de roles para obtener horas
    apiRequest(`/api/template-roles/${quotationData.template.id}`)
      .then(assignments => {
        if (!Array.isArray(assignments) || !assignments.length) {
          return;
        }

        const uniqueRoleIds = Array.from(new Set(recommendedRoleIds));
        const newTeamMembers: TeamMember[] = [];

        uniqueRoleIds.forEach(roleId => {
          // Encontrar el rol
          const role = availableRoles.find(r => r.id === roleId);
          if (!role) return;

          // Encontrar todas las asignaciones para este rol
          const roleAssignments = assignments.filter(a => a.roleId === roleId);

          if (!roleAssignments.length) {
            // Usar horas predeterminadas si no hay asignaciones
            newTeamMembers.push({
              id: uuidv4(),
              roleId: role.id,
              personnelId: 0, // Usar 0 en lugar de null para compatibilidad con la API
              hours: 10, // Valor predeterminado
              rate: role.defaultRate,
              cost: 10 * role.defaultRate
            });
          } else {
            // Añadir cada asignación como un miembro del equipo
            roleAssignments.forEach(assignment => {
              const hours = parseInt(assignment.hours);
              newTeamMembers.push({
                id: uuidv4(),
                roleId: role.id,
                personnelId: 0, // Usar 0 en lugar de null para compatibilidad con la API
                hours: hours,
                rate: role.defaultRate,
                cost: hours * role.defaultRate
              });
            });
          }
        });

        // Actualizar el equipo con los miembros recomendados
        setQuotationData(prev => ({
          ...prev,
          teamMembers: newTeamMembers
        }));

        // Recalcular costos
        calculateCosts(newTeamMembers);
      })
      .catch(error => {
        console.error("Error al cargar asignaciones de roles:", error);
      });
  }, [availableRoles, recommendedRoleIds, quotationData.template]);

  // Métodos para el Paso 4: Ajustes Financieros
  const updateFinancials = useCallback((updates: Partial<FinancialSettings>) => {
    setQuotationData(prev => ({
      ...prev,
      financials: {
        ...prev.financials,
        ...updates
      }
    }));
    
    // Recalcular costos cuando cambian los ajustes financieros
    setTimeout(() => calculateCosts(quotationData.teamMembers), 0);
  }, [quotationData.teamMembers]);

  // Funciones de cálculo de costos
  const calculateCosts = useCallback((teamMembers: TeamMember[]) => {
    // Calcular costo base sumando los costos de todos los miembros
    const base = teamMembers.reduce((sum, member) => sum + member.cost, 0);
    setBaseCost(base);
    
    // Calcular ajuste por complejidad
    const complexityAdj = calculateComplexityAdjustment(base, complexityFactors);
    setComplexityAdjustment(complexityAdj);
    
    // Calcular markup
    const adjusted = base + complexityAdj;
    const markup = calculateMarkup(adjusted);
    setMarkupAmount(markup);
    
    // Calcular total con costos de plataforma y desviación
    const { platformCost, deviationPercentage, discount } = quotationData.financials;
    
    // Primero calculamos el subtotal sin descuento
    const subtotal = calculateTotalAmount(
      base,
      complexityAdj,
      markup,
      platformCost,
      deviationPercentage
    );
    
    // Luego aplicamos el descuento si existe
    const total = discount > 0 ? subtotal * (1 - discount / 100) : subtotal;
    
    setTotalAmount(total);
  }, [complexityFactors, quotationData.financials]);

  // Actualizar costos cuando cambian los miembros del equipo o los factores de complejidad
  useEffect(() => {
    calculateCosts(quotationData.teamMembers);
  }, [calculateCosts, quotationData.teamMembers, complexityFactors]);

  // Cargar roles disponibles
  const loadRoles = useCallback(async () => {
    try {
      const roles = await apiRequest('/api/roles');
      setAvailableRoles(roles);
    } catch (error) {
      console.error("Error al cargar roles:", error);
    }
  }, []);

  // Cargar personal disponible
  const loadPersonnel = useCallback(async () => {
    try {
      const personnel = await apiRequest('/api/personnel');
      setAvailablePersonnel(personnel);
    } catch (error) {
      console.error("Error al cargar personal:", error);
    }
  }, []);

  // Métodos para la navegación del wizard
  const goToStep = useCallback((step: number) => {
    if (step >= 1 && step <= 4) {
      setCurrentStep(step);
    }
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < 4) {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep]);

  const previousStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  // Método para guardar la cotización
  const saveQuotation = useCallback(async () => {
    try {
      // Validar que tenemos los datos mínimos necesarios
      if (!quotationData.client || !quotationData.project.name || !quotationData.template) {
        throw new Error("Faltan datos requeridos para la cotización");
      }

      // Preparar datos para la API
      const quotationPayload = {
        clientId: quotationData.client.id,
        projectName: quotationData.project.name,
        projectType: quotationData.project.type || "executive",
        analysisType: "standard", // Valor por defecto si no está definido
        mentionsVolume: "medium", // Valor por defecto
        countriesCovered: "1", // Valor por defecto
        clientEngagement: "medium", // Valor por defecto
        templateId: quotationData.template.id,
        templateCustomization: quotationData.customization || "",
        baseCost: baseCost,
        complexityAdjustment: complexityAdjustment,
        markupAmount: markupAmount,
        totalAmount: totalAmount,
        status: "draft",
        adjustmentReason: quotationData.financials ? 
          `Descuento: ${quotationData.financials.discount}%, Desviación: ${quotationData.financials.deviationPercentage}%` : 
          "",
        additionalNotes: "Generado desde cotización optimizada"
      };

      console.log("Enviando payload:", quotationPayload);

      // Enviar a la API
      const response = await apiRequest('/api/quotations', {
        method: 'POST',
        body: JSON.stringify(quotationPayload)
      });

      console.log("Respuesta de la API de cotización:", response);

      // Si la API devuelve el ID de la cotización creada
      if (response && response.id) {
        console.log("Guardando miembros del equipo para cotización ID:", response.id);
        
        // Guardar los miembros del equipo
        for (const member of quotationData.teamMembers) {
          const teamMemberPayload = {
            quotationId: response.id,
            personnelId: member.personnelId || 0, // Si no hay personal asignado, usar 0
            hours: member.hours,
            rate: member.rate,
            cost: member.hours * member.rate // Calcular el costo total
          };
          
          console.log("Enviando miembro del equipo:", teamMemberPayload);
          
          try {
            const teamResponse = await apiRequest('/api/quotation-team', {
              method: 'POST',
              body: JSON.stringify(teamMemberPayload)
            });
            
            console.log("Miembro del equipo guardado:", teamResponse);
          } catch (error) {
            const teamError = error as Error;
            console.error("Error al guardar miembro del equipo:", teamError);
            throw new Error(`Error al guardar miembro del equipo: ${teamError.message || 'Error desconocido'}`);
          }
        }

        return response.id;
      } else {
        throw new Error("No se pudo crear la cotización (respuesta sin ID)");
      }
    } catch (e) {
      const error = e as any;
      console.error("Error al guardar la cotización:", error);
      if (error.response) {
        try {
          const errorData = await error.response.clone().json();
          console.error("Detalles del error:", errorData);
        } catch (jsonError) {
          console.error("No se pudo parsear el error como JSON");
        }
      }
      throw error;
    }
  }, [quotationData, totalAmount, baseCost, complexityAdjustment, markupAmount]);

  // Inicializar datos cuando se carga el componente
  useEffect(() => {
    loadRoles();
    loadPersonnel();
  }, [loadRoles, loadPersonnel]);

  // Valor del contexto
  const contextValue: OptimizedQuoteContextType = {
    quotationData,
    baseCost,
    complexityAdjustment,
    markupAmount,
    totalAmount,
    recommendedRoleIds,
    updateClient,
    updateProjectName,
    updateProjectType,
    updateProjectDuration,
    updateTemplate,
    updateComplexity,
    updateCustomization,
    setTeamOption,
    addTeamMember,
    updateTeamMember,
    removeTeamMember,
    applyRecommendedTeam,
    updateFinancials,
    saveQuotation,
    currentStep,
    goToStep,
    nextStep,
    previousStep,
    availableRoles,
    availablePersonnel,
    loadRoles,
    loadPersonnel,
  };

  return (
    <OptimizedQuoteContext.Provider value={contextValue}>
      {children}
    </OptimizedQuoteContext.Provider>
  );
};

// Hook para usar el contexto
export const useOptimizedQuote = () => {
  const context = useContext(OptimizedQuoteContext);
  if (context === undefined) {
    throw new Error('useOptimizedQuote debe ser usado dentro de un OptimizedQuoteProvider');
  }
  return context;
};