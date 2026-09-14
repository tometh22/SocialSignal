import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authFetch, authFetchJson } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AlertCircle, Calculator, Check, CheckCircle2, Clock, FileText, FolderKanban, Loader2, LockKeyhole, Receipt, ShieldCheck, Trash2, UploadCloud, X } from "lucide-react";

type Allocation = {
  projectId: number;
  projectName: string;
  clientName: string | null;
  hours: number;
  allocationPercent: number | string;
  computedCostARS: number | null;
  computedCostUSD: number | null;
  allocatedInvoiceAmount?: number | null;
  invoiceCurrency?: "ARS" | "USD" | null;
};

type InvoiceRow = {
  id: number;
  period: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  computedTotalCostARS: number | null;
  computedTotalCostUSD: number | null;
  hoursTotal: number | null;
  notes: string | null;
  uploadedAt: string;
  invoiceNumber?: string | null;
  issueDate?: string | null;
  invoiceCurrency?: "ARS" | "USD" | null;
  declaredInvoiceAmount?: number | null;
  bankFx?: number | null;
  contractTypeSnapshot?: string | null;
  financialCostMode?: "hourly" | "invoice_actual" | null;
  financialCostARS?: number | null;
  financialCostUSD?: number | null;
  approvalStatus?: "pending" | "approved" | "rejected";
  reviewReason?: string | null;
  allocations?: Allocation[];
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
  userId: number;
  personnelId: number | null;
  hours: number;
  totalCostARS: number;
  totalCostUSD: number;
  grandTotalARS?: number;
  grandTotalUSD?: number;
  opsFxRate?: number;
  billingCurrency?: string;
  contractType?: string;
  financialCostMode?: "hourly" | "invoice_actual";
  allocationBasis?: "cost" | "hours";
  isClosed?: boolean;
  availableHours?: number;
  entryCount: number;
};

type ProjectResponse = { summary: MonthSummary | null; projects: Allocation[] };

const STATUS = {
  pending: { label: "En revisión", className: "border-amber-200 bg-amber-50 text-amber-800" },
  approved: { label: "Aprobada", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  rejected: { label: "Requiere corrección", className: "border-rose-200 bg-rose-50 text-rose-800" },
} as const;

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMoney(value: number | null | undefined, currency: "ARS" | "USD") {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat(currency === "ARS" ? "es-AR" : "en-US", {
    style: "currency", currency, maximumFractionDigits: currency === "ARS" ? 0 : 2,
  }).format(Number(value));
}

function formatPeriod(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

function percentFor(project: Allocation, selected: Allocation[], basis: "cost" | "hours" = "cost") {
  const totalCost = selected.reduce((sum, item) => sum + Math.max(0, Number(item.computedCostARS) || 0), 0);
  const totalHours = selected.reduce((sum, item) => sum + Math.max(0, Number(item.hours) || 0), 0);
  if (basis === "hours" && totalHours > 0) return Math.max(0, Number(project.hours) || 0) / totalHours * 100;
  if (totalCost > 0) return Math.max(0, Number(project.computedCostARS) || 0) / totalCost * 100;
  return totalHours > 0 ? Math.max(0, Number(project.hours) || 0) / totalHours * 100 : 0;
}

export default function MyInvoices() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [period, setPeriod] = useState(currentPeriod());
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceCurrency, setInvoiceCurrency] = useState<"ARS" | "USD">("ARS");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [bankFx, setBankFx] = useState("");
  const [notes, setNotes] = useState("");
  const [invoiceFx, setInvoiceFx] = useState("");
  const [receivedFx, setReceivedFx] = useState("");
  const [bankCommissionUSD, setBankCommissionUSD] = useState("0");
  const [deleteTarget, setDeleteTarget] = useState<InvoiceRow | null>(null);

  const invoicesQuery = useQuery<InvoiceRow[]>({
    queryKey: ["personal-invoices"],
    queryFn: () => authFetchJson("/api/me/invoices"),
  });
  const projectQuery = useQuery<ProjectResponse>({
    queryKey: ["personal-invoice-projects", period],
    queryFn: () => authFetchJson(`/api/me/invoices/projects?period=${period}`),
  });
  const settlementQuery = useQuery<Settlement | null>({
    queryKey: ["personal-settlement", period],
    queryFn: () => authFetchJson(`/api/me/invoices/settlement?period=${period}`),
  });
  const existing = useMemo(() => (invoicesQuery.data ?? []).find((item) => item.period === period) ?? null, [invoicesQuery.data, period]);
  const projects = projectQuery.data?.projects ?? [];
  const selectedProjects = projects.filter((project) => selectedIds.includes(project.projectId));
  const summary = projectQuery.data?.summary;
  const financialCostMode = summary?.financialCostMode ?? existing?.financialCostMode;
  const isFreelance = financialCostMode === "hourly";
  const requiresMixedSettlement = summary?.billingCurrency?.toUpperCase() === "MIXED";
  const settlement = settlementQuery.data ?? null;
  const locked = existing?.approvalStatus === "approved";

  useEffect(() => {
    if (!projectQuery.data) return;
    const savedIds = existing?.allocations?.map((allocation) => allocation.projectId) ?? [];
    setSelectedIds(savedIds.length ? savedIds : projectQuery.data.projects.map((project) => project.projectId));
    setInvoiceAmount(existing?.declaredInvoiceAmount == null ? "" : String(existing.declaredInvoiceAmount));
    setInvoiceCurrency(existing?.invoiceCurrency ?? (projectQuery.data.summary?.billingCurrency === "USD" ? "USD" : "ARS"));
    setInvoiceNumber(existing?.invoiceNumber ?? "");
    setIssueDate(existing?.issueDate?.slice(0, 10) ?? "");
    setBankFx(existing?.bankFx == null ? "" : String(existing.bankFx));
    setNotes(existing?.notes ?? "");
    setFiles([]);
    if (fileInput.current) fileInput.current.value = "";
  }, [period, projectQuery.data, existing?.id]);

  useEffect(() => {
    setInvoiceFx(settlement?.invoiceFx == null ? "" : String(settlement.invoiceFx));
    setReceivedFx(settlement?.receivedFx == null ? "" : String(settlement.receivedFx));
    setBankCommissionUSD(String(settlement?.bankCommissionUSD ?? 0));
  }, [settlement?.id, settlement?.invoiceFx, settlement?.receivedFx, settlement?.bankCommissionUSD]);

  const settlementMutation = useMutation({
    mutationFn: () => authFetchJson("/api/me/invoices/settlement", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period, invoiceFx, receivedFx, bankCommissionUSD }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal-settlement", period] });
      toast({ title: "Tipos de cambio guardados", description: "Mind recalculó automáticamente los importes a facturar." });
    },
    onError: (error: Error) => toast({ title: "No se pudo calcular", description: error.message, variant: "destructive" }),
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!files.length) throw new Error("Adjuntá al menos un comprobante en PDF o imagen");
      if (!selectedIds.length) throw new Error("Seleccioná al menos un proyecto");
      const form = new FormData();
      files.forEach((file) => form.append("files", file));
      form.append("period", period);
      form.append("projectIds", JSON.stringify(selectedIds));
      form.append("invoiceCurrency", invoiceCurrency);
      if (invoiceAmount.trim()) form.append("invoiceAmount", invoiceAmount);
      if (invoiceNumber.trim()) form.append("invoiceNumber", invoiceNumber);
      if (issueDate) form.append("issueDate", issueDate);
      if (bankFx.trim()) form.append("bankFx", bankFx);
      if (notes.trim()) form.append("notes", notes);
      const response = await authFetch("/api/me/invoices", { method: "POST", body: form });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message ?? "No se pudo enviar la factura");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Factura enviada", description: "Finanzas ya puede revisarla. El estado quedará visible en esta pantalla." });
      setFiles([]);
      if (fileInput.current) fileInput.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["personal-invoices"] });
    },
    onError: (error: Error) => toast({ title: "No se pudo enviar", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => authFetchJson(`/api/me/invoices/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Factura eliminada" });
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["personal-invoices"] });
    },
    onError: (error: Error) => toast({ title: "No se pudo eliminar", description: error.message, variant: "destructive" }),
  });

  function acceptFiles(files: File[]) {
    const candidates = files.slice(0, 10);
    if (!candidates.length) return;
    if (candidates.some((candidate) => !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(candidate.type))) {
      toast({ title: "Formato no admitido", description: "Usá PDF, JPG, PNG o WEBP.", variant: "destructive" });
      return;
    }
    if (candidates.some((candidate) => candidate.size > 20 * 1024 * 1024)) {
      toast({ title: "Archivo demasiado grande", description: "El máximo es 20 MB.", variant: "destructive" });
      return;
    }
    setFiles((current) => [...current, ...candidates].slice(0, 10));
  }
  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    acceptFiles(Array.from(event.dataTransfer.files));
  }
  function onPaste(event: ClipboardEvent<HTMLDivElement>) {
    const pasted = Array.from(event.clipboardData.items).find((item) => item.kind === "file")?.getAsFile();
    if (pasted) { event.preventDefault(); acceptFiles([pasted]); }
  }
  function toggleProject(projectId: number, checked: boolean) {
    setSelectedIds((current) => checked ? [...new Set([...current, projectId])] : current.filter((id) => id !== projectId));
  }

  const mixedReady = !requiresMixedSettlement || Boolean(settlement?.invoiceFx && settlement?.receivedFx && settlement?.finalInvoiceARS != null);
  const stepReady = Boolean(summary?.personnelId && selectedIds.length && files.length && mixedReady && !locked);
  const status = existing?.approvalStatus ? STATUS[existing.approvalStatus] : null;
  const invoiceFxNumber = Number(invoiceFx) > 0 ? Number(invoiceFx) : null;
  const receivedFxNumber = Number(receivedFx) > 0 ? Number(receivedFx) : null;
  const previewBaseUSD = settlement && invoiceFxNumber ? settlement.plannedUSDARS / invoiceFxNumber : null;
  const previewTotalUSD = previewBaseUSD == null ? null : previewBaseUSD + Number(settlement?.bonusUSD ?? 0);
  const previewPesifiedARS = previewBaseUSD != null && receivedFxNumber ? previewBaseUSD * receivedFxNumber : null;
  const previewFinalARS = settlement && previewPesifiedARS != null && receivedFxNumber
    ? settlement.totalARS - previewPesifiedARS + settlement.extrasARS + (Number(bankCommissionUSD) || 0) * receivedFxNumber
    : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6" onPaste={onPaste}>
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar esta factura?</AlertDialogTitle><AlertDialogDescription>Se eliminarán el comprobante pendiente y su vínculo con los proyectos. Esta acción no modifica los costos ya calculados.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction disabled={deleteMutation.isPending} onClick={(event) => { event.preventDefault(); if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }} className="bg-rose-600 hover:bg-rose-700">Eliminar factura</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-600">Espacio personal</p>
          <h1 className="text-3xl font-semibold tracking-tight">Mis facturas</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Subí tu comprobante mensual. Mind separa la distribución operativa por horas del costo real que usa Finanzas.</p>
        </div>
        {status && <Badge variant="outline" className={status.className}>{status.label}</Badge>}
      </div>

      <div className={`grid gap-3 ${requiresMixedSettlement ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
        {(requiresMixedSettlement ? [
          { number: 1, title: "Elegí el período", text: "Mind trae tus horas y proyectos." },
          { number: 2, title: "Revisá tu liquidación", text: "Completá los TC de tu banco." },
          { number: 3, title: "Revisá el reparto", text: "Se calcula automáticamente." },
          { number: 4, title: "Adjuntá y enviá", text: "Subí los comprobantes USD y ARS." },
        ] : [
          { number: 1, title: "Elegí el período", text: "Mind trae tus horas y proyectos." },
          { number: 2, title: "Revisá el reparto", text: "Se calcula automáticamente." },
          { number: 3, title: "Adjuntá y enviá", text: "Finanzas controla antes de aprobar." },
        ]).map((step) => <div key={step.number} className="flex gap-3 rounded-xl border bg-white p-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700">{step.number}</span><div><p className="text-sm font-semibold">{step.title}</p><p className="text-xs text-muted-foreground">{step.text}</p></div></div>)}
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4 text-indigo-600" />1. Período y resumen</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-[220px_repeat(3,minmax(0,1fr))]">
          <div><Label htmlFor="invoice-period">Mes a facturar</Label><Input id="invoice-period" className="mt-1.5" type="month" value={period} onChange={(event) => setPeriod(event.target.value)} /></div>
          <Summary label="Horas cargadas" value={summary ? `${Number(summary.hours).toFixed(1)} h` : "—"} detail={`${summary?.entryCount ?? 0} registros`} />
          <Summary label={isFreelance ? "Costo por horas ARS" : "Referencia operativa ARS"} value={formatMoney(summary?.grandTotalARS ?? summary?.totalCostARS, "ARS")} detail="Horas × tarifa histórica" />
          <Summary label={isFreelance ? "Costo por horas USD" : "Referencia operativa USD"} value={formatMoney(summary?.grandTotalUSD ?? summary?.totalCostUSD, "USD")} detail={summary?.isClosed ? "Mes operativo cerrado" : "Estimación operativa"} />
        </CardContent>
        {summary?.personnelId && <CardContent className="pt-0"><Notice tone="info" title={isFreelance ? "Contrato freelance: el costo sale de las horas" : "Contrato fijo: el costo real sale de la factura"} text={isFreelance ? "Mind calcula el costo financiero con tus horas por la tarifa histórica. La factura funciona como comprobante y Finanzas controla cualquier diferencia." : "Tus horas se usan para markup, eficiencia y para repartir el trabajo entre proyectos. Cuando Finanzas aprueba la factura, su importe reemplaza la estimación únicamente en Finanzas y Economía."} /></CardContent>}
      </Card>

      {requiresMixedSettlement && <Card className={settlement ? "border-indigo-200" : "border-amber-200"}>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Calculator className="h-4 w-4 text-indigo-600" />2. Tu liquidación USD + ARS</CardTitle><p className="text-sm text-muted-foreground">Administración define el porcentaje y los extras. Vos sólo cargás el tipo de cambio real de tu banco en cada momento; Mind hace el resto.</p></CardHeader>
        <CardContent className="space-y-4">
          {settlementQuery.isLoading && <div className="flex items-center gap-2 py-5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Buscando tu liquidación…</div>}
          {!settlementQuery.isLoading && !settlement && <Notice tone="warning" title="Administración todavía no publicó este cierre" text="No tenés que calcular ni adivinar importes. Cuando esté listo, vas a ver acá exactamente cuánto facturar en USD y luego en ARS." />}
          {settlement && <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Summary label="Total base del mes" value={formatMoney(settlement.totalARS, "ARS")} detail={`${settlement.hoursSnapshot.toFixed(1)} h × ${formatMoney(settlement.hourlyRateARSSnapshot, "ARS")}`} />
              <Summary label="Porción en USD" value={`${Number(settlement.usdPercentage).toFixed(2)}%`} detail={formatMoney(settlement.plannedUSDARS, "ARS")} />
              <Summary label="Extra / bono USD" value={formatMoney(settlement.bonusUSD, "USD")} detail="Se suma, no descuenta del sueldo" />
              <Summary label="Extras ARS" value={formatMoney(settlement.extrasARS, "ARS")} detail="Se suman al comprobante ARS" />
              <Summary label="Comprobantes esperados" value="USD + ARS" detail="Adjuntalos juntos al finalizar" />
            </div>
            {settlement.adminNotes && <Notice tone="info" title="Indicación de Administración" text={settlement.adminNotes} />}
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border p-4">
                <div className="mb-3 flex items-start justify-between gap-3"><div><p className="font-semibold">A. Al momento de facturar USD</p><p className="text-xs text-muted-foreground">Ingresá el tipo de cambio comprador más bajo que te muestra tu banco.</p></div><Badge variant="secondary">Paso 1</Badge></div>
                <Label htmlFor="settlement-invoice-fx">Tipo de cambio al facturar</Label><Input id="settlement-invoice-fx" className="mt-1.5" type="number" min="0" step="0.01" value={invoiceFx} onChange={(event) => setInvoiceFx(event.target.value)} placeholder="ARS por USD" disabled={locked} />
                <div className="mt-3 grid gap-2 sm:grid-cols-2"><Summary label="USD base" value={formatMoney(previewBaseUSD, "USD")} detail={`${formatMoney(settlement.plannedUSDARS, "ARS")} ÷ TC`} /><Summary label="Total a facturar USD" value={formatMoney(previewTotalUSD, "USD")} detail="USD base + extra/bono" /></div>
              </div>
              <div className="rounded-xl border p-4">
                <div className="mb-3 flex items-start justify-between gap-3"><div><p className="font-semibold">B. Una vez recibida la transferencia</p><p className="text-xs text-muted-foreground">Cargá el nuevo TC y la comisión que descontó el banco.</p></div><Badge variant="secondary">Paso 2</Badge></div>
                <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="settlement-received-fx">Tipo de cambio al cobrar</Label><Input id="settlement-received-fx" className="mt-1.5" type="number" min="0" step="0.01" value={receivedFx} onChange={(event) => setReceivedFx(event.target.value)} placeholder="ARS por USD" disabled={locked} /></div><div><Label htmlFor="settlement-bank-fee">Comisión bancaria USD</Label><Input id="settlement-bank-fee" className="mt-1.5" type="number" min="0" step="0.01" value={bankCommissionUSD} onChange={(event) => setBankCommissionUSD(event.target.value)} disabled={locked} /></div></div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2"><Summary label="USD base pesificados" value={formatMoney(previewPesifiedARS, "ARS")} detail="USD base × nuevo TC" /><Summary label="Diferencia a facturar ARS" value={formatMoney(previewFinalARS, "ARS")} detail="Saldo + extras + comisión" /></div>
              </div>
            </div>
            <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">El bono USD queda separado de la base para que no reduzca por error la diferencia en pesos.</p><Button variant="outline" disabled={locked || settlementMutation.isPending || !invoiceFxNumber} onClick={() => settlementMutation.mutate()}>{settlementMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Guardar y recalcular</Button></div>
          </>}
        </CardContent>
      </Card>}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><FolderKanban className="h-4 w-4 text-indigo-600" />{requiresMixedSettlement ? "3" : "2"}. Proyectos incluidos</CardTitle><p className="text-sm text-muted-foreground">Seleccionamos tus proyectos facturables y distribuimos el comprobante {isFreelance ? "según el costo horario" : "según las horas trabajadas"}. Sólo desmarcá uno si no corresponde a esta factura.</p></CardHeader>
        <CardContent>
          {projectQuery.isLoading && <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Calculando tus proyectos…</div>}
          {projectQuery.isError && <Notice tone="danger" title="No pudimos traer tus proyectos" text="Actualizá la página o contactá a Administración si el problema continúa." />}
          {!projectQuery.isLoading && !projectQuery.isError && !summary?.personnelId && <Notice tone="danger" title="Falta vincular tu usuario" text="Administración debe asociar tu email con tu ficha de persona antes de que puedas cargar facturas." />}
          {!projectQuery.isLoading && !projectQuery.isError && summary?.personnelId && !projects.length && <Notice tone="warning" title="No encontramos proyectos facturables" text={`No hay horas facturables cargadas para ${formatPeriod(period)}. Revisá tus horas o elegí otro período.`} />}
          {projects.length > 0 && <div className="overflow-hidden rounded-xl border">
            <div className="hidden grid-cols-[44px_minmax(0,1fr)_110px_110px_150px] gap-3 bg-slate-50 px-4 py-2 text-xs font-medium text-muted-foreground md:grid"><span /><span>Cliente y proyecto</span><span className="text-right">Horas</span><span className="text-right">Reparto</span><span className="text-right">{isFreelance ? "Costo por horas" : "Referencia operativa"}</span></div>
            {projects.map((project) => {
              const checked = selectedIds.includes(project.projectId);
              const pct = checked ? percentFor(project, selectedProjects, summary?.allocationBasis) : 0;
              return <label key={project.projectId} className={`grid cursor-pointer items-center gap-3 border-t px-4 py-3 first:border-t-0 md:grid-cols-[44px_minmax(0,1fr)_110px_110px_150px] ${checked ? "bg-white" : "bg-slate-50/70 opacity-65"}`}>
                <Checkbox checked={checked} disabled={locked} onCheckedChange={(value) => toggleProject(project.projectId, value === true)} />
                <span><span className="block text-xs text-muted-foreground">{project.clientName ?? "Sin cliente"}</span><span className="block text-sm font-medium">{project.projectName}</span></span>
                <span className="text-sm tabular-nums md:text-right">{Number(project.hours).toFixed(1)} h</span>
                <span className="text-sm font-medium tabular-nums text-indigo-700 md:text-right">{pct.toFixed(1)}%</span>
                <span className="text-sm tabular-nums md:text-right">{formatMoney(project.computedCostARS, "ARS")}</span>
              </label>;
            })}
          </div>}
          {selectedIds.length > 0 && <p className="mt-3 flex items-center gap-2 text-xs text-emerald-700"><Check className="h-3.5 w-3.5" />El reparto suma 100% y quedará guardado como respaldo del costo directo. {isFreelance ? "Se calcula por costo horario." : "Se distribuye según las horas trabajadas."}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Receipt className="h-4 w-4 text-indigo-600" />{requiresMixedSettlement ? "4" : "3"}. Comprobantes</CardTitle><p className="text-sm text-muted-foreground">Adjuntá PDF o capturas. Si facturás USD + ARS, seleccioná ambos comprobantes; Mind los guarda juntos en el mismo cierre.</p></CardHeader>
        <CardContent className="space-y-4">
          {locked && <Notice tone="success" title="Factura aprobada" text="Este período quedó bloqueado para preservar el respaldo contable. Si necesitás corregirlo, contactá a Finanzas." />}
          {existing?.approvalStatus === "rejected" && <Notice tone="danger" title="Finanzas pidió una corrección" text={existing.reviewReason || "Revisá los datos y reemplazá el comprobante."} />}
          {!requiresMixedSettlement && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div><Label htmlFor="invoice-number">Número <span className="font-normal text-muted-foreground">(opcional)</span></Label><Input id="invoice-number" disabled={locked} className="mt-1.5" value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="Ej. FC A 0001-123" /></div>
            <div><Label htmlFor="invoice-date">Fecha <span className="font-normal text-muted-foreground">(opcional)</span></Label><Input id="invoice-date" disabled={locked} className="mt-1.5" type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} /></div>
            <div><Label>Moneda</Label><Select disabled={locked} value={invoiceCurrency} onValueChange={(value: "ARS" | "USD") => setInvoiceCurrency(value)}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ARS">ARS</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></div>
            <div><Label htmlFor="invoice-amount">{isFreelance ? "Importe facturado" : "Importe real"} <span className="font-normal text-muted-foreground">(Mind lo detecta)</span></Label><Input id="invoice-amount" disabled={locked} className="mt-1.5" type="number" min="0" step="0.01" value={invoiceAmount} onChange={(event) => setInvoiceAmount(event.target.value)} placeholder="Completalo sólo si hace falta" /></div>
          </div>}
          {!requiresMixedSettlement && invoiceCurrency === "ARS" && <div className="max-w-xs"><Label htmlFor="invoice-fx">TC bancario <span className="font-normal text-muted-foreground">(opcional)</span></Label><Input id="invoice-fx" disabled={locked} className="mt-1.5" type="number" min="0" step="0.01" value={bankFx} onChange={(event) => setBankFx(event.target.value)} placeholder={summary?.opsFxRate ? `Referencia ${summary.opsFxRate}` : "ARS por USD"} /></div>}
          {requiresMixedSettlement && !mixedReady && <Notice tone="warning" title="Primero completá tu liquidación" text="Guardá el TC al facturar y, una vez cobrada la transferencia, el TC al cobrar. Mind habilitará el envío cuando pueda calcular el comprobante final en ARS." />}
          <div className={`rounded-xl border-2 border-dashed p-7 text-center transition ${dragging ? "border-indigo-500 bg-indigo-50" : files.length ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200"}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
            {files.length ? <><CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-600" /><p className="text-sm font-semibold">{files.length} comprobante{files.length === 1 ? "" : "s"} listo{files.length === 1 ? "" : "s"}</p><div className="mx-auto mt-3 max-w-xl space-y-2 text-left">{files.map((file, index) => <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2"><span className="min-w-0 truncate text-xs">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</span><Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X className="h-3.5 w-3.5" /></Button></div>)}</div><Button className="mt-3" size="sm" variant="outline" disabled={locked || files.length >= 10} onClick={() => fileInput.current?.click()}>Agregar otro</Button></> : <><UploadCloud className="mx-auto mb-2 h-8 w-8 text-indigo-500" /><p className="text-sm font-semibold">Arrastrá las facturas o pegá capturas con ⌘V</p><p className="mt-1 text-xs text-muted-foreground">Hasta 10 archivos PDF, JPG, PNG o WEBP · máximo 20 MB cada uno</p><Button className="mt-3" size="sm" variant="outline" disabled={locked} onClick={() => fileInput.current?.click()}>Elegir comprobantes</Button></>}
            <input ref={fileInput} type="file" multiple className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(event) => { acceptFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} />
          </div>
          <div><Label htmlFor="invoice-notes">Aclaración <span className="font-normal text-muted-foreground">(opcional)</span></Label><Textarea id="invoice-notes" disabled={locked} className="mt-1.5" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Sólo si Finanzas necesita contexto adicional" /></div>
          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex max-w-xl items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />El archivo se guarda de forma privada. {isFreelance ? "Finanzas usa el costo calculado por horas." : "Al aprobar, Finanzas y Economía usan el importe real de la factura; Operaciones conserva el cálculo por horas."}</p>
            <Button disabled={!stepReady || uploadMutation.isPending} onClick={() => uploadMutation.mutate()}>{uploadMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}{uploadMutation.isPending ? "Leyendo y enviando…" : existing ? "Reemplazar y reenviar" : "Enviar a Finanzas"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Historial</CardTitle><p className="text-sm text-muted-foreground">Seguimiento de tus comprobantes y su estado de revisión.</p></CardHeader>
        <CardContent className="space-y-3">
          {invoicesQuery.isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Cargando…</p>}
          {!invoicesQuery.isLoading && !(invoicesQuery.data ?? []).length && <p className="py-6 text-center text-sm text-muted-foreground">Todavía no enviaste ninguna factura.</p>}
          {(invoicesQuery.data ?? []).map((invoice) => {
            const itemStatus = STATUS[invoice.approvalStatus ?? "pending"];
            return <div key={invoice.id} className="flex flex-col gap-3 rounded-xl border p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold capitalize">{formatPeriod(invoice.period)}</p><Badge variant="outline" className={itemStatus.className}>{itemStatus.label}</Badge><Badge variant="secondary">{invoice.financialCostMode === "hourly" ? "Costo por horas" : "Importe real"}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{invoice.invoiceNumber || invoice.fileName} · {(invoice.allocations ?? []).length} proyecto(s) · {Number(invoice.hoursTotal ?? 0).toFixed(1)} h{invoice.financialCostUSD != null ? ` · ${formatMoney(invoice.financialCostUSD, "USD")}` : ""}</p>{invoice.reviewReason && <p className="mt-1 text-xs text-rose-700">{invoice.reviewReason}</p>}</div>
              <div className="flex flex-wrap items-center gap-2">{(invoice.documents?.length ? invoice.documents : [{ index: 0, fileName: invoice.fileName, fileSize: invoice.fileSize, mimeType: "", fileUrl: invoice.fileUrl }]).map((document, index) => <Button key={document.fileUrl} asChild size="sm" variant="outline"><a href={document.fileUrl} target="_blank" rel="noreferrer"><FileText className="mr-2 h-4 w-4" />{invoice.documents && invoice.documents.length > 1 ? `Comprobante ${index + 1}` : "Ver factura"}</a></Button>)}{invoice.approvalStatus !== "approved" && <Button size="icon" variant="ghost" className="text-rose-600" title="Eliminar factura" aria-label={`Eliminar factura de ${formatPeriod(invoice.period)}`} onClick={() => setDeleteTarget(invoice)}><Trash2 className="h-4 w-4" /></Button>}</div>
            </div>;
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function Summary({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-xl border bg-slate-50/70 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{value}</p><p className="text-[11px] text-muted-foreground">{detail}</p></div>;
}

function Notice({ tone, title, text }: { tone: "danger" | "warning" | "success" | "info"; title: string; text: string }) {
  const styles = tone === "danger" ? "border-rose-200 bg-rose-50 text-rose-900" : tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : tone === "info" ? "border-indigo-200 bg-indigo-50 text-indigo-950" : "border-emerald-200 bg-emerald-50 text-emerald-900";
  const Icon = tone === "success" ? LockKeyhole : tone === "info" ? ShieldCheck : AlertCircle;
  return <div className={`flex gap-3 rounded-xl border p-4 ${styles}`}><Icon className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="text-sm font-semibold">{title}</p><p className="text-xs opacity-80">{text}</p></div></div>;
}
