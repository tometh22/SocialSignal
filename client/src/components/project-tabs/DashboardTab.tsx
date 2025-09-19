import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  DollarSign, 
  Users, 
  Clock, 
  TrendingUp, 
  AlertTriangle,
  Target,
  Zap
} from 'lucide-react';
import { useCompleteProjectData } from '@/contexts/ProjectDataProvider';

// 🎯 DASHBOARD TAB - usa /complete-data endpoint según handoff
export default function DashboardTab() {
  const { data: completeData, isLoading } = useCompleteProjectData();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
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
      </div>
    );
  }

  if (!completeData?.summary) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          No se encontraron datos del proyecto para el período seleccionado.
        </AlertDescription>
      </Alert>
    );
  }

  const { summary } = completeData;
  const {
    activeMembers = 0,
    totalHours = 0,
    efficiencyPct = 0,
    teamCostUSD = 0,
    revenueUSD = 0,
    markupUSD = 0,
    emptyStates = {},
    hasData = {}
  } = summary;

  // 🎯 CÁLCULOS DERIVADOS según handoff
  const markup = revenueUSD > 0 ? (revenueUSD / (teamCostUSD || 1)) : 0;
  const marginPct = revenueUSD > 0 ? ((markupUSD / revenueUSD) * 100) : 0;
  const roiPct = teamCostUSD > 0 ? ((markupUSD / teamCostUSD) * 100) : 0;

  // 🎯 ESTADO BANNERS según handoff
  const showCostsBanner = emptyStates.costos || !hasData.costos;
  const showIncomeBanner = emptyStates.ingresos || !hasData.ingresos;

  return (
    <div className="space-y-6">
      {/* 🚨 BANNERS DE ESTADOS VACÍOS */}
      {showCostsBanner && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Sin datos de Excel MAESTRO para el período seleccionado.
          </AlertDescription>
        </Alert>
      )}

      {showIncomeBanner && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Sin ingresos detectados para el período seleccionado.
          </AlertDescription>
        </Alert>
      )}

      {/* 🎯 MÉTRICAS PRINCIPALES */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-revenue">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-revenue">
              ${revenueUSD.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Período: {summary.period}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-costs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costos</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-costs">
              ${teamCostUSD.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Base: {summary.basis}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-markup">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Markup</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-markup">
              {markup.toFixed(2)}x
            </div>
            <p className="text-xs text-muted-foreground">
              Ganancia: ${markupUSD.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-efficiency">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eficiencia</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-efficiency">
              {efficiencyPct.toFixed(1)}%
            </div>
            <Progress value={efficiencyPct} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* 🎯 MÉTRICAS SECUNDARIAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-team">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Equipo Activo</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-members">
              {activeMembers}
            </div>
            <p className="text-xs text-muted-foreground">miembros</p>
          </CardContent>
        </Card>

        <Card data-testid="card-hours">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Horas Trabajadas</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-hours">
              {totalHours.toFixed(1)}h
            </div>
            <p className="text-xs text-muted-foreground">total período</p>
          </CardContent>
        </Card>

        <Card data-testid="card-roi">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ROI</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-roi">
              {roiPct.toFixed(1)}%
            </div>
            <Badge variant={roiPct > 100 ? 'default' : 'secondary'}>
              {roiPct > 100 ? 'Rentable' : 'En pérdida'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* 🎯 RESUMEN EJECUTIVO */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen Ejecutivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Período:</span> {summary.period}
            </div>
            <div>
              <span className="font-medium">Base:</span> {summary.basis}
            </div>
            <div>
              <span className="font-medium">Margen:</span> {marginPct.toFixed(1)}%
            </div>
            <div>
              <span className="font-medium">Estado:</span>{' '}
              <Badge variant={markup > 2 ? 'default' : markup > 1 ? 'secondary' : 'destructive'}>
                {markup > 2 ? 'Excelente' : markup > 1 ? 'Bueno' : 'Crítico'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}