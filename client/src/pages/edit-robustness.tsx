import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Card, 
  CardHeader, 
  CardContent, 
  CardTitle,
  CardDescription,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save } from 'lucide-react';

const EditRobustnessPage: React.FC = () => {
  const { id } = useParams();
  const parsedId = id ? parseInt(id) : null;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estado para los valores editables
  const [formData, setFormData] = useState({
    month: 1,
    analysts: "",
    pm: "",
    deliveryOnTime: false,
    retrabajo: false,
    narrativeQuality: 0,
    graphicsEffectiveness: 0,
    formatDesign: 0,
    relevantInsights: 0,
    operationsFeedback: 0,
    hoursEstimated: 0
  });
  
  // Obtener los datos del entregable
  const { data: deliverable, isLoading, error } = useQuery({
    queryKey: ['/api/deliverables', parsedId],
    queryFn: async () => {
      if (!parsedId) return null;
      const response = await fetch(`/api/deliverables/${parsedId}`);
      if (!response.ok) {
        throw new Error('No se pudo cargar el entregable');
      }
      return response.json();
    },
    enabled: !!parsedId
  });
  
  // Inicializar los valores editables cuando cambia el entregable
  useEffect(() => {
    if (deliverable) {
      setFormData({
        month: deliverable.mes_entrega || 1,
        analysts: deliverable.analysts || "",
        pm: deliverable.pm || "",
        deliveryOnTime: deliverable.delivery_on_time || false,
        retrabajo: deliverable.retrabajo || false,
        narrativeQuality: deliverable.narrative_quality || 0,
        graphicsEffectiveness: deliverable.graphics_effectiveness || 0,
        formatDesign: deliverable.format_design || 0,
        relevantInsights: deliverable.relevant_insights || 0,
        operationsFeedback: deliverable.operations_feedback || 0,
        hoursEstimated: deliverable.hours_estimated || 40
      });
    }
  }, [deliverable]);

  // Función para guardar cambios directamente
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Formatear los datos para la API
      const apiData = {
        mes_entrega: formData.month,
        analysts: formData.analysts,
        pm: formData.pm,
        delivery_on_time: formData.deliveryOnTime,
        retrabajo: formData.retrabajo,
        narrative_quality: formData.narrativeQuality,
        graphics_effectiveness: formData.graphicsEffectiveness,
        format_design: formData.formatDesign,
        relevant_insights: formData.relevantInsights,
        operations_feedback: formData.operationsFeedback,
        hours_estimated: formData.hoursEstimated
      };

      console.log('Enviando datos al servidor:', apiData);

      // Usar la API directa que creamos
      const response = await fetch(`/api/deliverables/${parsedId}/indicators`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(apiData)
      });

      // Leer la respuesta
      const data = await response.json();

      // Verificar si hubo error
      if (!response.ok) {
        throw new Error(data.message || 'Error al actualizar indicadores');
      }

      // Mostrar mensaje de éxito
      toast({
        title: 'Éxito',
        description: 'Los indicadores se han actualizado correctamente'
      });

      // Redirigir a la página del proyecto
      if (deliverable?.project_id) {
        // Invalidar caché para actualizar los datos
        queryClient.invalidateQueries({ queryKey: [`/api/modo/deliverables/project/${deliverable.project_id}`] });
        // Redirigir
        setLocation(`/project-analytics/${deliverable.project_id}`);
      } else {
        setLocation(`/active-projects`);
      }
    } catch (error: any) {
      console.error('Error al guardar los indicadores:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudieron actualizar los indicadores',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Obtener nombre del mes según su número
  const getMonthName = (monthNumber: number): string => {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[monthNumber - 1] || 'Desconocido';
  };

  if (isLoading) {
    return (
      <div className="container py-10">
        <Card>
          <CardContent className="py-10 text-center">
            Cargando entregable...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !deliverable) {
    return (
      <div className="container py-10">
        <Card>
          <CardContent className="py-10 text-center">
            No se pudo cargar el entregable. Intente nuevamente.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setLocation(`/project-analytics/${deliverable.project_id}`)}
            className="mr-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al proyecto
          </Button>
          <h1 className="text-2xl font-bold">Editar Indicadores de Robustez</h1>
        </div>
        
        <div>
          <p className="text-sm text-muted-foreground">
            Proyecto: <span className="font-medium">{deliverable.title || deliverable.name}</span>
          </p>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Indicadores de Robustez</CardTitle>
          <CardDescription>
            Actualiza los valores para mejorar el seguimiento del proyecto
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="month">Mes de Entrega</Label>
                <Select 
                  value={String(formData.month)}
                  onValueChange={(value) => setFormData({...formData, month: parseInt(value)})}
                >
                  <SelectTrigger id="month">
                    <SelectValue placeholder="Seleccionar mes" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                      <SelectItem key={month} value={String(month)}>
                        {getMonthName(month)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="hoursEstimated">Horas Disponibles</Label>
                <Input 
                  id="hoursEstimated"
                  type="number" 
                  value={formData.hoursEstimated} 
                  onChange={(e) => setFormData({
                    ...formData, 
                    hoursEstimated: parseFloat(e.target.value || "0")
                  })}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="analysts">Analistas</Label>
                <Input 
                  id="analysts"
                  value={formData.analysts}
                  onChange={(e) => setFormData({...formData, analysts: e.target.value})}
                  placeholder="Nombres separados por coma"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="pm">Project Manager</Label>
                <Input 
                  id="pm"
                  value={formData.pm}
                  onChange={(e) => setFormData({...formData, pm: e.target.value})}
                  placeholder="Nombre del PM"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="deliveryOnTime"
                  checked={formData.deliveryOnTime}
                  onCheckedChange={(checked) => 
                    setFormData({...formData, deliveryOnTime: checked})
                  }
                />
                <Label htmlFor="deliveryOnTime">Entrega a Tiempo</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="retrabajo"
                  checked={formData.retrabajo}
                  onCheckedChange={(checked) => 
                    setFormData({...formData, retrabajo: checked})
                  }
                />
                <Label htmlFor="retrabajo">Requirió Retrabajo</Label>
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Evaluación de Calidad (0-5)</h3>
              
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <Label htmlFor="narrativeQuality">Calidad Narrativa</Label>
                    <span className="text-sm font-medium">{formData.narrativeQuality.toFixed(1)}</span>
                  </div>
                  <Slider 
                    id="narrativeQuality"
                    value={[formData.narrativeQuality]}
                    min={0}
                    max={5}
                    step={0.1}
                    onValueChange={(value) => setFormData({...formData, narrativeQuality: value[0]})}
                  />
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <Label htmlFor="graphicsEffectiveness">Efectividad de Gráficos</Label>
                    <span className="text-sm font-medium">{formData.graphicsEffectiveness.toFixed(1)}</span>
                  </div>
                  <Slider 
                    id="graphicsEffectiveness"
                    value={[formData.graphicsEffectiveness]}
                    min={0}
                    max={5}
                    step={0.1}
                    onValueChange={(value) => setFormData({...formData, graphicsEffectiveness: value[0]})}
                  />
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <Label htmlFor="formatDesign">Formato y Diseño</Label>
                    <span className="text-sm font-medium">{formData.formatDesign.toFixed(1)}</span>
                  </div>
                  <Slider 
                    id="formatDesign"
                    value={[formData.formatDesign]}
                    min={0}
                    max={5}
                    step={0.1}
                    onValueChange={(value) => setFormData({...formData, formatDesign: value[0]})}
                  />
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <Label htmlFor="relevantInsights">Insights Relevantes</Label>
                    <span className="text-sm font-medium">{formData.relevantInsights.toFixed(1)}</span>
                  </div>
                  <Slider 
                    id="relevantInsights"
                    value={[formData.relevantInsights]}
                    min={0}
                    max={5}
                    step={0.1}
                    onValueChange={(value) => setFormData({...formData, relevantInsights: value[0]})}
                  />
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <Label htmlFor="operationsFeedback">Feedback Operaciones</Label>
                    <span className="text-sm font-medium">{formData.operationsFeedback.toFixed(1)}</span>
                  </div>
                  <Slider 
                    id="operationsFeedback"
                    value={[formData.operationsFeedback]}
                    min={0}
                    max={5}
                    step={0.1}
                    onValueChange={(value) => setFormData({...formData, operationsFeedback: value[0]})}
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setLocation(`/project-analytics/${deliverable.project_id}`)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar Cambios
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default EditRobustnessPage;