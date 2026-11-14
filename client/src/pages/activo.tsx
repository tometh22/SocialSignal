import { QueryError } from "@/components/query-error";
import { useFinancePeriod } from "@/hooks/use-finance-period";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, DollarSign, AlertCircle, Clock, ChevronLeft, ChevronRight, UploadCloud, Ban } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

function fmtUSD(n: number | null | undefined) {
  if (n == null) return "Sin datos";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}

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
  const voidRow = (row: any) => {
    const reason = window.prompt(`Motivo de anulación de ${row.nroFactura || row.concepto || "la factura"}:`);
    if (reason?.trim() && reason.trim().length >= 5) voidMutation.mutate({ id: row.id, reason: reason.trim() });
    else if (reason != null) toast({ title: "Ingresá un motivo de al menos 5 caracteres", variant: "destructive" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Cuentas por cobrar</h1><p className="text-muted-foreground text-sm">Facturas emitidas, cobros y saldos registrados en Mind</p></div>
        <Button asChild><Link href="/finance/cargar"><UploadCloud className="mr-2 h-4 w-4" />Cargar información</Link></Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <Select value={estado} onValueChange={(value) => { setEstado(value); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="cobrado">Cobrado</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="vencido">Vencido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(isError || summaryError) && <QueryError message="No se pudieron cargar todos los datos del período. Los importes no disponibles se muestran como Sin datos." retry={() => { void refetch(); void retrySummary(); }} />}
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Facturas del mes</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{fmtUSD(summary?.total)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Cobrado</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{fmtUSD(summary?.cobrado)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Pendiente</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-yellow-600">{fmtUSD(summary?.pendiente)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Vencido</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{fmtUSD(summary?.vencido)}</div></CardContent>
        </Card>
      </div>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-5" aria-label="Cargando cuentas a cobrar">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="flex min-h-40 flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-sm font-medium">No pudimos cargar las cuentas a cobrar.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Reintentar</Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              No hay registros para {period}
            </div>
          ) : (
            <>
              <div className={`overflow-x-auto transition-opacity ${isFetching ? "opacity-60" : "opacity-100"}`}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Factura</TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead className="text-right">Monto USD</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fuente</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row: any) => (
                      <TableRow key={row.id}>
                        <TableCell className="max-w-[240px] truncate">{row.concepto || "-"}</TableCell>
                        <TableCell>{row.clienteNombre || "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{row.nroFactura || "-"}</TableCell>
                        <TableCell className="text-sm">
                          {row.fechaVencimiento ? new Date(row.fechaVencimiento).toLocaleDateString("es-AR") : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {fmtUSD(Number(row.montoTotalUSD ?? 0))}
                        </TableCell>
                        <TableCell className="text-right font-mono">{fmtUSD(Number(row.outstandingUSD ?? row.montoTotalUSD ?? 0))}</TableCell>
                        <TableCell>
                          {row.cobradoAlCierre ? (
                            <Badge className="bg-green-100 text-green-800">Cobrado</Badge>
                          ) : row.status === "PARTIAL" ? (
                            <Badge variant="outline">Parcial</Badge>
                          ) : row.vencido ? (
                            <Badge variant="destructive">Vencido</Badge>
                          ) : (
                            <Badge variant="secondary">Pendiente</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {row.overrideManual ? "Mind" : "Histórico"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right"><Button size="sm" variant="ghost" disabled={voidMutation.isPending} onClick={() => voidRow(row)}><Ban className="mr-1 h-4 w-4" />Anular</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="text-muted-foreground">
                  {pagination?.total ?? 0} registros · Página {pagination?.page ?? 1} de {Math.max(1, pagination?.totalPages ?? 1)}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page <= 1 || isFetching}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((current) => current + 1)}
                    disabled={page >= (pagination?.totalPages ?? 1) || isFetching}
                  >
                    Siguiente <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
