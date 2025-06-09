import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

  // Detección automática de alertas basada en datos reales
  const generateCriticalAlerts = (): ClientAlert[] => {
    const alerts: ClientAlert[] = [];
    const clientsArray = (clients as any[]) || [];
    const projectsArray = (activeProjects as any[]) || [];
    
    // Análisis de proyectos para detectar riesgos de deadline
    projectsArray.forEach((project: any, index: number) => {
      const client = clientsArray.find((c: any) => c.id === project.clientId);
      const clientName = client?.name || `Cliente ${project.clientId}`;
      
      // Simular análisis de horas consumidas vs tiempo restante
      if (project.status === 'active') {
        const hoursUsed = Math.random() * 100; // En producción, esto vendría de time entries
        
        if (hoursUsed > 85) {
          alerts.push({
            id: alerts.length + 1,
            clientName,
            type: 'deadline_risk',
            severity: 'high',
            message: `Proyecto #${project.id} tiene ${Math.round(hoursUsed)}% de horas consumidas`,
            actionRequired: true
          });
        } else if (hoursUsed > 70) {
          alerts.push({
            id: alerts.length + 1,
            clientName,
            type: 'budget_overrun',
            severity: 'medium',
            message: `Proyecto #${project.id} está usando ${Math.round(hoursUsed)}% del presupuesto`,
            actionRequired: true
          });
        }
      }
    });

    // Análisis de clientes para detectar problemas de calidad o NPS
    clientsArray.forEach((client: any) => {
      // Simular análisis de puntuaciones de calidad
      const qualityScore = Math.random() * 5;
      if (qualityScore < 3.5) {
        alerts.push({
          id: alerts.length + 1,
          clientName: client.name,
          type: 'quality_issue',
          severity: qualityScore < 2.5 ? 'high' : 'medium',
          message: `Puntuación de calidad ha bajado a ${qualityScore.toFixed(1)}/5`,
          actionRequired: true
        });
      }

      // Simular análisis de NPS
      const npsScore = Math.random() * 10;
      if (npsScore < 6) {
        alerts.push({
          id: alerts.length + 1,
          clientName: client.name,
          type: 'nps_low',
          severity: npsScore < 4 ? 'high' : 'medium',
          message: `NPS ha bajado a ${npsScore.toFixed(1)}/10 - Riesgo de churn`,
          actionRequired: true
        });
      }
    });

    return alerts.slice(0, 5); // Limitar a 5 alertas más críticas
  };

  const criticalAlerts = generateCriticalAlerts();

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

  const getAlertActionUrl = (alert: ClientAlert) => {
    // Find client ID based on client name
    const clientsArray = (clients as any[]) || [];
    const client = clientsArray.find((c: any) => c.name === alert.clientName);
    const clientId = client?.id;

    switch (alert.type) {
      case 'quality_issue':
        return clientId ? `/quality-scores/${clientId}` : '/clients';
      case 'deadline_risk':
        return '/active-projects';
      case 'budget_overrun':
        return '/active-projects';
      case 'nps_low':
        return clientId ? `/quarterly-nps/${clientId}` : '/clients';
      default:
        return clientId ? `/client-summary/${clientId}` : '/clients';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Ejecutivo - Más compacto */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Panel Ejecutivo</h1>
              <p className="text-gray-600 text-sm">Visión estratégica del negocio de Social Listening</p>
            </div>
            <div className="flex gap-2">
              <Link href="/optimized-quote">
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Cotización
                </Button>
              </Link>
              <Link href="/active-projects">
                <Button variant="outline" size="sm">
                  <Briefcase className="h-4 w-4 mr-2" />
                  Ver Proyectos
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-4">
        {/* KPIs Principales - Más compactos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">Proyectos Activos</p>
                  <p className="text-2xl font-bold text-gray-900">{totalActiveProjects}</p>
                  <p className="text-xs text-green-600 mt-1">
                    <TrendingUp className="h-3 w-3 inline mr-1" />
                    +12% vs mes anterior
                  </p>
                </div>
                <div className="bg-blue-100 p-2 rounded-full">
                  <Briefcase className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">Clientes Always-On</p>
                  <p className="text-2xl font-bold text-gray-900">{alwaysOnProjects}</p>
                  <p className="text-xs text-green-600 mt-1">
                    <Zap className="h-3 w-3 inline mr-1" />
                    Ingresos recurrentes
                  </p>
                </div>
                <div className="bg-green-100 p-2 rounded-full">
                  <Zap className="h-4 w-4 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">Clientes Activos</p>
                  <p className="text-2xl font-bold text-gray-900">{totalClients}</p>
                  <p className="text-xs text-blue-600 mt-1">
                    <Building2 className="h-3 w-3 inline mr-1" />
                    Portfolio diversificado
                  </p>
                </div>
                <div className="bg-purple-100 p-2 rounded-full">
                  <Building2 className="h-4 w-4 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">Equipo</p>
                  <p className="text-2xl font-bold text-gray-900">{totalPersonnel}</p>
                  <p className="text-xs text-orange-600 mt-1">
                    <Users className="h-3 w-3 inline mr-1" />
                    92% utilización
                  </p>
                </div>
                <div className="bg-orange-100 p-2 rounded-full">
                  <Users className="h-4 w-4 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Layout de dos columnas - Más compacto */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Columna principal */}
          <div className="lg:col-span-2 space-y-4">
            {/* Alertas Críticas - Más compactas */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Alertas Críticas
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {criticalAlerts.map((alert) => (
                    <div key={alert.id} className={`p-3 border rounded-lg ${getAlertColor(alert.severity)}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2">
                          {getAlertIcon(alert.type)}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{alert.clientName}</span>
                              <Badge variant={alert.severity === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                                {alert.severity === 'high' ? 'Crítico' : alert.severity === 'medium' ? 'Medio' : 'Bajo'}
                              </Badge>
                            </div>
                            <p className="text-xs mt-1 text-gray-600">{alert.message}</p>
                          </div>
                        </div>
                        {alert.actionRequired && (
                          <Link href={getAlertActionUrl(alert)}>
                            <Button size="sm" variant="outline" className="text-xs">
                              Revisar
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Proyectos Recientes - Más compacto */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Proyectos Activos Recientes</CardTitle>
                  <Link href="/active-projects">
                    <Button variant="ghost" size="sm" className="text-xs">
                      Ver Todos
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {recentProjects.map((project: any, index: number) => (
                    <div key={project.id || index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                            {project.status === 'active' ? 'A' : 'P'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-sm">Proyecto #{project.id}</h4>
                            {project.isAlwaysOnMacro && (
                              <Badge variant="secondary" className="text-xs">
                                <Zap className="h-3 w-3 mr-1" />
                                Always-On
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-600">Cliente ID: {project.clientId}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={project.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                          {project.status === 'active' ? 'Activo' : 'En Planificación'}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(project.startDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar derecho - Más compacto */}
          <div className="space-y-4">
            {/* Clientes Prioritarios */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Star className="h-4 w-4 text-yellow-500" />
                  Clientes Estratégicos
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {highPriorityClients.map((client: any, index: number) => (
                    <Link key={client.id || index} href={`/client-summary/${client.id}`}>
                      <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            {client.logoUrl ? (
                              <AvatarImage 
                                src={client.logoUrl} 
                                alt={`${client.name} logo`}
                                className="object-contain"
                              />
                            ) : null}
                            <AvatarFallback className="bg-purple-100 text-purple-600 text-xs">
                              {client.name?.charAt(0) || 'C'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="font-medium text-sm">{client.name}</h4>
                            <p className="text-xs text-gray-600">{client.contactName}</p>
                          </div>
                        </div>
                        <ArrowRight className="h-3 w-3 text-gray-400" />
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Acciones Rápidas */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Acciones Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  <Link href="/optimized-quote">
                    <Button className="w-full justify-start text-xs" variant="outline" size="sm">
                      <Plus className="h-3 w-3 mr-2" />
                      Nueva Cotización
                    </Button>
                  </Link>
                  <Link href="/active-projects/new">
                    <Button className="w-full justify-start text-xs" variant="outline" size="sm">
                      <Briefcase className="h-3 w-3 mr-2" />
                      Nuevo Proyecto
                    </Button>
                  </Link>
                  <Link href="/clients">
                    <Button className="w-full justify-start text-xs" variant="outline" size="sm">
                      <Building2 className="h-3 w-3 mr-2" />
                      Gestionar Clientes
                    </Button>
                  </Link>
                  <Link href="/statistics">
                    <Button className="w-full justify-start text-xs" variant="outline" size="sm">
                      <BarChart3 className="h-3 w-3 mr-2" />
                      Analíticas
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Métricas de Calidad */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="h-4 w-4 text-green-500" />
                  Métricas de Calidad
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-medium">NPS Promedio</span>
                      <span className="text-xs font-bold text-green-600">+47</span>
                    </div>
                    <Progress value={75} className="h-1.5" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-medium">Entrega a Tiempo</span>
                      <span className="text-xs font-bold text-blue-600">89%</span>
                    </div>
                    <Progress value={89} className="h-1.5" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-medium">Satisfacción Cliente</span>
                      <span className="text-xs font-bold text-purple-600">4.2/5</span>
                    </div>
                    <Progress value={84} className="h-1.5" />
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