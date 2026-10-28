import { settlementProgress as workflow } from "@shared/utils/settlement-progress";
import { settlementWorkflow as normalizeWorkflow, type SettlementWorkflow, type SettlementPhase } from "@shared/utils/settlement-workflow";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { usePermissions } from "@/hooks/use-permissions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
type SettlementRow = {
  person: { id: number; name: string; email: string | null; contractType: string; billingCurrency: string };
  closing: { id: number } | null;
  system: { hours: number | null; hourlyRateARS: number | null; totalARS: number | null };
  settlement: Settlement | null;
  suggestion: { sourcePeriod: string; billingCurrency: string; usdPercentage: number } | null;
  invoices: Array<{ id: number; invoiceComponent: "single" | "usd" | "ars"; invoiceCurrency?: string | null; approvalStatus: "pending" | "approved" | "rejected"; documentCount: number; uploadedAt: string; reviewReason: string | null }>;
};
type Draft = { version: number; billingCurrency: BillingCurrency; usdPercentage: string; bonusUSD: string; bonusARS: string; extrasARS: string; adminNotes: string };
type WorkflowGroup = "ops" | "team" | "review" | "done" | "no_close";

const EMPTY_DRAFT: Draft = { version: 0, billingCurrency: "ARS", usdPercentage: "0", bonusUSD: "0", bonusARS: "0", extrasARS: "0", adminNotes: "" };

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
    version: normalizeWorkflow(row.settlement?.workflow).version,
    billingCurrency: billingCurrency === "USD" ? "MIXED" : billingCurrency,
    usdPercentage: String(usdPercentage),
    bonusUSD: String(row.settlement?.bonusUSD ?? 0),
    bonusARS: String(row.settlement?.bonusARS ?? 0),
    extrasARS: String(row.settlement?.extrasARS ?? 0),
    adminNotes: row.settlement?.adminNotes ?? "",
  };
}


function ars(value: number | null | undefined) {
  return value == null ? "—" : new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(value);
}

function usd(value: number | null | undefined) {
  return value == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", currencyDisplay: "code", maximumFractionDigits: 2 }).format(value);
}

export default function TeamSettlements({ period, onDirtyChange, onGoToBase }: { period: string; onDirtyChange: (dirty: boolean) => void; onGoToBase: () => void }) {
  const [search, setSearch] = useState("");
  const dirtyIds = useRef(new Set<number>());
  const [focusedPersonId, setFocusedPersonId] = useState<number | null>(() => {
    const value = new URLSearchParams(window.location.search).get("personnelId") ?? "";
    return /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
  });
  const [scope, setScope] = useState(() => focusedPersonId ? "all" : "ops");
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  useEffect(() => { onDirtyChange(dirtyIds.current.size > 0); }, [drafts, onDirtyChange]);
  const [openId, setOpenId] = useState<number | null>(focusedPersonId);
  const [earlyTarget, setEarlyTarget] = useState<SettlementRow | null>(null);
  const [earlyReason, setEarlyReason] = useState("");
  const [earlyOpen, setEarlyOpen] = useState(false);
  const [earlyDraft, setEarlyDraft] = useState<Draft | undefined>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const cutoff = useQuery<{ state: string; day: string; canCut: boolean; canPublishEarly: boolean }>({
    queryKey: ["payroll-period", period], refetchInterval: 30000,
    queryFn: () => authFetchJson(`/api/payroll-period/${period}`),
  });
  const hoursOpen = cutoff.data?.state !== "cut";
  const cutoffLabel = cutoff.data?.day ? new Date(`${cutoff.data.day}T12:00:00-03:00`).toLocaleDateString("es-AR", { day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" }) : "la fecha indicada en Base a cobrar";
  const query = useQuery<SettlementRow[]>({
    queryKey: ["personnel-settlements", period],
    refetchOnWindowFocus: false,
    queryFn: () => authFetchJson(`/api/finance/personnel-settlements?period=${period}`),
  });

  useEffect(() => {
    if (!query.data) return;
    setDrafts(previous => Object.fromEntries(query.data.map(row => [row.person.id, dirtyIds.current.has(row.person.id) && previous[row.person.id] ? previous[row.person.id] : draftFor(row)])));
  }, [query.data]);

  const payloadFor = (row: SettlementRow, publish: boolean, draftOverride?: Draft) => ({ period, ...(draftOverride ?? drafts[row.person.id] ?? draftFor(row)), publish, expectedBase: { closingId: row.closing?.id, totalARS: row.system.totalARS, hours: row.system.hours } });
  const mutation = useMutation({
    mutationFn: ({ row, publish, earlyPublication, draftOverride }: { row: SettlementRow; publish: boolean; earlyPublication?: { confirmed: true; reason: string }; draftOverride?: Draft }) => authFetchJson(`/api/finance/personnel-settlements/${row.person.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payloadFor(row, publish, draftOverride), earlyPublication }),
    }),
    onSuccess: (_data, variables) => {
      dirtyIds.current.delete(variables.row.person.id);
      setEarlyOpen(false);
      if (variables.publish) setScope("team");
      queryClient.invalidateQueries({ queryKey: ["personnel-settlements", period] });
      toast({
        title: variables.publish ? (variables.row.settlement?.status === "published" ? "Publicación actualizada" : "Liquidación publicada") : "Borrador guardado",
        description: variables.publish ? `${variables.row.person.name} ya ve los importes e instrucciones vigentes.` : "Quedó preparado para que Operaciones lo revise antes de publicar.",
      });
    },
    onError: (error: Error) => { queryClient.invalidateQueries({ queryKey: ["personnel-settlements", period] }); queryClient.invalidateQueries({ queryKey: ["payroll-period", period] }); toast({ title: "No se pudo guardar", description: error.message, variant: "destructive" }); },
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
  }, { ops: 0, team: 0, review: 0, done: 0, no_close: 0 } as Record<WorkflowGroup, number>), [allRows]);
  const rows = useMemo(() => allRows.filter((row) => {
    if (focusedPersonId && row.person.id !== focusedPersonId) return false;
    const group = workflow(row).group;
    if (scope !== "all" && scope !== "ready" && group !== scope) return false;
    if (scope === "ready" && !row.closing) return false;
    return `${row.person.name} ${row.person.email ?? ""}`.toLowerCase().includes(search.trim().toLowerCase());
  }), [allRows, scope, search, focusedPersonId]);

  const update = (personId: number, field: keyof Draft, value: string) => { dirtyIds.current.add(personId); setDrafts((current) => ({
    ...current,
    [personId]: { ...(current[personId] ?? EMPTY_DRAFT), [field]: value },
  })); };

  return <div className="min-w-0 space-y-5">
    <Dialog open={earlyOpen} onOpenChange={open => { if (!mutation.isPending) setEarlyOpen(open); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Publicar anticipadamente</DialogTitle><DialogDescription>Habilitá la facturación de {earlyTarget?.person.name} antes del corte general de {cutoffLabel}, a las 23:59 de Buenos Aires.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm"><p className="font-medium">Base a fijar: {ars(earlyTarget?.system.totalARS)}</p><p>{Number(earlyTarget?.system.hours ?? 0).toFixed(1)} horas · {periodLabel(period)}</p></div>
          <p className="text-sm">Esta base queda protegida para facturar. Las horas operativas de esta persona y del resto del equipo siguen abiertas hasta el corte general.</p>
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{earlyTarget?.person.contractType === "freelance" ? "Para freelancers, revisá que estén incluidas todas las horas a pagar. " : ""}Las horas cargadas después no se suman automáticamente a esta liquidación. El corte general conservará la base publicada.</p>
          <div className="space-y-1.5"><Label htmlFor="early-publication-reason">Motivo de la publicación anticipada</Label><Textarea id="early-publication-reason" value={earlyReason} onChange={event => setEarlyReason(event.target.value)} maxLength={2000} placeholder="Ej. Adelantar la factura del mes con la base ya revisada" /><p className="text-xs text-muted-foreground">Queda registrado con tu usuario y la fecha.</p></div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0"><Button variant="outline" disabled={mutation.isPending} onClick={() => setEarlyOpen(false)}>Volver</Button><Button disabled={mutation.isPending || earlyReason.trim().length < 5} onClick={() => { if (earlyTarget) mutation.mutate({ row: earlyTarget, publish: true, earlyPublication: { confirmed: true, reason: earlyReason }, draftOverride: earlyDraft }); }}>{mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar publicación anticipada</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h2 className="text-lg font-semibold">Facturación y seguimiento</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">La base del paso 1 se trae automáticamente. Publicá las condiciones y autorizá cada importe antes de que la persona facture. El colaborador carga los TC y extras en Mis facturas.</p>
      </div>
      <Button variant="outline" disabled={!bulkRows.length || bulkMutation.isPending} onClick={() => bulkMutation.mutate()}>
        {bulkMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}
        Preparar {bulkRows.length || ""} borrador{bulkRows.length === 1 ? "" : "es"}
      </Button>
    </div>

    <div role="status" className="rounded-xl border bg-muted/20 p-4 text-sm">
      {cutoff.isError ? <><p className="text-destructive">No se pudo verificar el corte. Podés guardar borradores; para publicar, reintentá la consulta.</p><Button variant="link" onClick={() => cutoff.refetch()}>Reintentar</Button></> : cutoff.isLoading ? <p>Consultando el corte de horas…</p> : <>
        <p className="font-medium">{hoursOpen ? cutoff.data?.canPublishEarly ? "Horas abiertas · podés publicar por persona" : "Mes futuro · sólo borradores" : "Corte general realizado · podés publicar"}</p>
        <p className="mt-1 text-muted-foreground">{hoursOpen ? `El corte general está previsto para el ${cutoffLabel} a las 23:59, hora de Buenos Aires. Guardar la base no realiza ese corte. Podés guardar un borrador o publicar anticipadamente fijando la base de esa persona.` : "Las horas ya tienen corte. Publicá las condiciones de cada persona para que complete su siguiente paso en Mis facturas."}</p>
        {hoursOpen && !cutoff.data?.canPublishEarly && <p className="mt-2 text-amber-900">Este mes todavía no comenzó. Podés preparar borradores; la publicación se habilita durante el mes trabajado.</p>}
        <Button variant="link" className="mt-1 h-auto px-0" onClick={onGoToBase}>Ver base y corte general</Button>
      </>}
    </div>

    {focusedPersonId && <div className="flex flex-col gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"><p>Mostrando el cierre de {allRows.find(row => row.person.id === focusedPersonId)?.person.name ?? "la persona seleccionada"}.</p><Button variant="outline" size="sm" onClick={() => { setFocusedPersonId(null); const url = new URL(window.location.href); url.searchParams.delete("personnelId"); window.history.replaceState(window.history.state, "", url); }}>Ver todo el equipo</Button></div>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Metric icon={Calculator} label="Para Operaciones" value={String(counts.ops)} onSelect={() => setScope("ops")} />
      <Metric icon={Clock3} label="Para el equipo" value={String(counts.team)} onSelect={() => setScope("team")} />
      <Metric icon={FileCheck2} label="En Administración" value={String(counts.review)} onSelect={() => setScope("review")} />
      <Metric icon={CheckCircle2} label="Completas" value={String(counts.done)} onSelect={() => setScope("done")} />
    </div>

    <Card>
      <CardHeader className="pb-3"><p className="font-semibold">¿Qué requiere atención en {periodLabel(period)}?</p></CardHeader>
      <CardContent className="flex flex-col gap-3 lg:flex-row">
        <div className="w-full lg:w-72"><Label htmlFor="settlement-scope">Estado del flujo</Label><Select value={scope} onValueChange={setScope}><SelectTrigger id="settlement-scope" className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ops">Acción de Operaciones ({counts.ops})</SelectItem><SelectItem value="team">Esperando al equipo ({counts.team})</SelectItem><SelectItem value="review">En Administración ({counts.review})</SelectItem><SelectItem value="done">Completas ({counts.done})</SelectItem><SelectItem value="ready">Con cierre operativo</SelectItem><SelectItem value="no_close">Sin cierre operativo ({counts.no_close})</SelectItem><SelectItem value="all">Todo el equipo</SelectItem></SelectContent></Select></div>
        <div className="min-w-0 flex-1"><Label htmlFor="settlement-search">Buscar</Label><div className="relative mt-1.5"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input id="settlement-search" className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre o email" /></div></div>
      </CardContent>
    </Card>

    {query.isLoading && <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando cierres…</div>}
    {query.isError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">No pudimos cargar las liquidaciones. Actualizá la página o revisá tu acceso de Operaciones.</div>}
    {!query.isLoading && !query.isError && !rows.length && <div className="rounded-xl border border-dashed p-10 text-center">
      <p className="font-medium">No hay personas en este estado para {periodLabel(period)}.</p>
      <p className="mt-1 text-sm text-muted-foreground">{allRows.length ? "Probá otro estado o quitá la búsqueda para ver al resto del equipo." : "Prepará las bases en el paso 1 para comenzar."}</p>
      {allRows.length > 0 && <Button className="mt-4" variant="outline" onClick={() => { setScope("all"); setSearch(""); setFocusedPersonId(null); }}>Ver todo el equipo</Button>}
    </div>}

    <div className="space-y-3">
      {rows.map((row) => {
        const draft = drafts[row.person.id] ?? draftFor(row);
        const state = workflow(row);
        const isOpen = openId === row.person.id;
        const isMixed = draft.billingCurrency !== "ARS";
        const pct = isMixed ? Math.min(100, Math.max(0, Number(draft.usdPercentage) || 0)) : draft.billingCurrency === "USD" ? 100 : 0;
        const planned = Number(row.system.totalARS ?? 0) * pct / 100;
        const published = row.settlement?.status === "published";
        const flow = normalizeWorkflow(row.settlement?.workflow);
        const conditionsLocked = (row.invoices ?? []).length > 0 || [flow.usd.status, flow.ars.status].some(s => s === "pending" || s === "approved");
        return <Card key={row.person.id} className={state.group === "ops" ? "border-indigo-200" : state.group === "done" ? "border-emerald-200" : ""}>
          <CardHeader className="p-0 sm:p-0">
            <button type="button" className="flex w-full items-center gap-4 px-5 py-4 text-left" onClick={() => setOpenId(isOpen ? null : row.person.id)} aria-expanded={isOpen}>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${state.group === "done" ? "bg-emerald-100 text-emerald-700" : state.group === "ops" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-700"}`}>{state.step}</span>
              <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{row.person.name}</span><span className="block truncate text-xs text-muted-foreground">{row.person.contractType} · {row.person.email || "Sin email vinculado"}</span><span className="mt-0.5 block text-xs font-medium text-indigo-700 md:hidden">{state.label}</span></span>
              <span className="hidden text-right sm:block"><span className="block text-xs text-muted-foreground">Base del mes</span><span className="block font-semibold tabular-nums">{ars(row.system.totalARS)}</span></span>
              <StageBadge tone={state.tone} label={state.label} />
              <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
          </CardHeader>
          {isOpen && <CardContent className="space-y-4 border-t pt-5 sm:pt-6">
            {!row.closing ? <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>Falta el cierre operativo. Prepará primero su base en el paso 1: Base a cobrar. Después podés publicar sus condiciones, también antes del corte general.</span></div> : <>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mind completa automáticamente</p>
                <div className="grid gap-3 sm:grid-cols-3"><ReadOnly label="Horas del cierre" value={`${Number(row.system.hours ?? 0).toFixed(1)} h`} /><ReadOnly label="Valor hora ARS" value={ars(row.system.hourlyRateARS)} /><ReadOnly label="Base del mes en ARS" value={ars(row.system.totalARS)} /></div>
              </div>

              {flow.publication?.beforeCut && <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm"><p className="font-medium">Publicada antes del corte general · base protegida</p><p className="mt-1">{flow.publication.reason}</p></div>}
              {published && <InvoiceReviewHandoff row={row} period={period} />}
              {published && <SettlementAuthorization row={row} period={period} />}
              <fieldset disabled={conditionsLocked} className="min-w-0 rounded-xl border border-amber-200 bg-amber-50/40 p-3 sm:p-4">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Operaciones completa</p><p className="text-sm text-muted-foreground">Definí la distribución y los adicionales. Los TC bancarios los carga el colaborador; los importes quedan sujetos a tu autorización.</p></div>
                  {row.suggestion && <Button size="sm" variant="outline" onClick={() => {
                    update(row.person.id, "billingCurrency", normalizeBillingCurrency(row.suggestion?.billingCurrency) === "USD" ? "MIXED" : normalizeBillingCurrency(row.suggestion?.billingCurrency));
                    update(row.person.id, "usdPercentage", String(row.suggestion?.usdPercentage ?? 0));
                  }}><WandSparkles className="mr-2 h-3.5 w-3.5" />Usar {periodLabel(row.suggestion.sourcePeriod)}</Button>}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><Label htmlFor={`billing-${row.person.id}`}>Cómo factura este mes</Label><Select value={draft.billingCurrency} onValueChange={(value: BillingCurrency) => { update(row.person.id, "billingCurrency", value); if (value === "ARS") { update(row.person.id, "usdPercentage", "0"); update(row.person.id, "bonusUSD", "0"); } }}><SelectTrigger id={`billing-${row.person.id}`} className="mt-1.5 bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ARS">Sólo ARS</SelectItem><SelectItem value="MIXED">USD + ARS</SelectItem></SelectContent></Select></div>
                  {isMixed && <div><Label htmlFor={`pct-${row.person.id}`}>Porcentaje de la base en USD</Label><Input id={`pct-${row.person.id}`} className="mt-1.5 bg-white" type="number" min="0" max="100" step="0.01" value={draft.usdPercentage} onChange={event => update(row.person.id, "usdPercentage", event.target.value)} /></div>}
                </div>
                <div className={`mt-4 grid gap-4 ${isMixed ? "lg:grid-cols-3" : "sm:grid-cols-2"}`}>
                  {isMixed && <div><Label htmlFor={`bonus-${row.person.id}`}>Bono en USD</Label><Input id={`bonus-${row.person.id}`} className="mt-1.5 bg-white" type="number" min="0" step="0.01" value={draft.bonusUSD} onChange={event => update(row.person.id, "bonusUSD", event.target.value)} /></div>}
                  <div><Label htmlFor={`bonus-ars-${row.person.id}`}>Bono en ARS</Label><Input id={`bonus-ars-${row.person.id}`} className="mt-1.5 bg-white" type="number" min="0" step="0.01" value={draft.bonusARS} onChange={event => update(row.person.id, "bonusARS", event.target.value)} /></div>
                  <div><Label htmlFor={`extras-ars-${row.person.id}`}>Otros adicionales ARS</Label><Input id={`extras-ars-${row.person.id}`} className="mt-1.5 bg-white" type="number" min="0" step="0.01" value={draft.extrasARS} onChange={event => update(row.person.id, "extrasARS", event.target.value)} /><p className="mt-1 text-xs text-muted-foreground">Monotributo u otros reintegros: podés incluirlos acá o agregarlos después en Mis facturas, sin duplicarlos.</p></div>
                </div>
                {conditionsLocked && <p className="mt-2 text-sm text-muted-foreground">Condiciones congeladas: ya hay importes enviados o facturas.</p>}
              </fieldset>

              {isMixed ? <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4"><div className="flex items-center gap-2"><Calculator className="h-4 w-4 text-indigo-600" /><p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Mind calcula y el colaborador completa los dos TC</p></div><div className="mt-3 grid gap-3 sm:grid-cols-3"><ReadOnly label="Pesos a cobrar en USD" value={ars(planned)} /><ReadOnly label="USD a facturar" value={row.settlement?.invoiceFx ? usd(planned / row.settlement.invoiceFx + Number(draft.bonusUSD || 0)) : "Se calcula con su TC"} /><ReadOnly label="Diferencia final ARS" value={row.settlement?.finalInvoiceARS == null ? "Se calcula al cobrar" : ars(row.settlement.finalInvoiceARS)} /></div></div> : <div className="rounded-lg border bg-slate-50 p-3 text-sm text-muted-foreground">{draft.billingCurrency === "USD" ? "Mind usa el total del cierre como base y la persona adjunta su comprobante en USD." : "Mind usa directamente el total ARS del cierre. La persona agrega extras y envía el importe a autorización. No se pide tipo de cambio."}</div>}

              {published && <div className={`grid gap-3 ${isMixed ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}><ProgressItem done={Boolean(row.settlement?.invoiceFx) || !isMixed} label={isMixed ? "TC al facturar" : "Liquidación publicada"} />{isMixed && <InvoiceProgress invoice={invoiceForPhase(row, "usd")} label="Factura USD" />}<ProgressItem done={isMixed ? Boolean(row.settlement?.receivedFx) : (row.invoices ?? []).some(i => i.invoiceComponent === "single")} label={isMixed ? "TC al cobrar" : "Factura adjunta"} /><InvoiceProgress invoice={invoiceForPhase(row, "ars")} label="Factura ARS" /></div>}

              <div><Label htmlFor={`notes-${row.person.id}`}>Indicaciones para la persona <span className="font-normal text-muted-foreground">(opcional)</span></Label><Textarea disabled={conditionsLocked} id={`notes-${row.person.id}`} className="mt-1.5" rows={2} value={draft.adminNotes} onChange={(event) => update(row.person.id, "adminNotes", event.target.value)} placeholder="Ej. El bono corresponde al proyecto X" /></div>
              <div className="flex flex-col gap-2 border-t pt-4 lg:flex-row lg:items-center lg:justify-between"><p className="text-xs text-muted-foreground">{published ? "Los cambios se hacen visibles recién cuando actualizás la publicación." : "Guardar borrador no avisa al colaborador. Publicar habilita su siguiente paso."}</p><div className="flex flex-col gap-2 sm:flex-row">{!published && <Button variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ row, publish: false })}>Guardar borrador</Button>}<Button disabled={conditionsLocked || mutation.isPending || !row.person.email || cutoff.isLoading || cutoff.isError || (hoursOpen && !cutoff.data?.canPublishEarly)} onClick={() => { if (hoursOpen && !published) { setEarlyReason(""); setEarlyDraft({ ...draft }); setEarlyTarget(row); setEarlyOpen(true); } else mutation.mutate({ row, publish: true }); }}>{mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}{published ? "Actualizar publicación" : hoursOpen ? "Publicar anticipadamente" : "Publicar"}</Button></div></div>
            </>}
          </CardContent>}
        </Card>;
      })}
    </div>
  </div>;
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-lg border bg-white p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words font-semibold tabular-nums">{value}</p></div>;
}

function Metric({ icon: Icon, label, value, onSelect }: { icon: typeof UsersRound; label: string; value: string; onSelect: () => void }) {
  return <button type="button" onClick={onSelect} className="flex min-w-0 items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Icon className="hidden h-5 w-5 shrink-0 text-indigo-600 sm:block" /><span><span className="block text-xs text-muted-foreground">{label}</span><span className="block text-xl font-semibold">{value}</span></span></button>;
}

function StageBadge({ tone, label }: { tone: "amber" | "indigo" | "emerald" | "blue" | "rose"; label: string }) {
  const colors = { amber: "border-amber-200 bg-amber-50 text-amber-800", indigo: "border-indigo-200 bg-indigo-50 text-indigo-800", emerald: "border-emerald-200 bg-emerald-50 text-emerald-800", blue: "border-blue-200 bg-blue-50 text-blue-800", rose: "border-rose-200 bg-rose-50 text-rose-800" };
  return <Badge variant="outline" className={`hidden whitespace-nowrap md:inline-flex ${colors[tone]}`}>{label}</Badge>;
}

function ProgressItem({ done, label }: { done: boolean; label: string }) {
  return <div className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${done ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "bg-slate-50 text-muted-foreground"}`}>{done ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <Clock3 className="h-4 w-4 shrink-0" />}<span>{label}</span></div>;
}

function invoiceForPhase(row: SettlementRow, phase: SettlementPhase) {
  return row.invoices.find(invoice => invoice.invoiceComponent === phase || (invoice.invoiceComponent === "single" && (invoice.invoiceCurrency?.toUpperCase() === phase.toUpperCase() || (!invoice.invoiceCurrency && phase === "ars" && row.settlement?.billingCurrencySnapshot.toUpperCase() === "ARS"))));
}

function InvoiceProgress({ invoice, label }: { invoice?: SettlementRow["invoices"][number]; label: string }) {
  if (!invoice || invoice.approvalStatus === "approved") return <ProgressItem done={invoice?.approvalStatus === "approved"} label={label} />;
  const rejected = invoice.approvalStatus === "rejected";
  return <div className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${rejected ? "border-rose-200 bg-rose-50 text-rose-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
    {rejected ? <AlertCircle className="h-4 w-4 shrink-0" /> : <Clock3 className="h-4 w-4 shrink-0" />}<span>{label} · {rejected ? "corregir" : "en revisión"}</span>
  </div>;
}

function InvoiceReviewHandoff({ row, period }: { row: SettlementRow; period: string }) {
  const { hasPermission } = usePermissions();
  const pending = row.invoices.filter(invoice => invoice.approvalStatus === "pending");
  if (!pending.length) return null;
  return <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
    <p className="font-semibold">Siguiente paso: revisar el comprobante en Administración</p>
    <p>El importe ya está autorizado. Falta revisar la factura adjunta en Facturas del equipo; las condiciones permanecen protegidas durante esa revisión.</p>
    {pending.map(invoice => {
      const currency = invoice.invoiceCurrency?.toUpperCase() ?? (invoice.invoiceComponent === "usd" ? "USD" : "ARS");
      return <div key={invoice.id} className="space-y-2">
        {hasPermission("finance") ? <Button asChild className="h-auto min-h-10 whitespace-normal"><Link href={`/finance/facturas-equipo?period=${encodeURIComponent(period)}&invoiceId=${invoice.id}&personnelId=${row.person.id}`}>Revisar factura {currency}</Link></Button> : <p>Administración o Finanzas debe revisar el comprobante {currency}. Tu usuario puede autorizar importes, pero la revisión de facturas requiere acceso a Finanzas.</p>}
        <p className="text-muted-foreground">{currency === "USD" ? "Cuando Administración apruebe el comprobante y la persona reciba los USD, continúa en Mis facturas con el TC al cobrar y los extras." : "Al aprobar el comprobante se registra el Pasivo y se completa este tramo."}</p>
      </div>;
    })}
  </div>;
}

function SettlementAuthorization({ row, period }: { row: SettlementRow; period: string }) {
  const [reason, setReason] = useState("");
  const client = useQueryClient();
  const { toast } = useToast();
  const flow = normalizeWorkflow(row.settlement?.workflow);
  const usesUSD = Number(row.settlement?.usdPercentage) > 0 || Number(row.settlement?.bonusUSD) > 0;
  const canRequestCorrection = ([...(usesUSD ? ["usd"] : []), "ars"] as SettlementPhase[]).some(phase => flow[phase].status === "pending" || (flow[phase].status === "approved" && !invoiceForPhase(row, phase)));
  const mutation = useMutation({
    mutationFn: ({ phase, action }: { phase: SettlementPhase; action: string }) => authFetchJson(`/api/finance/personnel-settlements/${row.settlement!.id}/authorization`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phase, action, version: flow.version, reason }) }),
    onSuccess: () => { client.invalidateQueries({ queryKey: ["personnel-settlements", period] }); setReason(""); toast({ title: "Decisión guardada", description: "La persona recibe el siguiente paso en Mis facturas." }); },
    onError: (error: Error) => toast({ title: "No se pudo autorizar", description: error.message, variant: "destructive" }),
  });
  return <div className="space-y-3 rounded-xl border border-indigo-200 p-4"><p className="font-semibold">Autorizaciones antes de emitir</p>{(["usd", "ars"] as const).filter(phase => phase === "ars" || Number(row.settlement?.usdPercentage) > 0 || Number(row.settlement?.bonusUSD) > 0).map(phase => {
    const stage = flow[phase];
    const hasInvoice = Boolean(invoiceForPhase(row, phase));
    const details = phase === "usd"
      ? `TC al facturar: ${row.settlement?.invoiceFx ?? "pendiente"} · Bono USD: ${row.settlement?.bonusUSD ?? 0}`
      : [
          ...(usesUSD ? [`TC al cobrar: ${row.settlement?.receivedFx ?? "pendiente"}`] : []),
          `Bono ARS: ${ars(row.settlement?.bonusARS)}`,
          `Otros adicionales ARS: ${ars(row.settlement?.extrasARS)}`,
          `Extras colaborador: ${ars(flow.extrasARS)}`,
          ...(usesUSD ? [`Comisión USD: ${row.settlement?.bankCommissionUSD ?? 0}`] : []),
        ].join(" · ");
    return <div key={phase} className="space-y-2 rounded border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{phase === "usd" ? "Factura USD" : "Factura ARS"}: {phase === "usd" ? usd(stage.amount) : ars(stage.amount)}</span><Badge variant="outline" className="whitespace-normal">{{draft:"Esperando al colaborador",pending:"Requiere tu autorización",approved:"Importe autorizado",rejected:"Devuelto a corrección"}[stage.status]}</Badge></div><p className="text-sm text-muted-foreground">{details}</p>{phase === "ars" && flow.extrasReason && <p className="text-sm">{flow.extrasReason}</p>}{stage.status === "pending" && <div className="flex flex-col gap-2 sm:flex-row"><Button disabled={mutation.isPending} onClick={() => mutation.mutate({phase,action:"approve"})}>Autorizar {phase.toUpperCase()}</Button><Button variant="outline" disabled={mutation.isPending || reason.trim().length < 5} onClick={() => mutation.mutate({phase,action:"reject"})}>Pedir corrección</Button></div>}{stage.status === "approved" && !hasInvoice && <Button variant="outline" disabled={mutation.isPending || reason.trim().length < 5} onClick={() => mutation.mutate({phase,action:"reopen"})}>Devolver importe a corrección</Button>}</div>;
  })}{canRequestCorrection && <><Label htmlFor={`correction-${row.person.id}`}>Motivo para pedir una corrección</Label><Textarea id={`correction-${row.person.id}`} value={reason} onChange={e => setReason(e.target.value)} placeholder="Indicá qué debe revisar el colaborador" /></>}</div>;
}
