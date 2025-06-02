import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import TimeEntryForm from "@/components/time-entry-form";
import { 
  ArrowLeft, 
  Calendar,
  Clock,
  DollarSign,
  Building2,
  Target,
  FileText,
  TrendingUp,
  Settings,
  Users,
  MessageSquare,
  Plus,
  Timer,
  Activity,
  BarChart3,
  Edit,
  AlertCircle
} from "lucide-react";

export default function ProjectDetails() {
  const [match, params] = useRoute("/active-projects/:id");
  const projectId = params?.id;
  const [showTimeEntryForm, setShowTimeEntryForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: project, isLoading } = useQuery({
    queryKey: ["/api/active-projects", projectId],
    queryFn: () => fetch(`/api/active-projects/${projectId}`).then(res => res.json()),
    enabled: !!projectId,
  });

  const { data: allProjects = [] } = useQuery({
    queryKey: ["/api/active-projects", true],
    queryFn: () => fetch("/api/active-projects?showSubprojects=true").then(res => res.json()),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["/api/time-entries/project", projectId],
    queryFn: () => fetch(`/api/time-entries/project/${projectId}`).then(res => res.json()),
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50/50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500 text-sm">Cargando detalles del proyecto...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50/50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Proyecto no encontrado</h3>
            <p className="text-gray-600 mb-6">El proyecto que buscas no existe o no tienes permisos para verlo.</p>
            <Link href="/active-projects">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver a Proyectos
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Encontrar el proyecto en la lista para obtener todos los datos
  const projectData = allProjects.find((p: any) => p.id === parseInt(projectId!));
  const isSubproject = projectData?.parentProjectId;
  const parentProject = isSubproject ? allProjects.find((p: any) => p.id === projectData.parentProjectId) : null;

  const getProjectName = (id: number) => {
    switch(id) {
      case 5: return "Ejecutivo Sony One";
      case 6: return "Mensual Enero";
      case 7: return "Ejecutivo Telepase";
      case 8: return "Mensual Febrero";
      case 9: return "Ejecutivo NFC";
      case 10: return "Ejecutivo Sony One Febrero";
      case 11: return "Mensual Marzo";
      case 12: return "Ejecutivo 2";
      case 13: return "Ejecutivo Comercios";
      case 14: return "Mensual Abril";
      case 15: return "Ejecutivo 1";
      case 16: return "MODO Always-On - Presupuesto Global";
      default: return `Proyecto ${id}`;
    }
  };

  const getStatusBadge = (status: string) => {
    const config = {
      "active": { className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100", label: "Activo" },
      "en_progreso": { className: "bg-blue-100 text-blue-700 hover:bg-blue-100", label: "En Progreso" },
      "paused": { className: "bg-amber-100 text-amber-700 hover:bg-amber-100", label: "Pausado" },
      "completed": { className: "bg-gray-100 text-gray-700 hover:bg-gray-100", label: "Completado" }
    };
    
    const statusConfig = config[status as keyof typeof config] || config.active;
    
    return (
      <Badge variant="secondary" className={`text-sm font-medium px-3 py-1 ${statusConfig.className}`}>
        {statusConfig.label}
      </Badge>
    );
  };

  // Calcular métricas
  const totalHours = timeEntries.reduce((sum: number, entry: any) => sum + entry.hours, 0);
  const estimatedHours = 8; // Valor estimado
  const progress = estimatedHours > 0 ? (totalHours / estimatedHours) * 100 : 0;
  const totalCost = timeEntries.reduce((sum: number, entry: any) => sum + (entry.hours * (entry.hourlyRate || 0)), 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header Moderno con Acciones Principales */}
      <div className="border-b bg-white sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Link href="/active-projects">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {getProjectName(projectData?.id || parseInt(projectId!))}
                </h1>
                {isSubproject && parentProject && (
                  <p className="text-muted-foreground mt-1">
                    Parte del proyecto: <span className="font-medium">{getProjectName(parentProject.id)}</span>
                  </p>
                )}
                <div className="flex items-center gap-4 mt-2">
                  {getStatusBadge(projectData?.status || "active")}
                  <Badge variant="outline" className="text-xs">
                    <Building2 className="h-3 w-3 mr-1" />
                    MODO
                  </Badge>
                </div>
              </div>
            </div>
            
            {/* Botones de Acción Principales */}
            <div className="flex items-center gap-3">
              <Button 
                size="lg"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => setShowTimeEntryForm(true)}
              >
                <Clock className="h-5 w-5 mr-2" />
                Registrar Horas
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => window.location.href = `/time-entries/project/${projectId}`}
              >
                <BarChart3 className="h-5 w-5 mr-2" />
                Ver Análisis
              </Button>
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {/* Panel de Métricas Rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Horas Registradas</p>
                  <p className="text-2xl font-bold">{totalHours}h</p>
                </div>
                <Clock className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Horas Estimadas</p>
                  <p className="text-2xl font-bold">{estimatedHours}h</p>
                </div>
                <Target className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Progreso</p>
                  <p className="text-2xl font-bold">{Math.round(progress)}%</p>
                </div>
                <TrendingUp className={`h-8 w-8 ${progress > 100 ? 'text-red-500' : 'text-emerald-500'}`} />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Costo Actual</p>
                  <p className="text-2xl font-bold">${totalCost.toFixed(0)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Barra de Progreso Visual */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Progreso del Entregable</h3>
              <span className="text-sm text-muted-foreground">{totalHours}h de {estimatedHours}h</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className={`h-3 rounded-full transition-all duration-500 ${
                  progress > 100 ? 'bg-red-500' : progress > 80 ? 'bg-orange-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              ></div>
            </div>
            {progress > 100 && (
              <div className="flex items-center gap-2 mt-2 text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Proyecto excedido en {Math.round(progress - 100)}%</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Grid Principal */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Registros de Tiempo */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Registros de Tiempo
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowTimeEntryForm(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar
              </Button>
            </CardHeader>
            <CardContent>
              {timeEntries.length > 0 ? (
                <div className="space-y-4">
                  {timeEntries.map((entry: any) => (
                    <div key={entry.id} className="flex items-start justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-medium">
                            {entry.personnelName?.split(' ').map((n: string) => n[0]).join('') || 'TR'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{entry.personnelName}</p>
                          <p className="text-xs text-muted-foreground">{entry.roleName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                            {entry.hours}h
                          </Badge>
                          <span className="text-sm font-medium">${(entry.hours * entry.hourlyRate).toFixed(0)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(entry.date).toLocaleDateString('es-ES')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Timer className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No hay registros de tiempo</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => setShowTimeEntryForm(true)}
                  >
                    Registrar primera entrada
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Información del Proyecto */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Información del Entregable
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Frecuencia:</span>
                  <span className="text-sm font-medium">Mensual</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Tipo:</span>
                  <span className="text-sm font-medium">Ejecutivo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Fecha inicio:</span>
                  <span className="text-sm font-medium">
                    {project.startDate ? new Date(project.startDate).toLocaleDateString('es-ES') : 'No definida'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Estado:</span>
                  {getStatusBadge(project.status || "active")}
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h4 className="text-sm font-medium mb-2">Descripción</h4>
                <p className="text-sm text-muted-foreground">
                  {project.notes || `Entregable "${getProjectName(projectData?.id || parseInt(projectId!))}" del programa Always-On MODO`}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de Registro de Tiempo */}
      <TimeEntryForm 
        projectId={projectId!} 
        open={showTimeEntryForm}
        onOpenChange={(open) => {
          setShowTimeEntryForm(open);
          if (!open) {
            // Recargar datos cuando se cierre el modal
            queryClient.invalidateQueries({ queryKey: ["/api/time-entries/project", projectId] });
          }
        }}
      />
    </div>
  );
}