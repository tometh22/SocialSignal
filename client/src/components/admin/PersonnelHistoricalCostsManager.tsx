import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash2, DollarSign, Clock, Users, TrendingUp, Edit, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Personnel, PersonnelHistoricalCost } from "@shared/schema";
import { deriveHourlyRatesFromSalary } from "@shared/utils/personnel-cost";

const personnelHistoricalCostSchema = z.object({
  personnelId: z.number().min(1, "Debe seleccionar una persona"),
  year: z.number().min(2020, "Año debe ser mayor a 2020").max(2030, "Año debe ser menor a 2030"),
  month: z.number().min(1, "Mes debe ser entre 1 y 12").max(12, "Mes debe ser entre 1 y 12"),
  monthlyHours: z.number().min(0, "Las horas mensuales no pueden ser negativas").int("Las horas mensuales deben ser enteras").nullable().optional(),
  hourlyRateARS: z.number().min(0, "Tarifa por hora ARS debe ser positiva").optional(),
  monthlySalaryARS: z.number().min(0, "Salario mensual ARS debe ser positivo").optional(),
  hourlyRateUSD: z.number().min(0, "Tarifa por hora USD debe ser positiva").optional(),
  monthlySalaryUSD: z.number().min(0, "Salario mensual USD debe ser positivo").optional(),
  adjustmentReason: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => {
  return [data.hourlyRateARS, data.monthlySalaryARS, data.hourlyRateUSD, data.monthlySalaryUSD]
    .some((value) => value != null);
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
      monthlyHours: undefined,
      hourlyRateARS: undefined,
      monthlySalaryARS: undefined,
      hourlyRateUSD: undefined,
      monthlySalaryUSD: undefined,
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

  const selectedPersonnelId = useWatch({ control: form.control, name: "personnelId" });
  const monthlyHours = useWatch({ control: form.control, name: "monthlyHours" });
  const monthlySalaryARS = useWatch({ control: form.control, name: "monthlySalaryARS" });
  const monthlySalaryUSD = useWatch({ control: form.control, name: "monthlySalaryUSD" });
  const selectedPerson = personnel.find((person) => person.id === selectedPersonnelId);

  useEffect(() => {
    if (!showForm || selectedPersonnelId <= 0) return;
    const personHours = selectedPerson?.monthlyHours ?? null;
    if (monthlyHours === undefined && personHours !== null) {
      form.setValue("monthlyHours", personHours);
    }
  }, [form, monthlyHours, selectedPerson, selectedPersonnelId, showForm]);

  useEffect(() => {
    const derivedRates = deriveHourlyRatesFromSalary({ monthlyHours, monthlySalaryARS, monthlySalaryUSD });
    if (derivedRates.hourlyRateARS !== undefined) {
      form.setValue("hourlyRateARS", derivedRates.hourlyRateARS, { shouldValidate: true });
    }
    if (derivedRates.hourlyRateUSD !== undefined) {
      form.setValue("hourlyRateUSD", derivedRates.hourlyRateUSD, { shouldValidate: true });
    }
  }, [form, monthlyHours, monthlySalaryARS, monthlySalaryUSD]);

  // Mutations
  const createCostMutation = useMutation({
    mutationFn: (data: PersonnelHistoricalCostFormData) => 
      apiRequest("/api/personnel-historical-costs", {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personnel-historical-costs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });
      form.reset();
      setShowForm(false);
    },
    onError: (error: Error) => {
      form.setError("root", { message: error.message });
    },
  });

  const updateCostMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PersonnelHistoricalCostFormData> }) =>
      apiRequest(`/api/personnel-historical-costs/${id}`, {
        method: "PATCH",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personnel-historical-costs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });
      setEditingCost(null);
      form.reset();
      setShowForm(false);
    },
    onError: (error: Error) => {
      form.setError("root", { message: error.message });
    },
  });

  const deleteCostMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/personnel-historical-costs/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personnel-historical-costs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });
    },
    onError: (error: Error) => {
      form.setError("root", { message: error.message });
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
    form.setValue("monthlyHours", personnel.find((person) => person.id === cost.personnelId)?.monthlyHours ?? null);
    form.setValue("hourlyRateARS", cost.hourlyRateARS != null ? Number(cost.hourlyRateARS) : undefined);
    form.setValue("monthlySalaryARS", cost.monthlySalaryARS != null ? Number(cost.monthlySalaryARS) : undefined);
    form.setValue("hourlyRateUSD", cost.hourlyRateUSD != null ? Number(cost.hourlyRateUSD) : undefined);
    form.setValue("monthlySalaryUSD", cost.monthlySalaryUSD != null ? Number(cost.monthlySalaryUSD) : undefined);
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
              Fuente única de tarifas para Administración, Cotizaciones y Cierre mensual.
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
                          onValueChange={(value) => {
                            const personnelId = parseInt(value);
                            field.onChange(personnelId);
                            const person = personnel.find((candidate) => candidate.id === personnelId);
                            form.setValue("monthlyHours", person?.monthlyHours ?? null);
                          }}
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
                    name="monthlyHours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horas mensuales contractuales</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="Sin capacidad (freelance)"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(event) => field.onChange(event.target.value === "" ? null : parseFloat(event.target.value))}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Cambiar sueldo u horas recalcula automáticamente el valor hora.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="hourlyRateARS"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor hora ARS {monthlySalaryARS != null && Number(monthlyHours) > 0 ? "(calculado)" : ""}</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01"
                            readOnly={monthlySalaryARS != null && Number(monthlyHours) > 0}
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
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
                        <FormLabel>Valor hora USD {monthlySalaryUSD != null && Number(monthlyHours) > 0 ? "(calculado)" : "- Opcional"}</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01"
                            readOnly={monthlySalaryUSD != null && Number(monthlyHours) > 0}
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
                    name="monthlySalaryARS"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sueldo Mensual (ARS)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="monthlySalaryUSD"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sueldo Mensual (USD)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))} />
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

                  {form.formState.errors.root?.message && (
                    <p className="md:col-span-2 text-sm text-destructive">
                      {form.formState.errors.root.message}
                    </p>
                  )}

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
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead><tr className="border-b text-left text-muted-foreground">
                      <th className="p-2">Persona</th><th className="p-2">Período</th><th className="p-2">Sueldo ARS</th>
                      <th className="p-2">Sueldo USD</th><th className="p-2">Horas/mes</th><th className="p-2">Valor hora ARS</th><th className="p-2">Valor hora USD</th><th className="p-2" />
                    </tr></thead>
                    <tbody>
              {historicalCosts.map((cost) => (
                <tr key={cost.id} className="border-b hover:bg-muted/40">
                  <td className="p-2 font-medium">{getPersonnelName(cost.personnelId)}</td>
                  <td className="p-2 text-muted-foreground">{monthNames[cost.month - 1]} {cost.year}</td>
                  <td className="p-2">{cost.monthlySalaryARS == null ? "—" : `$${Number(cost.monthlySalaryARS).toLocaleString("es-AR")}`}</td>
                  <td className="p-2">{cost.monthlySalaryUSD == null ? "—" : `$${Number(cost.monthlySalaryUSD).toLocaleString("en-US")}`}</td>
                  <td className="p-2">{personnel.find((person) => person.id === cost.personnelId)?.monthlyHours ?? "—"}</td>
                  <td className="p-2">{cost.hourlyRateARS == null ? "—" : `${Number(cost.hourlyRateARS).toLocaleString("es-AR")} ARS/h`}</td>
                  <td className="p-2">{cost.hourlyRateUSD == null ? "—" : `${Number(cost.hourlyRateUSD).toLocaleString("en-US")} USD/h`}</td>
                  <td className="p-2"><div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(cost)}><Edit className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(cost.id)} disabled={deleteCostMutation.isPending}><Trash2 className="h-4 w-4" /></Button>
                  </div></td>
                </tr>
              ))}
                    </tbody>
                  </table>
                </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
