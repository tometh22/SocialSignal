
import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

// Types
interface Client {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  industry?: string;
  logo?: string;
}

interface ReportTemplate {
  id: number;
  name: string;
  description?: string;
  basePrice: number;
  durationWeeks: number;
  recommendedRoles: number[];
}

interface Role {
  id: number;
  name: string;
  hourlyRate: number;
  description?: string;
}

interface Personnel {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  roleId: number;
  hourlyRate: number;
  isActive: boolean;
}

interface TeamMember {
  id: string | number;
  roleId: number;
  personnelId?: number;
  hoursPerWeek: number;
  weeksCovered: number;
  totalCost: number;
}

interface QuoteDeliverable {
  id: string;
  name: string;
  description: string;
  cost: number;
  isIncluded: boolean;
}

interface ProjectDuration {
  weeks: number;
  isAlwaysOn: boolean;
  monthsForAlwaysOn?: number;
  value?: string;
}

interface QuotationData {
  client: Client | null;
  projectName: string;
  projectType: string;
  projectDuration: ProjectDuration;
  template: ReportTemplate | null;
  complexity: 'low' | 'medium' | 'high';
  customization: string;
  analysisType: string;
  mentionsVolume: string;
  countriesCovered: string;
  clientEngagement: string;
  teamOption: 'auto' | 'manual';
  teamMembers: TeamMember[];
  deliverables: QuoteDeliverable[];
  additionalDeliverableCost: number;
  markupPercentage: number;
  discountPercentage: number;
  notes: string;
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
  complexityFactors: any;
  updateClient: (client: Client | null) => void;
  updateProjectName: (name: string) => void;
  updateProjectType: (type: string) => void;
  updateProjectDuration: (duration: string | ProjectDuration) => void;
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
  updateFinancials: (markup: number, discount: number) => void;
  saveQuotation: () => Promise<void>;
  loadQuotation: (id: number) => Promise<void>;
  currentStep: number;
  goToStep: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  availableRoles: Role[] | null;
  availablePersonnel: Personnel[] | null;
  loadRoles: () => Promise<void>;
  loadPersonnel: () => Promise<void>;
  refreshData: () => void;
  isRefreshing: boolean;
}

const initialQuotationData: QuotationData = {
  client: null,
  projectName: '',
  projectType: '',
  projectDuration: { weeks: 4, isAlwaysOn: false },
  template: null,
  complexity: 'medium',
  customization: '',
  analysisType: '',
  mentionsVolume: '',
  countriesCovered: '',
  clientEngagement: '',
  teamOption: 'auto',
  teamMembers: [],
  deliverables: [],
  additionalDeliverableCost: 0,
  markupPercentage: 30,
  discountPercentage: 0,
  notes: ''
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [complexityFactors, setComplexityFactors] = useState({});
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);

  // Basic update functions
  const updateClient = useCallback((client: Client | null) => {
    setQuotationData(prev => ({ ...prev, client }));
  }, []);

  const updateProjectName = useCallback((projectName: string) => {
    setQuotationData(prev => ({ ...prev, projectName }));
  }, []);

  const updateProjectType = useCallback((projectType: string) => {
    setQuotationData(prev => ({ ...prev, projectType }));
  }, []);

  const updateProjectDuration = useCallback((value: string | ProjectDuration) => {
    if (typeof value === 'string') {
      // Mapear los valores del select a semanas
      const durationMap: Record<string, number> = {
        '3-weeks': 3,
        '1-month': 4,
        '2-months': 8,
        '3-months': 12,
        '4-months': 16,
        '6-months': 24,
        '12-months': 48,
        'custom': 4
      };
      
      const weeks = durationMap[value] || 4;
      setQuotationData(prev => ({ 
        ...prev, 
        projectDuration: { 
          ...prev.projectDuration, 
          weeks,
          value
        } 
      }));
    } else {
      setQuotationData(prev => ({ ...prev, projectDuration: value }));
    }
  }, []);

  const updateTemplate = useCallback((template: ReportTemplate | null) => {
    setQuotationData(prev => ({ ...prev, template }));
    if (template) {
      setRecommendedRoleIds(template.recommendedRoles || []);
    }
  }, []);

  const updateComplexity = useCallback((complexity: 'low' | 'medium' | 'high') => {
    setQuotationData(prev => ({ ...prev, complexity }));
  }, []);

  const updateCustomization = useCallback((customization: string) => {
    setQuotationData(prev => ({ ...prev, customization }));
  }, []);

  const updateAnalysisType = useCallback((analysisType: string) => {
    setQuotationData(prev => ({ ...prev, analysisType }));
  }, []);

  const updateMentionsVolume = useCallback((mentionsVolume: string) => {
    setQuotationData(prev => ({ ...prev, mentionsVolume }));
  }, []);

  const updateCountriesCovered = useCallback((countriesCovered: string) => {
    setQuotationData(prev => ({ ...prev, countriesCovered }));
  }, []);

  const updateClientEngagement = useCallback((clientEngagement: string) => {
    setQuotationData(prev => ({ ...prev, clientEngagement }));
  }, []);

  // Team management functions
  const setTeamOption = useCallback((teamOption: 'auto' | 'manual') => {
    setQuotationData(prev => ({ ...prev, teamOption }));
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
    setQuotationData(prev => ({
      ...prev,
      projectDuration: { ...prev.projectDuration, isAlwaysOn }
    }));
  }, []);

  // Deliverable functions
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

  const updateAdditionalDeliverableCost = useCallback((additionalDeliverableCost: number) => {
    setQuotationData(prev => ({ ...prev, additionalDeliverableCost }));
  }, []);

  const updateFinancials = useCallback((markupPercentage: number, discountPercentage: number) => {
    setQuotationData(prev => ({ ...prev, markupPercentage, discountPercentage }));
  }, []);

  // Navigation functions
  const goToStep = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep(prev => prev + 1);
  }, []);

  const previousStep = useCallback(() => {
    setCurrentStep(prev => Math.max(1, prev - 1));
  }, []);

  // Data loading functions
  const loadRoles = useCallback(async () => {
    try {
      const response = await fetch('/api/roles');
      if (response.ok) {
        const roles = await response.json();
        setAvailableRoles(roles);
      }
    } catch (error) {
      console.error("Error loading roles:", error);
    }
  }, []);

  const loadPersonnel = useCallback(async () => {
    try {
      const response = await fetch('/api/personnel');
      if (response.ok) {
        const personnel = await response.json();
        setAvailablePersonnel(personnel);
      }
    } catch (error) {
      console.error("Error loading personnel:", error);
    }
  }, []);

  const saveQuotation = useCallback(async () => {
    setIsSavingInProgress(true);
    try {
      const response = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quotationData)
      });
      
      if (!response.ok) {
        throw new Error('Failed to save quotation');
      }
      
      toast({
        title: "Cotización guardada",
        description: "La cotización se ha guardado correctamente."
      });
    } catch (error) {
      console.error("Error saving quotation:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar la cotización.",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsSavingInProgress(false);
    }
  }, [quotationData, toast]);

  const loadQuotation = useCallback(async (id: number) => {
    try {
      const response = await fetch(`/api/quotations/${id}`);
      if (response.ok) {
        const data = await response.json();
        setQuotationData(data);
      }
    } catch (error) {
      console.error("Error loading quotation:", error);
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
    quotationId: quotationId || null,
    complexityFactors,
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
    loadQuotation,
    currentStep,
    goToStep,
    nextStep,
    previousStep,
    availableRoles,
    availablePersonnel,
    loadRoles,
    loadPersonnel,
    refreshData,
    isRefreshing
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
