import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Settings,
  Users,
  Clock,
  DollarSign,
  Calendar,
  FileText,
  Save,
  Plus,
  Trash2,
  Edit,
  Calculator,
  Timer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Schema para el registro de tiempo
const timeEntrySchema = z.object({
  registrationType: z.enum(["hours", "cost"]),
  period: z.enum(["current_month", "last_month", "custom"]),
  customStartDate: z.string().optional(),
  customEndDate: z.string().optional(),
  hours: z.number().min(0).optional(),
  totalCost: z.number().min(0).optional(),
  hourlyRate: z.number().min(0),
  description: z.string().min(1, "La descripción es requerida"),
  personnelId: z.number().min(1, "Selecciona un miembro del equipo")
});

export default function ProjectSettings() {
  const { id: projectId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("general");
  const [calculatedValue, setCalculatedValue] = useState<number>(0);

  // Formulario para registro de tiempo
  const timeEntryForm = useForm<z.infer<typeof timeEntrySchema>>({
    resolver: zodResolver(timeEntrySchema),
    defaultValues: {
      registrationType: "hours",
      period: "current_month",
      hourlyRate: 0,
      description: "",
      personnelId: 0
    }
  });

  // Datos del proyecto
  const { data: project, isLoading } = useQuery({
    queryKey: [`/api/active-projects/${projectId}`],
    enabled: !!projectId,
  });

  const { data: client } = useQuery({
    queryKey: [`/api/clients/${(project as any)?.clientId}`],
    enabled: !!(project as any)?.clientId,
  });

  const { data: baseTeam = [] } = useQuery({
    queryKey: [`/api/projects/${projectId}/base-team`],
    enabled: !!projectId,
  });

  // Copiar equipo de cotización
  const copyTeamMutation = useMutation({
    mutationFn: () => apiRequest(`/api/projects/${projectId}/copy-quotation-team`, "POST"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/base-team`] });
      toast({
        title: "Equipo copiado",
        description: "El equipo de la cotización se ha configurado para el proyecto"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo copiar el equipo de la cotización",
        variant: "destructive"
      });
    }
  });

  // Crear entrada de tiempo
  const createTimeEntryMutation = useMutation({
    mutationFn: (data: z.infer<typeof timeEntrySchema>) => {
      const { registrationType, period, customStartDate, customEndDate, ...entryData } = data;
      
      // Calcular fechas según el período
      let startDate: string, endDate: string;
      const now = new Date();
      
      if (period === "current_month") {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      } else if (period === "last_month") {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      } else {
        startDate = customStartDate!;
        endDate = customEndDate!;
      }

      // Calcular horas o costo según el tipo de registro
      const finalHours = registrationType === "hours" ? data.hours : (data.totalCost! / data.hourlyRate);
      const finalCost = registrationType === "cost" ? data.totalCost : (data.hours! * data.hourlyRate);

      return apiRequest(`/api/time-entries`, "POST", {
        projectId: Number(projectId),
        personnelId: data.personnelId,
        date: startDate,
        hours: finalHours,
        totalCost: finalCost,
        hourlyRateAtTime: data.hourlyRate,
        entryType: registrationType,
        description: data.description,
        isDateRange: true,
        startDate,
        endDate,
        periodDescription: period === "current_month" ? "Mes actual" : 
                          period === "last_month" ? "Mes pasado" : 
                          "Período personalizado"
      });
    },
    onSuccess: () => {
      toast({
        title: "Tiempo registrado",
        description: "El registro de tiempo se ha creado exitosamente"
      });
      queryClient.invalidateQueries({ queryKey: [`/api/time-entries/project/${projectId}`] });
      timeEntryForm.reset();
      setCalculatedValue(0);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo registrar el tiempo",
        variant: "destructive"
      });
    }
  });

  // Funciones de cálculo en tiempo real
  const calculateValue = () => {
    const values = timeEntryForm.getValues();
    const { registrationType, hours, totalCost, hourlyRate } = values;

    if (!hourlyRate || hourlyRate <= 0) {
      setCalculatedValue(0);
      return;
    }

    if (registrationType === "hours" && hours) {
      setCalculatedValue(hours * hourlyRate);
    } else if (registrationType === "cost" && totalCost) {
      setCalculatedValue(totalCost / hourlyRate);
    } else {
      setCalculatedValue(0);
    }
  };

  // Obtener fechas para períodos
  const getPeriodDates = (period: string) => {
    const now = new Date();
    if (period === "current_month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return `${start.toLocaleDateString('es-ES')} - ${end.toLocaleDateString('es-ES')}`;
    } else if (period === "last_month") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return `${start.toLocaleDateString('es-ES')} - ${end.toLocaleDateString('es-ES')}`;
    }
    return "Seleccionar fechas";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Cargando configuración del proyecto...</div>
      </div>
    );
  }

  const projectData = project as any;
  const clientData = client as any;
  const projectName = projectData?.quotation?.projectName || "Proyecto sin nombre";
  const clientName = clientData?.name || "Cliente desconocido";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-white via-blue-50 to-purple-50 border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation(`/project-details/${projectId}`)}
                className="hover:bg-gray-100 h-8"
              >
                <ArrowLeft className="h-3 w-3 mr-1" />
                Volver al Proyecto
              </Button>
              
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Configuración del Proyecto
                </h1>
                <p className="text-gray-600 mt-1">{projectName}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                General
              </TabsTrigger>
              <TabsTrigger value="team" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Equipo Base
              </TabsTrigger>
              <TabsTrigger value="time" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Tiempo
              </TabsTrigger>
              <TabsTrigger value="billing" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Facturación
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Información General
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="projectName">Nombre del Proyecto</Label>
                      <Input
                        id="projectName"
                        defaultValue={projectName}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="clientName">Cliente</Label>
                      <Input
                        id="clientName"
                        value={clientName}
                        disabled
                        className="mt-1"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="startDate">Fecha de Inicio</Label>
                      <Input
                        id="startDate"
                        type="date"
                        defaultValue={projectData?.startDate ? new Date(projectData.startDate).toISOString().split('T')[0] : ''}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="endDate">Fecha Estimada de Fin</Label>
                      <Input
                        id="endDate"
                        type="date"
                        defaultValue={projectData?.expectedEndDate ? new Date(projectData.expectedEndDate).toISOString().split('T')[0] : ''}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description">Descripción</Label>
                    <Textarea
                      id="description"
                      placeholder="Descripción del proyecto..."
                      defaultValue={projectData?.notes || ''}
                      className="mt-1"
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button>
                      <Save className="h-4 w-4 mr-2" />
                      Guardar Cambios
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="team" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Equipo Base del Proyecto
                    </CardTitle>
                    {(!Array.isArray(baseTeam) || baseTeam.length === 0) && (
                      <Button
                        onClick={() => copyTeamMutation.mutate()}
                        disabled={copyTeamMutation.isPending}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {copyTeamMutation.isPending ? "Copiando..." : "Copiar desde Cotización"}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {Array.isArray(baseTeam) && baseTeam.length > 0 ? (
                    <div className="space-y-3">
                      {baseTeam.map((member: any) => (
                        <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="font-medium">{member.personnel?.name}</p>
                              <p className="text-sm text-gray-500">{member.role?.name}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">${member.hourlyRate}/hora</Badge>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No hay equipo base configurado</p>
                      <p className="text-sm">Copia el equipo desde la cotización para comenzar</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="time" className="space-y-4">
              {/* Registro de Tiempo */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Timer className="h-5 w-5" />
                    Registrar Tiempo por Período
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...timeEntryForm}>
                    <form onSubmit={timeEntryForm.handleSubmit((data) => createTimeEntryMutation.mutate(data))} className="space-y-6">
                      
                      {/* Selección de miembro del equipo */}
                      <FormField
                        control={timeEntryForm.control}
                        name="personnelId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Miembro del Equipo</FormLabel>
                            <Select onValueChange={(value) => field.onChange(Number(value))}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona un miembro del equipo" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {Array.isArray(baseTeam) && baseTeam.map((member: any) => (
                                  <SelectItem key={member.personnelId} value={member.personnelId.toString()}>
                                    {member.personnel?.name} - {member.role?.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Tarifa por hora */}
                      <FormField
                        control={timeEntryForm.control}
                        name="hourlyRate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tarifa por Hora ($)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Ej: 75.00"
                                {...field}
                                onChange={(e) => {
                                  field.onChange(Number(e.target.value));
                                  setTimeout(calculateValue, 100);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Tipo de registro */}
                      <FormField
                        control={timeEntryForm.control}
                        name="registrationType"
                        render={({ field }) => (
                          <FormItem className="space-y-3">
                            <FormLabel>Tipo de Registro</FormLabel>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="flex flex-col space-y-2"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="hours" id="hours" />
                                  <Label htmlFor="hours" className="flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    Por cantidad de horas (calcula costo automáticamente)
                                  </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="cost" id="cost" />
                                  <Label htmlFor="cost" className="flex items-center gap-2">
                                    <Calculator className="h-4 w-4" />
                                    Por costo total (calcula horas automáticamente)
                                  </Label>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Input condicional según tipo de registro */}
                      <div className="grid grid-cols-2 gap-4">
                        {timeEntryForm.watch("registrationType") === "hours" ? (
                          <FormField
                            control={timeEntryForm.control}
                            name="hours"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Cantidad de Horas</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.5"
                                    placeholder="Ej: 40"
                                    {...field}
                                    onChange={(e) => {
                                      field.onChange(Number(e.target.value));
                                      setTimeout(calculateValue, 100);
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ) : (
                          <FormField
                            control={timeEntryForm.control}
                            name="totalCost"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Costo Total ($)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="Ej: 3000.00"
                                    {...field}
                                    onChange={(e) => {
                                      field.onChange(Number(e.target.value));
                                      setTimeout(calculateValue, 100);
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        <div className="flex items-end">
                          <div className="w-full p-3 bg-gray-50 rounded-md border">
                            <Label className="text-sm text-gray-600">
                              {timeEntryForm.watch("registrationType") === "hours" ? "Costo Calculado" : "Horas Calculadas"}
                            </Label>
                            <p className="text-lg font-semibold">
                              {timeEntryForm.watch("registrationType") === "hours" 
                                ? `$${calculatedValue.toFixed(2)}`
                                : `${calculatedValue.toFixed(1)}h`
                              }
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Selección de período */}
                      <FormField
                        control={timeEntryForm.control}
                        name="period"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Período</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona un período" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="current_month">
                                  Este mes ({getPeriodDates("current_month")})
                                </SelectItem>
                                <SelectItem value="last_month">
                                  Mes pasado ({getPeriodDates("last_month")})
                                </SelectItem>
                                <SelectItem value="custom">
                                  Período personalizado
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Fechas personalizadas */}
                      {timeEntryForm.watch("period") === "custom" && (
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={timeEntryForm.control}
                            name="customStartDate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Fecha de Inicio</FormLabel>
                                <FormControl>
                                  <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={timeEntryForm.control}
                            name="customEndDate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Fecha de Fin</FormLabel>
                                <FormControl>
                                  <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}

                      {/* Descripción */}
                      <FormField
                        control={timeEntryForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Descripción del Trabajo</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Describe el trabajo realizado en este período..."
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end">
                        <Button 
                          type="submit"
                          disabled={createTimeEntryMutation.isPending}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          {createTimeEntryMutation.isPending ? "Registrando..." : "Registrar Tiempo"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              {/* Configuración general de tiempo */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Configuración de Tiempo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="estimatedHours">Horas Estimadas</Label>
                      <Input
                        id="estimatedHours"
                        type="number"
                        step="0.5"
                        defaultValue={projectData?.estimatedHours || ''}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="hourlyRate">Tarifa por Hora (Promedio)</Label>
                      <Input
                        id="hourlyRate"
                        type="number"
                        step="0.01"
                        defaultValue={projectData?.avgHourlyRate || ''}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-medium mb-3">Configuraciones de Registro</h4>
                    <div className="space-y-2">
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" defaultChecked />
                        <span className="text-sm">Permitir registro de tiempo retroactivo</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" defaultChecked />
                        <span className="text-sm">Requerir descripción en registros de tiempo</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" />
                        <span className="text-sm">Limitar registro a horas de trabajo</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button>
                      <Save className="h-4 w-4 mr-2" />
                      Guardar Configuración
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="billing" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Configuración de Facturación
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="totalBudget">Presupuesto Total</Label>
                      <Input
                        id="totalBudget"
                        type="number"
                        step="0.01"
                        defaultValue={projectData?.quotation?.totalAmount || ''}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="currency">Moneda</Label>
                      <Input
                        id="currency"
                        defaultValue="USD"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-medium mb-3">Alertas de Presupuesto</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="warningThreshold">Alerta al (% del presupuesto)</Label>
                        <Input
                          id="warningThreshold"
                          type="number"
                          min="0"
                          max="100"
                          defaultValue="80"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="criticalThreshold">Crítico al (% del presupuesto)</Label>
                        <Input
                          id="criticalThreshold"
                          type="number"
                          min="0"
                          max="100"
                          defaultValue="95"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button>
                      <Save className="h-4 w-4 mr-2" />
                      Guardar Configuración
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}