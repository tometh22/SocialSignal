import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Building2, 
  Search, 
  Filter, 
  Plus, 
  Calendar, 
  Clock, 
  DollarSign, 
  Users, 
  TrendingUp,
  CalendarDays,
  BarChart3,
  Activity,
  AlertCircle,
  CheckCircle2,
  Eye,
  RefreshCw,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

// Types
interface DashboardProject {
  id: number;
  name: string;
  clientId: number;
  status: string;
  isAlwaysOn: boolean;
  estimatedHours: number;
  workedHours: number;
  totalRevenue: number;
  totalCost: number;
  markup: string;
  efficiency: string;
  salesCount: number;
  hasActivity: boolean;
  lastActivity: string | null;
  teamSize: number;
  progress: number;
  client?: {
    id: number;
    name: string;
    logoUrl?: string;
  } | null;
  error?: string;
}

interface DashboardStats {
  total: number;
  active: number;
  totalRevenue: number;
  totalCost: number;
  totalHours: number;
  averageMarkup: string;
  averageEfficiency: string;
}

interface DashboardData {
  timeFilter: string;
  dateRange: {
    startDate: string;
    endDate: string;
  } | null;
  stats: DashboardStats;
  projects: DashboardProject[];
  clients: any[];
  timestamp: string;
}

// Custom hook para el dashboard
function useDashboardData(timeFilter: string) {
  return useQuery<DashboardData>({
    queryKey: ["/api/dashboard/projects", timeFilter],
    queryFn: ({ queryKey }) => {
      const currentTimeFilter = queryKey[1] as string;
      return apiRequest(`/api/dashboard/projects?timeFilter=${currentTimeFilter}`, 'GET');
    },
    staleTime: 30000, // Cache por 30 segundos
    refetchOnWindowFocus: false,
  });
}

// Componente para las estadísticas
function StatsCards({ stats, timeFilter, isLoading }: { 
  stats?: DashboardStats; 
  timeFilter: string;
  isLoading: boolean;
}) {
  const formatCurrency = (amount: number) => `$${amount.toLocaleString()}`;
  const formatHours = (hours: number) => `${hours.toFixed(0)}h`;
  
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardContent className="p-8">
              <Skeleton className="h-4 w-20 mb-4" />
              <Skeleton className="h-10 w-20 mb-2" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    {
      title: timeFilter === "all" ? "Total Proyectos" : "Proyectos (período)",
      value: stats.total,
      subtitle: "proyectos registrados",
      icon: Building2,
      gradient: "from-blue-500 to-cyan-500",
      bgGradient: "from-blue-50 to-cyan-50"
    },
    {
      title: timeFilter === "all" ? "Con Actividad" : "Activos (período)",
      value: stats.active,
      subtitle: "con trabajo realizado",
      icon: Activity,
      gradient: "from-emerald-500 to-green-500",
      bgGradient: "from-emerald-50 to-green-50"
    },
    {
      title: timeFilter === "all" ? "Facturación Total" : "Facturación (período)",
      value: formatCurrency(stats.totalRevenue),
      subtitle: "ingresos generados",
      icon: DollarSign,
      gradient: "from-purple-500 to-pink-500",
      bgGradient: "from-purple-50 to-pink-50"
    },
    {
      title: timeFilter === "all" ? "Horas Registradas" : "Horas (período)",
      value: formatHours(stats.totalHours),
      subtitle: "tiempo invertido",
      icon: Clock,
      gradient: "from-orange-500 to-amber-500",
      bgGradient: "from-orange-50 to-amber-50"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
      {cards.map((card, index) => (
        <Card 
          key={index} 
          className={`bg-gradient-to-br ${card.bgGradient} border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 group`}
        >
          <CardContent className="p-8">
            <div className="flex items-start justify-between mb-4">
              <div className={`p-4 rounded-2xl bg-gradient-to-r ${card.gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <card.icon className="h-7 w-7 text-white" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                {card.title}
              </p>
              <div className="text-3xl font-bold text-gray-900 leading-none">
                {card.value}
              </div>
              <p className="text-xs text-gray-500">
                {card.subtitle}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Componente para cada proyecto
function ProjectCard({ project }: { project: DashboardProject }) {
  const [, setLocation] = useLocation();

  const getStatusGradient = (hasActivity: boolean, efficiency: string) => {
    if (!hasActivity) return "from-gray-400 to-gray-500";
    const eff = parseFloat(efficiency);
    if (eff >= 80) return "from-emerald-500 to-green-500";
    if (eff >= 60) return "from-yellow-500 to-orange-500";
    return "from-red-500 to-pink-500";
  };

  const getMarkupColor = (markup: string) => {
    const markupValue = parseFloat(markup);
    if (markupValue >= 3) return "text-emerald-600";
    if (markupValue >= 1.5) return "text-yellow-600";
    return "text-red-500";
  };

  const getProgressColor = (efficiency: string) => {
    const eff = parseFloat(efficiency);
    if (eff >= 80) return "bg-gradient-to-r from-emerald-500 to-green-500";
    if (eff >= 60) return "bg-gradient-to-r from-yellow-500 to-orange-500";
    return "bg-gradient-to-r from-red-500 to-pink-500";
  };

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer group transform hover:-translate-y-1"
          onClick={() => setLocation(`/proyectos/${project.id}`)}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl font-bold text-gray-900 group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-purple-600 group-hover:bg-clip-text group-hover:text-transparent transition-all duration-300">
              {project.name}
            </CardTitle>
            <p className="text-gray-600 mt-2 flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              {project.client?.name || "Cliente desconocido"}
            </p>
          </div>
          <div className={`px-3 py-1 rounded-full bg-gradient-to-r ${getStatusGradient(project.hasActivity, project.efficiency)} text-white text-sm font-medium shadow-lg`}
               data-testid={`badge-status-${project.id}`}>
            {project.hasActivity ? `${project.efficiency}%` : "Sin actividad"}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Progress bar moderno */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-medium text-gray-700">Progreso del proyecto</span>
            <span className="text-sm font-bold text-gray-900">{project.workedHours}h / {project.estimatedHours}h</span>
          </div>
          <div className="relative">
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div 
                className={`h-full ${getProgressColor(project.efficiency)} transition-all duration-500 ease-out shadow-lg`}
                style={{ width: `${Math.min(project.progress, 100)}%` }}
                data-testid={`progress-${project.id}`}
              />
            </div>
          </div>
        </div>

        {/* Métricas modernas */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Facturación</p>
            <p className="text-lg font-bold text-gray-900" data-testid={`revenue-${project.id}`}>
              ${project.totalRevenue.toLocaleString()}
            </p>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Costo</p>
            <p className="text-lg font-bold text-gray-900" data-testid={`cost-${project.id}`}>
              ${project.totalCost.toLocaleString()}
            </p>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Markup</p>
            <p className={`text-lg font-bold ${getMarkupColor(project.markup)}`} data-testid={`markup-${project.id}`}>
              {project.markup}x
            </p>
          </div>
        </div>

        {/* Footer con información adicional */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 text-gray-600">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-sm font-medium">{project.teamSize} miembros</span>
          </div>
          {project.isAlwaysOn && (
            <div className="px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold rounded-full shadow-md">
              Always On
            </div>
          )}
          {project.error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-1 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Error</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Componente principal
export default function ActiveProjectsV2() {
  const [timeFilter, setTimeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Usar el hook personalizado
  const { data: dashboardData, isLoading, error, refetch } = useDashboardData(timeFilter);

  // Filtrar y ordenar proyectos
  const filteredAndSortedProjects = useMemo(() => {
    if (!dashboardData?.projects) return [];

    let filtered = dashboardData.projects.filter(project => {
      if (searchTerm === "") return true;
      return (
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.client?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });

    // Ordenamiento
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "client":
          return (a.client?.name || "").localeCompare(b.client?.name || "");
        case "revenue":
          return b.totalRevenue - a.totalRevenue;
        case "activity":
          if (a.hasActivity && !b.hasActivity) return -1;
          if (!a.hasActivity && b.hasActivity) return 1;
          return b.workedHours - a.workedHours;
        case "efficiency":
          return parseFloat(b.efficiency) - parseFloat(a.efficiency);
        default:
          return 0;
      }
    });

    return filtered;
  }, [dashboardData?.projects, searchTerm, sortBy]);

  const handleRefresh = () => {
    refetch();
    toast({
      title: "✨ Datos actualizados",
      description: "La información del dashboard ha sido actualizada exitosamente.",
    });
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md mx-4">
          <div className="bg-red-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-10 w-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">¡Ups! Algo salió mal</h2>
          <p className="text-gray-600 mb-6">
            Hubo un problema al cargar la información del dashboard. No te preocupes, podemos intentarlo de nuevo.
          </p>
          <Button 
            onClick={() => refetch()} 
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 transform hover:scale-105"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar ahora
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        {/* Header moderno */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center space-x-4">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-3">
              <Building2 className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">
                Proyectos Activos
              </h1>
              <p className="text-gray-600 text-lg">
                Gestión integral con análisis en tiempo real ✨
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={handleRefresh}
              variant="outline"
              size="lg"
              disabled={isLoading}
              data-testid="button-refresh"
              className="border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin text-blue-600" />
              ) : (
                <RefreshCw className="h-5 w-5 mr-2 text-blue-600" />
              )}
              Actualizar
            </Button>
            <Button 
              size="lg" 
              data-testid="button-new-project"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg transition-all duration-200 transform hover:scale-105"
            >
              <Plus className="h-5 w-5 mr-2" />
              Nuevo Proyecto
            </Button>
          </div>
        </div>

      {/* Estadísticas */}
      <StatsCards 
        stats={dashboardData?.stats} 
        timeFilter={timeFilter}
        isLoading={isLoading}
      />

      {/* Filtros modernos */}
      <Card className="mb-10 bg-white/80 backdrop-blur-sm border-0 shadow-xl">
        <CardContent className="p-8">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Filtro temporal */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                <CalendarDays className="h-5 w-5 text-white" />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-700">Período:</span>
                <Select value={timeFilter} onValueChange={setTimeFilter} data-testid="select-time-filter">
                  <SelectTrigger className="w-56 bg-white border-gray-200 hover:border-blue-300 focus:border-blue-500 focus:ring-blue-500/20">
                    <SelectValue placeholder="Seleccionar período" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200 shadow-xl rounded-xl">
                    <SelectItem value="all" className="focus:bg-blue-50">Todo el período</SelectItem>
                    <SelectItem value="este_mes" className="focus:bg-blue-50">Este mes</SelectItem>
                    <SelectItem value="mes_pasado" className="focus:bg-blue-50">Mes pasado</SelectItem>
                    <SelectItem value="este_trimestre" className="focus:bg-blue-50">Este trimestre</SelectItem>
                    <SelectItem value="trimestre_pasado" className="focus:bg-blue-50">Trimestre pasado</SelectItem>
                    <SelectItem value="mayo_2025" className="focus:bg-blue-50">Mayo 2025</SelectItem>
                    <SelectItem value="junio_2025" className="focus:bg-blue-50">Junio 2025</SelectItem>
                    <SelectItem value="q1_2025" className="focus:bg-blue-50">Q1 2025</SelectItem>
                    <SelectItem value="q2_2025" className="focus:bg-blue-50">Q2 2025</SelectItem>
                  </SelectContent>
                </Select>
                {timeFilter !== "all" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTimeFilter("all")}
                    data-testid="button-clear-filter"
                    className="text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                  >
                    ✕ Limpiar
                  </Button>
                )}
              </div>
            </div>

            {/* Búsqueda */}
            <div className="flex items-center gap-3 flex-1">
              <div className="p-2 bg-gradient-to-r from-emerald-500 to-green-500 rounded-lg">
                <Search className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 max-w-md">
                <Input
                  placeholder="Buscar proyectos o clientes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white border-gray-200 hover:border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500/20"
                  data-testid="input-search"
                />
              </div>
            </div>

            {/* Ordenamiento */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-orange-500 to-amber-500 rounded-lg">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-700">Ordenar:</span>
                <Select value={sortBy} onValueChange={setSortBy} data-testid="select-sort">
                  <SelectTrigger className="w-44 bg-white border-gray-200 hover:border-orange-300 focus:border-orange-500 focus:ring-orange-500/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200 shadow-xl rounded-xl">
                    <SelectItem value="name" className="focus:bg-orange-50">Nombre</SelectItem>
                    <SelectItem value="client" className="focus:bg-orange-50">Cliente</SelectItem>
                    <SelectItem value="revenue" className="focus:bg-orange-50">Facturación</SelectItem>
                    <SelectItem value="activity" className="focus:bg-orange-50">Actividad</SelectItem>
                    <SelectItem value="efficiency" className="focus:bg-orange-50">Eficiencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Información del filtro */}
          {dashboardData?.dateRange && (
            <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <p className="text-sm font-medium text-blue-800">
                  <strong>Período activo:</strong> {new Date(dashboardData.dateRange.startDate).toLocaleDateString('es-ES')} - {new Date(dashboardData.dateRange.endDate).toLocaleDateString('es-ES')}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

        {/* Lista de proyectos modernos */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader>
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-6" />
                  <div className="grid grid-cols-3 gap-4">
                    <Skeleton className="h-12 w-full rounded-xl" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredAndSortedProjects.length === 0 ? (
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
            <CardContent className="p-16 text-center">
              <div className="bg-gradient-to-r from-gray-100 to-gray-200 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                <Building2 className="h-12 w-12 text-gray-500" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                No hay proyectos
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                {searchTerm || timeFilter !== "all" 
                  ? "No se encontraron proyectos que coincidan con los filtros aplicados. Intenta ajustar los criterios de búsqueda."
                  : "Aún no hay proyectos activos registrados en el sistema."
                }
              </p>
              {(searchTerm || timeFilter !== "all") && (
                <Button 
                  onClick={() => {
                    setSearchTerm("");
                    setTimeFilter("all");
                  }}
                  data-testid="button-clear-all-filters"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                >
                  ✨ Limpiar filtros
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredAndSortedProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}

        {/* Footer moderno con información */}
        {dashboardData && (
          <div className="mt-12 text-center">
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 inline-block border border-gray-100">
              <p className="text-sm text-gray-600">
                ✨ Datos actualizados: {new Date(dashboardData.timestamp).toLocaleString('es-ES')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}