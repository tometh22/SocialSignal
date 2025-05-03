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
import { EnhancedTable } from "@/components/ui/enhanced-table";
import { getStatusBadgeForProject } from "@/components/ui/status-badge";
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
              <h1 className="text-display text-balance text-neutral-900 slide-in">Gestión de Proyectos</h1>
              <Button 
                className="mt-4 sm:mt-0 hover-lift shadow-soft hover:shadow-medium transition-all slide-in" 
                onClick={() => setLocation("/active-projects/new")}
                size="lg"
              >
                <PlusCircle className="mr-2 h-5 w-5" />
                Nuevo Proyecto
              </Button>
            </div>

            <div className="mb-section">
              {/* Filtros y búsqueda */}
              <Card className="glass-card shadow-medium mb-6 scale-in">
                <CardHeader className="pb-3 border-b border-white/10">
                  <CardTitle className="text-heading flex items-center">
                    <span className="bg-primary/20 p-2 rounded-full mr-2">
                      <Search className="h-5 w-5 text-primary" />
                    </span>
                    Filtros
                  </CardTitle>
                  <CardDescription>
                    Refina los proyectos que deseas visualizar
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row gap-4 form-group slide-in">
                    <div className="relative flex-grow form-group">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" size={18} />
                        <Input
                          placeholder="Buscar proyectos..."
                          className="pl-10 shadow-soft focus:shadow-medium transition-shadow"
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
                        <SelectTrigger className="hover-lift shadow-soft">
                          <SelectValue placeholder="Filtrar por cliente" />
                        </SelectTrigger>
                        <SelectContent className="glass-light backdrop-blur-md border border-white/20">
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
              <Card className="glass-card shadow-medium scale-in">
                <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-white/10">
                  <CardTitle className="text-heading flex items-center">
                    <span className="bg-accent/20 p-2 rounded-full mr-2">
                      <ListChecks className="h-5 w-5 text-accent" />
                    </span>
                    Proyectos en Ejecución
                  </CardTitle>
                  <Tabs
                    defaultValue="all"
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className="w-full max-w-xl"
                  >
                    <TabsList className="grid grid-cols-5 w-full glass-panel">
                      <TabsTrigger value="all" className="hover-lift">Todos</TabsTrigger>
                      <TabsTrigger value="active" className="hover-lift">Activos</TabsTrigger>
                      <TabsTrigger value="on-hold" className="hover-lift">En Pausa</TabsTrigger>
                      <TabsTrigger value="completed" className="hover-lift">Completados</TabsTrigger>
                      <TabsTrigger value="by-client" className="hover-lift">Por Cliente</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </CardHeader>
                
                <CardContent className="p-0">
                  <div className="rounded-md">
                    {(isLoadingProjects || isLoadingClientProjects) ? (
                      <div className="flex justify-center items-center h-[300px] scale-in">
                        <div className="glass-pill p-8 rounded-xl shadow-medium flex flex-col items-center">
                          <div className="bg-primary/10 p-4 rounded-full mb-4">
                            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                          </div>
                          <h3 className="text-heading text-xl mb-2">Cargando proyectos</h3>
                          <p className="text-neutral-500">Por favor espera mientras cargamos la información...</p>
                        </div>
                      </div>
                    ) : filteredProjects.length === 0 ? (
                      <div className="flex flex-col justify-center items-center h-[300px] text-center px-4 scale-in">
                        <div className="glass-pill p-8 rounded-xl shadow-medium fade-in flex flex-col items-center max-w-md">
                          <div className="bg-primary/10 p-4 rounded-full mb-4">
                            <FileText className="h-12 w-12 text-primary" />
                          </div>
                          <h3 className="text-heading text-xl mb-2">No hay proyectos</h3>
                          <p className="text-neutral-500 mb-6">
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
                              className="hover-lift shadow-soft hover:shadow-medium transition-all"
                              onClick={() => setLocation("/active-projects/new")}
                              size="lg"
                            >
                              <PlusCircle className="mr-2 h-5 w-5" />
                              Nuevo Proyecto
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="scale-in">
                        <EnhancedTable
                          glassmorphism
                          animateRows
                          rounded
                          data={filteredProjects}
                          columns={[
                            {
                              header: "Proyecto",
                              accessorKey: "quotation.projectName",
                              className: "font-medium text-neutral-900"
                            },
                            {
                              header: "Cliente",
                              accessorKey: (row) => {
                                const client = clients?.find(
                                  (c: Client) => c.id === row.quotation?.clientId
                                );
                                return client?.name || "Cliente Desconocido";
                              },
                              className: "text-neutral-700"
                            },
                            {
                              header: "Estado",
                              accessorKey: (row) => getStatusBadgeForProject(row.status)
                            },
                            {
                              header: "Inicio",
                              accessorKey: (row) => (
                                <div className="flex items-center">
                                  <CalendarIcon className="mr-2 h-4 w-4 text-neutral-400" />
                                  {formatDate(row.startDate)}
                                </div>
                              ),
                              className: "text-neutral-700"
                            },
                            {
                              header: "Fin Esperado",
                              accessorKey: (row) => (
                                <div className="flex items-center">
                                  <CalendarIcon className="mr-2 h-4 w-4 text-neutral-400" />
                                  {formatDate(row.expectedEndDate)}
                                </div>
                              ),
                              className: "text-neutral-700"
                            },
                            {
                              header: "Seguimiento",
                              accessorKey: (row) => getTrackingFrequencyLabel(row.trackingFrequency),
                              className: "text-neutral-700"
                            },
                            {
                              header: "Acciones",
                              accessorKey: (row) => (
                                <div className="flex space-x-2">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="hover-lift"
                                          onClick={() => setLocation(`/project-summary/${row.id}`)}
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
                                          onClick={() => setLocation(`/active-projects/${row.id}/time-entries`)}
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
                                          onClick={() => setLocation(`/project-summary/${row.id}`)}
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
                              )
                            }
                          ]}
                          emptyState={
                            <div className="flex flex-col justify-center items-center h-[300px] text-center px-4 scale-in">
                              <div className="glass-pill p-8 rounded-xl shadow-medium fade-in flex flex-col items-center max-w-md">
                                <div className="bg-primary/10 p-4 rounded-full mb-4">
                                  <FileText className="h-12 w-12 text-primary" />
                                </div>
                                <h3 className="text-heading text-xl mb-2">No hay proyectos</h3>
                                <p className="text-neutral-500 mb-6">
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
                                    className="hover-lift shadow-soft hover:shadow-medium transition-all"
                                    onClick={() => setLocation("/active-projects/new")}
                                    size="lg"
                                  >
                                    <PlusCircle className="mr-2 h-5 w-5" />
                                    Nuevo Proyecto
                                  </Button>
                                )}
                              </div>
                            </div>
                          }
                        />
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