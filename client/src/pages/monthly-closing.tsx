import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { contractualMonthlyHours, payableMonthlyHours } from "@shared/utils/payroll-hours";
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
import { getApiErrorMessage } from "@/lib/api-error";
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
const defaultBaseHours = contractualMonthlyHours;

export default function MonthlyClosing() {
  const selectedPeriod = new URLSearchParams(window.location.search).get("period");
  const now = selectedPeriod && /^\d{4}-(0[1-9]|1[0-2])$/.test(selectedPeriod) ? new Date(`${selectedPeriod}-01T12:00:00`) : new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [contractFilter, setContractFilter] = useState<string>("all");
  useEffect(() => { const url = new URL(window.location.href); url.searchParams.set("period", `${year}-${String(month + 1).padStart(2, "0")}`); window.history.replaceState(null, "", url); }, [year, month]);
  // Category-based hours adjustments per person
  type HoursAdj = { unpaidHours: number };
  const [adjustmentReasons, setAdjustmentReasons] = useState<Record<number, string>>({});
  const [hoursAdjustments, setHoursAdjustments] = useState<Record<number, HoursAdj>>({});
  const [expandedAdj, setExpandedAdj] = useState<number | null>(null);
  // Per-row mutation tracking
  const [closingPersonnelId, setClosingPersonnelId] = useState<number | null>(null);
  // Re-close confirmation target
  const [reCloseTarget, setReCloseTarget] = useState<any>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const period = `${year}-${String(month+1).padStart(2,"0")}`;
  const [reopenReason, setReopenReason] = useState("");
  const cutoff = useQuery<any>({ queryKey: ["payroll-period",period], queryFn: async () => { const r = await fetch(`/api/payroll-period/${period}`, {credentials:"include"}); if (!r.ok) throw new Error("No se pudo cargar el corte"); return r.json(); } });
  const prepare = useMutation({ mutationFn: (action: string) => apiRequest(`/api/payroll-period/${period}/${action}`, "POST", {reason:reopenReason}), onSuccess: () => { queryClient.invalidateQueries({queryKey:["payroll-period"]}); queryClient.invalidateQueries({queryKey:["/api/monthly-closings"]}); queryClient.invalidateQueries({queryKey:["personnel-settlements"]}); toast({title:"Corte actualizado",description:"Revisá los pendientes y continuá al paso 2."}); }, onError:(error:Error)=>toast({title:"No se pudo actualizar",description:error.message,variant:"destructive"}) });

  const { exchangeRate } = useCurrency();

  const { data: personnel, isLoading: personnelLoading } = useQuery<any[]>({ queryKey: ["/api/personnel"] });
  const { data: closings, isLoading: closingsLoading } = useQuery<any[]>({
    queryKey: ["/api/monthly-closings", year, month + 1],
    queryFn: () =>
      fetch(`/api/monthly-closings?year=${year}&month=${month + 1}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }).then((r) => r.json()),
  });
  const { data: declarations = [], refetch: refetchDeclarations } = useQuery<any[]>({ queryKey: ["monthly-settlement-declarations"], queryFn: () => fetch("/api/monthly-settlement-declarations", { credentials: "include" }).then((r) => r.ok ? r.json() : []) });
  const declarationReview = useMutation({ mutationFn: ({ id, action, reason, submittedAt }: { id: number; action: string; reason?: string; submittedAt: string }) => apiRequest(`/api/monthly-settlement-declarations/${id}`, "PATCH", { action, reason, submittedAt }), onSuccess: () => { refetchDeclarations(); toast({ title: "Declaración revisada" }); }, onError: (error: Error) => toast({ title: "No se pudo revisar", description: error.message, variant: "destructive" }) });
  // Real hours logged per person for the month (time_entries + task_time_entries)
  const { data: realHoursMap = {} } = useQuery<Record<number, number>>({
    queryKey: ["/api/monthly-closings/real-hours", year, month + 1],
    queryFn: () =>
      fetch(`/api/monthly-closings/real-hours?year=${year}&month=${month + 1}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }).then((r) => r.json()),
  });
  // Rehydrate saved adjustments when closings load (so manual edits survive reload)
  useEffect(() => {
    if (!closings) return;
    const restored: Record<number, HoursAdj> = {};
    for (const c of closings) {
      if (c.adjustments && typeof c.adjustments === "object") {
        restored[c.personnelId] = { unpaidHours: c.adjustments.unpaidHours || 0 };
      }
    }
    setHoursAdjustments(restored);
    setAdjustmentReasons(Object.fromEntries(closings.map((c: any) => [c.personnelId, c.notes || ""])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closings]);

  const closeMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/monthly-closings", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/monthly-closings"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-settlements"] });
      toast({ title: "Base guardada", description: "Seguí en el paso 2: Facturación y seguimiento." });
    },
    onError: (error) => {
      toast({
        title: "No se pudo guardar el cierre",
        description: getApiErrorMessage(error, "Revisá la tarifa histórica del período."),
        variant: "destructive",
      });
    },
    onSettled: () => {
      setClosingPersonnelId(null);
    },
  });

  const getClosing = (personnelId: number) =>
    closings?.find((c: any) => c.personnelId === personnelId);

  // Historical costs synced from Personal are the single rate source.
  const getEffectiveRate = (person: any): { rate: number; isEstimated: boolean } => {
    const selectedPeriod = year * 100 + month + 1;
    const monthly = [...(person.historicalRates ?? [])]
      .filter((item: any) => item.year * 100 + item.month <= selectedPeriod)
      .sort((left: any, right: any) =>
        (right.year * 100 + right.month) - (left.year * 100 + left.month)
      )[0];
    const billing = person.billingCurrency ?? "ARS";
    if (billing === "USD" || billing === "mixed") {
      return { rate: monthly?.hourlyRateUSD || 0, isEstimated: false };
    }
    return { rate: monthly?.hourlyRateARS || 0, isEstimated: false };
  };

  const getAdj = (personnelId: number): HoursAdj =>
    hoursAdjustments[personnelId] ?? { unpaidHours: 0 };

  const setAdj = (personnelId: number, field: keyof HoursAdj, value: string) => {
    const parsed = parseFloat(value);
    const v = isNaN(parsed) ? 0 : parsed;
    setHoursAdjustments(prev => ({ ...prev, [personnelId]: { ...getAdj(personnelId), [field]: v } }));
  };

  const resetAdj = (personnelId: number) => {
    setHoursAdjustments(prev => { const n = { ...prev }; delete n[personnelId]; return n; });
    setExpandedAdj(null);
  };

  const hasAdjustment = (id: number) => getAdj(id).unpaidHours > 0;
  const effectiveBaseHours = (person: any): number => Math.max(0, defaultBaseHours(person) - getAdj(person.id).unpaidHours);
  const effectiveHours = (person: any): number => person.contractType === "freelance" ? realHoursMap[person.id] ?? 0 : effectiveBaseHours(person);

  const doClose = (person: any) => {
    const hrs = effectiveHours(person);
    const { rate } = getEffectiveRate(person);
    const existingClosing = getClosing(person.id);
    if (rate <= 0) {
      toast({
        title: "Sin tarifa configurada",
        description: `${person.name} no tiene tarifa para ${MONTHS[month]} ${year}. Configurala en Configuración → Personal.`,
        variant: "destructive",
      });
      return;
    }
    const billing = existingClosing?.billingCurrency ?? getBillingCurrency(person);
    const manualAdjustments = hoursAdjustments[person.id];
    const adjustments = manualAdjustments || { unpaidHours: 0 };
    try { payableMonthlyHours(person, realHoursMap[person.id] ?? 0, adjustments.unpaidHours, adjustmentReasons[person.id] || ""); }
    catch (error) { toast({ title: "Revisá el descuento", description: (error as Error).message, variant: "destructive" }); return; }
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
      adjustments,
      notes: adjustmentReasons[person.id] || null,
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
    const billing = closing?.billingCurrency ?? getBillingCurrency(person);
    const rate = closing ? closing.hourlyRate : getEffectiveRate(person).rate; // ARS o USD según billingCurrency
    const fx = closing?.exchangeRateAtClose || exchangeRate;

    // New closings persist the exact invoice split. Prefer that snapshot so the
    // table does not reconstruct a different mixed-currency value than Mi cuenta.
    if (closing && closing.totalCostARS != null && closing.totalCostUSD != null) {
      if (billing === "mixed") {
        return {
          primary: `USD ${Number(closing.totalCostUSD).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
          secondary: `+ ARS ${Number(closing.totalCostARS).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
        };
      }
      if (billing === "USD") {
        return {
          primary: `USD ${Number(closing.totalCostUSD).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
          secondary: `≈ ARS ${Number(closing.grandTotalARS ?? closing.totalCost).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
        };
      }
      return {
        primary: `ARS ${Number(closing.totalCostARS).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
        secondary: null,
      };
    }

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
      const usdFraction = closing?.usdBillingFraction ?? getUsdFraction(person);
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
    const closing = getClosing(person.id);
    const billing = closing?.billingCurrency ?? getBillingCurrency(person);
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
    if (closing && closing.totalCostARS != null && closing.totalCostUSD != null) {
      return {
        costUSD: Number(closing.totalCostUSD),
        costARS: Number(closing.totalCostARS),
      };
    }
    const hrs = closing ? closing.adjustedHours : effectiveHours(person);
    const billing = closing?.billingCurrency ?? getBillingCurrency(person);
    const rate = closing ? closing.hourlyRate : getEffectiveRate(person).rate;
    const fx = closing?.exchangeRateAtClose || exchangeRate || 1;
    if (billing === "USD") {
      const costUSD = hrs * rate;
      return { costUSD, costARS: costUSD * fx };
    }
    if (billing === "mixed") {
      const usdFraction = closing?.usdBillingFraction ?? getUsdFraction(person);
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
      toast({ title: "Copiado", description: `${rows.length} filas copiadas para revisión.` });
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
      <div className="space-y-3 rounded-xl border p-4"><p className="font-semibold">Corte de horas: {cutoff.data?.day ?? "cargando…"} a las 23:59 (Buenos Aires)</p><p className="text-sm text-muted-foreground">Se programa según los feriados de Mind. El corte congela las horas y prepara borradores; Operaciones revisa las condiciones antes de publicar. Vacaciones, feriados y días Epical son pagos.</p><p>Estado: {cutoff.data?.state === "cut" ? "Horas con corte" : "Horas abiertas"}</p>{cutoff.data?.issues?.map((issue:string)=><p key={issue} className="text-sm text-amber-800">{issue}</p>)}<div className="flex flex-wrap gap-2"><Button disabled={prepare.isPending} onClick={()=>prepare.mutate("prepare")}>Preparar bases y borradores</Button><Button variant="outline" disabled={prepare.isPending || !cutoff.data?.canCut || cutoff.data?.state === "cut"} onClick={()=>prepare.mutate("cut")}>Ejecutar corte pendiente</Button></div>{cutoff.data?.state === "cut" && <div className="flex gap-2"><Input value={reopenReason} onChange={e=>setReopenReason(e.target.value)} placeholder="Motivo para corregir horas antes de publicar"/><Button variant="outline" disabled={prepare.isPending || reopenReason.trim().length < 5} onClick={()=>prepare.mutate("reopen")}>Reabrir horas</Button></div>}</div>
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
          <h1 className="text-2xl font-bold">1. Base a cobrar</h1>
          <p className="text-muted-foreground">
            Fijos: horas contractuales × tarifa. Freelancers: horas trabajadas × tarifa. Las ausencias pagas no descuentan.{" "}
            <Link href="/admin" className="inline-flex items-center gap-1 text-primary hover:underline text-sm">
              Gestionar tarifas en Personal <ExternalLink className="h-3 w-3" />
            </Link>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyForExcel}
            disabled={filteredPersonnel.length === 0}
            title="Copia la tabla para revisión"
          >
            <Copy className="h-4 w-4 mr-1" /> Copiar tabla
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
                            <Dialog open onOpenChange={open => { if (!open) setExpandedAdj(null); }}><DialogContent className="sm:max-w-md space-y-3"><DialogTitle>Descuento excepcional · {p.name}</DialogTitle><DialogDescription>La base sólo se reduce por una licencia sin goce de sueldo acordada.</DialogDescription>
                              <div className="text-[10px] text-muted-foreground mb-1" title="Las horas base surgen de las Horas Mensuales configuradas en Admin → Personal (o 160 full-time / 120 part-time por defecto). Sólo se descuentan licencias sin goce explícitas.">
                                Base contractual: {defaultBaseHours(p)}h <span className="underline decoration-dotted">(de Admin → Personal)</span>
                              </div>
                              <p className="rounded bg-emerald-50 p-2 text-emerald-800">Vacaciones, feriados y días Epical son pagos. No reducen esta base.</p>
                              <label className="block">Horas de licencia sin goce
                                <Input type="number" min="0" max={defaultBaseHours(p)} step="0.5" value={getAdj(p.id).unpaidHours || ""} onChange={(e) => setAdj(p.id, "unpaidHours", e.target.value)} placeholder="0" />
                              </label>
                              <label className="block">Motivo del descuento
                                <Input value={adjustmentReasons[p.id] || ""} onChange={(e) => setAdjustmentReasons(prev => ({ ...prev, [p.id]: e.target.value }))} placeholder="Licencia sin goce acordada…" />
                              </label>
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
                            </DialogContent></Dialog>
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
                            <span className={isEstimated ? "text-blue-600" : ""} title={isEstimated ? "Tarifa histórica estimada por falta de dato del período" : "Tarifa histórica de personal"}>
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
        </CardContent>
      </Card>
      <details><summary className="cursor-pointer text-sm text-muted-foreground">Declaraciones anteriores del cierre operativo</summary><Card>
        <CardHeader><CardTitle>Historial de conciliación bancaria</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {!declarations.some((item: any) => item.closingYear === year && item.closingMonth === month + 1) ? <p className="text-sm text-muted-foreground">No hay declaraciones pendientes ni revisadas.</p> : <table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b text-left"><th className="p-2">Persona / período</th><th className="p-2">Tramo USD</th><th className="p-2">FX cierre</th><th className="p-2">FX banco</th><th className="p-2">Diferencia ARS</th><th className="p-2">Estado</th><th className="p-2">Acción</th></tr></thead><tbody>{declarations.filter((item: any) => item.closingYear === year && item.closingMonth === month + 1).map((item: any) => { const row = item.declaration; return <tr key={row.id} className="border-b"><td className="p-2">{item.personName} · {MONTHS[(item.closingMonth ?? 1) - 1]} {item.closingYear}</td><td className="p-2">USD {Number(row.usdAmount).toLocaleString("en-US", { maximumFractionDigits: 2 })}</td><td className="p-2">{Number(row.closingFxRate).toLocaleString("es-AR")}</td><td className="p-2">{Number(row.bankFxRate).toLocaleString("es-AR")}</td><td className="p-2">ARS {Number(row.differenceARS).toLocaleString("es-AR", { maximumFractionDigits: 2 })}</td><td className="p-2"><Badge variant={row.status === "approved" ? "default" : row.status === "rejected" ? "destructive" : "secondary"}>{row.status === "approved" ? "Aprobada" : row.status === "rejected" ? "Rechazada" : "Pendiente"}</Badge>{row.reviewReason && <p className="mt-1 text-xs text-muted-foreground">{row.reviewReason}</p>}</td><td className="p-2">{row.status === "pending" && <div className="flex gap-1"><Button size="sm" disabled={declarationReview.isPending} onClick={() => declarationReview.mutate({ id: row.id, action: "approve", submittedAt: row.submittedAt })}>Aprobar</Button><Button size="sm" disabled={declarationReview.isPending} variant="outline" onClick={() => { const reason = window.prompt("Qué debe corregir la persona?"); if (reason?.trim()) declarationReview.mutate({ id: row.id, action: "reject", reason, submittedAt: row.submittedAt }); }}>Rechazar</Button></div>}</td></tr>; })}</tbody></table>}
        </CardContent>
      </Card></details>
    </div>
  );
}
