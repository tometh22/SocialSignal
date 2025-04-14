import React, { createContext, useContext, useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { useQuery } from "@tanstack/react-query";
import { ReportTemplate } from "@shared/schema";
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

export interface TeamMember {
  id: string;
  roleId: number;
  personnelId: number | null;
  hours: number;
  rate: number;
  cost: number;
}

interface ProjectDetails {
  clientId?: number;
  projectName?: string;
  analysisType?: string;
  projectType?: string;
  mentionsVolume?: string;
  countriesCovered?: string;
  clientEngagement?: string;
}

interface QuotationData {
  analysisType: string;
  projectType: string;
  mentionsVolume: string;
  countriesCovered: string;
  clientEngagement: string;
  templateComplexity: string;
}

interface QuoteContextType {
  projectDetails: ProjectDetails;
  teamMembers: TeamMember[];
  selectedTemplateId: number | null;
  templateCustomization: string | null;
  baseCost: number;
  complexityAdjustment: number;
  markupAmount: number;
  totalAmount: number;
  complexityFactors: ComplexityFactors;
  quotationData: QuotationData;
  quoteOption: "roles" | "team";
  updateProjectDetails: (details: Partial<ProjectDetails>) => void;
  addTeamMember: (member: Omit<TeamMember, "id">) => void;
  updateTeamMember: (id: string, member: TeamMember) => void;
  removeTeamMember: (id: string) => void;
  updateReportTemplate: (templateId: number) => void;
  updateTemplateCustomization: (customization: string) => void;
  updateQuoteOption: (option: "roles" | "team") => void;
  analyzeInputs: () => void;
  calculateBaseCost: () => void;
  calculateTotalCost: () => void;
}

const QuoteContext = createContext<QuoteContextType | undefined>(undefined);

export const QuoteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Project details
  const [projectDetails, setProjectDetails] = useState<ProjectDetails>({});
  
  // Team members
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  
  // Quote option
  const [quoteOption, setQuoteOption] = useState<"roles" | "team">("roles");
  
  // Report template
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [templateCustomization, setTemplateCustomization] = useState<string | null>(null);
  
  // Cost calculation
  const [baseCost, setBaseCost] = useState(0);
  const [complexityAdjustment, setComplexityAdjustment] = useState(0);
  const [markupAmount, setMarkupAmount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  
  // Complexity factors
  const [complexityFactors, setComplexityFactors] = useState<ComplexityFactors>({
    analysisTypeFactor: 0,
    mentionsVolumeFactor: 0,
    countriesFactor: 0,
    clientEngagementFactor: 0,
    templateFactor: 0
  });
  
  // Quotation data for calculation
  const [quotationData, setQuotationData] = useState<QuotationData>({
    analysisType: "",
    projectType: "",
    mentionsVolume: "",
    countriesCovered: "",
    clientEngagement: "",
    templateComplexity: ""
  });

  // Get template info
  const { data: templates } = useQuery<ReportTemplate[]>({
    queryKey: ["/api/templates"],
  });

  // Project details update
  const updateProjectDetails = useCallback((details: Partial<ProjectDetails>) => {
    setProjectDetails(prev => ({ ...prev, ...details }));
  }, []);

  // Team members operations
  const addTeamMember = useCallback((member: Omit<TeamMember, "id">) => {
    const newMember: TeamMember = {
      ...member,
      id: uuidv4()
    };
    setTeamMembers(prev => [...prev, newMember]);
  }, []);

  const updateTeamMember = useCallback((id: string, member: TeamMember) => {
    setTeamMembers(prev => prev.map(m => m.id === id ? member : m));
  }, []);

  const removeTeamMember = useCallback((id: string) => {
    setTeamMembers(prev => prev.filter(m => m.id !== id));
  }, []);

  // Report template operations
  const updateReportTemplate = useCallback((templateId: number) => {
    setSelectedTemplateId(templateId);
    
    // Update template complexity factor
    if (templates) {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        const templateFactor = getTemplateFactor(template.complexity);
        setComplexityFactors(prev => ({
          ...prev,
          templateFactor
        }));
        setQuotationData(prev => ({
          ...prev,
          templateComplexity: template.complexity
        }));
      }
    }
  }, [templates]);

  const updateTemplateCustomization = useCallback((customization: string) => {
    setTemplateCustomization(customization);
  }, []);
  
  // Update quote option
  const updateQuoteOption = useCallback((option: "roles" | "team") => {
    setQuoteOption(option);
    
    // Al cambiar la opción, reseteamos el equipo para empezar de nuevo
    setTeamMembers([]);
    
    // Cuando cambiamos a opción por equipo, debemos reflejar correctamente
    // que se usarán tarifas personalizadas por miembro en lugar de tarifas estándar
    if (option === "team") {
      console.log("Cambiando a cotización por miembros específicos");
    } else {
      console.log("Cambiando a cotización por roles estándar");
    }
  }, []);

  // Analyze inputs to determine complexity factors
  const analyzeInputs = useCallback(() => {
    if (
      projectDetails.analysisType &&
      projectDetails.mentionsVolume &&
      projectDetails.countriesCovered &&
      projectDetails.clientEngagement
    ) {
      const analysisTypeFactor = getAnalysisTypeFactor(projectDetails.analysisType);
      const mentionsVolumeFactor = getMentionsVolumeFactor(projectDetails.mentionsVolume);
      const countriesFactor = getCountriesFactor(projectDetails.countriesCovered);
      const clientEngagementFactor = getClientEngagementFactor(projectDetails.clientEngagement);
      
      setComplexityFactors(prev => ({
        ...prev,
        analysisTypeFactor,
        mentionsVolumeFactor,
        countriesFactor,
        clientEngagementFactor
      }));
      
      setQuotationData({
        analysisType: projectDetails.analysisType,
        projectType: projectDetails.projectType || "",
        mentionsVolume: projectDetails.mentionsVolume,
        countriesCovered: projectDetails.countriesCovered,
        clientEngagement: projectDetails.clientEngagement,
        templateComplexity: quotationData.templateComplexity
      });
    }
  }, [
    projectDetails.analysisType,
    projectDetails.mentionsVolume,
    projectDetails.countriesCovered,
    projectDetails.clientEngagement,
    projectDetails.projectType,
    quotationData.templateComplexity
  ]);

  // Calculate base cost from team members
  const calculateBaseCost = useCallback(() => {
    const total = teamMembers.reduce((sum, member) => sum + member.cost, 0);
    setBaseCost(total);
    return total;
  }, [teamMembers]);

  // Calculate total cost with complexity adjustments and markup
  const calculateTotalCost = useCallback(() => {
    // Calculate base cost from team members
    const baseTeamCost = calculateBaseCost();
    
    // Calculate complexity adjustment
    const complexityAdj = calculateComplexityAdjustment(baseTeamCost, complexityFactors);
    setComplexityAdjustment(complexityAdj);
    
    // Calculate markup (minimum 2x)
    const adjusted = baseTeamCost + complexityAdj;
    const markup = calculateMarkup(adjusted);
    setMarkupAmount(markup);
    
    // Calculate total
    const total = calculateTotalAmount(baseTeamCost, complexityAdj, markup);
    setTotalAmount(total);
  }, [calculateBaseCost, complexityFactors]);

  const value = {
    projectDetails,
    teamMembers,
    selectedTemplateId,
    templateCustomization,
    baseCost,
    complexityAdjustment,
    markupAmount,
    totalAmount,
    complexityFactors,
    quotationData,
    quoteOption,
    updateProjectDetails,
    addTeamMember,
    updateTeamMember,
    removeTeamMember,
    updateReportTemplate,
    updateTemplateCustomization,
    updateQuoteOption,
    analyzeInputs,
    calculateBaseCost,
    calculateTotalCost
  };

  return <QuoteContext.Provider value={value}>{children}</QuoteContext.Provider>;
};

export const useQuoteContext = () => {
  const context = useContext(QuoteContext);
  if (context === undefined) {
    throw new Error("useQuoteContext must be used within a QuoteProvider");
  }
  return context;
};
