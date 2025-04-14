import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Personnel, Role } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { Edit } from "lucide-react";

interface InlineEditPersonnelProps {
  person: Personnel;
  roles: Role[] | undefined;
}

export function InlineEditPersonnel({ person, roles }: InlineEditPersonnelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(person.name);
  const [editRoleId, setEditRoleId] = useState(person.roleId);
  const [editRate, setEditRate] = useState(person.hourlyRate);
  const { toast } = useToast();

  // Get role name by ID
  const getRoleName = (roleId: number) => {
    if (!roles) return "Unknown";
    const role = roles.find(r => r.id === roleId);
    return role ? role.name : "Unknown";
  };

  // Update personnel mutation
  const updatePersonnelMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name: string; roleId: number; hourlyRate: number } }) => 
      apiRequest("PATCH", `/api/personnel/${id}`, data),
    onSuccess: () => {
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
    setEditName(person.name);
    setEditRoleId(person.roleId);
    setEditRate(person.hourlyRate);
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
        ) : person.name}
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
        ) : getRoleName(person.roleId)}
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
        ) : `$${person.hourlyRate.toFixed(2)}/hr`}
      </TableCell>
      <TableCell className="text-right">
        {isEditing ? (
          <div className="flex justify-end space-x-2">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button variant="default" size="sm" onClick={handleSave}>
              Save
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