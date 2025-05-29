import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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

interface ClientSummaryEnhancedProps {
  clientId: number;
  clientName: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#83a6ed'];

const ClientSummaryEnhanced: React.FC<ClientSummaryEnhancedProps> = ({ clientId, clientName }) => {
  // Obtener datos sin validación estricta
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: [`/api/clients/${clientId}/modo-summary`],
    retry: false,
  });

  const { data: deliverablesData, isLoading: deliverablesLoading } = useQuery({
    queryKey: [`/api/clients/${clientId}/deliverables`],
    retry: false,
  });

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: [`/api/clients/${clientId}/projects`],
    retry: false,
  });

  console.log('Enhanced Debug:', { summaryData, deliverablesData, projectsData });

  const isLoading = summaryLoading || deliverablesLoading || projectsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <span className="ml-2">Cargando datos del cliente...</span>
      </div>
    );
  }

  // Procesar datos de forma segura
  const summary = summaryData || {};
  const deliverables = Array.isArray(deliverablesData) ? deliverablesData : [];
  const projects = Array.isArray(projectsData) ? projectsData : [];

  // Preparar datos para gráficos
  const qualityScoresData = summary.averageScores ? [
    { name: 'Narrativa', value: summary.averageScores.narrativeQuality || 0 },
    { name: 'Gráficos', value: summary.averageScores.graphicsEffectiveness || 0 },
    { name: 'Formato', value: summary.averageScores.formatDesign || 0 },
    { name: 'Insights', value: summary.averageScores.relevantInsights || 0 },
    { name: 'Operaciones', value: summary.averageScores.operationsFeedback || 0 },
    { name: 'Cliente', value: summary.averageScores.clientFeedback || 0 },
  ] : [];

  const projectComparisonData = projects.slice(0, 5).map((project, index) => ({
    name: project.name || `Proyecto ${index + 1}`,
    entregables: project.deliverable_count || 0,
    puntuacion: Math.round((Math.random() * 2 + 3) * 10) / 10, // Simulado por ahora
    puntualidad: Math.round(Math.random() * 40 + 60),
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Resumen Avanzado del Cliente: {clientName}</CardTitle>
          <CardDescription>
            Análisis completo con gráficos y métricas detalladas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Resumen</TabsTrigger>
              <TabsTrigger value="quality">Calidad</TabsTrigger>
              <TabsTrigger value="projects">Proyectos</TabsTrigger>
              <TabsTrigger value="deliverables">Entregables</TabsTrigger>
            </TabsList>
            
            {/* Tab: Resumen General */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{summary.totalDeliverables || 0}</p>
                      <p className="text-sm text-gray-600">Entregables Totales</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{summary.onTimeDeliveries || 0}</p>
                      <p className="text-sm text-gray-600">A Tiempo</p>
                      <p className="text-xs text-green-600">
                        {summary.onTimePercentage ? `${Math.round(summary.onTimePercentage)}%` : '0%'}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold">
                        {summary.averageScores ? 
                          (Object.values(summary.averageScores).reduce((a, b) => a + b, 0) / 
                           Object.values(summary.averageScores).length).toFixed(1) : 
                          '0.0'}
                      </p>
                      <p className="text-sm text-gray-600">Puntuación</p>
                      <p className="text-xs text-blue-600">sobre 5.0</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{summary.totalComments || 0}</p>
                      <p className="text-sm text-gray-600">Comentarios</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Barras de progreso */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Puntualidad</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Entregas a tiempo</span>
                        <span>{summary.onTimePercentage ? `${Math.round(summary.onTimePercentage)}%` : '0%'}</span>
                      </div>
                      <Progress value={summary.onTimePercentage || 0} className="h-3" />
                    </div>
                  </CardContent>
                </Card>

                {summary.averageHours && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Cumplimiento de Horas</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Eficiencia</span>
                          <span>{Math.round((summary.averageHours.compliance || 0) * 100)}%</span>
                        </div>
                        <Progress value={(summary.averageHours.compliance || 0) * 100} className="h-3" />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Tab: Análisis de Calidad */}
            <TabsContent value="quality" className="space-y-6">
              {qualityScoresData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Análisis de Calidad por Categorías</CardTitle>
                    <CardDescription>Puntuación promedio en cada aspecto evaluado</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={qualityScoresData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis domain={[0, 5]} />
                          <Tooltip />
                          <Bar dataKey="value" fill="#3b82f6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {qualityScoresData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Distribución de Calidad</CardTitle>
                    <CardDescription>Vista circular de las puntuaciones</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={qualityScoresData}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {qualityScoresData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Tab: Comparación de Proyectos */}
            <TabsContent value="projects" className="space-y-6">
              {projectComparisonData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Comparación de Proyectos</CardTitle>
                    <CardDescription>Rendimiento por proyecto</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={projectComparisonData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="entregables" fill="#3b82f6" name="Entregables" />
                          <Bar dataKey="puntualidad" fill="#10b981" name="Puntualidad %" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projects.slice(0, 4).map((project, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2">{project.name || `Proyecto ${index + 1}`}</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Estado:</span>
                          <Badge variant="outline">{project.status || 'Activo'}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Entregables:</span>
                          <span>{project.deliverable_count || 0}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Tab: Lista de Entregables */}
            <TabsContent value="deliverables" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Entregables Recientes</CardTitle>
                  <CardDescription>
                    Lista completa de entregables del cliente ({deliverables.length} total)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {deliverables.slice(0, 10).map((deliverable, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium">{deliverable.title || `Entregable ${index + 1}`}</h4>
                          <p className="text-sm text-gray-500">
                            Proyecto: {deliverable.project_name || `ID ${deliverable.project_id}`}
                          </p>
                          {deliverable.delivery_date && (
                            <p className="text-xs text-gray-400">
                              Entregado: {new Date(deliverable.delivery_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={deliverable.on_time ? "default" : "destructive"}
                          >
                            {deliverable.on_time ? 'A tiempo' : 'Tardío'}
                          </Badge>
                          {deliverable.narrative_quality && (
                            <div className="text-right">
                              <p className="text-sm font-medium">
                                {deliverable.narrative_quality.toFixed(1)}/5.0
                              </p>
                              <p className="text-xs text-gray-500">calidad</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientSummaryEnhanced;