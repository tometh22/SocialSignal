import React, { useMemo, useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { 
  Card, 
  CardHeader, 
  CardContent, 
  CardTitle,
  CardDescription,
  CardFooter
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle, XCircle, Edit, PenSquare, Save } from 'lucide-react';

interface ProjectModoMetricsProps {
  deliverable: any; // Usamos any porque la estructura puede variar
  projectId: number;
}

const FixedProjectModoMetrics: React.FC<ProjectModoMetricsProps> = ({ deliverable, projectId }) => {
  const [setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Estado para los valores editables
  const [editableValues, setEditableValues] = useState({
    month: 1,
    analystId: null as number | null,
    analysts: "",
    pmId: null as number | null,
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

  // Inicializar los valores editables cuando cambia el entregable
  useEffect(() => {
    if (deliverable) {
      setEditableValues({
        month: deliverable.mes_entrega || 1,
        analystId: null,
        analysts: deliverable.analysts || "",
        pmId: null,
        pm: deliverable.pm || "",
        deliveryOnTime: deliverable.deliveryOnTime || false,
        retrabajo: deliverable.retrabajo || false,
        narrativeQuality: deliverable.narrative_quality || 0,
        graphicsEffectiveness: deliverable.graphics_effectiveness || 0,
        formatDesign: deliverable.format_design || 0,
        relevantInsights: deliverable.relevant_insights || 0,
        operationsFeedback: deliverable.operations_feedback || 0,
        hoursEstimated: deliverable.hoursEstimated || 40
      });
    }
  }, [deliverable]);
  
  // Función para guardar cambios directamente
  const handleSaveChanges = async () => {
    setIsSaving(true);
    
    try {
      // Convertir los valores a los campos esperados por el servidor
      const serverData = {
        mes_entrega: editableValues.month,
        analysts: editableValues.analysts,
        pm: editableValues.pm,
        delivery_on_time: editableValues.deliveryOnTime,
        retrabajo: editableValues.retrabajo,
        narrative_quality: editableValues.narrativeQuality,
        graphics_effectiveness: editableValues.graphicsEffectiveness,
        format_design: editableValues.formatDesign,
        relevant_insights: editableValues.relevantInsights,
        operations_feedback: editableValues.operationsFeedback,
        hours_estimated: editableValues.hoursEstimated
      };
      
      
      // Usar la nueva ruta simplificada para actualizar
      const response = await fetch(`/api/deliverables/${deliverable.id}/indicators`, { credentials: 'include',
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(serverData)
      });
      
      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(responseData.message || "Error al actualizar el entregable");
      }
      
      // Actualización exitosa
      toast({
        title: "Éxito",
        description: "Indicadores actualizados correctamente",
      });
      
      // Cerrar el diálogo
      setIsDialogOpen(false);
      
      // Invalidar la consulta para refrescar los datos
      queryClient.invalidateQueries({ queryKey: [`/api/modo/deliverables/project/${projectId}`] });
      
    } catch (error: any) {
      console.error("Error al actualizar el entregable:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el entregable",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Calcula el score total MODO
  const totalScore = useMemo(() => {
    // Ponderaciones exactas según el Excel MODO
    const weights = {
      narrative_quality: 0.15,       // Calidad Narrativa
      graphics_effectiveness: 0.15,  // Efectividad de los gráficos
      format_design: 0.10,           // Formato y Diseño
      relevant_insights: 0.20,       // Insights relevantes
      operations_feedback: 0.20,     // Feedback Operaciones
      client_feedback: 0.20,         // Feedback general cliente
      brief_compliance: 0.30         // Cumplimiento del brief
    };

    // Calcula el score ponderado
    let score = 0;
    let totalWeight = 0;

    for (const [key, weight] of Object.entries(weights)) {
      if (deliverable[key] !== null && deliverable[key] !== undefined) {
        score += deliverable[key] * weight;
        totalWeight += weight;
      }
    }

    // Normaliza el score
    return totalWeight > 0 ? score / (totalWeight / 1.3) : 0;
  }, [deliverable]);
  
  // Función auxiliar para obtener el nombre del mes
  const getMonthName = (monthNumber: number): string => {
    const months = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    return months[monthNumber - 1] || "Desconocido";
  };
  
  // Función para obtener el color según el score
  const getScoreColor = (score: number): string => {
    if (score >= 4.5) return "bg-green-100 text-green-800 hover:bg-green-200";
    if (score >= 3.5) return "bg-blue-100 text-blue-800 hover:bg-blue-200";
    if (score >= 2.5) return "bg-yellow-100 text-yellow-800 hover:bg-yellow-200";
    return "bg-red-100 text-red-800 hover:bg-red-200";
  };

  return (
    <Card className="shadow-md">
      <CardHeader className="bg-gray-50 border-b pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <span>Métricas MODO</span>
              <Badge variant="outline" className={getScoreColor(totalScore)}>
                {totalScore.toFixed(2)} / 5.0
              </Badge>
            </CardTitle>
            
            {/* Dialog para editar los valores */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="mt-2">
                  <Edit className="h-4 w-4 mr-2" />
                  Editar Indicadores
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Editar Indicadores de Robustez</DialogTitle>
                  <DialogDescription>
                    Modifica los valores de los indicadores para el proyecto {deliverable.name}
                  </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                  {/* Datos básicos */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Mes de Entrega</label>
                      <Select 
                        value={String(editableValues.month)}
                        onValueChange={(value) => setEditableValues({...editableValues, month: parseInt(value)})}
                      >
                        <SelectTrigger>
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
                      <label className="text-sm font-medium">Horas Disponibles</label>
                      <Input 
                        type="number" 
                        value={editableValues.hoursEstimated} 
                        onChange={(e) => setEditableValues({
                          ...editableValues, 
                          hoursEstimated: parseFloat(e.target.value || "0")
                        })}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Analistas</label>
                      <Input 
                        value={editableValues.analysts}
                        onChange={(e) => setEditableValues({...editableValues, analysts: e.target.value})}
                        placeholder="Nombres separados por coma"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Project Manager</label>
                      <Input 
                        value={editableValues.pm}
                        onChange={(e) => setEditableValues({...editableValues, pm: e.target.value})}
                        placeholder="Nombre del PM"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={editableValues.deliveryOnTime}
                        onCheckedChange={(checked) => 
                          setEditableValues({...editableValues, deliveryOnTime: checked})
                        }
                      />
                      <label className="text-sm font-medium">Entrega a Tiempo</label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={editableValues.retrabajo}
                        onCheckedChange={(checked) => 
                          setEditableValues({...editableValues, retrabajo: checked})
                        }
                      />
                      <label className="text-sm font-medium">Requirió Retrabajo</label>
                    </div>
                  </div>
                  
                  {/* Métricas */}
                  <h3 className="font-medium text-sm pt-2">Evaluación de Calidad (0-5)</h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <label className="text-sm">Calidad Narrativa</label>
                        <span className="text-sm font-medium">{editableValues.narrativeQuality.toFixed(1)}</span>
                      </div>
                      <Slider 
                        value={[editableValues.narrativeQuality]}
                        min={0}
                        max={5}
                        step={0.1}
                        onValueChange={(value) => setEditableValues({...editableValues, narrativeQuality: value[0]})}
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <label className="text-sm">Efectividad de Gráficos</label>
                        <span className="text-sm font-medium">{editableValues.graphicsEffectiveness.toFixed(1)}</span>
                      </div>
                      <Slider 
                        value={[editableValues.graphicsEffectiveness]}
                        min={0}
                        max={5}
                        step={0.1}
                        onValueChange={(value) => setEditableValues({...editableValues, graphicsEffectiveness: value[0]})}
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <label className="text-sm">Formato y Diseño</label>
                        <span className="text-sm font-medium">{editableValues.formatDesign.toFixed(1)}</span>
                      </div>
                      <Slider 
                        value={[editableValues.formatDesign]}
                        min={0}
                        max={5}
                        step={0.1}
                        onValueChange={(value) => setEditableValues({...editableValues, formatDesign: value[0]})}
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <label className="text-sm">Insights Relevantes</label>
                        <span className="text-sm font-medium">{editableValues.relevantInsights.toFixed(1)}</span>
                      </div>
                      <Slider 
                        value={[editableValues.relevantInsights]}
                        min={0}
                        max={5}
                        step={0.1}
                        onValueChange={(value) => setEditableValues({...editableValues, relevantInsights: value[0]})}
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <label className="text-sm">Feedback Operaciones</label>
                        <span className="text-sm font-medium">{editableValues.operationsFeedback.toFixed(1)}</span>
                      </div>
                      <Slider 
                        value={[editableValues.operationsFeedback]}
                        min={0}
                        max={5}
                        step={0.1}
                        onValueChange={(value) => setEditableValues({...editableValues, operationsFeedback: value[0]})}
                      />
                    </div>
                  </div>
                </div>
                
                <DialogFooter>
                  <div className="flex space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      type="button" 
                      onClick={handleSaveChanges}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <>Guardando...</>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Guardar Cambios
                        </>
                      )}
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <CardDescription>
              Métricas del Sistema de Seguimiento Operacional para este entregable
            </CardDescription>
          </div>
          
          <div className="text-right flex flex-col items-end">
            <div className="text-sm text-gray-500 mb-1">Mes de entrega</div>
            <div className="font-medium">
              {deliverable.mes_entrega ? getMonthName(deliverable.mes_entrega) : "No definido"}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sección izquierda: Información general y gráficos */}
          <div>
            <h3 className="text-md font-semibold mb-3">Datos del entregable</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-500">Analistas</p>
                <p className="font-medium">{deliverable.analysts || "No asignado"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Project Manager</p>
                <p className="font-medium">{deliverable.pm || "No asignado"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Entrega a tiempo</p>
                <p>
                  {deliverable.deliveryOnTime || deliverable.delivery_on_time ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Requirió retrabajo</p>
                <p>
                  {deliverable.retrabajo ? (
                    <CheckCircle className="h-5 w-5 text-red-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-green-500" />
                  )}
                </p>
              </div>
            </div>
            
            <Separator className="my-4" />
            
            <h3 className="text-md font-semibold mb-3">Uso de horas</h3>
            <div className="space-y-3 mb-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm">Horas disponibles</span>
                  <span className="text-sm font-medium">{deliverable.hoursEstimated || 0}</span>
                </div>
                <Progress value={100} className="h-2 bg-gray-200" />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm">Horas utilizadas</span>
                  <span className="text-sm font-medium">{deliverable.hoursActual || 0}</span>
                </div>
                <Progress 
                  value={deliverable.hoursEstimated ? (deliverable.hoursActual / deliverable.hoursEstimated) * 100 : 0} 
                  className="h-2 bg-gray-200" 
                />
              </div>
            </div>
          </div>
          
          {/* Sección derecha: Métricas de calidad */}
          <div>
            <h3 className="text-md font-semibold mb-3">Métricas de calidad</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">Calidad Narrativa</span>
                  <span className="text-sm font-medium">{deliverable.narrative_quality || 0}/5</span>
                </div>
                <Progress 
                  value={(deliverable.narrative_quality || 0) * 20} 
                  className="h-2 bg-gray-200" 
                />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">Efectividad de Gráficos</span>
                  <span className="text-sm font-medium">{deliverable.graphics_effectiveness || 0}/5</span>
                </div>
                <Progress 
                  value={(deliverable.graphics_effectiveness || 0) * 20} 
                  className="h-2 bg-gray-200" 
                />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">Formato y Diseño</span>
                  <span className="text-sm font-medium">{deliverable.format_design || 0}/5</span>
                </div>
                <Progress 
                  value={(deliverable.format_design || 0) * 20} 
                  className="h-2 bg-gray-200" 
                />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">Insights Relevantes</span>
                  <span className="text-sm font-medium">{deliverable.relevant_insights || 0}/5</span>
                </div>
                <Progress 
                  value={(deliverable.relevant_insights || 0) * 20} 
                  className="h-2 bg-gray-200" 
                />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">Feedback Operaciones</span>
                  <span className="text-sm font-medium">{deliverable.operations_feedback || 0}/5</span>
                </div>
                <Progress 
                  value={(deliverable.operations_feedback || 0) * 20} 
                  className="h-2 bg-gray-200" 
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FixedProjectModoMetrics;