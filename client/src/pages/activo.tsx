import { useState } from "react";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, DollarSign, AlertCircle, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { LedgerBackfillPanel } from "@/components/ledger-backfill-panel";

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1).padStart(2, "0"),
  label: new Date(2000, i, 1).toLocaleString("es-AR", { month: "long" }),
}));

const YEARS = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - 1 + i));

function fmtUSD(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}

type LedgerPage<T> = {
  items: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export default function ActivoPage() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [estado, setEstado] = useState("todos");
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const qc = useQueryClient();

  const period = `${year}-${month}`;

  const { data, isLoading, isFetching, isError, refetch } = useQuery<LedgerPage<any>>({
    queryKey: ["/api/activo", period, estado, page],
    queryFn: () => {
      const params = new URLSearchParams({ period, page: String(page), pageSize: "50" });
      if (estado !== "todos") params.set("estado", estado);
      return apiRequest(`/api/activo?${params}`, "GET");
    },
    placeholderData: keepPreviousData,
  });
  const rows = data?.items ?? [];
  const pagination = data?.pagination;

  const { data: summary } = useQuery<any>({
    queryKey: ["/api/activo/summary", period],
    queryFn: () => apiRequest(`/api/activo/summary?period=${period}`, "GET"),
  });

  const markCobradoMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/activo/${id}`, "PATCH", { cobradoAlCierre: true }),
    onSuccess: () => {
      toast({ title: "Marcado como cobrado" });
      qc.invalidateQueries({ queryKey: ["/api/activo"] });
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Activo — Cuentas a Cobrar</h1>
        <p className="text-muted-foreground text-sm">Facturas emitidas y liquidez importadas desde el Excel MAESTRO</p>
      </div>

      <LedgerBackfillPanel />

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <Select value={month} onValueChange={(value) => { setMonth(value); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={year} onValueChange={(value) => { setYear(value); setPage(1); }}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
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

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{fmtUSD(summary?.total ?? 0)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Cobrado</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{fmtUSD(summary?.cobrado ?? 0)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Pendiente</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-yellow-600">{fmtUSD(summary?.pendiente ?? 0)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Vencido</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{fmtUSD(summary?.vencido ?? 0)}</div></CardContent>
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
                        <TableCell>
                          {row.cobradoAlCierre ? (
                            <Badge className="bg-green-100 text-green-800">Cobrado</Badge>
                          ) : row.vencido ? (
                            <Badge variant="destructive">Vencido</Badge>
                          ) : (
                            <Badge variant="secondary">Pendiente</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {row.overrideManual ? "Manual" : "Máster"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {!row.cobradoAlCierre && row.id && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => markCobradoMutation.mutate(row.id)}
                              disabled={markCobradoMutation.isPending}
                            >
                              Marcar cobrado
                            </Button>
                          )}
                        </TableCell>
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
