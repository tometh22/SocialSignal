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
  fte?: number;        // Fracción del tiempo completo (ej: 0.5 = medio tiempo)
  dedication?: number; // Porcentaje de dedicación (ej: 50 = 50%)
  quantity?: number;   // Cantidad de miembros de este tipo (para selección múltiple)
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
  marginFactor?: number; // Factor multiplicador para el margen operativo (1.0-10.0)
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
  // Estado de guardado
  isSavingInProgress: boolean;
  // Estado de edición
  isEditing: boolean;
  // Estado de recotización
  isRecotizacion: boolean;
  // ID de cotización si estamos editando
  quotationId: number | null;
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
    marginFactor: 1.0, // Valor inicial del multiplicador de margen
  },
};

// Crear el contexto
const OptimizedQuoteContext = createContext<OptimizedQuoteContextType | undefined>(undefined);

// Definiciones de contexto
export interface OptimizedQuoteProviderProps {
  children: ReactNode;
  quotationId?: number;  // ID opcional para cargar una cotización existente
  isRequote?: boolean;   // Indica si es una recotización (clonar y modificar)
}

// Proveedor del contexto
export const OptimizedQuoteProvider: React.FC<OptimizedQuoteProviderProps> = ({ 
  children, 
  quotationId, 
  isRequote = false 
}) => {
  // Estado principal
  const [quotationData, setQuotationData] = useState<QuotationData>(initialQuotationData);
  
  // Estados adicionales
  const [baseCost, setBaseCost] = useState(0); // Inicia en cero hasta que se seleccione una plantilla
  const [complexityAdjustment, setComplexityAdjustment] = useState(0);
  const [markupAmount, setMarkupAmount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [recommendedRoleIds, setRecommendedRoleIds] = useState<number[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [availableRoles, setAvailableRoles] = useState<Role[] | null>(null);
  const [availablePersonnel, setAvailablePersonnel] = useState<Personnel[] | null>(null);
  
  // Estados específicos para edición/recotización
  const [isEditing, setIsEditing] = useState<boolean>(!!quotationId && !isRequote);
  const [isRecotizacion, setIsRecotizacion] = useState<boolean>(!!isRequote);
  const [editQuotationId, setEditQuotationId] = useState<number | null>(quotationId || null);
  
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
      apiRequest(`/api/template-roles/${template.id}`, "GET")
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
    // Nuevo enfoque: permitir múltiples entradas del mismo rol pero con ID único
    // Solo consideramos duplicado si el rol Y el personal son iguales (personas específicas)
    const uniqueMap = new Map();
    
    members.forEach(member => {
      // Si es el mismo rol pero con personal específico, usamos ID completo para permitir duplicados
      const key = member.personnelId 
        ? `${member.roleId}_${member.personnelId}` // Rol con persona específica
        : `role_${member.id}`; // Sólo rol (permitir múltiples del mismo rol)
      
      uniqueMap.set(key, member);
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
          const personnelList = await apiRequest('/api/personnel', 'GET');
          if (personnelList && personnelList.length > 0) {
            defaultPersonnelId = personnelList[0].id;
          }
        } catch (err) {
          console.warn("Error al cargar personal, usando ID por defecto:", err);
        }
      }
      
      console.log("Usando ID de personal por defecto para equipo recomendado:", defaultPersonnelId);
      
      // Ahora cargar asignaciones de roles para obtener horas (si hay plantilla)
      let assignments = [];
      if (quotationData.template !== null) {
        assignments = await apiRequest(`/api/template-roles/${quotationData.template.id}`, 'GET');
      } else {
        // Caso "Sin plantilla": crear asignaciones básicas basadas en recommendedRoleIds
        console.log("Usando configuración de equipo personalizada...");
        assignments = recommendedRoleIds.map(roleId => ({
          roleId: roleId,
          hours: "10" // Horas predeterminadas
        }));
      }
      
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
            personnelId: null, // No asignar personal específico en modo automático
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
              personnelId: null, // No asignar personal específico en modo automático
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
    // Asegurarnos que las actualizaciones tengan valores numéricos válidos
    const sanitizedUpdates: Partial<FinancialSettings> = {};
    
    // Copia las actualizaciones, pero verifica que los valores sean numéricos
    if ('platformCost' in updates) {
      const value = updates.platformCost;
      sanitizedUpdates.platformCost = typeof value === 'number' && !isNaN(value) ? value : 0;
    }
    
    if ('deviationPercentage' in updates) {
      const value = updates.deviationPercentage;
      sanitizedUpdates.deviationPercentage = typeof value === 'number' && !isNaN(value) ? value : 0;
    }
    
    if ('discount' in updates) {
      const value = updates.discount;
      sanitizedUpdates.discount = typeof value === 'number' && !isNaN(value) ? value : 0;
    }
    
    if ('marginFactor' in updates) {
      const value = updates.marginFactor;
      sanitizedUpdates.marginFactor = typeof value === 'number' && !isNaN(value) ? value : 1.0;
    }
    
    console.log("Actualizaciones sanitizadas:", sanitizedUpdates);
    
    // Actualizar estado financiero con valores verificados
    setQuotationData(prev => {
      const newFinancials = {
        ...prev.financials,
        ...sanitizedUpdates
      };
      
      // Usar una función auxiliar para recalcular costos inmediatamente
      const recalculateNow = () => {
        try {
          console.log("Actualizando financials en tiempo real:", sanitizedUpdates);
          
          // Obtener los valores actualizados para cálculos inmediatos
          const newBaseCost = baseCost || 0;
          
          // Recalcular el ajuste por complejidad
          const newAdjustment = calculateComplexityAdjustment(
            newBaseCost, 
            complexityFactors
          );
          
          // Recalcular el markup
          const newMarginFactor = 'marginFactor' in sanitizedUpdates 
            ? sanitizedUpdates.marginFactor! 
            : prev.financials.marginFactor || 1.0;
            
          const newMarkup = calculateMarkup(
            newBaseCost + newAdjustment,
            newMarginFactor
          );
          
          // Recalcular el total con los nuevos valores financieros
          const newPlatformCost = 'platformCost' in sanitizedUpdates 
            ? sanitizedUpdates.platformCost! 
            : prev.financials.platformCost;
            
          const newDeviationPercentage = 'deviationPercentage' in sanitizedUpdates 
            ? sanitizedUpdates.deviationPercentage! 
            : prev.financials.deviationPercentage;
          
          const newTotal = calculateTotalAmount(
            newBaseCost,
            newAdjustment,
            newMarkup,
            newPlatformCost,
            newDeviationPercentage
          );
          
          // Actualizar estados inmediatamente
          setComplexityAdjustment(newAdjustment);
          setMarkupAmount(newMarkup);
          setTotalAmount(newTotal);
          
          console.log("Nuevos valores calculados:", {
            baseCost: newBaseCost,
            adjustment: newAdjustment,
            markup: newMarkup,
            total: newTotal,
            deviationPercentage: newDeviationPercentage
          });
        } catch (error) {
          console.error("Error al recalcular costos:", error);
        }
      };
      
      // Ejecutar el recálculo después de actualizar el estado
      setTimeout(recalculateNow, 0);
      
      return {
        ...prev,
        financials: newFinancials
      };
    });
  }, [baseCost, complexityFactors, calculateComplexityAdjustment, calculateMarkup, calculateTotalAmount]);

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
    const markup = calculateMarkup(adjusted, quotationData.financials.marginFactor || 1.0);
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
  // Este efecto solo se dispara cuando cambian los miembros del equipo,
  // no cuando cambian los factores de complejidad
  useEffect(() => {
    // Evitar recalcular si estamos en el paso 2 (selección de plantilla)
    if (currentStep === 2 && quotationData.template !== undefined) {
      console.log("Omitiendo cálculo de costos basado en miembros del equipo en el paso 2");
      return;
    }
    
    // Solo calcular costos a partir de miembros del equipo cuando hay miembros
    if (quotationData.teamMembers.length > 0) {
      console.log("Calculando costos basados en miembros del equipo:", quotationData.teamMembers.length);
      calculateCosts(quotationData.teamMembers);
    }
  }, [calculateCosts, quotationData.teamMembers, currentStep, quotationData.template]);

  // Cargar roles disponibles
  const loadRoles = useCallback(async () => {
    try {
      const roles = await apiRequest('/api/roles', 'GET');
      setAvailableRoles(roles);
    } catch (error) {
      console.error("Error al cargar roles:", error);
    }
  }, []);

  // Cargar personal disponible
  const loadPersonnel = useCallback(async () => {
    try {
      const personnel = await apiRequest('/api/personnel', 'GET');
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

  // Al seleccionar una plantilla, establecer el costo base según la plantilla
  useEffect(() => {
    if (quotationData.template) {
      // Si la plantilla existe, obtener su costo
      if (quotationData.template.baseCost !== undefined && quotationData.template.baseCost !== null) {
        // Usar el costo base de la plantilla
        setBaseCost(quotationData.template.baseCost || 0);
        console.log("Estableciendo costo base desde plantilla:", quotationData.template.baseCost);
      } else if (quotationData.template.platformCost !== undefined && quotationData.template.platformCost !== null) {
        // Usar el costo de la plataforma como alternativa
        setBaseCost(quotationData.template.platformCost || 0);
        console.log("Usando platformCost como costo base:", quotationData.template.platformCost || 0);
      } else {
        // Un valor predeterminado si no hay costos
        setBaseCost(1500);
        console.log("Usando valor predeterminado para la plantilla:", 1500);
      }
    } else if (quotationData.template === null) {
      // Si es modo personalizado, establecer un costo base predeterminado
      setBaseCost(1000);
      console.log("Modo personalizado: estableciendo costo base predeterminado de 1000");
    }
  }, [quotationData.template]);

  // Variable para rastrear si hay una operación de guardado en progreso
  const [isSavingInProgress, setIsSavingInProgress] = useState(false);

  // Método para guardar o actualizar la cotización
  const saveQuotation = useCallback(async () => {
    try {
      // Evitar múltiples envíos simultáneos
      if (isSavingInProgress) {
        console.log("Ya hay una operación de guardado en progreso. Ignorando esta solicitud.");
        return -1; // Retornar valor especial para indicar que no se realizó la operación
      }
      
      setIsSavingInProgress(true);
      console.log(`Iniciando proceso de ${isEditing ? 'actualizar' : 'guardar'} cotización...`);
      
      // Validación básica
      if (!quotationData.client) {
        console.error("Error: Cliente no seleccionado");
        throw new Error("Debe seleccionar un cliente");
      }
      
      if (!quotationData.project.name) {
        console.error("Error: Nombre del proyecto vacío");
        throw new Error("Debe ingresar un nombre de proyecto");
      }
      
      // Verificar que template no sea undefined (puede ser null para "Sin plantilla")
      if (quotationData.template === undefined) {
        console.error("Error: Configuración de plantilla indefinida");
        throw new Error("Debe completar la configuración de plantilla o seleccionar la opción personalizada");
      }
      
      // Preparar datos comunes para crear o actualizar
      const payload: {
        clientId: number;
        projectName: string;
        projectType: string;
        analysisType: string;
        mentionsVolume: string;
        countriesCovered: string;
        clientEngagement: string;
        templateId: number | null;
        templateCustomization: string;
        baseCost: number;
        complexityAdjustment: number;
        markupAmount: number;
        totalAmount: number;
        adjustmentReason: string;
        additionalNotes: string;
        status?: string; // Hacemos que status sea una propiedad opcional
      } = {
        clientId: quotationData.client.id,
        projectName: quotationData.project.name,
        projectType: quotationData.project.type || "executive",
        analysisType: quotationData.analysisType,
        mentionsVolume: quotationData.mentionsVolume,
        countriesCovered: quotationData.countriesCovered,
        clientEngagement: quotationData.clientEngagement,
        // Si es "Sin plantilla", usamos un ID especial (normalmente 0 o null dependiendo del backend)
        templateId: quotationData.template ? quotationData.template.id : null,
        templateCustomization: quotationData.customization || 
                              (quotationData.template === null ? "Cotización personalizada sin plantilla" : ""),
        baseCost: baseCost,
        complexityAdjustment: complexityAdjustment,
        markupAmount: markupAmount,
        totalAmount: totalAmount,
        adjustmentReason: `Descuento: ${quotationData.financials.discount}%, Desviación: ${quotationData.financials.deviationPercentage}%`,
        additionalNotes: quotationData.template === null 
                        ? "Cotización personalizada sin plantilla predefinida"
                        : isRecotizacion 
                          ? "Recotización de propuesta anterior"
                          : isEditing 
                            ? "Actualización de borrador"
                            : "Generado desde cotización optimizada"
      };
      
      // Si es una recotización, siempre crear como nuevo
      if (isRecotizacion) {
        payload.status = "negotiation"; // Las recotizaciones siempre inician en negociación
      } else if (!isEditing) {
        payload.status = "draft"; // Nuevas cotizaciones siempre inician como borrador
      }
      
      console.log("Payload a enviar:", payload);
      
      let response;
      let quotationId;
      
      // Lógica diferente según si es edición o nueva cotización
      if (isEditing && editQuotationId && !isRecotizacion) {
        // Actualizar cotización existente
        console.log(`Actualizando cotización ID: ${editQuotationId}`);
        response = await fetch(`/api/quotations/${editQuotationId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include'
        });
        
        quotationId = editQuotationId;
      } else {
        // Crear cotización nueva (o recotización)
        console.log("Creando nueva cotización...");
        response = await fetch('/api/quotations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include'
        });
      }
      
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
        
        throw new Error(`Error al ${isEditing ? 'actualizar' : 'guardar'} cotización: ${errorMessage}`);
      }
      
      // Procesar respuesta diferente según el método
      if (!isEditing || isRecotizacion) {
        // Para nuevas cotizaciones o recotizaciones, obtener el ID de la respuesta
        try {
          const quotation = await response.json();
          console.log("Cotización creada:", quotation);
          
          if (!quotation || !quotation.id) {
            throw new Error("La respuesta no contiene un ID de cotización válido");
          }
          
          quotationId = quotation.id;
          console.log(`ID de cotización creada: ${quotationId}`);
        } catch (err) {
          console.error("Error al parsear respuesta como JSON:", err);
          throw new Error("No se pudo leer la respuesta del servidor");
        }
      }
      
      // En edición, primero eliminamos los miembros del equipo anteriores
      if (isEditing && !isRecotizacion) {
        try {
          console.log(`Eliminando miembros anteriores para cotización ${quotationId}`);
          await fetch(`/api/quotation-team/by-quotation/${quotationId}`, {
            method: 'DELETE',
            credentials: 'include'
          });
        } catch (err) {
          console.error("Error al eliminar miembros anteriores:", err);
          // Continuar a pesar del error
        }
      }
      
      // Prevenir duplicados
      const uniqueTeamMembers: TeamMember[] = [];
      const seen = new Set<string>();
      
      // Filtrar duplicados antes de guardar
      quotationData.teamMembers.forEach(member => {
        const key = `${member.roleId}-${member.personnelId || 'none'}-${member.hours}-${member.rate}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueTeamMembers.push(member);
        } else {
          console.log(`Miembro duplicado detectado y omitido: ${key}`);
        }
      });
      
      console.log(`Equipo filtrado: ${uniqueTeamMembers.length} miembros únicos de ${quotationData.teamMembers.length} originales`);
      
      // Guardar cada miembro del equipo
      for (const member of uniqueTeamMembers) {
        // Asegurarnos de que tengamos un roleId y personnelId coherentes
        let personnelId = member.personnelId;
        
        // Si no tenemos personnelId pero tenemos roleId, buscar el primer personal con ese rol
        if (!personnelId && member.roleId && availablePersonnel) {
          const personnelWithRole = availablePersonnel.find(p => p.roleId === member.roleId);
          if (personnelWithRole) {
            personnelId = personnelWithRole.id;
            console.log(`Asignando personnel ${personnelId} (${personnelWithRole.name}) al rol ${member.roleId}`);
          }
        }
        
        // Si aún no tenemos personnelId, usar el primer personnel disponible
        if (!personnelId && availablePersonnel && availablePersonnel.length > 0) {
          personnelId = availablePersonnel[0].id;
          console.log(`Usando personnel predeterminado: ${personnelId}`);
        }
        
        const memberPayload = {
          quotationId: quotationId,
          personnelId: personnelId || 39, // Último recurso: user ID 39 como fallback
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
      
      console.log(`¡Cotización ${isEditing ? 'actualizada' : 'guardada'} con éxito!`);
      return quotationId;
      
    } catch (error) {
      console.error("Error completo:", error);
      throw error;
    } finally {
      // Asegurarse de restablecer el estado de guardado, tanto en éxito como en error
      setIsSavingInProgress(false);
    }
  }, [quotationData, baseCost, complexityAdjustment, markupAmount, totalAmount, 
      isSavingInProgress, isEditing, isRecotizacion, editQuotationId]);

  // Actualizar los cálculos financieros cuando cambian los factores
  useEffect(() => {
    // Evitar recalcular si baseCost no está establecido
    if (baseCost <= 0 && currentStep === 2 && quotationData.template) {
      // Si estamos en el paso 2 y hay una plantilla seleccionada, pero baseCost es 0,
      // probablemente se acaba de seleccionar la plantilla y aún no se ha establecido baseCost
      console.log("Esperando a que baseCost se establezca antes de recalcular...");
      
      // Verificar si hay un valor de costo base en la plantilla
      const templateBaseCost = quotationData.template.baseCost;
      if (templateBaseCost && templateBaseCost > 0) {
        console.log("Usando baseCost desde la plantilla para el cálculo:", templateBaseCost);
        
        // Forzar el cálculo con el costo base de la plantilla
        try {
          const adjustment = calculateComplexityAdjustment(templateBaseCost, complexityFactors);
          setComplexityAdjustment(adjustment);
          
          const markup = calculateMarkup(
            templateBaseCost + adjustment,
            quotationData.financials.marginFactor || 1.0
          );
          setMarkupAmount(markup);
          
          const total = calculateTotalAmount(
            templateBaseCost,
            adjustment,
            markup,
            quotationData.financials.platformCost,
            quotationData.financials.deviationPercentage
          );
          setTotalAmount(total);
          
          console.log("Actualización forzada de costos completada:", {
            baseCost: templateBaseCost,
            adjustment,
            markup,
            total
          });
        } catch (error) {
          console.error("Error durante cálculos financieros forzados:", error);
        }
        
        return;
      }
    }
    
    console.log("Recalculando financieros. Base cost:", baseCost);
    
    try {
      // Calcular el ajuste de complejidad basado en los factores
      const adjustment = calculateComplexityAdjustment(baseCost, complexityFactors);
      setComplexityAdjustment(adjustment);
      
      // Calcular el markup con el factor de margen
      const markup = calculateMarkup(
        baseCost + adjustment,
        quotationData.financials.marginFactor || 1.0
      );
      setMarkupAmount(markup);
      
      // Calcular el total final
      const total = calculateTotalAmount(
        baseCost, 
        adjustment, 
        markup,
        quotationData.financials.platformCost,
        quotationData.financials.deviationPercentage
      );
      setTotalAmount(total);
      
      console.log("Actualización de costos completada:", {
        baseCost,
        adjustment,
        markup,
        total
      });
    } catch (error) {
      console.error("Error durante cálculos financieros:", error);
    }
  }, [
    baseCost, 
    complexityFactors, 
    quotationData.financials.platformCost, 
    quotationData.financials.deviationPercentage,
    quotationData.financials.marginFactor, // Añadimos el factor de margen como dependencia
    currentStep,
    quotationData.template
  ]);

  // Inicializar datos cuando se carga el componente
  useEffect(() => {
    loadRoles();
    loadPersonnel();
  }, [loadRoles, loadPersonnel]);

  // Efecto para cargar una cotización existente si hay quotationId
  useEffect(() => {
    if (quotationId) {
      const loadExistingQuotation = async () => {
        try {
          console.log(`Cargando cotización existente ID: ${quotationId}`);
          
          // Obtener la cotización de la API
          const quotation = await apiRequest(`/api/quotations/${quotationId}`, "GET");
          if (!quotation) {
            console.error("No se pudo cargar la cotización");
            return;
          }
          
          // Cargar el cliente
          let cliente = null;
          try {
            cliente = await apiRequest(`/api/clients/${quotation.clientId}`, "GET");
          } catch (err) {
            console.error("Error al cargar cliente:", err);
          }
          
          // Cargar la plantilla si existe
          let template = null;
          if (quotation.templateId) {
            try {
              template = await apiRequest(`/api/templates/${quotation.templateId}`, "GET");
            } catch (err) {
              console.error("Error al cargar plantilla:", err);
            }
          }
          
          // Cargar miembros del equipo
          let teamMembers: TeamMember[] = [];
          try {
            console.log(`Cargando equipo para cotización ID: ${quotationId}`);
            let teamData = await apiRequest(`/api/quotation-team/${quotationId}`, "GET");
            console.log("Equipo recibido (sin procesar):", teamData);
            
            if (Array.isArray(teamData) && teamData.length > 0) {
              // Limpiar duplicados en caso de error de persistencia
              const seenMemberKeys = new Set<string>();
              teamData = teamData.filter(member => {
                const memberKey = `${member.personnelId}-${member.rate}-${member.hours}`;
                // Si ya hemos visto este miembro exacto, filtrarlo
                if (seenMemberKeys.has(memberKey)) {
                  console.log(`Miembro duplicado detectado: ${memberKey}`);
                  return false;
                }
                seenMemberKeys.add(memberKey);
                return true;
              });
              
              console.log("Equipo recibido (limpio):", teamData);
              
              // Cargar personnel para obtener sus roles
              const allPersonnel = await apiRequest("/api/personnel", "GET");
              console.log("Personnel cargados:", allPersonnel);
              
              // Mapa para acceder rápidamente a los datos del personal
              const personnelMap: Record<number, any> = {};
              allPersonnel.forEach((p: any) => {
                personnelMap[p.id] = p;
              });
              
              // Convertir datos del API a formato TeamMember
              teamMembers = teamData.map((member: {id: number; personnelId: number; hours: number; rate: number; cost: number;}) => {
                // Obtener información del personal
                const person = personnelMap[member.personnelId];
                const roleId = person ? person.roleId : 0;
                const name = person ? person.name : "Desconocido";
                
                console.log(`Miembro ${member.id}: personnelId=${member.personnelId}, nombre=${name}, roleId=${roleId}`);
                
                return {
                  id: uuidv4(), // Generar nuevo ID para la interfaz
                  roleId: roleId, // Obtener el roleId correcto basado en el personnelId
                  personnelId: member.personnelId,
                  hours: member.hours,
                  rate: member.rate,
                  cost: member.cost
                };
              });
              
              console.log("Equipo convertido (final):", teamMembers);
            }
          } catch (err) {
            console.error("Error al cargar equipo:", err);
          }
          
          // Actualizar el estado con los datos cargados
          setBaseCost(quotation.baseCost || 0);
          setComplexityAdjustment(quotation.complexityAdjustment || 0);
          setMarkupAmount(quotation.markupAmount || 0);
          setTotalAmount(quotation.totalAmount || 0);
          
          // Extraer valores de ajuste financiero
          let deviation = 0;
          let discount = 0;
          if (quotation.adjustmentReason) {
            const deviationMatch = quotation.adjustmentReason.match(/Desviación: (\d+\.?\d*)%/);
            if (deviationMatch && deviationMatch[1]) {
              deviation = parseFloat(deviationMatch[1]);
            }
            
            const discountMatch = quotation.adjustmentReason.match(/Descuento: (\d+\.?\d*)%/);
            if (discountMatch && discountMatch[1]) {
              discount = parseFloat(discountMatch[1]);
            }
          }
          
          // Análisis de complejidad desde campos personalizados o textuales
          const getAnalysisTypeFromIdOrText = (id?: number, text?: string) => {
            // Primero intentar por texto exacto
            if (text) {
              const textLower = text.toLowerCase();
              if (textLower.includes('basic') || textLower.includes('básico')) return 'basic';
              if (textLower.includes('advanced') || textLower.includes('avanzado')) return 'advanced';
              if (textLower.includes('standard') || textLower.includes('estándar')) return 'standard';
            }
            
            // Si no hay texto o no se pudo determinar, intentar por ID
            if (id === 1) return 'basic';
            if (id === 3) return 'advanced';
            if (id === 2) return 'standard';
            
            // Buscar en campos directos
            if (quotation.analysisType) {
              return quotation.analysisType as 'basic' | 'standard' | 'advanced';
            }
            
            return 'standard'; // Valor predeterminado
          };
          
          const getMentionsVolumeFromIdOrText = (id?: number, text?: string) => {
            // Primero intentar por texto exacto
            if (text) {
              const textLower = text.toLowerCase();
              if (textLower.includes('low') || textLower.includes('bajo')) return 'low';
              if (textLower.includes('high') || textLower.includes('alto')) return 'high';
              if (textLower.includes('medium') || textLower.includes('medio')) return 'medium';
            }
            
            // Si no hay texto o no se pudo determinar, intentar por ID
            if (id === 1) return 'low';
            if (id === 3) return 'high';
            if (id === 2) return 'medium';
            
            // Buscar en campos directos
            if (quotation.mentionsVolume) {
              return quotation.mentionsVolume as 'low' | 'medium' | 'high';
            }
            
            return 'medium'; // Valor predeterminado
          };
          
          const getCountriesCoveredFromIdOrText = (id?: number, text?: string) => {
            // Primero intentar por texto exacto
            if (text === quotation.countriesCovered) return text;
            if (text) {
              const textLower = text.toLowerCase();
              if (textLower.includes('1') || textLower.includes('one')) return '1';
              if (textLower.includes('2-3')) return '2-3';
              if (textLower.includes('4+') || textLower.includes('more')) return '4+';
            }
            
            // Si hay un valor directo, usarlo
            if (quotation.countriesCovered) return quotation.countriesCovered;
            
            // Si no hay texto o no se pudo determinar, intentar por ID
            if (id === 1) return '1';
            if (id === 2) return '2-3';
            if (id === 3) return '4+';
            
            return '1'; // Valor predeterminado
          };
          
          const getClientEngagementFromIdOrText = (id?: number, text?: string) => {
            // Primero intentar por texto exacto
            if (text) {
              const textLower = text.toLowerCase();
              if (textLower.includes('minimum') || textLower.includes('mínimo')) return 'minimum';
              if (textLower.includes('high') || textLower.includes('alto')) return 'high';
              if (textLower.includes('medium') || textLower.includes('medio')) return 'medium';
            }
            
            // Si hay un valor directo, usarlo
            if (quotation.clientEngagement) return quotation.clientEngagement;
            
            // Si no hay texto o no se pudo determinar, intentar por ID
            if (id === 1) return 'minimum';
            if (id === 3) return 'high';
            if (id === 2) return 'medium';
            
            return 'medium'; // Valor predeterminado
          };
          
          // Extraer complejidad directamente o de datos relacionados
          const complexity = quotation.complexity || 
                           (quotation.complexityAdjustment > 5000 ? 'high' : 
                           quotation.complexityAdjustment > 2000 ? 'medium' : 'low');
          
          console.log("Análisis de los factores de complejidad de la cotización:", {
            analysisType: {
              fromId: getAnalysisTypeFromIdOrText(quotation.analysisTypeId),
              fromText: getAnalysisTypeFromIdOrText(undefined, quotation.analysisType),
              original: quotation.analysisType
            },
            mentionsVolume: {
              fromId: getMentionsVolumeFromIdOrText(quotation.mentionsVolumeId),
              fromText: getMentionsVolumeFromIdOrText(undefined, quotation.mentionsVolume),
              original: quotation.mentionsVolume
            },
            countriesCovered: {
              fromId: getCountriesCoveredFromIdOrText(quotation.countriesCoveredId),
              fromText: getCountriesCoveredFromIdOrText(undefined, quotation.countriesCovered),
              original: quotation.countriesCovered
            },
            clientEngagement: {
              fromId: getClientEngagementFromIdOrText(quotation.clientEngagementId),
              fromText: getClientEngagementFromIdOrText(undefined, quotation.clientEngagement),
              original: quotation.clientEngagement
            },
            complexity: {
              original: quotation.complexity,
              calculated: complexity
            }
          });
          
          // Actualizar quotationData completamente
          setQuotationData({
            client: cliente,
            project: {
              name: quotation.projectName || '',
              type: quotation.projectType || 'executive',
              duration: quotation.projectDuration as ProjectDuration || 'medium',
            },
            template: template,
            complexity: complexity as 'low' | 'medium' | 'high', 
            customization: quotation.templateCustomization || '',
            analysisType: getAnalysisTypeFromIdOrText(quotation.analysisTypeId, quotation.analysisType),
            mentionsVolume: getMentionsVolumeFromIdOrText(quotation.mentionsVolumeId, quotation.mentionsVolume),
            countriesCovered: getCountriesCoveredFromIdOrText(quotation.countriesCoveredId, quotation.countriesCovered),
            clientEngagement: getClientEngagementFromIdOrText(quotation.clientEngagementId, quotation.clientEngagement),
            teamOption: 'manual', // Por defecto asumimos manual en edición
            teamMembers: teamMembers,
            financials: {
              platformCost: template?.platformCost || 0,
              deviationPercentage: deviation,
              discount: discount,
              marginFactor: 1.0 // Valor por defecto
            }
          });
          
          console.log("Cotización cargada exitosamente");
        } catch (error) {
          console.error("Error al cargar la cotización:", error);
        }
      };
      
      loadExistingQuotation();
    }
  }, [quotationId]); // Solo se ejecuta cuando cambia quotationId

  // Valor del contexto
  const contextValue: OptimizedQuoteContextType = {
    quotationData,
    baseCost,
    complexityAdjustment,
    markupAmount,
    totalAmount,
    recommendedRoleIds,
    isSavingInProgress,
    // Información de edición
    isEditing: !!quotationId && !isRequote,
    isRecotizacion: isRequote,
    quotationId: editQuotationId,
    // Métodos para actualización
    updateClient,
    updateProjectName,
    updateProjectType,
    updateProjectDuration,
    updateTemplate,
    updateComplexity,
    updateCustomization,
    // Métodos para configuración
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