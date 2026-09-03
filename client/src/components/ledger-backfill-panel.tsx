import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { RefreshCcw } from "lucide-react";

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Carga histórica de Activo/Pasivo desde el Excel MAESTRO.
 *
 * El sync automático (cada 30 min) sólo importa el mes en curso y deja de
 * tocar estos períodos desde app_mode_cutover_date en adelante — por diseño,
 * para no pisar la carga manual en Mind (ver docs/audits para el detalle).
 * Este panel es la excepción explícita y admin-only: pedís un rango puntual
 * (incluso posterior al cutover) y se trae tal cual está en la planilla.
 * Sólo visible para Admin porque dispara llamadas a la API de Google Sheets
 * y puede tocar meses ya cerrados.
 */
export function LedgerBackfillPanel() {
  // hasPermission('admin') matchea exactamente el gate del backend
  // (requirePermission("admin") acepta isAdmin=true, role="admin" o
  // permissions.includes("admin")) — isAdmin a secas es más estricto que
  // eso y es lo que gatea el resto del sidebar (Configuración, Usuarios),
  // así que un admin real podía no ver este panel.
  const { hasPermission } = usePermissions();
  const isAdmin = hasPermission("admin");
  const { toast } = useToast();
  const qc = useQueryClient();
  const [from, setFrom] = useState("2026-01");
  const [to, setTo] = useState(currentPeriod());

  const backfillMutation = useMutation({
    mutationFn: () => apiRequest("/api/ledger/backfill", "POST", { from, to }),
    onSuccess: async (result: any) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["/api/activo"] }),
        qc.invalidateQueries({ queryKey: ["/api/activo/summary"] }),
        qc.invalidateQueries({ queryKey: ["/api/pasivo"] }),
        qc.invalidateQueries({ queryKey: ["/api/pasivo/summary"] }),
      ]);
      const periods: string[] = result?.periods ?? [];
      const withErrors = periods.filter((p) => {
        const r = result.results?.[p];
        return (r?.activo?.errors?.length ?? 0) > 0 || (r?.pasivo?.errors?.length ?? 0) > 0;
      });
      toast({
        title: `Backfill completado: ${periods.length} meses`,
        description: withErrors.length > 0
          ? `${withErrors.length} meses sin datos en la planilla o con error: ${withErrors.join(", ")}`
          : "Todos los meses del rango se importaron sin errores.",
        variant: withErrors.length > 0 ? "destructive" : undefined,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error al traer datos del Excel MAESTRO", description: error.message, variant: "destructive" });
    },
  });

  if (!isAdmin) return null;

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-wrap items-end gap-3 py-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="backfill-from" className="text-xs text-muted-foreground">Desde</Label>
          <Input id="backfill-from" type="month" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="backfill-to" className="text-xs text-muted-foreground">Hasta (inclusive)</Label>
          <Input id="backfill-to" type="month" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" />
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={backfillMutation.isPending}
          onClick={() => backfillMutation.mutate()}
        >
          <RefreshCcw className={`h-3.5 w-3.5 mr-1.5 ${backfillMutation.isPending ? "animate-spin" : ""}`} />
          {backfillMutation.isPending ? "Trayendo del Excel MAESTRO…" : "Traer Activo/Pasivo desde Excel MAESTRO"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Sólo Admin. Trae el rango tal cual está en la planilla; nunca pisa filas cargadas a mano en Mind.
        </span>
      </CardContent>
    </Card>
  );
}
