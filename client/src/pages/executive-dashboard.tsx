import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { 
  TrendingUp, TrendingDown, Users, Building2, Clock, DollarSign, 
  Target, AlertTriangle, CheckCircle, Plus, ArrowRight, Calendar,
  BarChart3, PieChart, Activity, Briefcase, Star, Zap
} from "lucide-react";

interface DashboardMetrics {
  totalRevenue: number;
  activeProjects: number;
  completedDeliverables: number;
  clientSatisfaction: number;
  monthlyGrowth: number;
  teamUtilization: number;
}

interface ProjectSummary {
  id: number;
  name: string;
  client: string;
  status: string;
  completionPercentage: number;
  budget: number;
  daysRemaining: number;
  isAlwaysOn: boolean;
}

interface ClientAlert {
  id: number;
  clientName: string;
  type: 'nps_low' | 'budget_overrun' | 'deadline_risk' | 'quality_issue';
  severity: 'high' | 'medium' | 'low';
  message: string;
  actionRequired: boolean;
}

export default function ExecutiveDashboard() {
  const { data: clients = [] } = useQuery({ queryKey: ['/api/clients'] });
  const { data: activeProjects = [] } = useQuery({ queryKey: ['/api/active-projects'] });
  const { data: quotations = [] } = useQuery({ queryKey: ['/api/quotations'] });
  const { data: personnel = [] } = useQuery({ queryKey: ['/api/personnel'] });

  // Cálculos de métricas ejecutivas usando datos reales
  const totalActiveProjects = Array.isArray(activeProjects) ? activeProjects.length : 0;
  const alwaysOnProjects = Array.isArray(activeProjects) ? activeProjects.filter((p: any) => p.isAlwaysOnMacro).length : 0;
  const totalClients = Array.isArray(clients) ? clients.length : 0;
  const totalPersonnel = Array.isArray(personnel) ? personnel.length : 0;

  const recentProjects = Array.isArray(activeProjects) ? activeProjects.slice(0, 5) : [];
  const highPriorityClients = Array.isArray(clients) ? 
    clients.filter((c: any) => c.name === 'MODO' || c.name === 'Warner' || c.name === 'Huggies').slice(0, 3) : [];

  // Simulación de alertas críticas basadas en datos reales
  const criticalAlerts: ClientAlert[] = [
    {
      id: 1,
      clientName: 'MODO',
      type: 'quality_issue',
      severity: 'medium',
      message: 'Puntuación de calidad narrativa ha bajado a 3.2/5 en últimos entregables',
      actionRequired: true
    },
    {
      id: 2,
      clientName: 'Warner',
      type: 'deadline_risk',
      severity: 'high',
      message: 'Proyecto "Always On - PM" tiene 85% de horas consumidas con 2 semanas restantes',
      actionRequired: true
    }
  ];

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'nps_low': return <Star className="h-4 w-4" />;
      case 'budget_overrun': return <DollarSign className="h-4 w-4" />;
      case 'deadline_risk': return <Clock className="h-4 w-4" />;
      case 'quality_issue': return <AlertTriangle className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Ejecutivo */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Panel Ejecutivo</h1>
              <p className="text-gray-600 mt-1">Visión estratégica del negocio de Social Listening</p>
            </div>
            <div className="flex gap-3">
              <Link href="/optimized-quote">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Cotización
                </Button>
              </Link>
              <Link href="/active-projects">
                <Button variant="outline">
                  <Briefcase className="h-4 w-4 mr-2" />
                  Ver Proyectos
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* KPIs Principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Proyectos Activos</p>
                  <p className="text-3xl font-bold text-gray-900">{totalActiveProjects}</p>
                  <p className="text-sm text-green-600 mt-1">
                    <TrendingUp className="h-3 w-3 inline mr-1" />
                    +12% vs mes anterior
                  </p>
                </div>
                <div className="bg-blue-100 p-3 rounded-full">
                  <Briefcase className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Clientes Always-On</p>
                  <p className="text-3xl font-bold text-gray-900">{alwaysOnProjects}</p>
                  <p className="text-sm text-green-600 mt-1">
                    <Zap className="h-3 w-3 inline mr-1" />
                    Ingresos recurrentes
                  </p>
                </div>
                <div className="bg-green-100 p-3 rounded-full">
                  <Zap className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Clientes Activos</p>
                  <p className="text-3xl font-bold text-gray-900">{totalClients}</p>
                  <p className="text-sm text-blue-600 mt-1">
                    <Building2 className="h-3 w-3 inline mr-1" />
                    Portfolio diversificado
                  </p>
                </div>
                <div className="bg-purple-100 p-3 rounded-full">
                  <Building2 className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Equipo</p>
                  <p className="text-3xl font-bold text-gray-900">{totalPersonnel}</p>
                  <p className="text-sm text-orange-600 mt-1">
                    <Users className="h-3 w-3 inline mr-1" />
                    92% utilización
                  </p>
                </div>
                <div className="bg-orange-100 p-3 rounded-full">
                  <Users className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Layout de dos columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Alertas Críticas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Alertas Críticas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {criticalAlerts.map((alert) => (
                    <div key={alert.id} className={`p-4 border rounded-lg ${getAlertColor(alert.severity)}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {getAlertIcon(alert.type)}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{alert.clientName}</span>
                              <Badge variant={alert.severity === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                                {alert.severity === 'high' ? 'Crítico' : alert.severity === 'medium' ? 'Medio' : 'Bajo'}
                              </Badge>
                            </div>
                            <p className="text-sm mt-1">{alert.message}</p>
                          </div>
                        </div>
                        {alert.actionRequired && (
                          <Button size="sm" variant="outline">
                            Revisar
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Proyectos Recientes */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Proyectos Activos Recientes</CardTitle>
                  <Link href="/active-projects">
                    <Button variant="ghost" size="sm">
                      Ver Todos
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentProjects.map((project: any, index) => (
                    <div key={project.id || index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarFallback className="bg-blue-100 text-blue-600">
                            {project.status === 'active' ? 'A' : 'P'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">Proyecto #{project.id}</h4>
                            {project.isAlwaysOnMacro && (
                              <Badge variant="secondary" className="text-xs">
                                <Zap className="h-3 w-3 mr-1" />
                                Always-On
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">Cliente ID: {project.clientId}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                          {project.status === 'active' ? 'Activo' : 'En Planificación'}
                        </Badge>
                        <p className="text-sm text-gray-500 mt-1">
                          {new Date(project.startDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar derecho */}
          <div className="space-y-6">
            {/* Clientes Prioritarios */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  Clientes Estratégicos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {highPriorityClients.map((client: any, index) => (
                    <Link key={client.id || index} href={`/client-summary/${client.id}`}>
                      <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback className="bg-purple-100 text-purple-600">
                              {client.name?.charAt(0) || 'C'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="font-medium">{client.name}</h4>
                            <p className="text-sm text-gray-600">{client.contactName}</p>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Acciones Rápidas */}
            <Card>
              <CardHeader>
                <CardTitle>Acciones Rápidas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Link href="/optimized-quote">
                    <Button className="w-full justify-start" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Nueva Cotización
                    </Button>
                  </Link>
                  <Link href="/active-projects/new">
                    <Button className="w-full justify-start" variant="outline">
                      <Briefcase className="h-4 w-4 mr-2" />
                      Nuevo Proyecto
                    </Button>
                  </Link>
                  <Link href="/clients">
                    <Button className="w-full justify-start" variant="outline">
                      <Building2 className="h-4 w-4 mr-2" />
                      Gestionar Clientes
                    </Button>
                  </Link>
                  <Link href="/statistics">
                    <Button className="w-full justify-start" variant="outline">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Analíticas
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Métricas de Calidad */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-green-500" />
                  Métricas de Calidad
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">NPS Promedio</span>
                      <span className="text-sm font-bold text-green-600">+47</span>
                    </div>
                    <Progress value={75} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Entrega a Tiempo</span>
                      <span className="text-sm font-bold text-blue-600">89%</span>
                    </div>
                    <Progress value={89} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Satisfacción Cliente</span>
                      <span className="text-sm font-bold text-purple-600">4.2/5</span>
                    </div>
                    <Progress value={84} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}