/**
 * Presupuesto — costos estimados y ventas estimadas del ejercicio.
 *
 * Reemplaza las solapas «Costos estimados» y las filas no confirmadas de
 * «Proyectos confirmados y estimados» del Máster. Una sola fuente por mes: los
 * meses que todavía informa el Máster se muestran como referencia y no se editan.
 */
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Copy, Database, Pencil, Plus, Receipt, Scale, Trash2, TrendingUp, Wallet } from "lucide-react";
import { useFinancePeriod } from "@/hooks/use-finance-period";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { QueryError } from "@/components/query-error";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { PageShell } from "@/components/ui/page-shell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { FinanceHeader, FinanceTableCard, StatusPill, formatUsd, periodLabel, useReasonDialog, type StatusTone } from "@/components/finance/ui";
import {
  BUDGET_COST_MODE_LABELS, budgetCostInputSchema, budgetCostUsesPuesto, budgetSaleInputSchema, computeBudgetCostAmounts,
  computeBudgetSaleAmounts, shiftBudgetPeriod, type BudgetCostMode, type BudgetCostRow, type BudgetMonth, type BudgetSaleRow,
} from "@shared/finance-budget";

type BudgetResponse = { year: number; months: BudgetMonth[]; subtipos: string[] };

const number = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const fmt = (value: number | null | undefined) => value == null ? "—" : number.format(value);
/** Acepta "1.500,50" (es-AR) y "1500.50". Vacío → null. */
function parseAmount(raw: string): number | null {
  const value = raw.trim().replace(/\s|USD|ARS|\$/gi, "");
  if (!value) return null;
  const normalized = value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(value) ? value.replace(/\./g, "") : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}
const toField = (value: number | null | undefined) => value == null ? "" : String(value).replace(".", ",");

const costBasisPill: Record<BudgetMonth["costBasis"], { tone: StatusTone; label: string }> = {
  master: { tone: "info", label: "Máster · solo lectura" },
  mind: { tone: "success", label: "Cargado en Mind" },
  master_fallback: { tone: "warning", label: "Referencia del Máster" },
  empty: { tone: "neutral", label: "Sin presupuesto" },
};

function costCalculation(row: BudgetCostRow) {
  const parts: string[] = [];
  if (row.horasUnidades != null && row.valorHora != null) parts.push(`${fmt(row.horasUnidades)} × ${row.monedaOriginalArs != null ? "ARS" : "USD"} ${fmt(row.valorHora)}`);
  else if (row.monedaOriginalArs != null) parts.push(`ARS ${fmt(row.monedaOriginalArs)}`);
  else if (row.monedaOriginalUsd != null) parts.push(`USD ${fmt(row.monedaOriginalUsd)}`);
  if (row.monedaOriginalArs != null && row.cotizacion) parts.push(`cotización ${fmt(row.cotizacion)}`);
  return parts.join(" · ") || "—";
}

export default function PresupuestoPage() {
  const { period } = useFinancePeriod();
  const year = Number(period.slice(0, 4));
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("finance");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const reason = useReasonDialog();
  const initiallyOpen = (value: string) => new Set([`cost:${value}`, `sale:${value}`]);
  const [expanded, setExpanded] = useState<Set<string>>(() => initiallyOpen(period));
  const [costForm, setCostForm] = useState<{ period: string; row?: BudgetCostRow } | null>(null);
  const [saleForm, setSaleForm] = useState<{ period: string; row?: BudgetSaleRow } | null>(null);
  useEffect(() => { setExpanded(initiallyOpen(period)); }, [period]);

  const budgetKey = `/api/finance/budget?year=${year}`;
  const budget = useQuery<BudgetResponse>({ queryKey: [budgetKey], queryFn: () => apiRequest(budgetKey, "GET") });
  const { data: clients } = useQuery<Array<{ id: number; name: string }>>({ queryKey: ["/api/clients"], enabled: canManage, staleTime: 300_000 });
  const months = budget.data?.months ?? [];

  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: [budgetKey] }),
    queryClient.invalidateQueries({ predicate: query => String(query.queryKey[0]).startsWith("/api/v2/executive/proyeccion") }),
  ]);
  const onError = (title: string) => (error: Error) => toast({ title, description: error.message, variant: "destructive" });
  const saveCost = useMutation({
    mutationFn: ({ id, body }: { id?: number; body: unknown }) => apiRequest(id ? `/api/finance/budget/costs/${id}` : "/api/finance/budget/costs", id ? "PATCH" : "POST", body),
    onSuccess: async (_, variables) => { await refresh(); setCostForm(null); toast({ title: variables.id ? "Costo actualizado" : "Costo agregado", description: "La Proyección ya usa el nuevo presupuesto." }); },
    onError: onError("No se pudo guardar el costo"),
  });
  const copyCosts = useMutation({
    mutationFn: (body: { from: string; to: string }) => apiRequest("/api/finance/budget/costs/copy", "POST", body),
    onSuccess: async (result: { count: number }, body) => { await refresh(); toast({ title: `${result.count} ${result.count === 1 ? "costo copiado" : "costos copiados"}`, description: `${periodLabel(body.to)} ya tiene presupuesto en Mind.` }); },
    onError: onError("No se pudo copiar"),
  });
  const saveSale = useMutation({
    mutationFn: ({ id, body }: { id?: number; body: unknown }) => apiRequest(id ? `/api/finance/budget/sales/${id}` : "/api/finance/budget/sales", id ? "PATCH" : "POST", body),
    onSuccess: async (_, variables) => { await refresh(); setSaleForm(null); toast({ title: variables.id ? "Venta actualizada" : "Venta estimada agregada" }); },
    onError: onError("No se pudo guardar la venta"),
  });
  const remove = useMutation({
    mutationFn: ({ kind, id, reason }: { kind: "costs" | "sales"; id: number; reason: string }) => apiRequest(`/api/finance/budget/${kind}/${id}`, "DELETE", { reason }),
    onSuccess: async () => { await refresh(); toast({ title: "Fila eliminada", description: "El cambio quedó registrado en la auditoría." }); },
    onError: onError("No se pudo eliminar"),
  });
  const askDelete = async (kind: "costs" | "sales", id: number, label: string) => {
    const text = await reason.ask({ title: `Eliminar ${label}`, description: "La fila deja de contar en la Proyección. Indicá por qué se elimina.", confirmLabel: "Eliminar", destructive: true });
    if (text) remove.mutate({ kind, id, reason: text });
  };

  const totals = useMemo(() => ({
    costs: months.reduce((sum, month) => sum + month.costTotalUsd, 0),
    sales: months.reduce((sum, month) => sum + month.salesTotalUsd, 0),
    weighted: months.reduce((sum, month) => sum + month.salesWeightedUsd, 0),
    master: months.filter(month => month.source === "master").length,
  }), [months]);
  const toggle = (key: string) => setExpanded(current => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });

  return <PageShell width="wide" spacing="compact">
    <FinanceHeader title={`Presupuesto ${year}`} description="Costos estimados y ventas estimadas de cada mes. En los meses que se registran en Mind alimentan la Proyección; las ventas no confirmadas se ponderan por su probabilidad." />
    <div data-testid="budget-source-rule" className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-3 text-sm text-sky-950">
      <Database className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" aria-hidden="true" />
      <p className="text-xs leading-5 text-sky-900/80"><span className="font-medium text-sky-950">Una sola fuente por mes.</span> Los meses que todavía informa el Máster se ven como referencia y se corrigen en la planilla. En los meses de Mind, el presupuesto que cargues acá reemplaza al de la solapa «Costos estimados»: nunca se suman los dos.</p>
    </div>
    {budget.isError && <QueryError message="No se pudo cargar el presupuesto. Los importes no disponibles se muestran como Sin datos." retry={() => void budget.refetch()} />}
    <MetricGrid>
      <MetricCard label="Costos estimados del año" value={budget.data ? formatUsd(totals.costs) : formatUsd(null)} icon={<Wallet />} tone="neutral" />
      <MetricCard label="Ventas estimadas" value={budget.data ? formatUsd(totals.sales) : formatUsd(null)} icon={<Receipt />} tone="info" detail="Monto completo, sin ponderar" />
      <MetricCard label="Ventas ponderadas" value={budget.data ? formatUsd(totals.weighted) : formatUsd(null)} icon={<TrendingUp />} tone="success" detail="Lo que suma la Proyección" />
      <MetricCard label="Meses del Máster" value={budget.data ? String(totals.master) : "—"} icon={<Scale />} tone={totals.master ? "warning" : "neutral"} detail="Solo lectura: se corrigen en la planilla" />
    </MetricGrid>

    <FinanceTableCard title="Costos estimados" description="Mismos campos que la solapa «Costos estimados» del Máster, agrupados por mes."
      loading={budget.isLoading} error={budget.isError} onRetry={budget.refetch} dimmed={budget.isFetching}>
      <div className="divide-y">{months.map(month => {
        const key = `cost:${month.period}`;
        const open = expanded.has(key);
        const pill = costBasisPill[month.costBasis];
        const editable = canManage && !month.editBlock.cost;
        const previous = shiftBudgetPeriod(month.period, -1);
        return <MonthBlock key={key} testId={`budget-costs-${month.period}`} period={month.period} open={open} onToggle={() => toggle(key)}
          pill={<StatusPill tone={pill.tone}>{pill.label}</StatusPill>} closeStatus={month.closeStatus}
          summary={<><span className="text-muted-foreground">{month.costs.length} {month.costs.length === 1 ? "fila" : "filas"}</span><span data-testid={`budget-cost-total-${month.period}`} className="font-semibold tabular-nums">Total {formatUsd(month.costTotalUsd)}</span></>}
          actions={editable ? <>
            <Button size="sm" variant="outline" onClick={() => setCostForm({ period: month.period })}><Plus className="mr-1.5 h-4 w-4" />Agregar costo</Button>
            {month.costBasis !== "mind" && <Button size="sm" variant="ghost" disabled={copyCosts.isPending} onClick={() => copyCosts.mutate({ from: previous, to: month.period })}><Copy className="mr-1.5 h-4 w-4" />Copiar el mes anterior</Button>}
            {month.costBasis === "master_fallback" && <Button size="sm" variant="ghost" disabled={copyCosts.isPending} onClick={() => copyCosts.mutate({ from: month.period, to: month.period })}>Usar estas filas como base</Button>}
          </> : null}>
          {month.editBlock.cost && <Note>{month.editBlock.cost}</Note>}
          {month.costBasis === "master_fallback" && !month.editBlock.cost && <Note tone="warning">Estas filas vienen de la solapa «Costos estimados» del Máster y se usan hasta que cargues el presupuesto del mes en Mind. Cuando agregues la primera fila en Mind dejan de sumar: usá «Usar estas filas como base» para conservarlas.</Note>}
          {month.ignoredCostRows > 0 && month.costBasis === "mind" && <Note>{month.ignoredCostRows} {month.ignoredCostRows === 1 ? "fila importada" : "filas importadas"} del Máster para este mes no se suman: el mes usa el presupuesto cargado en Mind.</Note>}
          {month.costs.length === 0 ? <p className="px-4 py-3 text-sm text-muted-foreground sm:px-5">No hay costos estimados en {periodLabel(month.period)}.</p> : <Table>
            <TableHeader><TableRow>
              <TableHead>Detalle</TableHead><TableHead>Subtipo de costo</TableHead><TableHead>Puesto</TableHead><TableHead>Cálculo</TableHead>
              <TableHead className="text-right">Monto USD</TableHead><TableHead className="w-px text-right"><span className="sr-only">Acciones</span></TableHead>
            </TableRow></TableHeader>
            <TableBody>{month.costs.map(row => <TableRow key={row.id}>
              <TableCell className="font-medium">{row.detalle || "—"}<span className="block text-xs font-normal text-muted-foreground">{row.native ? "Cargado en Mind" : "Máster"}</span></TableCell>
              <TableCell>{row.subtipoCosto || "—"}</TableCell>
              <TableCell>{row.puesto || "—"}</TableCell>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{costCalculation(row)}</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">{formatUsd(row.montoTotalUsd)}</TableCell>
              <TableCell className="whitespace-nowrap text-right">{editable && row.native && <RowActions label={row.detalle ?? "costo"} onEdit={() => setCostForm({ period: month.period, row })} onDelete={() => void askDelete("costs", row.id, row.detalle ?? "el costo")} />}</TableCell>
            </TableRow>)}</TableBody>
          </Table>}
        </MonthBlock>;
      })}</div>
    </FinanceTableCard>

    <FinanceTableCard title="Ventas estimadas" description="Ventas que todavía no se facturaron. Las confirmadas suman completas; las no confirmadas, según su probabilidad."
      loading={budget.isLoading} error={budget.isError} onRetry={budget.refetch} dimmed={budget.isFetching}>
      <div className="divide-y">{months.map(month => {
        const key = `sale:${month.period}`;
        const open = expanded.has(key);
        const editable = canManage && !month.editBlock.sale;
        return <MonthBlock key={key} testId={`budget-sales-${month.period}`} period={month.period} open={open} onToggle={() => toggle(key)}
          pill={month.source === "master" ? <StatusPill tone="info">Máster · solo lectura</StatusPill> : <StatusPill tone={month.sales.length ? "success" : "neutral"}>{month.sales.length ? "Cargado en Mind" : "Sin ventas estimadas"}</StatusPill>}
          closeStatus={month.closeStatus}
          summary={month.source === "master" ? <span className="text-muted-foreground">Ventas en la planilla</span> : <><span className="text-muted-foreground">{formatUsd(month.salesTotalUsd)}</span><span data-testid={`budget-sales-total-${month.period}`} className="font-semibold tabular-nums">Ponderado {formatUsd(month.salesWeightedUsd)}</span></>}
          actions={editable ? <Button size="sm" variant="outline" onClick={() => setSaleForm({ period: month.period })}><Plus className="mr-1.5 h-4 w-4" />Agregar venta</Button> : null}>
          {month.editBlock.sale && <Note>{month.editBlock.sale}</Note>}
          {month.invoicedUsd > 0 && month.sales.length > 0 && <Note tone="warning">Ya hay {formatUsd(month.invoicedUsd)} facturados en Mind este mes. Borrá o ajustá las ventas estimadas que ya se facturaron para no contarlas dos veces en la Proyección.</Note>}
          {month.source === "mind" && (month.sales.length === 0 ? <p className="px-4 py-3 text-sm text-muted-foreground sm:px-5">No hay ventas estimadas en {periodLabel(month.period)}.</p> : <Table>
            <TableHeader><TableRow>
              <TableHead>Cliente</TableHead><TableHead>Proyecto</TableHead><TableHead>Monto</TableHead><TableHead className="text-right">USD</TableHead>
              <TableHead>Estado</TableHead><TableHead className="text-right">Ponderado</TableHead><TableHead className="w-px text-right"><span className="sr-only">Acciones</span></TableHead>
            </TableRow></TableHeader>
            <TableBody>{month.sales.map(row => <TableRow key={row.id}>
              <TableCell className="font-medium">{row.clientName}{row.note && <span className="block max-w-[260px] truncate text-xs font-normal text-muted-foreground" title={row.note}>{row.note}</span>}</TableCell>
              <TableCell>{row.projectName || "—"}</TableCell>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{row.currency} {fmt(row.amountNative ?? row.amountUsd)}{row.currency === "ARS" && row.fxRate ? ` · cotización ${fmt(row.fxRate)}` : ""}</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">{formatUsd(row.amountUsd)}</TableCell>
              <TableCell>{row.confirmed ? <StatusPill tone="success">Confirmada</StatusPill> : <StatusPill tone="warning">{fmt(row.probability ?? 0)} % de probabilidad</StatusPill>}</TableCell>
              <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">{formatUsd(row.weightedUsd)}</TableCell>
              <TableCell className="whitespace-nowrap text-right">{editable && <RowActions label={row.clientName} onEdit={() => setSaleForm({ period: month.period, row })} onDelete={() => void askDelete("sales", row.id, `la venta de ${row.clientName}`)} />}</TableCell>
            </TableRow>)}</TableBody>
          </Table>)}
        </MonthBlock>;
      })}</div>
    </FinanceTableCard>

    {costForm && <CostDialog key={`${costForm.period}:${costForm.row?.id ?? "new"}`} initial={costForm} subtipos={budget.data?.subtipos ?? []} busy={saveCost.isPending}
      onClose={() => setCostForm(null)} onSubmit={body => saveCost.mutate({ id: costForm.row?.id, body })} />}
    {saleForm && <SaleDialog key={`${saleForm.period}:${saleForm.row?.id ?? "new"}`} initial={saleForm} clients={clients ?? []} busy={saveSale.isPending}
      onClose={() => setSaleForm(null)} onSubmit={body => saveSale.mutate({ id: saleForm.row?.id, body })} />}
    {reason.dialog}
  </PageShell>;
}

function MonthBlock({ testId, period, open, onToggle, pill, closeStatus, summary, actions, children }: {
  testId: string; period: string; open: boolean; onToggle: () => void; pill: ReactNode; closeStatus: string | null; summary: ReactNode; actions: ReactNode; children: ReactNode;
}) {
  return <section data-testid={testId} aria-label={periodLabel(period)}>
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
      <button type="button" onClick={onToggle} aria-expanded={open} className="inline-flex items-center gap-2 rounded-md text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
        {periodLabel(period)}
      </button>
      <div className="flex flex-1 flex-wrap items-center gap-2">{pill}{closeStatus === "CLOSED" && <StatusPill tone="neutral">Cerrado</StatusPill>}{closeStatus === "IN_REVIEW" && <StatusPill tone="neutral">En revisión</StatusPill>}</div>
      <div className="flex flex-wrap items-center gap-3 text-sm">{summary}</div>
    </div>
    {open && <div className="pb-3">
      {actions && <div className="flex flex-wrap gap-2 px-4 pb-2 sm:px-5">{actions}</div>}
      {children}
    </div>}
  </section>;
}

function Note({ tone = "info", children }: { tone?: "info" | "warning"; children: ReactNode }) {
  return <p className={cn("mx-4 mb-2 rounded-lg border px-3 py-2 text-xs leading-5 sm:mx-5", tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-sky-200 bg-sky-50/70 text-sky-900")}>{children}</p>;
}

function RowActions({ label, onEdit, onDelete }: { label: string; onEdit: () => void; onDelete: () => void }) {
  return <div className="flex justify-end gap-1">
    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" aria-label={`Editar ${label}`} title="Editar" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-red-700" aria-label={`Eliminar ${label}`} title="Eliminar" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
  </div>;
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>;
}

function CostDialog({ initial, subtipos, busy, onClose, onSubmit }: {
  initial: { period: string; row?: BudgetCostRow }; subtipos: string[]; busy: boolean; onClose: () => void; onSubmit: (body: unknown) => void;
}) {
  const row = initial.row;
  const [form, setForm] = useState(() => ({
    period: initial.period, detalle: row?.detalle ?? "", subtipoCosto: row?.subtipoCosto ?? "", puesto: row?.puesto ?? "",
    billingYear: String(row?.billingYear ?? initial.period.slice(0, 4)),
    mode: (row?.horasUnidades != null ? "hours" : row?.monedaOriginalArs != null ? "ars" : "usd") as BudgetCostMode,
    amount: toField(row ? row.monedaOriginalArs ?? row.monedaOriginalUsd : null), hours: toField(row?.horasUnidades), hourlyRate: toField(row?.valorHora),
    rateCurrency: (row?.monedaOriginalArs != null ? "ARS" : "USD") as "ARS" | "USD", exchangeRate: toField(row?.cotizacion),
  }));
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (value: string) => setForm(current => ({ ...current, [key]: value }));
  const body = {
    period: form.period, detalle: form.detalle, subtipoCosto: form.subtipoCosto, puesto: form.puesto || null,
    billingYear: form.billingYear ? Number(form.billingYear) : null, mode: form.mode,
    amount: form.mode === "hours" ? null : parseAmount(form.amount), hours: form.mode === "hours" ? parseAmount(form.hours) : null,
    hourlyRate: form.mode === "hours" ? parseAmount(form.hourlyRate) : null, rateCurrency: form.mode === "hours" ? form.rateCurrency : null,
    exchangeRate: parseAmount(form.exchangeRate),
  };
  const parsed = budgetCostInputSchema.safeParse(body);
  const total = parsed.success ? computeBudgetCostAmounts(parsed.data).montoTotalUsd : null;
  const needsRate = form.mode === "ars" || (form.mode === "hours" && form.rateCurrency === "ARS");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revisá los datos."); return; }
    setError(null);
    onSubmit(parsed.data);
  };
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="sm:max-w-lg">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <DialogHeader>
          <DialogTitle>{row ? "Editar costo estimado" : "Agregar costo estimado"}</DialogTitle>
          <DialogDescription>Se guarda en el presupuesto de Mind y reemplaza a la solapa «Costos estimados» del Máster para ese mes.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="cost-period" label="Mes"><Input id="cost-period" type="month" value={form.period} onChange={event => set("period")(event.target.value)} /></Field>
          <Field id="cost-billing-year" label="Año de facturación"><Input id="cost-billing-year" inputMode="numeric" value={form.billingYear} onChange={event => set("billingYear")(event.target.value)} /></Field>
          <div className="sm:col-span-2"><Field id="cost-detalle" label="Detalle" hint="Persona o proveedor."><Input id="cost-detalle" value={form.detalle} onChange={event => set("detalle")(event.target.value)} /></Field></div>
          <Field id="cost-subtipo" label="Subtipo de costo">
            <Input id="cost-subtipo" list="budget-subtipos" value={form.subtipoCosto} onChange={event => set("subtipoCosto")(event.target.value)} placeholder="Equipo, Monotributo, Software…" />
            <datalist id="budget-subtipos">{subtipos.map(value => <option key={value} value={value} />)}</datalist>
          </Field>
          {budgetCostUsesPuesto(form.subtipoCosto) && <Field id="cost-puesto" label="Puesto"><Input id="cost-puesto" value={form.puesto} onChange={event => set("puesto")(event.target.value)} /></Field>}
          <div className="sm:col-span-2"><Field id="cost-mode" label="Cómo se calcula">
            <Select value={form.mode} onValueChange={value => set("mode")(value)}>
              <SelectTrigger id="cost-mode"><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(BUDGET_COST_MODE_LABELS) as BudgetCostMode[]).map(mode => <SelectItem key={mode} value={mode}>{BUDGET_COST_MODE_LABELS[mode]}</SelectItem>)}</SelectContent>
            </Select>
          </Field></div>
          {form.mode === "hours" ? <>
            <Field id="cost-hours" label="Cantidad de horas o unidades"><Input id="cost-hours" inputMode="decimal" value={form.hours} onChange={event => set("hours")(event.target.value)} /></Field>
            <Field id="cost-rate" label="Valor hora">
              <div className="flex gap-2">
                <Select value={form.rateCurrency} onValueChange={value => set("rateCurrency")(value)}>
                  <SelectTrigger className="w-24" aria-label="Moneda del valor hora"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="ARS">ARS</SelectItem></SelectContent>
                </Select>
                <Input id="cost-rate" inputMode="decimal" value={form.hourlyRate} onChange={event => set("hourlyRate")(event.target.value)} />
              </div>
            </Field>
          </> : <Field id="cost-amount" label={form.mode === "ars" ? "Monto en ARS" : "Monto en USD"}><Input id="cost-amount" inputMode="decimal" value={form.amount} onChange={event => set("amount")(event.target.value)} /></Field>}
          {(needsRate || form.exchangeRate) && <Field id="cost-fx" label="Cotización ARS/USD"><Input id="cost-fx" inputMode="decimal" value={form.exchangeRate} onChange={event => set("exchangeRate")(event.target.value)} /></Field>}
        </div>
        <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm"><span className="text-muted-foreground">Monto total</span><span data-testid="budget-cost-preview" className="font-semibold tabular-nums">{formatUsd(total, "—")}</span></div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={busy}>{row ? "Guardar cambios" : "Agregar costo"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

function SaleDialog({ initial, clients, busy, onClose, onSubmit }: {
  initial: { period: string; row?: BudgetSaleRow }; clients: Array<{ id: number; name: string }>; busy: boolean; onClose: () => void; onSubmit: (body: unknown) => void;
}) {
  const row = initial.row;
  const [form, setForm] = useState(() => ({
    period: initial.period, clientName: row?.clientName ?? "", projectName: row?.projectName ?? "",
    currency: (row?.currency === "ARS" ? "ARS" : "USD") as "USD" | "ARS", amount: toField(row ? row.amountNative ?? row.amountUsd : null),
    exchangeRate: toField(row?.fxRate), confirmed: row?.confirmed ? "si" : "no", probability: toField(row && !row.confirmed ? row.probability : 50), note: row?.note ?? "",
  }));
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (value: string) => setForm(current => ({ ...current, [key]: value }));
  const confirmed = form.confirmed === "si";
  const body = {
    period: form.period, clientName: form.clientName, projectName: form.projectName || null, currency: form.currency,
    amount: parseAmount(form.amount), exchangeRate: parseAmount(form.exchangeRate), confirmed,
    probability: confirmed ? null : parseAmount(form.probability), note: form.note || null,
  };
  const parsed = budgetSaleInputSchema.safeParse(body);
  const preview = parsed.success ? computeBudgetSaleAmounts(parsed.data) : null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revisá los datos."); return; }
    setError(null);
    onSubmit(parsed.data);
  };
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="sm:max-w-lg">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <DialogHeader>
          <DialogTitle>{row ? "Editar venta estimada" : "Agregar venta estimada"}</DialogTitle>
          <DialogDescription>Una venta que todavía no se facturó. Cuando se facture, cargá la factura en Carga financiera y eliminá esta estimación.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="sale-client" label="Cliente">
            <Input id="sale-client" list="budget-clients" value={form.clientName} onChange={event => set("clientName")(event.target.value)} />
            <datalist id="budget-clients">{clients.map(client => <option key={client.id} value={client.name} />)}</datalist>
          </Field>
          <Field id="sale-project" label="Proyecto"><Input id="sale-project" value={form.projectName} onChange={event => set("projectName")(event.target.value)} /></Field>
          <Field id="sale-period" label="Mes de facturación"><Input id="sale-period" type="month" value={form.period} onChange={event => set("period")(event.target.value)} /></Field>
          <Field id="sale-amount" label="Monto">
            <div className="flex gap-2">
              <Select value={form.currency} onValueChange={value => set("currency")(value)}>
                <SelectTrigger className="w-24" aria-label="Moneda"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="ARS">ARS</SelectItem></SelectContent>
              </Select>
              <Input id="sale-amount" inputMode="decimal" value={form.amount} onChange={event => set("amount")(event.target.value)} />
            </div>
          </Field>
          {form.currency === "ARS" && <Field id="sale-fx" label="Cotización ARS/USD"><Input id="sale-fx" inputMode="decimal" value={form.exchangeRate} onChange={event => set("exchangeRate")(event.target.value)} /></Field>}
          <Field id="sale-confirmed" label="¿Está confirmada?">
            <Select value={form.confirmed} onValueChange={value => set("confirmed")(value)}>
              <SelectTrigger id="sale-confirmed"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="si">Sí, confirmada</SelectItem><SelectItem value="no">No, es una estimación</SelectItem></SelectContent>
            </Select>
          </Field>
          {!confirmed && <Field id="sale-probability" label="Probabilidad de cierre (%)"><Input id="sale-probability" inputMode="decimal" value={form.probability} onChange={event => set("probability")(event.target.value)} /></Field>}
          <div className="sm:col-span-2"><Field id="sale-note" label="Nota (opcional)"><Textarea id="sale-note" rows={2} value={form.note} onChange={event => set("note")(event.target.value)} /></Field></div>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
          <span className="text-muted-foreground">{preview ? `${formatUsd(preview.amountUsd)} · suma en la Proyección` : "Suma en la Proyección"}</span>
          <span className="font-semibold tabular-nums">{formatUsd(preview?.weightedUsd, "—")}</span>
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={busy}>{row ? "Guardar cambios" : "Agregar venta"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
