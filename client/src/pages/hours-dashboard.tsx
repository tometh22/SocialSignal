import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/queryClient";
import { format, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, BarChart3, PieChart, Table, Clock, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart as RPieChart, Pie, Cell, Sector
} from "recharts";
import { cn } from "@/lib/utils";

type Personnel = { id: number; name: string };
type Project = { id: number; name: string; client_name: string };

const CHART_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#14b8a6"];

type HoursSummary = {
  entries: any[];
  byWeek: { week: string; hours: number }[];
  byProject: { name: string; hours: number }[];
  byPerson: { name: string; hours: number }[];
};

const QUICK_FILTERS = [
  { label: "Esta semana", value: "this_week" },
  { label: "Semana anterior", value: "last_week" },
  { label: "Este mes", value: "this_month" },
  { label: "Mes anterior", value: "last_month" },
  { label: "Últimos 3 meses", value: "last_3_months" },
];

function getDateRange(filter: string): { dateFrom: string; dateTo: string } {
  const now = new Date();
  switch (filter) {
    case "this_week": {
      const s = startOfWeek(now, { weekStartsOn: 1 });
      const e = endOfWeek(now, { weekStartsOn: 1 });
      return { dateFrom: s.toISOString(), dateTo: e.toISOString() };
    }
    case "last_week": {
      const s = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      const e = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      return { dateFrom: s.toISOString(), dateTo: e.toISOString() };
    }
    case "this_month": {
      return { dateFrom: startOfMonth(now).toISOString(), dateTo: endOfMonth(now).toISOString() };
    }
    case "last_month": {
      const prev = subMonths(now, 1);
      return { dateFrom: startOfMonth(prev).toISOString(), dateTo: endOfMonth(prev).toISOString() };
    }
    case "last_3_months": {
      return { dateFrom: subMonths(startOfMonth(now), 3).toISOString(), dateTo: endOfMonth(now).toISOString() };
    }
    default:
      return { dateFrom: startOfMonth(now).toISOString(), dateTo: endOfMonth(now).toISOString() };
  }
}

export default function HoursDashboardPage() {
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [quickFilter, setQuickFilter] = useState<string>("this_month");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const { dateFrom, dateTo } = quickFilter === "custom"
    ? { dateFrom: customFrom ? new Date(customFrom).toISOString() : "", dateTo: customTo ? new Date(customTo).toISOString() : "" }
    : getDateRange(quickFilter);

  const { data: allPersonnel = [] } = useQuery<Personnel[]>({
    queryKey: ["/api/tasks-personnel"],
    queryFn: () => authFetch("/api/tasks-personnel").then(r => r.json()),
  });

  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/tasks-projects"],
    queryFn: () => authFetch("/api/tasks-projects").then(r => r.json()),
  });

  const params = new URLSearchParams();
  if (selectedPersonnelId !== "all") params.set("personnelId", selectedPersonnelId);
  if (selectedProjectId !== "all") params.set("projectId", selectedProjectId);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);

  const { data: summary, isLoading } = useQuery<HoursSummary>({
    queryKey: ["/api/tasks/hours-summary", selectedPersonnelId, selectedProjectId, dateFrom, dateTo],
    queryFn: () => authFetch(`/api/tasks/hours-summary?${params}`).then(r => r.json()),
    enabled: !!(dateFrom && dateTo),
  });

  const totalHours = summary?.byPerson.reduce((acc, p) => acc + p.hours, 0) || 0;
  const topProject = summary?.byProject[0];
  const topPerson = summary?.byPerson[0];

  // Format week labels for bar chart
  const weeklyData = (summary?.byWeek || []).map(w => ({
    week: format(new Date(w.week), "dd/MM", { locale: es }),
    horas: parseFloat(w.hours.toFixed(1)),
  }));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Panel de Horas</h1>
        <p className="text-sm text-muted-foreground">Horas registradas en tareas por persona y proyecto</p>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filtros</p>
        <div className="flex flex-wrap gap-2 items-center">
          {/* Quick filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {QUICK_FILTERS.map(f => (
              <Button
                key={f.value}
                variant={quickFilter === f.value ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setQuickFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
            <Button
              variant={quickFilter === "custom" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setQuickFilter("custom")}
            >
              Personalizado
            </Button>
          </div>

          {quickFilter === "custom" && (
            <div className="flex items-center gap-2">
              <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-7 text-xs w-36" />
              <span className="text-xs text-muted-foreground">a</span>
              <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-7 text-xs w-36" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Select value={selectedPersonnelId} onValueChange={setSelectedPersonnelId}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="Todas las personas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las personas</SelectItem>
              {allPersonnel.map(p => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="h-8 w-52 text-xs">
              <SelectValue placeholder="Todos los proyectos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los proyectos</SelectItem>
              {allProjects.map(p => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.client_name} · {p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !summary || summary.entries.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border">
          <Clock className="h-14 w-14 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No hay horas registradas en el período seleccionado</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Las horas se registran desde el panel de cada tarea</p>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-card rounded-xl border p-4">
              <p className="text-xs text-muted-foreground mb-1">Total de horas</p>
              <p className="text-2xl font-bold text-foreground">{totalHours.toFixed(1)}h</p>
              <p className="text-xs text-muted-foreground mt-1">{summary.entries.length} entradas</p>
            </div>
            <div className="bg-card rounded-xl border p-4">
              <p className="text-xs text-muted-foreground mb-1">Colaboradores</p>
              <p className="text-2xl font-bold text-foreground">{summary.byPerson.length}</p>
              {topPerson && <p className="text-xs text-muted-foreground mt-1">Más horas: {topPerson.name.split(" ")[0]}</p>}
            </div>
            <div className="bg-card rounded-xl border p-4">
              <p className="text-xs text-muted-foreground mb-1">Proyectos</p>
              <p className="text-2xl font-bold text-foreground">{summary.byProject.length}</p>
              {topProject && <p className="text-xs text-muted-foreground mt-1">Mayor: {topProject.name}</p>}
            </div>
            <div className="bg-card rounded-xl border p-4">
              <p className="text-xs text-muted-foreground mb-1">Promedio por semana</p>
              <p className="text-2xl font-bold text-foreground">
                {weeklyData.length > 0 ? (totalHours / weeklyData.length).toFixed(1) : "0"}h
              </p>
              <p className="text-xs text-muted-foreground mt-1">{weeklyData.length} semanas</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Bar chart - hours by week */}
            <div className="bg-card rounded-xl border p-4">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Horas por semana
              </h3>
              {weeklyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={weeklyData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                      formatter={(v: any) => [`${v}h`, "Horas"]}
                    />
                    <Bar dataKey="horas" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
              )}
            </div>

            {/* Pie chart - by project */}
            <div className="bg-card rounded-xl border p-4">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <PieChart className="h-4 w-4 text-primary" />
                Tiempo por proyecto
              </h3>
              {summary.byProject.length > 0 ? (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="55%" height={200}>
                    <RPieChart>
                      <Pie
                        data={summary.byProject}
                        dataKey="hours"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {summary.byProject.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: any) => [`${v.toFixed(1)}h`]}
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                      />
                    </RPieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[200px]">
                    {summary.byProject.map((p, i) => (
                      <div key={p.name} className="flex items-center gap-2 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="flex-1 truncate text-muted-foreground">{p.name}</span>
                        <span className="font-semibold text-foreground flex-shrink-0">{p.hours.toFixed(1)}h</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
              )}
            </div>
          </div>

          {/* By person table */}
          <div className="bg-card rounded-xl border overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/20">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Detalle por colaborador
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/10">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Colaborador</th>
                    {summary.byProject.slice(0, 6).map(p => (
                      <th key={p.name} className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground max-w-[100px]">
                        <span className="block truncate" title={p.name}>{p.name}</span>
                      </th>
                    ))}
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {summary.byPerson.map((person, pi) => {
                    // Calculate hours per project for this person
                    const personEntries = summary.entries.filter((e: any) => e.personnelName === person.name);
                    return (
                      <tr key={person.name} className="hover:bg-accent/30 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-foreground text-xs">{person.name}</td>
                        {summary.byProject.slice(0, 6).map(proj => {
                          const ph = personEntries.filter((e: any) => e.projectName === proj.name).reduce((acc: number, e: any) => acc + e.hours, 0);
                          return (
                            <td key={proj.name} className="text-center px-3 py-2.5 text-xs text-muted-foreground">
                              {ph > 0 ? <span className="font-medium text-foreground">{ph.toFixed(1)}h</span> : <span className="text-muted-foreground/40">—</span>}
                            </td>
                          );
                        })}
                        <td className="text-right px-4 py-2.5 font-bold text-foreground text-xs">{person.hours.toFixed(1)}h</td>
                      </tr>
                    );
                  })}
                  {/* Total row */}
                  <tr className="bg-muted/20 font-semibold">
                    <td className="px-4 py-2.5 text-xs text-foreground">Total</td>
                    {summary.byProject.slice(0, 6).map(proj => (
                      <td key={proj.name} className="text-center px-3 py-2.5 text-xs text-foreground">{proj.hours.toFixed(1)}h</td>
                    ))}
                    <td className="text-right px-4 py-2.5 text-xs text-foreground">{totalHours.toFixed(1)}h</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Detail entries */}
          <div className="bg-card rounded-xl border overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/20 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Entradas detalladas</h3>
              <Badge variant="secondary">{summary.entries.length} entradas</Badge>
            </div>
            <div className="max-h-[320px] overflow-y-auto divide-y divide-border">
              {summary.entries.map((entry: any) => (
                <div key={entry.id} className="flex items-center gap-3 px-4 py-2.5 text-xs hover:bg-accent/20">
                  <span className="font-medium text-foreground w-28 flex-shrink-0">{entry.personnelName}</span>
                  <span className="font-semibold text-primary flex-shrink-0">{entry.hours}h</span>
                  <span className="text-muted-foreground flex-shrink-0">{format(new Date(entry.date), "dd/MM/yy")}</span>
                  <span className="flex-1 text-muted-foreground truncate">{entry.taskTitle}</span>
                  <span className="text-muted-foreground/70 flex-shrink-0 max-w-[120px] truncate">{entry.projectName}</span>
                  {entry.description && <span className="text-muted-foreground/50 flex-shrink-0 max-w-[140px] truncate">— {entry.description}</span>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
