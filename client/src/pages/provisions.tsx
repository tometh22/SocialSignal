import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, UploadCloud } from "lucide-react";
import { Link } from "wouter";
import { Label } from "@/components/ui/label";

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1).padStart(2, "0"),
  label: new Date(2000, i, 1).toLocaleString("es-AR", { month: "long" }),
}));

const YEARS = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - 1 + i));

function fmtUSD(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}

export default function ProvisionsPage() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [releaseRow, setReleaseRow] = useState<any | null>(null);
  const [releaseAmount, setReleaseAmount] = useState("");
  const [releaseNote, setReleaseNote] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const period = `${year}-${month}`;

  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/provisions", period],
    queryFn: () => apiRequest(`/api/provisions?period=${period}`, "GET"),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/provisions/${id}/approve`, "POST", {}),
    onSuccess: () => {
      toast({ title: "Provisión aprobada" });
      qc.invalidateQueries({ queryKey: ["/api/provisions"] });
    },
    onError: (error: Error) => toast({ title: "No se pudo aprobar", description: error.message, variant: "destructive" }),
  });
  const releaseMutation = useMutation({
    mutationFn: () => apiRequest(`/api/provisions/${releaseRow!.id}/release`, "POST", { amount: releaseAmount, periodKey: period, note: releaseNote }),
    onSuccess: () => {
      toast({ title: "Liberación registrada" });
      qc.invalidateQueries({ queryKey: ["/api/provisions"] });
      setReleaseRow(null); setReleaseAmount(""); setReleaseNote("");
    },
    onError: (error: Error) => toast({ title: "No se pudo liberar", description: error.message, variant: "destructive" }),
  });

  const totalActivo = rows.filter(r => r.tipo === "NUEVA_PROVISION" && ["APPROVED", "ACTIVE"].includes(r.status)).reduce((s, r) => s + parseFloat(r.remainingAmount ?? r.montoProvision ?? "0"), 0);
  const totalRecupero = rows.filter(r => r.tipo === "RECUPERO" && ["APPROVED", "ACTIVE"].includes(r.status)).reduce((s, r) => s + parseFloat(r.montoProvision ?? "0"), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Provisiones</h1>
          <p className="text-muted-foreground text-sm">Provisiones de facturación adelantada y contingencias</p>
        </div>
        <Button asChild><Link href="/finance/cargar"><UploadCloud className="h-4 w-4 mr-2" />Cargar provisión</Link></Button>
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

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Provisiones activas</CardTitle>
            <ShieldAlert className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{fmtUSD(totalActivo)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Recuperos</CardTitle>
            <ShieldAlert className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{fmtUSD(totalRecupero)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Neto</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{fmtUSD(totalActivo - totalRecupero)}</div></CardContent>
        </Card>
      </div>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">Cargando...</div>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              No hay provisiones para {period}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Mes aplicación</TableHead>
                  <TableHead className="text-right">Monto Provisión</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Criterio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fuente</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row: any) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.clienteNombre || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={row.tipo === "RECUPERO" ? "default" : "secondary"}>
                        {row.tipo === "RECUPERO" ? "Recupero" : "Nueva Provisión"}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.mesAplicacion || row.periodKey}</TableCell>
                    <TableCell className="text-right font-mono">{fmtUSD(parseFloat(row.montoProvision ?? "0"))}</TableCell>
                    <TableCell className="text-right font-mono">{fmtUSD(parseFloat(row.remainingAmount ?? row.montoProvision ?? "0"))}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{row.criterio || "-"}</TableCell>
                    <TableCell><Badge variant="outline">{row.status || "PROPOSED"}</Badge></TableCell>
                    <TableCell>
                      {row.importBatch ? (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Excel</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Mind</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {(row.status || "PROPOSED") === "PROPOSED" && <Button size="sm" variant="outline" disabled={approveMutation.isPending} onClick={() => approveMutation.mutate(row.id)}>Aprobar</Button>}
                        {["APPROVED", "ACTIVE"].includes(row.status) && Number(row.remainingAmount ?? row.montoProvision ?? 0) > 0 && <Button size="sm" variant="outline" onClick={() => { setReleaseRow(row); setReleaseAmount(String(row.remainingAmount ?? row.montoProvision ?? "")); }}>Liberar</Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Dialog open={Boolean(releaseRow)} onOpenChange={(open) => { if (!open) setReleaseRow(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Liberar provisión</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Monto ({releaseRow?.currency || "USD"})</Label><Input type="number" min="0.01" step="0.01" value={releaseAmount} onChange={(event) => setReleaseAmount(event.target.value)} /></div>
            <div><Label>Motivo</Label><Input value={releaseNote} onChange={(event) => setReleaseNote(event.target.value)} placeholder="Explicá por qué se libera" /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setReleaseRow(null)}>Cancelar</Button><Button disabled={releaseMutation.isPending || Number(releaseAmount) <= 0 || releaseNote.trim().length < 5} onClick={() => releaseMutation.mutate()}>Confirmar liberación</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
