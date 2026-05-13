import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/use-permissions";
import { Pencil, Check, X, RotateCcw } from "lucide-react";

// Override key: "{personnelId}-{weekStart}"
function buildOverrideKey(personnelId: number, weekStart: string) {
  return `capOverride:${personnelId}:${weekStart}`;
}

function getStoredOverride(personnelId: number, weekStart: string): number | null {
  try {
    const raw = localStorage.getItem(buildOverrideKey(personnelId, weekStart));
    if (raw === null) return null;
    const n = parseFloat(raw);
    return isNaN(n) ? null : n;
  } catch {
    return null;
  }
}

function setStoredOverride(personnelId: number, weekStart: string, value: number | null) {
  try {
    const key = buildOverrideKey(personnelId, weekStart);
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, String(value));
  } catch {}
}

export default function CapacityDashboard() {
  const { isOperations } = usePermissions();
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1); // Monday
    return d.toISOString().split("T")[0];
  });

  // editingCapacity: personnelId whose cap is being edited
  const [editingCapacityId, setEditingCapacityId] = useState<number | null>(null);
  const [editingCapacityInput, setEditingCapacityInput] = useState<string>("");
  // Local override state — initialize from localStorage per person+week
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/capacity/weekly", weekStart],
    queryFn: () =>
      fetch(`/api/capacity/weekly?weekStart=${weekStart}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }).then((r) => r.json()),
    // Reload overrides from localStorage when week changes
    select: (d) => d,
  });

  const getOverride = (personnelId: number): number | null => {
    const key = buildOverrideKey(personnelId, weekStart);
    if (key in overrides) return overrides[key];
    return getStoredOverride(personnelId, weekStart);
  };

  const effectiveMax = (p: any): number => getOverride(p.personnelId) ?? p.maxCapacity;

  const recalcPerson = (p: any) => {
    const max = effectiveMax(p);
    const actual = p.actualHours;
    const idle = Math.max(0, max - actual);
    const utilPct = max > 0 ? Math.round((actual / max) * 100) : 0;
    return { ...p, maxCapacity: max, idleHours: idle, utilizationPct: utilPct, isOverloaded: actual > max };
  };

  const personnel = (data?.personnel || []).map(recalcPerson);

  const totals = personnel.length > 0 ? {
    totalMaxCapacity: personnel.reduce((s: number, p: any) => s + p.maxCapacity, 0),
    totalActualHours: personnel.reduce((s: number, p: any) => s + p.actualHours, 0),
    totalIdleHours: personnel.reduce((s: number, p: any) => s + p.idleHours, 0),
    avgUtilization: Math.round(personnel.reduce((s: number, p: any) => s + p.utilizationPct, 0) / personnel.length),
  } : data?.totals;

  const handleStartEdit = (p: any) => {
    setEditingCapacityInput(String(effectiveMax(p)));
    setEditingCapacityId(p.personnelId);
  };

  const handleConfirmEdit = (personnelId: number) => {
    const parsed = parseFloat(editingCapacityInput);
    if (!isNaN(parsed) && parsed >= 0) {
      const key = buildOverrideKey(personnelId, weekStart);
      setOverrides(prev => ({ ...prev, [key]: parsed }));
      setStoredOverride(personnelId, weekStart, parsed);
    }
    setEditingCapacityId(null);
  };

  const handleResetOverride = (personnelId: number) => {
    const key = buildOverrideKey(personnelId, weekStart);
    setOverrides(prev => { const next = { ...prev }; delete next[key]; return next; });
    setStoredOverride(personnelId, weekStart, null);
  };

  const getUtilColor = (pct: number) => {
    if (pct > 100) return "text-red-700 bg-red-50";
    if (pct >= 85) return "text-green-700 bg-green-50";
    if (pct >= 60) return "text-yellow-700 bg-yellow-50";
    return "text-gray-500 bg-gray-50";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Capacidad Operativa Semanal</h1>
          <p className="text-muted-foreground">
            {isOperations
              ? "Vista de operaciones: capacidad, horas ociosas y utilización"
              : "Tu carga de horas semanal"}
          </p>
        </div>
        <Input
          type="date"
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
          className="w-44"
        />
      </div>

      {data?.holidaysInWeek?.length > 0 && (
        <div className="flex gap-2 items-center">
          <span className="text-sm text-muted-foreground">Feriados esta semana:</span>
          {data.holidaysInWeek.map((h: any, i: number) => (
            <Badge key={i} variant="secondary">{h.name}</Badge>
          ))}
          <Badge variant="outline">{data.workingDays} días hábiles</Badge>
        </div>
      )}

      {isOperations && totals && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Capacidad Total</CardTitle></CardHeader>
            <CardContent><span className="text-2xl font-bold">{totals.totalMaxCapacity.toFixed(0)}h</span></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Horas Trabajadas</CardTitle></CardHeader>
            <CardContent><span className="text-2xl font-bold">{totals.totalActualHours.toFixed(0)}h</span></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Horas Ociosas</CardTitle></CardHeader>
            <CardContent><span className="text-2xl font-bold text-amber-600">{totals.totalIdleHours.toFixed(0)}h</span></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Utilización Promedio</CardTitle></CardHeader>
            <CardContent><span className="text-2xl font-bold">{totals.avgUtilization}%</span></CardContent>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              Detalle por Persona
              {isOperations && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">(doble clic en Cap. Máx para editar)</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Persona</th>
                  <th className="text-center py-2 px-3">Cap. Máxima</th>
                  <th className="text-center py-2 px-3">Horas Reales</th>
                  {isOperations && <th className="text-center py-2 px-3">Horas Ociosas</th>}
                  <th className="text-center py-2 px-3">Utilización</th>
                </tr>
              </thead>
              <tbody>
                {personnel.map((p: any) => {
                  const hasOverride = getOverride(p.personnelId) !== null;
                  return (
                    <tr key={p.personnelId} className="border-b hover:bg-muted/30 group">
                      <td className="py-2 px-3 font-medium">{p.name}</td>
                      <td className="text-center py-2 px-3">
                        {isOperations && editingCapacityId === p.personnelId ? (
                          <div className="flex items-center justify-center gap-1">
                            <Input
                              type="number"
                              value={editingCapacityInput}
                              onChange={e => setEditingCapacityInput(e.target.value)}
                              className="w-20 h-6 text-xs text-center"
                              min={0}
                              step={0.5}
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === "Enter") handleConfirmEdit(p.personnelId);
                                if (e.key === "Escape") setEditingCapacityId(null);
                              }}
                            />
                            <span className="text-xs text-muted-foreground">h</span>
                            <Button size="sm" variant="ghost" onClick={() => handleConfirmEdit(p.personnelId)} className="h-5 w-5 p-0 text-green-600">
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingCapacityId(null)} className="h-5 w-5 p-0">
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className={`flex items-center justify-center gap-1 ${isOperations ? "cursor-pointer" : ""}`}
                            onDoubleClick={() => isOperations && handleStartEdit(p)}>
                            <span className={hasOverride ? "font-semibold text-amber-700" : ""}>
                              {p.maxCapacity.toFixed(1)}h
                            </span>
                            {hasOverride && (
                              <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600 px-1 py-0">Manual</Badge>
                            )}
                            {isOperations && (
                              <div className="flex items-center opacity-0 group-hover:opacity-100">
                                <Button size="sm" variant="ghost" onClick={() => handleStartEdit(p)} className="h-4 w-4 p-0 text-muted-foreground">
                                  <Pencil className="h-2.5 w-2.5" />
                                </Button>
                                {hasOverride && (
                                  <Button size="sm" variant="ghost" onClick={() => handleResetOverride(p.personnelId)} className="h-4 w-4 p-0 text-muted-foreground" title="Restaurar capacidad original">
                                    <RotateCcw className="h-2.5 w-2.5" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="text-center py-2 px-3">{p.actualHours.toFixed(1)}h</td>
                      {isOperations && (
                        <td className="text-center py-2 px-3">
                          <span className={p.idleHours > 0 ? "text-amber-600" : "text-green-600"}>
                            {p.idleHours.toFixed(1)}h
                          </span>
                        </td>
                      )}
                      <td className="text-center py-2 px-3">
                        <Badge className={getUtilColor(p.utilizationPct)}>
                          {p.utilizationPct}%{p.isOverloaded && " ⚠️"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
