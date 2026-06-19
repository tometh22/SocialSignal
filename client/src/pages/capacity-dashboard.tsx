import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Pencil, Check, X, RotateCcw } from "lucide-react";

export default function CapacityDashboard() {
  const { isOperations } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [resetTarget, setResetTarget] = useState<{ personnelId: number; name: string } | null>(null);
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1); // Monday
    return d.toISOString().split("T")[0];
  });

  const [editingCapacityId, setEditingCapacityId] = useState<number | null>(null);
  const [editingCapacityInput, setEditingCapacityInput] = useState<string>("");

  const queryKey = ["/api/capacity/weekly", weekStart];

  const { data, isLoading, isError } = useQuery<any>({
    queryKey,
    queryFn: () =>
      fetch(`/api/capacity/weekly?weekStart=${weekStart}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }).then((r) => r.json()),
  });

  const saveOverride = useMutation({
    mutationFn: (vars: { personnelId: number; maxHours: number }) =>
      apiRequest("/api/capacity/overrides", { method: "PUT", body: { ...vars, weekStart } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Capacidad actualizada" });
    },
    onError: () => toast({ title: "Error al guardar", variant: "destructive" }),
  });

  const deleteOverride = useMutation({
    mutationFn: (personnelId: number) =>
      apiRequest(`/api/capacity/overrides/${personnelId}?weekStart=${weekStart}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Capacidad restablecida al valor de contrato" });
    },
    onError: () => toast({ title: "Error al restablecer", variant: "destructive" }),
  });

  const personnel = data?.personnel || [];
  const totals = data?.totals;

  const handleStartEdit = (p: any) => {
    setEditingCapacityInput(String(p.maxCapacity));
    setEditingCapacityId(p.personnelId);
  };

  const handleConfirmEdit = (personnelId: number) => {
    const parsed = parseFloat(editingCapacityInput);
    if (!isNaN(parsed) && parsed >= 0) {
      saveOverride.mutate({ personnelId, maxHours: parsed });
    }
    setEditingCapacityId(null);
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
          <p className="text-muted-foreground text-sm">
            {isOperations
              ? "Capacidad máxima según contrato vs. horas registradas en el Panel de Horas. Doble clic en Cap. Máx para ajustar puntualmente."
              : "Tus horas registradas vs. tu capacidad semanal contratada."}
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
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Cargando...</span>
        </div>
      ) : isError ? (
        <div className="text-center py-12 text-red-500">Error al cargar datos de capacidad</div>
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
            {personnel.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No hay personal configurado esta semana</div>
            ) : (
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
                  {personnel.map((p: any) => (
                    <tr key={p.personnelId} className="border-b hover:bg-muted/30 group">
                      <td className="py-2 px-3 font-medium">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {p.name}
                          {p.isAbsent && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">En ausencia</span>
                          )}
                          {!p.isAbsent && p.absenceHours > 0 && (
                            <span className="text-[10px] text-amber-600">({p.absenceHours.toFixed(0)}h ausencia)</span>
                          )}
                        </div>
                      </td>
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
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={p.hasOverride ? "font-semibold text-amber-700" : ""}>
                                    {p.maxCapacity.toFixed(1)}h
                                  </span>
                                </TooltipTrigger>
                                {isOperations && (
                                  <TooltipContent side="top">Doble clic para editar</TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                            {p.hasOverride && (
                              <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600 px-1 py-0">Manual</Badge>
                            )}
                            {isOperations && (
                              <div className="flex items-center opacity-0 group-hover:opacity-100">
                                <Button size="sm" variant="ghost" onClick={() => handleStartEdit(p)} className="h-4 w-4 p-0 text-muted-foreground">
                                  <Pencil className="h-2.5 w-2.5" />
                                </Button>
                                {p.hasOverride && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setResetTarget({ personnelId: p.personnelId, name: p.name })}
                                    className="h-4 w-4 p-0 text-muted-foreground"
                                    title="Restaurar capacidad original"
                                  >
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
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!resetTarget} onOpenChange={open => { if (!open) setResetTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Resetear la capacidad máxima de {resetTarget?.name} a su valor predeterminado?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el ajuste manual para esta semana y se usará el valor de contrato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setResetTarget(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (resetTarget) {
                  deleteOverride.mutate(resetTarget.personnelId);
                  setResetTarget(null);
                }
              }}
            >
              Resetear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
