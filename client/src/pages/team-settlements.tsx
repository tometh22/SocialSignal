import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { authFetchJson } from "@/lib/queryClient";
import { AlertCircle, Calculator, CheckCircle2, Loader2, Search, Send, UsersRound } from "lucide-react";

type Settlement = {
  id: number;
  status: "draft" | "published";
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
};

type Draft = { usdPercentage: string; bonusUSD: string; extrasARS: string; adminNotes: string };

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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
  const [scope, setScope] = useState("mixed");
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const query = useQuery<SettlementRow[]>({
    queryKey: ["personnel-settlements", period],
    queryFn: () => authFetchJson(`/api/finance/personnel-settlements?period=${period}`),
  });

  useEffect(() => {
    if (!query.data) return;
    setDrafts(Object.fromEntries(query.data.map((row) => [row.person.id, {
      usdPercentage: String(row.settlement?.usdPercentage ?? (row.person.billingCurrency?.toUpperCase() === "USD" ? 100 : 0)),
      bonusUSD: String(row.settlement?.bonusUSD ?? 0),
      extrasARS: String(row.settlement?.extrasARS ?? 0),
      adminNotes: row.settlement?.adminNotes ?? "",
    }])));
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: ({ row, publish }: { row: SettlementRow; publish: boolean }) => {
      const draft = drafts[row.person.id];
      return authFetchJson(`/api/finance/personnel-settlements/${row.person.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, ...draft, publish }),
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["personnel-settlements", period] });
      toast({
        title: variables.publish ? "Liquidación publicada" : "Borrador guardado",
        description: variables.publish ? `${variables.row.person.name} ya puede ver qué debe facturar.` : "Los cambios quedaron guardados sin mostrarse al colaborador.",
      });
    },
    onError: (error: Error) => toast({ title: "No se pudo guardar", description: error.message, variant: "destructive" }),
  });

  const rows = useMemo(() => (query.data ?? []).filter((row) => {
    if (scope === "mixed" && row.person.billingCurrency?.toUpperCase() !== "MIXED") return false;
    return `${row.person.name} ${row.person.email ?? ""}`.toLowerCase().includes(search.trim().toLowerCase());
  }), [query.data, scope, search]);
  const published = (query.data ?? []).filter((row) => row.settlement?.status === "published").length;
  const mixed = (query.data ?? []).filter((row) => row.person.billingCurrency?.toUpperCase() === "MIXED").length;

  const update = (personId: number, field: keyof Draft, value: string) => setDrafts((current) => ({
    ...current,
    [personId]: { ...(current[personId] ?? { usdPercentage: "0", bonusUSD: "0", extrasARS: "0", adminNotes: "" }), [field]: value },
  }));

  return <div className="mx-auto max-w-7xl space-y-6">
    <div>
      <p className="text-sm font-medium text-indigo-600">Carga financiera</p>
      <h1 className="text-3xl font-semibold tracking-tight">Liquidaciones del equipo</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Definí la parte variable del cierre y publicá instrucciones exactas. Las horas, el valor hora y el total ARS vienen del cierre operativo; acá sólo se cargan el porcentaje USD y los adicionales.</p>
    </div>

    <div className="grid gap-3 sm:grid-cols-3">
      <Metric icon={UsersRound} label="Personas con esquema mixto" value={String(mixed)} />
      <Metric icon={CheckCircle2} label="Liquidaciones publicadas" value={String(published)} />
      <Metric icon={Calculator} label="Cálculos manuales" value="0" detail="Mind reemplaza las fórmulas del Excel" />
    </div>

    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Período y equipo</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row">
        <div className="w-full sm:w-52"><Label htmlFor="settlement-period">Mes de cierre</Label><Input id="settlement-period" className="mt-1.5" type="month" value={period} onChange={(event) => setPeriod(event.target.value)} /></div>
        <div className="w-full sm:w-60"><Label>Personas</Label><Select value={scope} onValueChange={setScope}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="mixed">Sólo facturación mixta</SelectItem><SelectItem value="all">Todo el equipo</SelectItem></SelectContent></Select></div>
        <div className="min-w-0 flex-1"><Label htmlFor="settlement-search">Buscar</Label><div className="relative mt-1.5"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input id="settlement-search" className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre o email" /></div></div>
      </CardContent>
    </Card>

    {query.isLoading && <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando cierres…</div>}
    {query.isError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">No pudimos cargar las liquidaciones. Actualizá la página o revisá tu acceso de Finanzas.</div>}
    {!query.isLoading && !rows.length && <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">No hay personas para este filtro.</div>}

    <div className="space-y-4">
      {rows.map((row) => {
        const draft = drafts[row.person.id] ?? { usdPercentage: "0", bonusUSD: "0", extrasARS: "0", adminNotes: "" };
        const isMixed = row.person.billingCurrency?.toUpperCase() === "MIXED";
        const pct = isMixed ? Math.min(100, Math.max(0, Number(draft.usdPercentage) || 0)) : row.person.billingCurrency?.toUpperCase() === "USD" ? 100 : 0;
        const planned = Number(row.system.totalARS ?? 0) * pct / 100;
        return <Card key={row.person.id} className={row.settlement?.status === "published" ? "border-emerald-200" : ""}>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle className="text-base">{row.person.name}</CardTitle><p className="text-xs text-muted-foreground">{row.person.email || "Sin email vinculado"} · {row.person.contractType} · {isMixed ? "USD + ARS" : row.person.billingCurrency}</p></div><Badge variant="outline" className={row.settlement?.status === "published" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50"}>{row.settlement?.status === "published" ? "Publicada" : "Borrador"}</Badge></div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!row.closing ? <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>Falta el cierre operativo. Cerrá primero sus horas en Operaciones → Cierre mensual; recién entonces Mind congela el valor hora y el total.</span></div> : <>
              <div className="grid gap-3 sm:grid-cols-3">
                <ReadOnly label="Horas del cierre" value={`${Number(row.system.hours ?? 0).toFixed(1)} h`} />
                <ReadOnly label="Valor hora ARS" value={ars(row.system.hourlyRateARS)} />
                <ReadOnly label="Total a cobrar ARS" value={ars(row.system.totalARS)} />
              </div>
              {isMixed ? <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div><Label htmlFor={`pct-${row.person.id}`}>% a facturar en USD</Label><Input id={`pct-${row.person.id}`} className="mt-1.5" type="number" min="0" max="100" step="0.01" value={draft.usdPercentage} onChange={(event) => update(row.person.id, "usdPercentage", event.target.value)} /></div>
                  <div><Label htmlFor={`bonus-${row.person.id}`}>Extras / bono en USD</Label><Input id={`bonus-${row.person.id}`} className="mt-1.5" type="number" min="0" step="0.01" value={draft.bonusUSD} onChange={(event) => update(row.person.id, "bonusUSD", event.target.value)} /></div>
                  <div><Label htmlFor={`extra-${row.person.id}`}>Extras en ARS</Label><Input id={`extra-${row.person.id}`} className="mt-1.5" type="number" min="0" step="0.01" value={draft.extrasARS} onChange={(event) => update(row.person.id, "extrasARS", event.target.value)} /></div>
                </div>
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4"><p className="text-xs font-medium uppercase tracking-wide text-indigo-700">Resultado para el colaborador</p><div className="mt-2 grid gap-3 sm:grid-cols-3"><ReadOnly label="Pesos que convertirá a USD" value={ars(planned)} /><ReadOnly label="USD a facturar" value={row.settlement?.invoiceFx ? usd(planned / row.settlement.invoiceFx) : "Se calcula con su TC"} /><ReadOnly label="Saldo final ARS" value={row.settlement?.finalInvoiceARS == null ? "Se calcula al cobrar" : ars(row.settlement.finalInvoiceARS)} /></div></div>
              </> : <div className="rounded-lg border bg-slate-50 p-3 text-sm text-muted-foreground">Esta persona no tiene esquema mixto. Mind toma el total del cierre sin pedir porcentaje ni doble tipo de cambio.</div>}
              <div><Label htmlFor={`notes-${row.person.id}`}>Indicaciones para la persona <span className="font-normal text-muted-foreground">(opcional)</span></Label><Textarea id={`notes-${row.person.id}`} className="mt-1.5" rows={2} value={draft.adminNotes} onChange={(event) => update(row.person.id, "adminNotes", event.target.value)} placeholder="Ej. El bono corresponde al proyecto X" /></div>
              <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">Guardar borrador no notifica. Publicar hace visible la instrucción en “Mis facturas”.</p><div className="flex gap-2"><Button variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ row, publish: false })}>Guardar borrador</Button><Button disabled={mutation.isPending || !row.person.email} onClick={() => mutation.mutate({ row, publish: true })}>{mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Publicar</Button></div></div>
            </>}
          </CardContent>
        </Card>;
      })}
    </div>
  </div>;
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border bg-white p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold tabular-nums">{value}</p></div>;
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof UsersRound; label: string; value: string; detail?: string }) {
  return <Card><CardContent className="flex items-center gap-3 p-4"><span className="rounded-lg bg-indigo-50 p-2 text-indigo-600"><Icon className="h-5 w-5" /></span><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{value}</p>{detail && <p className="text-[11px] text-muted-foreground">{detail}</p>}</div></CardContent></Card>;
}
