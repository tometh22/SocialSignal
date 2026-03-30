/**
 * AI Copilot — Project Intelligence Engine (Redesigned)
 * Smart collapse for signals, action buttons, improved visual hierarchy.
 */
import { useMemo, useState } from "react";
import { Zap, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, ChevronDown, ChevronRight, FlaskConical, Eye, Lightbulb } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AICopilotProps {
  revenue: number;
  cost: number;
  markup: number;
  margin: number;
  budget: number;
  budgetUtilization: number;
  totalHours: number;
  estimatedHours: number;
  hoursDeviation: number;
  costDeviation: number;
  teamBreakdown: Array<{
    name: string;
    role?: string;
    targetHours?: number;
    estimatedHours?: number;
    hours?: number;
    hoursAsana?: number;
    costUSD?: number;
    cost?: number;
  }>;
  previousPeriod?: {
    hasData: boolean;
    metrics?: {
      markup: number;
      margin: number;
      revenueUSD: number;
      teamCostUSD: number;
      totalHours: number;
    } | null;
  };
  period?: string;
}

type SignalLevel = "critical" | "warning" | "good" | "info";

interface Signal {
  level: SignalLevel;
  headline: string;
  detail: string;
}

interface Recommendation {
  rank: number;
  text: string;
  impact: "high" | "medium" | "low";
}

interface WhatIfScenario {
  label: string;
  change: string;
  newMarkup: number;
  newRevenue?: number;
  newCost?: number;
  delta: number;
  positive: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function usd(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function pct(n: number, sign = true) {
  return `${sign && n > 0 ? "+" : ""}${n.toFixed(0)}%`;
}

// ─── Intelligence Engine ───────────────────────────────────────────────────────────

function useProjectIntelligence(props: AICopilotProps) {
  return useMemo(() => {
    const {
      revenue, cost, markup, margin, budget, budgetUtilization,
      totalHours, estimatedHours, hoursDeviation, costDeviation,
      teamBreakdown, previousPeriod,
    } = props;

    const signals: Signal[] = [];
    const recommendations: Recommendation[] = [];
    let recRank = 1;

    if (cost > 0) {
      const gapTo25x = cost * 2.5 - revenue;
      const costCutNeeded = cost > 0 ? ((cost - revenue / 2.5) / cost) * 100 : 0;
      if (markup < 2.0) {
        signals.push({ level: "critical", headline: `Markup CRITICO: ${markup.toFixed(2)}x`, detail: `Por debajo de 2.0x — el proyecto genera pérdida de eficiencia. Necesita ${usd(Math.abs(gapTo25x))} más de revenue o reducir costos un ${costCutNeeded.toFixed(0)}% para llegar al estándar Epical (2.5x).` });
        recommendations.push({ rank: recRank++, impact: "high", text: `Renegociar precio o reducir scope para subir markup de ${markup.toFixed(1)}x → 2.5x (faltan ${usd(gapTo25x)}).` });
      } else if (markup < 2.5) {
        signals.push({ level: "warning", headline: `Markup bajo el estándar: ${markup.toFixed(2)}x`, detail: `Meta Epical: 2.5x. Faltan ${usd(gapTo25x)} de revenue o reducir costos un ${costCutNeeded.toFixed(0)}% para alcanzarla.` });
        recommendations.push({ rank: recRank++, impact: "high", text: `Para llegar a 2.5x: subir revenue en ${usd(gapTo25x)} o reducir costos de equipo en ${costCutNeeded.toFixed(0)}%.` });
      } else if (markup >= 3.0) {
        signals.push({ level: "good", headline: `Markup excelente: ${markup.toFixed(2)}x`, detail: `${((markup / 2.5 - 1) * 100).toFixed(0)}% por encima del estándar Epical. Proyecto altamente rentable con ${margin.toFixed(1)}% de margen.` });
      } else {
        signals.push({ level: "good", headline: `Markup en target: ${markup.toFixed(2)}x`, detail: `Dentro del estándar Epical (2.5x). Margen del ${margin.toFixed(1)}%. Monitorear costos de equipo.` });
      }
    }

    if (budget > 0) {
      const remaining = budget - cost;
      if (budgetUtilization >= 90) {
        signals.push({ level: "critical", headline: `Budget al ${budgetUtilization.toFixed(0)}% — quedan ${usd(remaining)}`, detail: `El presupuesto está prácticamente agotado. ${remaining < 0 ? `Excedido en ${usd(Math.abs(remaining))}.` : `Solo quedan ${usd(remaining)} disponibles.`}` });
        recommendations.push({ rank: recRank++, impact: "high", text: `Solicitar extensión de presupuesto o frenar trabajo adicional. Quedan ${usd(remaining)}.` });
      } else if (budgetUtilization >= 75) {
        let weeksDetail = "";
        if (estimatedHours > 0 && totalHours > 0) {
          const hoursLeft = estimatedHours - totalHours;
          const avgCostPerHour = totalHours > 0 ? cost / totalHours : 0;
          if (hoursLeft * avgCostPerHour > remaining) weeksDetail = ` Al ritmo actual (${usd(avgCostPerHour)}/h), el presupuesto se agotaría antes de terminar el proyecto.`;
        }
        signals.push({ level: "warning", headline: `Budget al ${budgetUtilization.toFixed(0)}% — quedan ${usd(remaining)}`, detail: `El proyecto consumió ${budgetUtilization.toFixed(0)}% del presupuesto.${weeksDetail} Planificar cierre o extensión.` });
        recommendations.push({ rank: recRank++, impact: "medium", text: `Monitorear el burn rate. Con ${usd(remaining)} restantes, asegurar que el scope restante esté cubierto.` });
      } else {
        signals.push({ level: "good", headline: `Budget saludable: ${budgetUtilization.toFixed(0)}% consumido`, detail: `Quedan ${usd(remaining)} de presupuesto (${(100 - budgetUtilization).toFixed(0)}% disponible).` });
      }
    }

    const withTarget = teamBreakdown.filter(m => { const target = m.targetHours ?? m.estimatedHours ?? 0; const actual = m.hoursAsana ?? m.hours ?? 0; return target > 0 && actual > 0; });
    if (withTarget.length > 0) {
      const overruners = withTarget.map(m => { const target = m.targetHours ?? m.estimatedHours ?? 0; const actual = m.hoursAsana ?? m.hours ?? 0; const excess = actual - target; const excessPct = target > 0 ? (excess / target) * 100 : 0; const costPerHour = actual > 0 ? ((m.costUSD ?? m.cost ?? 0) / actual) : 0; const excessCost = excess * costPerHour; return { ...m, target, actual, excess, excessPct, costPerHour, excessCost }; }).filter(m => m.excessPct > 15).sort((a, b) => b.excessCost - a.excessCost);
      if (overruners.length > 0) {
        const top = overruners[0];
        const newMarkup = (cost - top.excessCost) > 0 ? revenue / (cost - top.excessCost) : 0;
        signals.push({ level: top.excessPct > 30 ? "warning" : "info", headline: `${top.name}: +${top.excess.toFixed(0)}h sobre estimación (${pct(top.excessPct)})`, detail: `Lleva ${top.actual.toFixed(0)}h vs ${top.target.toFixed(0)}h planeadas. El exceso equivale a ${usd(top.excessCost)} de costo adicional.${newMarkup > 0 && newMarkup > markup ? ` Si vuelve a target, el markup subiría de ${markup.toFixed(1)}x a ${newMarkup.toFixed(1)}x.` : ""}` });
        if (top.excessCost > 500) recommendations.push({ rank: recRank++, impact: top.excessPct > 30 ? "high" : "medium", text: `Revisar carga de ${top.name}: ${top.excess.toFixed(0)}h de exceso = ${usd(top.excessCost)}. ${newMarkup > 0 ? `Reducir a target subiría markup a ${newMarkup.toFixed(1)}x.` : ""}` });
      }
      if (Math.abs(hoursDeviation) > 10) {
        const avgRate = totalHours > 0 ? cost / totalHours : 0;
        const excessCost = (hoursDeviation / 100) * estimatedHours * avgRate;
        if (hoursDeviation > 0 && excessCost > 300) signals.push({ level: hoursDeviation > 25 ? "warning" : "info", headline: `Equipo: ${pct(hoursDeviation)} de horas sobre lo estimado`, detail: `${totalHours.toFixed(0)}h trabajadas vs ${estimatedHours.toFixed(0)}h estimadas. El desvío equivale a ~${usd(excessCost)} de costo adicional (a ${usd(avgRate)}/h promedio).` });
      }
    } else if (estimatedHours > 0 && totalHours > 0) {
      const devPct = ((totalHours - estimatedHours) / estimatedHours) * 100;
      if (Math.abs(devPct) > 15) {
        const avgRate = totalHours > 0 ? cost / totalHours : 0;
        const excessCost = Math.abs(devPct / 100) * estimatedHours * avgRate;
        signals.push({ level: devPct > 25 ? "warning" : "info", headline: `Horas: ${devPct > 0 ? "+" : ""}${devPct.toFixed(0)}% vs estimación`, detail: `${totalHours.toFixed(0)}h reales vs ${estimatedHours.toFixed(0)}h estimadas. Impacto en costo: ~${usd(excessCost)}.` });
      }
    }

    if (previousPeriod?.hasData && previousPeriod.metrics && markup > 0) {
      const prev = previousPeriod.metrics;
      const markupDelta = markup - prev.markup;
      const revDelta = revenue - prev.revenueUSD;
      if (Math.abs(markupDelta) >= 0.2) signals.push({ level: markupDelta > 0 ? "good" : "info", headline: `Markup ${markupDelta > 0 ? "mejoró" : "bajó"} ${Math.abs(markupDelta).toFixed(1)}x vs período anterior`, detail: `Pasó de ${prev.markup.toFixed(1)}x a ${markup.toFixed(1)}x. ${revDelta !== 0 ? `Revenue ${revDelta > 0 ? "subió" : "bajó"} ${usd(Math.abs(revDelta))} vs mes anterior.` : ""}` });
    }

    const hasCritical = signals.some(s => s.level === "critical");
    const hasWarning = signals.some(s => s.level === "warning");
    if (!hasCritical && !hasWarning && markup >= 2.5) recommendations.push({ rank: recRank++, impact: "low", text: "Sin alertas. Mantener el ritmo actual y monitorear el budget restante periódicamente." });

    const whatIfScenarios: WhatIfScenario[] = [];
    if (cost > 0 && revenue > 0) {
      const avgRate = totalHours > 0 ? cost / totalHours : 0;
      const rev10 = revenue * 1.1; const markup10 = rev10 / cost;
      whatIfScenarios.push({ label: "+10% precio", change: `Revenue ${usd(revenue)} → ${usd(rev10)}`, newMarkup: markup10, newRevenue: rev10, delta: markup10 - markup, positive: markup10 > markup });
      if (avgRate > 0) { const costSaved = 10 * avgRate; const newCostB = Math.max(0, cost - costSaved); const markupB = newCostB > 0 ? revenue / newCostB : 0; whatIfScenarios.push({ label: "-10h de equipo", change: `Ahorro ~${usd(costSaved)} (a ${usd(avgRate)}/h)`, newMarkup: markupB, newCost: newCostB, delta: markupB - markup, positive: markupB > markup }); }
      if (estimatedHours > 0 && totalHours > estimatedHours && avgRate > 0) { const costAtTarget = estimatedHours * avgRate; const markupTarget = revenue / costAtTarget; const savings = cost - costAtTarget; if (savings > 0) whatIfScenarios.push({ label: "Llegar a horas estimadas", change: `${totalHours.toFixed(0)}h → ${estimatedHours.toFixed(0)}h, ahorro ${usd(savings)}`, newMarkup: markupTarget, newCost: costAtTarget, delta: markupTarget - markup, positive: markupTarget > markup }); }
      const costMinus5 = cost * 0.95; const markupMinus5 = revenue / costMinus5;
      whatIfScenarios.push({ label: "-5% costos generales", change: `Costo ${usd(cost)} → ${usd(costMinus5)}`, newMarkup: markupMinus5, newCost: costMinus5, delta: markupMinus5 - markup, positive: markupMinus5 > markup });
    }

    const diagnosis = hasCritical ? "critical" : hasWarning ? "warning" : "healthy";
    return { signals, recommendations, whatIfScenarios, diagnosis };
  }, [props]);
}

// ─── Signal Icon ───────────────────────────────────────────────────────────────

function SignalIcon({ level }: { level: SignalLevel }) {
  if (level === "critical") return <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />;
  if (level === "warning")  return <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />;
  if (level === "good")     return <CheckCircle   className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />;
  return                           <TrendingUp     className="h-4 w-4 text-indigo-400 flex-shrink-0 mt-0.5" />;
}

const SIGNAL_BG: Record<SignalLevel, string> = {
  critical: "bg-red-50 border-red-200 border-l-4 border-l-red-500",
  warning: "bg-amber-50 border-amber-200 border-l-4 border-l-amber-400",
  good: "bg-emerald-50 border-emerald-200 border-l-4 border-l-emerald-500",
  info: "bg-indigo-50 border-indigo-100 border-l-4 border-l-indigo-300",
};

const IMPACT_BADGE: Record<string, string> = {
  high: "bg-red-100 text-red-700 border border-red-200",
  medium: "bg-amber-100 text-amber-700 border border-amber-200",
  low: "bg-emerald-100 text-emerald-700 border border-emerald-200",
};

const IMPACT_LABEL: Record<string, string> = {
  high: "URGENTE",
  medium: "MEDIO",
  low: "OK",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AICopilot(props: AICopilotProps) {
  const { signals, recommendations, whatIfScenarios, diagnosis } = useProjectIntelligence(props);
  const [showAllSignals, setShowAllSignals] = useState(false);
  const [showWhatIf, setShowWhatIf] = useState(false);

  const headerBorder = diagnosis === "critical" ? "border-l-red-500" : diagnosis === "warning" ? "border-l-amber-400" : "border-l-emerald-500";
  const diagnosisMeta = {
    critical: { label: "Proyecto en Riesgo", dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50 border-red-100" },
    warning:  { label: "Requiere Atención",  dot: "bg-amber-400", text: "text-amber-700", bg: "bg-amber-50 border-amber-100" },
    healthy:  { label: "Proyecto Saludable", dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50 border-emerald-100" },
  }[diagnosis];

  const criticalCount = signals.filter(s => s.level === "critical").length;
  const warningCount  = signals.filter(s => s.level === "warning").length;

  // Smart collapse: show critical/warning expanded, collapse good/info by default
  const prioritySignals = signals.filter(s => s.level === "critical" || s.level === "warning");
  const secondarySignals = signals.filter(s => s.level === "good" || s.level === "info");
  const visibleSignals = showAllSignals ? signals : (prioritySignals.length > 0 ? prioritySignals : signals.slice(0, 2));
  const hiddenCount = signals.length - visibleSignals.length;

  return (
    <div className={`bg-indigo-50/40 rounded-2xl border border-indigo-200/50 border-l-4 ${headerBorder} shadow-sm overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-indigo-100/60 bg-indigo-50/60">
        <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center">
          <Zap className="h-3 w-3 text-indigo-600" />
        </div>
        <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">AI Copilot</span>
        <span className="text-[10px] text-indigo-400">Epical Intelligence</span>
        <div className="ml-auto flex items-center gap-2">
          {criticalCount > 0 && <span className="text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200 rounded-full px-2.5 py-0.5">{criticalCount} critico{criticalCount > 1 ? "s" : ""}</span>}
          {warningCount > 0 && <span className="text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-0.5">{warningCount} atención</span>}
          <span className={`flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2.5 py-0.5 border ${diagnosisMeta.bg} ${diagnosisMeta.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${diagnosisMeta.dot} ${diagnosis !== "healthy" ? "animate-pulse" : ""}`} />
            {diagnosisMeta.label}
          </span>
        </div>
      </div>

      <div className="p-4 grid md:grid-cols-2 gap-4 bg-white/50">
        {/* Signals */}
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Eye className="h-3 w-3" />
            Señales detectadas
          </p>
          <div className="space-y-2">
            {visibleSignals.map((s, i) => (
              <div key={i} className={`rounded-xl border px-3.5 py-2.5 transition-all ${SIGNAL_BG[s.level]}`}>
                <div className="flex items-start gap-2.5">
                  <SignalIcon level={s.level} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 leading-snug">{s.headline}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{s.detail}</p>
                  </div>
                </div>
              </div>
            ))}
            {signals.length === 0 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                <p className="text-sm text-emerald-700 font-medium">Sin señales de riesgo detectadas.</p>
              </div>
            )}
            {/* Show more / less toggle */}
            {hiddenCount > 0 && !showAllSignals && (
              <button
                onClick={() => setShowAllSignals(true)}
                className="w-full text-center py-2 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center gap-1 rounded-lg hover:bg-slate-50"
              >
                <ChevronDown className="h-3 w-3" />
                Ver {hiddenCount} señal{hiddenCount > 1 ? "es" : ""} más
              </button>
            )}
            {showAllSignals && secondarySignals.length > 0 && prioritySignals.length > 0 && (
              <button
                onClick={() => setShowAllSignals(false)}
                className="w-full text-center py-2 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center gap-1 rounded-lg hover:bg-slate-50"
              >
                <ChevronDown className="h-3 w-3 rotate-180" />
                Mostrar solo alertas
              </button>
            )}
          </div>
        </div>

        {/* Recommendations */}
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Lightbulb className="h-3 w-3" />
            Acciones recomendadas
          </p>
          <div className="space-y-2">
            {recommendations.map((r) => (
              <div key={r.rank} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-3 hover:bg-slate-100/60 transition-colors group">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 text-white text-[11px] font-bold flex items-center justify-center mt-0.5">{r.rank}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-600 leading-relaxed">{r.text}</p>
                </div>
                <span className={`flex-shrink-0 text-[10px] font-semibold rounded-md px-2 py-0.5 mt-0.5 ${IMPACT_BADGE[r.impact]}`}>
                  {IMPACT_LABEL[r.impact]}
                </span>
              </div>
            ))}
            {recommendations.length === 0 && (
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5">
                <p className="text-sm text-slate-400 italic">Sin acciones requeridas por ahora.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* What-If Scenarios (collapsible) */}
      {whatIfScenarios.length > 0 && (
        <div className="border-t border-slate-100">
          <button
            onClick={() => setShowWhatIf(!showWhatIf)}
            className="w-full flex items-center gap-2 px-4 py-2.5 bg-indigo-50/30 hover:bg-indigo-50/60 transition-colors"
          >
            <FlaskConical className="h-3.5 w-3.5 text-indigo-500" />
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Escenarios What-If</p>
            <span className="text-[10px] text-slate-300 ml-0.5">— simulación instantánea</span>
            <ChevronRight className={`h-3.5 w-3.5 text-slate-400 ml-auto transition-transform ${showWhatIf ? "rotate-90" : ""}`} />
          </button>
          {showWhatIf && (
            <div className="px-4 pb-3 bg-indigo-50/20">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {whatIfScenarios.map((sc, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{sc.label}</p>
                    <p className="text-[11px] text-slate-400 leading-snug mb-2.5">{sc.change}</p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl font-bold text-slate-900 tabular-nums">{sc.newMarkup.toFixed(2)}x</span>
                      <span className={`text-xs font-semibold flex items-center gap-0.5 ${sc.positive ? "text-emerald-600" : "text-red-500"}`}>
                        {sc.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {sc.delta > 0 ? "+" : ""}{sc.delta.toFixed(2)}x
                      </span>
                    </div>
                    <span className={`mt-2 text-[10px] font-semibold rounded-md px-2 py-0.5 inline-block border ${
                      sc.newMarkup >= 2.5 ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : sc.newMarkup >= 2.0 ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-red-50 text-red-700 border-red-200"
                    }`}>
                      {sc.newMarkup >= 2.5 ? "En target" : sc.newMarkup >= 2.0 ? "Bajo estándar" : "Critico"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
