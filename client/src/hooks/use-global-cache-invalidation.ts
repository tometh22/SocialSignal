import { queryClient } from "@/lib/queryClient";

export const useGlobalCacheInvalidation = () => {
  const invalidateAllRelatedData = () => {
    // Invalidar todas las consultas principales que pueden verse afectadas por cambios
    const queriesToInvalidate = [
      ["/api/personnel"],
      ["/api/roles"], 
      ["/api/clients"],
      ["/api/quotations"],
      ["/api/active-projects"],
      ["/api/time-entries"],
      ["/api/templates"],
      ["/api/project-components"],
      ["/api/progress-reports"],
      ["/api/deliverables"],
      ["/api/conversations"]
    ];

    queriesToInvalidate.forEach(queryKey => {
      queryClient.invalidateQueries({ queryKey });
    });
  };

  const invalidatePersonnelData = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });
    queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
    queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
    queryClient.invalidateQueries({ queryKey: ["/api/active-projects"] });
    queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
  };

  const invalidateClientData = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
    queryClient.invalidateQueries({ queryKey: ["/api/active-projects"] });
    queryClient.invalidateQueries({ queryKey: ["/api/deliverables"] });
  };

  const invalidateProjectData = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/active-projects"] });
    queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
    queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
    queryClient.invalidateQueries({ queryKey: ["/api/project-components"] });
    queryClient.invalidateQueries({ queryKey: ["/api/progress-reports"] });
    queryClient.invalidateQueries({ queryKey: ["/api/deliverables"] });
  };

  const invalidateQuotationData = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
    queryClient.invalidateQueries({ queryKey: ["/api/active-projects"] });
    queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
  };

  const updatePersonnelInCache = (updatedPersonnel: any) => {
    // Forzar actualización inmediata eliminando el caché y recargando
    queryClient.removeQueries({ queryKey: ["/api/personnel"] });
    queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });
    
    // También actualizar manualmente para mayor velocidad
    queryClient.setQueryData(["/api/personnel"], (oldData: any[] | undefined) => {
      if (!oldData) return [updatedPersonnel];
      return oldData.map(item => item.id === updatedPersonnel.id ? updatedPersonnel : item);
    });
  };

  const updateClientInCache = (updatedClient: any) => {
    queryClient.setQueryData(["/api/clients"], (oldData: any[] | undefined) => {
      if (!oldData) return [updatedClient];
      return oldData.map(item => item.id === updatedClient.id ? updatedClient : item);
    });
  };

  const updateProjectInCache = (updatedProject: any) => {
    queryClient.setQueryData(["/api/active-projects"], (oldData: any[] | undefined) => {
      if (!oldData) return [updatedProject];
      return oldData.map(item => item.id === updatedProject.id ? updatedProject : item);
    });
  };

  const updateQuotationInCache = (updatedQuotation: any) => {
    queryClient.setQueryData(["/api/quotations"], (oldData: any[] | undefined) => {
      if (!oldData) return [updatedQuotation];
      return oldData.map(item => item.id === updatedQuotation.id ? updatedQuotation : item);
    });
  };

  return {
    invalidateAllRelatedData,
    invalidatePersonnelData,
    invalidateClientData,
    invalidateProjectData,
    invalidateQuotationData,
    updatePersonnelInCache,
    updateClientInCache,
    updateProjectInCache,
    updateQuotationInCache
  };
};