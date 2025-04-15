import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Personnel, Role } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { Edit, Loader2 } from "lucide-react";

interface InlineEditPersonnelProps {
  person: Personnel;
  roles: Role[] | undefined;
}

export function InlineEditPersonnel({ person, roles }: InlineEditPersonnelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(person.name);
  const [editRoleId, setEditRoleId] = useState(person.roleId);
  const [editRate, setEditRate] = useState(person.hourlyRate);
  const [updatedPerson, setUpdatedPerson] = useState<Personnel>(person);
  const { toast } = useToast();

  // Update when the person prop changes
  useEffect(() => {
    setUpdatedPerson(person);
    if (!isEditing) {
      setEditName(person.name);
      setEditRoleId(person.roleId);
      setEditRate(person.hourlyRate);
    }
  }, [person, isEditing]);

  // Get role name by ID
  const getRoleName = (roleId: number) => {
    if (!roles) return "Unknown";
    const role = roles.find(r => r.id === roleId);
    return role ? role.name : "Unknown";
  };

  // Update personnel mutation
  const updatePersonnelMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { name: string; roleId: number; hourlyRate: number } }) => {
      const response = await apiRequest("PATCH", `/api/personnel/${id}`, data);
      return await response.json();
    },
    onSuccess: (updatedData: Personnel) => {
      setUpdatedPerson(updatedData);
      // Actualizar de inmediato la caché local
      queryClient.setQueryData(["/api/personnel"], (oldData: Personnel[] | undefined) => {
        if (!oldData) return [updatedData];
        return oldData.map(item => item.id === updatedData.id ? updatedData : item);
      });
      // Invalidar la consulta para refrescar los datos
      queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });
      toast({
        title: "Success",
        description: "Team member has been updated successfully.",
      });
      setIsEditing(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update team member.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    // Validate inputs
    if (!editName.trim()) {
      toast({
        title: "Error",
        description: "Name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    if (editRate <= 0) {
      toast({
        title: "Error",
        description: "Hourly rate must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    updatePersonnelMutation.mutate({ 
      id: person.id, 
      data: {
        name: editName,
        roleId: editRoleId,
        hourlyRate: editRate
      }
    });
  };

  const handleCancel = () => {
    setEditName(updatedPerson.name);
    setEditRoleId(updatedPerson.roleId);
    setEditRate(updatedPerson.hourlyRate);
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
        ) : updatedPerson.name}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <Select value={editRoleId.toString()} onValueChange={(value) => setEditRoleId(parseInt(value))}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {roles?.map(role => (
                <SelectItem key={role.id} value={role.id.toString()}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : getRoleName(updatedPerson.roleId)}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <Input 
            type="number" 
            min="0" 
            step="0.01" 
            value={editRate} 
            onChange={(e) => setEditRate(parseFloat(e.target.value))} 
            className="w-full"
          />
        ) : `$${updatedPerson.hourlyRate.toFixed(2)}/hr`}
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
              disabled={updatePersonnelMutation.isPending}
            >
              {updatePersonnelMutation.isPending ? (
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