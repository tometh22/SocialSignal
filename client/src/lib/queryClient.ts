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
  
  const response = await fetch(url);
  
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
    
    const response = await fetch(url);
    
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
  method: string,
  endpoint: string,
  data?: any
) {
  const url = endpoint;
  
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
  
  const response = await fetch(url, options);
  
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
  
  return response;
}