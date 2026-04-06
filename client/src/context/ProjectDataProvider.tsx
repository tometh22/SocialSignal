import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useCompleteProjectData } from '@/hooks/useCompleteProjectData';
import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/queryClient';

interface ProjectDataContextType {
  // Global state
  projectId: number;
  period: string;
  setPeriod: (period: string) => void;
  
  // Data from useCompleteProjectData
  projectData?: any;
  isLoading: boolean;
  error: any;
  
  // Additional specific endpoints
  rankingsData?: any;
  incomesData?: any;
  costsData?: any;
  
  // Loading states
  isLoadingRankings: boolean;
  isLoadingIncomes: boolean;
  isLoadingCosts: boolean;
  
  // Refetch functions
  refetchAll: () => void;
  refetchProjectData: () => void;
  refetchRankings: () => void;
  refetchIncomes: () => void;
  refetchCosts: () => void;
}

const ProjectDataContext = createContext<ProjectDataContextType | undefined>(undefined);

interface ProjectDataProviderProps {
  projectId: number;
  defaultPeriod?: string;
  children: ReactNode;
}

export const ProjectDataProvider: React.FC<ProjectDataProviderProps> = ({ 
  projectId, 
  defaultPeriod = 'august_2025',
  children 
}) => {
  const [period, setPeriod] = useState(defaultPeriod);

  // Main project data using existing hook
  const { 
    data: projectData, 
    isLoading: isLoadingProject, 
    error: projectError,
    refetch: refetchProjectData
  } = useCompleteProjectData(projectId, period);

  // Performance rankings data
  const { 
    data: rankingsData, 
    isLoading: isLoadingRankings,
    error: rankingsError,
    refetch: refetchRankings
  } = useQuery({
    queryKey: ['projects', projectId, 'performance-rankings', period],
    queryFn: async () => {
      const response = await authFetch(`/api/projects/${projectId}/performance-rankings?timeFilter=${period}`);
      if (!response.ok) throw new Error('Failed to fetch rankings');
      return response.json();
    },
    enabled: !!projectId,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // Incomes data (NEW)
  const { 
    data: incomesData, 
    isLoading: isLoadingIncomes,
    error: incomesError,
    refetch: refetchIncomes
  } = useQuery({
    queryKey: ['projects', projectId, 'incomes', period],
    queryFn: async () => {
      const response = await authFetch(`/api/projects/${projectId}/incomes?timeFilter=${period}`);
      if (!response.ok) throw new Error('Failed to fetch incomes');
      return response.json();
    },
    enabled: !!projectId,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // Costs data (NEW)
  const { 
    data: costsData, 
    isLoading: isLoadingCosts,
    error: costsError,
    refetch: refetchCosts
  } = useQuery({
    queryKey: ['projects', projectId, 'costs', period],
    queryFn: async () => {
      const response = await authFetch(`/api/projects/${projectId}/costs?timeFilter=${period}`);
      if (!response.ok) throw new Error('Failed to fetch costs');
      return response.json();
    },
    enabled: !!projectId,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // Consolidated loading and error states
  const isLoading = isLoadingProject || isLoadingRankings || isLoadingIncomes || isLoadingCosts;
  const error = projectError || rankingsError || incomesError || costsError;

  // Refetch all data
  const refetchAll = useCallback(() => {
    refetchProjectData();
    refetchRankings();
    refetchIncomes();
    refetchCosts();
  }, [refetchProjectData, refetchRankings, refetchIncomes, refetchCosts]);

  // Update period and trigger refetch
  const handleSetPeriod = useCallback((newPeriod: string) => {
    console.log(`🔄 ProjectDataProvider: Changing period from ${period} to ${newPeriod}`);
    setPeriod(newPeriod);
    // React Query will automatically refetch when the period (queryKey) changes
  }, [period]);

  const value: ProjectDataContextType = {
    projectId,
    period,
    setPeriod: handleSetPeriod,
    projectData,
    isLoading,
    error,
    rankingsData,
    incomesData,
    costsData,
    isLoadingRankings,
    isLoadingIncomes,
    isLoadingCosts,
    refetchAll,
    refetchProjectData,
    refetchRankings,
    refetchIncomes,
    refetchCosts,
  };

  return (
    <ProjectDataContext.Provider value={value}>
      {children}
    </ProjectDataContext.Provider>
  );
};

export const useProjectData = (): ProjectDataContextType => {
  const context = useContext(ProjectDataContext);
  if (!context) {
    throw new Error('useProjectData must be used within a ProjectDataProvider');
  }
  return context;
};

// Helper hooks for specific data access
export const useProjectPeriod = () => {
  const { period, setPeriod } = useProjectData();
  return { period, setPeriod };
};

export const useProjectRankings = () => {
  const { rankingsData, isLoadingRankings, refetchRankings } = useProjectData();
  return { rankingsData, isLoadingRankings, refetchRankings };
};

export const useProjectIncomes = () => {
  const { incomesData, isLoadingIncomes, refetchIncomes } = useProjectData();
  return { incomesData, isLoadingIncomes, refetchIncomes };
};

export const useProjectCosts = () => {
  const { costsData, isLoadingCosts, refetchCosts } = useProjectData();
  return { costsData, isLoadingCosts, refetchCosts };
};

export const useProjectMetrics = () => {
  const { projectData } = useProjectData();
  return {
    efficiency: projectData?.metrics?.efficiency,
    markup: projectData?.metrics?.markup,
    budgetUtilization: projectData?.metrics?.budgetUtilization,
    totalAmount: projectData?.analysis?.totals?.revenue || projectData?.totalRealRevenue,
    totalCost: projectData?.analysis?.totals?.costs || projectData?.actuals?.totalWorkedCost,
  };
};