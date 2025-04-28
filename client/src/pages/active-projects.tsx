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
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Proyectos Activos</h1>
          <p className="text-muted-foreground">
            Gestión y seguimiento de proyectos en ejecución
          </p>
        </div>
        <Button onClick={() => setLocation("/active-projects/new")}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nuevo Proyecto
        </Button>
      </div>

      <div className="flex flex-col space-y-6">
        {/* Filtros y búsqueda */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar proyectos..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
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
        <Card className="overflow-hidden">
          <CardHeader className="px-6 pt-6 pb-0">
            <Tabs
              defaultValue="all"
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
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
                  <h3 className="text-xl font-medium">No hay proyectos</h3>
                  <p className="text-muted-foreground mt-2 max-w-md">
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
                      className="mt-4"
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
                        <TableHead>Proyecto</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Inicio</TableHead>
                        <TableHead>Fin Esperado</TableHead>
                        <TableHead>Seguimiento</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProjects.map((project) => (
                        <TableRow key={project.id}>
                          <TableCell className="font-medium">
                            {project.quotation?.projectName}
                          </TableCell>
                          <TableCell>
                            {clients?.find(
                              (c: Client) => c.id === project.quotation?.clientId
                            )?.name || "Cliente Desconocido"}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(project.status)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                              {formatDate(project.startDate)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                              {formatDate(project.expectedEndDate)}
                            </div>
                          </TableCell>
                          <TableCell>
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
                                      onClick={() => setLocation(`/time-entries/project/${project.id}`)}
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
  );
};

export default ActiveProjects;