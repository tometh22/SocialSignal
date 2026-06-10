import { useState } from "react";
import { useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, DollarSign, AlertCircle, Clock } from "lucide-react";

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1).padStart(2, "0"),
  label: new Date(2000, i, 1).toLocaleString("es-AR", { month: "long" }),
}));

const YEARS = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - 1 + i));

function fmtUSD(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}

export default function ActivoPage() {
  const search = useSearch();
  const urlPeriod = new URLSearchParams(search).get("period");
  const [year, setYear] = useState(urlPeriod ? urlPeriod.split("-")[0] : String(new Date().getFullYear()));
  const [month, setMonth] = useState(urlPeriod ? urlPeriod.split("-")[1] : String(new Date().getMonth() + 1).padStart(2, "0"));
  const [estado, setEstado] = useState("todos");
  const { toast } = useToast();
  const qc = useQueryClient();

  const period = `${year}-${month}`;

  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/activo", period, estado],
    queryFn: () => {
      const params = new URLSearchParams({ period });
      if (estado !== "todos") params.set("estado", estado);
      return apiRequest(`/api/activo?${params}`, "GET");
    },
  });

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
        <h1 className="text-2xl font-bold">Activo — Cuentas a Cobrar</h1>
        <p className="text-muted-foreground text-sm">Facturas emitidas y liquidez importadas desde el Excel MAESTRO</p>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={estado} onValueChange={setEstado}>
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
            <div className="flex items-center justify-center h-32 text-muted-foreground">Cargando...</div>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              No hay registros para {period}
            </div>
          ) : (
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
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row: any) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-[200px] truncate">{row.concepto || "-"}</TableCell>
                    <TableCell>{row.clienteNombre || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{row.nroFactura || "-"}</TableCell>
                    <TableCell className="text-sm">
                      {row.fechaVencimiento ? new Date(row.fechaVencimiento).toLocaleDateString("es-AR") : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {fmtUSD(parseFloat(row.montoTotalUSD ?? row.montoUSD ?? "0"))}
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
                      {row.overrideManual ? (
                        <Badge variant="outline" className="text-xs">Manual</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Excel</Badge>
                      )}
                    </TableCell>
                    <TableCell>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
