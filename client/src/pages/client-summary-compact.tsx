import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  FileText,
  CheckCircle,
  Star,
  Clock,
  AlertTriangle,
  MessageSquare,
  TrendingUp,
  Target,
  DollarSign,
  Users,
  BarChart3,
  Calendar,
  Activity,
  Award,
  Zap,
  PieChart,
  Eye,
  Briefcase
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from "recharts";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const mockData = {
  totalDeliverables: 24,
  onTimePercentage: 92,
  npsScore: 47,
  totalHours: 156,
  activeProjects: 3,
  completedProjects: 8,
  totalBudget: 85000,
  spentBudget: 62000,
  teamEfficiency: 94,
  clientSatisfaction: 4.8,
  avgDeliveryTime: 3.2,
  qualityScore: 8.7
};

export default function ClientSummaryCompact() {
  const { clientId } = useParams();
  const [activeTab, setActiveTab] = useState("dashboard");

  // Data queries
  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: [`/api/clients/${clientId}`],
    enabled: !!clientId,
  });

  const { data: activeProjects = [], isLoading: projectsLoading } = useQuery({
    queryKey: [`/api/clients/${clientId}/active-projects`],
    enabled: !!clientId,
    retry: false,
  });

  const { data: quotations = [], isLoading: quotationsLoading } = useQuery({
    queryKey: [`/api/clients/${clientId}/quotations`],
    enabled: !!clientId,
    retry: false,
  });

  const { data: deliverablesData, isLoading: deliverablesLoading } = useQuery({
    queryKey: [`/api/clients/${clientId}/deliverables`],
    enabled: !!clientId,
    retry: false,
  });

  if (clientLoading) {
    return (
      <div className="min-h-screen bg-gray-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Cargando cliente...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-gray-50/30 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600">Cliente no encontrado</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/30">
      {/* Ultra-Compact Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-2">
          {/* Top row - Navigation and actions */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" asChild className="text-xs">
                <Link href="/clients">
                  <ArrowLeft className="h-3 w-3 mr-1" />
                  Clientes
                </Link>
              </Button>
              <Separator orientation="vertical" className="h-4" />
              {(client as any)?.logoUrl && (
                <img 
                  src={(client as any).logoUrl} 
                  alt={(client as any).name}
                  className="w-6 h-6 rounded object-contain"
                />
              )}
              <div>
                <h1 className="text-lg font-bold text-gray-900">{(client as any)?.name}</h1>
                <p className="text-xs text-gray-500">Always-On • Social Listening</p>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <Button variant="outline" size="sm" className="text-xs h-7 px-2">
                <MessageSquare className="h-3 w-3 mr-1" />
                NPS
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-7 px-2">
                <Star className="h-3 w-3 mr-1" />
                Calidad
              </Button>
              <Button size="sm" className="text-xs h-7 px-2">
                <FileText className="h-3 w-3 mr-1" />
                Reportes
              </Button>
            </div>
          </div>

          {/* Metrics row */}
          <div className="grid grid-cols-6 gap-2 mb-2">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded px-3 py-2 border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-700">Entregables</p>
                  <p className="text-sm font-bold text-blue-900">{mockData.totalDeliverables}</p>
                </div>
                <FileText className="h-4 w-4 text-blue-500" />
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-green-50 to-green-100 rounded px-3 py-2 border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-green-700">A Tiempo</p>
                  <p className="text-sm font-bold text-green-900">{mockData.onTimePercentage}%</p>
                </div>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded px-3 py-2 border border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-purple-700">NPS</p>
                  <p className="text-sm font-bold text-purple-900">+{mockData.npsScore}</p>
                </div>
                <Star className="h-4 w-4 text-purple-500" />
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded px-3 py-2 border border-orange-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-orange-700">Horas</p>
                  <p className="text-sm font-bold text-orange-900">{mockData.totalHours}h</p>
                </div>
                <Clock className="h-4 w-4 text-orange-500" />
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 rounded px-3 py-2 border border-emerald-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-emerald-700">Proyectos</p>
                  <p className="text-sm font-bold text-emerald-900">{mockData.activeProjects}</p>
                </div>
                <Briefcase className="h-4 w-4 text-emerald-500" />
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-rose-50 to-rose-100 rounded px-3 py-2 border border-rose-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-rose-700">Calidad</p>
                  <p className="text-sm font-bold text-rose-900">{mockData.qualityScore}</p>
                </div>
                <Award className="h-4 w-4 text-rose-500" />
              </div>
            </div>
          </div>

          {/* Alert strip */}
          <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded px-3 py-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-3 w-3 text-yellow-600" />
                <span className="text-xs font-medium text-yellow-800">Alertas:</span>
                <div className="flex items-center space-x-3 text-xs">
                  <span className="flex items-center space-x-1">
                    <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
                    <span className="text-red-700">1 Crítico</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                    <span className="text-blue-700">NPS Programado</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                    <span className="text-green-700">Performance OK</span>
                  </span>
                </div>
              </div>
              <Button size="sm" variant="outline" className="text-xs h-5 px-2">Ver</Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="dashboard" className="text-sm">Dashboard General</TabsTrigger>
            <TabsTrigger value="projects" className="text-sm">Proyectos y Performance</TabsTrigger>
            <TabsTrigger value="analytics" className="text-sm">Análisis y Reportes</TabsTrigger>
          </TabsList>

          {/* DASHBOARD GENERAL TAB */}
          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid grid-cols-12 gap-4">
              {/* Performance Overview - 5 columns */}
              <Card className="col-span-5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center">
                    <TrendingUp className="h-4 w-4 mr-2 text-blue-600" />
                    Performance General
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-blue-700">Eficiencia Equipo</span>
                        <Target className="h-3 w-3 text-blue-600" />
                      </div>
                      <div className="text-lg font-bold text-blue-900">{mockData.teamEfficiency}%</div>
                      <Progress value={mockData.teamEfficiency} className="h-1 mt-1" />
                    </div>
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-green-700">Satisfacción</span>
                        <Star className="h-3 w-3 text-green-600" />
                      </div>
                      <div className="text-lg font-bold text-green-900">{mockData.clientSatisfaction}/5</div>
                      <Progress value={mockData.clientSatisfaction * 20} className="h-1 mt-1" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-purple-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-purple-700">Tiempo Promedio</span>
                        <Clock className="h-3 w-3 text-purple-600" />
                      </div>
                      <div className="text-lg font-bold text-purple-900">{mockData.avgDeliveryTime}d</div>
                      <div className="text-xs text-purple-600">días por entregable</div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-orange-700">Score Calidad</span>
                        <Award className="h-3 w-3 text-orange-600" />
                      </div>
                      <div className="text-lg font-bold text-orange-900">{mockData.qualityScore}/10</div>
                      <Progress value={mockData.qualityScore * 10} className="h-1 mt-1" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Project Status - 3 columns */}
              <Card className="col-span-3">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center">
                    <Activity className="h-4 w-4 mr-2 text-green-600" />
                    Estado Proyectos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{mockData.activeProjects}</div>
                    <div className="text-xs text-gray-600">Proyectos Activos</div>
                  </div>
                  <div className="space-y-2">
                    {(activeProjects as any[]).slice(0, 3).map((project: any, index: number) => (
                      <div key={index} className="flex items-center justify-between text-xs">
                        <span className="truncate">{project?.name || `Proyecto ${index + 1}`}</span>
                        <Badge variant="outline" className="text-xs">
                          {project?.status || 'Activo'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <Button size="sm" variant="outline" className="w-full text-xs">
                    Ver Todos los Proyectos
                  </Button>
                </CardContent>
              </Card>

              {/* Budget Overview - 4 columns */}
              <Card className="col-span-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center">
                    <DollarSign className="h-4 w-4 mr-2 text-emerald-600" />
                    Presupuesto y Costos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-700">Presupuesto Total</div>
                      <div className="text-lg font-bold text-gray-900">${mockData.totalBudget.toLocaleString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-700">Ejecutado</div>
                      <div className="text-lg font-bold text-emerald-600">${mockData.spentBudget.toLocaleString()}</div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>Progreso de Gasto</span>
                      <span>{Math.round((mockData.spentBudget / mockData.totalBudget) * 100)}%</span>
                    </div>
                    <Progress value={(mockData.spentBudget / mockData.totalBudget) * 100} className="h-2" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-50 rounded p-2">
                      <div className="font-medium">Disponible</div>
                      <div className="text-blue-600 font-bold">${(mockData.totalBudget - mockData.spentBudget).toLocaleString()}</div>
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                      <div className="font-medium">Burn Rate</div>
                      <div className="text-orange-600 font-bold">15.5k/mes</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Second row - Recent Activity */}
            <div className="grid grid-cols-12 gap-4">
              <Card className="col-span-8">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center">
                    <Calendar className="h-4 w-4 mr-2 text-indigo-600" />
                    Actividad Reciente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(quotations as any[]).slice(0, 4).map((quotation: any, index: number) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                          <div>
                            <div className="text-sm font-medium">{quotation?.projectName || `Actividad ${index + 1}`}</div>
                            <div className="text-xs text-gray-500">hace 2 días</div>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {quotation?.status || 'Completado'}
                        </Badge>
                      </div>
                    ))}
                    {(quotations as any[]).length === 0 && (
                      <div className="text-center text-sm text-gray-500 py-4">
                        No hay actividad reciente
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="col-span-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center">
                    <Zap className="h-4 w-4 mr-2 text-yellow-600" />
                    Acciones Rápidas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button size="sm" variant="outline" className="w-full justify-start text-xs">
                    <FileText className="h-3 w-3 mr-2" />
                    Crear Nuevo Entregable
                  </Button>
                  <Button size="sm" variant="outline" className="w-full justify-start text-xs">
                    <MessageSquare className="h-3 w-3 mr-2" />
                    Enviar Encuesta NPS
                  </Button>
                  <Button size="sm" variant="outline" className="w-full justify-start text-xs">
                    <BarChart3 className="h-3 w-3 mr-2" />
                    Generar Reporte
                  </Button>
                  <Button size="sm" variant="outline" className="w-full justify-start text-xs">
                    <Users className="h-3 w-3 mr-2" />
                    Asignar Equipo
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* PROYECTOS Y PERFORMANCE TAB */}
          <TabsContent value="projects" className="space-y-4">
            <div className="grid grid-cols-12 gap-4">
              {/* Active Projects List - 8 columns */}
              <Card className="col-span-8">
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center">
                      <Briefcase className="h-4 w-4 mr-2 text-blue-600" />
                      Proyectos Activos ({mockData.activeProjects})
                    </span>
                    <Button size="sm" variant="outline" className="text-xs">Nuevo Proyecto</Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(activeProjects as any[]).map((project: any, index: number) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-sm">{project?.name || `Proyecto ${index + 1}`}</h3>
                            <p className="text-xs text-gray-500">{project?.description || 'Sin descripción'}</p>
                          </div>
                          <Badge variant="outline">{project?.status || 'Activo'}</Badge>
                        </div>
                        <div className="grid grid-cols-4 gap-4 text-xs">
                          <div>
                            <div className="font-medium text-gray-700">Progreso</div>
                            <div className="flex items-center space-x-2 mt-1">
                              <Progress value={project?.progress || 65} className="h-1 flex-1" />
                              <span className="text-xs">{project?.progress || 65}%</span>
                            </div>
                          </div>
                          <div>
                            <div className="font-medium text-gray-700">Presupuesto</div>
                            <div className="text-green-600 font-bold">${project?.totalCost?.toLocaleString() || '25,000'}</div>
                          </div>
                          <div>
                            <div className="font-medium text-gray-700">Gastado</div>
                            <div className="text-orange-600 font-bold">${project?.actualCost?.toLocaleString() || '18,500'}</div>
                          </div>
                          <div>
                            <div className="font-medium text-gray-700">Días Restantes</div>
                            <div className="text-blue-600 font-bold">{project?.daysRemaining || 12}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {(activeProjects as any[]).length === 0 && (
                      <div className="text-center py-8">
                        <div className="text-gray-500">No hay proyectos activos</div>
                        <Button className="mt-4" size="sm">
                          Crear Nuevo Proyecto
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Performance Metrics - 4 columns */}
              <Card className="col-span-4">
                <CardHeader>
                  <CardTitle className="text-base flex items-center">
                    <BarChart3 className="h-4 w-4 mr-2 text-green-600" />
                    Métricas de Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-blue-700">Proyectos Completados</span>
                        <CheckCircle className="h-3 w-3 text-blue-600" />
                      </div>
                      <div className="text-lg font-bold text-blue-900">{mockData.completedProjects}</div>
                      <div className="text-xs text-blue-600">este año</div>
                    </div>
                    
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-green-700">Entregas Puntuales</span>
                        <Clock className="h-3 w-3 text-green-600" />
                      </div>
                      <div className="text-lg font-bold text-green-900">{mockData.onTimePercentage}%</div>
                      <Progress value={mockData.onTimePercentage} className="h-1 mt-1" />
                    </div>
                    
                    <div className="bg-purple-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-purple-700">Calidad Promedio</span>
                        <Award className="h-3 w-3 text-purple-600" />
                      </div>
                      <div className="text-lg font-bold text-purple-900">{mockData.qualityScore}/10</div>
                      <Progress value={mockData.qualityScore * 10} className="h-1 mt-1" />
                    </div>
                    
                    <div className="bg-orange-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-orange-700">Eficiencia</span>
                        <TrendingUp className="h-3 w-3 text-orange-600" />
                      </div>
                      <div className="text-lg font-bold text-orange-900">{mockData.teamEfficiency}%</div>
                      <Progress value={mockData.teamEfficiency} className="h-1 mt-1" />
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="text-sm font-medium mb-2">Presupuesto vs Ejecutado</h4>
                    <div className="h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={(activeProjects as any[]).slice(0, 3)}>
                          <XAxis dataKey="name" fontSize={10} />
                          <YAxis fontSize={10} />
                          <Tooltip />
                          <Bar dataKey="totalCost" fill="#3b82f6" name="Presupuesto" />
                          <Bar dataKey="actualCost" fill="#10b981" name="Gastado" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ANÁLISIS Y REPORTES TAB */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-12 gap-4">
              {/* Quality Distribution Chart - 6 columns */}
              <Card className="col-span-6">
                <CardHeader>
                  <CardTitle className="text-base flex items-center">
                    <PieChart className="h-4 w-4 mr-2 text-indigo-600" />
                    Distribución de Calidad
                  </CardTitle>
                  <CardDescription>Puntuación de entregables por categoría</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-48">
                    {(deliverablesData as any)?.qualityDistribution ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={(deliverablesData as any).qualityDistribution}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={60}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {(deliverablesData as any).qualityDistribution.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-sm text-gray-500">
                        No hay datos de calidad disponibles
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Historical Data - 6 columns */}
              <Card className="col-span-6">
                <CardHeader>
                  <CardTitle className="text-base flex items-center">
                    <TrendingUp className="h-4 w-4 mr-2 text-green-600" />
                    Histórico de Cotizaciones
                  </CardTitle>
                  <CardDescription>Resumen de todas las cotizaciones generadas</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {(quotations as any[]).map((quotation: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded text-xs">
                        <div>
                          <div className="font-medium">{quotation?.projectName || `Cotización ${index + 1}`}</div>
                          <div className="text-gray-500">${quotation?.totalCost?.toLocaleString() || '15,000'}</div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {quotation?.status || 'Pendiente'}
                        </Badge>
                      </div>
                    ))}
                    
                    {(quotations as any[]).length === 0 && (
                      <div className="text-center py-8 text-gray-500 text-sm">
                        No hay cotizaciones registradas
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Additional Analytics */}
            <div className="grid grid-cols-12 gap-4">
              <Card className="col-span-12">
                <CardHeader>
                  <CardTitle className="text-base flex items-center">
                    <Eye className="h-4 w-4 mr-2 text-blue-600" />
                    Análisis de Recursos por Rol
                  </CardTitle>
                  <CardDescription>Distribución de horas y costos por rol del equipo</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <div className="text-lg font-bold text-blue-900">45h</div>
                      <div className="text-sm text-blue-700">Estrategia</div>
                      <div className="text-xs text-blue-600">$4,500</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <div className="text-lg font-bold text-green-900">62h</div>
                      <div className="text-sm text-green-700">Diseño</div>
                      <div className="text-xs text-green-600">$3,720</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4 text-center">
                      <div className="text-lg font-bold text-purple-900">38h</div>
                      <div className="text-sm text-purple-700">Desarrollo</div>
                      <div className="text-xs text-purple-600">$3,040</div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4 text-center">
                      <div className="text-lg font-bold text-orange-900">11h</div>
                      <div className="text-sm text-orange-700">Gestión</div>
                      <div className="text-xs text-orange-600">$1,100</div>
                    </div>
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