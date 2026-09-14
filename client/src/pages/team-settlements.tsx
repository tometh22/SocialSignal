import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { authFetchJson } from "@/lib/queryClient";
import {
  AlertCircle, Calculator, Check, CheckCircle2, ChevronDown, Clock3,
  FileCheck2, Loader2, Search, Send, UsersRound, WandSparkles,
} from "lucide-react";

type BillingCurrency = "ARS" | "USD" | "MIXED";
type Settlement = {
  id: number;
  status: "draft" | "published";
  billingCurrencySnapshot: string;
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
type SettlementRow = {
  person: { id: number; name: string; email: string | null; contractType: string; billingCurrency: string };
  closing: { id: number } | null;
  system: { hours: number | null; hourlyRateARS: number | null; totalARS: number | null };
  settlement: Settlement | null;
  suggestion: { sourcePeriod: string; billingCurrency: string; usdPercentage: number } | null;
  invoice: { id: number; approvalStatus: "pending" | "approved" | "rejected"; documentCount: number; uploadedAt: string; reviewReason: string | null } | null;
};
type Draft = { billingCurrency: BillingCurrency; usdPercentage: string; bonusUSD: string; extrasARS: string; adminNotes: string };
type WorkflowGroup = "admin" | "team" | "review" | "done" | "no_close";

const EMPTY_DRAFT: Draft = { billingCurrency: "ARS", usdPercentage: "0", bonusUSD: "0", extrasARS: "0", adminNotes: "" };

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function periodLabel(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

function normalizeBillingCurrency(value?: string | null): BillingCurrency {
  const normalized = String(value ?? "ARS").toUpperCase();
  return normalized === "USD" || normalized === "MIXED" ? normalized : "ARS";
}

function draftFor(row: SettlementRow): Draft {
  const billingCurrency = normalizeBillingCurrency(row.settlement?.billingCurrencySnapshot ?? row.suggestion?.billingCurrency ?? row.person.billingCurrency);
  const usdPercentage = row.settlement?.usdPercentage ?? row.suggestion?.usdPercentage ?? (billingCurrency === "USD" ? 100 : billingCurrency === "MIXED" ? 90 : 0);
  return {
    billingCurrency,
    usdPercentage: String(usdPercentage),
    bonusUSD: String(row.settlement?.bonusUSD ?? 0),
    extrasARS: String(row.settlement?.extrasARS ?? 0),
    adminNotes: row.settlement?.adminNotes ?? "",
  };
}

function workflow(row: SettlementRow) {
  if (!row.closing) return { group: "no_close" as WorkflowGroup, label: "Falta cierre operativo", tone: "amber" as const, step: 1 };
  if (!row.settlement || row.settlement.status === "draft") return { group: "admin" as WorkflowGroup, label: row.settlement ? "Borrador para publicar" : "Preparar liquidación", tone: "indigo" as const, step: 2 };
  if (row.invoice?.approvalStatus === "approved") return { group: "done" as WorkflowGroup, label: "Cierre completo", tone: "emerald" as const, step: 4 };
  if (row.invoice?.approvalStatus === "pending") return { group: "review" as WorkflowGroup, label: "Factura para revisar", tone: "blue" as const, step: 4 };
  if (row.invoice?.approvalStatus === "rejected") return { group: "team" as WorkflowGroup, label: "Esperando corrección", tone: "rose" as const, step: 3 };
  if (normalizeBillingCurrency(row.settlement.billingCurrencySnapshot) === "MIXED") {
    if (!row.settlement.invoiceFx) return { group: "team" as WorkflowGroup, label: "Esperando TC al facturar", tone: "amber" as const, step: 3 };
    if (!row.settlement.receivedFx) return { group: "team" as WorkflowGroup, label: "Esperando cobro y segundo TC", tone: "amber" as const, step: 3 };
  }
  return { group: "team" as WorkflowGroup, label: "Esperando comprobantes", tone: "amber" as const, step: 3 };
}

function ars(value: number | null | undefined) {
  return value == null ? "—" : new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

function usd(value: number | null | undefined) {
  return value == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

export default function TeamSettlements() {
  const [period, setPeriod] = useState(currentPeriod());
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("admin");
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [openId, setOpenId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const query = useQuery<SettlementRow[]>({
    queryKey: ["personnel-settlements", period],
    queryFn: () => authFetchJson(`/api/finance/personnel-settlements?period=${period}`),
  });

  useEffect(() => {
    if (!query.data) return;
    setDrafts(Object.fromEntries(query.data.map((row) => [row.person.id, draftFor(row)])));
    setOpenId(null);
  }, [query.data]);

  const payloadFor = (row: SettlementRow, publish: boolean) => ({ period, ...(drafts[row.person.id] ?? draftFor(row)), publish });
  const mutation = useMutation({
    mutationFn: ({ row, publish }: { row: SettlementRow; publish: boolean }) => authFetchJson(`/api/finance/personnel-settlements/${row.person.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadFor(row, publish)),
    }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["personnel-settlements", period] });
      toast({
        title: variables.publish ? (variables.row.settlement?.status === "published" ? "Publicación actualizada" : "Liquidación publicada") : "Borrador guardado",
        description: variables.publish ? `${variables.row.person.name} ya ve los importes e instrucciones vigentes.` : "Quedó preparado para que Administración lo revise antes de publicar.",
      });
    },
    onError: (error: Error) => toast({ title: "No se pudo guardar", description: error.message, variant: "destructive" }),
  });

  const bulkRows = useMemo(() => (query.data ?? []).filter((row) => row.closing && !row.settlement), [query.data]);
  const bulkMutation = useMutation({
    mutationFn: async () => {
      for (const row of bulkRows) {
        await authFetchJson(`/api/finance/personnel-settlements/${row.person.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadFor(row, false)),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel-settlements", period] });
      toast({ title: "Borradores preparados", description: `Mind preparó ${bulkRows.length} liquidación${bulkRows.length === 1 ? "" : "es"} con la última modalidad conocida y dejó extras en cero.` });
    },
    onError: (error: Error) => toast({ title: "No se pudieron preparar todos los borradores", description: error.message, variant: "destructive" }),
  });

  const allRows = query.data ?? [];
  const counts = useMemo(() => allRows.reduce((result, row) => {
    result[workflow(row).group] += 1;
    return result;
  }, { admin: 0, team: 0, review: 0, done: 0, no_close: 0 } as Record<WorkflowGroup, number>), [allRows]);
  const rows = useMemo(() => allRows.filter((row) => {
    const group = workflow(row).group;
    if (scope !== "all" && scope !== "ready" && group !== scope) return false;
    if (scope === "ready" && !row.closing) return false;
    return `${row.person.name} ${row.person.email ?? ""}`.toLowerCase().includes(search.trim().toLowerCase());
  }), [allRows, scope, search]);

  const update = (personId: number, field: keyof Draft, value: string) => setDrafts((current) => ({
    ...current,
    [personId]: { ...(current[personId] ?? EMPTY_DRAFT), [field]: value },
  }));

  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-sm font-medium text-indigo-600">Carga financiera</p>
        <h1 className="text-3xl font-semibold tracking-tight">Cierre mensual del equipo</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">El mismo orden del Excel, sin copiar horas ni hacer cuentas: Mind trae el cierre, Administración define lo variable y cada persona completa sus tipos de cambio y comprobantes.</p>
      </div>
      <Button variant="outline" disabled={!bulkRows.length || bulkMutation.isPending} onClick={() => bulkMutation.mutate()}>
        {bulkMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}
        Preparar {bulkRows.length || ""} borrador{bulkRows.length === 1 ? "" : "es"}
      </Button>
    </div>

    <div className="grid gap-3 md:grid-cols-4">
      <WorkflowStep number={1} label="Cierre operativo" detail="Horas y valor hora" done={allRows.some((row) => Boolean(row.closing))} />
      <WorkflowStep number={2} label="Administración" detail="Modalidad, % y extras" active={counts.admin > 0} />
      <WorkflowStep number={3} label="Colaborador" detail="TC y comprobantes" active={counts.team > 0} />
      <WorkflowStep number={4} label="Revisión final" detail="Aprobación de Finanzas" active={counts.review > 0} done={counts.done > 0 && counts.admin + counts.team + counts.review === 0} />
    </div>

    <div className="grid gap-3 sm:grid-cols-3">
      <Metric icon={Calculator} label="Requieren acción de Administración" value={String(counts.admin)} />
      <Metric icon={Clock3} label="Esperando al equipo" value={String(counts.team)} />
      <Metric icon={FileCheck2} label="Para revisar / completas" value={`${counts.review} / ${counts.done}`} />
    </div>

    <Card>
      <CardHeader className="pb-3"><p className="font-semibold">¿Qué requiere atención en {periodLabel(period)}?</p></CardHeader>
      <CardContent className="flex flex-col gap-3 lg:flex-row">
        <div className="w-full lg:w-52"><Label htmlFor="settlement-period">Mes de cierre</Label><Input id="settlement-period" className="mt-1.5" type="month" value={period} onChange={(event) => setPeriod(event.target.value)} /></div>
        <div className="w-full lg:w-72"><Label>Estado del flujo</Label><Select value={scope} onValueChange={setScope}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">Acción de Administración ({counts.admin})</SelectItem><SelectItem value="team">Esperando al equipo ({counts.team})</SelectItem><SelectItem value="review">Para revisar ({counts.review})</SelectItem><SelectItem value="done">Completas ({counts.done})</SelectItem><SelectItem value="ready">Con cierre operativo</SelectItem><SelectItem value="no_close">Sin cierre operativo ({counts.no_close})</SelectItem><SelectItem value="all">Todo el equipo</SelectItem></SelectContent></Select></div>
        <div className="min-w-0 flex-1"><Label htmlFor="settlement-search">Buscar</Label><div className="relative mt-1.5"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input id="settlement-search" className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre o email" /></div></div>
      </CardContent>
    </Card>

    {query.isLoading && <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando cierres…</div>}
    {query.isError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">No pudimos cargar las liquidaciones. Actualizá la página o revisá tu acceso de Finanzas.</div>}
    {!query.isLoading && !rows.length && <div className="rounded-xl border border-dashed p-10 text-center">
      <p className="font-medium">No hay personas en este estado para {periodLabel(period)}.</p>
      <p className="mt-1 text-sm text-muted-foreground">Si el mes todavía no tiene información, completá primero Operaciones → Cierre mensual. Después Mind traerá las horas y los valores automáticamente.</p>
      <Button asChild className="mt-4" variant="outline"><a href="/operations/monthly-closing">Ir al cierre operativo</a></Button>
    </div>}

    <div className="space-y-3">
      {rows.map((row) => {
        const draft = drafts[row.person.id] ?? draftFor(row);
        const state = workflow(row);
        const isOpen = openId === row.person.id;
        const isMixed = draft.billingCurrency === "MIXED";
        const pct = isMixed ? Math.min(100, Math.max(0, Number(draft.usdPercentage) || 0)) : draft.billingCurrency === "USD" ? 100 : 0;
        const planned = Number(row.system.totalARS ?? 0) * pct / 100;
        const published = row.settlement?.status === "published";
        return <Card key={row.person.id} className={state.group === "admin" ? "border-indigo-200" : state.group === "done" ? "border-emerald-200" : ""}>
          <CardHeader className="p-0">
            <button type="button" className="flex w-full items-center gap-4 px-5 py-4 text-left" onClick={() => setOpenId(isOpen ? null : row.person.id)} aria-expanded={isOpen}>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${state.group === "done" ? "bg-emerald-100 text-emerald-700" : state.group === "admin" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-700"}`}>{state.step}</span>
              <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{row.person.name}</span><span className="block truncate text-xs text-muted-foreground">{row.person.contractType} · {row.person.email || "Sin email vinculado"}</span><span className="mt-0.5 block text-xs font-medium text-indigo-700 md:hidden">{state.label}</span></span>
              <span className="hidden text-right sm:block"><span className="block text-xs text-muted-foreground">Total del cierre</span><span className="block font-semibold tabular-nums">{ars(row.system.totalARS)}</span></span>
              <StageBadge tone={state.tone} label={state.label} />
              <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
          </CardHeader>
          {isOpen && <CardContent className="space-y-4 border-t pt-5">
            {!row.closing ? <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>Falta el cierre operativo. Cerrá primero sus horas en Operaciones → Cierre mensual; recién entonces Mind congela el valor hora y el total.</span></div> : <>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mind completa automáticamente</p>
                <div className="grid gap-3 sm:grid-cols-3"><ReadOnly label="Horas del cierre" value={`${Number(row.system.hours ?? 0).toFixed(1)} h`} /><ReadOnly label="Valor hora ARS" value={ars(row.system.hourlyRateARS)} /><ReadOnly label="Número a cobrar en ARS" value={ars(row.system.totalARS)} /></div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Administración completa</p><p className="text-sm text-muted-foreground">Son los únicos campos variables que antes estaban en amarillo.</p></div>
                  {row.suggestion && <Button size="sm" variant="outline" onClick={() => {
                    update(row.person.id, "billingCurrency", normalizeBillingCurrency(row.suggestion?.billingCurrency));
                    update(row.person.id, "usdPercentage", String(row.suggestion?.usdPercentage ?? 0));
                  }}><WandSparkles className="mr-2 h-3.5 w-3.5" />Usar {periodLabel(row.suggestion.sourcePeriod)}</Button>}
                </div>
                <div className={`grid gap-4 ${isMixed ? "lg:grid-cols-4" : "lg:grid-cols-2"}`}>
                  <div><Label>Cómo factura este mes</Label><Select value={draft.billingCurrency} onValueChange={(value: BillingCurrency) => {
                    update(row.person.id, "billingCurrency", value);
                    if (value !== "MIXED") {
                      update(row.person.id, "usdPercentage", value === "USD" ? "100" : "0");
                      update(row.person.id, "bonusUSD", "0");
                      update(row.person.id, "extrasARS", "0");
                    }
                  }}><SelectTrigger className="mt-1.5 bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ARS">Sólo ARS</SelectItem><SelectItem value="USD">Sólo USD</SelectItem><SelectItem value="MIXED">USD + ARS</SelectItem></SelectContent></Select><p className="mt-1 text-xs text-muted-foreground">Se define por mes.</p></div>
                  {isMixed && <><div><Label htmlFor={`pct-${row.person.id}`}>% a facturar en USD</Label><Input id={`pct-${row.person.id}`} className="mt-1.5 bg-white" type="number" min="0" max="100" step="0.01" value={draft.usdPercentage} onChange={(event) => update(row.person.id, "usdPercentage", event.target.value)} /></div><div><Label htmlFor={`bonus-${row.person.id}`}>Extras / bono en USD</Label><Input id={`bonus-${row.person.id}`} className="mt-1.5 bg-white" type="number" min="0" step="0.01" value={draft.bonusUSD} onChange={(event) => update(row.person.id, "bonusUSD", event.target.value)} /></div><div><Label htmlFor={`extra-${row.person.id}`}>Extras ARS</Label><Input id={`extra-${row.person.id}`} className="mt-1.5 bg-white" type="number" min="0" step="0.01" value={draft.extrasARS} onChange={(event) => update(row.person.id, "extrasARS", event.target.value)} /></div></>}
                </div>
              </div>

              {isMixed ? <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4"><div className="flex items-center gap-2"><Calculator className="h-4 w-4 text-indigo-600" /><p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Mind calcula y el colaborador completa los dos TC</p></div><div className="mt-3 grid gap-3 sm:grid-cols-3"><ReadOnly label="Pesos a cobrar en USD" value={ars(planned)} /><ReadOnly label="USD a facturar" value={row.settlement?.invoiceFx ? usd(planned / row.settlement.invoiceFx + Number(draft.bonusUSD || 0)) : "Se calcula con su TC"} /><ReadOnly label="Diferencia final ARS" value={row.settlement?.finalInvoiceARS == null ? "Se calcula al cobrar" : ars(row.settlement.finalInvoiceARS)} /></div></div> : <div className="rounded-lg border bg-slate-50 p-3 text-sm text-muted-foreground">{draft.billingCurrency === "USD" ? "Mind usa el total del cierre como base y la persona adjunta su comprobante en USD." : "Mind usa directamente el total ARS del cierre. No se piden porcentajes ni doble tipo de cambio."}</div>}

              {published && <div className="grid gap-3 sm:grid-cols-3"><ProgressItem done={Boolean(row.settlement?.invoiceFx) || !isMixed} label={isMixed ? "TC al facturar" : "Liquidación publicada"} /><ProgressItem done={Boolean(row.settlement?.receivedFx) || !isMixed} label={isMixed ? "TC al cobrar" : "Esperando factura"} /><ProgressItem done={Boolean(row.invoice)} label={row.invoice ? `${row.invoice.documentCount || 1} comprobante${(row.invoice.documentCount || 1) === 1 ? "" : "s"} · ${row.invoice.approvalStatus === "approved" ? "aprobada" : row.invoice.approvalStatus === "rejected" ? "a corregir" : "en revisión"}` : "Comprobantes pendientes"} /></div>}

              <div><Label htmlFor={`notes-${row.person.id}`}>Indicaciones para la persona <span className="font-normal text-muted-foreground">(opcional)</span></Label><Textarea id={`notes-${row.person.id}`} className="mt-1.5" rows={2} value={draft.adminNotes} onChange={(event) => update(row.person.id, "adminNotes", event.target.value)} placeholder="Ej. El bono corresponde al proyecto X" /></div>
              <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">{published ? "Los cambios se hacen visibles recién cuando actualizás la publicación." : "Guardar borrador no avisa al colaborador. Publicar habilita su siguiente paso."}</p><div className="flex gap-2">{!published && <Button variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ row, publish: false })}>Guardar borrador</Button>}<Button disabled={mutation.isPending || !row.person.email} onClick={() => mutation.mutate({ row, publish: true })}>{mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}{published ? "Actualizar publicación" : "Publicar"}</Button></div></div>
            </>}
          </CardContent>}
        </Card>;
      })}
    </div>
  </div>;
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border bg-white p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold tabular-nums">{value}</p></div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof UsersRound; label: string; value: string }) {
  return <Card><CardContent className="flex items-center gap-3 p-4"><span className="rounded-lg bg-indigo-50 p-2 text-indigo-600"><Icon className="h-5 w-5" /></span><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{value}</p></div></CardContent></Card>;
}

function WorkflowStep({ number, label, detail, active, done }: { number: number; label: string; detail: string; active?: boolean; done?: boolean }) {
  return <div className={`flex items-center gap-3 rounded-xl border p-3 ${active ? "border-indigo-200 bg-indigo-50/50" : done ? "border-emerald-200 bg-emerald-50/50" : "bg-white"}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${done ? "bg-emerald-600 text-white" : active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>{done ? <Check className="h-4 w-4" /> : number}</span><span><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-muted-foreground">{detail}</span></span></div>;
}

function StageBadge({ tone, label }: { tone: "amber" | "indigo" | "emerald" | "blue" | "rose"; label: string }) {
  const colors = { amber: "border-amber-200 bg-amber-50 text-amber-800", indigo: "border-indigo-200 bg-indigo-50 text-indigo-800", emerald: "border-emerald-200 bg-emerald-50 text-emerald-800", blue: "border-blue-200 bg-blue-50 text-blue-800", rose: "border-rose-200 bg-rose-50 text-rose-800" };
  return <Badge variant="outline" className={`hidden whitespace-nowrap md:inline-flex ${colors[tone]}`}>{label}</Badge>;
}

function ProgressItem({ done, label }: { done: boolean; label: string }) {
  return <div className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${done ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "bg-slate-50 text-muted-foreground"}`}>{done ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <Clock3 className="h-4 w-4 shrink-0" />}<span>{label}</span></div>;
}
