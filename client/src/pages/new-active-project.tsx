import React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { queryClient, apiRequest } from "../lib/queryClient";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { CalendarIcon, Loader2, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Interfaz para los datos del formulario
interface FormData {
  quotationId: number;
  status: string;
  startDate: Date;
  expectedEndDate?: Date;
  trackingFrequency: string;
  notes?: string;
}

const formSchema = z.object({
  quotationId: z.number(),
  status: z.string(),
  startDate: z.date(),
  expectedEndDate: z.date().optional(),
  trackingFrequency: z.string(),
  notes: z.string().optional(),
});

const NewActiveProject: React.FC = () => {
  const [, setLocation] = useLocation();

  // Obtener cotizaciones aprobadas
  const { data: quotations, isLoading: isLoadingQuotations } = useQuery({
    queryKey: ["/api/quotations"],
  });

  // Obtener opciones de estado de proyecto
  const { data: statusOptions, isLoading: isLoadingStatusOptions } = useQuery({
    queryKey: ["/api/options/project-status"],
  });

  // Obtener opciones de frecuencia de seguimiento
  const { data: trackingOptions, isLoading: isLoadingTrackingOptions } = useQuery({
    queryKey: ["/api/options/tracking-frequency"],
  });

  // Filtrar cotizaciones aprobadas
  const approvedQuotations = React.useMemo(() => {
    return quotations?.filter((q: any) => q.status === "approved") || [];
  }, [quotations]);

  // Configurar el formulario
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: "active",
      startDate: new Date(),
      trackingFrequency: "weekly",
    },
  });

  // Mutación para crear un nuevo proyecto
  const createProjectMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest("/api/active-projects", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/active-projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/active-projects/client"] });
      toast({
        title: "Proyecto creado",
        description: "El proyecto ha sido creado con éxito",
      });
      setLocation("/active-projects");
    },
    onError: (error: any) => {
      console.error("Error creating project:", error);
      toast({
        title: "Error",
        description: error.message || "Ha ocurrido un error al crear el proyecto",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createProjectMutation.mutate(data);
  };

  const isLoading = isLoadingQuotations || isLoadingStatusOptions || isLoadingTrackingOptions;
  const isSubmitting = createProjectMutation.isPending;

  // Mostrar mensaje si no hay cotizaciones aprobadas
  if (!isLoading && approvedQuotations.length === 0) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center mb-6">
          <Button variant="ghost" onClick={() => setLocation("/active-projects")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          <h1 className="text-3xl font-bold ml-4">Nuevo Proyecto</h1>
        </div>
        
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <CardTitle>No hay cotizaciones aprobadas</CardTitle>
            <CardDescription>
              Para crear un nuevo proyecto, primero debes tener cotizaciones aprobadas.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setLocation("/active-projects")}>
              Cancelar
            </Button>
            <Button onClick={() => setLocation("/quotations")}>
              Ver Cotizaciones
            </Button>
          </CardFooter>
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

      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Crear Proyecto Activo</CardTitle>
          <CardDescription>
            Crea un nuevo proyecto a partir de una cotización aprobada.
          </CardDescription>
        </CardHeader>
        {isLoading ? (
          <div className="flex justify-center items-center h-[300px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="quotationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cotización</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        defaultValue={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona una cotización" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {approvedQuotations.map((q: any) => (
                            <SelectItem key={q.id} value={q.id.toString()}>
                              {q.projectName} ({q.id})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Solo se muestran cotizaciones con estado "Aprobado".
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un estado" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {statusOptions?.map((option: any) => (
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

                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fecha de Inicio</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={
                                "w-full pl-3 text-left font-normal flex justify-between items-center"
                              }
                            >
                              {field.value ? (
                                format(field.value, "dd MMM yyyy", { locale: es })
                              ) : (
                                <span>Seleccionar fecha</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            locale={es}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expectedEndDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fecha de Finalización Esperada</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={
                                "w-full pl-3 text-left font-normal flex justify-between items-center"
                              }
                            >
                              {field.value ? (
                                format(field.value, "dd MMM yyyy", { locale: es })
                              ) : (
                                <span>Seleccionar fecha</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            locale={es}
                            fromDate={form.watch("startDate")}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        Opcional. Si no se especifica, el proyecto se considerará sin fecha de finalización definida.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="trackingFrequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frecuencia de Seguimiento</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona una frecuencia" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {trackingOptions?.map((option: any) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Define la frecuencia con la que se realizará el seguimiento del proyecto.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Información adicional sobre el proyecto..."
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Opcional. Añade cualquier nota relevante sobre el proyecto.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation("/active-projects")}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Crear Proyecto
                </Button>
              </CardFooter>
            </form>
          </Form>
        )}
      </Card>
    </div>
  );
};

export default NewActiveProject;