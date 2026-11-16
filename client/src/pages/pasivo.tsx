import { QueryError } from "@/components/query-error";
import { useFinancePeriod } from "@/hooks/use-finance-period";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { PageShell } from "@/components/ui/page-shell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FinanceHeader, FinancePagination, FinanceTableCard, StatusPill, formatDate, formatUsd, periodLabel, useReasonDialog, usePeriodSource, PeriodSourceNotice } from "@/components/finance/ui";
import { DollarSign, AlertCircle, Clock, CheckCircle, UploadCloud, Ban } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type LedgerPage<T> = {
  items: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export default function PasivoPage() {
  const { period } = useFinancePeriod();
  const [estado, setEstado] = useState("todos");
  const [subtipo, setSubtipo] = useState("todos");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const reason = useReasonDialog();
  const periodSource = usePeriodSource(period);
  const masterMonth = periodSource.data?.source === "master";

  useEffect(() => { setPage(1); }, [period]);

  const { data, isLoading, isFetching, isError, refetch } = useQuery<LedgerPage<any>>({
    queryKey: ["/api/pasivo", period, estado, subtipo, page],
    queryFn: () => {
      const params = new URLSearchParams({ period, page: String(page), pageSize: "50" });
      if (estado !== "todos") params.set("estado", estado);
      if (subtipo !== "todos") params.set("subtipo", subtipo);
      return apiRequest(`/api/pasivo?${params}`, "GET");
    },
  });
  const rows = data?.items ?? [];
  const pagination = data?.pagination;

  const { data: summary, isError: summaryError, refetch: retrySummary } = useQuery<any>({
    queryKey: ["/api/pasivo/summary", period],
    queryFn: () => apiRequest(`/api/pasivo/summary?period=${period}`, "GET"),
  });
  const voidMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => apiRequest(`/api/pasivo/${id}/void`, "POST", { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pasivo"] });
      toast({ title: "Factura anulada", description: "El cambio quedó registrado en la auditoría." });
    },
    onError: (error: Error) => toast({ title: "No se pudo anular", description: error.message, variant: "destructive" }),
  });
  const voidRow = async (row: any) => {
    const text = await reason.ask({ title: `Anular ${row.documentNumber || row.detalle || "la factura"}`, description: "La obligación deja de contar como saldo por pagar. Indicá por qué se anula.", confirmLabel: "Anular factura", destructive: true });
    if (text) voidMutation.mutate({ id: row.id, reason: text });
  };

  const subtipoEntries = (Object.entries(summary?.bySubtipo ?? {}) as [string, number][]).sort(([, a], [, b]) => b - a);
  const subtipoTotal = subtipoEntries.reduce((sum, [, value]) => sum + Number(value || 0), 0);
  const overdue = summary?.vencido == null ? null : Number(summary.vencido);
  const chip = (selected: boolean) => cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
    selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground");

  return (
    <PageShell width="wide" spacing="compact">
      <FinanceHeader
        title="Cuentas por pagar"
        description={`Obligaciones, pagos y saldos de ${periodLabel(period)}.`}
        actions={<Button asChild variant="outline"><Link href={`/finance/cargar?period=${period}`}><UploadCloud className="mr-2 h-4 w-4" />Cargar facturas</Link></Button>}
      />
      <PeriodSourceNotice source={periodSource.data} otherRecords={periodSource.data?.otherSourceRecords.pasivo} noun="las obligaciones" />

      {(isError || summaryError) && <QueryError message="No se pudieron cargar todos los datos del período. Los importes no disponibles se muestran como Sin datos." retry={() => { void refetch(); void retrySummary(); }} />}
      <MetricGrid>
        <MetricCard label="Obligaciones del mes" value={formatUsd(summary?.total)} icon={<DollarSign />} tone="neutral" />
        <MetricCard label="Pagado" value={formatUsd(summary?.pagado)} icon={<CheckCircle />} tone="success" />
        <MetricCard label="Pendiente" value={formatUsd(summary?.pendiente)} icon={<Clock />} tone="warning" detail="Todavía dentro del plazo" />
        <MetricCard label="Vencido" value={formatUsd(summary?.vencido)} icon={<AlertCircle />} tone={overdue ? "danger" : "neutral"} detail={overdue ? "Pagos atrasados" : undefined} />
      </MetricGrid>

      <FinanceTableCard
        title="Facturas y obligaciones"
        description={subtipoEntries.length > 0 ? "Filtrá por tipo de gasto con los botones de abajo." : "Saldo pendiente de cada obligación al cierre del mes."}
        toolbar={<Select value={estado} onValueChange={(value) => { setEstado(value); setPage(1); }}>
          <SelectTrigger className="h-9 w-44" aria-label="Filtrar por estado"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="pagado">Pagado</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="vencido">Vencido</SelectItem>
          </SelectContent>
        </Select>}
        loading={isLoading} error={isError} onRetry={refetch} empty={rows.length === 0} dimmed={isFetching}
        emptyMessage={subtipo === "todos" ? `No hay obligaciones en ${periodLabel(period)}.` : `No hay obligaciones de ${subtipo} en ${periodLabel(period)}.`}
        footer={<FinancePagination page={pagination?.page ?? page} total={pagination?.total ?? 0} totalPages={pagination?.totalPages ?? 1} busy={isFetching} onPage={setPage} />}
        subheader={subtipoEntries.length > 0 && <div role="group" aria-label="Filtrar por tipo de gasto" className="flex flex-wrap gap-2 border-b bg-muted/30 px-4 py-3 sm:px-5">
          <button type="button" aria-pressed={subtipo === "todos"} className={chip(subtipo === "todos")} onClick={() => { setSubtipo("todos"); setPage(1); }}>Todos · {formatUsd(subtipoTotal)}</button>
          {subtipoEntries.map(([key, val]) => <button key={key} type="button" aria-pressed={subtipo === key} className={chip(subtipo === key)} onClick={() => { setSubtipo(subtipo === key ? "todos" : key); setPage(1); }}>{key} · {formatUsd(val)}</button>)}
        </div>}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Detalle</TableHead>
              <TableHead>Tipo de gasto</TableHead>
              <TableHead>Emisión</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-px text-right"><span className="sr-only">Acciones</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row: any) => {
              const outstanding = Number(row.outstandingUSD ?? row.montoTotalUSD ?? 0);
              return <TableRow key={row.id}>
                <TableCell className="max-w-[280px]"><span className="block truncate font-medium" title={row.detalle || undefined}>{row.detalle || "—"}</span><span className="text-xs text-muted-foreground">{row.source === "excel" ? "Máster" : "Registrado en Mind"}</span></TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.subtipoCosto || "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-sm">{formatDate(row.fechaEmision)}</TableCell>
                <TableCell className="whitespace-nowrap text-sm">{formatDate(row.fechaVencimiento)}</TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums">{formatUsd(Number(row.montoTotalUSD ?? 0))}</TableCell>
                <TableCell className={`whitespace-nowrap text-right font-medium tabular-nums ${outstanding > 0 ? "" : "text-muted-foreground"}`}>{formatUsd(outstanding)}</TableCell>
                <TableCell>
                  {row.pagadoAlCierre ? <StatusPill tone="success">Pagado</StatusPill>
                    : row.status === "PARTIAL" ? <StatusPill tone="info">Parcial</StatusPill>
                    : row.vencido ? <StatusPill tone="danger">Vencido</StatusPill>
                    : <StatusPill tone="warning">Pendiente</StatusPill>}
                </TableCell>
                <TableCell className="text-right">{masterMonth && row.source === "excel" ? null : <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-red-700" aria-label="Anular" title="Anular" disabled={voidMutation.isPending} onClick={() => void voidRow(row)}><Ban className="h-4 w-4" /></Button>}</TableCell>
              </TableRow>;
            })}
          </TableBody>
        </Table>
      </FinanceTableCard>
      {reason.dialog}
    </PageShell>
  );
}
