import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MonthlyReconciliationReport } from "@shared/monthly-reconciliation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompactPageHeader } from "@/components/ui/compact-page-header";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { PageShell } from "@/components/ui/page-shell";
import { ToolbarPanel } from "@/components/ui/toolbar-panel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, TrendingUp, Target } from "lucide-react";

const money = (value: number | null | undefined) => value == null ? "Sin datos"
  : `USD ${value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
interface Response { periodos: string[]; periodo: string | null; report?: MonthlyReconciliationReport }

export default function RendimientoPage() {
  const [period, setPeriod] = useState<string | null>(null);
  const [client, setClient] = useState("__all");
  const [basis, setBasis] = useState<"monthly" | "project">("monthly");
  const { data, isLoading, error, refetch } = useQuery<Response>({
    queryKey: [period ? `/api/v2/executive/rendimiento?period=${period}` : "/api/v2/executive/rendimiento"],
  });
  const report = data?.report;
  const clients = useMemo(() => Array.from(new Set([
    ...(report?.rows ?? []).map(row => row.clientName), ...(report?.followup ?? []).map(row => row.clientName),
  ])).sort(), [report]);
  const rows = (report?.rows ?? []).filter(row => client === "__all" || row.clientName === client);
  const followup = (report?.followup ?? []).filter(row => client === "__all" || row.clientName === client);
  const sales = rows.reduce((sum, row) => sum + row.revenueUsd, 0);
  const direct = rows.every(row => row.directCostUsd != null) ? rows.reduce((sum, row) => sum + row.directCostUsd!, 0) : null;
  const profit = direct == null ? null : sales - direct;
  return <PageShell>
    <CompactPageHeader title="Rendimiento" description="Ventas y costos mensuales conciliados. Seguimiento acumulado de proyectos por separado." />
    <ToolbarPanel>
      <Select value={period ?? data?.periodo ?? ""} onValueChange={setPeriod}>
        <SelectTrigger className="w-40" aria-label="Período"><SelectValue placeholder="Período" /></SelectTrigger>
        <SelectContent>{(data?.periodos ?? []).map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={client} onValueChange={setClient}>
        <SelectTrigger className="w-52 ml-2" aria-label="Cliente"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="__all">Todos los clientes</SelectItem>{clients.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
      </Select>
      <div className="flex flex-wrap gap-2 mt-2">
        <Button variant={basis === "monthly" ? "default" : "outline"} onClick={() => setBasis("monthly")}>Detalle mensual</Button>
        <Button variant={basis === "project" ? "default" : "outline"} onClick={() => setBasis("project")}>Proyectos acumulados</Button>
      </div>
    </ToolbarPanel>
    {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
    {error && <div role="alert" className="space-y-2"><p>No se pudo leer una fuente del informe.</p><Button variant="outline" onClick={() => refetch()}>Reintentar</Button></div>}
    {report && <div className="space-y-5">
      <Card data-testid="monthly-reconciliation"><CardHeader className="pb-2">
        <CardTitle className="text-base">Conciliación mensual · {report.periodKey}</CardTitle>
      </CardHeader><CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">Todos los clientes. Fuente: {report.source === "master" ? "Máster de seguimiento" : report.source === "cierre" ? "Cierre de Mind" : "Mind"}.
          Base de costos: {report.costBasis === "actual" ? "cargados en el mes" : report.costBasis === "estimated" ? "estimados" : "sin datos suficientes"}.</p>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><dt>Ventas del resumen</dt><dd className="font-medium tabular-nums">{money(report.totals.summarySalesUsd)}</dd></div>
          <div><dt>Ventas del detalle</dt><dd className="font-medium tabular-nums">{money(report.totals.salesUsd)}</dd></div>
          <div><dt>Diferencia de ventas</dt><dd className="font-medium tabular-nums">{money(report.totals.salesDifferenceUsd)}</dd></div>
          <div><dt>Diferencia de costos operativos</dt><dd className="font-medium tabular-nums">{money(report.totals.costsDifferenceUsd)}</dd></div>
        </dl>
        <p data-testid="reconciliation-status">{report.status === "matched" ? "El detalle mensual coincide con el resumen financiero."
          : report.status === "difference" ? "Hay diferencias entre el detalle y el resumen; el período requiere revisión." : "Faltan datos para comprobar la conciliación."}</p>
        <p className="text-muted-foreground">Esta comprobación concilia los totales de ventas y costos operativos. No acredita facturas emitidas ni aprobación del cierre. El Máster puede incluir ventas programadas.</p>
        {report.warnings.map((warning, index) => <p key={index} className="text-amber-700">{warning}</p>)}
      </CardContent></Card>
      {basis === "monthly" ? <>
        <MetricGrid>
          <MetricCard label="Ventas del mes" value={money(sales)} icon={<DollarSign />} detail="Selección de clientes" />
          <MetricCard label="Costos directos del mes" value={money(direct)} icon={<TrendingUp />} detail="Sin overhead ni costos de otros meses" />
          <MetricCard label="Contribución del mes" value={money(profit)} icon={<Target />} detail="Ventas menos costos directos" />
          <MetricCard label="EBIT de la empresa" value={money(report.totals.ebitUsd)} icon={<TrendingUp />} detail="Todos los clientes, con overhead" />
        </MetricGrid>
        <Card><CardHeader><CardTitle className="text-base">Detalle mensual por proyecto</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left">
            {["Cliente", "Proyecto", "Ventas del mes", "Costos directos del mes", "Contribución"].map(label => <th key={label} className="p-2 font-medium">{label}</th>)}
          </tr></thead><tbody>{rows.map(row => <tr key={row.key} className="border-b last:border-0">
            <td className="p-2">{row.clientName}</td><td className="p-2">{row.projectName}<div className="text-xs text-muted-foreground">{row.sourceRefs.join(" · ")}</div></td>
            <td className="p-2 tabular-nums">{money(row.revenueUsd)}</td><td className="p-2 tabular-nums">{money(row.directCostUsd)}</td>
            <td className="p-2 tabular-nums">{money(row.directCostUsd == null ? null : row.revenueUsd - row.directCostUsd)}</td>
          </tr>)}</tbody></table>{!rows.length && <p className="py-4 text-muted-foreground">Sin movimientos del período.</p>}
          <p className="mt-3 text-muted-foreground">Overhead de la empresa: {money(report.totals.overheadUsd)}. Costos operativos totales: {money(report.totals.operatingCostUsd)}.</p>
        </CardContent></Card>
      </> : <Card><CardHeader><CardTitle className="text-base">Seguimiento acumulado de proyectos</CardTitle></CardHeader><CardContent className="space-y-4 overflow-x-auto">
        <p className="text-sm text-muted-foreground">El mes es el del análisis. El valor del proyecto puede incluir cuotas futuras y los costos pueden abarcar varios meses. Los proyectos abiertos no se presentan como utilidad realizada.</p>
        {report.source === 'master' && <p className="text-sm">Markup del conjunto cerrado: {report.totals.closedProjectMarkup == null ? 'Sin datos' : `${report.totals.closedProjectMarkup.toFixed(2)}×`}. Referencia del resumen: {report.totals.summaryClosedProjectMarkup == null ? 'Sin datos' : `${report.totals.summaryClosedProjectMarkup.toFixed(2)}×`}. Se excluyen los proyectos abiertos o sin confirmar.</p>}
        <table className="w-full text-sm"><thead><tr className="border-b text-left">{["Cliente", "Proyecto", "Estado", "Valor del proyecto", "Costo acumulado", "Markup de cierre"].map(label => <th key={label} className="p-2 font-medium">{label}</th>)}</tr></thead>
          <tbody>{followup.map(row => <tr key={row.key} className="border-b last:border-0"><td className="p-2">{row.clientName}</td><td className="p-2">{row.projectName}</td>
            <td className="p-2"><Badge variant="outline">{row.status === "closed" ? "Cerrado" : row.status === "open" ? "Abierto" : "Sin confirmar"}</Badge></td>
            <td className="p-2 tabular-nums">{money(row.budgetUsd)}</td><td className="p-2 tabular-nums">{money(row.cumulativeCostUsd)}</td>
            <td className="p-2">{row.status === "closed" && row.budgetUsd != null && row.cumulativeCostUsd != null && row.cumulativeCostUsd > 0 ? `${(row.budgetUsd / row.cumulativeCostUsd).toFixed(2)}×` : "Pendiente"}</td>
          </tr>)}</tbody></table>
        {!followup.length && <p className="text-sm text-muted-foreground">No hay seguimiento acumulado en esta fuente para el período.</p>}
        {report.missingFollowup.length > 0 && <div className="text-sm"><p className="font-medium">Ventas del mes sin seguimiento acumulado:</p><ul className="list-disc pl-5">{report.missingFollowup.map((row,index) => <li key={index}>{row.clientName} · {row.projectName}: {money(row.revenueUsd)}</li>)}</ul><p className="text-muted-foreground">Estas ventas ya están incluidas en el detalle mensual. Su cierre de proyecto sigue pendiente de confirmar.</p></div>}
      </CardContent></Card>}
    </div>}
  </PageShell>;
}
