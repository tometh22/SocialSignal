import React, { useState } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  ArrowLeft, 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Star, 
  Target,
  CheckCircle2,
  Users,
  DollarSign,
  Activity,
  Calendar,
  Edit,
  Settings,
  Eye,
  FileText,
  AlertTriangle
} from "lucide-react";
import { useLocation } from "wouter";
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
  Cell,
  LineChart,
  Line
} from "recharts";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const ClientSummaryRedesigned = () => {
  const [, params] = useRoute('/client-summary-redesigned/:id');
  const clientId = params?.id ? parseInt(params.id) : null;
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("dashboard");

  // Obtener información del cliente
  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: [`/api/clients/${clientId}`],
    enabled: !!clientId,
  });

  // Obtener resumen de datos
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: [`/api/clients/${clientId}/modo-summary`],
    enabled: !!clientId,
    retry: false,
  });

  // Obtener entregables
  const { data: deliverablesData, isLoading: deliverablesLoading } = useQuery({
    queryKey: [`/api/clients/${clientId}/deliverables`],
    enabled: !!clientId,
    retry: false,
  });

  // Obtener proyectos activos
  const { data: activeProjects = [], isLoading: projectsLoading } = useQuery({
    queryKey: [`/api/clients/${clientId}/active-projects`],
    enabled: !!clientId,
    retry: false,
  });

  // Obtener cotizaciones
  const { data: quotations = [], isLoading: quotationsLoading } = useQuery({
    queryKey: [`/api/clients/${clientId}/quotations`],
    enabled: !!clientId,
    retry: false,
  });

  if (clientLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-4">
          <div className="h-8 bg-gray-200 rounded animate-pulse" />
          <div className="h-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-64 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              Cliente no encontrado
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calcular métricas principales
  const projectsArray = Array.isArray(activeProjects) ? activeProjects : [];
  const quotationsArray = Array.isArray(quotations) ? quotations : [];
  
  const totalProjects = projectsArray.length;
  const completedProjects = projectsArray.filter((p: any) => p.status === 'completed').length;
  const totalQuotations = quotationsArray.length;
  const approvedQuotations = quotationsArray.filter((q: any) => q.status === 'approved').length;
  
  const projectMetrics = projectsArray.reduce((acc: any, project: any) => {
    acc.totalBudget += project.totalCost || 0;
    acc.totalSpent += project.actualCost || 0;
    return acc;
  }, { totalBudget: 0, totalSpent: 0 });

  const avgQualityScore = (deliverablesData as any)?.averageScore || 0;
  const totalDeliverables = (deliverablesData as any)?.total || 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/clients")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a Clientes
          </Button>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-blue-100 text-blue-700 text-lg font-semibold">
                {((client as any)?.name || 'Cliente').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">{(client as any)?.name || 'Cliente'}</h1>
              <p className="text-sm text-muted-foreground">
                {(client as any)?.industry || 'Industria'} • Cliente desde {(client as any)?.createdAt ? format(parseISO((client as any).createdAt), "MMMM yyyy", { locale: es }) : 'N/A'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={(client as any)?.isActive ? "default" : "secondary"}>
            {(client as any)?.isActive ? "Activo" : "Inactivo"}
          </Badge>
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Button>
        </div>
      </div>

      {/* Tabs reorganizadas */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard General
          </TabsTrigger>
          <TabsTrigger value="projects" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Proyectos y Performance
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Análisis y Reportes
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Dashboard General */}
        <TabsContent value="dashboard" className="space-y-6">
          {/* Métricas principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Proyectos Activos</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalProjects}</div>
                <p className="text-xs text-muted-foreground">
                  {completedProjects} completados
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cotizaciones</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalQuotations}</div>
                <p className="text-xs text-muted-foreground">
                  {approvedQuotations} aprobadas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Presupuesto Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${projectMetrics.totalBudget.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  ${projectMetrics.totalSpent.toLocaleString()} gastado
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Calidad Promedio</CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{avgQualityScore.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">
                  {totalDeliverables} entregables
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Resumen visual */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Estado de Proyectos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {projectsLoading ? (
                  <div className="h-48 flex items-center justify-center">
                    <div className="text-sm text-muted-foreground">Cargando...</div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(activeProjects as any[]).slice(0, 5).map((project: any) => (
                      <div key={project.id} className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="font-medium text-sm">{project.name}</div>
                            <Badge variant="secondary" className="text-xs">
                              {project.status}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            ${project.totalCost?.toLocaleString()} • {project.teamSize} miembros
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{Math.round(project.progress || 0)}%</div>
                          <Progress value={project.progress || 0} className="w-16 h-2 mt-1" />
                        </div>
                      </div>
                    ))}
                    {(activeProjects as any[]).length === 0 && (
                      <div className="text-center text-muted-foreground py-8">
                        No hay proyectos activos
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Actividad Reciente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(quotations as any[]).slice(0, 5).map((quotation: any) => (
                    <div key={quotation.id} className="flex items-center gap-3">
                      <div className="h-2 w-2 bg-blue-500 rounded-full flex-shrink-0" />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{quotation.projectName}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(parseISO(quotation.createdAt), "dd MMM yyyy", { locale: es })}
                        </div>
                      </div>
                      <Badge variant={quotation.status === 'approved' ? 'default' : 'secondary'}>
                        {quotation.status}
                      </Badge>
                    </div>
                  ))}
                  {(quotations as any[]).length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      No hay actividad reciente
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: Proyectos y Performance */}
        <TabsContent value="projects" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lista de proyectos */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Proyectos Activos</CardTitle>
                <CardDescription>
                  Gestión y seguimiento de proyectos en curso
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(activeProjects as any[]).map((project: any) => (
                    <div key={project.id} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{project.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            Inicio: {format(parseISO(project.createdAt), "dd MMM yyyy", { locale: es })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{project.status}</Badge>
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Presupuesto</div>
                          <div className="font-medium">${project.totalCost?.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Gastado</div>
                          <div className="font-medium">${project.actualCost?.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Progreso</div>
                          <div className="font-medium">{Math.round(project.progress || 0)}%</div>
                        </div>
                      </div>
                      
                      <Progress value={project.progress || 0} className="h-2" />
                    </div>
                  ))}
                  
                  {(activeProjects as any[]).length === 0 && (
                    <div className="text-center py-8">
                      <div className="text-muted-foreground">No hay proyectos activos</div>
                      <Button className="mt-4" size="sm">
                        Crear Nuevo Proyecto
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Panel de métricas de performance */}
            <Card>
              <CardHeader>
                <CardTitle>Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Tasa de Completitud</span>
                    <span className="font-medium">
                      {totalProjects > 0 ? Math.round((completedProjects / totalProjects) * 100) : 0}%
                    </span>
                  </div>
                  <Progress 
                    value={totalProjects > 0 ? (completedProjects / totalProjects) * 100 : 0} 
                    className="h-2" 
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Uso de Presupuesto</span>
                    <span className="font-medium">
                      {projectMetrics.totalBudget > 0 ? 
                        Math.round((projectMetrics.totalSpent / projectMetrics.totalBudget) * 100) : 0}%
                    </span>
                  </div>
                  <Progress 
                    value={projectMetrics.totalBudget > 0 ? 
                      (projectMetrics.totalSpent / projectMetrics.totalBudget) * 100 : 0} 
                    className="h-2" 
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Calidad Promedio</span>
                    <span className="font-medium">{avgQualityScore.toFixed(1)}/10</span>
                  </div>
                  <Progress value={avgQualityScore * 10} className="h-2" />
                </div>

                <div className="pt-4 border-t">
                  <div className="text-sm text-muted-foreground mb-2">Estado General</div>
                  {avgQualityScore >= 8 && projectMetrics.totalSpent <= projectMetrics.totalBudget ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-sm font-medium">Excelente</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-yellow-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm font-medium">Atención</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 3: Análisis y Reportes */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de presupuesto vs gasto */}
            <Card>
              <CardHeader>
                <CardTitle>Análisis Financiero</CardTitle>
                <CardDescription>Presupuesto vs Gasto Real por Proyecto</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={(activeProjects as any[]).slice(0, 5)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="totalCost" fill="#3b82f6" name="Presupuestado" />
                      <Bar dataKey="actualCost" fill="#10b981" name="Gastado" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Distribución de calidad */}
            <Card>
              <CardHeader>
                <CardTitle>Distribución de Calidad</CardTitle>
                <CardDescription>Puntuación de entregables por categoría</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  {(deliverablesData as any)?.qualityDistribution ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={(deliverablesData as any).qualityDistribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {(deliverablesData as any).qualityDistribution.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      No hay datos de calidad disponibles
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabla de reportes históricos */}
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Cotizaciones</CardTitle>
              <CardDescription>Resumen de todas las cotizaciones generadas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(quotations as any[]).map((quotation: any) => (
                  <div key={quotation.id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <div className="font-medium">{quotation.projectName}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(parseISO(quotation.createdAt), "dd MMM yyyy", { locale: es })}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-medium">${quotation.totalCost?.toLocaleString()}</div>
                        <div className="text-sm text-muted-foreground">{quotation.teamSize} miembros</div>
                      </div>
                      <Badge variant={quotation.status === 'approved' ? 'default' : 'secondary'}>
                        {quotation.status}
                      </Badge>
                    </div>
                  </div>
                ))}
                
                {(quotations as any[]).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay cotizaciones registradas
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClientSummaryRedesigned;