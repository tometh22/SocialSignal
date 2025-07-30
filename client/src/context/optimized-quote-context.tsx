import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Client, ReportTemplate, Role, Personnel, Quotation } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export interface OptimizedTeamMember {
  id: string;
  roleId: number;
  personnelId: number | null;
  hours: number;
  rate: number;
  cost: number;
}

export interface ProjectData {
  name: string;
  type: string;
  duration: string;
}

export interface ComplexityFactors {
  analysisTypeFactor: number;
  mentionsVolumeFactor: number;
  countriesFactor: number;
  clientEngagementFactor: number;
}

interface QuotationFinancials {
  platformCost: number;
  deviationPercentage: number;
  discount: number;
  marginFactor: number;
  marginPercentage?: number;
  discountPercentage?: number;
  // Nuevos campos para herramientas y pricing manual
  toolsCost: number;
  priceMode: 'auto' | 'manual';
  manualPrice?: number;
}

export interface QuotationData {
  id?: number; // Para rastrear cotización existente al editar
  client: Client | null;
  project: ProjectData;
  analysisType: string;
  mentionsVolume: string;
  countriesCovered: string;
  clientEngagement: string;
  template: ReportTemplate | null;
  complexity: 'basic' | 'medium' | 'high';
  teamMembers: OptimizedTeamMember[];
  deliverables: any[];
  additionalDeliverableCost: number;
  financials: QuotationFinancials;
  inflation: {
    applyInflationAdjustment: boolean;
    inflationMethod: string;
    manualInflationRate: number;
    projectStartDate: string;
    quotationCurrency: string;
  };
  proposalLink?: string; // Link a la propuesta original
}

interface OptimizedQuoteContextType {
  // Data
  quotationData: QuotationData;
  baseCost: number;
  complexityAdjustment: number;
  markupAmount: number;
  totalAmount: number;
  complexityFactors: ComplexityFactors;
  availableRoles: Role[];
  availablePersonnel: Personnel[];
  recommendedRoleIds: number[];

  // Navigation
  currentStep: number;
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (step: number) => void;

  // Update functions
  updateClient: (client: Client | null) => void;
  updateProjectName: (name: string) => void;
  updateProjectType: (type: string) => void;
  updateProjectDuration: (duration: string) => void;
  updateAnalysisType: (type: string) => void;
  updateMentionsVolume: (volume: string) => void;
  updateCountriesCovered: (countries: string) => void;
  updateClientEngagement: (engagement: string) => void;
  updateTemplate: (template: ReportTemplate | null) => void;
  updateComplexity: (complexity: 'basic' | 'medium' | 'high') => void;
  updateTeamMembers: (members: OptimizedTeamMember[]) => void;
  addTeamMember: (member: Omit<OptimizedTeamMember, "id">) => void;
  updateTeamMember: (id: string, updates: Partial<OptimizedTeamMember>) => void;
  removeTeamMember: (id: string) => void;
  updateFinancials: (financials: Partial<QuotationData['financials']>) => void;
  updateInflation: (inflation: Partial<QuotationData['inflation']>) => void;
  // Nuevas funciones para herramientas y pricing manual
  updateToolsCost: (cost: number) => void;
  updatePriceMode: (mode: 'auto' | 'manual') => void;
  updateManualPrice: (price: number) => void;

  // Actions
  loadQuotation: (quotationId: number) => Promise<void>;
  saveQuotation: (status?: 'draft' | 'pending' | 'approved' | 'rejected' | 'in-negotiation') => Promise<void>;
  calculateTotalCost: () => void;
  resetQuotation: () => void;
  setQuotationData: (data: QuotationData) => void;
  loadRoles: () => void;
  loadPersonnel: () => void;
  forceRecalculate: () => void;

  // Deliverables
  updateDeliverables: (deliverables: any[]) => void;
  addDeliverable: (deliverable: any) => void;
  updateDeliverable: (index: number, deliverable: any) => void;
  removeDeliverable: (index: number) => void;
  updateAdditionalDeliverableCost: (cost: number) => void;
  
  // General update function
  updateQuotationData: (data: Partial<QuotationData>) => void;
}

const OptimizedQuoteContext = createContext<OptimizedQuoteContextType | undefined>(undefined);

const initialQuotationData: QuotationData = {
  client: null,
  project: {
    name: "",
    type: "",
    duration: ""
  },
  analysisType: "standard",
  mentionsVolume: "medium",
  countriesCovered: "1",
  clientEngagement: "medium",
  template: null,
  complexity: 'basic',
  teamMembers: [],
  deliverables: [],
  additionalDeliverableCost: 0,
  financials: {
    platformCost: 0,
    deviationPercentage: 0,
    discount: 0,
    marginFactor: 2.0,
    marginPercentage: 100,
    discountPercentage: 0,
    // Nuevos campos inicializados
    toolsCost: 0,
    priceMode: 'auto' as const,
    manualPrice: undefined
  },
  inflation: {
    applyInflationAdjustment: false,
    inflationMethod: "manual",
    manualInflationRate: 25,
    projectStartDate: "",
    quotationCurrency: "USD"
  }
};

// Helper functions for complexity calculation
const getAnalysisTypeFactor = (type: string): number => {
  console.log('📊 Analysis Type Factor for:', type);
  const factors: Record<string, number> = {
    'basic': -0.10,   // Básico: -10% (más simple que estándar)
    'standard': 0.0,  // Estándar: +0% (base de referencia)
    'advanced': 0.15, // Avanzado: +15%
    'premium': 0.25,  // Premium: +25%
    'Básico': -0.10,
    'Estándar': 0.0,
    'Avanzado': 0.15,
    'Premium': 0.25
  };
  const factor = factors[type] || 0.0;
  console.log(`📊 Analysis Type "${type}" -> ${factor} (${factor * 100}%)`);
  return factor;
};

const getMentionsVolumeFactor = (volume: string): number => {
  console.log('📊 Mentions Volume Factor for:', volume);
  const factors: Record<string, number> = {
    'low': -0.05,     // Bajo: -5% (menos trabajo de análisis)
    'medium': 0.0,    // Medio: +0% (base estándar 1K-10K)
    'high': 0.15,     // Alto: +15% (más trabajo significativo)
    'very-high': 0.30, // Muy Alto: +30% (complejidad exponencial)
    'Bajo': -0.05,
    'Medio': 0.0,
    'Alto': 0.15,
    'Muy Alto': 0.30
  };
  const factor = factors[volume] || 0.0;
  console.log(`📊 Mentions Volume "${volume}" -> ${factor} (${factor * 100}%)`);
  return factor;
};

const getCountriesFactor = (countries: string): number => {
  console.log('📊 Countries Factor for:', countries);
  const factors: Record<string, number> = {
    '1': 0.0,         // 1 país: +0% (base estándar)
    '2-3': 0.08,      // 2-3 países: +8% (coordinación adicional)
    '4-6': 0.18,      // 4-6 países: +18% (complejidad multicultural)
    '7+': 0.30,       // 7+ países: +30% (gestión muy compleja)
    '2-3 países': 0.08,
    '4+ países': 0.18,
    '4-6 países': 0.18,
    '7+ países': 0.30
  };
  const factor = factors[countries] || 0.0;
  console.log(`📊 Countries "${countries}" -> ${factor} (${factor * 100}%)`);
  return factor;
};

const getClientEngagementFactor = (engagement: string): number => {
  console.log('📊 Client Engagement Factor for:', engagement);
  const factors: Record<string, number> = {
    'low': -0.05,     // Bajo: -5% (cliente autónomo, menos reuniones)
    'medium': 0.0,    // Medio: +0% (engagement estándar)
    'high': 0.12,     // Alto: +12% (más reuniones y seguimiento)
    'very-high': 0.20, // Muy Alto: +20% (cliente muy demandante)
    'Bajo': -0.05,
    'Medio': 0.0,
    'Alto': 0.12,
    'Muy Alto': 0.20
  };
  const factor = factors[engagement] || 0.0;
  console.log(`📊 Client Engagement "${engagement}" -> ${factor} (${factor * 100}%)`);
  return factor;
};

const getTemplateFactor = (complexity: string): number => {
  console.log('📊 Template Factor for:', complexity);
  const factors: Record<string, number> = {
    'basic': 0.0,
    'medium': 0.1,
    'high': 0.15,
    'low': 0.0
  };
  const factor = factors[complexity] || 0.0;
  console.log(`📊 Template "${complexity}" -> ${factor} (${factor * 100}%)`);
  return factor;
};

interface OptimizedQuoteProviderProps {
  children: React.ReactNode;
  quotationId?: number;
  isRequote?: boolean;
}

const OptimizedQuoteProvider: React.FC<OptimizedQuoteProviderProps> = ({ children, quotationId, isRequote }) => {
  const [quotationData, setQuotationData] = useState<QuotationData>(initialQuotationData);
  const [baseCost, setBaseCost] = useState(0);
  const [complexityAdjustment, setComplexityAdjustment] = useState(0);
  const [markupAmount, setMarkupAmount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);
  const [recalculationTrigger, setRecalculationTrigger] = useState(0);

  const queryClient = useQueryClient();

  // Get data from queries
  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });

  const { data: personnel = [] } = useQuery<Personnel[]>({
    queryKey: ["/api/personnel"],
  });

  // Force recalculation function with debouncing
  const forceRecalculate = useCallback(() => {
    console.log('🔄 Force recalculation triggered');

    // Debounce rapid consecutive calls
    const now = Date.now();
    const lastRecalc = localStorage.getItem('last-recalc-time');

    if (lastRecalc && (now - parseInt(lastRecalc)) < 100) {
      console.log('🔄 Recalculation debounced');
      return;
    }

    localStorage.setItem('last-recalc-time', now.toString());
    setRecalculationTrigger(prev => prev + 1);
  }, []);

  // Enhanced auto-save draft to localStorage with error handling
  useEffect(() => {
    const saveInterval = setInterval(() => {
      if (quotationData.project.name || quotationData.teamMembers.length > 0 || quotationData.client) {
        try {
          const draftData = {
            quotationData,
            timestamp: Date.now(),
            version: '2.0',
            userAgent: navigator.userAgent,
            url: window.location.href
          };

          localStorage.setItem('draft-quotation', JSON.stringify(draftData));
          localStorage.setItem('draft-quotation-backup', JSON.stringify(draftData));
          localStorage.setItem('last-autosave-time', Date.now().toString());
          console.log('💾 Autoguardado completo:', new Date().toLocaleTimeString(), 
                     `- Cliente: ${quotationData.client?.name || 'Sin cliente'}`,
                     `- Proyecto: ${quotationData.project.name || 'Sin nombre'}`,
                     `- Equipo: ${quotationData.teamMembers.length} miembros`);
        } catch (error) {
          console.error('❌ Error saving draft:', error);
          // Try to clear some space and save essential data only
          try {
            localStorage.removeItem('draft-quotation-backup');
            const essentialData = {
              quotationData: {
                client: quotationData.client,
                project: quotationData.project,
                teamMembers: quotationData.teamMembers,
                template: quotationData.template
              },
              timestamp: Date.now()
            };
            localStorage.setItem('draft-quotation', JSON.stringify(essentialData));
            console.log('💾 Guardado de emergencia realizado');
          } catch (secondError) {
            console.error('❌ CRÍTICO: No se puede guardar datos del formulario');
            // Last resort: try to save to sessionStorage
            try {
              sessionStorage.setItem('emergency-draft', JSON.stringify({
                client: quotationData.client?.name,
                project: quotationData.project.name,
                teamCount: quotationData.teamMembers.length,
                timestamp: Date.now()
              }));
            } catch {}
          }
        }
      }
    }, 10000); // Save every 10 seconds (más frecuente)

    return () => clearInterval(saveInterval);
  }, [quotationData]);

  // Draft detection disabled - clean up any existing drafts on load
  useEffect(() => {
    // Clear any existing draft data to prevent issues
    localStorage.removeItem('draft-quotation');
    localStorage.removeItem('draft-quotation-backup');
    localStorage.removeItem('pending-draft-restore');
    console.log('🧹 Draft data cleared on component mount');
  }, []);

  // Calculate recommended roles based on template
  const recommendedRoleIds = useMemo(() => {
    if (!quotationData.template) return [];

    // Basic role recommendations based on template complexity
    const baseRoles = [1, 2]; // Analyst and Project Manager

    if (quotationData.template.complexity === 'medium') {
      baseRoles.push(3); // Senior Analyst
    } else if (quotationData.template.complexity === 'high') {
      baseRoles.push(3, 4); // Senior Analyst and Director
    }

    return baseRoles;
  }, [quotationData.template]);

  // Calculate complexity factors with proper logging
  const complexityFactors = useMemo((): ComplexityFactors => {
    console.log('🔧 === COMPLEXITY FACTORS CALCULATION ===');
    console.log('🔍 Input data:', {
      analysisType: quotationData.analysisType,
      mentionsVolume: quotationData.mentionsVolume,
      countriesCovered: quotationData.countriesCovered,
      clientEngagement: quotationData.clientEngagement,
      template: quotationData.template?.name || 'None',
      complexity: quotationData.complexity
    });

    const factors = {
      analysisTypeFactor: getAnalysisTypeFactor(quotationData.analysisType),
      mentionsVolumeFactor: getMentionsVolumeFactor(quotationData.mentionsVolume),
      countriesFactor: getCountriesFactor(quotationData.countriesCovered),
      clientEngagementFactor: getClientEngagementFactor(quotationData.clientEngagement)
      // Removed templateFactor - it doesn't make logical sense
    };

    console.log('📊 Calculated complexity factors:', factors);

    const totalFactor = Object.values(factors).reduce((sum, factor) => sum + (factor || 0), 0);
    console.log(`🎯 Total complexity factor: ${totalFactor} (${(totalFactor * 100).toFixed(1)}%)`);

    return factors;
  }, [
    quotationData.analysisType, 
    quotationData.mentionsVolume, 
    quotationData.countriesCovered, 
    quotationData.clientEngagement, 
    quotationData.template, 
    quotationData.complexity,
    recalculationTrigger
  ]);

  // Calculate costs with proper recalculation trigger
  useEffect(() => {
    console.log('💰 === COST CALCULATION START ===');
    console.log('🔧 Team members:', quotationData.teamMembers);
    console.log('🔧 Template:', quotationData.template?.name);
    console.log('🔧 Financials:', quotationData.financials);
    console.log('🔧 Recalculation trigger:', recalculationTrigger);

    if (!quotationData.teamMembers || quotationData.teamMembers.length === 0) {
      console.log('⚠️ No team members, setting costs to 0');
      setBaseCost(0);
      setComplexityAdjustment(0);
      setMarkupAmount(0);
      setTotalAmount(0);
      return;
    }

    // Calculate base cost from team members
    const calculatedBaseCost = quotationData.teamMembers.reduce((sum, member) => {
      const memberCost = (member.hours || 0) * (member.rate || 0);
      console.log(`👤 Member ${member.id}: ${member.hours}h × $${member.rate} = $${memberCost}`);
      return sum + memberCost;
    }, 0);

    console.log(`💵 Calculated base cost: $${calculatedBaseCost}`);
    setBaseCost(calculatedBaseCost);

    // Calculate complexity adjustment
    const totalComplexityFactor = Object.values(complexityFactors).reduce((sum, factor) => sum + (factor || 0), 0);
    const calculatedComplexityAdjustment = calculatedBaseCost * totalComplexityFactor;
    console.log(`🔧 Complexity adjustment: $${calculatedBaseCost} × ${totalComplexityFactor} = $${calculatedComplexityAdjustment}`);
    setComplexityAdjustment(calculatedComplexityAdjustment);

    // Calculate subtotal after complexity
    const subtotalWithComplexity = calculatedBaseCost + calculatedComplexityAdjustment;
    console.log(`📊 Subtotal with complexity: $${subtotalWithComplexity}`);

    // Declare variables for calculated values
    let calculatedMarkup = 0;
    let subtotalWithMarkup = 0;

    // Check if we're in manual pricing mode
    if (quotationData.financials.priceMode === 'manual' && quotationData.financials.manualPrice) {
      console.log(`✏️ Manual pricing mode: Target price $${quotationData.financials.manualPrice}`);

      // Calculate what margin would be needed to reach the manual price (before tools)
      const manualPrice = quotationData.financials.manualPrice;
      const toolsCost = quotationData.financials.toolsCost || 0;
      // Manual price includes tools, so we need to subtract tools to get the base for markup calculation
      const priceBeforeTools = manualPrice - toolsCost;
      calculatedMarkup = priceBeforeTools - subtotalWithComplexity;
      const marginFactor = subtotalWithComplexity > 0 ? (priceBeforeTools / subtotalWithComplexity) : 1;

      console.log(`✏️ Manual price markup: $${calculatedMarkup}, Effective margin: ${marginFactor}x`);
      setMarkupAmount(calculatedMarkup);

      // Update margin factor in the context for display purposes
      const updatedFinancials = {
        ...quotationData.financials,
        marginFactor: marginFactor,
        marginPercentage: ((marginFactor - 1) * 100)
      };

      setQuotationData(prev => ({ 
        ...prev, 
        financials: updatedFinancials 
      }));

      subtotalWithMarkup = priceBeforeTools;
      console.log(`📈 Manual subtotal with markup (before tools): $${subtotalWithMarkup}`);
    } else {
      // Calculate markup (margin) normally
      const marginFactor = quotationData.financials.marginFactor || 2.0;
      calculatedMarkup = subtotalWithComplexity * (marginFactor - 1);
      console.log(`💰 Auto markup: $${subtotalWithComplexity} × ${marginFactor - 1} = $${calculatedMarkup}`);
      setMarkupAmount(calculatedMarkup);

      subtotalWithMarkup = subtotalWithComplexity + calculatedMarkup;
      console.log(`📈 Auto subtotal with markup: $${subtotalWithMarkup}`);
    }

    // Add tools cost AFTER markup
    const toolsCost = quotationData.financials.toolsCost || 0;
    const subtotalWithTools = subtotalWithMarkup + toolsCost;
    console.log(`🔧 Tools cost (added after markup): $${toolsCost}, Subtotal with tools: $${subtotalWithTools}`);

    // Update the variable name for consistency
    subtotalWithMarkup = subtotalWithTools;

    // Add platform cost
    const platformCost = quotationData.financials.platformCost || 0;
    const subtotalWithPlatform = subtotalWithMarkup + platformCost;
    console.log(`🖥️ Platform cost: $${platformCost}, Subtotal: $${subtotalWithPlatform}`);

    // Apply deviation percentage
    const deviationPercentage = quotationData.financials.deviationPercentage || 0;
    const deviationAmount = subtotalWithPlatform * (deviationPercentage / 100);
    const subtotalWithDeviation = subtotalWithPlatform + deviationAmount;
    console.log(`📊 Deviation: ${deviationPercentage}% = $${deviationAmount}, Subtotal: $${subtotalWithDeviation}`);

    // Apply discount
    const discountPercentage = quotationData.financials.discountPercentage || 0;
    const discountAmount = subtotalWithDeviation * (discountPercentage / 100);
    const finalTotal = subtotalWithDeviation - discountAmount;
    console.log(`💸 Discount: ${discountPercentage}% = $${discountAmount}, Final: $${finalTotal}`);

    // Handle inflation if applicable
    let finalTotalWithInflation = finalTotal;
    if (quotationData.inflation.applyInflationAdjustment && quotationData.inflation.projectStartDate) {
      const startDate = new Date(quotationData.inflation.projectStartDate);
      const currentDate = new Date();
      const monthsToProject = (startDate.getFullYear() - currentDate.getFullYear()) * 12 + 
                             (startDate.getMonth() - currentDate.getMonth());

      if (monthsToProject > 0) {
        let annualInflationRate;
        if (quotationData.inflation.inflationMethod === 'manual') {
          annualInflationRate = quotationData.inflation.manualInflationRate || 25;
        } else {
          annualInflationRate = 25; // Default
        }

        const monthlyRateDecimal = Math.pow(1 + (annualInflationRate / 100), 1/12) - 1;
        const inflationFactor = Math.pow(1 + monthlyRateDecimal, monthsToProject);
        finalTotalWithInflation = finalTotal * inflationFactor;

        console.log(`📈 Inflation adjustment: ${annualInflationRate}% annual, ${monthsToProject} months = $${finalTotalWithInflation}`);
      }
    }

    // Additional platform cost from template if selected
    if (quotationData.template) {
      const templatePlatformCost = quotationData.template.platformCost || 0;
      if (templatePlatformCost > 0 && quotationData.financials.platformCost === 0) {
        // Auto-apply template platform cost if no manual cost is set
        const updatedFinancials = {
          ...quotationData.financials,
          platformCost: templatePlatformCost
        };
        setQuotationData(prev => ({ 
          ...prev, 
          financials: updatedFinancials 
        }));
      }
    }

    // Ensure all values are properly rounded and consistent
    const finalBaseCost = Math.round(calculatedBaseCost * 100) / 100;
    const finalComplexityAdjustment = Math.round(calculatedComplexityAdjustment * 100) / 100;
    const finalMarkupAmount = Math.round(calculatedMarkup * 100) / 100;
    const finalTotalAmount = Math.round(finalTotalWithInflation * 100) / 100;

    // Set all calculated values
    setBaseCost(finalBaseCost);
    setComplexityAdjustment(finalComplexityAdjustment);
    setMarkupAmount(finalMarkupAmount);
    setTotalAmount(finalTotalAmount);

    console.log(`💰 FINAL VALUES: Base: $${finalBaseCost}, Complexity: $${finalComplexityAdjustment}, Markup: $${finalMarkupAmount}, Total: $${finalTotalAmount}`);
    console.log('💰 === COST CALCULATION END ===');

  }, [quotationData.teamMembers, quotationData.template, quotationData.financials, complexityFactors, roles, recalculationTrigger]);

  // Navigation functions
  const nextStep = useCallback(() => {
    const maxStep = quotationData.project.type === 'always-on' ? 6 : 5;
    if (currentStep < maxStep) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep, quotationData.project.type]);

  const previousStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback((step: number) => {
    const maxStep = quotationData.project.type === 'always-on' ? 6 : 5;
    if (step >= 1 && step <= maxStep) {
      setCurrentStep(step);
    }
  }, [quotationData.project.type]);

  // Context methods with proper recalculation triggers
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

  const updateProjectDuration = useCallback((duration: string) => {
    setQuotationData(prev => ({ 
      ...prev, 
      project: { ...prev.project, duration: duration }
    }));
  }, []);

  const updateAnalysisType = useCallback((analysisType: string) => {
    console.log('📝 Updating analysis type:', analysisType);
    setQuotationData(prev => ({ ...prev, analysisType }));
    forceRecalculate();
  }, [forceRecalculate]);

  const updateMentionsVolume = useCallback((mentionsVolume: string) => {
    console.log('📝 Updating mentions volume:', mentionsVolume);
    setQuotationData(prev => ({ ...prev, mentionsVolume }));
    forceRecalculate();
  }, [forceRecalculate]);

  const updateCountriesCovered = useCallback((countriesCovered: string) => {
    console.log('📝 Updating countries covered:', countriesCovered);
    setQuotationData(prev => ({ ...prev, countriesCovered }));
    forceRecalculate();
  }, [forceRecalculate]);

  const updateClientEngagement = useCallback((clientEngagement: string) => {
    console.log('📝 Updating client engagement:', clientEngagement);
    setQuotationData(prev => ({ ...prev, clientEngagement }));
    forceRecalculate();
  }, [forceRecalculate]);

  const updateTemplate = useCallback((template: ReportTemplate | null) => {
    console.log('📝 Updating template:', template);
    setQuotationData(prev => ({
      ...prev,
      template,
      complexity: template ? template.complexity as 'basic' | 'medium' | 'high' : 'basic',
      financials: {
        ...prev.financials,
        platformCost: template?.platformCost || 0,
        deviationPercentage: template?.deviationPercentage || 0
      }
    }));
    forceRecalculate();
  }, [forceRecalculate]);

  const updateComplexity = useCallback((complexity: 'basic' | 'medium' | 'high') => {
    console.log('📝 Updating complexity:', complexity);
    setQuotationData(prev => ({ ...prev, complexity }));
    forceRecalculate();
  }, [forceRecalculate]);

  const updateTeamMembers = useCallback((teamMembers: OptimizedTeamMember[]) => {
    console.log('👥 Updating team members:', teamMembers);
    setQuotationData(prev => ({ ...prev, teamMembers }));
    forceRecalculate();
  }, [forceRecalculate]);

  const addTeamMember = useCallback((member: Omit<OptimizedTeamMember, "id">) => {
    // Get default values from role if available
    const role = roles.find(r => r.id === member.roleId);
    const defaultHours = member.hours || 40;
    const defaultRate = member.rate || role?.defaultRate || 50;

    const newMember: OptimizedTeamMember = {
      ...member,
      id: `member-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      roleId: member.roleId,
      personnelId: member.personnelId ?? null, // Explicitly handle null/undefined
      hours: defaultHours,
      rate: defaultRate,
      cost: defaultHours * defaultRate
    };

    console.log('➕ Adding new team member:', newMember);

    setQuotationData(prev => ({
      ...prev,
      teamMembers: [...prev.teamMembers, newMember]
    }));

    forceRecalculate();
  }, [roles, forceRecalculate]);

  const updateTeamMember = useCallback((id: string, updates: Partial<OptimizedTeamMember>) => {
    console.log('📝 Updating team member:', id, updates);

    setQuotationData(prev => ({
      ...prev,
      teamMembers: prev.teamMembers.map(member => {
        if (member.id === id) {
          const updatedMember = { ...member, ...updates };
          // Recalculate cost when hours or rate change
          if ('hours' in updates || 'rate' in updates) {
            updatedMember.cost = (updatedMember.hours || 0) * (updatedMember.rate || 0);
          }
          console.log('✅ Updated team member:', updatedMember);
          return updatedMember;
        }
        return member;
      })
    }));

    forceRecalculate();
  }, [forceRecalculate]);

  const removeTeamMember = useCallback((id: string) => {
    console.log('🗑️ Removing team member:', id);
    setQuotationData(prev => ({
      ...prev,
      teamMembers: prev.teamMembers.filter(member => member.id !== id)
    }));
    forceRecalculate();
  }, [forceRecalculate]);

  const updateFinancials = useCallback((financials: Partial<QuotationData['financials']>) => {
    console.log('💰 Updating financials:', financials);
    setQuotationData(prev => ({
      ...prev,
      financials: { ...prev.financials, ...financials }
    }));
    forceRecalculate();
  }, [forceRecalculate]);

  const loadQuotation = useCallback(async (quotationId: number) => {
    try {
      console.log('🔍 Loading quotation ID:', quotationId);

      const quotation: any = await apiRequest(`/api/quotations/${quotationId}`, 'GET');
      console.log('📄 Quotation data loaded:', quotation);

      const teamMembers = await apiRequest(`/api/quotation-team/${quotationId}`, 'GET');
      console.log('👥 Team members loaded:', teamMembers);

      // Ensure team members are properly reconstructed
      const optimizedTeamMembers: OptimizedTeamMember[] = teamMembers.map((member: any, index: number) => {
        const teamMember = {
          id: `member-${member.id || Date.now()}-${index}`,
          roleId: Number(member.roleId),
          // Mantener el personnelId tal como viene de la base de datos, sin modificaciones
          personnelId: member.personnelId ? Number(member.personnelId) : null,
          hours: Number(member.hours) || 0,
          rate: Number(member.rate) || 0,
          cost: Number(member.cost) || (Number(member.hours || 0) * Number(member.rate || 0))
        };
        
        console.log('👤 Processing team member:', {
          id: member.id,
          roleId: member.roleId,
          personnelId: member.personnelId,
          personnelName: member.personnelName,
          processed: teamMember
        });
        
        return teamMember;
      });

      // Get client data separately
      const clientData = quotation.clientId ? await apiRequest(`/api/clients/${quotation.clientId}`, 'GET') : null;
      console.log('🏢 Client data loaded:', clientData);

      // Get template data if available
      let templateData = null;
      if (quotation.templateId) {
        try {
          templateData = await apiRequest(`/api/templates/${quotation.templateId}`, 'GET');
          console.log('📋 Template data loaded:', templateData);
        } catch (templateError) {
          console.warn('⚠️ Could not load template:', templateError);
        }
      }

      const loadedQuotationData = {
        id: quotation.id, // Importante: establecer el ID para indicar que estamos editando
        client: clientData,
        project: {
          name: quotation.projectName || "",
          type: quotation.projectType || "on-demand",
          duration: quotation.projectDuration || ""
        },
        analysisType: quotation.analysisType ||"standard",
        mentionsVolume: quotation.mentionsVolume || "medium",
        countriesCovered: quotation.countriesCovered || "1",
        clientEngagement: quotation.clientEngagement || "medium",
        template: templateData,
        complexity: (templateData?.complexity as 'basic' | 'medium' | 'high') || 'basic',
        teamMembers: optimizedTeamMembers,
        deliverables: [],
        additionalDeliverableCost: 0,
        financials: {
          platformCost: Number(quotation.platformCost || 0),
          deviationPercentage: Number(quotation.deviationPercentage || 0),
          discount: Number(quotation.discountPercentage || 0),
          // Calculate marginFactor and marginPercentage from saved values
          marginFactor: quotation.markupAmount && quotation.baseCost ? 
            1 + (quotation.markupAmount / (quotation.baseCost + (quotation.complexityAdjustment || 0))) : 2.0,
          marginPercentage: quotation.markupAmount && quotation.baseCost ? 
            ((quotation.markupAmount / (quotation.baseCost + (quotation.complexityAdjustment || 0))) * 100) : 100,
          discountPercentage: Number(quotation.discountPercentage || 0),
          // Nuevos campos cargados de la base de datos
          toolsCost: Number(quotation.toolsCost || 0),
          priceMode: (quotation.priceMode as 'auto' | 'manual') || 'auto',
          manualPrice: quotation.manualPrice ? Number(quotation.manualPrice) : undefined
        },
        inflation: {
          applyInflationAdjustment: Boolean(quotation.applyInflationAdjustment),
          inflationMethod: quotation.inflationMethod || "manual",
          manualInflationRate: Number(quotation.manualInflationRate || 0),
          projectStartDate: quotation.projectStartDate ? new Date(quotation.projectStartDate).toISOString().split('T')[0] : "",
          quotationCurrency: quotation.quotationCurrency || "USD"
        },
        proposalLink: quotation.proposalLink || undefined
      };

      console.log('📊 Final quotation data to set:', loadedQuotationData);
      setQuotationData(loadedQuotationData);

      // Force recalculation after loading
      setTimeout(() => {
        console.log('🔄 Triggering recalculation after load');
        forceRecalculate();
      }, 100);

    } catch (error) {
      console.error("❌ Error loading quotation:", error);
      throw error;
    }
  }, [forceRecalculate]);

  const saveQuotation = useCallback(async (status: 'draft' | 'pending' | 'approved' | 'rejected' | 'in-negotiation' = 'draft') => {
    try {
      // Validaciones básicas para todos los estados
      if (!quotationData.client?.id) {
        throw new Error("Debe seleccionar un cliente");
      }

      if (!quotationData.project.name?.trim()) {
        throw new Error("Debe ingresar el nombre del proyecto");
      }

      // Para borradores, permitir cotizaciones sin equipo
      if (status !== 'draft' && quotationData.teamMembers.length === 0) {
        throw new Error("Debe agregar al menos un miembro al equipo");
      }

      const quotationPayload = {
        clientId: quotationData.client.id,
        projectName: quotationData.project.name,
        projectType: quotationData.project.type || 'on-demand',
        projectDuration: quotationData.project.duration || '',
        analysisType: quotationData.analysisType || 'standard',
        mentionsVolume: quotationData.mentionsVolume || 'medium',
        countriesCovered: quotationData.countriesCovered || '1',
        clientEngagement: quotationData.clientEngagement || 'medium',
        templateId: quotationData.template?.id || null,
        baseCost: baseCost || 0,
        complexityAdjustment: complexityAdjustment || 0,markupAmount: markupAmount || 0,
        totalAmount: totalAmount || 0,
        platformCost: quotationData.financials.platformCost || 0,
        deviationPercentage: quotationData.financials.deviationPercentage || 0,
        discountPercentage: quotationData.financials.discountPercentage || 0,
        // Nuevos campos para herramientas y pricing manual
        toolsCost: quotationData.financials.toolsCost || 0,
        priceMode: quotationData.financials.priceMode || 'auto',
        manualPrice: quotationData.financials.manualPrice || null,
        applyInflationAdjustment: quotationData.inflation.applyInflationAdjustment || false,
        inflationMethod: quotationData.inflation.inflationMethod || 'manual',
        manualInflationRate: quotationData.inflation.manualInflationRate || 0,
        projectStartDate: quotationData.inflation.projectStartDate ? new Date(quotationData.inflation.projectStartDate) : undefined,
        quotationCurrency: quotationData.inflation.quotationCurrency || 'USD',
        proposalLink: quotationData.proposalLink || null,
        status: status
      };

      console.log('📤 Saving quotation with payload:', quotationPayload);
      console.log('🔍 QuotationData.id value:', quotationData.id);
      console.log('🔍 QuotationData.id type:', typeof quotationData.id);

      // SOLUCIÓN CRÍTICA: Verificar primero si la cotización existe
      let isEditing = false;
      let quotationExists = false;

      if (quotationData.id !== undefined && quotationData.id !== null && quotationData.id > 0) {
        try {
          // Verificar si la cotización realmente existe antes de intentar actualizarla
          console.log(`🔍 Checking if quotation ${quotationData.id} exists...`);
          const existingQuotation = await apiRequest(`/api/quotations/${quotationData.id}`, 'GET');
          if (existingQuotation && existingQuotation.id) {
            quotationExists = true;
            isEditing = true;
            console.log('✅ Quotation exists, will update');
          }
        } catch (checkError) {
          console.warn(`⚠️ Quotation ${quotationData.id} not found, will create new one instead`);
          // Reset the ID in context since the quotation doesn't exist
          setQuotationData(prev => ({ ...prev, id: undefined }));
          isEditing = false;
          quotationExists = false;
        }
      }

      console.log('🔍 Final decision - Is editing:', isEditing, 'Exists:', quotationExists);

      let savedQuotation: any;
      if (isEditing && quotationExists) {
        // Actualizar cotización existente
        console.log(`🔄 Updating existing quotation ID: ${quotationData.id}`);

        // Eliminar miembros del equipo existentes antes de agregar nuevos
        try {
          await apiRequest(`/api/quotation-team/${quotationData.id}`, 'DELETE');
          console.log('🗑️ Existing team members cleared');
        } catch (deleteError) {
          console.warn('⚠️ Could not clear existing team members:', deleteError);
        }

        savedQuotation = await apiRequest(`/api/quotations/${quotationData.id}`, 'PUT', quotationPayload);
        console.log('✅ Quotation updated:', savedQuotation);
      } else {
        // Crear nueva cotización
        console.log('➕ Creating new quotation');
        savedQuotation = await apiRequest('/api/quotations', 'POST', quotationPayload);
        console.log('✅ Quotation created:', savedQuotation);

        // Actualizar el ID en el contexto después de crear
        setQuotationData(prev => ({ ...prev, id: savedQuotation.id }));
      }

      // Save team members with proper validation
      console.log('👥 Saving team members:', quotationData.teamMembers);
      console.log('📊 Total team members to save:', quotationData.teamMembers.length);

      // Verificar si hay miembros para guardar
      if (!quotationData.teamMembers || quotationData.teamMembers.length === 0) {
        console.warn('⚠️ No team members to save!');
        return savedQuotation;
      }

      for (const member of quotationData.teamMembers) {
        // CRITICAL DEBUG - Track roleId through the process
        console.log('🚨 CRITICAL DEBUG - Processing member:', {
          memberId: member.id,
          originalRoleId: member.roleId,
          personnelId: member.personnelId,
          fullMember: member
        });

        // IMPORTANTE: Mantener el personnelId tal como está, incluso si es genérico
        // No convertir a null aquí, dejar que el backend lo maneje si es necesario
        let finalPersonnelId = member.personnelId;
        
        if (finalPersonnelId) {
          const person = personnel.find(p => p.id === finalPersonnelId);
          if (person && person.name.includes('Member')) {
            console.log('⚠️ Detected generic personnel, but keeping ID for storage:', person.name, finalPersonnelId);
          }
        }
        
        const teamMemberPayload = {
          quotationId: savedQuotation.id,
          roleId: member.roleId,
          personnelId: finalPersonnelId, // Use cleaned personnel ID
          hours: member.hours || 0,
          rate: member.rate || 0,
          cost: (member.hours || 0) * (member.rate || 0) // Ensure cost is calculated
        };

        console.log('👤 Saving team member:', teamMemberPayload);
        console.log('🔍 DEBUG - Original member object:', member);
        console.log('🔍 DEBUG - Member roleId type:', typeof member.roleId, 'value:', member.roleId);
        console.log('🚨 CRITICAL - Payload roleId:', teamMemberPayload.roleId);

        try {
          await apiRequest('/api/quotation-team', 'POST', teamMemberPayload);
          console.log('✅ Team member saved successfully');
        } catch (memberError) {
          console.error('❌ Error saving team member:', memberError);
          console.error('❌ Failed payload:', teamMemberPayload);
          // Continue saving other members even if one fails
        }
      }

      // Track successful quotation completion for draft management
      if (status !== 'draft') {
        localStorage.setItem('last-quotation-status', status);
        // Clear draft when quotation is successfully completed
        localStorage.removeItem('draft-quotation');
        localStorage.removeItem('draft-quotation-backup');
        localStorage.removeItem('pending-draft-restore');
        console.log(`✅ Quotation completed with status: ${status}, drafts cleared`);
      }

      console.log('🎉 Quotation and team saved successfully');
      return savedQuotation;
    } catch (error) {
      console.error("❌ Error saving quotation:", error);
      throw error;
    }
  }, [quotationData, baseCost, complexityAdjustment, markupAmount, totalAmount]);

  const calculateTotalCost = useCallback(() => {
    console.log('🔄 Manual recalculation triggered');
    forceRecalculate();
  }, [forceRecalculate]);

  const resetQuotation = useCallback(() => {
    setQuotationData(initialQuotationData);
    setBaseCost(0);
    setComplexityAdjustment(0);
    setMarkupAmount(0);
    setTotalAmount(0);
    setCurrentStep(1);
  }, []);

  const setQuotationDataDirect = useCallback((data: QuotationData) => {
    setQuotationData(data);
    forceRecalculate();
  }, [forceRecalculate]);

  const updateDeliverables = useCallback((deliverables: any[]) => {
    setQuotationData(prev => ({ ...prev, deliverables }));
  }, []);

  const addDeliverable = useCallback((deliverable: any) => {
    setQuotationData(prev => ({
      ...prev,
      deliverables: [...(prev.deliverables || []), deliverable]
    }));
  }, []);

  const updateDeliverable = useCallback((index: number, deliverable: any) => {
    setQuotationData(prev => ({
      ...prev,
      deliverables: prev.deliverables?.map((item, i) => 
        i === index ? deliverable : item
      ) || []
    }));
  }, []);

  const removeDeliverable = useCallback((index: number) => {
    setQuotationData(prev => ({
      ...prev,
      deliverables: prev.deliverables?.filter((_, i) => i !== index) || []
    }));
  }, []);

  const updateAdditionalDeliverableCost = useCallback((cost: number) => {
    setQuotationData(prev => ({ ...prev, additionalDeliverableCost: cost }));
    forceRecalculate();
  }, [forceRecalculate]);

  const updateInflation = useCallback((inflation: Partial<QuotationData['inflation']>) => {
    setQuotationData(prev => ({
      ...prev,
      inflation: { ...prev.inflation, ...inflation }
    }));
    forceRecalculate();
  }, [forceRecalculate]);

  // Nuevas funciones para herramientas y pricing manual
  const updateToolsCost = useCallback((cost: number) => {
    console.log('🔧 Updating tools cost:', cost);
    setQuotationData(prev => ({
      ...prev,
      financials: { ...prev.financials, toolsCost: cost }
    }));
    forceRecalculate();
  }, [forceRecalculate]);

  const updatePriceMode = useCallback((mode: 'auto' | 'manual') => {
    console.log('💰 Updating price mode:', mode);
    setQuotationData(prev => ({
      ...prev,
      financials: { 
        ...prev.financials, 
        priceMode: mode,
        // Limpiar precio manual si volvemos a modo automático
        manualPrice: mode === 'auto' ? undefined : prev.financials.manualPrice
      }
    }));
    forceRecalculate();
  }, [forceRecalculate]);

  const updateManualPrice = useCallback((price: number) => {
    console.log('✏️ Updating manual price:', price);
    setQuotationData(prev => ({
      ...prev,
      financials: { ...prev.financials, manualPrice: price }
    }));
    forceRecalculate();
  }, [forceRecalculate]);

  const loadRoles = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
  }, [queryClient]);

  const loadPersonnel = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });
  }, [queryClient]);

  // General update function for any quotation data field
  const updateQuotationData = useCallback((data: Partial<QuotationData>) => {
    console.log('📝 Updating quotation data:', data);
    setQuotationData(prev => ({ ...prev, ...data }));
    // Only recalculate if financial-related fields are updated
    const needsRecalc = data.teamMembers || data.financials || data.inflation || 
                       data.complexity || data.analysisType || data.mentionsVolume || 
                       data.countriesCovered || data.clientEngagement;
    if (needsRecalc) {
      forceRecalculate();
    }
  }, [forceRecalculate]);

  const value = {
    quotationData,
    baseCost,
    complexityAdjustment,
    markupAmount,
    totalAmount,
    complexityFactors,
    availableRoles: roles,
    availablePersonnel: personnel,
    recommendedRoleIds,
    currentStep,
    nextStep,
    previousStep,
    goToStep,
    updateClient,
    updateProjectName,
    updateProjectType,
    updateProjectDuration,
    updateAnalysisType,
    updateMentionsVolume,
    updateCountriesCovered,
    updateClientEngagement,
    updateTemplate,
    updateComplexity,
    updateTeamMembers,
    addTeamMember,
    updateTeamMember,
    removeTeamMember,
    updateFinancials,
    updateInflation,
    loadQuotation,
    saveQuotation,
    calculateTotalCost,
    resetQuotation,
    setQuotationData: setQuotationDataDirect,
    loadRoles,
    loadPersonnel,
    forceRecalculate,
    updateDeliverables,
    addDeliverable,
    updateDeliverable,
    removeDeliverable,
    updateAdditionalDeliverableCost,
    // Nuevas funciones para herramientas y pricing manual
    updateToolsCost,
    updatePriceMode,
    updateManualPrice,
    // General update function
    updateQuotationData
  };

  return (
    <OptimizedQuoteContext.Provider value={value}>
      {children}
    </OptimizedQuoteContext.Provider>
  );
};

export { OptimizedQuoteProvider };

export const useOptimizedQuote = () => {
  const context = useContext(OptimizedQuoteContext);
  if (context === undefined) {
    throw new Error("useOptimizedQuote must be used within an OptimizedQuoteProvider");
  }
  return context;
};