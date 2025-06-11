import React, { useState, useMemo, useEffect } from "react";
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
import { Plus, Search, Calendar, Clock, BarChart2, UserPlus, Trash2, LineChart, LineChartIcon, PenSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

// Definición de tipos (from original code)
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
  const { data: projects = [], refetch: refetchProjects, isFetching: isLoadingProjects } = useQuery<ActiveProject[]>({ 
    queryKey: ['/api/active-projects', { showSubprojects: false }],
    queryFn: async () => {
      // Consulta que solo devuelve proyectos principales (no subproyectos)
      const response = await fetch(`/api/active-projects?showSubprojects=false`);
      if (!response.ok) throw new Error('Error al cargar proyectos activos');
      return response.json();
    },
    refetchOnWindowFocus: true,
  });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ['/api/clients'] });
  const [deleteProjectId, setDeleteProjectId] = useState<number | null>(null);
  const [deleteMacroProjectId, setDeleteMacroProjectId] = useState<number | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [assignClientDialogOpen, setAssignClientDialogOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [expandedProjects, setExpandedProjects] = useState<{[key: number]: boolean}>({16: true}); // ID 16 es el proyecto macro MODO, inicialmente expandido
  const { toast } = useToast();
  
  // Consulta para obtener subproyectos de un proyecto específico
  const { data: subprojects = [], refetch: refetchSubprojects, isLoading: isLoadingSubprojects } = useQuery<ActiveProject[]>({
    queryKey: ['/api/active-projects/parent', expandedProjects],
    queryFn: async () => {
      // Obtener subproyectos solo para los proyectos expandidos
      const expandedIds = Object.keys(expandedProjects)
        .filter(id => expandedProjects[parseInt(id)])
        .map(id => parseInt(id));
      
      if (expandedIds.length === 0) return [];
      
      // Realizar consultas para todos los proyectos expandidos
      const allSubprojects: ActiveProject[] = [];
      
      for (const id of expandedIds) {
        try {
          const response = await fetch(`/api/active-projects/parent/${id}`);
          if (response.ok) {
            const data = await response.json();
            allSubprojects.push(...data);
          }
        } catch (error) {
          console.error(`Error al obtener subproyectos para el proyecto ${id}:`, error);
        }
      }
      
      return allSubprojects;
    },
    enabled: Object.values(expandedProjects).some(expanded => expanded),
  });
  
  // Función para desplegar o colapsar un proyecto
  const toggleProjectExpansion = (e: React.MouseEvent, projectId: number) => {
    e.stopPropagation(); // Evita que se active el onClick del tr
    setExpandedProjects(prev => {
      const newState = {
        ...prev,
        [projectId]: !prev[projectId]
      };
      
      // Refrescar subproyectos si es necesario
      if (newState[projectId]) {
        // Retrasamos la llamada para dar tiempo a que se actualice el estado
        setTimeout(() => {
          refetchSubprojects();
        }, 100);
      }
      
      return newState;
    });
  };

  // Mutation para asignar cliente a un proyecto
  const assignClientMutation = useMutation({
    mutationFn: ({ projectId, clientId }: { projectId: number; clientId: number }) => 
      apiRequest(`/api/active-projects/${projectId}/assign-client`, "PATCH", { clientId }),
    onSuccess: async () => {
      // Invalidar caché y forzar actualización
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

  const handleDeleteMacroProject = (projectId: number) => {
    setDeleteMacroProjectId(projectId);
    setDeleteConfirmationText("");
  };

  // Mutation para eliminar proyectos
  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: number) => {
      const response = await apiRequest(`/api/active-projects/${projectId}`, 'DELETE');
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Proyecto eliminado",
        description: "El proyecto ha sido eliminado correctamente.",
      });
      // Importante: invalidar la caché y forzar recarga de datos
      queryClient.invalidateQueries({ queryKey: ['/api/active-projects'] });
      // Cerrar el diálogo
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

  // Mutation para eliminar proyectos macro
  const deleteMacroProjectMutation = useMutation({
    mutationFn: async (projectId: number) => {
      const response = await apiRequest(`/api/active-projects/${projectId}`, 'DELETE');
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Proyecto macro eliminado",
        description: "El proyecto macro y todos sus subproyectos han sido eliminados correctamente.",
      });
      // Importante: invalidar la caché y forzar recarga de datos
      queryClient.invalidateQueries({ queryKey: ['/api/active-projects'] });
      // Cerrar el diálogo y limpiar estado
      setDeleteMacroProjectId(null);
      setDeleteConfirmationText("");
    },
    onError: (error) => {
      console.error('Error al eliminar el proyecto macro:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el proyecto macro. Inténtalo de nuevo más tarde.",
        variant: "destructive",
      });
    }
  });

  const confirmDelete = () => {
    if (!deleteProjectId) return;
    deleteProjectMutation.mutate(deleteProjectId);
  };

  const confirmDeleteMacro = () => {
    if (!deleteMacroProjectId || deleteConfirmationText !== "DELETE") return;
    deleteMacroProjectMutation.mutate(deleteMacroProjectId);
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

  // Estado para almacenar todos los proyectos visibles (proyectos principales + subproyectos)
  const [allVisibleProjects, setAllVisibleProjects] = useState<ActiveProject[]>([]);
  
  // Efecto para cargar subproyectos cuando se expande un proyecto
  useEffect(() => {
    const loadSubprojectsForExpandedProjects = async () => {
      // Primero empezamos con los proyectos principales
      const updatedProjects = [...projects];
      
      // Para cada proyecto expandido, cargamos sus subproyectos
      for (const projectId in expandedProjects) {
        if (expandedProjects[parseInt(projectId)]) {
          try {
            const response = await fetch(`/api/active-projects/parent/${projectId}`);
            
            if (response.ok) {
              const childProjects = await response.json();
              
              // Encontrar la posición del proyecto padre
              const parentIndex = updatedProjects.findIndex(p => p.id === parseInt(projectId));
              
              if (parentIndex !== -1) {
                // Insertar los subproyectos justo después del padre
                updatedProjects.splice(parentIndex + 1, 0, ...childProjects);
              }
            }
          } catch (error) {
            console.error(`Error cargando subproyectos para ID ${projectId}:`, error);
          }
        }
      }
      
      setAllVisibleProjects(updatedProjects);
    };
    
    loadSubprojectsForExpandedProjects();
  }, [projects, expandedProjects]);
  
  // Usamos allVisibleProjects en lugar de visibleProjects
  const visibleProjects = allVisibleProjects;

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
              {projects.length} proyectos
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
            {visibleProjects.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-2 py-4 text-center text-gray-500 text-xs">No hay proyectos</td>
              </tr>
            ) : (
              visibleProjects.map(project => (
                <tr 
                  key={project.id} 
                  className={`text-xs hover:bg-gray-50 cursor-pointer ${project.isAlwaysOnMacro ? 'bg-blue-50/50' : ''} ${project.parentProjectId ? 'pl-4' : ''}`}
                  onClick={() => setLocation(`/project-analytics/${project.id}`)}
                >
                  <td className="px-2 py-1.5 font-medium">
                    <div className="flex items-center">
                      {/* Botón para expandir/colapsar para proyectos macro */}
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
                          <span className="sr-only">
                            {expandedProjects[project.id] ? 'Colapsar' : 'Expandir'}
                          </span>
                        </Button>
                      )}
                    
                      {project.isAlwaysOnMacro && (
                        <Badge variant="outline" className="mr-2 bg-blue-100 text-blue-800 border-blue-200">
                          Always On
                        </Badge>
                      )}
                      {project.parentProjectId && (
                        <span className="text-gray-400 mr-1">└─</span>
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
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      ) : project.quotation?.client?.name ? (
                        <div className="h-5 w-5 bg-primary/10 rounded flex items-center justify-center flex-shrink-0">
                          <span className="text-[9px] font-medium text-primary">
                            {project.quotation.client.name.substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                      ) : null}
                      <span>{project.quotation?.client?.name || 'Cliente Desconocido'}</span>
                      {(!project.quotation?.client?.name || project.quotation?.client?.name === '') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                          onClick={(e) => openAssignClientDialog(e, project.id)}
                          title="Asignar cliente"
                        >
                          <UserPlus className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <Badge className={`text-[10px] py-0.5 ${project.status === 'active' ? 'bg-green-500 hover:bg-green-600' : ''}`}>
                      {project.status === 'active' ? 'Activo' : project.status === 'en_progreso' ? 'En progreso' : project.status}
                    </Badge>
                  </td>
                  <td className="px-2 py-1.5 text-gray-600">
                    {formatDate(project.startDate)}
                  </td>
                  <td className="px-2 py-1.5 text-gray-600">
                    {formatDate(project.expectedEndDate)}
                  </td>
                  <td className="px-2 py-1.5">
                    {project.trackingFrequency === "weekly" ? "Semanal" : 
                     project.trackingFrequency === "biweekly" ? "Quincenal" :
                     project.trackingFrequency === "monthly" ? "Mensual" : 
                     project.trackingFrequency}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/project-analytics/${project.id}`);
                        }}
                        title="Ver analíticas"
                      >
                        <LineChart className="h-3.5 w-3.5" />
                      </Button>
                      
                      {/* Botón para editar proyecto Always On (solo para proyectos macro) */}
                      {project.isAlwaysOnMacro && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/project-analytics/${project.id}?edit=true`);
                          }}
                          title="Editar Proyecto Always On"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                            <path d="M12 20h9"></path>
                            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                          </svg>
                        </Button>
                      )}
                      
                      {/* Botón para editar indicadores de robustez */}
                      {project.status !== 'cancelled' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              // Verificar si existe el indicador de robustez para este proyecto
                              const response = await fetch(`/api/deliverables/project/${project.id}`);
                              if (response.ok) {
                                const deliverable = await response.json();
                                if (deliverable && deliverable.id) {
                                  setLocation(`/edit-robustness/${deliverable.id}`);
                                } else {
                                  // No existe, crearlo
                                  const createResponse = await fetch('/api/deliverables', {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                      projectId: project.id,
                                      feedbackGeneral: 0,
                                      feedbackBrief: 0,
                                      feedbackAppliedMetrics: 0,
                                      feedbackDeliverables: 0,
                                      feedbackExecution: 0,
                                      feedbackRecommendations: 0,
                                      feedbackExtraValue: 0,
                                      feedbackScore: 0,
                                      title: `Indicadores para ${project.quotation?.projectName || 'Proyecto'}`
                                    }),
                                  });
                                  
                                  if (createResponse.ok) {
                                    const newDeliverable = await createResponse.json();
                                    setLocation(`/edit-robustness/${newDeliverable.id}`);
                                  } else {
                                    toast({
                                      title: "Error",
                                      description: "No se pudo crear un registro de indicadores",
                                      variant: "destructive",
                                    });
                                  }
                                }
                              }
                            } catch (error) {
                              console.error('Error al buscar el entregable:', error);
                              toast({
                                title: "Error",
                                description: "No se pudo acceder a los indicadores de robustez",
                                variant: "destructive",
                              });
                            }
                          }}
                          title="Editar Indicadores de Robustez"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                            <path d="M16 16v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1"></path>
                            <path d="m8 11 2 2 7-7"></path>
                          </svg>
                        </Button>
                      )}
                      
                      {/* Botón especial para proyectos macro Always-On */}
                      {project.isAlwaysOnMacro ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs font-medium border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMacroProject(project.id);
                          }}
                          title="Eliminar proyecto macro y todos sus subproyectos"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Eliminar Macro
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProject(project.id);
                          }}
                          title="Eliminar proyecto"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Diálogo de confirmación para eliminar */}
      <Dialog open={deleteProjectId !== null} onOpenChange={() => setDeleteProjectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro que deseas eliminar este proyecto? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteProjectId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación para eliminar proyecto macro */}
      <Dialog open={deleteMacroProjectId !== null} onOpenChange={() => {
        setDeleteMacroProjectId(null);
        setDeleteConfirmationText("");
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              ⚠️ Eliminar Proyecto Macro Always-On
            </DialogTitle>
            <DialogDescription className="space-y-3 text-left">
              <p className="font-medium">
                Estás a punto de eliminar el proyecto macro{" "}
                <span className="font-semibold text-red-700">
                  "{visibleProjects.find(p => p.id === deleteMacroProjectId)?.quotation?.projectName}"
                </span>{" "}
                y <strong>TODOS sus subproyectos asociados</strong>.
              </p>
              
              <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                <p className="font-semibold text-red-800 mb-2">Esta acción es IRREVERSIBLE y eliminará:</p>
                <ul className="list-disc list-inside text-red-700 space-y-1 text-sm">
                  <li>El proyecto macro y todos los subproyectos</li>
                  <li>Todas las entradas de tiempo registradas</li>
                  <li>Todos los informes de progreso</li>
                  <li>Las conversaciones de chat relacionadas</li>
                  <li>Todos los componentes y configuraciones</li>
                  <li>Las asignaciones de presupuesto</li>
                </ul>
              </div>
              
              <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                <p className="text-yellow-800 text-sm font-medium mb-2">
                  Para confirmar la eliminación, escribe <span className="font-bold">DELETE</span> en el campo de abajo:
                </p>
                <Input
                  value={deleteConfirmationText}
                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                  placeholder="Escribe DELETE para confirmar"
                  className="bg-white"
                />
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setDeleteMacroProjectId(null);
                setDeleteConfirmationText("");
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteMacro}
              disabled={deleteConfirmationText !== "DELETE" || deleteMacroProjectMutation.isPending}
            >
              {deleteMacroProjectMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  ELIMINAR PROYECTO COMPLETO
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para asignar cliente */}
      <Dialog open={assignClientDialogOpen} onOpenChange={setAssignClientDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar cliente al proyecto</DialogTitle>
            <DialogDescription>
              Selecciona un cliente para asociarlo con este proyecto.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map(client => (
                  <SelectItem key={client.id} value={client.id.toString()}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignClientDialogOpen(false)}>Cancelar</Button>
            <Button onClick={assignClient}>Asignar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}