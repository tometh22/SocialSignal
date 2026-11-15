import { useFinancePeriod } from "@/hooks/use-finance-period";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MonthlyReconciliationReport } from "@shared/monthly-reconciliation";
import { Card } from "@/components/ui/card";
import { FinanceHeader, FinanceLoading, StatusPill, periodLabel } from "@/components/finance/ui";
import { QueryError } from "@/components/query-error";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { PageShell } from "@/components/ui/page-shell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, TrendingDown, TrendingUp, Target } from "lucide-react";

const money = (value: number | null | undefined) => value == null ? "Sin datos"
  : `USD ${value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
interface Response { periodos: string[]; periodo: string | null; report?: MonthlyReconciliationReport }

export default function RendimientoPage() {
  const { period } = useFinancePeriod();
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
  const th = "px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground";
  const td = "px-4 py-3 align-top";
  const num = "px-4 py-3 text-right align-top tabular-nums whitespace-nowrap";
  const margin = (revenue: number, cost: number | null) => cost == null || revenue === 0 ? "—" : `${(((revenue - cost) / revenue) * 100).toFixed(1)}%`;
  const statusTone = report?.status === "matched" ? "success" as const : report?.status === "difference" ? "danger" as const : "warning" as const;
  const diffTone = (value: number | null | undefined) => value == null ? "text-muted-foreground" : Math.abs(value) < 0.005 ? "text-emerald-700" : "text-red-600";
  const segment = (selected: boolean) => `rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`;
  return <PageShell width="wide" spacing="compact">
    <FinanceHeader title="Contribución por proyecto" description={`Cuánto aporta cada proyecto en ${periodLabel(period)} después de sus costos directos. Los presupuestos acumulados se consultan por separado.`}
      actions={<>
        <div role="group" aria-label="Base del análisis" className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5">
          <button type="button" aria-pressed={basis === "monthly"} className={segment(basis === "monthly")} onClick={() => setBasis("monthly")}>Detalle mensual</button>
          <button type="button" aria-pressed={basis === "project"} className={segment(basis === "project")} onClick={() => setBasis("project")}>Proyectos acumulados</button>
        </div>
        <Select value={client} onValueChange={setClient}>
          <SelectTrigger className="h-9 w-52" aria-label="Cliente"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="__all">Todos los clientes</SelectItem>{clients.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
        </Select>
      </>} />
    {isLoading && <FinanceLoading label="Cargando contribución por proyecto" />}
    {error && <QueryError message="No se pudo leer una fuente del informe." retry={refetch} />}
    {report && <div className="space-y-5">
      <Card data-testid="monthly-reconciliation" className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">Conciliación con el resumen · {periodLabel(report.periodKey)}</h2>
            <StatusPill tone={statusTone}><span data-testid="reconciliation-status">{report.status === "matched" ? "El detalle mensual coincide con el resumen financiero."
              : report.status === "difference" ? "Hay diferencias entre el detalle y el resumen; el período requiere revisión." : "Faltan datos para comprobar la conciliación."}</span></StatusPill>
          </div>
          <p className="text-xs text-muted-foreground">Fuente: {report.source === "master" ? "Máster de seguimiento" : report.source === "cierre" ? "Cierre de Mind" : "Mind"} · Costos {report.costBasis === "actual" ? "cargados en el mes" : report.costBasis === "estimated" ? "estimados" : "sin datos suficientes"}</p>
        </div>
        <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-xs text-muted-foreground">Ventas del resumen</dt><dd className="font-semibold tabular-nums">{money(report.totals.summarySalesUsd)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Ventas del detalle</dt><dd className="font-semibold tabular-nums">{money(report.totals.salesUsd)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Diferencia de ventas</dt><dd className={`font-semibold tabular-nums ${diffTone(report.totals.salesDifferenceUsd)}`}>{money(report.totals.salesDifferenceUsd)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Diferencia de costos operativos</dt><dd className={`font-semibold tabular-nums ${diffTone(report.totals.costsDifferenceUsd)}`}>{money(report.totals.costsDifferenceUsd)}</dd></div>
        </dl>
        {report.warnings.length > 0 && <ul className="mt-3 space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{report.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
        <p className="mt-3 text-xs leading-5 text-muted-foreground">Concilia los totales de ventas y costos operativos. No acredita facturas emitidas ni aprobación del cierre. El Máster puede incluir ventas programadas.</p>
      </Card>
      {basis === "monthly" ? <>
        <MetricGrid>
          <MetricCard label="Ventas del mes" value={money(sales)} icon={<DollarSign />} tone="neutral" detail={client === "__all" ? "Todos los clientes" : client} />
          <MetricCard label="Costos directos del mes" value={money(direct)} icon={<TrendingDown />} tone="neutral" detail="Sin estructura ni costos de otros meses" />
          <MetricCard label="Contribución del mes" value={money(profit)} icon={<Target />} tone={profit == null ? "neutral" : profit >= 0 ? "success" : "danger"} detail={profit == null ? "Faltan costos directos" : `Margen de contribución ${margin(sales, direct)}`} />
          <MetricCard label="EBIT de la empresa" value={money(report.totals.ebitUsd)} icon={<TrendingUp />} tone="neutral" detail="Todos los clientes, con costos de estructura" />
        </MetricGrid>
        <Card className="overflow-hidden">
          <div className="border-b px-4 py-3 sm:px-5"><h2 className="text-base font-semibold">Detalle mensual por proyecto</h2><p className="text-xs text-muted-foreground">Costos de estructura de la empresa: {money(report.totals.overheadUsd)} · Costos operativos totales: {money(report.totals.operatingCostUsd)}</p></div>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/40"><tr className="border-b text-left">
            {["Cliente", "Proyecto"].map(label => <th key={label} className={th}>{label}</th>)}
            {["Ventas del mes", "Costos directos del mes", "Contribución", "Margen"].map(label => <th key={label} className={`${th} text-right`}>{label}</th>)}
          </tr></thead><tbody>{rows.map(row => { const contribution = row.directCostUsd == null ? null : row.revenueUsd - row.directCostUsd; return <tr key={row.key} className="border-b last:border-0 hover:bg-muted/30">
            <td className={`${td} font-medium`}>{row.clientName}</td><td className={td}>{row.projectName}<div className="text-xs text-muted-foreground">{row.sourceRefs.join(" · ")}</div></td>
            <td className={num}>{money(row.revenueUsd)}</td><td className={num}>{money(row.directCostUsd)}</td>
            <td className={`${num} font-medium ${contribution == null ? "text-muted-foreground" : contribution < 0 ? "text-red-600" : "text-emerald-700"}`}>{money(contribution)}</td>
            <td className={`${num} text-muted-foreground`}>{margin(row.revenueUsd, row.directCostUsd)}</td>
          </tr>; })}</tbody>
          {rows.length > 1 && <tfoot><tr className="border-t bg-muted/40 font-semibold"><td className={td} colSpan={2}>Total</td><td className={num}>{money(sales)}</td><td className={num}>{money(direct)}</td><td className={num}>{money(profit)}</td><td className={`${num} text-muted-foreground`}>{margin(sales, direct)}</td></tr></tfoot>}
          </table></div>{!rows.length && <p className="px-5 py-8 text-center text-sm text-muted-foreground">Sin movimientos del período.</p>}
        </Card>
      </> : <Card className="overflow-hidden">
        <div className="border-b px-4 py-3 sm:px-5"><h2 className="text-base font-semibold">Seguimiento acumulado de proyectos</h2>
          <p className="text-xs leading-5 text-muted-foreground">El mes es el del análisis. El valor del proyecto puede incluir cuotas futuras y los costos pueden abarcar varios meses. Los proyectos abiertos no se presentan como utilidad realizada.</p></div>
        {report.source === 'master' && <p className="border-b bg-muted/30 px-4 py-2.5 text-sm sm:px-5">Markup del conjunto cerrado: <strong className="tabular-nums">{report.totals.closedProjectMarkup == null ? 'Sin datos' : `${report.totals.closedProjectMarkup.toFixed(2)}×`}</strong> · Referencia del resumen: <strong className="tabular-nums">{report.totals.summaryClosedProjectMarkup == null ? 'Sin datos' : `${report.totals.summaryClosedProjectMarkup.toFixed(2)}×`}</strong>. Se excluyen los proyectos abiertos o sin confirmar.</p>}
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/40"><tr className="border-b text-left">{["Cliente", "Proyecto", "Estado"].map(label => <th key={label} className={th}>{label}</th>)}{["Valor del proyecto", "Costo acumulado", "Markup de cierre"].map(label => <th key={label} className={`${th} text-right`}>{label}</th>)}</tr></thead>
          <tbody>{followup.map(row => <tr key={row.key} className="border-b last:border-0 hover:bg-muted/30"><td className={`${td} font-medium`}>{row.clientName}</td><td className={td}>{row.projectName}</td>
            <td className={td}>{row.status === "closed" ? <StatusPill tone="success">Cerrado</StatusPill> : row.status === "open" ? <StatusPill tone="info">Abierto</StatusPill> : <StatusPill tone="warning">Sin confirmar</StatusPill>}</td>
            <td className={num}>{money(row.budgetUsd)}</td><td className={num}>{money(row.cumulativeCostUsd)}</td>
            <td className={`${num} ${row.status === "closed" ? "font-medium" : "text-muted-foreground"}`}>{row.status === "closed" && row.budgetUsd != null && row.cumulativeCostUsd != null && row.cumulativeCostUsd > 0 ? `${(row.budgetUsd / row.cumulativeCostUsd).toFixed(2)}×` : "Pendiente"}</td>
          </tr>)}</tbody></table></div>
        {!followup.length && <p className="px-5 py-8 text-center text-sm text-muted-foreground">No hay seguimiento acumulado en esta fuente para el período.</p>}
        {report.missingFollowup.length > 0 && <div className="border-t bg-amber-50/60 px-4 py-3 text-sm sm:px-5"><p className="font-medium text-amber-900">Ventas del mes sin seguimiento acumulado</p><ul className="mt-1 space-y-0.5">{report.missingFollowup.map((row,index) => <li key={index}>{row.clientName} · {row.projectName}: <span className="tabular-nums">{money(row.revenueUsd)}</span></li>)}</ul><p className="mt-1 text-xs text-muted-foreground">Estas ventas ya están incluidas en el detalle mensual. Su cierre de proyecto sigue pendiente de confirmar.</p></div>}
      </Card>}
    </div>}
  </PageShell>;
}
