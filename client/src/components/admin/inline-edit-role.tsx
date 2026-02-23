
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Edit, Check, X, Loader2, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface InlineEditRoleProps {
  role: {
    id: number;
    name: string;
    description: string;
    defaultRate: number;
    defaultRateUsd: number | null;
  };
}

function InlineEditRole({ role }: InlineEditRoleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editedName, setEditedName] = useState(role.name);
  const [editedDescription, setEditedDescription] = useState(role.description || "");
  const [editedHourlyRate, setEditedHourlyRate] = useState(role.defaultRate.toString());
  const [editedHourlyRateUsd, setEditedHourlyRateUsd] = useState((role.defaultRateUsd || 0).toString());

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateRoleMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; defaultRate: number; defaultRateUsd?: number }) => {
      return apiRequest(`/api/roles/${role.id}`, "PATCH", data);
    },
    onSuccess: (updatedRole) => {
      setEditedName(updatedRole.name);
      setEditedDescription(updatedRole.description || "");
      setEditedHourlyRate(updatedRole.defaultRate.toString());
      setEditedHourlyRateUsd((updatedRole.defaultRateUsd || 0).toString());

      // Actualizar cache de forma optimista
      queryClient.setQueryData(["/api/roles"], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((r: any) => 
          r.id === role.id ? updatedRole : r
        );
      });

      // Invalidar queries para forzar actualización
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });

      toast({
        title: "Éxito",
        description: "Rol actualizado correctamente"
      });
      setIsEditing(false);
    },
    onError: (err) => {
      console.error("Error updating role:", err);
      toast({
        title: "Error",
        description: "No se pudo actualizar el rol",
        variant: "destructive"
      });
    }
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/roles/${role.id}`, "DELETE");
    },
    onSuccess: () => {
      // Actualizar cache de forma optimista eliminando el rol
      queryClient.setQueryData(["/api/roles"], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.filter((r: any) => r.id !== role.id);
      });

      // Invalidar queries para forzar actualización
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });

      toast({
        title: "Éxito",
        description: "Rol eliminado correctamente"
      });
    },
    onError: (err) => {
      console.error("Error deleting role:", err);
      toast({
        title: "Error",
        description: "No se pudo eliminar el rol. Puede estar en uso.",
        variant: "destructive"
      });
      setIsDeleting(false);
    }
  });

  const handleDelete = () => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar el rol "${role.name}"? Esta acción no se puede deshacer.`)) {
      setIsDeleting(true);
      deleteRoleMutation.mutate();
    }
  };

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

    const hourlyRateUsd = parseFloat(editedHourlyRateUsd);

    updateRoleMutation.mutate({
      name: editedName.trim(),
      description: editedDescription.trim(),
      defaultRate: hourlyRate,
      defaultRateUsd: isNaN(hourlyRateUsd) ? 0 : hourlyRateUsd
    });
  };

  const handleCancel = () => {
    setEditedName(role.name);
    setEditedDescription(role.description || "");
    setEditedHourlyRate(role.defaultRate.toString());
    setEditedHourlyRateUsd((role.defaultRateUsd || 0).toString());
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <tr className="border-b bg-blue-50/30">
        <td className="px-6 py-4">
          <Input
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            className="h-9 border-blue-200 focus:border-blue-400"
            disabled={updateRoleMutation.isPending}
            placeholder="Nombre del rol"
          />
        </td>
        <td className="px-6 py-4">
          <Input
            value={editedDescription}
            onChange={(e) => setEditedDescription(e.target.value)}
            className="h-9 border-blue-200 focus:border-blue-400"
            placeholder="Descripción del rol"
            disabled={updateRoleMutation.isPending}
          />
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-gray-600">$</span>
            <Input
              type="number"
              step="1"
              min="0"
              value={editedHourlyRate}
              onChange={(e) => setEditedHourlyRate(e.target.value)}
              className="h-9 w-24 border-blue-200 focus:border-blue-400"
              disabled={updateRoleMutation.isPending}
              placeholder="0"
            />
            <span className="text-sm text-muted-foreground">ARS/hr</span>
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-gray-600">$</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={editedHourlyRateUsd}
              onChange={(e) => setEditedHourlyRateUsd(e.target.value)}
              className="h-9 w-24 border-blue-200 focus:border-blue-400"
              disabled={updateRoleMutation.isPending}
              placeholder="0"
            />
            <span className="text-sm text-muted-foreground">USD/hr</span>
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSave}
              disabled={updateRoleMutation.isPending}
              className="h-9 w-9 p-0 hover:bg-green-100 hover:text-green-700"
            >
              {updateRoleMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              ) : (
                <Check className="h-4 w-4 text-green-600" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              disabled={updateRoleMutation.isPending}
              className="h-9 w-9 p-0 hover:bg-red-100 hover:text-red-700"
            >
              <X className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b hover:bg-muted/50 transition-colors">
      <td className="px-6 py-4">
        <div className="font-medium text-gray-900">{role.name}</div>
      </td>
      <td className="px-6 py-4">
        <div className="text-sm text-muted-foreground max-w-xs truncate">
          {role.description || "Sin descripción"}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold text-green-700">${role.defaultRate.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
          <span className="text-xs text-muted-foreground">ARS/hr</span>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold text-blue-700">${(role.defaultRateUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
          <span className="text-xs text-muted-foreground">USD/hr</span>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsEditing(true)}
            disabled={isDeleting}
            className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 transition-colors"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            disabled={isDeleting || deleteRoleMutation.isPending}
            className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            {isDeleting || deleteRoleMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin text-red-600" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </td>
    </tr>
  );
}

export { InlineEditRole };
export default InlineEditRole;
