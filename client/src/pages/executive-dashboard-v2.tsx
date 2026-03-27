/**
 * Executive Dashboard V2 - Reads directly from Google Sheets
 * No ETL, no DB intermediary. Same data source as Looker Studio.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, TrendingDown, DollarSign, BarChart3, Wallet, ArrowDown, ArrowUp, AlertTriangle, Lightbulb, Target, Shield } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend, ReferenceLine, ComposedChart, Line } from "recharts";

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtShort = (n: number | null | undefined) =>
  n == null ? "—" : `$${n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const fmtPct = (n: number | null | undefined) =>
  n == null ? "—" : `${n.toFixed(2)}%`;

export default function ExecutiveDashboardV2() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  const { data, isLoading, refetch, isFetching } = useQuery<any>({
    queryKey: ["/api/v2/executive/dashboard", selectedYear, selectedMonth],
    queryFn: () =>
      fetch(`/api/v2/executive/dashboard?year=${selectedYear}&month=${selectedMonth}`, {
        credentials: "include",
      }).then((r) => {
        if (!r.ok) throw new Error("Error al cargar datos");
        return r.json();
      }),
    staleTime: 60_000,
  });

  const d = data?.filtered;
  const allData = data?.data || [];
  const trend = allData.slice(-12);

  const kpiColor = (val: number | null | undefined, good: number) => {
    if (val == null) return "text-slate-500";
    return val >= good ? "text-emerald-700" : val >= 0 ? "text-amber-600" : "text-red-600";
  };

  const runwayMonths = d?.activoLiquido != null && d?.ebitOperativo != null && d.ebitOperativo < 0
    ? Math.abs(d.activoLiquido / d.ebitOperativo)
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Ejecutivo</h1>
          <p className="text-sm text-muted-foreground">
            Datos en tiempo real desde Google Sheets — misma fuente que Looker Studio
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-center space-y-2">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Consultando Google Sheets...</p>
          </div>
        </div>
      ) : !d ? (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
            <p className="font-medium">No hay datos para {MONTHS[selectedMonth - 1]} {selectedYear}</p>
            <p className="text-sm text-muted-foreground mt-1">Verificá que el Excel tenga datos para este período.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Period indicator */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm px-3 py-1">
              {d.monthLabel} — {d.year}
            </Badge>
            <span className="text-xs text-muted-foreground">Period key: {d.periodKey}</span>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "EBIT Operativo", value: fmt(d.ebitOperativo), pct: fmtPct(d.margenOperativo), color: kpiColor(d.ebitOperativo, 0), icon: TrendingUp },
              { label: "Ventas del Mes", value: fmt(d.ventasDelMes), pct: null, color: "text-emerald-700", icon: DollarSign },
              { label: "Cashflow", value: fmt(d.cashflow), pct: null, color: kpiColor(d.cashflow, 0), icon: d.cashflow && d.cashflow >= 0 ? ArrowUp : ArrowDown },
              { label: "Margen Neto", value: fmtPct(d.margenNeto), pct: null, color: kpiColor(d.margenNeto, 15), icon: BarChart3 },
              { label: "Markup", value: d.markup != null ? d.markup.toFixed(2) : "—", pct: null, color: kpiColor(d.markup, 2.5), icon: TrendingUp },
              { label: "Beneficio Neto", value: fmt(d.beneficioNeto), pct: null, color: kpiColor(d.beneficioNeto, 0), icon: Wallet },
            ].map((kpi, i) => (
              <Card key={i} className="relative overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{kpi.label}</span>
                    <kpi.icon className="h-4 w-4 text-slate-300" />
                  </div>
                  <div className={`text-xl font-bold tabular-nums ${kpi.color}`}>{kpi.value}</div>
                  {kpi.pct && <div className="text-xs text-muted-foreground mt-0.5">{kpi.pct}</div>}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* P&L + Balance */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Estado de Resultados */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> Estado de Resultados
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: "Ventas del mes", value: d.ventasDelMes, bold: false, pct: 100 },
                  { label: "– Costos (implícito)", value: d.ventasDelMes != null && d.ebitOperativo != null ? -(d.ventasDelMes - d.ebitOperativo) : null, bold: false, pct: d.ventasDelMes ? ((d.ventasDelMes - (d.ebitOperativo || 0)) / d.ventasDelMes * 100) : null, negative: true },
                  { label: "= EBIT Operativo", value: d.ebitOperativo, bold: true, pct: d.margenOperativo },
                  { label: "– Impuestos (impl.)", value: d.ebitOperativo != null && d.beneficioNeto != null ? -(d.ebitOperativo - d.beneficioNeto) : null, bold: false, negative: true },
                  { label: "= Beneficio Neto", value: d.beneficioNeto, bold: true, pct: d.margenNeto },
                ].map((row, i) => (
                  <div key={i} className={`flex items-center justify-between py-2 px-3 rounded ${row.bold ? "bg-slate-50 border font-semibold" : ""}`}>
                    <span className={`text-sm ${row.bold ? "" : "text-muted-foreground"}`}>{row.label}</span>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm tabular-nums ${row.negative ? "text-red-500" : kpiColor(row.value, 0)}`}>
                        {row.value != null ? fmt(Math.abs(row.value)) : "—"}
                      </span>
                      {row.pct != null && (
                        <span className="text-xs text-muted-foreground w-16 text-right">{typeof row.pct === 'number' ? fmtPct(row.pct) : row.pct}</span>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Balance + Caja */}
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wallet className="h-4 w-4" /> Balance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { label: "Activo Líquido", value: d.activoLiquido },
                    { label: "Activo M.P. Crypto", value: d.activoMedPlazo },
                    { label: "Clientes a Cobrar", value: d.clientesACobrar },
                    { label: "Activo Total", value: d.activoTotal, bold: true },
                    { label: "Pasivo Total", value: d.pasivoTotal, bold: true, negative: true },
                    { label: "Balance Neto", value: d.balanceNeto, bold: true },
                  ].map((row, i) => (
                    <div key={i} className={`flex justify-between py-1.5 px-3 rounded text-sm ${row.bold ? "bg-slate-50 border font-semibold" : ""}`}>
                      <span className={row.bold ? "" : "text-muted-foreground"}>{row.label}</span>
                      <span className={`tabular-nums ${row.negative ? "text-red-500" : kpiColor(row.value, 0)}`}>
                        {fmt(row.value)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Caja & Runway
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between py-1.5 px-3 text-sm">
                    <span className="text-muted-foreground">Cashflow Neto</span>
                    <span className={`tabular-nums font-medium ${kpiColor(d.cashflow, 0)}`}>{fmt(d.cashflow)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 px-3 text-sm">
                    <span className="text-muted-foreground">Caja Total</span>
                    <span className={`tabular-nums font-medium ${kpiColor(d.activoLiquido, 0)}`}>{fmt(d.activoLiquido)}</span>
                  </div>
                  {runwayMonths != null && (
                    <div className="flex justify-between py-2 px-3 rounded bg-red-50 border border-red-200 text-sm">
                      <span className="font-semibold text-red-800">Runway</span>
                      <Badge className="bg-red-100 text-red-800">{runwayMonths.toFixed(1)} meses</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ─── Charts ───────────────────────────────────────── */}
          {trend.length > 2 && (() => {
            const chartData = trend.filter((m: any) => m.ventasDelMes != null).map((m: any) => ({
              period: `${MONTHS[(m.month || 1) - 1]} ${String(m.year).slice(2)}`,
              ventas: m.ventasDelMes || 0,
              ebit: m.ebitOperativo || 0,
              beneficio: m.beneficioNeto || 0,
              cashflow: m.cashflow || 0,
              markup: m.markup || 0,
              margen: m.margenOperativo || 0,
            }));

            return (
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Ventas & EBIT Chart */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Ventas & EBIT (USD)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                        <RTooltip formatter={(v: number) => [`$${v.toLocaleString('es-AR')}`, '']} />
                        <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                        <Area type="monotone" dataKey="ventas" name="Ventas" fill="#d1fae5" stroke="#10b981" strokeWidth={2} />
                        <Line type="monotone" dataKey="ebit" name="EBIT" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                        <ReferenceLine y={0} stroke="#e5e7eb" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Cashflow Chart */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Cashflow Mensual (USD)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                        <RTooltip formatter={(v: number) => [`$${v.toLocaleString('es-AR')}`, '']} />
                        <ReferenceLine y={0} stroke="#94a3b8" />
                        <Bar dataKey="cashflow" name="Cashflow" fill="#6366f1" radius={[4, 4, 0, 0]}
                          fillOpacity={0.8}
                          // Color bars based on positive/negative
                          shape={(props: any) => {
                            const { x, y, width, height, value } = props;
                            return <rect x={x} y={y} width={width} height={height} rx={4} fill={value >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.75} />;
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          {/* ─── CEO Insights & Recommendations ──────────────── */}
          {d && (() => {
            const insights: Array<{ icon: any; color: string; title: string; text: string }> = [];
            const recommendations: Array<{ priority: 'high' | 'medium' | 'low'; text: string }> = [];

            // Trend analysis
            const prev = trend.length > 1 ? trend.find((m: any) => m.periodKey !== d.periodKey && m.ventasDelMes != null) : null;
            const ventasChange = prev?.ventasDelMes && d.ventasDelMes ? ((d.ventasDelMes - prev.ventasDelMes) / prev.ventasDelMes * 100) : null;

            // Revenue insight
            if (d.ventasDelMes != null) {
              if (ventasChange != null && ventasChange > 10) {
                insights.push({ icon: TrendingUp, color: "text-emerald-600", title: "Revenue en crecimiento", text: `Ventas crecieron ${ventasChange.toFixed(0)}% vs mes anterior. Tendencia positiva.` });
              } else if (ventasChange != null && ventasChange < -10) {
                insights.push({ icon: TrendingDown, color: "text-red-600", title: "Caída de revenue", text: `Ventas bajaron ${Math.abs(ventasChange).toFixed(0)}% vs mes anterior.` });
                recommendations.push({ priority: 'high', text: 'Revisar pipeline de ventas y acelerar cierre de propuestas pendientes.' });
              }
            }

            // Profitability insight
            if (d.margenOperativo != null) {
              if (d.margenOperativo > 30) {
                insights.push({ icon: Shield, color: "text-emerald-600", title: "Márgenes saludables", text: `Margen operativo de ${d.margenOperativo.toFixed(1)}% está por encima del objetivo (>25%).` });
              } else if (d.margenOperativo > 0 && d.margenOperativo < 15) {
                insights.push({ icon: AlertTriangle, color: "text-amber-600", title: "Márgenes ajustados", text: `Margen operativo de ${d.margenOperativo.toFixed(1)}% está debajo del mínimo (15%).` });
                recommendations.push({ priority: 'high', text: 'Optimizar costos de equipo: reducir horas senior en proyectos de bajo margen o renegociar precios.' });
              } else if (d.margenOperativo < 0) {
                insights.push({ icon: AlertTriangle, color: "text-red-600", title: "Operación con pérdida", text: `Margen operativo negativo (${d.margenOperativo.toFixed(1)}%). La empresa pierde dinero.` });
                recommendations.push({ priority: 'high', text: 'URGENTE: Revisar todos los proyectos activos e identificar los que generan pérdida. Considerar cierre o renegociación.' });
              }
            }

            // Markup insight
            if (d.markup != null) {
              if (d.markup >= 3.0) {
                insights.push({ icon: Target, color: "text-emerald-600", title: "Markup excelente", text: `Markup de ${d.markup.toFixed(2)}x supera el estándar Epical de 2.5x.` });
              } else if (d.markup < 2.5 && d.markup > 0) {
                insights.push({ icon: AlertTriangle, color: "text-amber-600", title: "Markup debajo del estándar", text: `Markup de ${d.markup.toFixed(2)}x está debajo del mínimo Epical (2.5x).` });
                recommendations.push({ priority: 'medium', text: 'Revisar pricing de nuevos proyectos. Considerar aumento de tarifas o reducción de scope.' });
              }
            }

            // Cashflow insight
            if (d.cashflow != null) {
              if (d.cashflow < 0) {
                insights.push({ icon: ArrowDown, color: "text-red-600", title: "Cashflow negativo", text: `Salieron $${Math.abs(d.cashflow).toLocaleString('es-AR')} más de lo que entró este mes.` });
                recommendations.push({ priority: 'medium', text: 'Acelerar cobros pendientes y revisar timing de pagos a proveedores.' });
              }
            }

            // Runway
            if (d.activoLiquido != null && d.ebitOperativo != null && d.ebitOperativo < 0) {
              const runway = Math.abs(d.activoLiquido / d.ebitOperativo);
              if (runway < 3) {
                recommendations.push({ priority: 'high', text: `Runway de ${runway.toFixed(1)} meses. Buscar ingreso de capital o reducir gastos urgentemente.` });
              }
            }

            // Balance insight
            if (d.balanceNeto != null && d.balanceNeto > 0) {
              insights.push({ icon: Shield, color: "text-emerald-600", title: "Balance positivo", text: `Balance neto de $${d.balanceNeto.toLocaleString('es-AR')} USD. La empresa tiene patrimonio positivo.` });
            }

            // Default if no insights
            if (insights.length === 0) {
              insights.push({ icon: Lightbulb, color: "text-slate-500", title: "Sin datos suficientes", text: "Se necesitan más datos para generar insights." });
            }

            return (
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Insights */}
                <Card className="border-indigo-100">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-indigo-500" /> Insights para el Board
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {insights.map((ins, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <ins.icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${ins.color}`} />
                        <div>
                          <p className="text-sm font-medium">{ins.title}</p>
                          <p className="text-xs text-muted-foreground">{ins.text}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Recommendations */}
                <Card className={recommendations.some(r => r.priority === 'high') ? "border-red-100" : "border-amber-100"}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="h-4 w-4 text-amber-500" /> Recomendaciones Accionables
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {recommendations.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin recomendaciones urgentes. La operación está saludable.</p>
                    ) : (
                      recommendations.map((rec, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <Badge variant="outline" className={`text-[10px] mt-0.5 flex-shrink-0 ${
                            rec.priority === 'high' ? 'border-red-200 text-red-700 bg-red-50' :
                            rec.priority === 'medium' ? 'border-amber-200 text-amber-700 bg-amber-50' :
                            'border-blue-200 text-blue-700 bg-blue-50'
                          }`}>
                            {rec.priority === 'high' ? 'URGENTE' : rec.priority === 'medium' ? 'MEDIO' : 'BAJO'}
                          </Badge>
                          <p className="text-sm">{rec.text}</p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          {/* 12-month trend table */}
          {trend.length > 1 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Evolución Mensual (últimos {trend.length} meses)</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Período</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Ventas</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">EBIT</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Benef. Neto</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Markup</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Margen Op.</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Cashflow</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trend.map((m: any) => (
                      <tr key={m.periodKey} className={`border-b hover:bg-slate-50 ${m.periodKey === d.periodKey ? "bg-indigo-50" : ""}`}>
                        <td className="py-1.5 px-2 font-medium">{m.monthLabel} {m.year}</td>
                        <td className="text-right py-1.5 px-2 tabular-nums">{fmtShort(m.ventasDelMes)}</td>
                        <td className={`text-right py-1.5 px-2 tabular-nums ${kpiColor(m.ebitOperativo, 0)}`}>{fmtShort(m.ebitOperativo)}</td>
                        <td className={`text-right py-1.5 px-2 tabular-nums ${kpiColor(m.beneficioNeto, 0)}`}>{fmtShort(m.beneficioNeto)}</td>
                        <td className={`text-right py-1.5 px-2 tabular-nums ${kpiColor(m.markup, 2.5)}`}>{m.markup?.toFixed(2) || "—"}</td>
                        <td className={`text-right py-1.5 px-2 tabular-nums ${kpiColor(m.margenOperativo, 15)}`}>{fmtPct(m.margenOperativo)}</td>
                        <td className={`text-right py-1.5 px-2 tabular-nums ${kpiColor(m.cashflow, 0)}`}>{fmtShort(m.cashflow)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
