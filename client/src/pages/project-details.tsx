import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TimeEntryForm from "@/components/time-entry-form";
import { SubprojectAlerts } from "@/components/subproject-alerts";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
  Repeat,
  Timer,
  Activity,
  BarChart3,
  Edit,
  AlertCircle,
  Save,
  X,
  CheckCircle,
  Pause,
  Play
} from "lucide-react";

export default function ProjectDetails() {
  const [match, params] = useRoute("/active-projects/:id");
  const projectId = params?.id;
  const [showTimeEntryForm, setShowTimeEntryForm] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [editingStatus, setEditingStatus] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  const { data: personnel = [] } = useQuery({
    queryKey: ["/api/personnel"],
  });



  // Mutaciones para actualizar el proyecto
  const updateProjectMutation = useMutation({
    mutationFn: async (data: { name?: string; status?: string; description?: string }) => {
      return apiRequest(`/api/active-projects/${projectId}/update`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/active-projects"] });
      setShowSettingsDialog(false);
      toast({
        title: "Éxito",
        description: "Proyecto actualizado correctamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el proyecto.",
        variant: "destructive",
      });
    },
  });

  const handleOpenSettings = () => {
    const projectData = allProjects.find((p: any) => p.id === parseInt(projectId!));
    setEditingName(getProjectName(projectData?.id || parseInt(projectId!)));
    setEditingStatus(projectData?.completionStatus || "pending");
    setEditingDescription(projectData?.description || "");
    setShowSettingsDialog(true);
  };

  const handleSaveSettings = () => {
    updateProjectMutation.mutate({
      name: editingName,
      status: editingStatus,
      description: editingDescription,
    });
  };

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

  const getCompletionStatusBadge = (status: string) => {
    const config = {
      "pending": { className: "bg-gray-100 text-gray-700 hover:bg-gray-100", label: "Pendiente" },
      "in_progress": { className: "bg-blue-100 text-blue-700 hover:bg-blue-100", label: "En Progreso" },
      "completed": { className: "bg-green-100 text-green-700 hover:bg-green-100", label: "Completado" },
      "paused": { className: "bg-amber-100 text-amber-700 hover:bg-amber-100", label: "Pausado" },
      "cancelled": { className: "bg-red-100 text-red-700 hover:bg-red-100", label: "Cancelado" }
    };

    const statusConfig = config[status as keyof typeof config] || config.pending;

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
                  {getCompletionStatusBadge(projectData?.completionStatus || "in_progress")}
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
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => window.location.href = `/projects/${projectId}/recurring-templates`}
                className="border-orange-200 text-orange-700 hover:bg-orange-50"
              >
                <Repeat className="h-5 w-5 mr-2" />
                Automatizar
              </Button>
              <Button variant="ghost" size="sm" onClick={handleOpenSettings}>
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* SECCIÓN 1: ESTADO Y PROGRESO */}
        <div className="grid gap-6 mb-8">
          {/* Panel de Estado Principal */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Progreso Visual Prominente */}
                <div className="lg:col-span-2 space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xl font-bold text-gray-900">Progreso del Entregable</h3>
                      <Badge variant={progress > 100 ? "destructive" : progress > 80 ? "secondary" : "default"}>
                        {Math.round(progress)}%
                      </Badge>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div 
                        className={`h-4 rounded-full transition-all duration-500 ${
                          progress > 100 ? 'bg-red-500' : progress > 80 ? 'bg-orange-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600 mt-1">
                      <span>{totalHours}h registradas</span>
                      <span>{estimatedHours}h estimadas</span>
                    </div>
                    {progress > 100 && (
                      <div className="flex items-center gap-2 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <AlertCircle className="h-5 w-5 text-red-500" />
                        <span className="text-sm font-medium text-red-700">
                          Subproyecto excedido en {Math.round(progress - 100)}% - Requiere atención
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Métricas Clave */}
                <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Horas Totales</p>
                        <p className="text-2xl font-bold text-blue-600">{totalHours}h</p>
                      </div>
                      <Clock className="h-8 w-8 text-blue-500" />
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Costo Actual</p>
                        <p className="text-2xl font-bold text-green-600">${totalCost.toFixed(0)}</p>
                      </div>
                      <DollarSign className="h-8 w-8 text-green-500" />
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Límite PM</p>
                        <p className="text-2xl font-bold text-orange-600">{estimatedHours}h</p>
                      </div>
                      <Target className="h-8 w-8 text-orange-500" />
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Eficiencia</p>
                        <p className={`text-2xl font-bold ${progress <= 100 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {progress <= 100 ? 'Óptima' : 'Riesgo'}
                        </p>
                      </div>
                      <TrendingUp className={`h-8 w-8 ${progress <= 100 ? 'text-emerald-500' : 'text-red-500'}`} />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SECCIÓN 2: ALERTAS DE EFICIENCIA (Solo para subproyectos) */}
        {isSubproject && timeEntries.length > 0 && Array.isArray(personnel) && (
          <div className="mb-8">
            <SubprojectAlerts
              timeEntries={timeEntries}
              personnel={personnel}
              estimatedHours={estimatedHours}
              projectStartDate={projectData?.startDate?.toString()}
              clientSubprojects={[]}
            />
          </div>
        )}

        {/* SECCIÓN 3: OPERACIONES Y DATOS */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* COLUMNA 1: Registros de Tiempo y Acciones */}
          <div className="lg:col-span-2 space-y-6">
            {/* Registros de Tiempo */}
            <Card className="h-fit">
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
          </div>

          {/* COLUMNA 2: Información del Proyecto y Acciones */}
          <div className="space-y-6">
            {/* Equipo del Proyecto */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Equipo Asignado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ProjectTeamSection projectId={projectId!} queryClient={queryClient} />
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
                      {projectData?.startDate ? new Date(projectData.startDate).toLocaleDateString('es-ES') : 'No definida'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Estado:</span>
                    {getCompletionStatusBadge(projectData?.completionStatus || "in_progress")}
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-medium mb-2">Descripción</h4>
                  <p className="text-sm text-muted-foreground">
                    {projectData?.notes || `Entregable "${getProjectName(projectData?.id || parseInt(projectId!))}" del programa Always-On MODO`}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Panel de Acciones Rápidas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Acciones Rápidas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => setShowTimeEntryForm(true)}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Registrar Tiempo
                </Button>

                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => window.location.href = `/time-entries/project/${projectId}`}
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Ver Análisis Detallado
                </Button>

                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={handleOpenSettings}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Configurar Proyecto
                </Button>
              </CardContent>
            </Card>

            {/* Resumen Ejecutivo */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Resumen Ejecutivo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">
                    {timeEntries.length}
                  </div>
                  <div className="text-sm text-gray-600">Entradas de Tiempo</div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="text-lg font-bold text-blue-600">
                      {Math.round((totalHours / estimatedHours) * 100)}%
                    </div>
                    <div className="text-xs text-blue-600">Completado</div>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <div className="text-lg font-bold text-green-600">
                      ${(totalCost / totalHours || 0).toFixed(0)}
                    </div>
                    <div className="text-xs text-green-600">Costo/Hora</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
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

      {/* Diálogo de Configuración del Proyecto */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuración del Proyecto
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Información básica */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="project-name" className="text-sm font-medium">
                  Nombre del Proyecto
                </Label>
                <Input
                  id="project-name"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="mt-1"
                  placeholder="Nombre del entregable"
                />
              </div>

              <div>
                <Label htmlFor="project-status" className="text-sm font-medium">
                  Estado del Proyecto
                </Label>
                <Select value={editingStatus} onValueChange={setEditingStatus}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        Pendiente
                      </div>
                    </SelectItem>
                    <SelectItem value="in_progress">
                      <div className="flex items-center gap-2">
                        <Play className="h-4 w-4 text-blue-500" />
                        En Progreso
                      </div>
                    </SelectItem>
                    <SelectItem value="completed">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Completado
                      </div>
                    </SelectItem>
                    <SelectItem value="paused">
                      <div className="flex items-center gap-2">
                        <Pause className="h-4 w-4 text-orange-500" />
                        Pausado
                      </div>
                    </SelectItem>
                    <SelectItem value="cancelled">
                      <div className="flex items-center gap-2">
                        <X className="h-4 w-4 text-red-500" />
                        Cancelado
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="project-description" className="text-sm font-medium">
                  Descripción
                </Label>
                <Textarea
                  id="project-description"
                  value={editingDescription}
                  onChange={(e) => setEditingDescription(e.target.value)}
                  className="mt-1"
                  placeholder="Descripción del entregable y sus objetivos..."
                  rows={3}
                />
              </div>
            </div>

            {/* Información del proyecto padre */}
            {isSubproject && parentProject && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Proyecto Padre</span>
                </div>
                <p className="text-sm text-blue-700">
                  Este entregable forma parte del proyecto: <strong>{getProjectName(parentProject.id)}</strong>
                </p>
              </div>
            )}

            {/* Acciones rápidas */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-900">Acciones Rápidas</h4>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowSettingsDialog(false);
                    setShowTimeEntryForm(true);
                  }}
                  className="justify-start"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Registrar Tiempo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowSettingsDialog(false);
                    window.location.href = `/time-entries/project/${projectId}`;
                  }}
                  className="justify-start"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Ver Análisis
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-6 border-t">
            <Button 
              variant="outline" 
              onClick={() => setShowSettingsDialog(false)}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveSettings}
              disabled={updateProjectMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {updateProjectMutation.isPending ? (
                <>
                  <Timer className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Component for ProjectTeamSection
function ProjectTeamSection({ projectId, queryClient }: { projectId: string; queryClient: any }) {
  const { toast } = useToast();
  
  const { data: baseTeam = [], isLoading: teamLoading, refetch } = useQuery({
    queryKey: ["/api/projects", projectId, "base-team"],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/base-team`);
      if (!response.ok) {
        throw new Error('Failed to fetch team');
      }
      return response.json();
    },
    enabled: !!projectId,
  });

  const copyTeamMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/copy-quotation-team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        throw new Error('Failed to copy team');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Éxito",
        description: "Equipo copiado desde la cotización correctamente",
      });
      refetch();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo copiar el equipo de la cotización",
        variant: "destructive",
      });
    },
  });

  if (teamLoading) {
    return (
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  if (!baseTeam || baseTeam.length === 0) {
    return (
      <div className="text-center py-8">
        <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground mb-3">No hay equipo asignado a este proyecto</p>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => copyTeamMutation.mutate()}
          disabled={copyTeamMutation.isPending}
        >
          {copyTeamMutation.isPending ? (
            <>
              <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
              Copiando...
            </>
          ) : (
            <>
              <Users className="h-4 w-4 mr-2" />
              Copiar Equipo de Cotización
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {baseTeam.map((member: any) => (
        <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-medium">
                {member.personnel?.name?.split(' ').map((n: string) => n[0]).join('') || 'MB'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-sm">{member.personnel?.name || 'Miembro del Equipo'}</p>
              <p className="text-xs text-muted-foreground">{member.role?.name || 'Rol no especificado'}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                {member.estimatedHours || 0}h
              </Badge>
              <span className="text-sm font-medium">${member.hourlyRate || 0}/h</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {member.isActive ? 'Activo' : 'Inactivo'}
            </p>
          </div>
        </div>
      ))}
      
      <div className="pt-3 border-t">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total Horas Estimadas:</span>
          <span className="font-medium">
            {baseTeam.reduce((sum: number, member: any) => sum + (member.estimatedHours || 0), 0)}h
          </span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span className="text-muted-foreground">Costo Estimado Total:</span>
          <span className="font-medium">
            ${baseTeam.reduce((sum: number, member: any) => 
              sum + ((member.estimatedHours || 0) * (member.hourlyRate || 0)), 0
            ).toFixed(0)}
          </span>
        </div>
      </div>
    </div>
  );
}