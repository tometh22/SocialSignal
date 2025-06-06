import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart3, TrendingUp, TrendingDown, Target, Award } from "lucide-react";

interface SubprojectComparisonProps {
  currentProject: {
    id: number;
    name: string;
    totalHours: number;
    estimatedHours: number;
    totalCost: number;
  };
  siblingProjects: Array<{
    id: number;
    name: string;
    totalHours: number;
    estimatedHours: number;
    totalCost: number;
    completionStatus: string;
  }>;
  clientName: string;
}

export function SubprojectComparison({
  currentProject,
  siblingProjects,
  clientName
}: SubprojectComparisonProps) {
  const allProjects = [...siblingProjects, currentProject];
  
  // Calcular métricas comparativas
  const getEfficiencyScore = (project: any) => {
    if (project.estimatedHours === 0) return 100;
    const efficiency = Math.max(0, 100 - ((project.totalHours / project.estimatedHours - 1) * 100));
    return Math.round(efficiency);
  };

  const getCostPerHour = (project: any) => {
    return project.totalHours > 0 ? project.totalCost / project.totalHours : 0;
  };

  const currentEfficiency = getEfficiencyScore(currentProject);
  const currentCostPerHour = getCostPerHour(currentProject);
  
  // Calcular promedios del cliente
  const avgEfficiency = Math.round(
    allProjects.reduce((sum, p) => sum + getEfficiencyScore(p), 0) / allProjects.length
  );
  
  const avgCostPerHour = allProjects.reduce((sum, p) => sum + getCostPerHour(p), 0) / allProjects.length;
  
  // Ranking del proyecto actual
  const efficiencyRanking = allProjects
    .sort((a, b) => getEfficiencyScore(b) - getEfficiencyScore(a))
    .findIndex(p => p.id === currentProject.id) + 1;
  
  const costRanking = allProjects
    .sort((a, b) => getCostPerHour(a) - getCostPerHour(b))
    .findIndex(p => p.id === currentProject.id) + 1;

  // Determinar estado comparativo
  const getComparisonStatus = () => {
    const efficiencyVsAvg = currentEfficiency - avgEfficiency;
    const costVsAvg = ((currentCostPerHour - avgCostPerHour) / avgCostPerHour) * 100;
    
    if (efficiencyVsAvg >= 10 && costVsAvg <= -10) return "excellent";
    if (efficiencyVsAvg >= 5 && costVsAvg <= -5) return "good";
    if (efficiencyVsAvg >= -5 && costVsAvg <= 5) return "average";
    return "needs_improvement";
  };

  const comparisonStatus = getComparisonStatus();
  
  const statusConfig = {
    excellent: { 
      label: "Excelente", 
      color: "green", 
      bgColor: "bg-green-50", 
      textColor: "text-green-700",
      icon: Award 
    },
    good: { 
      label: "Bueno", 
      color: "blue", 
      bgColor: "bg-blue-50", 
      textColor: "text-blue-700",
      icon: TrendingUp 
    },
    average: { 
      label: "Promedio", 
      color: "yellow", 
      bgColor: "bg-yellow-50", 
      textColor: "text-yellow-700",
      icon: Target 
    },
    needs_improvement: { 
      label: "Mejorable", 
      color: "red", 
      bgColor: "bg-red-50", 
      textColor: "text-red-700",
      icon: TrendingDown 
    }
  };

  const config = statusConfig[comparisonStatus];
  const StatusIcon = config.icon;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Comparativa con {clientName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Estado General */}
        <div className={`${config.bgColor} p-4 rounded-lg border border-${config.color}-200`}>
          <div className="flex items-center gap-3">
            <StatusIcon className={`h-6 w-6 text-${config.color}-600`} />
            <div>
              <div className={`font-medium ${config.textColor}`}>
                Performance: {config.label}
              </div>
              <div className={`text-sm text-${config.color}-600`}>
                Basado en eficiencia y costo vs otros subproyectos
              </div>
            </div>
          </div>
        </div>

        {/* Métricas Comparativas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Eficiencia */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Eficiencia</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  #{efficiencyRanking} de {allProjects.length}
                </Badge>
                <span className="text-sm font-bold">{currentEfficiency}%</span>
              </div>
            </div>
            <div className="space-y-1">
              <Progress value={currentEfficiency} className="h-2" />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Tu proyecto</span>
                <span>Promedio: {avgEfficiency}%</span>
              </div>
            </div>
            {currentEfficiency >= avgEfficiency ? (
              <div className="flex items-center gap-1 text-xs text-green-600">
                <TrendingUp className="h-3 w-3" />
                +{currentEfficiency - avgEfficiency}% vs promedio
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs text-red-600">
                <TrendingDown className="h-3 w-3" />
                {currentEfficiency - avgEfficiency}% vs promedio
              </div>
            )}
          </div>

          {/* Costo por Hora */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Costo/Hora</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  #{costRanking} de {allProjects.length}
                </Badge>
                <span className="text-sm font-bold">${currentCostPerHour.toFixed(0)}</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${currentCostPerHour <= avgCostPerHour ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min((currentCostPerHour / (avgCostPerHour * 1.5)) * 100, 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Tu proyecto</span>
                <span>Promedio: ${avgCostPerHour.toFixed(0)}</span>
              </div>
            </div>
            {currentCostPerHour <= avgCostPerHour ? (
              <div className="flex items-center gap-1 text-xs text-green-600">
                <TrendingDown className="h-3 w-3" />
                ${(avgCostPerHour - currentCostPerHour).toFixed(0)} menos que promedio
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs text-red-600">
                <TrendingUp className="h-3 w-3" />
                ${(currentCostPerHour - avgCostPerHour).toFixed(0)} más que promedio
              </div>
            )}
          </div>
        </div>

        {/* Lista de Subproyectos */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Otros subproyectos de {clientName}</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {siblingProjects.map((project) => {
              const projectEfficiency = getEfficiencyScore(project);
              const projectCostPerHour = getCostPerHour(project);
              
              return (
                <div 
                  key={project.id} 
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {project.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {project.totalHours}h / {project.estimatedHours}h estimadas
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs text-gray-600">Eficiencia</div>
                      <div className={`text-sm font-medium ${
                        projectEfficiency >= currentEfficiency ? 'text-green-600' : 'text-gray-600'
                      }`}>
                        {projectEfficiency}%
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-600">Costo/h</div>
                      <div className={`text-sm font-medium ${
                        projectCostPerHour <= currentCostPerHour ? 'text-green-600' : 'text-gray-600'
                      }`}>
                        ${projectCostPerHour.toFixed(0)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recomendaciones */}
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h4 className="text-sm font-medium text-blue-900 mb-2">Recomendaciones</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            {currentEfficiency < avgEfficiency && (
              <li>• Revisar procesos para mejorar eficiencia en uso de horas</li>
            )}
            {currentCostPerHour > avgCostPerHour && (
              <li>• Optimizar la asignación de roles para reducir costo promedio</li>
            )}
            {costRanking <= 2 && efficiencyRanking <= 2 && (
              <li>• ¡Excelente trabajo! Considera documentar mejores prácticas</li>
            )}
            {efficiencyRanking > allProjects.length / 2 && (
              <li>• Analizar metodología de proyectos mejor rankeados</li>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}