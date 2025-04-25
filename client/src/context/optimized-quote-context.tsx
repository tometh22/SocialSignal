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
  // Parámetros adicionales de configuración
  analysisType: string;
  mentionsVolume: string;
  countriesCovered: string;
  clientEngagement: string;
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
  // Métodos para configuración adicional
  updateAnalysisType: (type: string) => void;
  updateMentionsVolume: (volume: string) => void;
  updateCountriesCovered: (countries: string) => void;
  updateClientEngagement: (engagement: string) => void;
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
  // Valores por defecto para parámetros adicionales
  analysisType: 'standard',
  mentionsVolume: 'medium',
  countriesCovered: '1',
  clientEngagement: 'medium',
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
      // Factor de complejidad general del proyecto
      analysisTypeFactor: getAnalysisTypeFactor(quotationData.analysisType),
      
      // Factor de volumen de menciones
      mentionsVolumeFactor: getMentionsVolumeFactor(quotationData.mentionsVolume),
      
      // Factor de países cubiertos
      countriesFactor: getCountriesFactor(quotationData.countriesCovered),
      
      // Factor de interacción con el cliente
      clientEngagementFactor: getClientEngagementFactor(quotationData.clientEngagement),
      
      // Factor de complejidad de la plantilla
      // Si template es null (sin plantilla), usamos el factor de complejidad directamente
      templateFactor: quotationData.template === null ? 
                     (quotationData.complexity === 'high' ? 0.20 : 
                      quotationData.complexity === 'medium' ? 0.10 : 0) :
                     quotationData.template?.complexity === 'high' ? 0.25 :
                     quotationData.template?.complexity === 'medium' ? 0.15 : 0.05,
    };
  }, [
    quotationData.complexity, 
    quotationData.project.duration, 
    quotationData.template,
    quotationData.analysisType,
    quotationData.mentionsVolume,
    quotationData.countriesCovered,
    quotationData.clientEngagement
  ]);

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
    
    console.log(`Actualizando plantilla: ${template ? `ID: ${template.id}, ${template.name}` : 'Personalizado / Sin Plantilla'}`);
    
    // Limpiar equipos anteriores para evitar duplicidades
    setQuotationData(prev => ({
      ...prev, 
      template, // Esto puede ser null para "Personalizado / Sin Plantilla"
      teamMembers: [] // Limpiar equipos anteriores
    }));
    
    // Establecer la complejidad por separado, para ambos casos
    let newComplexity: 'low' | 'medium' | 'high' = 'medium'; // Por defecto

    if (template) {
      // Determinar el valor de complejidad basado en la plantilla
      if (template.complexity === 'high') {
        newComplexity = 'high';
      } else if (template.complexity === 'low') {
        newComplexity = 'low';
      }
    } else {
      // Para opción personalizada, asignar una complejidad media por defecto
      newComplexity = 'medium';
    }
      
    // Actualizar la complejidad en todos los casos
    setQuotationData(prev => ({
      ...prev,
      complexity: newComplexity
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
      console.log("Configurando opción 'Personalizado / Sin Plantilla'");
      
      // Reiniciar los financials a valores predeterminados
      setQuotationData(prev => ({
        ...prev,
        financials: {
          ...prev.financials,
          platformCost: 0,
          deviationPercentage: 0,
        }
      }));

      // Para la opción personalizada, aún necesitamos roles generales recomendados
      // Establecer algunos roles básicos como recomendados
      const basicRoles = [9, 10, 12, 15, 18]; // IDs de roles básicos (ajustar según tus datos)
      setRecommendedRoleIds(basicRoles);
    }
  }, [quotationData.template]);

  const updateComplexity = useCallback((complexity: 'low' | 'medium' | 'high') => {
    setQuotationData(prev => ({...prev, complexity}));
  }, []);

  const updateCustomization = useCallback((customization: string) => {
    setQuotationData(prev => ({...prev, customization}));
  }, []);
  
  // Métodos para los parámetros adicionales de configuración
  const updateAnalysisType = useCallback((type: string) => {
    setQuotationData(prev => ({...prev, analysisType: type}));
  }, []);
  
  const updateMentionsVolume = useCallback((volume: string) => {
    setQuotationData(prev => ({...prev, mentionsVolume: volume}));
  }, []);
  
  const updateCountriesCovered = useCallback((countries: string) => {
    setQuotationData(prev => ({...prev, countriesCovered: countries}));
  }, []);
  
  const updateClientEngagement = useCallback((engagement: string) => {
    setQuotationData(prev => ({...prev, clientEngagement: engagement}));
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

  const applyRecommendedTeam = useCallback(async () => {
    // Si no hay roles disponibles o recomendados, no hacemos nada
    if (!availableRoles || !recommendedRoleIds.length) {
      return;
    }
    
    // Si es la opción personalizada (template = null), también podemos asignar un equipo básico
    if (quotationData.template === undefined) {
      return;
    }

    // Limpiar equipo actual
    setQuotationData(prev => ({...prev, teamMembers: []}));

    try {
      // Primero encontrar un ID de personal válido para usar
      let defaultPersonnelId = 39; // Valor por defecto conocido
      
      if (availablePersonnel && availablePersonnel.length > 0) {
        // Usar el primer personal disponible de la lista ya cargada
        defaultPersonnelId = availablePersonnel[0].id;
      } else {
        // Si no está disponible, intentar cargar de la API
        try {
          const personnelList = await apiRequest('/api/personnel');
          if (personnelList && personnelList.length > 0) {
            defaultPersonnelId = personnelList[0].id;
          }
        } catch (err) {
          console.warn("Error al cargar personal, usando ID por defecto:", err);
        }
      }
      
      console.log("Usando ID de personal por defecto para equipo recomendado:", defaultPersonnelId);
      
      // Ahora cargar asignaciones de roles para obtener horas
      const assignments = await apiRequest(`/api/template-roles/${quotationData.template.id}`);
      
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
            personnelId: defaultPersonnelId, // Usar ID de personal válido
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
              personnelId: defaultPersonnelId, // Usar ID de personal válido
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
    } catch (error) {
      console.error("Error al aplicar equipo recomendado:", error);
    }
  }, [availableRoles, availablePersonnel, recommendedRoleIds, quotationData.template]);

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
    // Si estamos en el paso 1 (información básica), validar los campos de información básica
    if (currentStep === 1) {
      // Verificar que el cliente esté seleccionado
      if (!quotationData.client) {
        alert("Debe seleccionar un cliente antes de continuar.");
        return;
      }
      
      // Verificar que el nombre del proyecto esté ingresado
      if (!quotationData.project.name.trim()) {
        alert("Debe ingresar un nombre para el proyecto antes de continuar.");
        return;
      }
      
      // Forzar ir a selección de plantilla (paso 2)
      setCurrentStep(2);
      return;
    }
    
    // Si estamos en el paso 2 (selección directa de complejidad), verificamos parámetros
    if (currentStep === 2) {
      // Verificar que quotationData.template no es undefined (puede ser null para "Sin plantilla")
      if (quotationData.template === undefined) {
        alert("Debe configurar factores de complejidad antes de continuar.");
        return;
      }
      
      // Verificar que todos los parámetros obligatorios estén configurados
      if (!quotationData.analysisType) {
        alert("Debe seleccionar un tipo de análisis antes de continuar.");
        return;
      }
      
      if (!quotationData.mentionsVolume) {
        alert("Debe seleccionar un volumen de menciones antes de continuar.");
        return;
      }
      
      if (!quotationData.countriesCovered) {
        alert("Debe seleccionar la cantidad de países cubiertos antes de continuar.");
        return;
      }
      
      if (!quotationData.clientEngagement) {
        alert("Debe seleccionar un nivel de interacción con el cliente antes de continuar.");
        return;
      }
      
      // Si todo está en orden, proceder al paso 3
      setCurrentStep(3);
      return;
    }
    
    // Para otros pasos, simplemente avanzar
    if (currentStep < 4) {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep, quotationData]);

  const previousStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  // Método simplificado para guardar la cotización
  const saveQuotation = useCallback(async () => {
    try {
      console.log("Iniciando proceso de guardar cotización...");
      
      // Validación básica
      if (!quotationData.client) {
        console.error("Error: Cliente no seleccionado");
        throw new Error("Debe seleccionar un cliente");
      }
      
      if (!quotationData.project.name) {
        console.error("Error: Nombre del proyecto vacío");
        throw new Error("Debe ingresar un nombre de proyecto");
      }
      
      if (!quotationData.template) {
        console.error("Error: Plantilla no seleccionada");
        throw new Error("Debe seleccionar una plantilla");
      }
      
      // Preparar datos
      const payload = {
        clientId: quotationData.client.id,
        projectName: quotationData.project.name,
        projectType: quotationData.project.type || "executive",
        analysisType: quotationData.analysisType,
        mentionsVolume: quotationData.mentionsVolume,
        countriesCovered: quotationData.countriesCovered,
        clientEngagement: quotationData.clientEngagement,
        templateId: quotationData.template.id,
        templateCustomization: quotationData.customization || "",
        baseCost: baseCost,
        complexityAdjustment: complexityAdjustment,
        markupAmount: markupAmount,
        totalAmount: totalAmount,
        status: "draft",
        adjustmentReason: `Descuento: ${quotationData.financials.discount}%, Desviación: ${quotationData.financials.deviationPercentage}%`,
        additionalNotes: "Generado desde cotización optimizada"
      };
      
      console.log("Payload a enviar:", payload);
      
      // Crear cotización
      console.log("Enviando solicitud POST a /api/quotations...");
      const response = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      
      console.log("Estado de respuesta:", response.status);
      
      if (!response.ok) {
        let errorMessage = `Error ${response.status}: ${response.statusText}`;
        try {
          const errorText = await response.text();
          console.error("Error del servidor:", errorText);
          
          try {
            // Intentar parsear como JSON
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.message || errorJson.error || errorMessage;
          } catch {
            // Si no es JSON, usar el texto como está
            errorMessage = errorText || errorMessage;
          }
        } catch (err) {
          console.error("Error al leer respuesta de error:", err);
        }
        
        throw new Error(`Error al guardar cotización: ${errorMessage}`);
      }
      
      let quotation;
      try {
        quotation = await response.json();
        console.log("Cotización creada:", quotation);
      } catch (err) {
        console.error("Error al parsear respuesta como JSON:", err);
        throw new Error("No se pudo leer la respuesta del servidor");
      }
      
      if (!quotation || !quotation.id) {
        throw new Error("La respuesta no contiene un ID de cotización válido");
      }
      
      // Guardar equipo
      const quotationId = quotation.id;
      console.log(`ID de cotización creada: ${quotationId}`);
      
      // Usar el primer ID de personal como default
      const defaultPersonId = 39;
      
      // Guardar cada miembro del equipo
      for (const member of quotationData.teamMembers) {
        const memberPayload = {
          quotationId: quotationId,
          personnelId: member.personnelId || defaultPersonId,
          hours: member.hours,
          rate: member.rate,
          cost: member.hours * member.rate
        };
        
        console.log("Guardando miembro del equipo:", memberPayload);
        
        const teamResponse = await fetch('/api/quotation-team', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(memberPayload),
          credentials: 'include'
        });
        
        if (!teamResponse.ok) {
          try {
            const errorText = await teamResponse.text();
            console.error("Error al guardar miembro:", errorText);
            throw new Error(`Error al guardar miembro: ${teamResponse.status}`);
          } catch (err) {
            console.error("Error leyendo respuesta:", err);
            throw new Error(`Error al guardar miembro: ${teamResponse.status}`);
          }
        }
        
        const savedMember = await teamResponse.json();
        console.log("Miembro guardado:", savedMember);
      }
      
      console.log("¡Cotización guardada con éxito!");
      return quotationId;
      
    } catch (error) {
      console.error("Error completo:", error);
      throw error;
    }
  }, [quotationData, baseCost, complexityAdjustment, markupAmount, totalAmount]);

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
    // Nuevos métodos para configuración
    updateAnalysisType,
    updateMentionsVolume,
    updateCountriesCovered,
    updateClientEngagement,
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