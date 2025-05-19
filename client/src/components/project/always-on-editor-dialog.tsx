import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CalendarIcon, DollarSign } from "lucide-react";

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
});

type EditAlwaysOnProjectFormValues = z.infer<typeof editAlwaysOnProjectSchema>;

interface AlwaysOnEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project: any;
}

export function AlwaysOnEditorDialog({ isOpen, onClose, project }: AlwaysOnEditorDialogProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("general");

  // Formulario
  const form = useForm<EditAlwaysOnProjectFormValues>({
    resolver: zodResolver(editAlwaysOnProjectSchema),
    defaultValues: {
      projectName: "",
      macroMonthlyBudget: 0,
      trackingFrequency: "monthly",
      status: "active",
      notes: "",
      startDate: new Date(),
    }
  });

  // Actualizar el formulario cuando se carguen los datos del proyecto
  useEffect(() => {
    if (project && project.quotation) {
      form.reset({
        projectName: project.quotation.projectName,
        macroMonthlyBudget: project.macroMonthlyBudget || 4200, // Valor por defecto para MODO
        trackingFrequency: project.trackingFrequency || "monthly",
        status: project.status || "active",
        startDate: project.startDate ? new Date(project.startDate) : new Date(),
        expectedEndDate: project.expectedEndDate ? new Date(project.expectedEndDate) : undefined,
        notes: project.notes || "",
      });
    }
  }, [project, form]);

  // Mutation para actualizar el proyecto
  const updateProjectMutation = useMutation({
    mutationFn: (data: EditAlwaysOnProjectFormValues) => 
      apiRequest(`/api/active-projects/${project.id}`, "PATCH", data),
    onSuccess: () => {
      toast({
        title: "Proyecto actualizado",
        description: "Los cambios han sido guardados correctamente."
      });
      queryClient.invalidateQueries({ queryKey: [`/api/active-projects/${project.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/active-projects'] });
      onClose();
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Editar Proyecto Always-On</span>
            <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">Macro Project</Badge>
          </DialogTitle>
          <DialogDescription>
            Configure los detalles del proyecto macro "Always On" y su presupuesto global.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                      rows={3}
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

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
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
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}