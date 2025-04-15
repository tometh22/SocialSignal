import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Role } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TableCell, TableRow } from "@/components/ui/table";
import { Edit, Loader2 } from "lucide-react";

interface InlineEditRoleProps {
  role: Role;
  onUpdate?: (updatedRole: Role) => void;
}

export function InlineEditRole({ role, onUpdate }: InlineEditRoleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(role.name);
  const [editDescription, setEditDescription] = useState(role.description || "");
  const [editDefaultRate, setEditDefaultRate] = useState(role.defaultRate);
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
      setEditDefaultRate(role.defaultRate);
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
    setEditDefaultRate(localRole.defaultRate);
    setIsEditing(false);
  };

  return (
    <TableRow>
      <TableCell className="font-medium">
        {isEditing ? (
          <Input 
            value={editName} 
            onChange={(e) => setEditName(e.target.value)}
            className="w-full"
          />
        ) : localRole.name}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <Textarea 
            value={editDescription} 
            onChange={(e) => setEditDescription(e.target.value)}
            className="w-full h-20 resize-none"
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
            className="w-full"
          />
        ) : `$${localRole.defaultRate.toFixed(2)}/hr`}
      </TableCell>
      <TableCell className="text-right">
        {isEditing ? (
          <div className="flex justify-end space-x-2">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              Cancel
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
                  Saving...
                </>
              ) : "Save"}
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}