import { createContext, ReactNode, useContext } from "react";
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
};

type LoginData = {
  email: string;
  password: string;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  // Consulta al servidor para verificar la sesión actual
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<UserType | null>({
    queryKey: ["/api/current-user"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/current-user", {
          credentials: "include"
        });
        
        if (response.status === 401) {
          return null;
        }
        
        if (!response.ok) {
          throw new Error("Error al obtener datos del usuario");
        }
        
        return await response.json();
      } catch (error) {
        console.error("Error al obtener sesión:", error);
        return null;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchInterval: 2 * 60 * 1000, // Refrescar cada 2 minutos
  });

  // Mutación para el inicio de sesión
  const loginMutation = useMutation<UserType, Error, LoginData>({
    mutationFn: async (credentials: LoginData) => {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
        credentials: "include"
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Error al iniciar sesión" }));
        throw new Error(errorData.message || "Error al iniciar sesión");
      }

      return await response.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/current-user"], user);
      toast({
        title: "Inicio de sesión exitoso",
        description: `Bienvenido ${user.firstName} ${user.lastName}`,
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: "Error al iniciar sesión",
        description: error.message || "Credenciales incorrectas",
        variant: "destructive",
      });
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
      queryClient.setQueryData(["/api/current-user"], null);
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión correctamente",
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: "Error al cerrar sesión",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
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