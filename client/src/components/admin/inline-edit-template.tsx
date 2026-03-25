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
import { Edit, Loader2, Trash } from "lucide-react";

interface InlineEditTemplateProps {
  template: ReportTemplate;
  onUpdate?: (updatedTemplate: ReportTemplate) => void;
  onDelete?: (templateId: number) => void;
}

export function InlineEditTemplate({ template, onUpdate, onDelete }: InlineEditTemplateProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(template.name);
  const [editDescription, setEditDescription] = useState(template.description || "");
  const [editComplexity, setEditComplexity] = useState(template.complexity);
  const [editPageRange, setEditPageRange] = useState(template.pageRange || "");
  const [editFeatures, setEditFeatures] = useState(template.features || "");
  const [editPlatformCost, setEditPlatformCost] = useState(template.platformCost || 0);
  const [editDeviationPercentage, setEditDeviationPercentage] = useState(template.deviationPercentage || 0);
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
      setEditPlatformCost(template.platformCost || 0);
      setEditDeviationPercentage(template.deviationPercentage || 0);
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
        platformCost: number;
        deviationPercentage: number;
      } 
    }) => {
      return await apiRequest(`/api/templates/${id}`, "PATCH", data);
    },
    onSuccess: (updatedData: ReportTemplate) => {
      setUpdatedTemplate(updatedData);
      
      // Notificar al componente padre si existe onUpdate
      if (onUpdate) {
        onUpdate(updatedData);
      }
      
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
        features: editFeatures,
        platformCost: editPlatformCost,
        deviationPercentage: editDeviationPercentage
      }
    });
  };

  const handleCancel = () => {
    setEditName(updatedTemplate.name);
    setEditDescription(updatedTemplate.description || "");
    setEditComplexity(updatedTemplate.complexity);
    setEditPageRange(updatedTemplate.pageRange || "");
    setEditFeatures(updatedTemplate.features || "");
    setEditPlatformCost(updatedTemplate.platformCost || 0);
    setEditDeviationPercentage(updatedTemplate.deviationPercentage || 0);
    setIsEditing(false);
  };

  // Calcular si hay costos adicionales visualizados
  const hasCostsToDisplay = (updatedTemplate.platformCost || 0) > 0 || (updatedTemplate.deviationPercentage || 0) > 0;

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
          ) : updatedTemplate.name}
        </TableCell>
        <TableCell className="max-w-xs">
          {isEditing ? (
            <Textarea 
              value={editDescription} 
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full h-10 resize-none min-h-0 py-2"
              style={{ overflow: 'auto', lineHeight: '1.2' }}
            />
          ) : updatedTemplate.description || "-"}
        </TableCell>
        <TableCell>
          {isEditing ? (
            <Select value={editComplexity} onValueChange={setEditComplexity}>
              <SelectTrigger className="w-full h-9"> {/* Altura fija */}
                <SelectValue placeholder="Select complexity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baja</SelectItem>
                <SelectItem value="medium">Media</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
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
              {
                updatedTemplate.complexity === 'low' ? 'Baja' :
                updatedTemplate.complexity === 'medium' ? 'Media' :
                updatedTemplate.complexity === 'high' ? 'Alta' :
                updatedTemplate.complexity === 'variable' ? 'Variable' :
                updatedTemplate.complexity.charAt(0).toUpperCase() + updatedTemplate.complexity.slice(1)
              }
            </span>
          )}
        </TableCell>
        <TableCell>
          {isEditing ? (
            <Input 
              value={editPageRange} 
              onChange={(e) => setEditPageRange(e.target.value)}
              className="w-full h-9" // Altura fija
            />
          ) : updatedTemplate.pageRange || "-"}
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
                disabled={updateTemplateMutation.isPending}
              >
                {updateTemplateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Guardando...
                  </>
                ) : "Guardar"}
              </Button>
            </div>
          ) : (
            <div className="flex justify-end space-x-1">
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 mr-1" />
                Editar
              </Button>
              {onDelete && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    if (window.confirm(`¿Estás seguro de que deseas eliminar la plantilla "${updatedTemplate.name}"? Esta acción no se puede deshacer.`)) {
                      onDelete(updatedTemplate.id);
                    }
                  }}
                >
                  <Trash className="h-4 w-4 text-red-500" />
                </Button>
              )}
            </div>
          )}
        </TableCell>
      </TableRow>

      {/* Fila secundaria para mostrar/editar costos adicionales */}
      {(isEditing || hasCostsToDisplay) && (
        <TableRow className={isEditing ? "bg-slate-50" : ""}>
          <TableCell colSpan={5} className="py-2">
            {isEditing ? (
              <div className="space-y-3 p-2">
                <h4 className="text-sm font-medium">Costos adicionales</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Costo de Plataformas ($)</label>
                    <Input 
                      type="number"
                      min="0"
                      step="0.01"
                      value={editPlatformCost}
                      onChange={(e) => { const v = parseFloat(e.target.value); setEditPlatformCost(!isNaN(v) ? v : 0); }}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Porcentaje de Desvío (%)</label>
                    <Input 
                      type="number"
                      min="0"
                      max="100"
                      value={editDeviationPercentage}
                      onChange={(e) => { const v = parseFloat(e.target.value); setEditDeviationPercentage(!isNaN(v) ? v : 0); }}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>
            ) : hasCostsToDisplay ? (
              <div className="text-sm space-y-1 py-1">
                {(updatedTemplate.platformCost || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Costo de Plataformas:</span>
                    <span className="font-medium">${(updatedTemplate.platformCost || 0).toFixed(2)} USD</span>
                  </div>
                )}
                {(updatedTemplate.deviationPercentage || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Porcentaje de Desvío:</span>
                    <span className="font-medium">{updatedTemplate.deviationPercentage || 0}%</span>
                  </div>
                )}
              </div>
            ) : null}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}