import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calculator, Search } from 'lucide-react';
import { calculateFinancialScenario, matchesScenarioCost, type FinancialScenario } from '@shared/financial-scenario';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MetricCard, MetricGrid } from '@/components/ui/metric-card';

const money = (value: number | null) => value == null ? 'Sin datos' : new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(value);
const pageSize = 30;

export function CostScenario({ year }: { year: number }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [onlySelected, setOnlySelected] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [snapshot, setSnapshot] = useState<FinancialScenario>();
  const { data: remoteData, isLoading, error, refetch } = useQuery<FinancialScenario>({
    queryKey: [`/api/v2/executive/proyeccion/escenario?year=${year}`], enabled: open,
    refetchOnWindowFocus: false, staleTime: Infinity, gcTime: 0, refetchOnReconnect: false,
  });
  useEffect(() => { if (remoteData && !snapshot) setSnapshot(remoteData); }, [remoteData, snapshot]);
  const data = snapshot ?? remoteData;
  const result = useMemo(() => data ? calculateFinancialScenario(data, selected) : null, [data, selected]);
  const filtered = useMemo(() => (data?.costs ?? []).filter(cost => matchesScenarioCost(cost, search)
    && (!onlySelected || selected.has(cost.id))), [data, search, onlySelected, selected]);
  const selectable = filtered.filter(cost => cost.amountUsd != null);
  const matchedAmount = data ? calculateFinancialScenario(data, selectable.map(cost => cost.id)).excludedUsd : 0;
  const matchedSelected = selectable.filter(cost => selected.has(cost.id)).length;
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / pageSize) - 1));
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const monthLabels = new Map(data?.months.map(month => [month.periodKey, month.monthLabel]));
  const changeSearch = (value: string) => { setSearch(value); setPage(0); };
  const toggle = (ids: string[], exclude: boolean) => setSelected(previous => {
    const next = new Set(previous);
    ids.forEach(id => exclude ? next.add(id) : next.delete(id));
    return next;
  });

  return (
    <Card className="border-primary/20" data-testid="cost-scenario">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base"><Calculator className="h-4 w-4" /> Escenario sin reinversión</CardTitle>
            <p className="text-sm text-muted-foreground">Excluí conceptos de {year} y compará el resultado. La contabilidad original se conserva.</p>
          </div>
          <Button variant={open ? 'outline' : 'default'} onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="cost-scenario-content">
            {open ? 'Ocultar simulación' : 'Simular exclusiones'}
          </Button>
        </div>
      </CardHeader>
      {open && <CardContent id="cost-scenario-content" className="space-y-5">
        {isLoading && <p role="status" className="text-sm text-muted-foreground">Buscando conceptos y movimientos del año…</p>}
        {error && !data && <div role="alert" className="flex items-center gap-3 text-sm text-red-600">
          No se pudieron cargar los costos. <Button variant="outline" size="sm" onClick={() => void refetch()}>Reintentar</Button>
        </div>}
        {data && result && <>
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground space-y-1">
            <p>Simulación en USD: suma al resultado los gastos excluidos, manteniendo los ingresos y los demás gastos. No recalcula tasas impositivas.</p>
            <p>Para los meses del Máster se usa el detalle de Costos directos e indirectos o Costos estimados que coincide con Ventas menos EBIT. No se mezclan ambas bases ni se suman pagos de caja. IVA, impuestos y bonos respetan las fórmulas del Máster.</p>
          </div>

          {data.sourceReadAt && <p className="text-xs text-muted-foreground">Máster consultado: {new Date(data.sourceReadAt).toLocaleString('es-AR')}. Los importes quedan fijos durante esta simulación.</p>}
          {data.warnings?.map(warning => <p key={warning} role="alert" className="text-sm text-amber-800">{warning}</p>)}
          <MetricGrid minColumnWidth="190px" aria-live="polite">
            <MetricCard label="Gastos excluidos" value={money(result.excludedUsd)} data-testid="scenario-excluded"
              detail={`${result.selected.length} movimientos · ${new Set(result.selected.map(cost => cost.periodKey)).size} meses`} />
            <MetricCard label="Costo operativo ajustado" value={money(result.adjustedCostUsd)} data-testid="scenario-cost"
              detail={`Original: ${money(result.baseCostUsd)}`} />
            <MetricCard label="EBIT ajustado" value={money(result.adjustedEbitUsd)} data-testid="scenario-ebit"
              detail={`Original: ${money(result.baseEbitUsd)}`} tone={result.operatingExcludedUsd > 0 ? 'success' : 'neutral'} />
            <MetricCard label={result.netMonthCount === data.months.length ? 'Beneficio neto ajustado' : `Beneficio neto parcial (${result.netMonthCount}/${data.months.length} meses)`}
              value={money(result.adjustedNetProfitUsd)} data-testid="scenario-net"
              detail={`Original: ${money(result.baseNetProfitUsd)} · Cambio: ${money(result.netChangeUsd)}`}
              tone={result.netMonthCount < data.months.length ? 'warning' : 'neutral'} />
          </MetricGrid>
          {result.missingNetMonths.length > 0 && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            El beneficio neto no tiene un valor válido en {result.missingNetMonths.join(', ')}. La comparación de neto incluye solo los {result.netMonthCount} meses con datos válidos;
            las exclusiones de los otros meses sí se reflejan en costos y EBIT. No se presenta ese subtotal como beneficio anual.
          </p>}
          {result.negativeCostMonths.length > 0 && <p role="alert" className="text-sm text-red-700">
            Las exclusiones superan el costo operativo base en {result.negativeCostMonths.join(', ')}. Revisá que esos gastos estén incluidos en el resultado original.
          </p>}

          <div className="space-y-3">
            <label htmlFor="scenario-cost-search" className="block text-sm font-medium">Buscar conceptos en todo el año</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input id="scenario-cost-search" value={search} onChange={event => changeSearch(event.target.value)} className="pl-9"
                placeholder="Replit, Railway, OpenAI, Neon…" />
            </div>
            <div className="flex flex-wrap gap-2">
              {['Replit', 'Railway', 'OpenAI', 'Neon', 'Marketing'].map(term => <Button key={term} variant="outline" size="sm" onClick={() => changeSearch(term)}>{term}</Button>)}
            </div>
            <p className="text-xs text-muted-foreground">Busca también dentro de los consumos de tarjeta. Separá conceptos con comas para buscar varios a la vez. No se extrapolan cargos a meses sin detalle.</p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox aria-label="Excluir todas las coincidencias" disabled={!selectable.length}
                    checked={matchedSelected === selectable.length && selectable.length > 0 ? true : matchedSelected ? 'indeterminate' : false}
                    onCheckedChange={value => toggle(selectable.map(cost => cost.id), value === true)} />
                  Excluir todas las coincidencias ({selectable.length})
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={onlySelected} onCheckedChange={value => { setOnlySelected(value === true); setPage(0); }} />
                  Solo excluidos
                </label>
              </div>
              <Button variant="ghost" size="sm" disabled={!result.selected.length} onClick={() => { setSelected(new Set()); setOnlySelected(false); setPage(0); }}>Reincorporar todo</Button>
            </div>
            <p className="text-sm text-muted-foreground" role="status">{filtered.length} coincidencias · {new Set(filtered.map(cost => cost.periodKey)).size} meses · {money(matchedAmount)}</p>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm" aria-label="Conceptos para excluir">
              <thead className="bg-muted/50"><tr className="text-left">
                <th className="p-3 font-medium">Excluir</th><th className="p-3 font-medium">Mes</th>
                <th className="p-3 font-medium">Concepto y detalle</th><th className="p-3 font-medium">Fuente</th>
                <th className="p-3 text-right font-medium">Importe USD</th>
              </tr></thead>
              <tbody>
                {visible.map(cost => <tr key={cost.id} className={`border-t ${selected.has(cost.id) ? 'bg-primary/5' : ''}`}>
                  <td className="p-3"><Checkbox checked={selected.has(cost.id)} disabled={cost.amountUsd == null}
                    aria-label={`Excluir ${cost.description || cost.concept} · ${monthLabels.get(cost.periodKey)}`}
                    onCheckedChange={value => toggle([cost.id], value === true)} /></td>
                  <td className="p-3 whitespace-nowrap">{monthLabels.get(cost.periodKey)}</td>
                  <td className="p-3 min-w-[220px] max-w-lg">
                    <div className="font-medium">{cost.concept}</div>
                    {cost.description && <div className="break-words text-muted-foreground">{cost.description}</div>}
                    <div className="mt-1 text-xs text-muted-foreground">{cost.category}{cost.date ? ` · ${cost.date}` : ''}{cost.impact === 'net' ? ' · Solo afecta al neto' : cost.impact === 'ebit' ? ' · Solo afecta a costos y EBIT' : ''}</div>
                    {cost.amountUsd == null && <div className="text-xs text-amber-700">Falta importe o tipo de cambio; no se puede excluir.</div>}
                  </td>
                  <td className="p-3"><Badge variant="outline">{cost.source === 'ledger' ? 'Movimiento' : cost.source === 'master' ? 'Máster' : 'Estimado'}</Badge>{cost.sourceDetail && <div className="mt-1 text-xs text-muted-foreground">{cost.sourceDetail}</div>}</td>
                  <td className="p-3 text-right whitespace-nowrap tabular-nums">{money(cost.amountUsd)}</td>
                </tr>)}
                {!visible.length && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">
                  {data.costs.length ? 'No hay coincidencias. Probá otro nombre o quitá el filtro de excluidos.' : 'No hay conceptos cargados para este año.'}
                </td></tr>}
              </tbody>
            </table>
          </div>
          {filtered.length > pageSize && <div className="flex items-center justify-end gap-3 text-sm">
            <Button variant="outline" size="sm" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Anterior</Button>
            <span>Página {currentPage + 1} de {Math.ceil(filtered.length / pageSize)}</span>
            <Button variant="outline" size="sm" disabled={(currentPage + 1) * pageSize >= filtered.length} onClick={() => setPage(currentPage + 1)}>Siguiente</Button>
          </div>}
          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer text-sm font-medium">Comparación mes a mes</summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm" aria-label="Comparación mensual del escenario">
                <thead><tr className="text-right text-muted-foreground"><th className="p-2 text-left">Mes</th><th className="p-2">Excluido</th><th className="p-2">Costo original → ajustado</th><th className="p-2">EBIT original → ajustado</th><th className="p-2">Neto original → ajustado</th></tr></thead>
                <tbody>{result.months.map(month => <tr key={month.periodKey} className="border-t text-right tabular-nums">
                  <td className="p-2 text-left whitespace-nowrap">{month.monthLabel}</td><td className="p-2 whitespace-nowrap">{money(month.excludedUsd)}</td>
                  <td className="p-2 whitespace-nowrap">{money(month.costUsd)} → {money(month.adjustedCostUsd)}</td>
                  <td className="p-2 whitespace-nowrap">{money(month.ebitUsd)} → {money(month.adjustedEbitUsd)}</td>
                  <td className="p-2 whitespace-nowrap">{money(month.netProfitUsd)} → {money(month.adjustedNetProfitUsd)}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </details>
          <p className="text-xs text-muted-foreground">La selección dura mientras estás en esta página. Cambiar de año o salir reinicia el escenario.</p>
        </>}
      </CardContent>}
    </Card>
  );
}
