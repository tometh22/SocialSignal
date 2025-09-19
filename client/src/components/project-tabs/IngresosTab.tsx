import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DollarSign, AlertTriangle } from 'lucide-react';
import { useCompleteProjectData } from '@/contexts/ProjectDataProvider';

// 🎯 INGRESOS TAB - usa datos de Ventas Tomi convertidos a USD según handoff
export default function IngresosTab() {
  const { data: completeData, isLoading } = useCompleteProjectData();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!completeData) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          No se encontraron datos de ingresos para el período seleccionado.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Tabla de Ingresos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            Tabla de ingresos en desarrollo.
            <br />
            Mostrará filas de Ventas Tomi convertidas a USD.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}