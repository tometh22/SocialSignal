import React, { useState } from "react";
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
  Clock
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const formSchema = z.object({
  quotationId: z.number({
    required_error: "Selecciona una cotización",
  }),
  status: z.string({
    required_error: "Selecciona un estado",
  }),
  startDate: z.date({
    required_error: "Selecciona una fecha de inicio",
  }),
  expectedEndDate: z.date().optional(),
  trackingFrequency: z.string({
    required_error: "Selecciona una frecuencia de seguimiento",
  }),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function NewActiveProjectSimple() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Datos hardcodeados para evitar problemas de carga
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

  // Query solo para cotizaciones
  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ["/api/quotations"],
    queryFn: async () => {
      const response = await fetch("/api/quotations");
      if (!response.ok) throw new Error("Error al cargar cotizaciones");
      return response.json();
    },
    retry: 1,
  });

  // Filtrar cotizaciones aprobadas
  const approvedQuotations = quotations.filter((q: any) => q.status === "approved");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: "active",
      startDate: new Date(),
      trackingFrequency: "weekly",
    },
  });

  // Mutación para crear proyecto
  const createProjectMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest("/api/active-projects", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/active-projects"] });
      toast({
        title: "¡Proyecto creado con éxito!",
        description: "Ahora puedes comenzar a registrar horas y dar seguimiento al proyecto.",
      });
      setLocation("/active-projects");
    },
    onError: (error: any) => {
      toast({
        title: "Error al crear el proyecto",
        description: error.message || "Verifica los datos e intenta nuevamente",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    const formattedData = {
      ...data,
      startDate: data.startDate.toISOString(),
      expectedEndDate: data.expectedEndDate ? data.expectedEndDate.toISOString() : undefined,
    };
    createProjectMutation.mutate(formattedData as any);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
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
                    <FormLabel>Cotización</FormLabel>
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

              {/* Fecha de inicio */}
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fecha de inicio</FormLabel>
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

              {/* Notas */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas (opcional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Agregar notas adicionales..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Botón de automatización */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-blue-900">¿Quieres automatizar este proyecto?</h3>
                    <p className="text-sm text-blue-700 mt-1">
                      Configura tareas recurrentes y entregas automáticas después de crear el proyecto.
                    </p>
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    className="border-blue-300 text-blue-700 hover:bg-blue-100"
                    disabled
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Configurar después
                  </Button>
                </div>
              </div>
            </CardContent>

            <div className="flex justify-between p-6 border-t">
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
                className="min-w-[120px]"
              >
                {createProjectMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  "Crear Proyecto"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </Card>
    </div>
  );
}