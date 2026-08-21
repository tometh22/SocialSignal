/**
 * ARR — ingreso recurrente anualizado.
 *
 * Reemplaza la página "ARR" del Looker Studio. Sale de financial_sot, que es la
 * solapa "Rendimiento Cliente" del Excel MAESTRO.
 *
 * MRR = facturación de proyectos con Tipo = "Fee" del mes. ARR = MRR × 12.
 * Verificado contra el Looker (jul-2026): MRR 45.081,72 y Warner ARR 420.420,
 * exactos.
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
import { Repeat, Users, Percent, AlertTriangle, Info } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip,
} from "recharts";

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : `$${n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

interface Cliente { clientName: string; mrr: number; arr: number; sharePct: number }
interface Data {
  periodKey: string; mrr: number; arr: number; revenueTotal: number;
  feeSharePct: number; clientesFee: number; porCliente: Cliente[]; hhi: number;
  serie: Array<{ periodKey: string; mrr: number; arr: number }>;
}
interface Resp { periodos: string[]; data: Data | null }

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

// Umbrales de concentración, alineados con el detector de data-quality.
const CONCENTRACION_ALERTA = 50;
const CONCENTRACION_CRITICA = 65;

export default function ArrPage() {
  const [periodo, setPeriodo] = useState<string | null>(null);
  const { data: resp, isLoading, error } = useQuery<Resp>({
    queryKey: [periodo ? `/api/v2/executive/recurring?period=${periodo}` : `/api/v2/executive/recurring`],
  });

  const d = resp?.data;
  const top = d?.porCliente?.[0];
  const concentrado = (top?.sharePct ?? 0) >= CONCENTRACION_ALERTA;

  return (
    <PageShell>
      <CompactPageHeader
        title="ARR"
        description="Ingreso recurrente anualizado, sobre facturación de proyectos tipo Fee"
      />

      <ToolbarPanel>
        <Select value={periodo ?? d?.periodKey ?? ""} onValueChange={setPeriodo}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            {(resp?.periodos ?? []).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </ToolbarPanel>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {error && <p className="text-sm text-red-600">No se pudo cargar el ingreso recurrente.</p>}
      {resp && !d && (
        <p className="text-sm text-muted-foreground">
          No hay datos de rendimiento por proyecto cargados todavía.
        </p>
      )}

      {d && (
        <TooltipProvider delayDuration={200}>
          <div className="space-y-6">
            <MetricGrid>
              {[
                {
                  label: "MRR", icon: Repeat, value: fmt(d.mrr),
                  detail: `${d.clientesFee} clientes con fee mensual`,
                  tip: "Facturación de proyectos con Tipo = Fee del mes. No incluye one-shots.",
                },
                {
                  label: "ARR", icon: Repeat, value: fmt(d.arr),
                  detail: "MRR × 12",
                  tip: "MRR anualizado. Mide recurrencia ejecutada: la fuente sólo tiene meses cerrados, no proyecta hacia adelante.",
                },
                {
                  label: "Ingreso recurrente", icon: Percent, value: `${d.feeSharePct.toFixed(1)}%`,
                  detail: `${fmt(d.mrr)} de ${fmt(d.revenueTotal)}`,
                  tip: "Qué parte de la facturación del mes es recurrente. El resto son proyectos puntuales, que hay que volver a vender cada vez.",
                },
                {
                  label: top ? `Concentración · ${top.clientName}` : "Concentración",
                  icon: concentrado ? AlertTriangle : Users,
                  value: top ? `${top.sharePct.toFixed(1)}%` : "—",
                  detail: `HHI ${d.hhi.toFixed(2)} sobre ${d.clientesFee} clientes`,
                  tone: (top && top.sharePct >= CONCENTRACION_CRITICA ? "danger"
                    : concentrado ? "warning" : "success") as "danger" | "warning" | "success",
                  tip: "Participación del cliente más grande en el MRR. El índice Herfindahl va de 0 (cartera repartida) a 1 (un solo cliente). Por encima del 50% conviene mirar la fecha de vencimiento de ese contrato.",
                },
              ].map((kpi, i) => (
                <MetricCard
                  key={i}
                  label={(
                    <span className="flex min-w-0 items-center justify-between gap-2">
                      <span className="truncate">{kpi.label}</span>
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

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  ARR histórico
                  <InfoTip>
                    Base recurrente mes a mes. Un ARR plano con facturación creciente significa que el crecimiento viene de proyectos puntuales, no de recurrencia.
                  </InfoTip>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={d.serie}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="periodKey" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} fontSize={12}
                      tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <RTooltip formatter={(v: any) => fmt(v)} />
                    <Area dataKey="arr" name="ARR" stroke="#2563eb" fill="#bfdbfe" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">ARR por cliente</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 px-2 font-medium">Cliente</th>
                      <th className="text-right py-2 px-2 font-medium">MRR</th>
                      <th className="text-right py-2 px-2 font-medium">ARR</th>
                      <th className="text-right py-2 px-2 font-medium">Participación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.porCliente.map((c) => (
                      <tr key={c.clientName} className="border-b last:border-0">
                        <td className="py-1.5 px-2">
                          {c.clientName}
                          {c.sharePct >= CONCENTRACION_CRITICA && (
                            <Badge variant="destructive" className="ml-2 text-[10px]">concentración</Badge>
                          )}
                        </td>
                        <td className="text-right py-1.5 px-2 tabular-nums">{fmt(c.mrr)}</td>
                        <td className="text-right py-1.5 px-2 tabular-nums font-medium">{fmt(c.arr)}</td>
                        <td className="text-right py-1.5 px-2 tabular-nums">{c.sharePct.toFixed(1)}%</td>
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
