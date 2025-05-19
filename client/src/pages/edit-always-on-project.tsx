import React, { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon, Clock, DollarSign, Users, Building2, CheckCircle2, ArrowLeft } from "lucide-react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

// Esquema para validar el formulario de edición
const editAlwaysOnProjectSchema = z.object({
  projectName: z.string().min(1, "El nombre del proyecto es requerido"),
  macroMonthlyBudget: z.coerce.number().min(1, "El presupuesto mensual debe ser mayor a 0"),
  trackingFrequency: z.string(),
  status: z.string(),
  startDate: z.date(),
  expectedEndDate: z.date().optional(),
  notes: z.string().optional(),
  clientId: z.coerce.number(),
  teamMembers: z.array(z.object({
    personnelId: z.number(),
    roleId: z.number(),
    hourlyRate: z.number().optional(),
    allocatedHours: z.number().optional()
  })).optional()
});

type EditAlwaysOnProjectFormValues = z.infer<typeof editAlwaysOnProjectSchema>;

export default function EditAlwaysOnProject() {
  const [, setLocation] = useLocation();
  const { projectId } = useParams();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("general");

  // Obtener los datos del proyecto
  const { data: project, isLoading, isError } = useQuery({
    queryKey: [`/api/active-projects/${projectId}`],
    enabled: !!projectId,
  });

  // Obtener clientes para el selector
  const { data: clients = [] } = useQuery({
    queryKey: ['/api/clients'],
  });

  // Obtener personal para asignar al equipo
  const { data: personnel = [] } = useQuery({
    queryKey: ['/api/personnel'],
  });

  // Obtener roles para asignar al equipo
  const { data: roles = [] } = useQuery({
    queryKey: ['/api/roles'],
  });

  // Formulario
  const form = useForm<EditAlwaysOnProjectFormValues>({
    resolver: zodResolver(editAlwaysOnProjectSchema),
    defaultValues: {
      projectName: "",
      macroMonthlyBudget: 0,
      trackingFrequency: "monthly",
      status: "active",
      notes: "",
      clientId: 0,
      teamMembers: []
    }
  });

  // Actualizar el formulario cuando se carguen los datos del proyecto
  useEffect(() => {
    if (project && project.quotation) {
      form.reset({
        projectName: project.quotation.projectName,
        macroMonthlyBudget: project.macroMonthlyBudget || 0,
        trackingFrequency: project.trackingFrequency,
        status: project.status,
        startDate: new Date(project.startDate),
        expectedEndDate: project.expectedEndDate ? new Date(project.expectedEndDate) : undefined,
        notes: project.notes || "",
        clientId: project.quotation.clientId,
        teamMembers: [] // Aquí cargaríamos el equipo si existe
      });
    }
  }, [project, form]);

  // Mutation para actualizar el proyecto
  const updateProjectMutation = useMutation({
    mutationFn: (data: EditAlwaysOnProjectFormValues) => 
      apiRequest(`/api/active-projects/${projectId}/update-always-on`, "PATCH", data),
    onSuccess: () => {
      toast({
        title: "Proyecto actualizado",
        description: "Los cambios han sido guardados correctamente."
      });
      queryClient.invalidateQueries({ queryKey: [`/api/active-projects/${projectId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/active-projects'] });
      setLocation("/active-projects");
    },
    onError: (error) => {
      console.error("Error al actualizar el proyecto:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el proyecto. Intente nuevamente.",
        variant: "destructive"
      });
    }
  });

  // Manejar envío del formulario
  const onSubmit = (data: EditAlwaysOnProjectFormValues) => {
    updateProjectMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="p-4 text-center">
        <h2 className="text-lg font-medium text-gray-900">Error al cargar el proyecto</h2>
        <p className="mt-2 text-sm text-gray-500">No se pudo cargar la información del proyecto. Intente nuevamente.</p>
        <Button 
          onClick={() => setLocation("/active-projects")} 
          className="mt-4"
          variant="outline"
        >
          Volver a proyectos
        </Button>
      </div>
    );
  }

  // Verificar si es un proyecto macro "Always On"
  if (!project.isAlwaysOnMacro) {
    return (
      <div className="p-4 text-center">
        <h2 className="text-lg font-medium text-gray-900">Proyecto no compatible</h2>
        <p className="mt-2 text-sm text-gray-500">Este no es un proyecto "Always On" macro. Por favor, seleccione un proyecto válido.</p>
        <Button 
          onClick={() => setLocation("/active-projects")} 
          className="mt-4"
          variant="outline"
        >
          Volver a proyectos
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-5xl">
      {/* Header con navegación */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setLocation("/active-projects")}
            className="h-8 w-8 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Volver</span>
          </Button>
          <h1 className="text-xl font-semibold">Editar Proyecto Always-On</h1>
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">Macro Project</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <span>{project.quotation.projectName}</span>
              <Badge className={project.status === "active" ? "bg-green-500" : "bg-amber-500"}>
                {project.status === "active" ? "Activo" : "En pausa"}
              </Badge>
            </div>
          </CardTitle>
          <CardDescription>
            Edite los detalles del proyecto macro "Always On" y su presupuesto global.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">Información General</TabsTrigger>
              <TabsTrigger value="budget">Presupuesto</TabsTrigger>
              <TabsTrigger value="team">Equipo</TabsTrigger>
            </TabsList>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-6">
                <TabsContent value="general" className="space-y-4">
                  <FormField
                    control={form.control}
                    name="projectName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre del Proyecto</FormLabel>
                        <FormControl>
                          <Input placeholder="Ingrese nombre del proyecto" {...field} />
                        </FormControl>
                        <FormDescription>
                          Este nombre aparecerá en todos los informes y comunicaciones.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="clientId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cliente</FormLabel>
                          <Select 
                            onValueChange={(value) => field.onChange(parseInt(value))}
                            defaultValue={field.value.toString()}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccione un cliente" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {clients.map((client: any) => (
                                <SelectItem key={client.id} value={client.id.toString()}>
                                  <div className="flex items-center">
                                    <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                                    {client.name}
                                  </div>
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
                                <SelectValue placeholder="Seleccione un estado" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="active">Activo</SelectItem>
                              <SelectItem value="on-hold">En Pausa</SelectItem>
                              <SelectItem value="completed">Completado</SelectItem>
                              <SelectItem value="cancelled">Cancelado</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
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
                                  className={cn(
                                    "pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP", { locale: es })
                                  ) : (
                                    <span>Seleccione una fecha</span>
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
                                disabled={(date) =>
                                  date > new Date() || date < new Date("1900-01-01")
                                }
                                initialFocus
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
                                  className={cn(
                                    "pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP", { locale: es })
                                  ) : (
                                    <span>Seleccione una fecha</span>
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
                                disabled={(date) =>
                                  date < new Date("1900-01-01")
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
                              <SelectValue placeholder="Seleccione frecuencia" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="daily">Diario</SelectItem>
                            <SelectItem value="weekly">Semanal</SelectItem>
                            <SelectItem value="biweekly">Quincenal</SelectItem>
                            <SelectItem value="monthly">Mensual</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Con qué frecuencia se realizará el seguimiento de este proyecto.
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
                            placeholder="Información adicional sobre el proyecto" 
                            className="resize-none" 
                            rows={4}
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Agregue cualquier información relevante sobre el proyecto, instrucciones especiales o consideraciones.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="budget" className="space-y-4">
                  <div className="rounded-lg border p-4 bg-blue-50/50">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-full bg-blue-100">
                        <DollarSign className="h-5 w-5 text-blue-700" />
                      </div>
                      <div>
                        <h3 className="font-medium text-blue-900">Configuración de Presupuesto "Always On"</h3>
                        <p className="text-sm text-blue-700 mt-1">
                          El presupuesto mensual configurado aquí será compartido entre todos los subproyectos asociados.
                        </p>
                      </div>
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="macroMonthlyBudget"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Presupuesto Mensual Global</FormLabel>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 h-4 w-4" />
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="0.00" 
                              className="pl-9"
                              {...field}
                            />
                          </FormControl>
                        </div>
                        <FormDescription>
                          Este es el presupuesto mensual consolidado que se compartirá entre todos los subproyectos.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="rounded-lg border p-4 mt-4">
                    <h3 className="font-medium text-sm mb-2">Subproyectos Asociados</h3>
                    <p className="text-xs text-gray-500 mb-4">Los siguientes proyectos comparten este presupuesto mensual:</p>
                    
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {project?.subProjects?.map((subProject: any) => (
                        <div key={subProject.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-gray-50">
                          <div>
                            <span className="text-xs font-medium">{subProject.quotation?.projectName}</span>
                            <div className="text-[10px] text-gray-500">
                              ID: {subProject.id} • Estado: {subProject.status}
                            </div>
                          </div>
                        </div>
                      ))}
                      {(!project?.subProjects || project.subProjects.length === 0) && (
                        <div className="text-center py-4 text-xs text-gray-500">
                          No hay subproyectos asociados a este proyecto macro.
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="team" className="space-y-4">
                  <div className="rounded-lg border p-4 bg-blue-50/50">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-full bg-blue-100">
                        <Users className="h-5 w-5 text-blue-700" />
                      </div>
                      <div>
                        <h3 className="font-medium text-blue-900">Equipo del Proyecto Macro</h3>
                        <p className="text-sm text-blue-700 mt-1">
                          Configure el equipo principal que trabajará en todos los subproyectos asociados.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Aquí iría la lógica para manejar el equipo del proyecto */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-medium">Miembros del Equipo</h3>
                      <Button 
                        type="button" 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          // Lógica para agregar miembro al equipo
                          toast({
                            title: "Característica en desarrollo",
                            description: "La gestión de equipo para proyectos macro estará disponible pronto."
                          });
                        }}
                      >
                        Agregar Miembro
                      </Button>
                    </div>

                    <div className="border rounded-md p-4 text-center text-sm text-gray-500">
                      <Users className="h-10 w-10 mx-auto mb-2 text-gray-400" />
                      <p>La gestión de equipo para proyectos "Always On" estará disponible pronto.</p>
                    </div>
                  </div>
                </TabsContent>

                <div className="pt-4 border-t flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setLocation("/active-projects")}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={updateProjectMutation.isPending}>
                    {updateProjectMutation.isPending ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Guardando...
                      </>
                    ) : (
                      "Guardar Cambios"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}