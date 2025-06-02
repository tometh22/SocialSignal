import { QueryClient } from "@tanstack/react-query";

/**
 * Utilidad global para invalidar y actualizar el caché después de cualquier mutación
 * Garantiza que todos los componentes se actualicen inmediatamente
 */
export function invalidateAllAppData(queryClient: QueryClient) {
  // Invalidar todas las consultas principales de la aplicación
  queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });
  queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
  queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
  queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
  queryClient.invalidateQueries({ queryKey: ["/api/active-projects"] });
  queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
  queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
  
  // Forzar recarga inmediata de datos críticos
  queryClient.refetchQueries({ queryKey: ["/api/personnel"] });
  queryClient.refetchQueries({ queryKey: ["/api/roles"] });
}

/**
 * Actualiza el caché local inmediatamente con nuevos datos
 * Esto asegura que la UI se actualice sin esperar la respuesta del servidor
 */
export function updateCacheData<T>(
  queryClient: QueryClient,
  queryKey: string,
  updatedItem: T,
  idField: keyof T = 'id' as keyof T
) {
  queryClient.setQueryData([queryKey], (oldData: T[] | undefined) => {
    if (!oldData) return [updatedItem];
    return oldData.map(item => 
      item[idField] === updatedItem[idField] ? updatedItem : item
    );
  });
}

/**
 * Función completa que maneja toda la actualización después de una mutación
 * Combina actualización de caché local + invalidación global
 */
export function handleMutationSuccess<T>(
  queryClient: QueryClient,
  queryKey: string,
  updatedItem: T,
  successMessage?: string
) {
  // Actualizar caché local inmediatamente
  updateCacheData(queryClient, queryKey, updatedItem);
  
  // Invalidar toda la aplicación para consistencia
  invalidateAllAppData(queryClient);
  
  return {
    title: "Éxito",
    description: successMessage || "Datos actualizados correctamente"
  };
}