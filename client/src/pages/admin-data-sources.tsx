import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Database, FileSpreadsheet, RefreshCw, CheckCircle2, AlertTriangle, Clock, CalendarClock, GitCompare } from "lucide-react";

interface SystemConfig {
  id: number;
  configKey: string;
  configValue: number;
  description?: string;
}

interface RebuildResult {
  periodKey: string;
  inserted: number;
  updated: number;
  errors: string[];
  executionTimeMs: number;
}

export default function AdminDataSources() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rebuildPeriod, setRebuildPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [rebuildResult, setRebuildResult] = useState<RebuildResult | null>(null);
  const [cutoverDate, setCutoverDate] = useState('');
  const [recoFrom, setRecoFrom] = useState('');
  const [recoTo, setRecoTo] = useState('');

  const { data: configList = [], isLoading } = useQuery<SystemConfig[]>({
    queryKey: ['/api/admin/system-config'],
  });

  const hoursConfig = configList.find((c) => c.configKey === 'hours_data_source');
  const isAppMode = hoursConfig?.configValue === 1;

  const toggleMutation = useMutation({
    mutationFn: (newValue: 0 | 1) =>
      apiRequest('/api/admin/system-config', {
        method: 'POST',
        body: {
          configKey: 'hours_data_source',
          configValue: newValue,
          description: newValue === 1
            ? 'Fuente de horas: App (time_entries → fact_labor_month)'
            : 'Fuente de horas: Excel Maestro (Google Sheets → fact_labor_month)',
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/system-config'] });
      toast({ title: `Fuente de datos cambiada a ${isAppMode ? 'Excel Maestro' : 'Registros de la app'}` });
    },
    onError: () => {
      toast({ title: 'Error al cambiar la fuente de datos', variant: 'destructive' });
    },
  });

  const rebuildMutation = useMutation({
    mutationFn: (period: string) =>
      apiRequest('/internal/rebuild-labor-from-app', {
        method: 'POST',
        body: { period },
      }) as Promise<RebuildResult>,
    onSuccess: (data: RebuildResult) => {
      setRebuildResult(data);
      toast({
        title: `Rebuild completado`,
        description: `${data.inserted} insertados, ${data.updated} actualizados en ${data.executionTimeMs}ms`,
      });
    },
    onError: () => {
      toast({ title: 'Error en el rebuild', variant: 'destructive' });
    },
  });

  const { data: cutoverConfig } = useQuery<{ configValue: number; description?: string }>({
    queryKey: ['/api/admin/system-config/cutover-date'],
    queryFn: () => apiRequest('/api/admin/system-config/cutover-date', 'GET'),
  });
  const currentCutover = cutoverConfig?.description || null;

  const cutoverMutation = useMutation({
    mutationFn: (date: string) =>
      apiRequest('/api/admin/system-config/cutover-date', { method: 'POST', body: { cutoverDate: date } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/system-config/cutover-date'] });
      toast({ title: 'Fecha de corte guardada' });
    },
    onError: () => toast({ title: 'Error guardando fecha de corte', variant: 'destructive' }),
  });

  const { data: recoData, isLoading: recoLoading, refetch: recoRefetch } = useQuery({
    queryKey: ['/internal/reconciliation', recoFrom, recoTo],
    queryFn: () => apiRequest(`/internal/reconciliation?periodFrom=${recoFrom}&periodTo=${recoTo}`, 'GET'),
    enabled: false,
  });

  const handleToggle = (checked: boolean) => {
    toggleMutation.mutate(checked ? 1 : 0);
  };

  const handleRebuild = () => {
    if (!/^\d{4}-\d{2}$/.test(rebuildPeriod)) {
      toast({ title: 'Período inválido. Usá formato YYYY-MM', variant: 'destructive' });
      return;
    }
    setRebuildResult(null);
    rebuildMutation.mutate(rebuildPeriod);
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Fuente de Datos</h1>
        <p className="text-sm text-slate-500 mt-1">
          Controla cómo se puebla <code className="bg-slate-100 px-1 rounded text-xs">fact_labor_month</code>, la tabla que alimenta todos los analytics de horas.
        </p>
      </div>

      {/* Card 1: Toggle */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-slate-600" />
              <CardTitle className="text-base">Fuente de datos de horas</CardTitle>
            </div>
            {isLoading ? (
              <Badge variant="outline" className="text-xs">Cargando...</Badge>
            ) : isAppMode ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">App activa</Badge>
            ) : (
              <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Excel activo</Badge>
            )}
          </div>
          <CardDescription>
            El toggle cambia qué proceso escribe en <code className="text-xs">fact_labor_month</code>. Los analytics siempre leen de ahí.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className={`h-5 w-5 ${!isAppMode ? 'text-blue-600' : 'text-slate-400'}`} />
              <div>
                <p className={`font-medium text-sm ${!isAppMode ? 'text-slate-900' : 'text-slate-400'}`}>
                  Excel Maestro
                </p>
                <p className="text-xs text-slate-500">Google Sheets → sot-etl.ts → fact_labor_month</p>
              </div>
            </div>
            <Switch
              checked={isAppMode}
              onCheckedChange={handleToggle}
              disabled={toggleMutation.isPending || isLoading}
            />
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className={`font-medium text-sm ${isAppMode ? 'text-slate-900' : 'text-slate-400'}`}>
                  Registros de la app
                </p>
                <p className="text-xs text-slate-500">time_entries → rebuild manual → fact_labor_month</p>
              </div>
              <Database className={`h-5 w-5 ${isAppMode ? 'text-emerald-600' : 'text-slate-400'}`} />
            </div>
          </div>

          {!isAppMode && (
            <p className="text-xs text-blue-600 bg-blue-50 rounded p-3">
              Modo Excel activo. Los analytics usan los datos del Excel Maestro importado. El equipo aún no necesita cargar horas en la app.
            </p>
          )}
          {isAppMode && (
            <p className="text-xs text-emerald-700 bg-emerald-50 rounded p-3">
              Modo App activo. Usá el panel de Reconstrucción para que los analytics reflejen las horas cargadas en la app.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Card 2: Rebuild */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-slate-600" />
            <CardTitle className="text-base">Reconstruir período desde time_entries</CardTitle>
          </div>
          <CardDescription>
            Corre el ETL de app-mode para un período específico. Sobreescribe los datos de ese período en <code className="text-xs">fact_labor_month</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="rebuild-period">Período (YYYY-MM)</Label>
              <Input
                id="rebuild-period"
                value={rebuildPeriod}
                onChange={(e) => setRebuildPeriod(e.target.value)}
                placeholder="2025-06"
                className="w-36 font-mono"
              />
            </div>
            <Button
              onClick={handleRebuild}
              disabled={rebuildMutation.isPending}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${rebuildMutation.isPending ? 'animate-spin' : ''}`} />
              {rebuildMutation.isPending ? 'Reconstruyendo...' : 'Reconstruir'}
            </Button>
          </div>

          {rebuildResult && (
            <div className={`rounded-lg border p-4 space-y-2 ${rebuildResult.errors.length > 0 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
              <div className="flex items-center gap-2">
                {rebuildResult.errors.length > 0
                  ? <AlertTriangle className="h-4 w-4 text-amber-600" />
                  : <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                }
                <span className="font-medium text-sm">
                  Período {rebuildResult.periodKey} — {rebuildResult.inserted} insertados, {rebuildResult.updated} actualizados
                </span>
                <span className="ml-auto flex items-center gap-1 text-xs text-slate-500">
                  <Clock className="h-3 w-3" /> {rebuildResult.executionTimeMs}ms
                </span>
              </div>
              {rebuildResult.errors.length > 0 && (
                <ul className="text-xs text-amber-700 space-y-0.5 pl-6 list-disc">
                  {rebuildResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card 3: Cutover date */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-slate-600" />
            <CardTitle className="text-base">Fecha de corte del modo App</CardTitle>
          </div>
          <CardDescription>
            Protege los datos históricos del Excel. El rebuild en modo App no puede sobrescribir períodos anteriores a esta fecha.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            {currentCutover ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                Corte activo: {currentCutover}
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                Sin fecha de corte — historial vulnerable
              </Badge>
            )}
          </div>
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="cutover-date">Fecha de corte (YYYY-MM)</Label>
              <Input
                id="cutover-date"
                value={cutoverDate}
                onChange={(e) => setCutoverDate(e.target.value)}
                placeholder="2026-01"
                className="w-36 font-mono"
              />
            </div>
            <Button
              onClick={() => cutoverMutation.mutate(cutoverDate)}
              disabled={cutoverMutation.isPending || !cutoverDate}
              className="gap-2"
            >
              <CalendarClock className="h-4 w-4" />
              {cutoverMutation.isPending ? 'Guardando...' : 'Guardar fecha de corte'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card 4: Reconciliation */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-slate-600" />
            <CardTitle className="text-base">Reconciliación de datos</CardTitle>
          </div>
          <CardDescription>
            Compara los datos del Excel con los registros de la app para detectar discrepancias antes de migrar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1">
              <Label htmlFor="reco-from">Desde</Label>
              <Input
                id="reco-from"
                value={recoFrom}
                onChange={(e) => setRecoFrom(e.target.value)}
                placeholder="2026-01"
                className="w-32 font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="reco-to">Hasta</Label>
              <Input
                id="reco-to"
                value={recoTo}
                onChange={(e) => setRecoTo(e.target.value)}
                placeholder="2026-06"
                className="w-32 font-mono"
              />
            </div>
            <Button
              onClick={() => recoRefetch()}
              disabled={recoLoading || !recoFrom || !recoTo}
              className="gap-2"
            >
              <GitCompare className={`h-4 w-4 ${recoLoading ? 'animate-spin' : ''}`} />
              {recoLoading ? 'Comparando...' : 'Comparar'}
            </Button>
          </div>

          {recoData && Array.isArray(recoData) && recoData.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Filas Excel</TableHead>
                  <TableHead className="text-right">Horas Excel</TableHead>
                  <TableHead className="text-right">Filas App</TableHead>
                  <TableHead className="text-right">Horas App</TableHead>
                  <TableHead className="text-right">Δ Horas %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(recoData as Array<{
                  period: string;
                  excelRows: number;
                  excelHours: number;
                  appRows: number;
                  appHours: number;
                  deltaPct: number;
                }>).map((row) => {
                  const absDelta = Math.abs(row.deltaPct);
                  const deltaClass =
                    row.excelRows === 0
                      ? 'text-slate-400'
                      : absDelta < 5
                      ? 'text-emerald-700'
                      : absDelta < 15
                      ? 'text-amber-700'
                      : 'text-red-700';
                  return (
                    <TableRow key={row.period}>
                      <TableCell className="font-mono text-sm">{row.period}</TableCell>
                      <TableCell className="text-right text-sm">{row.excelRows ?? '—'}</TableCell>
                      <TableCell className="text-right text-sm">{row.excelHours?.toFixed(1) ?? '—'}</TableCell>
                      <TableCell className="text-right text-sm">{row.appRows ?? '—'}</TableCell>
                      <TableCell className="text-right text-sm">{row.appHours?.toFixed(1) ?? '—'}</TableCell>
                      <TableCell className={`text-right text-sm font-medium ${deltaClass}`}>
                        {row.excelRows === 0 ? '—' : `${row.deltaPct >= 0 ? '+' : ''}${row.deltaPct.toFixed(1)}%`}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Card 5: Behavior table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Comportamiento por modo</CardTitle>
          <CardDescription>Qué funciona en cada configuración</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Funcionalidad</TableHead>
                <TableHead className="text-center">Excel Maestro</TableHead>
                <TableHead className="text-center">Registros de la app</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                {
                  feature: 'Dashboard horas / métricas operacionales',
                  excel: '✅ Funciona',
                  app: '✅ Tras rebuild del período',
                },
                {
                  feature: 'Team breakdown en analytics',
                  excel: '⚠️ Vacío (sin time_entries)',
                  app: '✅ Poblado',
                },
                {
                  feature: 'targetHours (eficiencia planificada)',
                  excel: '✅ Del Excel',
                  app: '⚠️ Siempre 0',
                },
                {
                  feature: 'Capacity dashboard',
                  excel: '⚠️ Parcial',
                  app: '✅ Completo',
                },
                {
                  feature: 'Rebuild automático',
                  excel: '✅ Al importar el Excel',
                  app: '🔘 Manual desde esta página',
                },
              ].map((row) => (
                <TableRow key={row.feature}>
                  <TableCell className="text-sm">{row.feature}</TableCell>
                  <TableCell className={`text-center text-sm ${!isAppMode ? 'font-medium' : ''}`}>{row.excel}</TableCell>
                  <TableCell className={`text-center text-sm ${isAppMode ? 'font-medium' : ''}`}>{row.app}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
