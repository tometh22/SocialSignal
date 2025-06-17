import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  Building2, 
  Search, 
  Filter, 
  Plus, 
  Calendar, 
  Clock, 
  DollarSign, 
  Users, 
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Play,
  Pause,
  Archive,
  Eye,
  Edit,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Timer,
  Target,
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

interface ProjectCardProps {
  project: any;
  client: any;
  subprojects: any[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onNavigate: (path: string) => void;
  getProjectHours: (id: number) => number;
}

function ProjectCard({ 
  project, 
  client, 
  subprojects, 
  isExpanded, 
  onToggleExpand, 
  onNavigate,
  getProjectHours 
}: ProjectCardProps) {
  const projectName = project.quotation?.projectName || "Proyecto sin nombre";
  const clientName = client?.name || "Cliente desconocido";
  const totalAmount = project.quotation?.totalAmount || 0;
  const totalHours = getProjectHours(project.id);
  const isAlwaysOnProject = project.isAlwaysOnMacro || subprojects.length > 0;
  
  // Calcular progreso basado en horas registradas vs estimadas
  const estimatedHours = project.estimatedHours || totalAmount / 100; // Aproximación
  const progressPercentage = estimatedHours > 0 ? Math.min((totalHours / estimatedHours) * 100, 100) : 0;

  const getStatusConfig = (status: string) => {
    const configs = {
      active: { 
        label: "Activo", 
        variant: "default" as const,
        color: "bg-green-100 text-green-800 border-green-200",
        icon: Play
      },
      paused: { 
        label: "Pausado", 
        variant: "secondary" as const,
        color: "bg-yellow-100 text-yellow-800 border-yellow-200",
        icon: Pause
      },
      completed: { 
        label: "Completado", 
        variant: "outline" as const,
        color: "bg-blue-100 text-blue-800 border-blue-200",
        icon: CheckCircle2
      },
      archived: { 
        label: "Archivado", 
        variant: "outline" as const,
        color: "bg-gray-100 text-gray-600 border-gray-200",
        icon: Archive
      }
    };
    return configs[status as keyof typeof configs] || configs.active;
  };

  const statusConfig = getStatusConfig(project.status);
  const StatusIcon = statusConfig.icon;

  return (
    <Card className="group hover:shadow-md transition-all duration-200 border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <h3 className="font-semibold text-gray-900 truncate text-lg">
                  {projectName}
                </h3>
              </div>
              {isAlwaysOnProject && (
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                  Always-On
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
              <span className="font-medium">{clientName}</span>
              <Separator orientation="vertical" className="h-4" />
              <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                <StatusIcon className="h-3 w-3" />
                {statusConfig.label}
              </div>
            </div>

            {/* Métricas principales */}
            <div className="grid grid-cols-3 gap-4 mb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <div>
                  <div className="text-lg font-bold text-gray-900">${totalAmount.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Presupuesto</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <div>
                  <div className="text-lg font-bold text-gray-900">{totalHours.toFixed(1)}h</div>
                  <div className="text-xs text-gray-500">Registradas</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-purple-600" />
                <div>
                  <div className="text-lg font-bold text-gray-900">{progressPercentage.toFixed(0)}%</div>
                  <div className="text-xs text-gray-500">Progreso</div>
                </div>
              </div>
            </div>

            {/* Barra de progreso */}
            <div className="mb-3">
              <Progress value={progressPercentage} className="h-2" />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{totalHours.toFixed(1)}h trabajadas</span>
                <span>{estimatedHours.toFixed(0)}h estimadas</span>
              </div>
            </div>

            {/* Fechas */}
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>
                  Inicio: {project.startDate ? new Date(project.startDate).toLocaleDateString('es-ES') : 'Sin fecha'}
                </span>
              </div>
              {project.expectedEndDate && (
                <div className="flex items-center gap-1">
                  <Timer className="h-3 w-3" />
                  <span>Fin: {new Date(project.expectedEndDate).toLocaleDateString('es-ES')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate(`/active-projects/${project.id}`)}
              className="h-8 px-3"
            >
              <Eye className="h-4 w-4 mr-1" />
              Ver
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onNavigate(`/active-projects/${project.id}/edit`)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Users className="h-4 w-4 mr-2" />
                  Gestionar Equipo
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Ver Reportes
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {isAlwaysOnProject && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleExpand}
                className="h-8 w-8 p-0"
              >
                {isExpanded ? 
                  <ChevronDown className="h-4 w-4" /> : 
                  <ChevronRight className="h-4 w-4" />
                }
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Subproyectos expandibles */}
      {isAlwaysOnProject && isExpanded && subprojects.length > 0 && (
        <CardContent className="pt-0">
          <div className="border-t pt-3">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">
                Subproyectos ({subprojects.length})
              </span>
            </div>
            
            <div className="space-y-2">
              {subprojects.map((subproject: any) => (
                <div 
                  key={subproject.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm text-gray-900">
                        {subproject.subprojectName || "Subproyecto sin nombre"}
                      </h4>
                      <Badge variant="outline" className="text-xs">
                        {subproject.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{getProjectHours(subproject.id).toFixed(1)}h</span>
                      <span>${(subproject.budget || 0).toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onNavigate(`/active-projects/${subproject.id}`)}
                    className="h-7 px-2 text-xs"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Ver
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function ActiveProjectsRedesigned() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterClient, setFilterClient] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());

  // Datos
  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["/api/active-projects"],
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
  });

  const { data: allProjects = [] } = useQuery({
    queryKey: ["/api/active-projects?showSubprojects=true"],
  });

  const { data: timeEntriesData = {} } = useQuery({
    queryKey: ["/api/time-entries/all-projects"],
  });

  // Función para obtener horas de un proyecto
  const getProjectHours = (projectId: number): number => {
    if (!timeEntriesData || typeof timeEntriesData !== 'object') return 0;
    const entries = (timeEntriesData as any)[projectId] || [];
    return Array.isArray(entries) ? entries.reduce((sum: number, entry: any) => sum + (entry.hours || 0), 0) : 0;
  };

  // Proyectos filtrados y ordenados
  const filteredProjects = useMemo(() => {
    if (!Array.isArray(projects)) return [];

    return projects
      .filter((project: any) => {
        // Solo proyectos principales
        if (project.parentProjectId) return false;

        const client = Array.isArray(clients) ? clients.find((c: any) => c.id === project.clientId) : null;
        const projectName = project.quotation?.projectName || "Proyecto sin nombre";
        const clientName = client?.name || "";

        const matchesSearch = searchTerm === "" || 
          projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          clientName.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = filterStatus === "all" || project.status === filterStatus;
        const matchesClient = filterClient === "all" || project.clientId.toString() === filterClient;

        return matchesSearch && matchesStatus && matchesClient;
      })
      .sort((a: any, b: any) => {
        switch (sortBy) {
          case "name":
            return (a.quotation?.projectName || "").localeCompare(b.quotation?.projectName || "");
          case "client":
            const clientA = Array.isArray(clients) ? (clients as any[]).find((c: any) => c.id === a.clientId)?.name || "" : "";
            const clientB = Array.isArray(clients) ? (clients as any[]).find((c: any) => c.id === b.clientId)?.name || "" : "";
            return clientA.localeCompare(clientB);
          case "budget":
            return (b.quotation?.totalAmount || 0) - (a.quotation?.totalAmount || 0);
          case "hours":
            return getProjectHours(b.id) - getProjectHours(a.id);
          case "recent":
          default:
            return new Date((b as any).createdAt || 0).getTime() - new Date((a as any).createdAt || 0).getTime();
        }
      });
  }, [projects, clients, searchTerm, filterStatus, filterClient, sortBy, timeEntriesData]);

  // Estadísticas generales
  const stats = useMemo(() => {
    const activeProjects = filteredProjects.filter((p: any) => p.status === "active");
    const totalBudget = filteredProjects.reduce((sum: number, p: any) => sum + (p.quotation?.totalAmount || 0), 0);
    const totalHours = filteredProjects.reduce((sum: number, p: any) => sum + getProjectHours(p.id), 0);
    
    return {
      total: filteredProjects.length,
      active: activeProjects.length,
      totalBudget,
      totalHours
    };
  }, [filteredProjects, timeEntriesData]);

  const toggleExpanded = (projectId: number) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  if (loadingProjects) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando proyectos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Proyectos Activos</h1>
              <p className="text-gray-600 mt-1">Gestiona y monitorea todos tus proyectos</p>
            </div>
            
            <Button 
              onClick={() => setLocation("/active-projects/new")}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Proyecto
            </Button>
          </div>

          {/* Estadísticas */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="text-2xl font-bold text-blue-900">{stats.total}</div>
                  <div className="text-sm text-blue-700">Total Proyectos</div>
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <Play className="h-5 w-5 text-green-600" />
                <div>
                  <div className="text-2xl font-bold text-green-900">{stats.active}</div>
                  <div className="text-sm text-green-700">Activos</div>
                </div>
              </div>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-purple-600" />
                <div>
                  <div className="text-2xl font-bold text-purple-900">${stats.totalBudget.toLocaleString()}</div>
                  <div className="text-sm text-purple-700">Presupuesto Total</div>
                </div>
              </div>
            </div>
            
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-600" />
                <div>
                  <div className="text-2xl font-bold text-orange-900">{stats.totalHours.toFixed(0)}h</div>
                  <div className="text-sm text-orange-700">Horas Registradas</div>
                </div>
              </div>
            </div>
          </div>

          {/* Filtros y búsqueda */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar proyectos o clientes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="paused">Pausado</SelectItem>
                <SelectItem value="completed">Completado</SelectItem>
                <SelectItem value="archived">Archivado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los clientes</SelectItem>
                {Array.isArray(clients) && clients.map((client: any) => (
                  <SelectItem key={client.id} value={client.id.toString()}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Más recientes</SelectItem>
                <SelectItem value="name">Nombre A-Z</SelectItem>
                <SelectItem value="client">Cliente A-Z</SelectItem>
                <SelectItem value="budget">Presupuesto ↓</SelectItem>
                <SelectItem value="hours">Horas ↓</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Lista de proyectos */}
      <div className="p-6">
        {filteredProjects.length > 0 ? (
          <div className="space-y-4">
            {filteredProjects.map((project: any) => {
              const subprojects = Array.isArray(allProjects) ? 
                allProjects.filter((p: any) => p.parentProjectId === project.id) : [];
              const client = Array.isArray(clients) ? 
                clients.find((c: any) => c.id === project.clientId) : null;

              return (
                <ProjectCard
                  key={project.id}
                  project={project}
                  client={client}
                  subprojects={subprojects}
                  isExpanded={expandedProjects.has(project.id)}
                  onToggleExpand={() => toggleExpanded(project.id)}
                  onNavigate={setLocation}
                  getProjectHours={getProjectHours}
                />
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || filterStatus !== "all" || filterClient !== "all" 
                ? "No se encontraron proyectos" 
                : "No hay proyectos activos"
              }
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || filterStatus !== "all" || filterClient !== "all"
                ? "Ajusta los filtros para ver más resultados"
                : "Comienza creando tu primer proyecto para gestionar tus operaciones"
              }
            </p>
            {(!searchTerm && filterStatus === "all" && filterClient === "all") && (
              <Button 
                onClick={() => setLocation("/active-projects/new")}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Crear Primer Proyecto
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}