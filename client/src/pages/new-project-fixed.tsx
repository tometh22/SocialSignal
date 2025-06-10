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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Loader2, 
  Plus,
  Clock,
  Building2
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
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

export default function NewProjectFixed() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Queries para cotizaciones y clientes
  const { data: quotationsData, isLoading: quotationsLoading, error: quotationsError } = useQuery({
    queryKey: ["/api/quotations"],
    enabled: true,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ["/api/clients"],
    enabled: true,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  // Procesamiento seguro de datos
  const quotations = Array.isArray(quotationsData) ? quotationsData : [];
  const clients = Array.isArray(clientsData) ? clientsData : [];
  
  // Función para obtener logo y colores del cliente
  const getClientInfo = (clientName: string) => {
    const clientMap: Record<string, { logo?: string; bgColor: string; textColor: string }> = {
      'MODO': { 
        logo: '/uploads/logo-aad7da83-1d41-4c52-a130-dad57dea76db.png',
        bgColor: 'bg-green-100', 
        textColor: 'text-green-700' 
      },
      'Diamond Films': { 
        bgColor: 'bg-purple-100', 
        textColor: 'text-purple-700' 
      },
      'Pedidos Ya': { 
        bgColor: 'bg-orange-100', 
        textColor: 'text-orange-700' 
      },
      'Warner Bros.': { 
        bgColor: 'bg-blue-100', 
        textColor: 'text-blue-700' 
      },
      'Uber': { 
        bgColor: 'bg-gray-100', 
        textColor: 'text-gray-700' 
      },
      'Coca Cola': { 
        bgColor: 'bg-red-100', 
        textColor: 'text-red-700' 
      },
      'Arcos Dorados': { 
        bgColor: 'bg-yellow-100', 
        textColor: 'text-yellow-700' 
      }
    };
    return clientMap[clientName] || { bgColor: 'bg-blue-100', textColor: 'text-blue-700' };
  };

  // Combinar cotizaciones con información de clientes
  const quotationsWithClients = quotations.map((q: any) => {
    const client = clients.find((c: any) => c.id === q.clientId);
    const clientName = client?.name || 'Cliente no encontrado';
    const clientInfo = getClientInfo(clientName);
    return {
      ...q,
      clientName,
      clientLogo: clientInfo.logo,
      clientBgColor: clientInfo.bgColor,
      clientTextColor: clientInfo.textColor,
      clientInitials: clientName.split(' ').map((word: string) => word[0]).join('').toUpperCase().slice(0, 2)
    };
  });
  
  const approvedQuotations = quotationsWithClients.filter((q: any) => q?.status === "approved");

  // Opciones estáticas
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
        title: "Proyecto creado exitosamente",
        description: "El proyecto se ha creado correctamente",
      });
      setLocation("/active-projects");
    },
    onError: (error: any) => {
      toast({
        title: "Error al crear proyecto",
        description: error.message || "Intenta nuevamente",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createProjectMutation.mutate(data);
  };

  if (quotationsError) {
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
            <CardTitle className="text-red-600">Error al cargar datos</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="mb-4">Error: {quotationsError.message}</p>
            <Button onClick={() => window.location.reload()}>Reintentar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (quotationsLoading || clientsLoading) {
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
                    <FormLabel>Cotización Aprobada</FormLabel>
                    <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una cotización" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {approvedQuotations.map((q: any) => (
                          <SelectItem key={q.id} value={q.id.toString()}>
                            <div className="flex items-center gap-3 py-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage 
                                  src={q.clientLogo} 
                                  alt={q.clientName}
                                />
                                <AvatarFallback className={`${q.clientBgColor} ${q.clientTextColor} text-xs font-medium`}>
                                  {q.clientInitials}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <div className="font-medium text-sm">{q.clientName}</div>
                                <div className="text-xs text-muted-foreground">
                                  {q.projectName} - ${q.totalAmount?.toFixed(2)}
                                </div>
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

                {/* Frecuencia */}
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
                                <span>Selecciona fecha</span>
                              )}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
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

                {/* Fecha de finalización esperada */}
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
                                <span>Selecciona fecha</span>
                              )}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
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
                        placeholder="Agregar notas adicionales..."
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
                  <div>
                    <h3 className="font-semibold text-blue-900 mb-2">Automatización disponible</h3>
                    <p className="text-sm text-blue-700">
                      Después de crear el proyecto podrás configurar tareas recurrentes, 
                      entregas automáticas y plantillas personalizadas.
                    </p>
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
          </form>
        </Form>
      </Card>
    </div>
  );
}