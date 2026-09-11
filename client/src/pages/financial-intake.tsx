import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authFetch, authFetchJson } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle2, FileText, Image, Loader2, Paperclip, RefreshCw, Send, Sparkles, UploadCloud, XCircle } from "lucide-react";

type DocumentKind = "customer_invoice" | "customer_collection" | "supplier_invoice" | "supplier_payment" | "bank_statement" | "fee_confirmation" | "exchange_rate" | "tax_settlement" | "provision" | "unknown";
type LineItem = { date: string | null; description: string | null; amount: number; currency: "ARS" | "USD" | "EUR" | "OTHER"; direction: "IN" | "OUT"; bank: string | null; reference: string | null };
type Extraction = {
  documentKind: DocumentKind; suggestedTarget: string; periodKey: string | null; issueDate: string | null;
  dueDate: string | null; paymentDate: string | null; documentNumber: string | null; counterparty: string | null;
  clientName: string | null; projectName: string | null; description: string | null; currency: "ARS" | "USD" | "EUR" | "OTHER" | null;
  netAmount: number | null; taxAmount: number | null; totalAmount: number | null; exchangeRate: number | null;
  bank: string | null; paymentTermsDays: number | null; lineItems: LineItem[]; confidence: number;
  costTreatment: "direct" | "indirect" | "provision" | "unclassified" | null; costSubtype: string | null;
  deliveryStart: string | null; deliveryEnd: string | null; deliveryCurve: "invoice" | "linear" | "milestone" | null;
  fieldConfidence: Record<string, number>; missingFields: string[]; warnings: string[];
};
type IntakeItem = {
  id: number; inputKind: string; originalText: string | null; originalFileName: string | null; mimeType: string | null;
  documentKind: DocumentKind; suggestedTarget: string | null; status: string; extractedData: Extraction;
  warnings: string[]; extractionError: string | null; reviewNotes: string | null; linkedRecords: Array<{ type: string; id: number }>;
  fileAvailable: boolean; createdAt: string; updatedAt: string; duplicate?: boolean;
};

const KIND_LABELS: Record<DocumentKind, string> = {
  customer_invoice: "Factura a cliente", customer_collection: "Cobro de cliente", supplier_invoice: "Factura de proveedor",
  supplier_payment: "Pago a proveedor", bank_statement: "Extracto bancario", fee_confirmation: "Fee confirmado",
  exchange_rate: "Tipo de cambio", tax_settlement: "Liquidación impositiva", provision: "Provisión", unknown: "Sin clasificar",
};
const TARGET_BY_KIND: Record<DocumentKind, string> = {
  customer_invoice: "activo", customer_collection: "cashflow", supplier_invoice: "pasivo", supplier_payment: "cashflow",
  bank_statement: "cashflow", fee_confirmation: "revenue", exchange_rate: "fx", tax_settlement: "tax", provision: "provision", unknown: "unknown",
};
const STATUS_LABELS: Record<string, string> = { received: "Recibido", processing: "Procesando", needs_review: "Revisar", approved: "Listo", rejected: "Rechazado", posted: "Contabilizado", failed: "Falló" };

function responseError(error: unknown) { return error instanceof Error ? error.message : "No se pudo completar la operación."; }

export default function FinancialIntakePage() {
  const [text, setText] = useState("");
  const [context, setContext] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Extraction | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const statusParam = statusFilter === "open" ? "all" : statusFilter;
  const query = useQuery<{ items: IntakeItem[]; total: number }>({
    queryKey: ["financial-native-intake", statusParam],
    queryFn: () => authFetchJson(`/api/financial-native/intake?status=${statusParam}&pageSize=100`),
  });
  const allItems = query.data?.items ?? [];
  const items = statusFilter === "open" ? allItems.filter((item) => !["posted", "rejected"].includes(item.status)) : allItems;
  const selected = allItems.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId && items[0]) setSelectedId(items[0].id);
  }, [items, selectedId]);
  useEffect(() => {
    setDraft(selected?.extractedData ?? null);
    setReviewNotes(selected?.reviewNotes ?? "");
  }, [selected?.id, selected?.updatedAt]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["financial-native-intake"] });
  const textMutation = useMutation({
    mutationFn: () => authFetchJson<IntakeItem>("/api/financial-native/intake/text", { method: "POST", body: JSON.stringify({ text }) }),
    onSuccess: (item) => { setText(""); setSelectedId(item.id); refresh(); toast({ title: "Carga interpretada", description: "Revisá el borrador antes de contabilizar." }); },
    onError: (e) => toast({ title: "No pudimos interpretar el texto", description: responseError(e), variant: "destructive" }),
  });
  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const form = new FormData(); files.forEach((file) => form.append("files", file)); if (context) form.append("context", context);
      const response = await authFetch("/api/financial-native/intake/files", { method: "POST", body: form });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "No se pudieron subir los archivos.");
      return response.json() as Promise<{ items: IntakeItem[] }>;
    },
    onSuccess: ({ items }) => { setSelectedId(items[0]?.id ?? null); refresh(); toast({ title: `${items.length} documento(s) procesado(s)` }); },
    onError: (e) => toast({ title: "Error al subir", description: responseError(e), variant: "destructive" }),
  });
  const saveMutation = useMutation({
    mutationFn: () => authFetchJson(`/api/financial-native/intake/${selectedId}`, { method: "PATCH", body: JSON.stringify({ extractedData: draft, reviewNotes: reviewNotes || null }) }),
    onSuccess: () => { refresh(); toast({ title: "Revisión guardada" }); },
    onError: (e) => toast({ title: "No se guardó", description: responseError(e), variant: "destructive" }),
  });
  const actionMutation = useMutation({
    mutationFn: async ({ action, body }: { action: "post" | "reprocess" | "reject"; body?: unknown }) => authFetchJson(`/api/financial-native/intake/${selectedId}/${action}`, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
    onSuccess: (_data, variables) => { refresh(); toast({ title: variables.action === "post" ? "Contabilizado en Mind" : variables.action === "reject" ? "Carga rechazada" : "Documento reprocesado" }); },
    onError: (e) => toast({ title: "No se pudo completar", description: responseError(e), variant: "destructive" }),
  });

  const busy = textMutation.isPending || uploadMutation.isPending || saveMutation.isPending || actionMutation.isPending;
  const openCount = allItems.filter((i) => !["posted", "rejected"].includes(i.status)).length;
  const needsCount = allItems.filter((i) => i.status === "needs_review" || i.status === "failed").length;

  function acceptFiles(files: File[]) { if (files.length) uploadMutation.mutate(files.slice(0, 10)); }
  function onDrop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setDragging(false); acceptFiles(Array.from(event.dataTransfer.files)); }
  function onPaste(event: ClipboardEvent<HTMLDivElement>) {
    const images = Array.from(event.clipboardData.items).filter((item) => item.kind === "file").map((item) => item.getAsFile()).filter(Boolean) as File[];
    if (images.length) { event.preventDefault(); acceptFiles(images); }
  }
  function setField<K extends keyof Extraction>(key: K, value: Extraction[K]) { setDraft((old) => old ? { ...old, [key]: value } : old); }
  function numberValue(value: string) { return value.trim() === "" ? null : Number(value); }
  function reject() { const reason = window.prompt("Motivo del rechazo (queda en auditoría):"); if (reason) actionMutation.mutate({ action: "reject", body: { reason } }); }

  return (
    <div className="space-y-6" onPaste={onPaste}>
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div><p className="text-sm font-medium text-rose-600">Finanzas · carga nativa</p><h1 className="text-3xl font-semibold tracking-tight">Bandeja financiera</h1><p className="text-sm text-muted-foreground">Pegá un mensaje, arrastrá un documento o pegá una captura. Mind prepara el registro; Administración lo confirma.</p></div>
        <div className="flex gap-2"><Badge variant="outline">{openCount} abiertas</Badge><Badge variant={needsCount ? "destructive" : "outline"}>{needsCount} requieren atención</Badge></div>
      </div>

      <Card className="overflow-hidden border-rose-100 bg-gradient-to-br from-white to-rose-50/50">
        <CardContent className="pt-6">
          <Tabs defaultValue="text">
            <TabsList><TabsTrigger value="text"><Sparkles className="mr-2 h-4 w-4" />Escribir o pegar</TabsTrigger><TabsTrigger value="file"><Paperclip className="mr-2 h-4 w-4" />Archivo o captura</TabsTrigger></TabsList>
            <TabsContent value="text" className="space-y-3 pt-3">
              <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="Ej.: Cobramos la factura FC-203 de Acme por USD 12.500 el 10/09/2026 en Santander, proyecto Always On." />
              <div className="flex justify-end"><Button disabled={busy || text.trim().length < 3} onClick={() => textMutation.mutate()}><Send className="mr-2 h-4 w-4" />Interpretar con Mind</Button></div>
            </TabsContent>
            <TabsContent value="file" className="space-y-3 pt-3">
              <div className={`rounded-xl border-2 border-dashed p-8 text-center transition ${dragging ? "border-rose-500 bg-rose-50" : "border-slate-200"}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
                <UploadCloud className="mx-auto mb-3 h-8 w-8 text-rose-500" /><p className="font-medium">Arrastrá PDFs, imágenes, Word o Excel</p><p className="mt-1 text-xs text-muted-foreground">También podés pegar una captura con ⌘V. Hasta 10 archivos de 20 MB.</p>
                <input ref={fileInput} type="file" multiple className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.docx,.xlsx" onChange={(e) => acceptFiles(Array.from(e.target.files ?? []))} />
                <Button className="mt-4" variant="outline" onClick={() => fileInput.current?.click()}>Elegir archivos</Button>
              </div>
              <Input value={context} onChange={(e) => setContext(e.target.value)} placeholder="Contexto opcional: banco, cliente, período o cualquier aclaración" />
            </TabsContent>
          </Tabs>
          {busy && <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Mind está procesando la información…</div>}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="h-fit"><CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-base">Entradas</CardTitle><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Pendientes</SelectItem><SelectItem value="all">Todas</SelectItem><SelectItem value="needs_review">A revisar</SelectItem><SelectItem value="posted">Contabilizadas</SelectItem><SelectItem value="rejected">Rechazadas</SelectItem></SelectContent></Select></div></CardHeader>
          <CardContent className="max-h-[720px] space-y-2 overflow-auto">
            {query.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
            {!query.isLoading && !items.length && <div className="py-10 text-center text-sm text-muted-foreground"><CheckCircle2 className="mx-auto mb-2 h-7 w-7" />No hay cargas en esta vista.</div>}
            {items.map((item) => <button key={item.id} onClick={() => setSelectedId(item.id)} className={`w-full rounded-xl border p-3 text-left transition ${selectedId === item.id ? "border-rose-300 bg-rose-50" : "hover:bg-slate-50"}`}>
              <div className="flex items-start justify-between gap-2"><span className="flex min-w-0 items-center gap-2 text-sm font-medium">{item.inputKind === "image" ? <Image className="h-4 w-4" /> : <FileText className="h-4 w-4" />}<span className="truncate">{item.originalFileName || KIND_LABELS[item.documentKind]}</span></span><StatusBadge status={item.status} /></div>
              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{item.extractedData?.description || item.originalText || "Sin descripción"}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">{new Date(item.createdAt).toLocaleString("es-AR")}</p>
            </button>)}
          </CardContent>
        </Card>

        {!selected || !draft ? <Card><CardContent className="py-20 text-center text-muted-foreground">Seleccioná una entrada para revisar el borrador.</CardContent></Card> :
          <div className="space-y-4">
            <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="text-lg">Revisar antes de contabilizar</CardTitle><p className="mt-1 text-xs text-muted-foreground">Confianza de extracción: {Math.round((draft.confidence || 0) * 100)}%</p></div><div className="flex gap-2"><StatusBadge status={selected.status} />{selected.fileAvailable && <Button size="sm" variant="outline" asChild><a href={`/api/financial-native/intake/${selected.id}/file`} target="_blank" rel="noreferrer">Ver original</a></Button>}</div></div></CardHeader>
              <CardContent className="space-y-5">
                {(draft.warnings.length > 0 || selected.extractionError) && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><div className="flex gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><div>{selected.extractionError || draft.warnings.join(" · ")}</div></div></div>}
                {selected.fileAvailable && selected.mimeType?.startsWith("image/") && <img src={`/api/financial-native/intake/${selected.id}/file`} className="max-h-64 rounded-lg border object-contain" alt="Documento original" />}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Field label="Tipo"><Select value={draft.documentKind} onValueChange={(v: DocumentKind) => setDraft({ ...draft, documentKind: v, suggestedTarget: TARGET_BY_KIND[v] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(KIND_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></Field>
                  <Field label="Período"><Input type="month" value={draft.periodKey ?? ""} onChange={(e) => setField("periodKey", e.target.value || null)} /></Field>
                  <Field label="Moneda"><Select value={draft.currency ?? "none"} onValueChange={(v) => setField("currency", v === "none" ? null : v as Extraction["currency"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Elegir</SelectItem><SelectItem value="ARS">ARS</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem><SelectItem value="OTHER">Otra</SelectItem></SelectContent></Select></Field>
                  <Field label="Fecha de emisión"><Input type="date" value={draft.issueDate ?? ""} onChange={(e) => setField("issueDate", e.target.value || null)} /></Field>
                  <Field label="Vencimiento"><Input type="date" value={draft.dueDate ?? ""} onChange={(e) => setField("dueDate", e.target.value || null)} /></Field>
                  <Field label="Fecha de pago/cobro"><Input type="date" value={draft.paymentDate ?? ""} onChange={(e) => setField("paymentDate", e.target.value || null)} /></Field>
                  <Field label="Nº documento"><Input value={draft.documentNumber ?? ""} onChange={(e) => setField("documentNumber", e.target.value || null)} /></Field>
                  <Field label="Contraparte"><Input value={draft.counterparty ?? ""} onChange={(e) => setField("counterparty", e.target.value || null)} /></Field>
                  <Field label="Cliente"><Input value={draft.clientName ?? ""} onChange={(e) => setField("clientName", e.target.value || null)} /></Field>
                  <Field label="Proyecto"><Input value={draft.projectName ?? ""} onChange={(e) => setField("projectName", e.target.value || null)} /></Field>
                  <Field label="Banco / cuenta"><Input value={draft.bank ?? ""} onChange={(e) => setField("bank", e.target.value || null)} /></Field>
                  <Field label="Plazo (días)"><Input type="number" min="0" value={draft.paymentTermsDays ?? ""} onChange={(e) => setField("paymentTermsDays", numberValue(e.target.value))} /></Field>
                  <Field label="Neto"><Input type="number" step="0.01" value={draft.netAmount ?? ""} onChange={(e) => setField("netAmount", numberValue(e.target.value))} /></Field>
                  <Field label="Impuestos"><Input type="number" step="0.01" value={draft.taxAmount ?? ""} onChange={(e) => setField("taxAmount", numberValue(e.target.value))} /></Field>
                  <Field label="Total"><Input type="number" step="0.01" value={draft.totalAmount ?? ""} onChange={(e) => setField("totalAmount", numberValue(e.target.value))} /></Field>
                  <Field label="Cotización ARS/USD"><Input type="number" step="0.0001" value={draft.exchangeRate ?? ""} onChange={(e) => setField("exchangeRate", numberValue(e.target.value))} /></Field>
                  {(draft.documentKind === "supplier_invoice" || draft.documentKind === "tax_settlement") && <><Field label="Tratamiento del costo"><Select value={draft.costTreatment ?? "unclassified"} onValueChange={(v: NonNullable<Extraction["costTreatment"]>) => setField("costTreatment", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="direct">Directo al proyecto</SelectItem><SelectItem value="indirect">Indirecto / estructura</SelectItem><SelectItem value="provision">Provisión</SelectItem><SelectItem value="unclassified">Pendiente de clasificar</SelectItem></SelectContent></Select></Field><Field label="Subtipo de costo"><Input value={draft.costSubtype ?? ""} onChange={(e) => setField("costSubtype", e.target.value || null)} /></Field></>}
                  {(draft.documentKind === "customer_invoice" || draft.documentKind === "fee_confirmation") && <><Field label="Inicio del devengamiento"><Input type="month" value={draft.deliveryStart ?? ""} onChange={(e) => setField("deliveryStart", e.target.value || null)} /></Field><Field label="Fin del devengamiento"><Input type="month" value={draft.deliveryEnd ?? ""} onChange={(e) => setField("deliveryEnd", e.target.value || null)} /></Field><Field label="Curva"><Select value={draft.deliveryCurve ?? "invoice"} onValueChange={(v: NonNullable<Extraction["deliveryCurve"]>) => setField("deliveryCurve", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="invoice">Al facturar</SelectItem><SelectItem value="linear">Lineal</SelectItem><SelectItem value="milestone">Por hitos</SelectItem></SelectContent></Select></Field></>}
                </div>
                <Field label="Descripción"><Textarea value={draft.description ?? ""} onChange={(e) => setField("description", e.target.value || null)} /></Field>
                {draft.documentKind === "bank_statement" && <LineItemsEditor rows={draft.lineItems} onChange={(lineItems) => setField("lineItems", lineItems)} />}
                <Field label="Notas de revisión"><Textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Decisiones o aclaraciones que deben quedar en auditoría" /></Field>
                {draft.missingFields.length > 0 && <p className="text-xs text-amber-700">Pendientes detectados: {draft.missingFields.join(", ")}. Al corregirlos, quitá el nombre correspondiente de la lista.</p>}
                <div className="flex flex-wrap justify-between gap-2 border-t pt-4"><div className="flex gap-2"><Button variant="ghost" disabled={busy || selected.status === "posted"} onClick={() => actionMutation.mutate({ action: "reprocess" })}><RefreshCw className="mr-2 h-4 w-4" />Reprocesar</Button><Button variant="ghost" className="text-red-600" disabled={busy || selected.status === "posted"} onClick={reject}><XCircle className="mr-2 h-4 w-4" />Rechazar</Button></div><div className="flex gap-2"><Button variant="outline" disabled={busy || selected.status === "posted"} onClick={() => saveMutation.mutate()}>Guardar revisión</Button><Button disabled={busy || selected.status === "posted" || selected.status === "failed" || draft.missingFields.length > 0} onClick={() => actionMutation.mutate({ action: "post" })}><CheckCircle2 className="mr-2 h-4 w-4" />Contabilizar</Button></div></div>
              </CardContent>
            </Card>
            {selected.linkedRecords.length > 0 && <Card><CardHeader><CardTitle className="text-base">Registros creados</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">{selected.linkedRecords.map((link) => <Badge key={`${link.type}-${link.id}`} variant="secondary">{link.type} #{link.id}</Badge>)}</CardContent></Card>}
          </div>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
function StatusBadge({ status }: { status: string }) { return <Badge variant={status === "failed" || status === "rejected" ? "destructive" : status === "posted" ? "default" : "secondary"}>{STATUS_LABELS[status] ?? status}</Badge>; }
function LineItemsEditor({ rows, onChange }: { rows: LineItem[]; onChange: (rows: LineItem[]) => void }) {
  const totals = useMemo(() => rows.reduce((sum, row) => sum + (row.direction === "IN" ? row.amount : -row.amount), 0), [rows]);
  const update = (index: number, next: Partial<LineItem>) => onChange(rows.map((row, i) => i === index ? { ...row, ...next } : row));
  return <div className="space-y-2"><div className="flex items-center justify-between"><Label>Movimientos del extracto ({rows.length})</Label><span className="text-xs text-muted-foreground">Neto extraído: {totals.toLocaleString("es-AR")}</span></div><div className="max-h-80 space-y-2 overflow-auto rounded-lg border p-2">{rows.map((row, index) => <div key={index} className="grid grid-cols-[120px_1fr_110px_100px_40px] gap-2"><Input type="date" value={row.date ?? ""} onChange={(e) => update(index, { date: e.target.value || null })} /><Input value={row.description ?? ""} onChange={(e) => update(index, { description: e.target.value || null })} placeholder="Detalle" /><Input type="number" value={row.amount} onChange={(e) => update(index, { amount: Number(e.target.value) })} /><Select value={row.direction} onValueChange={(direction: "IN" | "OUT") => update(index, { direction })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="IN">Ingreso</SelectItem><SelectItem value="OUT">Egreso</SelectItem></SelectContent></Select><Button size="icon" variant="ghost" onClick={() => onChange(rows.filter((_, i) => i !== index))}><XCircle className="h-4 w-4" /></Button></div>)}{!rows.length && <p className="p-4 text-center text-sm text-muted-foreground">No se detectaron movimientos. Reprocesá o cargalos desde un mensaje.</p>}</div></div>;
}
