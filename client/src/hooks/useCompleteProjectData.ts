import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface CompleteProjectData {
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
    }>;
  };
  actuals: {
    totalWorkedHours: number;
    totalWorkedCost: number;
    totalEntries: number;
  };
  metrics: {
    efficiency: number;
    markup: number;
    budgetUtilization: number;
    hoursDeviation: number;
    costDeviation: number;
  };
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
    staleTime: 0, // No stale time - always fetch fresh data when timeFilter changes
    cacheTime: 1 * 60 * 1000, // 1 minute cache
    refetchOnWindowFocus: false, // Disable refetch on window focus
  });
};