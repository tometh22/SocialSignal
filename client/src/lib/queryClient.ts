import { QueryClient } from "@tanstack/react-query";

type FetcherOptions = {
  on401?: "throw" | "returnNull";
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

// Default query function that will be used by react-query
export const defaultQueryFn = async ({ queryKey }: { queryKey: string | string[] }) => {
  const url = Array.isArray(queryKey) ? queryKey[0] : queryKey;
  
  // SOLUCIÓN TEMPORAL: Obtener user ID del localStorage
  const tempUserId = localStorage.getItem('tempUserId');
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  
  if (tempUserId) {
    headers['Authorization'] = `Bearer ${tempUserId}`;
    console.log('🔑 Adding Authorization header:', tempUserId);
  }
  
  const response = await fetch(url, {
    credentials: "include", // Asegurar que las cookies se envíen con la solicitud
    headers
  });
  
  if (!response.ok) {
    const errorMessage = await response
      .text()
      .then(text => {
        try {
          const json = JSON.parse(text);
          return json.message || text;
        } catch (e) {
          return text;
        }
      })
      .catch(() => "Error desconocido");
    
    throw new Error(errorMessage);
  }
  
  // For empty responses like 204 No Content
  if (response.status === 204) {
    return null;
  }
  
  return await response.json();
};

// Function to get a query function with custom error handling
export function getQueryFn({ on401 = "throw" }: FetcherOptions = {}) {
  return async ({ queryKey }: { queryKey: string | string[] }) => {
    const url = Array.isArray(queryKey) ? queryKey[0] : queryKey;
    
    // SOLUCIÓN TEMPORAL: Obtener user ID del localStorage
    const tempUserId = localStorage.getItem('tempUserId');
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    
    if (tempUserId) {
      headers['Authorization'] = `Bearer ${tempUserId}`;
    }
    
    const response = await fetch(url, {
      credentials: "include", // Asegurar que las cookies se envíen con la solicitud
      headers
    });
    
    if (!response.ok) {
      if (response.status === 401 && on401 === "returnNull") {
        return null;
      }
      
      const errorMessage = await response
        .text()
        .then(text => {
          try {
            const json = JSON.parse(text);
            return json.message || text;
          } catch (e) {
            return text;
          }
        })
        .catch(() => "Error desconocido");
      
      throw new Error(errorMessage);
    }
    
    // For empty responses like 204 No Content
    if (response.status === 204) {
      return null;
    }
    
    return await response.json();
  };
}

// Generic function for API requests
export async function apiRequest(
  endpoint: string,
  method: string,
  data?: any
) {
  const url = endpoint;
  
  // SOLUCIÓN TEMPORAL: Obtener user ID del localStorage
  const tempUserId = localStorage.getItem('tempUserId');
  
  try {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    
    if (tempUserId) {
      headers['Authorization'] = `Bearer ${tempUserId}`;
    }
    
    const options: RequestInit = {
      method,
      headers,
      credentials: "include",
    };
    
    if (data) {
      console.log('📡 Datos ANTES de stringify:', data);
      console.log('📡 Propiedades del objeto:', Object.keys(data));
      console.log('📡 totalCost valor:', data.totalCost, typeof data.totalCost);
      console.log('📡 entryType valor:', data.entryType, typeof data.entryType);
      
      options.body = JSON.stringify(data);
      console.log('📡 JSON stringified:', options.body);
      
      // Verificar que se puede parsear correctamente
      const parsed = JSON.parse(options.body);
      console.log('📡 Parsed de vuelta:', parsed);
      console.log('📡 totalCost después de parse:', parsed.totalCost, typeof parsed.totalCost);
    }
    
    // Realizar la solicitud
    const response = await fetch(url, options);
    
    // Manejar errores de respuesta
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error: ${method} ${url} status ${response.status}`, errorText);
      
      let errorMessage;
      try {
        const json = JSON.parse(errorText);
        errorMessage = json.message || errorText;
      } catch (e) {
        errorMessage = errorText || "Error desconocido";
      }
      
      throw new Error(errorMessage);
    }
    
    // Para respuestas vacías
    if (response.status === 204) {
      return null;
    }
    
    // Verificar si el cuerpo de la respuesta tiene contenido
    const responseText = await response.text();
    if (!responseText) {
      return null;
    }
    
    // Intentar analizar la respuesta como JSON
    try {
      return JSON.parse(responseText);
    } catch (error) {
      console.error("Error al analizar respuesta JSON:", error);
      throw new Error("Error al analizar la respuesta del servidor");
    }
  } catch (error) {
    console.error(`Error en solicitud API ${method} ${url}:`, error);
    throw error;
  }
}