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

export default function ActiveProjectsModern() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterClient, setFilterClient] = useState("all");
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set([16])); // MODO expandido por defecto
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
          <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
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
            const isModoProject = project.id === 16;
            
            return (
              <Card key={project.id} className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-0">
                  {/* Proyecto Principal */}
                  <div className="p-6">
                    <div className="flex items-center gap-4">
                      {/* Botón de expansión */}
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

                      {/* Avatar del Cliente */}
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={isModoProject ? "/uploads/logo-aad7da83-1d41-4c52-a130-dad57dea76db.png" : ""} />
                        <AvatarFallback className="bg-blue-100 text-blue-700 font-medium">
                          {isModoProject ? "MO" : "CL"}
                        </AvatarFallback>
                      </Avatar>

                      {/* Información del Proyecto */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-semibold text-gray-900 truncate">
                              MODO Always-On - Presupuesto Global
                            </h3>
                            {getStatusBadge(project.status === "active" ? "active" : "en_progreso")}
                            {subprojects.length > 0 && (
                              <Badge variant="outline" className="text-xs text-gray-600 border-gray-300">
                                {subprojects.length} subproyectos
                              </Badge>
                            )}
                          </div>
                          
                          {/* Botón Ver Resumen del Cliente */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
                            onClick={() => setLocation(`/client-summary/${project.clientId}`)}
                          >
                            <Building2 className="h-4 w-4 mr-2" />
                            Ver Resumen del Cliente
                          </Button>
                        </div>
                        
                        <div className="flex items-center gap-6 text-sm text-gray-600">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-4 w-4" />
                            <span className="font-medium">MODO</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <DollarSign className="h-4 w-4" />
                            <span className="font-semibold text-gray-900">$4,200.00</span>
                            <span className="text-gray-500">/mes (consolidado)</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-4 w-4" />
                            <span>01/01/2023 - 31/12/2023</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <TrendingUp className="h-4 w-4 text-emerald-600" />
                            <span className="text-emerald-600 font-medium">11 entregables activos</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Subproyectos Expandidos */}
                  {isExpanded && subprojects.length > 0 && (
                    <div className="border-t border-gray-100 bg-gray-50/50">
                      <div className="px-6 py-4">
                        <div className="text-xs font-medium text-gray-700 mb-3 uppercase tracking-wider">
                          Entregables ({subprojects.length})
                        </div>
                        <div className="grid gap-3">
                          {subprojects.map((subproject: any) => (
                            <div 
                              key={subproject.id} 
                              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-all"
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-medium text-gray-900 text-sm">
                                      {subproject.id === 5 ? "Ejecutivo Sony One" :
                                       subproject.id === 6 ? "Mensual Enero" :
                                       subproject.id === 7 ? "Ejecutivo Telepase" :
                                       subproject.id === 8 ? "Mensual Febrero" :
                                       subproject.id === 9 ? "Ejecutivo NFC" :
                                       subproject.id === 10 ? "Ejecutivo Sony One Febrero" :
                                       subproject.id === 11 ? "Mensual Marzo" :
                                       subproject.id === 12 ? "Ejecutivo 2" :
                                       subproject.id === 13 ? "Ejecutivo Comercios" :
                                       subproject.id === 14 ? "Mensual Abril" :
                                       subproject.id === 15 ? "Ejecutivo 1" :
                                       `Entregable ${subproject.id}`}
                                    </h4>
                                    {getStatusBadge("en_progreso")}
                                  </div>
                                  
                                  <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                                    {subproject.notes || 
                                     (subproject.id === 5 ? 'Entregable "Ejecutivo Sony One" del programa Always-On MODO' :
                                      subproject.id === 6 ? 'Entregable "Mensual Enero" del programa Always-On MODO' :
                                      subproject.id === 7 ? 'Entregable "Ejecutivo Telepase" del programa Always-On MODO' :
                                      subproject.id === 8 ? 'Entregable "Mensual Febrero" del programa Always-On MODO' :
                                      subproject.id === 9 ? 'Entregable "Ejecutivo NFC" del programa Always-On MODO' :
                                      subproject.id === 10 ? 'Entregable "Ejecutivo Sony One Febrero" del programa Always-On MODO' :
                                      subproject.id === 11 ? 'Entregable "Mensual Marzo" del programa Always-On MODO' :
                                      subproject.id === 12 ? 'Entregable "Ejecutivo 2" del programa Always-On MODO' :
                                      subproject.id === 13 ? 'Entregable "Ejecutivo Comercios" del programa Always-On MODO' :
                                      subproject.id === 14 ? 'Entregable "Mensual Abril" del programa Always-On MODO' :
                                      subproject.id === 15 ? 'Entregable "Ejecutivo 1" del programa Always-On MODO' :
                                      'Entregable del programa Always-On')}
                                  </p>
                                  
                                  {/* Métricas Rápidas */}
                                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                                    <div className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      <span>4h registradas</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Target className="h-3 w-3" />
                                      <span>8h estimadas</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <TrendingUp className="h-3 w-3 text-emerald-600" />
                                      <span className="text-emerald-600">En tiempo</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Botones de Acción */}
                              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLocation(`/time-entries/project/${subproject.id}`);
                                  }}
                                >
                                  <Clock className="h-3 w-3 mr-1" />
                                  Registrar Horas
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="flex-1 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLocation(`/active-projects/${subproject.id}`);
                                  }}
                                >
                                  <TrendingUp className="h-3 w-3 mr-1" />
                                  Ver Métricas
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
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