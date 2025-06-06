import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar, TrendingUp } from "lucide-react";
import { Link } from "wouter";

interface SubprojectNavigationProps {
  currentProjectId: number;
  siblingProjects: Array<{
    id: number;
    name: string;
    completionStatus: string;
    totalHours?: number;
    estimatedHours?: number;
  }>;
  clientName: string;
}

export function SubprojectNavigation({ 
  currentProjectId, 
  siblingProjects, 
  clientName 
}: SubprojectNavigationProps) {
  const currentIndex = siblingProjects.findIndex(p => p.id === currentProjectId);
  const previousProject = currentIndex > 0 ? siblingProjects[currentIndex - 1] : null;
  const nextProject = currentIndex < siblingProjects.length - 1 ? siblingProjects[currentIndex + 1] : null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-700";
      case "in_progress": return "bg-blue-100 text-blue-700";
      case "paused": return "bg-orange-100 text-orange-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getProgressPercentage = (project: any) => {
    if (!project.totalHours || !project.estimatedHours) return 0;
    return Math.round((project.totalHours / project.estimatedHours) * 100);
  };

  return (
    <Card className="mb-6 bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{clientName}</span> • 
              <span className="ml-1">{currentIndex + 1} de {siblingProjects.length} subproyectos</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Navegación Anterior */}
            {previousProject ? (
              <Link href={`/active-projects/${previousProject.id}`}>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <ChevronLeft className="h-4 w-4" />
                  <div className="text-left">
                    <div className="text-xs font-medium truncate max-w-32">
                      {previousProject.name}
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className={`text-xs ${getStatusColor(previousProject.completionStatus)}`}>
                        {getProgressPercentage(previousProject)}%
                      </Badge>
                    </div>
                  </div>
                </Button>
              </Link>
            ) : (
              <Button variant="outline" size="sm" disabled className="opacity-50">
                <ChevronLeft className="h-4 w-4" />
                Primero
              </Button>
            )}

            {/* Navegación Siguiente */}
            {nextProject ? (
              <Link href={`/active-projects/${nextProject.id}`}>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-xs font-medium truncate max-w-32">
                      {nextProject.name}
                    </div>
                    <div className="flex items-center gap-1 justify-end">
                      <Badge variant="secondary" className={`text-xs ${getStatusColor(nextProject.completionStatus)}`}>
                        {getProgressPercentage(nextProject)}%
                      </Badge>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Button variant="outline" size="sm" disabled className="opacity-50">
                Último
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Barra de progreso del programa general */}
        <div className="mt-3 pt-3 border-t border-indigo-200">
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
            <span>Progreso del Programa Always-On</span>
            <span>{siblingProjects.filter(p => p.completionStatus === "completed").length} completados</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
              style={{ 
                width: `${(siblingProjects.filter(p => p.completionStatus === "completed").length / siblingProjects.length) * 100}%` 
              }}
            ></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}