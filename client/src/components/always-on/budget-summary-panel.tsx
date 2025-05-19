import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { InfoIcon, AlertTriangle, DollarSign, LineChart, BarChart4 } from "lucide-react";

interface BudgetSummaryPanelProps {
  project: any;
  showTitle?: boolean;
}

export function BudgetSummaryPanel({ project, showTitle = true }: BudgetSummaryPanelProps) {
  // Estado local
  const [subprojectsData, setSubprojectsData] = useState<any[]>([]);
  const [isOverBudget, setIsOverBudget] = useState(false);
  const [usagePercentage, setUsagePercentage] = useState(0);
  const [totalUsed, setTotalUsed] = useState(0);
  
  // Consulta para obtener subproyectos si no están ya incluidos en el proyecto
  const { data: subprojects = [] } = useQuery<any[]>({
    queryKey: ['/api/active-projects/subprojects', project?.id],
    queryFn: async () => {
      if (project?.subProjects && project.subProjects.length > 0) {
        return project.subProjects;
      }
      if (!project?.id) return [];
      
      const response = await fetch(`/api/active-projects/parent/${project.id}`);
      if (!response.ok) throw new Error('No se pudieron cargar los subproyectos');
      return await response.json();
    },
    enabled: !!project?.id && project?.isAlwaysOnMacro,
  });
  
  // Consultar costos para cada subproyecto
  const { data: costsData = {} } = useQuery<Record<number, any>>({
    queryKey: ['/api/projects/costs', project?.id],
    queryFn: async () => {
      const allProjects = [project?.id, ...(subprojects.map(p => p.id) || [])].filter(Boolean);
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
    enabled: !!project?.id && !!subprojects.length,
  });
  
  // Calcular datos combinados de subproyectos con sus costos
  useEffect(() => {
    if (!project || !subprojects) return;
    
    try {
      // Preparar datos combinados
      const combinedData = subprojects.map(subproject => {
        const costData = costsData[subproject.id] || { actualCost: 0, estimatedCost: 0, percentageUsed: 0 };
        return {
          ...subproject,
          costSummary: costData
        };
      });
      
      // Calcular totales
      const monthlyBudget = project.macroMonthlyBudget || 4200; // Valor por defecto si no hay presupuesto definido
      const totalActualCost = Object.values(costsData).reduce(
        (sum: number, data: any) => sum + (data?.actualCost || 0), 
        0
      );
      
      setSubprojectsData(combinedData);
      setTotalUsed(totalActualCost);
      setUsagePercentage(Math.min(100, (totalActualCost / monthlyBudget) * 100));
      setIsOverBudget(totalActualCost > monthlyBudget);
      
    } catch (error) {
      console.error("Error al procesar datos de presupuesto:", error);
    }
  }, [project, subprojects, costsData]);
  
  // Si no es un proyecto macro, no mostrar nada
  if (!project?.isAlwaysOnMacro && project?.id !== 16) return null;
  
  const monthlyBudget = project?.macroMonthlyBudget || 4200;
  
  return (
    <Card className="border-blue-100 shadow-sm">
      {showTitle && (
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center">
            <DollarSign className="h-5 w-5 mr-1 text-blue-600" />
            Presupuesto Mensual Consolidado
          </CardTitle>
          <CardDescription>
            Distribución del presupuesto mensual entre los subproyectos
          </CardDescription>
        </CardHeader>
      )}
      
      <CardContent>
        <div className="space-y-4">
          {/* Barra de progreso principal del presupuesto */}
          <div>
            <div className="flex justify-between mb-1">
              <div className="text-sm font-medium">
                Utilización del Presupuesto
              </div>
              <div className="text-sm font-medium">
                ${totalUsed.toFixed(2)} / ${monthlyBudget.toFixed(2)}
              </div>
            </div>
            
            <div className="relative pt-1">
              <Progress 
                value={usagePercentage} 
                className={`h-3 ${isOverBudget ? 'bg-red-100' : 'bg-blue-100'}`}
                indicatorClassName={isOverBudget ? 'bg-red-500' : usagePercentage > 80 ? 'bg-yellow-500' : 'bg-blue-500'}
              />
              
              {/* Marcador del 100% */}
              <div className="absolute top-1 right-0 h-3 border-r-2 border-gray-400 z-10"></div>
            </div>
            
            <div className="mt-1 flex justify-between text-xs text-gray-500">
              <div>{usagePercentage.toFixed(1)}% utilizado</div>
              <div>{(100 - usagePercentage).toFixed(1)}% disponible</div>
            </div>
          </div>
          
          {/* Alerta si está sobre el presupuesto */}
          {isOverBudget && (
            <Alert variant="destructive" className="mt-3">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Presupuesto excedido</AlertTitle>
              <AlertDescription>
                El costo actual (${totalUsed.toFixed(2)}) supera el presupuesto mensual establecido (${monthlyBudget.toFixed(2)}).
              </AlertDescription>
            </Alert>
          )}
          
          {/* Alerta si está cerca del límite */}
          {!isOverBudget && usagePercentage > 80 && (
            <Alert className="mt-3 border-yellow-200 bg-yellow-50 text-yellow-800">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Cerca del límite</AlertTitle>
              <AlertDescription>
                Se ha utilizado el {usagePercentage.toFixed(1)}% del presupuesto mensual. Considere revisar los costos.
              </AlertDescription>
            </Alert>
          )}
          
          {/* Lista de subproyectos con su consumo */}
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Distribución por Subproyecto</h4>
            
            {subprojectsData.length === 0 ? (
              <div className="text-center py-4 text-sm text-gray-500 border rounded-md">
                No hay subproyectos asociados a este proyecto macro.
              </div>
            ) : (
              <div className="space-y-3">
                {subprojectsData.map((subproject) => {
                  const cost = subproject.costSummary?.actualCost || 0;
                  const percentage = monthlyBudget > 0 ? (cost / monthlyBudget) * 100 : 0;
                  const isHighUsage = percentage > 50;
                  
                  return (
                    <div key={subproject.id} className="border rounded-md p-3">
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <h5 className="text-sm font-medium">{subproject.quotation?.projectName || `Subproyecto #${subproject.id}`}</h5>
                          <div className="text-xs text-gray-500 mt-0.5 flex items-center">
                            <Badge 
                              variant="outline" 
                              className={`mr-2 ${
                                subproject.status === 'active' ? 'bg-green-50 text-green-800 border-green-200' : 
                                subproject.status === 'on-hold' ? 'bg-yellow-50 text-yellow-800 border-yellow-200' :
                                'bg-gray-50 text-gray-800 border-gray-200'
                              }`}
                            >
                              {subproject.status}
                            </Badge>
                            <span>ID: {subproject.id}</span>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-sm font-medium">${cost.toFixed(2)}</div>
                          <div className={`text-xs ${
                            percentage > 80 ? 'text-red-600' : 
                            percentage > 50 ? 'text-yellow-600' : 
                            'text-gray-500'
                          }`}>
                            {percentage.toFixed(1)}% del total
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-2">
                        <Progress 
                          value={percentage} 
                          className="h-2 bg-gray-100"
                          indicatorClassName={
                            percentage > 80 ? 'bg-red-500' : 
                            percentage > 50 ? 'bg-yellow-500' : 
                            'bg-blue-500'
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between border-t pt-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center text-xs text-gray-500">
                <InfoIcon className="h-3.5 w-3.5 mr-1" />
                <span>Datos basados en costos acumulados</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Los datos mostrados reflejan los costos acumulados de cada proyecto en relación al presupuesto mensual establecido para el proyecto macro.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" className="text-xs">
            <BarChart4 className="h-3.5 w-3.5 mr-1" />
            Ver Tendencias
          </Button>
          <Button variant="outline" size="sm" className="text-xs">
            <LineChart className="h-3.5 w-3.5 mr-1" />
            Detalles
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}