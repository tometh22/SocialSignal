import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

interface ApiError extends Error {
  status?: number;
  info?: any;
}

export const apiRequest = async (
  url: string,
  method: string = "GET",
  data?: any
): Promise<any> => {
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const error: ApiError = new Error(
      `API request failed with status ${response.status}`
    );
    error.status = response.status;
    
    try {
      error.info = await response.json();
    } catch (e) {
      error.info = { message: "Could not parse error response" };
    }
    
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};

// Default fetcher for useQuery
export const defaultQueryFn = async ({ queryKey }: { queryKey: string[] }) => {
  const [url, ...params] = queryKey;
  
  // If the URL contains parameters, we need to construct the full URL
  const fullUrl = params.length > 0 
    ? `${url}/${params.join('/')}`
    : url;
    
  return apiRequest(fullUrl);
};