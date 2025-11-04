import { useQuery } from '@tanstack/react-query';
import { useRef, useEffect } from 'react';

interface CompleteProjectData {
  // Root level properties (for direct access)
  efficiency: number;
  estimatedCost: number;
  estimatedHours: number;
  isAlwaysOn: boolean;
  markup: number;
  timeFilter: string;
  workedCost: number;
  workedHours: number;
  totalRealRevenue: number; // 🎯 NUEVO: Revenue real del período filtrado
  
  // Project type validation (new for one-shot projects)
  isOutOfRange?: boolean;
  activityRange?: {
    startPeriod: string;
    endPeriod: string;
    isActive: boolean;
  };
  
  // Nested objects (full structure from backend)
  project: {
    id: number;
    name: string;
    status: string;
    startDate: string;
    expectedEndDate: string;
    clientId: number;
    quotationId: number;
  };
  quotation: {
    id: number;
    projectName: string;
    baseCost: number;
    totalAmount: number;
    estimatedHours: number;
    team: Array<{
      id: number;
      personnelId: number;
      personnelName: string;
      hours: number;
      rate: number;
      cost: number;
      personnel: {
        id: number;
        name: string;
        email: string;
        hourlyRate: number;
        profilePicture: string;
      };
      role: {
        id: number;
        name: string;
        description: string;
      };
    }>;
  };
  actuals: {
    totalWorkedHours: number;
    totalAsanaHours?: number;
    totalBillingHours?: number;
    totalWorkedCost: number;
    totalEntries: number;
    teamBreakdown: Array<{
      personnelId: number | string;
      name: string;
      // 3 tipos de horas
      targetHours?: number;
      hoursAsana?: number;
      hoursBilling?: number;
      hours: number;              // Legacy
      // Costos
      costARS?: number;
      costUSD?: number;
      hourlyRateARS?: number;
      // Legacy fields
      cost?: number;
      entries?: number;
      lastActivity?: string | null;
      estimatedHours?: number;
      rate?: number | null;
      isQuoted?: boolean;
      roleName?: string;
      role?: string;
    }>;
  };
  metrics: {
    efficiency: number;
    markup: number;
    budgetUtilization: number;
    hoursDeviation: number;
    costDeviation: number;
  };
  summary?: {
    teamCostUSD: number;
    revenueUSD: number;
    markupUSD: number;
    costDisplay?: number;
    revenueDisplay?: number;
    currencyNative?: string;
    markup?: number;
    margin?: number;
    flags?: string[];
    emptyStates?: {
      costos: boolean;
      ingresos: boolean;
      horas: boolean;
      objetivos: boolean;
    };
    hasData?: {
      costos: boolean;
      ingresos: boolean;
    };
  };
  views?: {
    original?: {
      revenue: number;
      revenue_currency: string;
      cost: number;
      cost_currency: string;
      cotizacion?: number | null;
    };
    operativa?: {
      revenue: number;
      cost: number;
      currency: string;
      cotizacion?: number | null;
      markup?: number | null;
      margin?: number | null;
      budgetUtilization?: number | null;
    };
    usd?: {
      revenue: number;
      cost: number;
      currency: string;
      cotizacion?: number | null;
      markup?: number | null;
      margin?: number | null;
      budgetUtilization?: number | null;
    };
  };
  rankings: {
    economicMetrics: Array<{
      personnelId: number;
      personnelName: string;
      estimatedHours: number;
      actualHours: number;
      estimatedCost: number;
      actualCost: number;
      pricePercentage: number;
      assignedPrice: number;
      costDeviation: number;
      hoursDeviation: number;
      marginPerHour: number;
      billingEfficiency: number;
      efficiencyScore: number;
      impactScore: number;
      unifiedScore: number;
      performanceColor: string;
      efficiencyRank: number;
      impactRank: number;
      unifiedRank: number;
    }>;
    summary: {
      totalMembers: number;
      excellentPerformers: number;
      goodPerformers: number;
      criticalPerformers: number;
    };
  };
  directCosts: Array<{
    id: number;
    persona: string;
    mes: string;
    año: number;
    proyecto: string;
    cliente: string;
    horasRealesAsana: number;
    costoTotal: number;
    montoTotalUSD?: number; // Corregido: USD en mayúsculas como en schema
    valorHoraPersona: number;
    projectId?: number;
    personnelId?: number;
  }>;
  // 🎯 NUEVO: Ventas filtradas de Google Sheets para cálculo de revenue del período
  googleSheetsSales?: Array<{
    id: number;
    clientName: string;
    projectName: string;
    month: string;
    year: number;
    amountUsd: string;
    currency: string;
    status: string;
  }>;
  
  // 💰 NUEVO: Multi-Currency Analysis
  analysis?: {
    currency: 'ARS' | 'USD'; // Detected analysis currency
    totals: {
      revenue: number;       // Normalized revenue
      costs: number;         // Normalized costs  
      margin: number;        // Revenue - costs
      markup: number;        // Revenue / costs ratio
      roi: number;           // ROI percentage
    };
    metadata: {
      incomeRecords: number;
      costRecords: number;
      hasUsdIncomes: boolean;
      hasArsIncomes: boolean;
      hasMixedCurrencies: boolean;
    };
  };
  
  // 💰 NUEVO: Costs formatted for dual-currency display
  costsDisplay?: Array<{
    id: number;
    persona: string;
    mes: string;
    año: number;
    horasRealesAsana: number;
    costoTotal: number;
    montoTotalUSD?: number;
    costoTotalARS: number;     // ARS version (always available)
    costoTotalUSD: number;     // USD version (converted if needed)
    hasUsdValue: boolean;      // Whether montoTotalUSD is original or converted
    isConverted: boolean;      // Whether USD value is converted from ARS
    valorHoraPersona: number;
    projectId?: number;
    personnelId?: number;
  }>;
  
  // 🔄 NUEVO: Previous period data for delta calculations
  previousPeriod?: {
    period: string; // YYYY-MM format
    hasData: boolean; // Whether previous period has any data
    metrics: {
      revenueUSD: number;
      teamCostUSD: number;
      totalHours: number;
      efficiencyPct: number;
      teamMembers: number;
      markup: number;
      margin: number;
    } | null;
  };
}

export const useCompleteProjectData = (
  projectId: number, 
  timeFilter: string = 'all',
  period?: string, // 🎯 Support period=YYYY-MM for SoT integration
  view?: 'original' | 'operativa' | 'usd' // 🎯 NEW: Support 3-view system
) => {
  // 🛡️ RACE CONDITION FIX: Cache último summary válido
  const lastGoodSummaryRef = useRef<CompleteProjectData['summary'] | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const query = useQuery<CompleteProjectData>({
    queryKey: ['projects', projectId, 'complete-data', period || timeFilter, view || 'operativa'],
    staleTime: 0, // 🔧 TEMPORARY: Force fresh data on every mount for previousPeriod debugging
    queryFn: async () => {
      // 🛡️ Abortar fetch anterior si existe
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      const controller = new AbortController();
      abortControllerRef.current = controller;
      
      // 🎯 Build URL with view parameter + CACHE BUSTING
      const cacheBuster = `_t=${Date.now()}`; // Force fresh request every time
      const baseUrl = period && /^\d{4}-\d{2}$/.test(period)
        ? `/api/projects/${projectId}/complete-data?period=${period}&basis=usd&${cacheBuster}`
        : `/api/projects/${projectId}/complete-data?timeFilter=${timeFilter}&${cacheBuster}`;
      
      const url = view ? `${baseUrl}&view=${view}` : baseUrl;
      console.log('🔍 HOOK: Fetching complete project data for:', { projectId, timeFilter, period, view, url });
      
      const timeoutId = setTimeout(() => {
        console.log('🔍 HOOK: Request timeout after 20 seconds');
        controller.abort();
      }, 20000); // 20 second timeout for complex project data
      
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          credentials: "include",
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        
        clearTimeout(timeoutId);
        console.log('🔍 HOOK: Response status:', response.status);
        console.log('🔍 HOOK: Response ok:', response.ok);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('🔍 HOOK: Error response:', errorText);
          
          if (response.status === 408 || response.status >= 500) {
            throw new Error('El servidor está experimentando problemas. Por favor, recarga la página.');
          }
          if (response.status === 404) {
            throw new Error('Proyecto no encontrado.');
          }
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // 🚨 DEBUG: Check for previousPeriod in response
        console.log('🔍 PREVIOUS PERIOD DEBUG:', {
          hasPreviousPeriod: !!data.previousPeriod,
          previousPeriod: data.previousPeriod,
          previousHasData: data.previousPeriod?.hasData,
          previousMetrics: data.previousPeriod?.metrics
        });
        
        // 🛡️ MERGE FUNCIONAL: Preservar summary si el nuevo fetch no lo trae
        // Guard defensivo para evitar spread sobre undefined/null
        const mergedData = {
          ...(data ?? {}),
          summary: data?.summary || lastGoodSummaryRef.current || undefined
        };
        
        console.log('🔍 HOOK: Success data received:', {
          projectId,
          timeFilter,
          estimatedHours: data.quotation?.estimatedHours,
          workedHours: data.actuals?.totalWorkedHours,
          totalCost: data.actuals?.totalWorkedCost,
          markup: data.metrics?.markup,
          hasSummary: !!data.summary,
          costDisplay: data.summary?.costDisplay,
          usedCachedSummary: !data.summary && !!lastGoodSummaryRef.current
        });
        
        return mergedData;
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('La carga de datos tardó demasiado tiempo. Verifica tu conexión e inténtalo de nuevo.');
        }
        console.error('🔍 HOOK: Fetch error:', error);
        throw error;
      }
    },
    enabled: !!projectId,
    retry: (failureCount, error: any) => {
      // No retry for client errors (4xx) or if already tried 2 times
      if (failureCount >= 2) return false;
      if (error?.message?.includes('no encontrado')) return false;
      if (error?.message?.includes('404')) return false;
      return true;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    gcTime: 5 * 60 * 1000, // 5 minute cache - better performance
    refetchOnWindowFocus: false, // Disable refetch on window focus
    refetchInterval: false, // Disable automatic polling
    placeholderData: undefined, // No usar datos previos al cambiar período (evita mezclar shapes)
  });

  // 🛡️ Actualizar cache cuando llegue un summary válido
  useEffect(() => {
    if (query.data?.summary?.costDisplay != null) {
      lastGoodSummaryRef.current = query.data.summary;
      console.log('🛡️ CACHE: Updated lastGoodSummary:', {
        costDisplay: query.data.summary.costDisplay,
        currencyNative: query.data.summary.currencyNative
      });
    }
  }, [query.data?.summary?.costDisplay]);

  // 🛡️ Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return query;
};