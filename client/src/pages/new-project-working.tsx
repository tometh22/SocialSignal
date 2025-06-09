import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { queryClient, apiRequest } from "../lib/queryClient";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Loader2, 
  Plus,
  Calendar,
  Clock,
  CheckCircle
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const formSchema = z.object({
  quotationId: z.number({
    required_error: "Selecciona una cotización",
  }),
  status: z.string().default("active"),
  startDate: z.date({
    required_error: "Selecciona una fecha de inicio",
  }),
  expectedEndDate: z.date().optional(),
  trackingFrequency: z.string().default("weekly"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function NewProjectWorking() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  // Query simple para cotizaciones
  const { data: quotations = [], isLoading: quotationsLoading } = useQuery({
    queryKey: ["/api/quotations"],
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });

  // Estados y opciones hardcodeados para evitar queries adicionales
  const statusOptions = [
    { value: "active", label: "Activo" },
    { value: "completed", label: "Completado" },
    { value: "cancelled", label: "Cancelado" },
    { value: "on-hold", label: "En Pausa" }
  ];

  const trackingOptions = [
    { value: "daily", label: "Diario" },
    { value: "weekly", label: "Semanal" },
    { value: "biweekly", label: "Quincenal" },
    { value: "monthly", label: "Mensual" }
  ];

  // Filtrar cotizaciones aprobadas
  const approvedQuotations = (quotations as any[]).filter((q: any) => q.status === "approved");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: "active",
      startDate: new Date(),
      trackingFrequency: "weekly",
    },
  });

  // Mutación simple para crear proyecto
  const createProjectMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        ...data,
        startDate: data.startDate.toISOString(),
        expectedEndDate: data.expectedEndDate ? data.expectedEndDate.toISOString() : undefined,
      };
      return apiRequest("/api/active-projects", "POST", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/active-projects"] });
      toast({
        title: "¡Proyecto creado!",
        description: "El proyecto se ha creado correctamente.",
      });
      setLocation("/active-projects");
    },
    onError: (error: any) => {
      console.error("Error creating project:", error);
      toast({
        title: "Error al crear el proyecto",
        description: error.message || "Intenta nuevamente",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createProjectMutation.mutate(data);
  };

  // Estados de carga
  if (quotationsLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Cargando cotizaciones...</p>
          </div>
        </div>
      </div>
    );
  }

  if (approvedQuotations.length === 0) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center mb-6">
          <Button variant="ghost" onClick={() => setLocation("/active-projects")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          <h1 className="text-3xl font-bold ml-4">Nuevo Proyecto</h1>
        </div>
        
        <Card className="mx-auto max-w-3xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">No hay cotizaciones aprobadas</CardTitle>
            <p className="text-muted-foreground">
              Para crear un nuevo proyecto, primero debes tener cotizaciones con estado "Aprobado".
            </p>
          </CardHeader>
          <CardContent className="flex justify-center gap-4">
            <Button variant="outline" onClick={() => setLocation("/active-projects")}>
              Volver a Proyectos
            </Button>
            <Button onClick={() => setLocation("/manage-quotes")}>
              Gestionar Cotizaciones
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center mb-6">
        <Button variant="ghost" onClick={() => setLocation("/active-projects")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold ml-4">Nuevo Proyecto</h1>
      </div>

      <Card className="mx-auto max-w-4xl">
        <CardHeader>
          <CardTitle className="text-center text-2xl">Crear Proyecto Activo</CardTitle>
          <p className="text-center text-muted-foreground">
            Configura un nuevo proyecto de seguimiento a partir de una cotización aprobada
          </p>
        </CardHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              {/* Selección de cotización */}
              <FormField
                control={form.control}
                name="quotationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cotización *</FormLabel>
                    <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una cotización aprobada" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {approvedQuotations.map((q: any) => (
                          <SelectItem key={q.id} value={q.id.toString()}>
                            {q.projectName} - ${q.totalAmount?.toFixed(2)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Estado del proyecto */}
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado inicial</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {statusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Frecuencia de seguimiento */}
                <FormField
                  control={form.control}
                  name="trackingFrequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frecuencia de seguimiento</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {trackingOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Fecha de inicio */}
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fecha de inicio *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className="pl-3 text-left font-normal"
                            >
                              {field.value ? (
                                format(field.value, "PPP", { locale: es })
                              ) : (
                                <span>Selecciona una fecha</span>
                              )}
                              <Calendar className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date("1900-01-01")}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Fecha esperada de finalización */}
                <FormField
                  control={form.control}
                  name="expectedEndDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fecha esperada de finalización (opcional)</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className="pl-3 text-left font-normal"
                            >
                              {field.value ? (
                                format(field.value, "PPP", { locale: es })
                              ) : (
                                <span>Selecciona una fecha</span>
                              )}
                              <Calendar className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date("1900-01-01")}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Notas */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas (opcional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Agregar notas adicionales sobre el proyecto..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Sección de automatización */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-100 rounded-full p-2">
                    <Clock className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-900 mb-2">
                      ¿Quieres automatizar este proyecto?
                    </h3>
                    <p className="text-sm text-blue-700 mb-4">
                      Después de crear el proyecto, podrás configurar tareas recurrentes, 
                      entregas automáticas y plantillas para automatizar el flujo de trabajo.
                    </p>
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <CheckCircle className="h-4 w-4" />
                      <span>Configurable después de la creación del proyecto</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>

            <div className="flex justify-between p-6 border-t bg-gray-50/50">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setLocation("/active-projects")}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createProjectMutation.isPending}
                className="min-w-[140px]"
              >
                {createProjectMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando proyecto...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Crear Proyecto
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </Card>
    </div>
  );
}