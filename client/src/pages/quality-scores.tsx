import React, { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const QualityScoresPage = () => {
  const [, params] = useRoute('/quality-scores/:clientId');
  const clientId = params?.clientId ? parseInt(params.clientId) : null;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Estados para el formulario
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedDeliverable, setSelectedDeliverable] = useState<string>("");
  const [scores, setScores] = useState({
    narrative_quality_score: "",
    graphics_effectiveness_score: "",
    format_design_score: "",
    relevant_insights_score: "",
    operations_feedback_score: "",
    client_feedback_score: "",
    brief_compliance_score: "",
    hours_available: "",
    hours_real: "",
    notes: ""
  });

  // Obtener información del cliente
  const { data: client } = useQuery({
    queryKey: [`/api/clients/${clientId}`],
    enabled: !!clientId,
  });

  // Obtener proyectos activos del cliente que tienen entregables
  const { data: allProjects } = useQuery({
    queryKey: [`/api/active-projects/client/${clientId}`],
    enabled: !!clientId,
  });

  // Agrupar proyectos por jerarquía para MODO (Always-On)
  const projectsGrouped = React.useMemo(() => {
    
    if (!allProjects || !Array.isArray(allProjects)) {
      return [];
    }
    
    // Para MODO, el proyecto padre es ID 16 (Always-On) y tiene subproyectos 5,6,7,8,9,10,11,12,13,14,15
    const parentProject = allProjects.find((p: any) => p.id === 16);
    const subProjects = allProjects.filter((p: any) => 
      [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].includes(p.id)
    );
    
    
    if (parentProject) {
      return [{
        ...parentProject,
        displayName: "MODO Always-On",
        subProjects: subProjects
      }];
    }
    
    return allProjects;
  }, [allProjects]);


  // Obtener entregables del proyecto seleccionado o de todos los subproyectos si es el padre
  const { data: deliverables } = useQuery({
    queryKey: selectedProject === "16" 
      ? [`/api/projects/always-on/deliverables`] 
      : [`/api/projects/${selectedProject}/deliverables`],
    enabled: !!selectedProject,
  });

  // Obtener datos del entregable seleccionado
  const { data: deliverableData } = useQuery({
    queryKey: [`/api/deliverables/${selectedDeliverable}`],
    enabled: !!selectedDeliverable,
  });

  // Cargar datos del entregable cuando se selecciona
  React.useEffect(() => {
    if (deliverableData && typeof deliverableData === 'object') {
      const data = deliverableData as any;
      setScores({
        narrative_quality_score: data.narrative_quality_score?.toString() || data.narrative_quality?.toString() || "",
        graphics_effectiveness_score: data.graphics_effectiveness_score?.toString() || data.graphics_effectiveness?.toString() || "",
        format_design_score: data.format_design_score?.toString() || data.format_design?.toString() || "",
        relevant_insights_score: data.relevant_insights_score?.toString() || data.relevant_insights?.toString() || "",
        operations_feedback_score: data.operations_feedback_score?.toString() || data.operations_feedback?.toString() || "",
        client_feedback_score: data.client_feedback_score?.toString() || data.client_feedback?.toString() || "",
        brief_compliance_score: data.brief_compliance_score?.toString() || data.brief_compliance?.toString() || "",
        hours_available: data.hours_available?.toString() || "",
        hours_real: data.hours_real?.toString() || "",
        notes: data.notes || ""
      });
    }
  }, [deliverableData]);

  // Mutación para actualizar puntuaciones
  const updateScoresMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/deliverables/${selectedDeliverable}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error("Error al actualizar puntuaciones");
      }
      
      return response.json();
    },
    onSuccess: (updatedData) => {
      toast({
        title: "Puntuaciones actualizadas",
        description: "Las puntuaciones de calidad se han guardado correctamente.",
      });
      
      // Actualizar directamente los campos del formulario con los datos devueltos
      if (updatedData) {
        setScores({
          narrative_quality_score: updatedData.narrative_quality?.toString() || scores.narrative_quality_score,
          graphics_effectiveness_score: updatedData.graphics_effectiveness?.toString() || scores.graphics_effectiveness_score,
          format_design_score: updatedData.format_design?.toString() || scores.format_design_score,
          relevant_insights_score: updatedData.relevant_insights?.toString() || scores.relevant_insights_score,
          operations_feedback_score: updatedData.operations_feedback?.toString() || scores.operations_feedback_score,
          client_feedback_score: updatedData.client_feedback?.toString() || scores.client_feedback_score,
          brief_compliance_score: updatedData.brief_compliance?.toString() || scores.brief_compliance_score,
          hours_available: updatedData.hours_available?.toString() || scores.hours_available,
          hours_real: updatedData.hours_real?.toString() || scores.hours_real,
          notes: updatedData.notes || scores.notes
        });
      }
      
      // Invalidar caché relacionado
      queryClient.invalidateQueries({ queryKey: [`/api/deliverables/${selectedDeliverable}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/modo-summary`] });
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/deliverables`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "No se pudieron guardar las puntuaciones. Intenta nuevamente.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!selectedDeliverable) {
      toast({
        title: "Selecciona un entregable",
        description: "Debes seleccionar un entregable antes de guardar.",
        variant: "destructive",
      });
      return;
    }

    const data = {
      narrative_quality_score: scores.narrative_quality_score ? parseFloat(scores.narrative_quality_score) : null,
      graphics_effectiveness_score: scores.graphics_effectiveness_score ? parseFloat(scores.graphics_effectiveness_score) : null,
      format_design_score: scores.format_design_score ? parseFloat(scores.format_design_score) : null,
      relevant_insights_score: scores.relevant_insights_score ? parseFloat(scores.relevant_insights_score) : null,
      operations_feedback_score: scores.operations_feedback_score ? parseFloat(scores.operations_feedback_score) : null,
      client_feedback_score: scores.client_feedback_score ? parseFloat(scores.client_feedback_score) : null,
      brief_compliance_score: scores.brief_compliance_score ? parseFloat(scores.brief_compliance_score) : null,
      hours_available: scores.hours_available ? parseFloat(scores.hours_available) : null,
      hours_real: scores.hours_real ? parseFloat(scores.hours_real) : null,
      notes: scores.notes
    };

    updateScoresMutation.mutate(data);
  };

  const handleInputChange = (field: string, value: string) => {
    setScores(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clientName = client && typeof client === 'object' && 'name' in client 
    ? client.name as string 
    : "Cliente";

  if (!clientId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl font-bold mb-4">Cliente no especificado</h1>
        <Button onClick={() => navigate("/clients")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a Clientes
        </Button>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Breadcrumbs */}
      <div className="breadcrumb-nav">
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-4">
          <span>Dashboard</span>
          <span>/</span>
          <span>Clientes</span>
          <span>/</span>
          <span>{clientName}</span>
          <span>/</span>
          <span className="text-foreground font-medium">Puntuaciones de Calidad</span>
        </nav>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="heading-page">Actualizar Puntuaciones de Calidad</h1>
            <p className="text-muted-foreground mt-1">
              Actualiza los indicadores de robustez cada 15 días para {clientName}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate(`/client-summary/${clientId}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al Resumen
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel de selección */}
        <div className="lg:col-span-1">
          <Card className="standard-card">
            <CardHeader>
              <CardTitle>Seleccionar Entregable</CardTitle>
              <CardDescription>
                Elige el proyecto y entregable que deseas evaluar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="project">Proyecto</Label>
                <Select onValueChange={setSelectedProject} value={selectedProject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un proyecto" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectsGrouped && projectsGrouped.length > 0 ? projectsGrouped.map((project: any) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.displayName || project.quotation?.projectName || project.name || `Proyecto ${project.id}`}
                      </SelectItem>
                    )) : (
                      <SelectItem disabled value="no-projects">
                        No hay proyectos disponibles
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedProject && (
                <div>
                  <Label htmlFor="deliverable">Entregable</Label>
                  <Select onValueChange={setSelectedDeliverable} value={selectedDeliverable}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un entregable" />
                    </SelectTrigger>
                    <SelectContent>
                      {deliverables && Array.isArray(deliverables) && deliverables.map((deliverable: any) => (
                        <SelectItem key={deliverable.id} value={deliverable.id.toString()}>
                          {deliverable.displayTitle || deliverable.title || deliverable.name || `Entregable ${deliverable.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Panel de puntuaciones */}
        <div className="lg:col-span-2">
          {selectedDeliverable ? (
            <div className="space-y-6">
              {/* Puntuaciones de Calidad */}
              <Card className="standard-card">
                <CardHeader>
                  <CardTitle>Indicadores de Robustez</CardTitle>
                  <CardDescription>
                    Puntuaciones del 1 al 10 para cada dimensión de calidad
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="narrative_quality">Calidad Narrativa</Label>
                      <Input
                        id="narrative_quality"
                        type="number"
                        min="1"
                        max="10"
                        step="0.1"
                        value={scores.narrative_quality_score}
                        onChange={(e) => handleInputChange('narrative_quality_score', e.target.value)}
                        placeholder="1.0 - 10.0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="graphics_effectiveness">Efectividad Gráfica</Label>
                      <Input
                        id="graphics_effectiveness"
                        type="number"
                        min="1"
                        max="10"
                        step="0.1"
                        value={scores.graphics_effectiveness_score}
                        onChange={(e) => handleInputChange('graphics_effectiveness_score', e.target.value)}
                        placeholder="1.0 - 10.0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="format_design">Diseño de Formato</Label>
                      <Input
                        id="format_design"
                        type="number"
                        min="1"
                        max="10"
                        step="0.1"
                        value={scores.format_design_score}
                        onChange={(e) => handleInputChange('format_design_score', e.target.value)}
                        placeholder="1.0 - 10.0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="relevant_insights">Insights Relevantes</Label>
                      <Input
                        id="relevant_insights"
                        type="number"
                        min="1"
                        max="10"
                        step="0.1"
                        value={scores.relevant_insights_score}
                        onChange={(e) => handleInputChange('relevant_insights_score', e.target.value)}
                        placeholder="1.0 - 10.0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="operations_feedback">Feedback Operaciones</Label>
                      <Input
                        id="operations_feedback"
                        type="number"
                        min="1"
                        max="10"
                        step="0.1"
                        value={scores.operations_feedback_score}
                        onChange={(e) => handleInputChange('operations_feedback_score', e.target.value)}
                        placeholder="1.0 - 10.0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="client_feedback">Feedback Cliente</Label>
                      <Input
                        id="client_feedback"
                        type="number"
                        min="1"
                        max="10"
                        step="0.1"
                        value={scores.client_feedback_score}
                        onChange={(e) => handleInputChange('client_feedback_score', e.target.value)}
                        placeholder="1.0 - 10.0"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="brief_compliance">Cumplimiento del Brief</Label>
                      <Input
                        id="brief_compliance"
                        type="number"
                        min="1"
                        max="10"
                        step="0.1"
                        value={scores.brief_compliance_score}
                        onChange={(e) => handleInputChange('brief_compliance_score', e.target.value)}
                        placeholder="1.0 - 10.0"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Métricas de Horas */}
              <Card className="standard-card">
                <CardHeader>
                  <CardTitle>Métricas de Tiempo</CardTitle>
                  <CardDescription>
                    Horas asignadas vs horas reales utilizadas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="hours_available">Horas Disponibles</Label>
                      <Input
                        id="hours_available"
                        type="number"
                        min="0"
                        step="0.5"
                        value={scores.hours_available}
                        onChange={(e) => handleInputChange('hours_available', e.target.value)}
                        placeholder="Ej: 40"
                      />
                    </div>
                    <div>
                      <Label htmlFor="hours_real">Horas Reales</Label>
                      <Input
                        id="hours_real"
                        type="number"
                        min="0"
                        step="0.5"
                        value={scores.hours_real}
                        onChange={(e) => handleInputChange('hours_real', e.target.value)}
                        placeholder="Ej: 38.5"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Notas */}
              <Card className="standard-card">
                <CardHeader>
                  <CardTitle>Observaciones</CardTitle>
                  <CardDescription>
                    Notas adicionales sobre la evaluación
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={scores.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    placeholder="Agregar observaciones sobre la calidad del entregable..."
                    rows={4}
                  />
                </CardContent>
              </Card>

              {/* Botón de guardar */}
              <div className="flex justify-end">
                <Button 
                  onClick={handleSave}
                  disabled={updateScoresMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {updateScoresMutation.isPending ? "Guardando..." : "Guardar Puntuaciones"}
                </Button>
              </div>
            </div>
          ) : (
            <Card className="standard-card">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Plus className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Selecciona un entregable</h3>
                <p className="text-muted-foreground text-center">
                  Selecciona un proyecto y entregable para comenzar a actualizar las puntuaciones de calidad.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default QualityScoresPage;