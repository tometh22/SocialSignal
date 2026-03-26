import React, { useState, useEffect } from 'react';
import { useRoute, Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuthHeader } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { SelectValue, SelectTrigger, SelectItem, SelectContent, Select } from '@/components/ui/select';
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const EditRobustnessPage = () => {
  const [, params] = useRoute('/edit-indicators/:id');
  const id = params?.id ? parseInt(params.id) : null;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Estado para almacenar todos los valores editables
  const [formData, setFormData] = useState({
    mes_entrega: 1,
    analysts: "",
    analystId: null,
    pm: "",
    pmId: null,
    deliveryOnTime: false,
    retrabajo: false,
    narrativeQuality: 0,
    graphicsEffectiveness: 0,
    formatDesign: 0,
    relevantInsights: 0,
    operationsFeedback: 0,
    hoursEstimated: 40,
    hoursActual: 0
  });
  
  // Consultar los datos del entregable
  const { data: deliverable, isLoading } = useQuery<any>({
    queryKey: [`/api/deliverables/${id}`],
    enabled: !!id
  });
  
  // Consultar personal disponible
  const { data: personnel } = useQuery({
    queryKey: ['/api/personnel'],
    enabled: !!id
  });
  
  // Consultar roles
  const { data: roles } = useQuery({
    queryKey: ['/api/roles'],
    enabled: !!id
  });
  
  // Consultar entradas de tiempo
  const { data: timeEntries } = useQuery({
    queryKey: [`/api/time-entries/project/${deliverable?.project_id}`],
    enabled: !!deliverable?.project_id
  });
  
  // Actualizar formulario cuando se carguen los datos
  useEffect(() => {
    if (deliverable) {
      setFormData({
        mes_entrega: deliverable.mes_entrega || 1,
        analysts: deliverable.analysts || "",
        analystId: null,
        pm: deliverable.pm || "",
        pmId: null,
        deliveryOnTime: deliverable.deliveryOnTime || false,
        retrabajo: deliverable.retrabajo || false,
        narrativeQuality: deliverable.narrative_quality || 0,
        graphicsEffectiveness: deliverable.graphics_effectiveness || 0,
        formatDesign: deliverable.format_design || 0,
        relevantInsights: deliverable.relevant_insights || 0,
        operationsFeedback: deliverable.operations_feedback || 0,
        hoursEstimated: deliverable.hours_available || 40,
        hoursActual: calculateTotalHours(timeEntries || [])
      });
    }
  }, [deliverable, timeEntries]);
  
  // Función para calcular horas totales
  const calculateTotalHours = (entries: any[]) => {
    return entries.reduce((total, entry) => total + entry.hours, 0);
  };
  
  // Calcular puntuación total
  const calculateTotalScore = () => {
    const scores = [
      formData.narrativeQuality,
      formData.graphicsEffectiveness,
      formData.formatDesign,
      formData.relevantInsights,
      formData.operationsFeedback
    ];
    
    // Calcular promedio de valores no cero
    const validScores = scores.filter(score => score > 0);
    if (validScores.length === 0) return 0;
    
    return validScores.reduce((a, b) => a + b, 0) / validScores.length;
  };
  
  // Función para obtener color según puntuación
  const getScoreColor = (score: number) => {
    if (score >= 4) return "bg-green-100 text-green-800 hover:bg-green-200";
    if (score >= 3) return "bg-yellow-100 text-yellow-800 hover:bg-yellow-200";
    return "bg-red-100 text-red-800 hover:bg-red-200";
  };
  
  // Mutación para guardar los cambios directamente mediante el nuevo endpoint
  const updateIndicatorsMutation = useMutation({
    mutationFn: async (data: any) => {
      // Mapear los datos del formulario al formato que espera el backend
      const serverData = {
        mes_entrega: data.mes_entrega,
        analysts: data.analysts,
        pm: data.pm,
        delivery_on_time: data.deliveryOnTime,
        retrabajo: data.retrabajo,
        narrative_quality: data.narrativeQuality,
        graphics_effectiveness: data.graphicsEffectiveness,
        format_design: data.formatDesign,
        relevant_insights: data.relevantInsights,
        operations_feedback: data.operationsFeedback,
        // Usar el nombre correcto para las horas estimadas
        hours_available: data.hoursEstimated
      };
      
      
      // Usar la nueva ruta especializada para indicadores
      return fetch(`/api/deliverables/${id}/indicators`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader()
        },
        body: JSON.stringify(serverData)
      }).then(response => {
        if (!response.ok) {
          throw new Error('Error al actualizar los indicadores');
        }
        return response.json();
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Éxito",
        description: "Indicadores actualizados correctamente",
      });
      
      // Actualizar los datos locales con los valores actualizados
      if (data) {
        setFormData({
          ...formData,
          narrativeQuality: data.narrative_quality || 0,
          graphicsEffectiveness: data.graphics_effectiveness || 0,
          formatDesign: data.format_design || 0,
          relevantInsights: data.relevant_insights || 0,
          operationsFeedback: data.operations_feedback || 0,
          mes_entrega: data.mes_entrega || 1,
          retrabajo: data.retrabajo || false,
          deliveryOnTime: data.on_time || false,
          analysts: data.analysts || "",
          pm: data.pm || "",
          hoursEstimated: data.hours_available || 0,
          hoursActual: calculateTotalHours(timeEntries || [])
        });
      }
      
      // Invalidar consultas para refrescar datos en segundo plano
      queryClient.invalidateQueries({ queryKey: [`/api/deliverables/${id}`] });
      if (deliverable?.project_id) {
        queryClient.invalidateQueries({ queryKey: [`/api/modo/deliverables/project/${deliverable.project_id}`] });
      }
      
      // NO redirigimos - permanecemos en la misma página
    },
    onError: (error) => {
      console.error("Error al actualizar indicadores:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar los indicadores. Intenta nuevamente.",
        variant: "destructive"
      });
    }
  });
  
  // Función para manejar el envío del formulario
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateIndicatorsMutation.mutate(formData);
    
    // Después de enviar el formulario, vamos a forzar la recarga del entregable
    setTimeout(() => {
      fetch(`/api/deliverables/${id}`)
        .then(response => response.json())
        .then(data => {
          setFormData({
            mes_entrega: data.mes_entrega || 1,
            analysts: data.analysts || "",
            analystId: null,
            pm: data.pm || "",
            pmId: null,
            deliveryOnTime: data.on_time || false,
            retrabajo: data.retrabajo || false,
            narrativeQuality: data.narrative_quality || 0,
            graphicsEffectiveness: data.graphics_effectiveness || 0,
            formatDesign: data.format_design || 0,
            relevantInsights: data.relevant_insights || 0,
            operationsFeedback: data.operations_feedback || 0,
            hoursEstimated: data.hours_available || 0,
            hoursActual: calculateTotalHours(timeEntries || [])
          });
          
          toast({
            title: "Datos actualizados correctamente",
            description: "Los cambios han sido guardados en la base de datos",
          });
        })
        .catch(error => {
          console.error("Error recargando datos:", error);
        });
    }, 500); // Esperar 500ms para asegurarnos que la actualización se complete
  };
  
  // Función para actualizar campos del formulario
  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">Cargando datos...</span>
      </div>
    );
  }
  
  if (!deliverable) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <h2 className="text-xl font-bold mb-2">Entregable no encontrado</h2>
        <p className="text-muted-foreground mb-4">No se encontró el entregable solicitado</p>
        <Button onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
      </div>
    );
  }
  
  // Calcular la puntuación total
  const totalScore = calculateTotalScore();
  
  // No necesitamos navegación por wouter para esta página
  
  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Editar Indicadores de Robustez</h1>
          <p className="text-muted-foreground">
            Proyecto: {deliverable.title} (ID: {deliverable.id})
          </p>
        </div>
        {deliverable?.project_id ? (
          <Link href={`/project-analytics/${deliverable.project_id}`}>
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al Proyecto
            </Button>
          </Link>
        ) : (
          <Link href="/active-projects">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a Proyectos
            </Button>
          </Link>
        )}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Información del proyecto */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Información del Proyecto</CardTitle>
            <CardDescription>Detalles básicos del entregable</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="projectId">ID del Proyecto</Label>
                <Input id="projectId" value={deliverable.project_id} disabled />
              </div>
              <div>
                <Label htmlFor="deliverableId">ID del Entregable</Label>
                <Input id="deliverableId" value={deliverable.id} disabled />
              </div>
              <div>
                <Label htmlFor="title">Título</Label>
                <Input id="title" value={deliverable.title} disabled />
              </div>
              <div>
                <Label htmlFor="month">Mes de Entrega</Label>
                <Select 
                  value={formData.mes_entrega.toString()} 
                  onValueChange={(value) => handleInputChange('mes_entrega', parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar mes" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => (
                      <SelectItem key={month} value={month.toString()}>
                        Mes {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="totalScore">Puntuación Total</Label>
                  <Badge variant="outline" className={getScoreColor(totalScore)}>
                    {totalScore.toFixed(2)} / 5.0
                  </Badge>
                </div>
                <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${totalScore >= 4 ? 'bg-green-500' : totalScore >= 3 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${(totalScore / 5) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Formulario principal */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Editar Indicadores</CardTitle>
            <CardDescription>Actualiza los valores de robustez para este entregable</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Equipo */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Equipo de Proyecto</h3>
                  <div>
                    <Label htmlFor="analysts">Analistas (separados por coma)</Label>
                    <div className="space-y-2">
                      <div className="flex space-x-2">
                        <Select 
                          value={formData.analystId || ""} 
                          onValueChange={(value) => {
                            if (value) {
                              const analyst = personnel?.find(p => p.id === parseInt(value));
                              if (analyst) {
                                // Si ya hay analistas, añadir con coma
                                const currentAnalysts = formData.analysts ? formData.analysts.split(',').map(a => a.trim()) : [];
                                
                                // Verificar si el analista ya está en la lista
                                if (!currentAnalysts.includes(analyst.name)) {
                                  currentAnalysts.push(analyst.name);
                                }
                                
                                // Actualizar con la lista completa
                                handleInputChange('analysts', currentAnalysts.join(', '));
                                handleInputChange('analystId', analyst.id);
                              }
                            }
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Añadir analista" />
                          </SelectTrigger>
                          <SelectContent>
                            {personnel?.filter(p => {
                              const role = roles?.find(r => r.id === p.roleId);
                              return role && (role.name.includes('Analista') || role.name.includes('Analyst'));
                            }).map((analyst) => (
                              <SelectItem key={analyst.id} value={analyst.id.toString()}>
                                {analyst.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Input
                          id="analysts"
                          value={formData.analysts}
                          onChange={(e) => handleInputChange('analysts', e.target.value)}
                          placeholder="Nombres de analistas (ej: Ana, Juan, María)"
                        />
                        
                        {/* Mostrar chips o badges para los analistas seleccionados */}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {formData.analysts.split(',').map((analyst, index) => (
                            analyst.trim() && (
                              <Badge 
                                key={index} 
                                variant="secondary"
                                className="flex items-center gap-1"
                              >
                                {analyst.trim()}
                              </Badge>
                            )
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="pm">Project Manager</Label>
                    <div className="flex space-x-2">
                      <Select 
                        value={formData.pmId || ""} 
                        onValueChange={(value) => {
                          if (value) {
                            const manager = personnel?.find(p => p.id === parseInt(value));
                            if (manager) {
                              handleInputChange('pm', manager.name);
                              handleInputChange('pmId', manager.id);
                            }
                          }
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seleccionar PM" />
                        </SelectTrigger>
                        <SelectContent>
                          {personnel?.filter(p => {
                            const role = roles?.find(r => r.id === p.roleId);
                            return role && (role.name.includes('PM') || role.name.includes('Project Manager'));
                          }).map((manager) => (
                            <SelectItem key={manager.id} value={manager.id.toString()}>
                              {manager.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        id="pm"
                        value={formData.pm}
                        onChange={(e) => handleInputChange('pm', e.target.value)}
                        placeholder="Nombre del PM"
                      />
                    </div>
                  </div>
                  <div className="flex space-x-6">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="deliveryOnTime"
                        checked={formData.deliveryOnTime}
                        onCheckedChange={(checked) => handleInputChange('deliveryOnTime', checked)}
                      />
                      <Label htmlFor="deliveryOnTime">Entrega a tiempo</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="retrabajo"
                        checked={formData.retrabajo}
                        onCheckedChange={(checked) => handleInputChange('retrabajo', checked)}
                      />
                      <Label htmlFor="retrabajo">Requirió retrabajo</Label>
                    </div>
                  </div>
                </div>
                
                {/* Horas */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Horas y Estimación</h3>
                  <div>
                    <Label htmlFor="hoursEstimated">Horas Estimadas</Label>
                    <Input
                      id="hoursEstimated"
                      type="number"
                      value={formData.hoursEstimated}
                      onChange={(e) => handleInputChange('hoursEstimated', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="hoursActual">Horas Registradas</Label>
                    <Input
                      id="hoursActual"
                      type="number"
                      value={formData.hoursActual}
                      disabled
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Total de horas registradas en el sistema de tiempo
                    </p>
                  </div>
                  <div>
                    <Label>Eficiencia de Tiempo</Label>
                    <div className="flex items-center mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2.5 mr-2">
                        <div 
                          className={`h-2.5 rounded-full ${
                            formData.hoursActual <= formData.hoursEstimated 
                              ? 'bg-green-500' 
                              : formData.hoursActual <= formData.hoursEstimated * 1.2 
                                ? 'bg-yellow-500' 
                                : 'bg-red-500'
                          }`}
                          style={{ 
                            width: `${Math.min(
                              (formData.hoursActual / Math.max(formData.hoursEstimated, 1)) * 100, 
                              100
                            )}%` 
                          }}
                        ></div>
                      </div>
                      <span className="text-sm">
                        {Math.round((formData.hoursActual / Math.max(formData.hoursEstimated, 1)) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Métricas de calidad */}
              <div className="pt-4 border-t space-y-6">
                <h3 className="text-lg font-medium">Métricas de Calidad</h3>
                
                <div>
                  <div className="flex justify-between mb-2">
                    <Label htmlFor="narrativeQuality">Calidad de Narrativa</Label>
                    <span className="text-sm font-medium">{formData.narrativeQuality}</span>
                  </div>
                  <Slider
                    id="narrativeQuality"
                    min={0}
                    max={5}
                    step={0.5}
                    value={[formData.narrativeQuality]}
                    onValueChange={(value) => handleInputChange('narrativeQuality', value[0])}
                  />
                </div>
                
                <div>
                  <div className="flex justify-between mb-2">
                    <Label htmlFor="graphicsEffectiveness">Efectividad Gráfica</Label>
                    <span className="text-sm font-medium">{formData.graphicsEffectiveness}</span>
                  </div>
                  <Slider
                    id="graphicsEffectiveness"
                    min={0}
                    max={5}
                    step={0.5}
                    value={[formData.graphicsEffectiveness]}
                    onValueChange={(value) => handleInputChange('graphicsEffectiveness', value[0])}
                  />
                </div>
                
                <div>
                  <div className="flex justify-between mb-2">
                    <Label htmlFor="formatDesign">Diseño de Formato</Label>
                    <span className="text-sm font-medium">{formData.formatDesign}</span>
                  </div>
                  <Slider
                    id="formatDesign"
                    min={0}
                    max={5}
                    step={0.5}
                    value={[formData.formatDesign]}
                    onValueChange={(value) => handleInputChange('formatDesign', value[0])}
                  />
                </div>
                
                <div>
                  <div className="flex justify-between mb-2">
                    <Label htmlFor="relevantInsights">Insights Relevantes</Label>
                    <span className="text-sm font-medium">{formData.relevantInsights}</span>
                  </div>
                  <Slider
                    id="relevantInsights"
                    min={0}
                    max={5}
                    step={0.5}
                    value={[formData.relevantInsights]}
                    onValueChange={(value) => handleInputChange('relevantInsights', value[0])}
                  />
                </div>
                
                <div>
                  <div className="flex justify-between mb-2">
                    <Label htmlFor="operationsFeedback">Feedback Operacional</Label>
                    <span className="text-sm font-medium">{formData.operationsFeedback}</span>
                  </div>
                  <Slider
                    id="operationsFeedback"
                    min={0}
                    max={5}
                    step={0.5}
                    value={[formData.operationsFeedback]}
                    onValueChange={(value) => handleInputChange('operationsFeedback', value[0])}
                  />
                </div>
              </div>
              
              <div className="pt-6 flex justify-between">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => window.history.back()}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateIndicatorsMutation.isPending}
                >
                  {updateIndicatorsMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Guardar Cambios
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EditRobustnessPage;