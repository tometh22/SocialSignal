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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { 
  CalendarIcon, 
  Loader2, 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle, 
  Clock, 
  Calendar as CalendarSquare,
  Clipboard, 
  Info,
  RotateCcw,
  UserCircle2,
  Building2
} from "lucide-react";
import { format, addMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// Interfaz para los datos del formulario
interface FormData {
  quotationId: number;
  status: string;
  startDate: Date;
  expectedEndDate?: Date;
  trackingFrequency: string;
  notes?: string;
}

// Esquema de validación del formulario
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

// Componentes personalizados para la visualización
const StepIndicator: React.FC<{ 
  currentStep: number, 
  totalSteps: number,
  onStepChange: (step: number) => void,
  stepsCompleted: number[]
}> = ({ currentStep, totalSteps, onStepChange, stepsCompleted }) => {
  return (
    <div className="mb-8">
      <div className="flex justify-between mb-2">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <div 
            key={index} 
            className={`relative flex items-center justify-center w-10 h-10 rounded-full cursor-pointer transition-all
              ${index + 1 === currentStep 
                ? 'bg-primary text-primary-foreground' 
                : stepsCompleted.includes(index + 1)
                  ? 'bg-primary/20 text-primary hover:bg-primary/30'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            onClick={() => onStepChange(index + 1)}
          >
            {stepsCompleted.includes(index + 1) && index + 1 !== currentStep ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <span className="font-medium">{index + 1}</span>
            )}
          </div>
        ))}
      </div>
      <Progress value={(currentStep / totalSteps) * 100} className="h-2" />
      <div className="flex justify-between mt-2 text-xs text-muted-foreground">
        <div className={currentStep === 1 ? "font-medium text-primary" : ""}>Cotización</div>
        <div className={currentStep === 2 ? "font-medium text-primary" : ""}>Programación</div>
        <div className={currentStep === 3 ? "font-medium text-primary" : ""}>Seguimiento</div>
      </div>
    </div>
  );
};

// Componente de información
const InfoCard: React.FC<{
  title: string;
  description: string;
  icon: React.ReactNode;
}> = ({ title, description, icon }) => (
  <div className="flex p-4 rounded-lg border bg-muted/30">
    <div className="mr-4 text-primary">{icon}</div>
    <div>
      <h4 className="font-medium mb-1">{title}</h4>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  </div>
);

// Componente principal
const NewActiveProject: React.FC = () => {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [stepsCompleted, setStepsCompleted] = useState<number[]>([]);
  const [selectedQuotation, setSelectedQuotation] = useState<any>(null);
  
  // Queries para obtener datos
  const { data: quotations, isLoading: isLoadingQuotations } = useQuery({
    queryKey: ["/api/quotations"],
  });

  const { data: statusOptions, isLoading: isLoadingStatusOptions } = useQuery({
    queryKey: ["/api/options/project-status"],
  });

  const { data: trackingOptions, isLoading: isLoadingTrackingOptions } = useQuery({
    queryKey: ["/api/options/tracking-frequency"],
  });

  // Filtrar cotizaciones aprobadas
  const approvedQuotations = React.useMemo(() => {
    return quotations?.filter((q: any) => q.status === "approved") || [];
  }, [quotations]);

  // Configurar formulario con valores predeterminados inteligentes
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: "active",
      startDate: new Date(),
      trackingFrequency: "weekly",
    },
  });

  // Establecer valores automáticos al seleccionar una cotización
  const handleQuotationSelect = (id: number) => {
    const quotation = approvedQuotations.find((q: any) => q.id === id);
    if (quotation) {
      setSelectedQuotation(quotation);
      
      // Sugerir una fecha de finalización basada en el tipo de proyecto
      const startDate = form.getValues("startDate");
      let suggestedEndDate;
      
      switch (quotation.projectType) {
        case "demo":
        case "basic":
          suggestedEndDate = addMonths(startDate, 1);
          break;
        case "standard":
          suggestedEndDate = addMonths(startDate, 2);
          break;
        case "full":
        case "strategic":
          suggestedEndDate = addMonths(startDate, 3);
          break;
        default:
          suggestedEndDate = addMonths(startDate, 2);
      }
      
      form.setValue("expectedEndDate", suggestedEndDate);
    }
  };

  // Avanzar al siguiente paso
  const goToNextStep = () => {
    const newCompleted = [...stepsCompleted];
    if (!newCompleted.includes(currentStep)) {
      newCompleted.push(currentStep);
      setStepsCompleted(newCompleted);
    }
    setCurrentStep((prev) => Math.min(prev + 1, 3));
  };

  // Volver al paso anterior
  const goToPreviousStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // Mutación para crear un nuevo proyecto
  const createProjectMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest("/api/active-projects", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/active-projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/active-projects/client"] });
      toast({
        title: "¡Proyecto creado con éxito!",
        description: "Ahora puedes comenzar a registrar horas y dar seguimiento al proyecto.",
      });
      setLocation("/active-projects");
    },
    onError: (error: any) => {
      console.error("Error creating project:", error);
      toast({
        title: "Error al crear el proyecto",
        description: error.message || "Verifica los datos e intenta nuevamente",
        variant: "destructive",
      });
    },
  });

  // Manejar el envío del formulario
  const onSubmit = (data: FormData) => {
    createProjectMutation.mutate(data);
  };

  // Estado de carga
  const isLoading = isLoadingQuotations || isLoadingStatusOptions || isLoadingTrackingOptions;
  const isSubmitting = createProjectMutation.isPending;

  // Renderizar mensaje si no hay cotizaciones aprobadas
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
        
        <Card className="mx-auto max-w-3xl">
          <CardHeader className="text-center">
            <div className="mx-auto my-3 bg-muted w-12 h-12 rounded-full flex items-center justify-center">
              <Clipboard className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl">No hay cotizaciones aprobadas</CardTitle>
            <CardDescription className="max-w-md mx-auto">
              Para crear un nuevo proyecto, primero debes tener cotizaciones con estado "Aprobado".
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center gap-4 pb-8">
            <Button variant="outline" onClick={() => setLocation("/active-projects")}>
              Volver a Proyectos
            </Button>
            <Button onClick={() => setLocation("/quotations")}>
              Gestionar Cotizaciones
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Renderizar formulario por pasos
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
          <CardDescription className="text-center">
            Configura un nuevo proyecto de seguimiento a partir de una cotización aprobada
          </CardDescription>
        </CardHeader>
        {isLoading ? (
          <div className="flex justify-center items-center h-[400px]">
            <div className="text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Cargando datos...</p>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="pb-2">
                <StepIndicator 
                  currentStep={currentStep} 
                  totalSteps={3} 
                  onStepChange={setCurrentStep}
                  stepsCompleted={stepsCompleted} 
                />

                {/* Paso 1: Selección de cotización */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <FormField
                      control={form.control}
                      name="quotationId"
                      render={({ field }) => (
                        <FormItem>
                          <div className="mb-4">
                            <FormLabel className="text-lg">Selecciona una cotización aprobada</FormLabel>
                            <FormDescription>
                              Elige una cotización que ya tenga estado "Aprobado" para convertirla en un proyecto activo.
                            </FormDescription>
                          </div>
                          
                          <div className="grid grid-cols-1 gap-4">
                            {approvedQuotations.map((q: any) => (
                              <div 
                                key={q.id}
                                className={`p-4 border rounded-lg cursor-pointer transition-all hover:border-primary
                                  ${field.value === q.id ? 'border-primary bg-primary/5' : 'border-muted'}
                                `}
                                onClick={() => {
                                  field.onChange(q.id);
                                  handleQuotationSelect(q.id);
                                }}
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <h3 className="font-medium text-lg">{q.projectName}</h3>
                                    <p className="text-sm text-muted-foreground">ID: {q.id}</p>
                                  </div>
                                  <Badge className="bg-green-600">Aprobada</Badge>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                                  <div className="flex items-center">
                                    <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                                    <span>Cliente: {q.clientId}</span>
                                  </div>
                                  <div className="flex items-center">
                                    <CalendarSquare className="h-4 w-4 mr-2 text-muted-foreground" />
                                    <span>Tipo: {q.projectType}</span>
                                  </div>
                                  <div className="flex items-center">
                                    <UserCircle2 className="h-4 w-4 mr-2 text-muted-foreground" />
                                    <span>Analista principal: {q.assignedAnalyst || "No asignado"}</span>
                                  </div>
                                  <div className="flex items-center">
                                    <Info className="h-4 w-4 mr-2 text-muted-foreground" />
                                    <span>Monto: ${q.totalAmount?.toFixed(2) || "0.00"}</span>
                                  </div>
                                </div>
                                
                                {field.value === q.id && (
                                  <div className="mt-3 text-primary text-sm flex items-center">
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Cotización seleccionada
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          {approvedQuotations.length === 0 && (
                            <div className="text-center p-8 border rounded-lg bg-muted/30">
                              <p className="text-muted-foreground">No hay cotizaciones aprobadas disponibles</p>
                            </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <InfoCard 
                      title="Sobre la selección de cotizaciones"
                      description="Solo las cotizaciones con estado 'Aprobado' pueden convertirse en proyectos activos para garantizar que el cliente ha confirmado el trabajo."
                      icon={<Info className="h-5 w-5" />}
                    />
                  </div>
                )}

                {/* Paso 2: Programación y estado */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    <div className="mb-4">
                      <h3 className="text-lg font-medium">Programación y Estado</h3>
                      <p className="text-sm text-muted-foreground">Define cuándo comienza el proyecto y su duración esperada.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estado del Proyecto</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="h-12">
                                  <SelectValue placeholder="Selecciona un estado" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {statusOptions?.map((option: any) => (
                                  <SelectItem 
                                    key={option.value} 
                                    value={option.value}
                                    className="flex items-center py-3"
                                  >
                                    <div className="flex items-center">
                                      <div className={`w-2 h-2 rounded-full mr-2 ${
                                        option.value === "active" ? "bg-green-500" :
                                        option.value === "on-hold" ? "bg-yellow-500" :
                                        option.value === "completed" ? "bg-blue-500" :
                                        "bg-red-500"
                                      }`} />
                                      {option.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Normalmente, los nuevos proyectos comienzan en estado "Activo".
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
                                <SelectTrigger className="h-12">
                                  <SelectValue placeholder="Selecciona una frecuencia" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {trackingOptions?.map((option: any) => (
                                  <SelectItem key={option.value} value={option.value} className="py-3">
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Define cada cuánto se realizará el seguimiento y reportes.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
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
                                      "w-full h-12 pl-3 text-left font-normal flex justify-between items-center"
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
                                  onSelect={(date) => {
                                    field.onChange(date);
                                    
                                    // Ajustar la fecha de finalización si existe
                                    const currentEndDate = form.getValues("expectedEndDate");
                                    if (currentEndDate && date && date > currentEndDate) {
                                      // Si la fecha de inicio es posterior a la de fin, ajustar la de fin
                                      const newEndDate = addMonths(date, 1);
                                      form.setValue("expectedEndDate", newEndDate);
                                    }
                                  }}
                                  locale={es}
                                  className="rounded-md border"
                                />
                              </PopoverContent>
                            </Popover>
                            <FormDescription>
                              Fecha en la que comienza oficialmente el proyecto.
                            </FormDescription>
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
                                      "w-full h-12 pl-3 text-left font-normal flex justify-between items-center"
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
                                  selected={field.value || undefined}
                                  onSelect={field.onChange}
                                  locale={es}
                                  fromDate={form.watch("startDate")}
                                  className="rounded-md border"
                                />
                              </PopoverContent>
                            </Popover>
                            <FormDescription>
                              Fecha estimada de finalización del proyecto (opcional).
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg mt-4">
                      <div className="flex">
                        <Clock className="text-amber-500 mr-3 h-5 w-5 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-amber-800">Duración del proyecto</h4>
                          <p className="text-sm text-amber-700">
                            {form.watch("startDate") && form.watch("expectedEndDate") ? (
                              <>
                                El proyecto está programado para durar aproximadamente{" "}
                                <strong>
                                  {Math.ceil(
                                    (form.watch("expectedEndDate")!.getTime() - form.watch("startDate").getTime()) / 
                                    (1000 * 60 * 60 * 24)
                                  )}{" "}
                                  días
                                </strong>
                              </>
                            ) : (
                              "Selecciona las fechas de inicio y fin para calcular la duración"
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Paso 3: Notas y finalización */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    <div className="mb-4">
                      <h3 className="text-lg font-medium">Notas y Detalles Adicionales</h3>
                      <p className="text-sm text-muted-foreground">Añade información relevante sobre el proyecto.</p>
                    </div>

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notas del Proyecto</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Información adicional sobre el proyecto, requerimientos especiales, contactos clave..."
                              className="min-h-[150px]"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormDescription>
                            Esta información será visible para todo el equipo que trabaje en el proyecto.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="mt-6 border rounded-lg overflow-hidden">
                      <div className="bg-muted px-4 py-3 border-b">
                        <h3 className="font-medium">Resumen del Proyecto</h3>
                      </div>
                      <div className="p-4">
                        <ScrollArea className="h-[260px] rounded-md">
                          <div className="space-y-4">
                            {selectedQuotation && (
                              <>
                                <div>
                                  <h4 className="text-sm font-medium text-muted-foreground">Nombre del Proyecto</h4>
                                  <p className="font-medium">{selectedQuotation.projectName}</p>
                                </div>
                                <Separator />
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <h4 className="text-sm font-medium text-muted-foreground">ID Cotización</h4>
                                    <p>{selectedQuotation.id}</p>
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-medium text-muted-foreground">Cliente</h4>
                                    <p>ID: {selectedQuotation.clientId}</p>
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-medium text-muted-foreground">Tipo de Proyecto</h4>
                                    <p className="capitalize">{selectedQuotation.projectType}</p>
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-medium text-muted-foreground">Monto Total</h4>
                                    <p>${selectedQuotation.totalAmount?.toFixed(2) || "0.00"}</p>
                                  </div>
                                </div>
                                <Separator />
                                <div>
                                  <h4 className="text-sm font-medium text-muted-foreground">Estado Inicial</h4>
                                  <p>{statusOptions?.find((s: any) => s.value === form.watch("status"))?.label || form.watch("status")}</p>
                                </div>
                                <div>
                                  <h4 className="text-sm font-medium text-muted-foreground">Período</h4>
                                  <p>
                                    {form.watch("startDate") && format(form.watch("startDate"), "dd MMM yyyy", { locale: es })}
                                    {form.watch("expectedEndDate") && ` - ${format(form.watch("expectedEndDate"), "dd MMM yyyy", { locale: es })}`}
                                  </p>
                                </div>
                                <div>
                                  <h4 className="text-sm font-medium text-muted-foreground">Frecuencia de Seguimiento</h4>
                                  <p>{trackingOptions?.find((t: any) => t.value === form.watch("trackingFrequency"))?.label || form.watch("trackingFrequency")}</p>
                                </div>
                                <Separator />
                                <div>
                                  <h4 className="text-sm font-medium text-muted-foreground">Notas</h4>
                                  <p className="text-sm">{form.watch("notes") || "Sin notas adicionales"}</p>
                                </div>
                              </>
                            )}
                            {!selectedQuotation && (
                              <div className="flex flex-col items-center justify-center h-[180px] text-muted-foreground">
                                <RotateCcw className="h-8 w-8 mb-2 animate-pulse" />
                                <p>Vuelve al primer paso para seleccionar una cotización</p>
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex justify-between border-t pt-6 px-6">
                {currentStep > 1 ? (
                  <Button type="button" variant="outline" onClick={goToPreviousStep}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Anterior
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={() => setLocation("/active-projects")}>
                    Cancelar
                  </Button>
                )}

                {currentStep < 3 ? (
                  <Button 
                    type="button" 
                    onClick={goToNextStep}
                    disabled={
                      (currentStep === 1 && !form.getValues("quotationId")) ||
                      (currentStep === 2 && (!form.getValues("startDate") || !form.getValues("status") || !form.getValues("trackingFrequency")))
                    }
                  >
                    Siguiente
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button 
                    type="submit" 
                    disabled={isSubmitting || !form.formState.isValid}
                    className="min-w-[120px]"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creando...
                      </>
                    ) : (
                      "Crear Proyecto"
                    )}
                  </Button>
                )}
              </CardFooter>
            </form>
          </Form>
        )}
      </Card>
    </div>
  );
};

export default NewActiveProject;