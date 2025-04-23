import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      const text = await res.text();
      const jsonError = JSON.parse(text);
      console.error("API Error Details:", jsonError);
      const error = new Error(`${res.status}: ${text}`);
      (error as any).response = res;
      throw error;
    } catch (jsonParseError) {
      const error = new Error(`${res.status}: ${res.statusText}`);
      (error as any).response = res;
      throw error;
    }
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
  if (!isOldStyleUsage) {
    const url = methodOrUrl;
    console.log(`Enviando GET request a ${url}`);
    
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });
    
    console.log(`Respuesta de ${url} - Status: ${res.status}`);
    
    await throwIfResNotOk(res);
    const jsonData = await res.json();
    console.log(`Datos recibidos de ${url}:`, jsonData);
    
    return jsonData;
  }
  
  // Manejar caso de uso tradicional con 2-3 argumentos
  const method = methodOrUrl;
  const url = urlOrData as string;
  const bodyData = data;
  
  console.log(`Enviando ${method} request a ${url}`, bodyData || '');
  
  const res = await fetch(url, {
    method,
    headers: bodyData ? { "Content-Type": "application/json" } : {},
    body: bodyData ? JSON.stringify(bodyData) : undefined,
    credentials: "include",
  });

  console.log(`Respuesta de ${url} - Status: ${res.status}`);
  
  await throwIfResNotOk(res);
  
  // Para métodos POST, intentamos obtener un objeto JSON
  if (method === 'POST' || method === 'PATCH') {
    try {
      const jsonData = await res.json();
      console.log(`Datos recibidos de ${url}:`, jsonData);
      return jsonData;
    } catch (error) {
      console.warn(`No se pudo parsear respuesta como JSON:`, error);
      return res;
    }
  }
  
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
