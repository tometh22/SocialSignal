/**
 * Team Performance — redesigned with wider bars, interactive sorting,
 * avatar status indicators, and improved visual hierarchy.
 */
import { useState } from "react";
import { Users, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
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
  efficiencyScore?: number;
  performanceColor?: string;
}

interface TeamPerformanceProps {
  team: TeamMember[];
  canSeeCosts: boolean;
}

type SortField = "name" | "hours" | "deviation" | "cost" | "efficiency";
type SortDir = "asc" | "desc";

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

// ─── Enhanced Hours Bar ─────────────────────────────────────────────────────

function HoursBar({ actual, target }: { actual: number; target: number }) {
  if (target <= 0) {
    return <span className="text-sm tabular-nums text-slate-600 font-medium">{actual.toFixed(0)}h</span>;
  }
  const pct = Math.min(150, (actual / target) * 100);
  const over = actual > target;
  const barColor = pct >= 125 ? "bg-gradient-to-r from-red-400 to-red-500" : pct >= 105 ? "bg-gradient-to-r from-amber-300 to-amber-400" : "bg-gradient-to-r from-emerald-400 to-emerald-500";
  const trackBg = pct >= 125 ? "bg-red-100" : pct >= 105 ? "bg-amber-100" : "bg-slate-100";

  return (
    <div className="space-y-1.5 min-w-[100px]">
      <div className="flex justify-between text-[11px]">
        <span className={`font-semibold tabular-nums ${over ? "text-red-600" : "text-slate-700"}`}>
          {actual.toFixed(0)}h
        </span>
        <span className="text-slate-400">/{target.toFixed(0)}h</span>
      </div>
      <div className={`h-2 rounded-full ${trackBg} overflow-hidden`}>
        <div className={`h-full rounded-full ${barColor} transition-all duration-500`} style={{ width: `${Math.min(100, pct)}%` }} />
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
      {dev > 0 ? "+" : dev < 0 ? "-" : ""}{abs}%
    </span>
  );
}

// ─── Sort Header ─────────────────────────────────────────────────────────────

function SortHeader({
  label, field, currentField, currentDir, onSort, className = "",
}: {
  label: string;
  field: SortField;
  currentField: SortField;
  currentDir: SortDir;
  onSort: (f: SortField) => void;
  className?: string;
}) {
  const active = currentField === field;
  return (
    <th className={`py-2.5 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-600 transition-colors select-none ${className}`}
        onClick={() => onSort(field)}>
      <span className="flex items-center gap-1">
        {label}
        {active ? (
          currentDir === "asc" ? <ChevronUp className="h-3 w-3 text-indigo-500" /> : <ChevronDown className="h-3 w-3 text-indigo-500" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </th>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TeamPerformance({ team, canSeeCosts }: TeamPerformanceProps) {
  const [sortField, setSortField] = useState<SortField>("hours");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  if (!team || team.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-50 bg-slate-50/50">
          <Users className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Equipo</span>
        </div>
        <div className="p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Users className="h-6 w-6 text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-500">Sin datos de equipo para este período</p>
          <p className="text-xs mt-1 text-slate-400">Las horas aparecen cuando el equipo las carga en Tareas.</p>
        </div>
      </div>
    );
  }

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

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sorted = [...members].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortField) {
      case "name": return dir * a.name.localeCompare(b.name);
      case "hours": return dir * (a.actualHours - b.actualHours);
      case "deviation": {
        const devA = a.target > 0 ? (a.actualHours - a.target) / a.target : 0;
        const devB = b.target > 0 ? (b.actualHours - b.target) / b.target : 0;
        return dir * (devA - devB);
      }
      case "cost": return dir * (a.costVal - b.costVal);
      case "efficiency": return dir * ((a.efficiencyScore ?? 0) - (b.efficiencyScore ?? 0));
      default: return 0;
    }
  });

  const pieData = members
    .filter(m => m.costVal > 0)
    .map((m, i) => ({
      name: m.name.split(" ")[0],
      value: Math.round(m.costVal),
      color: PIE_COLORS[i % PIE_COLORS.length],
    }));

  // Performance indicator dot color
  const getStatusDot = (m: typeof members[0]) => {
    if (m.efficiencyScore != null) {
      if (m.efficiencyScore >= 70) return "bg-emerald-500";
      if (m.efficiencyScore >= 40) return "bg-amber-400";
      return "bg-red-500";
    }
    if (m.target > 0) {
      const dev = (m.actualHours - m.target) / m.target;
      if (dev > 0.2) return "bg-red-500";
      if (dev > 0.05) return "bg-amber-400";
      return "bg-emerald-500";
    }
    return "bg-slate-300";
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-50 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Equipo</span>
          <span className="text-xs text-slate-400 bg-slate-200/60 rounded-full px-2 py-0.5">{members.length}</span>
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
              <SortHeader label="Persona" field="name" currentField={sortField} currentDir={sortDir} onSort={handleSort} className="pl-4 pr-3 text-left" />
              <SortHeader label="Horas" field="hours" currentField={sortField} currentDir={sortDir} onSort={handleSort} className="text-left" />
              <SortHeader label="Desvío" field="deviation" currentField={sortField} currentDir={sortDir} onSort={handleSort} className="text-center" />
              {canSeeCosts && (
                <SortHeader label="Costo" field="cost" currentField={sortField} currentDir={sortDir} onSort={handleSort} className="text-right" />
              )}
              <SortHeader label="Eficiencia" field="efficiency" currentField={sortField} currentDir={sortDir} onSort={handleSort} className="text-center" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((m, i) => (
              <tr key={m.personnelId ?? i} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                {/* Avatar + Name with status dot */}
                <td className="py-2.5 pl-4 pr-3">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${m.gradient} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                        {initials(m.name)}
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${getStatusDot(m)}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800 leading-tight">{m.name}</p>
                      {m.role && <p className="text-[11px] text-slate-400 leading-tight">{m.role}</p>}
                    </div>
                  </div>
                </td>

                {/* Hours bar */}
                <td className="py-2.5 px-2.5">
                  <HoursBar actual={m.actualHours} target={m.target} />
                </td>

                {/* Deviation badge */}
                <td className="py-2.5 px-2.5 text-center">
                  <DeviationBadge actual={m.actualHours} target={m.target} />
                </td>

                {/* Cost */}
                {canSeeCosts && (
                  <td className="py-2.5 px-2.5 text-right tabular-nums text-sm text-slate-600 font-medium">
                    {usd(m.costVal)}
                    {totalCost > 0 && m.costVal > 0 && (
                      <div className="text-[10px] text-slate-400">
                        {((m.costVal / totalCost) * 100).toFixed(0)}%
                      </div>
                    )}
                  </td>
                )}

                {/* Efficiency */}
                <td className="py-2.5 px-2.5 text-center">
                  <EfficiencyBadge score={m.efficiencyScore} color={m.performanceColor} />
                </td>
              </tr>
            ))}
          </tbody>

          {/* Totals */}
          {(totalHours > 0 || (canSeeCosts && totalCost > 0)) && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50/80">
                <td className="py-2.5 pl-4 pr-3 text-sm font-semibold text-slate-700">Total</td>
                <td className="py-2.5 px-2.5 text-sm font-semibold text-slate-700 tabular-nums">
                  {totalHours.toFixed(0)}h
                </td>
                <td className="py-2.5 px-2.5" />
                {canSeeCosts && (
                  <td className="py-2.5 px-2.5 text-right text-sm font-semibold text-slate-700 tabular-nums">
                    {usd(totalCost)}
                  </td>
                )}
                <td className="py-2.5 px-2.5" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Cost distribution pie */}
      {canSeeCosts && pieData.length >= 2 && (
        <div className="border-t border-slate-100 px-4 py-3">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Distribución de costos</p>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={130} height={100}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={46} innerRadius={20} dataKey="value" paddingAngle={2}>
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
