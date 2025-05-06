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
  
  const response = await fetch(url, {
    credentials: "include" // Asegurar que las cookies se envíen con la solicitud
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
    
    const response = await fetch(url, {
      credentials: "include" // Asegurar que las cookies se envíen con la solicitud
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

// Generic function for API requests that handles both parameter orders for backward compatibility
export async function apiRequest(
  arg1: string,    // Can be either endpoint or method
  arg2: string,    // Can be either method or endpoint
  data?: any
) {
  // Determine which argument is the method and which is the endpoint
  const isArg1Method = ["GET", "POST", "PUT", "PATCH", "DELETE"].includes(arg1.toUpperCase());
  
  // Assign variables based on the detected order
  const method = isArg1Method ? arg1 : arg2;
  const endpoint = isArg1Method ? arg2 : arg1;
  
  const url = endpoint;
  
  console.log(`API Request: ${method} ${url}`, data);
  
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error: ${method} ${url} status ${response.status}`, errorText);
      
      const errorMessage = (() => {
        try {
          const json = JSON.parse(errorText);
          return json.message || errorText;
        } catch (e) {
          return errorText || "Error desconocido";
        }
      })();
      
      throw new Error(errorMessage);
    }
    
    if (response.status === 204) {
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error en solicitud API ${method} ${url}:`, error);
    throw error;
  }
}