import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, FileText, Loader2, Receipt, Search, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { authFetchJson } from "@/lib/queryClient";

type ReviewInvoice = {
  id: number;
  period: string;
  personnel_name?: string | null;
  user_name?: string | null;
  email?: string | null;
  invoice_component?: "single" | "usd" | "ars";
  invoice_currency?: "ARS" | "USD" | null;
  declared_invoice_amount?: number | null;
  invoice_number?: string | null;
  issue_date?: string | null;
  approval_status: "pending" | "approved" | "rejected";
  review_reason?: string | null;
  settlement_total_invoice_usd?: number | null;
  settlement_final_invoice_ars?: number | null;
  settlement_total_ars?: number | null;
  settlement_billing_currency?: string | null;
  documents?: Array<{ index: number; fileName: string; fileUrl: string }>;
};

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function money(value: number | null | undefined, currency: "ARS" | "USD") {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat(currency === "ARS" ? "es-AR" : "en-US", {
    style: "currency", currency, maximumFractionDigits: currency === "ARS" ? 0 : 2,
  }).format(Number(value));
}

function expected(invoice: ReviewInvoice) {
  if (invoice.invoice_component === "usd") return { amount: Number(invoice.settlement_total_invoice_usd ?? 0), currency: "USD" as const };
  if (invoice.invoice_component === "ars") return { amount: Number(invoice.settlement_final_invoice_ars ?? 0), currency: "ARS" as const };
  if (invoice.invoice_currency === "ARS") return { amount: Number(invoice.settlement_total_ars ?? 0), currency: "ARS" as const };
  return { amount: Number(invoice.settlement_total_invoice_usd ?? 0), currency: "USD" as const };
}

function componentLabel(component?: string) {
  return component === "usd" ? "Factura USD · fin de mes" : component === "ars" ? "Factura ARS · diferencia" : "Factura mensual";
}

export default function TeamInvoiceReview() {
  const [period, setPeriod] = useState(currentPeriod());
  const [search, setSearch] = useState("");
  const [correction, setCorrection] = useState<ReviewInvoice | null>(null);
  const [reason, setReason] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const query = useQuery<ReviewInvoice[]>({
    queryKey: ["team-invoice-review", period],
    queryFn: () => authFetchJson(`/api/operations/invoices/review?period=${period}`),
  });
  const mutation = useMutation({
    mutationFn: ({ invoice, status, reviewReason }: { invoice: ReviewInvoice; status: "approved" | "rejected" | "pending"; reviewReason?: string }) =>
      authFetchJson(`/api/operations/invoices/review/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalStatus: status, reviewReason }),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["team-invoice-review", period] });
      setCorrection(null);
      setReason("");
      toast({
        title: variables.status === "approved" ? "Factura aprobada y registrada en Pasivo" : variables.status === "rejected" ? "Corrección solicitada" : "Factura reabierta",
        description: variables.status === "approved" ? "El costo operativo no cambió." : undefined,
      });
    },
    onError: (error: Error) => toast({ title: "No se pudo actualizar", description: error.message, variant: "destructive" }),
  });

  const invoices = query.data ?? [];
  const rows = useMemo(() => invoices.filter((invoice) => `${invoice.personnel_name ?? ""} ${invoice.user_name ?? ""} ${invoice.email ?? ""} ${invoice.invoice_number ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())), [invoices, search]);
  const pending = invoices.filter((invoice) => invoice.approval_status === "pending").length;
  const approved = invoices.filter((invoice) => invoice.approval_status === "approved").length;
  const mismatches = invoices.filter((invoice) => {
    const target = expected(invoice);
    return target.amount > 0 && Math.abs(Number(invoice.declared_invoice_amount ?? 0) - target.amount) > (target.currency === "ARS" ? 1 : 0.01);
  }).length;

  return <div className="mx-auto max-w-6xl space-y-6">
    <AlertDialog open={Boolean(correction)} onOpenChange={(open) => { if (!open) { setCorrection(null); setReason(""); } }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Pedir corrección</AlertDialogTitle><AlertDialogDescription>Indicá qué dato de la factura no coincide con la liquidación publicada por Operaciones.</AlertDialogDescription></AlertDialogHeader>
        <Textarea autoFocus value={reason} onChange={(event) => setReason(event.target.value)} rows={4} placeholder="Ej. El total de la factura no coincide con el importe esperado." />
        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction disabled={!reason.trim() || mutation.isPending} onClick={(event) => { event.preventDefault(); if (correction && reason.trim()) mutation.mutate({ invoice: correction, status: "rejected", reviewReason: reason.trim() }); }}>Enviar pedido</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <div>
      <p className="text-sm font-medium text-indigo-600">Carga financiera</p>
      <h1 className="text-3xl font-semibold tracking-tight">Facturas del equipo</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Compará cada factura con el número final publicado por Operaciones. Aprobarla crea el Pasivo en el mes de emisión; nunca modifica Costos ni la rentabilidad.</p>
    </div>

    <div className="grid gap-3 sm:grid-cols-3">
      <Metric label="Esperando revisión" value={pending} />
      <Metric label="Con diferencia" value={mismatches} warning={mismatches > 0} />
      <Metric label="Aprobadas" value={approved} />
    </div>

    <Card><CardContent className="flex flex-col gap-3 pt-6 sm:flex-row">
      <div className="sm:w-56"><Label htmlFor="invoice-review-period">Período trabajado</Label><Input id="invoice-review-period" className="mt-1.5" type="month" value={period} onChange={(event) => setPeriod(event.target.value)} /></div>
      <div className="min-w-0 flex-1"><Label htmlFor="invoice-review-search">Buscar</Label><div className="relative mt-1.5"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input id="invoice-review-search" className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Persona o número de factura" /></div></div>
    </CardContent></Card>

    {query.isLoading && <div className="flex justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando facturas…</div>}
    {query.isError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">No se pudieron cargar las facturas.</div>}
    {!query.isLoading && !rows.length && <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">No hay facturas enviadas para este período trabajado.</div>}

    <div className="space-y-3">{rows.map((invoice) => {
      const target = expected(invoice);
      const actual = Number(invoice.declared_invoice_amount ?? 0);
      const matches = target.amount <= 0 || Math.abs(actual - target.amount) <= (target.currency === "ARS" ? 1 : 0.01);
      const liabilityPeriod = invoice.issue_date?.slice(0, 7) ?? invoice.period;
      return <Card key={invoice.id} className={matches ? "" : "border-amber-300"}>
        <CardHeader className="pb-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{invoice.personnel_name || invoice.user_name || invoice.email || "Persona"}</p><Badge variant="secondary">{componentLabel(invoice.invoice_component)}</Badge><Status value={invoice.approval_status} /></div><p className="mt-1 text-xs text-muted-foreground">{invoice.invoice_number || "Sin número"} · emitida {invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString("es-AR") : "sin fecha"} · impacta Pasivo {liabilityPeriod}</p></div>{!matches && <Badge className="w-fit border-amber-200 bg-amber-50 text-amber-900" variant="outline"><AlertCircle className="mr-1 h-3 w-3" />Revisar diferencia</Badge>}</div></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3"><Amount label="Operaciones indicó" value={money(target.amount || null, target.currency)} /><Amount label="Factura recibida" value={money(actual || null, invoice.invoice_currency ?? target.currency)} /><Amount label="Diferencia" value={money(actual - target.amount, target.currency)} /></div>
          {invoice.review_reason && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">{invoice.review_reason}</div>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><div className="flex flex-wrap gap-2">{(invoice.documents ?? []).map((document, index) => <Button key={document.fileUrl} asChild size="sm" variant="outline"><a href={document.fileUrl} target="_blank" rel="noreferrer"><FileText className="mr-2 h-4 w-4" />{invoice.documents!.length > 1 ? `Comprobante ${index + 1}` : "Ver factura"}</a></Button>)}</div><div className="flex gap-2">{invoice.approval_status === "pending" && <><Button variant="outline" size="sm" onClick={() => { setCorrection(invoice); setReason(""); }}><X className="mr-1 h-4 w-4" />Pedir corrección</Button><Button size="sm" disabled={mutation.isPending || !matches} title={!matches ? "El importe debe coincidir con la liquidación de Operaciones" : undefined} onClick={() => mutation.mutate({ invoice, status: "approved" })}><Check className="mr-1 h-4 w-4" />Aprobar y crear Pasivo</Button></>}{invoice.approval_status === "approved" && <Button variant="outline" size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate({ invoice, status: "pending", reviewReason: "Reabierta por Finanzas." })}>Reabrir</Button>}</div></div>
        </CardContent>
      </Card>;
    })}</div>
  </div>;
}

function Metric({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return <Card><CardContent className="flex items-center gap-3 pt-6"><Receipt className={`h-5 w-5 ${warning ? "text-amber-600" : "text-indigo-600"}`} /><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-semibold">{value}</p></div></CardContent></Card>;
}

function Amount({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border bg-slate-50 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{value}</p></div>;
}

function Status({ value }: { value: ReviewInvoice["approval_status"] }) {
  const style = value === "approved" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : value === "rejected" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800";
  return <Badge variant="outline" className={style}>{value === "approved" ? "Aprobada" : value === "rejected" ? "A corregir" : "Pendiente"}</Badge>;
}
