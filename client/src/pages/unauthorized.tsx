import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";

export default function UnauthorizedPage() {
  const { getFirstAllowedRoute } = usePermissions();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-4 text-center px-4">
      <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
        <ShieldX className="h-8 w-8 text-destructive" />
      </div>
      <h1 className="text-2xl font-bold text-foreground">Acceso restringido</h1>
      <p className="text-muted-foreground max-w-md">
        No tenés permiso para ver esta sección. Contactá al administrador si creés que esto es un error.
      </p>
      <Button onClick={() => window.location.href = getFirstAllowedRoute()}>
        Ir al inicio
      </Button>
    </div>
  );
}
