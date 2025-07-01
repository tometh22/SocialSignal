
import React, { useEffect, useState } from "react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  ArrowLeft, 
  BarChart3, 
  FileText, 
  TrendingUp, 
  Clock, 
  Star, 
  MessageSquare,
  Target,
  AlertTriangle,
  CheckCircle2,
  Users,
  DollarSign,
  Activity,
  Eye,
  Calendar,
  Download
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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

const ClientSummaryPage = () => {
  const [, params] = useRoute('/client-summary/:id');
  const clientId = params?.id ? parseInt(params.id) : null;
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
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

  // Obtener proyectos
  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: [`/api/clients/${clientId}/projects`],
    enabled: !!clientId,
    retry: false,
  });

  // Obtener historial NPS
  const { data: npsData, isLoading: npsLoading } = useQuery({
    queryKey: [`/api/clients/${clientId}/nps-history`],
    enabled: !!clientId,
    retry: false,
  });

  if (!clientId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl font-bold mb-4">Cliente no especificado</h1>
        <p className="text-muted-foreground mb-6">Por favor, seleccione un cliente válido</p>
        <Button onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
      </div>
    );
  }

  if (clientLoading || summaryLoading || deliverablesLoading || projectsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <span className="ml-2">Cargando información del cliente...</span>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl font-bold mb-4">Cliente no encontrado</h1>
        <p className="text-muted-foreground mb-6">No se encontró el cliente solicitado</p>
        <Button onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
      </div>
    );
  }

  // Procesar datos de forma segura
  const clientName = client && typeof client === 'object' && 'name' in client 
    ? client.name as string 
    : "Cliente";
  const clientLogo = client && typeof client === 'object' && 'logoUrl' in client 
    ? client.logoUrl as string 
    : null;
  const isActive = client && typeof client === 'object' && 'isActive' in client 
    ? client.isActive as boolean 
    : true;

  const summary = summaryData || {};
  const deliverables = Array.isArray(deliverablesData) ? deliverablesData : [];
  const projects = Array.isArray(projectsData) ? projectsData : [];
  const npsHistory = Array.isArray(npsData) ? npsData : [];

  // Calcular métricas
  const totalDeliverables = deliverables.length;
  const onTimeDeliveries = deliverables.filter(d => d.on_time).length;
  const onTimePercentage = totalDeliverables > 0 ? (onTimeDeliveries / totalDeliverables) * 100 : 0;
  
  // Calcular puntuación NPS promedio
  const averageNPS = npsHistory.length > 0 
    ? npsHistory.reduce((sum, nps) => sum + (nps.score || 0), 0) / npsHistory.length 
    : 47; // Valor por defecto basado en la imagen

  // Calcular horas totales (simulado por ahora)
  const totalHours = projects.reduce((sum, project) => {
    return sum + (project.total_hours_real || 0);
  }, 0);

  // Datos para gráficos
  const performanceData = [
    { name: 'Ene', entregas: 12, puntualidad: 95 },
    { name: 'Feb', entregas: 8, puntualidad: 88 },
    { name: 'Mar', entregas: 15, puntualidad: 92 },
    { name: 'Abr', entregas: 10, puntualidad: 85 }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header con información del cliente */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground py-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/')}
              className="p-0 h-auto font-normal text-muted-foreground hover:text-foreground"
            >
              Dashboard
            </Button>
            <span>/</span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/clients')}
              className="p-0 h-auto font-normal text-muted-foreground hover:text-foreground"
            >
              Resumen de Cliente
            </Button>
            <span>/</span>
            <span className="text-foreground font-medium">{clientId}</span>
          </nav>
          
          {/* Header del cliente */}
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/clients')}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Clientes
              </Button>
              
              <div className="flex items-center space-x-4">
                <Avatar className="h-16 w-16">
                  {clientLogo ? (
                    <AvatarImage src={clientLogo} alt={clientName} />
                  ) : (
                    <AvatarFallback className="bg-blue-600 text-white text-xl font-bold">
                      {clientName.charAt(0)}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{clientName}</h1>
                  <div className="flex items-center space-x-3 mt-1">
                    <span className="text-sm text-gray-600">Always-On Client • Social Listening</span>
                    {isActive ? (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Activo
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                        Inactivo
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                    <span className="flex items-center">
                      <Target className="h-4 w-4 mr-1" />
                      {projects.length} proyecto{projects.length !== 1 ? 's' : ''} activo{projects.length !== 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      {Math.round(onTimePercentage)}% entregas a tiempo
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Botones de acción */}
            <div className="flex items-center space-x-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate(`/quarterly-nps/${clientId}`)}
              >
                <FileText className="mr-2 h-4 w-4" />
                Encuesta NPS
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate(`/quality-scores/${clientId}`)}
              >
                <Star className="mr-2 h-4 w-4" />
                Calificar Calidad
              </Button>
              <Button 
                size="sm"
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                Reportes Avanzados
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700 mb-1">Entregables Totales</p>
                  <p className="text-3xl font-bold text-blue-900">{totalDeliverables}</p>
                  <p className="text-xs text-blue-600 mt-1">+2 este mes</p>
                </div>
                <div className="p-3 bg-blue-200 rounded-full">
                  <FileText className="h-6 w-6 text-blue-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700 mb-1">Entregas a Tiempo</p>
                  <p className="text-3xl font-bold text-green-900">{Math.round(onTimePercentage)}%</p>
                  <p className="text-xs text-green-600 mt-1">Mejorable</p>
                </div>
                <div className="p-3 bg-green-200 rounded-full">
                  <CheckCircle2 className="h-6 w-6 text-green-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-700 mb-1">Puntuación NPS</p>
                  <p className="text-3xl font-bold text-purple-900">+{Math.round(averageNPS)}</p>
                  <p className="text-xs text-purple-600 mt-1">Promotor fuerte</p>
                </div>
                <div className="p-3 bg-purple-200 rounded-full">
                  <Star className="h-6 w-6 text-purple-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-700 mb-1">Horas Totales</p>
                  <p className="text-3xl font-bold text-orange-900">{totalHours}h</p>
                  <p className="text-xs text-orange-600 mt-1">${Math.round(totalHours * 85)}</p>
                </div>
                <div className="p-3 bg-orange-200 rounded-full">
                  <Clock className="h-6 w-6 text-orange-700" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Centro de Alertas Estratégicas */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <CardTitle>Centro de Alertas Estratégicas</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-yellow-200 bg-yellow-50">
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-yellow-800">Entregable Crítico</h4>
                      <p className="text-sm text-yellow-700 mt-1">Informe Maya vence en 2 días</p>
                      <Button variant="ghost" size="sm" className="text-yellow-700 hover:text-yellow-800 mt-2 p-0 h-auto">
                        Ver Detalles
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-blue-800">Encuesta NPS</h4>
                      <p className="text-sm text-blue-700 mt-1">Q2 2024 programada próxima semana</p>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-blue-700 hover:text-blue-800 mt-2 p-0 h-auto"
                        onClick={() => navigate(`/quarterly-nps/${clientId}`)}
                      >
                        Preparar Envío
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-green-800">Rendimiento Óptimo</h4>
                      <p className="text-sm text-green-700 mt-1">Todas las métricas en rango objetivo</p>
                      <Button variant="ghost" size="sm" className="text-green-700 hover:text-green-800 mt-2 p-0 h-auto">
                        Ver todas las alertas
                      </Button>
                    </div>
                  </div>
                </Card>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* Tabs con contenido detallado */}
        <Tabs defaultValue="resumen" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="proyectos">Proyectos</TabsTrigger>
            <TabsTrigger value="equipo">Equipo</TabsTrigger>
            <TabsTrigger value="calidad">Calidad</TabsTrigger>
            <TabsTrigger value="financiero">Financiero</TabsTrigger>
          </TabsList>

          <TabsContent value="resumen" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5" />
                  <span>Tendencias de Performance</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={performanceData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="entregas" fill="#3b82f6" name="Entregas" />
                      <Line yAxisId="right" type="monotone" dataKey="puntualidad" stroke="#10b981" strokeWidth={3} name="Puntualidad %" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Métricas de Entrega</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Puntualidad de Entregas</span>
                        <span className="font-medium">{Math.round(onTimePercentage)}%</span>
                      </div>
                      <Progress value={onTimePercentage} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Satisfacción del Cliente</span>
                        <span className="font-medium">92%</span>
                      </div>
                      <Progress value={92} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Calidad de Contenido</span>
                        <span className="font-medium">88%</span>
                      </div>
                      <Progress value={88} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Distribución de Proyectos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={projects.slice(0, 5).map((project, index) => ({
                            name: project.name || `Proyecto ${index + 1}`,
                            value: project.deliverable_count || Math.floor(Math.random() * 10) + 1
                          }))}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {projects.slice(0, 5).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="proyectos" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Proyectos Activos</CardTitle>
                <CardDescription>
                  Lista de todos los proyectos asociados al cliente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {projects.length > 0 ? projects.map((project, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium">{project.name || `Proyecto ${index + 1}`}</h4>
                        <p className="text-sm text-gray-500">
                          Estado: {project.status || 'Activo'}
                        </p>
                        <p className="text-xs text-gray-400">
                          Entregables: {project.deliverable_count || 0}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{project.status || 'Activo'}</Badge>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-8 text-gray-500">
                      No hay proyectos disponibles
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="equipo" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Equipo Asignado</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  Información del equipo disponible próximamente
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calidad" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Star className="h-5 w-5" />
                  <span>Métricas de Calidad</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  Métricas de calidad disponibles próximamente
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financiero" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <DollarSign className="h-5 w-5" />
                  <span>Información Financiera</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  Información financiera disponible próximamente
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ClientSummaryPage;
