import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Plus, Search, Calendar, Clock, ArrowUpDown, Trash2 } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { es } from "date-fns/locale";

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
  const { data: projects = [], refetch: refetchProjects } = useQuery({ queryKey: ['/api/active-projects'] });
  const { data: clients = [] } = useQuery({ queryKey: ['/api/clients'] });
  const [deleteProjectId, setDeleteProjectId] = useState<number | null>(null);

  const handleDeleteProject = (projectId: number) => {
    setDeleteProjectId(projectId);
  };

  const confirmDelete = async () => {
    if (!deleteProjectId) return;
    
    try {
      await apiRequest(`/api/active-projects/${deleteProjectId}`, 'DELETE');
      await refetchProjects();
      setDeleteProjectId(null);
    } catch (error) {
      console.error('Error al eliminar el proyecto:', error);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return format(new Date(dateString), "dd MMM yyyy", { locale: es });
  };


  return (
    <div className="p-4 space-y-4">
      {/* Header más compacto */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Gestión de Proyectos</h1>
        <Button
          onClick={() => setLocation("/projects/new")}
          size="sm"
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4 mr-1" />
          Nuevo Proyecto
        </Button>
      </div>

      {/* Filtros más compactos */}
      <div className="bg-white rounded-lg shadow-sm border p-3">
        <div className="flex gap-3 items-center">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Buscar proyectos..."
                className="pl-9 h-9"
              />
            </div>
          </div>
          <Select defaultValue="all" className="w-48 h-9">
            <option value="all">Todos los clientes</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </Select>
        </div>
      </div>

      {/* Tabla de proyectos más compacta */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b bg-gray-50">
          <h2 className="text-sm font-medium">Proyectos en Ejecución</h2>
        </div>

        <table className="w-full">
          <thead>
            <tr className="text-xs text-gray-500 bg-gray-50">
              <th className="px-4 py-2 text-left font-medium">Proyecto</th>
              <th className="px-4 py-2 text-left font-medium">Cliente</th>
              <th className="px-4 py-2 text-left font-medium">Estado</th>
              <th className="px-4 py-2 text-left font-medium">Inicio</th>
              <th className="px-4 py-2 text-left font-medium">Fin Esperado</th>
              <th className="px-4 py-2 text-left font-medium">Seguimiento</th>
              <th className="px-4 py-2 text-left font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {projects.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No hay proyectos</td>
              </tr>
            ) : projects.map((project) => (
              <tr 
                key={project.id} 
                className="text-sm hover:bg-gray-50 cursor-pointer"
                onClick={() => setLocation(`/project-summary/${project.id}`)}
              >
                <td className="px-4 py-2">{project.quotation?.projectName || '-'}</td>
                <td className="px-4 py-2">{project.quotation?.client?.name || project.quotation?.clientName || 'Cliente Desconocido'}</td>
                <td className="px-4 py-2">
                  <Badge className={project.status === 'active' ? 'bg-green-500 hover:bg-green-600' : ''}>
                    {project.status === 'active' ? 'Activo' : project.status}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-gray-600">
                  {formatDate(project.startDate)}
                </td>
                <td className="px-4 py-2 text-gray-600">
                  {formatDate(project.expectedEndDate)}
                </td>
                <td className="px-4 py-2">{project.trackingFrequency}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setLocation(`/project-summary/${project.id}`)}
                      title="Ver resumen del proyecto"
                    >
                      <ArrowUpDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`/projects/${project.id}/time-entries`);
                      }}
                      title="Gestión de horas"
                    >
                      <Clock className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDeleteProject(project.id)}
                      title="Eliminar proyecto"
                    >
                      <Trash2 className="h-4 w-4" />
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
    </div>
  );
}