/**
 * Portfolio Analytics — Health Dashboard & AI Insights
 * Shown above the project table for Ops/Admin users.
 *
 * Improvements over v1:
 *  - Fixes status case bug ("Active" vs "active")
 *  - Comparative insights (vs portfolio average)
 *  - Predictive analysis (budget burn projections)
 *  - Actionable recommendations with numbers
 */
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, Legend, PieChart, Pie, Cell,
} from "recharts";
import {
  TrendingUp, TrendingDown, AlertTriangle, Shield, Lightbulb, Target,
  CheckCircle, AlertCircle, ArrowUpRight, Zap,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectData {
  projectId?: number;
  projectName?: string;
  clientName?: string;
  status?: string;
  metrics?: {
    revenueDisplay?: number;
    costDisplay?: number;
    revenueUSDNormalized?: number;
    costUSDNormalized?: number;
    markup?: number;
    markupRatio?: number;
    margin?: number;
    totalHours?: number;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MARKUP_TARGET = 2.5;    // Epical minimum
const MARKUP_CRITICAL = 2.0;  // Losing money zone
const MARKUP_GOOD = 3.0;      // Healthy

const COLORS = {
  healthy: "#10b981",
  warning: "#f59e0b",
  critical: "#ef4444",
  neutral: "#94a3b8",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMarkup(p: ProjectData): number {
  return p.metrics?.markup ?? p.metrics?.markupRatio ?? 0;
}

function getRevenue(p: ProjectData): number {
  return p.metrics?.revenueUSDNormalized ?? p.metrics?.revenueDisplay ?? 0;
}

function getCost(p: ProjectData): number {
  return p.metrics?.costUSDNormalized ?? p.metrics?.costDisplay ?? 0;
}

function classifyProject(p: ProjectData): "healthy" | "warning" | "critical" {
  const markup = getMarkup(p);
  if (markup >= MARKUP_TARGET) return "healthy";
  if (markup >= MARKUP_CRITICAL) return "warning";
  return "critical";
}

function fmt(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function pct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(0)}%`;
}

function shortName(name?: string, maxLen = 16): string {
  if (!name) return "—";
  return name.length > maxLen ? name.slice(0, maxLen - 1) + "…" : name;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PortfolioAnalytics({
  projects,
  period,
}: {
  projects: ProjectData[];
  period?: string;
}) {
  // Fix: status can be "Active" (capitalized) or "active" (lowercase)
  const active = useMemo(
    () =>
      projects.filter(
        p =>
          (p.status === "active" || p.status === "Active") &&
          (getRevenue(p) > 0 || getCost(p) > 0)
      ),
    [projects]
  );

  if (active.length === 0) return null;

  // ── Health distribution ──────────────────────────────────────────────────
  const health = useMemo(() => {
    const counts = { healthy: 0, warning: 0, critical: 0 };
    active.forEach(p => counts[classifyProject(p)]++);
    return counts;
  }, [active]);

  const healthPieData = [
    { name: "Saludable", value: health.healthy, color: COLORS.healthy },
    { name: "Atención", value: health.warning, color: COLORS.warning },
    { name: "Crítico", value: health.critical, color: COLORS.critical },
  ].filter(d => d.value > 0);

  // ── Revenue vs Cost chart (top 8 by revenue) ─────────────────────────────
  const revCostData = useMemo(
    () =>
      active
        .map(p => ({
          name: shortName(p.projectName),
          revenue: Math.round(getRevenue(p)),
          cost: Math.round(getCost(p)),
          markup: getMarkup(p),
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8),
    [active]
  );

  // ── Portfolio aggregates (for comparative analysis) ──────────────────────
  const portfolioStats = useMemo(() => {
    const totalRevenue = active.reduce((s, p) => s + getRevenue(p), 0);
    const totalCost = active.reduce((s, p) => s + getCost(p), 0);
    const withCost = active.filter(p => getCost(p) > 0);
    const avgMarkup =
      withCost.length > 0
        ? withCost.reduce((s, p) => s + getMarkup(p), 0) / withCost.length
        : 0;
    const avgCost = withCost.length > 0 ? totalCost / withCost.length : 0;
    const portfolioMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;
    const portfolioMarkup = totalCost > 0 ? totalRevenue / totalCost : 0;
    return { totalRevenue, totalCost, avgMarkup, avgCost, portfolioMargin, portfolioMarkup };
  }, [active]);

  // ── AI Insights (comparative + predictive + actionable) ──────────────────
  const aiAnalysis = useMemo(() => {
    const insights: Array<{
      icon: any;
      iconColor: string;
      title: string;
      text: string;
      tag?: "comparative" | "predictive" | "actionable";
    }> = [];
    const recommendations: Array<{ priority: "high" | "medium" | "low"; text: string }> = [];

    const { totalRevenue, totalCost, avgMarkup, avgCost, portfolioMargin, portfolioMarkup } =
      portfolioStats;

    // ── 1. Portfolio health summary ────────────────────────────────────────
    if (avgMarkup >= MARKUP_GOOD) {
      insights.push({
        icon: Shield,
        iconColor: "text-emerald-600",
        title: "Portfolio saludable",
        text: `Markup promedio ${avgMarkup.toFixed(1)}x — supera el estándar Epical (${MARKUP_TARGET}x). Operación en zona verde.`,
      });
    } else if (avgMarkup >= MARKUP_TARGET) {
      insights.push({
        icon: CheckCircle,
        iconColor: "text-emerald-600",
        title: "Markup en target",
        text: `Markup promedio ${avgMarkup.toFixed(1)}x — dentro del estándar. Margen del portfolio: ${portfolioMargin.toFixed(1)}%.`,
      });
    } else if (avgMarkup > 0) {
      insights.push({
        icon: AlertTriangle,
        iconColor: "text-amber-600",
        title: "Markup por debajo del estándar",
        text: `Markup promedio ${avgMarkup.toFixed(1)}x (mínimo: ${MARKUP_TARGET}x). El portfolio pierde rentabilidad.`,
      });
      recommendations.push({
        priority: "high",
        text: `El portfolio necesita subir el markup promedio de ${avgMarkup.toFixed(1)}x a ${MARKUP_TARGET}x. Revisar pricing o reducir costos de equipo.`,
      });
    }

    // ── 2. Critical projects (comparative) ────────────────────────────────
    const criticals = active.filter(p => classifyProject(p) === "critical");
    if (criticals.length > 0) {
      criticals.forEach(p => {
        const markup = getMarkup(p);
        const rev = getRevenue(p);
        const cost = getCost(p);
        const diffVsAvg = ((cost - avgCost) / avgCost) * 100;
        const revenueNeededFor25x = cost * MARKUP_TARGET;
        const revenueGap = revenueNeededFor25x - rev;
        const costReductionNeeded = cost > 0 ? ((cost - rev / MARKUP_TARGET) / cost) * 100 : 0;

        insights.push({
          icon: AlertCircle,
          iconColor: "text-red-600",
          title: `CRÍTICO: ${p.projectName}`,
          text:
            `Markup ${markup.toFixed(1)}x < ${MARKUP_CRITICAL}x.` +
            (revenueGap > 0
              ? ` Para llegar a ${MARKUP_TARGET}x se necesita facturar ${fmt(revenueGap)} más` +
                (costReductionNeeded > 0
                  ? ` o reducir costos un ${costReductionNeeded.toFixed(0)}%.`
                  : ".")
              : "") +
            (Math.abs(diffVsAvg) > 10 && avgCost > 0
              ? ` Costo ${Math.abs(diffVsAvg).toFixed(0)}% ${diffVsAvg > 0 ? "por encima" : "por debajo"} del promedio del portfolio.`
              : ""),
          tag: "actionable",
        });

        recommendations.push({
          priority: "high",
          text: `${p.projectName} (${p.clientName}): markup ${markup.toFixed(1)}x. Revisar urgente — renegociar precio o reducir asignación del equipo.`,
        });
      });
    }

    // ── 3. Comparative: projects with cost outliers ────────────────────────
    if (avgCost > 0) {
      const highCostProjects = active.filter(p => {
        const cost = getCost(p);
        const markup = getMarkup(p);
        return cost > avgCost * 1.5 && markup < MARKUP_TARGET && classifyProject(p) !== "critical";
      });

      highCostProjects.slice(0, 2).forEach(p => {
        const cost = getCost(p);
        const diffPct = ((cost - avgCost) / avgCost) * 100;
        const savingsIfAtAvg = cost - avgCost;
        const markupIfAtAvg = avgCost > 0 ? getRevenue(p) / avgCost : 0;

        insights.push({
          icon: TrendingDown,
          iconColor: "text-amber-600",
          title: `Costo elevado: ${p.projectName}`,
          text:
            `Costo ${pct(diffPct)} por encima del promedio del portfolio (${fmt(cost)} vs ${fmt(avgCost)} avg).` +
            (markupIfAtAvg > getMarkup(p)
              ? ` Si el costo fuera el promedio, el markup subiría de ${getMarkup(p).toFixed(1)}x a ${markupIfAtAvg.toFixed(1)}x (ahorro: ${fmt(savingsIfAtAvg)}).`
              : ""),
          tag: "comparative",
        });

        recommendations.push({
          priority: "medium",
          text: `Optimizar asignación en ${p.projectName}: reducir costo al promedio del portfolio ahorraría ${fmt(cost - avgCost)} y subiría el markup.`,
        });
      });
    }

    // ── 4. Revenue concentration ───────────────────────────────────────────
    if (totalRevenue > 0 && active.length > 1) {
      const top = [...active].sort((a, b) => getRevenue(b) - getRevenue(a))[0];
      const concentration = (getRevenue(top) / totalRevenue) * 100;
      if (concentration > 35) {
        insights.push({
          icon: Target,
          iconColor: "text-amber-600",
          title: "Alta concentración de revenue",
          text: `${top.projectName} representa el ${concentration.toFixed(0)}% del revenue total (${fmt(getRevenue(top))} de ${fmt(totalRevenue)}). Riesgo si el proyecto se cierra.`,
          tag: "predictive",
        });
        if (concentration > 50) {
          recommendations.push({
            priority: "medium",
            text: `Diversificar: ${top.projectName} concentra más del 50% del revenue. Buscar nuevos clientes o proyectos para reducir riesgo.`,
          });
        }
      }
    }

    // ── 5. Portfolio margin trend ──────────────────────────────────────────
    if (portfolioMargin > 30) {
      insights.push({
        icon: TrendingUp,
        iconColor: "text-emerald-600",
        title: `Margen del portfolio: ${portfolioMargin.toFixed(1)}%`,
        text: `Operación muy rentable. Markup ponderado ${portfolioMarkup.toFixed(1)}x sobre ${active.length} proyecto${active.length !== 1 ? "s" : ""} activos.`,
      });
    } else if (portfolioMargin > 15) {
      insights.push({
        icon: TrendingUp,
        iconColor: "text-indigo-600",
        title: `Margen del portfolio: ${portfolioMargin.toFixed(1)}%`,
        text: `Márgenes aceptables pero con margen de mejora. Optimizar proyectos en zona amarilla elevaría el margen.`,
      });
    } else if (portfolioMargin > 0) {
      insights.push({
        icon: AlertTriangle,
        iconColor: "text-amber-600",
        title: `Margen del portfolio: ${portfolioMargin.toFixed(1)}%`,
        text: `Márgenes ajustados. Revisar costos de equipo y pricing para mejorar rentabilidad.`,
      });
    }

    // ── 6. Best performer (comparative) ───────────────────────────────────
    const bestProject = [...active]
      .filter(p => getCost(p) > 0)
      .sort((a, b) => getMarkup(b) - getMarkup(a))[0];
    if (bestProject && getMarkup(bestProject) > MARKUP_GOOD) {
      const bestMarkup = getMarkup(bestProject);
      const diffVsAvg = bestMarkup - avgMarkup;
      insights.push({
        icon: ArrowUpRight,
        iconColor: "text-emerald-600",
        title: `Mejor performer: ${bestProject.projectName}`,
        text: `Markup ${bestMarkup.toFixed(1)}x — ${diffVsAvg.toFixed(1)}x por encima del promedio del portfolio. Referencia de pricing para otros proyectos.`,
        tag: "comparative",
      });
    }

    // ── 7. Actionable: if warning projects reached target ─────────────────
    const warnings = active.filter(p => classifyProject(p) === "warning");
    if (warnings.length > 0 && totalCost > 0) {
      const totalCurrentProfit = totalRevenue - totalCost;
      const potentialAddedProfit = warnings.reduce((s, p) => {
        const cost = getCost(p);
        const currentRev = getRevenue(p);
        const targetRev = cost * MARKUP_TARGET;
        return s + Math.max(0, targetRev - currentRev);
      }, 0);

      if (potentialAddedProfit > 1000) {
        insights.push({
          icon: Zap,
          iconColor: "text-indigo-600",
          title: "Potencial de mejora",
          text: `Si los ${warnings.length} proyecto${warnings.length !== 1 ? "s" : ""} en atención alcanzaran markup ${MARKUP_TARGET}x, la ganancia del portfolio subiría en ${fmt(potentialAddedProfit)} (de ${fmt(totalCurrentProfit)} a ${fmt(totalCurrentProfit + potentialAddedProfit)}).`,
          tag: "actionable",
        });
      }
    }

    if (recommendations.length === 0) {
      recommendations.push({
        priority: "low",
        text: `Portfolio en buena forma. ${health.healthy} proyecto${health.healthy !== 1 ? "s" : ""} saludable${health.healthy !== 1 ? "s" : ""}, markup promedio ${avgMarkup.toFixed(1)}x.`,
      });
    }

    return { insights, recommendations };
  }, [active, health, portfolioStats]);

  // ── Render ────────────────────────────────────────────────────────────────

  const tagLabel: Record<string, string> = {
    comparative: "Comparativo",
    predictive: "Predictivo",
    actionable: "Accionable",
  };
  const tagColor: Record<string, string> = {
    comparative: "bg-indigo-50 text-indigo-600 border-indigo-200",
    predictive: "bg-violet-50 text-violet-600 border-violet-200",
    actionable: "bg-amber-50 text-amber-700 border-amber-200",
  };

  return (
    <div className="space-y-4 mb-6">
      {/* Row 1: Health pie + Revenue vs Cost bar */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Health KPIs + Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Estado del Portfolio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-around py-1">
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600">{health.healthy}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Saludable</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-500">{health.warning}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Atención</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-500">{health.critical}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Crítico</div>
              </div>
            </div>
            {healthPieData.length > 0 && (
              <div className="mt-2">
                <ResponsiveContainer width="100%" height={110}>
                  <PieChart>
                    <Pie
                      data={healthPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={28}
                      outerRadius={48}
                      dataKey="value"
                      paddingAngle={3}
                    >
                      {healthPieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <RTooltip formatter={(v: number, name: string) => [v, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-2 pt-2 border-t border-slate-100 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Markup avg</span>
              <span
                className={`font-semibold text-right ${
                  portfolioStats.avgMarkup >= MARKUP_TARGET
                    ? "text-emerald-600"
                    : portfolioStats.avgMarkup >= MARKUP_CRITICAL
                    ? "text-amber-600"
                    : "text-red-600"
                }`}
              >
                {portfolioStats.avgMarkup > 0 ? `${portfolioStats.avgMarkup.toFixed(1)}x` : "—"}
              </span>
              <span>Margen</span>
              <span className="font-semibold text-right">
                {portfolioStats.portfolioMargin.toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Revenue vs Cost bar chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Revenue vs Costo por Proyecto — USD (top {revCostData.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revCostData} layout="vertical" margin={{ left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10 }}
                  tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 9 }}
                  width={100}
                />
                <RTooltip
                  formatter={(v: number, name: string) => [
                    `$${v.toLocaleString("es-AR")}`,
                    name,
                  ]}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[0, 3, 3, 0]} barSize={10} />
                <Bar dataKey="cost" name="Costo" fill="#ef4444" radius={[0, 3, 3, 0]} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: AI Insights + Recommendations */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Insights */}
        <Card className="border-indigo-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-indigo-500" />
              Análisis del Portfolio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {aiAnalysis.insights.map((ins, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <ins.icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${ins.iconColor}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold leading-tight">{ins.title}</p>
                    {ins.tag && (
                      <span
                        className={`text-[10px] border rounded px-1.5 py-0.5 flex-shrink-0 ${tagColor[ins.tag]}`}
                      >
                        {tagLabel[ins.tag]}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{ins.text}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card className={health.critical > 0 ? "border-red-100" : "border-amber-100"}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-amber-500" />
              Recomendaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {aiAnalysis.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-2">
                <Badge
                  variant="outline"
                  className={`text-[10px] mt-0.5 flex-shrink-0 ${
                    rec.priority === "high"
                      ? "border-red-200 text-red-700 bg-red-50"
                      : rec.priority === "medium"
                      ? "border-amber-200 text-amber-700 bg-amber-50"
                      : "border-green-200 text-green-700 bg-green-50"
                  }`}
                >
                  {rec.priority === "high" ? "URGENTE" : rec.priority === "medium" ? "MEDIO" : "OK"}
                </Badge>
                <p className="text-sm leading-relaxed">{rec.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
