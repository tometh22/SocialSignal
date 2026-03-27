import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { 
  Save, 
  BarChart2, 
  AlertCircle, 
  DollarSign, 
  RefreshCw,
  PercentIcon 
} from 'lucide-react';

interface BudgetAllocationToolProps {
  project: any;
  subprojects?: any[];
}

export function BudgetAllocationTool({ project, subprojects = [] }: BudgetAllocationToolProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const monthlyBudget = project?.macroMonthlyBudget || 4200;
  const [allocations, setAllocations] = useState<any[]>([]);
  const [unallocatedAmount, setUnallocatedAmount] = useState(monthlyBudget);
  const [isModified, setIsModified] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  // Obtener subproyectos asociados si no fueron proporcionados
  const { data: fetchedSubprojects = [], isLoading: isLoadingSubprojects } = useQuery({
    queryKey: ['/api/active-projects/parent', project?.id],
    queryFn: async () => {
      if (!project?.id) return [];
      const response = await fetch(`/api/active-projects/parent/${project.id}`);
      if (!response.ok) throw new Error('Error al obtener subproyectos');
      return response.json();
    },
    enabled: !!project?.id && project?.isAlwaysOnMacro && (!subprojects || subprojects.length === 0)
  });
  
  // Combinar subproyectos proporcionados o recuperados
  const effectiveSubprojects = subprojects?.length > 0 ? subprojects : fetchedSubprojects;
  
  // Obtener información de costos para cada subproyecto
  const { data: costSummaries = {}, isLoading: isLoadingCosts } = useQuery({
    queryKey: ['/api/projects/costs', project?.id, effectiveSubprojects],
    queryFn: async () => {
      if (!project?.id || effectiveSubprojects.length === 0) return {};
      
      const projectIds = [project.id, ...effectiveSubprojects.map((p: any) => p.id)];
      const summaries: Record<number, any> = {};
      
      await Promise.all(
        projectIds.map(async (id) => {
          try {
            const response = await fetch(`/api/projects/${id}/cost-summary`);
            if (response.ok) {
              summaries[id] = await response.json();
            }
          } catch (error) {
            console.error(`Error al obtener costos para el proyecto ${id}:`, error);
          }
        })
      );
      
      return summaries;
    },
    enabled: !!project?.id && effectiveSubprojects.length > 0
  });

  // Mutación para guardar asignaciones de presupuesto
  const saveBudgetAllocationMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/projects/budget-allocations`, { credentials: 'include',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al guardar asignaciones de presupuesto');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects/costs', project?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/active-projects', project?.id] });
      setIsModified(false);
      setShowConfirmation(true);
      
      toast({
        title: 'Presupuesto asignado',
        description: 'La distribución del presupuesto ha sido guardada exitosamente.',
        variant: 'success',
      });
      
      // Ocultar mensaje de confirmación después de 3 segundos
      setTimeout(() => setShowConfirmation(false), 3000);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Ocurrió un error al guardar las asignaciones de presupuesto.',
        variant: 'destructive',
      });
    }
  });

  // Inicializar asignaciones basadas en subproyectos
  useEffect(() => {
    if (effectiveSubprojects.length > 0 && !isLoadingCosts) {
      const currentAllocations = effectiveSubprojects.map((subproject: any) => {
        const cost = costSummaries[subproject.id]?.estimatedCost || 0;
        const actualCost = costSummaries[subproject.id]?.actualCost || 0;
        
        return {
          id: subproject.id,
          name: subproject.quotation?.projectName || `Subproyecto ${subproject.id}`,
          currentBudget: cost,
          newBudget: cost, // Inicialmente igual al presupuesto actual
          actualCost,
          percentUsed: cost > 0 ? (actualCost / cost) * 100 : 0,
          color: getRandomColor(subproject.id)
        };
      });
      
      setAllocations(currentAllocations);
      
      // Calcular monto sin asignar
      const totalAllocated = currentAllocations.reduce((sum, item) => sum + item.newBudget, 0);
      setUnallocatedAmount(Math.max(0, monthlyBudget - totalAllocated));
    }
  }, [effectiveSubprojects, costSummaries, isLoadingCosts, monthlyBudget]);

  // Funciones auxiliares
  function getRandomColor(id: number) {
    const colors = [
      '#0088FE', '#00C49F', '#FFBB28', '#FF8042', 
      '#8884D8', '#82CA9D', '#A4DE6C', '#D0ED57', 
      '#FFC658', '#8DD1E1', '#83A6ED', '#8884D8'
    ];
    return colors[id % colors.length];
  }

  function handleAllocationChange(id: number, newValue: number) {
    const updated = allocations.map(item => {
      if (item.id === id) {
        return { ...item, newBudget: newValue };
      }
      return item;
    });
    
    setAllocations(updated);
    setIsModified(true);
    
    // Recalcular monto sin asignar
    const totalAllocated = updated.reduce((sum, item) => sum + item.newBudget, 0);
    setUnallocatedAmount(Math.max(0, monthlyBudget - totalAllocated));
  }
  
  function handlePercentageChange(id: number, percentage: number) {
    const amount = (percentage / 100) * monthlyBudget;
    handleAllocationChange(id, Math.round(amount));
  }
  
  function handleResetAllocations() {
    // Restablecer a los valores originales (estimatedCost)
    const reset = allocations.map(item => {
      const original = costSummaries[item.id]?.estimatedCost || 0;
      return { ...item, newBudget: original };
    });
    
    setAllocations(reset);
    
    // Recalcular monto sin asignar
    const totalAllocated = reset.reduce((sum, item) => sum + item.newBudget, 0);
    setUnallocatedAmount(Math.max(0, monthlyBudget - totalAllocated));
    
    setIsModified(true);
  }
  
  function handleEqualDistribution() {
    // Distribuir el presupuesto en partes iguales
    const equalAmount = Math.floor(monthlyBudget / allocations.length);
    const equal = allocations.map(item => ({ ...item, newBudget: equalAmount }));
    
    setAllocations(equal);
    
    // Ajustar el monto sin asignar (puede haber un pequeño remanente debido al redondeo)
    const totalAllocated = equal.reduce((sum, item) => sum + item.newBudget, 0);
    setUnallocatedAmount(Math.max(0, monthlyBudget - totalAllocated));
    
    setIsModified(true);
  }
  
  async function handleSaveAllocations() {
    const data = {
      macroProjectId: project.id,
      allocations: allocations.map(item => ({
        projectId: item.id,
        amount: item.newBudget
      }))
    };
    
    saveBudgetAllocationMutation.mutate(data);
  }

  const isOverBudget = unallocatedAmount < 0;
  const totalAllocated = monthlyBudget - unallocatedAmount;
  const pieData = allocations.map(item => ({
    name: item.name,
    value: item.newBudget,
    color: item.color
  }));
  
  if (isLoadingSubprojects || isLoadingCosts) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-pulse text-gray-400">Cargando datos de presupuesto...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Panel de información general */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center">
            <BarChart2 className="mr-2 h-5 w-5 text-blue-600" />
            Asignación de Presupuesto Mensual
          </CardTitle>
          <CardDescription>
            Distribuya el presupuesto mensual de ${monthlyBudget.toLocaleString()} entre los {allocations.length} subproyectos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="col-span-1 md:col-span-2">
              <div className="rounded-lg border p-4 bg-blue-50 border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-blue-700">Presupuesto Mensual Total</div>
                  <div className="text-xl font-bold text-blue-700">${monthlyBudget.toLocaleString()}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-blue-700">Asignado a Subproyectos</div>
                  <div className="text-xl font-bold text-blue-700">${totalAllocated.toLocaleString()}</div>
                </div>
                <Separator className="my-3 bg-blue-200" />
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-blue-700">
                    {isOverBudget ? 'Excedente de Presupuesto' : 'Presupuesto Sin Asignar'}
                  </div>
                  <div className={`text-xl font-bold ${isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                    ${Math.abs(unallocatedAmount).toLocaleString()}
                    {isOverBudget && <span className="ml-1 text-sm">(Exceso)</span>}
                  </div>
                </div>
                
                {isOverBudget && (
                  <div className="mt-3 flex items-start text-xs text-red-700 bg-red-50 p-2 rounded-md border border-red-200">
                    <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0 mt-0.5" />
                    <div>
                      La suma de los presupuestos asignados excede el presupuesto mensual total por ${Math.abs(unallocatedAmount).toLocaleString()}.
                      Ajuste las asignaciones antes de guardar.
                    </div>
                  </div>
                )}
                
                {showConfirmation && (
                  <div className="mt-3 flex items-start text-xs text-green-700 bg-green-50 p-2 rounded-md border border-green-200">
                    <div className="flex items-center">
                      <DollarSign className="h-4 w-4 mr-1" />
                      Asignación de presupuesto guardada con éxito
                    </div>
                  </div>
                )}
              </div>
              
              <div className="mt-4 flex space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleResetAllocations}
                  className="text-xs"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Restablecer Valores
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleEqualDistribution}
                  className="text-xs"
                >
                  <PercentIcon className="h-3 w-3 mr-1" />
                  Distribuir Equitativamente
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleSaveAllocations}
                  disabled={isOverBudget || saveBudgetAllocationMutation.isPending || !isModified}
                  className="text-xs ml-auto"
                >
                  <Save className="h-3 w-3 mr-1" />
                  Guardar Asignación
                </Button>
              </div>
            </div>
            
            <div className="rounded-lg border p-4 h-[220px]">
              <div className="text-sm font-medium mb-2 text-center">Distribución de Presupuesto</div>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    fill="#8884d8"
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Presupuesto']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Lista de asignaciones por subproyecto */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Asignación por Subproyecto</CardTitle>
          <CardDescription>
            Ajuste el presupuesto para cada subproyecto utilizando los controles deslizantes o ingresando valores directos
          </CardDescription>
        </CardHeader>
        <CardContent className="max-h-[450px] overflow-y-auto">
          <div className="space-y-6">
            {allocations.map((item) => {
              const percentOfTotal = (item.newBudget / monthlyBudget) * 100;
              const isExceedingBudget = item.actualCost > item.newBudget;
              
              return (
                <div key={item.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-medium">{item.name}</h4>
                      <p className="text-xs text-muted-foreground">ID: {item.id}</p>
                    </div>
                    <Badge
                      variant="outline"
                      style={{ backgroundColor: `${item.color}20`, borderColor: item.color, color: item.color }}
                    >
                      {percentOfTotal.toFixed(1)}% del presupuesto
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-12 gap-4 items-center mb-3">
                    <div className="col-span-3 text-sm">
                      <div className="text-xs text-muted-foreground mb-1">Presupuesto actual</div>
                      <div className="font-medium">${item.currentBudget.toLocaleString()}</div>
                    </div>
                    
                    <div className="col-span-3 text-sm">
                      <div className="text-xs text-muted-foreground mb-1">Gasto actual</div>
                      <div className={`font-medium ${isExceedingBudget ? 'text-red-500' : ''}`}>
                        ${item.actualCost.toLocaleString()}
                        {isExceedingBudget && <span className="ml-1 text-xs">(!)</span>}
                      </div>
                    </div>
                    
                    <div className="col-span-6 text-sm">
                      <div className="text-xs text-muted-foreground mb-1">Nuevo presupuesto</div>
                      <div className="font-medium flex items-center">
                        <span className="text-primary mr-2">${item.newBudget.toLocaleString()}</span>
                        <Input
                          type="number"
                          min="0"
                          max={monthlyBudget}
                          value={item.newBudget}
                          onChange={(e) => handleAllocationChange(item.id, parseInt(e.target.value) || 0)}
                          className="w-24 h-7 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                  </div>
                  
                  <Slider
                    defaultValue={[percentOfTotal]}
                    max={100}
                    step={1}
                    value={[percentOfTotal]}
                    onValueChange={(value) => handlePercentageChange(item.id, value[0])}
                    className="mb-4"
                  />
                  
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center text-muted-foreground">
                      <span>Presupuesto Mensual: ${monthlyBudget.toLocaleString()}</span>
                    </div>
                    <div 
                      className={`flex items-center ${
                        item.newBudget < item.actualCost ? 'text-red-500' : 'text-muted-foreground'
                      }`}
                    >
                      {item.newBudget < item.actualCost && (
                        <AlertCircle className="h-3 w-3 mr-1 text-red-500" />
                      )}
                      <span>
                        {item.newBudget < item.actualCost
                          ? 'El presupuesto es menor que el gasto actual'
                          : 'Presupuesto adecuado para el gasto actual'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {allocations.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No hay subproyectos disponibles para asignar presupuesto
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="border-t pt-4 text-xs text-muted-foreground">
          <div className="flex items-center">
            <DollarSign className="h-3 w-3 mr-1" />
            Los cambios en la asignación de presupuesto se aplicarán cuando guarde los cambios.
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}