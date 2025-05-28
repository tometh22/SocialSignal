import React, { useMemo } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { 
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface ClientSummaryViewProps {
  clientId: number;
  clientName: string;
}

interface DeliverableData {
  id: number;
  title: string;
  project_id: number;
  delivery_date: string;
  due_date: string;
  on_time: boolean;
  narrative_quality: number;
  graphics_effectiveness: number;
  format_design: number;
  relevant_insights: number;
  operations_feedback: number;
  client_feedback: number;
  brief_compliance: number;
  hours_available: number;
  hours_real: number;
  hours_compliance: number;
  notes?: string;
  retrabajo?: boolean;
  feedback_general_cliente?: number;
  mes_entrega?: number;
  project_name?: string;
}

interface ClientSummary {
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
  averageHours?: {
    available: number;
    real: number;
    compliance: number;
  };
  totalComments: number;
  latestComment?: any;
}

interface ProjectMetrics {
  projectId: number;
  projectName: string;
  deliverableCount: number;
  onTimePercentage: number;
  averageScore: number;
  hoursCompliance: number;
}

// Definir tipos para las respuestas de la API
type Project = {
  id: number;
  name: string;
  status: string;
  budget?: number;
  description?: string;
  start_date?: string;
  end_date?: string;
  deliverable_count?: number;
  total_hours_available?: number;
  total_hours_real?: number;
  hours_compliance?: number;
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#83a6ed'];

// Función para formatear números como porcentaje
const formatPercent = (value: number) => `${Math.round(value)}%`;

// Función para formatear la puntuación (valor sobre 5)
const formatScore = (value: number) => value.toFixed(1);

const ClientSummaryView: React.FC<ClientSummaryViewProps> = ({ clientId, clientName }) => {
  const { toast } = useToast();

  // Obtener el resumen MODO del cliente
  const { data: clientSummaryData, isLoading: summaryLoading, error: summaryError } = useQuery({
    queryKey: [`/api/clients/${clientId}/modo-summary`],
    retry: 1,
  });

  // Obtener todos los entregables del cliente
  const { data: deliverablesData, isLoading: deliverablesLoading, error: deliverablesError } = useQuery({
    queryKey: [`/api/clients/${clientId}/deliverables`],
    retry: 1,
  });

  // Obtener todos los proyectos del cliente
  const { data: projectsData, isLoading: projectsLoading, error: projectsError } = useQuery({
    queryKey: [`/api/clients/${clientId}/projects`],
    retry: 1,
  });

  // Log para debugging
  console.log('ClientSummaryView Debug:', {
    clientId,
    summaryLoading,
    deliverablesLoading, 
    projectsLoading,
    clientSummaryData,
    deliverablesData,
    projectsData,
    summaryError,
    deliverablesError,
    projectsError
  });

  // Confirmar el tipo para TypeScript con validación segura
  const clientSummary: ClientSummary | undefined = clientSummaryData && typeof clientSummaryData === 'object' 
    ? clientSummaryData as ClientSummary 
    : undefined;
  const deliverables: DeliverableData[] = Array.isArray(deliverablesData) ? deliverablesData : [];
  const projects: Project[] = Array.isArray(projectsData) ? projectsData : [];

  // Preparar los datos para las gráficas
  const qualityScoresData = clientSummary ? [
    { name: 'Narrativa', value: clientSummary.averageScores.narrativeQuality },
    { name: 'Gráficos', value: clientSummary.averageScores.graphicsEffectiveness },
    { name: 'Formato', value: clientSummary.averageScores.formatDesign },
    { name: 'Insights', value: clientSummary.averageScores.relevantInsights },
    { name: 'Operaciones', value: clientSummary.averageScores.operationsFeedback },
  ] : [];

  // Calcular métricas por proyecto
  const projectMetrics: ProjectMetrics[] = React.useMemo(() => {
    if (!deliverables || !projects) return [];

    const metricsMap = new Map<number, ProjectMetrics>();

    // Inicializar métricas para cada proyecto
    projects.forEach(project => {
      metricsMap.set(project.id, {
        projectId: project.id,
        projectName: project.name,
        deliverableCount: 0,
        onTimePercentage: 0,
        averageScore: 0,
        hoursCompliance: 0
      });
    });

    // Agrupar y calcular métricas por proyecto
    deliverables.forEach(deliverable => {
      const projectId = deliverable.project_id;
      const metrics = metricsMap.get(projectId);
      
      if (metrics) {
        // Incrementar contador
        metrics.deliverableCount += 1;
        
        // Actualizar porcentaje de entregas a tiempo
        const onTimeCount = metrics.deliverableCount ? 
          (metrics.onTimePercentage / 100) * (metrics.deliverableCount - 1) : 0;
        const newOnTimeCount = onTimeCount + (deliverable.on_time ? 1 : 0);
        metrics.onTimePercentage = (newOnTimeCount / metrics.deliverableCount) * 100;
        
        // Calcular puntuación promedio
        const qualities = [
          deliverable.narrative_quality || 0,
          deliverable.graphics_effectiveness || 0,
          deliverable.format_design || 0,
          deliverable.relevant_insights || 0,
          deliverable.operations_feedback || 0
        ].filter(Boolean);
        
        const avgScore = qualities.length ? 
          qualities.reduce((sum, score) => sum + score, 0) / qualities.length : 0;
        
        // Actualizar puntuación promedio para el proyecto
        const prevAvg = metrics.averageScore;
        metrics.averageScore = 
          ((prevAvg * (metrics.deliverableCount - 1)) + avgScore) / metrics.deliverableCount;
        
        // Actualizar cumplimiento de horas
        const hoursCompliance = deliverable.hours_compliance || 0;
        metrics.hoursCompliance = 
          ((metrics.hoursCompliance * (metrics.deliverableCount - 1)) + hoursCompliance) 
          / metrics.deliverableCount;
      }
    });

    return Array.from(metricsMap.values())
      .filter(metric => metric.deliverableCount > 0)
      .sort((a, b) => b.averageScore - a.averageScore);
  }, [deliverables, projects]);

  // Preparar datos para gráfico de proyectos
  const projectComparisonData = projectMetrics.map(metric => ({
    name: metric.projectName,
    entregables: metric.deliverableCount,
    puntuacion: Math.round(metric.averageScore * 100) / 100,
    puntualidad: Math.round(metric.onTimePercentage),
    cumplimientoHoras: Math.round(metric.hoursCompliance * 100)
  }));

  const isLoading = summaryLoading || deliverablesLoading || projectsLoading;
  const hasErrors = summaryError || deliverablesError || projectsError;

  console.log('Loading state:', { isLoading, hasErrors, clientSummary });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <span className="ml-2">Cargando datos del cliente...</span>
      </div>
    );
  }

  if (hasErrors) {
    console.error('Error details:', { summaryError, deliverablesError, projectsError });
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">
            <p className="text-red-600 mb-2">Error al cargar los datos del cliente</p>
            <p className="text-sm text-gray-500">
              Error de conexión o validación de datos. Intentando recargar...
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Recargar página
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Si no hay datos, mostrar mensaje
  if (!clientSummary || (clientSummary && clientSummary.totalDeliverables === 0)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resumen del Cliente: {clientName}</CardTitle>
          <CardDescription>
            Visión general de todos los proyectos del cliente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-60">
            <p className="text-muted-foreground">No hay datos disponibles para este cliente</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Resumen General de {clientName}</CardTitle>
          <CardDescription>
            Análisis consolidado de todos los proyectos del cliente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="summary">Resumen</TabsTrigger>
              <TabsTrigger value="projects">Proyectos</TabsTrigger>
              <TabsTrigger value="details">Detalles</TabsTrigger>
            </TabsList>
            
            {/* Tab: Resumen general */}
            <TabsContent value="summary" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Métricas clave */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Métricas Clave</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Presupuesto consolidado para "always on" */}
                    {clientName === "MODO" && (
                      <div className="mb-4 pb-4 border-b border-gray-100">
                        <h4 className="text-sm font-semibold mb-2">Presupuesto Mensual Consolidado</h4>
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium">Total Asignado</span>
                            <span className="font-bold">$4,200</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Utilización Global</span>
                            <span className="font-semibold text-blue-600">
                              {projects && projects.length > 0
                                ? formatPercent(
                                    (projects.reduce(
                                      (sum, p) => sum + (p.total_hours_real || 0),
                                      0
                                    ) /
                                      (4200 / 85)) * 100
                                  ) // Cálculo aproximado: 85 USD por hora
                                : "0%"}
                            </span>
                          </div>
                          <div className="mt-2">
                            <p className="text-xs text-muted-foreground">
                              Los proyectos asociados a MODO comparten un presupuesto global de $4,200 mensuales
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Entregables Totales</span>
                        <span className="font-semibold">{clientSummary.totalDeliverables}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Entregas a Tiempo</span>
                        <span className="font-semibold">{formatPercent(clientSummary.onTimePercentage)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Puntuación General</span>
                        <span className="font-semibold">
                          {formatScore(
                            Object.values(clientSummary.averageScores).reduce((a, b) => a + b, 0) / 
                            Object.values(clientSummary.averageScores).length
                          )}
                        </span>
                      </div>
                      {clientSummary.averageHours && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Cumplimiento de Horas</span>
                          <span className="font-semibold">
                            {formatPercent(clientSummary.averageHours.compliance * 100)}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Gráfico de métricas de calidad */}
                    <div className="pt-4">
                      <h4 className="text-sm font-medium mb-2">Puntuaciones por Categoría</h4>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={qualityScoresData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis domain={[0, 5]} />
                          <Tooltip formatter={(value) => [`${value.toFixed(2)}`, 'Puntuación']} />
                          <Bar dataKey="value" fill="#8884d8" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Distribución de proyectos */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Distribución de Proyectos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-center items-center h-[250px]">
                      {projectComparisonData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie
                              data={projectComparisonData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="entregables"
                              nameKey="name"
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            >
                              {projectComparisonData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => [value, 'Entregables']} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="text-center text-muted-foreground">
                          No hay datos suficientes de proyectos
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            {/* Tab: Comparativa de proyectos */}
            <TabsContent value="projects" className="space-y-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Comparativa de Proyectos</CardTitle>
                </CardHeader>
                <CardContent>
                  {projectComparisonData.length > 0 ? (
                    <div className="space-y-6">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={projectComparisonData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis yAxisId="left" orientation="left" domain={[0, 5]} />
                          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                          <Tooltip />
                          <Legend />
                          <Bar yAxisId="left" dataKey="puntuacion" name="Puntuación" fill="#8884d8" />
                          <Bar yAxisId="right" dataKey="puntualidad" name="Puntualidad %" fill="#82ca9d" />
                        </BarChart>
                      </ResponsiveContainer>
                      
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Proyecto</TableHead>
                              <TableHead>Entregables</TableHead>
                              <TableHead>Puntuación</TableHead>
                              <TableHead>Puntualidad</TableHead>
                              <TableHead>Cumplimiento de Horas</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {projectMetrics.map((metric) => (
                              <TableRow key={metric.projectId}>
                                <TableCell className="font-medium">{metric.projectName}</TableCell>
                                <TableCell>{metric.deliverableCount}</TableCell>
                                <TableCell>{formatScore(metric.averageScore)}</TableCell>
                                <TableCell>{formatPercent(metric.onTimePercentage)}</TableCell>
                                <TableCell>{formatPercent(metric.hoursCompliance * 100)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-60">
                      <p className="text-muted-foreground">No hay datos suficientes para comparar proyectos</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Tab: Detalle de entregables */}
            <TabsContent value="details" className="space-y-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Detalle de Entregables</CardTitle>
                </CardHeader>
                <CardContent>
                  {deliverables && deliverables.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Título</TableHead>
                            <TableHead>Fecha Entrega</TableHead>
                            <TableHead>A Tiempo</TableHead>
                            <TableHead>Calidad</TableHead>
                            <TableHead>Horas</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {deliverables.map((deliverable) => {
                            // Calcular puntuación media
                            const scores = [
                              deliverable.narrative_quality,
                              deliverable.graphics_effectiveness,
                              deliverable.format_design,
                              deliverable.relevant_insights,
                              deliverable.operations_feedback
                            ].filter(Boolean) as number[];
                            
                            const avgScore = scores.length > 0
                              ? scores.reduce((sum, score) => sum + score, 0) / scores.length
                              : 0;
                            
                            return (
                              <TableRow key={deliverable.id}>
                                <TableCell className="font-medium">
                                  {deliverable.title}
                                </TableCell>
                                <TableCell>
                                  {deliverable.delivery_date
                                    ? format(parseISO(deliverable.delivery_date), 'dd MMM yyyy', { locale: es })
                                    : 'N/A'}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={deliverable.on_time ? "success" : "destructive"}>
                                    {deliverable.on_time ? "A tiempo" : "Retrasado"}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center">
                                    <div className="mr-2">{avgScore.toFixed(1)}</div>
                                    <Progress 
                                      value={(avgScore / 5) * 100} 
                                      className="h-2 w-16" 
                                    />
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="text-sm">
                                    {deliverable.hours_real}/{deliverable.hours_available}
                                    <Badge 
                                      variant={deliverable.hours_compliance >= 0.9 ? "outline" : "destructive"}
                                      className="ml-2 text-xs"
                                    >
                                      {Math.round(deliverable.hours_compliance * 100)}%
                                    </Badge>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-60">
                      <p className="text-muted-foreground">No hay entregables disponibles para este cliente</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientSummaryView;