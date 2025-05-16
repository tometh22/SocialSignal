import React, { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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

// Función para obtener el nombre del mes
const getMonthName = (monthNumber: number) => {
  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  
  return months[monthNumber - 1] || "Desconocido";
};

// Función para obtener color según puntuación
const getScoreColor = (score: number) => {
  if (score >= 4.5) return "bg-green-100 text-green-800 border-green-300";
  if (score >= 3.5) return "bg-blue-100 text-blue-800 border-blue-300";
  if (score >= 2.5) return "bg-yellow-100 text-yellow-800 border-yellow-300";
  return "bg-red-100 text-red-800 border-red-300";
};

// Calcula el progreso para Progress component (base 100)
const calculateProgress = (value: number, max: number = 5) => {
  return (value / max) * 100;
};

export function ProjectModoMetrics({ deliverable, projectId }: ProjectModoMetricsProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Estado para los valores editables
  const [editableValues, setEditableValues] = useState({
    month: deliverable?.mes_entrega || 1,
    analystId: null,
    analysts: deliverable?.analysts || "",
    pmId: null,
    pm: deliverable?.pm || "",
    deliveryOnTime: deliverable?.deliveryOnTime || false,
    retrabajo: deliverable?.retrabajo || false,
    narrativeQuality: deliverable?.narrative_quality || 0,
    graphicsEffectiveness: deliverable?.graphics_effectiveness || 0,
    formatDesign: deliverable?.format_design || 0,
    relevantInsights: deliverable?.relevant_insights || 0,
    operationsFeedback: deliverable?.operations_feedback || 0,
    hoursEstimated: deliverable?.hoursEstimated || 40
  });
  
  // Actualizar valores editables cuando cambie el entregable
  React.useEffect(() => {
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
  
  // Mutación para actualizar el entregable
  const updateDeliverableMutation = useMutation({
    mutationFn: async (data: any) => {
      // Mapeo para el backend
      const serverData = {
        name: deliverable.name,
        deliveryMonth: String(data.month),
        mes_entrega: data.month,
        analystId: data.analystId,
        analysts: data.analysts,
        pmId: data.pmId,
        pm: data.pm,
        deliveryOnTime: data.deliveryOnTime,
        retrabajo: data.retrabajo,
        narrativeQuality: data.narrativeQuality,
        graphicsEffectiveness: data.graphicsEffectiveness,
        formatDesign: data.formatDesign,
        relevantInsights: data.relevantInsights,
        operationsFeedback: data.operationsFeedback,
        hoursEstimated: data.hoursEstimated,
      };
      
      console.log("Enviando datos al servidor:", serverData);
      
      const response = await fetch(`/api/deliverables/${deliverable.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serverData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error al actualizar el entregable");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Éxito",
        description: "Indicadores actualizados correctamente",
      });
      // Cerrar el diálogo
      setIsDialogOpen(false);
      // Actualizar los datos
      queryClient.invalidateQueries({ queryKey: [`/api/modo/deliverables/project/${projectId}`] });
    },
    onError: (error: any) => {
      console.error("Error al actualizar indicadores:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar los indicadores",
        variant: "destructive"
      });
    }
  });
  
  // Manejar el guardado de valores
  const handleSaveValues = () => {
    updateDeliverableMutation.mutate(editableValues);
  };
  
  // Cargar datos específicos para Sony One directamente desde la imagen
  const loadSonyOneData = () => {
    const sonyOneValues = {
      month: 1,
      analystId: null,
      analysts: "Vanti, Trini",
      pmId: null,
      pm: "Vanti",
      deliveryOnTime: true,
      retrabajo: true,
      narrativeQuality: 5.0,
      graphicsEffectiveness: 5.0,
      formatDesign: 5.0,
      relevantInsights: 5.0,
      operationsFeedback: 5.0,
      hoursEstimated: 40
    };
    
    // Actualizar el estado para reflejar los datos de la imagen
    setEditableValues(sonyOneValues);
    
    // Guardar inmediatamente los cambios
    updateDeliverableMutation.mutate(sonyOneValues);
  };

  // Si no hay entregable, muestra un mensaje
  if (!deliverable) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Indicadores de Robustez</CardTitle>
          <CardDescription>No hay datos de indicadores disponibles para este proyecto</CardDescription>
        </CardHeader>
      </Card>
    );
  }

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
                
                <DialogFooter className="flex justify-between">
                  <div>
                    <Button 
                      type="button" 
                      variant="secondary"
                      onClick={loadSonyOneData}
                      disabled={updateDeliverableMutation.isPending}
                      className="mr-2"
                    >
                      Cargar Datos Sony One
                    </Button>
                  </div>
                  <div className="flex space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      type="button" 
                      onClick={handleSaveValues}
                      disabled={updateDeliverableMutation.isPending}
                    >
                      {updateDeliverableMutation.isPending ? (
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
          <Button 
            variant="outline" 
            size="sm" 
            className="flex items-center gap-1 text-xs"
            onClick={() => setLocation(`/edit-deliverable/${deliverable.id}`)}
          >
            <PenSquare className="h-3.5 w-3.5" />
            Editar Indicadores
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-6">
        {/* Información general */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <h3 className="font-semibold text-sm mb-2">Información General</h3>
            <div className="bg-gray-50 p-3 rounded-md space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700">Entregable:</span>
                <span className="font-medium">{deliverable.title}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700">Mes de entrega:</span>
                <Badge variant="outline">
                  {deliverable.mes_entrega ? getMonthName(deliverable.mes_entrega) : "No especificado"}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700">Entrega a tiempo:</span>
                <span>{deliverable.on_time ? 
                  <CheckCircle className="h-5 w-5 text-green-600" /> : 
                  <XCircle className="h-5 w-5 text-red-600" />}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700">Requirió retrabajo:</span>
                <span>
                  {deliverable.retrabajo !== undefined ? (deliverable.retrabajo ? 
                    <CheckCircle className="h-5 w-5 text-red-600" /> : 
                    <XCircle className="h-5 w-5 text-green-600" />
                  ) : "-"}
                </span>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold text-sm mb-2">Horas de Trabajo</h3>
            <div className="bg-gray-50 p-3 rounded-md space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700">Horas disponibles:</span>
                <span className="font-medium">{deliverable.hours_available || "-"} horas</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700">Horas reales:</span>
                <span className="font-medium">{deliverable.hours_real || "-"} horas</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700">Cumplimiento:</span>
                <Badge variant="outline" className={getScoreColor(deliverable.hours_compliance * 5 || 0)}>
                  {(deliverable.hours_compliance * 5)?.toFixed(1) || "-"} / 5.0
                </Badge>
              </div>
              {deliverable.hours_available && deliverable.hours_real && (
                <div className="pt-1">
                  <Progress
                    value={(deliverable.hours_real / deliverable.hours_available) * 100}
                    className="h-2"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabla de Métricas */}
        <h3 className="font-semibold text-sm mb-2">Detalle de Métricas de Calidad</h3>
        <Table className="border">
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="w-[250px]">Métrica</TableHead>
              <TableHead className="text-center">Valor</TableHead>
              <TableHead>Barra de Progreso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Calidad Narrativa</TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className={getScoreColor(deliverable.narrative_quality || 0)}>
                  {deliverable.narrative_quality?.toFixed(1) || "-"}
                </Badge>
              </TableCell>
              <TableCell>
                <Progress value={calculateProgress(deliverable.narrative_quality || 0)} className="h-2" />
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Efectividad de Gráficos</TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className={getScoreColor(deliverable.graphics_effectiveness || 0)}>
                  {deliverable.graphics_effectiveness?.toFixed(1) || "-"}
                </Badge>
              </TableCell>
              <TableCell>
                <Progress value={calculateProgress(deliverable.graphics_effectiveness || 0)} className="h-2" />
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Formato y Diseño</TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className={getScoreColor(deliverable.format_design || 0)}>
                  {deliverable.format_design?.toFixed(1) || "-"}
                </Badge>
              </TableCell>
              <TableCell>
                <Progress value={calculateProgress(deliverable.format_design || 0)} className="h-2" />
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Insights Relevantes</TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className={getScoreColor(deliverable.relevant_insights || 0)}>
                  {deliverable.relevant_insights?.toFixed(1) || "-"}
                </Badge>
              </TableCell>
              <TableCell>
                <Progress value={calculateProgress(deliverable.relevant_insights || 0)} className="h-2" />
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Feedback Operaciones</TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className={getScoreColor(deliverable.operations_feedback || 0)}>
                  {deliverable.operations_feedback?.toFixed(1) || "-"}
                </Badge>
              </TableCell>
              <TableCell>
                <Progress value={calculateProgress(deliverable.operations_feedback || 0)} className="h-2" />
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Feedback Cliente</TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className={getScoreColor(deliverable.client_feedback || 0)}>
                  {deliverable.client_feedback?.toFixed(1) || "-"}
                </Badge>
              </TableCell>
              <TableCell>
                <Progress value={calculateProgress(deliverable.client_feedback || 0)} className="h-2" />
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Cumplimiento del Brief</TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className={getScoreColor(deliverable.brief_compliance || 0)}>
                  {deliverable.brief_compliance?.toFixed(1) || "-"}
                </Badge>
              </TableCell>
              <TableCell>
                <Progress value={calculateProgress(deliverable.brief_compliance || 0)} className="h-2" />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        {/* Notas y comentarios */}
        {deliverable.notes && (
          <div className="mt-6">
            <h3 className="font-semibold text-sm mb-2">Notas</h3>
            <div className="bg-gray-50 p-3 rounded-md">
              <p className="text-sm text-gray-700">
                {deliverable.notes}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}