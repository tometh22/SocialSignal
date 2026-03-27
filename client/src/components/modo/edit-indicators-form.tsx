import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface EditIndicatorsFormProps {
  deliverableId: number;
  projectId: number;
  initialData: any;
  onSuccess: () => void;
}

const EditIndicatorsForm: React.FC<EditIndicatorsFormProps> = ({ 
  deliverableId, 
  projectId, 
  initialData,
  onSuccess
}) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    month: 1,
    analysts: '',
    pm: '',
    deliveryOnTime: false,
    retrabajo: false,
    narrativeQuality: 0,
    graphicsEffectiveness: 0,
    formatDesign: 0,
    relevantInsights: 0,
    operationsFeedback: 0,
    hoursEstimated: 0
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inicializar el formulario con los datos actuales
  useEffect(() => {
    if (initialData) {
      setFormData({
        month: initialData.mes_entrega || 1,
        analysts: initialData.analysts || '',
        pm: initialData.pm || '',
        deliveryOnTime: initialData.delivery_on_time || false,
        retrabajo: initialData.retrabajo || false,
        narrativeQuality: initialData.narrative_quality || 0,
        graphicsEffectiveness: initialData.graphics_effectiveness || 0,
        formatDesign: initialData.format_design || 0,
        relevantInsights: initialData.relevant_insights || 0,
        operationsFeedback: initialData.operations_feedback || 0,
        hoursEstimated: initialData.hours_estimated || 40
      });
    }
  }, [initialData]);

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


      // Hacer la solicitud al servidor usando Fetch API
      const response = await fetch(`/api/deliverables/${deliverableId}/indicators`, { credentials: 'include',
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

      // Llamar al callback de éxito
      onSuccess();
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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Editar Indicadores de Robustez</CardTitle>
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
          
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default EditIndicatorsForm;