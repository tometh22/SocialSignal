import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  DollarSign, 
  Save, 
  ArrowLeftRight, 
  BarChart4, 
  PieChart,
  RefreshCcw,
  AlertTriangle
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface BudgetAllocationToolProps {
  project: any;
  subprojects?: any[];
}

interface BudgetAllocation {
  projectId: number;
  projectName: string;
  currentAllocation: number;
  newAllocation: number;
  sliderValue: number;
  status: string;
}

export function BudgetAllocationTool({ project, subprojects = [] }: BudgetAllocationToolProps) {
  const { toast } = useToast();
  const [allocations, setAllocations] = useState<BudgetAllocation[]>([]);
  const [totalAllocated, setTotalAllocated] = useState(0);
  const [totalMonthlyBudget, setTotalMonthlyBudget] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isBalanced, setIsBalanced] = useState(true);
  
  // Obtener datos de costos actuales
  const { data: costsData = {}, isLoading: isLoadingCosts } = useQuery<Record<number, any>>({
    queryKey: ['/api/projects/costs', project?.id],
    queryFn: async () => {
      if (!project?.id) return {};
      
      const allProjects = [project.id, ...(subprojects?.map(p => p.id) || [])].filter(Boolean);
      if (allProjects.length === 0) return {};
      
      const result: Record<number, any> = {};
      await Promise.all(
        allProjects.map(async (projectId) => {
          try {
            const response = await fetch(`/api/projects/${projectId}/cost-summary`);
            if (response.ok) {
              result[projectId] = await response.json();
            }
          } catch (error) {
            console.error(`Error al obtener costos para proyecto ${projectId}:`, error);
          }
        })
      );
      
      return result;
    },
    enabled: !!project?.id,
  });
  
  // Mutación para guardar las asignaciones
  const updateAllocationsMutation = useMutation({
    mutationFn: async (data: { projectId: number, plannedBudget: number }[]) => {
      // En una implementación real, esto actualizaría la distribución de presupuesto en el servidor
      return Promise.all(
        data.map(allocation => 
          apiRequest(`/api/projects/${allocation.projectId}/budget`, "PATCH", { 
            plannedBudget: allocation.plannedBudget 
          })
        )
      );
    },
    onSuccess: () => {
      toast({
        title: "Distribución de presupuesto actualizada",
        description: "Los cambios se han guardado correctamente."
      });
      
      // Actualizar los datos en la UI
      queryClient.invalidateQueries({ queryKey: ['/api/projects/costs', project?.id] });
      setIsEditing(false);
    },
    onError: (error) => {
      console.error("Error al actualizar distribución de presupuesto:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la distribución del presupuesto. Intente nuevamente.",
        variant: "destructive"
      });
    },
  });
  
  // Inicializar las asignaciones de presupuesto
  useEffect(() => {
    if (!project || !subprojects || !costsData) return;
    
    const monthlyBudget = project.macroMonthlyBudget || 4200;
    setTotalMonthlyBudget(monthlyBudget);
    
    // Si no estamos en modo edición, obtener los datos actuales
    if (!isEditing) {
      // Preparar asignaciones iniciales basadas en los datos actuales
      const initialAllocations = subprojects.map(subproject => {
        const costData = costsData[subproject.id] || { 
          estimatedCost: 0, 
          actualCost: 0, 
          percentageUsed: 0 
        };
        
        // Se asume que estimatedCost es el presupuesto planificado
        const currentAllocation = costData.estimatedCost || 0;
        
        return {
          projectId: subproject.id,
          projectName: subproject.quotation?.projectName || `Subproyecto #${subproject.id}`,
          currentAllocation,
          newAllocation: currentAllocation,
          sliderValue: 0, // Se calculará después
          status: subproject.status
        };
      });
      
      // Calcular el total asignado actualmente
      const total = initialAllocations.reduce((sum, item) => sum + item.currentAllocation, 0);
      
      // Si no hay nada asignado, distribuir equitativamente
      if (total === 0 && initialAllocations.length > 0) {
        const equalShare = monthlyBudget / initialAllocations.length;
        initialAllocations.forEach(item => {
          item.currentAllocation = equalShare;
          item.newAllocation = equalShare;
        });
        setTotalAllocated(monthlyBudget);
      } else {
        setTotalAllocated(total);
      }
      
      // Calcular los valores del slider (0-100)
      initialAllocations.forEach(item => {
        if (total > 0) {
          item.sliderValue = (item.currentAllocation / total) * 100;
        } else {
          item.sliderValue = 100 / initialAllocations.length;
        }
      });
      
      setAllocations(initialAllocations);
    }
  }, [project, subprojects, costsData, isEditing]);
  
  // Manejar cambios en el valor del slider
  const handleSliderChange = (index: number, value: number[]) => {
    if (!isEditing) return;
    
    const newValue = value[0];
    const newAllocations = [...allocations];
    const oldValue = newAllocations[index].sliderValue;
    const diff = newValue - oldValue;
    
    // Actualizar el valor del slider para el proyecto seleccionado
    newAllocations[index].sliderValue = newValue;
    
    // Distribuir la diferencia entre los demás proyectos proporcionalmente
    const totalOtherValues = 100 - oldValue;
    if (totalOtherValues > 0) {
      const otherIndices = newAllocations.map((_, i) => i).filter(i => i !== index);
      
      // Ajustar proporcionalmente los otros valores
      otherIndices.forEach(i => {
        const proportion = newAllocations[i].sliderValue / totalOtherValues;
        newAllocations[i].sliderValue = Math.max(0, newAllocations[i].sliderValue - (diff * proportion));
      });
    }
    
    // Normalizar los valores para que sumen exactamente 100
    const currentSum = newAllocations.reduce((sum, item) => sum + item.sliderValue, 0);
    const factor = 100 / currentSum;
    newAllocations.forEach(item => {
      item.sliderValue = item.sliderValue * factor;
    });
    
    // Recalcular las asignaciones en dinero
    newAllocations.forEach(item => {
      item.newAllocation = (item.sliderValue / 100) * totalMonthlyBudget;
    });
    
    setAllocations(newAllocations);
    
    // Verificar si está balanceado
    const sum = newAllocations.reduce((total, item) => total + item.newAllocation, 0);
    setIsBalanced(Math.abs(sum - totalMonthlyBudget) < 0.01);
  };
  
  // Manejar cambios en el valor directo de asignación
  const handleDirectInputChange = (index: number, value: string) => {
    if (!isEditing) return;
    
    const numValue = parseFloat(value) || 0;
    const newAllocations = [...allocations];
    const oldAllocation = newAllocations[index].newAllocation;
    const diff = numValue - oldAllocation;
    
    // Actualizar la asignación para el proyecto seleccionado
    newAllocations[index].newAllocation = numValue;
    
    // Distribuir la diferencia entre los demás proyectos proporcionalmente
    const totalOtherAllocations = totalMonthlyBudget - oldAllocation;
    if (totalOtherAllocations > 0) {
      const otherIndices = newAllocations.map((_, i) => i).filter(i => i !== index);
      
      // Ajustar proporcionalmente los otros valores
      otherIndices.forEach(i => {
        const proportion = newAllocations[i].newAllocation / totalOtherAllocations;
        newAllocations[i].newAllocation = Math.max(0, newAllocations[i].newAllocation - (diff * proportion));
      });
    }
    
    // Recalcular los valores del slider
    newAllocations.forEach(item => {
      item.sliderValue = (item.newAllocation / totalMonthlyBudget) * 100;
    });
    
    setAllocations(newAllocations);
    
    // Verificar si está balanceado
    const sum = newAllocations.reduce((total, item) => total + item.newAllocation, 0);
    setIsBalanced(Math.abs(sum - totalMonthlyBudget) < 0.01);
  };
  
  // Distribuir equitativamente
  const distributeEvenly = () => {
    if (!isEditing || allocations.length === 0) return;
    
    const equalShare = totalMonthlyBudget / allocations.length;
    const newAllocations = allocations.map(item => ({
      ...item,
      newAllocation: equalShare,
      sliderValue: 100 / allocations.length
    }));
    
    setAllocations(newAllocations);
    setIsBalanced(true);
  };
  
  // Guardar cambios
  const saveChanges = () => {
    if (!isBalanced) {
      toast({
        title: "Error",
        description: "La distribución debe sumar exactamente el presupuesto mensual.",
        variant: "destructive"
      });
      return;
    }
    
    updateAllocationsMutation.mutate(
      allocations.map(item => ({
        projectId: item.projectId,
        plannedBudget: item.newAllocation
      }))
    );
  };
  
  if (!project?.isAlwaysOnMacro && project?.id !== 16) return null;
  
  return (
    <Card className="border-blue-100 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center">
          <ArrowLeftRight className="h-5 w-5 mr-1 text-blue-600" />
          Distribución de Presupuesto
        </CardTitle>
        <CardDescription>
          Asigne y ajuste el presupuesto mensual entre los diferentes subproyectos
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Presupuesto total */}
        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
          <div>
            <h3 className="text-sm font-medium">Presupuesto Mensual Total</h3>
            <p className="text-2xl font-bold text-blue-600">${totalMonthlyBudget.toFixed(2)}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-right">Asignado</h3>
            <p className={`text-2xl font-bold ${
              isBalanced ? 'text-green-600' : 'text-red-600'
            }`}>
              ${totalAllocated.toFixed(2)}
            </p>
          </div>
        </div>
        
        {/* Controles */}
        <div className="flex justify-between">
          <Button 
            variant={isEditing ? "default" : "outline"}
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? "Cancelar" : "Editar Distribución"}
          </Button>
          
          {isEditing && (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={distributeEvenly}
              >
                <RefreshCcw className="h-4 w-4 mr-1" />
                Distribuir Equitativamente
              </Button>
              <Button 
                variant="default" 
                size="sm"
                onClick={saveChanges}
                disabled={!isBalanced || updateAllocationsMutation.isPending}
              >
                <Save className="h-4 w-4 mr-1" />
                {updateAllocationsMutation.isPending ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          )}
        </div>
        
        {/* Advertencia si no está balanceado */}
        {isEditing && !isBalanced && (
          <div className="flex items-center p-2 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800 text-sm">
            <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
            La distribución actual no suma exactamente el presupuesto mensual total. 
            Ajuste los valores para continuar.
          </div>
        )}
        
        {/* Lista de asignaciones */}
        <div className="space-y-4 mt-2">
          {allocations.map((allocation, index) => (
            <div key={allocation.projectId} className="border rounded-md p-3">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <h4 className="text-sm font-medium">{allocation.projectName}</h4>
                  <div className="text-xs text-gray-500">
                    {allocation.status === 'active' && <span className="text-green-600">Activo</span>}
                    {allocation.status === 'on-hold' && <span className="text-yellow-600">En Pausa</span>}
                    {allocation.status === 'completed' && <span className="text-blue-600">Completado</span>}
                    {allocation.status === 'cancelled' && <span className="text-red-600">Cancelado</span>}
                  </div>
                </div>
                
                <div className="text-right">
                  {isEditing ? (
                    <div className="flex items-center">
                      <DollarSign className="h-4 w-4 text-gray-500" />
                      <Input
                        type="number"
                        value={allocation.newAllocation.toFixed(2)}
                        onChange={(e) => handleDirectInputChange(index, e.target.value)}
                        className="w-24 text-right"
                        step="100"
                        min="0"
                        max={totalMonthlyBudget.toString()}
                      />
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm font-medium">${allocation.currentAllocation.toFixed(2)}</div>
                      <div className="text-xs text-gray-500">
                        {((allocation.currentAllocation / totalMonthlyBudget) * 100).toFixed(1)}% del total
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {isEditing ? (
                <div className="pt-2">
                  <Slider
                    value={[allocation.sliderValue]}
                    onValueChange={(value) => handleSliderChange(index, value)}
                    max={100}
                    step={1}
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0%</span>
                    <span>{allocation.sliderValue.toFixed(1)}%</span>
                    <span>100%</span>
                  </div>
                </div>
              ) : (
                <Progress 
                  value={(allocation.currentAllocation / totalMonthlyBudget) * 100} 
                  className="h-2"
                />
              )}
            </div>
          ))}
          
          {allocations.length === 0 && (
            <div className="text-center py-6 text-gray-500">
              No hay subproyectos disponibles para asignar presupuesto.
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between border-t pt-4">
        <div className="text-xs text-gray-500">
          Los cambios en la distribución afectarán a los presupuestos planificados de cada subproyecto.
        </div>
        
        <div className="flex space-x-2">
          <Button variant="ghost" size="sm" className="text-xs">
            <PieChart className="h-3.5 w-3.5 mr-1" />
            Ver Porcentajes
          </Button>
          <Button variant="ghost" size="sm" className="text-xs">
            <BarChart4 className="h-3.5 w-3.5 mr-1" />
            Ver Historial
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}