import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash2, DollarSign, Clock, Users, TrendingUp, Edit, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Personnel, PersonnelHistoricalCost } from "@shared/schema";

const personnelHistoricalCostSchema = z.object({
  personnelId: z.number().min(1, "Debe seleccionar una persona"),
  year: z.number().min(2020, "Año debe ser mayor a 2020").max(2030, "Año debe ser menor a 2030"),
  month: z.number().min(1, "Mes debe ser entre 1 y 12").max(12, "Mes debe ser entre 1 y 12"),
  hourlyRateARS: z.number().min(0, "Tarifa por hora ARS debe ser positiva").optional(),
  monthlySalaryARS: z.number().min(0, "Salario mensual ARS debe ser positivo").optional(),
  hourlyRateUSD: z.number().min(0, "Tarifa por hora USD debe ser positiva").optional(),
  monthlySalaryUSD: z.number().min(0, "Salario mensual USD debe ser positivo").optional(),
  adjustmentReason: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => {
  return data.hourlyRateARS || data.monthlySalaryARS || data.hourlyRateUSD || data.monthlySalaryUSD;
}, {
  message: "Debe especificar al menos una tarifa o salario",
  path: ["hourlyRateARS"]
});

type PersonnelHistoricalCostFormData = z.infer<typeof personnelHistoricalCostSchema>;

interface PersonnelHistoricalCostsManagerProps {
  onClose?: () => void;
}

export function PersonnelHistoricalCostsManager({ onClose }: PersonnelHistoricalCostsManagerProps) {
  const [editingCost, setEditingCost] = useState<PersonnelHistoricalCost | null>(null);
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<PersonnelHistoricalCostFormData>({
    resolver: zodResolver(personnelHistoricalCostSchema),
    defaultValues: {
      personnelId: 0,
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      hourlyRateARS: 0,
      hourlyRateUSD: 0,
      adjustmentReason: "",
      notes: "",
    },
  });

  // Queries
  const { data: personnel = [] } = useQuery<Personnel[]>({
    queryKey: ["/api/personnel"],
  });

  const { data: historicalCosts = [] } = useQuery<PersonnelHistoricalCost[]>({
    queryKey: ["/api/personnel-historical-costs"],
  });

  // Mutations
  const createCostMutation = useMutation({
    mutationFn: (data: PersonnelHistoricalCostFormData) => 
      apiRequest("/api/personnel-historical-costs", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personnel-historical-costs"] });
      form.reset();
      setShowForm(false);
    },
  });

  const updateCostMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PersonnelHistoricalCostFormData> }) =>
      apiRequest(`/api/personnel-historical-costs/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personnel-historical-costs"] });
      setEditingCost(null);
      form.reset();
      setShowForm(false);
    },
  });

  const deleteCostMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/personnel-historical-costs/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personnel-historical-costs"] });
    },
  });

  const onSubmit = (data: PersonnelHistoricalCostFormData) => {
    if (editingCost) {
      updateCostMutation.mutate({ id: editingCost.id, data });
    } else {
      createCostMutation.mutate(data);
    }
  };

  const handleEdit = (cost: PersonnelHistoricalCost) => {
    setEditingCost(cost);
    form.setValue("personnelId", cost.personnelId);
    form.setValue("year", cost.year);
    form.setValue("month", cost.month);
    form.setValue("hourlyRateARS", cost.hourlyRateARS);
    form.setValue("hourlyRateUSD", cost.hourlyRateUSD || 0);
    form.setValue("adjustmentReason", cost.adjustmentReason || "");
    form.setValue("notes", cost.notes || "");
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("¿Está seguro de que desea eliminar este costo histórico?")) {
      deleteCostMutation.mutate(id);
    }
  };

  const getPersonnelName = (personnelId: number) => {
    const person = personnel.find(p => p.id === personnelId);
    return person ? person.name : "Desconocido";
  };

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-green-600" />
          <div>
            <CardTitle className="text-xl font-bold">Costos Históricos de Personal</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Gestiona los costos históricos por hora para cálculos de rentabilidad temporal
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => {
              setEditingCost(null);
              form.reset();
              setShowForm(!showForm);
            }}
            variant={showForm ? "outline" : "default"}
          >
            <Plus className="h-4 w-4 mr-2" />
            {showForm ? "Cancelar" : "Nuevo Costo"}
          </Button>
          {onClose && (
            <Button onClick={onClose} variant="outline">
              Cerrar
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Formulario de crear/editar */}
        {showForm && (
          <Card className="bg-slate-50 border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg">
                {editingCost ? "Editar Costo Histórico" : "Nuevo Costo Histórico"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="personnelId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Persona</FormLabel>
                        <Select 
                          onValueChange={(value) => field.onChange(parseInt(value))}
                          value={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar persona" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {personnel.map((person) => (
                              <SelectItem key={person.id} value={person.id.toString()}>
                                {person.name}
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
                    name="year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Año</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            min="2020"
                            max="2030"
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
                          onValueChange={(value) => field.onChange(parseInt(value))}
                          value={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar mes" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {monthNames.map((month, index) => (
                              <SelectItem key={index + 1} value={(index + 1).toString()}>
                                {month}
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
                    name="hourlyRateARS"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tarifa por Hora (ARS)</FormLabel>
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
                    control={form.control}
                    name="hourlyRateUSD"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tarifa por Hora (USD) - Opcional</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="adjustmentReason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Razón del Ajuste</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Ej: Inflación, promoción, ajuste salarial..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Notas Adicionales</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Cualquier información adicional relevante..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="md:col-span-2 flex justify-end gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setShowForm(false);
                        setEditingCost(null);
                        form.reset();
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createCostMutation.isPending || updateCostMutation.isPending}
                    >
                      {editingCost ? "Actualizar" : "Crear"} Costo
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Lista de costos históricos */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Costos Históricos Registrados</h3>
            <Badge variant="outline" className="text-sm">
              {historicalCosts.length} registro{historicalCosts.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          {historicalCosts.length === 0 ? (
            <Card className="p-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                No hay costos históricos registrados
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Comience agregando costos históricos para un mejor análisis de rentabilidad temporal
              </p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar Primer Costo
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4">
              {historicalCosts.map((cost) => (
                <Card key={cost.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">{getPersonnelName(cost.personnelId)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-muted-foreground">
                          {monthNames[cost.month - 1]} {cost.year}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-emerald-600" />
                        <span className="font-mono text-sm">
                          ${cost.hourlyRateARS.toLocaleString()} ARS/h
                        </span>
                      </div>
                      {cost.hourlyRateUSD && (
                        <span className="font-mono text-sm text-muted-foreground">
                          (${cost.hourlyRateUSD.toLocaleString()} USD/h)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(cost)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(cost.id)}
                        disabled={deleteCostMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {(cost.adjustmentReason || cost.notes) && (
                    <div className="mt-3 pl-6 space-y-1">
                      {cost.adjustmentReason && (
                        <p className="text-sm text-muted-foreground">
                          <strong>Razón:</strong> {cost.adjustmentReason}
                        </p>
                      )}
                      {cost.notes && (
                        <p className="text-sm text-muted-foreground">
                          <strong>Notas:</strong> {cost.notes}
                        </p>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}