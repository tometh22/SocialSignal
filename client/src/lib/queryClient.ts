import { QueryClient } from "@tanstack/react-query";

// Crear una instancia de QueryClient para ser usada en toda la aplicación
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      gcTime: 1000 * 60 * 10, // 10 minutos (equivalente a cacheTime en v5)
      retry: 2,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 5000), // Backoff exponencial
      refetchOnMount: "always",
      refetchOnWindowFocus: false, // Desactivamos esto para evitar demasiadas peticiones
      refetchOnReconnect: false, // Desactivamos esto para evitar demasiadas peticiones
      refetchInterval: false, // Sin refresco automático
      refetchIntervalInBackground: false,
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

export const defaultQueryFn = async ({ queryKey }: { queryKey: string[] }) => {
  const relativeUrl = queryKey[0];
  const url = getAbsoluteUrl(relativeUrl);
  
  // Verificar caché primero
  const now = Date.now();
  const cachedResponse = responseCache.get(url);
  
  if (cachedResponse && now - cachedResponse.timestamp < CACHE_LIFETIME) {
    // console.log(`Using cached data for ${url} (Age: ${now - cachedResponse.timestamp}ms)`);
    return cachedResponse.data;
  }
  
  // Si no hay caché o está expirada, hacer petición
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 segundos de timeout
  
  try {
    console.log(`Fetching data from: ${url}`);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Cache-Control': 'max-age=30', // Permitir caché HTTP de 30 segundos
      },
      // Asegura que se envíen las cookies y credenciales
      credentials: 'same-origin'
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`Error en la petición a ${url}: ${response.status} - ${response.statusText}`);
      throw new Error(`Error en la petición: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Data successfully retrieved from ${url}`);
    
    // Guardar en caché
    responseCache.set(url, {data, timestamp: now});
    
    return data;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.error(`Request timeout for ${url}`);
      throw new Error(`La petición a ${url} ha excedido el tiempo de espera`);
    }
    
    // Intento de recuperación para errores de API
    if (url.includes('/api/') && !url.includes('/api/ping')) {
      console.error(`Error al cargar datos desde ${url}:`, error);
      
      // Verificar conectividad del servidor
      try {
        const pingResponse = await fetch(getAbsoluteUrl('/api/ping'), { 
          method: 'GET',
          cache: 'no-store' 
        });
        
        if (pingResponse.ok) {
          console.log("Servidor responde a ping, pero falló la solicitud específica");
        }
      } catch (e) {
        console.error("El servidor no responde. Posible problema de conectividad general");
      }
    }
    
    throw error;
  }
};