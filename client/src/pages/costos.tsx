/**
 * Costos — desglose por concepto, por tipo y por equipo.
 *
 * Reemplaza tres páginas del Looker Studio de una vez: "Costos YTD y
 * Estimados", "Costos Directos e Indirectos" y "Costos Equipo".
 *
 * Verificado contra el Looker (2026): Tomi Criado 54.267,46 · Honorarios Oxean
 * 54.045,32 · Vicky Puricelli 44.310,06 · Tarjeta USA 43.900 · Youscan 35.446,70.
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
import { Coins, Layers, Users, Info } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, Legend, ComposedChart, Line, Cell,
} from "recharts";

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : `$${n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

interface Concepto { concepto: string; montoUsd: number; sharePct: number }
interface Mensual {
  periodKey: string; directo: number; indirecto: number;
  provisiones: number; total: number; overheadPct: number;
}
interface Equipo {
  periodKey: string; horasObjetivo: number; horasAsana: number;
  horasFacturacion: number; costoUsd: number; valorHora: number | null;
}
interface Data {
  year: number;
  conceptos: Concepto[];
  totalConceptos: number;
  boardYHolding: { conceptos: string[]; montoUsd: number; sharePct: number };
  mensual: Mensual[];
  equipo: Equipo[];
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

export default function CostosPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { data, isLoading, error } = useQuery<Data>({
    queryKey: [`/api/v2/executive/costs?year=${year}`],
  });

  const years = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];
  const topConceptos = (data?.conceptos ?? []).slice(0, 12);
  const esBoard = (c: string) => data?.boardYHolding.conceptos.includes(c) ?? false;

  return (
    <PageShell>
      <CompactPageHeader
        title="Costos"
        description="Desglose por concepto, tipo y equipo, sobre el Excel MAESTRO"
      />

      <ToolbarPanel>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </ToolbarPanel>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {error && <p className="text-sm text-red-600">No se pudo cargar el desglose de costos.</p>}

      {data && (
        <TooltipProvider delayDuration={200}>
          <div className="space-y-6">
            <MetricGrid>
              <MetricCard
                label={<span className="flex items-center justify-between gap-2"><span>Costo total</span>
                  <InfoTip>Suma de los costos estimados del ejercicio, del Excel MAESTRO. Incluye impuestos e intereses.</InfoTip></span>}
                value={fmt(data.totalConceptos)}
                icon={<Coins className="h-5 w-5" />}
                detail={`${data.conceptos.length} conceptos`}
              />
              <MetricCard
                label={<span className="flex items-center justify-between gap-2"><span>Board + holding</span>
                  <InfoTip>Compensación de socios y honorarios de la holding. Se muestra aparte porque es la línea más grande de la empresa y queda diluida dentro del ranking general.</InfoTip></span>}
                value={fmt(data.boardYHolding.montoUsd)}
                icon={<Users className="h-5 w-5" />}
                detail={`${data.boardYHolding.sharePct.toFixed(1)}% del costo · ${data.boardYHolding.conceptos.join(", ")}`}
                tone={data.boardYHolding.sharePct >= 20 ? "warning" : "neutral"}
              />
              {data.mensual.length > 0 && (() => {
                const ult = data.mensual[data.mensual.length - 1];
                return (
                  <MetricCard
                    label={<span className="flex items-center justify-between gap-2"><span>Overhead</span>
                      <InfoTip>Costos indirectos sobre el costo operativo del último mes cerrado. Alto significa estructura pesada respecto del equipo asignado a clientes.</InfoTip></span>}
                    value={`${ult.overheadPct.toFixed(1)}%`}
                    icon={<Layers className="h-5 w-5" />}
                    detail={`${ult.periodKey} · ${fmt(ult.indirecto)} de ${fmt(ult.directo + ult.indirecto)}`}
                    tone={ult.overheadPct >= 70 ? "danger" : ult.overheadPct >= 55 ? "warning" : "success"}
                  />
                );
              })()}
              {data.equipo.length > 0 && (() => {
                const ult = data.equipo[data.equipo.length - 1];
                return (
                  <MetricCard
                    label={<span className="flex items-center justify-between gap-2"><span>Valor hora</span>
                      <InfoTip>Costo del equipo dividido por las horas efectivamente cargadas en Asana del último mes con datos.</InfoTip></span>}
                    value={ult.valorHora != null ? `$${ult.valorHora.toFixed(2)}` : "—"}
                    icon={<Users className="h-5 w-5" />}
                    detail={`${ult.periodKey} · ${ult.horasAsana.toFixed(0)}h cargadas`}
                  />
                );
              })()}
            </MetricGrid>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  Conceptos más caros del año
                  <span className="text-xs font-normal text-muted-foreground">ámbar = board y holding</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(260, topConceptos.length * 28)}>
                  <BarChart data={topConceptos} layout="vertical" margin={{ left: 120 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickLine={false} axisLine={false} fontSize={12}
                      tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <YAxis type="category" dataKey="concepto" width={120} tickLine={false} axisLine={false} fontSize={11} />
                    <RTooltip formatter={(v: any) => fmt(v)} />
                    <Bar dataKey="montoUsd" radius={[0, 3, 3, 0]}>
                      {topConceptos.map((c, i) => (
                        <Cell key={i} fill={esBoard(c.concepto) ? "#f59e0b" : "#60a5fa"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {data.mensual.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    Directos vs indirectos
                    <InfoTip>Directo es el equipo asignado a proyectos de clientes; indirecto es todo lo demás. La línea muestra qué porcentaje del costo operativo es overhead.</InfoTip>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={data.mensual}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="periodKey" tickLine={false} axisLine={false} fontSize={11} />
                      <YAxis yAxisId="l" tickLine={false} axisLine={false} fontSize={12}
                        tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                      <YAxis yAxisId="r" orientation="right" tickLine={false} axisLine={false} fontSize={12}
                        tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                      <RTooltip formatter={(v: any, n: any) => n === "Overhead" ? `${Number(v).toFixed(1)}%` : fmt(v)} />
                      <Legend />
                      <Bar yAxisId="l" dataKey="directo" name="Directo" stackId="c" fill="#2563eb" />
                      <Bar yAxisId="l" dataKey="indirecto" name="Indirecto" stackId="c" fill="#f1a1a1" />
                      <Line yAxisId="r" dataKey="overheadPct" name="Overhead" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {data.equipo.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    Horas del equipo
                    <InfoTip>Objetivo es lo presupuestado por proyecto; Asana es lo efectivamente cargado. La brecha entre ambas indica si el presupuesto de horas está bien calibrado.</InfoTip>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.equipo}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="periodKey" tickLine={false} axisLine={false} fontSize={11} />
                      <YAxis tickLine={false} axisLine={false} fontSize={12} />
                      <RTooltip formatter={(v: any) => `${Number(v).toFixed(0)}h`} />
                      <Legend />
                      <Bar dataKey="horasObjetivo" name="Objetivo" fill="#c7d2fe" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="horasAsana" name="Asana" fill="#2563eb" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Todos los conceptos</CardTitle>
              </CardHeader>
              <CardContent className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 px-2 font-medium">Concepto</th>
                      <th className="text-right py-2 px-2 font-medium">Monto</th>
                      <th className="text-right py-2 px-2 font-medium">Participación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.conceptos.map((c) => (
                      <tr key={c.concepto} className="border-b last:border-0">
                        <td className="py-1.5 px-2">
                          {c.concepto}
                          {esBoard(c.concepto) && (
                            <Badge variant="outline" className="ml-2 text-[10px] border-amber-400 text-amber-600">board</Badge>
                          )}
                        </td>
                        <td className="text-right py-1.5 px-2 tabular-nums">{fmt(c.montoUsd)}</td>
                        <td className="text-right py-1.5 px-2 tabular-nums text-muted-foreground">{c.sharePct.toFixed(2)}%</td>
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
