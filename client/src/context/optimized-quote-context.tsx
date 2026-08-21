import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Client, ReportTemplate, Role, Personnel, Quotation } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useCurrency } from "@/hooks/use-currency";
import { resolveQuotationPersonnelRate } from "@shared/utils/quotation-personnel-rate";
import {
  calculateQuotationPricing,
  type QuotationPricingResult,
} from "@shared/utils/quotation-pricing";
import {
  getCountriesFactor,
  getMentionsVolumeFactor,
} from "@shared/utils/quotation-complexity";
import type { BlueprintDefinition, CommercialMotion } from "@shared/quotation-professional";

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
  scopeSnapshot?: BlueprintDefinition | null;
  deliverables?: Array<Record<string, unknown>>;
  assumptions?: string[];
  isRecommended?: boolean;
  unitMetrics?: Record<string, number>;
  isLegacy?: boolean;
  teamMembers: Array<{
    roleId: number | null;
    personnelId: number | null;
    hours: number;
    rate: number;
    cost: number;
  }>;
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

export type AutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

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
    automaticInflationRate?: number;
    projectStartDate: string;
  rateProjectionMode?: "current" | "annual_avg";
  };
  customization?: string;
  proposalLink?: string; // Link a la propuesta original
  adjustmentReason?: string;
  leadId?: number; // Lead CRM de origen (para integración CRM-Cotizaciones)
  billingEntityId?: number | null;
  expiresAt?: string;
  quotationType?: 'one-time' | 'recurring' | 'fee';
  taxRate?: number;
  taxLabel?: string;
  pricesIncludeTax?: boolean;
  paymentTermsDays?: number | null;
  paymentSchedule?: Array<{ label: string; percentage: number; dueDays?: number }>;
  commercialTerms?: string;
  inclusions?: string;
  exclusions?: string;
  termsVersion?: string;
  quotationNumber?: string | null;
  revisionNumber?: number;
  lockVersion?: number;
  exchangeRateSnapshot?: number; // Tipo de cambio al momento de cotizar (snapshot)
  pricingVersion?: number;
  requiresExchangeRateConfirmation?: boolean;
  // Mes histórico (formato 'mmmYYYY', ej. 'aug2025') a usar como tarifa
  // por defecto al agregar personal y al recalcular tarifas. null = "más reciente disponible".
  salaryMonth?: string | null;
  serviceBlueprintId?: number | null;
  serviceBlueprintVersion?: number | null;
  commercialMotion?: CommercialMotion;
  scopeSnapshot?: BlueprintDefinition | null;
  decisionContext?: Record<string, unknown>;
  operationalPlan?: Record<string, unknown>;
  effortOverrideReason?: string | null;
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
  autosaveStatus: AutosaveStatus;
  lastAutosaveAt?: number;
  hasUnsavedChanges: boolean;

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

const defaultExpiryDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().split('T')[0];
};

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
    manualInflationRate: 0,
    automaticInflationRate: undefined,
    projectStartDate: "",
    rateProjectionMode: "current"
  },
  quotationType: 'one-time',
  expiresAt: defaultExpiryDate(),
  taxRate: 0,
  taxLabel: 'IVA',
  pricesIncludeTax: false,
  paymentTermsDays: 30,
  paymentSchedule: [],
  commercialTerms: 'Los importes y fechas quedan sujetos a la vigencia indicada en esta propuesta.',
  adjustmentReason: '',
  inclusions: '',
  exclusions: '',
  termsVersion: '1',
  lockVersion: 1,
  salaryMonth: null,
  serviceBlueprintId: null,
  serviceBlueprintVersion: null,
  commercialMotion: 'new_business',
  scopeSnapshot: null,
  decisionContext: {},
  operationalPlan: {},
  effortOverrideReason: null,
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
    canonicalARS: { baseCost: 0, complexityAdjustment: 0, markupAmount: 0, toolsCost: 0, additionalDeliverableCost: 0, platformCost: 0, deviationAmount: 0, discountAmount: 0, total: 0 },
    display: { baseCost: 0, complexityAdjustment: 0, markupAmount: 0, toolsCost: 0, additionalDeliverableCost: 0, platformCost: 0, deviationAmount: 0, discountAmount: 0, total: 0 },
    displayCurrency: "ARS",
    effectiveMarginFactor: 2,
  });
  const [currentStep, setCurrentStep] = useState(1);
  const [recalculationTrigger, setRecalculationTrigger] = useState(0);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle');
  const [lastAutosaveAt, setLastAutosaveAt] = useState<number | undefined>(() => {
    const stored = localStorage.getItem('last-autosave-time');
    return stored ? Number(stored) : undefined;
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const queryClient = useQueryClient();
  const { convertToUSD, exchangeRate, exchangeRateReady } = useCurrency();
  const effectiveExchangeRate = quotationData.exchangeRateSnapshot && quotationData.exchangeRateSnapshot > 0
    ? quotationData.exchangeRateSnapshot
    : exchangeRate;

  useEffect(() => {
    if (!quotationData.exchangeRateSnapshot && !quotationData.requiresExchangeRateConfirmation && exchangeRateReady && exchangeRate > 0) {
      setQuotationData((current) => ({ ...current, exchangeRateSnapshot: exchangeRate }));
    }
  }, [exchangeRate, exchangeRateReady, quotationData.exchangeRateSnapshot, quotationData.requiresExchangeRateConfirmation]);

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
    const parsedMonth = parseSalaryMonth(targetMonth);
    const referenceDate = parsedMonth
        ? new Date(parsedMonth.year, parsedMonth.month - 1, 1)
        : new Date();
    return resolveQuotationPersonnelRate({
      billingCurrency: (person as any).billingCurrency,
      usdBillingFraction: (person as any).usdBillingFraction,
      quotationCurrency: currency,
      quotationExchangeRate: rateExchangeRate,
      historicalRates: (person as any).historicalRates,
      referenceYear: referenceDate.getFullYear(),
      referenceMonth: referenceDate.getMonth() + 1,
      rateMode,
      averageYear: projectStartDate?.getFullYear() ?? currentYear,
    });
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

  // Persist local drafts shortly after each meaningful edit and expose the
  // real write lifecycle to the UI. This avoids time-based status guesses.
  useEffect(() => {
    const hasMeaningfulData = Boolean(
      quotationData.project.name || quotationData.teamMembers.length > 0 || quotationData.client,
    );
    if (!hasMeaningfulData) return;

    setAutosaveStatus('pending');
    setHasUnsavedChanges(true);
    const saveTimeout = window.setTimeout(() => {
      setAutosaveStatus('saving');
      try {
        const timestamp = Date.now();
        const draftData = {
          quotationData,
          timestamp,
          version: '2.1',
          url: window.location.href,
        };
        localStorage.setItem('draft-quotation', JSON.stringify(draftData));
        localStorage.setItem('draft-quotation-backup', JSON.stringify(draftData));
        localStorage.setItem('last-autosave-time', String(timestamp));
        setLastAutosaveAt(timestamp);
        setAutosaveStatus('saved');
        setHasUnsavedChanges(false);
      } catch (error) {
        console.error('❌ Error saving quotation draft:', error);
        setAutosaveStatus('error');
        setHasUnsavedChanges(true);
      }
    }, 900);

    return () => window.clearTimeout(saveTimeout);
  }, [quotationData]);

  // Restore a recent local draft only when opening a new quotation. A saved
  // quotation always wins over local state.
  useEffect(() => {
    if (!window.location.pathname.match(/^\/optimized-quote\/?$/)) return;
    const rawDraft = localStorage.getItem('draft-quotation')
      || localStorage.getItem('draft-quotation-backup');
    if (!rawDraft) return;
    try {
      const draft = JSON.parse(rawDraft);
      const isRecent = Number(draft.timestamp) > Date.now() - 7 * 24 * 60 * 60 * 1000;
      const restored = draft.quotationData;
      if (!isRecent || !restored || typeof restored !== 'object') return;
      setQuotationData({
        ...initialQuotationData,
        ...restored,
        id: undefined,
        project: { ...initialQuotationData.project, ...(restored.project || {}) },
        financials: { ...initialQuotationData.financials, ...(restored.financials || {}) },
        inflation: { ...initialQuotationData.inflation, ...(restored.inflation || {}) },
        teamMembers: Array.isArray(restored.teamMembers) ? restored.teamMembers : [],
        deliverables: Array.isArray(restored.deliverables) ? restored.deliverables : [],
      });
      sessionStorage.setItem('quotation-draft-restored', String(Date.now()));
    } catch {
      localStorage.removeItem('draft-quotation');
      localStorage.removeItem('draft-quotation-backup');
    }
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

    const factors = {
      analysisTypeFactor: 0,
      mentionsVolumeFactor: getMentionsVolumeFactor(quotationData.mentionsVolume),
      countriesFactor: getCountriesFactor(quotationData.countriesCovered),
      clientEngagementFactor: 0,
      // Removed templateFactor - it doesn't make logical sense
    };

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
    if (!(effectiveExchangeRate > 0)) {
      const emptyResult: QuotationPricingResult = {
        canonicalARS: { baseCost: 0, complexityAdjustment: 0, markupAmount: 0, toolsCost: 0, additionalDeliverableCost: 0, platformCost: 0, deviationAmount: 0, discountAmount: 0, total: 0 },
        display: { baseCost: 0, complexityAdjustment: 0, markupAmount: 0, toolsCost: 0, additionalDeliverableCost: 0, platformCost: 0, deviationAmount: 0, discountAmount: 0, total: 0 },
        displayCurrency: quotationData.quotationCurrency === "USD" ? "USD" : "ARS",
        effectiveMarginFactor: quotationData.financials.marginFactor || 2,
      };
      setPricingResult(emptyResult);
      setBaseCost(0);
      setComplexityAdjustment(0);
      setMarkupAmount(0);
      setTotalAmount(0);
      return;
    }
    const inflationFactor = 1;
    const complexityFactor = Object.values(complexityFactors).reduce((sum, factor) => sum + (factor || 0), 0);
    const result = calculateQuotationPricing({
      quotationCurrency: quotationData.quotationCurrency === "USD" ? "USD" : "ARS",
      exchangeRate: effectiveExchangeRate,
      team: quotationData.teamMembers.map((member) => ({
        hours: member.hours,
        rate: member.rate,
        cost: member.cost,
        currency: quotationData.quotationCurrency === "USD" ? "USD" : "ARS",
      })),
      complexityFactor,
      marginFactor: quotationData.financials.marginFactor,
      toolsCostUSD: quotationData.financials.toolsCost,
      additionalDeliverableCostUSD: quotationData.additionalDeliverableCost,
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
    const maxStep = 6;
    if (currentStep < maxStep) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep]);

  const previousStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback((step: number) => {
    const maxStep = 6;
    if (step >= 1 && step <= maxStep) {
      setCurrentStep(step);
    }
  }, []);

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
      const oldCurrency = prev.quotationCurrency || 'ARS';
      const currentManualPrice = prev.financials.manualPrice;
      let convertedManualPrice = currentManualPrice;
      if (currentManualPrice && oldCurrency !== newCurrency && rateSnapshot > 0) {
        convertedManualPrice = oldCurrency === 'ARS'
          ? currentManualPrice / rateSnapshot
          : currentManualPrice * rateSnapshot;
      }
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
        financials: {
          ...prev.financials,
          manualPrice: convertedManualPrice,
          manualPriceCurrency: newCurrency === 'USD' ? 'USD' : 'ARS',
        },
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


    setQuotationData(prev => ({
      ...prev,
      teamMembers: [...prev.teamMembers, newMember]
    }));

    forceRecalculate();
  }, [roles, getPersonnelRate, quotationData.quotationCurrency, forceRecalculate]);

  const updateTeamMember = useCallback((id: string, updates: Partial<OptimizedTeamMember>) => {

    setQuotationData(prev => ({
      ...prev,
      teamMembers: prev.teamMembers.map(member => {
        if (member.id === id) {
          const updatedMember = { ...member, ...updates };
          // Recalculate cost when hours or rate change
          if ('hours' in updates || 'rate' in updates) {
            updatedMember.cost = (updatedMember.hours || 0) * (updatedMember.rate || 0);
          }
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

        return teamMember;
      });

      // Get client data separately
      const clientData = quotation.clientId ? await apiRequest(`/api/clients/${quotation.clientId}`, 'GET') : null;

      // Get template data if available
      let templateData = null;
      if (quotation.templateId) {
        try {
          templateData = await apiRequest(`/api/templates/${quotation.templateId}`, 'GET');
        } catch (templateError) {
          console.warn('⚠️ Could not load template:', templateError);
        }
      }

      const loadedQuotationData = {
        id: quotation.id, // Importante: establecer el ID para indicar que estamos editando
        quotationNumber: quotation.quotationNumber,
        revisionNumber: quotation.revisionNumber,
        lockVersion: quotation.lockVersion,
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
        deliverables: Array.isArray(quotation.deliverables) ? quotation.deliverables : [],
        additionalDeliverableCost: quotation.quotationCurrency === "USD"
          ? Number(quotation.additionalDeliverableCost || 0)
          : Number(quotation.additionalDeliverableCost || 0) / (Number(quotation.exchangeRateAtQuote) || 1),
        financials: {
          platformCost: quotation.quotationCurrency === "USD"
            ? Number(quotation.platformCost || 0) * (Number(quotation.exchangeRateAtQuote) || 1)
            : Number(quotation.platformCost || 0),
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
          toolsCost: quotation.quotationCurrency === "USD"
            ? Number(quotation.toolsCost || 0)
            : Number(quotation.toolsCost || 0) / (Number(quotation.exchangeRateAtQuote) || 1),
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
          applyInflationAdjustment: false,
          inflationMethod: "manual",
          manualInflationRate: 0,
          automaticInflationRate: undefined,
          projectStartDate: quotation.projectStartDate ? new Date(quotation.projectStartDate).toISOString().split('T')[0] : "",
          rateProjectionMode: ((quotation as any).rateProjectionMode === "annual_avg" ? "annual_avg" : "current") as "current" | "annual_avg",
        },
        proposalLink: quotation.proposalLink || undefined,
        adjustmentReason: quotation.adjustmentReason || '',
        billingEntityId: quotation.billingEntityId,
        expiresAt: quotation.expiresAt ? new Date(quotation.expiresAt).toISOString().split('T')[0] : undefined,
        quotationType: (quotation.quotationType || 'one-time') as 'one-time' | 'recurring' | 'fee',
        taxRate: Number(quotation.taxRate || 0),
        taxLabel: quotation.taxLabel || 'IVA',
        pricesIncludeTax: Boolean(quotation.pricesIncludeTax),
        paymentTermsDays: quotation.paymentTermsDays == null ? null : Number(quotation.paymentTermsDays),
        paymentSchedule: Array.isArray(quotation.paymentSchedule) ? quotation.paymentSchedule : [],
        commercialTerms: quotation.commercialTerms || '',
        inclusions: quotation.inclusions || '',
        exclusions: quotation.exclusions || '',
        termsVersion: quotation.termsVersion || '1',
        salaryMonth: quotation.salaryMonth ?? null,
        serviceBlueprintId: quotation.serviceBlueprintId ?? null,
        serviceBlueprintVersion: quotation.serviceBlueprintVersion ?? null,
        commercialMotion: quotation.commercialMotion || 'new_business',
        scopeSnapshot: quotation.scopeSnapshot || null,
        decisionContext: quotation.decisionContext || {},
        operationalPlan: quotation.operationalPlan || {},
        effortOverrideReason: quotation.effortOverrideReason || null,
      };

      setQuotationData(loadedQuotationData);

      // Force recalculation after loading
      setTimeout(() => {
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
      if (status !== 'draft' && (!quotationData.teamMembers || quotationData.teamMembers.length === 0)) {
        throw new Error("Debe agregar al menos un miembro al equipo antes de finalizar la cotización");
      }

      const saveExchangeRate = Number(quotationData.exchangeRateSnapshot || exchangeRate);
      if (!Number.isFinite(saveExchangeRate) || saveExchangeRate <= 0) {
        throw new Error("Confirmá un tipo de cambio USD/ARS positivo antes de guardar la cotización");
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
        serviceBlueprintId: quotationData.serviceBlueprintId ?? null,
        serviceBlueprintVersion: quotationData.serviceBlueprintVersion ?? null,
        commercialMotion: quotationData.commercialMotion || 'new_business',
        scopeSnapshot: quotationData.scopeSnapshot ?? null,
        decisionContext: quotationData.decisionContext || {},
        operationalPlan: quotationData.operationalPlan || {},
        effortOverrideReason: quotationData.effortOverrideReason || null,
        baseCost: pricingResult.display.baseCost,
        complexityAdjustment: pricingResult.display.complexityAdjustment,
        markupAmount: pricingResult.display.markupAmount,
        marginFactor: quotationData.financials.marginFactor || 2.0,
        totalAmount: pricingResult.display.total,
        platformCost: pricingResult.display.platformCost,
        deviationPercentage: quotationData.financials.deviationPercentage || 0,
        discountPercentage: quotationData.financials.discountPercentage || 0,
        // Nuevos campos para herramientas y pricing manual
        toolsCost: pricingResult.display.toolsCost,
        deliverables: quotationData.deliverables || [],
        additionalDeliverableCost: pricingResult.display.additionalDeliverableCost,
        priceMode: quotationData.financials.priceMode || 'auto',
        manualPrice: quotationData.financials.manualPrice || null,
        manualPriceCurrency: quotationData.financials.manualPriceCurrency ?? quotationData.quotationCurrency,
        pricingVersion: 2,
        applyInflationAdjustment: false,
        inflationMethod: 'manual',
        manualInflationRate: 0,
        automaticInflationRate: null,
        projectStartDate: quotationData.inflation.projectStartDate ? new Date(quotationData.inflation.projectStartDate) : undefined,
        rateProjectionMode: quotationData.inflation.rateProjectionMode || 'current',
        quotationCurrency: quotationData.quotationCurrency || 'ARS',
        exchangeRateAtQuote: saveExchangeRate,
        proposalLink: quotationData.proposalLink || null,
        adjustmentReason: quotationData.adjustmentReason || null,
        leadId: quotationData.leadId || null,
        billingEntityId: quotationData.billingEntityId ?? null,
        expiresAt: quotationData.expiresAt ? new Date(`${quotationData.expiresAt}T12:00:00`) : undefined,
        quotationType: quotationData.quotationType || 'one-time',
        taxRate: quotationData.taxRate || 0,
        taxLabel: quotationData.taxLabel || 'IVA',
        pricesIncludeTax: quotationData.pricesIncludeTax || false,
        paymentTermsDays: quotationData.paymentTermsDays ?? null,
        paymentSchedule: quotationData.paymentSchedule || [],
        commercialTerms: quotationData.commercialTerms || null,
        inclusions: quotationData.inclusions || null,
        exclusions: quotationData.exclusions || null,
        termsVersion: quotationData.termsVersion || '1',
        lockVersion: quotationData.lockVersion || 1,
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
      setQuotationData((previous) => ({
        ...previous,
        id: savedQuotation.id,
        quotationNumber: savedQuotation.quotationNumber ?? previous.quotationNumber,
        revisionNumber: savedQuotation.revisionNumber ?? previous.revisionNumber,
        lockVersion: savedQuotation.lockVersion ?? previous.lockVersion,
        expiresAt: savedQuotation.expiresAt
          ? new Date(savedQuotation.expiresAt).toISOString().split('T')[0]
          : previous.expiresAt,
      }));

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

      const savedAt = Date.now();
      localStorage.setItem('last-autosave-time', String(savedAt));
      setLastAutosaveAt(savedAt);
      setAutosaveStatus('saved');
      setHasUnsavedChanges(false);

      console.log('🎉 Quotation and team saved successfully');
      return savedQuotation;
    } catch (error) {
      console.error("❌ Error saving quotation:", error);
      throw error;
    }
  }, [quotationData, pricingResult, exchangeRate, queryClient]);

  const calculateTotalCost = useCallback(() => {
    console.log('🔄 Manual recalculation triggered');
    forceRecalculate();
  }, [forceRecalculate]);

  const resetQuotation = useCallback(() => {
    localStorage.removeItem('draft-quotation');
    localStorage.removeItem('draft-quotation-backup');
    localStorage.removeItem('last-autosave-time');
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
    autosaveStatus,
    lastAutosaveAt,
    hasUnsavedChanges,
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
