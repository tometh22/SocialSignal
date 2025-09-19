import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, AlertTriangle } from 'lucide-react';
import { useCompleteProjectData } from '@/contexts/ProjectDataProvider';

// 🎯 TIEMPO TAB - usa complete-data para tracking temporal según handoff
export default function TiempoTab() {
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
          No se encontraron datos de tiempo para el período seleccionado.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            Funcionalidad de tiempo en desarrollo.
            <br />
            Integrará con /time-tracking endpoint.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}