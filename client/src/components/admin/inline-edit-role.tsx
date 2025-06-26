
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Edit, Check, X, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface InlineEditRoleProps {
  role: {
    id: number;
    name: string;
    description: string;
    defaultRate: number;
  };
}

function InlineEditRole({ role }: InlineEditRoleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(role.name);
  const [editedDescription, setEditedDescription] = useState(role.description || "");
  const [editedHourlyRate, setEditedHourlyRate] = useState(role.defaultRate.toString());

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateRoleMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; defaultRate: number }) => {
      return apiRequest(`/api/roles/${role.id}`, "PUT", data);
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ["/api/roles"] });

      const previousRoles = queryClient.getQueryData(["/api/roles"]);

      queryClient.setQueryData(["/api/roles"], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((r: any) => 
          r.id === role.id 
            ? { ...r, ...newData }
            : r
        );
      });

      return { previousRoles };
    },
    onError: (err, newData, context) => {
      queryClient.setQueryData(["/api/roles"], context?.previousRoles);
      toast({
        title: "Error",
        description: "No se pudo actualizar el rol",
        variant: "destructive"
      });
    },
    onSuccess: (updatedRole) => {
      // Actualizar inmediatamente los datos en el cache
      queryClient.setQueryData(["/api/roles"], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((r: any) => 
          r.id === role.id ? updatedRole : r
        );
      });

      // Forzar re-render
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });

      toast({
        title: "Éxito",
        description: "Rol actualizado correctamente"
      });
      setIsEditing(false);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
    }
  });

  const handleSave = () => {
    const hourlyRate = parseFloat(editedHourlyRate);

    if (isNaN(hourlyRate) || hourlyRate < 0) {
      toast({
        title: "Error",
        description: "La tarifa por hora debe ser un número válido",
        variant: "destructive"
      });
      return;
    }

    if (!editedName.trim()) {
      toast({
        title: "Error",
        description: "El nombre del rol es requerido",
        variant: "destructive"
      });
      return;
    }

    updateRoleMutation.mutate({
      name: editedName.trim(),
      description: editedDescription.trim(),
      defaultRate: hourlyRate
    });
  };

  const handleCancel = () => {
    setEditedName(role.name);
    setEditedDescription(role.description || "");
    setEditedHourlyRate(role.defaultRate.toString());
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <tr className="border-b">
        <td className="px-6 py-4">
          <Input
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            className="h-8"
            disabled={updateRoleMutation.isPending}
          />
        </td>
        <td className="px-6 py-4">
          <Input
            value={editedDescription}
            onChange={(e) => setEditedDescription(e.target.value)}
            className="h-8"
            placeholder="Sin descripción"
            disabled={updateRoleMutation.isPending}
          />
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-1">
            <span className="text-sm">$</span>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={editedHourlyRate}
              onChange={(e) => setEditedHourlyRate(e.target.value)}
              className="h-8 w-20"
              disabled={updateRoleMutation.isPending}
            />
            <span className="text-sm text-muted-foreground">/hr</span>
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSave}
              disabled={updateRoleMutation.isPending}
              className="h-8 w-8 p-0"
            >
              {updateRoleMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4 text-green-600" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              disabled={updateRoleMutation.isPending}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b hover:bg-muted/50">
      <td className="px-6 py-4 font-medium">{role.name}</td>
      <td className="px-6 py-4 text-muted-foreground">
        {role.description || "Sin descripción"}
      </td>
      <td className="px-6 py-4">
        <span className="font-medium">${role.defaultRate}/hr</span>
      </td>
      <td className="px-6 py-4">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsEditing(true)}
          className="h-8 w-8 p-0"
        >
          <Edit className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}

export { InlineEditRole };
export default InlineEditRole;
