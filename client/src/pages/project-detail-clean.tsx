/**
 * Project Detail - Clean, Modern Redesign
 * 4 tabs: Resumen, Equipo, Finanzas, Tareas
 * Replaces the 10-tab, 5694-line original
 */
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useCompleteProjectData } from "@/hooks/useCompleteProjectData";
import { toProjectVM, useWhichCost } from "@/selectors/projectVM";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, DollarSign, Clock, Users, TrendingUp,
  AlertTriangle, CheckCircle, BarChart3, Target, Zap,
} from "lucide-react";
import { Link } from "wouter";

// Lazy imports for heavy tab content
import ProjectTaskList from "@/components/tasks/ProjectTaskList";

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number | null | undefined, prefix = "$") =>
  n == null ? "—" : `${prefix}${Math.round(n).toLocaleString("es-AR")}`;

const fmtPct = (n: number | null | undefined) =>
  n == null ? "—" : `${n.toFixed(1)}%`;

const fmtHours = (n: number | null | undefined) =>
  n == null ? "—" : `${n.toFixed(1)}h`;

const healthColor = (margin: number | null | undefined) => {
  if (margin == null) return "bg-slate-100 text-slate-600";
  if (margin >= 30) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (margin >= 15) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-700 border-red-200";
};

const statusLabel: Record<string, string> = {
  active: "Activo", completed: "Completado", cancelled: "Cancelado", "on-hold": "Pausado",
};
const statusColor: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  completed: "bg-blue-100 text-blue-800",
  cancelled: "bg-red-100 text-red-800",
  "on-hold": "bg-amber-100 text-amber-800",
};

// ─── KPI Card Component ─────────────────────────────────────────────────────

function KpiCard({ label, value, subtitle, icon: Icon, color = "text-slate-700", alert }: {
  label: string; value: string; subtitle?: string; icon: any; color?: string; alert?: boolean;
}) {
  return (
    <Card className={`relative overflow-hidden transition-shadow hover:shadow-md ${alert ? "ring-2 ring-red-200" : ""}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={`p-2.5 rounded-xl bg-slate-50 ${alert ? "bg-red-50" : ""}`}>
            <Icon className={`h-5 w-5 ${alert ? "text-red-500" : "text-slate-400"}`} />
          </div>
        </div>
        {alert && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-red-400 to-red-500" />
        )}
      </CardContent>
    </Card>
  );
}

// ─── Progress Bar ───────────────────────────────────────────────────────────

function ProgressBar({ value, max, label, color = "bg-indigo-500" }: {
  value: number; max: number; label?: string; color?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const isOver = pct > 90;
  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className={`font-semibold ${isOver ? "text-red-600" : "text-slate-700"}`}>{pct.toFixed(0)}%</span>
        </div>
      )}
      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${isOver ? "bg-red-500" : color}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

// ─── Team Member Row ────────────────────────────────────────────────────────

function TeamRow({ member }: { member: any }) {
  const deviation = member.targetHours > 0
    ? ((member.actualHours - member.targetHours) / member.targetHours) * 100
    : 0;
  const isOver = deviation > 10;
  const isUnder = deviation < -20;

  return (
    <tr className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
            {member.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800">{member.name}</p>
            <p className="text-xs text-muted-foreground">{member.role || "Sin rol"}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-4 text-right tabular-nums text-sm">{fmtHours(member.targetHours)}</td>
      <td className="py-3 px-4 text-right tabular-nums text-sm">{fmtHours(member.actualHours)}</td>
      <td className="py-3 px-4 text-right tabular-nums text-sm">{fmt(member.costUSD)}</td>
      <td className="py-3 px-4 text-right">
        {member.targetHours > 0 ? (
          <Badge variant="outline" className={`text-xs ${isOver ? "border-red-200 text-red-600 bg-red-50" : isUnder ? "border-blue-200 text-blue-600 bg-blue-50" : "border-green-200 text-green-600 bg-green-50"}`}>
            {deviation > 0 ? "+" : ""}{deviation.toFixed(0)}%
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ProjectDetailClean() {
  const [location] = useLocation();
  const projectId = location.split("/")[2];
  const pid = parseInt(projectId || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("resumen");

  // Period from URL or default to current month
  const urlParams = new URLSearchParams(window.location.search);
  const periodFromUrl = urlParams.get("period");

  const { data: unifiedData, isLoading, error } = useCompleteProjectData(
    pid, "current_month", periodFromUrl || undefined, "operativa"
  );

  const projectVM = unifiedData ? toProjectVM(unifiedData) : null;
  const whichCost = useWhichCost(projectVM);

  // Extract key metrics
  const q = unifiedData?.quotation;
  const s = unifiedData?.summary;
  const a = unifiedData?.actuals;
  const m = unifiedData?.metrics;

  const revenue = s?.revenueDisplay ?? s?.revenueUSD ?? 0;
  const cost = s?.costDisplay ?? s?.costUSD ?? 0;
  const margin = revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0;
  const markup = cost > 0 ? revenue / cost : 0;
  const budget = q?.totalAmount ?? unifiedData?.project?.budget ?? 0;
  const budgetUsed = budget > 0 ? (cost / budget) * 100 : 0;
  const totalHours = a?.totalWorkedHours ?? 0;
  const teamCount = a?.teamBreakdown?.length ?? 0;
  const isHealthy = margin >= 20;

  // Project info
  const project = unifiedData?.project;
  const projectName = q?.projectName ?? project?.subprojectName ?? "Proyecto";
  const clientName = unifiedData?.client?.name ?? "—";
  const projectStatus = project?.status ?? "active";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Cargando proyecto...</p>
        </div>
      </div>
    );
  }

  if (error || !unifiedData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center space-y-3">
            <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
            <h3 className="font-semibold">No se pudieron cargar los datos</h3>
            <p className="text-sm text-muted-foreground">
              {error?.message || "Verificá que el proyecto exista y tenga datos cargados."}
            </p>
            <Link href="/active-projects">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" /> Volver a proyectos
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link href="/active-projects">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <p className="text-sm text-muted-foreground">{clientName}</p>
              <h1 className="text-2xl font-bold text-slate-900">{projectName}</h1>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={statusColor[projectStatus] || "bg-slate-100"}>
            {statusLabel[projectStatus] || projectStatus}
          </Badge>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className={healthColor(margin)}>
                  {isHealthy ? <CheckCircle className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                  Margen {fmtPct(margin)}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                {isHealthy ? "Proyecto rentable" : "Margen bajo - revisar costos"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* ─── Budget Progress ────────────────────────────────────── */}
      {budget > 0 && (
        <Card>
          <CardContent className="p-4">
            <ProgressBar
              value={cost}
              max={budget}
              label={`Presupuesto: ${fmt(cost)} de ${fmt(budget)} consumido`}
              color={budgetUsed > 80 ? "bg-red-500" : budgetUsed > 60 ? "bg-amber-500" : "bg-indigo-500"}
            />
          </CardContent>
        </Card>
      )}

      {/* ─── Tabs ───────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100/80 p-1 rounded-xl">
          <TabsTrigger value="resumen" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <BarChart3 className="h-4 w-4 mr-1.5" /> Resumen
          </TabsTrigger>
          <TabsTrigger value="equipo" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Users className="h-4 w-4 mr-1.5" /> Equipo
          </TabsTrigger>
          <TabsTrigger value="finanzas" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <DollarSign className="h-4 w-4 mr-1.5" /> Finanzas
          </TabsTrigger>
          <TabsTrigger value="tareas" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Target className="h-4 w-4 mr-1.5" /> Tareas
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab: Resumen ──────────────────────────────────────── */}
        <TabsContent value="resumen" className="mt-6 space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Revenue" value={fmt(revenue)} icon={TrendingUp} color="text-emerald-700" />
            <KpiCard label="Costo Real" value={fmt(cost)} icon={DollarSign} color="text-red-600" />
            <KpiCard label="Margen" value={fmtPct(margin)} subtitle={`Markup: ${markup.toFixed(1)}x`} icon={BarChart3} color={margin >= 20 ? "text-emerald-700" : "text-red-600"} alert={margin < 15} />
            <KpiCard label="Horas Trabajadas" value={fmtHours(totalHours)} subtitle={`${teamCount} personas activas`} icon={Clock} color="text-indigo-700" />
          </div>

          {/* Budget + Quick insights */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Resultado del Proyecto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-muted-foreground">Revenue</span>
                  <span className="text-lg font-semibold text-emerald-700">{fmt(revenue)}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-muted-foreground">Costos directos</span>
                  <span className="text-lg font-semibold text-red-600">-{fmt(cost)}</span>
                </div>
                <div className="border-t pt-3 flex justify-between items-baseline">
                  <span className="text-sm font-medium">Resultado</span>
                  <span className={`text-xl font-bold ${revenue - cost >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {fmt(revenue - cost)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Indicadores Clave</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Markup</span>
                  <Badge variant="outline" className={markup >= 2 ? "border-emerald-200 text-emerald-700" : "border-amber-200 text-amber-700"}>
                    {markup.toFixed(2)}x
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Burn Rate</span>
                  <span className="text-sm font-medium">{totalHours > 0 ? fmt(cost / totalHours) + "/h" : "—"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Budget consumido</span>
                  <span className={`text-sm font-medium ${budgetUsed > 80 ? "text-red-600" : "text-slate-700"}`}>
                    {budget > 0 ? `${budgetUsed.toFixed(0)}%` : "Sin budget"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Estado</span>
                  <Badge className={isHealthy ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}>
                    {isHealthy ? "Rentable" : "En Riesgo"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Tab: Equipo ───────────────────────────────────────── */}
        <TabsContent value="equipo" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Equipo del Proyecto</CardTitle>
            </CardHeader>
            <CardContent>
              {a?.teamBreakdown && a.teamBreakdown.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-slate-50/50">
                        <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase">Persona</th>
                        <th className="text-right py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase">Hs Estimadas</th>
                        <th className="text-right py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase">Hs Reales</th>
                        <th className="text-right py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase">Costo USD</th>
                        <th className="text-right py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase">Desvío</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.teamBreakdown.map((member: any, i: number) => (
                        <TeamRow key={member.personnelId || i} member={member} />
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 bg-slate-50/80">
                        <td className="py-3 px-4 text-sm font-semibold">Total</td>
                        <td className="py-3 px-4 text-right text-sm font-semibold tabular-nums">
                          {fmtHours(a.teamBreakdown.reduce((s: number, m: any) => s + (m.targetHours || 0), 0))}
                        </td>
                        <td className="py-3 px-4 text-right text-sm font-semibold tabular-nums">
                          {fmtHours(totalHours)}
                        </td>
                        <td className="py-3 px-4 text-right text-sm font-semibold tabular-nums">
                          {fmt(a.teamBreakdown.reduce((s: number, m: any) => s + (m.costUSD || 0), 0))}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No hay datos de equipo para este período</p>
                  <p className="text-xs mt-1">Las horas aparecen cuando el equipo las carga en Tareas o Time Entries</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab: Finanzas ─────────────────────────────────────── */}
        <TabsContent value="finanzas" className="mt-6 space-y-6">
          {/* P&L Waterfall */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">P&L del Proyecto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: "Revenue (Venta)", value: revenue, color: "bg-emerald-500", textColor: "text-emerald-700" },
                  { label: "Costos Directos", value: -cost, color: "bg-red-400", textColor: "text-red-600" },
                  { label: "Resultado Bruto", value: revenue - cost, color: revenue - cost >= 0 ? "bg-emerald-500" : "bg-red-500", textColor: revenue - cost >= 0 ? "text-emerald-700" : "text-red-700", bold: true },
                ].map((row, i) => (
                  <div key={i} className={`flex items-center justify-between py-2.5 px-4 rounded-lg ${row.bold ? "bg-slate-50 border" : ""}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-sm ${row.color}`} />
                      <span className={`text-sm ${row.bold ? "font-semibold" : "text-muted-foreground"}`}>{row.label}</span>
                    </div>
                    <span className={`text-sm font-semibold tabular-nums ${row.textColor}`}>
                      {fmt(Math.abs(row.value))}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Financial KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="ROI" value={`${markup > 0 ? ((markup - 1) * 100).toFixed(0) : 0}%`} icon={Zap} color={markup > 1.5 ? "text-emerald-700" : "text-red-600"} />
            <KpiCard label="Margen Neto" value={fmtPct(margin)} icon={TrendingUp} color={margin >= 20 ? "text-emerald-700" : "text-red-600"} />
            <KpiCard label="Burn Rate" value={totalHours > 0 ? `${fmt(cost / totalHours)}/h` : "—"} icon={DollarSign} />
            <KpiCard label="Budget Restante" value={budget > 0 ? fmt(budget - cost) : "—"} icon={Target} alert={budgetUsed > 90} />
          </div>

          {/* Quotation info */}
          {q && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Datos de Cotización</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Precio Cotizado</p>
                    <p className="font-semibold">{fmt(q.totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Costo Base</p>
                    <p className="font-semibold">{fmt(q.baseCost)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Markup Cotizado</p>
                    <p className="font-semibold">{fmt(q.markupAmount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tipo</p>
                    <p className="font-semibold capitalize">{q.quotationType || "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Tab: Tareas ───────────────────────────────────────── */}
        <TabsContent value="tareas" className="mt-6">
          <ProjectTaskList projectId={pid} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
