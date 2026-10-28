import { calculatePersonnelSettlement } from "@shared/utils/personnel-settlement";
import { settlementWorkflow, type SettlementWorkflow, type SettlementPhase } from "@shared/utils/settlement-workflow";
import { calculateSettlementDifference } from "@shared/utils/monthly-settlement-declaration";
import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Calculator, Check, CheckCircle2, FileText, Loader2, ShieldCheck, UploadCloud, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { authFetch, authFetchJson } from "@/lib/queryClient";

type InvoiceComponent = "single" | "usd" | "ars";
type InvoiceRow = {
  id: number;
  period: string;
  invoiceComponent: InvoiceComponent;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  hoursTotal: number | null;
  notes: string | null;
  uploadedAt: string;
  invoiceNumber?: string | null;
  issueDate?: string | null;
  invoiceCurrency?: "ARS" | "USD" | null;
  declaredInvoiceAmount?: number | null;
  approvalStatus?: "pending" | "approved" | "rejected";
  reviewReason?: string | null;
  documents?: Array<{ index: number; fileName: string; fileSize: number; mimeType: string; fileUrl: string }>;
};
type Settlement = {
  id: number;
  period: string;
  billingCurrencySnapshot: string;
  hoursSnapshot: number;
  hourlyRateARSSnapshot: number;
  totalARS: number;
  usdPercentage: number;
  plannedUSDARS: number;
  bonusUSD: number;
  bonusARS: number;
  workflow: SettlementWorkflow;
  extrasARS: number;
  invoiceFx: number | null;
  baseInvoiceUSD: number | null;
  totalInvoiceUSD: number | null;
  receivedFx: number | null;
  bankCommissionUSD: number;
  pesifiedBaseARS: number | null;
  finalInvoiceARS: number | null;
  adminNotes: string | null;
};
type MonthSummary = {
  period: string;
  personnelId: number | null;
  hours: number;
  grandTotalARS?: number;
  grandTotalUSD?: number;
  isClosed?: boolean;
  entryCount: number;
};

const STATUS = {
  pending: { label: "En revisión", className: "border-amber-200 bg-amber-50 text-amber-800" },
  approved: { label: "Aprobada · registrada en Pasivo", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  rejected: { label: "Requiere corrección", className: "border-rose-200 bg-rose-50 text-rose-800" },
} as const;

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
function money(value: number | null | undefined, currency: "ARS" | "USD") {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat(currency === "ARS" ? "es-AR" : "en-US", { style: "currency", currency, currencyDisplay: currency === "USD" ? "code" : "symbol", maximumFractionDigits: 2 }).format(Number(value));
}
function periodLabel(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

export default function MyInvoices() {
  const [period, setPeriod] = useState(() => { const saved = new URLSearchParams(window.location.search).get("period"); return saved && /^\d{4}-(0[1-9]|1[0-2])$/.test(saved) ? saved : currentPeriod(); });
  useEffect(() => { const url = new URL(window.location.href); url.searchParams.set("period", period); window.history.replaceState(window.history.state, "", url); }, [period]);
  const [invoiceFx, setInvoiceFx] = useState("");
  const [receivedFx, setReceivedFx] = useState("");
  const [bankCommissionUSD, setBankCommissionUSD] = useState("0");
  const [extrasARS, setExtrasARS] = useState("0");
  const [extrasReason, setExtrasReason] = useState("");
  const [receivedConfirmed, setReceivedConfirmed] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const invoicesQuery = useQuery<InvoiceRow[]>({ queryKey: ["personal-invoices"], refetchInterval: 30000, queryFn: () => authFetchJson("/api/me/invoices") });
  const summaryQuery = useQuery<MonthSummary | null>({ queryKey: ["personal-invoice-summary", period], queryFn: () => authFetchJson(`/api/me/invoices/summary?period=${period}`) });
  const settlementQuery = useQuery<Settlement | null>({ queryKey: ["personal-settlement", period], refetchInterval: 30000, queryFn: () => authFetchJson(`/api/me/invoices/settlement?period=${period}`) });
  const settlement = settlementQuery.data ?? null;
  const summary = summaryQuery.data ?? null;
  const periodInvoices = useMemo(() => (invoicesQuery.data ?? []).filter((item) => item.period === period), [invoicesQuery.data, period]);
  const invoiceFor = (component: InvoiceComponent) => periodInvoices.find((item) => (item.invoiceComponent ?? "single") === component) ?? null;
  const billing = settlement?.billingCurrencySnapshot?.toUpperCase() ?? "";
  const isMixed = billing !== "ARS";
  const usesUSD = Number(settlement?.usdPercentage ?? 0) > 0 || Number(settlement?.bonusUSD ?? 0) > 0;
  const flow = settlementWorkflow(settlement?.workflow);
  const complete = Boolean(settlement) && ([...(usesUSD ? ["usd"] : []), "ars"] as SettlementPhase[]).every(phase => flow[phase].status === "approved" && (flow[phase].amount === 0 || periodInvoices.some(i => i.invoiceCurrency === phase.toUpperCase() && i.approvalStatus === "approved")));
  const usdDocumentApproved = periodInvoices.some(i => i.invoiceCurrency === "USD" && i.approvalStatus === "approved");

  useEffect(() => {
    setInvoiceFx(settlement?.invoiceFx == null ? "" : String(settlement.invoiceFx));
    setReceivedFx(settlement?.receivedFx == null ? "" : String(settlement.receivedFx));
    setBankCommissionUSD(String(settlement?.bankCommissionUSD ?? 0));
    setExtrasARS(String(settlement?.workflow?.extrasARS ?? 0));
    setExtrasReason(settlement?.workflow?.extrasReason ?? "");
    setReceivedConfirmed(Boolean(settlement?.workflow?.receivedConfirmed));
  }, [settlement?.id, settlement?.invoiceFx, settlement?.receivedFx, settlement?.bankCommissionUSD, settlement?.workflow?.version, period]);

  const settlementMutation = useMutation({
    mutationFn: (phase: SettlementPhase) => authFetchJson("/api/me/invoices/settlement", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: settlement?.id, version: flow.version, phase, action: "submit", invoiceFx, receivedFx, receivedConfirmed, bankCommissionUSD, extrasARS, extrasReason }),
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["personal-settlement", period] }); toast({ title: "Enviado a Operaciones", description: "Esperá la autorización antes de emitir la factura. El estado se actualiza acá." }); },
    onError: (error: Error) => toast({ title: "Revisá los datos", description: error.message, variant: "destructive" }),
  });
  const preview = settlement ? calculatePersonnelSettlement({ ...settlement, invoiceFx: Number(invoiceFx), receivedFx: Number(receivedFx), bankCommissionUSD: Number(bankCommissionUSD), extrasARS: settlement.extrasARS + Number(extrasARS) }) : null;
  const phaseCard = (phase: SettlementPhase) => {
    if (!settlement) return null;
    const stage = flow[phase];
    const isUSD = phase === "usd";
    const canEdit = stage.status === "draft" || stage.status === "rejected";
    const ready = isUSD || !usesUSD || usdDocumentApproved;
    const amount = canEdit ? isUSD ? preview?.totalInvoiceUSD : preview?.finalInvoiceARS : stage.amount;
    const component: InvoiceComponent = isMixed ? phase : "single";
    const label = isUSD ? "1. Factura en dólares" : usesUSD ? "2. Después de recibir los USD" : "Tu factura en pesos";
    return <Card key={phase} className={stage.status === "approved" ? "border-emerald-300" : ""}><CardHeader><CardTitle className="text-base">{label}</CardTitle><p className="text-sm text-muted-foreground">{isUSD ? "Ingresá el tipo de cambio comprador más bajo de tu banco del día en que vas a facturar." : usesUSD ? "Confirmá que recibiste el dinero e ingresá el TC comprador más bajo de tu banco de ese día." : "Tu importe base ya está calculado. Agregá extras sólo si corresponde."}</p></CardHeader><CardContent className="space-y-4">
      {!ready && <Notice tone="info" title="Primero completá la factura USD" text="Este paso se habilita después de que Administración apruebe tu comprobante USD y recibas el dinero." />}
      {stage.reason && <Notice tone="warning" title="Operaciones pidió una corrección" text={stage.reason} />}
      {canEdit && ready && (isUSD ? <div className="max-w-md space-y-1.5"><Label htmlFor="invoice-fx">TC de mi banco al facturar (ARS por USD)</Label><Input id="invoice-fx" type="number" min="0.01" step="0.01" value={invoiceFx} onChange={e => setInvoiceFx(e.target.value)} placeholder="Ej. 1500" /></div> : <div className="grid gap-4 sm:grid-cols-2">
        {usesUSD && <>
          <label className="flex items-start gap-2 rounded-lg border bg-muted/20 p-3 text-sm sm:col-span-2"><input className="mt-0.5 h-4 w-4 shrink-0" type="checkbox" checked={receivedConfirmed} onChange={e => setReceivedConfirmed(e.target.checked)} />Ya recibí los USD en mi cuenta</label>
          <div className="space-y-1.5"><Label htmlFor="received-fx">TC de mi banco al recibir (ARS por USD)</Label><Input id="received-fx" type="number" min="0.01" step="0.01" value={receivedFx} onChange={e => setReceivedFx(e.target.value)} placeholder="Ej. 1505" /></div>
          <div className="space-y-1.5"><Label htmlFor="bank-fee">Comisión en USD (opcional)</Label><Input id="bank-fee" type="number" min="0" step="0.01" value={bankCommissionUSD} onChange={e => setBankCommissionUSD(e.target.value)} /></div>
        </>}
        <div className="space-y-1.5"><Label htmlFor="extras-ars">Extras en ARS</Label><Input id="extras-ars" type="number" min="0" step="0.01" value={extrasARS} onChange={e => setExtrasARS(e.target.value)} /><p className="text-xs text-muted-foreground">Comisiones, monotributo u otros reintegros.</p></div>
        <div className="space-y-1.5"><Label htmlFor="extras-reason">Detalle de los extras</Label><Textarea id="extras-reason" value={extrasReason} onChange={e => setExtrasReason(e.target.value)} placeholder="Concepto e importe de cada reintegro" /><p className="text-xs text-muted-foreground">Obligatorio cuando hay extras o comisión.</p></div>
      </div>)}
      <Summary label={stage.status === "approved" ? "Importe autorizado" : "Importe calculado"} value={money(amount, isUSD ? "USD" : "ARS")} detail={isUSD ? "Tramo base ÷ TC + bono USD" : usesUSD ? "Total base − USD base al TC del cobro + bono ARS + extras" : "Base + bono ARS + extras"} />
      {canEdit && ready && <Button disabled={settlementMutation.isPending || amount == null || amount < 0 || (!isUSD && ((usesUSD && !receivedConfirmed) || Number(extrasARS) < 0 || Number(bankCommissionUSD) < 0 || ((Number(extrasARS) > 0 || Number(bankCommissionUSD) > 0) && extrasReason.trim().length < 5)))} onClick={() => settlementMutation.mutate(phase)}>Enviar importe a Operaciones</Button>}
      {amount != null && amount < 0 && <Notice tone="warning" title="Saldo negativo: requiere revisión" text="El valor de los USD recibidos supera el saldo. Operaciones debe resolver la diferencia antes de emitir." />}
      {stage.status === "pending" && <Notice tone="info" title="Esperando autorización de Operaciones" text="Todavía no emitas la factura. Cuando aprueben el importe vas a poder adjuntarla en este mismo lugar." />}
      {stage.status === "approved" && (Number(stage.amount) === 0 ? <Notice tone="info" title="Tramo completo: no requiere factura" text="Operaciones autorizó un saldo de cero." /> : <InvoiceUpload period={period} component={component} currency={isUSD ? "USD" : "ARS"} expected={Number(stage.amount)} existing={invoiceFor(component)} enabled onSaved={() => { queryClient.invalidateQueries({ queryKey: ["personal-invoices"] }); queryClient.invalidateQueries({ queryKey: ["personal-settlement", period] }); }} />)}
    </CardContent></Card>;
  };

  return <div className="mx-auto max-w-6xl min-w-0 space-y-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div>
      <p className="text-sm font-medium text-indigo-600">Espacio personal</p>
      <h1 className="text-3xl font-semibold tracking-tight">Mis facturas</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{settlement && !usesUSD ? "Revisá tu importe y agregá extras si corresponde, esperá la autorización de Operaciones y adjuntá tu factura en pesos." : "Completá el TC y los extras, esperá la autorización de Operaciones y adjuntá cada factura. Acá ves siempre el siguiente paso."}</p>
    </div><div className="w-full shrink-0 sm:w-48"><Label htmlFor="invoice-period">Mes trabajado</Label><Input id="invoice-period" className="mt-1.5" type="month" value={period} onChange={event => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) setPeriod(event.target.value); }} /></div></div>

    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Step number={1} label="Base a cobrar" detail="Importe del mes" done={Boolean(summary?.isClosed)} />
      <Step number={2} label="Condiciones" detail="Operaciones publica" done={Boolean(settlement)} />
      <Step number={3} label="Facturación" detail={usesUSD ? "USD y luego ARS" : "Factura en pesos"} active={Boolean(settlement)} />
      <Step number={4} label="Comprobantes" detail="Administración aprueba" done={complete} />
    </div>

    <details className="rounded-xl border p-4"><summary className="cursor-pointer text-sm font-medium">Ver base del mes y horas contractuales</summary><div className="mt-3 grid gap-3 sm:grid-cols-3">
      <Summary label="Horas de la base" value={`${Number(summary?.hours ?? 0).toFixed(1)} h`} detail="Las ausencias pagas no reducen las horas fijas" />
      <Summary label="Base ARS" value={money(summary?.grandTotalARS, "ARS")} detail="Antes de bonos y extras" />
      <Summary label="Referencia USD" value={money(summary?.grandTotalUSD, "USD")} detail="Cotización del cierre; tu TC bancario se carga abajo" />
    </div></details>
    {settlementQuery.isLoading && <p role="status" className="text-sm text-muted-foreground">Cargando tus condiciones…</p>}
    {(settlementQuery.isError || invoicesQuery.isError) && <Notice tone="danger" title="No pudimos cargar la información" text="Actualizá la página antes de continuar. Tus datos guardados se conservan." />}

    {!settlementQuery.isLoading && !settlementQuery.isError && !settlement && <Notice tone="warning" title="Esperando a Operaciones" text={`Todavía no publicaron tus condiciones de ${periodLabel(period)}. Cuando Operaciones las publique, acá se habilitará tu siguiente paso.`} />}
    {flow.publication?.beforeCut && <Notice tone="info" title="Condiciones publicadas antes del corte general" text="Tu base ya está fijada para facturar. Las horas operativas pueden seguir abiertas; las cargas posteriores no se agregan automáticamente a esta liquidación." />}
    {settlement?.adminNotes && <Notice tone="info" title="Indicación de Operaciones" text={settlement.adminNotes} />}

    {settlement && <div className="space-y-4">{usesUSD && phaseCard("usd")}{phaseCard("ars")}</div>}

    <Card><CardHeader className="pb-3"><CardTitle className="text-base">Historial del período</CardTitle></CardHeader><CardContent className="space-y-3">{!periodInvoices.length ? <p className="py-4 text-sm text-muted-foreground">Todavía no enviaste facturas para este período.</p> : periodInvoices.map((invoice) => <InvoiceStatus key={invoice.id} invoice={invoice} />)}</CardContent></Card>
    <details><summary className="cursor-pointer text-sm text-muted-foreground">Declaraciones anteriores del cierre operativo</summary><MonthlyClosingDeclarations /></details>
  </div>;
}

type ClosingDeclarationRow = {
  closingId: number; year: number; month: number; billingCurrency: string;
  usdBillingFraction: number; amountUSD: number; amountARS: number; closingFxRate: number | null;
  declaration: null | { id: number; bankFxRate: number; differenceARS: number; status: string; reviewReason?: string | null; events?: Array<{ action: string; createdAt: string }> };
};

function MonthlyClosingDeclarations() {
  const { toast } = useToast();
  const client = useQueryClient();
  const query = useQuery<ClosingDeclarationRow[]>({ queryKey: ["my-monthly-settlement-declarations"], queryFn: () => authFetchJson("/api/me/monthly-settlement-declarations") });
  const [rates, setRates] = useState<Record<number, string>>({});
  const mutation = useMutation({
    mutationFn: ({ closingId, bankFxRate }: { closingId: number; bankFxRate: number }) => authFetchJson("/api/me/monthly-settlement-declarations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ closingId, bankFxRate }) }),
    onSuccess: () => { client.invalidateQueries({ queryKey: ["my-monthly-settlement-declarations"] }); toast({ title: "Declaración enviada a Operaciones" }); },
    onError: (error: Error) => toast({ title: "No se pudo enviar", description: error.message, variant: "destructive" }),
  });
  return <Card><CardHeader><CardTitle className="text-base">Conciliación del cierre operativo</CardTitle><p className="text-sm text-muted-foreground">El cierre original permanece fijo. Informá el tipo de cambio bancario para calcular la diferencia de tu tramo USD; Operaciones revisará la declaración.</p></CardHeader><CardContent className="space-y-3">{query.isLoading && <p className="text-sm text-muted-foreground">Cargando cierres…</p>}{query.isError && <p className="text-sm text-destructive">{query.error.message}</p>}{query.data?.filter((row) => row.amountUSD > 0 && row.declaration != null).map((row) => {
    const rate = Number(rates[row.closingId] ?? row.declaration?.bankFxRate ?? "");
    const difference = (() => { try { return calculateSettlementDifference(row.amountUSD, rate, Number(row.closingFxRate)); } catch { return null; } })();
    return <div key={row.closingId} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.2fr_auto] sm:items-end">
      <div><p className="text-xs text-muted-foreground">Período</p><p className="font-medium">{periodLabel(`${row.year}-${String(row.month).padStart(2, "0")}`)}</p></div>
      <Summary label="Tramo USD" value={money(row.amountUSD, "USD")} detail={`${Math.round(row.usdBillingFraction * 100)}% de la configuración`} />
      <Summary label="FX de cierre" value={row.closingFxRate ? row.closingFxRate.toLocaleString("es-AR") : "—"} detail="Referencia congelada" />
      <div><Label>FX recibido por banco</Label><Input disabled={row.declaration?.status === "approved"} type="number" min="0.01" step="0.01" value={rates[row.closingId] ?? (row.declaration?.bankFxRate ? String(row.declaration.bankFxRate) : "")} onChange={(event) => setRates({ ...rates, [row.closingId]: event.target.value })} /><p className="mt-1 text-xs text-muted-foreground">Diferencia: {difference == null ? "—" : money(difference, "ARS")}</p></div>
      {row.declaration && <Badge variant="outline">{row.declaration.status === "approved" ? "Aprobada" : row.declaration.status === "rejected" ? "Requiere corrección" : "Pendiente"}</Badge>}
      <Button disabled={difference == null || mutation.isPending || row.declaration?.status === "approved"} onClick={() => mutation.mutate({ closingId: row.closingId, bankFxRate: rate })}>{row.declaration?.status === "rejected" ? "Corregir y reenviar" : "Enviar"}</Button>
      {row.declaration?.reviewReason && <p className="text-xs text-rose-700 sm:col-span-2 xl:col-span-5">Respuesta de Operaciones: {row.declaration.reviewReason}</p>}
      {!!row.declaration?.events?.length && <p className="text-[11px] text-muted-foreground sm:col-span-2 xl:col-span-5">Historial: {row.declaration.events.map((event) => `${({ submitted: "Enviada", resubmitted: "Reenviada", approve: "Aprobada", reject: "Rechazada" } as Record<string, string>)[event.action] ?? event.action} · ${new Date(event.createdAt).toLocaleDateString("es-AR")}`).join(" → ")}</p>}
    </div>;
  })}{query.data?.filter((row) => row.amountUSD > 0 && row.declaration != null).length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay cierres con tramo USD para declarar.</p>}</CardContent></Card>;
}

function InvoiceUpload({ period, component, currency, expected, existing, enabled, onSaved }: { period: string; component: InvoiceComponent; currency: "ARS" | "USD"; expected: number; existing: InvoiceRow | null; enabled: boolean; onSaved: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const locked = existing?.approvalStatus === "approved";
  useEffect(() => {
    setInvoiceNumber(existing?.invoiceNumber ?? "");
    setIssueDate(existing?.issueDate?.slice(0, 10) ?? "");
    setAmount(existing?.declaredInvoiceAmount == null ? "" : String(existing.declaredInvoiceAmount));
    setNotes(existing?.notes ?? "");
    setFiles([]);
  }, [existing?.id, period, component]);
  const mutation = useMutation({
    mutationFn: async () => {
      if (!files.length) throw new Error("Adjuntá al menos un comprobante");
      const form = new FormData();
      files.forEach((file) => form.append("files", file));
      form.append("period", period);
      form.append("invoiceComponent", component);
      form.append("invoiceCurrency", currency);
      if (invoiceNumber.trim()) form.append("invoiceNumber", invoiceNumber.trim());
      if (issueDate) form.append("issueDate", issueDate);
      if (amount.trim()) form.append("invoiceAmount", amount);
      if (notes.trim()) form.append("notes", notes.trim());
      const response = await authFetch("/api/me/invoices", { method: "POST", body: form });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message ?? "No se pudo enviar la factura");
      return response.json();
    },
    onSuccess: () => { setFiles([]); if (input.current) input.current.value = ""; onSaved(); toast({ title: "Factura enviada a Administración", description: "La revisarán contra el importe publicado por Operaciones." }); },
    onError: (error: Error) => toast({ title: "No se pudo enviar", description: error.message, variant: "destructive" }),
  });
  function accept(candidates: File[]) {
    const next = candidates.slice(0, 10);
    if (next.some((file) => !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type))) return toast({ title: "Formato no admitido", description: "Usá PDF, JPG, PNG o WEBP.", variant: "destructive" });
    if (next.some((file) => file.size > 20 * 1024 * 1024)) return toast({ title: "Archivo demasiado grande", description: "El máximo es 20 MB por archivo.", variant: "destructive" });
    setFiles((current) => [...current, ...next].slice(0, 10));
  }
  function drop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setDragging(false); accept(Array.from(event.dataTransfer.files)); }
  function paste(event: ClipboardEvent<HTMLDivElement>) { const file = Array.from(event.clipboardData.items).find((item) => item.kind === "file")?.getAsFile(); if (file) { event.preventDefault(); accept([file]); } }
  if (locked && existing) return <InvoiceStatus invoice={existing} />;
  const uploadForm = <div className="space-y-4" onPaste={paste}>
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">Adjuntar {component === "usd" ? "factura USD" : component === "ars" ? "factura ARS" : "factura"}</p><p className="text-xs text-muted-foreground">Importe esperado: {money(expected, currency)}. Mind intentará leer el importe real del archivo.</p></div>{existing?.approvalStatus && <Badge variant="outline" className={STATUS[existing.approvalStatus].className}>{STATUS[existing.approvalStatus].label}</Badge>}</div>
    {existing?.approvalStatus === "rejected" && <Notice tone="danger" title="Administración pidió una corrección" text={existing.reviewReason || "Revisá el comprobante y volvé a enviarlo."} />}
    <div className="grid items-end gap-3 sm:grid-cols-3"><div><Label htmlFor={`invoice-number-${component}`}>Número <span className="font-normal text-muted-foreground">(opcional)</span></Label><Input className="mt-1.5" id={`invoice-number-${component}`} value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} disabled={locked} /></div><div><Label htmlFor={`invoice-date-${component}`}>Fecha de emisión</Label><Input id={`invoice-date-${component}`} className="mt-1.5" type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} disabled={locked} /></div><div><Label htmlFor={`invoice-amount-${component}`}>Importe real <span className="font-normal text-muted-foreground">(si Mind no lo lee)</span></Label><Input className="mt-1.5" type="number" min="0" step="0.01" id={`invoice-amount-${component}`} value={amount} onChange={(event) => setAmount(event.target.value)} disabled={locked} placeholder={String(expected || "")} /></div></div>
    <div className={`rounded-xl border-2 border-dashed p-6 text-center ${dragging ? "border-indigo-500 bg-indigo-50" : files.length ? "border-emerald-300 bg-emerald-50" : "border-slate-200"}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>{files.length ? <><CheckCircle2 className="mx-auto h-7 w-7 text-emerald-600" /><p className="mt-1 text-sm font-medium">{files.length} archivo{files.length === 1 ? "" : "s"} listo{files.length === 1 ? "" : "s"}</p><div className="mt-2 space-y-1">{files.map((file, index) => <div key={`${file.name}-${index}`} className="mx-auto flex max-w-lg items-center justify-between rounded border bg-white px-3 py-1.5 text-xs"><span className="truncate">{file.name}</span><Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label={`Quitar ${file.name}`} onClick={() => setFiles((current) => current.filter((_, item) => item !== index))}><X className="h-3 w-3" /></Button></div>)}</div></> : <><UploadCloud className="mx-auto h-7 w-7 text-indigo-500" /><p className="mt-1 text-sm font-medium">Arrastrá el PDF o pegá una captura con ⌘V</p></>}<Button className="mt-3" size="sm" variant="outline" disabled={locked} onClick={() => input.current?.click()}>{files.length ? "Agregar archivo" : "Elegir comprobante"}</Button><input ref={input} className="hidden" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(event) => { accept(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} /></div>
    <div><Label htmlFor={`invoice-notes-${component}`}>Aclaración <span className="font-normal text-muted-foreground">(opcional)</span></Label><Textarea id={`invoice-notes-${component}`} className="mt-1.5" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} disabled={locked} /></div>
    <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="flex max-w-2xl items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />Al aprobarla, Administración crea el Pasivo en el mes de emisión. El costo del equipo y los proyectos no cambian.</p><Button disabled={!enabled || !files.length || locked || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}{existing ? "Reemplazar y reenviar" : "Enviar a Administración"}</Button></div>
  </div>;
  return existing?.approvalStatus === "pending" ? <div className="space-y-3"><InvoiceStatus invoice={existing} /><p className="text-sm text-muted-foreground">Administración está revisando tu comprobante. Te avisaremos si necesitás corregirlo.</p><details><summary className="cursor-pointer text-sm font-medium">Reemplazar comprobante enviado</summary><div className="mt-4">{uploadForm}</div></details></div> : uploadForm;
}

function InvoiceStatus({ invoice }: { invoice: InvoiceRow }) {
  const status = STATUS[invoice.approvalStatus ?? "pending"];
  return <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{invoice.invoiceComponent === "usd" ? "Factura USD" : invoice.invoiceComponent === "ars" ? "Factura ARS" : "Factura mensual"}</p><Badge variant="outline" className={status.className}>{status.label}</Badge></div><p className="mt-1 break-words text-xs text-muted-foreground">{invoice.invoiceNumber || invoice.fileName} · {money(invoice.declaredInvoiceAmount, invoice.invoiceCurrency ?? "ARS")}{invoice.issueDate ? ` · emitida ${new Date(invoice.issueDate).toLocaleDateString("es-AR")}` : ""}</p></div><div className="flex flex-wrap gap-2">{(invoice.documents ?? []).map((document, index) => <Button key={document.fileUrl} asChild size="sm" variant="outline"><a href={document.fileUrl} target="_blank" rel="noreferrer"><FileText className="mr-2 h-4 w-4" />{invoice.documents!.length > 1 ? `Archivo ${index + 1}` : "Ver factura"}</a></Button>)}</div></div>;
}
function Step({ number, label, detail, done = false, active = false }: { number: number; label: string; detail: string; done?: boolean; active?: boolean }) {
  return <div className={`flex min-w-0 flex-col items-start gap-2 rounded-xl border p-3 min-[380px]:flex-row min-[380px]:items-center sm:gap-3 sm:p-4 ${done ? "border-emerald-200 bg-emerald-50/40" : active ? "border-indigo-200" : "bg-slate-50/50"}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${done ? "bg-emerald-600 text-white" : active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}>{done ? <Check className="h-4 w-4" /> : number}</span><span className="min-w-0"><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-muted-foreground">{detail}</span></span></div>;
}
function Summary({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-xl border bg-slate-50/70 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words text-lg font-semibold tabular-nums">{value}</p><p className="text-[11px] text-muted-foreground">{detail}</p></div>; }
function Notice({ tone, title, text }: { tone: "danger" | "warning" | "info"; title: string; text: string }) { const styles = tone === "danger" ? "border-rose-200 bg-rose-50 text-rose-900" : tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-indigo-200 bg-indigo-50 text-indigo-950"; const Icon = tone === "info" ? ShieldCheck : AlertCircle; return <div className={`flex gap-3 rounded-xl border p-4 ${styles}`}><Icon className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="text-sm font-semibold">{title}</p><p className="text-xs opacity-80">{text}</p></div></div>; }
