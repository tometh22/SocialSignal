
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

  // Calculate complexity factors
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
                     (quotationData.complexity === 'high' ? 0.20 : 
                      quotationData.complexity === 'medium' ? 0.10 : 0)
    };

    console.log('📊 Calculated complexity factors:', factors);
    
    const totalFactor = Object.values(factors).reduce((sum, factor) => sum + (factor || 0), 0);
    console.log(`🎯 Total complexity factor: ${totalFactor} (${(totalFactor * 100).toFixed(1)}%)`);
    
    if (totalFactor === 0) {
      console.warn('⚠️ WARNING: Total complexity factor is 0! This means no additional costs will be applied.');
    }

    return factors;
  }, [
    quotationData.analysisType, 
    quotationData.mentionsVolume, 
    quotationData.countriesCovered, 
    quotationData.clientEngagement, 
    quotationData.template, 
    quotationData.complexity
  ]);

  // Calculate base cost from team members
  useEffect(() => {
    console.log('💰 === BASE COST CALCULATION ===');
    console.log('🧑‍💼 Team members:', quotationData.teamMembers);
    console.log('📋 Template:', quotationData.template);
    console.log('📦 Additional deliverable cost:', quotationData.additionalDeliverableCost);
    
    const teamBaseCost = quotationData.teamMembers.reduce((total, member) => {
      const memberCost = (member.hours || 0) * (member.rate || 0);
      console.log(`👤 Member ${member.id}: ${member.hours} hours × $${member.rate} = $${memberCost}`);
      return total + memberCost;
    }, 0);

    const templateCost = quotationData.template?.baseCost || 0;
    const deliverableCost = quotationData.additionalDeliverableCost || 0;
    const totalBaseCost = teamBaseCost + templateCost + deliverableCost;

    console.log('💰 Base cost breakdown:', { 
      teamBaseCost: `$${teamBaseCost}`, 
      templateCost: `$${templateCost}`, 
      deliverableCost: `$${deliverableCost}`, 
      totalBaseCost: `$${totalBaseCost}` 
    });
    
    if (totalBaseCost === 0) {
      console.warn('⚠️ WARNING: Total base cost is $0! Check team members and template configuration.');
    }
    
    setBaseCost(totalBaseCost);
  }, [quotationData.teamMembers, quotationData.template, quotationData.additionalDeliverableCost]);

  // Calculate complexity adjustment
  useEffect(() => {
    if (baseCost > 0) {
      const adjustment = calculateComplexityAdjustment(baseCost, complexityFactors);
      setComplexityAdjustment(adjustment);
    } else {
      setComplexityAdjustment(0);
    }
  }, [baseCost, complexityFactors]);

  // Calculate markup and total
  useEffect(() => {
    if (baseCost > 0) {
      const baseWithComplexity = baseCost + complexityAdjustment;
      const platformCostAmount = quotationData.financials.platformCost || 0;
      const deviationAmount = baseWithComplexity * ((quotationData.financials.deviationPercentage || 0) / 100);

      // Calculate markup
      const markup = calculateMarkup(baseWithComplexity);
      setMarkupAmount(markup);

      // Calculate total
      const total = calculateTotalAmount(
        baseCost,
        complexityAdjustment,
        markup,
        platformCostAmount,
        deviationAmount
      );

      const discountAmount = total * ((quotationData.financials.discount || 0) / 100);
      setTotalAmount(total - discountAmount);
    } else {
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

  const updateProjectDuration = useCallback((duration: string) => {
    setQuotationData(prev => ({ 
      ...prev, 
      project: { ...prev.project, duration: duration }
    }));
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

  const updateTemplate = useCallback((template: ReportTemplate | null) => {
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
  }, []);

  const updateComplexity = useCallback((complexity: 'basic' | 'medium' | 'high') => {
    setQuotationData(prev => ({ ...prev, complexity }));
  }, []);

  const updateTeamMembers = useCallback((teamMembers: OptimizedTeamMember[]) => {
    setQuotationData(prev => ({ ...prev, teamMembers }));
  }, []);

  const addTeamMember = useCallback((member: Omit<OptimizedTeamMember, "id">) => {
    const hours = member.hours || 40; // Default to 40 hours if not specified
    const rate = member.rate || 50; // Default to $50/hour if not specified
    
    const newMember: OptimizedTeamMember = {
      ...member,
      id: `member-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      hours,
      rate,
      cost: hours * rate
    };
    
    console.log('➕ Adding new team member:', newMember);
    console.log(`💵 Member cost: ${hours} hours × $${rate} = $${newMember.cost}`);
    
    setQuotationData(prev => ({
      ...prev,
      teamMembers: [...prev.teamMembers, newMember]
    }));
  }, []);

  const updateTeamMember = useCallback((id: string, updates: Partial<OptimizedTeamMember>) => {
    setQuotationData(prev => ({
      ...prev,
      teamMembers: prev.teamMembers.map(member => {
        if (member.id === id) {
          const updatedMember = { ...member, ...updates };
          // Recalcular el costo cuando se actualizan horas o rate
          if ('hours' in updates || 'rate' in updates) {
            updatedMember.cost = (updatedMember.hours || 0) * (updatedMember.rate || 0);
          }
          console.log('Updated team member:', updatedMember);
          return updatedMember;
        }
        return member;
      })
    }));
  }, []);

  const removeTeamMember = useCallback((id: string) => {
    setQuotationData(prev => ({
      ...prev,
      teamMembers: prev.teamMembers.filter(member => member.id !== id)
    }));
  }, []);

  const updateFinancials = useCallback((financials: Partial<QuotationData['financials']>) => {
    setQuotationData(prev => ({
      ...prev,
      financials: { ...prev.financials, ...financials }
    }));
  }, []);

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
        analysisType: quotation.analysisType || "",
        mentionsVolume: quotation.mentionsVolume || "",
        countriesCovered: quotation.countriesCovered || "",
        clientEngagement: quotation.clientEngagement || "",
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
    } catch (error) {
      console.error("Error loading quotation:", error);
    }
  }, []);

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
    console.log('calculateTotalCost called');
    setQuotationData(prev => {
      const updatedMembers = prev.teamMembers.map(member => ({
        ...member,
        cost: (member.hours || 0) * (member.rate || 0)
      }));
      
      console.log('Updated team members:', updatedMembers);
      
      return { 
        ...prev, 
        teamMembers: updatedMembers
      };
    });
  }, []);

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
  }, []);

  const loadRoles = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
  }, [queryClient]);

  const loadPersonnel = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });
  }, [queryClient]);

  // Diagnostic function
  const runDiagnostic = useCallback(() => {
    console.log('🔍 === QUOTATION DIAGNOSTIC ===');
    console.log('📊 Current quotation data:', quotationData);
    console.log('💰 Financial summary:', {
      baseCost: `$${baseCost}`,
      complexityAdjustment: `$${complexityAdjustment}`,
      markupAmount: `$${markupAmount}`,
      totalAmount: `$${totalAmount}`
    });
    console.log('🧮 Complexity factors:', complexityFactors);
    console.log('👥 Team members:', quotationData.teamMembers);
    console.log('📋 Selected template:', quotationData.template);
    console.log('🎯 Available roles:', roles.length);
    console.log('👤 Available personnel:', personnel.length);
    
    // Check for potential issues
    const issues = [];
    if (quotationData.teamMembers.length === 0) issues.push('❌ No team members configured');
    if (baseCost === 0) issues.push('❌ Base cost is $0');
    if (Object.values(complexityFactors).every(f => f === 0)) issues.push('❌ All complexity factors are 0');
    if (!quotationData.template) issues.push('⚠️ No template selected');
    
    if (issues.length > 0) {
      console.warn('🚨 Issues found:', issues);
    } else {
      console.log('✅ All checks passed!');
    }
    
    return {
      quotationData,
      baseCost,
      complexityAdjustment,
      markupAmount,
      totalAmount,
      complexityFactors,
      issues
    };
  }, [quotationData, baseCost, complexityAdjustment, markupAmount, totalAmount, complexityFactors, roles, personnel]);

  // Expose diagnostic function globally for debugging
  useEffect(() => {
    (window as any).quotationDiagnostic = runDiagnostic;
    return () => {
      delete (window as any).quotationDiagnostic;
    };
  }, [runDiagnostic]);

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
    updateDeliverables,
    addDeliverable,
    updateDeliverable,
    removeDeliverable,
    updateAdditionalDeliverableCost,
    runDiagnostic
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
