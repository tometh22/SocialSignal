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
  CheckCircle,
  ChevronDown,
  Download,
  Maximize2,
  Minimize2,
  Save,
  Share2,
  LayoutGrid,
  Filter,
  RefreshCw,
  Settings,
  Timer,
  Users,
  ShieldAlert,
  Zap,
  Award,
  Percent,
  Eye,
  Clock3,
  UserCheck,
  Bell,
  Info as InfoIcon,
  X as XIcon,
  Expand as ExpandIcon
} from "lucide-react";
import { format, subDays, differenceInDays, differenceInBusinessDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import { toast } from "@/hooks/use-toast";

// Interfaces
interface CostSummary {
  estimatedCost: number;
  actualCost: number;
  variance: number;
  percentageUsed: number;
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

// Risk Calculation
const calculateRiskLevel = (
  timeProgress: number,
  budgetUsed: number,
  daysLeft: number
): { level: "low" | "medium" | "high"; factors: string[] } => {
  const risks: string[] = [];
  let level: "low" | "medium" | "high" = "low";

  // Budget risk
  if (budgetUsed > 110) {
    risks.push("Presupuesto excedido más del 10%");
    level = "high";
  } else if (budgetUsed > 90) {
    risks.push("Presupuesto cercano al límite");
    if (level === "low") level = "medium";
  }

  // Time risk
  if (timeProgress > 100 && daysLeft < 0) {
    risks.push("Plazo excedido");
    level = "high";
  } else if (timeProgress > 90 || daysLeft < 5) {
    risks.push("Plazo por vencer");
    if (level === "low") level = "medium";
  }

  // Schedule vs budget risk
  if (timeProgress < 50 && budgetUsed > 60) {
    risks.push("Consumo de presupuesto acelerado");
    if (level === "low") level = "medium";
  }

  if (risks.length === 0) {
    risks.push("Proyecto en curso normal");
  }

  return { level, factors: risks };
};

// Component Wrappers for Animation
const AnimatedCard: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
}> = ({ children, delay = 0, className = "" }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100 + delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`transition-all duration-500 ${
        isVisible 
          ? "opacity-100 transform translate-y-0" 
          : "opacity-0 transform translate-y-4"
      } ${className}`}
    >
      {children}
    </div>
  );
};

// Status Badge Component
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const statusConfig = {
    active: { 
      className: "bg-green-500 hover:bg-green-600", 
      label: "Activo" 
    },
    completed: { 
      className: "bg-blue-500 hover:bg-blue-600", 
      label: "Completado" 
    },
    "on-hold": { 
      className: "bg-yellow-500 hover:bg-yellow-600", 
      label: "En Pausa" 
    },
    cancelled: { 
      className: "bg-red-500 hover:bg-red-600", 
      label: "Cancelado" 
    }
  };

  const config = statusConfig[status as keyof typeof statusConfig] || 
    { className: "bg-slate-500", label: "Desconocido" };

  return (
    <Badge className={config.className}>
      {config.label}
    </Badge>
  );
};

// Risk Badge Component
const RiskBadge: React.FC<{ 
  level: "low" | "medium" | "high";
  tooltip?: string;
}> = ({ level, tooltip }) => {
  const config = {
    low: { 
      className: "bg-green-100 text-green-800 hover:bg-green-200", 
      icon: <CheckCircle className="h-3.5 w-3.5 mr-1" />,
      label: "Bajo"
    },
    medium: { 
      className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200", 
      icon: <AlertCircle className="h-3.5 w-3.5 mr-1" />,
      label: "Medio"
    },
    high: { 
      className: "bg-red-100 text-red-800 hover:bg-red-200", 
      icon: <AlertTriangle className="h-3.5 w-3.5 mr-1" />,
      label: "Alto"
    }
  };

  const { className, icon, label } = config[level];

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`font-normal ${className}`}>
              <span className="flex items-center">
                {icon}
                {label}
              </span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs p-4">
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Badge variant="outline" className={`font-normal ${className}`}>
      <span className="flex items-center">
        {icon}
        {label}
      </span>
    </Badge>
  );
};

// Modal para gráficos expandidos
const ChartModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg w-[90vw] h-[90vh] flex flex-col max-w-6xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold">{title}</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-full"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 p-4 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

// Componente principal
const ProjectSummary: React.FC = () => {
  const [, setLocation] = useLocation();
  const params = useParams();
  const projectId = parseInt(params.projectId || "0");
  
  // Modal de gráficos
  const [expandedChart, setExpandedChart] = useState<{
    isOpen: boolean;
    title: string;
    type: 'personnelBar' | 'billablePie' | 'timeTrend' | null;
  }>({
    isOpen: false,
    title: "",
    type: null
  });
  
  // Tabs y filtros
  const [activeTab, setActiveTab] = useState("overview");
  const [timeFilter, setTimeFilter] = useState("all");
  const [chartType, setChartType] = useState<"bar" | "line" | "radar">("bar");
  const [customView, setCustomView] = useState<{
    showKpi: boolean;
    showFinances: boolean;
    showTime: boolean;
    showRisks: boolean;
    showCharts: boolean;
  }>({
    showKpi: true,
    showFinances: true,
    showTime: true,
    showRisks: true,
    showCharts: true
  });
  
  // Obtener proyecto activo
  const { data: project, isLoading: isLoadingProject } = useQuery<ActiveProject>({
    queryKey: [`/api/active-projects/${projectId}`],
    enabled: !!projectId,
  });
  
  // Editor del nombre del proyecto
  const [editing, setEditing] = useState(false);
  const [editedName, setEditedName] = useState("");
  
  // Efecto para inicializar el nombre cuando se carga el proyecto
  useEffect(() => {
    if (project?.quotation?.projectName) {
      setEditedName(project.quotation.projectName);
    }
  }, [project?.quotation?.projectName]);
  
  // Guardar el nombre del proyecto
  const handleSaveProjectName = async () => {
    if (!editedName.trim()) {
      toast({
        title: "Error",
        description: "El nombre del proyecto no puede estar vacío",
        variant: "destructive",
      });
      return;
    }
    
    // Mostrar toast de carga
    const toastId = toast({
      title: "Actualizando nombre...",
      description: "Guardando cambios en el servidor",
    });
    
    try {
      // Hacemos la petición para actualizar el nombre del proyecto
      const response = await fetch(`/api/projects/${projectId}/update-name`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: editedName.trim() }),
      });
      
      if (!response.ok) {
        throw new Error('Error al actualizar el nombre del proyecto');
      }
      
      toast({
        title: "Nombre actualizado",
        description: `El proyecto ahora se llama "${editedName}"`,
      });
      
      // Invalidar la caché de consultas para recargar los datos actualizados
      await queryClient.invalidateQueries({ queryKey: [`/api/active-projects/${projectId}`] });
      
      setEditing(false);
    } catch (error) {
      console.error("Error updating project name:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el nombre del proyecto. Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  };

  // Obtener resumen de costos
  const { data: costSummary, isLoading: isLoadingCostSummary } = useQuery<CostSummary>({
    queryKey: [`/api/projects/${projectId}/cost-summary`],
    enabled: !!projectId,
  });

  // Obtener registros de tiempo
  const { data: timeEntries, isLoading: isLoadingTimeEntries } = useQuery<TimeEntry[]>({
    queryKey: [`/api/time-entries/project/${projectId}`],
    enabled: !!projectId,
  });

  // Obtener personal
  const { data: personnel, isLoading: isLoadingPersonnel } = useQuery<Personnel[]>({
    queryKey: ['/api/personnel'],
  });
  
  // Obtener roles
  const { data: roles, isLoading: isLoadingRoles } = useQuery<Role[]>({
    queryKey: ['/api/roles'],
  });

  // Total de horas calculado una sola vez
  const totalHours = useMemo(() => {
    return timeEntries?.reduce((acc, entry) => acc + entry.hours, 0) || 0;
  }, [timeEntries]);

  // Horas facturables calculadas una sola vez
  const billableHours = useMemo(() => {
    return timeEntries?.filter(e => e.billable).reduce((acc, entry) => acc + entry.hours, 0) || 0;
  }, [timeEntries]);

  // Horas no facturables calculadas una sola vez
  const nonBillableHours = useMemo(() => {
    return timeEntries?.filter(e => !e.billable).reduce((acc, entry) => acc + entry.hours, 0) || 0;
  }, [timeEntries]);

  // Formatear fecha
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return format(new Date(dateString), "dd MMM yyyy", { locale: es });
  };

  // Formatear dinero
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Calcular KPIs y progreso
  const projectMetrics = useMemo(() => {
    if (!project || !costSummary || !timeEntries) return null;

    let startDate = new Date(project.startDate);
    let endDate = project.expectedEndDate ? new Date(project.expectedEndDate) : new Date();
    let today = new Date();
    
    // Días totales del proyecto
    const totalDays = differenceInDays(endDate, startDate) || 1;
    
    // Días transcurridos
    const daysPassed = differenceInDays(today, startDate);
    
    // Días restantes (pueden ser negativos si estamos fuera de plazo)
    const daysLeft = differenceInDays(endDate, today);
    
    // Días laborables restantes
    const workingDaysLeft = differenceInBusinessDays(endDate, today);
    
    // Porcentaje de tiempo transcurrido
    const timeProgress = Math.min(100, Math.round((daysPassed / totalDays) * 100));
    
    // Calcular riesgos
    const risk = calculateRiskLevel(
      timeProgress, 
      costSummary.percentageUsed,
      daysLeft
    );

    // Calcular velocidad de registro de horas
    // Promedio de horas por día
    const hoursPerDay = timeEntries.length > 0 
      ? totalHours / Math.max(1, daysPassed)
      : 0;
      
    // Tendencia de costos (simulada para demostración)
    const costTrend = {
      value: 5.2,
      isPositive: costSummary.percentageUsed < 50
    };
    
    // Tendencia de tiempo (simulada para demostración)
    const timeTrend = {
      value: 3.8,
      isPositive: timeProgress < 50
    };

    return {
      timeProgress,
      budgetUsed: costSummary.percentageUsed,
      totalDays,
      daysPassed,
      daysLeft,
      workingDaysLeft,
      hoursPerDay,
      costTrend,
      timeTrend,
      risk
    };
  }, [project, costSummary, timeEntries, totalHours]);

  // Filtrar datos por periodo de tiempo
  const filterDataByTime = (data: any[], dateKey: string = 'date') => {
    if (!data || !data.length || timeFilter === 'all') return data;

    const today = new Date();
    const filterDate = timeFilter === 'week' 
      ? subDays(today, 7) 
      : timeFilter === 'month' 
        ? subDays(today, 30) 
        : subDays(today, 90); // trimestre
    
    return data.filter(item => {
      const itemDate = new Date(item[dateKey]);
      return itemDate >= filterDate;
    });
  };

  // Preparar datos para gráficos usando useMemo para evitar cálculos repetidos
  const timeByPersonnelData = useMemo(() => {
    if (!timeEntries || !personnel || !roles) return [];

    const filteredEntries = filterDataByTime(timeEntries);
    const hoursByPersonnel: Record<number, number> = {};
    
    filteredEntries.forEach(entry => {
      if (!hoursByPersonnel[entry.personnelId]) {
        hoursByPersonnel[entry.personnelId] = 0;
      }
      hoursByPersonnel[entry.personnelId] += entry.hours;
    });

    return Object.keys(hoursByPersonnel).map(personnelId => {
      const id = parseInt(personnelId);
      const person = personnel.find(p => p.id === id);
      const role = roles.find(r => r.id === person?.roleId);
      
      return {
        name: person?.name || "Desconocido",
        role: role?.name || "Sin rol",
        hours: hoursByPersonnel[id],
        cost: hoursByPersonnel[id] * (person?.hourlyRate || 0)
      };
    }).sort((a, b) => b.hours - a.hours);
  }, [timeEntries, personnel, roles, timeFilter]);

  const billableVsNonBillableData = useMemo(() => {
    if (!timeEntries) return [];

    const filteredEntries = filterDataByTime(timeEntries);
    let billableHours = 0;
    let nonBillableHours = 0;

    filteredEntries.forEach(entry => {
      if (entry.billable) {
        billableHours += entry.hours;
      } else {
        nonBillableHours += entry.hours;
      }
    });

    return [
      { name: "Facturable", value: billableHours },
      { name: "No facturable", value: nonBillableHours },
    ];
  }, [timeEntries, timeFilter]);

  const timeEntriesByDateData = useMemo(() => {
    if (!timeEntries) return [];

    const filteredEntries = filterDataByTime(timeEntries);
    const entriesByDate: Record<string, { date: string; hours: number; cost: number }> = {};
    
    filteredEntries.forEach(entry => {
      const dateStr = format(new Date(entry.date), "yyyy-MM-dd");
      const person = personnel?.find(p => p.id === entry.personnelId);
      const hourlyRate = person?.hourlyRate || 0;
      
      if (!entriesByDate[dateStr]) {
        entriesByDate[dateStr] = { 
          date: format(new Date(entry.date), "dd MMM"), 
          hours: 0,
          cost: 0
        };
      }
      entriesByDate[dateStr].hours += entry.hours;
      entriesByDate[dateStr].cost += entry.hours * hourlyRate;
    });

    return Object.values(entriesByDate).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [timeEntries, personnel, timeFilter]);

  const radarData = useMemo(() => {
    if (!timeEntries || !personnel) return [];
    
    // Categorías para el radar
    const categories = ["Análisis", "Desarrollo", "Diseño", "Pruebas", "Gestión"];
    
    // Crear datos para el radar con valores simulados
    const data = categories.map(category => {
      return {
        subject: category,
        A: Math.floor(Math.random() * 100) + 20,
        B: Math.floor(Math.random() * 100) + 10,
        fullMark: 150
      };
    });
    
    return data;
  }, [timeEntries, personnel]);

  // Simular exportación de informe 
  const handleExportReport = () => {
    toast({
      title: "Exportando informe",
      description: "El informe del proyecto se está generando y se descargará automáticamente.",
    });

    // Simular la descarga tras un breve retraso
    setTimeout(() => {
      toast({
        title: "Exportación completada",
        description: "El informe se ha descargado con éxito.",
      });
    }, 1500);
  };

  // Guardar vista personalizada
  const handleSaveView = () => {
    toast({
      title: "Vista personalizada guardada",
      description: "Tu configuración de dashboard ha sido guardada.",
    });
  };

  const pieChartColors = ["#4f46e5", "#f97316", "#10b981", "#f43f5e"];

  const isLoading = 
    isLoadingProject || 
    isLoadingCostSummary || 
    isLoadingTimeEntries ||
    isLoadingPersonnel;
    
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
                    fontWeight: 500,
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
                  formatter={(value, name, entry) => {
                    if (name === "hours") {
                      return [`${value} horas`, "Horas"];
                    } else if (name === "cost") {
                      return [formatCurrency(value as number), "Costo"];
                    }
                    return [value, name];
                  }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-4 rounded-md shadow-md border border-gray-200">
                          <p className="font-bold mb-2 text-lg">{data.name}</p>
                          <p className="text-sm text-gray-600 mb-3">
                            <span className="font-medium">Rol:</span> {data.role}
                          </p>
                          <p className="text-sm mb-2">
                            <span className="font-medium">Horas:</span> {data.hours}
                          </p>
                          <p className="text-sm">
                            <span className="font-medium">Costo:</span> {formatCurrency(data.cost)}
                          </p>
                        </div>
                      );
                    }
                    return null;
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
                  data={billableVsNonBillableData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  outerRadius={250}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, value, percent }) => 
                    `${name}: ${value} horas (${(percent * 100).toFixed(0)}%)`
                  }
                  animationDuration={1500}
                  animationBegin={300}
                >
                  {billableVsNonBillableData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={index === 0 ? "#4f46e5" : "#f97316"} 
                    />
                  ))}
                </Pie>
                <RechartsTooltip 
                  formatter={(value) => [`${value} horas`, "Horas"]}
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
                  <AlertDialogAction onClick={handleSaveView}>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar configuración
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            <Button variant="outline" size="sm" onClick={handleExportReport}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-[400px]">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Cargando datos del proyecto...</p>
            </div>
          </div>
        ) : !project ? (
          <Card className="w-full max-w-3xl mx-auto shadow-md">
            <CardHeader className="bg-muted/30">
              <CardTitle>Proyecto no encontrado</CardTitle>
              <CardDescription>
                El proyecto especificado no existe o no está disponible.
              </CardDescription>
            </CardHeader>
            <CardFooter className="border-t py-4">
              <Button onClick={() => setLocation("/active-projects")}>
                Ver todos los proyectos
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <>
            {/* KPI Cards - Layout limpio y claro */}
            {customView.showKpi && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <KpiCard
                  title="Progreso del proyecto"
                  value={`${projectMetrics?.timeProgress || 0}%`}
                  icon={<Percent className="h-5 w-5 text-blue-600" />}
                  trend={{
                    value: 3.8,
                    isPositive: true
                  }}
                />
                
                <KpiCard
                  title="Presupuesto utilizado"
                  value={`${Math.round(costSummary?.percentageUsed || 0)}%`}
                  subtitle={formatCurrency(costSummary?.actualCost || 0)}
                  icon={<DollarSign className="h-5 w-5 text-green-600" />}
                  trend={{
                    value: 5.2,
                    isPositive: true
                  }}
                />
                
                <KpiCard
                  title="Tiempo restante"
                  value={projectMetrics?.daysLeft || 0}
                  subtitle="días"
                  icon={<Timer className="h-5 w-5 text-purple-600" />}
                />
                
                <KpiCard
                  title="Personal asignado"
                  value={new Set(timeEntries?.map(e => e.personnelId) || []).size}
                  subtitle="personas"
                  icon={<Users className="h-5 w-5 text-orange-600" />}
                />
              </div>
            )}

            {/* Análisis de riesgos */}
            {customView.showRisks && (
              <AnimatedCard delay={300}>
                <Card className="mb-8 shadow-sm border bg-white">
                  <CardHeader className="pb-2 border-b">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <ShieldAlert className="h-5 w-5 mr-2 text-primary" />
                        <CardTitle className="text-lg font-medium">Análisis de Riesgos del Proyecto</CardTitle>
                      </div>
                      <RiskBadge level={projectMetrics?.risk.level || "low"} />
                    </div>
                    <CardDescription>
                      Monitoreo de factores de riesgo y alertas tempranas
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-4">
                        <h3 className="text-sm font-medium">Presupuesto</h3>
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
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Presupuesto utilizado</span>
                          <RiskBadge 
                            level={(costSummary?.percentageUsed || 0) > 100 
                              ? "high" 
                              : (costSummary?.percentageUsed || 0) > 90 
                              ? "medium" 
                              : "low"} 
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <h3 className="text-sm font-medium">Plazos</h3>
                        <Progress 
                          value={projectMetrics?.timeProgress || 0} 
                          className={
                            (projectMetrics?.timeProgress || 0) > 100
                              ? "bg-red-100 text-red-500"
                              : (projectMetrics?.timeProgress || 0) > 90
                              ? "bg-yellow-100 text-yellow-500"
                              : "bg-primary/20"
                          }
                        />
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Progreso vs plazo</span>
                          <RiskBadge 
                            level={(projectMetrics?.timeProgress || 0) > 100 
                              ? "high" 
                              : (projectMetrics?.timeProgress || 0) > 90 
                              ? "medium" 
                              : "low"} 
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <h3 className="text-sm font-medium">Factores de Riesgo</h3>
                        <ul className="space-y-2">
                          {projectMetrics?.risk.factors.map((factor, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm">
                              {projectMetrics.risk.level === "high" ? (
                                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                              ) : projectMetrics.risk.level === "medium" ? (
                                <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                              ) : (
                                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                              )}
                              <span>{factor}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-2 border-t">
                    <Button variant="outline" size="sm" className="w-full">
                      <Eye className="mr-2 h-4 w-4" />
                      Ver plan de mitigación de riesgos
                    </Button>
                  </CardFooter>
                </Card>
              </AnimatedCard>
            )}
            
            {/* Tabs de navegación para el contenido */}
            <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full max-w-md mb-4">
                <TabsTrigger value="overview" className="flex-1">Vista general</TabsTrigger>
                <TabsTrigger value="financial" className="flex-1">Finanzas</TabsTrigger>
                <TabsTrigger value="hours" className="flex-1">Registro de horas</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="pt-4">
                {/* Main Three Cards Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                  {customView.showFinances && (
                    <AnimatedCard delay={400}>
                      <Card className="shadow-sm hover:shadow-md transition-shadow">
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
                            onClick={() => setLocation(`/active-projects/${project.id}/time-entries`)}
                          >
                            <Clock className="mr-2 h-4 w-4" />
                            Ver Registro de Horas
                          </Button>
                        </CardFooter>
                      </Card>
                    </AnimatedCard>
                  )}

                  {customView.showFinances && (
                    <AnimatedCard delay={500}>
                      <Card className="shadow-sm hover:shadow-md transition-shadow">
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
                            onClick={() => setLocation(`/quotations/${project.quotationId}`)}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Ver Cotización Original
                          </Button>
                        </CardFooter>
                      </Card>
                    </AnimatedCard>
                  )}

                  {customView.showTime && (
                    <AnimatedCard delay={600}>
                      <Card className="shadow-sm hover:shadow-md transition-shadow">
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
                
                {/* Chart Controls */}
                {customView.showCharts && (
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">Análisis y visualizaciones</h2>
                    <div className="flex items-center space-x-2">
                      <TooltipProvider>
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
                      </TooltipProvider>
                      
                      <TooltipProvider>
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
                      </TooltipProvider>
                      
                      <TooltipProvider>
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
                      </TooltipProvider>
                    </div>
                  </div>
                )}

                {/* Charts Section */}
                {customView.showCharts && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <AnimatedCard delay={700}>
                      <Card className="shadow-sm">
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
                                  margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                                  barSize={40}
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
                                    formatter={(value, name, entry) => {
                                      if (name === "hours") {
                                        return [`${value} horas`, "Horas"];
                                      } else if (name === "cost") {
                                        return [formatCurrency(value as number), "Costo"];
                                      }
                                      return [value, name];
                                    }}
                                    content={({ active, payload, label }) => {
                                      if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                          <div className="bg-white p-3 rounded-md shadow-md border border-gray-200">
                                            <p className="font-bold mb-1">{data.name}</p>
                                            <p className="text-sm text-gray-600 mb-2">
                                              <span className="font-medium">Rol:</span> {data.role}
                                            </p>
                                            <p className="text-sm mb-1">
                                              <span className="font-medium">Horas:</span> {data.hours}
                                            </p>
                                            <p className="text-sm">
                                              <span className="font-medium">Costo:</span> {formatCurrency(data.cost)}
                                            </p>
                                          </div>
                                        );
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
                                  <Legend iconType="circle" />
                                  <Line
                                    type="monotone"
                                    dataKey="hours"
                                    stroke="#4f46e5"
                                    name="Horas"
                                    strokeWidth={3}
                                    dot={{ r: 6, fill: "#4f46e5", strokeWidth: 2, stroke: "#ffffff" }}
                                    activeDot={{ r: 8, fill: "#4f46e5", strokeWidth: 2, stroke: "#ffffff" }}
                                    animationDuration={1500}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            ) : (
                              <ResponsiveContainer width="100%" height="100%">
                                <RadarChart 
                                  outerRadius={90} 
                                  width={500} 
                                  height={300} 
                                  data={radarData}
                                >
                                  <PolarGrid />
                                  <PolarAngleAxis dataKey="subject" />
                                  <PolarRadiusAxis />
                                  <Radar
                                    name="Proyecto Actual"
                                    dataKey="A"
                                    stroke="#4f46e5"
                                    fill="#4f46e5"
                                    fillOpacity={0.6}
                                    animationDuration={1500}
                                  />
                                  <Radar
                                    name="Promedio de Proyectos"
                                    dataKey="B"
                                    stroke="#ff7a45"
                                    fill="#ff7a45"
                                    fillOpacity={0.6}
                                    animationDuration={1500}
                                  />
                                  <Legend iconType="circle" />
                                </RadarChart>
                              </ResponsiveContainer>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </AnimatedCard>

                    <AnimatedCard delay={800}>
                      <Card className="shadow-sm">
                        <CardHeader className="border-b">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg font-medium flex items-center">
                                <PieChartIcon className="h-5 w-5 mr-2 text-primary" />
                                Facturable vs No Facturable
                              </CardTitle>
                              <CardDescription>
                                Proporción de horas facturables y no facturables
                              </CardDescription>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => setExpandedChart({
                                isOpen: true,
                                title: "Facturable vs No Facturable",
                                type: "billablePie"
                              })}
                            >
                              <ExpandIcon className="h-4 w-4" />
                            </Button>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 mt-2">
                                <InfoIcon className="h-4 w-4 mr-1" />
                                <span className="text-xs">¿Qué significa esto?</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Horas Facturables vs No Facturables</AlertDialogTitle>
                                <AlertDialogDescription className="space-y-4">
                                  <p><strong>Horas Facturables:</strong> Son horas de trabajo que se cobran directamente al cliente según lo estipulado en el contrato. Esto incluye tareas como análisis de datos, elaboración de informes, reuniones con el cliente, y trabajo de monitoreo social directo.</p>
                                  <p><strong>Horas No Facturables:</strong> Son horas de trabajo interno que no se cobran al cliente. Incluyen capacitaciones, reuniones internas, mantenimiento de plataformas, desarrollo de herramientas, y tiempo administrativo que no está directamente relacionado con los entregables del proyecto.</p>
                                  <p>Esta distinción es importante para el análisis de rentabilidad del proyecto y para entender cómo se distribuye el esfuerzo del equipo.</p>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogAction>Entendido</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </CardHeader>
                        <CardContent className="pt-6">
                          <div className="h-[300px]"> {/* Altura fija para el gráfico */}
                            {billableVsNonBillableData.every(item => item.value === 0) ? (
                              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                <Clock className="h-10 w-10 mb-2" />
                                <p>No hay datos disponibles</p>
                              </div>
                            ) : (
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={billableVsNonBillableData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    outerRadius={120}
                                    fill="#8884d8"
                                    dataKey="value"
                                    label={({ name, percent }) => 
                                      `${name}: ${(percent * 100).toFixed(0)}%`
                                    }
                                    animationDuration={1500}
                                    animationBegin={300}
                                  >
                                    {billableVsNonBillableData.map((entry, index) => (
                                      <Cell 
                                        key={`cell-${index}`} 
                                        fill={index === 0 ? "#4f46e5" : "#f97316"} 
                                      />
                                    ))}
                                  </Pie>
                                  <RechartsTooltip 
                                    formatter={(value) => [`${value} horas`, "Horas"]}
                                    contentStyle={{ 
                                      borderRadius: '8px',
                                      border: '1px solid rgba(0, 0, 0, 0.1)',
                                      boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)'
                                    }}
                                  />
                                </PieChart>
                              </ResponsiveContainer>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </AnimatedCard>
                  </div>
                )}
                
                {/* Time Trend Chart */}
                {customView.showCharts && (
                  <AnimatedCard delay={900}>
                    <Card className="shadow-sm mb-12"> {/* Espacio extra al final */}
                      <CardHeader className="border-b">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg font-medium flex items-center">
                              <LineChartIcon className="h-5 w-5 mr-2 text-primary" />
                              Tendencia de Registro de Horas
                            </CardTitle>
                            <CardDescription>
                              Evolución de las horas registradas a lo largo del tiempo
                            </CardDescription>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => setExpandedChart({
                              isOpen: true,
                              title: "Tendencia de Registro de Horas",
                              type: "timeTrend"
                            })}
                          >
                            <ExpandIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <div className="h-[300px]"> {/* Altura fija para el gráfico */}
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
                                  padding={{ left: 30, right: 30 }}
                                />
                                <YAxis 
                                  axisLine={false}
                                  tickLine={false}
                                  yAxisId="left"
                                />
                                <YAxis 
                                  axisLine={false}
                                  tickLine={false}
                                  orientation="right"
                                  yAxisId="right"
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
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </AnimatedCard>
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

export default ProjectSummary;