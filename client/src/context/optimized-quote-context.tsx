
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Client, ReportTemplate, Role, Personnel, Quotation } from "@shared/schema";
import {
  getAnalysisTypeFactor,
  getMentionsVolumeFactor,
  getCountriesFactor,
  getClientEngagementFactor,
  getTemplateFactor,
  calculateComplexityAdjustment,
  calculateMarkup,
  calculateTotalAmount,
  ComplexityFactors,
  loadCostMultipliers
} from "@/lib/calculation";
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
  }
};

export const OptimizedQuoteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  const { data: templates = [] } = useQuery<ReportTemplate[]>({
    queryKey: ["/api/report-templates"],
  });

  // Load cost multipliers on mount
  useEffect(() => {
    loadCostMultipliers().catch(console.error);
  }, []);

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
      clientEngagementFactor: getClientEngagementFactor(quotationData.clientEngagement),
      templateFactor: quotationData.template ? 
                     getTemplateFactor(quotationData.template.complexity) :
                     getTemplateFactor(quotationData.complexity)
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

  // Calculate base cost from team members with proper validation
  useEffect(() => {
    console.log('💰 === BASE COST CALCULATION ===');
    console.log('🧑‍💼 Team members:', quotationData.teamMembers);
    
    const teamBaseCost = quotationData.teamMembers.reduce((total, member) => {
      const hours = Number(member.hours) || 0;
      const rate = Number(member.rate) || 0;
      const memberCost = hours * rate;
      
      console.log(`👤 Member ${member.id}: ${hours} hours × $${rate} = $${memberCost}`);
      return total + memberCost;
    }, 0);

    const templateCost = Number(quotationData.template?.baseCost) || 0;
    const deliverableCost = Number(quotationData.additionalDeliverableCost) || 0;
    const totalBaseCost = teamBaseCost + templateCost + deliverableCost;

    console.log('💰 Base cost breakdown:', { 
      teamBaseCost: `$${teamBaseCost}`, 
      templateCost: `$${templateCost}`, 
      deliverableCost: `$${deliverableCost}`, 
      totalBaseCost: `$${totalBaseCost}` 
    });
    
    setBaseCost(totalBaseCost);
  }, [quotationData.teamMembers, quotationData.template, quotationData.additionalDeliverableCost, recalculationTrigger]);

  // Calculate complexity adjustment
  useEffect(() => {
    console.log('🔧 === COMPLEXITY ADJUSTMENT CALCULATION ===');
    console.log('📊 Base cost:', baseCost);
    console.log('📊 Complexity factors:', complexityFactors);
    
    if (baseCost > 0) {
      const adjustment = calculateComplexityAdjustment(baseCost, complexityFactors);
      console.log('📊 Complexity adjustment result:', adjustment);
      setComplexityAdjustment(adjustment);
    } else {
      console.log('⚠️ Base cost is 0, setting complexity adjustment to 0');
      setComplexityAdjustment(0);
    }
  }, [baseCost, complexityFactors]);

  // Calculate markup and total
  useEffect(() => {
    console.log('💵 === MARKUP AND TOTAL CALCULATION ===');
    console.log('📊 Base cost:', baseCost);
    console.log('📊 Complexity adjustment:', complexityAdjustment);
    
    if (baseCost > 0) {
      const baseWithComplexity = baseCost + complexityAdjustment;
      const platformCostAmount = Number(quotationData.financials.platformCost) || 0;
      const deviationAmount = baseWithComplexity * ((Number(quotationData.financials.deviationPercentage) || 0) / 100);

      // Calculate markup
      const markup = calculateMarkup(baseWithComplexity);
      console.log('💰 Markup calculation:', markup);
      setMarkupAmount(markup);

      // Calculate total
      const total = calculateTotalAmount(
        baseCost,
        complexityAdjustment,
        markup,
        platformCostAmount,
        deviationAmount
      );

      const discountAmount = total * ((Number(quotationData.financials.discount) || 0) / 100);
      const finalTotal = total - discountAmount;
      
      console.log('💵 Final total:', finalTotal);
      setTotalAmount(finalTotal);
    } else {
      console.log('⚠️ Base cost is 0, setting markup and total to 0');
      setMarkupAmount(0);
      setTotalAmount(0);
    }
  }, [baseCost, complexityAdjustment, quotationData.financials]);

  // Navigation functions
  const nextStep = useCallback(() => {
    const maxStep = quotationData.project.type === 'always-on' ? 5 : 4;
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
    const maxStep = quotationData.project.type === 'always-on' ? 5 : 4;
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
      const quotation: Quotation = await apiRequest(`/api/quotations/${quotationId}`);
      const teamMembers = await apiRequest(`/api/quotation-team/${quotationId}`);

      const optimizedTeamMembers: OptimizedTeamMember[] = teamMembers.map((member: any) => ({
        id: `member-${member.id}`,
        roleId: member.roleId,
        personnelId: member.personnelId,
        hours: member.hours,
        rate: member.rate,
        cost: member.hours * member.rate
      }));

      setQuotationData({
        client: quotation.client || null,
        project: {
          name: quotation.projectName || "",
          type: quotation.projectType || "one-time"
        },
        analysisType: quotation.analysisType || "standard",
        mentionsVolume: quotation.mentionsVolume || "medium",
        countriesCovered: quotation.countriesCovered || "1",
        clientEngagement: quotation.clientEngagement || "medium",
        template: quotation.reportTemplate || null,
        complexity: (quotation.reportTemplate?.complexity as 'basic' | 'medium' | 'high') || 'basic',
        teamMembers: optimizedTeamMembers,
        deliverables: [],
        additionalDeliverableCost: 0,
        financials: {
          platformCost: quotation.platformCost || 0,
          deviationPercentage: quotation.deviationPercentage || 0,
          discount: quotation.discount || 0,
          marginFactor: quotation.marginFactor || 2.0
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
        discount: quotationData.financials.discount,
        marginFactor: quotationData.financials.marginFactor,
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
