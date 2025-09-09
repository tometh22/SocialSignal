import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Route, Redirect, RouteProps } from "wouter";

interface ProtectedRouteProps extends RouteProps {
  component: React.ComponentType<any>;
}

export function ProtectedRoute({
  path,
  component: Component,
  children,
  ...rest
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  console.log('🔍 ProtectedRoute (' + (path || 'unknown') + '):', { user: !!user, isLoading: loading });

  return (
    <Route path={path}>
      {(() => {
        // Mostrar loading mientras se verifica la autenticación
        if (loading) {
          return (
            <div className="flex items-center justify-center min-h-screen">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          );
        }

        // Solo redirigir si no hay usuario Y no está cargando
        if (!user && !loading) {
          console.log(`🚫 No user found, redirecting to /auth from ${path}`);
          return <Redirect to="/auth" />;
        }

        // Si hay usuario, renderizar el componente
        if (user) {
          console.log(`✅ User found, rendering component for ${path}`);
          return <Component {...rest} />;
        }

        // Estado intermedio, mostrar loading
        return (
          <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        );
      })()}
    </Route>
  );
}