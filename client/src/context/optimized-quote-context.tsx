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
  ComplexityFactors
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

export interface QuotationData {
  client: Client | null;
  projectName: string;
  analysisType: string;
  projectType: string;
  mentionsVolume: string;
  countriesCovered: string;
  clientEngagement: string;
  template: ReportTemplate | null;
  complexity: 'basic' | 'medium' | 'high';
  teamMembers: OptimizedTeamMember[];
  financials: {
    platformCost: number;
    deviationPercentage: number;
    discount: number;
    marginFactor: number;
  };
}

interface OptimizedQuoteContextType {
  quotationData: QuotationData;
  baseCost: number;
  complexityAdjustment: number;
  markupAmount: number;
  totalAmount: number;
  complexityFactors: ComplexityFactors;
  updateClient: (client: Client | null) => void;
  updateProjectName: (name: string) => void;
  updateAnalysisType: (type: string) => void;
  updateProjectType: (type: string) => void;
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
  loadQuotation: (quotationId: number) => Promise<void>;
  calculateTotalCost: () => void;
  resetQuotation: () => void;
}

const OptimizedQuoteContext = createContext<OptimizedQuoteContextType | undefined>(undefined);

const initialQuotationData: QuotationData = {
  client: null,
  projectName: "",
  analysisType: "",
  projectType: "",
  mentionsVolume: "",
  countriesCovered: "",
  clientEngagement: "",
  template: null,
  complexity: 'basic',
  teamMembers: [],
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

  const queryClient = useQueryClient();

  // Get data from queries
  const { data: roles } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });

  const { data: personnel } = useQuery<Personnel[]>({
    queryKey: ["/api/personnel"],
  });

  // Calculate complexity factors
  const complexityFactors = useMemo((): ComplexityFactors => {
    return {
      analysisTypeFactor: getAnalysisTypeFactor(quotationData.analysisType),
      mentionsVolumeFactor: getMentionsVolumeFactor(quotationData.mentionsVolume),
      countriesFactor: getCountriesFactor(quotationData.countriesCovered),
      clientEngagementFactor: getClientEngagementFactor(quotationData.clientEngagement),
      templateFactor: quotationData.template ? 
                     getTemplateFactor(quotationData.template.complexity) :
                     (quotationData.complexity === 'high' ? 0.20 : 
                      quotationData.complexity === 'medium' ? 0.10 : 0)
    };
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
    const teamBaseCost = quotationData.teamMembers.reduce((total, member) => {
      return total + (member.cost || 0);
    }, 0);

    const templateCost = quotationData.template?.baseCost || 0;
    const totalBaseCost = teamBaseCost + templateCost;

    setBaseCost(totalBaseCost);
  }, [quotationData.teamMembers, quotationData.template]);

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
      const marginMultiplier = quotationData.financials.marginFactor || 2.0;

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

  // Context methods
  const updateClient = useCallback((client: Client | null) => {
    setQuotationData(prev => ({ ...prev, client }));
  }, []);

  const updateProjectName = useCallback((projectName: string) => {
    setQuotationData(prev => ({ ...prev, projectName }));
  }, []);

  const updateAnalysisType = useCallback((analysisType: string) => {
    setQuotationData(prev => ({ ...prev, analysisType }));
  }, []);

  const updateProjectType = useCallback((projectType: string) => {
    setQuotationData(prev => ({ ...prev, projectType }));
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
    const newMember: OptimizedTeamMember = {
      ...member,
      id: `member-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    setQuotationData(prev => ({
      ...prev,
      teamMembers: [...prev.teamMembers, newMember]
    }));
  }, []);

  const updateTeamMember = useCallback((id: string, updates: Partial<OptimizedTeamMember>) => {
    setQuotationData(prev => ({
      ...prev,
      teamMembers: prev.teamMembers.map(member =>
        member.id === id ? { ...member, ...updates } : member
      )
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
      // Load quotation data
      const quotation: Quotation = await apiRequest(`/api/quotations/${quotationId}`);

      // Load team members
      const teamMembers = await apiRequest(`/api/quotation-team/${quotationId}`);

      // Convert team members to OptimizedTeamMember format
      const optimizedTeamMembers: OptimizedTeamMember[] = teamMembers.map((member: any) => ({
        id: `member-${member.id}`,
        roleId: member.roleId,
        personnelId: member.personnelId,
        hours: member.hours,
        rate: member.rate,
        cost: member.hours * member.rate
      }));

      // Update quotation data
      setQuotationData({
        client: quotation.client || null,
        projectName: quotation.projectName || "",
        analysisType: quotation.analysisType || "",
        projectType: quotation.projectType || "",
        mentionsVolume: quotation.mentionsVolume || "",
        countriesCovered: quotation.countriesCovered || "",
        clientEngagement: quotation.clientEngagement || "",
        template: quotation.reportTemplate || null,
        complexity: (quotation.reportTemplate?.complexity as 'basic' | 'medium' | 'high') || 'basic',
        teamMembers: optimizedTeamMembers,
        financials: {
          platformCost: quotation.platformCost || 0,
          deviationPercentage: quotation.deviationPercentage || 0,
          discount: quotation.discount || 0,
          marginFactor: quotation.marginFactor || 2.0
        }
      });

      console.log("Quotation loaded successfully:", quotation);
    } catch (error) {
      console.error("Error loading quotation:", error);
    }
  }, []);

  const calculateTotalCost = useCallback(() => {
    // This will be triggered by the useEffect hooks
    // Just force a recalculation by updating the team members
    setQuotationData(prev => ({ ...prev, teamMembers: [...prev.teamMembers] }));
  }, []);

  const resetQuotation = useCallback(() => {
    setQuotationData(initialQuotationData);
    setBaseCost(0);
    setComplexityAdjustment(0);
    setMarkupAmount(0);
    setTotalAmount(0);
  }, []);

  const value = {
    quotationData,
    baseCost,
    complexityAdjustment,
    markupAmount,
    totalAmount,
    complexityFactors,
    updateClient,
    updateProjectName,
    updateAnalysisType,
    updateProjectType,
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
    calculateTotalCost,
    resetQuotation
  };

  return (
    <OptimizedQuoteContext.Provider value={value}>
      {children}
    </OptimizedQuoteContext.Provider>
  );
};

export const useOptimizedQuote = () => {
  const context = useContext(OptimizedQuoteContext);
  if (context === undefined) {
    throw new Error("useOptimizedQuote must be used within an OptimizedQuoteProvider");
  }
  return context;
};