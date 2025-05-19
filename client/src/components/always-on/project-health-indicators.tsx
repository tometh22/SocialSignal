import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Calendar,
  ThumbsUp,
  AlertTriangle,
  XCircle,
  Gauge,
  Zap,
  BarChart3
} from 'lucide-react';

interface ProjectHealthIndicatorsProps {
  project: any;
  subprojects?: any[];
}

interface HealthStatus {
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  label: string;
}

export function ProjectHealthIndicators({ project, subprojects = [] }: ProjectHealthIndicatorsProps) {
  // Estado para los indicadores de salud
  const [healthMetrics, setHealthMetrics] = useState({
    budgetHealth: 0, // 0-100, donde 100 es perfecto
    scheduleHealth: 0, // 0-100, donde 100 es perfecto
    qualityHealth: 0, // 0-100, donde 100 es perfecto
    resourceHealth: 0, // 0-100, donde 100 es perfecto
    clientSatisfaction: 0, // 0-100, donde 100 es perfecto
    overall: 0, // Promedio ponderado
    alerts: 0, // Número de alertas activas
    warnings: 0, // Número de advertencias
  });
  
  const [statusCounts, setStatusCounts] = useState({
    active: 0,
    onHold: 0,
    completed: 0,
    delayed: 0, // Subproyectos con retraso en cronograma
  });
  
  // Obtener datos de costos para todos los proyectos
  const { data: costsData = {}, isLoading: isLoadingCosts } = useQuery({
    queryKey: ['/api/projects/costs', project?.id, subprojects],
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
    enabled: !!project?.id && (subprojects?.length > 0 || true)
  });

  useEffect(() => {
    if (!isLoadingCosts && project && (subprojects?.length > 0 || true)) {
      // Cálculo de salud de presupuesto
      let totalBudget = project?.macroMonthlyBudget || 4200;
      let totalSpent = 0;
      
      const mainProjectCost = costsData[project.id]?.actualCost || 0;
      totalSpent += mainProjectCost;
      
      // Sumar costos de subproyectos
      if (subprojects?.length > 0) {
        subprojects.forEach(subproject => {
          const cost = costsData[subproject.id]?.actualCost || 0;
          totalSpent += cost;
        });
      }
      
      // Calcular porcentaje de presupuesto usado
      const budgetPercentUsed = (totalSpent / totalBudget) * 100;
      
      // Salud del presupuesto (inversamente proporcional al porcentaje usado)
      // 0-75% usado = 100% salud, 75-100% usado = degradación lineal de 100% a 0%
      const budgetHealth = budgetPercentUsed <= 75 
        ? 100 
        : Math.max(0, 100 - ((budgetPercentUsed - 75) * 4));
      
      // Calcular otros indicadores (simulados para demostración)
      // En una implementación real, estos datos vendrían de APIs específicas
      const scheduleHealth = calculateScheduleHealth(subprojects);
      const qualityHealth = calculateQualityHealth(subprojects);
      const resourceHealth = calculateResourceHealth(subprojects);
      const clientSatisfaction = calculateClientSatisfaction(subprojects);
      
      // Calcular la salud general ponderada
      const overall = calculateOverallHealth({
        budgetHealth,
        scheduleHealth,
        qualityHealth,
        resourceHealth,
        clientSatisfaction
      });
      
      // Contar alertas y advertencias
      const alerts = countAlerts({
        budgetHealth,
        scheduleHealth,
        qualityHealth,
        resourceHealth,
        clientSatisfaction
      });
      
      const warnings = countWarnings({
        budgetHealth,
        scheduleHealth,
        qualityHealth,
        resourceHealth,
        clientSatisfaction
      });
      
      // Actualizar estado
      setHealthMetrics({
        budgetHealth,
        scheduleHealth,
        qualityHealth,
        resourceHealth,
        clientSatisfaction,
        overall,
        alerts,
        warnings
      });
      
      // Actualizar conteo de estados de subproyectos
      const counts = {
        active: 0,
        onHold: 0,
        completed: 0,
        delayed: 0
      };
      
      if (subprojects?.length > 0) {
        subprojects.forEach(subproject => {
          const status = subproject.status?.toLowerCase() || 'active';
          
          if (status === 'active') counts.active++;
          else if (status === 'on hold' || status === 'paused') counts.onHold++;
          else if (status === 'completed') counts.completed++;
          
          // Calcular si está retrasado (simulado)
          if (status === 'active' && Math.random() > 0.7) {
            counts.delayed++;
          }
        });
      }
      
      setStatusCounts(counts);
    }
  }, [project, subprojects, costsData, isLoadingCosts]);

  // Funciones auxiliares para cálculos (simuladas para demostración)
  function calculateScheduleHealth(subprojects: any[]): number {
    // En una implementación real, esto analizaría fechas reales
    // Para demostración, generamos un valor entre 60-100
    return Math.floor(Math.random() * 40) + 60;
  }
  
  function calculateQualityHealth(subprojects: any[]): number {
    // Simulado: porcentaje de subproyectos con buena calidad
    return Math.floor(Math.random() * 25) + 75;
  }
  
  function calculateResourceHealth(subprojects: any[]): number {
    // Simulado: disponibilidad y asignación de recursos
    return Math.floor(Math.random() * 30) + 70;
  }
  
  function calculateClientSatisfaction(subprojects: any[]): number {
    // Simulado: satisfacción del cliente
    return Math.floor(Math.random() * 20) + 80;
  }
  
  function calculateOverallHealth(metrics: { 
    budgetHealth: number; 
    scheduleHealth: number; 
    qualityHealth: number;
    resourceHealth: number;
    clientSatisfaction: number;
  }): number {
    // Ponderación: presupuesto (30%), cronograma (25%), calidad (20%), recursos (15%), satisfacción (10%)
    return (
      metrics.budgetHealth * 0.3 +
      metrics.scheduleHealth * 0.25 +
      metrics.qualityHealth * 0.2 +
      metrics.resourceHealth * 0.15 +
      metrics.clientSatisfaction * 0.1
    );
  }
  
  function countAlerts(metrics: any): number {
    // Contar métricas críticas (menos de 50%)
    return Object.values(metrics).filter((value: any) => 
      typeof value === 'number' && value < 50
    ).length;
  }
  
  function countWarnings(metrics: any): number {
    // Contar métricas en advertencia (entre 50% y 75%)
    return Object.values(metrics).filter((value: any) => 
      typeof value === 'number' && value >= 50 && value < 75
    ).length;
  }

  // Función para determinar el estado de salud basado en un valor porcentual
  function getHealthStatus(value: number): HealthStatus {
    if (value >= 85) {
      return {
        icon: <CheckCircle2 className="h-5 w-5" />,
        color: 'text-green-600',
        bgColor: 'bg-green-50 border-green-200',
        label: 'Óptimo'
      };
    } else if (value >= 70) {
      return {
        icon: <ThumbsUp className="h-5 w-5" />,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50 border-blue-200',
        label: 'Bueno'
      };
    } else if (value >= 50) {
      return {
        icon: <AlertTriangle className="h-5 w-5" />,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50 border-amber-200',
        label: 'Atención'
      };
    } else {
      return {
        icon: <AlertCircle className="h-5 w-5" />,
        color: 'text-red-600',
        bgColor: 'bg-red-50 border-red-200',
        label: 'Crítico'
      };
    }
  }

  if (isLoadingCosts) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-pulse text-gray-400">Calculando indicadores de salud...</div>
      </div>
    );
  }

  // Obtener estados de salud para cada métrica
  const budgetStatus = getHealthStatus(healthMetrics.budgetHealth);
  const scheduleStatus = getHealthStatus(healthMetrics.scheduleHealth);
  const qualityStatus = getHealthStatus(healthMetrics.qualityHealth);
  const resourceStatus = getHealthStatus(healthMetrics.resourceHealth);
  const clientStatus = getHealthStatus(healthMetrics.clientSatisfaction);
  const overallStatus = getHealthStatus(healthMetrics.overall);

  return (
    <div className="space-y-6">
      {/* Resumen de Salud General */}
      <Card className={`border ${overallStatus.bgColor}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center">
            <Gauge className={`mr-2 ${overallStatus.color}`} />
            <span>Salud General del Proyecto</span>
          </CardTitle>
          <CardDescription>
            Evaluación consolidada de todos los indicadores clave
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-3xl font-bold mb-1 flex items-center">
                <span className={overallStatus.color}>{Math.round(healthMetrics.overall)}%</span>
              </div>
              <div className="flex items-center">
                <Badge className={`${overallStatus.bgColor} ${overallStatus.color} border`}>
                  {overallStatus.icon}
                  <span className="ml-1">{overallStatus.label}</span>
                </Badge>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-end space-x-4">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-amber-500">{healthMetrics.warnings}</div>
                  <div className="text-xs text-gray-500">Advertencias</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-red-500">{healthMetrics.alerts}</div>
                  <div className="text-xs text-gray-500">Alertas</div>
                </div>
              </div>
            </div>
          </div>
          
          <Progress 
            value={healthMetrics.overall} 
            className="h-2 mb-2" 
            indicatorClassName={
              healthMetrics.overall >= 85 ? "bg-green-500" :
              healthMetrics.overall >= 70 ? "bg-blue-500" :
              healthMetrics.overall >= 50 ? "bg-amber-500" : "bg-red-500"
            }
          />
          
          <div className="text-xs text-muted-foreground mt-1">
            {healthMetrics.overall >= 85 ? "El proyecto goza de excelente salud en todos los aspectos clave." :
             healthMetrics.overall >= 70 ? "El proyecto está en buena salud general, con algunas áreas para optimizar." :
             healthMetrics.overall >= 50 ? "El proyecto requiere atención en varios aspectos importantes." :
             "El proyecto está en estado crítico y necesita intervención inmediata."}
          </div>
        </CardContent>
      </Card>

      {/* Indicadores de Salud */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={`border ${budgetStatus.bgColor}`}>
          <CardHeader className="py-3 pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <span className={`mr-2 ${budgetStatus.color}`}>
                <BarChart3 className="h-4 w-4" />
              </span>
              Salud Presupuestal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-2xl font-bold ${budgetStatus.color}`}>
                {Math.round(healthMetrics.budgetHealth)}%
              </span>
              <Badge variant="outline" className={`${budgetStatus.bgColor} border-0 ${budgetStatus.color}`}>
                {budgetStatus.label}
              </Badge>
            </div>
            <Progress 
              value={healthMetrics.budgetHealth} 
              className="h-1.5 mb-2" 
              indicatorClassName={
                healthMetrics.budgetHealth >= 85 ? "bg-green-500" :
                healthMetrics.budgetHealth >= 70 ? "bg-blue-500" :
                healthMetrics.budgetHealth >= 50 ? "bg-amber-500" : "bg-red-500"
              }
            />
            <div className="text-xs text-muted-foreground">
              {healthMetrics.budgetHealth >= 85 ? "Uso de presupuesto óptimo" :
               healthMetrics.budgetHealth >= 70 ? "Presupuesto bajo control" :
               healthMetrics.budgetHealth >= 50 ? "Atención al presupuesto" :
               "Presupuesto en estado crítico"}
            </div>
          </CardContent>
        </Card>
        
        <Card className={`border ${scheduleStatus.bgColor}`}>
          <CardHeader className="py-3 pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <span className={`mr-2 ${scheduleStatus.color}`}>
                <Calendar className="h-4 w-4" />
              </span>
              Salud del Cronograma
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-2xl font-bold ${scheduleStatus.color}`}>
                {Math.round(healthMetrics.scheduleHealth)}%
              </span>
              <Badge variant="outline" className={`${scheduleStatus.bgColor} border-0 ${scheduleStatus.color}`}>
                {scheduleStatus.label}
              </Badge>
            </div>
            <Progress 
              value={healthMetrics.scheduleHealth} 
              className="h-1.5 mb-2" 
              indicatorClassName={
                healthMetrics.scheduleHealth >= 85 ? "bg-green-500" :
                healthMetrics.scheduleHealth >= 70 ? "bg-blue-500" :
                healthMetrics.scheduleHealth >= 50 ? "bg-amber-500" : "bg-red-500"
              }
            />
            <div className="text-xs text-muted-foreground">
              {healthMetrics.scheduleHealth >= 85 ? "Cronograma en fecha" :
               healthMetrics.scheduleHealth >= 70 ? "Pequeños retrasos manejables" :
               healthMetrics.scheduleHealth >= 50 ? "Retrasos significativos" :
               "Cronograma en estado crítico"}
            </div>
          </CardContent>
        </Card>
        
        <Card className={`border ${qualityStatus.bgColor}`}>
          <CardHeader className="py-3 pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <span className={`mr-2 ${qualityStatus.color}`}>
                <Zap className="h-4 w-4" />
              </span>
              Calidad de Entregables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-2xl font-bold ${qualityStatus.color}`}>
                {Math.round(healthMetrics.qualityHealth)}%
              </span>
              <Badge variant="outline" className={`${qualityStatus.bgColor} border-0 ${qualityStatus.color}`}>
                {qualityStatus.label}
              </Badge>
            </div>
            <Progress 
              value={healthMetrics.qualityHealth}
              className="h-1.5 mb-2" 
              indicatorClassName={
                healthMetrics.qualityHealth >= 85 ? "bg-green-500" :
                healthMetrics.qualityHealth >= 70 ? "bg-blue-500" :
                healthMetrics.qualityHealth >= 50 ? "bg-amber-500" : "bg-red-500"
              }
            />
            <div className="text-xs text-muted-foreground">
              {healthMetrics.qualityHealth >= 85 ? "Excelente calidad de entregables" :
               healthMetrics.qualityHealth >= 70 ? "Buena calidad general" :
               healthMetrics.qualityHealth >= 50 ? "Calidad inconsistente" :
               "Problemas severos de calidad"}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Estadísticas de Subproyectos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Estado de Subproyectos</CardTitle>
          <CardDescription>
            Distribución de los {subprojects?.length || 0} subproyectos por estado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex flex-col items-center p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="text-2xl font-bold text-green-700 mb-1">{statusCounts.active}</div>
              <div className="text-xs text-green-700 flex items-center">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Activos
              </div>
            </div>
            
            <div className="flex flex-col items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-blue-700 mb-1">{statusCounts.completed}</div>
              <div className="text-xs text-blue-700 flex items-center">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Completados
              </div>
            </div>
            
            <div className="flex flex-col items-center p-3 bg-orange-50 rounded-lg border border-orange-200">
              <div className="text-2xl font-bold text-orange-700 mb-1">{statusCounts.onHold}</div>
              <div className="text-xs text-orange-700 flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                En Pausa
              </div>
            </div>
            
            <div className="flex flex-col items-center p-3 bg-red-50 rounded-lg border border-red-200">
              <div className="text-2xl font-bold text-red-700 mb-1">{statusCounts.delayed}</div>
              <div className="text-xs text-red-700 flex items-center">
                <AlertCircle className="h-3 w-3 mr-1" />
                Con Retraso
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="pt-0 text-xs text-muted-foreground border-t px-6 py-3">
          <div className="flex items-center">
            <AlertTriangle className="h-3 w-3 mr-1 text-amber-500" />
            {statusCounts.delayed > 0 
              ? `${statusCounts.delayed} subproyectos con retrasos que requieren atención.` 
              : "Todos los subproyectos activos están en fecha."}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}