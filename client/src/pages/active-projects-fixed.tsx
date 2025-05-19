import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Plus, Search, Calendar, Clock, BarChart2, UserPlus, Trash2, LineChart, PenSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

// Definición de tipos
interface Client {
  id: number;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  logoUrl?: string;
}

interface Quotation {
  id: number;
  clientId: number;
  projectName: string;
  status: string;
  totalAmount: number;
  analysisType: string;
  projectType: string;
  client?: Client;
  clientName?: string;
}

interface ActiveProject {
  id: number;
  quotationId: number;
  status: string;
  startDate: string;
  expectedEndDate: string | null;
  actualEndDate: string | null;
  trackingFrequency: string;
  notes: string | null;
  isAlwaysOnMacro?: boolean;
  macroMonthlyBudget?: number;
  parentProjectId?: number;
  quotation: Quotation;
}

export default function ActiveProjects() {
  const [, setLocation] = useLocation();
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [expandedProjects, setExpandedProjects] = useState<{[key: number]: boolean}>({16: false}); // ID 16 es el proyecto macro MODO
  const [deleteProjectId, setDeleteProjectId] = useState<number | null>(null);
  const [assignClientDialogOpen, setAssignClientDialogOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [allProjects, setAllProjects] = useState<ActiveProject[]>([]);
  const [subprojectsMap, setSubprojectsMap] = useState<{[key: number]: ActiveProject[]}>({});
  const { toast } = useToast();

  // Consulta principal para obtener solo proyectos principales
  const { data: mainProjects = [], isLoading, refetch: refetchProjects } = useQuery<ActiveProject[]>({ 
    queryKey: ['/api/active-projects'],
    queryFn: async () => {
      const response = await fetch(`/api/active-projects?showSubprojects=false`);
      if (!response.ok) throw new Error('Error al cargar proyectos activos');
      return response.json();
    },
  });

  // Consulta para obtener clientes
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ['/api/clients'] });

  // Efecto para cargar subproyectos cuando un proyecto se expande
  useEffect(() => {
    const loadSubprojectsForExpandedProjects = async () => {
      const expandedIds = Object.entries(expandedProjects)
        .filter(([_, isExpanded]) => isExpanded)
        .map(([id]) => parseInt(id));
      
      if (expandedIds.length === 0) return;
      
      for (const parentId of expandedIds) {
        if (!subprojectsMap[parentId]) { // Cargar solo si no están ya cargados
          try {
            const response = await fetch(`/api/active-projects/parent/${parentId}`);
            if (response.ok) {
              const subprojects = await response.json();
              setSubprojectsMap(prev => ({
                ...prev,
                [parentId]: subprojects
              }));
            }
          } catch (error) {
            console.error(`Error cargando subproyectos para el proyecto ${parentId}:`, error);
          }
        }
      }
    };
    
    loadSubprojectsForExpandedProjects();
  }, [expandedProjects, subprojectsMap]);

  // Efecto para combinar proyectos principales y subproyectos
  useEffect(() => {
    const combined: ActiveProject[] = [...mainProjects];
    
    // Agregar subproyectos para proyectos expandidos
    Object.entries(expandedProjects).forEach(([parentId, isExpanded]) => {
      if (isExpanded && subprojectsMap[parseInt(parentId)]) {
        // Encontrar la posición del proyecto padre
        const parentIndex = combined.findIndex(p => p.id === parseInt(parentId));
        if (parentIndex !== -1) {
          // Insertar subproyectos después del padre
          const subprojects = subprojectsMap[parseInt(parentId)];
          combined.splice(parentIndex + 1, 0, ...subprojects);
        }
      }
    });
    
    setAllProjects(combined);
  }, [mainProjects, expandedProjects, subprojectsMap]);

  // Función para cambiar el estado de expansión de un proyecto
  const toggleProjectExpansion = (e: React.MouseEvent, projectId: number) => {
    e.stopPropagation();
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
  };

  // Mutation para asignar cliente a un proyecto
  const assignClientMutation = useMutation({
    mutationFn: ({ projectId, clientId }: { projectId: number; clientId: number }) => 
      apiRequest(`/api/active-projects/${projectId}/assign-client`, "PATCH", { clientId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/active-projects'] });
      await refetchProjects();
      toast({
        title: "Éxito",
        description: "Cliente asignado correctamente al proyecto.",
      });
      setAssignClientDialogOpen(false);
      setSelectedProjectId(null);
      setSelectedClientId("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo asignar el cliente al proyecto.",
        variant: "destructive",
      });
    }
  });

  const handleDeleteProject = (projectId: number) => {
    setDeleteProjectId(projectId);
  };

  // Mutation para eliminar proyectos
  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: number) => {
      const response = await apiRequest('DELETE', `/api/active-projects/${projectId}`);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Proyecto eliminado",
        description: "El proyecto ha sido eliminado correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/active-projects'] });
      setDeleteProjectId(null);
    },
    onError: (error) => {
      console.error('Error al eliminar el proyecto:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el proyecto. Inténtalo de nuevo más tarde.",
        variant: "destructive",
      });
    }
  });

  const confirmDelete = () => {
    if (!deleteProjectId) return;
    deleteProjectMutation.mutate(deleteProjectId);
  };

  const openAssignClientDialog = (e: React.MouseEvent, projectId: number) => {
    e.stopPropagation();
    setSelectedProjectId(projectId);
    setSelectedClientId("");
    setAssignClientDialogOpen(true);
  };

  const assignClient = () => {
    if (!selectedProjectId || !selectedClientId) {
      toast({
        title: "Error",
        description: "Debes seleccionar un cliente.",
        variant: "destructive",
      });
      return;
    }

    assignClientMutation.mutate({ 
      projectId: selectedProjectId, 
      clientId: parseInt(selectedClientId) 
    });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return format(new Date(dateString), "dd MMM yyyy", { locale: es });
  };

  return (
    <div className="p-3 space-y-3">
      {/* Header más compacto */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold">Gestión de Proyectos</h1>
        <Button
          onClick={() => setLocation("/active-projects/new")}
          size="sm"
          className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Nuevo Proyecto
        </Button>
      </div>

      {/* Filtros integrados en la tabla */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {/* Barra de filtros */}
        <div className="flex gap-2 items-center p-2 border-b bg-gray-50">
          <div className="flex items-center text-xs font-medium text-gray-600 mr-1">
            <Search className="h-3.5 w-3.5 mr-1 text-gray-500" />
            Filtros:
          </div>
          
          <div className="flex-1">
            <div className="relative">
              <Input
                placeholder="Buscar proyectos..."
                className="pl-6 h-7 text-xs"
              />
              <Search className="absolute left-1.5 top-1.5 h-3.5 w-3.5 text-gray-400" />
            </div>
          </div>
          
          <div className="w-40">
            <Select defaultValue="all">
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Todos los clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los clientes</SelectItem>
                {clients && clients.map((client: Client) => (
                  <SelectItem key={client.id} value={client.id.toString()}>
                    <div className="flex items-center gap-2">
                      {client.logoUrl ? (
                        <div className="h-4 w-4 rounded overflow-hidden flex-shrink-0">
                          <img 
                            src={client.logoUrl} 
                            alt={`${client.name} logo`} 
                            className="h-full w-full object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="h-4 w-4 bg-primary/10 rounded flex items-center justify-center flex-shrink-0">
                          <span className="text-[9px] font-medium text-primary">
                            {client.name.substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                      )}
                      {client.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between p-2 bg-gray-50 border-b">
          <h2 className="text-xs font-medium text-gray-600">Proyectos en Ejecución</h2>
          <div className="flex gap-1">
            <Badge variant="outline" className="text-[10px] h-5 bg-white">
              {mainProjects.length} proyectos principales
            </Badge>
          </div>
        </div>

        {/* Tabla optimizada */}
        <table className="w-full">
          <thead>
            <tr className="text-[11px] text-gray-500 bg-gray-50">
              <th className="px-2 py-1.5 text-left font-medium">Proyecto</th>
              <th className="px-2 py-1.5 text-left font-medium">Cliente</th>
              <th className="px-2 py-1.5 text-left font-medium">Estado</th>
              <th className="px-2 py-1.5 text-left font-medium">Inicio</th>
              <th className="px-2 py-1.5 text-left font-medium">Fin Esperado</th>
              <th className="px-2 py-1.5 text-left font-medium">Seguimiento</th>
              <th className="px-2 py-1.5 text-left font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-2 py-4 text-center text-gray-500 text-xs">Cargando proyectos...</td>
              </tr>
            ) : allProjects.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-2 py-4 text-center text-gray-500 text-xs">No hay proyectos</td>
              </tr>
            ) : (
              allProjects.map(project => (
                <tr 
                  key={project.id} 
                  className={`text-xs hover:bg-gray-50 cursor-pointer 
                    ${project.isAlwaysOnMacro ? 'bg-blue-50/50' : ''} 
                    ${project.parentProjectId ? 'bg-slate-50' : ''}`}
                  onClick={() => setLocation(`/project-analytics/${project.id}`)}
                >
                  <td className="px-2 py-1.5 font-medium">
                    <div className="flex items-center">
                      {/* Botón para expandir/colapsar solo para proyectos macro */}
                      {project.isAlwaysOnMacro && (
                        <Button 
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 mr-1 text-blue-600"
                          onClick={(e) => toggleProjectExpansion(e, project.id)}
                        >
                          {expandedProjects[project.id] ? (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                              <path d="M19 12h-14"></path>
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                              <path d="M12 5v14M5 12h14"></path>
                            </svg>
                          )}
                        </Button>
                      )}
                    
                      {project.isAlwaysOnMacro && (
                        <Badge variant="outline" className="mr-2 bg-blue-100 text-blue-800 border-blue-200">
                          Always On
                        </Badge>
                      )}
                      {project.parentProjectId && (
                        <span className="text-gray-400 ml-5 mr-1">└─</span>
                      )}
                      {project.quotation?.projectName || '-'}
                      {project.isAlwaysOnMacro && (
                        <span className="ml-2 text-blue-600 text-[10px]">
                          ${project.macroMonthlyBudget?.toLocaleString()} / mes
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      {project.quotation?.client?.logoUrl ? (
                        <div className="h-5 w-5 rounded overflow-hidden border flex-shrink-0">
                          <img 
                            src={project.quotation.client.logoUrl} 
                            alt={`${project.quotation.client.name} logo`} 
                            className="h-full w-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="h-5 w-5 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-medium text-gray-500">
                            {project.quotation?.client?.name?.substring(0, 2).toUpperCase() || ''}
                          </span>
                        </div>
                      )}
                      {project.quotation?.client?.name || '-'}
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <Badge className={`
                      ${project.status === 'active' || project.status === 'activo' ? 'bg-green-100 text-green-800 hover:bg-green-100' : ''}
                      ${project.status === 'en_progreso' ? 'bg-amber-100 text-amber-800 hover:bg-amber-100' : ''}
                      ${project.status === 'pausado' ? 'bg-orange-100 text-orange-800 hover:bg-orange-100' : ''}
                      ${project.status === 'cancelado' ? 'bg-red-100 text-red-800 hover:bg-red-100' : ''}
                      ${project.status === 'completado' ? 'bg-blue-100 text-blue-800 hover:bg-blue-100' : ''}
                      text-[10px] font-normal`}
                    >
                      {project.status === 'active' ? 'Activo' : 
                       project.status === 'en_progreso' ? 'En progreso' :
                       project.status === 'pausado' ? 'Pausado' :
                       project.status === 'cancelado' ? 'Cancelado' :
                       project.status === 'completado' ? 'Completado' : project.status}
                    </Badge>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center text-gray-600">
                      <Calendar className="h-3 w-3 mr-1.5 text-gray-400" />
                      {formatDate(project.startDate)}
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center text-gray-600">
                      <Calendar className="h-3 w-3 mr-1.5 text-gray-400" />
                      {formatDate(project.expectedEndDate)}
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center text-gray-600">
                      <Clock className="h-3 w-3 mr-1.5 text-gray-400" />
                      {project.trackingFrequency === 'mensual' ? 'Mensual' :
                       project.trackingFrequency === 'semanal' ? 'Semanal' :
                       project.trackingFrequency === 'quincenal' ? 'Quincenal' :
                       project.trackingFrequency === 'monthly' ? 'Mensual' :
                       project.trackingFrequency === 'weekly' ? 'Semanal' :
                       project.trackingFrequency === 'biweekly' ? 'Quincenal' : project.trackingFrequency}
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 rounded-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/project-analytics/${project.id}`);
                        }}
                      >
                        <BarChart2 className="h-3.5 w-3.5 text-indigo-600" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 rounded-full"
                        onClick={(e) => openAssignClientDialog(e, project.id)}
                      >
                        <UserPlus className="h-3.5 w-3.5 text-gray-600" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 rounded-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/active-projects/${project.id}/edit`);
                        }}
                      >
                        <PenSquare className="h-3.5 w-3.5 text-gray-600" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 rounded-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProject(project.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-gray-600" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Dialog para confirmar eliminación */}
      <Dialog open={deleteProjectId !== null} onOpenChange={() => setDeleteProjectId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres eliminar este proyecto? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-between mt-2">
            <Button
              variant="outline"
              onClick={() => setDeleteProjectId(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteProjectMutation.isPending}
            >
              {deleteProjectMutation.isPending ? "Eliminando..." : "Eliminar proyecto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para asignar cliente */}
      <Dialog open={assignClientDialogOpen} onOpenChange={setAssignClientDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Asignar Cliente</DialogTitle>
            <DialogDescription>
              Selecciona un cliente para asignarlo al proyecto.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 mb-4">
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id.toString()}>
                    <div className="flex items-center gap-2">
                      {client.logoUrl ? (
                        <div className="h-4 w-4 rounded overflow-hidden flex-shrink-0">
                          <img 
                            src={client.logoUrl} 
                            alt={`${client.name} logo`} 
                            className="h-full w-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="h-4 w-4 bg-primary/10 rounded flex items-center justify-center flex-shrink-0">
                          <span className="text-[9px] font-medium text-primary">
                            {client.name.substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                      )}
                      {client.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button
              variant="outline"
              onClick={() => setAssignClientDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={assignClient}
              disabled={!selectedClientId || assignClientMutation.isPending}
            >
              {assignClientMutation.isPending ? "Asignando..." : "Asignar cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}