import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User as UserType, InsertUser } from "@shared/schema";
import { apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: UserType | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<UserType, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<UserType, Error, InsertUser>;
  login: (email: string, password: string) => Promise<UserType>;
  register: (userData: InsertUser) => Promise<UserType>;
  logout: () => Promise<void>;
  loading: boolean;
};

type LoginData = {
  email: string;
  password: string;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  // Consulta al servidor para verificar la sesión actual
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/current-user"],
    queryFn: async (): Promise<UserType | null> => {
      try {
        console.log('🔍 Fetching current user...');
        
        const response = await fetch("/api/current-user", {
          credentials: 'include',
          method: 'GET',
          cache: 'no-cache',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          },
        });

        console.log('🔍 Response status:', response.status);

        if (!response.ok) {
          if (response.status === 401) {
            console.log('🔒 User not authenticated');
            localStorage.removeItem('tempUserId');
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

  // Mutación para el inicio de sesión
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
      console.log('🔐 Login response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error de autenticación');
      }

      const userData = await response.json();
      console.log('✅ Login successful for:', credentials.email);
      console.log('✅ User data:', userData);

      return userData;
    },
    onSuccess: (userData) => {
      console.log('✅ Login mutation success, setting user data...');
      
      // Establecer inmediatamente los datos del usuario en el cache
      queryClient.setQueryData(["/api/current-user"], userData);
      
      // Invalidar para forzar una nueva consulta
      queryClient.invalidateQueries({ queryKey: ["/api/current-user"] });
      
      console.log('🚀 Login successful, user data set in cache');
      
      toast({
        title: "Inicio de sesión exitoso",
        description: `Bienvenido ${userData.firstName}`,
        variant: "default",
      });

      // Redirect automático al dashboard después del login
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    },
    onError: (error) => {
      console.error('❌ Login mutation error:', error);
    },
  });

  // Mutación para el registro de usuario
  const registerMutation = useMutation<UserType, Error, InsertUser>({
    mutationFn: async (userData) => {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
        credentials: "include"
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Error al registrarse" }));
        throw new Error(errorData.message || "Error al registrarse");
      }

      return await response.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/current-user"], user);
      toast({
        title: "Registro exitoso",
        description: `Bienvenido ${user.firstName} ${user.lastName}`,
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: "Error al registrarse",
        description: error.message || "No se pudo crear la cuenta",
        variant: "destructive",
      });
    },
  });

  // Mutación para el cierre de sesión
  const logoutMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      const response = await fetch("/api/logout", {
        method: "POST",
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error("Error al cerrar sesión");
      }
    },
    onSuccess: () => {
      console.log('🚪 Logout successful, clearing user data...');
      
      // Limpiar datos locales específicos
      localStorage.removeItem('tempUserId');
      
      // Limpiar datos del cache de queries
      queryClient.setQueryData(["/api/current-user"], null);
      queryClient.clear();
      
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión correctamente",
        variant: "default",
      });

      // Redirect inmediato a la página de autenticación
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

  // Create stable callback functions
  const login = useCallback(async (email: string, password: string) => {
    return loginMutation.mutateAsync({ email, password });
  }, [loginMutation]);

  const register = useCallback(async (userData: InsertUser) => {
    return registerMutation.mutateAsync(userData);
  }, [registerMutation]);

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
        registerMutation,
        login,
        register,
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