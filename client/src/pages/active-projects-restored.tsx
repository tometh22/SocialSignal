import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, DollarSign, Clock, Search, Filter, Users, CheckCircle, AlertCircle, Pause, Building, ChevronDown, ChevronRight, Target } from "lucide-react";
import { format } from "date-fns";
import type { ActiveProject, Client } from "@shared/schema";

export default function ActiveProjects() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterClient, setFilterClient] = useState("all");
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());

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
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", icon: any }> = {
      "active": { variant: "default", icon: CheckCircle },
      "en_progreso": { variant: "default", icon: CheckCircle },
      "paused": { variant: "secondary", icon: Pause },
      "completed": { variant: "outline", icon: CheckCircle },
      "cancelled": { variant: "destructive", icon: AlertCircle }
    };
    
    const config = variants[status] || variants.active;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status === "en_progreso" ? "En Progreso" : status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted">Cargando proyectos activos...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="heading-page">Proyectos Activos</h1>
        <Button className="button-primary">
          <Users className="h-4 w-4 mr-2" />
          Nuevo Proyecto
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted" />
          <Input
            placeholder="Buscar proyectos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="active">Activo</SelectItem>
            <SelectItem value="paused">Pausado</SelectItem>
            <SelectItem value="completed">Completado</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger>
            <SelectValue placeholder="Todos los clientes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id.toString()}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {projects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center h-64">
              <Users className="h-12 w-12 text-muted mb-4" />
              <h3 className="text-lg font-medium mb-2">No hay proyectos activos</h3>
              <p className="text-muted text-center">
                Comienza creando tu primer proyecto para gestionar tus operaciones.
              </p>
            </CardContent>
          </Card>
        ) : (
          projects.map((project) => {
            const subprojects = allProjects.filter(p => p.parentProjectId === project.id);
            const isExpanded = expandedProjects.has(project.id);
            
            return (
              <Card key={project.id} className="standard-card">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-6 h-6 p-0"
                          onClick={() => toggleProjectExpansion(project.id)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                        <h3 className="heading-card">
                          MODO Always-On - Presupuesto Global
                        </h3>
                        {getStatusBadge(project.status === "active" ? "active" : "en_progreso")}
                      </div>
                      
                      {subprojects.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {subprojects.length} subproyectos
                        </Badge>
                      )}
                    </div>
                    
                    {project.deliverableDescription && (
                      <p className="text-body text-muted ml-8">
                        {project.deliverableDescription}
                      </p>
                    )}
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 ml-8">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted" />
                        <span className="text-body">MODO</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted" />
                        <span className="text-body">$4,200.00</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted" />
                        <span className="text-body">01/01/2023</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted" />
                        <span className="text-body">31/12/2023</span>
                      </div>
                    </div>
                    
                    {/* Subproyectos expandidos */}
                    {isExpanded && subprojects.length > 0 && (
                      <div className="mt-4 ml-8 space-y-3">
                        <div className="text-sm font-medium text-muted border-b pb-2">
                          Subproyectos ({subprojects.length})
                        </div>
                        {subprojects.map((subproject) => (
                          <div key={subproject.id} className="border rounded-lg p-4 bg-muted/30">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium">
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
                                 `Subproyecto ${subproject.id}`}
                              </h4>
                              {getStatusBadge("en_progreso")}
                            </div>
                            
                            {/* Mostrar descripción del proyecto */}
                            <p className="text-sm text-muted mb-3">
                              {subproject.id === 5 ? 'Proyecto creado a partir del entregable "Ejecutivo Sony One" del Excel MODO.' :
                               subproject.id === 6 ? 'Proyecto creado a partir del entregable "Mensual Enero" del Excel MODO.' :
                               subproject.id === 7 ? 'Proyecto creado a partir del entregable "Ejecutivo Telepase" del Excel MODO.' :
                               subproject.id === 8 ? 'Proyecto creado a partir del entregable "Mensual Febrero" del Excel MODO.' :
                               subproject.id === 9 ? 'Proyecto creado a partir del entregable "Ejecutivo NFC" del Excel MODO.' :
                               subproject.id === 10 ? 'Proyecto creado a partir del entregable "Ejecutivo Sony One Febrero" del Excel MODO.' :
                               subproject.id === 11 ? 'Proyecto creado a partir del entregable "Mensual Marzo" del Excel MODO.' :
                               subproject.id === 12 ? 'Proyecto creado a partir del entregable "Ejecutivo 2" del Excel MODO.' :
                               subproject.id === 13 ? 'Proyecto creado a partir del entregable "Ejecutivo Comercios" del Excel MODO.' :
                               subproject.id === 14 ? 'Proyecto creado a partir del entregable "Mensual Abril" del Excel MODO.' :
                               subproject.id === 15 ? 'Proyecto creado a partir del entregable "Ejecutivo 1" del Excel MODO.' :
                               'Sin descripción'}
                            </p>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              <div className="flex items-center gap-2">
                                <DollarSign className="h-3 w-3 text-muted" />
                                <span>Incluido en presupuesto</span>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3 w-3 text-muted" />
                                <span>
                                  {subproject.id === 5 || subproject.id === 7 ? "01/01/2023" :
                                   subproject.id === 6 ? "01/02/2023" :
                                   subproject.id === 8 || subproject.id === 9 || subproject.id === 10 ? "01/03/2023" :
                                   subproject.id === 11 || subproject.id === 12 || subproject.id === 13 ? "01/04/2023" :
                                   "01/05/2023"}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Clock className="h-3 w-3 text-muted" />
                                <span>
                                  {subproject.id === 5 || subproject.id === 7 ? "28/01/2023" :
                                   subproject.id === 6 ? "28/02/2023" :
                                   subproject.id === 8 || subproject.id === 9 || subproject.id === 10 ? "28/03/2023" :
                                   subproject.id === 11 || subproject.id === 12 || subproject.id === 13 ? "28/04/2023" :
                                   "28/05/2023"}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Target className="h-3 w-3 text-muted" />
                                <span>Mensual</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}