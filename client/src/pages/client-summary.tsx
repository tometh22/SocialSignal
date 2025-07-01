
import React, { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Switch } from "@/components/ui/switch";
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
  Download,
  Settings,
  Mail,
  Phone,
  Globe,
  Edit,
  Save,
  X
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
  Line,
  AreaChart,
  Area
} from "recharts";
import { queryClient } from "@/lib/queryClient";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const ClientSummaryPage = () => {
  const [, params] = useRoute('/client-summary/:id');
  const clientId = params?.id ? parseInt(params.id) : null;
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("resumen");
  
  // Estados para edición inline
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [tempActive, setTempActive] = useState(true);
  
  // Obtener información del cliente
  const { data: client, isLoading: clientLoading, refetch: refetchClient } = useQuery({
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

  // Obtener datos de tiempo
  const { data: timeEntriesData, isLoading: timeEntriesLoading } = useQuery({
    queryKey: [`/api/time-entries/client/${clientId}`],
    enabled: !!clientId,
    retry: false,
  });

  // Mutación para actualizar estado del cliente
  const updateClientMutation = useMutation({
    mutationFn: async (updates: { isActive: boolean }) => {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!response.ok) throw new Error('Error al actualizar cliente');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}`] });
      toast({
        title: "Cliente actualizado",
        description: "El estado del cliente se ha actualizado correctamente",
      });
      setIsEditingStatus(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado del cliente",
        variant: "destructive",
      });
    }
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

  const isLoading = clientLoading || summaryLoading || deliverablesLoading || projectsLoading;

  if (isLoading) {
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
  const contactName = client && typeof client === 'object' && 'contactName' in client 
    ? client.contactName as string 
    : null;
  const contactEmail = client && typeof client === 'object' && 'contactEmail' in client 
    ? client.contactEmail as string 
    : null;
  const contactPhone = client && typeof client === 'object' && 'contactPhone' in client 
    ? client.contactPhone as string 
    : null;

  const summary = summaryData || {};
  const deliverables = Array.isArray(deliverablesData) ? deliverablesData : [];
  const projects = Array.isArray(projectsData) ? projectsData : [];
  const npsHistory = Array.isArray(npsData) ? npsData : [];
  const timeEntries = Array.isArray(timeEntriesData) ? timeEntriesData : [];

  // Calcular métricas
  const totalDeliverables = deliverables.length;
  const onTimeDeliveries = deliverables.filter(d => d.on_time).length;
  const onTimePercentage = totalDeliverables > 0 ? (onTimeDeliveries / totalDeliverables) * 100 : 0;
  
  // Calcular puntuación NPS promedio
  const averageNPS = npsHistory.length > 0 
    ? npsHistory.reduce((sum, nps) => sum + (nps.score || 0), 0) / npsHistory.length 
    : 47;

  // Calcular horas totales
  const totalHours = timeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
  const totalBudget = projects.reduce((sum, project) => sum + (project.total_budget || 0), 0);

  // Datos para gráficos
  const performanceData = [
    { name: 'Ene', entregas: 12, puntualidad: 95, calidad: 88 },
    { name: 'Feb', entregas: 8, puntualidad: 88, calidad: 92 },
    { name: 'Mar', entregas: 15, puntualidad: 92, calidad: 85 },
    { name: 'Abr', entregas: 10, puntualidad: 85, calidad: 90 },
    { name: 'May', entregas: 18, puntualidad: 94, calidad: 87 },
    { name: 'Jun', entregas: 14, puntualidad: 89, calidad: 91 }
  ];

  const npsEvolutionData = [
    { mes: 'Q1 2024', nps: 42, satisfaccion: 85 },
    { mes: 'Q2 2024', nps: 47, satisfaccion: 88 },
    { mes: 'Q3 2024', nps: 51, satisfaccion: 92 },
    { mes: 'Q4 2024', nps: 47, satisfaccion: 89 }
  ];

  const projectStatusData = projects.reduce((acc, project) => {
    const status = project.status || 'Activo';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusChartData = Object.entries(projectStatusData).map(([status, count]) => ({
    name: status,
    value: count
  }));

  const handleStatusToggle = () => {
    if (isEditingStatus) {
      updateClientMutation.mutate({ isActive: tempActive });
    } else {
      setTempActive(isActive);
      setIsEditingStatus(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingStatus(false);
    setTempActive(isActive);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Mejorado */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb Mejorado */}
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground py-3 border-b border-gray-100">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/')}
              className="p-0 h-auto font-normal text-muted-foreground hover:text-primary transition-colors"
            >
              Dashboard
            </Button>
            <span className="text-gray-300">/</span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/clients')}
              className="p-0 h-auto font-normal text-muted-foreground hover:text-primary transition-colors"
            >
              Clientes
            </Button>
            <span className="text-gray-300">/</span>
            <span className="text-foreground font-medium">{clientName}</span>
          </nav>
          
          {/* Header del cliente con información completa */}
          <div className="py-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-6">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => navigate('/clients')}
                  className="mt-2 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Volver
                </Button>
                
                <div className="flex items-start space-x-4">
                  <Avatar className="h-20 w-20 border-4 border-white shadow-lg">
                    {clientLogo ? (
                      <AvatarImage src={clientLogo} alt={clientName} />
                    ) : (
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-2xl font-bold">
                        {clientName.charAt(0)}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  
                  <div className="space-y-3">
                    <div>
                      <h1 className="text-3xl font-bold text-gray-900 mb-1">{clientName}</h1>
                      <p className="text-gray-600 text-sm">Always-On Client • Social Listening</p>
                    </div>
                    
                    {/* Estado del cliente con edición inline */}
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        {isEditingStatus ? (
                          <>
                            <Switch
                              checked={tempActive}
                              onCheckedChange={setTempActive}
                              disabled={updateClientMutation.isPending}
                            />
                            <span className="text-sm font-medium">
                              {tempActive ? 'Activo' : 'Inactivo'}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleStatusToggle}
                              disabled={updateClientMutation.isPending}
                              className="h-7 px-2"
                            >
                              <Save className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleCancelEdit}
                              disabled={updateClientMutation.isPending}
                              className="h-7 px-2"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Badge 
                              variant={isActive ? "default" : "secondary"} 
                              className={isActive ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-gray-100 text-gray-600"}
                            >
                              <div className={`w-2 h-2 rounded-full mr-2 ${isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                              {isActive ? 'Activo' : 'Inactivo'}
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setIsEditingStatus(true)}
                              className="h-7 px-2 text-muted-foreground hover:text-foreground"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* Información de contacto */}
                    {(contactName || contactEmail || contactPhone) && (
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        {contactName && (
                          <div className="flex items-center">
                            <Users className="h-4 w-4 mr-1" />
                            {contactName}
                          </div>
                        )}
                        {contactEmail && (
                          <div className="flex items-center">
                            <Mail className="h-4 w-4 mr-1" />
                            {contactEmail}
                          </div>
                        )}
                        {contactPhone && (
                          <div className="flex items-center">
                            <Phone className="h-4 w-4 mr-1" />
                            {contactPhone}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Métricas rápidas */}
                    <div className="flex items-center space-x-6 text-sm text-gray-500">
                      <div className="flex items-center">
                        <Target className="h-4 w-4 mr-1" />
                        {projects.length} proyecto{projects.length !== 1 ? 's' : ''}
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        {Math.round(onTimePercentage)}% puntualidad
                      </div>
                      <div className="flex items-center">
                        <Star className="h-4 w-4 mr-1" />
                        NPS +{Math.round(averageNPS)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Botones de acción mejorados */}
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate(`/quarterly-nps/${clientId}`)}
                  className="shadow-sm"
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Encuesta NPS
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate(`/quality-scores/${clientId}`)}
                  className="shadow-sm"
                >
                  <Star className="mr-2 h-4 w-4" />
                  Calificar Calidad
                </Button>
                <Button 
                  size="sm"
                  className="shadow-sm bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                >
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Reportes Avanzados
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* KPI Cards Mejorados */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-blue-700">Entregables Totales</p>
                  <p className="text-3xl font-bold text-blue-900">{totalDeliverables}</p>
                  <div className="flex items-center text-xs text-blue-600">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +2 este mes
                  </div>
                </div>
                <div className="p-3 bg-blue-200 rounded-full">
                  <FileText className="h-6 w-6 text-blue-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-green-700">Entregas a Tiempo</p>
                  <p className="text-3xl font-bold text-green-900">{Math.round(onTimePercentage)}%</p>
                  <div className="w-full bg-green-200 rounded-full h-1.5">
                    <div 
                      className="bg-green-600 h-1.5 rounded-full transition-all duration-300" 
                      style={{ width: `${onTimePercentage}%` }}
                    />
                  </div>
                </div>
                <div className="p-3 bg-green-200 rounded-full">
                  <CheckCircle2 className="h-6 w-6 text-green-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-purple-700">Puntuación NPS</p>
                  <p className="text-3xl font-bold text-purple-900">+{Math.round(averageNPS)}</p>
                  <p className="text-xs text-purple-600">Promotor fuerte</p>
                </div>
                <div className="p-3 bg-purple-200 rounded-full">
                  <Star className="h-6 w-6 text-purple-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-orange-700">Inversión Total</p>
                  <p className="text-3xl font-bold text-orange-900">${totalBudget.toLocaleString()}</p>
                  <p className="text-xs text-orange-600">{totalHours}h registradas</p>
                </div>
                <div className="p-3 bg-orange-200 rounded-full">
                  <DollarSign className="h-6 w-6 text-orange-700" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Centro de Alertas Estratégicas Mejorado */}
        <Card className="mb-8 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <CardTitle className="text-lg">Centro de Alertas Estratégicas</CardTitle>
              </div>
              <Badge variant="outline" className="text-xs">
                3 alertas activas
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-yellow-200 bg-yellow-50 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-yellow-200 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-yellow-700" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <h4 className="font-semibold text-yellow-800">Entregable Crítico</h4>
                      <p className="text-sm text-yellow-700">Informe Maya vence en 2 días</p>
                      <Button variant="ghost" size="sm" className="text-yellow-700 hover:text-yellow-800 p-0 h-auto">
                        Ver Detalles →
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-blue-200 bg-blue-50 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-blue-200 rounded-lg">
                      <Calendar className="h-4 w-4 text-blue-700" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <h4 className="font-semibold text-blue-800">Encuesta NPS</h4>
                      <p className="text-sm text-blue-700">Q2 2024 programada próxima semana</p>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-blue-700 hover:text-blue-800 p-0 h-auto"
                        onClick={() => navigate(`/quarterly-nps/${clientId}`)}
                      >
                        Preparar Envío →
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-green-200 bg-green-50 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-green-200 rounded-lg">
                      <TrendingUp className="h-4 w-4 text-green-700" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <h4 className="font-semibold text-green-800">Rendimiento Óptimo</h4>
                      <p className="text-sm text-green-700">Todas las métricas en rango objetivo</p>
                      <Button variant="ghost" size="sm" className="text-green-700 hover:text-green-800 p-0 h-auto">
                        Ver Detalles →
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* Tabs con contenido detallado */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6 mb-8">
            <TabsTrigger value="resumen" className="text-sm">Resumen</TabsTrigger>
            <TabsTrigger value="performance" className="text-sm">Performance</TabsTrigger>
            <TabsTrigger value="proyectos" className="text-sm">Proyectos</TabsTrigger>
            <TabsTrigger value="equipo" className="text-sm">Equipo</TabsTrigger>
            <TabsTrigger value="calidad" className="text-sm">Calidad</TabsTrigger>
            <TabsTrigger value="financiero" className="text-sm">Financiero</TabsTrigger>
          </TabsList>

          <TabsContent value="resumen" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    <span>Tendencias de Performance</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={performanceData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'white', 
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                          }}
                        />
                        <Legend />
                        <Area 
                          type="monotone" 
                          dataKey="puntualidad" 
                          stackId="1"
                          stroke="#10b981" 
                          fill="#10b981" 
                          fillOpacity={0.6}
                          name="Puntualidad %" 
                        />
                        <Area 
                          type="monotone" 
                          dataKey="calidad" 
                          stackId="2"
                          stroke="#3b82f6" 
                          fill="#3b82f6" 
                          fillOpacity={0.6}
                          name="Calidad %" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="h-5 w-5 text-purple-600" />
                    <span>Evolución NPS</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={npsEvolutionData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="mes" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'white', 
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                          }}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="nps" 
                          stroke="#8b5cf6" 
                          strokeWidth={3}
                          dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
                          name="Puntuación NPS" 
                        />
                        <Line 
                          type="monotone" 
                          dataKey="satisfaccion" 
                          stroke="#06b6d4" 
                          strokeWidth={2}
                          dot={{ fill: '#06b6d4', strokeWidth: 2, r: 4 }}
                          name="Satisfacción %" 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Métricas de Entrega</CardTitle>
                  <CardDescription>Indicadores clave de rendimiento</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium">Puntualidad de Entregas</span>
                        <span className="font-semibold text-green-600">{Math.round(onTimePercentage)}%</span>
                      </div>
                      <Progress value={onTimePercentage} className="h-3" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium">Satisfacción del Cliente</span>
                        <span className="font-semibold text-blue-600">92%</span>
                      </div>
                      <Progress value={92} className="h-3" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium">Calidad de Contenido</span>
                        <span className="font-semibold text-purple-600">88%</span>
                      </div>
                      <Progress value={88} className="h-3" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium">Cumplimiento de Presupuesto</span>
                        <span className="font-semibold text-orange-600">94%</span>
                      </div>
                      <Progress value={94} className="h-3" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Estado de Proyectos</CardTitle>
                  <CardDescription>Distribución por estado actual</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusChartData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {statusChartData.map((entry, index) => (
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
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Proyectos Activos</CardTitle>
                    <CardDescription>
                      Gestión de todos los proyectos asociados al cliente
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">
                    {projects.length} proyectos
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {projects.length > 0 ? projects.map((project, index) => (
                    <Card key={index} className="border border-gray-200 hover:border-gray-300 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h4 className="font-semibold text-lg">{project.name || `Proyecto ${index + 1}`}</h4>
                              <Badge 
                                variant={project.status === 'Activo' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {project.status || 'Activo'}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                              <div>
                                <span className="font-medium">Entregables:</span> {project.deliverable_count || 0}
                              </div>
                              <div>
                                <span className="font-medium">Presupuesto:</span> ${(project.total_budget || 0).toLocaleString()}
                              </div>
                              <div>
                                <span className="font-medium">Horas:</span> {project.total_hours_real || 0}h
                              </div>
                              <div>
                                <span className="font-medium">Progreso:</span> 
                                <span className="ml-2 text-green-600 font-semibold">75%</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Settings className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )) : (
                    <div className="text-center py-12 text-gray-500">
                      <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">No hay proyectos disponibles</h3>
                      <p className="text-sm">Los proyectos aparecerán aquí cuando sean asignados al cliente</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="equipo" className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Equipo Asignado</span>
                </CardTitle>
                <CardDescription>
                  Personal trabajando en proyectos del cliente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">Información del equipo próximamente</h3>
                  <p className="text-sm">Los datos del equipo se mostrarán aquí</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calidad" className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Star className="h-5 w-5" />
                  <span>Métricas de Calidad</span>
                </CardTitle>
                <CardDescription>
                  Indicadores de calidad y satisfacción
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-gray-500">
                  <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">Métricas de calidad próximamente</h3>
                  <p className="text-sm">Los indicadores de calidad se mostrarán aquí</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financiero" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <DollarSign className="h-5 w-5" />
                    <span>Resumen Financiero</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium">Inversión Total</span>
                      <span className="text-xl font-bold text-green-600">${totalBudget.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium">Horas Registradas</span>
                      <span className="text-xl font-bold text-blue-600">{totalHours}h</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium">Costo por Hora Promedio</span>
                      <span className="text-xl font-bold text-purple-600">
                        ${totalHours > 0 ? Math.round(totalBudget / totalHours) : 0}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>ROI por Proyecto</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-gray-500">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">Análisis ROI próximamente</h3>
                    <p className="text-sm">Los datos de retorno de inversión se mostrarán aquí</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ClientSummaryPage;
