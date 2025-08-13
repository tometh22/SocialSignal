// Configuraciones optimizadas de React Query por tipo de dato
export const queryConfigs = {
  // Datos estáticos que cambian pocas veces
  static: {
    staleTime: 10 * 60 * 1000, // 10 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos
    refetchOnWindowFocus: false,
    refetchInterval: false,
  },
  
  // Datos que cambian moderadamente (proyectos, clientes)
  dynamic: {
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
    refetchOnWindowFocus: false,
    refetchInterval: false,
  },
  
  // Datos que cambian frecuentemente (time entries, contadores)
  frequent: {
    staleTime: 30 * 1000, // 30 segundos
    gcTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false,
    refetchInterval: false,
  },
  
  // Datos críticos en tiempo real
  realtime: {
    staleTime: 5 * 1000, // 5 segundos
    gcTime: 1 * 60 * 1000, // 1 minuto
    refetchOnWindowFocus: true,
    refetchInterval: false, // Usar WebSockets en su lugar
  },
  
  // Configuración para datos que requieren frescura absoluta
  fresh: {
    staleTime: 0, // Siempre fresco
    gcTime: 30 * 1000, // Cache mínimo
    refetchOnWindowFocus: false,
    refetchInterval: false,
  }
};

// Configuraciones específicas por endpoint
export const endpointConfigs = {
  // Datos estáticos
  '/api/clients': queryConfigs.static,
  '/api/personnel': queryConfigs.static,
  '/api/roles': queryConfigs.static,
  
  // Datos dinámicos
  '/api/active-projects': queryConfigs.dynamic,
  '/api/quotations': queryConfigs.dynamic,
  
  // Datos frecuentes
  '/api/time-entries': queryConfigs.frequent,
  '/api/active-projects/count': queryConfigs.frequent, // Optimización crítica
  
  // Datos en tiempo real
  '/api/conversations': queryConfigs.realtime,
};

// Helper para obtener configuración de un endpoint
export function getQueryConfig(endpoint: string) {
  // Buscar configuración exacta
  if (endpointConfigs[endpoint as keyof typeof endpointConfigs]) {
    return endpointConfigs[endpoint as keyof typeof endpointConfigs];
  }
  
  // Buscar por patrón
  for (const [pattern, config] of Object.entries(endpointConfigs)) {
    if (endpoint.includes(pattern)) {
      return config;
    }
  }
  
  // Configuración por defecto
  return queryConfigs.dynamic;
}