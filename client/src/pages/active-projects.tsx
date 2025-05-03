import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  CalendarIcon, 
  Clock, 
  LineChart, 
  ListChecks, 
  Loader2, 
  PlusCircle, 
  Search,
  FileText
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Definición de tipos
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

// Componente principal
const ActiveProjects: React.FC = () => {
  const [, setLocation] = useLocation();
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("all");

  // Obtener clientes
  const { data: clients, isLoading: isLoadingClients } = useQuery({
    queryKey: ["/api/clients"],
  });

  // Obtener proyectos activos
  const { data: projects, isLoading: isLoadingProjects } = useQuery<ActiveProject[]>({
    queryKey: ["/api/active-projects"],
    enabled: activeTab === "all" || !selectedClient,
  });

  // Obtener proyectos activos por cliente
  const { data: clientProjects, isLoading: isLoadingClientProjects } = useQuery<ActiveProject[]>({
    queryKey: ["/api/active-projects/client", selectedClient],
    enabled: !!selectedClient && activeTab !== "all",
  });

  // Filtrar proyectos según pestaña activa y búsqueda
  const filteredProjects = React.useMemo(() => {
    let filtered = selectedClient && selectedClient !== "all" && activeTab !== "all" 
      ? clientProjects || [] 
      : projects || [];

    if (activeTab !== "all" && activeTab !== "by-client") {
      filtered = filtered.filter(project => project.status === activeTab);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        project =>
          project.quotation?.projectName.toLowerCase().includes(query) ||
          project.notes?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [projects, clientProjects, selectedClient, activeTab, searchQuery]);

  // Función para renderizar el badge de estado del proyecto
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500 hover:bg-green-600">Activo</Badge>;
      case "completed":
        return <Badge className="bg-blue-500 hover:bg-blue-600">Completado</Badge>;
      case "cancelled":
        return <Badge className="bg-red-500 hover:bg-red-600">Cancelado</Badge>;
      case "on-hold":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">En Pausa</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Función para renderizar la frecuencia de seguimiento
  const getTrackingFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case "daily":
        return "Diario";
      case "weekly":
        return "Semanal";
      case "biweekly":
        return "Quincenal";
      case "monthly":
        return "Mensual";
      default:
        return frequency;
    }
  };

  // Función para formatear fechas
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return format(new Date(dateString), "dd MMM yyyy", { locale: es });
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center h-16 px-4 border-b border-neutral-200 bg-white">
        <h2 className="text-subheading text-neutral-900">Proyectos Activos</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="container-xl fade-in">
          <div className="section-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-section">
              <h1 className="text-display text-balance text-neutral-900">Gestión de Proyectos</h1>
              <Button className="mt-4 sm:mt-0 hover-lift" onClick={() => setLocation("/active-projects/new")}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Nuevo Proyecto
              </Button>
            </div>

            <div className="mb-section">
              {/* Filtros y búsqueda */}
              <Card className="shadow-soft mb-6">
                <CardHeader className="pb-3">
                  <CardTitle className="text-heading">Filtros</CardTitle>
                  <CardDescription>
                    Refina los proyectos que deseas visualizar
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row gap-4 form-group">
                    <div className="relative flex-grow form-group">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" size={18} />
                        <Input
                          placeholder="Buscar proyectos..."
                          className="pl-10"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="w-full sm:w-[200px]">
                      <Select
                        value={selectedClient}
                        onValueChange={setSelectedClient}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Filtrar por cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los clientes</SelectItem>
                          {!isLoadingClients &&
                            clients?.map((client: Client) => (
                              <SelectItem key={client.id} value={client.id.toString()}>
                                {client.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tabs y tabla de proyectos */}
              <Card className="shadow-soft">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-heading">Proyectos en Ejecución</CardTitle>
                  <Tabs
                    defaultValue="all"
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className="w-full max-w-xl"
                  >
                    <TabsList className="grid grid-cols-5 w-full">
                      <TabsTrigger value="all">Todos</TabsTrigger>
                      <TabsTrigger value="active">Activos</TabsTrigger>
                      <TabsTrigger value="on-hold">En Pausa</TabsTrigger>
                      <TabsTrigger value="completed">Completados</TabsTrigger>
                      <TabsTrigger value="by-client">Por Cliente</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </CardHeader>
                
                <CardContent className="p-0">
                  <div className="rounded-md">
                    {(isLoadingProjects || isLoadingClientProjects) ? (
                      <div className="flex justify-center items-center h-[300px]">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : filteredProjects.length === 0 ? (
                      <div className="flex flex-col justify-center items-center h-[300px] text-center px-4">
                        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-heading">No hay proyectos</h3>
                        <p className="text-neutral-500 mt-2 max-w-md">
                          {searchQuery
                            ? "No se encontraron proyectos que coincidan con tu búsqueda. Intenta con otros términos."
                            : activeTab !== "all"
                            ? `No hay proyectos ${
                                activeTab === "by-client" ? "para este cliente" : "en este estado"
                              }.`
                            : "No hay proyectos activos en el sistema. Crea uno nuevo para comenzar."}
                        </p>
                        {!searchQuery && activeTab === "all" && (
                          <Button
                            className="mt-4 hover-lift"
                            onClick={() => setLocation("/active-projects/new")}
                          >
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Nuevo Proyecto
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-label">Proyecto</TableHead>
                              <TableHead className="text-label">Cliente</TableHead>
                              <TableHead className="text-label">Estado</TableHead>
                              <TableHead className="text-label">Inicio</TableHead>
                              <TableHead className="text-label">Fin Esperado</TableHead>
                              <TableHead className="text-label">Seguimiento</TableHead>
                              <TableHead className="text-label">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredProjects.map((project) => (
                              <TableRow key={project.id} className="hover:bg-neutral-50 transition-colors">
                                <TableCell className="font-medium text-neutral-900">
                                  {project.quotation?.projectName}
                                </TableCell>
                                <TableCell className="text-neutral-700">
                                  {clients?.find(
                                    (c: Client) => c.id === project.quotation?.clientId
                                  )?.name || "Cliente Desconocido"}
                                </TableCell>
                                <TableCell>
                                  {project.status === 'active' && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-caption font-medium bg-success/10 text-success-dark">
                                      Activo
                                    </span>
                                  )}
                                  {project.status === 'on-hold' && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-caption font-medium bg-warning/10 text-warning-dark">
                                      En Pausa
                                    </span>
                                  )}
                                  {project.status === 'completed' && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-caption font-medium bg-primary/10 text-primary-dark">
                                      Completado
                                    </span>
                                  )}
                                  {project.status === 'cancelled' && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-caption font-medium bg-error/10 text-error-dark">
                                      Cancelado
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-neutral-700">
                                  <div className="flex items-center">
                                    <CalendarIcon className="mr-2 h-4 w-4 text-neutral-400" />
                                    {formatDate(project.startDate)}
                                  </div>
                                </TableCell>
                                <TableCell className="text-neutral-700">
                                  <div className="flex items-center">
                                    <CalendarIcon className="mr-2 h-4 w-4 text-neutral-400" />
                                    {formatDate(project.expectedEndDate)}
                                  </div>
                                </TableCell>
                                <TableCell className="text-neutral-700">
                                  {getTrackingFrequencyLabel(project.trackingFrequency)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex space-x-2">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="hover-lift"
                                            onClick={() => setLocation(`/project-summary/${project.id}`)}
                                          >
                                            <FileText className="h-4 w-4" />
                                            <span className="sr-only">Ver Detalles</span>
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Ver Detalles del Proyecto</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                    
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="hover-lift"
                                            onClick={() => setLocation(`/active-projects/${project.id}/time-entries`)}
                                          >
                                            <Clock className="h-4 w-4" />
                                            <span className="sr-only">Registrar Horas</span>
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Registrar Horas de Trabajo</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                    
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="hover-lift"
                                            onClick={() => setLocation(`/project-summary/${project.id}`)}
                                          >
                                            <LineChart className="h-4 w-4" />
                                            <span className="sr-only">Estadísticas</span>
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Ver Estadísticas del Proyecto</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActiveProjects;