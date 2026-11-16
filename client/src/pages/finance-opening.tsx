import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Download, Landmark, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { PageShell } from "@/components/ui/page-shell";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QueryError } from "@/components/query-error";
import { FinanceHeader, FinanceLoading, FinanceTableCard, StatusPill, formatDate, formatUsd, periodLabel } from "@/components/finance/ui";

type Opening = {
  startPeriod: string | null; asOf: string | null; locked: boolean;
  accounts: Array<{ id: number; name: string; currency: string; openingBalance: string; openingBalanceDate: string | null }>;
  receivables: Array<{ id: number; clienteNombre: string | null; nroFactura: string | null; fechaVencimiento: string | null; montoTotalUSD: string | null; currency: string | null }>;
  payables: Array<{ id: number; detalle: string | null; subtipoCosto: string | null; fechaVencimiento: string | null; montoTotalUSD: string | null }>;
  investments: Array<{ id: number; concepto: string | null; montoTotalUSD: string | null }>;
  provisions: Array<{ id: number; cliente_nombre: string | null; criterio: string | null; opening_amount: number }>;
};
type ImportSummary = { asOf: string; totals: Record<string, number>; resumen: Record<string, number | null> | null; provisionWarning: string | null };

const sum = (items: Array<{ montoTotalUSD?: string | null }>) => items.reduce((total, item) => total + Number(item.montoTotalUSD ?? 0), 0);

export default function FinanceOpeningPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { hasPermission } = usePermissions();
  const isAdmin = hasPermission("admin");
  const query = useQuery<Opening>({ queryKey: ["/api/finance/opening"] });
  const [startInput, setStartInput] = useState("2027-01");
  const [lastImport, setLastImport] = useState<ImportSummary | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["/api/finance/opening"] }); qc.invalidateQueries({ queryKey: ["/api/v2/executive/dashboard"] }); };
  const fail = (title: string) => (error: Error) => toast({ title, description: error.message, variant: "destructive" });
  const setStart = useMutation({ mutationFn: (period: string) => apiRequest("/api/finance/opening/start", "PUT", { period }), onSuccess: () => { refresh(); toast({ title: "Fecha de cambio guardada" }); }, onError: fail("No se pudo guardar la fecha") });
  const importMaster = useMutation({ mutationFn: () => apiRequest("/api/finance/opening/import-master", "POST", {}) as Promise<ImportSummary>, onSuccess: (summary) => { setLastImport(summary); refresh(); toast({ title: "Saldos iniciales importados del Máster" }); }, onError: fail("No se pudo importar") });
  const addItem = useMutation({ mutationFn: (body: unknown) => apiRequest("/api/finance/opening/items", "POST", body), onSuccess: () => { refresh(); toast({ title: "Saldo inicial agregado" }); }, onError: fail("No se pudo agregar") });
  const removeItem = useMutation({ mutationFn: ({ kind, id }: { kind: string; id: number }) => apiRequest(`/api/finance/opening/items/${kind}/${id}`, "DELETE"), onSuccess: refresh, onError: fail("No se pudo quitar") });

  if (query.isLoading) return <PageShell width="wide" spacing="compact"><FinanceLoading label="Cargando saldos iniciales" /></PageShell>;
  if (query.error || !query.data) return <PageShell width="wide" spacing="compact"><QueryError message="No se pudieron cargar los saldos iniciales." retry={query.refetch} /></PageShell>;
  const data = query.data;
  const editable = Boolean(data.startPeriod) && !data.locked;
  const banksUsd = data.accounts.reduce((total, account) => total + (account.currency === "USD" ? Number(account.openingBalance || 0) : 0), 0);
  const arsAccounts = data.accounts.filter(account => account.currency !== "USD");
  const remove = (kind: string, id: number) => <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-red-700" aria-label="Quitar" disabled={!editable || removeItem.isPending} onClick={() => removeItem.mutate({ kind, id })}><Trash2 className="h-4 w-4" /></Button>;

  return <PageShell width="wide" spacing="compact">
    <FinanceHeader title="Saldos iniciales" description="Desde el mes de cambio, Finanzas se registra sólo en Mind. Acá se cargan los saldos con los que arranca: bancos, facturas sin cobrar, deudas, provisiones e inversiones. No son ventas ni gastos." />

    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-base font-semibold"><CalendarClock className="h-4 w-4 text-primary" />Mes de cambio</h2>
          {data.startPeriod
            ? <p className="text-sm text-muted-foreground">Desde <strong className="text-foreground">{periodLabel(data.startPeriod)}</strong> Finanzas se registra en Mind. Los saldos iniciales son los del cierre de {periodLabel(data.asOf!)} en el Máster.</p>
            : <p className="text-sm text-muted-foreground">Todavía no hay un mes de cambio: todos los meses con datos del Máster se siguen informando desde la planilla.</p>}
          {data.locked && <StatusPill tone="warning">El mes de cambio está cerrado o en revisión: los saldos iniciales no se pueden modificar.</StatusPill>}
        </div>
        {isAdmin && <form className="flex items-end gap-2" onSubmit={(event: FormEvent) => { event.preventDefault(); setStart.mutate(startInput); }}>
          <div className="space-y-1"><Label htmlFor="start-period">Primer mes en Mind</Label><Input id="start-period" type="month" value={startInput} onChange={event => setStartInput(event.target.value)} className="w-44" /></div>
          <Button type="submit" variant="outline" disabled={setStart.isPending}>Guardar</Button>
        </form>}
      </div>
    </Card>

    {data.startPeriod && <>
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div><h2 className="text-base font-semibold">Traer los saldos del Máster</h2><p className="text-sm text-muted-foreground">Reemplaza los saldos iniciales con lo pendiente al cierre de {periodLabel(data.asOf!)} en las pestañas Activo, Pasivo y Provisión pasivo. Después podés agregar o quitar ítems.</p></div>
        <Button disabled={!editable || importMaster.isPending} onClick={() => importMaster.mutate()}><Download className="mr-2 h-4 w-4" />{importMaster.isPending ? "Importando…" : "Importar del Máster"}</Button>
      </Card>
      {lastImport && <Card className="p-4 text-sm sm:p-5" data-testid="opening-import-summary">
        <h2 className="font-semibold">Comparación con el Resumen Ejecutivo de {periodLabel(lastImport.asOf)}</h2>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          <li>Facturas sin cobrar: {formatUsd(lastImport.totals.receivablesUsd)} · Resumen: {formatUsd(lastImport.resumen?.clientesACobrar)}</li>
          <li>Deudas sin pagar: {formatUsd(lastImport.totals.payablesUsd)} · Resumen (proveedores + impuestos EE. UU.): {formatUsd((lastImport.resumen?.pasivoProveedores ?? 0) + (lastImport.resumen?.pasivoImpuestosUSA ?? 0))}</li>
          <li>Bancos: {formatUsd(lastImport.totals.banksUsd)} · Resumen: {formatUsd(lastImport.resumen?.activoLiquido)}</li>
          <li>Provisiones: {formatUsd(lastImport.totals.provisionsUsd)} · Resumen: {formatUsd(lastImport.resumen?.provisiones)}</li>
          <li>Inversiones: {formatUsd(lastImport.totals.investmentsUsd)} · Resumen: {formatUsd(lastImport.resumen?.crypto)}</li>
        </ul>
        {lastImport.provisionWarning && <p className="mt-2 text-amber-800">{lastImport.provisionWarning}</p>}
        <p className="mt-2 text-xs text-muted-foreground">Si algún total difiere, revisá en la planilla qué ítems faltan en el detalle y agregalos acá.</p>
      </Card>}

      <MetricGrid>
        <MetricCard label="Bancos en USD" value={formatUsd(banksUsd)} icon={<Landmark />} detail={arsAccounts.length ? `${arsAccounts.length} cuenta(s) en otra moneda, en su moneda` : undefined} />
        <MetricCard label="Facturas sin cobrar" value={formatUsd(sum(data.receivables))} />
        <MetricCard label="Deudas sin pagar" value={formatUsd(sum(data.payables))} />
        <MetricCard label="Provisiones" value={formatUsd(data.provisions.reduce((t, p) => t + Number(p.opening_amount || 0), 0))} />
        <MetricCard label="Inversiones" value={formatUsd(sum(data.investments))} />
      </MetricGrid>

      <FinanceTableCard title="Cuentas bancarias" description="El saldo inicial de cada cuenta se edita en Caja → Cuentas. Al importar del Máster se crean o actualizan con el saldo de cierre." empty={!data.accounts.length} emptyMessage="No hay cuentas bancarias.">
        <Table><TableHeader><TableRow><TableHead>Cuenta</TableHead><TableHead>Moneda</TableHead><TableHead className="text-right">Saldo inicial</TableHead><TableHead>Desde</TableHead></TableRow></TableHeader>
          <TableBody>{data.accounts.map(account => <TableRow key={account.id}><TableCell className="font-medium">{account.name}</TableCell><TableCell>{account.currency}</TableCell><TableCell className="text-right tabular-nums">{Number(account.openingBalance || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 })} {account.currency}</TableCell><TableCell>{formatDate(account.openingBalanceDate)}</TableCell></TableRow>)}</TableBody></Table>
      </FinanceTableCard>

      <OpeningSection title="Facturas sin cobrar" kind="receivable" editable={editable} onAdd={body => addItem.mutate(body)} rows={data.receivables.map(row => ({ id: row.id, label: row.clienteNombre ?? "—", detail: [row.nroFactura, row.fechaVencimiento ? `vence ${formatDate(row.fechaVencimiento)}` : null].filter(Boolean).join(" · "), amount: Number(row.montoTotalUSD ?? 0) }))} remove={remove} />
      <OpeningSection title="Deudas sin pagar" kind="payable" editable={editable} onAdd={body => addItem.mutate(body)} rows={data.payables.map(row => ({ id: row.id, label: row.detalle ?? "—", detail: [row.subtipoCosto, row.fechaVencimiento ? `vence ${formatDate(row.fechaVencimiento)}` : null].filter(Boolean).join(" · "), amount: Number(row.montoTotalUSD ?? 0) }))} remove={remove} />
      <OpeningSection title="Provisiones" kind="provision" editable={editable} onAdd={body => addItem.mutate(body)} rows={data.provisions.map(row => ({ id: row.id, label: row.cliente_nombre ?? "—", detail: row.criterio ?? "", amount: Number(row.opening_amount ?? 0) }))} remove={remove} />
      <OpeningSection title="Inversiones (cripto y otras)" kind="investment" editable={editable} onAdd={body => addItem.mutate(body)} rows={data.investments.map(row => ({ id: row.id, label: row.concepto ?? "—", detail: "", amount: Number(row.montoTotalUSD ?? 0) }))} remove={remove} />
    </>}
  </PageShell>;
}

function OpeningSection({ title, kind, rows, editable, onAdd, remove }: { title: string; kind: "receivable" | "payable" | "provision" | "investment"; rows: Array<{ id: number; label: string; detail: string; amount: number }>; editable: boolean; onAdd: (body: unknown) => void; remove: (kind: string, id: number) => JSX.Element }) {
  const [name, setName] = useState(""); const [extra, setExtra] = useState(""); const [due, setDue] = useState(""); const [amount, setAmount] = useState(""); const [currency, setCurrency] = useState("USD"); const [rate, setRate] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const money = { currency, amount: Number(amount), rate: currency === "ARS" ? Number(rate) : null };
    const body = kind === "receivable" ? { kind, clientName: name, invoiceNumber: extra || null, dueDate: due || null, money }
      : kind === "payable" ? { kind, detail: name, subtype: extra || null, dueDate: due || null, money }
      : kind === "provision" ? { kind, name, criterio: extra || null, amountUsd: Number(amount) } : { kind, name, amountUsd: Number(amount) };
    onAdd(body); setName(""); setExtra(""); setDue(""); setAmount(""); setRate("");
  };
  const total = rows.reduce((t, row) => t + row.amount, 0);
  return <FinanceTableCard title={title} description={`${rows.length} ítems · ${formatUsd(total)}`} empty={false}
    footer={editable ? <form className="flex flex-wrap items-end gap-2" onSubmit={submit} aria-label={`Agregar a ${title}`}>
      <div className="space-y-1"><Label>{kind === "receivable" ? "Cliente" : kind === "payable" ? "Detalle" : "Nombre"}</Label><Input value={name} onChange={e => setName(e.target.value)} required className="w-48" /></div>
      {kind !== "investment" && <div className="space-y-1"><Label>{kind === "receivable" ? "Factura" : kind === "payable" ? "Tipo de gasto" : "Criterio"}</Label><Input value={extra} onChange={e => setExtra(e.target.value)} className="w-40" /></div>}
      {(kind === "receivable" || kind === "payable") && <><div className="space-y-1"><Label>Vencimiento</Label><Input type="date" value={due} onChange={e => setDue(e.target.value)} className="w-40" /></div>
        <div className="space-y-1"><Label>Moneda</Label><Select value={currency} onValueChange={setCurrency}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="ARS">ARS</SelectItem></SelectContent></Select></div>
        {currency === "ARS" && <div className="space-y-1"><Label>Cotización</Label><Input type="number" step="0.01" value={rate} onChange={e => setRate(e.target.value)} required className="w-28" /></div>}</>}
      <div className="space-y-1"><Label>{kind === "provision" || kind === "investment" ? "Importe USD" : "Importe"}</Label><Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required className="w-32" /></div>
      <Button type="submit" variant="outline"><Plus className="mr-1 h-4 w-4" />Agregar</Button>
    </form> : undefined}>
    {rows.length ? <Table><TableBody>{rows.map(row => <TableRow key={row.id}><TableCell><span className="font-medium">{row.label}</span>{row.detail && <span className="block text-xs text-muted-foreground">{row.detail}</span>}</TableCell><TableCell className="text-right font-medium tabular-nums">{formatUsd(row.amount)}</TableCell><TableCell className="w-px">{remove(kind, row.id)}</TableCell></TableRow>)}</TableBody></Table>
      : <p className="px-5 py-6 text-center text-sm text-muted-foreground">Sin ítems.</p>}
  </FinanceTableCard>;
}
