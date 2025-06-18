import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from 'react';
import { apiRequest } from '@/lib/queryClient';

// Tipos e interfaces
export type ProjectDuration = 'short' | 'medium' | 'long';

export interface Client {
  id: number;
  name: string;
  email: string;
  company?: string;
}

export interface ReportTemplate {
  id: number;
  name: string;
  description: string;
  baseCost: number;
  complexity: 'low' | 'medium' | 'high';
  features: string[];
  requiresCustomization: boolean;
}

export interface Role {
  id: number;
  name: string;
  description: string;
  hourlyRate: number;
  category: string;
}

export interface Personnel {
  id: number;
  name: string;
  email: string;
  roleId: number;
  hourlyRate: number;
  isAvailable: boolean;
}

export interface TeamMember {
  id: string | number;
  roleId: number;
  personnelId: number | null;
  hours: number;
  rate: number;
  cost: number;
  fte?: number;
  dedication?: number;
  quantity?: number;
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
  marginFactor?: number;
}

export interface QuoteDeliverable {
  id: string;
  type: string;
  frequency: string;
  description: string;
  budget: number;
}

export interface QuotationData {
  client: Client | null;
  project: {
    name: string;
    type: string;
    duration: ProjectDuration | '';
  };
  template: ReportTemplate | null;
  complexity: 'low' | 'medium' | 'high' | '';
  customization: string;
  analysisType: string;
  mentionsVolume: string;
  countriesCovered: string;
  clientEngagement: string;
  teamOption: 'auto' | 'manual';
  teamMembers: TeamMember[];
  isAlwaysOnProject: boolean;
  deliverables: QuoteDeliverable[];
  additionalDeliverableCost: number;
  financials: FinancialSettings;
}

interface OptimizedQuoteContextType {
  quotationData: QuotationData;
  baseCost: number;
  complexityAdjustment: number;
  markupAmount: number;
  totalAmount: number;
  recommendedRoleIds: number[];
  isSavingInProgress: boolean;
  isEditing: boolean;
  isRecotizacion: boolean;
  quotationId: number | null;
  updateClient: (client: Client | null) => void;
  updateProjectName: (name: string) => void;
  updateProjectType: (type: string) => void;
  updateProjectDuration: (duration: ProjectDuration) => void;
  updateTemplate: (template: ReportTemplate | null) => void;
  updateComplexity: (complexity: 'low' | 'medium' | 'high') => void;
  updateCustomization: (customization: string) => void;
  updateAnalysisType: (type: string) => void;
  updateMentionsVolume: (volume: string) => void;
  updateCountriesCovered: (countries: string) => void;
  updateClientEngagement: (engagement: string) => void;
  setTeamOption: (option: 'auto' | 'manual') => void;
  addTeamMember: (member: Omit<TeamMember, 'id'>) => void;
  updateTeamMember: (id: string | number, updates: Partial<Omit<TeamMember, 'id'>>) => void;
  removeTeamMember: (id: string | number) => void;
  applyRecommendedTeam: () => void;
  setIsAlwaysOnProject: (isAlwaysOn: boolean) => void;
  updateDeliverables: (deliverables: QuoteDeliverable[]) => void;
  addDeliverable: (deliverable: QuoteDeliverable) => void;
  updateDeliverable: (id: string, updates: Partial<Omit<QuoteDeliverable, 'id'>>) => void;
  removeDeliverable: (id: string) => void;
  updateAdditionalDeliverableCost: (cost: number) => void;
  updateFinancials: (updates: Partial<FinancialSettings>) => void;
  saveQuotation: () => Promise<number>;
  currentStep: number;
  goToStep: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  availableRoles: Role[] | null;
  availablePersonnel: Personnel[] | null;
  loadRoles: () => Promise<void>;
  loadPersonnel: () => Promise<void>;
}

const initialQuotationData: QuotationData = {
  client: null,
  project: { name: '', type: '', duration: '' },
  template: null,
  complexity: '',
  customization: '',
  analysisType: '',
  mentionsVolume: '',
  countriesCovered: '',
  clientEngagement: '',
  teamOption: 'auto',
  teamMembers: [],
  isAlwaysOnProject: false,
  deliverables: [],
  additionalDeliverableCost: 0,
  financials: {
    platformCost: 0,
    deviationPercentage: 0,
    discount: 0,
    marginFactor: 1.0
  }
};

const OptimizedQuoteContext = createContext<OptimizedQuoteContextType | undefined>(undefined);

export interface OptimizedQuoteProviderProps {
  children: ReactNode;
  quotationId?: number;
  isRequote?: boolean;
}

export const OptimizedQuoteProvider: React.FC<OptimizedQuoteProviderProps> = ({ 
  children, 
  quotationId, 
  isRequote = false 
}) => {
  const [quotationData, setQuotationData] = useState<QuotationData>(initialQuotationData);
  const [baseCost, setBaseCost] = useState(0);
  const [complexityAdjustment, setComplexityAdjustment] = useState(0);
  const [markupAmount, setMarkupAmount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [recommendedRoleIds, setRecommendedRoleIds] = useState<number[]>([]);
  const [isSavingInProgress, setIsSavingInProgress] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [availableRoles, setAvailableRoles] = useState<Role[] | null>(null);
  const [availablePersonnel, setAvailablePersonnel] = useState<Personnel[] | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(!!quotationId && !isRequote);
  const [isRecotizacion, setIsRecotizacion] = useState<boolean>(!!isRequote);
  const [editQuotationId, setEditQuotationId] = useState<number | null>(quotationId || null);

  // Helper functions for complexity factors
  const getAnalysisTypeFactor = (type: string): number => {
    switch (type) {
      case 'basic': return 0;
      case 'advanced': return 0.1;
      case 'premium': return 0.2;
      default: return 0;
    }
  };

  const getMentionsVolumeFactor = (volume: string): number => {
    switch (volume) {
      case 'low': return 0;
      case 'medium': return 0.05;
      case 'high': return 0.15;
      default: return 0;
    }
  };

  const getCountriesFactor = (countries: string): number => {
    switch (countries) {
      case 'single': return 0;
      case 'multiple': return 0.1;
      case 'global': return 0.2;
      default: return 0;
    }
  };

  const getClientEngagementFactor = (engagement: string): number => {
    switch (engagement) {
      case 'low': return 0;
      case 'medium': return 0.05;
      case 'high': return 0.1;
      default: return 0;
    }
  };

  const complexityFactors = useMemo((): ComplexityFactors => {
    return {
      analysisTypeFactor: getAnalysisTypeFactor(quotationData.analysisType),
      mentionsVolumeFactor: getMentionsVolumeFactor(quotationData.mentionsVolume),
      countriesFactor: getCountriesFactor(quotationData.countriesCovered),
      clientEngagementFactor: getClientEngagementFactor(quotationData.clientEngagement),
      templateFactor: quotationData.template === null ? 
                     (quotationData.complexity === 'high' ? 0.20 : 
                      quotationData.complexity === 'medium' ? 0.10 : 0) :
                     (quotationData.template.complexity === 'high' ? 0.15 :
                      quotationData.template.complexity === 'medium' ? 0.08 : 0)
    };
  }, [quotationData.analysisType, quotationData.mentionsVolume, quotationData.countriesCovered, 
      quotationData.clientEngagement, quotationData.template, quotationData.complexity]);

  // Calcular base cost desde los miembros del equipo
  useEffect(() => {
    const teamBaseCost = quotationData.teamMembers.reduce((total, member) => {
      return total + (member.cost || 0);
    }, 0);
    
    const templateCost = quotationData.template?.baseCost || 0;
    const totalBaseCost = teamBaseCost + templateCost;
    
    setBaseCost(totalBaseCost);
  }, [quotationData.teamMembers, quotationData.template]);

  // Calcular ajuste de complejidad
  useEffect(() => {
    const totalFactor = 
      complexityFactors.analysisTypeFactor +
      complexityFactors.mentionsVolumeFactor +
      complexityFactors.countriesFactor +
      complexityFactors.clientEngagementFactor +
      complexityFactors.templateFactor;
    
    const adjustment = baseCost * totalFactor;
    setComplexityAdjustment(adjustment);
  }, [baseCost, complexityFactors]);

  // Calcular markup basado en configuraciones financieras
  useEffect(() => {
    const baseWithComplexity = baseCost + complexityAdjustment;
    const platformCostAmount = quotationData.financials.platformCost || 0;
    const deviationAmount = baseWithComplexity * ((quotationData.financials.deviationPercentage || 0) / 100);
    const marginMultiplier = quotationData.financials.marginFactor || 1.0;
    
    const grossAmount = (baseWithComplexity + platformCostAmount + deviationAmount) * marginMultiplier;
    const discountAmount = grossAmount * ((quotationData.financials.discount || 0) / 100);
    
    setMarkupAmount(platformCostAmount + deviationAmount + (grossAmount * (marginMultiplier - 1)));
    setTotalAmount(grossAmount - discountAmount);
  }, [baseCost, complexityAdjustment, quotationData.financials]);

  // Context methods
  const updateClient = useCallback((client: Client | null) => {
    setQuotationData(prev => ({ ...prev, client }));
  }, []);

  const updateProjectName = useCallback((name: string) => {
    setQuotationData(prev => ({
      ...prev,
      project: { ...prev.project, name }
    }));
  }, []);

  const updateProjectType = useCallback((type: string) => {
    setQuotationData(prev => ({
      ...prev,
      project: { ...prev.project, type }
    }));
  }, []);

  const updateProjectDuration = useCallback((duration: ProjectDuration) => {
    setQuotationData(prev => ({
      ...prev,
      project: { ...prev.project, duration }
    }));
  }, []);

  const updateTemplate = useCallback((template: ReportTemplate | null) => {
    setQuotationData(prev => ({ ...prev, template }));
    if (template) {
      setBaseCost(template.baseCost);
    }
  }, []);

  const updateComplexity = useCallback((complexity: 'low' | 'medium' | 'high') => {
    setQuotationData(prev => ({ ...prev, complexity }));
  }, []);

  const updateCustomization = useCallback((customization: string) => {
    setQuotationData(prev => ({ ...prev, customization }));
  }, []);

  const updateAnalysisType = useCallback((type: string) => {
    setQuotationData(prev => ({ ...prev, analysisType: type }));
  }, []);

  const updateMentionsVolume = useCallback((volume: string) => {
    setQuotationData(prev => ({ ...prev, mentionsVolume: volume }));
  }, []);

  const updateCountriesCovered = useCallback((countries: string) => {
    setQuotationData(prev => ({ ...prev, countriesCovered: countries }));
  }, []);

  const updateClientEngagement = useCallback((engagement: string) => {
    setQuotationData(prev => ({ ...prev, clientEngagement: engagement }));
  }, []);

  const setTeamOption = useCallback((option: 'auto' | 'manual') => {
    setQuotationData(prev => ({ ...prev, teamOption: option }));
  }, []);

  const addTeamMember = useCallback((member: Omit<TeamMember, 'id'>) => {
    const newMember: TeamMember = { 
      ...member, 
      id: Date.now().toString() 
    };
    setQuotationData(prev => ({
      ...prev,
      teamMembers: [...prev.teamMembers, newMember]
    }));
  }, []);

  const updateTeamMember = useCallback((id: string | number, updates: Partial<Omit<TeamMember, 'id'>>) => {
    setQuotationData(prev => ({
      ...prev,
      teamMembers: prev.teamMembers.map(member =>
        member.id === id ? { ...member, ...updates } : member
      )
    }));
  }, []);

  const removeTeamMember = useCallback((id: string | number) => {
    setQuotationData(prev => ({
      ...prev,
      teamMembers: prev.teamMembers.filter(member => member.id !== id)
    }));
  }, []);

  const applyRecommendedTeam = useCallback(() => {
    // Implementation for applying recommended team
  }, []);

  const setIsAlwaysOnProject = useCallback((isAlwaysOn: boolean) => {
    setQuotationData(prev => ({ ...prev, isAlwaysOnProject: isAlwaysOn }));
  }, []);

  const updateDeliverables = useCallback((deliverables: QuoteDeliverable[]) => {
    setQuotationData(prev => ({ ...prev, deliverables }));
  }, []);

  const addDeliverable = useCallback((deliverable: QuoteDeliverable) => {
    setQuotationData(prev => ({
      ...prev,
      deliverables: [...prev.deliverables, deliverable]
    }));
  }, []);

  const updateDeliverable = useCallback((id: string, updates: Partial<Omit<QuoteDeliverable, 'id'>>) => {
    setQuotationData(prev => ({
      ...prev,
      deliverables: prev.deliverables.map(deliverable =>
        deliverable.id === id ? { ...deliverable, ...updates } : deliverable
      )
    }));
  }, []);

  const removeDeliverable = useCallback((id: string) => {
    setQuotationData(prev => ({
      ...prev,
      deliverables: prev.deliverables.filter(deliverable => deliverable.id !== id)
    }));
  }, []);

  const updateAdditionalDeliverableCost = useCallback((cost: number) => {
    setQuotationData(prev => ({ ...prev, additionalDeliverableCost: cost }));
  }, []);

  const updateFinancials = useCallback((updates: Partial<FinancialSettings>) => {
    setQuotationData(prev => ({
      ...prev,
      financials: { ...prev.financials, ...updates }
    }));
  }, []);

  const saveQuotation = useCallback(async (): Promise<number> => {
    setIsSavingInProgress(true);
    try {
      const response = await apiRequest('/api/quotations', 'POST', quotationData);
      return response.id;
    } finally {
      setIsSavingInProgress(false);
    }
  }, [quotationData]);

  const goToStep = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep(prev => prev + 1);
  }, []);

  const previousStep = useCallback(() => {
    setCurrentStep(prev => Math.max(1, prev - 1));
  }, []);

  const loadRoles = useCallback(async () => {
    try {
      const roles = await apiRequest('/api/roles', 'GET');
      setAvailableRoles(roles);
    } catch (error) {
      console.error("Error al cargar roles:", error);
    }
  }, []);

  const loadPersonnel = useCallback(async () => {
    try {
      const personnel = await apiRequest('/api/personnel', 'GET');
      setAvailablePersonnel(personnel);
    } catch (error) {
      console.error("Error al cargar personal:", error);
    }
  }, []);

  const contextValue: OptimizedQuoteContextType = {
    quotationData,
    baseCost,
    complexityAdjustment,
    markupAmount,
    totalAmount,
    recommendedRoleIds,
    isSavingInProgress,
    isEditing: !!quotationId && !isRequote,
    isRecotizacion: !!isRequote,
    quotationId: editQuotationId,
    updateClient,
    updateProjectName,
    updateProjectType,
    updateProjectDuration,
    updateTemplate,
    updateComplexity,
    updateCustomization,
    updateAnalysisType,
    updateMentionsVolume,
    updateCountriesCovered,
    updateClientEngagement,
    setTeamOption,
    addTeamMember,
    updateTeamMember,
    removeTeamMember,
    applyRecommendedTeam,
    setIsAlwaysOnProject,
    updateDeliverables,
    addDeliverable,
    updateDeliverable,
    removeDeliverable,
    updateAdditionalDeliverableCost,
    updateFinancials,
    saveQuotation,
    currentStep,
    goToStep,
    nextStep,
    previousStep,
    availableRoles,
    availablePersonnel,
    loadRoles,
    loadPersonnel
  };

  return (
    <OptimizedQuoteContext.Provider value={contextValue}>
      {children}
    </OptimizedQuoteContext.Provider>
  );
};

export const useOptimizedQuote = () => {
  const context = useContext(OptimizedQuoteContext);
  if (context === undefined) {
    throw new Error('useOptimizedQuote must be used within an OptimizedQuoteProvider');
  }
  return context;
};