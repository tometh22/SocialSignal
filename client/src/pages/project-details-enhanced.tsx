import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TimeEntryForm from "@/components/time-entry-form";
import { SubprojectAlerts } from "@/components/subproject-alerts";
import { SubprojectNavigation } from "@/components/subproject-navigation";
import { CompletionPredictor } from "@/components/completion-predictor";
import { TimeEntriesFilter } from "@/components/time-entries-filter";
import { SubprojectComparison } from "@/components/subproject-comparison";
import { BatchActions } from "@/components/batch-actions";
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
  Plus,
  Timer,
  Activity,
  AlertCircle,
  BarChart3,
  Save,
  RotateCcw,
  Trash2
} from "lucide-react";

export default function ProjectDetailsEnhanced() {
  const [, params] = useRoute("/project/:id");
  const projectId = params?.id;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Estados locales
  const [showTimeEntryForm, setShowTimeEntryForm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectStatus, setProjectStatus] = useState("");
  const [filteredTimeEntries, setFilteredTimeEntries] = useState<any[]>([]);

  // Queries
  const { data: projectData } = useQuery({
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

  // Inicializar filteredTimeEntries cuando timeEntries cambie
  useEffect(() => {
    setFilteredTimeEntries(timeEntries);
  }, [timeEntries]);

  // Mutaciones
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
        description: "Error al actualizar el proyecto.",
        variant: "destructive",
      });
    },
  });

  // Lógica de cálculos
  const isSubproject = projectData?.parentProjectId;
  const parentProject = isSubproject ? allProjects.find((p: any) => p.id === projectData.parentProjectId) : null;
  const clientData = Array.isArray(clients) ? clients.find((c: any) => c.id === projectData?.clientId) : null;
  
  // Obtener subproyectos hermanos
  const siblingProjects = isSubproject 
    ? allProjects.filter((p: any) => 
        p.parentProjectId === projectData.parentProjectId && 
        p.id !== projectData.id
      ).map((p: any) => ({
        id: p.id,
        name: p.subprojectName || p.projectName,
        completionStatus: p.completionStatus,
        totalHours: 0, // Se calculará con datos reales
        estimatedHours: 8, // Se calculará con datos reales
        totalCost: 0 // Se calculará con datos reales
      }))
    : [];

  // Obtener todos los subproyectos del mismo cliente (incluyendo el actual)
  const allClientSubprojects = isSubproject 
    ? allProjects.filter((p: any) => 
        p.parentProjectId === projectData.parentProjectId
      ).map((p: any) => ({
        id: p.id,
        name: p.subprojectName || p.projectName,
        completionStatus: p.completionStatus,
        totalHours: p.id === projectData.id ? totalHours : 0, // Solo tenemos datos del actual
        estimatedHours: 8,
        totalCost: p.id === projectData.id ? totalCost : 0
      }))
    : [];
  
  const getProjectName = (id: number) => {
    const project = allProjects.find((p: any) => p.id === id);
    return project?.subprojectName || project?.projectName || "Proyecto sin nombre";
  };

  const getCompletionStatusBadge = (status: string) => {
    const statusConfig = {
      "pending": { label: "Pendiente", variant: "secondary" as const, color: "bg-gray-100 text-gray-700" },
      "in_progress": { label: "En Progreso", variant: "default" as const, color: "bg-blue-100 text-blue-700" },
      "completed": { label: "Completado", variant: "default" as const, color: "bg-green-100 text-green-700" },
      "paused": { label: "Pausado", variant: "secondary" as const, color: "bg-orange-100 text-orange-700" }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    
    return (
      <Badge variant={config.variant} className={config.color}>
        {config.label}
      </Badge>
    );
  };

  // Calcular métricas
  const totalHours = timeEntries.reduce((sum: number, entry: any) => sum + entry.hours, 0);
  const estimatedHours = 8; // Valor estimado
  const progress = estimatedHours > 0 ? (totalHours / estimatedHours) * 100 : 0;
  const totalCost = timeEntries.reduce((sum: number, entry: any) => {
    const person = Array.isArray(personnel) ? personnel.find((p: any) => p.id === entry.personnelId) : null;
    return sum + (entry.hours * (person?.hourlyRate || 50));
  }, 0);

  // Preparar datos para el proyecto actual para comparativa
  const currentProjectForComparison = {
    id: projectData?.id || 0,
    name: getProjectName(projectData?.id || parseInt(projectId!)),
    totalHours,
    estimatedHours,
    totalCost
  };

  // Handlers
  const handleOpenSettings = () => {
    setProjectName(getProjectName(projectData?.id || parseInt(projectId!)));
    setProjectDescription(projectData?.notes || "");
    setProjectStatus(projectData?.completionStatus || "in_progress");
    setShowSettingsDialog(true);
  };

  const handleSaveSettings = () => {
    updateProjectMutation.mutate({
      name: projectName,
      status: projectStatus,
      description: projectDescription,
    });
  };

  const handleBatchActionSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/time-entries/project", projectId] });
    queryClient.invalidateQueries({ queryKey: ["/api/active-projects"] });
  };

  // Project deletion mutation
  const deleteProjectMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/active-projects/${projectId}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Proyecto eliminado",
        description: "El proyecto ha sido eliminado exitosamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/active-projects"] });
      // Redirect to projects list
      window.location.href = "/active-projects";
    },
    onError: (error: any) => {
      toast({
        title: "Error al eliminar",
        description: error.message || "No se pudo eliminar el proyecto.",
        variant: "destructive",
      });
    }
  });

  const handleDeleteProject = () => {
    if (deleteConfirmText.toLowerCase() === "delete" && !isDeleting) {
      setIsDeleting(true);
      deleteProjectMutation.mutate();
    }
  };

  const resetDeleteDialog = () => {
    setShowDeleteDialog(false);
    setDeleteConfirmText("");
    setIsDeleting(false);
  };

  if (!projectData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Timer className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Cargando proyecto...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* HEADER MODERNO */}
      <div className="border-b bg-white sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
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
                    {clientData?.name || "MODO"}
                  </Badge>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Botón para plantillas recurrentes si es proyecto padre */}
              {!isSubproject && (
                <Link href={`/recurring-templates/${projectId}`}>
                  <Button variant="outline" size="sm">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Plantillas Recurrentes
                  </Button>
                </Link>
              )}
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
              <Button variant="ghost" size="sm" onClick={handleOpenSettings}>
                <Settings className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowDeleteDialog(true)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* MEJORA 1: NAVEGACIÓN CONTEXTUAL ENTRE SUBPROYECTOS */}
        {isSubproject && allClientSubprojects.length > 1 && (
          <SubprojectNavigation
            currentProjectId={projectData.id}
            siblingProjects={allClientSubprojects}
            clientName={clientData?.name || "Cliente"}
          />
        )}

        {/* SECCIÓN 1: DASHBOARD DE ESTADO Y PROGRESO */}
        <div className="mb-8">
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Progreso Visual Prominente */}
                <div className="lg:col-span-2 space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xl font-bold text-gray-900">Progreso del Entregable</h3>
                      <Badge variant={progress > 100 ? "destructive" : progress > 80 ? "secondary" : "default"} className="text-sm px-3 py-1">
                        {Math.round(progress)}%
                      </Badge>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4 mb-3">
                      <div 
                        className={`h-4 rounded-full transition-all duration-500 ${
                          progress > 100 ? 'bg-red-500' : progress > 80 ? 'bg-orange-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>{totalHours}h registradas</span>
                      <span>{estimatedHours}h estimadas por PM</span>
                    </div>
                    {progress > 100 && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-red-700">
                          Subproyecto excedido en {Math.round(progress - 100)}% - Requiere atención inmediata
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Métricas Clave en Grid */}
                <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-lg border shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Horas Totales</p>
                        <p className="text-2xl font-bold text-blue-600">{totalHours}h</p>
                      </div>
                      <Clock className="h-8 w-8 text-blue-500" />
                    </div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg border shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Costo Actual</p>
                        <p className="text-2xl font-bold text-green-600">${totalCost.toFixed(0)}</p>
                      </div>
                      <DollarSign className="h-8 w-8 text-green-500" />
                    </div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg border shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Límite PM</p>
                        <p className="text-2xl font-bold text-orange-600">{estimatedHours}h</p>
                      </div>
                      <Target className="h-8 w-8 text-orange-500" />
                    </div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg border shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Estado</p>
                        <p className={`text-xl font-bold ${progress <= 100 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {progress <= 100 ? 'Óptimo' : 'Riesgo'}
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

        {/* MEJORA 3: PREDICCIÓN DE FINALIZACIÓN */}
        {timeEntries.length > 2 && (
          <CompletionPredictor
            timeEntries={timeEntries}
            estimatedHours={estimatedHours}
            startDate={projectData?.startDate}
            currentHours={totalHours}
          />
        )}

        {/* SECCIÓN 2: ALERTAS DE EFICIENCIA (Solo para subproyectos) */}
        {isSubproject && timeEntries.length > 0 && Array.isArray(personnel) && (
          <div className="mb-8">
            <SubprojectAlerts
              timeEntries={timeEntries}
              personnel={personnel as any}
              estimatedHours={estimatedHours}
              projectStartDate={projectData?.startDate?.toString()}
              clientSubprojects={[]}
            />
          </div>
        )}

        {/* MEJORA 4: COMPARATIVA VISUAL CON OTROS SUBPROYECTOS */}
        {isSubproject && siblingProjects.length > 0 && (
          <SubprojectComparison
            currentProject={currentProjectForComparison}
            siblingProjects={siblingProjects}
            clientName={clientData?.name || "Cliente"}
          />
        )}

        {/* SECCIÓN 3: OPERACIONES Y DATOS DETALLADOS */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* COLUMNA 1: Registros de Tiempo (Más espacio) */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Registros de Tiempo ({filteredTimeEntries.length})
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
                {/* MEJORA 2: FILTROS Y BÚSQUEDA EN REGISTROS DE TIEMPO */}
                {timeEntries.length > 3 && (
                  <TimeEntriesFilter
                    timeEntries={timeEntries}
                    personnel={personnel as any}
                    onFilteredEntriesChange={setFilteredTimeEntries}
                  />
                )}
                
                {filteredTimeEntries.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {filteredTimeEntries.map((entry: any) => (
                      <div key={entry.id} className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-blue-100 text-blue-700 text-sm font-medium">
                              {entry.personnelName?.split(' ').map((n: string) => n[0]).join('') || 'TR'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{entry.personnelName}</p>
                            <p className="text-xs text-muted-foreground">{entry.roleName}</p>
                            {entry.description && (
                              <p className="text-xs text-gray-500 mt-1 max-w-xs truncate">{entry.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                              {entry.hours}h
                            </Badge>
                            <span className="text-sm font-medium">${(entry.hours * (entry.hourlyRate || 50)).toFixed(0)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(entry.date).toLocaleDateString('es-ES')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Timer className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {timeEntries.length === 0 ? "No hay registros de tiempo" : "No se encontraron registros"}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {timeEntries.length === 0 
                        ? "Comienza registrando tu primera entrada de tiempo"
                        : "Prueba ajustando los filtros de búsqueda"
                      }
                    </p>
                    {timeEntries.length === 0 && (
                      <Button 
                        variant="outline" 
                        onClick={() => setShowTimeEntryForm(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Registrar primera entrada
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* COLUMNA 2: Información y Acciones */}
          <div className="space-y-6">
            {/* Información del Proyecto */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Información del Entregable
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
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
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Estado:</span>
                    {getCompletionStatusBadge(projectData?.completionStatus || "in_progress")}
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="text-sm font-medium mb-2">Descripción</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {projectData?.notes || `Entregable "${getProjectName(projectData?.id || parseInt(projectId!))}" del programa Always-On ${clientData?.name || "MODO"}`}
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

            {/* MEJORA 5: ACCIONES EN LOTE */}
            {isSubproject && siblingProjects.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Gestión Avanzada
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <BatchActions
                    currentProjectId={projectData.id}
                    siblingProjects={siblingProjects}
                    timeEntries={timeEntries}
                    onSuccess={handleBatchActionSuccess}
                  />
                </CardContent>
              </Card>
            )}

            {/* Resumen Ejecutivo Mejorado */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Resumen Ejecutivo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg">
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {timeEntries.length}
                  </div>
                  <div className="text-sm text-gray-600">Entradas de Tiempo</div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-blue-50 rounded-lg text-center">
                    <div className="text-lg font-bold text-blue-600">
                      {Math.round((totalHours / estimatedHours) * 100)}%
                    </div>
                    <div className="text-xs text-blue-600">Completado</div>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg text-center">
                    <div className="text-lg font-bold text-green-600">
                      ${totalHours > 0 ? (totalCost / totalHours).toFixed(0) : '0'}
                    </div>
                    <div className="text-xs text-green-600">Costo/Hora</div>
                  </div>
                </div>
                
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <div className="text-sm font-medium text-orange-800">
                    {estimatedHours - totalHours > 0 
                      ? `${(estimatedHours - totalHours).toFixed(1)}h restantes` 
                      : 'Límite superado'
                    }
                  </div>
                  <div className="text-xs text-orange-600">Según estimación PM</div>
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
            queryClient.invalidateQueries({ queryKey: ["/api/time-entries/project", projectId] });
          }
        }}
      />

      {/* Diálogo de Configuración del Proyecto */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Configuración del Proyecto</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="projectName">Nombre del Proyecto</Label>
              <Input
                id="projectName"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Nombre del proyecto"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="projectStatus">Estado</Label>
              <Select value={projectStatus} onValueChange={setProjectStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="in_progress">En Progreso</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                  <SelectItem value="paused">Pausado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="projectDescription">Descripción</Label>
              <Textarea
                id="projectDescription"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Descripción del proyecto"
                rows={3}
              />
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