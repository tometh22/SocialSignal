import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import {
  Search,
  Plus,
  Calendar,
  DollarSign,
  User,
  Building,
  ChevronRight,
  ChevronDown,
  Clock,
  AlertCircle,
  CheckCircle,
  Pause
} from "lucide-react";

import type { ActiveProject, Client } from "@shared/schema";

export default function ActiveProjects() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterClient, setFilterClient] = useState("all");
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading: projectsLoading } = useQuery<ActiveProject[]>({
    queryKey: ["/api/active-projects"],
  });

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const filteredProjects = projects.filter((project) => {
    const matchesSearch = (project.quotation?.projectName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (project.deliverableDescription || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || project.status === filterStatus;
    const matchesClient = filterClient === "all" || 
                         (project.quotation?.clientId && project.quotation.clientId.toString() === filterClient);
    
    return matchesSearch && matchesStatus && matchesClient;
  });

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

  const toggleProjectExpansion = (projectId: number) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  return (
    <div className="page-container">
      <div className="flex-between mb-6">
        <h1 className="heading-page">Proyectos Activos</h1>
        <Button onClick={() => navigate("/new-active-project")}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Proyecto
        </Button>
      </div>

      <Card className="standard-card">
        <CardContent className="card-content">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" size={18} />
              <Input
                placeholder="Buscar proyectos..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
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
                <SelectValue placeholder="Cliente" />
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
            {projectsLoading ? (
              <div className="text-center py-8">
                <div className="animate-pulse">Cargando proyectos...</div>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-8 text-muted">
                No se encontraron proyectos que coincidan con los filtros
              </div>
            ) : (
              filteredProjects.map((project) => (
                <Card key={project.id} className="standard-card">
                  <CardContent className="card-content">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleProjectExpansion(project.id)}
                            className="p-1 h-auto"
                          >
                            {expandedProjects[project.id] ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                          <h3 className="heading-card">MODO Always-On - Presupuesto Global</h3>
                          {getStatusBadge(project.status)}
                        </div>
                        
                        {project.deliverableDescription && (
                          <p className="text-body text-muted mb-3 ml-8">
                            {project.deliverableDescription}
                          </p>
                        )}
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 ml-8">
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-muted" />
                            <span className="text-body">
                              MODO
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-muted" />
                            <span className="text-body">
                              $4,200.00
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted" />
                            <span className="text-body">
                              31/12/2022
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
                        {expandedProjects.has(project.id) && (
                          <div className="mt-4 ml-8 space-y-3">
                            <div className="text-sm font-medium text-muted border-b pb-2">
                              Subproyectos ({subprojects.length})
                            </div>
                            {subprojects.map((subproject) => (
                              <div key={subproject.id} className="border rounded-lg p-4 bg-muted/30">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="font-medium">{subproject.projectName || `Subproyecto ${subproject.id}`}</h4>
                                  {getStatusBadge(subproject.status)}
                                </div>
                                
                                {subproject.deliverableDescription && (
                                  <p className="text-sm text-muted mb-3">
                                    {subproject.deliverableDescription}
                                  </p>
                                )}
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                  <div className="flex items-center gap-2">
                                    <DollarSign className="h-3 w-3 text-muted" />
                                    <span>{subproject.additionalDeliverableCost ? 
                                      `$${subproject.additionalDeliverableCost.toLocaleString()}` : 
                                      'Incluido en presupuesto'}</span>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-3 w-3 text-muted" />
                                    <span>{subproject.startDate ? 
                                      new Date(subproject.startDate).toLocaleDateString() : 
                                      'Sin fecha'}</span>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-3 w-3 text-muted" />
                                    <span>{subproject.expectedEndDate ? 
                                      new Date(subproject.expectedEndDate).toLocaleDateString() : 
                                      'Sin fecha límite'}</span>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    <Target className="h-3 w-3 text-muted" />
                                    <span>{subproject.deliverableFrequency || 'Una vez'}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}