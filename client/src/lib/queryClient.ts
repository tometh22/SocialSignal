import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  methodOrUrl: string,
  urlOrData?: string | unknown,
  data?: unknown | undefined,
): Promise<Response | any> {
  // Detectar tipo de uso
  const isOldStyleUsage = urlOrData !== undefined && typeof urlOrData === 'string';
  
  // Manejar caso cuando se llama con un solo argumento (la URL)
  if (!isOldStyleUsage && arguments.length === 1) {
    const url = methodOrUrl;
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });
    
    await throwIfResNotOk(res);
    return res.json();
  }
  
  // Manejar caso de uso tradicional con 2-3 argumentos
  const method = methodOrUrl;
  const url = urlOrData as string;
  const bodyData = data;
  
  const res = await fetch(url, {
    method,
    headers: bodyData ? { "Content-Type": "application/json" } : {},
    body: bodyData ? JSON.stringify(bodyData) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
