import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Client, ReportTemplate, Role, Personnel, Quotation } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useCurrency } from "@/hooks/use-currency";
import {
  calculateQuotationPricing,
  type QuotationPricingResult,
} from "@shared/utils/quotation-pricing";

export interface OptimizedTeamMember {
  id: string;
  roleId: number;
  personnelId: number | null;
  hours: number;
  rate: number;
  cost: number;
}

export type QuotationVariantPayload = {
  variantName: string;
  variantDescription?: string | null;
  variantOrder: number;
  baseCost: number;
  complexityAdjustment: number;
  markupAmount: number;
  totalAmount: number;
  isSelected: boolean;
};

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
  manualPriceCurrency?: 'ARS' | 'USD';
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
  quotationCurrency: string; // Moneda de cotización ('ARS' | 'USD')
  inflation: {
    applyInflationAdjustment: boolean;
    inflationMethod: string;
    manualInflationRate: number;
    projectStartDate: string;
  rateProjectionMode?: "current" | "annual_avg";
  };
  customization?: string;
  proposalLink?: string; // Link a la propuesta original
  leadId?: number; // Lead CRM de origen (para integración CRM-Cotizaciones)
  exchangeRateSnapshot?: number; // Tipo de cambio al momento de cotizar (snapshot)
  pricingVersion?: number;
  requiresExchangeRateConfirmation?: boolean;
  // Mes histórico (formato 'mmmYYYY', ej. 'aug2025') a usar como tarifa
  // por defecto al agregar personal y al recalcular tarifas. null = "más reciente disponible".
  salaryMonth?: string | null;
}

interface OptimizedQuoteContextType {
  // Data
  quotationData: QuotationData;
  baseCost: number;
  complexityAdjustment: number;
  markupAmount: number;
  totalAmount: number;
  pricingResult: QuotationPricingResult;
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
  updateQuotationCurrency: (currency: string, exchangeRateOverride?: number) => void;
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
  saveQuotation: (
    status?: 'draft' | 'pending' | 'approved' | 'rejected' | 'in-negotiation',
    variants?: QuotationVariantPayload[],
  ) => Promise<any>;
  calculateBaseCost: () => void;
  calculateTotalCost: () => void;
  resetQuotation: () => void;
  setQuotationData: (data: QuotationData) => void;
  loadRoles: () => void;
  loadPersonnel: () => void;
  forceRecalculate: () => void;
  getPersonnelRate: (personnelId: number, targetCurrency?: string, targetMonth?: string | null) => number;
  // Mes histórico a considerar para tarifas al agregar personal a la cotización.
  updateSalaryMonth: (salaryMonth: string | null) => void;
  // Retorna el mes que efectivamente se está usando en modo automático.
  getResolvedSalaryMonth: () => string | null;

  // Deliverables
  updateDeliverables: (deliverables: any[]) => void;
  addDeliverable: (deliverable: any) => void;
  updateDeliverable: (index: number, deliverable: any) => void;
  removeDeliverable: (index: number) => void;
  updateAdditionalDeliverableCost: (cost: number) => void;

  // General update function
  updateQuotationData: (data: Partial<QuotationData>) => void;
  // Templates
  saveAsTemplate: (name: string, description?: string) => Promise<void>;
  loadFromTemplate: (template: any) => void;
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
    manualPrice: undefined,
    manualPriceCurrency: 'ARS',
  },
  quotationCurrency: "ARS", // Siempre en pesos argentinos
  pricingVersion: 2,
  requiresExchangeRateConfirmation: false,
  inflation: {
    applyInflationAdjustment: false,
    inflationMethod: "manual",
    manualInflationRate: 25,
    projectStartDate: "",
    rateProjectionMode: "current"
  },
  salaryMonth: null
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
  const [pricingResult, setPricingResult] = useState<QuotationPricingResult>({
    canonicalARS: { baseCost: 0, complexityAdjustment: 0, markupAmount: 0, toolsCost: 0, platformCost: 0, deviationAmount: 0, discountAmount: 0, total: 0 },
    display: { baseCost: 0, complexityAdjustment: 0, markupAmount: 0, toolsCost: 0, platformCost: 0, deviationAmount: 0, discountAmount: 0, total: 0 },
    displayCurrency: "ARS",
    effectiveMarginFactor: 2,
  });
  const [currentStep, setCurrentStep] = useState(1);
  const [recalculationTrigger, setRecalculationTrigger] = useState(0);

  const queryClient = useQueryClient();
  const { convertToUSD, exchangeRate } = useCurrency();
  const effectiveExchangeRate = quotationData.exchangeRateSnapshot && quotationData.exchangeRateSnapshot > 0
    ? quotationData.exchangeRateSnapshot
    : exchangeRate;

  useEffect(() => {
    if (!quotationData.exchangeRateSnapshot && !quotationData.requiresExchangeRateConfirmation && exchangeRate > 0) {
      setQuotationData((current) => ({ ...current, exchangeRateSnapshot: exchangeRate }));
    }
  }, [exchangeRate, quotationData.exchangeRateSnapshot, quotationData.requiresExchangeRateConfirmation]);

  // Get data from queries first
  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });

  const { data: personnel = [] } = useQuery<Personnel[]>({
    queryKey: ["/api/personnel"],
    staleTime: 0, // Force fresh data after fixes
  });

  const currentYear = new Date().getFullYear();

  // Reference date for "is this person active?" checks. A person is excluded from
  // a quotation when their activeUntil date is on/before the month being quoted —
  // not just relative to today — so cotizaciones futuras no incluyen personas que
  // ya no van a estar (ej. Sol a partir de mayo 2026). Falls back to today.
  const quoteReferenceDate = useMemo(() => {
    const MONTH_NAMES = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    // 1) Explicit project start date
    const start = quotationData.inflation.projectStartDate;
    if (start) {
      const d = new Date(start);
      if (!isNaN(d.getTime())) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      }
    }
    // 2) Selected salary month key like "may2026"
    const sm = quotationData.salaryMonth;
    if (sm) {
      const m = MONTH_NAMES.findIndex((n) => sm.startsWith(n));
      const year = parseInt(sm.replace(/[a-z]/gi, ''), 10);
      if (m >= 0 && Number.isFinite(year)) {
        return `${year}-${String(m + 1).padStart(2, '0')}-01`;
      }
    }
    // 3) Fallback: today
    return new Date().toISOString().slice(0, 10);
  }, [quotationData.inflation.projectStartDate, quotationData.salaryMonth]);

  // Personnel filtered to exclude those inactive as of the quoted month.
  const filteredPersonnel = useMemo(() => {
    return personnel.filter((p: any) => {
      const until = p.activeUntil;
      // Excluded when activeUntil is on/before the quoted month start.
      return !until || until > quoteReferenceDate;
    });
  }, [personnel, quoteReferenceDate]);

  const MONTH_NAMES = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const parseSalaryMonth = (value: string | null | undefined) => {
    const match = value?.match(/^([a-z]{3})(\d{4})$/);
    if (!match) return null;
    const month = MONTH_NAMES.indexOf(match[1]) + 1;
    return month > 0 ? { year: Number(match[2]), month } : null;
  };
  const salaryMonthKey = (year: number, month: number) => `${MONTH_NAMES[month - 1]}${year}`;

  const resolvePersonnelRate = useCallback((
    person: Personnel,
    currency: string,
    targetMonth: string | null | undefined,
    rateMode: "current" | "annual_avg",
    projectStartDate?: Date | null,
    exchangeRateOverride?: number,
  ): number => {
    const rateExchangeRate = exchangeRateOverride && exchangeRateOverride > 0
      ? exchangeRateOverride
      : effectiveExchangeRate;
    const personBillingCurrency = (person as any).billingCurrency ?? 'ARS';
    const useUsd = currency === 'USD';
    const field = useUsd ? "hourlyRateUSD" : "hourlyRateARS";
    const historicalRates = [...((person as any).historicalRates ?? [])]
      .sort((left: any, right: any) =>
        (right.year * 100 + right.month) - (left.year * 100 + left.month)
      );

    if (rateMode === 'annual_avg') {
      const averageYear = projectStartDate?.getFullYear() ?? currentYear;
      const personRates = historicalRates.filter((r: any) =>
        r.year === averageYear && Number(r[field]) > 0
      );
      if (personRates.length > 0) {
        return personRates.reduce((sum: number, rate: any) => sum + Number(rate[field]), 0)
          / personRates.length;
      }
      const fallbackField = useUsd ? "hourlyRateARS" : "hourlyRateUSD";
      const fallbackRates = historicalRates.filter((r: any) =>
        r.year === averageYear &&
        Number(r[fallbackField]) > 0 &&
        (Number(r.exchangeRate) > 0 || rateExchangeRate > 0)
      );
      if (fallbackRates.length === 0) return 0;
      return fallbackRates.reduce((sum: number, rate: any) => {
        const value = Number(rate[fallbackField]);
        const fx = Number(rate.exchangeRate) || rateExchangeRate;
        return sum + (useUsd ? value / fx : value * fx);
      }, 0) / fallbackRates.length;
    }

    const parsedMonth = parseSalaryMonth(targetMonth);
    const referenceDate = parsedMonth
        ? new Date(parsedMonth.year, parsedMonth.month - 1, 1)
        : new Date();
    const referencePeriod = referenceDate.getFullYear() * 100 + referenceDate.getMonth() + 1;
    const applicable = historicalRates.find((rate: any) =>
      rate.year * 100 + rate.month <= referencePeriod && Number(rate[field]) > 0
    );
    if (applicable) return Number(applicable[field]);
    if (!useUsd) {
      const usdRate = historicalRates.find((rate: any) => rate.year * 100 + rate.month <= referencePeriod && Number(rate.hourlyRateUSD) > 0);
      const fx = Number(usdRate?.exchangeRate) || rateExchangeRate;
      if (usdRate && fx > 0) return Number(usdRate.hourlyRateUSD) * fx;
    } else {
      const arsRate = historicalRates.find((rate: any) => rate.year * 100 + rate.month <= referencePeriod && Number(rate.hourlyRateARS) > 0);
      const fx = Number(arsRate?.exchangeRate) || rateExchangeRate;
      if (arsRate && fx > 0) return Number(arsRate.hourlyRateARS) / fx;
    }
    return 0;
  }, [currentYear, effectiveExchangeRate]);

  const getPersonnelRate = useCallback((personnelId: number, targetCurrency?: string, targetMonth?: string | null) => {
    if (!personnel || personnel.length === 0) return 0;
    const person = personnel.find(p => p.id === personnelId);
    if (!person) return 0;
    const rawProjectStart = quotationData.inflation.projectStartDate;
    const projectStartDate = rawProjectStart ? new Date(rawProjectStart) : null;
    return resolvePersonnelRate(
      person,
      targetCurrency || quotationData.quotationCurrency || "ARS",
      targetMonth ?? quotationData.salaryMonth,
      quotationData.inflation.rateProjectionMode ?? "current",
      projectStartDate && !Number.isNaN(projectStartDate.getTime()) ? projectStartDate : null,
    );
  }, [personnel, quotationData.quotationCurrency, quotationData.salaryMonth,
      quotationData.inflation.rateProjectionMode, quotationData.inflation.projectStartDate,
      resolvePersonnelRate]);

  // Returns the month key actually being used in auto-mode (null if no data found).
  // Picks the most recent month where the majority of ARS-billed active personnel
  // have a non-zero rate (avoids returning a month with only partial/estimated data).
  const getResolvedSalaryMonth = useCallback((): string | null => {
    if (quotationData.salaryMonth) return quotationData.salaryMonth;
    const arsBilledActive = personnel.filter((p: any) => {
      const until = p.activeUntil;
      const isActive = !until || until > quoteReferenceDate;
      const isARS = !p.billingCurrency || p.billingCurrency === 'ARS';
      return isActive && isARS;
    });
    const threshold = arsBilledActive.length > 0 ? Math.ceil(arsBilledActive.length * 0.5) : 1;
    const currentPeriod = new Date().getFullYear() * 100 + new Date().getMonth() + 1;
    const availablePeriods = [...new Set(personnel.flatMap((person: any) =>
      (person.historicalRates ?? [])
        .filter((rate: any) => rate.year * 100 + rate.month <= currentPeriod && rate.hourlyRateARS > 0)
        .map((rate: any) => rate.year * 100 + rate.month),
    ))].sort((a, b) => b - a);
    for (const period of availablePeriods) {
      const year = Math.floor(period / 100);
      const month = period % 100;
      const withData = arsBilledActive.filter((person: any) =>
        (person.historicalRates ?? []).some((rate: any) =>
          rate.year === year && rate.month === month && rate.hourlyRateARS > 0),
      ).length;
      if (withData >= threshold) return salaryMonthKey(year, month);
    }
    // Fallback: any person has data
    const latestPeriod = availablePeriods[0];
    if (latestPeriod) {
      return salaryMonthKey(Math.floor(latestPeriod / 100), latestPeriod % 100);
    }
    return null;
  }, [personnel, quotationData.salaryMonth, quoteReferenceDate]);

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

    // Invalidate personnel cache to get fresh data
    queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });

    setRecalculationTrigger(prev => prev + 1);
  }, [queryClient]);

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

  useEffect(() => {
    const annualRate = quotationData.inflation.manualInflationRate || 25;
    let months = 0;
    if (quotationData.inflation.applyInflationAdjustment) {
      if (quotationData.inflation.rateProjectionMode === "annual_avg") {
        months = 6;
      } else if (quotationData.inflation.projectStartDate) {
        const start = new Date(quotationData.inflation.projectStartDate);
        const now = new Date();
        months = Math.max(0, (start.getFullYear() - now.getFullYear()) * 12 + start.getMonth() - now.getMonth());
      }
    }
    const monthlyInflation = Math.pow(1 + annualRate / 100, 1 / 12) - 1;
    const inflationFactor = months > 0 ? Math.pow(1 + monthlyInflation, months) : 1;
    const complexityFactor = Object.values(complexityFactors).reduce((sum, factor) => sum + (factor || 0), 0);
    const result = calculateQuotationPricing({
      quotationCurrency: quotationData.quotationCurrency === "USD" ? "USD" : "ARS",
      exchangeRate: effectiveExchangeRate || 1,
      team: quotationData.teamMembers.map((member) => ({
        hours: member.hours,
        rate: member.rate,
        cost: member.cost,
        currency: quotationData.quotationCurrency === "USD" ? "USD" : "ARS",
      })),
      complexityFactor,
      marginFactor: quotationData.financials.marginFactor,
      toolsCostUSD: quotationData.financials.toolsCost,
      platformCostARS: quotationData.financials.platformCost,
      deviationPercentage: quotationData.financials.deviationPercentage,
      discountPercentage: quotationData.financials.discountPercentage,
      inflationFactor,
      priceMode: quotationData.financials.priceMode,
      manualPrice: quotationData.financials.manualPrice,
      manualPriceCurrency: quotationData.financials.manualPriceCurrency ?? (quotationData.quotationCurrency === "USD" ? "USD" : "ARS"),
    });
    setPricingResult(result);
    setBaseCost(result.canonicalARS.baseCost);
    setComplexityAdjustment(result.canonicalARS.complexityAdjustment);
    setMarkupAmount(result.canonicalARS.markupAmount);
    setTotalAmount(result.canonicalARS.total);
  }, [quotationData.teamMembers, quotationData.financials, quotationData.quotationCurrency, quotationData.inflation, complexityFactors, recalculationTrigger, effectiveExchangeRate]);

  // Navigation functions
  const nextStep = useCallback(() => {
    const maxStep = quotationData.project.type === 'always-on' ? 8 : 7;
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
    const maxStep = quotationData.project.type === 'always-on' ? 8 : 7;
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

  const updateQuotationCurrency = useCallback((currency: string = 'ARS', exchangeRateOverride?: number) => {
    console.log('💱 Updating quotation currency to:', currency);
    setQuotationData(prev => {
      const newCurrency = currency;
      const rateSnapshot = exchangeRateOverride && exchangeRateOverride > 0
        ? exchangeRateOverride
        : (prev.exchangeRateSnapshot && prev.exchangeRateSnapshot > 0 ? prev.exchangeRateSnapshot : exchangeRate);
      const updatedMembers = prev.teamMembers.map(member => {
        let newRate = member.rate;
        if (member.personnelId) {
          const person = personnel?.find(p => p.id === member.personnelId);
          if (person) {
            const rawStart = prev.inflation.projectStartDate;
            const startDate = rawStart ? new Date(rawStart) : null;
            newRate = resolvePersonnelRate(
              person,
              newCurrency,
              prev.salaryMonth,
              prev.inflation.rateProjectionMode ?? "current",
              startDate && !Number.isNaN(startDate.getTime()) ? startDate : null,
              rateSnapshot,
            );
          }
        } else if (member.roleId) {
          const role = roles?.find(r => r.id === member.roleId);
          if (role) {
            newRate = newCurrency === 'USD'
              ? ((role as any).defaultRateUsd || 50)
              : (role.defaultRate || 5000);
          }
        }
        return { ...member, rate: newRate, cost: member.hours * newRate };
      });
      return {
        ...prev,
        quotationCurrency: newCurrency,
        exchangeRateSnapshot: exchangeRateOverride && exchangeRateOverride > 0
          ? rateSnapshot
          : prev.exchangeRateSnapshot,
        requiresExchangeRateConfirmation: exchangeRateOverride && exchangeRateOverride > 0
          ? false
          : prev.requiresExchangeRateConfirmation,
        teamMembers: updatedMembers,
      };
    });
    forceRecalculate();
  }, [exchangeRate, forceRecalculate, personnel, resolvePersonnelRate, roles]);

  // Cambia el mes histórico a considerar y re-aplica tarifas a los
  // miembros del equipo que tengan personnelId, usando el rate del mes
  // elegido (con fallback al más reciente disponible). No toca filas
  // sin personnelId — esas usan el defaultRate del rol y se ajustan a
  // mano. Solo aplica para cotizaciones en ARS; en USD el mes histórico
  // no se usa.
  const updateSalaryMonth = useCallback((salaryMonth: string | null) => {
    console.log('📅 Updating salaryMonth to:', salaryMonth);
    setQuotationData(prev => {
      const currency = prev.quotationCurrency || 'ARS';
      const updatedMembers = prev.teamMembers.map(member => {
        if (!member.personnelId) return member;
        const person = personnel?.find(p => p.id === member.personnelId);
        if (!person) return member;
        const rawStart = prev.inflation.projectStartDate;
        const startDate = rawStart ? new Date(rawStart) : null;
        const newRate = resolvePersonnelRate(
          person,
          currency,
          salaryMonth,
          prev.inflation.rateProjectionMode ?? "current",
          startDate && !Number.isNaN(startDate.getTime()) ? startDate : null,
        );
        if (newRate <= 0) return member;

        return { ...member, rate: newRate, cost: member.hours * newRate };
      });
      return { ...prev, salaryMonth, teamMembers: updatedMembers };
    });
    forceRecalculate();
  }, [personnel, forceRecalculate, resolvePersonnelRate]);

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

    let defaultRate = 0;
    const currency = quotationData.quotationCurrency || 'ARS';

    if (member.personnelId) {
      defaultRate = getPersonnelRate(member.personnelId, currency);
    }
    
    if (!defaultRate && !member.personnelId) {
      if (currency === 'USD') {
        defaultRate = (role as any)?.defaultRateUsd || 50;
      } else {
        defaultRate = role?.defaultRate || 5000;
      }
    }

    if (!defaultRate && !member.personnelId) {
      defaultRate = currency === 'USD' ? 50 : 5000;
    }

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
  }, [roles, getPersonnelRate, quotationData.quotationCurrency, forceRecalculate]);

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
          // Use saved marginFactor or calculate from saved values
          marginFactor: quotation.marginFactor || (quotation.markupAmount && quotation.baseCost ? 
            1 + (quotation.markupAmount / (quotation.baseCost + (quotation.complexityAdjustment || 0))) : 2.0),
          marginPercentage: quotation.marginFactor ? 
            ((quotation.marginFactor - 1) * 100) : 
            (quotation.markupAmount && quotation.baseCost ? 
              ((quotation.markupAmount / (quotation.baseCost + (quotation.complexityAdjustment || 0))) * 100) : 100),
          discountPercentage: Number(quotation.discountPercentage || 0),
          // Nuevos campos cargados de la base de datos
          toolsCost: Number(quotation.toolsCost || 0),
          priceMode: (quotation.priceMode as 'auto' | 'manual') || 'auto',
          manualPrice: quotation.manualPrice ? Number(quotation.manualPrice) : undefined,
          manualPriceCurrency: (quotation.manualPriceCurrency === "USD" ? "USD" : "ARS") as "USD" | "ARS",
        },
        quotationCurrency: quotation.quotationCurrency || "ARS", // Propiedad requerida en el nivel raíz
        exchangeRateSnapshot: Number(quotation.exchangeRateAtQuote) > 0
          ? Number(quotation.exchangeRateAtQuote)
          : undefined,
        pricingVersion: Number(quotation.pricingVersion || 1),
        requiresExchangeRateConfirmation: Number(quotation.pricingVersion || 1) < 2
          || !(Number(quotation.exchangeRateAtQuote) > 0),
        inflation: {
          applyInflationAdjustment: Boolean(quotation.applyInflationAdjustment),
          inflationMethod: quotation.inflationMethod || "manual",
          manualInflationRate: Number(quotation.manualInflationRate || 0),
          projectStartDate: quotation.projectStartDate ? new Date(quotation.projectStartDate).toISOString().split('T')[0] : "",
          rateProjectionMode: ((quotation as any).rateProjectionMode === "annual_avg" ? "annual_avg" : "current") as "current" | "annual_avg",
        },
        proposalLink: quotation.proposalLink || undefined,
        salaryMonth: quotation.salaryMonth ?? null
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

  const saveQuotation = useCallback(async (
    status: 'draft' | 'pending' | 'approved' | 'rejected' | 'in-negotiation' = 'draft',
    variants?: QuotationVariantPayload[],
  ) => {
    try {
      // Validaciones básicas para todos los estados
      if (!quotationData.client?.id) {
        throw new Error("Debe seleccionar un cliente");
      }

      if (!quotationData.project.name?.trim()) {
        console.error("❌ Validation failed: Missing project name");
        throw new Error("Debe ingresar el nombre del proyecto");
      }
      if (quotationData.requiresExchangeRateConfirmation) {
        throw new Error("Confirmá un tipo de cambio positivo para migrar esta cotización legacy al pricing actual");
      }

      // Para borradores, permitir cotizaciones sin equipo
      // Logging para debug
      console.log('📋 Validating quotation data:', {
        status,
        clientId: quotationData.client?.id,
        projectName: quotationData.project.name,
        teamMembersCount: quotationData.teamMembers?.length || 0,
        teamMembers: quotationData.teamMembers
      });

      if (status !== 'draft' && (!quotationData.teamMembers || quotationData.teamMembers.length === 0)) {
        console.error("❌ Validation failed: No team members found for non-draft status");
        console.error("❌ Team members data:", quotationData.teamMembers);
        console.error("❌ Status:", status);
        throw new Error("Debe agregar al menos un miembro al equipo antes de finalizar la cotización");
      }

      // baseCost/complexityAdjustment/markupAmount/totalAmount siempre están
      // en ARS internamente; si la cotización se eligió en USD hay que
      // convertir antes de persistir, para que quotation-detail.tsx no muestre
      // el número ARS crudo etiquetado como USD.
      const saveExchangeRate = quotationData.exchangeRateSnapshot || exchangeRate || 1;
      const toStoredCurrency = (amountARS: number) =>
        quotationData.quotationCurrency === 'USD' && saveExchangeRate > 0
          ? amountARS / saveExchangeRate
          : amountARS;

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
        baseCost: toStoredCurrency(baseCost || 0),
        complexityAdjustment: toStoredCurrency(complexityAdjustment || 0),
        markupAmount: toStoredCurrency(markupAmount || 0),
        marginFactor: quotationData.financials.marginFactor || 2.0,
        totalAmount: toStoredCurrency(totalAmount || 0),
        platformCost: quotationData.financials.platformCost || 0,
        deviationPercentage: quotationData.financials.deviationPercentage || 0,
        discountPercentage: quotationData.financials.discountPercentage || 0,
        // Nuevos campos para herramientas y pricing manual
        toolsCost: quotationData.financials.toolsCost || 0,
        priceMode: quotationData.financials.priceMode || 'auto',
        manualPrice: quotationData.financials.manualPrice || null,
        manualPriceCurrency: quotationData.financials.manualPriceCurrency ?? quotationData.quotationCurrency,
        pricingVersion: 2,
        applyInflationAdjustment: quotationData.inflation.applyInflationAdjustment || false,
        inflationMethod: quotationData.inflation.inflationMethod || 'manual',
        manualInflationRate: quotationData.inflation.manualInflationRate || 0,
        projectStartDate: quotationData.inflation.projectStartDate ? new Date(quotationData.inflation.projectStartDate) : undefined,
        rateProjectionMode: quotationData.inflation.rateProjectionMode || 'current',
        quotationCurrency: quotationData.quotationCurrency || 'ARS',
        exchangeRateAtQuote: saveExchangeRate,
        proposalLink: quotationData.proposalLink || null,
        leadId: quotationData.leadId || null,
        salaryMonth: quotationData.salaryMonth ?? null,
        status: status,
        // The UI uses 0 as the empty role sentinel when a member is selected
        // directly by person. The API contract uses null for an absent role;
        // sending 0 made otherwise valid quotations fail with "Invalid
        // quotation data" before the transaction started.
        teamMembers: quotationData.teamMembers.map((member) => {
          const hours = Number(member.hours);
          const rate = Number(member.rate);
          const roleId = Number(member.roleId);
          const personnelId = Number(member.personnelId);
          return {
            roleId: Number.isInteger(roleId) && roleId > 0 ? roleId : null,
            personnelId: Number.isInteger(personnelId) && personnelId > 0 ? personnelId : null,
            hours: Number.isFinite(hours) && hours >= 0 ? hours : 0,
            rate: Number.isFinite(rate) && rate >= 0 ? rate : 0,
            cost: Number.isFinite(hours) && hours >= 0 && Number.isFinite(rate) && rate >= 0
              ? hours * rate
              : 0,
          };
        }),
        ...(variants ? { variants } : {}),
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

      // Track successful quotation completion for draft management
      if (status !== 'draft') {
        localStorage.setItem('last-quotation-status', status);
        // Clear draft when quotation is successfully completed
        localStorage.removeItem('draft-quotation');
        localStorage.removeItem('draft-quotation-backup');
        localStorage.removeItem('pending-draft-restore');
        console.log(`✅ Quotation completed with status: ${status}, drafts cleared`);
      }

      await queryClient.invalidateQueries({ queryKey: ['/api/quotations'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/quotations/approved'] });

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

  // ── Template save/load ───────────────────────────────────────────────────────
  const saveAsTemplate = useCallback(async (name: string, description?: string) => {
    const payload = {
      name,
      description: description || null,
      projectType: quotationData.project.type,
      analysisType: quotationData.analysisType,
      mentionsVolume: quotationData.mentionsVolume,
      countriesCovered: quotationData.countriesCovered,
      clientEngagement: quotationData.clientEngagement,
      teamConfig: JSON.stringify(quotationData.teamMembers),
    };
    await apiRequest('/api/quotation-templates', 'POST', payload);
  }, [quotationData]);

  const loadFromTemplate = useCallback((template: { projectType: string; analysisType: string; mentionsVolume: string; countriesCovered: string; clientEngagement: string; teamConfig: string }) => {
    setQuotationData(prev => ({
      ...prev,
      project: { ...prev.project, type: template.projectType },
      analysisType: template.analysisType,
      mentionsVolume: template.mentionsVolume,
      countriesCovered: template.countriesCovered,
      clientEngagement: template.clientEngagement,
      teamMembers: (() => { try { return JSON.parse(template.teamConfig); } catch { return []; } })(),
    }));
    forceRecalculate();
  }, [forceRecalculate]);

  const value = {
    quotationData,
    baseCost,
    complexityAdjustment,
    markupAmount,
    totalAmount,
    pricingResult,
    complexityFactors,
    availableRoles: roles,
    availablePersonnel: filteredPersonnel,
    recommendedRoleIds,
    currentStep,
    nextStep,
    previousStep,
    goToStep,
    updateClient,
    updateProjectName,
    updateProjectType,
    updateProjectDuration,
    updateQuotationCurrency,
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
    calculateBaseCost: calculateTotalCost,
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
    updateQuotationData,
    // Currency conversion helper
    getPersonnelRate,
    getResolvedSalaryMonth,
    updateSalaryMonth,
    // Templates
    saveAsTemplate,
    loadFromTemplate,
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
  if (!context) {
    throw new Error('useOptimizedQuote must be used within an OptimizedQuoteProvider');
  }
  return context;
};
