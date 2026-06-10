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
import { DollarSign, AlertCircle, Clock, CheckCircle } from "lucide-react";

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1).padStart(2, "0"),
  label: new Date(2000, i, 1).toLocaleString("es-AR", { month: "long" }),
}));

const YEARS = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - 1 + i));

function fmtUSD(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}

export default function PasivoPage() {
  const search = useSearch();
  const urlPeriod = new URLSearchParams(search).get("period");
  const [year, setYear] = useState(urlPeriod ? urlPeriod.split("-")[0] : String(new Date().getFullYear()));
  const [month, setMonth] = useState(urlPeriod ? urlPeriod.split("-")[1] : String(new Date().getMonth() + 1).padStart(2, "0"));
  const [estado, setEstado] = useState("todos");
  const [subtipo, setSubtipo] = useState("todos");
  const { toast } = useToast();
  const qc = useQueryClient();

  const period = `${year}-${month}`;

  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/pasivo", period, estado, subtipo],
    queryFn: () => {
      const params = new URLSearchParams({ period });
      if (estado !== "todos") params.set("estado", estado);
      if (subtipo !== "todos") params.set("subtipo", subtipo);
      return apiRequest(`/api/pasivo?${params}`, "GET");
    },
  });

  const { data: summary } = useQuery<any>({
    queryKey: ["/api/pasivo/summary", period],
    queryFn: () => apiRequest(`/api/pasivo/summary?period=${period}`, "GET"),
  });

  const markPagadoMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/pasivo/${id}`, "PATCH", { pagadoAlCierre: true }),
    onSuccess: () => {
      toast({ title: "Marcado como pagado" });
      qc.invalidateQueries({ queryKey: ["/api/pasivo"] });
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const subtipoEntries = Object.entries(summary?.bySubtipo ?? {}) as [string, number][];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pasivo — Cuentas a Pagar</h1>
        <p className="text-muted-foreground text-sm">Obligaciones de pago importadas desde el Excel MAESTRO</p>
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
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="pagado">Pagado</SelectItem>
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
            <CardTitle className="text-sm font-medium">Pagado</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{fmtUSD(summary?.pagado ?? 0)}</div></CardContent>
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

      {/* Desglose por subtipo */}
      {subtipoEntries.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Por subtipo de costo</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {subtipoEntries.sort(([, a], [, b]) => b - a).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => setSubtipo(subtipo === key ? "todos" : key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    subtipo === key ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"
                  }`}
                >
                  {key} · {fmtUSD(val)}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                  <TableHead>Detalle</TableHead>
                  <TableHead>Subtipo</TableHead>
                  <TableHead>Emisión</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className="text-right">Monto USD</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row: any) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">{row.detalle}</TableCell>
                    <TableCell>
                      {row.subtipoCosto ? (
                        <Badge variant="outline" className="text-xs">{row.subtipoCosto}</Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.fechaEmision ? new Date(row.fechaEmision).toLocaleDateString("es-AR") : "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.fechaVencimiento ? new Date(row.fechaVencimiento).toLocaleDateString("es-AR") : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {fmtUSD(parseFloat(row.montoTotalUSD ?? row.montoUSD ?? "0"))}
                    </TableCell>
                    <TableCell>
                      {row.pagadoAlCierre ? (
                        <Badge className="bg-green-100 text-green-800">Pagado</Badge>
                      ) : row.vencido ? (
                        <Badge variant="destructive">Vencido</Badge>
                      ) : (
                        <Badge variant="secondary">Pendiente</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!row.pagadoAlCierre && row.id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => markPagadoMutation.mutate(row.id)}
                          disabled={markPagadoMutation.isPending}
                        >
                          Marcar pagado
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
