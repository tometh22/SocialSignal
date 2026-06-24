import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Calendar, TrendingUp, DollarSign, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Schema de validación para tipos de cambio
const exchangeRateSchema = z.object({
  year: z.number().min(2020).max(2030),
  month: z.number().min(1).max(12),
  rate: z.number().min(0.01, "La tasa debe ser mayor a 0"),
  rateType: z.enum(["end_of_month", "daily", "average"]),
  source: z.enum(["Blue", "REM", "MEP", "CCL", "BCRA", "Manual"]).default("Blue"),
  specificDate: z.string().optional(),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
});

type ExchangeRateFormData = z.infer<typeof exchangeRateSchema>;

interface ExchangeRate {
  id: number;
  year: number;
  month: number;
  rate: number;
  rateType: "end_of_month" | "daily" | "average";
  source?: string;
  specificDate?: string;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy?: number;
  updatedBy?: number;
}

const RATE_SOURCES = ["Blue", "REM", "MEP", "CCL", "BCRA", "Manual"] as const;

const SOURCE_BADGE: Record<string, { label: string; className: string }> = {
  Blue: { label: "Blue", className: "bg-blue-100 text-blue-800 border-blue-200" },
  REM: { label: "REM", className: "bg-purple-100 text-purple-800 border-purple-200" },
  MEP: { label: "MEP", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  CCL: { label: "CCL", className: "bg-orange-100 text-orange-800 border-orange-200" },
  BCRA: { label: "BCRA", className: "bg-green-100 text-green-800 border-green-200" },
  Manual: { label: "Manual", className: "bg-gray-100 text-gray-800 border-gray-200" },
};

const MONTHS = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

const RATE_TYPES = [
  { value: "end_of_month", label: "Fin de mes" },
  { value: "daily", label: "Diario" },
  { value: "average", label: "Promedio mensual" },
];

export function ExchangeRateManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<ExchangeRate | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isRemDialogOpen, setIsRemDialogOpen] = useState(false);
  const [remText, setRemText] = useState("");
  const { toast } = useToast();

  // Consulta para obtener tipos de cambio
  const { data: exchangeRates = [], isLoading } = useQuery({
    queryKey: ["/api/exchange-rates", selectedYear],
    queryFn: () => apiRequest(`/api/exchange-rates?year=${selectedYear}`, "GET"),
  });

  // Formulario
  const form = useForm<ExchangeRateFormData>({
    resolver: zodResolver(exchangeRateSchema),
    defaultValues: {
      year: selectedYear,
      month: new Date().getMonth() + 1,
      rate: 0,
      rateType: "end_of_month",
      source: "Blue",
      isActive: true,
    },
  });

  // Mutación para crear/actualizar tipo de cambio
  const createMutation = useMutation({
    mutationFn: (data: ExchangeRateFormData) => 
      apiRequest("/api/exchange-rates", "POST", data),
    onSuccess: () => {
      toast({
        title: "Tipo de cambio creado",
        description: "El tipo de cambio se ha guardado correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/exchange-rates"] });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al crear el tipo de cambio",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ExchangeRateFormData> }) =>
      apiRequest(`/api/exchange-rates/${id}`, "PATCH", data),
    onSuccess: () => {
      toast({
        title: "Tipo de cambio actualizado",
        description: "Los cambios se han guardado correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/exchange-rates"] });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar el tipo de cambio",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/exchange-rates/${id}`, "DELETE"),
    onSuccess: () => {
      toast({
        title: "Tipo de cambio eliminado",
        description: "El tipo de cambio se ha eliminado correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/exchange-rates"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar el tipo de cambio",
        variant: "destructive",
      });
    },
  });

  // Sincronizar dólar Blue de hoy (API pública dolarapi.com)
  const syncBlueMutation = useMutation({
    mutationFn: () => apiRequest("/api/exchange-rates/sync-blue", "POST"),
    onSuccess: (result: any) => {
      toast({
        title: "Blue sincronizado",
        description: result?.rate
          ? `Dólar blue de hoy: ${formatCurrency(Number(result.rate))}`
          : "Tipo de cambio blue actualizado.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/exchange-rates"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error al sincronizar Blue",
        description: error.message || "No se pudo obtener el dólar blue",
        variant: "destructive",
      });
    },
  });

  // Importar estimaciones REM (BCRA) en bloque
  const importRemMutation = useMutation({
    mutationFn: (estimates: { year: number; month: number; rate: number }[]) =>
      apiRequest("/api/exchange-rates/import-rem", "POST", { estimates }),
    onSuccess: (result: any) => {
      toast({
        title: "REM importado",
        description: `Se importaron ${result?.count ?? 0} estimaciones del REM.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/exchange-rates"] });
      setIsRemDialogOpen(false);
      setRemText("");
    },
    onError: (error: any) => {
      toast({
        title: "Error al importar REM",
        description: error.message || "No se pudo importar el REM",
        variant: "destructive",
      });
    },
  });

  // Parsea filas "año,mes,tasa" o "año-mes,tasa" (una por línea, separadores , ; o tab)
  const handleImportRem = () => {
    const estimates: { year: number; month: number; rate: number }[] = [];
    const lines = remText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const parts = line.split(/[,;\t]+/).map((p) => p.trim());
      let year: number, month: number, rate: number;
      if (parts.length >= 3) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        rate = parseFloat(parts[2].replace(/\./g, "").replace(",", "."));
      } else if (parts.length === 2 && parts[0].includes("-")) {
        const [y, m] = parts[0].split("-");
        year = parseInt(y, 10);
        month = parseInt(m, 10);
        rate = parseFloat(parts[1].replace(/\./g, "").replace(",", "."));
      } else {
        continue;
      }
      if (Number.isFinite(year) && month >= 1 && month <= 12 && Number.isFinite(rate) && rate > 0) {
        estimates.push({ year, month, rate });
      }
    }
    if (estimates.length === 0) {
      toast({
        title: "Sin datos válidos",
        description: "Usá el formato: año, mes, tasa (una fila por línea).",
        variant: "destructive",
      });
      return;
    }
    importRemMutation.mutate(estimates);
  };

  const handleSubmit = (data: ExchangeRateFormData) => {
    if (editingRate) {
      updateMutation.mutate({ id: editingRate.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (rate: ExchangeRate) => {
    setEditingRate(rate);
    form.reset({
      year: rate.year,
      month: rate.month,
      rate: rate.rate,
      rateType: rate.rateType,
      source: (rate.source as any) || "Blue",
      specificDate: rate.specificDate || "",
      isActive: rate.isActive,
      notes: rate.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingRate(null);
    form.reset({
      year: selectedYear,
      month: new Date().getMonth() + 1,
      rate: 0,
      rateType: "end_of_month",
      source: "Blue",
      isActive: true,
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getMonthName = (month: number) => {
    return MONTHS.find(m => m.value === month)?.label || month.toString();
  };

  const getRateTypeLabel = (rateType: string) => {
    return RATE_TYPES.find(rt => rt.value === rateType)?.label || rateType;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tipos de Cambio USD/ARS</h2>
          <p className="text-muted-foreground">
            Gestiona los tipos de cambio históricos para cálculos de costos y rentabilidad
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select
            value={selectedYear.toString()}
            onValueChange={(value) => setSelectedYear(parseInt(value))}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 11 }, (_, i) => 2020 + i).map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => syncBlueMutation.mutate()}
            disabled={syncBlueMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncBlueMutation.isPending ? "animate-spin" : ""}`} />
            Sync Blue hoy
          </Button>
          <Button variant="outline" onClick={() => setIsRemDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importar REM
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Agregar Tipo de Cambio
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  {editingRate ? "Editar Tipo de Cambio" : "Nuevo Tipo de Cambio"}
                </DialogTitle>
                <DialogDescription>
                  {editingRate 
                    ? "Modifica los datos del tipo de cambio existente."
                    : "Agrega un nuevo tipo de cambio mensual para USD/ARS."
                  }
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="year"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Año</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={2020}
                              max={2030}
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="month"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mes</FormLabel>
                          <Select
                            value={field.value.toString()}
                            onValueChange={(value) => field.onChange(parseInt(value))}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {MONTHS.map((month) => (
                                <SelectItem key={month.value} value={month.value.toString()}>
                                  {month.label}
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
                    control={form.control}
                    name="rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tasa de Cambio (ARS por USD)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="1150.50"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="rateType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Tasa</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {RATE_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="specificDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha Específica (opcional)</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="source"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fuente</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {RATE_SOURCES.map((src) => (
                              <SelectItem key={src} value={src}>
                                {src}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notas (opcional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Observaciones especiales..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={handleCloseDialog}>
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                    >
                      {editingRate ? "Actualizar" : "Crear"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          {/* Dialog: importar estimaciones REM */}
          <Dialog open={isRemDialogOpen} onOpenChange={setIsRemDialogOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Importar estimaciones REM (BCRA)</DialogTitle>
                <DialogDescription>
                  Pegá las estimaciones del REM, una por línea, con el formato{" "}
                  <span className="font-mono">año, mes, tasa</span>. Se guardan como tipo "estimated", fuente REM.
                </DialogDescription>
              </DialogHeader>
              <textarea
                className="w-full h-40 rounded-md border border-input bg-background p-3 text-sm font-mono"
                placeholder={"2026, 7, 1480\n2026, 8, 1525\n2026, 9, 1570"}
                value={remText}
                onChange={(e) => setRemText(e.target.value)}
              />
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsRemDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleImportRem} disabled={importRemMutation.isPending}>
                  {importRemMutation.isPending ? "Importando..." : "Importar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Registros</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{exchangeRates.length}</div>
            <p className="text-xs text-muted-foreground">
              Para el año {selectedYear}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa Promedio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {exchangeRates.length > 0
                ? formatCurrency(
                    exchangeRates.reduce((sum: number, rate: ExchangeRate) => sum + rate.rate, 0) /
                    exchangeRates.length
                  )
                : formatCurrency(0)
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Promedio del año
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa Máxima</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {exchangeRates.length > 0
                ? formatCurrency(Math.max(...exchangeRates.map((rate: ExchangeRate) => rate.rate)))
                : formatCurrency(0)
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Valor más alto
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa Mínima</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {exchangeRates.length > 0
                ? formatCurrency(Math.min(...exchangeRates.map((rate: ExchangeRate) => rate.rate)))
                : formatCurrency(0)
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Valor más bajo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de tipos de cambio */}
      <Card>
        <CardHeader>
          <CardTitle>Tipos de Cambio - {selectedYear}</CardTitle>
          <CardDescription>
            Historial de tipos de cambio USD/ARS configurados para cálculos del sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-muted-foreground">Cargando tipos de cambio...</div>
            </div>
          ) : exchangeRates.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-muted-foreground">
                No hay tipos de cambio configurados para el año {selectedYear}
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead>Tasa (ARS/USD)</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Fuente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha específica</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exchangeRates
                  .sort((a: ExchangeRate, b: ExchangeRate) => a.month - b.month)
                  .map((rate: ExchangeRate) => (
                    <TableRow key={rate.id}>
                      <TableCell className="font-medium">
                        {getMonthName(rate.month)} {rate.year}
                      </TableCell>
                      <TableCell className="font-mono">
                        {formatCurrency(rate.rate)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getRateTypeLabel(rate.rateType)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const src = rate.source || "Blue";
                          const badge = SOURCE_BADGE[src] || SOURCE_BADGE.Manual;
                          return (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${badge.className}`}>
                              {badge.label}
                            </span>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={rate.isActive ? "default" : "secondary"}>
                          {rate.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {rate.specificDate
                          ? new Date(rate.specificDate).toLocaleDateString()
                          : "-"
                        }
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {rate.notes || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(rate)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(rate.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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