import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/use-permissions";

export default function CapacityDashboard() {
  const { isOperations } = usePermissions();
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1); // Monday
    return d.toISOString().split("T")[0];
  });

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/capacity/weekly", weekStart],
    queryFn: () =>
      fetch(`/api/capacity/weekly?weekStart=${weekStart}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }).then((r) => r.json()),
  });

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

      {isOperations && data?.totals && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Capacidad Total</CardTitle></CardHeader>
            <CardContent><span className="text-2xl font-bold">{data.totals.totalMaxCapacity.toFixed(0)}h</span></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Horas Trabajadas</CardTitle></CardHeader>
            <CardContent><span className="text-2xl font-bold">{data.totals.totalActualHours.toFixed(0)}h</span></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Horas Ociosas</CardTitle></CardHeader>
            <CardContent><span className="text-2xl font-bold text-amber-600">{data.totals.totalIdleHours.toFixed(0)}h</span></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Utilización Promedio</CardTitle></CardHeader>
            <CardContent><span className="text-2xl font-bold">{data.totals.avgUtilization}%</span></CardContent>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : (
        <Card>
          <CardHeader><CardTitle>Detalle por Persona</CardTitle></CardHeader>
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
                {data?.personnel?.map((p: any) => (
                  <tr key={p.personnelId} className="border-b hover:bg-muted/30">
                    <td className="py-2 px-3 font-medium">{p.name}</td>
                    <td className="text-center py-2 px-3">{p.maxCapacity.toFixed(1)}h</td>
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
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
