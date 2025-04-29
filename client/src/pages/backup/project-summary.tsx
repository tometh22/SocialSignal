import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
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
  Settings,
  Timer,
  Users,
  ShieldAlert,
  Percent,
  Eye
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
    if (level !== "high") level = "medium";
  }

  // Time risk
  if (timeProgress > 100 && daysLeft < 0) {
    risks.push("Plazo excedido");
    level = "high";
  } else if (timeProgress > 90 || daysLeft < 5) {
    risks.push("Plazo por vencer");
    if (level !== "high") level = "medium";
  }

  // Schedule vs budget risk
  if (timeProgress < 50 && budgetUsed > 60) {
    risks.push("Consumo de presupuesto acelerado");
    if (level !== "high") level = "medium";
  }

  if (risks.length === 0) {
    risks.push("Proyecto en curso normal");
  }

  return { level, factors: risks };
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
}> = ({ level }) => {
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

  return (
    <Badge variant="outline" className={`font-normal ${className}`}>
      <span className="flex items-center">
        {icon}
        {label}
      </span>
    </Badge>
  );
};

// Componente principal
const ProjectSummary: React.FC = () => {
  const [, setLocation] = useLocation();
  const params = useParams();
  const projectId = parseInt(params.projectId || "0");
  
  // Tabs y filtros
  const [activeTab, setActiveTab] = useState("overview");
  const [timeFilter, setTimeFilter] = useState("all");
  const [chartType, setChartType] = useState<"bar" | "line" | "radar">("bar");

  // Obtener proyecto activo
  const { data: project, isLoading: isLoadingProject } = useQuery<ActiveProject>({
    queryKey: [`/api/active-projects/${projectId}`],
    enabled: !!projectId,
  });

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

    return {
      timeProgress,
      budgetUsed: costSummary.percentageUsed,
      totalDays,
      daysPassed,
      daysLeft,
      workingDaysLeft,
      hoursPerDay,
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

  const isLoading = 
    isLoadingProject || 
    isLoadingCostSummary || 
    isLoadingTimeEntries ||
    isLoadingPersonnel;

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
          <h1 className="text-3xl font-bold mb-1">
            {project?.quotation?.projectName || "Cargando..."}
          </h1>
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
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Personalizar
            </Button>
            
            <Button variant="outline" size="sm">
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

            {/* Análisis de riesgos */}
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
            
            {/* Tabs de navegación para el contenido */}
            <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full max-w-md mb-4">
                <TabsTrigger value="overview" className="flex-1">Vista general</TabsTrigger>
                <TabsTrigger value="financial" className="flex-1">Finanzas</TabsTrigger>
                <TabsTrigger value="hours" className="flex-1">Registro de horas</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="shadow-sm">
                    <CardHeader className="pb-2 border-b">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-medium flex items-center">
                          <FileText className="h-4 w-4 mr-2 text-primary" />
                          Información del Proyecto
                        </CardTitle>
                        <StatusBadge status={project.status} />
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Fecha de inicio:</span>
                          <span>{formatDate(project.startDate)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Fecha fin esperada:</span>
                          <span>{formatDate(project.expectedEndDate)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Seguimiento:</span>
                          <span className="capitalize">{project.trackingFrequency}</span>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-2 border-t">
                      <Button variant="outline" size="sm" className="w-full" onClick={() => 
                        setLocation(`/active-projects/${project.id}/time-entries`)
                      }>
                        <Clock className="mr-2 h-4 w-4" />
                        Ver Registro de Horas
                      </Button>
                    </CardFooter>
                  </Card>

                  {/* Más contenido aquí */}
                </div>
              </TabsContent>
              
              <TabsContent value="financial">
                {/* Contenido de Finanzas */}
              </TabsContent>
              
              <TabsContent value="hours">
                {/* Contenido de Registro de horas */}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </ScrollArea>
  );
};

export default ProjectSummary;