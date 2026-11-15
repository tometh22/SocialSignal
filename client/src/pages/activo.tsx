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
import { FinanceHeader, FinancePagination, FinanceTableCard, StatusPill, formatDate, formatUsd, periodLabel, useReasonDialog } from "@/components/finance/ui";
import { CheckCircle, DollarSign, AlertCircle, Clock, UploadCloud, Ban } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

type LedgerPage<T> = {
  items: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export default function ActivoPage() {
  const { period } = useFinancePeriod();
  const [estado, setEstado] = useState("todos");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const reason = useReasonDialog();

  useEffect(() => { setPage(1); }, [period]);

  const { data, isLoading, isFetching, isError, refetch } = useQuery<LedgerPage<any>>({
    queryKey: ["/api/activo", period, estado, page],
    queryFn: () => {
      const params = new URLSearchParams({ period, page: String(page), pageSize: "50" });
      if (estado !== "todos") params.set("estado", estado);
      return apiRequest(`/api/activo?${params}`, "GET");
    },
  });
  const rows = data?.items ?? [];
  const pagination = data?.pagination;

  const { data: summary, isError: summaryError, refetch: retrySummary } = useQuery<any>({
    queryKey: ["/api/activo/summary", period],
    queryFn: () => apiRequest(`/api/activo/summary?period=${period}`, "GET"),
  });
  const voidMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => apiRequest(`/api/activo/${id}/void`, "POST", { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activo"] });
      toast({ title: "Factura anulada", description: "El cambio quedó registrado en la auditoría." });
    },
    onError: (error: Error) => toast({ title: "No se pudo anular", description: error.message, variant: "destructive" }),
  });
  const voidRow = async (row: any) => {
    const text = await reason.ask({ title: `Anular ${row.nroFactura || row.concepto || "la factura"}`, description: "La factura deja de contar como saldo por cobrar. Indicá por qué se anula.", confirmLabel: "Anular factura", destructive: true });
    if (text) voidMutation.mutate({ id: row.id, reason: text });
  };
  const overdue = summary?.vencido == null ? null : Number(summary.vencido);

  return (
    <PageShell width="wide" spacing="compact">
      <FinanceHeader
        title="Cuentas por cobrar"
        description={`Facturas emitidas, cobros y saldos de ${periodLabel(period)}.`}
        actions={<Button asChild variant="outline"><Link href={`/finance/cargar?period=${period}`}><UploadCloud className="mr-2 h-4 w-4" />Cargar facturas</Link></Button>}
      />

      {(isError || summaryError) && <QueryError message="No se pudieron cargar todos los datos del período. Los importes no disponibles se muestran como Sin datos." retry={() => { void refetch(); void retrySummary(); }} />}
      <MetricGrid>
        <MetricCard label="Facturas del mes" value={formatUsd(summary?.total)} icon={<DollarSign />} tone="neutral" />
        <MetricCard label="Cobrado" value={formatUsd(summary?.cobrado)} icon={<CheckCircle />} tone="success" />
        <MetricCard label="Pendiente" value={formatUsd(summary?.pendiente)} icon={<Clock />} tone="warning" detail="Todavía dentro del plazo" />
        <MetricCard label="Vencido" value={formatUsd(summary?.vencido)} icon={<AlertCircle />} tone={overdue ? "danger" : "neutral"} detail={overdue ? "Requiere seguimiento de cobro" : undefined} />
      </MetricGrid>

      <FinanceTableCard
        title="Facturas"
        description="Saldo pendiente de cada factura al cierre del mes."
        toolbar={<Select value={estado} onValueChange={(value) => { setEstado(value); setPage(1); }}>
          <SelectTrigger className="h-9 w-44" aria-label="Filtrar por estado"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="cobrado">Cobrado</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="vencido">Vencido</SelectItem>
          </SelectContent>
        </Select>}
        loading={isLoading} error={isError} onRetry={refetch} empty={rows.length === 0} dimmed={isFetching}
        emptyMessage={`No hay facturas por cobrar en ${periodLabel(period)}.`}
        footer={<FinancePagination page={pagination?.page ?? page} total={pagination?.total ?? 0} totalPages={pagination?.totalPages ?? 1} busy={isFetching} onPage={setPage} />}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead>Factura</TableHead>
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
                <TableCell className="font-medium">{row.clienteNombre || "—"}</TableCell>
                <TableCell className="max-w-[260px]"><span className="block truncate" title={row.concepto || undefined}>{row.concepto || "—"}</span><span className="text-xs text-muted-foreground">{row.overrideManual ? "Registrado en Mind" : "Histórico"}</span></TableCell>
                <TableCell className="whitespace-nowrap font-mono text-xs">{row.nroFactura || "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-sm">{formatDate(row.fechaVencimiento)}</TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums">{formatUsd(Number(row.montoTotalUSD ?? 0))}</TableCell>
                <TableCell className={`whitespace-nowrap text-right font-medium tabular-nums ${outstanding > 0 ? "" : "text-muted-foreground"}`}>{formatUsd(outstanding)}</TableCell>
                <TableCell>
                  {row.cobradoAlCierre ? <StatusPill tone="success">Cobrado</StatusPill>
                    : row.status === "PARTIAL" ? <StatusPill tone="info">Parcial</StatusPill>
                    : row.vencido ? <StatusPill tone="danger">Vencido</StatusPill>
                    : <StatusPill tone="warning">Pendiente</StatusPill>}
                </TableCell>
                <TableCell className="text-right"><Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-red-700" aria-label="Anular" title="Anular" disabled={voidMutation.isPending} onClick={() => void voidRow(row)}><Ban className="h-4 w-4" /></Button></TableCell>
              </TableRow>;
            })}
          </TableBody>
        </Table>
      </FinanceTableCard>
      {reason.dialog}
    </PageShell>
  );
}
