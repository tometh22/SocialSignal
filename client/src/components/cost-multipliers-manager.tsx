import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Edit, Save, X, Check, AlertTriangle, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

// Schema de validación para crear multiplicadores
const createMultiplierSchema = z.object({
  category: z.string().min(1, "La categoría es requerida"),
  subcategory: z.string().min(1, "La subcategoría es requerida"),
  multiplier: z.number().min(0.1, "El multiplicador debe ser mayor a 0.1").max(10, "El multiplicador no puede ser mayor a 10"),
  label: z.string().min(1, "El nombre es requerido"),
  description: z.string().optional()
});

export function CostMultipliersManager() {
  const [editingMultiplier, setEditingMultiplier] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [updatingMultipliers, setUpdatingMultipliers] = useState<Set<number>>(new Set());
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form para crear multiplicadores
  const createForm = useForm<z.infer<typeof createMultiplierSchema>>({
    resolver: zodResolver(createMultiplierSchema),
    defaultValues: {
      category: "",
      subcategory: "",
      multiplier: 1,
      label: "",
      description: ""
    }
  });

  const { data: multipliers = [], isLoading } = useQuery<CostMultiplier[]>({
    queryKey: ["/api/cost-multipliers"],
  });

  // Mutación para crear multiplicadores
  const createMultiplierMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createMultiplierSchema>) => {
      return apiRequest("/api/cost-multipliers", "POST", data);
    },
    onSuccess: () => {
      // Invalidar caché de multiplicadores
      invalidateCostMultipliersCache();
      
      // Refrescar datos
      queryClient.invalidateQueries({ queryKey: ["/api/cost-multipliers"] });
      
      // Cerrar diálogo y limpiar form
      setCreateDialogOpen(false);
      createForm.reset();
      
      toast({
        title: "Multiplicador creado",
        description: "El nuevo multiplicador se ha agregado correctamente y está disponible en el cotizador.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear el multiplicador.",
        variant: "destructive",
      });
    },
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

  const handleCreateSubmit = (data: z.infer<typeof createMultiplierSchema>) => {
    createMultiplierMutation.mutate(data);
  };

  // Opciones de categorías disponibles
  const categoryOptions = [
    { value: "complexity", label: "Complejidad" },
    { value: "mentions_volume", label: "Volumen de Menciones" },
    { value: "countries", label: "Países Cubiertos" },
    { value: "urgency", label: "Urgencia" },
    { value: "project_type", label: "Tipo de Proyecto" },
  ];

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
      {/* Botón para agregar nuevo multiplicador */}
      <div className="flex justify-end">
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Añadir Multiplicador
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Multiplicador</DialogTitle>
              <DialogDescription>
                Agrega un nuevo multiplicador que estará disponible en el sistema de cotización.
              </DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoría</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona una categoría" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categoryOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="subcategory"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código Interno</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="ej. mega, premium, rush, etc." 
                            {...field} 
                          />
                        </FormControl>
                        <div className="text-xs text-muted-foreground">
                          Código único que identifica esta opción (sin espacios, solo letras y números)
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="label"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre (Etiqueta)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="ej. Análisis Premium" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="multiplier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Multiplicador</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.1"
                            max="10"
                            placeholder="1.25"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={createForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción (Opcional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe cuándo se usa este multiplicador..." 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setCreateDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMultiplierMutation.isPending}
                  >
                    {createMultiplierMutation.isPending ? "Creando..." : "Crear Multiplicador"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

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