import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, ShieldAlert } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1).padStart(2, "0"),
  label: new Date(2000, i, 1).toLocaleString("es-AR", { month: "long" }),
}));

const YEARS = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - 1 + i));

function fmtUSD(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}

const provisionSchema = z.object({
  periodKey: z.string().min(7),
  clienteNombre: z.string().min(1, "Requerido"),
  tipo: z.enum(["RECUPERO", "NUEVA_PROVISION"]),
  montoProvision: z.string().min(1, "Requerido"),
  criterio: z.string().optional(),
});

export default function ProvisionsPage() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const period = `${year}-${month}`;

  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/provisions", period],
    queryFn: () => apiRequest(`/api/provisions?period=${period}`, "GET"),
  });

  const form = useForm<z.infer<typeof provisionSchema>>({
    resolver: zodResolver(provisionSchema),
    defaultValues: { periodKey: period, tipo: "NUEVA_PROVISION", montoProvision: "" },
  });

  useEffect(() => {
    form.setValue("periodKey", period);
  }, [period, form]);

  const createMutation = useMutation({
    mutationFn: (data: z.infer<typeof provisionSchema>) => apiRequest("/api/provisions", "POST", data),
    onSuccess: () => {
      toast({ title: "Provisión creada" });
      qc.invalidateQueries({ queryKey: ["/api/provisions"] });
      setDialogOpen(false);
      form.reset();
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const totalActivo = rows.filter(r => r.tipo === "NUEVA_PROVISION").reduce((s, r) => s + parseFloat(r.montoProvision ?? "0"), 0);
  const totalRecupero = rows.filter(r => r.tipo === "RECUPERO").reduce((s, r) => s + parseFloat(r.montoProvision ?? "0"), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Provisiones</h1>
          <p className="text-muted-foreground text-sm">Provisiones de facturación adelantada y contingencias</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nueva Provisión</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva Provisión</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(data => createMutation.mutate(data))} className="space-y-4">
                <FormField control={form.control} name="clienteNombre" render={({ field }) => (
                  <FormItem><FormLabel>Cliente</FormLabel>
                    <FormControl><Input placeholder="Nombre del cliente" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="tipo" render={({ field }) => (
                  <FormItem><FormLabel>Tipo</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="NUEVA_PROVISION">Nueva Provisión</SelectItem>
                        <SelectItem value="RECUPERO">Recupero</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="montoProvision" render={({ field }) => (
                  <FormItem><FormLabel>Monto (USD)</FormLabel>
                    <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="criterio" render={({ field }) => (
                  <FormItem><FormLabel>Criterio (opcional)</FormLabel>
                    <FormControl><Input placeholder="Descripción del criterio..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createMutation.isPending}>Crear</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
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
                  <TableHead>Criterio</TableHead>
                  <TableHead>Fuente</TableHead>
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
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{row.criterio || "-"}</TableCell>
                    <TableCell>
                      {row.importBatch ? (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Excel</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Manual</Badge>
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
