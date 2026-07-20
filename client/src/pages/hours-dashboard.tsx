import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/queryClient";
import { format, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, BarChart3, PieChart, Clock, TrendingUp, User, Briefcase, ChevronLeft, ChevronRight } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, ResponsiveContainer,
  PieChart as RPieChart, Pie, Cell
} from "recharts";
import { cn } from "@/lib/utils";

type Personnel = { id: number; name: string };
type Project = { id: number; name: string; client_name: string };

const CHART_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#14b8a6", "#f97316", "#84cc16"];

type HoursSummary = {
  entries: any[];
  byWeek: { week: string; hours: number }[];
  byProject: { name: string; hours: number; estimatedHours: number }[];
  byPerson: { name: string; hours: number; estimatedHours: number }[];
  activeTeam?: { id: number; name: string; contractType: string; dailyHours: number }[];
};

const QUICK_FILTERS = [
  { label: "Esta semana", value: "this_week" },
  { label: "Sem. anterior", value: "last_week" },
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
    case "this_month":
      return { dateFrom: startOfMonth(now).toISOString(), dateTo: endOfMonth(now).toISOString() };
    case "last_month": {
      const prev = subMonths(now, 1);
      return { dateFrom: startOfMonth(prev).toISOString(), dateTo: endOfMonth(prev).toISOString() };
    }
    case "last_3_months":
      return { dateFrom: subMonths(startOfMonth(now), 3).toISOString(), dateTo: endOfMonth(now).toISOString() };
    default:
      return { dateFrom: startOfMonth(now).toISOString(), dateTo: endOfMonth(now).toISOString() };
  }
}

function formatHoursLabel(hours: number) {
  if (hours === 0) return "";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}

const PAGE_SIZE = 20;

export default function HoursDashboardPage() {
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [quickFilter, setQuickFilter] = useState<string>("this_month");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [page, setPage] = useState(0);

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
  const totalEstimatedHours = summary?.byPerson.reduce((acc, p) => acc + (p.estimatedHours || 0), 0) || 0;

  const weeklyData = (summary?.byWeek || []).map(w => ({
    week: format(new Date(w.week), "dd/MM", { locale: es }),
    horas: parseFloat(w.hours.toFixed(2)),
    label: formatHoursLabel(w.hours),
  }));

  // Holidays for the relevant years to compute available hours (sin feriados)
  const rangeYears = Array.from(new Set([
    dateFrom ? new Date(dateFrom).getFullYear() : new Date().getFullYear(),
    dateTo ? new Date(dateTo).getFullYear() : new Date().getFullYear(),
  ]));
  const { data: holidaysData = [] } = useQuery<any[]>({
    queryKey: ["/api/holidays", rangeYears.join(",")],
    queryFn: async () => {
      const all = await Promise.all(rangeYears.map(y =>
        authFetch(`/api/holidays?year=${y}`).then(r => r.json())
      ));
      return all.flat();
    },
  });

  // Ausencias de la persona seleccionada (vacaciones, licencias) — solo tiene
  // sentido restarlas de "horas disponibles" cuando se filtra a una persona
  // puntual; con "todo el equipo" seleccionado no hay una única persona cuyas
  // ausencias restar de un baseline de 8h/día.
  const { data: absencesData = [] } = useQuery<any[]>({
    queryKey: ["/api/personnel-absences", selectedPersonnelId],
    queryFn: () => authFetch(`/api/personnel-absences?personnelId=${selectedPersonnelId}`).then(r => r.json()),
    enabled: selectedPersonnelId !== "all",
  });

  // Horas disponibles = días hábiles del rango (sin feriados/ausencias) × horas diarias
  // por contrato. Con una persona filtrada usa SU jornada (full=8h, part-time=6h) y
  // resta sus ausencias; con "todo el equipo" suma la jornada de cada persona activa
  // (freelance excluido, no tiene capacidad base).
  const activeTeam = summary?.activeTeam ?? [];
  const { availableHours, absenceWorkdays, availableBasis } = (() => {
    if (!dateFrom || !dateTo) return { availableHours: 0, absenceWorkdays: 0, availableBasis: "" };
    const holidaySet = new Set(
      (holidaysData || []).map((h: any) => (h.date || "").slice(0, 10))
    );
    // Comparación por string YYYY-MM-DD (igual que holidaySet), no por Date,
    // para no perder el último día del rango por corrimiento de timezone.
    const absenceRanges = selectedPersonnelId !== "all"
      ? absencesData.map((a: any) => ({ start: (a.startDate || "").slice(0, 10), end: (a.endDate || "").slice(0, 10) }))
      : [];
    const isAbsent = (dateKey: string) => absenceRanges.some(r => dateKey >= r.start && dateKey <= r.end);
    let workdays = 0;
    let absentWorkdays = 0;
    const d = new Date(new Date(dateFrom).getFullYear(), new Date(dateFrom).getMonth(), new Date(dateFrom).getDate());
    const end = new Date(dateTo);
    while (d <= end) {
      const dow = d.getDay();
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (dow !== 0 && dow !== 6 && !holidaySet.has(key)) {
        workdays++;
        if (isAbsent(key)) absentWorkdays++;
      }
      d.setDate(d.getDate() + 1);
    }

    if (selectedPersonnelId !== "all") {
      const me = activeTeam.find(p => String(p.id) === selectedPersonnelId);
      // Freelance u persona sin jornada base → no se muestran horas disponibles.
      if (!me) return { availableHours: 0, absenceWorkdays: absentWorkdays, availableBasis: "freelance (sin jornada base)" };
      const daily = me.dailyHours || 8;
      const label = me.contractType === "part-time" ? "part-time (6h/día)" : `full-time (${daily}h/día)`;
      return { availableHours: Math.round((workdays - absentWorkdays) * daily), absenceWorkdays: absentWorkdays, availableBasis: label };
    }

    // Todo el equipo: suma de jornadas diarias × días hábiles (freelance excluido).
    const dailySum = activeTeam.reduce((acc, p) => acc + (p.dailyHours || 0), 0);
    return {
      availableHours: Math.round(workdays * dailySum),
      absenceWorkdays: 0,
      availableBasis: `${activeTeam.length} personas activas (sin freelance)`,
    };
  })();

  // Sorted entries for table
  const allEntries = (summary?.entries || []).slice().sort((a: any, b: any) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const totalPages = Math.ceil(allEntries.length / PAGE_SIZE);
  const pagedEntries = allEntries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleFilterChange = () => setPage(0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">Panel de Horas</h1>
        <p className="text-sm text-muted-foreground">Horas registradas en tareas por persona y proyecto</p>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filtros</p>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-1.5 flex-wrap">
            {QUICK_FILTERS.map(f => (
              <Button
                key={f.value}
                variant={quickFilter === f.value ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setQuickFilter(f.value); handleFilterChange(); }}
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
              <Input type="date" value={customFrom} onChange={e => { setCustomFrom(e.target.value); handleFilterChange(); }} className="h-7 text-xs w-36" />
              <span className="text-xs text-muted-foreground">a</span>
              <Input type="date" value={customTo} onChange={e => { setCustomTo(e.target.value); handleFilterChange(); }} className="h-7 text-xs w-36" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Select value={selectedPersonnelId} onValueChange={v => { setSelectedPersonnelId(v); handleFilterChange(); }}>
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

          <Select value={selectedProjectId} onValueChange={v => { setSelectedProjectId(v); handleFilterChange(); }}>
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="bg-card rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground font-medium">Total de horas reales</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{totalHours.toFixed(1)}h</p>
              <p className="text-xs text-muted-foreground mt-1">{summary.entries.length} entradas registradas</p>
            </div>

            <div className="bg-card rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <p className="text-xs text-muted-foreground font-medium">Horas estimadas totales</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{totalEstimatedHours.toFixed(1)}h</p>
              <p className="text-xs text-muted-foreground mt-1">
                {totalEstimatedHours > 0
                  ? `${Math.round((totalHours / totalEstimatedHours) * 100)}% consumido`
                  : "Sin estimación cargada"}
              </p>
            </div>

            <div className="bg-card rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-green-500" />
                <p className="text-xs text-muted-foreground font-medium">Horas disponibles</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{availableHours}h</p>
              <p className="text-xs text-muted-foreground mt-1">
                Días hábiles sin feriados{absenceWorkdays > 0 ? ` ni ausencias (-${absenceWorkdays}d)` : ""}{availableBasis ? ` · ${availableBasis}` : ""}
              </p>
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
                  <BarChart data={weeklyData} margin={{ top: 18, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                      formatter={(v: any) => [`${v}h`, "Horas"]}
                      labelFormatter={(label) => `Sem. del ${label}`}
                    />
                    <Bar dataKey="horas" fill="#6366f1" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="label" position="top" style={{ fontSize: "10px", fill: "hsl(var(--muted-foreground))", fontWeight: 600 }} />
                    </Bar>
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
                Tiempo por proyecto <span className="text-xs font-normal text-muted-foreground">· real vs estimado</span>
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
                    {summary.byProject.map((p, i) => {
                      const est = p.estimatedHours || 0;
                      const delta = p.hours - est;
                      return (
                        <div key={p.name} className="flex items-center gap-2 text-xs">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                          <span className="flex-1 truncate text-muted-foreground" title={p.name}>{p.name}</span>
                          <span className="font-semibold text-foreground flex-shrink-0 tabular-nums">{p.hours.toFixed(1)}h</span>
                          <span className="text-muted-foreground/60 flex-shrink-0 tabular-nums w-16 text-right">
                            {est > 0 ? `/ ${est.toFixed(1)}h` : "/ —"}
                          </span>
                          <span className={cn(
                            "flex-shrink-0 tabular-nums w-12 text-right font-medium",
                            est <= 0 ? "text-muted-foreground/40" : delta > 2 ? "text-orange-600" : delta < -2 ? "text-green-600" : "text-muted-foreground"
                          )}>
                            {est > 0 ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)}` : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
              )}
            </div>
          </div>

          {/* By person matrix */}
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
                    {summary.byProject.slice(0, 5).map(p => (
                      <th key={p.name} className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground max-w-[90px]">
                        <span className="block truncate" title={p.name}>{p.name}</span>
                      </th>
                    ))}
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Estimadas</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Reales</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Δ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {summary.byPerson.map((person) => {
                    const personEntries = summary.entries.filter((e: any) => e.personnelName === person.name);
                    const est = person.estimatedHours || 0;
                    const real = person.hours;
                    const delta = real - est;
                    return (
                      <tr key={person.name} className="hover:bg-accent/30 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-foreground text-xs">{person.name}</td>
                        {summary.byProject.slice(0, 5).map(proj => {
                          const ph = personEntries.filter((e: any) => e.projectName === proj.name).reduce((acc: number, e: any) => acc + e.hours, 0);
                          return (
                            <td key={proj.name} className="text-center px-3 py-2.5 text-xs text-muted-foreground">
                              {ph > 0 ? <span className="font-medium text-foreground">{ph.toFixed(1)}h</span> : <span className="text-muted-foreground/40">—</span>}
                            </td>
                          );
                        })}
                        <td className="text-right px-3 py-2.5 text-xs text-muted-foreground">
                          {est > 0 ? `${est.toFixed(1)}h` : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="text-right px-4 py-2.5 font-bold text-foreground text-xs">{real.toFixed(1)}h</td>
                        <td className="text-right px-4 py-2.5 text-xs">
                          {est > 0 ? (
                            <span className={cn(
                              "font-medium",
                              delta > 2 ? "text-orange-600" : delta < -2 ? "text-green-600" : "text-muted-foreground"
                            )}>
                              {delta > 0 ? "+" : ""}{delta.toFixed(1)}h
                            </span>
                          ) : <span className="text-muted-foreground/40">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-muted/20 font-semibold">
                    <td className="px-4 py-2.5 text-xs text-foreground">Total</td>
                    {summary.byProject.slice(0, 5).map(proj => (
                      <td key={proj.name} className="text-center px-3 py-2.5 text-xs text-foreground">{proj.hours.toFixed(1)}h</td>
                    ))}
                    <td className="text-right px-3 py-2.5 text-xs text-foreground">
                      {summary.byPerson.reduce((s, p) => s + (p.estimatedHours || 0), 0).toFixed(1)}h
                    </td>
                    <td className="text-right px-4 py-2.5 text-xs text-foreground">{totalHours.toFixed(1)}h</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Entries table with pagination */}
          <div className="bg-card rounded-xl border overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/20 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Entradas detalladas</h3>
              <Badge variant="secondary">{allEntries.length} entradas</Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/10">
                    <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Persona</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Proyecto</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Tarea</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">Fecha</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Horas</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground hidden md:table-cell">Descripción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pagedEntries.map((entry: any) => (
                    <tr key={entry.id} className="hover:bg-accent/20 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-foreground">{entry.personnelName}</td>
                      <td className="px-3 py-2.5 text-muted-foreground max-w-[120px]">
                        <span className="truncate block" title={entry.projectName}>{entry.projectName || "—"}</span>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground max-w-[160px]">
                        <span className="truncate block" title={entry.taskTitle}>{entry.taskTitle}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center text-muted-foreground">
                        {format(new Date(entry.date), "dd/MM/yy")}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-primary">
                        {entry.hours}h
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground/70 hidden md:table-cell max-w-[180px]">
                        {entry.description ? (
                          <span className="truncate block" title={entry.description}>{entry.description}</span>
                        ) : (
                          <span className="opacity-40">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-2.5 border-t bg-muted/10">
                <span className="text-xs text-muted-foreground">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, allEntries.length)} de {allEntries.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-xs font-medium px-2">{page + 1}/{totalPages}</span>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
