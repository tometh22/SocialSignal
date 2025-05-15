import React, { useMemo } from 'react';
import { 
  Card, 
  CardHeader, 
  CardContent, 
  CardTitle,
  CardDescription 
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
import { CheckCircle, XCircle } from 'lucide-react';

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
  // Si no hay entregable, muestra un mensaje
  if (!deliverable) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Métricas MODO</CardTitle>
          <CardDescription>No hay datos disponibles para este proyecto</CardDescription>
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
        <CardTitle className="text-lg font-bold flex justify-between items-center">
          <span>Métricas MODO</span>
          <Badge variant="outline" className={getScoreColor(totalScore)}>
            {totalScore.toFixed(2)} / 5.0
          </Badge>
        </CardTitle>
        <CardDescription>
          Métricas del Sistema de Seguimiento Operacional para este entregable
        </CardDescription>
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