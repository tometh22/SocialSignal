import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PencilIcon, DollarSign, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface EditMacroProjectButtonProps {
  project: any;
}

export default function EditMacroProjectButton({ project }: EditMacroProjectButtonProps) {
  // Estados
  const [isOpen, setIsOpen] = useState(false);
  const [budget, setBudget] = useState("4200");
  const [status, setStatus] = useState("active");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // Actualizar estados cuando cambia el proyecto
  useEffect(() => {
    if (project) {
      setBudget(project.macroMonthlyBudget?.toString() || "4200");
      setStatus(project.status || "active");
    }
  }, [project]);
  
  // Mutation para actualizar el proyecto
  const updateProjectMutation = useMutation({
    mutationFn: (data: any) => {
      return apiRequest(`/api/active-projects/${project.id}`, "PATCH", data);
    },
    onSuccess: () => {
      toast({
        title: "Proyecto actualizado",
        description: "Los cambios al proyecto Always-On han sido guardados."
      });
      // Invalidar queries para actualizar la UI
      queryClient.invalidateQueries({ queryKey: [`/api/active-projects/${project.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/active-projects'] });
      setIsOpen(false);
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

  // Mutation para eliminar el proyecto macro
  const deleteProjectMutation = useMutation({
    mutationFn: (id: number) => {
      return apiRequest(`/api/active-projects/${id}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Proyecto eliminado",
        description: "El proyecto Always-On y todos sus subproyectos han sido eliminados."
      });
      // Invalidar queries y redirigir
      queryClient.invalidateQueries({ queryKey: ['/api/active-projects'] });
      setDeleteDialogOpen(false);
      setLocation("/active-projects");
    },
    onError: (error) => {
      console.error("Error al eliminar el proyecto:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el proyecto. Intente nuevamente.",
        variant: "destructive"
      });
    }
  });

  // Manejar envío del formulario
  const handleSave = () => {
    if (!project?.id) {
      console.error("No se puede actualizar: ID de proyecto no disponible");
      return;
    }
    
    try {
      const budgetValue = parseFloat(budget);
      if (isNaN(budgetValue)) {
        toast({
          title: "Error en presupuesto",
          description: "El presupuesto debe ser un número válido",
          variant: "destructive"
        });
        return;
      }
      
      updateProjectMutation.mutate({
        macroMonthlyBudget: budgetValue,
        status
      });
    } catch (error) {
      console.error("Error al procesar datos:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error al procesar los datos del formulario",
        variant: "destructive"
      });
    }
  };

  // Manejar eliminación del proyecto
  const handleDeleteProject = () => {
    setDeleteDialogOpen(true);
  };

  const confirmDeleteProject = () => {
    if (project?.id) {
      deleteProjectMutation.mutate(project.id);
    }
  };

  // Debugging para ver si detecta correctamente el proyecto macro
  console.log("Edit Macro Project Button - Proyecto:", {
    id: project?.id,
    isAlwaysOnMacro: project?.isAlwaysOnMacro,
    shouldRender: project?.isAlwaysOnMacro || project?.id === 16
  });
  
  // Siempre renderizar para proyectos Always-On o con ID 16 (MODO Always-On)
  if (!project?.isAlwaysOnMacro && project?.id !== 16) return null;
  
  return (
    <>
      <div className="flex gap-2 mb-4 ml-4">
        <Button 
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 shadow-lg flex items-center justify-center animate-pulse"
          title="Editar proyecto Always-On"
        >
          <PencilIcon className="h-5 w-5 mr-2" />
          Editar Proyecto Always-On
        </Button>
        
        <Button 
          onClick={handleDeleteProject}
          variant="destructive"
          className="shadow-lg flex items-center justify-center"
          title="Eliminar proyecto Always-On"
        >
          <Trash2 className="h-5 w-5 mr-2" />
          Eliminar Proyecto
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>Editar Proyecto Always-On</span>
              <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">Macro Project</Badge>
            </DialogTitle>
            <DialogDescription>
              Configure los detalles básicos del proyecto macro "Always On"
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="name" className="mb-1 block">Nombre del Proyecto</Label>
              <Input 
                id="name" 
                value={project?.quotation?.projectName || "Proyecto Always-On"} 
                disabled 
                className="bg-gray-50"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Para cambiar el nombre, edite la cotización asociada
              </p>
            </div>
            
            <div>
              <Label htmlFor="budget" className="mb-1 block">Presupuesto Mensual (USD)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 h-4 w-4" />
                <Input 
                  id="budget"
                  type="number"
                  value={budget} 
                  onChange={(e) => setBudget(e.target.value)}
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Este presupuesto se compartirá entre todos los subproyectos
              </p>
            </div>
            
            <div>
              <Label htmlFor="status" className="mb-1 block">Estado</Label>
              <Select 
                value={status} 
                onValueChange={setStatus}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Seleccione un estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="on-hold">En Pausa</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsOpen(false)}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              disabled={updateProjectMutation.isPending}
            >
              {updateProjectMutation.isPending ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para confirmar eliminación del proyecto macro */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="sm:max-w-[500px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">
              ⚠️ ¿Eliminar proyecto Always-On completo?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Estás a punto de eliminar el proyecto macro <strong>"{project?.quotation?.projectName || "Always-On"}"</strong> 
                y <strong>TODOS sus subproyectos asociados</strong>.
              </p>
              
              <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                <p className="font-semibold text-red-800 mb-2">Esta acción es IRREVERSIBLE y eliminará:</p>
                <ul className="list-disc list-inside text-red-700 space-y-1 text-sm">
                  <li>El proyecto macro y todos los subproyectos</li>
                  <li>Todas las entradas de tiempo registradas</li>
                  <li>Todos los informes de progreso</li>
                  <li>Las conversaciones de chat relacionadas</li>
                  <li>Todos los componentes y configuraciones</li>
                  <li>Las asignaciones de presupuesto</li>
                </ul>
              </div>
              
              <p className="text-sm text-gray-600">
                Si solo quieres eliminar subproyectos específicos, cancela esta acción y usa los botones de eliminación individuales.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteProject}
              disabled={deleteProjectMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteProjectMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  SÍ, ELIMINAR PROYECTO COMPLETO
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}