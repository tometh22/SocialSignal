import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { contractualMonthlyHours, payableMonthlyHours } from "@shared/utils/payroll-hours";
import { useState, useEffect, useRef } from "react";
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
import { apiRequest, authFetchJson } from "@/lib/queryClient";
import { getApiErrorMessage } from "@/lib/api-error";
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

export default function MonthlyClosing({ period, onDirtyChange }: { period: string; onDirtyChange: (dirty: boolean) => void }) {
  const [year, oneBasedMonth] = period.split("-").map(Number);
  const month = oneBasedMonth - 1;
  const [contractFilter, setContractFilter] = useState<string>("all");
  // Category-based hours adjustments per person
  type HoursAdj = { unpaidHours: number };
  const [adjustmentReasons, setAdjustmentReasons] = useState<Record<number, string>>({});
  const dirtyAdjustmentIds = useRef(new Set<number>());
  const [hoursAdjustments, setHoursAdjustments] = useState<Record<number, HoursAdj>>({});
  const [expandedAdj, setExpandedAdj] = useState<number | null>(null);
  // Per-row mutation tracking
  const [closingPersonnelId, setClosingPersonnelId] = useState<number | null>(null);
  // Re-close confirmation target
  const [reCloseTarget, setReCloseTarget] = useState<any>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reopenReason, setReopenReason] = useState("");
  const cutoff = useQuery<any>({ queryKey: ["payroll-period",period], queryFn: async () => { return authFetchJson(`/api/payroll-period/${period}`); } });
  const prepare = useMutation({ mutationFn: (action: string) => apiRequest(`/api/payroll-period/${period}/${action}`, "POST", {reason:reopenReason}), onSuccess: () => { queryClient.invalidateQueries({queryKey:["payroll-period"]}); queryClient.invalidateQueries({queryKey:["/api/monthly-closings"]}); queryClient.invalidateQueries({queryKey:["personnel-settlements"]}); toast({title:"Corte actualizado",description:"Revisá los pendientes y continuá al paso 2."}); }, onError:(error:Error)=>toast({title:"No se pudo actualizar",description:error.message,variant:"destructive"}) });

  const settlements = useQuery<any[]>({ queryKey: ["personnel-settlements", period], queryFn: async () => { return authFetchJson(`/api/finance/personnel-settlements?period=${period}`); }, refetchOnWindowFocus: false });
  const publishedIds = new Set((settlements.data ?? []).filter(row => row.settlement?.status === "published").map(row => row.person.id));

  const { data: personnel, isLoading: personnelLoading } = useQuery<any[]>({ queryKey: ["/api/personnel"] });
  const { data: closings, isLoading: closingsLoading } = useQuery<any[]>({
    queryKey: ["/api/monthly-closings", year, month + 1],
    queryFn: () => authFetchJson(`/api/monthly-closings?year=${year}&month=${month + 1}`),
  });
  const { data: declarations = [], refetch: refetchDeclarations } = useQuery<any[]>({ queryKey: ["monthly-settlement-declarations"], queryFn: () => authFetchJson("/api/monthly-settlement-declarations") });
  const declarationReview = useMutation({ mutationFn: ({ id, action, reason, submittedAt }: { id: number; action: string; reason?: string; submittedAt: string }) => apiRequest(`/api/monthly-settlement-declarations/${id}`, "PATCH", { action, reason, submittedAt }), onSuccess: () => { refetchDeclarations(); toast({ title: "Declaración revisada" }); }, onError: (error: Error) => toast({ title: "No se pudo revisar", description: error.message, variant: "destructive" }) });
  // Real hours logged per person for the month (time_entries + task_time_entries)
  const { data: realHoursMap = {} } = useQuery<Record<number, number>>({
    queryKey: ["/api/monthly-closings/real-hours", year, month + 1],
    queryFn: () => authFetchJson(`/api/monthly-closings/real-hours?year=${year}&month=${month + 1}`),
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
    setHoursAdjustments(previous => ({ ...restored, ...Object.fromEntries(Object.entries(previous).filter(([id]) => dirtyAdjustmentIds.current.has(Number(id)))) }));
    setAdjustmentReasons(previous => ({ ...Object.fromEntries(closings.map((c: any) => [c.personnelId, c.notes || ""])), ...Object.fromEntries(Object.entries(previous).filter(([id]) => dirtyAdjustmentIds.current.has(Number(id)))) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closings]);

  const closeMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/monthly-closings", "POST", data),
    onSuccess: (_data, variables) => {
      dirtyAdjustmentIds.current.delete(variables.personnelId);
      queryClient.invalidateQueries({ queryKey: ["/api/monthly-closings"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-settlements"] });
      setExpandedAdj(null);
      toast({ title: "Base guardada", description: "En el paso 2 podés guardar las condiciones o publicarlas anticipadamente. Las horas siguen abiertas hasta el corte general." });
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

  // The base is expressed in ARS; invoice FX belongs to the next step.
  const getBaseRateARS = (person: any): number | null => {
    const closing = getClosing(person.id);
    if (closing?.adjustedHours > 0) return Number(closing.grandTotalARS ?? closing.totalCost) / closing.adjustedHours;
    const selected = year * 100 + month + 1;
    const historical = [...(person.historicalRates ?? [])].filter((r: any) => r.year*100+r.month <= selected).sort((a:any,b:any) => (b.year*100+b.month)-(a.year*100+a.month))[0];
    return Number(historical?.hourlyRateARS) > 0 ? Number(historical.hourlyRateARS) : null;
  };
  const getAdj = (personnelId: number): HoursAdj =>
    hoursAdjustments[personnelId] ?? { unpaidHours: 0 };

  const setAdj = (personnelId: number, field: keyof HoursAdj, value: string) => {
    dirtyAdjustmentIds.current.add(personnelId);
    const parsed = parseFloat(value);
    const v = isNaN(parsed) ? 0 : parsed;
    setHoursAdjustments(prev => ({ ...prev, [personnelId]: { ...getAdj(personnelId), [field]: v } }));
  };

  const resetAdj = (personnelId: number) => {
    dirtyAdjustmentIds.current.add(personnelId);
    setHoursAdjustments(prev => ({ ...prev, [personnelId]: { unpaidHours: 0 } }));
    setAdjustmentReasons(prev => ({ ...prev, [personnelId]: "" }));
  };

  const hasAdjustment = (id: number) => getAdj(id).unpaidHours > 0;
  const effectiveBaseHours = (person: any): number => Math.max(0, defaultBaseHours(person) - getAdj(person.id).unpaidHours);
  const effectiveHours = (person: any): number => person.contractType === "freelance" ? realHoursMap[person.id] ?? 0 : effectiveBaseHours(person);

  const doClose = (person: any) => {
    const hrs = effectiveHours(person);
    const rate = getBaseRateARS(person) ?? 0;
    const manualAdjustments = hoursAdjustments[person.id];
    const adjustments = manualAdjustments || { unpaidHours: 0 };
    try { payableMonthlyHours(person, realHoursMap[person.id] ?? 0, adjustments.unpaidHours, adjustmentReasons[person.id] || ""); }
    catch (error) { toast({ title: "Revisá el descuento", description: (error as Error).message, variant: "destructive" }); return; }
    const totalCost = hrs * rate;
    setClosingPersonnelId(person.id);
    closeMutation.mutate({
      personnelId: person.id,
      year,
      month: month + 1,
      actualHours: realHoursMap[person.id] ?? hrs,
      adjustedHours: hrs,
      hourlyRate: rate,
      totalCost,
      exchangeRateAtClose: null,
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
  const baseAmountARS = (person: any): number | null => {
    const closing = getClosing(person.id);
    if (closing) return Number(closing.grandTotalARS ?? closing.totalCost);
    const rate = getBaseRateARS(person);
    return rate == null ? null : Math.round(effectiveHours(person) * rate * 100) / 100;
  };
  const getCostDisplay = (person: any) => {
    const total = baseAmountARS(person);
    return { primary: total == null ? "Pendiente de preparar" : `ARS ${total.toLocaleString("es-AR", {minimumFractionDigits:2, maximumFractionDigits:2})}`, secondary: null };
  };
  const getRateDisplay = (person: any) => {
    const rate = getBaseRateARS(person);
    return { text: rate == null ? "Pendiente" : `ARS ${rate.toLocaleString("es-AR", {minimumFractionDigits:2, maximumFractionDigits:2})}`, isEstimated: false };
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
    "Valor Hora ARS", "Base a cobrar ARS", "Estado",
  ];
  const buildExportRows = (): (string | number)[][] => {
    return filteredPersonnel.map((p: any) => {
      const closing = getClosing(p.id);
      const baseHrs = closing ? closing.adjustedHours : effectiveHours(p);
      const realHrs = realHoursMap[p.id] ?? 0;
      const billing = getBillingCurrency(p);
      const rate = getBaseRateARS(p);
      const total = baseAmountARS(p);
      return [
        p.name,
        p.contractType || "full-time",
        billing === "mixed" ? "Mixto" : billing,
        Math.round(baseHrs * 100) / 100,
        Math.round(realHrs * 100) / 100,
        rate == null ? "Pendiente" : Math.round(rate * 100) / 100,
        total == null ? "Pendiente" : total,
        publishedIds.has(p.id) ? "Publicada" : closing ? "Base guardada" : "Pendiente",
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

  const hasUnsavedChanges = Object.keys(hoursAdjustments).some(pid => {
    const id = Number(pid), saved = getClosing(id);
    return getAdj(id).unpaidHours !== Number(saved?.adjustments?.unpaidHours ?? 0) || (getAdj(id).unpaidHours > 0 && (adjustmentReasons[id] || "") !== (saved?.notes || ""));
  });

  useEffect(() => { onDirtyChange(hasUnsavedChanges); }, [hasUnsavedChanges, onDirtyChange]);

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
    <div className="min-w-0 space-y-5">
      <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">Corte de horas</p><Badge variant="outline">{cutoff.data?.state === "cut" ? "Horas con corte" : "Horas abiertas"}</Badge></div>
        <p className="text-sm text-muted-foreground">{cutoff.data?.day ? format(new Date(`${cutoff.data.day}T12:00:00`), "d 'de' MMMM", {locale:es}) : "Cargando fecha…"} · 23:59, Buenos Aires. En esa fecha Mind congela las horas y prepara los borradores. Guardar una base no ejecuta el corte; podés habilitar la facturación anticipada por persona desde el paso 2.</p>
        {cutoff.isError && <p role="alert" className="text-sm text-destructive">No se pudo cargar el corte. Actualizá la página antes de continuar.</p>}
        {cutoff.data?.issues?.map((issue:string)=><p key={issue} className="text-sm text-amber-800">{issue}</p>)}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"><Button disabled={prepare.isPending || cutoff.isError || hasUnsavedChanges} onClick={()=>prepare.mutate("prepare")}>{prepare.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Preparar bases y borradores</Button>{cutoff.data?.state !== "cut" && <Button variant="outline" disabled={prepare.isPending || !cutoff.data?.canCut} onClick={()=>prepare.mutate("cut")}>Realizar corte general</Button>}</div>
        {cutoff.data?.state === "cut" && (publishedIds.size > 0 ? <p className="text-xs text-muted-foreground">Las bases publicadas están protegidas. La facturación continúa en el paso 2.</p> : <details><summary className="cursor-pointer text-sm font-medium">Corregir horas antes de publicar</summary><div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input aria-label="Motivo de reapertura" value={reopenReason} onChange={e=>setReopenReason(e.target.value)} placeholder="Motivo de la corrección"/><Button variant="outline" disabled={prepare.isPending || reopenReason.trim().length < 5} onClick={()=>prepare.mutate("reopen")}>Reabrir horas</Button></div></details>)}
      </div>
      {/* Re-close confirmation dialog */}
      <AlertDialog open={reCloseTarget !== null} onOpenChange={(open) => { if (!open) setReCloseTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Actualizar la base?</AlertDialogTitle>
            <AlertDialogDescription>
              Se actualizará la base de <strong>{reCloseTarget?.name}</strong> con la tarifa vigente y los descuentos sin goce que hayas indicado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReCloseConfirm}>Actualizar base</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved changes banner */}
      {hasUnsavedChanges && (
        <div className="rounded-md border border-yellow-400 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          Tenés un descuento sin guardar. Abrí las horas de la persona y guardá su base para aplicarlo.
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold">Bases del equipo</h2>
          <p className="text-muted-foreground">
            Fijos: horas contractuales × tarifa. Freelancers: horas trabajadas × tarifa. Las ausencias pagas no descuentan.{" "}
            <Link href="/admin" className="inline-flex items-center gap-1 text-primary hover:underline text-sm">
              Gestionar tarifas en Personal <ExternalLink className="h-3 w-3" />
            </Link>
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
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
            <SelectTrigger aria-label="Tipo de contrato" className="w-full sm:w-56"><SelectValue placeholder="Tipo de contrato" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los contratos</SelectItem>
              <SelectItem value="full-time">Full-time</SelectItem>
              <SelectItem value="part-time">Part-time</SelectItem>
              <SelectItem value="freelance">Freelance (por hora)</SelectItem>
            </SelectContent>
          </Select>

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
            <table className="block w-full text-sm md:table md:min-w-[1100px]">
              <thead className="hidden md:table-header-group">
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Persona</th>
                  <th className="text-center py-2 px-3">Contrato</th>
                  <th className="text-center py-2 px-3">Facturación</th>
                  <th className="text-center py-2 px-3">Hs Base</th>
                  <th className="text-center py-2 px-3">Hs Reales</th>
                  <th className="text-center py-2 px-3">Valor Hora</th>
                  <th className="text-center py-2 px-3">Base a cobrar ARS</th>
                  <th className="text-center py-2 px-3">Estado</th>
                  <th className="text-center py-2 px-3">Acción</th>
                </tr>
              </thead>
              <tbody className="grid gap-4 md:table-row-group">
                {filteredPersonnel.map((p: any) => {
                  const closing = getClosing(p.id);
                  const baseHrs = closing ? closing.adjustedHours : effectiveHours(p);
                  const cost = getCostDisplay(p);
                  const billing = getBillingCurrency(p);
                  const isPublished = publishedIds.has(p.id);
                  const isRowPending = closingPersonnelId === p.id && closeMutation.isPending;
                  return (
                    <tr key={p.id} className="grid grid-cols-2 gap-x-2 rounded-xl border p-2 md:table-row md:rounded-none md:border-x-0 md:border-t-0 md:p-0 hover:bg-muted/30">
                      <td data-label="Persona" className="flex min-w-0 flex-col items-start gap-1 py-2 px-3 before:text-left before:text-xs before:font-normal before:text-muted-foreground before:content-[attr(data-label)] md:table-cell md:before:hidden md:whitespace-nowrap col-span-2 font-medium">{p.name}</td>
                      <td data-label="Contrato" className="flex min-w-0 flex-col items-start gap-1 py-2 px-3 before:text-left before:text-xs before:font-normal before:text-muted-foreground before:content-[attr(data-label)] md:table-cell md:before:hidden md:whitespace-nowrap md:text-center">
                        {p.contractType || "full-time"}
                      </td>
                      <td data-label="Facturación" className="flex min-w-0 flex-col items-start gap-1 py-2 px-3 before:text-left before:text-xs before:font-normal before:text-muted-foreground before:content-[attr(data-label)] md:table-cell md:before:hidden md:whitespace-nowrap md:text-center">
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
                      <td data-label="Horas base" className="flex min-w-0 flex-col items-start gap-1 py-2 px-3 before:text-left before:text-xs before:font-normal before:text-muted-foreground before:content-[attr(data-label)] md:table-cell md:before:hidden md:whitespace-nowrap md:text-center">
                        {(p.contractType || "full-time").toLowerCase() === "freelance" ? (
                          // Freelance: horas reales trabajadas, sin ajustes de horas base (no aplica).
                          <span className="text-sm font-medium" title="Cálculo lineal por horas reales trabajadas">
                            {baseHrs}h <span className="text-[10px] text-muted-foreground">(real)</span>
                          </span>
                        ) : (
                        <div className="relative">
                          <button
                            className={`flex items-center gap-1 justify-center md:mx-auto text-sm font-medium hover:text-primary transition-colors ${hasAdjustment(p.id) ? "text-amber-700" : ""}`}
                            disabled={isPublished}
                            aria-label={`Ajustar base de ${p.name}`}
                            title={isPublished ? "Base publicada: protegida contra cambios" : "Sólo se descuentan licencias sin goce"}
                            onClick={() => setExpandedAdj(prev => prev === p.id ? null : p.id)}
                          >
                            {baseHrs}h
                            {hasAdjustment(p.id) && (
                              <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600 px-1 py-0">Aj.</Badge>
                            )}
                            <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${expandedAdj === p.id ? "rotate-180" : ""}`} />
                          </button>
                          {expandedAdj === p.id && (
                            <Dialog open onOpenChange={open => { if (!open) setExpandedAdj(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md space-y-3"><DialogTitle>Descuento excepcional · {p.name}</DialogTitle><DialogDescription>La base sólo se reduce por una licencia sin goce de sueldo acordada.</DialogDescription>
                              <div className="text-[10px] text-muted-foreground mb-1" title="Las horas base surgen de las Horas Mensuales configuradas en Admin → Personal (o 160 full-time / 120 part-time por defecto). Sólo se descuentan licencias sin goce explícitas.">
                                Base contractual: {defaultBaseHours(p)}h <span className="underline decoration-dotted">(de Admin → Personal)</span>
                              </div>
                              <p className="rounded bg-emerald-50 p-2 text-emerald-800">Vacaciones, feriados y días Epical son pagos. No reducen esta base.</p>
                              <label className="block">Horas de licencia sin goce
                                <Input disabled={isRowPending} type="number" min="0" max={defaultBaseHours(p)} step="0.5" value={getAdj(p.id).unpaidHours || ""} onChange={(e) => setAdj(p.id, "unpaidHours", e.target.value)} placeholder="0" />
                              </label>
                              <label className="block">Motivo del descuento
                                <Input disabled={isRowPending} value={adjustmentReasons[p.id] || ""} onChange={(e) => { dirtyAdjustmentIds.current.add(p.id); setAdjustmentReasons(prev => ({ ...prev, [p.id]: e.target.value })); }} placeholder="Licencia sin goce acordada…" />
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
                              <Button disabled={isRowPending} onClick={() => doClose(p)}>{isRowPending ? "Guardando…" : "Guardar base"}</Button>
                            </DialogContent></Dialog>
                          )}
                        </div>
                        )}
                      </td>
                      <td data-label="Horas reales" className="flex min-w-0 flex-col items-start gap-1 py-2 px-3 before:text-left before:text-xs before:font-normal before:text-muted-foreground before:content-[attr(data-label)] md:table-cell md:before:hidden md:whitespace-nowrap md:text-center">
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
                      <td data-label="Valor hora" className="flex min-w-0 flex-col items-start gap-1 py-2 px-3 before:text-left before:text-xs before:font-normal before:text-muted-foreground before:content-[attr(data-label)] md:table-cell md:before:hidden md:whitespace-nowrap md:text-center">
                        {(() => {
                          const { text, isEstimated } = getRateDisplay(p);
                          return (
                            <span className={isEstimated ? "text-blue-600" : ""} title={isEstimated ? "Tarifa histórica estimada por falta de dato del período" : "Tarifa histórica de personal"}>
                              {text}{isEstimated && " *"}
                            </span>
                          );
                        })()}
                      </td>
                      <td data-label="Base a cobrar" className="flex min-w-0 flex-col items-start gap-1 py-2 px-3 before:text-left before:text-xs before:font-normal before:text-muted-foreground before:content-[attr(data-label)] md:table-cell md:before:hidden md:whitespace-nowrap md:text-center">
                        <div>{cost.primary}</div>
                        {cost.secondary && (
                          <div className="text-xs text-muted-foreground font-normal">{cost.secondary}</div>
                        )}
                      </td>
                      <td data-label="Estado" className="flex min-w-0 flex-col items-start gap-1 py-2 px-3 before:text-left before:text-xs before:font-normal before:text-muted-foreground before:content-[attr(data-label)] md:table-cell md:before:hidden md:whitespace-nowrap md:text-center">
                        {closing ? (
                          <div className="flex flex-col items-start gap-0.5 md:items-center">
                            <span className="text-green-600 flex items-center gap-1 text-xs font-medium">
                              <Check className="h-3.5 w-3.5" /> Base guardada
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
                      <td data-label="Acción" className="flex min-w-0 flex-col items-start gap-1 py-2 px-3 before:text-left before:text-xs before:font-normal before:text-muted-foreground before:content-[attr(data-label)] md:table-cell md:before:hidden md:whitespace-nowrap col-span-2 md:text-center">
                        <Button
                          size="sm"
                          variant={closing ? "outline" : "default"}
                          onClick={() => handleClose(p)}
                          disabled={isRowPending || isPublished}
                        >
                          {isRowPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : isPublished ? (
                            "Publicada"
                          ) : closing ? (
                            "Actualizar base"
                          ) : (
                            "Guardar base"
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
