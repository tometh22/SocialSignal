import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { PageLayout } from "@/components/ui/page-layout";

interface ProjectData {
  id: number;
  quotation?: {
    projectName: string;
  };
  description?: string;
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
}

export default function EditProject() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const projectId = parseInt(id || "0");

  // Estados del formulario
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");
  const [budget, setBudget] = useState("");
  const [startDate, setStartDate] = useState("");
  const [expectedEndDate, setExpectedEndDate] = useState("");

  // Cargar datos del proyecto
  const { data: project, isLoading } = useQuery<ProjectData>({
    queryKey: [`/api/active-projects/${projectId}`],
    enabled: !!projectId
  });

  // Actualizar estados cuando se cargan los datos
  useEffect(() => {
    if (project) {
      setProjectName(project.quotation?.projectName || "");
      setDescription(project.description || "");
      setStatus(project.status || "active");
      setBudget(project.budget?.toString() || "");
      setStartDate(project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : "");
      setExpectedEndDate(project.expectedEndDate ? new Date(project.expectedEndDate).toISOString().split('T')[0] : "");
    }
  }, [project]);

  // Mutación para actualizar el proyecto
  const updateProjectMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/active-projects/${projectId}`, "PATCH", data);
    },
    onSuccess: () => {
      toast({
        title: "Proyecto actualizado",
        description: "Los cambios han sido guardados exitosamente."
      });
      queryClient.invalidateQueries({ queryKey: [`/api/active-projects/${projectId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/active-projects'] });
      setLocation(`/active-projects/${projectId}`);
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
      description: description || null,
      budget: budget ? parseFloat(budget) : null,
      startDate: startDate || null,
      expectedEndDate: expectedEndDate || null
    };

    updateProjectMutation.mutate(updateData);
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
    <PageLayout title="Editar Proyecto">
      <div className="max-w-4xl mx-auto">
        {/* Cabecera */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation(`/active-projects/${projectId}`)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al proyecto
          </Button>
          
          <h1 className="text-3xl font-bold">Editar Proyecto</h1>
          <p className="text-muted-foreground mt-2">
            Actualiza la información del proyecto #{projectId}
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Información del Proyecto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Nombre del proyecto (solo lectura) */}
              <div className="space-y-2">
                <Label htmlFor="projectName">Nombre del proyecto</Label>
                <Input
                  id="projectName"
                  value={projectName}
                  disabled
                  className="bg-muted"
                />
                <p className="text-sm text-muted-foreground">
                  El nombre del proyecto se hereda de la cotización y no se puede modificar aquí.
                </p>
              </div>

              {/* Descripción */}
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Añade una descripción del proyecto..."
                  rows={4}
                />
              </div>

              {/* Estado */}
              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="paused">Pausado</SelectItem>
                    <SelectItem value="completed">Completado</SelectItem>
                    <SelectItem value="archived">Archivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Presupuesto */}
              <div className="space-y-2">
                <Label htmlFor="budget">Presupuesto</Label>
                <Input
                  id="budget"
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Fecha de inicio */}
                <div className="space-y-2">
                  <Label htmlFor="startDate">Fecha de inicio</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                {/* Fecha de fin esperada */}
                <div className="space-y-2">
                  <Label htmlFor="expectedEndDate">Fecha de fin esperada</Label>
                  <Input
                    id="expectedEndDate"
                    type="date"
                    value={expectedEndDate}
                    onChange={(e) => setExpectedEndDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Información adicional */}
              {project.clientId && (
                <div className="p-4 bg-muted rounded-lg">
                  <h3 className="font-semibold mb-2">Información adicional</h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">Cliente:</span> {project.client?.name}</p>
                    <p><span className="font-medium">Creado:</span> {new Date(project.createdAt).toLocaleDateString('es-ES')}</p>
                    {project.quotationId && (
                      <p><span className="font-medium">Cotización:</span> #{project.quotationId}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation(`/active-projects/${projectId}`)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={updateProjectMutation.isPending}
                >
                  {updateProjectMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Guardar cambios
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </PageLayout>
  );
}