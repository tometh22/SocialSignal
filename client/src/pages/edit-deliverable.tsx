import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, ArrowLeft, Save, HelpCircle, Info, Clock } from "lucide-react";

// Esquema de validación para los datos del entregable
const deliverableSchema = z.object({
  title: z.string().min(2, "El título debe tener al menos 2 caracteres"),
  delivery_date: z.string().optional(),
  due_date: z.string().optional(),
  month: z.number().min(1).max(12).default(1),
  analysts: z.string().optional(),
  pm: z.string().optional(),
  on_time: z.boolean().default(true),
  retrabajo: z.boolean().default(false),
  // Métricas principales
  narrative_quality: z.number().min(0).max(5).default(0),
  graphics_effectiveness: z.number().min(0).max(5).default(0),
  format_design: z.number().min(0).max(5).default(0),
  relevant_insights: z.number().min(0).max(5).default(0),
  operations_feedback: z.number().min(0).max(5).default(0),
  // Feedback cliente
  client_feedback: z.number().min(0).max(5).default(0),
  client_feedback_average: z.number().min(0).max(5).default(0),
  // Cumplimiento de horas
  hours_available: z.number().min(0).default(0),
  hours_real: z.number().min(0).default(0),
  hours_compliance: z.number().min(0).max(5).default(0),
  // Cumplimiento del brief
  brief_compliance: z.number().min(0).max(5).default(0),
  brief_compliance_average: z.number().min(0).max(5).default(0),
  notes: z.string().optional(),
});

type DeliverableFormValues = z.infer<typeof deliverableSchema>;

export default function EditDeliverable() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [formattedDates, setFormattedDates] = useState({
    delivery_date: "",
    due_date: "",
  });

  // Consulta para obtener los datos del entregable
  const { data: deliverable, isLoading: isLoadingDeliverable } = useQuery({
    queryKey: ["/api/deliverables", id],
    queryFn: () => fetch(`/api/deliverables/${id}`).then((res) => res.json()),
    enabled: !!id,
  });
  
  // Consulta para obtener el personal (analistas y PMs)
  const { data: personnel, isLoading: isLoadingPersonnel } = useQuery({
    queryKey: ["/api/personnel"],
    queryFn: () => fetch("/api/personnel").then((res) => res.json()),
  });
  
  // Consulta para obtener los roles para identificar analistas y PMs
  const { data: roles, isLoading: isLoadingRoles } = useQuery({
    queryKey: ["/api/roles"],
    queryFn: () => fetch("/api/roles").then((res) => res.json()),
  });
  
  // Consulta para obtener los registros de tiempo del proyecto
  const { data: timeEntries, isLoading: isLoadingTimeEntries } = useQuery({
    queryKey: ["/api/time-entries/project", deliverable?.project_id],
    queryFn: () => fetch(`/api/time-entries/project/${deliverable?.project_id}`).then((res) => res.json()),
    enabled: !!deliverable?.project_id,
  });
  
  // Filtrar personal por rol (analistas y PMs)
  const analysts = personnel?.filter(p => {
    // Roles de analistas: Analista Junior, Analista Senior, Analista Semi Senior, Data Specialist
    const roleIds = [15, 9, 11, 10]; 
    return roleIds.includes(p.roleId);
  }) || [];
  
  const projectManagers = personnel?.filter(p => {
    // Roles de PM: Project Manager, Lead Project Manager, Operations Lead, COO, CEO
    const roleIds = [17, 12, 16, 14, 13]; 
    return roleIds.includes(p.roleId);
  }) || [];

  // Formulario
  const form = useForm<DeliverableFormValues>({
    resolver: zodResolver(deliverableSchema),
    defaultValues: {
      title: "",
      delivery_date: "",
      due_date: "",
      on_time: true,
      narrative_quality: 0,
      graphics_effectiveness: 0,
      format_design: 0,
      relevant_insights: 0,
      operations_feedback: 0,
      client_feedback: 0,
      brief_compliance: 0,
      hours_available: 0,
      hours_real: 0,
      retrabajo: false,
      notes: "",
    },
  });

  // Cuando los datos están disponibles, establecer los valores del formulario
  useEffect(() => {
    if (deliverable) {
      // Formatear fechas para el input de tipo date
      const formatDate = (dateString: string) => {
        if (!dateString) return "";
        return new Date(dateString).toISOString().split("T")[0];
      };

      const deliveryDate = formatDate(deliverable.delivery_date);
      const dueDate = formatDate(deliverable.due_date);

      setFormattedDates({
        delivery_date: deliveryDate,
        due_date: dueDate,
      });
      
      // Obtener analistas y PM desde los registros de tiempo o usar los existentes
      const analystNames = getAnalystNames();
      const analystText = analystNames.length > 0 
        ? analystNames.join(", ") 
        : (deliverable.analysts || "");
        
      const pmName = getProjectManagerName() || deliverable.pm || "";
      
      // Calcular horas actuales a partir de los registros de tiempo
      const actualHours = calculateTotalHours();
      const availableHours = deliverable.hours_available || 0;
      
      // Configurar valores del formulario
      form.reset({
        title: deliverable.title || "",
        on_time: deliverable.on_time || false,
        month: deliverable.month || deliverable.mes_entrega || 1,
        analysts: analystText,
        pm: pmName,
        // Métricas principales
        narrative_quality: deliverable.narrative_quality || 0,
        graphics_effectiveness: deliverable.graphics_effectiveness || 0,
        format_design: deliverable.format_design || 0,
        relevant_insights: deliverable.relevant_insights || 0,
        operations_feedback: deliverable.operations_feedback || 0,
        // Feedback cliente y cumplimiento
        client_feedback: deliverable.client_feedback || 0,
        client_feedback_average: deliverable.client_feedback_average || 0,
        brief_compliance: deliverable.brief_compliance || 0,
        brief_compliance_average: deliverable.brief_compliance_average || 0,
        // Horas y retrabajos
        hours_available: availableHours,
        hours_real: actualHours > 0 ? actualHours : (deliverable.hours_real || 0),
        hours_compliance: deliverable.hours_compliance || 0,
        retrabajo: deliverable.retrabajo || false,
        notes: deliverable.notes || "",
      });
    }
  }, [deliverable, form, personnel, timeEntries]);

  // Mutación para actualizar el entregable
  const updateDeliverableMutation = useMutation({
    mutationFn: async (data: DeliverableFormValues) => {
      const response = await fetch(`/api/deliverables/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          delivery_date: formattedDates.delivery_date
            ? new Date(formattedDates.delivery_date).toISOString()
            : null,
          due_date: formattedDates.due_date
            ? new Date(formattedDates.due_date).toISOString()
            : null,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Error al actualizar el entregable");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Éxito",
        description: "Entregable actualizado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/deliverables", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/modo/deliverables/project"] });
      // Redirigir a la página del proyecto
      if (deliverable?.project_id) {
        setLocation(`/project-analytics/${deliverable.project_id}`);
      } else {
        setLocation("/active-projects");
      }
    },
    onError: (error) => {
      console.error("Error al actualizar el entregable:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el entregable",
        variant: "destructive",
      });
    },
  });

  // Manejar la presentación del formulario
  const onSubmit = (data: DeliverableFormValues) => {
    updateDeliverableMutation.mutate(data);
  };

  // Calcular horas totales del proyecto basadas en los registros de tiempo
  const calculateTotalHours = () => {
    if (!timeEntries) return 0;
    return timeEntries.reduce((total, entry) => total + entry.hours, 0);
  };
  
  // Calcular lista de nombres de analistas basada en los registros de tiempo
  const getAnalystNames = () => {
    if (!timeEntries || !personnel) return [];
    
    // Obtener IDs únicos de analistas que han registrado tiempo
    const analystIds = timeEntries
      .filter(entry => {
        const person = personnel.find(p => p.id === entry.personnelId);
        return person && [1, 2, 3, 4, 5, 6, 8].includes(person.roleId);
      })
      .map(entry => entry.personnelId)
      .filter((id, index, self) => self.indexOf(id) === index);
    
    // Obtener nombres basados en los IDs
    return analystIds.map(id => {
      const person = personnel.find(p => p.id === id);
      return person ? person.name : '';
    }).filter(Boolean);
  };
  
  // Obtener nombre del PM asignado al proyecto
  const getProjectManagerName = () => {
    if (!timeEntries || !personnel) return '';
    
    // Buscar entradas de tiempo de PMs
    const pmEntries = timeEntries.filter(entry => {
      const person = personnel.find(p => p.id === entry.personnelId);
      return person && [7, 9, 10].includes(person.roleId);
    });
    
    if (pmEntries.length > 0) {
      const pmId = pmEntries[0].personnelId;
      const pm = personnel.find(p => p.id === pmId);
      return pm ? pm.name : '';
    }
    
    return '';
  };
  
  const isLoading = isLoadingDeliverable || isLoadingPersonnel || isLoadingRoles || 
                  (!!deliverable?.project_id && isLoadingTimeEntries);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="mb-6 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (deliverable?.project_id) {
              setLocation(`/project-analytics/${deliverable.project_id}`);
            } else {
              setLocation("/active-projects");
            }
          }}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <h1 className="text-2xl font-bold">Editar Entregable MODO</h1>
      </div>

      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle>Editar Indicadores y Datos</CardTitle>
          <CardDescription>
            Modifica los indicadores de robustez y datos generales del entregable
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Sección de datos básicos */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium border-b pb-2">Datos Básicos</h3>
                  
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Título del Entregable</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="month"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mes de Entrega</FormLabel>
                          <Select
                            onValueChange={(value) => field.onChange(Number(value))}
                            defaultValue={field.value ? field.value.toString() : "1"}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona el mes" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="1">Enero</SelectItem>
                              <SelectItem value="2">Febrero</SelectItem>
                              <SelectItem value="3">Marzo</SelectItem>
                              <SelectItem value="4">Abril</SelectItem>
                              <SelectItem value="5">Mayo</SelectItem>
                              <SelectItem value="6">Junio</SelectItem>
                              <SelectItem value="7">Julio</SelectItem>
                              <SelectItem value="8">Agosto</SelectItem>
                              <SelectItem value="9">Septiembre</SelectItem>
                              <SelectItem value="10">Octubre</SelectItem>
                              <SelectItem value="11">Noviembre</SelectItem>
                              <SelectItem value="12">Diciembre</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div>
                      <FormLabel>Fecha de Entrega</FormLabel>
                      <Input
                        type="date"
                        value={formattedDates.delivery_date}
                        onChange={(e) =>
                          setFormattedDates({
                            ...formattedDates,
                            delivery_date: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <FormLabel>Fecha Límite</FormLabel>
                      <Input
                        type="date"
                        value={formattedDates.due_date}
                        onChange={(e) =>
                          setFormattedDates({
                            ...formattedDates,
                            due_date: e.target.value,
                          })
                        }
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="on_time"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Entregado a Tiempo</FormLabel>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="analysts"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            Analistas
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="w-[220px] text-sm">Analistas que han registrado horas en este proyecto</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input {...field} placeholder="Nombres de analistas" />
                              {analysts.length > 0 && (
                                <div className="absolute right-2 top-2">
                                  <Badge variant="outline" className="text-xs">
                                    {analysts.length} analista(s) activo(s)
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </FormControl>
                          {analysts.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {analysts.map((analyst, idx) => (
                                <Badge 
                                  key={idx} 
                                  variant="secondary" 
                                  className="text-xs cursor-pointer"
                                  onClick={() => {
                                    const currentAnalysts = field.value ? field.value.split(", ").filter(Boolean) : [];
                                    if (!currentAnalysts.includes(analyst.name)) {
                                      const newValue = currentAnalysts.length > 0 
                                        ? `${field.value}, ${analyst.name}` 
                                        : analyst.name;
                                      field.onChange(newValue);
                                    }
                                  }}
                                >
                                  {analyst.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="pm"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            Project Manager
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="w-[220px] text-sm">PM asignado según registros de tiempo</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </FormLabel>
                          <FormControl>
                            <Select
                              value={field.value || ""}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar PM" />
                              </SelectTrigger>
                              <SelectContent>
                                {projectManagers.map((pm) => (
                                  <SelectItem key={pm.id} value={pm.name}>
                                    {pm.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="retrabajo"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Requirió Retrabajo</FormLabel>
                          <FormDescription>
                            Indica si el entregable necesitó correcciones adicionales
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Sección de horas */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium border-b pb-2">Control de Horas</h3>
                  
                  <FormField
                    control={form.control}
                    name="hours_available"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horas Disponibles</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="hours_real"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horas Reales Trabajadas</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="hours_compliance"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between mb-2">
                          <FormLabel>Cumplimiento de Horas</FormLabel>
                          <span className="text-sm font-medium">{field.value} / 5</span>
                        </div>
                        <FormControl>
                          <Slider
                            min={0}
                            max={5}
                            step={0.1}
                            value={[field.value]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                            className="py-3"
                          />
                        </FormControl>
                        <FormDescription>
                          Evaluación del cumplimiento de la estimación de horas
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notas y Comentarios</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Ingresa cualquier nota o comentario adicional"
                            className="min-h-20"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Sección de indicadores de robustez - Dos columnas */}
              <div className="pt-6">
                <h3 className="text-lg font-medium border-b pb-2 mb-6">Indicadores de Robustez</h3>
                
                <h4 className="font-medium text-base mb-4">Feedback Operaciones (20%)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <FormField
                    control={form.control}
                    name="narrative_quality"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between mb-2">
                          <FormLabel>Calidad Narrativa</FormLabel>
                          <span className="text-sm font-medium">{field.value} / 5</span>
                        </div>
                        <FormControl>
                          <Slider
                            min={0}
                            max={5}
                            step={0.1}
                            value={[field.value]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                            className="py-3"
                          />
                        </FormControl>
                        <FormDescription>
                          Califica la claridad y efectividad de la narrativa del entregable
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="graphics_effectiveness"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between mb-2">
                          <FormLabel>Efectividad de Gráficos</FormLabel>
                          <span className="text-sm font-medium">{field.value} / 5</span>
                        </div>
                        <FormControl>
                          <Slider
                            min={0}
                            max={5}
                            step={0.1}
                            value={[field.value]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                            className="py-3"
                          />
                        </FormControl>
                        <FormDescription>
                          Evalúa si los gráficos y visualizaciones son claros y efectivos
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="format_design"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between mb-2">
                          <FormLabel>Formato y Diseño</FormLabel>
                          <span className="text-sm font-medium">{field.value} / 5</span>
                        </div>
                        <FormControl>
                          <Slider
                            min={0}
                            max={5}
                            step={0.1}
                            value={[field.value]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                            className="py-3"
                          />
                        </FormControl>
                        <FormDescription>
                          Califica la calidad del diseño y el formato del documento
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="relevant_insights"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between mb-2">
                          <FormLabel>Insights Relevantes</FormLabel>
                          <span className="text-sm font-medium">{field.value} / 5</span>
                        </div>
                        <FormControl>
                          <Slider
                            min={0}
                            max={5}
                            step={0.1}
                            value={[field.value]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                            className="py-3"
                          />
                        </FormControl>
                        <FormDescription>
                          Evalúa si los insights proporcionados son relevantes para el cliente
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="operations_feedback"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between mb-2">
                          <FormLabel>Feedback de Operaciones</FormLabel>
                          <span className="text-sm font-medium">{field.value} / 5</span>
                        </div>
                        <FormControl>
                          <Slider
                            min={0}
                            max={5}
                            step={0.1}
                            value={[field.value]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                            className="py-3"
                          />
                        </FormControl>
                        <FormDescription>
                          Calificación del equipo de operaciones
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="client_feedback"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between mb-2">
                          <FormLabel>Feedback del Cliente</FormLabel>
                          <span className="text-sm font-medium">{field.value} / 5</span>
                        </div>
                        <FormControl>
                          <Slider
                            min={0}
                            max={5}
                            step={0.1}
                            value={[field.value]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                            className="py-3"
                          />
                        </FormControl>
                        <FormDescription>
                          Calificación proporcionada por el cliente
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="brief_compliance"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between mb-2">
                          <FormLabel>Cumplimiento del Brief</FormLabel>
                          <span className="text-sm font-medium">{field.value} / 5</span>
                        </div>
                        <FormControl>
                          <Slider
                            min={0}
                            max={5}
                            step={0.1}
                            value={[field.value]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                            className="py-3"
                          />
                        </FormControl>
                        <FormDescription>
                          Evalúa en qué medida el entregable cumple con los requisitos del brief
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button 
                  type="submit"
                  className="gap-2"
                  disabled={updateDeliverableMutation.isPending}
                >
                  {updateDeliverableMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  <Save className="h-4 w-4" />
                  Guardar Cambios
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}