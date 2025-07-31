import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
  TrendingUp,
  CalendarDays
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useImageRefresh } from "@/contexts/ImageRefreshContext";
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
  onDeleteProject: (id: number) => void;
}

function ProjectCard({ 
  project, 
  client, 
  subprojects, 
  isExpanded, 
  onToggleExpand, 
  onNavigate,
  getProjectHours,
  onDeleteProject
}: ProjectCardProps) {
  const { refreshTimestamp } = useImageRefresh();
  const projectName = project.quotation?.projectName || "Proyecto sin nombre";
  const clientName = client?.name || "Cliente desconocido";
  const totalAmount = project.quotation?.totalAmount || 0;
  const totalHours = getProjectHours(project.id);
  const isAlwaysOnProject = project.isAlwaysOnMacro || subprojects.length > 0;
  
  // Detectar tipo de proyecto para calcular progreso apropiado
  const projectType = project.quotation?.projectType || 'one-shot';
  const isFeeMensual = projectType === 'always-on';
  
  // Calcular progreso según tipo de proyecto
  const estimatedHours = project.quotation?.teamMembers?.reduce((total: number, member: any) => {
    return total + (member.estimatedHours || 0);
  }, 0) || 0;
  
  let progressPercentage = 0;
  let progressLabel = "";
  let progressSubtitle = "";
  
  if (isFeeMensual) {
    // Para proyectos fee mensual: progreso basado en tiempo calendario del mes actual
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const currentDay = now.getDate();
    
    progressPercentage = (currentDay / daysInMonth) * 100;
    progressLabel = "Progreso mensual";
    progressSubtitle = `Día ${currentDay} de ${daysInMonth}`;
  } else {
    // Para proyectos one-shot: progreso basado en horas
    progressPercentage = estimatedHours > 0 ? (totalHours / estimatedHours) * 100 : 0;
    progressLabel = "Progreso del proyecto";
    progressSubtitle = `${totalHours.toFixed(1)}h de ${estimatedHours.toFixed(0)}h`;
  }

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
    <Card className="group hover:shadow-lg hover:scale-[1.01] transition-all duration-300 border border-gray-200 hover:border-blue-300 bg-gradient-to-r from-white to-gray-50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-2">
                {/* Logo del cliente - pequeño y elegante */}
                {client?.logoUrl ? (
                  <div className="relative group">
                    <div className="h-6 w-6 rounded-md overflow-hidden bg-gray-50 border border-gray-200 flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-200">
                      <img 
                        key={`logo-${client.id}-${refreshTimestamp}`}
                        src={`${client.logoUrl}${client.logoUrl.includes('?') ? '&' : '?'}t=${refreshTimestamp}`}
                        alt={`Logo de ${clientName}`}
                        className="h-full w-full object-contain group-hover:scale-105 transition-transform duration-200"
                        onError={(e) => {
                          // Fallback al icono Building2 si el logo falla
                          const target = e.currentTarget;
                          const container = target.parentElement;
                          if (container) {
                            container.innerHTML = '<svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>';
                          }
                        }}
                      />
                    </div>
                    {/* Tooltip con nombre del cliente */}
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                      {clientName}
                    </div>
                  </div>
                ) : (
                  <div className="h-6 w-6 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-gray-400" />
                  </div>
                )}
                <h3 className="font-semibold text-gray-900 truncate text-lg">
                  {projectName}
                </h3>
              </div>
              {/* Project Type Badge */}
              {project.quotation?.projectType && (
                <Badge 
                  variant="outline" 
                  className={`text-xs ${
                    project.quotation.projectType === 'fee-mensual' 
                      ? 'bg-purple-50 text-purple-700 border-purple-200' 
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}
                >
                  {project.quotation.projectType === 'fee-mensual' ? 'Fee Mensual' : 'On Demand'}
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
              {/* Badge de tipo de proyecto */}
              {isFeeMensual && (
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                  <Calendar className="h-3 w-3" />
                  Fee Mensual
                </div>
              )}
            </div>

            {/* Métricas principales compactas */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="bg-green-50 p-2 rounded-lg flex items-center gap-2 hover:bg-green-100 transition-colors">
                <div className="p-1 bg-green-500 rounded-full">
                  <DollarSign className="h-3 w-3 text-white" />
                </div>
                <div>
                  <div className="text-sm font-bold text-green-800">${totalAmount.toLocaleString()}</div>
                  <div className="text-xs text-green-600">Precio al cliente</div>
                </div>
              </div>
              
              <div className="bg-blue-50 p-2 rounded-lg flex items-center gap-2 hover:bg-blue-100 transition-colors">
                <div className="p-1 bg-blue-500 rounded-full">
                  <Clock className="h-3 w-3 text-white" />
                </div>
                <div>
                  <div className="text-sm font-bold text-blue-800">{totalHours.toFixed(1)}h</div>
                  <div className="text-xs text-blue-600">Registradas</div>
                </div>
              </div>
              
              <div className={`p-2 rounded-lg flex items-center gap-2 transition-colors ${
                isFeeMensual ? 'bg-blue-50 hover:bg-blue-100' : 'bg-purple-50 hover:bg-purple-100'
              }`}>
                <div className={`p-1 rounded-full ${
                  isFeeMensual ? 'bg-blue-500' : 'bg-purple-500'
                }`}>
                  <Target className="h-3 w-3 text-white" />
                </div>
                <div>
                  <div className={`text-sm font-bold ${
                    isFeeMensual ? 'text-blue-800' : 'text-purple-800'
                  }`}>
                    {progressPercentage.toFixed(0)}%
                  </div>
                  <div className={`text-xs ${
                    isFeeMensual ? 'text-blue-600' : 'text-purple-600'
                  }`}>
                    {isFeeMensual ? 'Mes' : 'Progreso'}
                  </div>
                </div>
              </div>
            </div>

            {/* Barra de progreso inteligente */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-700">{progressLabel}</span>
                <span className="text-xs font-bold text-gray-900">{progressPercentage.toFixed(1)}%</span>
              </div>
              <div className="relative">
                <Progress 
                  value={Math.min(progressPercentage, 100)} 
                  className={`h-3 ${isFeeMensual ? 'bg-blue-100' : 'bg-gray-200'}`} 
                />
                {!isFeeMensual && progressPercentage > 100 && (
                  <div className="absolute top-0 left-0 h-3 bg-red-500 opacity-30 rounded-full" style={{width: '100%'}}></div>
                )}
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-gray-600 font-medium">
                  {isFeeMensual ? `${totalHours.toFixed(1)}h registradas` : progressSubtitle}
                </span>
                <span className={`font-medium ${!isFeeMensual && progressPercentage > 100 ? 'text-red-600' : 'text-gray-600'}`}>
                  {isFeeMensual ? progressSubtitle : `${estimatedHours.toFixed(0)}h estimadas`}
                </span>
              </div>
            </div>

            {/* Fechas */}
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>
                  Inicio: {project.startDate ? 
                    (() => {
                      try {
                        const date = new Date(project.startDate);
                        return !isNaN(date.getTime()) ? 
                          date.toLocaleDateString('es-ES', { 
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                          }) : 
                          'Sin fecha';
                      } catch {
                        return 'Sin fecha';
                      }
                    })() : 'Sin fecha'}
                </span>
              </div>
              {project.expectedEndDate && (
                <div className="flex items-center gap-1">
                  <Timer className="h-3 w-3" />
                  <span>Fin: {
                    (() => {
                      try {
                        const date = new Date(project.expectedEndDate);
                        return !isNaN(date.getTime()) ? 
                          date.toLocaleDateString('es-ES', { 
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                          }) : 
                          'Sin fecha';
                      } catch {
                        return 'Sin fecha';
                      }
                    })()
                  }</span>
                </div>
              )}
            </div>
          </div>

          {/* Acciones rápidas */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="default"
              size="sm"
              onClick={() => onNavigate(`/active-projects/${project.id}`)}
              className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Eye className="h-3 w-3 mr-1" />
              Abrir
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate(`/active-projects/${project.id}/time-entries`)}
              className="h-8 px-2"
            >
              <Clock className="h-3 w-3" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0 hover:bg-gray-100">
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 shadow-lg border-gray-200">
                <DropdownMenuItem onClick={() => onNavigate(`/active-projects/${project.id}/edit`)} className="cursor-pointer">
                  <Edit className="h-4 w-4 mr-2 text-blue-600" />
                  Editar Proyecto
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  <Users className="h-4 w-4 mr-2 text-green-600" />
                  Gestionar Equipo
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  <TrendingUp className="h-4 w-4 mr-2 text-purple-600" />
                  Ver Analíticas
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  <Timer className="h-4 w-4 mr-2 text-orange-600" />
                  Registro de Tiempo
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => onDeleteProject(project.id)}
                  className="text-red-600 cursor-pointer hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar Proyecto
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
              {subprojects.map((subproject: any) => {
                const subClient = Array.isArray(allClients) ? allClients.find((c: any) => c.id === subproject.clientId) : null;
                const subClientName = subClient?.name || clientName; // Usar el cliente del proyecto padre si no tiene uno específico
                
                return (
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
                  
                  <div className="flex items-center gap-2">
                    {/* Logo del cliente en subproyectos - más pequeño */}
                    {(subClient?.logoUrl || client?.logoUrl) ? (
                      <div className="h-4 w-4 rounded-sm overflow-hidden bg-gray-50 border border-gray-200 flex items-center justify-center opacity-70">
                        <img 
                          key={`sublogo-${subproject.id}-${refreshTimestamp}`}
                          src={`${subClient?.logoUrl || client?.logoUrl}${(subClient?.logoUrl || client?.logoUrl)?.includes('?') ? '&' : '?'}t=${refreshTimestamp}`}
                          alt={`Logo de ${subClientName}`}
                          className="h-full w-full object-contain"
                          onError={(e) => {
                            const target = e.currentTarget;
                            const container = target.parentElement;
                            if (container) {
                              container.innerHTML = '<svg class="h-3 w-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>';
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <div className="h-4 w-4 rounded-sm bg-gray-100 border border-gray-200 flex items-center justify-center">
                        <Building2 className="h-3 w-3 text-gray-300" />
                      </div>
                    )}
                    
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
                </div>
                );
              })}
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
  const [timeFilter, setTimeFilter] = useState("all");
  
  // Estados para eliminación de proyectos
  const [deleteProjectId, setDeleteProjectId] = useState<number | null>(null);
  const [deletingProjects, setDeletingProjects] = useState<Set<number>>(new Set());
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mutación para eliminar proyecto
  const deleteProjectMutation = useMutation({
    mutationFn: (projectId: number) => {
      return apiRequest(`/api/active-projects/${projectId}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Proyecto eliminado",
        description: "El proyecto ha sido eliminado exitosamente."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/active-projects"] });
      setDeleteProjectId(null);
      setDeletingProjects(new Set());
    },
    onError: (error) => {
      console.error("Error al eliminar proyecto:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el proyecto. Intente nuevamente.",
        variant: "destructive"
      });
      setDeletingProjects(new Set());
    }
  });

  // Función para iniciar eliminación
  const handleDeleteProject = (projectId: number) => {
    setDeleteProjectId(projectId);
  };

  // Función para confirmar eliminación
  const confirmDeleteProject = () => {
    if (deleteProjectId) {
      setDeletingProjects(new Set([deleteProjectId]));
      deleteProjectMutation.mutate(deleteProjectId);
    }
  };

  // Helper function to convert time filter to API parameter
  const getTimeFilterForAPI = (filter: string) => {
    const filterMap: Record<string, string> = {
      'all': 'all',
      'este_mes': 'current_month',
      'mes_pasado': 'last_month',
      'este_trimestre': 'current_quarter',
      'trimestre_pasado': 'last_quarter',
      'mayo_2025': 'may_2025',
      'junio_2025': 'june_2025',
      'julio_2025': 'july_2025',
      'q1_2025': 'q1_2025',
      'q2_2025': 'q2_2025',
      'este_semestre': 'current_semester',
      'semestre_pasado': 'last_semester',
      'este_año': 'current_year'
    };
    return filterMap[filter] || 'all';
  };

  // Datos
  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["/api/active-projects", timeFilter],
    queryFn: () => {
      const apiFilter = getTimeFilterForAPI(timeFilter);
      const url = `/api/active-projects${apiFilter !== 'all' ? `?timeFilter=${apiFilter}` : ''}`;
      console.log(`🔍 Active Projects API call:`, { 
        timeFilter, 
        apiFilter, 
        url 
      });
      return apiRequest(url, 'GET');
    }
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
  });

  const { data: allProjects = [] } = useQuery({
    queryKey: ["/api/active-projects?showSubprojects=true", timeFilter],
    queryFn: () => {
      const apiFilter = getTimeFilterForAPI(timeFilter);
      return apiRequest(`/api/active-projects?showSubprojects=true${apiFilter !== 'all' ? `&timeFilter=${apiFilter}` : ''}`, 'GET');
    }
  });

  const { data: timeEntriesData = {} } = useQuery({
    queryKey: ["/api/time-entries/all-projects", timeFilter],
    queryFn: () => {
      const apiFilter = getTimeFilterForAPI(timeFilter);
      const url = `/api/time-entries/all-projects${apiFilter !== 'all' ? `?timeFilter=${apiFilter}` : ''}`;
      console.log(`🔍 Time Entries API call:`, { 
        timeFilter, 
        apiFilter, 
        url 
      });
      return apiRequest(url, 'GET');
    }
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
      <div className="bg-gradient-to-r from-white via-blue-50 to-purple-50 border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Proyectos Activos
              </h1>
              <p className="text-gray-600 mt-1 text-lg">Gestión integral de proyectos y seguimiento en tiempo real</p>
            </div>
            
            <Button 
              onClick={() => setLocation("/active-projects/new")}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Proyecto
            </Button>
          </div>

          {/* Filtro temporal */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filtrar por período:</span>
              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Seleccionar período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo el tiempo</SelectItem>
                  <SelectItem value="este_mes">Este mes</SelectItem>
                  <SelectItem value="mes_pasado">Mes pasado</SelectItem>
                  <SelectItem value="este_trimestre">Este trimestre</SelectItem>
                  <SelectItem value="trimestre_pasado">Trimestre pasado</SelectItem>
                  <SelectItem value="este_semestre">Este semestre</SelectItem>
                  <SelectItem value="semestre_pasado">Semestre pasado</SelectItem>
                  <SelectItem value="este_año">Este año</SelectItem>
                  <SelectItem value="mayo_2025">Mayo 2025</SelectItem>
                  <SelectItem value="junio_2025">Junio 2025</SelectItem>
                  <SelectItem value="julio_2025">Julio 2025</SelectItem>
                  <SelectItem value="q1_2025">Q1 2025</SelectItem>
                  <SelectItem value="q2_2025">Q2 2025</SelectItem>
                </SelectContent>
              </Select>
              {timeFilter !== "all" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTimeFilter("all")}
                  className="h-8 px-2 text-xs text-gray-500 hover:text-gray-700"
                >
                  Limpiar filtro
                </Button>
              )}
            </div>
          </div>

          {/* Estadísticas mejoradas */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-blue-900">{stats.total}</div>
                  <div className="text-sm text-blue-700 font-medium">
                    {timeFilter === "all" ? "Total Proyectos" : "Proyectos (período)"}
                  </div>
                </div>
                <div className="p-3 bg-blue-500 rounded-full shadow-lg">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-green-900">{stats.active}</div>
                  <div className="text-sm text-green-700 font-medium">
                    {timeFilter === "all" ? "Activos" : "Activos (período)"}
                  </div>
                </div>
                <div className="p-3 bg-green-500 rounded-full shadow-lg">
                  <Play className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-purple-900">${stats.totalBudget.toLocaleString()}</div>
                  <div className="text-sm text-purple-700 font-medium">
                    {timeFilter === "all" ? "Facturación Total" : "Facturación (período)"}
                  </div>
                </div>
                <div className="p-3 bg-purple-500 rounded-full shadow-lg">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-orange-900">{stats.totalHours.toFixed(0)}h</div>
                  <div className="text-sm text-orange-700 font-medium">
                    {timeFilter === "all" ? "Horas Registradas" : "Horas (período)"}
                  </div>
                </div>
                <div className="p-3 bg-orange-500 rounded-full shadow-lg">
                  <Clock className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Filtros rápidos */}
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant={filterStatus === "active" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus(filterStatus === "active" ? "all" : "active")}
              className="h-8"
            >
              <Play className="h-3 w-3 mr-1" />
              Activos ({stats.active})
            </Button>
            <Button
              variant={filterStatus === "paused" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus(filterStatus === "paused" ? "all" : "paused")}
              className="h-8"
            >
              <Pause className="h-3 w-3 mr-1" />
              Pausados
            </Button>
            <Button
              variant={filterStatus === "completed" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus(filterStatus === "completed" ? "all" : "completed")}
              className="h-8"
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Completados
            </Button>
          </div>

          {/* Filtros y búsqueda */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar proyectos, clientes o descripción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/50 backdrop-blur-sm border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100"
                >
                  ×
                </Button>
              )}
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
                  onDeleteProject={handleDeleteProject}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-20 px-6">
            <Building2 className="h-16 w-16 text-gray-400 mb-6" />
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              {searchTerm || filterStatus !== "all" || filterClient !== "all" 
                ? "No se encontraron proyectos" 
                : "No hay proyectos activos"
              }
            </h3>
            <p className="text-gray-600 mb-8 max-w-md">
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

      {/* Diálogo de confirmación para eliminar proyecto */}
      <Dialog open={deleteProjectId !== null} onOpenChange={() => setDeleteProjectId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Eliminar Proyecto
            </DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. El proyecto y todos sus datos asociados serán eliminados permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteProjectId(null)}
              disabled={deleteProjectMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteProject}
              disabled={deleteProjectMutation.isPending}
            >
              {deleteProjectMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}