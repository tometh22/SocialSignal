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

  const toggleProjectExpansion = (projectId: number) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const getStatusBadge = (status: string) => {
    const config = {
      "active": { className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100", label: "Activo" },
      "en_progreso": { className: "bg-blue-100 text-blue-700 hover:bg-blue-100", label: "En Progreso" },
      "paused": { className: "bg-amber-100 text-amber-700 hover:bg-amber-100", label: "Pausado" },
      "completed": { className: "bg-gray-100 text-gray-700 hover:bg-gray-100", label: "Completado" }
    };
    
    const statusConfig = config[status] || config.active;
    
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
    <div className="min-h-screen bg-gray-50/50">
      <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Proyectos Activos</h1>
              <p className="text-sm text-gray-600 mt-1">Gestión y seguimiento de proyectos en curso</p>
            </div>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Proyecto
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
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
              {clients.map((client: any) => (
                <SelectItem key={client.id} value={client.id.toString()}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Lista de Proyectos */}
        <div className="space-y-4">
          {projects.map((project: any) => {
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
                        <div className="flex items-center gap-3 mb-2">
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
                              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-all cursor-pointer group"
                              onClick={() => setLocation(`/active-projects/${subproject.id}`)}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium text-gray-900 text-sm group-hover:text-blue-600 transition-colors">
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
                                  <Eye className="h-3 w-3 text-gray-400 group-hover:text-blue-500 transition-colors" />
                                </div>
                                <div className="flex items-center gap-2">
                                  {getStatusBadge("en_progreso")}
                                  <ExternalLink className="h-3 w-3 text-gray-400 group-hover:text-blue-500 transition-colors" />
                                </div>
                              </div>
                              
                              <p className="text-xs text-gray-600 mb-3 leading-relaxed group-hover:text-gray-700 transition-colors">
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
                              
                              <div className="flex items-center gap-4 text-xs text-gray-500 group-hover:text-gray-600 transition-colors">
                                <div className="flex items-center gap-1">
                                  <DollarSign className="h-3 w-3" />
                                  <span>Incluido en presupuesto</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  <span>
                                    {subproject.startDate ? new Date(subproject.startDate).toLocaleDateString('es-ES') :
                                     (subproject.id === 5 || subproject.id === 7 ? "01/01/2023" :
                                      subproject.id === 6 ? "01/02/2023" :
                                      subproject.id === 8 || subproject.id === 9 || subproject.id === 10 ? "01/03/2023" :
                                      subproject.id === 11 || subproject.id === 12 || subproject.id === 13 ? "01/04/2023" :
                                      "01/05/2023")}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    {subproject.expectedEndDate ? new Date(subproject.expectedEndDate).toLocaleDateString('es-ES') :
                                     (subproject.id === 5 || subproject.id === 7 ? "28/01/2023" :
                                      subproject.id === 6 ? "28/02/2023" :
                                      subproject.id === 8 || subproject.id === 9 || subproject.id === 10 ? "28/03/2023" :
                                      subproject.id === 11 || subproject.id === 12 || subproject.id === 13 ? "28/04/2023" :
                                      "28/05/2023")}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Target className="h-3 w-3" />
                                  <span>{subproject.trackingFrequency || "Mensual"}</span>
                                </div>
                                <div className="text-blue-600 group-hover:text-blue-700 font-medium">
                                  Ver detalles →
                                </div>
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

        {projects.length === 0 && (
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