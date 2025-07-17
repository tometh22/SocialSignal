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

export const useCompleteProjectData = (projectId: number) => {
  return useQuery<CompleteProjectData>({
    queryKey: ['projects', projectId, 'complete-data'],
    queryFn: async () => {
      const response = await apiRequest(`/api/projects/${projectId}/complete-data`);
      if (!response.ok) {
        throw new Error('Failed to fetch complete project data');
      }
      return response.json();
    },
    enabled: !!projectId,
    staleTime: 30000, // 30 seconds
    cacheTime: 5 * 60 * 1000, // 5 minutes
  });
};