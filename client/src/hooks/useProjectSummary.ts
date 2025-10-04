import { useQuery } from "@tanstack/react-query";

type Summary = {
  revenueUSD: number;
  costUSD: number;
  profitUSD: number;
  markup: number;
  margin: number;
  revenueDisplay?: number;
  costDisplay?: number;
  currencyNative?: "ARS" | "USD";
  flags?: string[];
};

type ProjectSummaryResponse = {
  period: string;
  basis: string;
  summary: Summary;
  project: {
    id: number;
    projectKey: string;
    name: string;
    client: { id: number; name: string };
    type: string;
    status: string;
  };
};

/**
 * 🎯 Hook con fallback automático para obtener KPIs del proyecto
 * 
 * Estrategia:
 * 1. Intenta GET /api/projects/:id/complete-data?period=YYYY-MM&basis=usd
 * 2. Si falla, hace fallback a GET /api/projects?period=YYYY-MM y busca el projectKey
 * 
 * Esto garantiza que los KPIs del header de proyecto = KPIs de la lista
 */
export function useProjectSummary(
  projectId: number,
  projectKey: string,
  period: string,
  basis: "usd" | "native" = "usd"
) {
  return useQuery<Summary>({
    queryKey: ["/api/project-summary", projectId, period, basis],
    enabled: !!projectId && !!period && /^\d{4}-\d{2}$/.test(period),
    staleTime: 30000, // 30 seconds
    retry: 1,
    queryFn: async () => {
      // 1. Try complete-data endpoint with SoT integration
      try {
        const completeDataUrl = `/api/projects/${projectId}/complete-data?period=${period}&basis=${basis}`;
        const completeDataRes = await fetch(completeDataUrl);
        
        if (completeDataRes.ok) {
          const data: ProjectSummaryResponse = await completeDataRes.json();
          
          // Extract summary from complete-data response
          if (data.summary) {
            return {
              revenueUSD: data.summary.revenueUSD ?? 0,
              costUSD: data.summary.teamCostUSD ?? 0,
              profitUSD: data.summary.markupUSD ?? 0,
              markup: data.summary.markup ?? (data.summary.teamCostUSD > 0 ? data.summary.revenueUSD / data.summary.teamCostUSD : 0),
              margin: data.summary.margin ?? (data.summary.revenueUSD > 0 ? (data.summary.revenueUSD - data.summary.teamCostUSD) / data.summary.revenueUSD : 0),
              revenueDisplay: data.summary.revenueDisplay,
              costDisplay: data.summary.costDisplay,
              currencyNative: data.summary.currencyNative,
              flags: data.summary.flags
            };
          }
        }
      } catch (error) {
        console.warn(`⚠️ Complete-data failed for project ${projectId}, trying fallback:`, error);
      }

      // 2. Fallback: Get from list endpoint
      console.log(`📋 FALLBACK: Using /api/projects?period=${period} for project ${projectKey}`);
      
      const listUrl = `/api/projects?period=${period}`;
      const listRes = await fetch(listUrl);
      
      if (!listRes.ok) {
        throw new Error(`Failed to fetch projects list: ${listRes.statusText}`);
      }
      
      const listData = await listRes.json();
      
      // Find project by key in the list
      const projectData = listData.projects?.find(
        (p: any) => p.projectKey === projectKey || p.projectKey?.toLowerCase() === projectKey?.toLowerCase()
      );
      
      if (!projectData) {
        throw new Error(`Project ${projectKey} not found in period ${period}`);
      }
      
      // Extract KPIs from list (same as card view)
      const metrics = projectData.metrics || {};
      
      return {
        revenueUSD: metrics.revenueUSDNormalized ?? 0,
        costUSD: metrics.costUSDNormalized ?? 0,
        profitUSD: (metrics.revenueUSDNormalized ?? 0) - (metrics.costUSDNormalized ?? 0),
        markup: metrics.markup ?? 0,
        margin: metrics.margin ?? 0,
        revenueDisplay: metrics.revenueDisplay,
        costDisplay: metrics.costDisplay,
        currencyNative: projectData.currencyNative
      };
    }
  });
}
