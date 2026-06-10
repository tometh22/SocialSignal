import { useState } from "react";
import { useParams, Redirect, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, TrendingUp, TrendingDown, Percent, ArrowLeft } from "lucide-react";

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1).padStart(2, "0"),
  label: new Date(2000, i, 1).toLocaleString("es-AR", { month: "long" }),
}));

const YEARS = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - 1 + i));

function fmtUSD(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}

function fmtPct(n: number) {
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function fmtMultiplier(n: number) {
  return `${n.toFixed(2)}x`;
}

export default function ClientPnlPage() {
  const params = useParams<{ id: string }>();
  if (!params.id) return <Redirect to="/" />;

  const clientId = parseInt(params.id);
  if (isNaN(clientId)) return <Redirect to="/" />;

  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));

  const period = `${year}-${month}`;

  const { data: pnl, isLoading, error } = useQuery<any>({
    queryKey: ["/api/clients", clientId, "pnl", period],
    queryFn: () => apiRequest(`/api/clients/${clientId}/pnl?period=${period}`, "GET"),
  });

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Error cargando P&L del cliente
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1 text-muted-foreground">
          <Link href={`/client-summary/${clientId}`}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Volver al cliente
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">P&L por Cliente</h1>
        <p className="text-muted-foreground text-sm">
          {pnl?.client?.name ?? `Cliente #${clientId}`} — Rentabilidad y desglose de costos
        </p>
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
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground">Cargando...</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fmtUSD(pnl?.revenue ?? 0)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium">Costo</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{fmtUSD(pnl?.cost ?? 0)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium">Markup</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${(pnl?.markup ?? 0) >= 2.5 ? "text-green-600" : "text-amber-600"}`}>
                  {fmtMultiplier(pnl?.markup ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">mínimo 2.5x</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium">Margen</CardTitle>
                <Percent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${(pnl?.margin ?? 0) >= 30 ? "text-green-600" : (pnl?.margin ?? 0) >= 15 ? "text-yellow-600" : "text-red-600"}`}>
                  {fmtPct(pnl?.margin ?? 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Team breakdown */}
          <Card>
            <CardHeader><CardTitle className="text-base">Desglose de equipo</CardTitle></CardHeader>
            <CardContent className="p-0">
              {!pnl?.teamBreakdown?.length ? (
                <div className="flex items-center justify-center h-24 text-muted-foreground">
                  Sin datos de equipo para {period}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Persona</TableHead>
                      <TableHead>Subtipo</TableHead>
                      <TableHead className="text-right">Costo USD</TableHead>
                      <TableHead className="text-right">% del costo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(pnl.teamBreakdown as any[])
                      .sort((a, b) => b.costoUSD - a.costoUSD)
                      .map((member: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{member.persona}</TableCell>
                          <TableCell>
                            {member.subtipo ? (
                              <Badge variant="outline" className="text-xs">{member.subtipo}</Badge>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono">{fmtUSD(member.costoUSD)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {pnl.cost > 0 ? `${((member.costoUSD / pnl.cost) * 100).toFixed(1)}%` : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
