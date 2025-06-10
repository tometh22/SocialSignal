import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Search, 
  Plus, 
  ChevronDown, 
  ChevronRight, 
  Calendar,
  DollarSign,
  Clock,
  Building2,
  Target,
  TrendingUp,
  ExternalLink,
  Eye
} from "lucide-react";
import { SubprojectManager } from "@/components/subproject-manager";

export default function ActiveProjectsModern() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterClient, setFilterClient] = useState("all");
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set()); // Todos los proyectos cerrados por defecto
  const [, setLocation] = useLocation();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["/api/active-projects"],
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
  });

  const { data: allProjects = [] } = useQuery({
    queryKey: ["/api/active-projects", true],
    queryFn: () => fetch("/api/active-projects?showSubprojects=true").then(res => res.json()),
  });

  // Obtener datos de tiempo para todos los proyectos
  const { data: timeEntriesData = {} } = useQuery({
    queryKey: ["/api/time-entries/all-projects"],
    queryFn: () => fetch("/api/time-entries/all-projects").then(res => res.json()),
  });

  const toggleProjectExpansion = (projectId: number) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  // Función para obtener horas registradas de un proyecto
  const getProjectHours = (projectId: number) => {
    const projectTimeEntries = timeEntriesData[projectId] || [];
    const totalHours = projectTimeEntries.reduce((sum: number, entry: any) => sum + (entry.hours || 0), 0);
    return totalHours;
  };

  // Función para determinar estado del proyecto basado en progreso
  const getProjectStatus = (registeredHours: number, estimatedHours: number) => {
    const progress = estimatedHours > 0 ? registeredHours / estimatedHours : 0;
    if (progress < 0.5) return { text: "Inicio", color: "text-blue-600" };
    if (progress < 0.8) return { text: "En progreso", color: "text-orange-600" };
    if (progress < 1.1) return { text: "En tiempo", color: "text-emerald-600" };
    return { text: "Excedido", color: "text-red-600" };
  };

  const getStatusBadge = (status: string) => {
    const config = {
      "active": { className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100", label: "Activo" },
      "en_progreso": { className: "bg-blue-100 text-blue-700 hover:bg-blue-100", label: "En Progreso" },
      "paused": { className: "bg-amber-100 text-amber-700 hover:bg-amber-100", label: "Pausado" },
      "completed": { className: "bg-gray-100 text-gray-700 hover:bg-gray-100", label: "Completado" }
    };
    
    const statusConfig = config[status as keyof typeof config] || config.active;
    
    return (
      <Badge variant="secondary" className={`text-xs font-medium px-2 py-1 ${statusConfig.className}`}>
        {statusConfig.label}
      </Badge>
    );
  };

  const getCompletionStatusBadge = (status: string) => {
    const config = {
      "pending": { className: "bg-gray-100 text-gray-700", label: "Pendiente" },
      "in_progress": { className: "bg-blue-100 text-blue-700", label: "En Progreso" },
      "completed": { className: "bg-green-100 text-green-700", label: "Completado" },
      "cancelled": { className: "bg-red-100 text-red-700", label: "Cancelado" }
    };
    
    const statusConfig = config[status as keyof typeof config] || config.pending;
    
    return (
      <Badge variant="secondary" className={`text-xs font-medium px-2 py-1 ${statusConfig.className}`}>
        {statusConfig.label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50/50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500 text-sm">Cargando proyectos...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Breadcrumbs unificados */}
      <div className="breadcrumb-nav">
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-4">
          <span>Dashboard</span>
          <span>/</span>
          <span className="text-foreground font-medium">Proyectos Activos</span>
        </nav>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="heading-page">Proyectos Activos</h1>
          </div>
          <Button 
            onClick={() => setLocation("/active-projects/new")}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Proyecto
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Filtros */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar proyectos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48 border-gray-200">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="active">Activo</SelectItem>
              <SelectItem value="en_progreso">En Progreso</SelectItem>
              <SelectItem value="paused">Pausado</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-48 border-gray-200">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {(clients as any[]).map((client: any) => (
                <SelectItem key={client.id} value={client.id.toString()}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Lista de Proyectos */}
        <div className="space-y-4">
          {(projects as any[]).map((project: any) => {
            const subprojects = allProjects.filter((p: any) => p.parentProjectId === project.id);
            const isExpanded = expandedProjects.has(project.id);
            const client = (clients as any[]).find((c: any) => c.id === project.clientId);
            const projectName = project.quotation?.projectName || "Proyecto sin nombre";
            const clientName = client?.name || "Cliente desconocido";
            const totalAmount = project.quotation?.totalAmount || 0;
            
            // Determinar si es un proyecto Always-On (tiene subproyectos) o proyecto único
            const isAlwaysOnProject = subprojects.length > 0;
            const hasExpandableContent = isAlwaysOnProject;
            
            return (
              <Card key={project.id} className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-0">
                  {/* Proyecto Principal */}
                  <div className="p-6">
                    <div className="flex items-center gap-4">
                      {/* Botón de expansión - solo para proyectos con subproyectos */}
                      {hasExpandableContent ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-gray-100"
                          onClick={() => toggleProjectExpansion(project.id)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-gray-600" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-600" />
                          )}
                        </Button>
                      ) : (
                        <div className="h-8 w-8 flex items-center justify-center">
                          <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                        </div>
                      )}

                      {/* Avatar del Cliente */}
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={client?.logoUrl || ""} />
                        <AvatarFallback className="bg-blue-100 text-blue-700 font-medium">
                          {clientName.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      {/* Información del Proyecto */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-semibold text-gray-900 truncate">
                              {projectName}
                            </h3>
                            {getStatusBadge(project.status === "active" ? "active" : "en_progreso")}
                            {subprojects.length > 0 && (
                              <Badge variant="outline" className="text-xs text-gray-600 border-gray-300">
                                {subprojects.length} subproyectos
                              </Badge>
                            )}
                          </div>
                          
                          {/* Botón contextual según tipo de proyecto */}
                          {isAlwaysOnProject ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
                              onClick={() => setLocation(`/client-summary/${project.clientId}`)}
                            >
                              <Building2 className="h-4 w-4 mr-2" />
                              Ver Resumen del Cliente
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
                              onClick={() => setLocation(`/project-details/${project.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Detalles del Proyecto
                            </Button>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-6 text-sm text-gray-600">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-4 w-4" />
                            <span className="font-medium">{clientName}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <DollarSign className="h-4 w-4" />
                            <span className="font-semibold text-gray-900">${totalAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {new Date(project.startDate).toLocaleDateString('es-ES')}
                              {project.expectedEndDate && ` - ${new Date(project.expectedEndDate).toLocaleDateString('es-ES')}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4 text-blue-600" />
                            <span className="text-blue-600 font-medium">{getProjectHours(project.id).toFixed(1)}h registradas</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Gestión de Subproyectos - solo para proyectos Always-On */}
                  {isAlwaysOnProject && (
                    <SubprojectManager
                      subprojects={subprojects}
                      parentProjectId={project.id}
                      isExpanded={isExpanded}
                      getProjectHours={getProjectHours}
                      setLocation={setLocation}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {(projects as any[]).length === 0 && (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay proyectos activos</h3>
            <p className="text-gray-600 mb-6">Comienza creando tu primer proyecto para gestionar tus operaciones.</p>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Crear Proyecto
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}