import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { queryClient } from "@/lib/queryClient";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { KpiCard } from "@/components/project/kpi-card";
import { 
  ArrowLeft, 
  Loader2, 
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Info as InfoCircle,
  UserIcon,
  PlusCircle as Plus,
  BarChart2,
  Clock as CalendarClock,
  Clock,
  Calendar,
  FileText,
  PlusCircle,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  DollarSign,
  Target,
  AlertCircle,
  Settings,
  Info as InfoIcon,
  Zap,
  Eye,
  CheckCircle,
  Clock3,
  Award,
  Activity,
  ThumbsUp,
  ArrowUpDown,
  Lightbulb,
  Smile
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { apiRequest } from "@/lib/queryClient";
import ChartModal from "@/components/project/chart-modal";
import { formatCurrency } from "@/lib/formatters";
import { ExpandIcon } from "@/components/ui/icons";
import AnimatedCard from "@/components/ui/animated-card";
import HelpDialog from "@/components/project/help-dialog";

interface CostSummary {
  estimatedCost: number;
  actualCost: number;
  variance: number;
  percentageUsed: number;
}

interface ProjectMetrics {
  hoursPerDay: number;
  progressPercentage: number;
  plannedHours: number;
  actualHours: number;
  daysElapsed: number;
  daysTotal: number;
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
  quotation: {
    id: number;
    projectName: string;
    clientId: number;
    totalAmount: number;
  };
}

interface TimeEntry {
  id: number;
  projectId: number;
  personnelId: number;
  date: string;
  hours: number;
  description: string | null;
  approved: boolean;
  billable: boolean;
}

interface Personnel {
  id: number;
  name: string;
  roleId: number;
  hourlyRate: number;
}

interface Role {
  id: number;
  name: string;
  description: string;
  hourlyRate: number;
}

// Estado de visualización
interface CustomView {
  showKpi: boolean;
  showFinances: boolean;
  showTime: boolean;
  showRisks: boolean;
  showCharts: boolean;
  showTeam: boolean;
}

// Estado para el modal de gráficos expandidos
interface ExpandedChartState {
  isOpen: boolean;
  title: string;
  type: "personnelBar" | "billablePie" | "timeTrend" | null;
}

// Estado para el modal de ayuda
interface HelpState {
  isOpen: boolean;
  title: string;
  content: string;
}

// Componente para mostrar el estado del proyecto
const StatusBadge = ({ status }: { status?: string }) => {
  // Si no hay estado, mostrar un estado por defecto
  if (!status) {
    return (
      <Badge className="bg-gray-100 text-gray-700">
        No definido
      </Badge>
    );
  }
  
  // Colores según estado
  let bgColor = "bg-gray-100";
  let textColor = "text-gray-700";
  let displayText = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  
  switch (status.toLowerCase()) {
    case 'active':
    case 'activo':
      bgColor = "bg-green-100";
      textColor = "text-green-700";
      displayText = "Activo";
      break;
    case 'completed':
    case 'completado':
      bgColor = "bg-blue-100";
      textColor = "text-blue-700";
      displayText = "Completado";
      break;
    case 'paused':
    case 'pausado':
      bgColor = "bg-amber-100";
      textColor = "text-amber-700";
      displayText = "Pausado";
      break;
    case 'cancelled':
    case 'cancelado':
      bgColor = "bg-red-100";
      textColor = "text-red-700";
      displayText = "Cancelado";
      break;
    case 'pending':
    case 'pendiente':
      bgColor = "bg-purple-100";
      textColor = "text-purple-700";
      displayText = "Pendiente";
      break;
  }
  
  return (
    <Badge className={`${bgColor} ${textColor}`}>
      {displayText}
    </Badge>
  );
};

const ProjectSummary = () => {
  const { projectId } = useParams();
  const parsedProjectId = projectId ? parseInt(projectId) : null;
  const [, setLocation] = useLocation();

  // Estados
  const [timeFilter, setTimeFilter] = useState("all");
  const [chartType, setChartType] = useState("bar");
  const [editing, setEditing] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [customView, setCustomView] = useState<CustomView>({
    showKpi: false,  // Cambiamos a false para no mostrar las tarjetas superiores duplicadas
    showFinances: true,
    showTime: true,
    showRisks: true,
    showCharts: true,
    showTeam: true,
  });
  
  // Función para manejar el diálogo de ayuda
  const handleOpenHelpDialog = (helpType: string) => {
    let title = "";
    let content = "";
    
    switch(helpType) {
      case 'hoursHelp':
        title = "Información sobre Horas";
        content = "Las horas registradas indican el tiempo total dedicado al proyecto por todo el equipo. Se dividen en horas facturables (que se cobran directamente al cliente) y horas no facturables (trabajo interno).";
        break;
      case 'costHelp':
        title = "Información sobre Costos";
        content = "El costo actual muestra los gastos acumulados en relación al presupuesto. Se calcula multiplicando las horas trabajadas por la tarifa correspondiente a cada rol en el proyecto.";
        break;
      case 'teamHelp':
        title = "Información sobre el Equipo";
        content = "Muestra el personal asignado al proyecto y cómo se distribuye el tiempo entre los distintos roles.";
        break;
      default:
        title = "Ayuda";
        content = "Seleccione un elemento específico para obtener más información.";
    }
    
    setShowHelp({
      isOpen: true,
      title,
      content
    });
  };
  const [expandedChart, setExpandedChart] = useState<ExpandedChartState>({
    isOpen: false,
    title: "",
    type: null
  });
  const [showHelp, setShowHelp] = useState<HelpState>({
    isOpen: false,
    title: "",
    content: ""
  });
  const [activeTab, setActiveTab] = useState("overview");

  // Obtener datos del proyecto
  const { data: project, isLoading } = useQuery({
    queryKey: ['/api/active-projects', parsedProjectId],
    enabled: !!parsedProjectId,
  });

  // Obtener registros de tiempo del proyecto
  const { data: timeEntries = [] } = useQuery({
    queryKey: [`/api/time-entries/project/${parsedProjectId}`],
    enabled: !!parsedProjectId,
  });

  // Obtener roles
  const { data: roles = [] } = useQuery({
    queryKey: ['/api/roles'],
  });

  // Obtener personal
  const { data: personnel = [] } = useQuery({
    queryKey: ['/api/personnel'],
  });

  // Obtener resumen de costos
  const { data: costSummary } = useQuery({
    queryKey: [`/api/projects/${parsedProjectId}/cost-summary`],
    enabled: !!parsedProjectId,
  });

  // Formatear fechas
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No definida";
    return format(new Date(dateString), "dd MMM yyyy", { locale: es });
  };

  // Actualizar el nombre del proyecto
  const handleSaveProjectName = async () => {
    if (!project || !parsedProjectId || !editedName.trim()) {
      setEditing(false);
      return;
    }

    try {
      // Optimistic update: actualiza la UI inmediatamente
      const oldProjectName = project.quotation?.projectName || "";
      
      // Actualizar inmediatamente la UI antes de la petición API
      const updatedProject = {
        ...project,
        quotation: {
          ...project.quotation,
          projectName: editedName.trim()
        }
      };
      
      // Usa la función queryClient.setQueryData para actualizar el caché inmediatamente
      queryClient.setQueryData(['/api/active-projects', parsedProjectId], updatedProject);
      
      // Luego realiza la petición API
      await apiRequest(`/api/quotations/${project.quotationId}`, 'PATCH', {
        projectName: editedName.trim()
      });
      
      // Finalmente, invalida las consultas para asegurarte de que los datos están frescos
      queryClient.invalidateQueries({ queryKey: ['/api/active-projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/active-projects', parsedProjectId] });
      
      setEditing(false);
    } catch (error) {
      console.error("Error al actualizar el nombre del proyecto:", error);
      setEditing(false);
      // Podría agregarse una alerta o notificación para el usuario
    }
  };

  // Filtrar entradas de tiempo según el filtro seleccionado
  const filteredTimeEntries = useMemo(() => {
    if (!timeEntries || !timeEntries.length) return [];
    
    const now = new Date();
    let filterDate = new Date();
    
    switch (timeFilter) {
      case "week":
        filterDate.setDate(now.getDate() - 7);
        break;
      case "month":
        filterDate.setMonth(now.getMonth() - 1);
        break;
      case "quarter":
        filterDate.setMonth(now.getMonth() - 3);
        break;
      default:
        return timeEntries;
    }
    
    return timeEntries.filter(entry => new Date(entry.date) >= filterDate);
  }, [timeEntries, timeFilter]);

  // Calcular totales de horas
  const totalHours = useMemo(() => {
    return filteredTimeEntries.reduce((sum, entry) => sum + entry.hours, 0);
  }, [filteredTimeEntries]);

  const billableHours = useMemo(() => {
    return filteredTimeEntries.filter(entry => entry.billable).reduce((sum, entry) => sum + entry.hours, 0);
  }, [filteredTimeEntries]);

  const nonBillableHours = useMemo(() => {
    return filteredTimeEntries.filter(entry => !entry.billable).reduce((sum, entry) => sum + entry.hours, 0);
  }, [filteredTimeEntries]);

  // Calcular métricas del proyecto
  const projectMetrics: ProjectMetrics = useMemo(() => {
    if (!project || !timeEntries) {
      return {
        hoursPerDay: 0,
        progressPercentage: 0,
        plannedHours: 0,
        actualHours: totalHours,
        daysElapsed: 0,
        daysTotal: 0,
      };
    }
    
    try {
      const startDate = new Date(project.startDate);
      // Si no hay fecha esperada de fin, usar fecha actual + 30 días como estimación
      const endDate = project.expectedEndDate ? new Date(project.expectedEndDate) : new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000);
      const today = new Date();
      
      const daysTotal = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      const daysElapsed = Math.max(0, Math.ceil((Math.min(today.getTime(), endDate.getTime()) - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      
      // Para simplificar, estimamos las horas planificadas proporcionalmente al costo
      const plannedHours = costSummary?.estimatedCost ? Math.round(costSummary.estimatedCost / 100) : 100; 
      
      const progressPercentage = Math.min(100, Math.max(0, (daysElapsed / daysTotal) * 100));
      const hoursPerDay = daysElapsed > 0 ? totalHours / daysElapsed : 0;
      
      return {
        hoursPerDay: isNaN(hoursPerDay) ? 0 : hoursPerDay,
        progressPercentage: isNaN(progressPercentage) ? 0 : progressPercentage,
        plannedHours,
        actualHours: totalHours,
        daysElapsed: isNaN(daysElapsed) ? 0 : daysElapsed,
        daysTotal: isNaN(daysTotal) ? 30 : daysTotal,
      };
    } catch (error) {
      console.error("Error al calcular métricas:", error);
      return {
        hoursPerDay: 0,
        progressPercentage: 0,
        plannedHours: 100,
        actualHours: totalHours,
        daysElapsed: 0,
        daysTotal: 30,
      };
    }
  }, [project, timeEntries, totalHours, costSummary]);

  // Preparar datos para los gráficos
  const timeByPersonnelData = useMemo(() => {
    if (!filteredTimeEntries.length || !personnel.length || !roles.length) return [];
    
    const personnelSummary: Record<number, { name: string, hours: number, role: string, cost: number }> = {};
    
    filteredTimeEntries.forEach(entry => {
      const person = personnel.find(p => p.id === entry.personnelId);
      if (!person) return;
      
      const role = roles.find(r => r.id === person.roleId);
      if (!role) return;
      
      if (!personnelSummary[person.id]) {
        personnelSummary[person.id] = {
          name: person.name,
          hours: 0,
          role: role.name,
          cost: 0
        };
      }
      
      personnelSummary[person.id].hours += entry.hours;
      personnelSummary[person.id].cost += entry.hours * role.hourlyRate;
    });
    
    return Object.values(personnelSummary);
  }, [filteredTimeEntries, personnel, roles]);

  const billabilityData = useMemo(() => {
    return [
      { name: 'Facturable', value: billableHours, color: '#4f46e5' },
      { name: 'No Facturable', value: nonBillableHours, color: '#f97316' }
    ];
  }, [billableHours, nonBillableHours]);

  const billableVsNonBillableData = useMemo(() => {
    return [
      { name: 'Facturable', value: billableHours },
      { name: 'No Facturable', value: nonBillableHours }
    ];
  }, [billableHours, nonBillableHours]);

  const timeEntriesByDateData = useMemo(() => {
    if (!filteredTimeEntries.length || !personnel.length || !roles.length) return [];
    
    const dateMap: Record<string, { date: string, hours: number, cost: number }> = {};
    
    // Ordenar las entradas por fecha
    const sortedEntries = [...filteredTimeEntries].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    sortedEntries.forEach(entry => {
      const dateStr = format(new Date(entry.date), "dd/MM/yyyy");
      const person = personnel.find(p => p.id === entry.personnelId);
      if (!person) return;
      
      const role = roles.find(r => r.id === person.roleId);
      if (!role) return;
      
      if (!dateMap[dateStr]) {
        dateMap[dateStr] = {
          date: dateStr,
          hours: 0,
          cost: 0
        };
      }
      
      dateMap[dateStr].hours += entry.hours;
      dateMap[dateStr].cost += entry.hours * role.hourlyRate;
    });
    
    return Object.values(dateMap);
  }, [filteredTimeEntries, personnel, roles]);

  // Datos para gráfico radar (ejemplo)
  const radarData = [
    { subject: 'Cumplimiento', A: 120, B: 110, fullMark: 150 },
    { subject: 'Calidad', A: 98, B: 130, fullMark: 150 },
    { subject: 'Eficiencia', A: 86, B: 130, fullMark: 150 },
    { subject: 'Costo', A: 99, B: 100, fullMark: 150 },
    { subject: 'Tiempo', A: 85, B: 90, fullMark: 150 },
    { subject: 'Valor', A: 65, B: 85, fullMark: 150 },
  ];

  // Roles info para el tooltip de ayuda
  const rolesInfo = useMemo(() => {
    return roles || [];
  }, [roles]);

  // Actualizar el nombre cuando cambia el proyecto
  useEffect(() => {
    if (project && project.quotation) {
      setEditedName(project.quotation.projectName || "");
    }
  }, [project]);

  // Renderizar el gráfico expandido en el modal
  const renderExpandedChart = () => {
    if (!expandedChart.isOpen || !expandedChart.type) return null;
    
    switch (expandedChart.type) {
      case 'personnelBar':
        return (
          <div className="h-[80vh]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={timeByPersonnelData}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                barSize={60}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  height={60}
                  tick={{
                    fontSize: 14,
                    dy: 10
                  }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  width={80}
                  tick={{
                    fontSize: 14
                  }}
                />
                <RechartsTooltip 
                  formatter={(value, name, props) => {
                    const data = props.payload;
                    if (data) {
                      return [
                        <div key={`tooltip-${name}`} className="space-y-2">
                          <p className="text-base mb-1">
                            <span className="font-medium">Nombre:</span> {data.name}
                          </p>
                          <p className="text-base mb-1">
                            <span className="font-medium">Rol:</span> {data.role}
                          </p>
                          <p className="text-base mb-1">
                            <span className="font-medium">Horas:</span> {data.hours}
                          </p>
                          <p className="text-base">
                            <span className="font-medium">Costo:</span> {formatCurrency(data.cost)}
                          </p>
                        </div>
                      ];
                    }
                    return null;
                  }}
                  contentStyle={{ 
                    borderRadius: '8px',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                    boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)',
                    padding: '16px',
                    fontSize: '14px'
                  }}
                />
                <Legend 
                  iconType="circle"
                  wrapperStyle={{
                    paddingTop: 20,
                    fontSize: 14
                  }}
                />
                <Bar 
                  dataKey="hours" 
                  fill="#4f46e5" 
                  name="Horas"
                  radius={[4, 4, 0, 0]}
                  animationDuration={1500}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      case 'billablePie':
        return (
          <div className="h-[80vh]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={billabilityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={100}
                  outerRadius={180}
                  paddingAngle={5}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ stroke: "#555", strokeWidth: 1, strokeDasharray: "3 3" }}
                  animationDuration={1500}
                >
                  {billabilityData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color} 
                    />
                  ))}
                </Pie>
                <RechartsTooltip 
                  formatter={(value, name) => [
                    `${value.toFixed(1)} horas (${((value / totalHours) * 100).toFixed(1)}%)`, 
                    name
                  ]}
                  contentStyle={{ 
                    borderRadius: '8px',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                    boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)',
                    padding: '16px',
                    fontSize: '14px'
                  }}
                />
                <Legend 
                  iconType="circle"
                  wrapperStyle={{
                    paddingTop: 20,
                    fontSize: 14
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        );
      case 'timeTrend':
        return (
          <div className="h-[80vh]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={timeEntriesByDateData}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  padding={{ left: 30, right: 30 }}
                  height={60}
                  tick={{
                    fontSize: 14,
                    dy: 10
                  }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  yAxisId="left"
                  width={80}
                  tick={{
                    fontSize: 14
                  }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  orientation="right"
                  yAxisId="right"
                  width={80}
                  tick={{
                    fontSize: 14
                  }}
                />
                <RechartsTooltip 
                  formatter={(value, name) => {
                    if (name === "hours") return [`${value} horas`, "Horas"];
                    if (name === "cost") return [formatCurrency(value as number), "Costo"];
                    return [value, name];
                  }}
                  contentStyle={{ 
                    borderRadius: '8px',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                    boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)',
                    padding: '10px',
                    fontSize: '14px'
                  }}
                />
                <Legend 
                  iconType="circle"
                  wrapperStyle={{
                    paddingTop: 20,
                    fontSize: 14
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="hours"
                  stroke="#4f46e5"
                  name="Horas"
                  strokeWidth={3}
                  dot={{ r: 6, fill: "#4f46e5", strokeWidth: 2, stroke: "#ffffff" }}
                  activeDot={{ r: 8, fill: "#4f46e5", strokeWidth: 2, stroke: "#ffffff" }}
                  yAxisId="left"
                  animationDuration={1500}
                />
                <Line
                  type="monotone"
                  dataKey="cost"
                  stroke="#f59e0b"
                  name="Costo"
                  strokeWidth={3}
                  dot={{ r: 6, fill: "#f59e0b", strokeWidth: 2, stroke: "#ffffff" }}
                  activeDot={{ r: 8, fill: "#f59e0b", strokeWidth: 2, stroke: "#ffffff" }}
                  yAxisId="right"
                  animationDuration={1500}
                  animationBegin={300}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      default:
        return null;
    }
  };

  if (!projectId) {
    return (
      <div className="container mx-auto py-6 px-6">
        <div className="flex justify-center items-center h-[400px]">
          <Card className="w-[600px]">
            <CardHeader>
              <CardTitle>Error</CardTitle>
              <CardDescription>No se ha especificado un proyecto</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button onClick={() => setLocation("/active-projects")}>
                Ver Proyectos
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 h-[calc(100vh-4rem)]">
      {/* Modal para gráficos expandidos */}
      <ChartModal 
        isOpen={expandedChart.isOpen}
        onClose={() => setExpandedChart({ isOpen: false, title: "", type: null })}
        title={expandedChart.title}
      >
        {renderExpandedChart()}
      </ChartModal>
      
      {/* Modal de ayuda */}
      <HelpDialog 
        isOpen={showHelp.isOpen}
        onClose={() => setShowHelp({ isOpen: false, title: "", content: "" })}
        title={showHelp.title}
        content={showHelp.content}
      />
      
      <div className="container mx-auto px-6 py-6 pb-24 max-w-[1200px]">
        {/* Header navigation */}
        <div className="mb-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setLocation("/active-projects")}
            className="px-2 py-1 h-auto"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Proyectos
          </Button>
        </div>
        
        {/* Project Title */}
        <div className="mb-6">
          {isLoading ? (
            <h1 className="text-3xl font-bold mb-1">Cargando...</h1>
          ) : (
            <div className="group relative">
              <div className="flex items-center gap-2">
                <h1 
                  className="text-3xl font-bold mb-1 group-hover:bg-primary/5 group-hover:rounded px-2 py-1 cursor-pointer"
                  onClick={() => setEditing(true)}
                >
                  {!editing ? (
                    <>{project?.quotation?.projectName || "Sin nombre"}</>
                  ) : (
                    <input
                      type="text"
                      className="bg-transparent border-none outline-none p-0 w-full focus:ring-2 focus:ring-primary rounded"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      autoFocus
                      onBlur={handleSaveProjectName}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSaveProjectName();
                        } else if (e.key === "Escape") {
                          setEditing(false);
                          setEditedName(project?.quotation?.projectName || "");
                        }
                      }}
                    />
                  )}
                </h1>
                {!editing && (
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      setEditing(true);
                      setEditedName(project?.quotation?.projectName || "");
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                      <path d="m15 5 4 4"></path>
                    </svg>
                  </Button>
                )}
              </div>
              {editing && (
                <div className="absolute top-full left-0 mt-1 flex space-x-2">
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={handleSaveProjectName}
                  >
                    Guardar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setEditing(false);
                      setEditedName(project?.quotation?.projectName || "");
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            ID: {projectId} | Última actualización: {format(new Date(), "dd MMM yyyy, HH:mm", { locale: es })}
          </p>
        </div>
        
        {/* Controls */}
        <div className="flex justify-between items-center mb-6">
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todo el periodo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo el periodo</SelectItem>
              <SelectItem value="week">Última semana</SelectItem>
              <SelectItem value="month">Último mes</SelectItem>
              <SelectItem value="quarter">Último trimestre</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Personalizar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Personaliza tu dashboard</AlertDialogTitle>
                  <AlertDialogDescription>
                    Selecciona qué componentes deseas mostrar en el resumen del proyecto.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Target className="h-4 w-4 text-primary" />
                      <span>Métricas principales (KPIs)</span>
                    </div>
                    <Switch 
                      checked={customView.showKpi} 
                      onCheckedChange={(checked) => 
                        setCustomView({...customView, showKpi: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-4 w-4 text-primary" />
                      <span>Información financiera</span>
                    </div>
                    <Switch 
                      checked={customView.showFinances} 
                      onCheckedChange={(checked) => 
                        setCustomView({...customView, showFinances: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <span>Registro de tiempo</span>
                    </div>
                    <Switch 
                      checked={customView.showTime} 
                      onCheckedChange={(checked) => 
                        setCustomView({...customView, showTime: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="h-4 w-4 text-primary" />
                      <span>Análisis de riesgos</span>
                    </div>
                    <Switch 
                      checked={customView.showRisks} 
                      onCheckedChange={(checked) => 
                        setCustomView({...customView, showRisks: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      <span>Gráficos y visualizaciones</span>
                    </div>
                    <Switch 
                      checked={customView.showCharts} 
                      onCheckedChange={(checked) => 
                        setCustomView({...customView, showCharts: checked})}
                    />
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction>Guardar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            <Button variant="default" size="sm" onClick={() => setLocation(`/active-projects/${projectId}/time-entries`)}>
              <Clock className="h-4 w-4 mr-2" />
              Registrar Horas
            </Button>
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center h-[400px]">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            {customView.showKpi && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8 h-[200px]">
                <AnimatedCard delay={100}>
                  <KpiCard 
                    title="Horas Registradas"
                    value={`${totalHours.toFixed(1)} h`}
                    description="Total de horas en el proyecto"
                    icon={<Clock className="h-5 w-5" />}
                    trend={5}
                    trendText="vs. periodo anterior"
                    color="blue"
                  />
                </AnimatedCard>
                
                <AnimatedCard delay={200}>
                  <KpiCard 
                    title="Costo Actual"
                    value={formatCurrency(costSummary?.actualCost || 0)}
                    description={`${Math.round(costSummary?.percentageUsed || 0)}% del presupuesto`}
                    icon={<DollarSign className="h-5 w-5" />}
                    trend={costSummary?.variance ? (costSummary.variance > 0 ? costSummary.variance : -costSummary.variance) : 0}
                    trendDirection={costSummary?.variance && costSummary.variance > 0 ? 'down' : 'up'}
                    trendText={costSummary?.variance && costSummary.variance > 0 ? "por debajo del presupuesto" : "por encima del presupuesto"}
                    color={costSummary?.percentageUsed && costSummary.percentageUsed > 90 ? "red" : "green"}
                  />
                </AnimatedCard>
                
                <AnimatedCard delay={300}>
                  <KpiCard 
                    title="Personal Asignado"
                    value={new Set(timeEntries?.map(e => e.personnelId) || []).size.toString()}
                    description="Trabajando en el proyecto"
                    icon={<Users className="h-5 w-5" />}
                    color="purple"
                  />
                </AnimatedCard>
                
                <AnimatedCard delay={400}>
                  <KpiCard 
                    title="Tiempo Restante"
                    value={projectMetrics ? `${Math.max(0, projectMetrics.daysTotal - projectMetrics.daysElapsed)} días` : "0 días"}
                    description={
                      <div className="flex flex-col">
                        <span>{`${isNaN(projectMetrics?.progressPercentage) ? 0 : Math.round(projectMetrics?.progressPercentage || 0)}% completado`}</span>
                        <span className="text-xs text-muted-foreground mt-1">Inicio: {formatDate(project?.startDate || "")}</span>
                      </div>
                    }
                    icon={<Calendar className="h-5 w-5" />}
                    color="amber"
                    progress={isNaN(projectMetrics?.progressPercentage) ? 0 : projectMetrics?.progressPercentage || 0}
                  />
                </AnimatedCard>
              </div>
            )}
            
            {/* Tabs de navegación para el contenido */}
            <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full max-w-md mb-4">
                <TabsTrigger value="overview" className="flex-1">Vista general</TabsTrigger>
                <TabsTrigger value="financial" className="flex-1">Finanzas</TabsTrigger>
                <TabsTrigger value="hours" className="flex-1">Registro de horas</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="pt-4">
                {/* Información general y estado del proyecto */}
                {/* Principales métricas del proyecto - Vista estilo dashboard */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  {/* Horas Registradas KPI */}
                  {customView.showTime && (
                    <AnimatedCard delay={200}>
                      <Card className="shadow-sm hover:shadow-md transition-shadow h-full">
                        <CardContent className="p-6">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center text-primary font-medium">
                                <Clock className="h-4 w-4 mr-2" />
                                <span>Horas Registradas</span>
                              </div>
                              <InfoCircle 
                                className="h-4 w-4 text-muted-foreground cursor-help" 
                                onClick={() => handleOpenHelpDialog('hoursHelp')}
                              />
                            </div>
                            
                            <div className="flex items-baseline">
                              <span className="text-3xl font-bold">{totalHours.toFixed(1)}</span>
                              <span className="text-xs text-muted-foreground ml-1">h</span>
                            </div>
                            
                            <div className="flex items-center text-xs text-muted-foreground">
                              <span className="inline-flex items-center mr-2 text-blue-600">
                                <span className="w-2 h-2 rounded-full bg-blue-600 mr-1"></span>
                                {billableHours.toFixed(1)} facturables
                              </span>
                              <span className="inline-flex items-center text-neutral-500">
                                <span className="w-2 h-2 rounded-full bg-neutral-400 mr-1"></span>
                                {nonBillableHours.toFixed(1)} no facturables
                              </span>
                            </div>
                            
                            <Separator className="my-2" />
                            
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-muted-foreground">En {timeEntries?.length || 0} registros</span>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-7 px-2"
                                onClick={() => setLocation(`/active-projects/${project.id}/time-entries`)}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Registrar
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </AnimatedCard>
                  )}
                  
                  {/* Costo Actual KPI */}
                  {customView.showFinances && (
                    <AnimatedCard delay={300}>
                      <Card className="shadow-sm hover:shadow-md transition-shadow h-full">
                        <CardContent className="p-6">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center text-primary font-medium">
                                <DollarSign className="h-4 w-4 mr-2" />
                                <span>Costo Actual</span>
                              </div>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge 
                                      variant="outline" 
                                      className={`${
                                        (costSummary?.percentageUsed || 0) > 100 ? "bg-red-50 text-red-600 border-red-200" :
                                        (costSummary?.percentageUsed || 0) > 90 ? "bg-amber-50 text-amber-600 border-amber-200" :
                                        "bg-green-50 text-green-600 border-green-200"
                                      }`}
                                    >
                                      {Math.round(costSummary?.percentageUsed || 0)}%
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Porcentaje del presupuesto utilizado</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            
                            <div className="flex items-baseline">
                              <span className="text-3xl font-bold">{formatCurrency(costSummary?.actualCost || 0, true)}</span>
                            </div>
                            
                            <div className="flex items-center text-xs">
                              <span className="text-muted-foreground">de {formatCurrency(costSummary?.estimatedCost || 0, true)} presupuestados</span>
                            </div>
                            
                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                              <div 
                                className={`h-full rounded-full ${
                                  (costSummary?.percentageUsed || 0) > 100 ? "bg-red-500" :
                                  (costSummary?.percentageUsed || 0) > 90 ? "bg-amber-500" :
                                  "bg-primary"
                                }`}
                                style={{ width: `${Math.min(costSummary?.percentageUsed || 0, 100)}%` }}
                              ></div>
                            </div>
                            
                            <Separator className="my-2" />
                            
                            <div className="flex items-center text-xs">
                              {costSummary && costSummary.variance >= 0 ? (
                                <div className="flex items-center text-green-600">
                                  <TrendingDown className="h-3 w-3 mr-1" />
                                  <span>{formatCurrency(costSummary.variance)} ahorrado</span>
                                </div>
                              ) : (
                                <div className="flex items-center text-red-600">
                                  <TrendingUp className="h-3 w-3 mr-1" />
                                  <span>{formatCurrency(Math.abs(costSummary?.variance || 0))} excedido</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </AnimatedCard>
                  )}
                  
                  {/* Personal Asignado KPI */}
                  {customView.showTeam && (
                    <AnimatedCard delay={400}>
                      <Card className="shadow-sm hover:shadow-md transition-shadow h-full">
                        <CardContent className="p-6">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center text-primary font-medium">
                                <Users className="h-4 w-4 mr-2" />
                                <span>Personal Asignado</span>
                              </div>
                              <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">
                                {new Set(timeEntries?.map(e => e.personnelId) || []).size}
                              </Badge>
                            </div>
                            
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Array.from(new Set(timeEntries?.map(e => e.personnelId) || [])).slice(0, 5).map((personnelId, idx) => {
                                const person = personnel?.find(p => p.id === personnelId);
                                const role = person ? roles?.find(r => r.id === person.roleId) : null;
                                return (
                                  <Badge 
                                    key={idx} 
                                    variant="outline" 
                                    className="bg-blue-50/50 border-blue-100 text-blue-700"
                                  >
                                    {person?.name || 'Desconocido'}
                                  </Badge>
                                );
                              })}
                              {new Set(timeEntries?.map(e => e.personnelId) || []).size > 5 && (
                                <Badge variant="outline" className="bg-muted">
                                  +{new Set(timeEntries?.map(e => e.personnelId) || []).size - 5} más
                                </Badge>
                              )}
                            </div>
                            
                            {timeEntries && timeEntries.length > 0 && (
                              <div className="flex flex-col space-y-1 mt-1">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>Rol</span>
                                  <span>Horas</span>
                                </div>
                                {Object.entries(
                                  timeEntries.reduce((acc, entry) => {
                                    const person = personnel?.find(p => p.id === entry.personnelId);
                                    const role = person ? roles?.find(r => r.id === person.roleId) : null;
                                    const roleName = role?.name || 'Sin rol';
                                    
                                    if (!acc[roleName]) acc[roleName] = 0;
                                    acc[roleName] += entry.hours || 0;
                                    return acc;
                                  }, {} as Record<string, number>)
                                )
                                .sort((a, b) => b[1] - a[1])
                                .slice(0, 3)
                                .map(([role, hours], idx) => (
                                  <div key={idx} className="flex justify-between items-center text-xs">
                                    <span>{role}</span>
                                    <span className="font-medium">{hours.toFixed(1)}h</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            <Separator className="my-2" />
                            
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-muted-foreground">
                                {Math.round((projectMetrics?.hoursPerDay || 0) * 10) / 10} h/día promedio
                              </span>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-7 px-2"
                                onClick={() => setExpandedChart({
                                  isOpen: true,
                                  title: "Distribución de Horas por Personal",
                                  type: "personnelBar"
                                })}
                              >
                                <BarChart2 className="h-3 w-3 mr-1" />
                                Ver detalle
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </AnimatedCard>
                  )}
                  
                  {/* Tiempo Restante KPI */}
                  {customView.showTime && (
                    <AnimatedCard delay={500}>
                      <Card className="shadow-sm hover:shadow-md transition-shadow h-full">
                        <CardContent className="p-6">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center text-primary font-medium">
                                <CalendarClock className="h-4 w-4 mr-2" />
                                <span>Tiempo Restante</span>
                              </div>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge 
                                      variant="outline" 
                                      className={`${
                                        isNaN(projectMetrics?.progressPercentage) ? "bg-neutral-50 text-neutral-600 border-neutral-200" :
                                        projectMetrics && (projectMetrics.progressPercentage < ((projectMetrics.daysElapsed / projectMetrics.daysTotal) * 100) - 10) ? 
                                          "bg-red-50 text-red-600 border-red-200" :
                                        projectMetrics && (projectMetrics.progressPercentage > ((projectMetrics.daysElapsed / projectMetrics.daysTotal) * 100) + 10) ? 
                                          "bg-green-50 text-green-600 border-green-200" :
                                          "bg-blue-50 text-blue-600 border-blue-200"
                                      }`}
                                    >
                                      {isNaN(projectMetrics?.progressPercentage) ? 0 : Math.round(projectMetrics?.progressPercentage || 0)}%
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Porcentaje de progreso real</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            
                            <div className="flex items-baseline">
                              <span className="text-3xl font-bold">{Math.max(0, (projectMetrics?.daysTotal || 0) - (projectMetrics?.daysElapsed || 0))}</span>
                              <span className="text-xs text-muted-foreground ml-1">días</span>
                            </div>
                            
                            <div className="flex items-center text-xs">
                              <span className="text-muted-foreground">
                                {projectMetrics?.daysElapsed || 0} de {projectMetrics?.daysTotal || 0} días transcurridos
                              </span>
                            </div>
                            
                            <div className="relative h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                              {/* Barra de tiempo transcurrido */}
                              <div 
                                className="absolute h-full bg-blue-500"
                                style={{ width: `${Math.min(Math.round((projectMetrics?.daysElapsed || 0) / Math.max(1, (projectMetrics?.daysTotal || 1)) * 100), 100)}%` }}
                              ></div>
                              
                              {/* Marcador de progreso */}
                              <div 
                                className="absolute top-1/2 w-1 h-3 bg-primary -translate-y-1/2 z-10"
                                style={{ 
                                  left: `${Math.min(isNaN(projectMetrics?.progressPercentage) ? 0 : Math.round(projectMetrics?.progressPercentage || 0), 100)}%`,
                                }}
                              ></div>
                            </div>
                            
                            <Separator className="my-2" />
                            
                            <div className="flex justify-between items-center text-xs">
                              <span className="flex items-center">
                                {projectMetrics && (projectMetrics.progressPercentage < ((projectMetrics.daysElapsed / projectMetrics.daysTotal) * 100) - 10) ? (
                                  <span className="flex items-center text-red-600">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    <span>{Math.round(((projectMetrics.daysElapsed / projectMetrics.daysTotal) * 100) - projectMetrics.progressPercentage)}% retraso</span>
                                  </span>
                                ) : projectMetrics && (projectMetrics.progressPercentage > ((projectMetrics.daysElapsed / projectMetrics.daysTotal) * 100) + 10) ? (
                                  <span className="flex items-center text-green-600">
                                    <ThumbsUp className="h-3 w-3 mr-1" />
                                    <span>{Math.round(projectMetrics.progressPercentage - ((projectMetrics.daysElapsed / projectMetrics.daysTotal) * 100))}% adelanto</span>
                                  </span>
                                ) : (
                                  <span className="flex items-center text-blue-600">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    <span>En tiempo</span>
                                  </span>
                                )}
                              </span>
                              {project?.expectedEndDate && (
                                <span className="text-muted-foreground">
                                  Fin: {formatDate(project.expectedEndDate, "short")}
                                </span>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </AnimatedCard>
                  )}
                </div>
                
                {/* Sección principal - Monitoreo y Análisis */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
                  {/* Monitoreo de Desviaciones - Panel detallado */}
                  {customView.showFinances && (
                    <AnimatedCard delay={600} className="lg:col-span-6">
                      <Card className="shadow-sm hover:shadow-md transition-shadow h-full">
                        <CardHeader className="pb-3 border-b">
                          <CardTitle className="text-lg font-medium flex items-center">
                            <div className="mr-3 p-2 rounded-full bg-primary/10">
                              <ArrowUpDown className="h-5 w-5 text-primary" />
                            </div>
                            Monitoreo de Desviaciones
                          </CardTitle>
                          <CardDescription>
                            Control de desviaciones en costos y tiempo
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Desviación de Costos */}
                            <div className="p-4 bg-card rounded-lg border">
                              <div className="flex justify-between items-center mb-2">
                                <h4 className="font-semibold text-sm flex items-center">
                                  <DollarSign className="h-4 w-4 mr-1 text-primary" />
                                  Costos
                                </h4>
                                <Badge variant={
                                  (costSummary?.percentageUsed || 0) > 100 ? "destructive" :
                                  (costSummary?.percentageUsed || 0) > 90 ? "outline" : "secondary"
                                } className="font-normal text-xs">
                                  {Math.round(costSummary?.percentageUsed || 0)}% utilizado
                                </Badge>
                              </div>
                              
                              <div className="space-y-4 mt-3">
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="bg-muted/30 p-2 rounded">
                                    <span className="text-xs text-muted-foreground block">Estimado</span>
                                    <span className="font-medium">{formatCurrency(costSummary?.estimatedCost || 0)}</span>
                                  </div>
                                  <div className="bg-muted/30 p-2 rounded">
                                    <span className="text-xs text-muted-foreground block">Actual</span>
                                    <span className="font-medium">{formatCurrency(costSummary?.actualCost || 0)}</span>
                                  </div>
                                </div>
                                
                                <div>
                                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                    <span>0%</span>
                                    <span>50%</span>
                                    <span>100%</span>
                                  </div>
                                  <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full ${
                                        (costSummary?.percentageUsed || 0) > 100 ? "bg-red-500" :
                                        (costSummary?.percentageUsed || 0) > 90 ? "bg-amber-500" :
                                        "bg-primary"
                                      }`}
                                      style={{ width: `${Math.min(costSummary?.percentageUsed || 0, 100)}%` }}
                                    ></div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center mt-1">
                                  {costSummary && costSummary.variance >= 0 ? (
                                    <div className="flex items-center text-green-600 text-sm">
                                      <TrendingDown className="h-4 w-4 mr-1" />
                                      <span>{formatCurrency(costSummary.variance)} por debajo del presupuesto</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center text-red-600 text-sm">
                                      <TrendingUp className="h-4 w-4 mr-1" />
                                      <span>{formatCurrency(Math.abs(costSummary?.variance || 0))} por encima del presupuesto</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Desviación de Tiempo */}
                            <div className="p-4 bg-card rounded-lg border">
                              <div className="flex justify-between items-center mb-2">
                                <h4 className="font-semibold text-sm flex items-center">
                                  <Clock className="h-4 w-4 mr-1 text-primary" />
                                  Tiempo
                                </h4>
                                <Badge variant={
                                  projectMetrics && (projectMetrics.progressPercentage < ((projectMetrics.daysElapsed / projectMetrics.daysTotal) * 100) - 15) ? 
                                    "destructive" :
                                  projectMetrics && (projectMetrics.progressPercentage < ((projectMetrics.daysElapsed / projectMetrics.daysTotal) * 100) - 5) ? 
                                    "outline" : "secondary"
                                } className="font-normal text-xs">
                                  {isNaN(projectMetrics?.progressPercentage) ? 0 : Math.round(projectMetrics?.progressPercentage || 0)}% completado
                                </Badge>
                              </div>
                              
                              <div className="space-y-4 mt-3">
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="bg-muted/30 p-2 rounded">
                                    <span className="text-xs text-muted-foreground block">Transcurrido</span>
                                    <span className="font-medium">{projectMetrics?.daysElapsed || 0} de {projectMetrics?.daysTotal || 0} días</span>
                                  </div>
                                  <div className="bg-muted/30 p-2 rounded">
                                    <span className="text-xs text-muted-foreground block">Progreso real</span>
                                    <span className="font-medium">{isNaN(projectMetrics?.progressPercentage) ? "0" : Math.round(projectMetrics?.progressPercentage || 0)}%</span>
                                  </div>
                                </div>
                                
                                <div>
                                  <div className="relative h-2 rounded-full bg-muted/30 mb-1">
                                    {/* Barra de tiempo transcurrido */}
                                    <div 
                                      className="absolute h-full bg-blue-500 rounded-full"
                                      style={{ width: `${Math.round((projectMetrics?.daysElapsed || 0) / Math.max(1, (projectMetrics?.daysTotal || 1)) * 100)}%` }}
                                    ></div>
                                    
                                    {/* Marcador de progreso */}
                                    <div 
                                      className="absolute top-0 w-1 h-4 bg-primary -mt-1 z-10 rounded-full"
                                      style={{ 
                                        left: `${isNaN(projectMetrics?.progressPercentage) ? 0 : Math.round(projectMetrics?.progressPercentage || 0)}%`,
                                        transform: 'translateX(-50%)'
                                      }}
                                    ></div>
                                  </div>
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span className="text-blue-600">Tiempo transcurrido</span>
                                    <span className="text-primary">Progreso real</span>
                                  </div>
                                </div>
                                
                                <div className="flex items-center mt-1">
                                  {projectMetrics && (projectMetrics.progressPercentage < ((projectMetrics.daysElapsed / projectMetrics.daysTotal) * 100) - 10) ? (
                                    <div className="flex items-center text-red-600 text-sm">
                                      <AlertTriangle className="h-4 w-4 mr-1" />
                                      <span>Proyecto retrasado ({Math.round(((projectMetrics.daysElapsed / projectMetrics.daysTotal) * 100) - projectMetrics.progressPercentage)}% de desviación)</span>
                                    </div>
                                  ) : projectMetrics && (projectMetrics.progressPercentage > ((projectMetrics.daysElapsed / projectMetrics.daysTotal) * 100) + 10) ? (
                                    <div className="flex items-center text-green-600 text-sm">
                                      <ThumbsUp className="h-4 w-4 mr-1" />
                                      <span>Proyecto adelantado ({Math.round(projectMetrics.progressPercentage - ((projectMetrics.daysElapsed / projectMetrics.daysTotal) * 100))}% de ventaja)</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center text-blue-600 text-sm">
                                      <CheckCircle className="h-4 w-4 mr-1" />
                                      <span>Proyecto alineado con la planificación</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </AnimatedCard>
                  )}
                  
                  {/* Monitoreo de Riesgos */}
                  {customView.showFinances && (
                    <AnimatedCard delay={700} className="lg:col-span-6">
                      <Card className="shadow-sm hover:shadow-md transition-shadow h-full">
                        <CardHeader className="border-b">
                          <CardTitle className="text-lg font-medium flex items-center">
                            <div className="mr-3 p-2 rounded-full bg-primary/10">
                              <AlertCircle className="h-5 w-5 text-primary" />
                            </div>
                            Monitoreo de Riesgos
                          </CardTitle>
                          <CardDescription>
                            Alertas tempranas y factores críticos
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                          <div className="space-y-6">
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Presupuesto</p>
                              <div className="relative pt-1">
                                <div className="flex mb-2 items-center justify-between">
                                  <div>
                                    <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-primary bg-primary/10">
                                      Presupuesto utilizado
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-xs font-semibold inline-block">
                                      {Math.round(costSummary?.percentageUsed || 0)}%
                                    </span>
                                  </div>
                                </div>
                                <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-primary/10">
                                  <div 
                                    style={{ width: `${Math.min(costSummary?.percentageUsed || 0, 100)}%` }} 
                                    className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                                      (costSummary?.percentageUsed || 0) > 90 ? "bg-red-500" : "bg-primary"
                                    }`}
                                  ></div>
                                </div>
                                <div className="flex items-center">
                                  {(costSummary?.percentageUsed || 0) <= 25 ? (
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                      <CheckCircle className="h-3 w-3 mr-1" /> Bajo
                                    </Badge>
                                  ) : (costSummary?.percentageUsed || 0) <= 90 ? (
                                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                                      <AlertCircle className="h-3 w-3 mr-1" /> Medio
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                      <AlertTriangle className="h-3 w-3 mr-1" /> Alto
                                    </Badge>
                                  )}
                                  <span className="text-xs text-muted-foreground ml-2">
                                    Nivel de riesgo presupuestario
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Tiempo</p>
                              <div className="relative pt-1">
                                <div className="flex mb-2 items-center justify-between">
                                  <div>
                                    <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-primary bg-primary/10">
                                      Progreso del proyecto
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-xs font-semibold inline-block">
                                      {isNaN(projectMetrics?.progressPercentage) ? "0" : Math.round(projectMetrics?.progressPercentage || 0)}%
                                    </span>
                                  </div>
                                </div>
                                <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-primary/10">
                                  <div 
                                    style={{ width: `${isNaN(projectMetrics?.progressPercentage) ? 0 : Math.round(projectMetrics?.progressPercentage || 0)}%` }} 
                                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary"
                                  ></div>
                                </div>
                                <div className="flex items-center">
                                  {projectMetrics && projectMetrics.progressPercentage < ((projectMetrics.daysElapsed / projectMetrics.daysTotal) * 100) - 10 ? (
                                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                      <AlertTriangle className="h-3 w-3 mr-1" /> Alto
                                    </Badge>
                                  ) : projectMetrics && projectMetrics.progressPercentage < ((projectMetrics.daysElapsed / projectMetrics.daysTotal) * 100) - 5 ? (
                                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                                      <AlertCircle className="h-3 w-3 mr-1" /> Medio
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                      <CheckCircle className="h-3 w-3 mr-1" /> Bajo
                                    </Badge>
                                  )}
                                  <span className="text-xs text-muted-foreground ml-2">
                                    Nivel de riesgo en cronograma
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <Separator />
                            
                            <div className="space-y-2">
                              <h3 className="text-sm font-medium">Alertas activas</h3>
                              <ul className="space-y-2">
                                {/* Renderizar todas las alertas basadas en el estado actual*/}
                                {costSummary && costSummary.percentageUsed > 90 && (
                                  <li className="flex items-start">
                                    <AlertTriangle className="h-4 w-4 mr-2 text-red-500 mt-0.5" />
                                    <div>
                                      <p className="text-sm">Presupuesto casi agotado ({Math.round(costSummary.percentageUsed)}%)</p>
                                      <p className="text-xs text-muted-foreground">Se recomienda evaluar si es necesario ampliar el presupuesto.</p>
                                    </div>
                                  </li>
                                )}
                                
                                {projectMetrics && projectMetrics.progressPercentage < ((projectMetrics.daysElapsed / projectMetrics.daysTotal) * 100) - 10 && (
                                  <li className="flex items-start">
                                    <AlertTriangle className="h-4 w-4 mr-2 text-red-500 mt-0.5" />
                                    <div>
                                      <p className="text-sm">Progreso retrasado respecto al tiempo transcurrido</p>
                                      <p className="text-xs text-muted-foreground">
                                        Tiempo transcurrido: {Math.round((projectMetrics.daysElapsed / projectMetrics.daysTotal) * 100)}%, 
                                        Progreso: {Math.round(projectMetrics.progressPercentage)}%.
                                      </p>
                                    </div>
                                  </li>
                                )}
                                
                                {billableHours < totalHours * 0.7 && totalHours > 0 && (
                                  <li className="flex items-start">
                                    <AlertCircle className="h-4 w-4 mr-2 text-amber-500 mt-0.5" />
                                    <div>
                                      <p className="text-sm">Alto porcentaje de horas no facturables ({Math.round((nonBillableHours/totalHours)*100)}%)</p>
                                      <p className="text-xs text-muted-foreground">Considere revisar la distribución de las actividades.</p>
                                    </div>
                                  </li>
                                )}
                                
                                {/* Si no hay alertas, mostrar mensaje positivo */}
                                {(!costSummary || costSummary.percentageUsed <= 90) && 
                                (!projectMetrics || projectMetrics.progressPercentage >= ((projectMetrics.daysElapsed / projectMetrics.daysTotal) * 100) - 10) &&
                                (billableHours >= totalHours * 0.7 || totalHours === 0) && (
                                  <li className="flex items-start">
                                    <CheckCircle className="h-4 w-4 mr-2 text-green-500 mt-0.5" />
                                    <div>
                                      <p className="text-sm">No hay alertas activas</p>
                                      <p className="text-xs text-muted-foreground">El proyecto está avanzando según lo planificado.</p>
                                    </div>
                                  </li>
                                )}
                              </ul>
                            </div>

                            <div className="flex justify-end">
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4 mr-2" />
                                Ver plan de mitigación
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </AnimatedCard>
                  )}
                </div>

                {/* Sección de Gráficos y Visualizaciones */}
                <h2 className="text-xl font-semibold mt-8 mb-4 flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Análisis y visualizaciones
                </h2>
                
                {customView.showCharts && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
                    {/* Distribución de Horas por Personal - Ocupa 6 columnas */}
                    <AnimatedCard delay={700} className="lg:col-span-6">
                      <Card className="shadow-sm hover:shadow-md transition-shadow h-full">
                        <CardHeader className="border-b">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg font-medium flex items-center">
                                <BarChart3 className="h-5 w-5 mr-2 text-primary" />
                                Distribución de Horas por Personal
                              </CardTitle>
                              <CardDescription>
                                Desglose del tiempo registrado por cada persona
                              </CardDescription>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => setExpandedChart({
                                isOpen: true,
                                title: "Distribución de Horas por Personal",
                                type: "personnelBar"
                              })}
                            >
                              <ExpandIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                          <div className="h-[300px]"> {/* Altura fija para el gráfico */}
                            {timeByPersonnelData.length === 0 ? (
                              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                <Clock className="h-10 w-10 mb-2" />
                                <p>No hay datos disponibles</p>
                              </div>
                            ) : chartType === "bar" ? (
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={timeByPersonnelData}
                                  margin={{ top: 5, right: 30, left: 20, bottom: 40 }}
                                  barSize={chartType === "bar" ? 30 : 10}
                                >
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                  <XAxis 
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    angle={-45}
                                    textAnchor="end"
                                    height={70}
                                    tick={{
                                      fontSize: 12
                                    }}
                                  />
                                  <YAxis 
                                    axisLine={false}
                                    tickLine={false}
                                  />
                                  <RechartsTooltip 
                                    formatter={(value, name, props) => {
                                      const data = props.payload;
                                      if (data) {
                                        return [
                                          <div key={`tooltip-${name}`} className="space-y-1">
                                            <p className="text-sm mb-1">
                                              <span className="font-medium">Nombre:</span> {data.name}
                                            </p>
                                            <p className="text-sm mb-1">
                                              <span className="font-medium">Rol:</span> {data.role}
                                            </p>
                                            <p className="text-sm mb-1">
                                              <span className="font-medium">Horas:</span> {data.hours}
                                            </p>
                                            <p className="text-sm">
                                              <span className="font-medium">Costo:</span> {formatCurrency(data.cost)}
                                            </p>
                                          </div>
                                        ];
                                      }
                                      return null;
                                    }}
                                  />
                                  <Legend iconType="circle" />
                                  <Bar 
                                    dataKey="hours" 
                                    fill="#4f46e5" 
                                    name="Horas"
                                    radius={[4, 4, 0, 0]}
                                    animationDuration={1500}
                                  />
                                </BarChart>
                              </ResponsiveContainer>
                            ) : chartType === "line" ? (
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                  data={timeByPersonnelData}
                                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                  <XAxis 
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                  />
                                  <YAxis 
                                    axisLine={false}
                                    tickLine={false}
                                  />
                                  <RechartsTooltip 
                                    formatter={(value) => [`${value} horas`, "Horas"]}
                                    contentStyle={{ 
                                      borderRadius: '8px',
                                      border: '1px solid rgba(0, 0, 0, 0.1)',
                                      boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)'
                                    }}
                                  />
                                  <Legend />
                                  <Line 
                                    type="monotone" 
                                    dataKey="hours" 
                                    stroke="#4f46e5" 
                                    activeDot={{ r: 8 }}
                                    name="Horas"
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            ) : (
                              <ResponsiveContainer width="100%" height="100%">
                                <RadarChart 
                                  cx="50%" 
                                  cy="50%" 
                                  outerRadius="80%" 
                                  data={timeByPersonnelData}
                                >
                                  <PolarGrid />
                                  <PolarAngleAxis dataKey="name" />
                                  <PolarRadiusAxis />
                                  <Radar 
                                    name="Horas" 
                                    dataKey="hours" 
                                    stroke="#4f46e5" 
                                    fill="#4f46e5" 
                                    fillOpacity={0.6}
                                  />
                                  <RechartsTooltip />
                                  <Legend />
                                </RadarChart>
                              </ResponsiveContainer>
                            )}
                          </div>
                        </CardContent>
                        <CardFooter className="border-t pt-3 pb-3 flex justify-between">
                          <TooltipProvider>
                            <div className="flex space-x-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="outline"
                                    size="sm" 
                                    onClick={() => setLocation(`/active-projects/${project.id}/time-entries`)}
                                  >
                                    <PlusCircle className="h-4 w-4 mr-1" />
                                    Registrar
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Registrar horas</p>
                                </TooltipContent>
                              </Tooltip>
                              
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setShowHelp({
                                        isOpen: true,
                                        title: "Información sobre Roles",
                                        content: "El costo por hora se calcula según el rol del personal: \n\n" +
                                          rolesInfo.map(role => `- ${role.name}: ${formatCurrency(role.hourlyRate)}/hora`).join("\n")
                                      });
                                    }}
                                  >
                                    <HelpCircleIcon className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Ayuda sobre roles</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TooltipProvider>
                          
                          <TooltipProvider>
                            <div className="flex space-x-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant={chartType === "bar" ? "default" : "outline"} 
                                    size="sm"
                                    onClick={() => setChartType("bar")}
                                  >
                                    <BarChart3 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Gráfico de barras</p>
                                </TooltipContent>
                              </Tooltip>
                              
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant={chartType === "line" ? "default" : "outline"} 
                                    size="sm"
                                    onClick={() => setChartType("line")}
                                  >
                                    <LineChartIcon className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Gráfico de línea</p>
                                </TooltipContent>
                              </Tooltip>
                              
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant={chartType === "radar" ? "default" : "outline"} 
                                    size="sm"
                                    onClick={() => setChartType("radar")}
                                  >
                                    <Zap className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Gráfico radar</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TooltipProvider>
                        </CardFooter>
                      </Card>
                    </AnimatedCard>

                    {/* Horas Facturables vs No Facturables - Ocupa 6 columnas */}
                    <AnimatedCard delay={800} className="lg:col-span-6">
                      <Card className="shadow-sm hover:shadow-md transition-shadow h-full">
                        <CardHeader className="border-b">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg font-medium flex items-center">
                                <PieChartIcon className="h-5 w-5 mr-2 text-primary" />
                                Horas Facturables vs No Facturables
                              </CardTitle>
                              <CardDescription>
                                Distribución de horas por tipo de facturación
                              </CardDescription>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => setExpandedChart({
                                isOpen: true,
                                title: "Horas Facturables vs No Facturables",
                                type: "billablePie"
                              })}
                            >
                              <ExpandIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                          <div className="h-[300px] flex items-center justify-center">
                            {billableHours + nonBillableHours === 0 ? (
                              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                <Clock className="h-10 w-10 mb-2" />
                                <p>No hay datos disponibles</p>
                              </div>
                            ) : (
                              <div className="w-full h-full relative">
                                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center z-10 pointer-events-none">
                                  <p className="text-2xl font-bold">{totalHours.toFixed(1)}</p>
                                  <p className="text-sm text-muted-foreground">Horas totales</p>
                                </div>
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie
                                      data={billabilityData}
                                      cx="50%"
                                      cy="50%"
                                      innerRadius={70}
                                      outerRadius={90}
                                      paddingAngle={2}
                                      dataKey="value"
                                      nameKey="name"
                                      animationDuration={1500}
                                    >
                                      {billabilityData.map((entry, index) => (
                                        <Cell 
                                          key={`cell-${index}`} 
                                          fill={entry.color} 
                                          stroke={entry.color}
                                        />
                                      ))}
                                    </Pie>
                                    <RechartsTooltip 
                                      formatter={(value, name) => [
                                        `${value.toFixed(1)} horas (${((value / totalHours) * 100).toFixed(1)}%)`, 
                                        name
                                      ]}
                                      contentStyle={{ 
                                        borderRadius: '8px',
                                        border: '1px solid rgba(0, 0, 0, 0.1)',
                                        boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)'
                                      }}
                                    />
                                    <Legend 
                                      verticalAlign="bottom" 
                                      align="center"
                                      layout="horizontal"
                                      iconType="circle"
                                    />
                                  </PieChart>
                                </ResponsiveContainer>
                              </div>
                            )}
                          </div>
                        </CardContent>
                        <CardFooter className="border-t pt-3 pb-3 flex justify-between">
                          <TooltipProvider>
                            <div className="flex space-x-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="outline"
                                    size="sm" 
                                    onClick={() => setLocation(`/active-projects/${project.id}/time-entries`)}
                                  >
                                    <PlusCircle className="h-4 w-4 mr-1" />
                                    Registrar
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Registrar horas</p>
                                </TooltipContent>
                              </Tooltip>
                              
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setShowHelp({
                                        isOpen: true,
                                        title: "Horas Facturables vs No Facturables",
                                        content: "• Las horas facturables son aquellas que se cobran al cliente según lo acordado en el contrato.\n\n" +
                                          "• Las horas no facturables son trabajo interno que no se cobra al cliente, como reuniones internas, capacitación o trabajo administrativo."
                                      });
                                    }}
                                  >
                                    <HelpCircleIcon className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>¿Qué significa esto?</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TooltipProvider>
                        </CardFooter>
                      </Card>
                    </AnimatedCard>
                  </div>
                )}
                
                {/* Sección de gráficos adicionales */}
                {customView.showCharts && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 mt-6">
                    {/* Evolución de Tiempo y Costo - Ocupa 8 columnas */}
                    <AnimatedCard delay={900} className="lg:col-span-8">
                      <Card className="shadow-sm hover:shadow-md transition-shadow h-full">
                        <CardHeader className="border-b">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg font-medium flex items-center">
                                <LineChartIcon className="h-5 w-5 mr-2 text-primary" />
                                Evolución de Tiempo y Costo
                              </CardTitle>
                              <CardDescription>
                                Progresión temporal de horas y costos del proyecto
                              </CardDescription>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => setExpandedChart({
                                isOpen: true,
                                title: "Evolución de Tiempo y Costo",
                                type: "timeTrend"
                              })}
                            >
                              <ExpandIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                          <div className="h-[300px]">
                            {timeEntriesByDateData.length === 0 ? (
                              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                <Clock className="h-10 w-10 mb-2" />
                                <p>No hay datos disponibles</p>
                              </div>
                            ) : (
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                  data={timeEntriesByDateData}
                                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                  <XAxis 
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{
                                      fontSize: 11
                                    }}
                                  />
                                  <YAxis 
                                    yAxisId="left"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{
                                      fontSize: 11
                                    }}
                                  />
                                  <YAxis 
                                    yAxisId="right"
                                    orientation="right"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{
                                      fontSize: 11
                                    }}
                                  />
                                  <RechartsTooltip 
                                    formatter={(value, name) => {
                                      if (name === "hours") return [`${value} horas`, "Horas"];
                                      if (name === "cost") return [formatCurrency(value as number), "Costo"];
                                      return [value, name];
                                    }}
                                    contentStyle={{ 
                                      borderRadius: '8px',
                                      border: '1px solid rgba(0, 0, 0, 0.1)',
                                      boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)'
                                    }}
                                  />
                                  <Legend iconType="circle" />
                                  <Line
                                    type="monotone"
                                    dataKey="hours"
                                    stroke="#4f46e5"
                                    strokeWidth={2}
                                    yAxisId="left"
                                    name="Horas"
                                    dot={{ r: 3, fill: "#4f46e5", strokeWidth: 1, stroke: "#ffffff" }}
                                    activeDot={{ r: 5, fill: "#4f46e5", strokeWidth: 1, stroke: "#ffffff" }}
                                    animationDuration={1500}
                                  />
                                  <Line
                                    type="monotone"
                                    dataKey="cost"
                                    stroke="#f59e0b"
                                    strokeWidth={2}
                                    yAxisId="right"
                                    name="Costo"
                                    dot={{ r: 3, fill: "#f59e0b", strokeWidth: 1, stroke: "#ffffff" }}
                                    activeDot={{ r: 5, fill: "#f59e0b", strokeWidth: 1, stroke: "#ffffff" }}
                                    animationDuration={1500}
                                    animationBegin={300}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            )}
                          </div>
                        </CardContent>
                        <CardFooter className="border-t pt-3 pb-3 flex justify-start">
                          <TooltipProvider>
                            <div className="flex space-x-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="outline"
                                    size="sm" 
                                    onClick={() => setLocation(`/active-projects/${project.id}/time-entries`)}
                                  >
                                    <Clock className="h-4 w-4 mr-1" />
                                    Ver Registros
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Ver registro de horas</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TooltipProvider>
                        </CardFooter>
                      </Card>
                    </AnimatedCard>

                    {/* Monitoreo de factores de riesgo - Ocupa 4 columnas */}
                    <AnimatedCard delay={1000} className="lg:col-span-4">
                      <Card className="shadow-sm hover:shadow-md transition-shadow h-full">
                        <CardHeader className="border-b">
                          <CardTitle className="text-lg font-medium flex items-center">
                            <div className="mr-3 p-2 rounded-full bg-primary/10">
                              <AlertCircle className="h-5 w-5 text-primary" />
                            </div>
                            Monitoreo de Desviaciones
                          </CardTitle>
                          <CardDescription>
                            Control de desviaciones en costos y tiempo
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                          <div className="space-y-6">
                            <div className="space-y-2">
                              <h3 className="text-sm font-medium flex items-center">
                                <ArrowUpDown className="h-4 w-4 mr-2 text-primary" />
                                Desviación en Costos
                              </h3>
                              <div className="p-3 rounded-md border bg-muted/20 mt-2">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-sm">Presupuesto estimado:</span>
                                  <span className="font-semibold">{formatCurrency(costSummary?.estimatedCost || 0)}</span>
                                </div>
                                <div className="flex justify-between items-center mb-3">
                                  <span className="text-sm">Costo actual:</span>
                                  <span className="font-semibold">{formatCurrency(costSummary?.actualCost || 0)}</span>
                                </div>
                                
                                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                  <span>0%</span>
                                  <span>50%</span>
                                  <span>100%</span>
                                </div>
                                <div className="overflow-hidden h-2 mb-2 text-xs flex rounded bg-gray-100">
                                  <div 
                                    style={{ width: `${Math.min(costSummary?.percentageUsed || 0, 100)}%` }} 
                                    className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                                      (costSummary?.percentageUsed || 0) > 90 ? "bg-red-500" : "bg-primary"
                                    }`}
                                  ></div>
                                </div>
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center">
                                    {costSummary && costSummary.variance >= 0 ? (
                                      <Badge className="bg-green-100 text-green-700 border-0">
                                        <TrendingDown className="h-3 w-3 mr-1" /> 
                                        {formatCurrency(costSummary.variance)} ahorrado
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-red-100 text-red-700 border-0">
                                        <TrendingUp className="h-3 w-3 mr-1" /> 
                                        {formatCurrency(Math.abs(costSummary?.variance || 0))} excedido
                                      </Badge>
                                    )}
                                  </div>
                                  <Badge variant="outline">
                                    {Math.round(costSummary?.percentageUsed || 0)}% utilizado
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            
                            <div className="space-y-2 mt-4">
                              <h3 className="text-sm font-medium flex items-center">
                                <Clock className="h-4 w-4 mr-2 text-primary" />
                                Desviación en Tiempo
                              </h3>
                              <div className="p-3 rounded-md border bg-muted/20 mt-2">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-sm">Tiempo transcurrido:</span>
                                  <span className="font-semibold">{projectMetrics?.daysElapsed || 0} de {projectMetrics?.daysTotal || 0} días</span>
                                </div>
                                <div className="flex justify-between items-center mb-3">
                                  <span className="text-sm">Progreso real:</span>
                                  <span className="font-semibold">{isNaN(projectMetrics?.progressPercentage) ? 0 : Math.round(projectMetrics?.progressPercentage || 0)}%</span>
                                </div>
                                
                                <div className="relative h-2 rounded-full bg-gray-100 mb-2">
                                  {/* Barra de tiempo transcurrido */}
                                  <div 
                                    className="absolute h-full bg-blue-500 rounded-full"
                                    style={{ width: `${Math.round((projectMetrics?.daysElapsed || 0) / Math.max(1, (projectMetrics?.daysTotal || 1)) * 100)}%` }}
                                  ></div>
                                  
                                  {/* Marcador de progreso */}
                                  <div 
                                    className="absolute top-0 w-1 h-4 bg-primary -mt-1 rounded-full"
                                    style={{ 
                                      left: `${isNaN(projectMetrics?.progressPercentage) ? 0 : Math.round(projectMetrics?.progressPercentage || 0)}%`,
                                      transform: 'translateX(-50%)'
                                    }}
                                  ></div>
                                </div>
                                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                                  <span className="text-blue-600">Tiempo</span>
                                  <span className="text-primary">Progreso</span>
                                </div>
                                
                                <div className="flex justify-between items-center">
                                  {projectMetrics && (projectMetrics.progressPercentage < ((projectMetrics.daysElapsed / projectMetrics.daysTotal) * 100) - 10) ? (
                                    <Badge className="bg-red-100 text-red-700 border-0">
                                      <TrendingDown className="h-3 w-3 mr-1" /> 
                                      {Math.round(((projectMetrics.daysElapsed / projectMetrics.daysTotal) * 100) - projectMetrics.progressPercentage)}% retraso
                                    </Badge>
                                  ) : projectMetrics && (projectMetrics.progressPercentage > ((projectMetrics.daysElapsed / projectMetrics.daysTotal) * 100) + 10) ? (
                                    <Badge className="bg-green-100 text-green-700 border-0">
                                      <TrendingUp className="h-3 w-3 mr-1" /> 
                                      {Math.round(projectMetrics.progressPercentage - ((projectMetrics.daysElapsed / projectMetrics.daysTotal) * 100))}% adelanto
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-blue-100 text-blue-700 border-0">
                                      <CheckCircle className="h-3 w-3 mr-1" /> 
                                      En tiempo
                                    </Badge>
                                  )}
                                  <Badge variant="outline">
                                    {Math.round((projectMetrics?.daysElapsed || 0) / Math.max(1, (projectMetrics?.daysTotal || 1)) * 100)}% tiempo
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            
                            <div className="mt-5">
                              <Button variant="outline" className="w-full flex items-center justify-center" size="sm">
                                <Lightbulb className="h-4 w-4 mr-2" />
                                Ver recomendaciones
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </AnimatedCard>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="financial">
                <h2 className="text-xl font-bold">Información Financiera Detallada</h2>
                <p className="text-muted-foreground">Detalles financieros del proyecto, presupuesto, gastos y análisis de costos</p>
                
                <div className="bg-muted/30 p-6 rounded-lg text-center mt-6">
                  <Award className="h-16 w-16 text-primary/40 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Módulo en desarrollo</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    La vista detallada de finanzas estará disponible próximamente. Por favor regresa más tarde.
                  </p>
                </div>
              </TabsContent>
              
              <TabsContent value="hours">
                <h2 className="text-xl font-bold">Detalle de Horas Registradas</h2>
                <p className="text-muted-foreground">Registro detallado de las horas trabajadas por cada miembro del equipo</p>
                
                <div className="bg-muted/30 p-6 rounded-lg text-center mt-6">
                  <Clock3 className="h-16 w-16 text-primary/40 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Módulo en desarrollo</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    La vista detallada de horas estará disponible próximamente. Por favor regresa más tarde.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </ScrollArea>
  );
};

// Define la interfaz para el componente Users
const Users = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
};

// Define la interfaz para el componente HelpCircleIcon
const HelpCircleIcon = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
};

export default ProjectSummary;