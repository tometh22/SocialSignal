import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, ArrowUp, ArrowDown, Wallet } from "lucide-react";

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1).padStart(2, "0"),
  label: new Date(2000, i, 1).toLocaleString("es-AR", { month: "long" }),
}));

const YEARS = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - 1 + i));

function fmtUSD(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}

interface CashflowRow {
  id: number;
  fecha?: string;
  tipoMovimiento: string;
  banco?: string;
  detalleOperacion?: string;
  concepto?: string;
  montoUSD?: string;
}

interface CashflowBalance {
  balances: Record<string, number>;
  totalUSD?: number;
}

export default function CashflowPage() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [banco, setBanco] = useState("todos");
  const [tipo, setTipo] = useState("todos");

  const period = `${year}-${month}`;

  // Last day of selected month
  const lastDay = new Date(parseInt(year), parseInt(month), 0);
  const dateStr = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;

  const { data: rows = [], isLoading } = useQuery<CashflowRow[]>({
    queryKey: ["/api/cashflow", period, banco, tipo],
    queryFn: () => {
      const params = new URLSearchParams({ period });
      if (banco !== "todos") params.set("banco", banco);
      if (tipo !== "todos") params.set("tipo", tipo);
      return apiRequest(`/api/cashflow?${params}`, "GET");
    },
  });

  const { data: balance } = useQuery<CashflowBalance>({
    queryKey: ["/api/cashflow/balance", dateStr],
    queryFn: () => apiRequest(`/api/cashflow/balance?date=${dateStr}`, "GET"),
    enabled: !!dateStr,
  });

  const ingresos = rows.filter(r => r.tipoMovimiento === "Ingreso").reduce((s, r) => s + parseFloat(r.montoUSD ?? "0"), 0);
  const egresos = rows.filter(r => r.tipoMovimiento === "Egreso").reduce((s, r) => s + parseFloat(r.montoUSD ?? "0"), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cashflow</h1>
        <p className="text-muted-foreground text-sm">Movimientos bancarios importados desde el Excel MAESTRO</p>
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
        <Select value={banco} onValueChange={setBanco}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los bancos</SelectItem>
            <SelectItem value="Santander">Santander</SelectItem>
            <SelectItem value="BOA">BOA</SelectItem>
            <SelectItem value="CAJA">Caja</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="Ingreso">Ingresos</SelectItem>
            <SelectItem value="Egreso">Egresos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Ingresos</CardTitle>
            <ArrowUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{fmtUSD(ingresos)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Egresos</CardTitle>
            <ArrowDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{fmtUSD(egresos)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Neto</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${ingresos - egresos >= 0 ? "text-green-600" : "text-red-600"}`}>
              {fmtUSD(ingresos - egresos)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{fmtUSD(balance?.totalUSD ?? 0)}</div></CardContent>
        </Card>
      </div>

      {/* Saldos por banco */}
      {balance?.balances && (
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(balance.balances as Record<string, number>).map(([bank, saldo]) => (
            <Card key={bank}>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{bank}</CardTitle></CardHeader>
              <CardContent><div className="text-xl font-semibold">{fmtUSD(saldo)}</div></CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">Cargando...</div>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              No hay movimientos para {period}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead className="text-right">Monto USD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-sm">
                      {row.fecha ? new Date(row.fecha).toLocaleDateString("es-AR") : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge className={row.tipoMovimiento === "Ingreso" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                        {row.tipoMovimiento}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.banco || "-"}</TableCell>
                    <TableCell className="max-w-[250px] truncate text-sm">{row.detalleOperacion || row.concepto || "-"}</TableCell>
                    <TableCell className={`text-right font-mono ${row.tipoMovimiento === "Ingreso" ? "text-green-600" : "text-red-600"}`}>
                      {fmtUSD(parseFloat(row.montoUSD ?? "0"))}
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
