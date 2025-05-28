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
      "paused": { variant: "secondary", icon: Pause },
      "completed": { variant: "outline", icon: CheckCircle },
      "cancelled": { variant: "destructive", icon: AlertCircle }
    };
    
    const config = variants[status] || variants.active;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
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
                          {project.id === 16 ? "MODO Always-On - Presupuesto Global" : `Proyecto ${project.id}`}
                        </h3>
                        {getStatusBadge(project.status)}
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
                        <span className="text-body">
                          {project.id === 16 ? "MODO" : "Cliente no asignado"}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted" />
                        <span className="text-body">
                          {project.id === 16 ? "$4,200.00" : "Sin presupuesto"}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted" />
                        <span className="text-body">
                          {project.id === 16 ? "31/12/2022" : "Sin fecha"}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted" />
                        <span className="text-body">
                          Sin fecha límite
                        </span>
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
                                {subproject.id === 5 ? "Baby & Child Care - Semanal" :
                                 subproject.id === 6 ? "Beauty & Fashion - Quincenal" :
                                 subproject.id === 7 ? "Food & Beverage - Semanal" :
                                 subproject.id === 8 ? "Gaming - Mensual" :
                                 subproject.id === 9 ? "Tech & Electronics - Quincenal" :
                                 subproject.id === 10 ? "Entertainment - Semanal" :
                                 subproject.id === 11 ? "Health & Wellness - Mensual" :
                                 subproject.id === 12 ? "Travel & Tourism - Quincenal" :
                                 subproject.id === 13 ? "Finance & Crypto - Semanal" :
                                 subproject.id === 14 ? "Sports & Fitness - Mensual" :
                                 subproject.id === 15 ? "Education & Learning - Quincenal" :
                                 `Subproyecto ${subproject.id}`}
                              </h4>
                              {getStatusBadge(subproject.status)}
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              <div className="flex items-center gap-2">
                                <DollarSign className="h-3 w-3 text-muted" />
                                <span>Incluido en presupuesto</span>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3 w-3 text-muted" />
                                <span>01/01/2023</span>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Clock className="h-3 w-3 text-muted" />
                                <span>Sin fecha límite</span>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Target className="h-3 w-3 text-muted" />
                                <span>
                                  {subproject.id === 5 || subproject.id === 7 || subproject.id === 10 || subproject.id === 13 ? "Semanal" :
                                   subproject.id === 6 || subproject.id === 9 || subproject.id === 12 || subproject.id === 15 ? "Quincenal" :
                                   "Mensual"}
                                </span>
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