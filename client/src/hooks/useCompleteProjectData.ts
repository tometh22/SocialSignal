import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

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
    totalWorkedCost: number;
    totalEntries: number;
    teamBreakdown: Array<{
      personnelId: number;
      name: string;
      hours: number;
      cost: number;
      entries: number;
      lastActivity: string | null;
      estimatedHours: number;
      rate: number;
      isQuoted: boolean;
      roleName: string;
    }>;
  };
  metrics: {
    efficiency: number;
    markup: number;
    budgetUtilization: number;
    hoursDeviation: number;
    costDeviation: number;
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
}

export const useCompleteProjectData = (projectId: number, timeFilter: string = 'all') => {
  return useQuery<CompleteProjectData>({
    queryKey: ['projects', projectId, 'complete-data', timeFilter],
    queryFn: async () => {
      const url = `/api/projects/${projectId}/complete-data?timeFilter=${timeFilter}`;
      console.log('🔍 HOOK: Fetching complete project data for:', { projectId, timeFilter, url });
      
      const response = await fetch(url, {
        credentials: "include",
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('🔍 HOOK: Response status:', response.status);
      console.log('🔍 HOOK: Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔍 HOOK: Error response:', errorText);
        throw new Error(`Failed to fetch complete project data: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('🔍 HOOK: Success data received:', {
        projectId,
        timeFilter,
        estimatedHours: data.quotation?.estimatedHours,
        workedHours: data.actuals?.totalWorkedHours,
        totalCost: data.actuals?.totalWorkedCost,
        markup: data.metrics?.markup
      });
      return data;
    },
    enabled: !!projectId,
    staleTime: 30 * 1000, // 30 seconds - reasonable freshness for project data
    gcTime: 5 * 60 * 1000, // 5 minute cache - better performance
    refetchOnWindowFocus: false, // Disable refetch on window focus
    refetchInterval: false, // Disable automatic polling
  });
};