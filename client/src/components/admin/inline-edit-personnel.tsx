
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Edit, Check, X, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface InlineEditPersonnelProps {
  person: {
    id: number;
    name: string;
    email: string;
    roleId: number;
    roleName: string;
    hourlyRate: number;
  };
  roles: any[];
}

export default function InlineEditPersonnel({ person, roles }: InlineEditPersonnelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(person.name);
  const [editedEmail, setEditedEmail] = useState(person.email);
  const [editedRoleId, setEditedRoleId] = useState(person.roleId.toString());
  const [editedHourlyRate, setEditedHourlyRate] = useState(person.hourlyRate.toString());

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updatePersonnelMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; roleId: number; hourlyRate: number }) => {
      return apiRequest(`/api/personnel/${person.id}`, "PUT", data);
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ["/api/personnel"] });

      const previousPersonnel = queryClient.getQueryData(["/api/personnel"]);

      queryClient.setQueryData(["/api/personnel"], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((p: any) => 
          p.id === person.id 
            ? { 
                ...p, 
                ...newData,
                roleName: roles.find(r => r.id === newData.roleId)?.name || p.roleName
              }
            : p
        );
      });

      return { previousPersonnel };
    },
    onError: (err, newData, context) => {
      queryClient.setQueryData(["/api/personnel"], context?.previousPersonnel);
      toast({
        title: "Error",
        description: "No se pudo actualizar el personal",
        variant: "destructive"
      });
    },
    onSuccess: (updatedPerson) => {
      // Actualizar inmediatamente los datos en el cache
      queryClient.setQueryData(["/api/personnel"], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((p: any) => 
          p.id === person.id ? {
            ...updatedPerson,
            roleName: roles.find(r => r.id === updatedPerson.roleId)?.name || updatedPerson.roleName
          } : p
        );
      });

      // Forzar re-render
      queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });

      toast({
        title: "Éxito",
        description: "Personal actualizado correctamente"
      });
      setIsEditing(false);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });
    }
  });

  const handleSave = () => {
    const hourlyRate = parseFloat(editedHourlyRate);
    const roleId = parseInt(editedRoleId);

    if (isNaN(hourlyRate) || hourlyRate < 0) {
      toast({
        title: "Error",
        description: "La tarifa por hora debe ser un número válido",
        variant: "destructive"
      });
      return;
    }

    if (!editedName.trim() || !editedEmail.trim()) {
      toast({
        title: "Error",
        description: "El nombre y email son requeridos",
        variant: "destructive"
      });
      return;
    }

    updatePersonnelMutation.mutate({
      name: editedName.trim(),
      email: editedEmail.trim(),
      roleId: roleId,
      hourlyRate: hourlyRate
    });
  };

  const handleCancel = () => {
    setEditedName(person.name);
    setEditedEmail(person.email);
    setEditedRoleId(person.roleId.toString());
    setEditedHourlyRate(person.hourlyRate.toString());
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
            disabled={updatePersonnelMutation.isPending}
          />
        </td>
        <td className="px-6 py-4">
          <Input
            type="email"
            value={editedEmail}
            onChange={(e) => setEditedEmail(e.target.value)}
            className="h-8"
            disabled={updatePersonnelMutation.isPending}
          />
        </td>
        <td className="px-6 py-4">
          <Select
            value={editedRoleId}
            onValueChange={setEditedRoleId}
            disabled={updatePersonnelMutation.isPending}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles?.map((role: any) => (
                <SelectItem key={role.id} value={role.id.toString()}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              disabled={updatePersonnelMutation.isPending}
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
              disabled={updatePersonnelMutation.isPending}
              className="h-8 w-8 p-0"
            >
              {updatePersonnelMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4 text-green-600" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              disabled={updatePersonnelMutation.isPending}
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
      <td className="px-6 py-4 font-medium">{person.name}</td>
      <td className="px-6 py-4 text-muted-foreground">{person.email}</td>
      <td className="px-6 py-4">
        <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
          {person.roleName}
        </span>
      </td>
      <td className="px-6 py-4">
        <span className="font-medium">${person.hourlyRate}/hr</span>
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
