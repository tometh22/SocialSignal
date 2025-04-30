import { QueryClient } from "@tanstack/react-query";

// Crear una instancia de QueryClient para ser usada en toda la aplicación
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      retry: 2,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 5000), // Backoff exponencial
      refetchOnMount: true,
      refetchOnWindowFocus: false, // Desactivamos esto para evitar demasiadas peticiones
      refetchOnReconnect: false, // Desactivamos esto para evitar demasiadas peticiones
      refetchInterval: false, // Sin refresco automático
    },
    mutations: {
      retry: 1,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 3000),
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
    // 1. Verificar caché en memoria primero
    const now = Date.now();
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
        
        // Intentar verificar conectividad general del servidor
        if (url.includes('/api/') && !url.includes('/api/ping')) {
          try {
            await fetch(getAbsoluteUrl('/api/ping'), { method: 'GET', cache: 'no-store' });
          } catch {
            // Si el ping también falla, es problema general de conexión
          }
        }
        
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
    const expiredCache = responseCache.get(url);
    if (expiredCache) {
      return expiredCache.data;
    }
    throw error;
  }
};