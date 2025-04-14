import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Role } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TableCell, TableRow } from "@/components/ui/table";
import { Edit } from "lucide-react";

interface InlineEditRoleProps {
  role: Role;
}

export function InlineEditRole({ role }: InlineEditRoleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(role.name);
  const [editDescription, setEditDescription] = useState(role.description || "");
  const [editDefaultRate, setEditDefaultRate] = useState(role.defaultRate);
  const { toast } = useToast();

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name: string; description: string; defaultRate: number } }) => 
      apiRequest("PATCH", `/api/roles/${id}`, data),
    onSuccess: () => {
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
    setEditName(role.name);
    setEditDescription(role.description || "");
    setEditDefaultRate(role.defaultRate);
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
        ) : role.name}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <Textarea 
            value={editDescription} 
            onChange={(e) => setEditDescription(e.target.value)}
            className="w-full h-20 resize-none"
          />
        ) : role.description || "-"}
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
        ) : `$${role.defaultRate.toFixed(2)}/hr`}
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