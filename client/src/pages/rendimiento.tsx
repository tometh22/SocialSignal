/**
 * Rendimiento — markup y margen por cliente y proyecto.
 *
 * Reemplaza las páginas "Rendimiento de Cliente" y "Rendimiento de Proyectos"
 * del Looker Studio. Sale de financial_sot ("Rendimiento Cliente" del MAESTRO),
 * que es la única fuente con facturación Y costo por proyecto.
 *
 * Verificado contra el Looker (jul-2026): Warner Fee Marketing 29.230 de
 * facturación, 6.402,73 de costo, 78,1% de margen, markup 4,57.
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CompactPageHeader } from "@/components/ui/compact-page-header";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { PageShell } from "@/components/ui/page-shell";
import { ToolbarPanel } from "@/components/ui/toolbar-panel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, DollarSign, Target, Info } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ReferenceLine, Cell,
} from "recharts";

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : `$${n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

/** Estándar de Epical, el mismo que usa la tarjeta de Markup del dashboard. */
const MARKUP_OBJETIVO = 2.5;

interface Fila {
  clientName: string; projectName: string; projectType: string | null;
  facturacion: number; costos: number; utilidad: number;
  margenPct: number; markup: number | null;
}
interface Resp { periodos: string[]; periodo: string | null; filas: Fila[] }

function InfoTip({ children }: { children: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="text-muted-foreground/60 hover:text-muted-foreground" aria-label="Más información">
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-relaxed">{children}</TooltipContent>
    </Tooltip>
  );
}

export default function RendimientoPage() {
  const [periodo, setPeriodo] = useState<string | null>(null);
  const [cliente, setCliente] = useState<string>("__todos");

  const { data: resp, isLoading, error } = useQuery<Resp>({
    queryKey: [periodo ? `/api/v2/executive/rendimiento?period=${periodo}` : `/api/v2/executive/rendimiento`],
  });

  const clientes = useMemo(
    () => Array.from(new Set((resp?.filas ?? []).map((f) => f.clientName))).sort(),
    [resp],
  );
  const filas = useMemo(
    () => (resp?.filas ?? []).filter((f) => cliente === "__todos" || f.clientName === cliente),
    [resp, cliente],
  );

  const totales = useMemo(() => {
    const facturacion = filas.reduce((a, f) => a + f.facturacion, 0);
    const costos = filas.reduce((a, f) => a + f.costos, 0);
    return {
      facturacion, costos,
      utilidad: facturacion - costos,
      margenPct: facturacion > 0 ? ((facturacion - costos) / facturacion) * 100 : 0,
      // Markup del conjunto: facturación total sobre costo total, no el promedio
      // de los markups — un proyecto chico con markup altísimo no debe arrastrar.
      markup: costos > 0 ? facturacion / costos : null,
    };
  }, [filas]);

  const chart = filas
    .filter((f) => f.markup != null)
    .slice(0, 12)
    .map((f) => ({
      nombre: `${f.clientName} · ${f.projectName}`.slice(0, 34),
      markup: f.markup as number,
    }));

  return (
    <PageShell>
      <CompactPageHeader
        title="Rendimiento"
        description="Markup y margen por cliente y proyecto, sobre el Excel MAESTRO"
      />

      <ToolbarPanel>
        <Select value={periodo ?? resp?.periodo ?? ""} onValueChange={setPeriodo}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            {(resp?.periodos ?? []).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={cliente} onValueChange={setCliente}>
          <SelectTrigger className="w-52 ml-2"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__todos">Todos los clientes</SelectItem>
            {clientes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </ToolbarPanel>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {error && <p className="text-sm text-red-600">No se pudo cargar el rendimiento.</p>}
      {resp && filas.length === 0 && !isLoading && (
        <p className="text-sm text-muted-foreground">Sin proyectos cargados para este período.</p>
      )}

      {filas.length > 0 && (
        <TooltipProvider delayDuration={200}>
          <div className="space-y-6">
            <MetricGrid>
              {[
                {
                  label: "Facturación", icon: DollarSign, value: fmt(totales.facturacion),
                  detail: `${filas.length} proyecto${filas.length === 1 ? "" : "s"}`,
                  tip: "Facturación sin IVA de los proyectos del período.",
                },
                {
                  label: "Costos directos", icon: TrendingUp, value: fmt(totales.costos),
                  detail: `Utilidad ${fmt(totales.utilidad)}`,
                  tip: "Costo del equipo asignado a cada proyecto. No incluye overhead.",
                },
                {
                  label: "Margen", icon: Target, value: `${totales.margenPct.toFixed(1)}%`,
                  detail: "Utilidad / Facturación",
                  tone: (totales.margenPct >= 50 ? "success" : totales.margenPct >= 0 ? "warning" : "danger") as any,
                  tip: "Margen operativo sobre costos directos. No es el margen de la empresa: falta el overhead.",
                },
                {
                  label: "Markup", icon: TrendingUp,
                  value: totales.markup != null ? `${totales.markup.toFixed(2)}×` : "—",
                  detail: `Objetivo ≥ ${MARKUP_OBJETIVO}×`,
                  tone: (totales.markup == null ? "neutral"
                    : totales.markup >= 3 ? "success"
                    : totales.markup >= MARKUP_OBJETIVO ? "warning" : "danger") as any,
                  tip: "Facturación sobre costos directos del conjunto. No es el promedio de los markups: un proyecto chico con markup altísimo no debe arrastrar el total.",
                },
              ].map((kpi, i) => (
                <MetricCard
                  key={i}
                  label={(
                    <span className="flex min-w-0 items-center justify-between gap-2">
                      <span>{kpi.label}</span>
                      <InfoTip>{kpi.tip}</InfoTip>
                    </span>
                  )}
                  value={kpi.value}
                  icon={<kpi.icon className="h-5 w-5" />}
                  detail={kpi.detail}
                  tone={(kpi as any).tone}
                  aria-label={`${kpi.label}: ${kpi.value}`}
                />
              ))}
            </MetricGrid>

            {chart.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    Markup por proyecto
                    <span className="text-xs font-normal text-muted-foreground">
                      línea = objetivo {MARKUP_OBJETIVO}×
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={Math.max(220, chart.length * 28)}>
                    <BarChart data={chart} layout="vertical" margin={{ left: 130 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis type="category" dataKey="nombre" width={130} tickLine={false} axisLine={false} fontSize={11} />
                      <RTooltip formatter={(v: any) => `${Number(v).toFixed(2)}×`} />
                      <ReferenceLine x={MARKUP_OBJETIVO} stroke="#f59e0b" strokeDasharray="4 4" />
                      <Bar dataKey="markup" radius={[0, 3, 3, 0]}>
                        {chart.map((c, i) => (
                          <Cell key={i} fill={c.markup >= MARKUP_OBJETIVO ? "#16a34a" : "#ef4444"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Detalle por proyecto</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 px-2 font-medium">Cliente</th>
                      <th className="text-left py-2 px-2 font-medium">Proyecto</th>
                      <th className="text-left py-2 px-2 font-medium">Tipo</th>
                      <th className="text-right py-2 px-2 font-medium">Facturación</th>
                      <th className="text-right py-2 px-2 font-medium">Costos</th>
                      <th className="text-right py-2 px-2 font-medium">Utilidad</th>
                      <th className="text-right py-2 px-2 font-medium">Margen</th>
                      <th className="text-right py-2 px-2 font-medium">Markup</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-1.5 px-2">{f.clientName}</td>
                        <td className="py-1.5 px-2 text-muted-foreground">{f.projectName}</td>
                        <td className="py-1.5 px-2">
                          <Badge variant="outline" className="text-[10px]">{f.projectType ?? "—"}</Badge>
                        </td>
                        <td className="text-right py-1.5 px-2 tabular-nums">{fmt(f.facturacion)}</td>
                        <td className="text-right py-1.5 px-2 tabular-nums">{fmt(f.costos)}</td>
                        <td className={`text-right py-1.5 px-2 tabular-nums ${f.utilidad >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {fmt(f.utilidad)}
                        </td>
                        <td className="text-right py-1.5 px-2 tabular-nums">{f.margenPct.toFixed(1)}%</td>
                        <td className={`text-right py-1.5 px-2 tabular-nums ${
                          f.markup == null ? "text-muted-foreground"
                            : f.markup >= MARKUP_OBJETIVO ? "text-emerald-600" : "text-red-600"}`}>
                          {f.markup == null ? "s/costo" : `${f.markup.toFixed(2)}×`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </TooltipProvider>
      )}
    </PageShell>
  );
}
