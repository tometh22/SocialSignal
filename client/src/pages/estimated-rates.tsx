import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Wand2, Info } from "lucide-react";
import { Link } from "wouter";

const MONTHS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
];

const LS_KEY = "estimatedRates:adjustmentPct";

function loadAdjustmentPct(fallback: number): number {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw !== null) {
      const parsed = parseFloat(raw);
      if (!isNaN(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return fallback;
}

export default function EstimatedRates() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [adjustmentPct, setAdjustmentPct] = useState(() => loadAdjustmentPct(8.5));
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Controlled cell values: key = `${personnelId}-${month}`
  const [cellValues, setCellValues] = useState<Record<string, string>>({});

  // Per-cell save status
  const [cellStatus, setCellStatus] = useState<Record<string, "saving" | "saved" | "error" | null>>({});

  // Auto-generation progress: { personId, count }
  const [generatingFor, setGeneratingFor] = useState<number | null>(null);
  const [generateCount, setGenerateCount] = useState(0);

  const { data: personnel } = useQuery<any[]>({ queryKey: ["/api/personnel"] });
  const { data: rates } = useQuery<any[]>({
    queryKey: ["/api/estimated-rates", year],
    queryFn: () =>
      fetch(`/api/estimated-rates?year=${year}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }).then((r) => r.json()),
  });

  // Sync cellValues when rates data changes
  useEffect(() => {
    if (!rates) return;
    setCellValues((prev) => {
      const next = { ...prev };
      for (const r of rates) {
        const k = `${r.personnelId}-${r.month}`;
        // Only overwrite if user hasn't typed something different
        if (r.estimatedRateARS != null) {
          next[k] = r.estimatedRateARS.toString();
        }
      }
      return next;
    });
  }, [rates]);

  // Persist adjustmentPct to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, adjustmentPct.toString());
    } catch {
      // ignore
    }
  }, [adjustmentPct]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/estimated-rates", "POST", data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimated-rates"] });
      const k = `${variables.personnelId}-${variables.month}`;
      setCellStatus((prev) => ({ ...prev, [k]: "saved" }));
      setTimeout(() => {
        setCellStatus((prev) => ({ ...prev, [k]: null }));
      }, 1500);
    },
    onError: (_err, variables) => {
      const k = `${variables.personnelId}-${variables.month}`;
      setCellStatus((prev) => ({ ...prev, [k]: "error" }));
      setTimeout(() => {
        setCellStatus((prev) => ({ ...prev, [k]: null }));
      }, 2000);
      toast({ title: "Error al guardar tarifa", variant: "destructive" });
    },
  });

  const getRate = (personnelId: number, month: number) =>
    rates?.find((r: any) => r.personnelId === personnelId && r.month === month);

  const getCurrentRate = (person: any): number => {
    const months = [
      'dec2026', 'nov2026', 'oct2026', 'sep2026', 'aug2026', 'jul2026',
      'jun2026', 'may2026', 'apr2026', 'mar2026', 'feb2026', 'jan2026',
      'dec2025', 'nov2025', 'oct2025', 'sep2025', 'aug2025', 'jul2025',
      'jun2025', 'may2025', 'apr2025', 'mar2025', 'feb2025', 'jan2025'
    ];
    for (const m of months) {
      const value = (person as any)[`${m}HourlyRateARS`];
      if (value && value > 0) return value;
    }
    return person.hourlyRate || 0;
  };

  const handleGenerateProjection = async (person: any) => {
    const baseRate = getCurrentRate(person);
    if (!baseRate) return;

    setGeneratingFor(person.id);
    setGenerateCount(0);

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
      setGenerateCount(m);
    }

    toast({ title: "Proyección generada", description: `${person.name}: ${adjustmentPct}% trimestral` });
    // Clear generating state after a short delay so user sees 12/12
    setTimeout(() => {
      setGeneratingFor(null);
      setGenerateCount(0);
    }, 1500);
  };

  const handleSaveRate = (personnelId: number, month: number, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) {
      toast({ title: "Valor inválido", description: "Ingresá un número positivo.", variant: "destructive" });
      return;
    }
    const k = `${personnelId}-${month}`;
    setCellStatus((prev) => ({ ...prev, [k]: "saving" }));
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
          <h1 className="text-2xl font-bold">Valor Hora Estimada</h1>
          <p className="text-muted-foreground">
            Proyección de valor hora con ajuste trimestral, solo para análisis interno
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
            min={2020}
            max={2030}
            onChange={(e) => setYear(parseInt(e.target.value) || now.getFullYear())}
            className="w-24"
          />
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
        <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-amber-900">
          <strong>Las tarifas proyectadas acá se usan en el{" "}
          <Link href="/monthly-closing" className="underline font-medium">Cierre Mensual</Link>
          </strong>{" "}si existe una tarifa para el mes seleccionado (en lugar de la tarifa base del personal). Los valores hora que usan las cotizaciones se editan en{" "}
          <Link href="/admin" className="underline font-medium">
            Admin → Personal
          </Link>{" "}
          (grilla de Costos Históricos por mes).
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
                const isGenerating = generatingFor === p.id;
                return (
                  <tr key={p.id} className="border-b hover:bg-muted/30">
                    <td className="py-1 px-2 font-medium sticky left-0 bg-white text-xs">{p.name}</td>
                    <td className="text-center py-1 px-1 text-xs text-muted-foreground">
                      ${currentRate.toLocaleString()}
                    </td>
                    {MONTHS.map((_, m) => {
                      const rate = getRate(p.id, m + 1);
                      const cellKey = `${p.id}-${m + 1}`;
                      const status = cellStatus[cellKey];
                      const originalValue = rate?.estimatedRateARS?.toString() || "";
                      const currentValue = cellValues[cellKey] ?? originalValue;
                      return (
                        <td key={m} className="text-center py-1 px-1 relative">
                          <div className="flex items-center justify-center gap-0.5">
                            <Input
                              type="number"
                              className="h-7 w-20 text-xs text-center"
                              value={currentValue}
                              placeholder="-"
                              onChange={(e) =>
                                setCellValues((prev) => ({ ...prev, [cellKey]: e.target.value }))
                              }
                              onBlur={() => {
                                if (currentValue !== originalValue && currentValue !== "") {
                                  handleSaveRate(p.id, m + 1, currentValue);
                                }
                              }}
                            />
                            {status === "saving" && (
                              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground flex-shrink-0" />
                            )}
                            {status === "saved" && (
                              <span className="text-green-600 text-xs font-bold flex-shrink-0">✓</span>
                            )}
                            {status === "error" && (
                              <span className="text-red-500 text-xs font-bold flex-shrink-0">✗</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="text-center py-1 px-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-14 p-0 text-xs"
                        onClick={() => handleGenerateProjection(p)}
                        disabled={saveMutation.isPending || isGenerating}
                        title={`Generar proyección ${adjustmentPct}% trimestral`}
                      >
                        {isGenerating ? (
                          <span className="text-xs">{generateCount}/12</span>
                        ) : saveMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Wand2 className="h-3 w-3" />
                        )}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground mt-2">
            * Solo se muestran empleados de tiempo completo. Los freelancers tienen tarifas por cotización.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
