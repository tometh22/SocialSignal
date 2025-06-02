import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Role } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TableCell, TableRow } from "@/components/ui/table";
import { Edit, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { parseDecimal, formatNumericInput } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface InlineEditRoleProps {
  role: Role;
  onUpdate?: (updatedRole: Role) => void;
  onDelete?: (roleId: number) => void;
}

export function InlineEditRole({ role, onUpdate, onDelete }: InlineEditRoleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(role.name);
  const [editDescription, setEditDescription] = useState(role.description || "");
  // Asegurarse de que editDefaultRate sea un número válido inicialmente
  const [editDefaultRate, setEditDefaultRate] = useState(typeof role.defaultRate === 'number' ? role.defaultRate : 0);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  // Estado local para mostrar los cambios inmediatamente
  const [localRole, setLocalRole] = useState<Role>(role);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Update when the role prop changes
  useEffect(() => {
    setLocalRole(role);
    if (!isEditing) {
      setEditName(role.name);
      setEditDescription(role.description || "");
      setEditDefaultRate(typeof role.defaultRate === 'number' ? role.defaultRate : 0);
    }
  }, [role, isEditing]);

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { name: string; description: string; defaultRate: number } }) => {
      const response = await apiRequest("PATCH", `/api/roles/${id}`, data);
      const updatedRole = await response.json();
      return updatedRole as Role;
    },
    onSuccess: (updatedData: Role) => {
      console.log("ROL ACTUALIZADO - Datos recibidos del servidor:", updatedData);
      
      // Actualizar estado local inmediatamente - FORZAR ACTUALIZACIÓN
      setLocalRole(updatedData);
      setEditName(updatedData.name);
      setEditDescription(updatedData.description || "");
      setEditDefaultRate(updatedData.defaultRate);
      
      console.log("Estado local actualizado con:", {
        name: updatedData.name,
        defaultRate: updatedData.defaultRate
      });
      
      // Actualizar la caché de React Query inmediatamente
      queryClient.setQueryData(["/api/roles"], (oldData: Role[] | undefined) => {
        console.log("Actualizando caché de roles...");
        if (!oldData) return [updatedData];
        const newData = oldData.map(item => item.id === updatedData.id ? updatedData : item);
        console.log("Nueva data en caché:", newData.find(r => r.id === updatedData.id));
        return newData;
      });
      
      // Invalidar TODO inmediatamente
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      queryClient.refetchQueries({ queryKey: ["/api/roles"] });
      
      // Notificar al componente padre si existe onUpdate
      if (onUpdate) {
        console.log("Notificando al componente padre...");
        onUpdate(updatedData);
      }
      
      // Forzar re-render del componente
      setTimeout(() => {
        setLocalRole({...updatedData});
        queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      }, 50);
      
      toast({
        title: "Éxito",
        description: `${updatedData.name}: $${updatedData.defaultRate}/hr actualizado`,
      });
      setIsEditing(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update role.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    // Validate inputs
    if (!editName.trim()) {
      toast({
        title: "Error",
        description: "Role name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    if (editDefaultRate <= 0) {
      toast({
        title: "Error",
        description: "Default rate must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    // Execute mutation
    updateRoleMutation.mutate({ 
      id: role.id, 
      data: {
        name: editName,
        description: editDescription,
        defaultRate: editDefaultRate
      }
    });
  };

  const handleCancel = () => {
    setEditName(localRole.name);
    setEditDescription(localRole.description || "");
    setEditDefaultRate(typeof localRole.defaultRate === 'number' ? localRole.defaultRate : 0);
    setIsEditing(false);
  };

  // Delete role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: async () => {
      // Realizar la eliminación y devolver el ID
      const response = await apiRequest("DELETE", `/api/roles/${role.id}`);
      
      // Validar la respuesta del servidor
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al eliminar el rol");
      }
      
      console.log(`Rol ${role.id} eliminado correctamente`);
      return role.id;
    },
    onSuccess: (deletedId) => {
      // Actualizar la caché directamente aquí para eliminar el rol
      queryClient.setQueryData(["/api/roles"], (oldData: Role[] | undefined) => {
        if (!oldData) return [];
        console.log("Eliminando rol ID:", deletedId);
        console.log("Roles antes:", oldData.map(r => r.id));
        const filtered = oldData.filter(item => item.id !== deletedId);
        console.log("Roles después:", filtered.map(r => r.id));
        return filtered;
      });
      
      // Invalidar las consultas para forzar refrescar los datos
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      
      // Notificar al componente padre si existe onDelete
      if (onDelete) {
        onDelete(deletedId);
      }
      
      toast({
        title: "Éxito",
        description: "Rol eliminado correctamente",
      });
    },
    onError: (error) => {
      console.error("Error al eliminar rol:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el rol. Puede que tenga personal asignado.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    deleteRoleMutation.mutate();
    setIsDeleteDialogOpen(false);
  };

  return (
    <>
      <TableRow>
        <TableCell className="font-medium">
          {isEditing ? (
            <Input 
              value={editName} 
              onChange={(e) => setEditName(e.target.value)}
              className="w-full h-9"
              disabled={updateRoleMutation.isPending}
            />
          ) : (
            <div className="flex items-center gap-2">
              {updateRoleMutation.isPending && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
              <span key={`name-${localRole.id}-${localRole.name}`}>{localRole.name}</span>
            </div>
          )}
        </TableCell>
        <TableCell>
          {isEditing ? (
            <Textarea 
              value={editDescription} 
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full h-10 resize-none min-h-0 py-2"
              style={{ overflow: 'auto', lineHeight: '1.2' }}
              disabled={updateRoleMutation.isPending}
            />
          ) : (
            <div className="flex items-center gap-2">
              {updateRoleMutation.isPending && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
              <span key={`desc-${localRole.id}-${localRole.description}`}>{localRole.description || "-"}</span>
            </div>
          )}
        </TableCell>
        <TableCell>
          {isEditing ? (
            <Input 
              type="text" 
              inputMode="decimal"
              placeholder="0,00"
              value={editDefaultRate.toString().replace('.', ',')} 
              onChange={(e) => {
                const value = parseDecimal(e.target.value);
                setEditDefaultRate(isNaN(value) ? 0 : value);
              }} 
              className="w-full h-9"
              disabled={updateRoleMutation.isPending}
            />
          ) : (
            <div className="flex items-center gap-2">
              {updateRoleMutation.isPending && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
              <span key={`rate-${localRole.id}-${localRole.defaultRate}`} className="font-mono">
                ${(typeof localRole.defaultRate === 'number' ? localRole.defaultRate : 0).toFixed(2).replace('.', ',')}/hr
              </span>
            </div>
          )}
        </TableCell>
        <TableCell className="text-right">
          {isEditing ? (
            <div className="flex justify-end space-x-2">
              <Button variant="outline" size="sm" onClick={handleCancel}>
                Cancelar
              </Button>
              <Button 
                variant="default" 
                size="sm" 
                onClick={handleSave}
                disabled={updateRoleMutation.isPending}
              >
                {updateRoleMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Guardando...
                  </>
                ) : "Guardar"}
              </Button>
            </div>
          ) : (
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsDeleteDialogOpen(true)}
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 mr-1" />
                Editar
              </Button>
            </div>
          )}
        </TableCell>
      </TableRow>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center text-red-600">
              <AlertTriangle className="h-5 w-5 mr-2" /> Eliminar Rol
            </AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro que deseas eliminar el rol <strong>{localRole.name}</strong>?
              <br /><br />
              Esta acción no se puede deshacer. Si hay personal asignado a este rol, la eliminación fallará.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteRoleMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Eliminando...
                </>
              ) : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}