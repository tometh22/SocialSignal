import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Loader2, Trash2, Edit, Plus } from "lucide-react";

// Interfaces
interface ProjectComponent {
  id: number;
  projectId: number;
  name: string;
  description: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: number | null;
}

// Esquema para la validación del formulario
const componentFormSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  description: z.string().optional(),
  isDefault: z.boolean().default(false),
});

type ComponentFormValues = z.infer<typeof componentFormSchema>;

interface ComponentsManagerProps {
  projectId: number;
  refreshTimeEntries?: () => void;
}

const ComponentsManager: React.FC<ComponentsManagerProps> = ({ 
  projectId, 
  refreshTimeEntries 
}) => {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<ProjectComponent | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [componentToDelete, setComponentToDelete] = useState<ProjectComponent | null>(null);

  // Consulta para obtener los componentes del proyecto
  const { 
    data: components, 
    isLoading: isLoadingComponents, 
    refetch: refetchComponents 
  } = useQuery<ProjectComponent[]>({
    queryKey: ['/api/project-components', projectId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/project-components/${projectId}`);
      const data = await response.json();
      return data;
    },
    enabled: !!projectId,
  });

  // Formulario para crear/editar componentes
  const form = useForm<ComponentFormValues>({
    resolver: zodResolver(componentFormSchema),
    defaultValues: {
      name: "",
      description: "",
      isDefault: false,
    },
  });

  // Mutación para crear un componente
  const createMutation = useMutation({
    mutationFn: async (values: ComponentFormValues) => {
      const response = await apiRequest('POST', '/api/project-components', {
        ...values,
        projectId,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Componente creado",
        description: "El componente se ha creado correctamente.",
      });
      refetchComponents();
      setIsDialogOpen(false);
      form.reset();
      if (refreshTimeEntries) refreshTimeEntries();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `No se pudo crear el componente: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutación para actualizar un componente
  const updateMutation = useMutation({
    mutationFn: async (values: ComponentFormValues & { id: number }) => {
      const { id, ...componentData } = values;
      const response = await apiRequest('PATCH', `/api/project-components/${id}`, componentData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Componente actualizado",
        description: "El componente se ha actualizado correctamente.",
      });
      refetchComponents();
      setIsDialogOpen(false);
      form.reset();
      if (refreshTimeEntries) refreshTimeEntries();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `No se pudo actualizar el componente: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutación para eliminar un componente
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/project-components/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Componente eliminado",
        description: "El componente se ha eliminado correctamente.",
      });
      refetchComponents();
      setDeleteConfirmOpen(false);
      setComponentToDelete(null);
      if (refreshTimeEntries) refreshTimeEntries();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `No se pudo eliminar el componente: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Función para abrir el formulario en modo edición
  const handleEdit = (component: ProjectComponent) => {
    setSelectedComponent(component);
    setIsEditMode(true);
    form.reset({
      name: component.name,
      description: component.description || "",
      isDefault: component.isDefault,
    });
    setIsDialogOpen(true);
  };

  // Función para abrir el formulario en modo creación
  const handleNewComponent = () => {
    setSelectedComponent(null);
    setIsEditMode(false);
    form.reset({
      name: "",
      description: "",
      isDefault: false,
    });
    setIsDialogOpen(true);
  };

  // Función para confirmar eliminación
  const handleDeleteConfirm = (component: ProjectComponent) => {
    setComponentToDelete(component);
    setDeleteConfirmOpen(true);
  };

  // Manejar envío del formulario
  const onSubmit = (values: ComponentFormValues) => {
    if (isEditMode && selectedComponent) {
      updateMutation.mutate({ ...values, id: selectedComponent.id });
    } else {
      createMutation.mutate(values);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Componentes del Proyecto</h3>
        <Button onClick={handleNewComponent} size="sm" className="gap-1">
          <Plus className="h-4 w-4" />
          Nuevo Componente
        </Button>
      </div>
      
      <Card>
        <CardContent className="p-0">
          {isLoadingComponents ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : components && components.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="w-[100px] text-center">Predeterminado</TableHead>
                  <TableHead className="w-[100px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {components.map((component) => (
                  <TableRow key={component.id}>
                    <TableCell className="font-medium">{component.name}</TableCell>
                    <TableCell>{component.description || "—"}</TableCell>
                    <TableCell className="text-center">
                      {component.isDefault && (
                        <Badge variant="secondary" className="text-xs">
                          Predeterminado
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(component)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteConfirm(component)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <p className="text-muted-foreground mb-4">
                No hay componentes definidos para este proyecto.
              </p>
              <Button onClick={handleNewComponent} size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                Crear Componente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo para crear/editar componentes */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? "Editar Componente" : "Nuevo Componente"}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? "Actualiza la información del componente."
                : "Define un nuevo componente para este proyecto."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Informe Semanal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe brevemente este componente"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isDefault"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Establecer como predeterminado</FormLabel>
                      <FormDescription>
                        Si se marca, este componente será el seleccionado por defecto al registrar horas.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isEditMode ? "Actualizar" : "Crear"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación para eliminar */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar el componente "{componentToDelete?.name}"?
              {componentToDelete?.isDefault && (
                <div className="mt-2 text-destructive font-medium">
                  Este es el componente predeterminado. Si lo eliminas, deberás elegir otro componente como predeterminado.
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (componentToDelete) {
                  deleteMutation.mutate(componentToDelete.id);
                }
              }}
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ComponentsManager;