import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Edit, Save, X, Check, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { invalidateCostMultipliersCache, loadCostMultipliers } from "@/lib/calculation";

interface CostMultiplier {
  id: number;
  category: string;
  subcategory: string;
  multiplier: number;
  label: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function CostMultipliersManager() {
  const [editingMultiplier, setEditingMultiplier] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [updatingMultipliers, setUpdatingMultipliers] = useState<Set<number>>(new Set());
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: multipliers = [], isLoading } = useQuery<CostMultiplier[]>({
    queryKey: ["/api/cost-multipliers"],
  });

  const updateMultiplierMutation = useMutation({
    mutationFn: async ({ id, multiplier }: { id: number; multiplier: number }) => {
      return apiRequest(`/api/cost-multipliers/${id}`, "PATCH", { multiplier });
    },
    onMutate: async ({ id, multiplier }) => {
      // Marcar como actualizando
      setUpdatingMultipliers(prev => {
        const newSet = new Set(prev);
        newSet.add(id);
        return newSet;
      });
      
      // Cancelar queries en progreso
      await queryClient.cancelQueries({ queryKey: ["/api/cost-multipliers"] });
      
      // Obtener datos anteriores
      const previousMultipliers = queryClient.getQueryData(["/api/cost-multipliers"]) as CostMultiplier[];
      
      // Actualización optimista
      const newMultipliers = previousMultipliers.map(m => 
        m.id === id ? { ...m, multiplier, updatedAt: new Date().toISOString() } : m
      );
      
      queryClient.setQueryData(["/api/cost-multipliers"], newMultipliers);
      
      return { previousMultipliers };
    },
    onSuccess: (data, { id }) => {
      // Invalidar caché de multiplicadores para que el cotizador use los nuevos valores
      invalidateCostMultipliersCache();
      
      // Remover de actualizando después de 500ms para mostrar animación
      setTimeout(() => {
        setUpdatingMultipliers(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      }, 500);
      
      setEditingMultiplier(null);
      setEditingValue("");
      
      toast({
        title: "Actualizado",
        description: "Multiplicador actualizado. Las cotizaciones usarán el nuevo valor.",
      });
    },
    onError: (err, { id }, context) => {
      // Restaurar datos anteriores
      if (context?.previousMultipliers) {
        queryClient.setQueryData(["/api/cost-multipliers"], context.previousMultipliers);
      }
      
      // Remover de actualizando
      setUpdatingMultipliers(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      
      toast({
        title: "Error",
        description: "No se pudo actualizar el multiplicador.",
        variant: "destructive",
      });
    },
  });

  const getCategoryDisplayName = (category: string) => {
    const categoryNames: Record<string, string> = {
      complexity: "Complejidad",
      mentions_volume: "Volumen de Menciones",
      countries: "Países Cubiertos",
      urgency: "Urgencia",
      project_type: "Tipo de Proyecto"
    };
    return categoryNames[category] || category;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      complexity: "bg-blue-100 text-blue-800",
      mentions_volume: "bg-green-100 text-green-800",
      countries: "bg-purple-100 text-purple-800",
      urgency: "bg-red-100 text-red-800",
      project_type: "bg-orange-100 text-orange-800"
    };
    return colors[category] || "bg-gray-100 text-gray-800";
  };

  const handleEditClick = (multiplier: CostMultiplier) => {
    setEditingMultiplier(multiplier.id);
    setEditingValue(multiplier.multiplier.toString());
  };

  const handleSaveClick = () => {
    if (editingMultiplier && editingValue) {
      const numericValue = parseFloat(editingValue);
      if (isNaN(numericValue) || numericValue <= 0) {
        toast({
          title: "Error",
          description: "El multiplicador debe ser un número positivo.",
          variant: "destructive",
        });
        return;
      }
      
      updateMultiplierMutation.mutate({ 
        id: editingMultiplier, 
        multiplier: numericValue 
      });
    }
  };

  const handleCancelClick = () => {
    setEditingMultiplier(null);
    setEditingValue("");
  };

  const groupedMultipliers = multipliers.reduce((acc, multiplier) => {
    if (!acc[multiplier.category]) {
      acc[multiplier.category] = [];
    }
    acc[multiplier.category].push(multiplier);
    return acc;
  }, {} as Record<string, CostMultiplier[]>);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="text-gray-500 text-sm">Cargando multiplicadores...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedMultipliers).map(([category, categoryMultipliers]) => (
        <div key={category} className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge className={`${getCategoryColor(category)} font-medium px-3 py-1`}>
              {getCategoryDisplayName(category)}
            </Badge>
            <span className="text-sm text-gray-500">
              {categoryMultipliers.length} multiplicadores
            </span>
          </div>
          
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/3">Opción</TableHead>
                  <TableHead className="w-1/6 text-center">Multiplicador</TableHead>
                  <TableHead className="w-1/3">Descripción</TableHead>
                  <TableHead className="w-1/6 text-center">Estado</TableHead>
                  <TableHead className="w-20 text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryMultipliers.map((multiplier) => {
                  const isEditing = editingMultiplier === multiplier.id;
                  const isUpdating = updatingMultipliers.has(multiplier.id);
                  
                  return (
                    <TableRow 
                      key={multiplier.id}
                      className={`transition-all duration-500 ${
                        isUpdating ? 'bg-green-50 border-green-200' : ''
                      }`}
                    >
                      <TableCell className="font-medium">
                        {multiplier.label}
                      </TableCell>
                      <TableCell className="text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-2">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              className="w-20 text-center"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveClick();
                                if (e.key === "Escape") handleCancelClick();
                              }}
                            />
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleSaveClick}
                                disabled={updateMultiplierMutation.isPending}
                                className="h-7 w-7 p-0"
                              >
                                <Save className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleCancelClick}
                                className="h-7 w-7 p-0"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <span className={`font-mono text-sm px-2 py-1 rounded ${
                              isUpdating ? 'bg-green-100 text-green-800' : 'bg-gray-100'
                            }`}>
                              {multiplier.multiplier}x
                              {multiplier.multiplier !== 1 && (
                                <span className="text-xs text-gray-500 ml-1">
                                  ({multiplier.multiplier > 1 ? '+' : ''}{((multiplier.multiplier - 1) * 100).toFixed(0)}%)
                                </span>
                              )}
                            </span>
                            {isUpdating && (
                              <Check className="h-4 w-4 text-green-600 animate-pulse" />
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {multiplier.description || "Sin descripción"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={multiplier.isActive ? "default" : "secondary"}>
                          {multiplier.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {!isEditing && !isUpdating && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditClick(multiplier)}
                            className="h-7 w-7 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
      
      {multipliers.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay multiplicadores configurados</h3>
          <p className="text-gray-600">Los multiplicadores de costos son necesarios para el sistema de cotización.</p>
        </div>
      )}
    </div>
  );
}