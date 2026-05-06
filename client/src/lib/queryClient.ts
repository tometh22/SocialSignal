import { QueryClient } from "@tanstack/react-query";

type FetcherOptions = {
  on401?: "throw" | "returnNull";
};

// Returns Authorization header if a session token exists in sessionStorage
export function getAuthHeader(): Record<string, string> {
  const token = sessionStorage.getItem('auth_token');
  return token ? { 'Authorization': `Session ${token}` } : {};
}

// ───────────────────────────────────────────────────────────────────────────
// Review Room context (for room-scoped API calls).
// When a room is active, legacy /api/status-semanal/* URLs are rewritten to
// the room-scoped /api/reviews/:roomId/* equivalents.
// ───────────────────────────────────────────────────────────────────────────

let _currentReviewRoomId: number | null = null;

export function setCurrentReviewRoomId(roomId: number | null) {
  if (_currentReviewRoomId === roomId) return;
  _currentReviewRoomId = roomId;
  // Changing room invalidates all status-semanal cache entries (they may live under different URLs now).
  try { queryClient.invalidateQueries(); } catch {}
}

export function getCurrentReviewRoomId(): number | null {
  return _currentReviewRoomId;
}

export function rewriteReviewUrl(url: string): string {
  const roomId = _currentReviewRoomId;
  if (!roomId) return url;
  if (!url.startsWith('/api/status-semanal')) return url;

  // Split off the query string so we can analyze only the path.
  const qIdx = url.indexOf('?');
  const path = qIdx >= 0 ? url.slice(0, qIdx) : url;
  const qs = qIdx >= 0 ? url.slice(qIdx) : '';
  const base = `/api/reviews/${roomId}`;

  // Exact matches
  if (path === '/api/status-semanal') return `${base}/items${qs}`;
  if (path === '/api/status-semanal/custom') return `${base}/items/custom${qs}`;
  if (path === '/api/status-semanal/users') return `${base}/assignable-users?scope=all${qs ? `&${qs.slice(1)}` : ''}`;
  if (path === '/api/status-semanal/ai-summary') return `${base}/ai-summary${qs}`;

  // notes/:id, updates/:id
  let m = path.match(/^\/api\/status-semanal\/notes\/(\d+)$/);
  if (m) return `${base}/notes/${m[1]}${qs}`;
  m = path.match(/^\/api\/status-semanal\/updates\/(\d+)$/);
  if (m) return `${base}/updates/${m[1]}${qs}`;

  // custom sub-routes
  m = path.match(/^\/api\/status-semanal\/custom\/(\d+)(\/notes|\/updates|\/activity|\/read)?$/);
  if (m) return `${base}/items/custom/${m[1]}${m[2] ?? ''}${qs}`;

  // project sub-routes
  m = path.match(/^\/api\/status-semanal\/(\d+)(\/notes|\/updates|\/activity|\/read)?$/);
  if (m) return `${base}/items/project/${m[1]}${m[2] ?? ''}${qs}`;

  return url;
}

// Wrapper over fetch that always includes credentials + auth header
export function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const rewritten = rewriteReviewUrl(url);
  const existingHeaders = options.headers
    ? (options.headers instanceof Headers
        ? Object.fromEntries((options.headers as Headers).entries())
        : (options.headers as Record<string, string>))
    : {};
  // When sending FormData, let the browser set the multipart boundary itself.
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  return fetch(rewritten, {
    ...options,
    credentials: 'include',
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...getAuthHeader(),
      ...existingHeaders,
    },
  });
}

// Default query function that will be used by react-query
export const defaultQueryFn = async ({ queryKey }: { queryKey: readonly unknown[] }) => {
  const rawUrl = Array.isArray(queryKey) ? queryKey[0] : queryKey;
  const url = rewriteReviewUrl(rawUrl as string);

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

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: defaultQueryFn,
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

// Function to get a query function with custom error handling
export function getQueryFn({ on401 = "throw" }: FetcherOptions = {}) {
  return async ({ queryKey }: { queryKey: readonly unknown[] }) => {
    const rawUrl = Array.isArray(queryKey) ? queryKey[0] : queryKey;
    const url = rewriteReviewUrl(rawUrl as string);

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
  const url = rewriteReviewUrl(endpoint);

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
