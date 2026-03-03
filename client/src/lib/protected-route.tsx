import { useAuth } from "@/hooks/use-auth";
import { usePermissions, AppSection } from "@/hooks/use-permissions";
import { Loader2 } from "lucide-react";
import { Route, Redirect, RouteProps } from "wouter";

interface ProtectedRouteProps extends RouteProps {
  component: React.ComponentType<any>;
  requiredPermission?: AppSection;
}

export function ProtectedRoute({
  path,
  component: Component,
  requiredPermission,
  children,
  ...rest
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { hasPermission, getFirstAllowedRoute } = usePermissions();

  if (loading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  if (!user && !loading) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  if (user && requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <Route path={path}>
        <Redirect to="/unauthorized" />
      </Route>
    );
  }

  if (user) {
    return <Route path={path} component={Component} {...rest} />;
  }

  return (
    <Route path={path}>
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </Route>
  );
}
