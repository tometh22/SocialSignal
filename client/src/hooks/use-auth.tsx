import { createContext, useContext, useCallback, ReactNode } from 'react';
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User as UserType } from "@shared/schema";
import { queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: UserType | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<UserType, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  login: (email: string, password: string) => Promise<UserType>;
  logout: () => Promise<void>;
  loading: boolean;
};

type LoginData = {
  email: string;
  password: string;
};

const AuthContext = createContext<AuthContextType | null>(null);

function getAuthHeader(): Record<string, string> {
  const token = sessionStorage.getItem('auth_token');
  return token ? { 'Authorization': `Session ${token}` } : {};
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/current-user"],
    queryFn: async (): Promise<UserType | null> => {
      try {
        const response = await fetch("/api/current-user", {
          credentials: 'include',
          method: 'GET',
          cache: 'no-cache',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            ...getAuthHeader(),
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            return null;
          }
          const errorText = await response.text();
          console.error('❌ HTTP error:', response.status, errorText);
          return null;
        }

        const userData = await response.json();
        console.log('✅ User data fetched:', userData.email);
        return userData;
      } catch (error) {
        console.error('❌ Error fetching user:', error);
        return null;
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchInterval: false,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }): Promise<UserType> => {
      console.log('🔐 Attempting login for:', credentials.email);

      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(credentials),
      });

      console.log('🔐 Login response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Error de autenticación');
      }

      const userData = await response.json();
      console.log('✅ Login successful for:', credentials.email);

      // Persist session token for environments where cookies don't propagate (e.g. Replit preview iframe)
      if (userData.sessionToken) {
        sessionStorage.setItem('auth_token', userData.sessionToken);
      }

      return userData;
    },
    onSuccess: (userData) => {
      console.log('✅ Login mutation success, setting user data...');

      // Strip sessionToken from cached user data — it's only needed for headers
      const { sessionToken, ...userForCache } = userData as any;
      queryClient.setQueryData(["/api/current-user"], userForCache);

      toast({
        title: "Inicio de sesión exitoso",
        description: `Bienvenido ${userData.firstName}`,
        variant: "default",
      });

      const getFirstRoute = (user: any): string => {
        if (user.role === 'external_provider') return '/provider/dashboard';
        if (user.isAdmin) return '/';
        const perms: string[] = user.permissions || [];
        if (perms.includes('dashboard')) return '/';
        if (perms.includes('crm')) return '/crm';
        if (perms.includes('quotations')) return '/quotations';
        if (perms.includes('projects')) return '/active-projects';
        if (perms.includes('finance')) return '/statistics';
        return '/my-invoices';
      };

      setTimeout(() => {
        window.location.href = getFirstRoute(userData);
      }, 100);
    },
    onError: (error) => {
      console.error('❌ Login mutation error:', error);
    },
  });

  const logoutMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      const response = await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
        headers: {
          ...getAuthHeader(),
        },
      });

      if (!response.ok) {
        throw new Error("Error al cerrar sesión");
      }
    },
    onSuccess: () => {
      sessionStorage.removeItem('auth_token');
      queryClient.setQueryData(["/api/current-user"], null);
      queryClient.clear();

      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión correctamente",
        variant: "default",
      });

      setTimeout(() => {
        window.location.href = "/auth";
      }, 300);
    },
    onError: (error) => {
      toast({
        title: "Error al cerrar sesión",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const login = useCallback(async (email: string, password: string) => {
    return loginMutation.mutateAsync({ email, password });
  }, [loginMutation]);

  const logout = useCallback(async () => {
    return logoutMutation.mutateAsync();
  }, [logoutMutation]);

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        login,
        logout,
        loading: isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe ser usado dentro de un AuthProvider");
  }
  return context;
}
