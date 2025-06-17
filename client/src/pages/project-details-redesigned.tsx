import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft,
  Calendar,
  Clock,
  DollarSign,
  Users,
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Play,
  Pause,
  Settings,
  FileText,
  BarChart3,
  Timer,
  Plus,
  Edit,
  Eye,
  Activity,
  Zap,
  Briefcase,
  MapPin,
  Mail,
  Phone,
  Building,
  Percent,
  CalendarClock,
  Gauge
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import QuickTimeRegister from "@/components/quick-time-register";

interface ProjectMetric {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: any;
  color: string;
  bgColor: string;
  change?: number;
}

interface TimeEntry {
  id: number;
  personnelId: number;
  personnelName: string;
  date: string;
  hours: number;
  description?: string;
  roleName?: string;
  hourlyRate?: number;
}

export default function ProjectDetailsRedesigned() {
  const { id: projectId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [showQuickRegister, setShowQuickRegister] = useState(false);

  // Datos del proyecto
  const { data: project, isLoading } = useQuery({
    queryKey: [`/api/active-projects/${projectId}`],
    enabled: !!projectId,
  });

  const { data: client } = useQuery({
    queryKey: [`/api/clients/${(project as any)?.clientId}`],
    enabled: !!(project as any)?.clientId,
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: [`/api/time-entries/project/${projectId}`],
    enabled: !!projectId,
  });

  const { data: baseTeam = [] } = useQuery({
    queryKey: [`/api/projects/${projectId}/base-team`],
    enabled: !!projectId,
  });

  // Cálculos principales
  const metrics = useMemo(() => {
    if (!project || !Array.isArray(timeEntries)) return [];

    const projectData = project as any;
    const totalHours = timeEntries.reduce((sum: number, entry: TimeEntry) => sum + (entry.hours || 0), 0);
    const totalCost = timeEntries.reduce((sum: number, entry: TimeEntry) => 
      sum + ((entry.hours || 0) * (entry.hourlyRate || 100)), 0);
    const budget = projectData.quotation?.totalAmount || projectData.deliverableBudget || 0;
    const estimatedHours = budget / 100; // Aproximación
    const progressPercentage = estimatedHours > 0 ? (totalHours / estimatedHours) * 100 : 0;
    const costEfficiency = budget > 0 ? ((budget - totalCost) / budget) * 100 : 0;

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'active': return { color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' };
        case 'paused': return { color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' };
        case 'completed': return { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' };
        default: return { color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' };
      }
    };

    const statusConfig = getStatusColor(projectData.status);

    return [
      {
        label: "Presupuesto Total",
        value: `$${budget.toLocaleString()}`,
        subtitle: `${costEfficiency > 0 ? 'Ahorro' : 'Sobrecosto'}: ${Math.abs(costEfficiency).toFixed(1)}%`,
        icon: DollarSign,
        color: "text-green-700",
        bgColor: "bg-gradient-to-br from-green-50 to-green-100",
        change: costEfficiency
      },
      {
        label: "Horas Registradas",
        value: `${totalHours.toFixed(1)}h`,
        subtitle: `de ${estimatedHours.toFixed(0)}h estimadas`,
        icon: Clock,
        color: "text-blue-700",
        bgColor: "bg-gradient-to-br from-blue-50 to-blue-100",
        change: progressPercentage > 100 ? -(progressPercentage - 100) : progressPercentage - 100
      },
      {
        label: "Progreso",
        value: `${progressPercentage.toFixed(1)}%`,
        subtitle: progressPercentage > 100 ? "Excedido" : "En progreso",
        icon: Target,
        color: progressPercentage > 100 ? "text-red-700" : "text-purple-700",
        bgColor: progressPercentage > 100 ? "bg-gradient-to-br from-red-50 to-red-100" : "bg-gradient-to-br from-purple-50 to-purple-100",
        change: progressPercentage - 50
      },
      {
        label: "Estado",
        value: projectData.status === 'active' ? 'Activo' : 
               projectData.status === 'paused' ? 'Pausado' : 
               projectData.status === 'completed' ? 'Completado' : 'Desconocido',
        subtitle: projectData.completionStatus || "Sin actualizar",
        icon: projectData.status === 'active' ? Play : projectData.status === 'paused' ? Pause : CheckCircle2,
        color: statusConfig.color,
        bgColor: statusConfig.bg,
      }
    ];
  }, [project, timeEntries]);

  const recentTimeEntries = useMemo(() => {
    if (!Array.isArray(timeEntries)) return [];
    return timeEntries
      .sort((a: TimeEntry, b: TimeEntry) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [timeEntries]);

  const teamStats = useMemo(() => {
    if (!Array.isArray(timeEntries) || !Array.isArray(baseTeam)) return [];
    
    const memberStats = new Map();
    
    timeEntries.forEach((entry: TimeEntry) => {
      if (!memberStats.has(entry.personnelId)) {
        memberStats.set(entry.personnelId, {
          id: entry.personnelId,
          name: entry.personnelName,
          hours: 0,
          entries: 0,
          lastActivity: entry.date
        });
      }
      
      const stats = memberStats.get(entry.personnelId);
      stats.hours += entry.hours;
      stats.entries += 1;
      
      if (new Date(entry.date) > new Date(stats.lastActivity)) {
        stats.lastActivity = entry.date;
      }
    });

    return Array.from(memberStats.values())
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);
  }, [timeEntries, baseTeam]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando proyecto...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Proyecto no encontrado</h2>
          <p className="text-gray-600 mb-4">El proyecto solicitado no existe o no tienes permisos para verlo.</p>
          <Button onClick={() => setLocation("/active-projects")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Proyectos
          </Button>
        </div>
      </div>
    );
  }

  const projectData = project as any;
  const clientData = client as any;
  const projectName = projectData?.quotation?.projectName || projectData?.name || "Proyecto sin nombre";
  const clientName = clientData?.name || "Cliente desconocido";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header moderno */}
      <div className="bg-gradient-to-r from-white via-blue-50 to-purple-50 border-b border-gray-200 shadow-sm">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/active-projects")}
                className="hover:bg-gray-100"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Proyectos
              </Button>
              
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {projectName}
                </h1>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Building className="h-4 w-4" />
                    <span className="font-medium">{clientName}</span>
                  </div>
                  <Separator orientation="vertical" className="h-4" />
                  <Badge 
                    variant="outline" 
                    className={`${metrics[3]?.color} ${metrics[3]?.bgColor} border-current`}
                  >
                    {metrics[3]?.value}
                  </Badge>
                  {projectData.isAlwaysOnMacro && (
                    <>
                      <Separator orientation="vertical" className="h-4" />
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                        Always-On
                      </Badge>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="default"
                onClick={() => setShowQuickRegister(!showQuickRegister)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Timer className="h-4 w-4 mr-2" />
                Registrar Tiempo
              </Button>
              
              <Button variant="outline" onClick={() => setLocation(`/project-analytics/${projectId}`)}>
                <BarChart3 className="h-4 w-4 mr-2" />
                Analíticas
              </Button>
              
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Configurar
              </Button>
            </div>
          </div>

          {/* Métricas principales */}
          <div className="grid grid-cols-4 gap-4">
            {metrics.map((metric, index) => {
              const IconComponent = metric.icon;
              return (
                <Card key={index} className={`${metric.bgColor} border-0 hover:shadow-md transition-all duration-200`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">{metric.label}</p>
                        <p className={`text-2xl font-bold ${metric.color}`}>{metric.value}</p>
                        {metric.subtitle && (
                          <p className="text-xs text-gray-500 mt-1">{metric.subtitle}</p>
                        )}
                      </div>
                      <div className={`p-3 rounded-full shadow-lg ${metric.color.replace('text-', 'bg-').replace('-700', '-500')}`}>
                        <IconComponent className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    {metric.change !== undefined && (
                      <div className="mt-2">
                        <div className={`flex items-center text-xs ${metric.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          <TrendingUp className="h-3 w-3 mr-1" />
                          {metric.change >= 0 ? '+' : ''}{metric.change.toFixed(1)}%
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Registro rápido de tiempo */}
      {showQuickRegister && (
        <div className="px-6 py-4 bg-white border-b border-gray-200">
          <QuickTimeRegister
            projectId={Number(projectId)}
            onSuccess={() => {
              setShowQuickRegister(false);
              queryClient.invalidateQueries({ queryKey: [`/api/time-entries/project/${projectId}`] });
              toast({
                title: "Tiempo registrado exitosamente",
                description: "Las horas han sido registradas en el proyecto",
              });
            }}
            onCancel={() => setShowQuickRegister(false)}
          />
        </div>
      )}

      {/* Contenido principal con tabs */}
      <div className="px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Resumen
            </TabsTrigger>
            <TabsTrigger value="time" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Tiempo
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Equipo
            </TabsTrigger>
            <TabsTrigger value="details" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Detalles
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              {/* Progreso del proyecto */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gauge className="h-5 w-5 text-blue-600" />
                    Progreso del Proyecto
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium">Avance General</span>
                      <span className="font-bold">{metrics[2]?.value}</span>
                    </div>
                    <Progress value={parseFloat(metrics[2]?.value.replace('%', '') || '0')} className="h-3" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Horas trabajadas</p>
                      <p className="font-semibold text-lg">{metrics[1]?.value}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Presupuesto usado</p>
                      <p className="font-semibold text-lg">{metrics[0]?.subtitle}</p>
                    </div>
                  </div>

                  {parseFloat(metrics[2]?.value.replace('%', '') || '0') > 100 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-red-700">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="font-medium">Proyecto excedido</span>
                      </div>
                      <p className="text-sm text-red-600 mt-1">
                        El proyecto ha superado las horas estimadas. Requiere atención inmediata.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Actividad reciente */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-green-600" />
                    Actividad Reciente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentTimeEntries.length > 0 ? (
                      recentTimeEntries.map((entry: TimeEntry, index) => (
                        <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {entry.personnelName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{entry.personnelName}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(entry.date).toLocaleDateString('es-ES')}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-sm">{entry.hours}h</p>
                            <p className="text-xs text-gray-500">{entry.roleName}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-gray-500">
                        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No hay registros de tiempo aún</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Información del cliente */}
            {client && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-purple-600" />
                    Información del Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Nombre</p>
                      <p className="font-semibold">{clientData?.name}</p>
                    </div>
                    {clientData?.email && (
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Email</p>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <p className="font-semibold">{clientData.email}</p>
                        </div>
                      </div>
                    )}
                    {clientData?.phone && (
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Teléfono</p>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <p className="font-semibold">{clientData.phone}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="time" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-5 w-5 text-blue-600" />
                    Registros de Tiempo
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation(`/active-projects/${projectId}/time-entries`)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Ver Todos
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.isArray(timeEntries) && timeEntries.length > 0 ? (
                    timeEntries.slice(0, 10).map((entry: TimeEntry) => (
                      <div key={entry.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              {entry.personnelName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{entry.personnelName}</p>
                            <p className="text-sm text-gray-500">{entry.roleName}</p>
                            {entry.description && (
                              <p className="text-xs text-gray-400 mt-1">{entry.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-lg">{entry.hours}h</p>
                          <p className="text-sm text-gray-500">
                            {new Date(entry.date).toLocaleDateString('es-ES')}
                          </p>
                          {entry.hourlyRate && (
                            <p className="text-xs text-gray-400">
                              ${(entry.hours * entry.hourlyRate).toFixed(0)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <Timer className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No hay registros de tiempo</h3>
                      <p className="text-gray-600 mb-4">Comienza registrando las primeras horas de trabajo.</p>
                      <Button onClick={() => setShowQuickRegister(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Registrar Tiempo
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-600" />
                  Rendimiento del Equipo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {teamStats.length > 0 ? (
                    teamStats.map((member, index) => (
                      <div key={member.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <Avatar className="h-12 w-12">
                              <AvatarFallback className="bg-blue-100 text-blue-800">
                                {member.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            {index === 0 && (
                              <div className="absolute -top-1 -right-1 bg-yellow-500 rounded-full p-1">
                                <Zap className="h-3 w-3 text-white" />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold">{member.name}</p>
                            <p className="text-sm text-gray-500">{member.entries} registros</p>
                            <p className="text-xs text-gray-400">
                              Última actividad: {new Date(member.lastActivity).toLocaleDateString('es-ES')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-blue-600">{member.hours.toFixed(1)}h</p>
                          <p className="text-sm text-gray-500">Total trabajado</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Sin actividad del equipo</h3>
                      <p className="text-gray-600">No hay registros de tiempo del equipo aún.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="details" className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-gray-600" />
                    Información del Proyecto
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Tipo</p>
                    <p className="font-semibold">{projectData.deliverableType || "No especificado"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Fecha de inicio</p>
                    <p className="font-semibold">
                      {projectData.startDate ? new Date(projectData.startDate).toLocaleDateString('es-ES') : "No definida"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Fecha estimada de fin</p>
                    <p className="font-semibold">
                      {projectData.expectedEndDate ? new Date(projectData.expectedEndDate).toLocaleDateString('es-ES') : "No definida"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Estado de completitud</p>
                    <p className="font-semibold">{projectData.completionStatus || "Sin actualizar"}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-gray-600" />
                    Descripción y Notas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {projectData.notes ? (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Descripción</p>
                        <p className="text-gray-800 leading-relaxed">{projectData.notes}</p>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500">No hay descripción disponible</p>
                        <Button variant="outline" size="sm" className="mt-2">
                          <Edit className="h-4 w-4 mr-2" />
                          Agregar descripción
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}