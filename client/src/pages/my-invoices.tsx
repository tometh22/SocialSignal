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
  return new Intl.NumberFormat(currency === "ARS" ? "es-AR" : "en-US", { style: "currency", currency, maximumFractionDigits: currency === "ARS" ? 0 : 2 }).format(Number(value));
}
function periodLabel(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

export default function MyInvoices() {
  const [period, setPeriod] = useState(currentPeriod());
  const [invoiceFx, setInvoiceFx] = useState("");
  const [receivedFx, setReceivedFx] = useState("");
  const [bankCommissionUSD, setBankCommissionUSD] = useState("0");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const invoicesQuery = useQuery<InvoiceRow[]>({ queryKey: ["personal-invoices"], queryFn: () => authFetchJson("/api/me/invoices") });
  const summaryQuery = useQuery<MonthSummary | null>({ queryKey: ["personal-invoice-summary", period], queryFn: () => authFetchJson(`/api/me/invoices/summary?period=${period}`) });
  const settlementQuery = useQuery<Settlement | null>({ queryKey: ["personal-settlement", period], queryFn: () => authFetchJson(`/api/me/invoices/settlement?period=${period}`) });
  const settlement = settlementQuery.data ?? null;
  const summary = summaryQuery.data ?? null;
  const periodInvoices = useMemo(() => (invoicesQuery.data ?? []).filter((item) => item.period === period), [invoicesQuery.data, period]);
  const invoiceFor = (component: InvoiceComponent) => periodInvoices.find((item) => (item.invoiceComponent ?? "single") === component) ?? null;
  const billing = settlement?.billingCurrencySnapshot?.toUpperCase() ?? "";
  const isMixed = billing === "MIXED";

  useEffect(() => {
    setInvoiceFx(settlement?.invoiceFx == null ? "" : String(settlement.invoiceFx));
    setReceivedFx(settlement?.receivedFx == null ? "" : String(settlement.receivedFx));
    setBankCommissionUSD(String(settlement?.bankCommissionUSD ?? 0));
  }, [settlement?.id, settlement?.invoiceFx, settlement?.receivedFx, settlement?.bankCommissionUSD]);

  const settlementMutation = useMutation({
    mutationFn: (phase: "invoice" | "receipt") => authFetchJson("/api/me/invoices/settlement", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(phase === "invoice" ? { period, invoiceFx } : { period, receivedFx, bankCommissionUSD }),
    }),
    onSuccess: (_data, phase) => {
      queryClient.invalidateQueries({ queryKey: ["personal-settlement", period] });
      toast(phase === "invoice" ? { title: "Factura USD calculada", description: "Ya podés emitirla y enviarla sin esperar el segundo tramo." } : { title: "Diferencia ARS calculada", description: "Ya podés emitir y enviar la factura ARS." });
    },
    onError: (error: Error) => toast({ title: "No se pudo calcular", description: error.message, variant: "destructive" }),
  });

  const invoiceFxNumber = Number(invoiceFx) > 0 ? Number(invoiceFx) : null;
  const receivedFxNumber = Number(receivedFx) > 0 ? Number(receivedFx) : null;
  const previewBaseUSD = settlement && invoiceFxNumber ? settlement.plannedUSDARS / invoiceFxNumber : null;
  const previewTotalUSD = previewBaseUSD == null ? null : previewBaseUSD + Number(settlement?.bonusUSD ?? 0);
  const previewPesifiedARS = previewBaseUSD != null && receivedFxNumber ? previewBaseUSD * receivedFxNumber : null;
  const previewFinalARS = settlement && previewPesifiedARS != null && receivedFxNumber
    ? settlement.totalARS - previewPesifiedARS + settlement.extrasARS + (Number(bankCommissionUSD) || 0) * receivedFxNumber : null;
  const invoiceFxSaved = Boolean(settlement?.invoiceFx && settlement?.totalInvoiceUSD != null);
  const receivedFxSaved = Boolean(settlement?.receivedFx && settlement?.finalInvoiceARS != null);

  return <div className="mx-auto max-w-6xl space-y-6">
    <div>
      <p className="text-sm font-medium text-indigo-600">Espacio personal</p>
      <h1 className="text-3xl font-semibold tracking-tight">Mis facturas</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Operaciones calcula tu liquidación. Vos emitís cada factura en su momento y Administración la compara con el importe esperado antes de registrarla en Pasivo.</p>
    </div>

    <div className="grid gap-3 md:grid-cols-4">
      <Step number={1} label="Cierre operativo" detail="Costo del mes" done={Boolean(summary?.isClosed)} />
      <Step number={2} label="Liquidación" detail="Operaciones publica" done={Boolean(settlement)} />
      <Step number={3} label="Facturación" detail={isMixed ? "USD y luego ARS" : "Comprobante"} active={Boolean(settlement)} />
      <Step number={4} label="Pasivo" detail="Administración aprueba" done={periodInvoices.length > 0 && periodInvoices.every((invoice) => invoice.approvalStatus === "approved")} />
    </div>

    <Card><CardHeader className="pb-3"><CardTitle className="text-base">1. Período y referencia operativa</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-4">
      <div><Label htmlFor="invoice-period">Mes trabajado</Label><Input id="invoice-period" className="mt-1.5" type="month" value={period} onChange={(event) => setPeriod(event.target.value)} /></div>
      <Summary label="Horas cerradas" value={`${Number(summary?.hours ?? 0).toFixed(1)} h`} detail={`${summary?.entryCount ?? 0} registros`} />
      <Summary label="Costo operativo ARS" value={money(summary?.grandTotalARS, "ARS")} detail="Independiente de la factura" />
      <Summary label="Costo operativo USD" value={money(summary?.grandTotalUSD, "USD")} detail="Para Costos y rentabilidad" />
    </CardContent></Card>

    {!settlementQuery.isLoading && !settlement && <Notice tone="warning" title="Esperando a Operaciones" text={`Todavía no publicaron tu liquidación de ${periodLabel(period)}. El costo ya pertenece al cierre operativo, pero aún no hay una instrucción para facturar.`} />}
    {settlement?.adminNotes && <Notice tone="info" title="Indicación de Operaciones" text={settlement.adminNotes} />}

    {settlement && !isMixed && <Card><CardHeader><CardTitle className="text-base">2. Factura mensual</CardTitle><p className="text-sm text-muted-foreground">La factura alimenta Pasivo según su fecha de emisión. No modifica el costo operativo.</p></CardHeader><CardContent>
      <InvoiceUpload period={period} component="single" currency={billing === "USD" ? "USD" : "ARS"} expected={billing === "USD" ? Number(summary?.grandTotalUSD ?? 0) : settlement.totalARS} existing={invoiceFor("single")} enabled onSaved={() => queryClient.invalidateQueries({ queryKey: ["personal-invoices"] })} />
    </CardContent></Card>}

    {settlement && isMixed && <div className="space-y-4">
      <Card className={invoiceFxSaved ? "border-emerald-200" : "border-indigo-200"}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">A. Fin de mes: factura USD</CardTitle><p className="mt-1 text-sm text-muted-foreground">Cargá el TC comprador más bajo del banco. Mind calcula el importe y habilita la factura USD inmediatamente.</p></div><Badge variant="outline">{invoiceFxSaved ? "Importe confirmado" : "Hacer ahora"}</Badge></div></CardHeader><CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,280px)_1fr_1fr]"><div><Label htmlFor="invoice-fx">TC al facturar</Label><Input id="invoice-fx" className="mt-1.5" type="number" min="0" step="0.01" value={invoiceFx} onChange={(event) => setInvoiceFx(event.target.value)} /></div><Summary label="USD base" value={money(previewBaseUSD, "USD")} detail="Pesos del tramo ÷ TC" /><Summary label="Factura USD esperada" value={money(previewTotalUSD, "USD")} detail="Incluye extra USD informado" /></div>
        <Button disabled={!invoiceFxNumber || settlementMutation.isPending} onClick={() => settlementMutation.mutate("invoice")}>{settlementMutation.isPending && settlementMutation.variables === "invoice" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}{invoiceFxSaved ? "Actualizar cálculo USD" : "Confirmar TC y calcular USD"}</Button>
        {invoiceFxSaved && <div className="border-t pt-4"><InvoiceUpload period={period} component="usd" currency="USD" expected={Number(settlement.totalInvoiceUSD ?? 0)} existing={invoiceFor("usd")} enabled onSaved={() => queryClient.invalidateQueries({ queryKey: ["personal-invoices"] })} /></div>}
      </CardContent></Card>

      <Card className={!invoiceFxSaved ? "opacity-65" : receivedFxSaved ? "border-emerald-200" : "border-indigo-200"}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">B. Después del cobro: factura ARS</CardTitle><p className="mt-1 text-sm text-muted-foreground">Cuando recibas los USD, cargá el segundo TC y la comisión. Esta factura puede emitirse al comienzo del mes siguiente.</p></div><Badge variant="outline">{receivedFxSaved ? "Importe confirmado" : invoiceFxSaved ? "Siguiente paso" : "Esperá el paso A"}</Badge></div></CardHeader><CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div><Label htmlFor="received-fx">TC al cobrar</Label><Input id="received-fx" className="mt-1.5" type="number" min="0" step="0.01" value={receivedFx} onChange={(event) => setReceivedFx(event.target.value)} disabled={!invoiceFxSaved} /></div><div><Label htmlFor="bank-fee">Comisión bancaria USD</Label><Input id="bank-fee" className="mt-1.5" type="number" min="0" step="0.01" value={bankCommissionUSD} onChange={(event) => setBankCommissionUSD(event.target.value)} disabled={!invoiceFxSaved} /></div><Summary label="USD base pesificados" value={money(previewPesifiedARS, "ARS")} detail="USD base × segundo TC" /><Summary label="Factura ARS esperada" value={money(previewFinalARS, "ARS")} detail="Diferencia final" /></div>
        <Button disabled={!invoiceFxSaved || !receivedFxNumber || settlementMutation.isPending} onClick={() => settlementMutation.mutate("receipt")}>{settlementMutation.isPending && settlementMutation.variables === "receipt" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}{receivedFxSaved ? "Actualizar cálculo ARS" : "Confirmar cobro y calcular ARS"}</Button>
        {receivedFxSaved && <div className="border-t pt-4"><InvoiceUpload period={period} component="ars" currency="ARS" expected={Number(settlement.finalInvoiceARS ?? 0)} existing={invoiceFor("ars")} enabled onSaved={() => queryClient.invalidateQueries({ queryKey: ["personal-invoices"] })} /></div>}
      </CardContent></Card>
    </div>}

    <Card><CardHeader className="pb-3"><CardTitle className="text-base">Historial del período</CardTitle></CardHeader><CardContent className="space-y-3">{!periodInvoices.length ? <p className="py-4 text-sm text-muted-foreground">Todavía no enviaste facturas para este período.</p> : periodInvoices.map((invoice) => <InvoiceStatus key={invoice.id} invoice={invoice} />)}</CardContent></Card>
  </div>;
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
  return <div className="space-y-4" onPaste={paste}>
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">Adjuntar {component === "usd" ? "factura USD" : component === "ars" ? "factura ARS" : "factura"}</p><p className="text-xs text-muted-foreground">Importe esperado: {money(expected, currency)}. Mind intentará leer el importe real del archivo.</p></div>{existing?.approvalStatus && <Badge variant="outline" className={STATUS[existing.approvalStatus].className}>{STATUS[existing.approvalStatus].label}</Badge>}</div>
    {existing?.approvalStatus === "rejected" && <Notice tone="danger" title="Administración pidió una corrección" text={existing.reviewReason || "Revisá el comprobante y volvé a enviarlo."} />}
    <div className="grid gap-3 sm:grid-cols-3"><div><Label>Número <span className="font-normal text-muted-foreground">(opcional)</span></Label><Input className="mt-1.5" value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} disabled={locked} /></div><div><Label>Fecha de emisión</Label><Input className="mt-1.5" type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} disabled={locked} /></div><div><Label>Importe real <span className="font-normal text-muted-foreground">(si Mind no lo lee)</span></Label><Input className="mt-1.5" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={locked} placeholder={String(expected || "")} /></div></div>
    <div className={`rounded-xl border-2 border-dashed p-6 text-center ${dragging ? "border-indigo-500 bg-indigo-50" : files.length ? "border-emerald-300 bg-emerald-50" : "border-slate-200"}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>{files.length ? <><CheckCircle2 className="mx-auto h-7 w-7 text-emerald-600" /><p className="mt-1 text-sm font-medium">{files.length} archivo{files.length === 1 ? "" : "s"} listo{files.length === 1 ? "" : "s"}</p><div className="mt-2 space-y-1">{files.map((file, index) => <div key={`${file.name}-${index}`} className="mx-auto flex max-w-lg items-center justify-between rounded border bg-white px-3 py-1.5 text-xs"><span className="truncate">{file.name}</span><Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setFiles((current) => current.filter((_, item) => item !== index))}><X className="h-3 w-3" /></Button></div>)}</div></> : <><UploadCloud className="mx-auto h-7 w-7 text-indigo-500" /><p className="mt-1 text-sm font-medium">Arrastrá el PDF o pegá una captura con ⌘V</p></>}<Button className="mt-3" size="sm" variant="outline" disabled={locked} onClick={() => input.current?.click()}>{files.length ? "Agregar archivo" : "Elegir comprobante"}</Button><input ref={input} className="hidden" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(event) => { accept(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} /></div>
    <div><Label>Aclaración <span className="font-normal text-muted-foreground">(opcional)</span></Label><Textarea className="mt-1.5" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} disabled={locked} /></div>
    <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="flex max-w-2xl items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />Al aprobarla, Administración crea el Pasivo en el mes de emisión. El costo del equipo y los proyectos no cambian.</p><Button disabled={!enabled || !files.length || locked || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}{existing ? "Reemplazar y reenviar" : "Enviar a Administración"}</Button></div>
  </div>;
}

function InvoiceStatus({ invoice }: { invoice: InvoiceRow }) {
  const status = STATUS[invoice.approvalStatus ?? "pending"];
  return <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{invoice.invoiceComponent === "usd" ? "Factura USD" : invoice.invoiceComponent === "ars" ? "Factura ARS" : "Factura mensual"}</p><Badge variant="outline" className={status.className}>{status.label}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{invoice.invoiceNumber || invoice.fileName} · {money(invoice.declaredInvoiceAmount, invoice.invoiceCurrency ?? "ARS")}{invoice.issueDate ? ` · emitida ${new Date(invoice.issueDate).toLocaleDateString("es-AR")}` : ""}</p></div><div className="flex flex-wrap gap-2">{(invoice.documents ?? []).map((document, index) => <Button key={document.fileUrl} asChild size="sm" variant="outline"><a href={document.fileUrl} target="_blank" rel="noreferrer"><FileText className="mr-2 h-4 w-4" />{invoice.documents!.length > 1 ? `Archivo ${index + 1}` : "Ver factura"}</a></Button>)}</div></div>;
}
function Step({ number, label, detail, done = false, active = false }: { number: number; label: string; detail: string; done?: boolean; active?: boolean }) {
  return <div className={`flex items-center gap-3 rounded-xl border p-4 ${done ? "border-emerald-200 bg-emerald-50/40" : active ? "border-indigo-200" : "bg-slate-50/50"}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${done ? "bg-emerald-600 text-white" : active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}>{done ? <Check className="h-4 w-4" /> : number}</span><span><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-muted-foreground">{detail}</span></span></div>;
}
function Summary({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-xl border bg-slate-50/70 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{value}</p><p className="text-[11px] text-muted-foreground">{detail}</p></div>; }
function Notice({ tone, title, text }: { tone: "danger" | "warning" | "info"; title: string; text: string }) { const styles = tone === "danger" ? "border-rose-200 bg-rose-50 text-rose-900" : tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-indigo-200 bg-indigo-50 text-indigo-950"; const Icon = tone === "info" ? ShieldCheck : AlertCircle; return <div className={`flex gap-3 rounded-xl border p-4 ${styles}`}><Icon className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="text-sm font-semibold">{title}</p><p className="text-xs opacity-80">{text}</p></div></div>; }
