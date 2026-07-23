import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useCurrency } from "@/hooks/use-currency";
import { Loader2, Check, X, ExternalLink, ChevronDown, Copy, Download } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// Default contractual base hours by contract type
function defaultBaseHours(person: any): number {
  const type = (person.contractType || "full-time").toLowerCase();
  if (type === "freelance") return person.monthlyHours || 0;
  // Use configured monthlyHours when available; fall back to contract-type defaults
  if (person.monthlyHours) return person.monthlyHours;
  return type === "part-time" ? 120 : 160;
}

export default function MonthlyClosing() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [contractFilter, setContractFilter] = useState<string>("all");
  // Category-based hours adjustments per person
  type HoursAdj = { vacaciones: number; feriados: number; epicalGeneral: number; discrecional: number };
  const [hoursAdjustments, setHoursAdjustments] = useState<Record<number, HoursAdj>>({});
  const [expandedAdj, setExpandedAdj] = useState<number | null>(null);
  // Per-row mutation tracking
  const [closingPersonnelId, setClosingPersonnelId] = useState<number | null>(null);
  // Re-close confirmation target
  const [reCloseTarget, setReCloseTarget] = useState<any>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { exchangeRate } = useCurrency();

  const { data: personnel, isLoading: personnelLoading } = useQuery<any[]>({ queryKey: ["/api/personnel"] });
  const { data: estimatedRates = [] } = useQuery<any[]>({
    queryKey: ["/api/estimated-rates", year],
    queryFn: () =>
      fetch(`/api/estimated-rates?year=${year}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }).then((r) => r.json()),
  });
  const { data: closings, isLoading: closingsLoading } = useQuery<any[]>({
    queryKey: ["/api/monthly-closings", year, month + 1],
    queryFn: () =>
      fetch(`/api/monthly-closings?year=${year}&month=${month + 1}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }).then((r) => r.json()),
  });
  // Real hours logged per person for the month (time_entries + task_time_entries)
  const { data: realHoursMap = {} } = useQuery<Record<number, number>>({
    queryKey: ["/api/monthly-closings/real-hours", year, month + 1],
    queryFn: () =>
      fetch(`/api/monthly-closings/real-hours?year=${year}&month=${month + 1}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }).then((r) => r.json()),
  });
  // Holidays for the year, to deduct from base hours
  const { data: holidaysData = [] } = useQuery<any[]>({
    queryKey: ["/api/holidays", year],
    queryFn: () =>
      fetch(`/api/holidays?year=${year}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }).then((r) => r.json()),
  });

  // Number of holidays falling on weekdays in the selected month
  const monthHolidayCount = (holidaysData || []).filter((h: any) => {
    const d = new Date(h.date + (h.date?.length === 10 ? "T00:00:00" : ""));
    if (isNaN(d.getTime())) return false;
    const dow = d.getDay();
    return d.getFullYear() === year && d.getMonth() === month && dow !== 0 && dow !== 6;
  }).length;

  // Rehydrate saved adjustments when closings load (so manual edits survive reload)
  useEffect(() => {
    if (!closings) return;
    const restored: Record<number, HoursAdj> = {};
    for (const c of closings) {
      if (c.adjustments && typeof c.adjustments === "object") {
        restored[c.personnelId] = {
          vacaciones: c.adjustments.vacaciones || 0,
          feriados: c.adjustments.feriados || 0,
          epicalGeneral: c.adjustments.epicalGeneral || 0,
          discrecional: c.adjustments.discrecional || 0,
        };
      }
    }
    if (Object.keys(restored).length > 0) {
      setHoursAdjustments((prev) => ({ ...restored, ...prev }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closings]);

  const closeMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/monthly-closings", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/monthly-closings"] });
      toast({ title: "Cierre guardado" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo guardar el cierre", variant: "destructive" });
    },
    onSettled: () => {
      setClosingPersonnelId(null);
    },
  });

  const getClosing = (personnelId: number) =>
    closings?.find((c: any) => c.personnelId === personnelId);

  // Returns the best available rate for the selected month: estimated > base by billing currency
  const getEffectiveRate = (person: any): { rate: number; isEstimated: boolean } => {
    const est = estimatedRates.find(
      (r: any) => r.personnelId === person.id && r.month === month + 1
    );
    if (est?.estimatedRateARS && est.estimatedRateARS > 0) {
      return { rate: Number(est.estimatedRateARS), isEstimated: true };
    }
    const billing = person.billingCurrency ?? "ARS";
    if (billing === "USD" || billing === "mixed") {
      return { rate: person.hourlyRate || 0, isEstimated: false };
    }
    // ARS: prefer the ARS-specific rate, fall back to hourlyRate only as last resort
    return { rate: person.hourlyRateARS || person.hourlyRate || 0, isEstimated: false };
  };

  const getAdj = (personnelId: number): HoursAdj =>
    hoursAdjustments[personnelId] ?? { vacaciones: 0, feriados: 0, epicalGeneral: 0, discrecional: 0 };

  const setAdj = (personnelId: number, field: keyof HoursAdj, value: string) => {
    const parsed = parseFloat(value);
    const v = isNaN(parsed) ? 0 : parsed;
    setHoursAdjustments(prev => ({ ...prev, [personnelId]: { ...getAdj(personnelId), [field]: v } }));
  };

  const resetAdj = (personnelId: number) => {
    setHoursAdjustments(prev => { const n = { ...prev }; delete n[personnelId]; return n; });
    setExpandedAdj(null);
  };

  const hasAdjustment = (personnelId: number): boolean => {
    const adj = hoursAdjustments[personnelId];
    return !!adj && (adj.vacaciones > 0 || adj.feriados > 0 || adj.epicalGeneral > 0 || adj.discrecional !== 0);
  };

  // Effective base hours for a person: default adjusted by category deductions.
  // No aplica a freelance — ver effectiveHours.
  const effectiveBaseHours = (person: any): number => {
    const base = defaultBaseHours(person);
    const adj = hoursAdjustments[person.id];
    if (!adj) return base;
    return Math.max(0, base - (adj.vacaciones || 0) - (adj.feriados || 0) - (adj.epicalGeneral || 0) + (adj.discrecional || 0));
  };

  // Horas a facturar: para full-time/part-time es la base ajustada (fija,
  // independiente de cuánto trabajaron). Para freelance el cálculo debe ser
  // lineal por horas reales trabajadas, sin piso/techo de horas base — no
  // tiene sentido ajustar por feriados/vacaciones a alguien que factura
  // exactamente lo que trabajó.
  const effectiveHours = (person: any): number => {
    if ((person.contractType || "full-time").toLowerCase() === "freelance") {
      return realHoursMap[person.id] ?? 0;
    }
    return effectiveBaseHours(person);
  };

  // Suggested feriado hours for a person this month (holidays × daily hours)
  const feriadoHoursFor = (person: any): number => {
    const dailyHours = (defaultBaseHours(person) || 160) / 20;
    return Math.round(monthHolidayCount * dailyHours);
  };

  const doClose = (person: any) => {
    const hrs = effectiveHours(person);
    const { rate } = getEffectiveRate(person);
    if (rate <= 0) {
      toast({
        title: "Sin tarifa configurada",
        description: `${person.name} no tiene tarifa para ${MONTHS[month]} ${year}. Configurala en Valor Hora Estimada o en Admin → Personal.`,
        variant: "destructive",
      });
      return;
    }
    const billing = getBillingCurrency(person);
    let totalCost: number;
    if (billing === 'USD' || billing === 'mixed') {
      // rate is already in USD; totalCost stored in ARS equivalent for consistency
      totalCost = hrs * rate * (exchangeRate || 1);
    } else {
      // ARS billing: rate is in ARS
      totalCost = hrs * rate;
    }
    setClosingPersonnelId(person.id);
    closeMutation.mutate({
      personnelId: person.id,
      year,
      month: month + 1,
      actualHours: realHoursMap[person.id] ?? hrs,
      adjustedHours: hrs,
      hourlyRate: rate,
      totalCost,
      exchangeRateAtClose: exchangeRate || null,
      adjustments: hoursAdjustments[person.id] ?? null,
    });
  };

  const handleClose = (person: any) => {
    const closing = getClosing(person.id);
    if (closing) {
      // Re-close: ask for confirmation first
      setReCloseTarget(person);
    } else {
      doClose(person);
    }
  };

  const handleReCloseConfirm = () => {
    if (reCloseTarget) {
      doClose(reCloseTarget);
    }
    setReCloseTarget(null);
  };

  // Billing currency helpers
  const getBillingCurrency = (person: any): string => person.billingCurrency ?? "ARS";
  const getUsdFraction = (person: any): number => person.usdBillingFraction ?? 0;

  // Cost display: returns {arsText, usdText} based on billing modality.
  // Si la persona ya tiene un cierre guardado para este mes, se usan los
  // valores congelados al cierre (horas, tarifa, TC) en vez de recalcular en
  // vivo — así esta tabla siempre coincide con lo que ve la persona en "Mis
  // Facturas" (que también lee del registro de cierre una vez cerrado).
  const getCostDisplay = (person: any) => {
    const closing = getClosing(person.id);
    const hrs = closing ? closing.adjustedHours : effectiveHours(person);
    const billing = getBillingCurrency(person);
    const rate = closing ? closing.hourlyRate : getEffectiveRate(person).rate; // ARS o USD según billingCurrency
    const fx = closing?.exchangeRateAtClose || exchangeRate;

    if (billing === "USD") {
      const costUSD = hrs * rate;
      const costARS = costUSD * fx;
      return {
        primary: `USD ${costUSD.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
        secondary: `≈ ARS ${costARS.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      };
    }

    if (billing === "mixed") {
      // `rate` está en USD/hora (igual que en el caso "USD" puro). El total en
      // USD se calcula directo; la porción facturada en ARS debe convertirse
      // al tipo de cambio del período, no quedar en unidades de USD.
      const usdFraction = getUsdFraction(person);
      const costTotalUSD = hrs * rate;
      const costUSD = costTotalUSD * usdFraction;
      const costARS = costTotalUSD * (1 - usdFraction) * fx;
      return {
        primary: `USD ${costUSD.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
        secondary: `+ ARS ${costARS.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      };
    }

    // ARS
    const costARS = hrs * rate;
    return {
      primary: `ARS ${costARS.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      secondary: null,
    };
  };

  const getRateDisplay = (person: any): { text: string; isEstimated: boolean } => {
    const billing = getBillingCurrency(person);
    const closing = getClosing(person.id);
    const { rate, isEstimated } = closing ? { rate: closing.hourlyRate, isEstimated: false } : getEffectiveRate(person);
    let text: string;
    if (billing === "USD") text = `USD ${rate.toLocaleString("en-US")}`;
    else if (billing === "mixed") text = `USD ${rate.toLocaleString("en-US")} (mixto)`;
    else text = `ARS ${rate.toLocaleString("es-AR")}`;
    return { text, isEstimated };
  };

  // Raw (numeric) cost split for export — mirrors getCostDisplay's logic but
  // returns numbers instead of formatted strings.
  const getCostRaw = (person: any): { costUSD: number; costARS: number } => {
    const closing = getClosing(person.id);
    const hrs = closing ? closing.adjustedHours : effectiveHours(person);
    const billing = getBillingCurrency(person);
    const rate = closing ? closing.hourlyRate : getEffectiveRate(person).rate;
    const fx = closing?.exchangeRateAtClose || exchangeRate || 1;
    if (billing === "USD") {
      const costUSD = hrs * rate;
      return { costUSD, costARS: costUSD * fx };
    }
    if (billing === "mixed") {
      const usdFraction = getUsdFraction(person);
      const totalUSD = hrs * rate;
      return { costUSD: totalUSD * usdFraction, costARS: totalUSD * (1 - usdFraction) * fx };
    }
    return { costUSD: 0, costARS: hrs * rate };
  };

  // Filter personnel
  const filteredPersonnel = (personnel || []).filter((p: any) => {
    if (contractFilter === "all") return true;
    const type = (p.contractType || "full-time").toLowerCase();
    return type === contractFilter;
  });

  // Build export matrix (header + rows). Numeric columns stay numeric so they
  // paste into Excel as numbers, ready for the honorarios sheet.
  const EXPORT_HEADERS = [
    "Persona", "Contrato", "Facturación", "Hs Base", "Hs Reales",
    "Valor Hora", "Moneda Tarifa", "Costo USD", "Costo ARS", "Estado",
  ];
  const buildExportRows = (): (string | number)[][] => {
    return filteredPersonnel.map((p: any) => {
      const closing = getClosing(p.id);
      const baseHrs = closing ? closing.adjustedHours : effectiveHours(p);
      const realHrs = realHoursMap[p.id] ?? 0;
      const billing = getBillingCurrency(p);
      const { rate } = closing ? { rate: closing.hourlyRate } : getEffectiveRate(p);
      const { costUSD, costARS } = getCostRaw(p);
      const rateCurrency = billing === "ARS" ? "ARS" : "USD";
      return [
        p.name,
        p.contractType || "full-time",
        billing === "mixed" ? "Mixto" : billing,
        Math.round(baseHrs * 100) / 100,
        Math.round(realHrs * 100) / 100,
        Math.round(rate * 100) / 100,
        rateCurrency,
        Math.round(costUSD),
        Math.round(costARS),
        closing ? "Cerrado" : "Pendiente",
      ];
    });
  };

  const handleCopyForExcel = async () => {
    const rows = buildExportRows();
    if (rows.length === 0) {
      toast({ title: "Nada para copiar", variant: "destructive" });
      return;
    }
    // Tab-separated → pega en columnas al hacer Ctrl+V en Excel/Sheets
    const tsv = [EXPORT_HEADERS, ...rows].map((r) => r.join("\t")).join("\n");
    try {
      await navigator.clipboard.writeText(tsv);
      toast({ title: "Copiado", description: `${rows.length} filas listas para pegar en el Excel de honorarios.` });
    } catch {
      toast({ title: "No se pudo copiar", description: "Tu navegador bloqueó el portapapeles. Probá con Descargar CSV.", variant: "destructive" });
    }
  };

  const handleDownloadCsv = () => {
    const rows = buildExportRows();
    if (rows.length === 0) {
      toast({ title: "Nada para exportar", variant: "destructive" });
      return;
    }
    const esc = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [EXPORT_HEADERS, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    // BOM para que Excel respete acentos
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cierre-${year}-${String(month + 1).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasUnsavedChanges = Object.keys(hoursAdjustments).some(pid => hasAdjustment(Number(pid)));

  // Loading state
  const isLoading = personnelLoading || closingsLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <Loader2 className="animate-spin h-8 w-8" />
        <span className="text-muted-foreground">Cargando...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Re-close confirmation dialog */}
      <AlertDialog open={reCloseTarget !== null} onOpenChange={(open) => { if (!open) setReCloseTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Re-cerrar el mes?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Re-cerrar el mes de <strong>{reCloseTarget?.name}</strong>? Esto sobreescribirá el cierre anterior.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReCloseConfirm}>Re-cerrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved changes banner */}
      {hasUnsavedChanges && (
        <div className="rounded-md border border-yellow-400 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          Tenés cambios manuales sin aplicar al cierre. Acordate de usar estos valores al cerrar.
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Cierre Mensual de Horas</h1>
          <p className="text-muted-foreground">
            Reconciliación: ajustar horas reales a horas contractuales para facturación.{" "}
            <Link href="/operations/estimated-rates" className="inline-flex items-center gap-1 text-primary hover:underline text-sm">
              Gestionar tarifas proyectadas <ExternalLink className="h-3 w-3" />
            </Link>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyForExcel}
            disabled={filteredPersonnel.length === 0}
            title="Copia la tabla en formato tabulado para pegar directo en el Excel de honorarios (Ctrl+V)"
          >
            <Copy className="h-4 w-4 mr-1" /> Copiar para Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadCsv}
            disabled={filteredPersonnel.length === 0}
            title="Descargar la tabla como archivo CSV"
          >
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Select value={contractFilter} onValueChange={setContractFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Tipo de contrato" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los contratos</SelectItem>
              <SelectItem value="full-time">Full-time</SelectItem>
              <SelectItem value="part-time">Part-time</SelectItem>
              <SelectItem value="freelance">Freelance (por hora)</SelectItem>
            </SelectContent>
          </Select>
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
            min={2020}
            max={2030}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Cierre {MONTHS[month]} {year}
            {contractFilter !== "all" && (
              <Badge variant="outline" className="ml-2 capitalize">{contractFilter}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {filteredPersonnel.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No hay personal para el filtro seleccionado
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Persona</th>
                  <th className="text-center py-2 px-3">Contrato</th>
                  <th className="text-center py-2 px-3">Facturación</th>
                  <th className="text-center py-2 px-3">Hs Base</th>
                  <th className="text-center py-2 px-3">Hs Reales</th>
                  <th className="text-center py-2 px-3">Valor Hora</th>
                  <th className="text-center py-2 px-3">Costo Final</th>
                  <th className="text-center py-2 px-3">Estado</th>
                  <th className="text-center py-2 px-3">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredPersonnel.map((p: any) => {
                  const closing = getClosing(p.id);
                  const baseHrs = closing ? closing.adjustedHours : effectiveHours(p);
                  const cost = getCostDisplay(p);
                  const billing = getBillingCurrency(p);
                  const isRowPending = closingPersonnelId === p.id && closeMutation.isPending;
                  return (
                    <tr key={p.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-3 font-medium">{p.name}</td>
                      <td className="text-center py-2 px-3 capitalize">
                        {p.contractType || "full-time"}
                      </td>
                      <td className="text-center py-2 px-3">
                        <Badge
                          variant="outline"
                          title={billing === "mixed" ? "Facturación Mixta" : `Facturación en ${billing}`}
                          className={
                            billing === "USD"
                              ? "border-green-400 text-green-700"
                              : billing === "mixed"
                              ? "border-amber-400 text-amber-700"
                              : "border-blue-400 text-blue-700"
                          }
                        >
                          {billing === "mixed" ? "Mixto" : billing}
                        </Badge>
                      </td>
                      <td className="text-center py-2 px-3">
                        {(p.contractType || "full-time").toLowerCase() === "freelance" ? (
                          // Freelance: horas reales trabajadas, sin ajustes de horas base (no aplica).
                          <span className="text-sm font-medium" title="Cálculo lineal por horas reales trabajadas">
                            {baseHrs}h <span className="text-[10px] text-muted-foreground">(real)</span>
                          </span>
                        ) : (
                        <div className="relative">
                          <button
                            className={`flex items-center gap-1 justify-center mx-auto text-sm font-medium hover:text-primary transition-colors ${hasAdjustment(p.id) ? "text-amber-700" : ""}`}
                            onClick={() => setExpandedAdj(prev => prev === p.id ? null : p.id)}
                          >
                            {baseHrs}h
                            {hasAdjustment(p.id) && (
                              <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600 px-1 py-0">Aj.</Badge>
                            )}
                            <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${expandedAdj === p.id ? "rotate-180" : ""}`} />
                          </button>
                          {expandedAdj === p.id && (
                            <div className="absolute z-10 mt-1 left-1/2 -translate-x-1/2 w-52 rounded-lg border bg-background shadow-lg p-3 text-xs space-y-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold text-foreground">Ajustar horas base</span>
                                <button onClick={() => setExpandedAdj(null)} className="text-muted-foreground hover:text-foreground">
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                              <div className="text-[10px] text-muted-foreground mb-1" title="Las horas base surgen de las Horas Mensuales configuradas en Admin → Personal (o 160 full-time / 120 part-time por defecto). Ajustá acá con las deducciones o el ajuste discrecional.">
                                Base contractual: {defaultBaseHours(p)}h <span className="underline decoration-dotted">(de Admin → Personal)</span>
                              </div>
                              {monthHolidayCount > 0 && (
                                <div className="flex items-center justify-between gap-2 rounded bg-muted/50 px-1.5 py-1">
                                  <span className="text-[10px] text-muted-foreground">
                                    {monthHolidayCount} feriado(s) este mes (≈{feriadoHoursFor(p)}h)
                                  </span>
                                  <button
                                    className="text-[10px] text-primary hover:underline"
                                    onClick={() => setAdj(p.id, "feriados", String(feriadoHoursFor(p)))}
                                  >
                                    Aplicar
                                  </button>
                                </div>
                              )}
                              {([
                                { key: "vacaciones" as const, label: "Vacaciones −" },
                                { key: "feriados" as const, label: "Feriados −" },
                                { key: "epicalGeneral" as const, label: "Epical General −" },
                                { key: "discrecional" as const, label: "Ajuste discrecional ±" },
                              ] as const).map(({ key, label }) => (
                                <div key={key} className="flex items-center justify-between gap-2">
                                  <span className="text-muted-foreground flex-1">{label}</span>
                                  <Input
                                    type="number"
                                    min={key === "discrecional" ? undefined : 0}
                                    step={1}
                                    value={getAdj(p.id)[key] || ""}
                                    onChange={(e) => setAdj(p.id, key, e.target.value)}
                                    className="w-16 h-6 text-xs text-center"
                                    placeholder="0"
                                  />
                                </div>
                              ))}
                              <div className="border-t pt-2 flex items-center justify-between">
                                <span className="font-semibold text-foreground">{effectiveBaseHours(p)}h total</span>
                                {hasAdjustment(p.id) && (
                                  <button
                                    onClick={() => resetAdj(p.id)}
                                    className="text-[10px] text-muted-foreground hover:text-red-600 underline"
                                  >
                                    Resetear
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        )}
                      </td>
                      <td className="text-center py-2 px-3">
                        {(() => {
                          const real = realHoursMap[p.id] ?? 0;
                          const over = (p.contractType || "full-time").toLowerCase() === "freelance" ? false : real > baseHrs;
                          return (
                            <span className={over ? "text-red-600 font-medium" : real > 0 ? "text-foreground" : "text-muted-foreground"} title="Horas reales cargadas (tareas + time entries)">
                              {real.toFixed(1)}h
                            </span>
                          );
                        })()}
                      </td>
                      <td className="text-center py-2 px-3">
                        {(() => {
                          const { text, isEstimated } = getRateDisplay(p);
                          return (
                            <span className={isEstimated ? "text-blue-600" : ""} title={isEstimated ? "Tarifa proyectada del mes" : "Tarifa base de personal"}>
                              {text}{isEstimated && " *"}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="text-center py-2 px-3 font-semibold">
                        <div>{cost.primary}</div>
                        {cost.secondary && (
                          <div className="text-xs text-muted-foreground font-normal">{cost.secondary}</div>
                        )}
                      </td>
                      <td className="text-center py-2 px-3">
                        {closing ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-green-600 flex items-center gap-1 text-xs font-medium">
                              <Check className="h-3.5 w-3.5" /> Cerrado
                            </span>
                            {closing.closedAt && (
                              <span className="text-[10px] text-muted-foreground">
                                {format(new Date(closing.closedAt), "d MMM, HH:mm", { locale: es })}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-amber-600">Pendiente</span>
                        )}
                      </td>
                      <td className="text-center py-2 px-3">
                        <Button
                          size="sm"
                          variant={closing ? "outline" : "default"}
                          onClick={() => handleClose(p)}
                          disabled={isRowPending}
                        >
                          {isRowPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : closing ? (
                            "Re-cerrar"
                          ) : (
                            "Cerrar"
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {estimatedRates.some((r: any) => r.month === month + 1) && (
            <p className="text-xs text-muted-foreground mt-2">
              * Tarifa proyectada para {MONTHS[month]} {year} (configurada en{" "}
              <Link href="/operations/estimated-rates" className="text-primary hover:underline">Valor Hora Estimada</Link>
              ). Los valores sin * usan la tarifa base del personal.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
