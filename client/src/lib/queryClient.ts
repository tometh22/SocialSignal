import { QueryClient } from "@tanstack/react-query";

type FetcherOptions = {
  on401?: "throw" | "returnNull";
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

// Returns Authorization header if a session token exists in sessionStorage
export function getAuthHeader(): Record<string, string> {
  const token = sessionStorage.getItem('auth_token');
  return token ? { 'Authorization': `Session ${token}` } : {};
}

// Wrapper over fetch that always includes credentials + auth header
export function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const existingHeaders = options.headers
    ? (options.headers instanceof Headers
        ? Object.fromEntries((options.headers as Headers).entries())
        : (options.headers as Record<string, string>))
    : {};
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...existingHeaders,
    },
  });
}

// Default query function that will be used by react-query
export const defaultQueryFn = async ({ queryKey }: { queryKey: readonly unknown[] }) => {
  const url = Array.isArray(queryKey) ? queryKey[0] : queryKey;
  
  const response = await fetch(url as string, {
    credentials: "include",
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    }
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
  
  if (response.status === 204) {
    return null;
  }
  
  return await response.json();
};

// Function to get a query function with custom error handling
export function getQueryFn({ on401 = "throw" }: FetcherOptions = {}) {
  return async ({ queryKey }: { queryKey: readonly unknown[] }) => {
    const url = Array.isArray(queryKey) ? queryKey[0] : queryKey;
    
    const response = await fetch(url as string, {
      credentials: "include",
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      }
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
    
    if (response.status === 204) {
      return null;
    }
    
    return await response.json();
  };
}

// Generic function for API requests (overloaded)
export async function apiRequest(
  endpoint: string,
  options: { method: string; body?: any }
): Promise<any>;
export async function apiRequest(
  endpoint: string,
  method: string,
  data?: any
): Promise<any>;
export async function apiRequest(
  endpoint: string,
  methodOrOptions: string | { method: string; body?: any },
  data?: any
) {
  let method: string;
  let requestData: any;
  
  if (typeof methodOrOptions === 'string') {
    method = methodOrOptions;
    requestData = data;
  } else {
    method = methodOrOptions.method;
    requestData = methodOrOptions.body;
  }
  const url = endpoint;
  
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    };
    
    const options: RequestInit = {
      method,
      headers,
      credentials: "include",
    };
    
    if (requestData) {
      options.body = JSON.stringify(requestData);
    }
    
    const response = await fetch(url, options);
    
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
    
    if (response.status === 204) {
      return null;
    }
    
    const responseText = await response.text();
    if (!responseText) {
      return null;
    }
    
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
