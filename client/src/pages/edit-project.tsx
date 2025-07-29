import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Loader2, Edit3, Calendar, DollarSign, FileText, Building2, AlertCircle, Info, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageLayout } from "@/components/ui/page-layout";

interface ProjectData {
  id: number;
  quotation?: {
    projectName: string;
  };
  notes?: string;
  status?: string;
  budget?: number;
  startDate?: string;
  expectedEndDate?: string;
  clientId?: number;
  client?: {
    name: string;
  };
  createdAt: string;
  quotationId?: number;
  subprojectName?: string;
  parentProjectId?: number;
}

interface QuotationData {
  id: number;
  projectName: string;
  baseCost: number;
  totalAmount: number;
}

export default function EditProject() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const projectId = parseInt(id || "0");

  // Estados del formulario
  const [projectName, setProjectName] = useState("");
  const [subprojectName, setSubprojectName] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("active");
  const [startDate, setStartDate] = useState("");
  const [expectedEndDate, setExpectedEndDate] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);

  // Cargar datos del proyecto
  const { data: project, isLoading } = useQuery<ProjectData>({
    queryKey: [`/api/active-projects/${projectId}`],
    enabled: !!projectId
  });

  // Cargar datos de la cotización si existe
  const { data: quotation } = useQuery<QuotationData>({
    queryKey: [`/api/quotations/${project?.quotationId}`],
    enabled: !!project?.quotationId
  });

  // Actualizar estados cuando se cargan los datos
  useEffect(() => {
    if (project) {
      setProjectName(project.quotation?.projectName || "");
      setSubprojectName(project.subprojectName || "");
      setNotes(project.notes || "");
      setStatus(project.status || "active");

      setStartDate(project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : "");
      setExpectedEndDate(project.expectedEndDate ? new Date(project.expectedEndDate).toISOString().split('T')[0] : "");
    }
  }, [project]);

  // Mutación para actualizar el proyecto
  const updateProjectMutation = useMutation({
    mutationFn: async (data: any) => {
      // Si estamos actualizando el nombre del proyecto, actualizar la cotización también
      if (data.projectName && project?.quotationId) {
        await apiRequest(`/api/quotations/${project.quotationId}`, "PATCH", {
          projectName: data.projectName
        });
      }
      // Remover projectName del data antes de enviar al backend del proyecto
      const { projectName, ...projectData } = data;
      return apiRequest(`/api/active-projects/${projectId}`, "PATCH", projectData);
    },
    onSuccess: () => {
      toast({
        title: "Proyecto actualizado",
        description: "Los cambios han sido guardados exitosamente."
      });
      
      // Invalidar queries en el orden correcto para asegurar actualización
      if (project?.quotationId) {
        queryClient.invalidateQueries({ queryKey: [`/api/quotations/${project.quotationId}`] });
      }
      queryClient.invalidateQueries({ queryKey: [`/api/active-projects/${projectId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/active-projects'] });
      
      // Dar tiempo para que las queries se actualicen antes de redirigir
      setTimeout(() => {
        setLocation(`/active-projects/${projectId}`);
      }, 100);
    },
    onError: (error) => {
      console.error("Error al actualizar proyecto:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el proyecto. Intente nuevamente.",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const updateData: any = {
      status,
      notes: notes || null,
      startDate: startDate || null,
      expectedEndDate: expectedEndDate || null,
      subprojectName: subprojectName || null
    };

    // Si el nombre del proyecto cambió, incluirlo en la actualización
    if (isEditingName && projectName !== project?.quotation?.projectName) {
      updateData.projectName = projectName;
    }

    updateProjectMutation.mutate(updateData);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-300';
      case 'paused': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'completed': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'archived': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Activo';
      case 'paused': return 'Pausado';
      case 'completed': return 'Completado';
      case 'archived': return 'Archivado';
      default: return status;
    }
  };

  if (isLoading) {
    return (
      <PageLayout title="Cargando...">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageLayout>
    );
  }

  if (!project) {
    return (
      <PageLayout title="Proyecto no encontrado">
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold mb-2">Proyecto no encontrado</h2>
          <p className="text-muted-foreground mb-4">No se pudo cargar la información del proyecto.</p>
          <Button onClick={() => setLocation("/active-projects")}>
            Volver a proyectos
          </Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <div className="max-w-5xl mx-auto p-6">
        {/* Cabecera mejorada */}
        <div className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation(`/active-projects/${projectId}`)}
            className="mb-4 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al proyecto
          </Button>
          
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-gray-900">Editar Proyecto</h1>
                  <Badge variant="outline" className={getStatusColor(status)}>
                    {getStatusLabel(status)}
                  </Badge>
                </div>
                <p className="text-gray-600">
                  Actualiza la información del proyecto #{projectId}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500 mb-1">Cliente</p>
                <p className="font-semibold text-gray-900 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  {project?.client?.name || "Sin cliente"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Card principal de información */}
          <Card className="shadow-md border-gray-200">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <FileText className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">Información del Proyecto</CardTitle>
                  <CardDescription>Actualiza los detalles principales del proyecto</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Nombre del proyecto (editable) */}
              <div className="space-y-2">
                <Label htmlFor="projectName" className="text-sm font-medium">
                  Nombre del proyecto
                </Label>
                {isEditingName ? (
                  <div className="flex gap-2">
                    <Input
                      id="projectName"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      className="flex-1"
                      placeholder="Ingresa el nombre del proyecto"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsEditingName(false);
                        setProjectName(project?.quotation?.projectName || "");
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      id="projectName"
                      value={projectName}
                      disabled
                      className="flex-1 bg-gray-50"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingName(true)}
                      className="flex items-center gap-2"
                    >
                      <Edit3 className="h-4 w-4" />
                      Editar
                    </Button>
                  </div>
                )}
                {!isEditingName && (
                  <p className="text-sm text-gray-500">
                    El nombre se sincroniza con la cotización asociada
                  </p>
                )}
              </div>

              {/* Nombre del subproyecto (si aplica) */}
              {project?.parentProjectId && (
                <div className="space-y-2">
                  <Label htmlFor="subprojectName" className="text-sm font-medium">
                    Nombre del subproyecto
                  </Label>
                  <Input
                    id="subprojectName"
                    value={subprojectName}
                    onChange={(e) => setSubprojectName(e.target.value)}
                    placeholder="Nombre específico del subproyecto"
                  />
                </div>
              )}

              {/* Notas */}
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-sm font-medium">
                  Notas del proyecto
                </Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Añade notas o descripción detallada del proyecto..."
                  rows={4}
                  className="resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Card de configuración */}
          <Card className="shadow-md border-gray-200">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <Settings className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">Configuración del Proyecto</CardTitle>
                  <CardDescription>Ajusta el estado, presupuesto y cronograma</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Estado */}
                <div className="space-y-2">
                  <Label htmlFor="status" className="text-sm font-medium">
                    Estado del proyecto
                  </Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          Activo
                        </div>
                      </SelectItem>
                      <SelectItem value="paused">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                          Pausado
                        </div>
                      </SelectItem>
                      <SelectItem value="completed">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full" />
                          Completado
                        </div>
                      </SelectItem>
                      <SelectItem value="archived">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-gray-500 rounded-full" />
                          Archivado
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Presupuesto - Solo lectura */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Presupuesto total
                  </Label>
                  <div className="rounded-md bg-gray-50 p-3">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">
                        ${quotation?.totalAmount?.toLocaleString() || '0.00'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Este valor proviene de la cotización aprobada
                    </p>
                  </div>
                </div>

                {/* Fecha de inicio */}
                <div className="space-y-2">
                  <Label htmlFor="startDate" className="text-sm font-medium">
                    Fecha de inicio
                  </Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Fecha de fin esperada */}
                <div className="space-y-2">
                  <Label htmlFor="expectedEndDate" className="text-sm font-medium">
                    Fecha de finalización esperada
                  </Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <Input
                      id="expectedEndDate"
                      type="date"
                      value={expectedEndDate}
                      onChange={(e) => setExpectedEndDate(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card de información adicional */}
          {(project?.clientId || project?.quotationId) && (
            <Card className="shadow-md border-gray-200">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Info className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Información Adicional</CardTitle>
                    <CardDescription>Detalles del contexto del proyecto</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Cliente:</span>
                      <span className="text-sm text-gray-900">{project.client?.name || "Sin cliente"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Fecha de creación:</span>
                      <span className="text-sm text-gray-900">
                        {new Date(project.createdAt).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {project.quotationId && (
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">Cotización:</span>
                        <span className="text-sm text-gray-900">#{project.quotationId}</span>
                      </div>
                    )}
                    {quotation && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">Costo base:</span>
                        <span className="text-sm text-gray-900">
                          ${quotation.baseCost.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Alerta informativa */}
          <Alert className="border-blue-200 bg-blue-50">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              Los cambios en el nombre del proyecto también actualizarán la cotización asociada. 
              El equipo del proyecto y otros detalles se mantienen sincronizados automáticamente.
            </AlertDescription>
          </Alert>

          {/* Botones de acción */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setLocation(`/active-projects/${projectId}`)}
              className="px-6"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="lg"
              disabled={updateProjectMutation.isPending}
              className="px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              {updateProjectMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando cambios...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar cambios
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}