import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PencilIcon, DollarSign } from "lucide-react";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EditMacroProjectButtonProps {
  project: any;
}

export default function EditMacroProjectButton({ project }: EditMacroProjectButtonProps) {
  // Estados
  const [isOpen, setIsOpen] = useState(false);
  const [budget, setBudget] = useState(project?.macroMonthlyBudget?.toString() || "4200");
  const [status, setStatus] = useState(project?.status || "active");
  const { toast } = useToast();
  
  // Actualizar estados cuando cambia el proyecto
  useEffect(() => {
    if (project) {
      setBudget(project.macroMonthlyBudget?.toString() || "4200");
      setStatus(project.status || "active");
    }
  }, [project]);
  
  // Mutation para actualizar el proyecto
  const updateProjectMutation = useMutation({
    mutationFn: (data: any) => 
      apiRequest(`/api/active-projects/${project.id}`, "PATCH", data),
    onSuccess: () => {
      toast({
        title: "Proyecto actualizado",
        description: "Los cambios al proyecto Always-On han sido guardados."
      });
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

  // Manejar envío del formulario
  const handleSave = () => {
    if (!project?.id) return;
    
    updateProjectMutation.mutate({
      macroMonthlyBudget: parseFloat(budget),
      status
    });
  };

  // No renderizar nada si no es un proyecto macro Always-On
  if (!project?.isAlwaysOnMacro) return null;

  return (
    <>
      <Button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 rounded-full h-12 w-12 bg-blue-600 hover:bg-blue-700 shadow-md flex items-center justify-center"
        title="Editar proyecto Always-On"
      >
        <PencilIcon className="h-5 w-5" />
      </Button>

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
                value={project?.quotation?.projectName || ""} 
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
    </>
  );
}