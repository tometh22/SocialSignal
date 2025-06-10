import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Loader2, 
  Plus,
  Clock,
  Building2,
  HelpCircle
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const formSchema = z.object({
  quotationId: z.number(),
  clientId: z.number(),
  status: z.string().min(1, "El estado es requerido"),
  trackingFrequency: z.string().min(1, "La frecuencia es requerida"),
  startDate: z.date(),
  expectedEndDate: z.date().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function NewProjectWithTooltips() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: "active",
      trackingFrequency: "weekly",
      startDate: new Date(),
      notes: "",
    },
  });

  // Fetch cotizaciones y clientes
  const { data: quotationsData, isLoading: quotationsLoading } = useQuery({
    queryKey: ["/api/quotations"],
  });
  
  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ["/api/clients"],
  });

  // Procesamiento seguro de datos
  const quotations = Array.isArray(quotationsData) ? quotationsData : [];
  const clients = Array.isArray(clientsData) ? clientsData : [];
  
  // Función para obtener colores del cliente
  const getClientColors = (clientName: string) => {
    const colorMap: Record<string, { bgColor: string; textColor: string }> = {
      'MODO': { bgColor: 'bg-green-100', textColor: 'text-green-700' },
      'Diamond Films': { bgColor: 'bg-purple-100', textColor: 'text-purple-700' },
      'Pedidos Ya': { bgColor: 'bg-orange-100', textColor: 'text-orange-700' },
      'Warner Bros.': { bgColor: 'bg-blue-100', textColor: 'text-blue-700' },
      'Uber': { bgColor: 'bg-gray-100', textColor: 'text-gray-700' },
      'Coca Cola': { bgColor: 'bg-red-100', textColor: 'text-red-700' },
      'Arcos Dorados': { bgColor: 'bg-yellow-100', textColor: 'text-yellow-700' }
    };
    return colorMap[clientName] || { bgColor: 'bg-blue-100', textColor: 'text-blue-700' };
  };

  // Combinar cotizaciones con información de clientes
  const quotationsWithClients = quotations.map((q: any) => {
    const client = clients.find((c: any) => c.id === q.clientId);
    const clientName = client?.name || 'Cliente no encontrado';
    const clientColors = getClientColors(clientName);
    return {
      ...q,
      clientName,
      clientLogo: client?.logoUrl,
      clientBgColor: clientColors.bgColor,
      clientTextColor: clientColors.textColor,
      clientInitials: clientName.split(' ').map((word: string) => word[0]).join('').toUpperCase().slice(0, 2)
    };
  });
  
  const approvedQuotations = quotationsWithClients.filter((q: any) => q?.status === "approved");

  // Opciones estáticas
  const statusOptions = [
    { value: "active", label: "Activo" },
    { value: "on_hold", label: "En pausa" },
    { value: "planning", label: "En planificación" },
  ];

  const trackingOptions = [
    { value: "daily", label: "Diario" },
    { value: "weekly", label: "Semanal" },
    { value: "biweekly", label: "Quincenal" },
    { value: "monthly", label: "Mensual" },
  ];

  const createProjectMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch("/api/active-projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error("Error al crear el proyecto");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "¡Proyecto creado exitosamente!",
        description: "El proyecto ha sido agregado a tu lista de proyectos activos.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/active-projects"] });
      setLocation("/active-projects");
    },
    onError: (error: any) => {
      toast({
        title: "Error al crear proyecto",
        description: error?.message || "Hubo un error inesperado",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    console.log("Datos del formulario:", data);
    createProjectMutation.mutate(data);
  };

  if (quotationsLoading || clientsLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin" />
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
            <CardTitle>No hay cotizaciones aprobadas</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="mb-4">Para crear un proyecto necesitas al menos una cotización aprobada.</p>
            <div className="flex gap-4 justify-center">
              <Button variant="outline" onClick={() => setLocation("/active-projects")}>
                Volver a Proyectos
              </Button>
              <Button onClick={() => setLocation("/manage-quotes")}>
                Gestionar Cotizaciones
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
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
              Convierte una cotización aprobada en un proyecto activo
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
                      <div className="flex items-center gap-2">
                        <FormLabel>Cotización Aprobada</FormLabel>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Selecciona la cotización aprobada que quieres convertir en proyecto activo.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Select onValueChange={(value) => {
                        const quotationId = parseInt(value);
                        const selectedQuotation = approvedQuotations.find(q => q.id === quotationId);
                        field.onChange(quotationId);
                        if (selectedQuotation) {
                          form.setValue('clientId', selectedQuotation.clientId);
                        }
                      }} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger className="h-auto min-h-[40px]">
                            <SelectValue placeholder="Selecciona una cotización">
                              {field.value && (() => {
                                const selected = approvedQuotations.find(q => q.id === field.value);
                                return selected ? (
                                  <div className="flex items-center gap-2 py-1">
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${selected.clientBgColor} ${selected.clientTextColor}`}>
                                      {selected.clientInitials}
                                    </div>
                                    <div className="flex flex-col items-start">
                                      <span className="font-medium text-sm">{selected.clientName}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {selected.projectName}
                                      </span>
                                    </div>
                                  </div>
                                ) : null;
                              })()}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {approvedQuotations.map((q: any) => (
                            <SelectItem key={q.id} value={q.id.toString()}>
                              <div className="flex items-center gap-2 py-1">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${q.clientBgColor} ${q.clientTextColor}`}>
                                  {q.clientInitials}
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-medium text-sm">{q.clientName}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {q.projectName} - ${q.totalAmount?.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Estado */}
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-2">
                          <FormLabel>Estado inicial</FormLabel>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Define el estado inicial del proyecto (Activo, En pausa, etc.)</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
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

                  {/* Frecuencia */}
                  <FormField
                    control={form.control}
                    name="trackingFrequency"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-2">
                          <FormLabel>Frecuencia de seguimiento</FormLabel>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Con qué frecuencia quieres recibir informes de progreso y hacer seguimiento del proyecto</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
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
                        <div className="flex items-center gap-2">
                          <FormLabel>Fecha de inicio</FormLabel>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Cuándo comenzará oficialmente el proyecto</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={`w-full pl-3 text-left font-normal ${!field.value && "text-muted-foreground"}`}
                              >
                                {field.value ? (
                                  format(field.value, "PPP", { locale: es })
                                ) : (
                                  <span>Selecciona una fecha</span>
                                )}
                                <Clock className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date < new Date(new Date().setHours(0, 0, 0, 0))
                              }
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
                        <div className="flex items-center gap-2">
                          <FormLabel>Fecha esperada de finalización (opcional)</FormLabel>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Fecha estimada de finalización del proyecto (opcional)</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={`w-full pl-3 text-left font-normal ${!field.value && "text-muted-foreground"}`}
                              >
                                {field.value ? (
                                  format(field.value, "PPP", { locale: es })
                                ) : (
                                  <span>Selecciona una fecha</span>
                                )}
                                <Clock className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date < new Date(new Date().setHours(0, 0, 0, 0))
                              }
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
                      <div className="flex items-center gap-2">
                        <FormLabel>Notas (opcional)</FormLabel>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Notas adicionales o comentarios sobre el proyecto</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <FormControl>
                        <Textarea
                          placeholder="Agregar notas adicionales..."
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Automatización disponible */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-blue-900 mb-2">
                        Automatización disponible
                      </h3>
                      <p className="text-sm text-blue-700">
                        Después de crear el proyecto podrás configurar tareas recurrentes, 
                        entregas automáticas y plantillas personalizadas.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-6 border-t">
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
                        Creando...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Crear Proyecto
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </form>
          </Form>
        </Card>
      </div>
    </TooltipProvider>
  );
}