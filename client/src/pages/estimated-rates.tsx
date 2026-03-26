import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Wand2 } from "lucide-react";

const MONTHS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
];

export default function EstimatedRates() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [adjustmentPct, setAdjustmentPct] = useState(8.5);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: personnel } = useQuery<any[]>({ queryKey: ["/api/personnel"] });
  const { data: rates } = useQuery<any[]>({
    queryKey: ["/api/estimated-rates", year],
    queryFn: () =>
      fetch(`/api/estimated-rates?year=${year}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }).then((r) => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/estimated-rates", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimated-rates"] });
    },
  });

  const getRate = (personnelId: number, month: number) =>
    rates?.find((r: any) => r.personnelId === personnelId && r.month === month);

  const getCurrentRate = (person: any): number => {
    // Get current ARS rate from latest historical or hourlyRate
    const fields = [
      'dec2025HourlyRateARS', 'nov2025HourlyRateARS', 'oct2025HourlyRateARS',
      'sep2025HourlyRateARS', 'aug2025HourlyRateARS', 'jul2025HourlyRateARS',
      'jun2025HourlyRateARS', 'may2025HourlyRateARS', 'apr2025HourlyRateARS',
      'mar2025HourlyRateARS', 'feb2025HourlyRateARS', 'jan2025HourlyRateARS'
    ];
    for (const f of fields) {
      if ((person as any)[f] && (person as any)[f] > 0) return (person as any)[f];
    }
    return person.hourlyRate || 0;
  };

  const handleGenerateProjection = (person: any) => {
    const baseRate = getCurrentRate(person);
    if (!baseRate) return;

    // Apply quarterly adjustment: rate increases by adjustmentPct% every 3 months
    for (let m = 1; m <= 12; m++) {
      const quartersAhead = Math.floor((m - 1) / 3);
      const projected = Math.round(baseRate * Math.pow(1 + adjustmentPct / 100, quartersAhead));
      saveMutation.mutate({
        personnelId: person.id,
        year,
        month: m,
        estimatedRateARS: projected,
        adjustmentPct,
      });
    }
    toast({ title: "Proyección generada", description: `${person.name}: ${adjustmentPct}% trimestral` });
  };

  const handleSaveRate = (personnelId: number, month: number, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) return;
    saveMutation.mutate({
      personnelId,
      year,
      month,
      estimatedRateARS: num,
      adjustmentPct,
    });
  };

  const fullTimers = personnel?.filter((p: any) => p.contractType !== "freelance") || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Valor Hora Real y Estimado</h1>
          <p className="text-muted-foreground">
            Proyección de valor hora con ajuste trimestral para cotizaciones futuras
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <label className="text-sm text-muted-foreground">Ajuste trimestral:</label>
          <Input
            type="number"
            step="0.5"
            value={adjustmentPct}
            onChange={(e) => setAdjustmentPct(parseFloat(e.target.value) || 0)}
            className="w-20"
          />
          <span className="text-sm">%</span>
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
          <CardTitle>Valor Hora Estimado {year} (ARS/hr)</CardTitle>
          <CardDescription>
            Click en una celda para editar. Use el botón de varita para generar proyección automática con {adjustmentPct}% trimestral.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2 sticky left-0 bg-white">Persona</th>
                <th className="text-center py-2 px-1 text-xs">Actual</th>
                {MONTHS.map((m, i) => (
                  <th key={i} className="text-center py-2 px-1 text-xs">{m}</th>
                ))}
                <th className="text-center py-2 px-1">Auto</th>
              </tr>
            </thead>
            <tbody>
              {fullTimers.map((p: any) => {
                const currentRate = getCurrentRate(p);
                return (
                  <tr key={p.id} className="border-b hover:bg-muted/30">
                    <td className="py-1 px-2 font-medium sticky left-0 bg-white text-xs">{p.name}</td>
                    <td className="text-center py-1 px-1 text-xs text-muted-foreground">
                      ${currentRate.toLocaleString()}
                    </td>
                    {MONTHS.map((_, m) => {
                      const rate = getRate(p.id, m + 1);
                      return (
                        <td key={m} className="text-center py-1 px-1">
                          <Input
                            type="number"
                            className="h-7 w-20 text-xs text-center"
                            defaultValue={rate?.estimatedRateARS || ""}
                            placeholder="-"
                            onBlur={(e) => handleSaveRate(p.id, m + 1, e.target.value)}
                          />
                        </td>
                      );
                    })}
                    <td className="text-center py-1 px-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => handleGenerateProjection(p)}
                        disabled={saveMutation.isPending}
                        title={`Generar proyección ${adjustmentPct}% trimestral`}
                      >
                        {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
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
