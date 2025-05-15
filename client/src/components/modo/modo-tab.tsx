import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileBarChart,
  AlertCircle,
  MessageSquare,
  Clock,
  BarChart,
  FileText,
  CheckCircle,
  XCircle,
  PieChart,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Tooltip as RechartsTooltip,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Line,
  Legend,
} from "recharts";

// Tipo para el resumen MODO
type ModoSummary = {
  totalDeliverables: number;
  onTimeDeliveries: number;
  onTimePercentage: number;
  averageScores: {
    narrativeQuality: number;
    graphicsEffectiveness: number;
    formatDesign: number;
    relevantInsights: number;
    operationsFeedback: number;
    clientFeedback: number;
    briefCompliance: number;
  };
  totalComments: number;
  latestComment?: {
    id: number;
    clientId: number;
    commentText: string;
    timestamp: string;
    year: number;
    quarter: number;
  };
};

// Tipo para entregables MODO
type Deliverable = {
  id: number;
  projectId: number;
  title: string;
  deliveryDate: string;
  dueDate: string;
  onTime: boolean;
  narrativeQuality: number | null;
  graphicsEffectiveness: number | null;
  formatDesign: number | null;
  relevantInsights: number | null;
  operationsFeedback: number | null;
  clientFeedback: number | null;
  briefCompliance: number | null;
  notes: string | null;
};

const formatDate = (dateString?: string) => {
  if (!dateString) return '';
  return format(new Date(dateString), "dd/MM/yyyy", { locale: es });
};

// Función para convertir valor numérico a texto de calificación
const scoreToText = (score: number | null) => {
  if (score === null) return "Sin calificar";
  if (score >= 4.5) return "Excelente";
  if (score >= 3.5) return "Bueno";
  if (score >= 2.5) return "Regular";
  if (score >= 1.5) return "Deficiente";
  return "Crítico";
};

// Función para obtener el color basado en la puntuación
const getScoreColor = (score: number | null) => {
  if (score === null) return "bg-gray-200";
  if (score >= 4.5) return "bg-green-500";
  if (score >= 3.5) return "bg-green-400";
  if (score >= 2.5) return "bg-yellow-400";
  if (score >= 1.5) return "bg-orange-400";
  return "bg-red-500";
};

const getScoreTextColor = (score: number | null) => {
  if (score === null) return "text-gray-500";
  if (score >= 4.5) return "text-green-700";
  if (score >= 3.5) return "text-green-600";
  if (score >= 2.5) return "text-yellow-700";
  if (score >= 1.5) return "text-orange-700";
  return "text-red-700";
};

// Componente principal de la pestaña MODO
interface ModoTabProps {
  clientId: number;
}

export const ModoTab: React.FC<ModoTabProps> = ({ clientId }) => {
  // Consulta para obtener el resumen MODO
  const { data: modoSummary, isLoading: isLoadingSummary } = useQuery<ModoSummary>({
    queryKey: [`/api/modo-summary/client/${clientId}`],
    enabled: !!clientId,
  });

  // Consulta para obtener los entregables
  const { data: deliverables = [], isLoading: isLoadingDeliverables } = useQuery<Deliverable[]>({
    queryKey: [`/api/deliverables?clientId=${clientId}`],
    enabled: !!clientId,
  });

  // Preparar datos para el gráfico de radar
  const radarData = modoSummary?.averageScores
    ? [
        {
          subject: "Calidad Narrativa",
          value: modoSummary.averageScores.narrativeQuality,
          fullMark: 5,
        },
        {
          subject: "Efectividad Gráficos",
          value: modoSummary.averageScores.graphicsEffectiveness,
          fullMark: 5,
        },
        {
          subject: "Diseño de Formato",
          value: modoSummary.averageScores.formatDesign,
          fullMark: 5,
        },
        {
          subject: "Insights Relevantes",
          value: modoSummary.averageScores.relevantInsights,
          fullMark: 5,
        },
        {
          subject: "Feedback Operaciones",
          value: modoSummary.averageScores.operationsFeedback,
          fullMark: 5,
        },
        {
          subject: "Feedback Cliente",
          value: modoSummary.averageScores.clientFeedback,
          fullMark: 5,
        },
        {
          subject: "Cumplimiento Brief",
          value: modoSummary.averageScores.briefCompliance,
          fullMark: 5,
        },
      ]
    : [];

  // Calcular el promedio total
  const totalAverage = modoSummary?.averageScores
    ? (
        modoSummary.averageScores.narrativeQuality +
        modoSummary.averageScores.graphicsEffectiveness +
        modoSummary.averageScores.formatDesign +
        modoSummary.averageScores.relevantInsights +
        modoSummary.averageScores.operationsFeedback +
        modoSummary.averageScores.clientFeedback +
        modoSummary.averageScores.briefCompliance
      ) / 7
    : 0;

  // Si los datos están cargando
  if (isLoadingSummary || isLoadingDeliverables) {
    return <div className="p-6 text-center text-gray-500">Cargando datos de MODO...</div>;
  }

  // Si no hay datos disponibles
  if (!modoSummary) {
    return (
      <div className="p-6 text-center text-gray-500">
        No hay datos MODO disponibles para este cliente.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Score MODO Promedio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline">
              <div className="text-2xl font-bold">{totalAverage.toFixed(2)}</div>
              <div className="ml-2 text-sm text-muted-foreground">/ 5.0</div>
            </div>
            <Progress
              value={(totalAverage / 5) * 100}
              className="h-2 mt-2"
              indicatorClassName={getScoreColor(totalAverage)}
            />
            <div className="text-xs mt-1" style={{ color: getScoreTextColor(totalAverage) }}>
              {scoreToText(totalAverage)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Entregas a Tiempo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline">
              <div className="text-2xl font-bold">{modoSummary.onTimePercentage.toFixed(1)}%</div>
              <div className="ml-2 text-sm text-muted-foreground">de cumplimiento</div>
            </div>
            <Progress
              value={modoSummary.onTimePercentage}
              className="h-2 mt-2"
              indicatorClassName={
                modoSummary.onTimePercentage > 90
                  ? "bg-green-500"
                  : modoSummary.onTimePercentage > 75
                  ? "bg-yellow-500"
                  : "bg-red-500"
              }
            />
            <div className="text-xs mt-1 text-gray-500">
              {modoSummary.onTimeDeliveries} de {modoSummary.totalDeliverables} entregables
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Feedback de Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline">
              <div className="text-2xl font-bold">
                {modoSummary.averageScores.clientFeedback.toFixed(2)}
              </div>
              <div className="ml-2 text-sm text-muted-foreground">/ 5.0</div>
            </div>
            <Progress
              value={(modoSummary.averageScores.clientFeedback / 5) * 100}
              className="h-2 mt-2"
              indicatorClassName={getScoreColor(modoSummary.averageScores.clientFeedback)}
            />
            <div className="text-xs mt-1">
              {modoSummary.totalComments > 0 ? (
                <span>
                  {modoSummary.totalComments} comentario{modoSummary.totalComments > 1 ? "s" : ""}{" "}
                  registrado{modoSummary.totalComments > 1 ? "s" : ""}
                </span>
              ) : (
                <span className="text-orange-600">Sin comentarios registrados</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de radar y último comentario */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">Evaluación de Métricas MODO</CardTitle>
            <CardDescription>
              Puntuación promedio por categoría (escala 0-5)
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart outerRadius={90} width={730} height={300} data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" />
                <RechartsTooltip formatter={(value) => [`${value}/5`, ""]} />
                <Radar
                  name="Puntuación"
                  dataKey="value"
                  stroke="#8884d8"
                  fill="#8884d8"
                  fillOpacity={0.6}
                />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">Comentarios del Cliente</CardTitle>
            <CardDescription>
              Retroalimentación del cliente sobre los entregables
            </CardDescription>
          </CardHeader>
          <CardContent>
            {modoSummary.latestComment ? (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-start">
                    <MessageSquare className="h-5 w-5 text-primary mt-1 mr-2" />
                    <div>
                      <div className="text-sm text-gray-500 mb-1">
                        Q{modoSummary.latestComment.quarter} {modoSummary.latestComment.year}
                      </div>
                      <p className="text-sm">{modoSummary.latestComment.commentText}</p>
                    </div>
                  </div>
                </div>
                {modoSummary.totalComments > 1 && (
                  <Button variant="outline" size="sm" className="w-full">
                    Ver {modoSummary.totalComments - 1} comentario
                    {modoSummary.totalComments - 1 > 1 ? "s" : ""} más
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-6">
                <AlertCircle className="h-12 w-12 text-orange-400 mb-3" />
                <p className="text-gray-500">No hay comentarios registrados para este cliente.</p>
                <Button variant="outline" size="sm" className="mt-4">
                  Añadir comentario
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lista de entregables */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium">Entregables Recientes</CardTitle>
          <CardDescription>
            Últimos {Math.min(5, deliverables.length)} de {deliverables.length} entregables registrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">Título</TableHead>
                <TableHead>Fecha Entrega</TableHead>
                <TableHead>A Tiempo</TableHead>
                <TableHead>Calidad</TableHead>
                <TableHead>Feedback</TableHead>
                <TableHead className="text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliverables.slice(0, 5).map((deliverable) => {
                // Calcular score promedio para este entregable
                const scoreValues = [
                  deliverable.narrativeQuality,
                  deliverable.graphicsEffectiveness,
                  deliverable.formatDesign,
                  deliverable.relevantInsights,
                  deliverable.operationsFeedback,
                  deliverable.clientFeedback,
                  deliverable.briefCompliance,
                ].filter((score): score is number => score !== null);
                
                const averageScore = scoreValues.length > 0
                  ? scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length
                  : null;

                return (
                  <TableRow key={deliverable.id}>
                    <TableCell className="font-medium">
                      {deliverable.title}
                    </TableCell>
                    <TableCell>{formatDate(deliverable.deliveryDate)}</TableCell>
                    <TableCell>
                      {deliverable.onTime ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-100">
                          <CheckCircle className="h-3 w-3 mr-1" /> A tiempo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-100">
                          <XCircle className="h-3 w-3 mr-1" /> Con retraso
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <div
                          className={`w-2 h-2 rounded-full mr-2 ${getScoreColor(
                            deliverable.narrativeQuality
                          )}`}
                        ></div>
                        <span className="text-sm">
                          {deliverable.narrativeQuality?.toFixed(1) || "N/A"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <div
                          className={`w-2 h-2 rounded-full mr-2 ${getScoreColor(
                            deliverable.clientFeedback
                          )}`}
                        ></div>
                        <span className="text-sm">
                          {deliverable.clientFeedback?.toFixed(1) || "N/A"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className={`${getScoreColor(averageScore)} text-white border-transparent font-bold`}
                      >
                        {averageScore?.toFixed(2) || "N/A"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {deliverables.length > 5 && (
            <Button variant="outline" size="sm" className="mt-4 w-full">
              Ver todos los entregables ({deliverables.length})
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ModoTab;