import React, { useState, useMemo } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  Calendar,
  Users,
  Clock,
  BarChart,
  ArrowLeft,
  ChevronDown,
  HelpCircle,
  FileSpreadsheet,
  Activity,
  TrendingUp,
  Pencil,
  MoreHorizontal,
  AlertCircle,
  Info,
  X,
  Maximize2,
  Minimize2,
  FileBarChart,
} from "lucide-react";

// Importar componente de la pestaña MODO
import ModoTab from "@/components/modo/modo-tab";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Bar,
  BarChart as RechartsBarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Line,
  LineChart,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// Tipos
type Client = {
  id: number;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};

type ActiveProject = {
  id: number;
  quotationId: number;
  status: string;
  startDate: string;
  expectedEndDate: string;
  actualEndDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  quotation: {
    id: number;
    clientId: number;
    projectName: string;
    totalAmount: number;
    status: string;
    client?: Client;
  };
};

type TimeEntry = {
  id: number;
  projectId: number;
  personnelId: number;
  roleId: number;
  date: string;
  hours: number;
  description: string;
  billable: boolean;
  approved: boolean;
  approvedBy: number | null;
  approvedDate: string | null;
};

type Personnel = {
  id: number;
  name: string;
  roleId: number;
  hourlyRate: number;
};

type Role = {
  id: number;
  name: string;
  description: string | null;
  defaultRate: number;
};

type ClientCostSummary = {
  totalEstimatedCost: number;
  totalActualCost: number;
  totalVariance: number;
  averagePercentageUsed: number;
  projectCount: number;
  projectsData: Array<{
    projectId: number;
    projectName: string;
    estimatedCost: number;
    actualCost: number;
    variance: number;
    percentageUsed: number;
  }>;
};

// Estados para el dashboard
type DashboardState = {
  timeFilter: "all" | "week" | "month" | "quarter";
  viewMode: "detailed" | "summary";
  showSections: {
    kpi: boolean;
    deviations: boolean;
    team: boolean;
    charts: boolean;
  };
};

type ExpandedChartState = {
  isOpen: boolean;
  title: string;
  type: "hours" | "cost" | "projects" | null;
};

type HelpState = {
  isOpen: boolean;
  title: string;
  content: string;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(amount);
};

const ClientSummary = () => {
  const { clientId } = useParams();
  const parsedClientId = clientId ? parseInt(clientId) : null;
  const [, setLocation] = useLocation();

  // Estados del dashboard
  const [dashboardState, setDashboardState] = useState<DashboardState>({
    timeFilter: "all",
    viewMode: "detailed",
    showSections: {
      kpi: true,
      deviations: true,
      team: true,
      charts: true,
    },
  });

  // Estados para diálogos y modales
  const [expandedChart, setExpandedChart] = useState<ExpandedChartState>({
    isOpen: false,
    title: "",
    type: null,
  });

  const [showHelp, setShowHelp] = useState<HelpState>({
    isOpen: false,
    title: "",
    content: "",
  });

  // Consultas de datos
  const { data: client, isLoading: isLoadingClient } = useQuery<Client>({
    queryKey: [`/api/clients/${parsedClientId}`],
    enabled: !!parsedClientId,
  });

  const { data: projects = [], isLoading: isLoadingProjects } = useQuery<ActiveProject[]>({
    queryKey: [`/api/active-projects/client/${parsedClientId}`],
    enabled: !!parsedClientId,
  });

  const { data: timeEntries = [], isLoading: isLoadingTimeEntries } = useQuery<TimeEntry[]>({
    queryKey: [`/api/time-entries/client/${parsedClientId}`],
    enabled: !!parsedClientId,
  });

  const { data: roles = [], isLoading: isLoadingRoles } = useQuery({
    queryKey: ['/api/roles'],
  });

  const { data: personnel = [], isLoading: isLoadingPersonnel } = useQuery({
    queryKey: ['/api/personnel'],
  });

  const { data: costSummary, isLoading: isLoadingCostSummary } = useQuery<ClientCostSummary>({
    queryKey: [`/api/clients/${parsedClientId}/cost-summary`],
    enabled: !!parsedClientId,
  });

  // Datos calculados y memoizados
  const totalHours = useMemo(() => {
    if (!timeEntries?.length) return 0;
    return timeEntries.reduce((sum, entry) => sum + entry.hours, 0);
  }, [timeEntries]);

  const billableHours = useMemo(() => {
    if (!timeEntries?.length) return 0;
    return timeEntries
      .filter((entry) => entry.billable)
      .reduce((sum, entry) => sum + entry.hours, 0);
  }, [timeEntries]);

  const nonBillableHours = useMemo(() => {
    if (!timeEntries?.length) return 0;
    return timeEntries
      .filter((entry) => !entry.billable)
      .reduce((sum, entry) => sum + entry.hours, 0);
  }, [timeEntries]);

  const teammateData = useMemo(() => {
    if (!timeEntries?.length || !personnel?.length) return [];

    const teamHours: { [key: number]: number } = {};
    timeEntries.forEach((entry) => {
      teamHours[entry.personnelId] = (teamHours[entry.personnelId] || 0) + entry.hours;
    });

    return Object.entries(teamHours)
      .map(([personnelId, hours]) => {
        const person = personnel.find((p) => p.id === parseInt(personnelId));
        if (!person) return null;
        const role = roles?.find((r) => r.id === person.roleId);
        return {
          id: parseInt(personnelId),
          name: person.name,
          role: role?.name || "Sin rol",
          hours,
          hourlyRate: person.hourlyRate,
          cost: hours * person.hourlyRate,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b?.hours || 0) - (a?.hours || 0));
  }, [timeEntries, personnel, roles]);

  // Datos para gráficos
  const projectsChartData = useMemo(() => {
    if (!costSummary?.projectsData) return [];
    
    return costSummary.projectsData.map(project => ({
      name: project.projectName,
      estimated: project.estimatedCost,
      actual: project.actualCost,
      variance: project.variance,
      percentageUsed: project.percentageUsed
    }));
  }, [costSummary]);

  const costDistributionData = useMemo(() => {
    if (!costSummary?.projectsData) return [];
    
    return costSummary.projectsData.map(project => ({
      name: project.projectName,
      value: project.actualCost,
      percentage: (project.actualCost / costSummary.totalActualCost) * 100
    }));
  }, [costSummary]);

  // Estado de carga
  const isLoading =
    isLoadingClient ||
    isLoadingProjects ||
    isLoadingTimeEntries ||
    isLoadingRoles ||
    isLoadingPersonnel ||
    isLoadingCostSummary;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Cargando información del cliente...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-2" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Cliente no encontrado</h3>
              <p className="text-sm text-red-700 mt-1">
                No se pudo encontrar la información del cliente solicitado.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => setLocation("/clients")}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Volver a la lista de clientes
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/clients")}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            
            {client.logoUrl ? (
              <div className="h-10 w-10 rounded overflow-hidden border flex-shrink-0">
                <img 
                  src={client.logoUrl} 
                  alt={`${client.name} logo`} 
                  className="h-full w-full object-contain"
                  onError={(e) => {
                    // Manejo de error si la imagen no se puede cargar
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            ) : (
              <div className="h-10 w-10 bg-primary/10 rounded flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-medium text-primary">
                  {client.name.substring(0, 2).toUpperCase()}
                </span>
              </div>
            )}
            
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {client.name}
              </h1>
              <p className="text-muted-foreground mt-1">
                <span className="font-medium">Contacto:</span> {client.contactName} · {client.contactEmail}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setShowHelp({
                      isOpen: true,
                      title: "Resumen del cliente",
                      content:
                        "Este panel muestra una visión consolidada de todos los proyectos asociados a este cliente, incluyendo costos, horas registradas y progreso general."
                    })
                  }
                >
                  <HelpCircle className="h-4 w-4 mr-1" />
                  Ayuda
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Ver información de ayuda</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                Exportar
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Exportar a Excel</DropdownMenuItem>
              <DropdownMenuItem>Exportar a PDF</DropdownMenuItem>
              <DropdownMenuItem>Enviar por correo</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tarjetas de KPIs principales */}
      {dashboardState.showSections.kpi && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Proyectos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline">
                <div className="text-2xl font-bold">
                  {projects.length}
                </div>
                <div className="ml-2 text-sm text-muted-foreground">
                  proyectos
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {costSummary?.projectCount || 0} proyectos activos
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Horas Registradas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline">
                <div className="text-2xl font-bold">{totalHours.toFixed(1)}</div>
                <div className="ml-2 text-sm text-muted-foreground">horas</div>
              </div>
              <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                <span className="flex items-center">
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500 mr-1"></span>
                  {billableHours.toFixed(1)} facturables
                </span>
                <span className="flex items-center">
                  <span className="inline-block h-2 w-2 rounded-full bg-orange-400 mr-1"></span>
                  {nonBillableHours.toFixed(1)} no facturables
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Presupuesto Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline">
                <div className="text-2xl font-bold">
                  {formatCurrency(costSummary?.totalEstimatedCost || 0)}
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                <span className={costSummary?.totalVariance && costSummary.totalVariance > 0 ? "text-green-600" : "text-red-600"}>
                  {formatCurrency(costSummary?.totalVariance || 0)} restante
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Eficiencia Presupuestaria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline">
                <div className="text-2xl font-bold">
                  {costSummary?.averagePercentageUsed.toFixed(1) || 0}%
                </div>
                <div className="ml-2 text-sm text-muted-foreground">usado</div>
              </div>
              <Progress
                value={costSummary?.averagePercentageUsed || 0}
                className="h-2 mt-2"
                indicatorClassName={cn(
                  costSummary?.averagePercentageUsed && costSummary.averagePercentageUsed > 90
                    ? "bg-red-500"
                    : costSummary?.averagePercentageUsed && costSummary.averagePercentageUsed > 75
                    ? "bg-yellow-500"
                    : "bg-green-500"
                )}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Contenido principal en tabs */}
      <Tabs defaultValue="overview" className="mb-6">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">
            <Activity className="h-4 w-4 mr-1" />
            Resumen
          </TabsTrigger>
          <TabsTrigger value="projects">
            <Briefcase className="h-4 w-4 mr-1" />
            Proyectos
          </TabsTrigger>
          <TabsTrigger value="time">
            <Clock className="h-4 w-4 mr-1" />
            Tiempo
          </TabsTrigger>
          <TabsTrigger value="finances">
            <TrendingUp className="h-4 w-4 mr-1" />
            Finanzas
          </TabsTrigger>
          <TabsTrigger value="modo">
            <FileBarChart className="h-4 w-4 mr-1" />
            MODO
          </TabsTrigger>
        </TabsList>

        {/* Pestaña de Resumen */}
        <TabsContent value="overview" className="space-y-6">
          {/* Gráfico de Proyectos */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-medium">Estado de Proyectos</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setExpandedChart({
                      isOpen: true,
                      title: "Estado de Proyectos",
                      type: "projects"
                    })
                  }
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>
                Comparativa de costos estimados vs. reales por proyecto
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart
                  data={projectsChartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45} 
                    textAnchor="end"
                    height={70}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis />
                  <RechartsTooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ fontSize: "12px" }}
                  />
                  <Legend />
                  <Bar 
                    dataKey="estimated" 
                    name="Presupuesto" 
                    fill="#8884d8" 
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="actual" 
                    name="Gasto Real" 
                    fill="#82ca9d" 
                    radius={[4, 4, 0, 0]}
                  />
                </RechartsBarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Indicadores de rendimiento y Distribución por proyecto */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Distribución del costo por proyecto */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium">
                  Distribución del Costo
                </CardTitle>
                <CardDescription>
                  Porcentaje del presupuesto total por proyecto
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={costDistributionData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => 
                        `${name}: ${(percent * 100).toFixed(1)}%`
                      }
                    >
                      {costDistributionData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={[
                            "#8884d8",
                            "#82ca9d",
                            "#ffc658",
                            "#ff8042",
                            "#0088fe",
                            "#00C49F",
                          ][index % 6]}
                        />
                      ))}
                    </Pie>
                    <Legend />
                    <RechartsTooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ fontSize: "12px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Equipo de trabajo */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium">Equipo de Trabajo</CardTitle>
                <CardDescription>
                  Personal asignado con más horas registradas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {teammateData.slice(0, 5).map((member) => (
                    <div key={member?.id} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                          {member?.name.substring(0, 1)}
                        </div>
                        <div className="ml-2">
                          <div className="font-medium text-sm">{member?.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {member?.role}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-sm">
                          {member?.hours.toFixed(1)} hrs
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(member?.cost || 0)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {teammateData.length > 5 && (
                    <Button variant="ghost" size="sm" className="w-full mt-2">
                      Ver {teammateData.length - 5} miembros más
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Pestaña de Proyectos */}
        <TabsContent value="projects" className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">Lista de Proyectos</CardTitle>
              <CardDescription>
                {projects.length} proyectos asociados a {client.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proyecto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Presupuesto</TableHead>
                    <TableHead>Gastado</TableHead>
                    <TableHead className="text-right">% Utilizado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costSummary?.projectsData.map((project) => (
                    <TableRow key={project.projectId}>
                      <TableCell className="font-medium">
                        <Link href={`/project-summary/${project.projectId}`}>
                          <Button variant="link" className="p-0 h-auto">
                            {project.projectName}
                          </Button>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Activo
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(project.estimatedCost)}</TableCell>
                      <TableCell>{formatCurrency(project.actualCost)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className={
                            project.percentageUsed > 90 
                              ? "text-red-600" 
                              : project.percentageUsed > 75 
                                ? "text-yellow-600" 
                                : "text-green-600"
                          }>
                            {project.percentageUsed.toFixed(1)}%
                          </span>
                          <Progress
                            value={project.percentageUsed}
                            className="h-2 w-16"
                            indicatorClassName={cn(
                              project.percentageUsed > 90
                                ? "bg-red-500"
                                : project.percentageUsed > 75
                                ? "bg-yellow-500"
                                : "bg-green-500"
                            )}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pestaña de Tiempo */}
        <TabsContent value="time" className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">Registros de Tiempo</CardTitle>
              <CardDescription>
                Total: {totalHours.toFixed(1)} horas registradas en todos los proyectos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Proyecto</TableHead>
                    <TableHead>Persona</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Horas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeEntries.slice(0, 10).map((entry) => {
                    const project = projects.find(p => p.id === entry.projectId);
                    const person = personnel.find(p => p.id === entry.personnelId);
                    
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap">
                          {entry.date ? format(new Date(entry.date), "dd/MM/yyyy", { locale: es }) : ""}
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate">
                          {project?.quotation?.projectName || `Proyecto #${entry.projectId}`}
                        </TableCell>
                        <TableCell>{person?.name || `Personal #${entry.personnelId}`}</TableCell>
                        <TableCell className="max-w-[250px] truncate">
                          {entry.description}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {entry.hours.toFixed(1)}h
                          {!entry.billable && (
                            <span className="ml-2 text-xs rounded-full bg-orange-100 text-orange-700 px-1.5 py-0.5">
                              No facturable
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {timeEntries.length > 10 && (
                <div className="flex justify-center mt-4">
                  <Button variant="outline" size="sm">
                    Ver todos los registros ({timeEntries.length})
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pestaña de Finanzas */}
        <TabsContent value="finances" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium">Resumen Financiero</CardTitle>
                <CardDescription>
                  Estado financiero consolidado de todos los proyectos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2">
                  <div className="flex justify-between py-1">
                    <dt className="text-sm font-medium text-muted-foreground">Presupuesto Total:</dt>
                    <dd className="text-sm font-medium">{formatCurrency(costSummary?.totalEstimatedCost || 0)}</dd>
                  </div>
                  <div className="flex justify-between py-1">
                    <dt className="text-sm font-medium text-muted-foreground">Gasto Actual:</dt>
                    <dd className="text-sm font-medium">{formatCurrency(costSummary?.totalActualCost || 0)}</dd>
                  </div>
                  <div className="flex justify-between py-1">
                    <dt className="text-sm font-medium text-muted-foreground">Varianza (Restante):</dt>
                    <dd className={`text-sm font-medium ${costSummary?.totalVariance && costSummary.totalVariance > 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(costSummary?.totalVariance || 0)}
                    </dd>
                  </div>
                  <div className="flex justify-between py-1">
                    <dt className="text-sm font-medium text-muted-foreground">Porcentaje Utilizado:</dt>
                    <dd className="text-sm font-medium">{costSummary?.averagePercentageUsed.toFixed(1) || 0}%</dd>
                  </div>
                  <div className="pt-2">
                    <Progress
                      value={costSummary?.averagePercentageUsed || 0}
                      className="h-2"
                      indicatorClassName={cn(
                        costSummary?.averagePercentageUsed && costSummary.averagePercentageUsed > 90
                          ? "bg-red-500"
                          : costSummary?.averagePercentageUsed && costSummary.averagePercentageUsed > 75
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      )}
                    />
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium">Distribución del Equipo</CardTitle>
                <CardDescription>
                  Costo por persona en los proyectos del cliente
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={teammateData.map(member => ({
                        name: member?.name || "",
                        value: member?.cost || 0
                      }))}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      labelLine={false}
                      label={({ name, percent }) => 
                        `${name}: ${(percent * 100).toFixed(0)}%`
                      }
                      dataKey="value"
                    >
                      {teammateData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={[
                            "#8884d8",
                            "#82ca9d",
                            "#ffc658",
                            "#ff8042",
                            "#0088fe",
                            "#00C49F",
                          ][index % 6]}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ fontSize: "12px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Diálogo de gráfico expandido */}
      <Dialog open={expandedChart.isOpen} onOpenChange={(open) => !open && setExpandedChart({ ...expandedChart, isOpen: false })}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{expandedChart.title}</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4"
              onClick={() => setExpandedChart({ ...expandedChart, isOpen: false })}
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {expandedChart.type === "projects" && (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart
                  data={projectsChartData}
                  margin={{ top: 20, right: 30, left: 50, bottom: 70 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45} 
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis />
                  <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="estimated" name="Presupuesto" fill="#8884d8" />
                  <Bar dataKey="actual" name="Gasto Real" fill="#82ca9d" />
                </RechartsBarChart>
              </ResponsiveContainer>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de ayuda */}
      <Dialog open={showHelp.isOpen} onOpenChange={(open) => !open && setShowHelp({ ...showHelp, isOpen: false })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{showHelp.title}</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4"
              onClick={() => setShowHelp({ ...showHelp, isOpen: false })}
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>
          <DialogDescription>{showHelp.content}</DialogDescription>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientSummary;