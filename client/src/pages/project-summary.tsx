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
    showKpi: true,
    showFinances: true,
    showTime: true,
    showRisks: true,
    showCharts: true,
  });
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
    queryKey: ['/api/time-entries/project', parsedProjectId],
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
    queryKey: ['/api/projects', parsedProjectId, 'cost-summary'],
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
      await apiRequest(`/api/quotations/${project.quotationId}`, 'PATCH', {
        projectName: editedName.trim()
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/active-projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/active-projects', parsedProjectId] });
      
      setEditing(false);
    } catch (error) {
      console.error("Error al actualizar el nombre del proyecto:", error);
      setEditing(false);
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
    
    const startDate = new Date(project.startDate);
    const endDate = project.expectedEndDate ? new Date(project.expectedEndDate) : new Date();
    const today = new Date();
    
    const daysTotal = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.ceil((Math.min(today.getTime(), endDate.getTime()) - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Para simplificar, estimamos las horas planificadas proporcionalmente al costo
    const plannedHours = 100; // Valor ficticio para ejemplo
    
    const progressPercentage = Math.min(100, (daysElapsed / Math.max(1, daysTotal)) * 100);
    const hoursPerDay = totalHours / Math.max(1, daysElapsed);
    
    return {
      hoursPerDay,
      progressPercentage,
      plannedHours,
      actualHours: totalHours,
      daysElapsed,
      daysTotal,
    };
  }, [project, timeEntries, totalHours]);

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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
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
                    description={`${projectMetrics?.progressPercentage.toFixed(0)}% completado`}
                    icon={<Calendar className="h-5 w-5" />}
                    color="amber"
                    progress={projectMetrics?.progressPercentage || 0}
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
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
                  {/* Información del Proyecto - Ocupa 4 columnas */}
                  {customView.showFinances && (
                    <AnimatedCard delay={400} className="lg:col-span-4">
                      <Card className="shadow-sm hover:shadow-md transition-shadow h-full">
                        <CardHeader className="pb-3 border-b">
                          <CardTitle className="text-lg font-medium flex items-center">
                            <div className="mr-3 p-2 rounded-full bg-primary/10">
                              <FileText className="h-5 w-5 text-primary" />
                            </div>
                            Información del Proyecto
                          </CardTitle>
                          <div className="flex justify-between items-center">
                            <CardDescription>Estado actual</CardDescription>
                            <StatusBadge status={project.status} />
                          </div>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <div className="space-y-4">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Nombre:</span>
                              <span className="font-medium">{project.quotation?.projectName || "Sin nombre"}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">ID Proyecto:</span>
                              <span>{project.id}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">ID Cotización:</span>
                              <span>{project.quotationId}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Fecha de inicio:</span>
                              <div className="flex items-center">
                                <Calendar className="h-4 w-4 mr-1 text-primary/70" />
                                <span>{formatDate(project.startDate)}</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Fecha fin esperada:</span>
                              <div className="flex items-center">
                                <Calendar className="h-4 w-4 mr-1 text-primary/70" />
                                <span>{formatDate(project.expectedEndDate)}</span>
                              </div>
                            </div>
                            {project.actualEndDate && (
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Fecha fin real:</span>
                                <div className="flex items-center">
                                  <Calendar className="h-4 w-4 mr-1 text-primary/70" />
                                  <span>{formatDate(project.actualEndDate)}</span>
                                </div>
                              </div>
                            )}
                            <Separator />
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Frecuencia de seguimiento:</span>
                              <span className="capitalize">{project.trackingFrequency}</span>
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="pt-0 border-t mt-4">
                          <Button 
                            variant="outline" 
                            className="w-full"
                            onClick={() => setLocation(`/quotations/${project.quotationId}`)}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Ver Cotización Original
                          </Button>
                        </CardFooter>
                      </Card>
                    </AnimatedCard>
                  )}

                  {/* Información Financiera - Ocupa 4 columnas */}
                  {customView.showFinances && (
                    <AnimatedCard delay={500} className="lg:col-span-4">
                      <Card className="shadow-sm hover:shadow-md transition-shadow h-full">
                        <CardHeader className="pb-3 border-b">
                          <CardTitle className="text-lg font-medium flex items-center">
                            <div className="mr-3 p-2 rounded-full bg-primary/10">
                              <DollarSign className="h-5 w-5 text-primary" />
                            </div>
                            Información Financiera
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <div className="space-y-4">
                            <div className="flex flex-col">
                              <span className="text-sm text-muted-foreground mb-1">Costo estimado:</span>
                              <span className="text-xl font-bold">
                                {formatCurrency(costSummary?.estimatedCost || 0)}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm text-muted-foreground mb-1">Costo actual:</span>
                              <span className="text-xl font-bold">
                                {formatCurrency(costSummary?.actualCost || 0)}
                              </span>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Variación:</span>
                              <div className="flex items-center">
                                {costSummary && costSummary.variance >= 0 ? (
                                  <>
                                    <TrendingDown className="h-4 w-4 mr-1 text-green-500" />
                                    <span className="text-green-500 font-medium">
                                      {formatCurrency(costSummary.variance)} ahorrado
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <TrendingUp className="h-4 w-4 mr-1 text-red-500" />
                                    <span className="text-red-500 font-medium">
                                      {formatCurrency(Math.abs(costSummary?.variance || 0))} extra
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="pt-2">
                              <div className="flex justify-between mb-2">
                                <span className="text-sm text-muted-foreground">Presupuesto utilizado:</span>
                                <span className="font-medium">
                                  {Math.round(costSummary?.percentageUsed || 0)}%
                                </span>
                              </div>
                              <Progress 
                                value={costSummary?.percentageUsed || 0} 
                                className={
                                  (costSummary?.percentageUsed || 0) > 100
                                    ? "bg-red-100 text-red-500"
                                    : (costSummary?.percentageUsed || 0) > 90
                                    ? "bg-yellow-100 text-yellow-500"
                                    : "bg-primary/20"
                                }
                              />
                              {(costSummary?.percentageUsed || 0) > 100 && (
                                <div className="flex items-center mt-2 text-red-500 text-xs">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  <span>Presupuesto excedido</span>
                                </div>
                              )}
                              {(costSummary?.percentageUsed || 0) > 90 && (costSummary?.percentageUsed || 0) <= 100 && (
                                <div className="flex items-center mt-2 text-yellow-500 text-xs">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  <span>Presupuesto a punto de agotarse</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="pt-0 border-t mt-4">
                          <Button 
                            variant="outline" 
                            className="w-full"
                            onClick={() => setLocation(`/active-projects/${project.id}/time-entries`)}
                          >
                            <Clock className="mr-2 h-4 w-4" />
                            Ver Registro de Horas
                          </Button>
                        </CardFooter>
                      </Card>
                    </AnimatedCard>
                  )}

                  {/* Resumen de Horas - Ocupa 4 columnas */}
                  {customView.showTime && (
                    <AnimatedCard delay={600} className="lg:col-span-4">
                      <Card className="shadow-sm hover:shadow-md transition-shadow h-full">
                        <CardHeader className="pb-3 border-b">
                          <CardTitle className="text-lg font-medium flex items-center">
                            <div className="mr-3 p-2 rounded-full bg-primary/10">
                              <Clock className="h-5 w-5 text-primary" />
                            </div>
                            Resumen de Horas
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <div className="space-y-4">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Total horas registradas:</span>
                              <span className="font-bold">
                                {totalHours.toFixed(1)} horas
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Horas facturables:</span>
                              <span>
                                {billableHours.toFixed(1)} horas
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Horas no facturables:</span>
                              <span>
                                {nonBillableHours.toFixed(1)} horas
                              </span>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Total registros:</span>
                              <span>{timeEntries?.length || 0} registros</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Personal involucrado:</span>
                              <span>
                                {new Set(timeEntries?.map(e => e.personnelId) || []).size} personas
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Promedio diario:</span>
                              <span>
                                {projectMetrics?.hoursPerDay.toFixed(1)} h/día
                              </span>
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="pt-0 border-t mt-4">
                          <Button 
                            className="w-full"
                            onClick={() => setLocation(`/active-projects/${project.id}/time-entries`)}
                          >
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Registrar Nuevas Horas
                          </Button>
                        </CardFooter>
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
                            <AlertCircle className="h-5 w-5 mr-2 text-primary" />
                            Monitoreo de riesgos
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
                                </div>
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Plazos</p>
                              <div className="relative pt-1">
                                <div className="flex mb-2 items-center justify-between">
                                  <div>
                                    <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-primary bg-primary/10">
                                      Progreso vs plazo
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-xs font-semibold inline-block">
                                      {projectMetrics?.progressPercentage?.toFixed(0) || 0}%
                                    </span>
                                  </div>
                                </div>
                                <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-primary/10">
                                  <div 
                                    style={{ width: `${projectMetrics?.progressPercentage || 0}%` }} 
                                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary"
                                  ></div>
                                </div>
                                <div className="flex items-center">
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    <CheckCircle className="h-3 w-3 mr-1" /> Bajo
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="mt-6">
                            <div className="flex items-center space-x-2 mb-4">
                              <div className="flex-1">
                                <h3 className="text-sm font-medium">Factores de Riesgo</h3>
                              </div>
                              <div>
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                  Proyecto en curso normal
                                </Badge>
                              </div>
                            </div>
                            
                            <Button variant="outline" className="w-full flex items-center justify-center" size="sm">
                              <Eye className="h-4 w-4 mr-2" />
                              Ver plan de mitigación
                            </Button>
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