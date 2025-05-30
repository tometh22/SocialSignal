import { useState, useCallback } from 'react';
import { queryClient } from "@/lib/queryClient";

export const useForceRefresh = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const forceRefresh = useCallback(() => {
    // Incrementar la clave de refresco para forzar re-render
    setRefreshKey(prev => prev + 1);
    
    // Eliminar todas las consultas del caché
    queryClient.clear();
    
    // Forzar la recarga de todas las consultas activas
    queryClient.refetchQueries();
    
    // También invalidar todas las consultas
    queryClient.invalidateQueries();
  }, []);

  const forceRefreshPersonnel = useCallback(() => {
    setRefreshKey(prev => prev + 1);
    queryClient.removeQueries({ queryKey: ["/api/personnel"] });
    queryClient.refetchQueries({ queryKey: ["/api/personnel"] });
    queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });
  }, []);

  return {
    refreshKey,
    forceRefresh,
    forceRefreshPersonnel
  };
};