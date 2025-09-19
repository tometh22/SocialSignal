import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import { useCompleteProjectData } from '@/contexts/ProjectDataProvider';

// 🎯 FINANCIERO TAB - análisis financiero completo según handoff
export default function FinancieroTab() {
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
          No se encontraron datos financieros para el período seleccionado.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Análisis Financiero
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            Análisis financiero en desarrollo.
            <br />
            Incluirá Revenue, Costs, Margin, Markup, ROI, Budget Utilization.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}