
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
}

export interface ComplexityFactors {
  analysisTypeFactor: number;
  mentionsVolumeFactor: number;
  countriesFactor: number;
  clientEngagementFactor: number;
}

export interface QuotationData {
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
  financials: {
    platformCost: number;
    deviationPercentage: number;
    discount: number;
    marginFactor: number;
  };
  inflation: {
    applyInflationAdjustment: boolean;
    inflationMethod: string;
    manualInflationRate: number;
    projectStartDate: string;
    quotationCurrency: string;
  };
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
  
  // Actions
  loadQuotation: (quotationId: number) => Promise<void>;
  saveQuotation: () => Promise<void>;
  calculateTotalCost: () => void;
  resetQuotation: () => void;
  loadRoles: () => void;
  loadPersonnel: () => void;
  forceRecalculate: () => void;
  
  // Deliverables
  updateDeliverables: (deliverables: any[]) => void;
  addDeliverable: (deliverable: any) => void;
  updateDeliverable: (index: number, deliverable: any) => void;
  removeDeliverable: (index: number) => void;
  updateAdditionalDeliverableCost: (cost: number) => void;
}

const OptimizedQuoteContext = createContext<OptimizedQuoteContextType | undefined>(undefined);

const initialQuotationData: QuotationData = {
  client: null,
  project: {
    name: "",
    type: "one-time"
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
    marginFactor: 2.0
  },
  inflation: {
    applyInflationAdjustment: false,
    inflationMethod: "automatic",
    manualInflationRate: 0,
    projectStartDate: "",
    quotationCurrency: "ARS"
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

export const OptimizedQuoteProvider: React.FC<OptimizedQuoteProviderProps> = ({ children, quotationId, isRequote }) => {
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

  // Force recalculation function
  const forceRecalculate = useCallback(() => {
    console.log('🔄 Force recalculation triggered');
    setRecalculationTrigger(prev => prev + 1);
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

  // Calculate costs properly with debugging
  useEffect(() => {
    console.log('💰 === COST CALCULATION START ===');
    console.log('📊 Input data:', {
      teamMembers: quotationData.teamMembers.length,
      template: quotationData.template?.name,
      financials: quotationData.financials
    });

    // Don't calculate if no team members
    if (!quotationData.teamMembers.length) {
      console.log('⚠️ No team members, setting costs to 0');
      setBaseCost(0);
      setComplexityAdjustment(0);
      setMarkupAmount(0);
      setTotalAmount(0);
      return;
    }

    // Step 1: Calculate base team cost
    const teamBaseCost = quotationData.teamMembers.reduce((total, member) => {
      const memberCost = (member.hours || 0) * (member.rate || 0);
      console.log(`👤 Member cost: ${member.hours}h × $${member.rate} = $${memberCost}`);
      return total + memberCost;
    }, 0);
    
    console.log(`👥 Total team base cost: $${teamBaseCost}`);

    // Step 2: Calculate complexity adjustments
    let totalComplexityAdjustment = 0;
    quotationData.teamMembers.forEach(member => {
      const baseHours = member.hours || 0;
      const hourlyRate = member.rate || 0;
      const baseCost = baseHours * hourlyRate;
      let memberComplexityFactor = 0;
      
      // Get role information
      const role = roles.find(r => r.id === member.roleId);
      const roleName = role?.name?.toLowerCase() || '';
      
      // Apply complexity factors based on role types
      if (roleName.includes('analista') || roleName.includes('data specialist') || roleName.includes('tech lead')) {
        memberComplexityFactor += complexityFactors.countriesFactor;
        memberComplexityFactor += complexityFactors.mentionsVolumeFactor;
        memberComplexityFactor += complexityFactors.analysisTypeFactor;
      }
      else if (roleName.includes('manager') || roleName.includes('director') || 
               roleName.includes('ceo') || roleName.includes('coo') || 
               roleName.includes('operations lead') || roleName.includes('account')) {
        memberComplexityFactor += complexityFactors.clientEngagementFactor;
        memberComplexityFactor += complexityFactors.analysisTypeFactor * 0.5;
      }
      else {
        memberComplexityFactor = complexityFactors.analysisTypeFactor * 0.3;
      }
      
      const adjustedHours = baseHours * (1 + memberComplexityFactor);
      const adjustedMemberCost = adjustedHours * hourlyRate;
      const memberAdjustment = adjustedMemberCost - baseCost;
      
      totalComplexityAdjustment += memberAdjustment;
      console.log(`🔧 ${roleName}: factor ${memberComplexityFactor.toFixed(3)} → adjustment $${memberAdjustment.toFixed(2)}`);
    });

    // Step 3: Add template cost
    const templateCost = quotationData.template?.baseCost || 0;
    console.log(`📋 Template cost: $${templateCost}`);
    
    // Step 4: Calculate final costs
    const newBaseCost = teamBaseCost + templateCost;
    const adjustedBaseCost = newBaseCost + totalComplexityAdjustment;
    
    console.log(`💵 Base cost: $${newBaseCost}`);
    console.log(`⚡ Complexity adjustment: $${totalComplexityAdjustment}`);
    console.log(`📈 Adjusted base cost: $${adjustedBaseCost}`);
    
    // Step 5: Apply business factors
    const platformCost = quotationData.financials.platformCost || 0;
    const marginMultiplier = quotationData.financials.marginFactor || 2.0;
    const subtotal = (adjustedBaseCost + platformCost) * marginMultiplier;
    const discount = subtotal * ((quotationData.financials.discount || 0) / 100);
    const finalTotal = subtotal - discount;
    
    console.log(`🏢 Platform cost: $${platformCost}`);
    console.log(`📊 Margin factor: ${marginMultiplier}x`);
    console.log(`💰 Subtotal: $${subtotal}`);
    console.log(`💸 Discount: $${discount}`);
    console.log(`🎯 Final total: $${finalTotal}`);
    
    // Update states
    setBaseCost(newBaseCost);
    setComplexityAdjustment(totalComplexityAdjustment);
    setMarkupAmount(subtotal - adjustedBaseCost - platformCost);
    setTotalAmount(finalTotal);
    
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
      const quotation: any = await apiRequest(`/api/quotations/${quotationId}`, 'GET');
      const teamMembers = await apiRequest(`/api/quotation-team/${quotationId}`, 'GET');

      const optimizedTeamMembers: OptimizedTeamMember[] = teamMembers.map((member: any) => ({
        id: `member-${member.id}`,
        roleId: member.roleId,
        personnelId: member.personnelId,
        hours: member.hours,
        rate: member.rate,
        cost: member.hours * member.rate
      }));

      // Get client data separately
      const clientData = quotation.clientId ? await apiRequest(`/api/clients/${quotation.clientId}`, 'GET') : null;
      
      setQuotationData({
        client: clientData,
        project: {
          name: quotation.projectName || "",
          type: quotation.projectType || "one-time"
        },
        analysisType: quotation.analysisType || "standard",
        mentionsVolume: quotation.mentionsVolume || "medium",
        countriesCovered: quotation.countriesCovered || "1",
        clientEngagement: quotation.clientEngagement || "medium",
        template: null, // Will be loaded separately if needed
        complexity: 'basic',
        teamMembers: optimizedTeamMembers,
        deliverables: [],
        additionalDeliverableCost: 0,
        financials: {
          platformCost: quotation.platformCost || 0,
          deviationPercentage: quotation.deviationPercentage || 0,
          discount: 0,
          marginFactor: 2.0
        },
        inflation: {
          applyInflationAdjustment: quotation.applyInflationAdjustment || false,
          inflationMethod: quotation.inflationMethod || "automatic",
          manualInflationRate: quotation.manualInflationRate || 0,
          projectStartDate: quotation.projectStartDate ? new Date(quotation.projectStartDate).toISOString().split('T')[0] : "",
          quotationCurrency: quotation.quotationCurrency || "ARS"
        }
      });
      
      forceRecalculate();
    } catch (error) {
      console.error("Error loading quotation:", error);
    }
  }, [forceRecalculate]);

  const saveQuotation = useCallback(async () => {
    try {
      const quotationPayload = {
        clientId: quotationData.client?.id,
        projectName: quotationData.project.name,
        projectType: quotationData.project.type,
        analysisType: quotationData.analysisType,
        mentionsVolume: quotationData.mentionsVolume,
        countriesCovered: quotationData.countriesCovered,
        clientEngagement: quotationData.clientEngagement,
        templateId: quotationData.template?.id,
        baseCost,
        complexityAdjustment,
        markupAmount,
        totalAmount,
        platformCost: quotationData.financials.platformCost,
        deviationPercentage: quotationData.financials.deviationPercentage,
        discountPercentage: quotationData.financials.discount,
        status: 'draft'
      };

      const savedQuotation = await apiRequest('/api/quotations', 'POST', quotationPayload);
      
      // Save team members
      for (const member of quotationData.teamMembers) {
        await apiRequest('/api/quotation-team', 'POST', {
          quotationId: savedQuotation.id,
          roleId: member.roleId,
          personnelId: member.personnelId,
          hours: member.hours,
          rate: member.rate
        });
      }

      return savedQuotation;
    } catch (error) {
      console.error("Error saving quotation:", error);
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

  const loadRoles = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
  }, [queryClient]);

  const loadPersonnel = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });
  }, [queryClient]);

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
    loadRoles,
    loadPersonnel,
    forceRecalculate,
    updateDeliverables,
    addDeliverable,
    updateDeliverable,
    removeDeliverable,
    updateAdditionalDeliverableCost
  };

  return (
    <OptimizedQuoteContext.Provider value={value}>
      {children}
    </OptimizedQuoteContext.Provider>
  );
};

export function useOptimizedQuote() {
  const context = useContext(OptimizedQuoteContext);
  if (context === undefined) {
    throw new Error("useOptimizedQuote must be used within an OptimizedQuoteProvider");
  }
  return context;
}
