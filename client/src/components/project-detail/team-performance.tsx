/**
 * Team Performance — tabla de equipo con efficiency scores, desvíos visuales
 * y distribución de costos. Visible solo para Ops/Admin (canSeeCosts).
 */
import { Users } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RTooltip } from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TeamMember {
  personnelId?: number | string;
  name: string;
  role?: string;
  roleName?: string;
  targetHours?: number;
  estimatedHours?: number;
  hours?: number;
  hoursAsana?: number;
  costUSD?: number;
  cost?: number;
  efficiencyScore?: number;   // from rankings.economicMetrics (0-100)
  performanceColor?: string;  // "green" | "amber" | "red" from rankings
}

interface TeamPerformanceProps {
  team: TeamMember[];
  canSeeCosts: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function usd(n: number) {
  if (!Number.isFinite(n) || n === 0) return "—";
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function initials(name: string) {
  return name
    .split(" ")
    .map(p => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const AVATAR_COLORS = [
  "from-indigo-400 to-violet-500",
  "from-emerald-400 to-teal-500",
  "from-orange-400 to-amber-500",
  "from-rose-400 to-pink-500",
  "from-sky-400 to-blue-500",
  "from-purple-400 to-fuchsia-500",
];

const PIE_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

// ─── Mini Hours Bar ───────────────────────────────────────────────────────────

function HoursBar({ actual, target }: { actual: number; target: number }) {
  if (target <= 0) {
    return <span className="text-sm tabular-nums text-slate-600">{actual.toFixed(0)}h</span>;
  }
  const pct = Math.min(150, (actual / target) * 100);
  const over = actual > target;
  const barColor = pct >= 125 ? "bg-red-500" : pct >= 105 ? "bg-amber-400" : "bg-emerald-500";

  return (
    <div className="space-y-1 min-w-[80px]">
      <div className="flex justify-between text-[11px]">
        <span className={`font-semibold tabular-nums ${over ? "text-red-600" : "text-slate-700"}`}>
          {actual.toFixed(0)}h
        </span>
        <span className="text-slate-400">/{target.toFixed(0)}h</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

// ─── Efficiency Badge ─────────────────────────────────────────────────────────

function EfficiencyBadge({ score, color }: { score?: number; color?: string }) {
  if (score == null) return <span className="text-slate-300 text-xs">—</span>;

  const cls =
    color === "green" || score >= 70 ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
    : color === "amber" || score >= 40 ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
    : "bg-red-50 text-red-700 ring-1 ring-red-200";

  const label =
    score >= 80 ? "Excelente"
    : score >= 60 ? "Bueno"
    : score >= 40 ? "Regular"
    : "Bajo";

  return (
    <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${cls}`}>
      {label} {score.toFixed(0)}
    </span>
  );
}

// ─── Deviation Badge ──────────────────────────────────────────────────────────

function DeviationBadge({ actual, target }: { actual: number; target: number }) {
  if (target <= 0) return <span className="text-slate-300 text-xs">—</span>;
  const dev = ((actual - target) / target) * 100;
  const abs = Math.abs(dev).toFixed(0);
  const cls =
    dev > 20 ? "bg-red-50 text-red-700 ring-1 ring-red-200"
    : dev > 5 ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
    : dev < -10 ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
    : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";

  return (
    <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${cls}`}>
      {dev > 0 ? "+" : ""}{abs}%
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TeamPerformance({ team, canSeeCosts }: TeamPerformanceProps) {
  if (!team || team.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
        <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Sin datos de equipo para este período.</p>
        <p className="text-xs mt-1 text-slate-300">Las horas aparecen cuando el equipo las carga en Tareas.</p>
      </div>
    );
  }

  // Normalize member data
  const members = team.map((m, i) => ({
    ...m,
    actualHours: m.hoursAsana ?? m.hours ?? 0,
    target: m.targetHours ?? m.estimatedHours ?? 0,
    costVal: m.costUSD ?? m.cost ?? 0,
    gradient: AVATAR_COLORS[i % AVATAR_COLORS.length],
    role: m.roleName ?? m.role ?? "",
  }));

  const totalCost = members.reduce((s, m) => s + m.costVal, 0);
  const totalHours = members.reduce((s, m) => s + m.actualHours, 0);

  // Sort: overrun first, then by hours desc
  const sorted = [...members].sort((a, b) => {
    const devA = a.target > 0 ? (a.actualHours - a.target) / a.target : 0;
    const devB = b.target > 0 ? (b.actualHours - b.target) / b.target : 0;
    if (devA > 0.05 && devB <= 0.05) return -1;
    if (devB > 0.05 && devA <= 0.05) return 1;
    return b.actualHours - a.actualHours;
  });

  // Pie data for cost distribution
  const pieData = members
    .filter(m => m.costVal > 0)
    .map((m, i) => ({
      name: m.name.split(" ")[0],
      value: Math.round(m.costVal),
      color: PIE_COLORS[i % PIE_COLORS.length],
    }));

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-800">Equipo</span>
          <span className="text-xs text-slate-400">{members.length} personas</span>
        </div>
        {canSeeCosts && totalCost > 0 && (
          <span className="text-xs text-slate-500">
            Total: <span className="font-semibold text-slate-700">{usd(totalCost)}</span>
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-white">
              <th className="py-2.5 pl-5 pr-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Persona</th>
              <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Horas</th>
              <th className="py-2.5 px-3 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Desvío</th>
              {canSeeCosts && (
                <th className="py-2.5 px-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Costo</th>
              )}
              <th className="py-2.5 px-3 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Eficiencia</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m, i) => (
              <tr key={m.personnelId ?? i} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                {/* Avatar + Name */}
                <td className="py-3 pl-5 pr-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${m.gradient} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                      {initials(m.name)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800 leading-tight">{m.name}</p>
                      {m.role && <p className="text-[11px] text-slate-400 leading-tight">{m.role}</p>}
                    </div>
                  </div>
                </td>

                {/* Hours bar */}
                <td className="py-3 px-3">
                  <HoursBar actual={m.actualHours} target={m.target} />
                </td>

                {/* Deviation badge */}
                <td className="py-3 px-3 text-center">
                  <DeviationBadge actual={m.actualHours} target={m.target} />
                </td>

                {/* Cost */}
                {canSeeCosts && (
                  <td className="py-3 px-3 text-right tabular-nums text-sm text-slate-600 font-medium">
                    {usd(m.costVal)}
                    {totalCost > 0 && m.costVal > 0 && (
                      <div className="text-[10px] text-slate-400">
                        {((m.costVal / totalCost) * 100).toFixed(0)}%
                      </div>
                    )}
                  </td>
                )}

                {/* Efficiency */}
                <td className="py-3 px-3 text-center">
                  <EfficiencyBadge score={m.efficiencyScore} color={m.performanceColor} />
                </td>
              </tr>
            ))}
          </tbody>

          {/* Totals */}
          {(totalHours > 0 || (canSeeCosts && totalCost > 0)) && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50/80">
                <td className="py-3 pl-5 pr-3 text-sm font-semibold text-slate-700">Total</td>
                <td className="py-3 px-3 text-sm font-semibold text-slate-700 tabular-nums">
                  {totalHours.toFixed(0)}h
                </td>
                <td className="py-3 px-3" />
                {canSeeCosts && (
                  <td className="py-3 px-3 text-right text-sm font-semibold text-slate-700 tabular-nums">
                    {usd(totalCost)}
                  </td>
                )}
                <td className="py-3 px-3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Cost distribution pie (ops only, 2+ people with costs) */}
      {canSeeCosts && pieData.length >= 2 && (
        <div className="border-t border-slate-100 px-5 py-4">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Distribución de costos</p>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={130} height={100}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={46} dataKey="value" paddingAngle={2}>
                  {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <RTooltip formatter={(v: number) => [`$${v.toLocaleString("es-AR")}`, ""]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {pieData.map((e, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: e.color }} />
                  <span className="text-xs text-slate-600">{e.name}</span>
                  <span className="text-xs text-slate-400">{((e.value / totalCost) * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
