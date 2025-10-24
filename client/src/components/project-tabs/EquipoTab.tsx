import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Users, 
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  User,
  DollarSign,
  Clock
} from 'lucide-react';
import { useDeviationAnalysis } from '@/contexts/ProjectDataProvider';

// 🎯 EQUIPO TAB - usa /deviation-analysis endpoint según handoff
// v2.0 - Incluye segunda fila con costo ARS
export default function EquipoTab() {
  const { data: deviationData, isLoading } = useDeviationAnalysis();
  console.log('✅ EquipoTab v2.0 cargado - con segunda fila ARS');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!deviationData?.deviations) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          No se encontraron datos del análisis de desviaciones para el período seleccionado.
        </AlertDescription>
      </Alert>
    );
  }

  const { summary, deviations = [] } = deviationData;

  // 🎯 ESTADÍSTICAS DEL EQUIPO
  const totalMembers = deviations.length;
  const criticalDeviations = deviations.filter((d: any) => d.severity === 'critical').length;
  const overBudgetMembers = deviations.filter((d: any) => d.deviationPercentage > 0).length;
  const underBudgetMembers = deviations.filter((d: any) => d.deviationPercentage < 0).length;

  // 🎯 ORDENAMIENTO por criticidad según handoff
  const sortedDeviations = [...deviations].sort((a, b) => {
    const aSeverity = a.severity === 'critical' ? 3 : a.severity === 'high' ? 2 : a.severity === 'medium' ? 1 : 0;
    const bSeverity = b.severity === 'critical' ? 3 : b.severity === 'high' ? 2 : b.severity === 'medium' ? 1 : 0;
    return bSeverity - aSeverity || Math.abs(b.deviationPercentage) - Math.abs(a.deviationPercentage);
  });

  // 🎯 HELPER para severidad
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'high': return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'medium': return <TrendingUp className="h-4 w-4 text-yellow-500" />;
      default: return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-6">
      {/* 🎯 RESUMEN DEL EQUIPO */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card data-testid="card-total-members">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Miembros Activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-members">
              {totalMembers}
            </div>
            <p className="text-xs text-muted-foreground">con actividad registrada</p>
          </CardContent>
        </Card>

        <Card data-testid="card-actual-hours">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Horas Trabajadas (Asana)</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-actual-hours">
              {summary.totalHours?.toFixed(1)}h
            </div>
            <p className="text-xs text-muted-foreground">horas reales rastreadas</p>
          </CardContent>
        </Card>

        <Card data-testid="card-target-hours">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Horas Objetivo</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-target-hours">
              {deviations.reduce((sum: number, d: any) => sum + d.budgetedHours, 0).toFixed(1)}h
            </div>
            <p className="text-xs text-muted-foreground">horas presupuestadas</p>
          </CardContent>
        </Card>

        <Card data-testid="card-efficiency">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eficiencia</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-efficiency">
              {summary.efficiencyPct?.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">horas Asana vs objetivo</p>
          </CardContent>
        </Card>

        <Card data-testid="card-team-cost-usd">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costo del Equipo (USD)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-team-cost-usd">
              USD {summary.teamCostUSD?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">inversión total registrada</p>
          </CardContent>
        </Card>
      </div>

      {/* 🎯 SEGUNDA FILA: Costo en ARS y Estados */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card data-testid="card-team-cost-ars">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costo del Equipo (ARS)</CardTitle>
            <DollarSign className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600" data-testid="text-team-cost-ars">
              ARS {summary.teamCostARS?.toLocaleString('es-AR') || 0}
            </div>
            <p className="text-xs text-muted-foreground">sin convertir a dólares</p>
          </CardContent>
        </Card>

        <Card data-testid="card-critical-deviations">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Críticos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-critical-count">
              {criticalDeviations}
            </div>
            <p className="text-xs text-muted-foreground">sobrecosto crítico/subutilización</p>
          </CardContent>
        </Card>

        <Card data-testid="card-over-budget">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sobre Presup.</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600" data-testid="text-over-budget">
              {overBudgetMembers}
            </div>
            <p className="text-xs text-muted-foreground">alta eficiencia/análisis procesos</p>
          </CardContent>
        </Card>

        <Card data-testid="card-under-budget">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bajo Presup.</CardTitle>
            <TrendingDown className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-under-budget">
              {underBudgetMembers}
            </div>
            <p className="text-xs text-muted-foreground">ahorros dentro del rango</p>
          </CardContent>
        </Card>

        <Card data-testid="card-period">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Período</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="text-period">
              {summary.period}
            </div>
            <p className="text-xs text-muted-foreground">métricas clave rendimiento</p>
          </CardContent>
        </Card>
      </div>

      {/* 🎯 TABLA DE DESVIACIONES según handoff */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Análisis de Desviaciones del Equipo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sortedDeviations.map((deviation, index) => (
              <div
                key={`${deviation.personnelId}-${index}`}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                data-testid={`row-member-${deviation.personnelId}`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {getSeverityIcon(deviation.severity)}
                    <div>
                      <div className="font-medium" data-testid={`text-member-name-${deviation.personnelId}`}>
                        {deviation.personnelName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {deviation.alertType} • {deviation.deviationType}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {/* Horas */}
                  <div className="text-center">
                    <div className="text-sm text-gray-500">Horas</div>
                    <div className="font-medium">
                      <span data-testid={`text-actual-hours-${deviation.personnelId}`}>
                        {deviation.actualHours.toFixed(1)}
                      </span>
                      <span className="text-gray-400 mx-1">/</span>
                      <span data-testid={`text-budgeted-hours-${deviation.personnelId}`}>
                        {deviation.budgetedHours.toFixed(1)}
                      </span>
                    </div>
                  </div>

                  {/* Costo */}
                  <div className="text-center">
                    <div className="text-sm text-gray-500">Costo USD</div>
                    <div className="font-medium">
                      <span data-testid={`text-actual-cost-${deviation.personnelId}`}>
                        USD {deviation.actualCost.toFixed(0)}
                      </span>
                      <span className="text-gray-400 mx-1">/</span>
                      <span data-testid={`text-budgeted-cost-${deviation.personnelId}`}>
                        USD {deviation.budgetedCost.toFixed(0)}
                      </span>
                    </div>
                  </div>

                  {/* Desviación */}
                  <div className="text-center">
                    <div className="text-sm text-gray-500">Desviación</div>
                    <Badge 
                      variant={getSeverityColor(deviation.severity)}
                      data-testid={`badge-deviation-${deviation.personnelId}`}
                    >
                      {deviation.deviationPercentage > 0 ? '+' : ''}
                      {deviation.deviationPercentage.toFixed(1)}%
                    </Badge>
                  </div>

                  {/* Progreso */}
                  <div className="w-24">
                    <Progress 
                      value={Math.min((deviation.actualHours / deviation.budgetedHours) * 100, 100)}
                      className="h-2"
                    />
                    <div className="text-xs text-center mt-1 text-gray-500">
                      {((deviation.actualHours / deviation.budgetedHours) * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {deviations.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No hay datos de desviaciones para el período seleccionado.
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}