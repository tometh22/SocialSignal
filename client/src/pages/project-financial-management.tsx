import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon, Plus, TrendingUp, DollarSign, FileText, Calendar } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Tipos
type ProjectMonthlySales = {
  id: number;
  projectId: number;
  year: number;
  month: number;
  salesAmountUsd: number;
  salesType: string;
  description?: string;
  createdAt: Date;
  createdBy?: number;
};

type ProjectFinancialTransaction = {
  id: number;
  projectId: number;
  invoiceDate: Date;
  invoiceAmountUsd: number;
  collectionDate?: Date;
  invoiceStatus: string;
  description?: string;
  createdAt: Date;
  createdBy?: number;
};

// Esquemas de validación
const monthlySalesSchema = z.object({
  year: z.number().min(2020).max(2030),
  month: z.number().min(1).max(12),
  salesAmountUsd: z.number().min(0),
  salesType: z.string().min(1, "Tipo de venta requerido"),
  description: z.string().optional(),
});

const financialTransactionSchema = z.object({
  invoiceDate: z.string().min(1, "Fecha de factura requerida"),
  invoiceAmountUsd: z.number().min(0),
  collectionDate: z.string().optional(),
  invoiceStatus: z.string().min(1, "Estado de factura requerido"),
  description: z.string().optional(),
});

type MonthlySalesFormData = z.infer<typeof monthlySalesSchema>;
type FinancialTransactionFormData = z.infer<typeof financialTransactionSchema>;

export default function ProjectFinancialManagement() {
  const { projectId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [openMonthlySales, setOpenMonthlySales] = useState(false);
  const [openFinancialTransaction, setOpenFinancialTransaction] = useState(false);

  // Obtener datos del proyecto
  const { data: project, isLoading: loadingProject } = useQuery({
    queryKey: [`/api/active-projects/${projectId}`],
    enabled: !!projectId,
  });

  // Obtener ventas operacionales mensuales
  const { data: monthlySales = [], isLoading: loadingMonthlySales } = useQuery({
    queryKey: [`/api/projects/${projectId}/monthly-sales`],
    enabled: !!projectId,
  });

  // Obtener transacciones financieras
  const { data: financialTransactions = [], isLoading: loadingTransactions } = useQuery({
    queryKey: [`/api/projects/${projectId}/financial-transactions`],
    enabled: !!projectId,
  });

  // Formularios
  const monthlySalesForm = useForm<MonthlySalesFormData>({
    resolver: zodResolver(monthlySalesSchema),
    defaultValues: {
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      salesAmountUsd: 0,
      salesType: "",
      description: "",
    },
  });

  const financialTransactionForm = useForm<FinancialTransactionFormData>({
    resolver: zodResolver(financialTransactionSchema),
    defaultValues: {
      invoiceDate: "",
      invoiceAmountUsd: 0,
      collectionDate: "",
      invoiceStatus: "pendiente",
      description: "",
    },
  });

  // Mutaciones
  const createMonthlySalesMutation = useMutation({
    mutationFn: (data: MonthlySalesFormData) =>
      apiRequest(`/api/projects/${projectId}/monthly-sales`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/monthly-sales`] });
      setOpenMonthlySales(false);
      monthlySalesForm.reset();
      toast({
        title: "Venta operacional registrada",
        description: "Los datos se guardaron correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo registrar la venta operacional",
        variant: "destructive",
      });
    },
  });

  const createFinancialTransactionMutation = useMutation({
    mutationFn: (data: FinancialTransactionFormData) =>
      apiRequest(`/api/projects/${projectId}/financial-transactions`, {
        method: "POST",
        body: JSON.stringify({
          ...data,
          invoiceDate: new Date(data.invoiceDate).toISOString(),
          collectionDate: data.collectionDate ? new Date(data.collectionDate).toISOString() : null,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/financial-transactions`] });
      setOpenFinancialTransaction(false);
      financialTransactionForm.reset();
      toast({
        title: "Transacción financiera registrada",
        description: "Los datos se guardaron correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo registrar la transacción financiera",
        variant: "destructive",
      });
    },
  });

  // Cálculos de resumen
  const totalMonthlySales = (monthlySales as ProjectMonthlySales[]).reduce((sum: number, sale: ProjectMonthlySales) => sum + sale.salesAmountUsd, 0);
  const totalInvoiced = (financialTransactions as ProjectFinancialTransaction[]).reduce((sum: number, txn: ProjectFinancialTransaction) => sum + txn.invoiceAmountUsd, 0);
  const totalCollected = (financialTransactions as ProjectFinancialTransaction[])
    .filter((txn: ProjectFinancialTransaction) => txn.collectionDate)
    .reduce((sum: number, txn: ProjectFinancialTransaction) => sum + txn.invoiceAmountUsd, 0);
  const pendingCollection = totalInvoiced - totalCollected;

  if (loadingProject) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Proyecto no encontrado</h1>
          <Button onClick={() => setLocation("/active-projects")}>Volver a Proyectos</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Gestión Financiera
          </h1>
          <p className="text-lg text-gray-600 mb-1">
            {(project as any)?.quotation?.projectName || "Proyecto sin nombre"}
          </p>
          <p className="text-sm text-gray-500">
            Cliente: {(project as any)?.quotation?.client?.name || "Cliente no especificado"}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setLocation("/active-projects")}
        >
          Volver a Proyectos
        </Button>
      </div>

      {/* Resumen Financiero */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Operacionales</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalMonthlySales.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total reconocido</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Facturado</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalInvoiced.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Facturas emitidas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cobrado</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${totalCollected.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Efectivamente cobrado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendiente Cobro</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">${pendingCollection.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Por cobrar</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs para análisis separado */}
      <Tabs defaultValue="operational" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="operational">Análisis Operacional</TabsTrigger>
          <TabsTrigger value="financial">Análisis Financiero</TabsTrigger>
        </TabsList>

        {/* Tab de Análisis Operacional */}
        <TabsContent value="operational" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Ventas Operacionales Mensuales</CardTitle>
                  <CardDescription>
                    Reconocimiento de ingresos por servicios prestados (independiente de facturación)
                  </CardDescription>
                </div>
                <Dialog open={openMonthlySales} onOpenChange={setOpenMonthlySales}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Registrar Venta
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Registrar Venta Operacional</DialogTitle>
                      <DialogDescription>
                        Registra los ingresos reconocidos por servicios prestados en un período específico
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...monthlySalesForm}>
                      <form onSubmit={monthlySalesForm.handleSubmit((data) => createMonthlySalesMutation.mutate(data))} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={monthlySalesForm.control}
                            name="year"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Año</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    {...field} 
                                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={monthlySalesForm.control}
                            name="month"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Mes</FormLabel>
                                <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Seleccionar mes" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {Array.from({ length: 12 }, (_, i) => (
                                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                                        {format(new Date(2024, i, 1), "MMMM", { locale: es })}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={monthlySalesForm.control}
                          name="salesAmountUsd"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Monto Venta (USD)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  step="0.01"
                                  {...field} 
                                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={monthlySalesForm.control}
                          name="salesType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tipo de Venta</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar tipo" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="fee_monthly">Fee Mensual</SelectItem>
                                  <SelectItem value="one_time">Proyecto Único</SelectItem>
                                  <SelectItem value="social_listening">Social Listening</SelectItem>
                                  <SelectItem value="campaign">Campaña Digital</SelectItem>
                                  <SelectItem value="other">Otro</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={monthlySalesForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Descripción</FormLabel>
                              <FormControl>
                                <Textarea {...field} placeholder="Detalles del servicio prestado..." />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="flex justify-end space-x-2">
                          <Button type="button" variant="outline" onClick={() => setOpenMonthlySales(false)}>
                            Cancelar
                          </Button>
                          <Button type="submit" disabled={createMonthlySalesMutation.isPending}>
                            {createMonthlySalesMutation.isPending ? "Guardando..." : "Guardar"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {loadingMonthlySales ? (
                <div className="animate-pulse space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-12 bg-gray-200 rounded"></div>
                  ))}
                </div>
              ) : (monthlySales as ProjectMonthlySales[]).length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No hay ventas operacionales registradas
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Monto (USD)</TableHead>
                      <TableHead>Descripción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(monthlySales as ProjectMonthlySales[]).map((sale: ProjectMonthlySales) => (
                      <TableRow key={sale.id}>
                        <TableCell>
                          {format(new Date(sale.year, sale.month - 1, 1), "MMMM yyyy", { locale: es })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{sale.salesType}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          ${sale.salesAmountUsd.toLocaleString()}
                        </TableCell>
                        <TableCell>{sale.description || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab de Análisis Financiero */}
        <TabsContent value="financial" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Transacciones Financieras</CardTitle>
                  <CardDescription>
                    Facturación y cobranza real con fechas exactas (cash flow)
                  </CardDescription>
                </div>
                <Dialog open={openFinancialTransaction} onOpenChange={setOpenFinancialTransaction}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Registrar Transacción
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Registrar Transacción Financiera</DialogTitle>
                      <DialogDescription>
                        Registra facturas emitidas y fechas de cobranza reales
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...financialTransactionForm}>
                      <form onSubmit={financialTransactionForm.handleSubmit((data) => createFinancialTransactionMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={financialTransactionForm.control}
                          name="invoiceDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Fecha de Factura</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={financialTransactionForm.control}
                          name="invoiceAmountUsd"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Monto Facturado (USD)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  step="0.01"
                                  {...field} 
                                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={financialTransactionForm.control}
                          name="invoiceStatus"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Estado de Factura</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar estado" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="pendiente">Pendiente</SelectItem>
                                  <SelectItem value="cobrada">Cobrada</SelectItem>
                                  <SelectItem value="vencida">Vencida</SelectItem>
                                  <SelectItem value="cancelada">Cancelada</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={financialTransactionForm.control}
                          name="collectionDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Fecha de Cobranza (opcional)</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={financialTransactionForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Descripción</FormLabel>
                              <FormControl>
                                <Textarea {...field} placeholder="Detalles de la factura..." />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="flex justify-end space-x-2">
                          <Button type="button" variant="outline" onClick={() => setOpenFinancialTransaction(false)}>
                            Cancelar
                          </Button>
                          <Button type="submit" disabled={createFinancialTransactionMutation.isPending}>
                            {createFinancialTransactionMutation.isPending ? "Guardando..." : "Guardar"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {loadingTransactions ? (
                <div className="animate-pulse space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-12 bg-gray-200 rounded"></div>
                  ))}
                </div>
              ) : (financialTransactions as ProjectFinancialTransaction[]).length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No hay transacciones financieras registradas
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha Factura</TableHead>
                      <TableHead>Monto (USD)</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha Cobranza</TableHead>
                      <TableHead>Descripción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(financialTransactions as ProjectFinancialTransaction[]).map((txn: ProjectFinancialTransaction) => (
                      <TableRow key={txn.id}>
                        <TableCell>
                          {format(new Date(txn.invoiceDate), "dd/MM/yyyy", { locale: es })}
                        </TableCell>
                        <TableCell className="font-medium">
                          ${txn.invoiceAmountUsd.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              txn.invoiceStatus === 'cobrada' ? 'default' :
                              txn.invoiceStatus === 'vencida' ? 'destructive' :
                              txn.invoiceStatus === 'cancelada' ? 'secondary' : 'outline'
                            }
                          >
                            {txn.invoiceStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {txn.collectionDate 
                            ? format(new Date(txn.collectionDate), "dd/MM/yyyy", { locale: es })
                            : "-"
                          }
                        </TableCell>
                        <TableCell>{txn.description || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}