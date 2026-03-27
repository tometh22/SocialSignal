/**
 * Portfolio Analytics - Charts, Health Dashboard & AI Insights
 * Shows above the project cards in the Rentabilidad page
 */
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, Legend, PieChart, Pie, Cell, ReferenceLine
} from "recharts";
import {
  TrendingUp, TrendingDown, AlertTriangle, Shield, Lightbulb, Target,
  CheckCircle, AlertCircle, DollarSign
} from "lucide-react";

interface ProjectData {
  projectId?: number;
  projectName?: string;
  clientName?: string;
  metrics?: {
    revenueDisplay?: number;
    costDisplay?: number;
    markup?: number;
    markupRatio?: number;
    margin?: number;
    budget?: number;
    budgetUtilization?: number;
    totalHours?: number;
  };
  status?: string;
}

const COLORS = {
  healthy: "#10b981",
  warning: "#f59e0b",
  critical: "#ef4444",
  neutral: "#94a3b8",
};

function classifyProject(p: ProjectData): "healthy" | "warning" | "critical" {
  const markup = p.metrics?.markup || p.metrics?.markupRatio || 0;
  const margin = p.metrics?.margin || 0;
  if (markup >= 2.5 && margin >= 20) return "healthy";
  if (markup >= 2.0 || margin >= 10) return "warning";
  return "critical";
}

export default function PortfolioAnalytics({ projects }: { projects: ProjectData[] }) {
  const active = useMemo(() =>
    projects.filter(p => p.status === "active" && (p.metrics?.revenueDisplay || p.metrics?.costDisplay)),
    [projects]
  );

  if (active.length === 0) return null;

  // Health distribution
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

  // Revenue vs Cost by project (top 8)
  const revCostData = useMemo(() =>
    active
      .map(p => ({
        name: (p.projectName || "").slice(0, 15),
        revenue: Math.round(p.metrics?.revenueDisplay || 0),
        cost: Math.round(p.metrics?.costDisplay || 0),
        margin: p.metrics?.margin || 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8),
    [active]
  );

  // AI Insights
  const insights = useMemo(() => {
    const result: Array<{ icon: any; color: string; title: string; text: string }> = [];
    const recs: Array<{ priority: "high" | "medium" | "low"; text: string }> = [];

    const totalRevenue = active.reduce((s, p) => s + (p.metrics?.revenueDisplay || 0), 0);
    const totalCost = active.reduce((s, p) => s + (p.metrics?.costDisplay || 0), 0);
    const avgMarkup = active.filter(p => (p.metrics?.costDisplay || 0) > 0)
      .reduce((s, p, _, a) => s + ((p.metrics?.markup || p.metrics?.markupRatio || 0) / a.length), 0);
    const portfolioMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue * 100) : 0;

    // Portfolio health
    if (avgMarkup >= 3.0) {
      result.push({ icon: Shield, color: "text-emerald-600", title: "Portfolio saludable", text: `Markup promedio de ${avgMarkup.toFixed(1)}x supera el estándar Epical (2.5x).` });
    } else if (avgMarkup >= 2.5) {
      result.push({ icon: CheckCircle, color: "text-emerald-600", title: "Markup en target", text: `Markup promedio de ${avgMarkup.toFixed(1)}x. Dentro del estándar.` });
    } else if (avgMarkup > 0) {
      result.push({ icon: AlertTriangle, color: "text-amber-600", title: "Markup por debajo del estándar", text: `Markup promedio ${avgMarkup.toFixed(1)}x (mínimo: 2.5x).` });
      recs.push({ priority: "high", text: "Revisar pricing de proyectos con markup < 2.5x. Considerar renegociar o reducir scope." });
    }

    // Critical projects
    if (health.critical > 0) {
      const critNames = active.filter(p => classifyProject(p) === "critical").map(p => p.projectName).slice(0, 3).join(", ");
      result.push({ icon: AlertCircle, color: "text-red-600", title: `${health.critical} proyecto${health.critical > 1 ? "s" : ""} en riesgo`, text: critNames });
      recs.push({ priority: "high", text: `Revisar urgente: ${critNames}. Evaluar si renegociar precio o reducir asignación de equipo.` });
    }

    // Revenue concentration
    if (totalRevenue > 0 && active.length > 1) {
      const top = active.reduce((max, p) => (p.metrics?.revenueDisplay || 0) > (max.metrics?.revenueDisplay || 0) ? p : max, active[0]);
      const concentration = ((top.metrics?.revenueDisplay || 0) / totalRevenue) * 100;
      if (concentration > 40) {
        result.push({ icon: Target, color: "text-amber-600", title: "Alta concentración de revenue", text: `${top.projectName} representa el ${concentration.toFixed(0)}% del total. Diversificar cartera.` });
        recs.push({ priority: "medium", text: "Buscar nuevos clientes para reducir riesgo de concentración." });
      }
    }

    // Margin health
    if (portfolioMargin > 25) {
      result.push({ icon: TrendingUp, color: "text-emerald-600", title: `Margen del portfolio: ${portfolioMargin.toFixed(1)}%`, text: "Operación rentable con márgenes saludables." });
    } else if (portfolioMargin > 0) {
      result.push({ icon: AlertTriangle, color: "text-amber-600", title: `Margen del portfolio: ${portfolioMargin.toFixed(1)}%`, text: "Márgenes ajustados. Optimizar costos de equipo." });
    }

    if (recs.length === 0) {
      recs.push({ priority: "low", text: "Sin alertas urgentes. La operación se mantiene saludable." });
    }

    return { insights: result, recommendations: recs };
  }, [active, health]);

  return (
    <div className="space-y-6 mb-8">
      {/* Health Status + Pie Chart */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Health KPIs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Estado del Portfolio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-around py-2">
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600">{health.healthy}</div>
                <div className="text-[10px] text-muted-foreground uppercase">Saludable</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-500">{health.warning}</div>
                <div className="text-[10px] text-muted-foreground uppercase">Atención</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-500">{health.critical}</div>
                <div className="text-[10px] text-muted-foreground uppercase">Crítico</div>
              </div>
            </div>
            <div className="mt-3">
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={healthPieData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" paddingAngle={3}>
                    {healthPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <RTooltip formatter={(v: number, name: string) => [v, name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Revenue vs Cost by Project */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue vs Costo por Proyecto (USD)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revCostData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={90} />
                <RTooltip formatter={(v: number) => [`$${v.toLocaleString("es-AR")}`, ""]} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[0, 4, 4, 0]} barSize={12} />
                <Bar dataKey="cost" name="Costo" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* AI Insights + Recommendations */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="border-indigo-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-indigo-500" /> Análisis del Portfolio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.insights.map((ins, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <ins.icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${ins.color}`} />
                <div>
                  <p className="text-sm font-medium">{ins.title}</p>
                  <p className="text-xs text-muted-foreground">{ins.text}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className={health.critical > 0 ? "border-red-100" : "border-amber-100"}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-amber-500" /> Recomendaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {insights.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-2">
                <Badge variant="outline" className={`text-[10px] mt-0.5 flex-shrink-0 ${
                  rec.priority === "high" ? "border-red-200 text-red-700 bg-red-50" :
                  rec.priority === "medium" ? "border-amber-200 text-amber-700 bg-amber-50" :
                  "border-green-200 text-green-700 bg-green-50"
                }`}>
                  {rec.priority === "high" ? "URGENTE" : rec.priority === "medium" ? "MEDIO" : "OK"}
                </Badge>
                <p className="text-sm">{rec.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
