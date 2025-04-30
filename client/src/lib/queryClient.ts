import { QueryClient } from "@tanstack/react-query";

// Sistema extremo para limitar agresivamente las peticiones y prevenir loops infinitos
// Creamos un contador de peticiones para detectar y prevenir loops
const requestCounts = new Map<string, {count: number, timestamp: number}>();
const RATE_LIMIT_WINDOW = 10000; // 10 segundos
const RATE_LIMIT_MAX = 3; // Máximo 3 peticiones por endpoint en la ventana de tiempo

// Limpieza periódica del contador (cada 30 segundos)
setInterval(() => {
  const now = Date.now();
  requestCounts.forEach((value, key) => {
    if (now - value.timestamp > RATE_LIMIT_WINDOW) {
      requestCounts.delete(key);
    }
  });
}, 30000);

// Crear una instancia de QueryClient para ser usada en toda la aplicación
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 10, // 10 minutos - Muy agresivo para evitar refrescos
      retry: 1, // Solo un reintento
      retryDelay: 3000, // Delay fijo de 3 segundos
      refetchOnMount: false, // No refrescar al montar
      refetchOnWindowFocus: false, // No refrescar al enfocar ventana
      refetchOnReconnect: false, // No refrescar al reconectar
      refetchInterval: false, // Sin refresco automático
      refetchIntervalInBackground: false, // Sin refresco en segundo plano
    },
    mutations: {
      retry: 0, // Sin reintentos para mutaciones
    },
  },
});

// Función para hacer peticiones a la API
export const apiRequest = async (
  url: string,
  method: string = "GET",
  data?: any
): Promise<any> => {
  try {
    const options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (data && (method === "POST" || method === "PUT" || method === "PATCH")) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Error en la petición: ${response.status}`
      );
    }

    // Para las peticiones DELETE no hay respuesta JSON
    if (method === "DELETE") {
      return true;
    }

    return await response.json();
  } catch (error: any) {
    console.error("API request error:", error);
    throw new Error(error.message || "Error desconocido");
  }
};

// Función para asegurar que las URLs sean absolutas
const getAbsoluteUrl = (url: string) => {
  // Si la URL ya es absoluta, la devolvemos sin cambios
  if (url.startsWith('http')) {
    return url;
  }

  // Obtenemos la URL base del servidor
  const baseUrl = window.location.origin;
  
  // Nos aseguramos de que la URL comience con /
  const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
  
  return `${baseUrl}${normalizedUrl}`;
};

// Función por defecto para consultas
// Cache de memoria interna para evitar solicitudes repetidas
const responseCache = new Map<string, {data: any, timestamp: number}>();
const CACHE_LIFETIME = 30000; // 30 segundos de caché en memoria

// Sistema de bloqueo para evitar múltiples peticiones simultáneas a la misma URL
const pendingRequests = new Map<string, Promise<any>>();

export const defaultQueryFn = async ({ queryKey }: { queryKey: string[] }) => {
  // Normalizamos la URL para cache coherente
  const relativeUrl = queryKey[0];
  const url = getAbsoluteUrl(relativeUrl);
  
  try {
    // ----- SISTEMA ANTI-BUCLE -----
    // Verificar y actualizar el contador de peticiones
    const now = Date.now();
    const urlKey = url.replace(/\d+$/, '*'); // Normalización para URLs con IDs
    
    let requestData = requestCounts.get(urlKey);
    if (!requestData) {
      requestData = { count: 0, timestamp: now };
      requestCounts.set(urlKey, requestData);
    } else if (now - requestData.timestamp > RATE_LIMIT_WINDOW) {
      // Si han pasado más de 10 segundos, reiniciar el contador
      requestData.count = 0;
      requestData.timestamp = now;
    }
    
    // Incrementar el contador
    requestData.count++;
    
    // Verificar límite de tasa
    if (requestData.count > RATE_LIMIT_MAX) {
      console.warn(`Rate limit alcanzado para ${urlKey}. Se omitirá la petición.`);
      
      // Buscar en caché primero
      const cachedResponse = responseCache.get(url);
      if (cachedResponse) {
        return cachedResponse.data;
      }
      
      // Si no hay caché, devolvemos un objeto vacío o array según la URL
      // para evitar errores en la interfaz pero sin hacer peticiones innecesarias
      if (url.includes('/api/quotations/')) {
        return {}; // Objeto vacío para detalles
      } else if (url.includes('/api/quotation-team/')) {
        return []; // Array vacío para listas
      } else if (url.includes('/api/clients/')) {
        return {}; // Objeto vacío para detalles de cliente
      } else if (url.includes('/api/templates/')) {
        return {}; // Objeto vacío para detalles de plantilla
      } else {
        return [];  // Por defecto, devolver array vacío
      }
    }
    
    // ----- SISTEMA DE CACHÉ -----
    // 1. Verificar caché en memoria primero
    const cachedResponse = responseCache.get(url);
    if (cachedResponse && now - cachedResponse.timestamp < CACHE_LIFETIME) {
      // Si hay caché válida, la usamos inmediatamente
      return cachedResponse.data;
    }
    
    // 2. Verificar si hay una petición pendiente para la misma URL
    if (pendingRequests.has(url)) {
      // Si ya hay una petición en curso, esperar su resultado
      return pendingRequests.get(url);
    }
    
    // 3. No hay caché ni petición pendiente, hacemos la petición
    const requestPromise = (async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 segundos de timeout
        
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Cache-Control': 'max-age=30', // Permitir caché HTTP de 30 segundos
          },
          credentials: 'same-origin'
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Error en la petición: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Guardar en caché
        responseCache.set(url, {data, timestamp: now});
        
        return data;
      } catch (error: any) {
        if (error.name === 'AbortError') {
          throw new Error(`La petición a ${url} ha excedido el tiempo de espera`);
        }
        
        // No intentamos verificar conectividad para evitar más peticiones
        throw error;
      } finally {
        // Siempre eliminar la petición del mapa cuando termina
        pendingRequests.delete(url);
      }
    })();
    
    // Registrar la petición en curso
    pendingRequests.set(url, requestPromise);
    
    return requestPromise;
  } catch (error) {
    // Como último recurso, si hay un error general, intentar devolver caché expirada si existe
    const cachedResponse = responseCache.get(url);
    if (cachedResponse) {
      return cachedResponse.data;
    }
    
    // Si no hay caché, devolvemos un objeto vacío o array según la URL
    if (url.includes('/api/quotations/')) {
      return {}; // Objeto vacío para detalles
    } else if (url.includes('/api/quotation-team/')) {
      return []; // Array vacío para listas
    } else {
      return [];  // Por defecto, devolver array vacío
    }
  }
};