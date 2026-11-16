import { QueryError } from "@/components/query-error";
import { useFinancePeriod } from "@/hooks/use-finance-period";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { PageShell } from "@/components/ui/page-shell";
import { FinanceHeader, FinanceTableCard, StatusPill, amountTone, formatDate, formatUsd, periodLabel, useReasonDialog, usePeriodSource, PeriodSourceNotice } from "@/components/finance/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { DollarSign, ArrowUp, ArrowDown, Wallet, Settings2, UploadCloud, Ban } from "lucide-react";


interface CashflowRow {
  id: number;
  fecha?: string;
  tipoMovimiento: string;
  banco?: string;
  detalleOperacion?: string;
  concepto?: string;
  montoUSD?: string;
  reconciliationStatus?: "matched" | "unmatched" | "ignored";
  transferGroupId?: string | null;
  source?: string | null;
}

interface CashflowBalance {
  balances: Record<string, number>;
  totalUSD?: number;
  source?: "master";
}
interface FinancialAccount { id: number; name: string; bankName?: string | null; currency: string; openingBalance: string; isActive: boolean }

export default function CashflowPage() {
  const { period, year, month } = useFinancePeriod();
  const [banco, setBanco] = useState("todos");
  const [tipo, setTipo] = useState("todos");
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [accountCurrency, setAccountCurrency] = useState("USD");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [openingBalanceDate, setOpeningBalanceDate] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`);
  const qc = useQueryClient();
  const { toast } = useToast();
  const reason = useReasonDialog();
  const periodSource = usePeriodSource(period);
  const masterMonth = periodSource.data?.source === "master";


  // Last day of selected month
  const lastDay = new Date(parseInt(year), parseInt(month), 0);
  const dateStr = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;

  const { data: movementData, isLoading, isError, refetch } = useQuery<CashflowRow[]>({
    queryKey: ["/api/cashflow", period, banco, tipo],
    queryFn: () => {
      const params = new URLSearchParams({ period });
      if (banco !== "todos") params.set("banco", banco);
      if (tipo !== "todos") params.set("tipo", tipo);
      return apiRequest(`/api/cashflow?${params}`, "GET");
    },
  });

  const { data: balance, isError: balanceError, refetch: retryBalance } = useQuery<CashflowBalance>({
    queryKey: ["/api/cashflow/balance", dateStr],
    queryFn: () => apiRequest(`/api/cashflow/balance?date=${dateStr}`, "GET"),
    enabled: !!dateStr,
  });
  const { data: accounts = [] } = useQuery<FinancialAccount[]>({ queryKey: ["/api/financial-accounts"], queryFn: () => apiRequest("/api/financial-accounts", "GET") });
  const accountMutation = useMutation({
    mutationFn: () => apiRequest("/api/financial-accounts", "POST", { name: accountName, bankName: accountName, currency: accountCurrency, openingBalance, openingBalanceDate, accountType: "bank", isActive: true }),
    onSuccess: () => { setAccountName(""); setOpeningBalance("0"); qc.invalidateQueries({ queryKey: ["/api/financial-accounts"] }); qc.invalidateQueries({ queryKey: ["/api/cashflow/balance"] }); toast({ title: "Cuenta creada" }); },
    onError: (error: Error) => toast({ title: "No se pudo crear", description: error.message, variant: "destructive" }),
  });
  const reconcileMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/cashflow/${id}/reconcile`, "POST", { status: "matched" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/cashflow"] });
      toast({ title: "Movimiento conciliado" });
    },
    onError: (error: Error) => toast({ title: "No se pudo conciliar", description: error.message, variant: "destructive" }),
  });
  const voidMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => apiRequest(`/api/cashflow/${id}/void`, "POST", { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/cashflow"] });
      qc.invalidateQueries({ queryKey: ["/api/cashflow/balance"] });
      toast({ title: "Movimiento anulado", description: "Si tenía una factura aplicada, su saldo fue restaurado." });
    },
    onError: (error: Error) => toast({ title: "No se pudo anular", description: error.message, variant: "destructive" }),
  });
  const voidRow = async (row: CashflowRow) => {
    const text = await reason.ask({ title: `Anular ${row.detalleOperacion || row.concepto || "el movimiento"}`, description: "Si tenía una factura aplicada, su saldo se restaura. Indicá por qué se anula.", confirmLabel: "Anular movimiento", destructive: true });
    if (text) voidMutation.mutate({ id: row.id, reason: text });
  };

  const rows = movementData ?? [];
  const operatingRows = rows.filter((row) => !row.transferGroupId);
  const ingresos = operatingRows.filter(r => r.tipoMovimiento === "Ingreso").reduce((s, r) => s + parseFloat(r.montoUSD ?? "0"), 0);
  const egresos = operatingRows.filter(r => r.tipoMovimiento === "Egreso").reduce((s, r) => s + parseFloat(r.montoUSD ?? "0"), 0);
  const net = movementData ? ingresos - egresos : null;
  const pendingCount = rows.filter(row => row.reconciliationStatus !== "matched" && row.reconciliationStatus !== "ignored").length;
  const bankBalances = Object.entries(balance?.balances ?? {}) as [string, number][];

  return (
    <PageShell width="wide" spacing="compact">
      <FinanceHeader
        title="Caja y bancos"
        description={`Saldos y movimientos bancarios de ${periodLabel(period)}.`}
        actions={<><Button variant="outline" asChild><Link href={`/finance/cargar?period=${period}`}><UploadCloud className="mr-2 h-4 w-4" />Cargar movimientos</Link></Button><Dialog open={accountOpen} onOpenChange={setAccountOpen}><DialogTrigger asChild><Button variant="outline"><Settings2 className="mr-2 h-4 w-4" />Cuentas</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Cuentas financieras</DialogTitle></DialogHeader><div className="space-y-2">{accounts.map((account) => <div key={account.id} className="flex items-center justify-between rounded-lg border p-3 text-sm"><span>{account.name}</span><span className="text-xs text-muted-foreground">{account.currency} · saldo inicial {account.openingBalance}</span></div>)}</div><div className="grid gap-3 border-t pt-4"><div><Label>Nombre / banco</Label><Input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Ej. Santander USD" /></div><div className="grid grid-cols-2 gap-3"><div><Label>Moneda</Label><Select value={accountCurrency} onValueChange={setAccountCurrency}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="ARS">ARS</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent></Select></div><div><Label>Saldo inicial</Label><Input type="number" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} /></div></div><div><Label>Fecha del saldo inicial</Label><Input type="date" value={openingBalanceDate} onChange={(e) => setOpeningBalanceDate(e.target.value)} /></div><Button disabled={!accountName.trim() || !openingBalanceDate || accountMutation.isPending} onClick={() => accountMutation.mutate()}>Agregar cuenta</Button></div></DialogContent></Dialog></>}
      />
      <PeriodSourceNotice source={periodSource.data} otherRecords={periodSource.data?.otherSourceRecords.cashflow} noun="los movimientos" />

      {(isError || balanceError) && <QueryError message="No se pudieron cargar los movimientos o los saldos bancarios." retry={() => { void refetch(); void retryBalance(); }} />}
      <MetricGrid>
        <MetricCard label="Saldo de todas las cuentas" value={formatUsd(balance?.totalUSD)} icon={<Wallet />} tone="neutral" detail={balance?.source === "master" ? `Activo líquido del Máster al cierre de ${periodLabel(period)}` : `Al cierre de ${periodLabel(period)}`} />
        <MetricCard label="Ingresos" value={formatUsd(movementData ? ingresos : null)} icon={<ArrowUp />} tone="success" detail="Sin transferencias entre cuentas" />
        <MetricCard label="Egresos" value={formatUsd(movementData ? egresos : null)} icon={<ArrowDown />} tone="danger" detail="Sin transferencias entre cuentas" />
        <MetricCard label="Movimiento neto del mes" value={formatUsd(net)} icon={<DollarSign />} tone={net == null ? "neutral" : net >= 0 ? "success" : "danger"} detail={net == null ? undefined : net >= 0 ? "Entró más de lo que salió" : "Salió más de lo que entró"} />
      </MetricGrid>

      {bankBalances.length > 0 && <section aria-label="Saldo por cuenta" className="rounded-2xl border border-border/75 bg-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold">Saldo por cuenta</h2>
        <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {bankBalances.map(([bank, saldo]) => <div key={bank} className="flex items-baseline justify-between gap-3 border-b border-dashed pb-2 last:border-0 sm:last:border-b">
            <dt className="truncate text-sm text-muted-foreground">{bank}</dt><dd className={`whitespace-nowrap text-sm font-semibold tabular-nums ${amountTone(saldo)}`}>{formatUsd(saldo)}</dd>
          </div>)}
        </dl>
      </section>}

      <FinanceTableCard
        title="Movimientos"
        description={movementData && rows.length > 0 ? masterMonth ? `${rows.length} movimientos del Máster.` : (pendingCount > 0 ? `${pendingCount} de ${rows.length} movimientos sin conciliar.` : `Los ${rows.length} movimientos están conciliados.`) : undefined}
        toolbar={<>
          <Select value={banco} onValueChange={setBanco}>
            <SelectTrigger className="h-9 w-44" aria-label="Filtrar por cuenta"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas las cuentas</SelectItem>
              {accounts.map((account) => <SelectItem key={account.id} value={account.name}>{account.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="h-9 w-48" aria-label="Filtrar por tipo de movimiento"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Ingresos y egresos</SelectItem>
              <SelectItem value="Ingreso">Solo ingresos</SelectItem>
              <SelectItem value="Egreso">Solo egresos</SelectItem>
            </SelectContent>
          </Select>
        </>}
        loading={isLoading} error={isError} onRetry={refetch} empty={rows.length === 0}
        emptyMessage={`No hay movimientos para ${periodLabel(period)}.`}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Detalle</TableHead>
              <TableHead>Cuenta</TableHead>
              {!masterMonth && <TableHead>Conciliación</TableHead>}
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="w-px text-right"><span className="sr-only">Acciones</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const income = row.tipoMovimiento === "Ingreso";
              const amount = parseFloat(row.montoUSD ?? "0");
              return <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap text-sm">{formatDate(row.fecha)}</TableCell>
                <TableCell className="max-w-[320px]"><span className="block truncate" title={row.detalleOperacion || row.concepto || undefined}>{row.detalleOperacion || row.concepto || "—"}</span>{row.transferGroupId && <span className="text-xs text-muted-foreground">Transferencia entre cuentas</span>}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.banco || "—"}</TableCell>
                {!masterMonth && <TableCell>{row.reconciliationStatus === "matched" ? <StatusPill tone="success">Conciliado</StatusPill> : row.reconciliationStatus === "ignored" ? <StatusPill tone="neutral">Ignorado</StatusPill> : <StatusPill tone="warning">Pendiente</StatusPill>}</TableCell>}
                <TableCell className={`whitespace-nowrap text-right font-medium tabular-nums ${income ? "text-emerald-700" : "text-red-600"}`}>{income ? "+" : "−"}{formatUsd(Math.abs(amount))}</TableCell>
                <TableCell className="text-right">{masterMonth && row.source === "excel" ? null : <div className="flex justify-end gap-1">{row.reconciliationStatus !== "matched" && <Button size="sm" variant="outline" disabled={reconcileMutation.isPending} onClick={() => reconcileMutation.mutate(row.id)}>Conciliar</Button>}<Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-red-700" aria-label="Anular" title="Anular" disabled={voidMutation.isPending} onClick={() => void voidRow(row)}><Ban className="h-4 w-4" /></Button></div>}</TableCell>
              </TableRow>;
            })}
          </TableBody>
        </Table>
      </FinanceTableCard>
      {reason.dialog}
    </PageShell>
  );
}
