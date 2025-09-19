import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Cog, AlertTriangle } from 'lucide-react';
import { useCompleteProjectData } from '@/contexts/ProjectDataProvider';

// 🎯 OPERACIONAL TAB - datos operacionales y recomendaciones según handoff
export default function OperacionalTab() {
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
          No se encontraron datos operacionales para el período seleccionado.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cog className="h-5 w-5" />
            Datos Operacionales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            Vista operacional en desarrollo.
            <br />
            Incluirá recomendaciones automáticas y datos operacionales.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}