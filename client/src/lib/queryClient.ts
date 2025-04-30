import { QueryClient } from "@tanstack/react-query";

// Crear una instancia de QueryClient para ser usada en toda la aplicación
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      retry: 3,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 10000), // Backoff exponencial
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

// Función por defecto para consultas
export const defaultQueryFn = async ({ queryKey }: { queryKey: string[] }) => {
  const url = queryKey[0];
  
  try {
    console.log(`Fetching data from: ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Error en la petición a ${url}: ${response.status} - ${response.statusText}`);
      throw new Error(`Error en la petición: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Data successfully retrieved from ${url}`);
    return data;
  } catch (error) {
    console.error(`Failed to fetch data from ${url}:`, error);
    throw error;
  }
};