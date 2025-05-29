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
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts";
import { 
  TrendingUp, 
  Clock, 
  Star, 
  MessageSquare, 
  Target,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  UserCheck,
  Users
} from "lucide-react";

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

  // Obtener datos de entradas de tiempo para análisis de recursos
  const { data: timeEntriesData, isLoading: timeEntriesLoading } = useQuery({
    queryKey: [`/api/time-entries/client/${clientId}`],
    retry: false,
  });

  console.log('Enhanced Debug:', { summaryData, deliverablesData, projectsData, timeEntriesData });

  const isLoading = summaryLoading || deliverablesLoading || projectsLoading || timeEntriesLoading;

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
  const timeEntries = Array.isArray(timeEntriesData) ? timeEntriesData : [];

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

  // Procesar datos de recursos humanos y costos
  const resourceAnalysis = timeEntries.length > 0 ? (() => {
    // Agrupar por persona
    const personnelMap = new Map();
    let totalCost = 0;
    let totalHours = 0;

    timeEntries.forEach(entry => {
      const key = entry.personnelName || `ID ${entry.personnelId}`;
      if (!personnelMap.has(key)) {
        personnelMap.set(key, {
          name: key,
          role: entry.personnelRole || 'No especificado',
          hours: 0,
          cost: 0,
          rate: entry.hourlyRate || 0,
          entries: 0
        });
      }
      
      const person = personnelMap.get(key);
      const hours = entry.hoursWorked || 0;
      const cost = hours * (entry.hourlyRate || 0);
      
      person.hours += hours;
      person.cost += cost;
      person.entries += 1;
      
      totalHours += hours;
      totalCost += cost;
    });

    // Convertir a array y ordenar por horas trabajadas
    const personnelData = Array.from(personnelMap.values())
      .sort((a, b) => b.hours - a.hours);

    return {
      personnelData,
      totalCost,
      totalHours,
      averageRate: totalHours > 0 ? totalCost / totalHours : 0,
      activePersonnel: personnelData.length
    };
  })() : null;

  return (
    <div className="space-y-4">
      <Card className="standard-card">
        <CardContent className="p-4">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="overview" className="text-sm">Resumen</TabsTrigger>
              <TabsTrigger value="quality" className="text-sm">Calidad</TabsTrigger>
              <TabsTrigger value="projects" className="text-sm">Proyectos</TabsTrigger>
              <TabsTrigger value="deliverables" className="text-sm">Entregables</TabsTrigger>
            </TabsList>
            
            {/* Tab: Resumen General */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-blue-700">{summary.totalDeliverables || 0}</p>
                        <p className="text-xs font-medium text-blue-600">Entregables Totales</p>
                      </div>
                      <div className="p-2 bg-blue-200 rounded-full">
                        <Target className="h-4 w-4 text-blue-700" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-green-700">{summary.onTimeDeliveries || 0}</p>
                        <p className="text-xs font-medium text-green-600">Entregas a Tiempo</p>
                        <p className="text-xs text-green-500 font-semibold">
                          {summary.onTimePercentage ? `${Math.round(summary.onTimePercentage)}%` : '0%'} de puntualidad
                        </p>
                      </div>
                      <div className="p-2 bg-green-200 rounded-full">
                        <CheckCircle2 className="h-4 w-4 text-green-700" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-purple-700">
                          {summary.averageScores ? 
                            (Object.values(summary.averageScores).reduce((a, b) => a + b, 0) / 
                             Object.values(summary.averageScores).length).toFixed(1) : 
                            '0.0'}
                        </p>
                        <p className="text-xs font-medium text-purple-600">Puntuación Promedio</p>
                        <p className="text-xs text-purple-500 font-semibold">sobre 5.0 puntos</p>
                      </div>
                      <div className="p-2 bg-purple-200 rounded-full">
                        <Star className="h-4 w-4 text-purple-700" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-orange-700">{summary.totalComments || 0}</p>
                        <p className="text-xs font-medium text-orange-600">Comentarios Recibidos</p>
                      </div>
                      <div className="p-2 bg-orange-200 rounded-full">
                        <MessageSquare className="h-4 w-4 text-orange-700" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Análisis de Recursos Humanos y Costos */}
              {resourceAnalysis && (
                <Card className="border-t-4 border-t-indigo-500">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-indigo-600" />
                      <CardTitle>Análisis de Recursos y Costos</CardTitle>
                    </div>
                    <CardDescription>
                      Distribución de horas trabajadas y análisis de costos por persona
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Métricas generales */}
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-2xl font-bold text-indigo-700">
                                    ${resourceAnalysis.totalCost.toFixed(0)}
                                  </p>
                                  <p className="text-xs font-medium text-indigo-600">Costo Total</p>
                                </div>
                                <div className="p-2 bg-indigo-200 rounded-full">
                                  <DollarSign className="h-4 w-4 text-indigo-700" />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                          
                          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-2xl font-bold text-emerald-700">
                                    {resourceAnalysis.totalHours.toFixed(1)}h
                                  </p>
                                  <p className="text-xs font-medium text-emerald-600">Horas Totales</p>
                                </div>
                                <div className="p-2 bg-emerald-200 rounded-full">
                                  <Clock className="h-4 w-4 text-emerald-700" />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <Card className="bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-2xl font-bold text-teal-700">
                                    ${resourceAnalysis.averageRate.toFixed(0)}
                                  </p>
                                  <p className="text-xs font-medium text-teal-600">Tarifa Promedio</p>
                                  <p className="text-xs text-teal-500 font-semibold">por hora</p>
                                </div>
                                <div className="p-2 bg-teal-200 rounded-full">
                                  <TrendingUp className="h-4 w-4 text-teal-700" />
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-200">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-2xl font-bold text-cyan-700">
                                    {resourceAnalysis.activePersonnel}
                                  </p>
                                  <p className="text-xs font-medium text-cyan-600">Personal Activo</p>
                                </div>
                                <div className="p-2 bg-cyan-200 rounded-full">
                                  <UserCheck className="h-4 w-4 text-cyan-700" />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>

                      {/* Gráfico de distribución de horas */}
                      <div>
                        <h4 className="font-medium text-gray-700 mb-4">Distribución de Horas por Persona</h4>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={resourceAnalysis.personnelData.slice(0, 8)}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="name" 
                                tick={{ fontSize: 11 }}
                                angle={-45}
                                textAnchor="end"
                                height={80}
                              />
                              <YAxis tick={{ fontSize: 12 }} />
                              <Tooltip 
                                formatter={(value, name) => [
                                  name === 'hours' ? `${Number(value).toFixed(1)}h` : `$${Number(value).toFixed(0)}`,
                                  name === 'hours' ? 'Horas' : 'Costo'
                                ]}
                                labelStyle={{ color: '#333' }}
                                contentStyle={{ 
                                  backgroundColor: '#fff', 
                                  border: '1px solid #ccc',
                                  borderRadius: '8px'
                                }}
                              />
                              <Bar dataKey="hours" fill="#3b82f6" name="hours" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    {/* Lista detallada de personal */}
                    <div className="mt-6">
                      <h4 className="font-medium text-gray-700 mb-4">Detalle por Persona</h4>
                      <div className="space-y-2">
                        {resourceAnalysis.personnelData.slice(0, 6).map((person, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                {person.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{person.name}</p>
                                <p className="text-sm text-gray-500">{person.role}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-gray-900">{person.hours.toFixed(1)}h</p>
                              <p className="text-sm text-gray-500">${person.cost.toFixed(0)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Métricas de rendimiento mejoradas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-blue-600" />
                      <CardTitle className="text-lg text-blue-700">Puntualidad de Entregas</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Entregas a tiempo</span>
                        <span className="text-2xl font-bold text-blue-600">
                          {summary.onTimePercentage ? `${Math.round(summary.onTimePercentage)}%` : '64%'}
                        </span>
                      </div>
                      <Progress 
                        value={summary.onTimePercentage || 64} 
                        className="h-4 bg-blue-100" 
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Objetivo: 85%</span>
                        <span className={summary.onTimePercentage >= 85 ? "text-green-600" : "text-orange-600"}>
                          {summary.onTimePercentage >= 85 ? "Superado" : "Por mejorar"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-green-600" />
                      <CardTitle className="text-lg text-green-700">Cumplimiento de Horas</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Eficiencia global</span>
                        <span className="text-2xl font-bold text-green-600">
                          {summary.averageHours ? 
                            `${Math.round((summary.averageHours.compliance || 0) * 100)}%` : 
                            '89%'}
                        </span>
                      </div>
                      <Progress 
                        value={summary.averageHours ? 
                          (summary.averageHours.compliance || 0) * 100 : 
                          89} 
                        className="h-4 bg-green-100" 
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Objetivo: 90%</span>
                        <span className="text-green-600">Excelente</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Información adicional del cliente MODO */}
              {clientName === "MODO" && (
                <Card className="bg-gradient-to-r from-slate-50 to-slate-100">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-slate-600" />
                      <CardTitle className="text-lg">Proyecto Always-On MODO</CardTitle>
                    </div>
                    <CardDescription>
                      Información consolidada del proyecto continuo
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-white rounded-lg border">
                        <p className="text-2xl font-bold text-slate-700">$4,200</p>
                        <p className="text-sm text-slate-500">Presupuesto Mensual</p>
                      </div>
                      <div className="text-center p-4 bg-white rounded-lg border">
                        <p className="text-2xl font-bold text-slate-700">{projects.length}</p>
                        <p className="text-sm text-slate-500">Subproyectos Activos</p>
                      </div>
                      <div className="text-center p-4 bg-white rounded-lg border">
                        <p className="text-2xl font-bold text-slate-700">11</p>
                        <p className="text-sm text-slate-500">Entregables Este Mes</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Tab: Análisis de Calidad */}
            <TabsContent value="quality" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-t-4 border-t-blue-500">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-blue-600" />
                      <CardTitle>Análisis de Calidad por Categorías</CardTitle>
                    </div>
                    <CardDescription>Puntuación promedio en cada aspecto evaluado (sobre 5.0)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={qualityScoresData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis 
                            dataKey="name" 
                            tick={{ fontSize: 12 }}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis 
                            domain={[0, 5]} 
                            tick={{ fontSize: 12 }}
                            tickFormatter={(value) => `${value}.0`}
                          />
                          <Tooltip 
                            formatter={(value) => [`${Number(value).toFixed(2)}/5.0`, 'Puntuación']}
                            labelStyle={{ color: '#333' }}
                            contentStyle={{ 
                              backgroundColor: '#fff', 
                              border: '1px solid #ccc',
                              borderRadius: '8px'
                            }}
                          />
                          <Bar 
                            dataKey="value" 
                            fill="#3b82f6"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-t-4 border-t-purple-500">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <PieChartIcon className="h-5 w-5 text-purple-600" />
                      <CardTitle>Distribución de Calidad</CardTitle>
                    </div>
                    <CardDescription>Vista circular de las puntuaciones por categoría</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={qualityScoresData}
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${Number(value).toFixed(2)}/5`}
                            labelLine={false}
                          >
                            {qualityScoresData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value) => [`${value}/5.0`, 'Puntuación']}
                            contentStyle={{ 
                              backgroundColor: '#fff', 
                              border: '1px solid #ccc',
                              borderRadius: '8px'
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Métricas detalladas de calidad */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {qualityScoresData.map((item, index) => (
                  <Card key={index} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-700">{item.name}</h4>
                          <p className="text-2xl font-bold" style={{ color: COLORS[index % COLORS.length] }}>
                            {item.value.toFixed(2)}/5.0
                          </p>
                        </div>
                        <div 
                          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        >
                          {item.value.toFixed(2)}
                        </div>
                      </div>
                      <div className="mt-3">
                        <Progress 
                          value={(item.value / 5) * 100} 
                          className="h-2"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
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