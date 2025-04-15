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
      // Actualizar estado local inmediatamente
      setLocalRole(updatedData);
      
      // Notificar al componente padre si existe onUpdate
      if (onUpdate) {
        onUpdate(updatedData);
      }
      
      // Actualizar la caché de React Query
      queryClient.setQueryData(["/api/roles"], (oldData: Role[] | undefined) => {
        if (!oldData) return [updatedData];
        return oldData.map(item => item.id === updatedData.id ? updatedData : item);
      });
      
      // También invalidar la consulta para asegurar que los datos se actualicen
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      
      toast({
        title: "Success",
        description: "Role has been updated successfully.",
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
      await apiRequest("DELETE", `/api/roles/${role.id}`);
      return role.id;
    },
    onSuccess: (deletedId) => {
      if (onDelete) {
        onDelete(deletedId);
      }
      
      // Actualizar la caché de React Query eliminando el rol
      queryClient.setQueryData(["/api/roles"], (oldData: Role[] | undefined) => {
        if (!oldData) return [];
        return oldData.filter(item => item.id !== deletedId);
      });
      
      toast({
        title: "Éxito",
        description: "Rol eliminado correctamente",
      });
    },
    onError: () => {
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
              className="w-full h-9" // Altura fija
            />
          ) : localRole.name}
        </TableCell>
        <TableCell>
          {isEditing ? (
            <Textarea 
              value={editDescription} 
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full h-10 resize-none min-h-0 py-2"
              style={{ overflow: 'auto', lineHeight: '1.2' }}
            />
          ) : localRole.description || "-"}
        </TableCell>
        <TableCell>
          {isEditing ? (
            <Input 
              type="number" 
              min="0" 
              step="0.01" 
              value={editDefaultRate} 
              onChange={(e) => setEditDefaultRate(parseFloat(e.target.value))} 
              className="w-full h-9" // Altura fija
            />
          ) : `$${(typeof localRole.defaultRate === 'number' ? localRole.defaultRate : 0).toFixed(2)}/hr`}
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