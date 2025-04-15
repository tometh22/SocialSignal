import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ReportTemplate } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TableCell, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Loader2 } from "lucide-react";

interface InlineEditTemplateProps {
  template: ReportTemplate;
}

export function InlineEditTemplate({ template }: InlineEditTemplateProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(template.name);
  const [editDescription, setEditDescription] = useState(template.description || "");
  const [editComplexity, setEditComplexity] = useState(template.complexity);
  const [editPageRange, setEditPageRange] = useState(template.pageRange || "");
  const [editFeatures, setEditFeatures] = useState(template.features || "");
  const [updatedTemplate, setUpdatedTemplate] = useState<ReportTemplate>(template);
  const { toast } = useToast();

  // Update when the template prop changes
  useEffect(() => {
    setUpdatedTemplate(template);
    if (!isEditing) {
      setEditName(template.name);
      setEditDescription(template.description || "");
      setEditComplexity(template.complexity);
      setEditPageRange(template.pageRange || "");
      setEditFeatures(template.features || "");
    }
  }, [template, isEditing]);

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { 
      id: number; 
      data: { 
        name: string; 
        description: string; 
        complexity: string;
        pageRange: string;
        features: string;
      } 
    }) => {
      const response = await apiRequest("PATCH", `/api/templates/${id}`, data);
      return await response.json();
    },
    onSuccess: (updatedData: ReportTemplate) => {
      setUpdatedTemplate(updatedData);
      // Actualizar de inmediato la caché local
      queryClient.setQueryData(["/api/templates"], (oldData: ReportTemplate[] | undefined) => {
        if (!oldData) return [updatedData];
        return oldData.map(item => item.id === updatedData.id ? updatedData : item);
      });
      // Invalidar la consulta para refrescar los datos
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Success",
        description: "Template has been updated successfully.",
      });
      setIsEditing(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update template.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    // Validate inputs
    if (!editName.trim()) {
      toast({
        title: "Error",
        description: "Template name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    updateTemplateMutation.mutate({ 
      id: template.id, 
      data: {
        name: editName,
        description: editDescription,
        complexity: editComplexity,
        pageRange: editPageRange,
        features: editFeatures
      }
    });
  };

  const handleCancel = () => {
    setEditName(updatedTemplate.name);
    setEditDescription(updatedTemplate.description || "");
    setEditComplexity(updatedTemplate.complexity);
    setEditPageRange(updatedTemplate.pageRange || "");
    setEditFeatures(updatedTemplate.features || "");
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
        ) : updatedTemplate.name}
      </TableCell>
      <TableCell className="max-w-xs">
        {isEditing ? (
          <Textarea 
            value={editDescription} 
            onChange={(e) => setEditDescription(e.target.value)}
            className="w-full h-20 resize-none"
          />
        ) : updatedTemplate.description || "-"}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <Select value={editComplexity} onValueChange={setEditComplexity}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select complexity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="variable">Variable</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
            ${updatedTemplate.complexity === 'low' ? 'bg-green-100 text-green-800' : ''}
            ${updatedTemplate.complexity === 'medium' ? 'bg-yellow-100 text-yellow-800' : ''}
            ${updatedTemplate.complexity === 'high' ? 'bg-red-100 text-red-800' : ''}
            ${updatedTemplate.complexity === 'variable' ? 'bg-blue-100 text-blue-800' : ''}
          `}>
            {updatedTemplate.complexity.charAt(0).toUpperCase() + updatedTemplate.complexity.slice(1)}
          </span>
        )}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <Input 
            value={editPageRange} 
            onChange={(e) => setEditPageRange(e.target.value)}
            className="w-full"
          />
        ) : updatedTemplate.pageRange || "-"}
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
              disabled={updateTemplateMutation.isPending}
            >
              {updateTemplateMutation.isPending ? (
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