/**
 * Proyección — ejecutado vs proyectado del ejercicio.
 *
 * Reemplaza la página "Proyección (resumen)" del Looker Studio, leyendo la misma
 * solapa del Excel MAESTRO. Responde la pregunta que el board hace siempre:
 * cómo venimos contra lo que proyectamos.
 *
 * Los costos usan la base consistente con el EBIT (ventas − EBIT, sin impuestos
 * ARG/USA ni intereses). Verificado contra el Looker: coincide al centavo.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CompactPageHeader } from "@/components/ui/compact-page-header";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { PageShell } from "@/components/ui/page-shell";
import { ToolbarPanel } from "@/components/ui/toolbar-panel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Target, TrendingUp, DollarSign, Info } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, Legend, ComposedChart, Line, ReferenceLine,
} from "recharts";

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : `$${n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

interface ProyeccionMes {
  periodKey: string;
  monthLabel: string;
  month: number;
  cierre: boolean;
  facturacion: number | null;
  costos: number | null;
  resultado: number | null;
}
interface Serie { ejecutado: number; proyectado: number; total: number }
interface Proyeccion {
  year: number;
  facturacion: Serie;
  costos: Serie;
  resultado: Serie;
  meses: ProyeccionMes[];
  mesesCerrados: number;
  mesesProyectados: number;
}

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

export default function ProyeccionPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const { data, isLoading, error } = useQuery<Proyeccion>({
    queryKey: [`/api/v2/executive/proyeccion?year=${year}`],
  });

  const years = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];

  const chartData = (data?.meses ?? []).map((m) => ({
    mes: m.monthLabel.slice(3),
    // Series separadas para que la barra proyectada se distinga de la real.
    facturacionReal: m.cierre ? m.facturacion : null,
    facturacionProyectada: m.cierre ? null : m.facturacion,
    costos: m.costos,
    resultado: m.resultado,
  }));

  return (
    <PageShell>
      <CompactPageHeader
        title="Proyección"
        description="Ejecutado contra proyectado del ejercicio, sobre el Excel MAESTRO"
      />

      <ToolbarPanel>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        {data && (
          <Badge variant="outline" className="ml-2">
            {data.mesesCerrados} cerrados · {data.mesesProyectados} proyectados
          </Badge>
        )}
      </ToolbarPanel>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {error && <p className="text-sm text-red-600">No se pudo cargar la proyección.</p>}

      {data && (
        <TooltipProvider delayDuration={200}>
          <div className="space-y-6">
            <MetricGrid>
              {[
                {
                  label: "Facturación total", icon: DollarSign,
                  value: fmt(data.facturacion.total),
                  detalle: `${fmt(data.facturacion.ejecutado)} ejecutada · ${fmt(data.facturacion.proyectado)} proyectada`,
                  tip: "Suma de la facturación de los meses cerrados más la proyectada de los que faltan. Sin IVA.",
                },
                {
                  label: "Costos totales", icon: TrendingUp,
                  value: fmt(data.costos.total),
                  detalle: `${fmt(data.costos.ejecutado)} ejecutados · ${fmt(data.costos.proyectado)} proyectados`,
                  tip: "Base consistente con el EBIT: excluye impuestos ARG y USA e intereses de Oxean. Se deriva como Ventas − EBIT, igual que la serie 'sin impuestos' del reporte de Looker.",
                },
                {
                  label: "Resultado (EBIT)", icon: Target,
                  value: fmt(data.resultado.total),
                  detalle: `${fmt(data.resultado.ejecutado)} ejecutado · ${fmt(data.resultado.proyectado)} proyectado`,
                  tip: "Ventas sin IVA menos costos, excluyendo impuestos e intereses. No incluye provisiones: para el resultado del ejercicio, ver Beneficio Neto en el Resumen Ejecutivo.",
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
                  detail={kpi.detalle}
                  aria-label={`${kpi.label}: ${kpi.value}`}
                />
              ))}
            </MetricGrid>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  Facturación mes a mes
                  <span className="text-xs font-normal text-muted-foreground">
                    real vs proyectada
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} fontSize={12}
                      tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <RTooltip formatter={(v: any) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="facturacionReal" name="Real" fill="#2563eb" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="facturacionProyectada" name="Proyectada" fill="#93c5fd" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  Costos y resultado
                  <InfoTip>
                    Los costos excluyen impuestos ARG y USA e intereses, para que el resultado sea el EBIT.
                  </InfoTip>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} fontSize={12}
                      tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <RTooltip formatter={(v: any) => fmt(v)} />
                    <Legend />
                    <ReferenceLine y={0} stroke="#94a3b8" />
                    <Bar dataKey="costos" name="Costos" fill="#f1a1a1" radius={[3, 3, 0, 0]} />
                    <Line dataKey="resultado" name="EBIT" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Detalle mensual</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 px-2 font-medium">Mes</th>
                      <th className="text-left py-2 px-2 font-medium">Estado</th>
                      <th className="text-right py-2 px-2 font-medium">Facturación</th>
                      <th className="text-right py-2 px-2 font-medium">Costos</th>
                      <th className="text-right py-2 px-2 font-medium">EBIT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.meses.map((m) => (
                      <tr key={m.periodKey} className={`border-b last:border-0 ${m.cierre ? "" : "text-muted-foreground"}`}>
                        <td className="py-1.5 px-2">{m.monthLabel}</td>
                        <td className="py-1.5 px-2">
                          <Badge variant={m.cierre ? "secondary" : "outline"} className="text-[10px]">
                            {m.cierre ? "cerrado" : "proyectado"}
                          </Badge>
                        </td>
                        <td className="text-right py-1.5 px-2 tabular-nums">{fmt(m.facturacion)}</td>
                        <td className="text-right py-1.5 px-2 tabular-nums">{fmt(m.costos)}</td>
                        <td className={`text-right py-1.5 px-2 tabular-nums ${(m.resultado ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {fmt(m.resultado)}
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
