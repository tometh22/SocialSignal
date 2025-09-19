import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

// 🎯 UNIVERSAL PROJECT DATA PROVIDER según handoff
// Manejo de estado global: projectId, timeFilter, basis
// Cache keys incluyen {projectId, period, basis} para consistencia total

interface ProjectDataContextType {
  projectId: number | null;
  timeFilter: string;
  basis: 'ECON' | 'EXEC';
  setProjectId: (id: number) => void;
  setTimeFilter: (filter: string) => void;
  setBasis: (basis: 'ECON' | 'EXEC') => void;
  
  // Datos universales (pre-fetched)
  completeData: any;
  deviationAnalysis: any;
  performanceRankings: any;
  
  // Loading states
  isLoadingComplete: boolean;
  isLoadingDeviation: boolean;
  isLoadingPerformance: boolean;
  
  // Helpers
  invalidateAll: () => void;
}

const ProjectDataContext = createContext<ProjectDataContextType | undefined>(undefined);

interface ProjectDataProviderProps {
  children: ReactNode;
  initialProjectId?: number;
  initialTimeFilter?: string;
  initialBasis?: 'ECON' | 'EXEC';
}

export function ProjectDataProvider({
  children,
  initialProjectId,
  initialTimeFilter = 'august_2025', // Default según handoff
  initialBasis = 'ECON'
}: ProjectDataProviderProps) {
  const [projectId, setProjectId] = useState<number | null>(initialProjectId || null);
  const [timeFilter, setTimeFilter] = useState(initialTimeFilter);
  const [basis, setBasis] = useState<'ECON' | 'EXEC'>(initialBasis);

  // 🎯 PREFETCH EN PARALELO - clave de caché incluye {projectId, period, basis}
  const {
    data: completeData,
    isLoading: isLoadingComplete,
    refetch: refetchComplete
  } = useQuery({
    queryKey: [`/api/projects/${projectId}/complete-data?timeFilter=${timeFilter}&basis=${basis}`, 'project', projectId, 'complete-data', timeFilter, basis],
    enabled: !!projectId,
    staleTime: 30000, // 30 segundos
  });

  const {
    data: deviationAnalysis,
    isLoading: isLoadingDeviation,
    refetch: refetchDeviation
  } = useQuery({
    queryKey: [`/api/projects/${projectId}/deviation-analysis?timeFilter=${timeFilter}&basis=${basis}`, 'project', projectId, 'deviation-analysis', timeFilter, basis],
    enabled: !!projectId,
    staleTime: 30000,
  });

  const {
    data: performanceRankings,
    isLoading: isLoadingPerformance,
    refetch: refetchPerformance
  } = useQuery({
    queryKey: [`/api/projects/${projectId}/performance-rankings?timeFilter=${timeFilter}`, 'project', projectId, 'performance-rankings', timeFilter],
    enabled: !!projectId,
    staleTime: 30000,
  });

  // 🔄 INVALIDAR Y REFETCH cuando cambia el filtro temporal
  const invalidateAll = () => {
    refetchComplete();
    refetchDeviation();
    refetchPerformance();
  };

  // Auto-invalidate cuando cambian los parámetros globales
  useEffect(() => {
    if (projectId) {
      invalidateAll();
    }
  }, [timeFilter, basis]);

  const value: ProjectDataContextType = {
    projectId,
    timeFilter,
    basis,
    setProjectId,
    setTimeFilter,
    setBasis,
    
    completeData,
    deviationAnalysis,
    performanceRankings,
    
    isLoadingComplete,
    isLoadingDeviation,
    isLoadingPerformance,
    
    invalidateAll
  };

  return (
    <ProjectDataContext.Provider value={value}>
      {children}
    </ProjectDataContext.Provider>
  );
}

export function useProjectData() {
  const context = useContext(ProjectDataContext);
  if (context === undefined) {
    throw new Error('useProjectData must be used within a ProjectDataProvider');
  }
  return context;
}

// 🎯 HOOK ESPECIALIZADO para cada endpoint según handoff
export function useCompleteProjectData() {
  const { completeData, isLoadingComplete } = useProjectData();
  return { data: completeData, isLoading: isLoadingComplete };
}

export function useDeviationAnalysis() {
  const { deviationAnalysis, isLoadingDeviation } = useProjectData();
  return { data: deviationAnalysis, isLoading: isLoadingDeviation };
}

export function usePerformanceRankings() {
  const { performanceRankings, isLoadingPerformance } = useProjectData();
  return { data: performanceRankings, isLoading: isLoadingPerformance };
}