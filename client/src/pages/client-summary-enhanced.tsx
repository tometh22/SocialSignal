import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  DollarSign, 
  Target, 
  AlertTriangle,
  CheckCircle,
  Calendar,
  Users,
  BarChart3,
  Star,
  Activity,
  FileText,
  MessageSquare,
  Zap,
  Award,
  Eye,
  Settings,
  ExternalLink
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Area, AreaChart } from "recharts";

export default function ClientSummaryEnhanced() {
  const [, params] = useRoute("/client-summary/:id");
  const clientId = parseInt(params?.id || "0");
  const [activeTab, setActiveTab] = useState("overview");
  const [, setLocation] = useLocation();

  // Navigation handlers for strategic actions
  const handleNewDeliverable = () => {
    console.log("Navigating to projects page");
    setLocation(`/projects`);
  };

  const handleNPSSurvey = () => {
    console.log("Navigating to conversations page");
    setLocation(`/conversations`);
  };

  const handleGenerateReport = () => {
    console.log("Navigating to dashboard page");
    setLocation(`/dashboard`);
  };

  const handleUpdateQuality = () => {
    console.log("Switching to quality tab");
    setActiveTab("quality");
  };

  const handleClientConfiguration = () => {
    console.log("Staying on overview tab");
    setActiveTab("overview");
  };

  // Queries for comprehensive client data
  const { data: clientData } = useQuery({
    queryKey: [`/api/clients/${clientId}`],
    enabled: !!clientId,
  });

  const { data: clientSummary } = useQuery({
    queryKey: [`/api/clients/${clientId}/modo-summary`],
    enabled: !!clientId,
  });

  const { data: deliverables = [] } = useQuery({
    queryKey: [`/api/clients/${clientId}/deliverables`],
    enabled: !!clientId,
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: [`/api/time-entries/client/${clientId}`],
    enabled: !!clientId,
  });

  const { data: projects = [] } = useQuery({
    queryKey: [`/api/clients/${clientId}/projects`],
    enabled: !!clientId,
  });

  const { data: personnel = [] } = useQuery({
    queryKey: ["/api/personnel"],
  });

  if (!clientData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Cargando resumen del cliente...</p>
        </div>
      </div>
    );
  }

  // Calculate comprehensive metrics
  const projectsArray = Array.isArray(projects) ? projects : [];
  const timeEntriesArray = Array.isArray(timeEntries) ? timeEntries : [];
  const personnelArray = Array.isArray(personnel) ? personnel : [];
  const deliverablesArray = Array.isArray(deliverables) ? deliverables : [];
  
  const totalProjects = projectsArray.length;
  const activeProjects = projectsArray.filter((p: any) => p.completionStatus === 'in_progress').length;
  const completedProjects = projectsArray.filter((p: any) => p.completionStatus === 'completed').length;
  
  const totalHours = timeEntriesArray.reduce((sum: number, entry: any) => sum + entry.hours, 0);
  const totalCost = timeEntriesArray.reduce((sum: number, entry: any) => {
    const person = personnelArray.find((p: any) => p.id === entry.personnelId);
    return sum + (entry.hours * (person?.hourlyRate || 50));
  }, 0);

  const onTimeDeliveries = deliverablesArray.filter((d: any) => d.deliveredOnTime).length;
  const onTimePercentage = deliverablesArray.length > 0 ? (onTimeDeliveries / deliverablesArray.length) * 100 : 0;

  // Performance trends data
  const monthlyData = [
    { month: 'Ene', deliverables: 3, hours: 45, satisfaction: 4.2 },
    { month: 'Feb', deliverables: 4, hours: 52, satisfaction: 4.5 },
    { month: 'Mar', deliverables: 2, hours: 38, satisfaction: 4.3 },
    { month: 'Abr', deliverables: 5, hours: 68, satisfaction: 4.6 },
    { month: 'May', deliverables: 3, hours: 42, satisfaction: 4.4 },
    { month: 'Jun', deliverables: 4, hours: 55, satisfaction: 4.7 }
  ];

  // Team distribution data
  const teamData = [
    { name: 'Analistas', hours: 120, cost: 6000, color: '#0088FE' },
    { name: 'Diseñadores', hours: 80, cost: 4800, color: '#00C49F' },
    { name: 'Estrategas', hours: 60, cost: 4200, color: '#FFBB28' },
    { name: 'Project Managers', hours: 40, cost: 3200, color: '#FF8042' }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* ENHANCED HEADER */}
      <div className="border-b bg-white sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Link href="/clients">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Clientes
                </Button>
              </Link>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={(clientData as any)?.logoUrl} alt={(clientData as any)?.name} />
                  <AvatarFallback className="bg-blue-100 text-blue-700 text-xl font-bold">
                    {((clientData as any)?.name || 'CL').split(' ').map((n: string) => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-3xl font-bold text-foreground">{(clientData as any)?.name || 'Cliente'}</h1>
                  <p className="text-muted-foreground mt-1">Always-On Client • Social Listening</p>
                  <div className="flex items-center gap-4 mt-2">
                    <Badge variant="outline" className="text-xs">
                      <Activity className="h-3 w-3 mr-1" />
                      {activeProjects} proyectos activos
                    </Badge>
                    <Badge variant={onTimePercentage >= 80 ? "default" : "destructive"} className="text-xs">
                      <Target className="h-3 w-3 mr-1" />
                      {Math.round(onTimePercentage)}% entregas a tiempo
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm">
                <MessageSquare className="h-4 w-4 mr-2" />
                Encuesta NPS
              </Button>
              <Button variant="outline" size="sm">
                <Star className="h-4 w-4 mr-2" />
                Calificar Calidad
              </Button>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                <BarChart3 className="h-4 w-4 mr-2" />
                Reportes Avanzados
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* KPI DASHBOARD */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700">Entregables Totales</p>
                  <p className="text-3xl font-bold text-blue-900">{deliverablesArray.length}</p>
                  <p className="text-xs text-blue-600 mt-1">+2 este mes</p>
                </div>
                <FileText className="h-12 w-12 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">Entregas a Tiempo</p>
                  <p className="text-3xl font-bold text-green-900">{Math.round(onTimePercentage)}%</p>
                  <p className="text-xs text-green-600 mt-1">
                    {onTimePercentage >= 80 ? 'Excelente' : 'Mejorable'}
                  </p>
                </div>
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-700">Puntuación NPS</p>
                  <p className="text-3xl font-bold text-purple-900">+47</p>
                  <p className="text-xs text-purple-600 mt-1">Promotor fuerte</p>
                </div>
                <Star className="h-12 w-12 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-700">Horas Totales</p>
                  <p className="text-3xl font-bold text-orange-900">{totalHours}h</p>
                  <p className="text-xs text-orange-600 mt-1">${(totalCost / totalHours || 0).toFixed(0)}/hora</p>
                </div>
                <Clock className="h-12 w-12 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* STRATEGIC ALERTS SECTION */}
        <div className="mb-8">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Centro de Alertas Estratégicas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-amber-800">Entregable Crítico</p>
                      <p className="text-sm text-amber-600 mt-1">Informe Mayo vence en 2 días</p>
                      <div className="mt-3">
                        <Button size="sm" variant="outline" className="text-xs">
                          Ver Detalles
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-blue-800">Encuesta NPS</p>
                      <p className="text-sm text-blue-600 mt-1">Q2 2024 programada próxima semana</p>
                      <div className="mt-3">
                        <Button size="sm" variant="outline" className="text-xs">
                          Preparar Envío
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-green-800">Rendimiento Óptimo</p>
                      <p className="text-sm text-green-600 mt-1">Todas las métricas en rango objetivo</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex justify-center">
                <Button variant="ghost" className="text-sm">
                  <Eye className="h-4 w-4 mr-2" />
                  Ver todas las alertas
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* COMPREHENSIVE TABS INTERFACE */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Resumen</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="projects">Proyectos</TabsTrigger>
            <TabsTrigger value="team">Equipo</TabsTrigger>
            <TabsTrigger value="quality">Calidad</TabsTrigger>
            <TabsTrigger value="financials">Financiero</TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-6">
            {/* Performance Chart - Full Width */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Tendencias de Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="deliverables" stroke="#0088FE" strokeWidth={3} name="Entregables" />
                    <Line type="monotone" dataKey="satisfaction" stroke="#00C49F" strokeWidth={3} name="Satisfacción" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Bottom Section - Three Columns */}
            <div className="grid gap-6 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Acciones Estratégicas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full justify-start" variant="outline" onClick={handleNewDeliverable}>
                    <FileText className="h-4 w-4 mr-2" />
                    Nuevo Entregable
                  </Button>
                  <Button className="w-full justify-start" variant="outline" onClick={handleNPSSurvey}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Encuesta NPS Trimestral
                  </Button>
                  <Button className="w-full justify-start" variant="outline" onClick={handleGenerateReport}>
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Generar Reporte
                  </Button>
                  <Button className="w-full justify-start" variant="outline" onClick={handleUpdateQuality}>
                    <Star className="h-4 w-4 mr-2" />
                    Actualizar Calidad
                  </Button>
                  <Button className="w-full justify-start" variant="outline" onClick={handleClientConfiguration}>
                    <Settings className="h-4 w-4 mr-2" />
                    Configuración Cliente
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-blue-500" />
                    Estado del Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Relación</span>
                    <Badge variant="default" className="bg-green-100 text-green-700">Always-On</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Satisfacción</span>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      <span className="text-sm font-medium">4.6/5.0</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Próxima Entrega</span>
                    <span className="text-sm font-medium">2 días</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Facturación</span>
                    <span className="text-sm font-medium text-green-600">Al día</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-purple-500" />
                    Equipo Asignado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">AM</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-medium">Account Manager</div>
                        <div className="text-xs text-gray-500">Belén López</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-green-100 text-green-700 text-xs">AN</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-medium">Analista Senior</div>
                        <div className="text-xs text-gray-500">Aylen Magali</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-purple-100 text-purple-700 text-xs">DS</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-medium">Diseñador</div>
                        <div className="text-xs text-gray-500">Marina Silva</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* PERFORMANCE TAB */}
          <TabsContent value="performance" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Cumplimiento de Entregas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">A Tiempo</span>
                        <span className="text-sm text-muted-foreground">{onTimeDeliveries}/{deliverablesArray.length}</span>
                      </div>
                      <Progress value={onTimePercentage} className="h-3" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">Calidad Promedio</span>
                        <span className="text-sm text-muted-foreground">4.5/5.0</span>
                      </div>
                      <Progress value={90} className="h-3" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">Satisfacción Cliente</span>
                        <span className="text-sm text-muted-foreground">92%</span>
                      </div>
                      <Progress value={92} className="h-3" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Distribución de Horas por Rol</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={teamData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="hours"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {teamData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* PROJECTS TAB */}
          <TabsContent value="projects" className="space-y-6">
            <div className="grid gap-4">
              {projectsArray.map((project: any) => (
                <Card key={project.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                          <FileText className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{project.subprojectName || project.projectName}</h3>
                          <p className="text-sm text-muted-foreground">{project.notes}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {project.completionStatus === 'completed' ? 'Completado' : 
                               project.completionStatus === 'in_progress' ? 'En Progreso' : 'Pendiente'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Inicio: {new Date(project.startDate).toLocaleDateString('es-ES')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Link href={`/active-projects/${project.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalles
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* TEAM TAB */}
          <TabsContent value="team" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Análisis de Recursos por Rol</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={teamData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="hours" fill="#0088FE" name="Horas" />
                    <Bar dataKey="cost" fill="#00C49F" name="Costo ($)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* QUALITY TAB */}
          <TabsContent value="quality" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Métricas de Calidad</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">4.6</div>
                      <div className="text-sm text-green-700">Calidad Narrativa</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">4.4</div>
                      <div className="text-sm text-blue-700">Efectividad Gráfica</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">4.7</div>
                      <div className="text-sm text-purple-700">Insights Relevantes</div>
                    </div>
                    <div className="text-center p-4 bg-orange-50 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">4.5</div>
                      <div className="text-sm text-orange-700">Cumplimiento Brief</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Historial de Feedback</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-sm">Informe Mayo 2024</span>
                        <Badge variant="default" className="text-xs">Excelente</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        "Insights muy valiosos sobre tendencias de mercado"
                      </p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-sm">Informe Abril 2024</span>
                        <Badge variant="secondary" className="text-xs">Bueno</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        "Gráficos claros, narrativa podría mejorarse"
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* FINANCIALS TAB */}
          <TabsContent value="financials" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Resumen Financiero</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Costo Total</span>
                      <span className="font-semibold">${totalCost.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Costo Promedio/Hora</span>
                      <span className="font-semibold">${(totalCost / totalHours || 0).toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Horas Totales</span>
                      <span className="font-semibold">{totalHours}h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Proyectos Activos</span>
                      <span className="font-semibold">{activeProjects}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Evolución de Costos Mensuales</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="hours" stackId="1" stroke="#0088FE" fill="#0088FE" fillOpacity={0.6} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}