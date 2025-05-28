import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Activity
} from "lucide-react";

export default function ProjectDetails() {
  const [match, params] = useRoute("/active-projects/:id");
  const projectId = params?.id;
  const [showTimeEntryForm, setShowTimeEntryForm] = useState(false);

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

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/active-projects">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  {getProjectName(projectData?.id || parseInt(projectId!))}
                </h1>
                {isSubproject && parentProject && (
                  <p className="text-sm text-gray-600 mt-1">
                    Parte del proyecto: {getProjectName(parentProject.id)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(projectData?.status || "active")}
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Configurar
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {/* Información del Cliente */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src="/uploads/logo-aad7da83-1d41-4c52-a130-dad57dea76db.png" />
                <AvatarFallback className="bg-blue-100 text-blue-700 font-medium">
                  MO
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">MODO</h3>
                <p className="text-sm text-gray-600">Cliente Always-On</p>
              </div>
              <div className="text-right">
                {isSubproject ? (
                  <div>
                    <div className="text-lg font-semibold text-gray-700">Incluido</div>
                    <p className="text-sm text-gray-600">En presupuesto principal</p>
                  </div>
                ) : (
                  <div>
                    <div className="text-2xl font-bold text-gray-900">$4,200.00</div>
                    <p className="text-sm text-gray-600">Presupuesto mensual</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detalles del Proyecto */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Información General */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Información General
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm font-medium">Fecha de inicio</p>
                  <p className="text-sm text-gray-600">
                    {projectData?.startDate ? new Date(projectData.startDate).toLocaleDateString('es-ES') : "01/01/2023"}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm font-medium">Fecha estimada de fin</p>
                  <p className="text-sm text-gray-600">
                    {projectData?.expectedEndDate ? new Date(projectData.expectedEndDate).toLocaleDateString('es-ES') : "28/12/2023"}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Target className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm font-medium">Frecuencia</p>
                  <p className="text-sm text-gray-600">{projectData?.trackingFrequency || "Mensual"}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <DollarSign className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm font-medium">Presupuesto</p>
                  <p className="text-sm text-gray-600">
                    {isSubproject ? "Incluido en presupuesto principal" : "$4,200.00 mensual"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Descripción y Notas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Descripción
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700 leading-relaxed">
                {projectData?.notes || 
                 `Proyecto creado a partir del entregable "${getProjectName(projectData?.id || parseInt(projectId!))}" del Excel MODO. Este entregable forma parte del programa Always-On de MODO con seguimiento mensual y presupuesto consolidado.`}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Seguimiento de Horas */}
        <div className="grid gap-6 md:grid-cols-2 mt-6">
          {/* Resumen de Horas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Timer className="h-5 w-5" />
                  Horas Trabajadas
                </div>
                <Button 
                  size="sm" 
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => setShowTimeEntryForm(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Registrar Horas
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">
                      {timeEntries.reduce((total: number, entry: any) => total + (entry.hours || 0), 0).toFixed(1)}h
                    </div>
                    <p className="text-sm text-gray-600">Total este mes</p>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      ${timeEntries.reduce((total: number, entry: any) => total + ((entry.hours || 0) * (entry.hourlyRate || 50)), 0).toLocaleString()}
                    </div>
                    <p className="text-sm text-blue-600">Costo real</p>
                  </div>
                </div>
                
                {timeEntries.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-900">Últimas entradas:</h4>
                    {timeEntries.slice(0, 3).map((entry: any) => (
                      <div key={entry.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          <Activity className="h-3 w-3 text-gray-500" />
                          <span className="text-sm">{entry.description || "Trabajo en proyecto"}</span>
                        </div>
                        <span className="text-sm font-medium">{entry.hours}h</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <Timer className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">No hay horas registradas aún</p>
                    <p className="text-xs">Comienza registrando el tiempo trabajado</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Análisis de Rentabilidad */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Análisis de Rentabilidad
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                  <span className="text-sm font-medium">Presupuesto asignado</span>
                  <span className="font-bold text-emerald-600">
                    {isSubproject ? "Incluido" : "$4,200"}
                  </span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <span className="text-sm font-medium">Costo real (horas)</span>
                  <span className="font-bold text-blue-600">
                    ${timeEntries.reduce((total: number, entry: any) => total + ((entry.hours || 0) * (entry.hourlyRate || 50)), 0).toLocaleString()}
                  </span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">Margen estimado</span>
                  <span className={`font-bold ${isSubproject ? 'text-gray-600' : 'text-emerald-600'}`}>
                    {isSubproject ? "Consolidado" : 
                     `$${(4200 - timeEntries.reduce((total: number, entry: any) => total + ((entry.hours || 0) * (entry.hourlyRate || 50)), 0)).toLocaleString()}`}
                  </span>
                </div>
                
                <div className="pt-2">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                    <span>Progreso presupuestario</span>
                    <span>
                      {isSubproject ? "N/A" : 
                       `${Math.round((timeEntries.reduce((total: number, entry: any) => total + ((entry.hours || 0) * (entry.hourlyRate || 50)), 0) / 4200) * 100)}%`}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        isSubproject ? 'bg-gray-400' : 
                        (timeEntries.reduce((total: number, entry: any) => total + ((entry.hours || 0) * (entry.hourlyRate || 50)), 0) / 4200) < 0.8 ? 
                        'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      style={{ 
                        width: isSubproject ? '0%' : 
                               `${Math.min((timeEntries.reduce((total: number, entry: any) => total + ((entry.hours || 0) * (entry.hourlyRate || 50)), 0) / 4200) * 100, 100)}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Acciones Rápidas */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Acciones del Proyecto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-4">
              <Button variant="outline" className="justify-start">
                <Users className="h-4 w-4 mr-2" />
                Gestionar Equipo
              </Button>
              <Button 
                variant="outline" 
                className="justify-start"
                onClick={() => setShowTimeEntryForm(true)}
              >
                <Timer className="h-4 w-4 mr-2" />
                Cargar Horas
              </Button>
              <Button variant="outline" className="justify-start">
                <Calendar className="h-4 w-4 mr-2" />
                Ver Cronograma
              </Button>
              <Button variant="outline" className="justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Generar Reporte
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Nota sobre Always-On */}
        {isSubproject && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-blue-900">Proyecto Always-On</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Este entregable forma parte del programa Always-On de MODO. El presupuesto y la gestión se manejan 
                  de forma consolidada con otros entregables del mismo programa.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Formulario de Registro de Horas */}
        {projectId && (
          <TimeEntryForm
            projectId={projectId}
            open={showTimeEntryForm}
            onOpenChange={setShowTimeEntryForm}
          />
        )}
      </div>
    </div>
  );
}