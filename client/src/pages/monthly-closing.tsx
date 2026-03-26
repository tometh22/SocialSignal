import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Check } from "lucide-react";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export default function MonthlyClosing() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // prev month for closing
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: personnel } = useQuery<any[]>({ queryKey: ["/api/personnel"] });
  const { data: closings } = useQuery<any[]>({
    queryKey: ["/api/monthly-closings", year, month + 1],
    queryFn: () =>
      fetch(`/api/monthly-closings?year=${year}&month=${month + 1}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }).then((r) => r.json()),
  });

  const closeMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/monthly-closings", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/monthly-closings"] });
      toast({ title: "Cierre guardado" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo guardar el cierre", variant: "destructive" });
    },
  });

  const getClosing = (personnelId: number) =>
    closings?.find((c: any) => c.personnelId === personnelId);

  const handleClose = (person: any) => {
    const monthlyHours = person.monthlyHours || 160;
    const rate = person.hourlyRate || 0;
    // For closing: adjustedHours = contractual monthly hours (e.g. 160)
    // actualHours should come from time entries but we default to monthlyHours
    const existing = getClosing(person.id);
    closeMutation.mutate({
      personnelId: person.id,
      year,
      month: month + 1,
      actualHours: existing?.actualHours || monthlyHours,
      adjustedHours: monthlyHours,
      hourlyRate: rate,
      totalCost: monthlyHours * rate,
    });
  };

  const fullTimers = personnel?.filter((p: any) => p.contractType !== "freelance") || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cierre Mensual de Horas</h1>
          <p className="text-muted-foreground">
            Reconciliación: ajustar horas reales a horas contractuales para facturación
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value) || now.getFullYear())}
            className="w-24"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cierre {MONTHS[month]} {year}</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3">Persona</th>
                <th className="text-center py-2 px-3">Contrato</th>
                <th className="text-center py-2 px-3">Hs Contractuales</th>
                <th className="text-center py-2 px-3">Valor Hora</th>
                <th className="text-center py-2 px-3">Costo Final</th>
                <th className="text-center py-2 px-3">Estado</th>
                <th className="text-center py-2 px-3">Acción</th>
              </tr>
            </thead>
            <tbody>
              {fullTimers.map((p: any) => {
                const closing = getClosing(p.id);
                const hrs = p.monthlyHours || 160;
                const rate = p.hourlyRate || 0;
                return (
                  <tr key={p.id} className="border-b hover:bg-muted/30">
                    <td className="py-2 px-3 font-medium">{p.name}</td>
                    <td className="text-center py-2 px-3 capitalize">{p.contractType || "full-time"}</td>
                    <td className="text-center py-2 px-3">{hrs}h</td>
                    <td className="text-center py-2 px-3">${rate.toLocaleString()}</td>
                    <td className="text-center py-2 px-3 font-semibold">
                      ${(hrs * rate).toLocaleString()}
                    </td>
                    <td className="text-center py-2 px-3">
                      {closing ? (
                        <span className="text-green-600 flex items-center justify-center gap-1">
                          <Check className="h-4 w-4" /> Cerrado
                        </span>
                      ) : (
                        <span className="text-amber-600">Pendiente</span>
                      )}
                    </td>
                    <td className="text-center py-2 px-3">
                      <Button
                        size="sm"
                        variant={closing ? "outline" : "default"}
                        onClick={() => handleClose(p)}
                        disabled={closeMutation.isPending}
                      >
                        {closeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : closing ? "Re-cerrar" : "Cerrar"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
