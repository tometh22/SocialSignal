import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  HeartPulse, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Calendar
} from "lucide-react";

interface ProjectHealthIndicatorsProps {
  project: any;
  subprojects?: any[];
}

export function ProjectHealthIndicators({ project, subprojects = [] }: ProjectHealthIndicatorsProps) {
  // Estado para los indicadores de salud
  const [healthMetrics, setHealthMetrics] = useState({
    budgetHealth: 100, // 0-100, donde 100 es perfecto
    scheduleHealth: 100, // 0-100, donde 100 es perfecto
    qualityHealth: 100, // 0-100, donde 100 es perfecto
    overall: 100, // Promedio ponderado
    alerts: 0, // Número de alertas activas
    warnings: 0, // Número de advertencias
  });
  
  const [statusCounts, setStatusCounts] = useState({
    active: 0,
    onHold: 0,
    completed: 0,
    cancelled: 0,
    delayed: 0, // Subproyectos con retraso en cronograma
  });
  
  // Obtener datos de costos para todos los proyectos
  const { data: costsData = {} } = useQuery<Record<number, any>>({
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
  
  // Obtener entregas para evaluar la calidad
  const { data: deliverables = [] } = useQuery<any[]>({
    queryKey: ['/api/modo/deliverables', project?.id],
    queryFn: async () => {
      if (!project?.id) return [];
      
      const response = await fetch(`/api/modo/deliverables/project/${project.id}`);
      if (!response.ok) return [];
      
      const data = await response.json();
      return Array.isArray(data) ? data : [data];
    },
    enabled: !!project?.id,
  });
  
  // Calcular indicadores de salud basados en los datos disponibles
  useEffect(() => {
    if (!project) return;
    
    // Procesamiento de subproyectos
    const subprojectStatuses = {
      active: 0,
      onHold: 0,
      completed: 0,
      cancelled: 0,
      delayed: 0,
    };
    
    (subprojects || []).forEach(sub => {
      // Contar por estado
      if (sub.status === 'active') subprojectStatuses.active++;
      else if (sub.status === 'on-hold') subprojectStatuses.onHold++;
      else if (sub.status === 'completed') subprojectStatuses.completed++;
      else if (sub.status === 'cancelled') subprojectStatuses.cancelled++;
      
      // Verificar retraso
      const costData = costsData[sub.id];
      if (costData && costData.percentageUsed > 90 && sub.status === 'active') {
        subprojectStatuses.delayed++;
      }
    });
    
    setStatusCounts(subprojectStatuses);
    
    // Calcular salud del presupuesto
    let budgetHealthScore = 100;
    const monthlyBudget = project.macroMonthlyBudget || 4200;
    const totalActualCost = Object.values(costsData).reduce(
      (sum: number, data: any) => sum + (data?.actualCost || 0), 
      0
    );
    
    const budgetUsagePercent = (totalActualCost / monthlyBudget) * 100;
    
    if (budgetUsagePercent > 100) {
      // Sobre el presupuesto
      budgetHealthScore = Math.max(0, 100 - (budgetUsagePercent - 100) * 2);
    } else if (budgetUsagePercent > 80) {
      // Cerca del límite
      budgetHealthScore = 100 - ((budgetUsagePercent - 80) * 4);
    }
    
    // Calcular salud del cronograma
    let scheduleHealthScore = 100;
    const delayedPercentage = subprojects.length > 0 
      ? (subprojectStatuses.delayed / subprojects.length) * 100 
      : 0;
    
    if (delayedPercentage > 0) {
      scheduleHealthScore = Math.max(0, 100 - delayedPercentage * 2);
    }
    
    // Calcular salud de calidad basada en entregables MODO
    let qualityHealthScore = 100;
    if (deliverables && deliverables.length > 0) {
      const deliverable = deliverables[0]; // Usar el primer entregable encontrado
      if (deliverable) {
        const robustness = deliverable.robustness_score || 5;
        const quality = deliverable.quality_score || 5;
        const narrative = deliverable.narrative_score || 5;
        
        // Calcular score de calidad basado en los indicadores MODO (escala 1-5)
        const maxPossible = 15; // 5+5+5
        const actual = robustness + quality + narrative;
        qualityHealthScore = (actual / maxPossible) * 100;
      }
    }
    
    // Calcular puntaje general y alertas
    const overallHealth = (budgetHealthScore * 0.4) + (scheduleHealthScore * 0.4) + (qualityHealthScore * 0.2);
    
    let alerts = 0;
    let warnings = 0;
    
    if (budgetHealthScore < 50) alerts++;
    else if (budgetHealthScore < 80) warnings++;
    
    if (scheduleHealthScore < 50) alerts++;
    else if (scheduleHealthScore < 80) warnings++;
    
    if (qualityHealthScore < 50) alerts++;
    else if (qualityHealthScore < 80) warnings++;
    
    // Actualizar estado
    setHealthMetrics({
      budgetHealth: Math.round(budgetHealthScore),
      scheduleHealth: Math.round(scheduleHealthScore),
      qualityHealth: Math.round(qualityHealthScore),
      overall: Math.round(overallHealth),
      alerts,
      warnings
    });
  }, [project, subprojects, costsData, deliverables]);
  
  if (!project?.isAlwaysOnMacro && project?.id !== 16) return null;
  
  // Función para obtener color según el valor de salud
  const getHealthColor = (value: number) => {
    if (value >= 80) return "text-green-500";
    if (value >= 60) return "text-yellow-500";
    if (value >= 40) return "text-orange-500";
    return "text-red-500";
  };
  
  return (
    <Card className="border-blue-100 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center">
          <HeartPulse className="h-5 w-5 mr-1 text-blue-600" />
          Salud del Proyecto Macro
        </CardTitle>
        <CardDescription>
          Indicadores clave para evaluar el estado general del proyecto Always-On
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Indicador principal */}
        <div className="text-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative inline-block">
                  <div className={`text-4xl font-bold mb-2 ${getHealthColor(healthMetrics.overall)}`}>
                    {healthMetrics.overall}%
                  </div>
                  <div className="text-sm text-gray-500">Salud General</div>
                  
                  {healthMetrics.alerts > 0 && (
                    <Badge className="absolute -top-2 -right-2 bg-red-500">
                      {healthMetrics.alerts}
                    </Badge>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Evaluación general basada en presupuesto (40%), cronograma (40%) y calidad (20%)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        {/* Indicadores específicos */}
        <div className="grid grid-cols-3 gap-4">
          <div className="border rounded-md p-3 text-center">
            <div className="text-sm font-medium mb-1">Presupuesto</div>
            <div className={`text-xl font-bold ${getHealthColor(healthMetrics.budgetHealth)}`}>
              {healthMetrics.budgetHealth}%
            </div>
            <Progress 
              value={healthMetrics.budgetHealth} 
              className="h-1.5 mt-2"
              indicatorClassName={healthMetrics.budgetHealth >= 80 ? "bg-green-500" : 
                                 healthMetrics.budgetHealth >= 60 ? "bg-yellow-500" : 
                                 healthMetrics.budgetHealth >= 40 ? "bg-orange-500" : "bg-red-500"}
            />
          </div>
          
          <div className="border rounded-md p-3 text-center">
            <div className="text-sm font-medium mb-1">Cronograma</div>
            <div className={`text-xl font-bold ${getHealthColor(healthMetrics.scheduleHealth)}`}>
              {healthMetrics.scheduleHealth}%
            </div>
            <Progress 
              value={healthMetrics.scheduleHealth} 
              className="h-1.5 mt-2"
              indicatorClassName={healthMetrics.scheduleHealth >= 80 ? "bg-green-500" : 
                                 healthMetrics.scheduleHealth >= 60 ? "bg-yellow-500" : 
                                 healthMetrics.scheduleHealth >= 40 ? "bg-orange-500" : "bg-red-500"}
            />
          </div>
          
          <div className="border rounded-md p-3 text-center">
            <div className="text-sm font-medium mb-1">Calidad</div>
            <div className={`text-xl font-bold ${getHealthColor(healthMetrics.qualityHealth)}`}>
              {healthMetrics.qualityHealth}%
            </div>
            <Progress 
              value={healthMetrics.qualityHealth} 
              className="h-1.5 mt-2"
              indicatorClassName={healthMetrics.qualityHealth >= 80 ? "bg-green-500" : 
                                 healthMetrics.qualityHealth >= 60 ? "bg-yellow-500" : 
                                 healthMetrics.qualityHealth >= 40 ? "bg-orange-500" : "bg-red-500"}
            />
          </div>
        </div>
        
        {/* Estado de subproyectos */}
        <div className="border rounded-md p-4">
          <h3 className="text-sm font-medium mb-3">Resumen de Subproyectos</h3>
          
          <div className="grid grid-cols-5 gap-2">
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-green-100 text-green-600 mb-1">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="text-xs font-medium">Activos</div>
              <div className="text-sm font-bold">{statusCounts.active}</div>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-yellow-100 text-yellow-600 mb-1">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="text-xs font-medium">En Pausa</div>
              <div className="text-sm font-bold">{statusCounts.onHold}</div>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-100 text-blue-600 mb-1">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="text-xs font-medium">Completados</div>
              <div className="text-sm font-bold">{statusCounts.completed}</div>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-red-100 text-red-600 mb-1">
                <XCircle className="h-5 w-5" />
              </div>
              <div className="text-xs font-medium">Cancelados</div>
              <div className="text-sm font-bold">{statusCounts.cancelled}</div>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-orange-100 text-orange-600 mb-1">
                <Clock className="h-5 w-5" />
              </div>
              <div className="text-xs font-medium">Con Retraso</div>
              <div className="text-sm font-bold">{statusCounts.delayed}</div>
            </div>
          </div>
        </div>
        
        {/* Alertas */}
        {(healthMetrics.alerts > 0 || healthMetrics.warnings > 0) && (
          <div>
            <h3 className="text-sm font-medium mb-2">Alertas y Advertencias</h3>
            
            <div className="space-y-2">
              {healthMetrics.budgetHealth < 50 && (
                <div className="flex items-start p-2 bg-red-50 border border-red-200 rounded-md text-red-800">
                  <AlertTriangle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium">Alerta de Presupuesto</p>
                    <p className="text-xs">El proyecto está significativamente sobre el presupuesto mensual.</p>
                  </div>
                </div>
              )}
              
              {healthMetrics.budgetHealth >= 50 && healthMetrics.budgetHealth < 80 && (
                <div className="flex items-start p-2 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800">
                  <AlertTriangle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium">Advertencia de Presupuesto</p>
                    <p className="text-xs">El proyecto se acerca al límite del presupuesto mensual.</p>
                  </div>
                </div>
              )}
              
              {healthMetrics.scheduleHealth < 50 && (
                <div className="flex items-start p-2 bg-red-50 border border-red-200 rounded-md text-red-800">
                  <Clock className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium">Alerta de Cronograma</p>
                    <p className="text-xs">Hay retrasos significativos en varios subproyectos.</p>
                  </div>
                </div>
              )}
              
              {healthMetrics.scheduleHealth >= 50 && healthMetrics.scheduleHealth < 80 && (
                <div className="flex items-start p-2 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800">
                  <Clock className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium">Advertencia de Cronograma</p>
                    <p className="text-xs">Algunos subproyectos están mostrando signos de retraso.</p>
                  </div>
                </div>
              )}
              
              {healthMetrics.qualityHealth < 50 && (
                <div className="flex items-start p-2 bg-red-50 border border-red-200 rounded-md text-red-800">
                  <AlertTriangle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium">Alerta de Calidad</p>
                    <p className="text-xs">Los indicadores de robustez están significativamente por debajo del objetivo.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}