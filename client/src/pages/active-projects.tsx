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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { Plus, Search, Calendar, Clock, BarChart2, UserPlus, Trash2, LineChart, PenSquare, Building2, Zap, Target, DollarSign } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterClient, setFilterClient] = useState("all");
  const [sortBy, setSortBy] = useState("recent");

  const { data: projects = [], refetch: refetchProjects, isFetching: isLoadingProjects } = useQuery<ActiveProject[]>({ 
    queryKey: ['/api/active-projects', { showSubprojects: false }],
    queryFn: async () => {
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
  const [deleteAllProjectsDialogOpen, setDeleteAllProjectsDialogOpen] = useState(false);
  const [deleteAllConfirmationText, setDeleteAllConfirmationText] = useState("");
  const [assignClientDialogOpen, setAssignClientDialogOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [expandedProjects, setExpandedProjects] = useState<{[key: number]: boolean}>({});
  const [deletingProjects, setDeletingProjects] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  // Consulta para obtener subproyectos
  const { data: subprojects = [], refetch: refetchSubprojects } = useQuery<ActiveProject[]>({
    queryKey: ['/api/active-projects/parent', expandedProjects],
    queryFn: async () => {
      const expandedIds = Object.keys(expandedProjects)
        .filter(id => expandedProjects[parseInt(id)])
        .map(id => parseInt(id));

      if (expandedIds.length === 0) return [];

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

  // Filtrar proyectos según el tab activo
  const filteredProjects = useMemo(() => {
    if (!projects) return [];

    let filtered = projects;

    // Filtrar por tipo de proyecto según el tab
    switch (activeTab) {
      case "always-on":
        filtered = projects.filter(p => 
          p.isAlwaysOnMacro || 
          p.quotation?.projectName?.toLowerCase().includes('always-on') ||
          p.quotation?.projectName?.toLowerCase().includes('modo') ||
          p.macroMonthlyBudget ||
          (p.quotation?.projectName?.toLowerCase().includes('presupuesto') && p.quotation?.projectName?.toLowerCase().includes('global'))
        );
        break;
      case "unicos":
        filtered = projects.filter(p => 
          !p.isAlwaysOnMacro && 
          !p.quotation?.projectName?.toLowerCase().includes('always-on') &&
          !p.quotation?.projectName?.toLowerCase().includes('modo') &&
          !p.macroMonthlyBudget &&
          !(p.quotation?.projectName?.toLowerCase().includes('presupuesto') && p.quotation?.projectName?.toLowerCase().includes('global'))
        );
        break;
      case "completados":
        filtered = projects.filter(p => p.status === 'completed' || p.status === 'cancelled');
        break;
      default: // "todos"
        filtered = projects;
    }

    // Aplicar filtros adicionales
    filtered = filtered.filter(project => {
      const client = clients.find(c => c.id === project.quotation?.clientId);
      const projectName = project.quotation?.projectName || "";
      const clientName = client?.name || "";

      const matchesSearch = searchTerm === "" || 
        projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        clientName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesClient = filterClient === "all" || project.quotation?.clientId?.toString() === filterClient;

      return matchesSearch && matchesClient;
    });

    // Ordenar
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return (a.quotation?.projectName || "").localeCompare(b.quotation?.projectName || "");
        case "client":
          const clientA = clients.find(c => c.id === a.quotation?.clientId)?.name || "";
          const clientB = clients.find(c => c.id === b.quotation?.clientId)?.name || "";
          return clientA.localeCompare(clientB);
        case "budget":
          return (b.quotation?.totalAmount || 0) - (a.quotation?.totalAmount || 0);
        case "recent":
        default:
          return new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime();
      }
    });
  }, [projects, clients, activeTab, searchTerm, filterClient, sortBy]);

  // Estadísticas por tipo
  const stats = useMemo(() => {
    if (!projects) return { total: 0, alwaysOn: 0, unicos: 0, completados: 0 };

    const alwaysOn = projects.filter(p => 
      p.isAlwaysOnMacro || 
      p.quotation?.projectName?.toLowerCase().includes('always-on') ||
      p.quotation?.projectName?.toLowerCase().includes('modo') ||
      p.macroMonthlyBudget ||
      (p.quotation?.projectName?.toLowerCase().includes('presupuesto') && p.quotation?.projectName?.toLowerCase().includes('global'))
    ).length;

    const completados = projects.filter(p => p.status === 'completed' || p.status === 'cancelled').length;
    const unicos = projects.length - alwaysOn - completados;

    return {
      total: projects.length,
      alwaysOn,
      unicos,
      completados
    };
  }, [projects]);

  // Mutation para asignar cliente
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

    // Mutación para eliminar todos los proyectos activos
    const deleteAllProjectsMutation = useMutation({
      mutationFn: async () => {
        const response = await apiRequest("/api/active-projects", "DELETE");
        return response;
      },
      onSuccess: async (data) => {
        await queryClient.invalidateQueries({ queryKey: ['/api/active-projects'] });
        await refetchProjects();
        toast({
          title: "Éxito",
          description: `Se eliminaron ${data.deletedCount} proyectos correctamente.`,
        });
        setDeleteAllProjectsDialogOpen(false);
        setDeleteAllConfirmationText("");
      },
      onError: (error) => {
        console.error('Error al eliminar todos los proyectos:', error);
        toast({
          title: "Error",
          description: "No se pudieron eliminar todos los proyectos. Inténtalo de nuevo más tarde.",
          variant: "destructive",
        });
      }
    });

  // Mutation para eliminar proyecto
  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: number) => {
      const response = await fetch(`/api/active-projects/${projectId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Error al eliminar el proyecto';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = `Error ${response.status}: ${errorText || 'Error desconocido'}`;
        }
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onMutate: async (projectId) => {
      await queryClient.cancelQueries({ queryKey: ['/api/active-projects'] });
      setDeletingProjects(prev => new Set([...prev, projectId]));
      return { projectId };
    },
    onSuccess: async (data, projectId) => {
      setDeletingProjects(prev => {
        const newSet = new Set(prev);
        newSet.delete(projectId);
        return newSet;
      });

      toast({
        title: "Proyecto eliminado",
        description: "El proyecto ha sido eliminado correctamente.",
      });

      setDeleteProjectId(null);
      setDeleteConfirmationText("");

      await queryClient.invalidateQueries({ queryKey: ['/api/active-projects'] });
      await refetchProjects();
      await refetchSubprojects();
    },
    onError: (error, projectId) => {
      setDeletingProjects(prev => {
        const newSet = new Set(prev);
        newSet.delete(projectId);
        return newSet;
      });

      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo eliminar el proyecto.",
        variant: "destructive",
      });

      setDeleteProjectId(null);
      setDeleteConfirmationText("");
    }
  });

  // Mutation para eliminar proyecto macro
  const deleteMacroProjectMutation = useMutation({
    mutationFn: async (projectId: number) => {
      const response = await fetch(`/api/active-projects/${projectId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
        throw new Error(errorData.message || 'Error al eliminar el proyecto macro');
      }

      return response.json();
    },
    onMutate: async (projectId) => {
      await queryClient.cancelQueries({ queryKey: ['/api/active-projects'] });
      setDeletingProjects(prev => new Set([...prev, projectId]));
      return { projectId };
    },
    onSuccess: async (data, projectId) => {
      await new Promise(resolve => setTimeout(resolve, 800));

      setDeletingProjects(prev => {
        const newSet = new Set(prev);
        newSet.delete(projectId);
        return newSet;
      });

      toast({
        title: "Proyecto macro eliminado",
        description: "El proyecto macro y todos sus subproyectos han sido eliminados correctamente.",
      });

      await queryClient.invalidateQueries({ queryKey: ['/api/active-projects'] });
      await refetchProjects();
      await refetchSubprojects();

      setDeleteMacroProjectId(null);
      setDeleteConfirmationText("");
    },
    onError: (error, projectId) => {
      setDeletingProjects(prev => {
        const newSet = new Set(prev);
        newSet.delete(projectId);
        return newSet;
      });

      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo eliminar el proyecto macro.",
        variant: "destructive",
      });

      setDeleteMacroProjectId(null);
      setDeleteConfirmationText("");
    }
  });

  const toggleProjectExpansion = (e: React.MouseEvent, projectId: number) => {
    e.stopPropagation();
    setExpandedProjects(prev => {
      const newState = {
        ...prev,
        [projectId]: !prev[projectId]
      };

      if (newState[projectId]) {
        setTimeout(() => {
          refetchSubprojects();
        }, 100);
      }

      return newState;
    });
  };

  const handleDeleteProject = (e: React.MouseEvent, projectId: number) => {
    e.stopPropagation();
    setDeleteProjectId(projectId);
  };

  const handleDeleteMacroProject = (e: React.MouseEvent, projectId: number) => {
    e.stopPropagation();
    setDeleteMacroProjectId(projectId);
  };

  const confirmDelete = () => {
    if (!deleteProjectId) return;
    deleteProjectMutation.mutate(deleteProjectId);
  };

  const confirmDeleteMacro = () => {
    if (!deleteMacroProjectId || deleteConfirmationText !== "DELETE") return;
    deleteMacroProjectMutation.mutate(deleteMacroProjectId);
  };

    const confirmDeleteAllProjects = () => {
      if (deleteAllConfirmationText !== "ELIMINAR TODO") return;
      deleteAllProjectsMutation.mutate();
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

  // Estado para proyectos visibles (principales + subproyectos expandidos)
  const [allVisibleProjects, setAllVisibleProjects] = useState<ActiveProject[]>([]);

  useEffect(() => {
    const loadSubprojectsForExpandedProjects = async () => {
      const updatedProjects = [...filteredProjects];

      for (const projectId in expandedProjects) {
        if (expandedProjects[parseInt(projectId)]) {
          try {
            const response = await fetch(`/api/active-projects/parent/${projectId}`);
            if (response.ok) {
              const childProjects = await response.json();
              const parentIndex = updatedProjects.findIndex(p => p.id === parseInt(projectId));
              if (parentIndex !== -1) {
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
  }, [filteredProjects, expandedProjects]);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Proyectos</h1>
          <p className="text-gray-600 mt-1">Administra todos tus proyectos desde un solo lugar</p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => setDeleteAllProjectsDialogOpen(true)}
            size="sm"
            variant="destructive"
            className="h-8 text-xs"
            disabled={!projects || projects.length === 0}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Limpiar Todo
          </Button>
          <Button
            onClick={() => setLocation("/active-projects/new")}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Proyecto
          </Button>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-blue-900">{stats.total}</div>
              <div className="text-sm text-blue-700">Total Proyectos</div>
            </div>
            <Building2 className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-purple-900">{stats.alwaysOn}</div>
              <div className="text-sm text-purple-700">Always-On</div>
            </div>
            <Zap className="h-8 w-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-green-900">{stats.unicos}</div>
              <div className="text-sm text-green-700">Únicos</div>
            </div>
            <Target className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.completados}</div>
              <div className="text-sm text-gray-700">Completados</div>
            </div>
            <Clock className="h-8 w-8 text-gray-600" />
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-4 items-center bg-white p-4 rounded-lg border">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar proyectos o clientes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos los clientes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {clients.map((client: Client) => (
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
          </SelectContent>
        </Select>
      </div>

      {/* Tabs por tipo de proyecto */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="todos" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Todos ({stats.total})
          </TabsTrigger>
          <TabsTrigger value="always-on" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Always-On ({stats.alwaysOn})
          </TabsTrigger>
          <TabsTrigger value="unicos" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Únicos ({stats.unicos})
          </TabsTrigger>
          <TabsTrigger value="completados" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Completados ({stats.completados})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium">Proyecto</th>
                  <th className="px-4 py-3 text-left font-medium">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  <th className="px-4 py-3 text-left font-medium">Presupuesto</th>
                  <th className="px-4 py-3 text-left font-medium">Inicio</th>
                  <th className="px-4 py-3 text-left font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {allVisibleProjects.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      {activeTab === "todos" && "No hay proyectos"}
                      {activeTab === "always-on" && "No hay proyectos Always-On"}
                      {activeTab === "unicos" && "No hay proyectos únicos"}
                      {activeTab === "completados" && "No hay proyectos completados"}
                    </td>
                  </tr>
                ) : (
                  allVisibleProjects.map(project => {
                    const client = clients.find(c => c.id === project.quotation?.clientId);
                    const isAlwaysOn = project.isAlwaysOnMacro || 
                      project.quotation?.projectName?.toLowerCase().includes('always-on') ||
                      project.quotation?.projectName?.toLowerCase().includes('modo') ||
                      project.macroMonthlyBudget ||
                      (project.quotation?.projectName?.toLowerCase().includes('presupuesto') && project.quotation?.projectName?.toLowerCase().includes('global'));

                    return (
                      <tr 
                        key={project.id} 
                        className={`text-sm hover:bg-gray-50 cursor-pointer transition-all duration-700 ease-out transform ${
                          isAlwaysOn ? 'bg-blue-50/30' : ''
                        } ${
                          project.parentProjectId ? 'bg-gray-50' : ''
                        } ${
                          deletingProjects.has(project.id) 
                            ? 'opacity-0 scale-95 -translate-x-4 bg-red-50 border-red-200 pointer-events-none' 
                            : 'opacity-100 scale-100 translate-x-0'
                        }`}
                        onClick={() => !deletingProjects.has(project.id) && setLocation(`/project-analytics/${project.id}`)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isAlwaysOn && !project.parentProjectId && (
                              <Button 
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-blue-600"
                                onClick={(e) => toggleProjectExpansion(e, project.id)}
                              >
                                {expandedProjects[project.id] ? '−' : '+'}
                              </Button>
                            )}
                            {project.parentProjectId && (
                              <span className="text-gray-400 ml-4">└─</span>
                            )}
                            <span className="font-medium">
                              {project.quotation?.projectName || 'Proyecto sin nombre'}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {client?.logoUrl ? (
                              <img 
                                src={client.logoUrl} 
                                alt={`${client.name} logo`} 
                                className="h-6 w-6 rounded object-contain"
                              />
                            ) : (
                              <div className="h-6 w-6 bg-gray-200 rounded flex items-center justify-center">
                                <span className="text-xs font-medium">
                                  {client?.name?.substring(0, 2).toUpperCase() || '??'}
                                </span>
                              </div>
                            )}
                            <span>{client?.name || 'Cliente Desconocido'}</span>
                            {(!client?.name || client?.name === '') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 text-indigo-600"
                                onClick={(e) => openAssignClientDialog(e, project.id)}
                                title="Asignar cliente"
                              >
                                <UserPlus className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          {isAlwaysOn ? (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                              <Zap className="h-3 w-3 mr-1" />
                              Always-On
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <Target className="h-3 w-3 mr-1" />
                              Único
                            </Badge>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <Badge className={`text-xs ${
                            project.status === 'active' ? 'bg-green-500 hover:bg-green-600' : 
                            project.status === 'completed' ? 'bg-blue-500 hover:bg-blue-600' :
                            project.status === 'cancelled' ? 'bg-red-500 hover:bg-red-600' :
                            'bg-gray-500 hover:bg-gray-600'
                          }`}>
                            {project.status === 'active' ? 'Activo' : 
                             project.status === 'completed' ? 'Completado' :
                             project.status === 'cancelled' ? 'Cancelado' :
                             project.status}
                          </Badge>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-gray-500" />
                            <span className="font-medium">
                              {isAlwaysOn && project.macroMonthlyBudget ? 
                                `${project.macroMonthlyBudget.toLocaleString()}/mes` :
                                (project.quotation?.totalAmount || 0).toLocaleString()
                              }
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-gray-600">
                          {formatDate(project.startDate)}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLocation(`/project-analytics/${project.id}`);
                              }}
                              title="Ver analíticas"
                            >
                              <LineChart className="h-3.5 w-3.5" />
                            </Button>

                            {isAlwaysOn && project.isAlwaysOnMacro ? (
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-7 px-2 text-xs bg-red-600 hover:bg-red-700"
                                onClick={(e) => handleDeleteMacroProject(e, project.id)}
                                disabled={deletingProjects.has(project.id)}
                                title="Eliminar proyecto macro"
                              >
                                {deletingProjects.has(project.id) ? (
                                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={(e) => handleDeleteProject(e, project.id)}
                                disabled={deletingProjects.has(project.id)}
                                title="Eliminar proyecto"
                              >
                                {deletingProjects.has(project.id) ? (
                                  <div className="w-3.5 h-3.5 border border-red-500 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Diálogos */}
      <Dialog open={deleteProjectId !== null} onOpenChange={(open) => {
        if (!open && !deleteProjectMutation.isPending) {
          setDeleteProjectId(null);
          setDeleteConfirmationText("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro que deseas eliminar este proyecto? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setDeleteProjectId(null);
                setDeleteConfirmationText("");
              }}
              disabled={deleteProjectMutation.isPending}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDelete}
              disabled={deleteProjectMutation.isPending}
            >
              {deleteProjectMutation.isPending ? (
                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Eliminando...
                </>
              ) : (
                "Eliminar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  "{allVisibleProjects.find(p => p.id === deleteMacroProjectId)?.quotation?.projectName}"
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

            {/* Diálogo para confirmar eliminación de todos los proyectos */}
            <Dialog open={deleteAllProjectsDialogOpen} onOpenChange={setDeleteAllProjectsDialogOpen}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle className="text-red-600">⚠️ Eliminar Todos los Proyectos</DialogTitle>
                  <DialogDescription className="space-y-3">
                    <p>
                      <strong>Esta acción eliminará TODOS los proyectos activos del sistema, incluyendo:</strong>
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li>Todos los proyectos macro (Always-On)</li>
                      <li>Todos los subproyectos asociados</li>
                      <li>Todas las plantillas recurrentes</li>
                      <li>Todos los registros de tiempo</li>
                      <li>Todos los reportes de progreso</li>
                      <li>Todos los entregables</li>
                    </ul>
                    <p className="text-red-600 font-medium">
                      Esta acción NO se puede deshacer. Se perderán todos los datos permanentemente.
                    </p>
                    <p>
                      Para confirmar, escribe exactamente: <code className="bg-gray-100 px-2 py-1 rounded">ELIMINAR TODO</code>
                    </p>
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    value={deleteAllConfirmationText}
                    onChange={(e) => setDeleteAllConfirmationText(e.target.value)}
                    placeholder="Escribe 'ELIMINAR TODO' para confirmar"
                    className="text-center"
                  />
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDeleteAllProjectsDialogOpen(false);
                      setDeleteAllConfirmationText("");
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={confirmDeleteAllProjects}
                    disabled={deleteAllConfirmationText !== "ELIMINAR TODO" || deleteAllProjectsMutation.isPending}
                  >
                    {deleteAllProjectsMutation.isPending ? "Eliminando..." : "Eliminar Todo"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

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