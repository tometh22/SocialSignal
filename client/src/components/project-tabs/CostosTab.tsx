import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DollarSign, AlertTriangle } from 'lucide-react';
import { useDeviationAnalysis } from '@/contexts/ProjectDataProvider';

// 🎯 COSTOS TAB - reutiliza deviation-analysis (basis ECON) según handoff
export default function CostosTab() {
  const { data: deviationData, isLoading } = useDeviationAnalysis();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!deviationData) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          No se encontraron datos de costos para el período seleccionado.
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
            Tabla de Costos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            Tabla de costos en desarrollo.
            <br />
            Usará datos de deviation-analysis para totales y desglose.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}