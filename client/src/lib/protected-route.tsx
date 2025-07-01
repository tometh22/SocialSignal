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

  console.log('🔍 ProtectedRoute (' + children?.props?.to || 'unknown' + '):', { user: !!user, isLoading: loading });

  if (loading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  if (!user) {
    console.log(`🚫 No user found, redirecting to /auth from ${path}`);
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  console.log(`✅ User found, rendering component for ${path}`);
  return <Route path={path} component={Component} {...rest} />;
}