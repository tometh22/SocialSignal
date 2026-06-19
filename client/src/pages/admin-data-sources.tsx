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
import { Database, FileSpreadsheet, RefreshCw, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

interface SystemConfig {
  id: number;
  configKey: string;
  configValue: number;
  description?: string;
}

interface RebuildResult {
  periodKey?: string;
  inserted?: number;
  updated?: number;
  errors: string[];
  executionTimeMs?: number;
  // range mode
  periods?: string[];
  totalInserted?: number;
  totalUpdated?: number;
  results?: Array<{ periodKey: string; inserted: number; updated: number; errors: string[]; executionTimeMs: number }>;
}

export default function AdminDataSources() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rebuildMode, setRebuildMode] = useState<'single' | 'range'>('single');
  const [rebuildPeriod, setRebuildPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [rebuildFrom, setRebuildFrom] = useState('');
  const [rebuildTo, setRebuildTo] = useState('');
  const [rebuildResult, setRebuildResult] = useState<RebuildResult | null>(null);

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
    mutationFn: (body: object) =>
      apiRequest('/internal/rebuild-labor-from-app', { method: 'POST', body }) as Promise<RebuildResult>,
    onSuccess: (data: RebuildResult) => {
      setRebuildResult(data);
      const inserted = data.totalInserted ?? data.inserted ?? 0;
      const updated = data.totalUpdated ?? data.updated ?? 0;
      const periods = data.periods?.length ?? 1;
      toast({
        title: `Rebuild completado`,
        description: `${periods > 1 ? `${periods} períodos — ` : ''}${inserted} insertados, ${updated} actualizados`,
      });
    },
    onError: () => {
      toast({ title: 'Error en el rebuild', variant: 'destructive' });
    },
  });

  const handleToggle = (checked: boolean) => {
    toggleMutation.mutate(checked ? 1 : 0);
  };

  const handleRebuild = () => {
    setRebuildResult(null);
    if (rebuildMode === 'range') {
      if (!/^\d{4}-\d{2}$/.test(rebuildFrom) || !/^\d{4}-\d{2}$/.test(rebuildTo)) {
        toast({ title: 'Rango inválido. Usá formato YYYY-MM en ambos campos', variant: 'destructive' });
        return;
      }
      if (rebuildFrom > rebuildTo) {
        toast({ title: '"Desde" debe ser anterior o igual a "Hasta"', variant: 'destructive' });
        return;
      }
      rebuildMutation.mutate({ periodFrom: rebuildFrom, periodTo: rebuildTo });
    } else {
      if (!/^\d{4}-\d{2}$/.test(rebuildPeriod)) {
        toast({ title: 'Período inválido. Usá formato YYYY-MM', variant: 'destructive' });
        return;
      }
      rebuildMutation.mutate({ period: rebuildPeriod });
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Fuente de Datos</h1>
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
          <div className="flex gap-2">
            <Button
              size="sm" variant={rebuildMode === 'single' ? 'default' : 'outline'}
              onClick={() => setRebuildMode('single')}
            >Período único</Button>
            <Button
              size="sm" variant={rebuildMode === 'range' ? 'default' : 'outline'}
              onClick={() => setRebuildMode('range')}
            >Rango de períodos</Button>
          </div>

          <div className="flex items-end gap-3 flex-wrap">
            {rebuildMode === 'single' ? (
              <div className="space-y-1">
                <Label htmlFor="rebuild-period">Período (YYYY-MM)</Label>
                <Input
                  id="rebuild-period"
                  value={rebuildPeriod}
                  onChange={(e) => setRebuildPeriod(e.target.value)}
                  placeholder="2026-06"
                  className="w-36 font-mono"
                />
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <Label htmlFor="rebuild-from">Desde</Label>
                  <Input
                    id="rebuild-from"
                    value={rebuildFrom}
                    onChange={(e) => setRebuildFrom(e.target.value)}
                    placeholder="2026-01"
                    className="w-32 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rebuild-to">Hasta</Label>
                  <Input
                    id="rebuild-to"
                    value={rebuildTo}
                    onChange={(e) => setRebuildTo(e.target.value)}
                    placeholder="2026-06"
                    className="w-32 font-mono"
                  />
                </div>
              </>
            )}
            <Button onClick={handleRebuild} disabled={rebuildMutation.isPending} className="gap-2">
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
                  {rebuildResult.periods
                    ? `${rebuildResult.periods.length} períodos (${rebuildResult.periods[0]}→${rebuildResult.periods[rebuildResult.periods.length - 1]}) — ${rebuildResult.totalInserted} insertados, ${rebuildResult.totalUpdated} actualizados`
                    : `Período ${rebuildResult.periodKey} — ${rebuildResult.inserted} insertados, ${rebuildResult.updated} actualizados`}
                </span>
                {rebuildResult.executionTimeMs && (
                  <span className="ml-auto flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="h-3 w-3" /> {rebuildResult.executionTimeMs}ms
                  </span>
                )}
              </div>
              {rebuildResult.errors.length > 0 && (
                <ul className="text-xs text-amber-700 space-y-0.5 pl-6 list-disc">
                  {rebuildResult.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                  {rebuildResult.errors.length > 10 && <li>...y {rebuildResult.errors.length - 10} errores más</li>}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card 3: Behavior table */}
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
