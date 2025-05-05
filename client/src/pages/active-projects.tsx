import React from "react";
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
import { Plus, Search, Calendar, Clock, BarChart2, UserPlus, Trash2 } from "lucide-react";
import { useState } from "react";
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
}

interface Quotation {
  id: number;
  clientId: number;
  projectName: string;
  status: string;
  totalAmount: number;
  analysisType: string;
  projectType: string;
  client?: Client; // Added client property for easier access
  clientName?: string; // Added clientName property for fallback
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
  quotation: Quotation;
}


export default function ActiveProjects() {
  const [, setLocation] = useLocation();
  const { data: projects = [], refetch: refetchProjects } = useQuery<ActiveProject[]>({ queryKey: ['/api/active-projects'] });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ['/api/clients'] });
  const [deleteProjectId, setDeleteProjectId] = useState<number | null>(null);
  const [assignClientDialogOpen, setAssignClientDialogOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const { toast } = useToast();

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

  const confirmDelete = async () => {
    if (!deleteProjectId) return;
    
    try {
      await apiRequest('DELETE', `/api/active-projects/${deleteProjectId}`);
      toast({
        title: "Éxito",
        description: "El proyecto ha sido eliminado correctamente.",
      });
      await refetchProjects();
      setDeleteProjectId(null);
    } catch (error) {
      console.error('Error al eliminar el proyecto:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el proyecto. Inténtalo de nuevo más tarde.",
        variant: "destructive",
      });
    }
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
                  <SelectItem key={client.id} value={client.id.toString()}>{client.name}</SelectItem>
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
            {projects.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-2 py-4 text-center text-gray-500 text-xs">No hay proyectos</td>
              </tr>
            ) : projects.map((project) => (
              <tr 
                key={project.id} 
                className="text-xs hover:bg-gray-50 cursor-pointer"
                onClick={() => setLocation(`/project-summary/${project.id}`)}
              >
                <td className="px-2 py-1.5 font-medium">{project.quotation?.projectName || '-'}</td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1">
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
                    {project.status === 'active' ? 'Activo' : project.status}
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
                      onClick={() => setLocation(`/project-summary/${project.id}`)}
                      title="Ver resumen del proyecto"
                    >
                      <BarChart2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`/active-projects/${project.id}/time-entries`);
                      }}
                      title="Gestión de horas"
                    >
                      <Clock className="h-3.5 w-3.5" />
                    </Button>
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
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Diálogo de confirmación para eliminar */}
      <Dialog open={deleteProjectId !== null} onOpenChange={() => setDeleteProjectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar este proyecto? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteProjectId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para asignar cliente a una cotización */}
      <Dialog open={assignClientDialogOpen} onOpenChange={setAssignClientDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar Cliente al Proyecto</DialogTitle>
            <DialogDescription>
              Selecciona un cliente para asignar a este proyecto sin cliente.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4">
            <Select
              value={selectedClientId}
              onValueChange={setSelectedClientId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id.toString()}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignClientDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={assignClient}
              disabled={assignClientMutation.isPending || !selectedClientId}
            >
              {assignClientMutation.isPending ? "Asignando..." : "Asignar Cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}