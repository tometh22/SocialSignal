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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16 mb-1" />
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
      icon: Building2,
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: timeFilter === "all" ? "Con Actividad" : "Activos (período)",
      value: stats.active,
      icon: Activity,
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      title: timeFilter === "all" ? "Facturación Total" : "Facturación (período)",
      value: formatCurrency(stats.totalRevenue),
      icon: DollarSign,
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    },
    {
      title: timeFilter === "all" ? "Horas Registradas" : "Horas (período)",
      value: formatHours(stats.totalHours),
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-50"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {cards.map((card, index) => (
        <Card key={index} className="hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">
                  {card.title}
                </p>
                <div className="text-2xl font-bold text-gray-900">
                  {card.value}
                </div>
              </div>
              <div className={`p-3 rounded-full ${card.bgColor}`}>
                <card.icon className={`h-6 w-6 ${card.color}`} />
              </div>
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

  const getStatusColor = (hasActivity: boolean, efficiency: string) => {
    if (!hasActivity) return "bg-gray-100 text-gray-600";
    const eff = parseFloat(efficiency);
    if (eff >= 80) return "bg-green-100 text-green-800";
    if (eff >= 60) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const getMarkupColor = (markup: string) => {
    const markupValue = parseFloat(markup);
    if (markupValue >= 3) return "text-green-600";
    if (markupValue >= 1.5) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group"
          onClick={() => setLocation(`/proyectos/${project.id}`)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
              {project.name}
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              {project.client?.name || "Cliente desconocido"}
            </p>
          </div>
          <Badge 
            className={`ml-2 ${getStatusColor(project.hasActivity, project.efficiency)}`}
            data-testid={`badge-status-${project.id}`}
          >
            {project.hasActivity ? `${project.efficiency}%` : "Sin actividad"}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Progreso</span>
              <span className="font-medium">{project.workedHours}h / {project.estimatedHours}h</span>
            </div>
            <Progress 
              value={Math.min(project.progress, 100)} 
              className="h-2"
              data-testid={`progress-${project.id}`}
            />
          </div>

          {/* Métricas */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <p className="text-gray-600">Facturación</p>
              <p className="font-semibold text-gray-900" data-testid={`revenue-${project.id}`}>
                ${project.totalRevenue.toLocaleString()}
              </p>
            </div>
            <div className="text-center">
              <p className="text-gray-600">Costo</p>
              <p className="font-semibold text-gray-900" data-testid={`cost-${project.id}`}>
                ${project.totalCost.toLocaleString()}
              </p>
            </div>
            <div className="text-center">
              <p className="text-gray-600">Markup</p>
              <p className={`font-semibold ${getMarkupColor(project.markup)}`} data-testid={`markup-${project.id}`}>
                {project.markup}x
              </p>
            </div>
          </div>

          {/* Información adicional */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>{project.teamSize} miembros</span>
            </div>
            {project.isAlwaysOn && (
              <Badge variant="outline" className="text-xs">
                Always On
              </Badge>
            )}
          </div>

          {project.error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>Error al cargar datos</span>
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
      title: "Datos actualizados",
      description: "La información del dashboard ha sido actualizada.",
    });
  };

  if (error) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error al cargar datos</h2>
          <p className="text-gray-600 mb-4">
            Hubo un problema al cargar la información del dashboard.
          </p>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Proyectos Activos
          </h1>
          <p className="text-gray-600">
            Gestión integral de proyectos y seguimiento en tiempo real
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            disabled={isLoading}
            data-testid="button-refresh"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Actualizar
          </Button>
          <Button size="sm" data-testid="button-new-project">
            <Plus className="h-4 w-4 mr-2" />
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

      {/* Filtros */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Filtro temporal */}
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Período:</span>
              <Select value={timeFilter} onValueChange={setTimeFilter} data-testid="select-time-filter">
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Seleccionar período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo el período</SelectItem>
                  <SelectItem value="este_mes">Este mes</SelectItem>
                  <SelectItem value="mes_pasado">Mes pasado</SelectItem>
                  <SelectItem value="este_trimestre">Este trimestre</SelectItem>
                  <SelectItem value="trimestre_pasado">Trimestre pasado</SelectItem>
                  <SelectItem value="mayo_2025">Mayo 2025</SelectItem>
                  <SelectItem value="junio_2025">Junio 2025</SelectItem>
                  <SelectItem value="q1_2025">Q1 2025</SelectItem>
                  <SelectItem value="q2_2025">Q2 2025</SelectItem>
                </SelectContent>
              </Select>
              {timeFilter !== "all" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTimeFilter("all")}
                  data-testid="button-clear-filter"
                >
                  Limpiar
                </Button>
              )}
            </div>

            {/* Búsqueda */}
            <div className="flex items-center gap-2 flex-1">
              <Search className="h-4 w-4 text-gray-500" />
              <Input
                placeholder="Buscar proyectos o clientes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
                data-testid="input-search"
              />
            </div>

            {/* Ordenamiento */}
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Ordenar:</span>
              <Select value={sortBy} onValueChange={setSortBy} data-testid="select-sort">
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Nombre</SelectItem>
                  <SelectItem value="client">Cliente</SelectItem>
                  <SelectItem value="revenue">Facturación</SelectItem>
                  <SelectItem value="activity">Actividad</SelectItem>
                  <SelectItem value="efficiency">Eficiencia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Información del filtro */}
          {dashboardData?.dateRange && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Período seleccionado:</strong> {new Date(dashboardData.dateRange.startDate).toLocaleDateString()} - {new Date(dashboardData.dateRange.endDate).toLocaleDateString()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de proyectos */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-4" />
                <div className="grid grid-cols-3 gap-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredAndSortedProjects.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No hay proyectos
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || timeFilter !== "all" 
                ? "No se encontraron proyectos que coincidan con los filtros aplicados."
                : "Aún no hay proyectos activos registrados."
              }
            </p>
            {(searchTerm || timeFilter !== "all") && (
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm("");
                  setTimeFilter("all");
                }}
                data-testid="button-clear-all-filters"
              >
                Limpiar filtros
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {/* Footer con información */}
      {dashboardData && (
        <div className="mt-8 text-center text-sm text-gray-500">
          Datos actualizados: {new Date(dashboardData.timestamp).toLocaleString()}
        </div>
      )}
    </div>
  );
}