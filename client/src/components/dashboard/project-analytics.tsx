import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  BarChart4,
  Calendar,
  Clock,
  DollarSign,
  Download,
  FileText,
  Gauge,
  HelpCircle,
  LineChart,
  PieChart,
  RefreshCw,
  Settings,
  Shield,
  Star,
  Timer,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Tipos de datos
interface ProjectAnalyticsProps {
  project: any;
  costSummary: any;
  timeEntries: any[];
  personnel: any[];
  roles: any[];
  deliverableData: any;
  projectMetrics: {
    hoursPerDay: number;
    progressPercentage: number;
    plannedHours: number;
    actualHours: number;
    daysElapsed: number;
    daysTotal: number;
  };
  riskIndicators: {
    budgetRisk: number;
    scheduleRisk: number;
    activeAlerts: number;
  };
  timeByPersonnelData: any[];
  billableDistributionData: any[];
  onHelpRequest: (topic: string) => void;
  onExpandChart: (type: string, title: string) => void;
  onTimeFilterChange: (filter: string) => void;
  isLoading: boolean;
  timeFilter: string;
}

/**
 * Componente optimizado para análisis de proyectos
 * Con diseño responsivo, espaciado adecuado, y visualización efectiva de datos
 */
const ProjectAnalytics: React.FC<ProjectAnalyticsProps> = ({
  project,
  costSummary,
  timeEntries,
  personnel,
  roles,
  deliverableData,
  projectMetrics,
  riskIndicators,
  timeByPersonnelData,
  billableDistributionData,
  onHelpRequest,
  onExpandChart,
  onTimeFilterChange,
  isLoading,
  timeFilter
}) => {
  // Estado para el modo de visualización
  const [activeTab, setActiveTab] = useState("overview");
  
  // Helpers para formatear datos
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', { 
      style: 'currency', 
      currency: 'ARS',
      maximumFractionDigits: 0 
    }).format(amount);
  };
  
  const formatDate = (dateString: string) => {
    if (!dateString) return 'No definida';
    return format(new Date(dateString), 'dd MMM yyyy', { locale: es });
  };
  
  const formatNumber = (num: number, digits = 1) => {
    return num.toLocaleString('es-AR', { 
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  };

  // Calcular días restantes
  const calculateRemainingDays = () => {
    if (!project?.expectedEndDate) return 'No definido';
    
    const today = new Date();
    const endDate = new Date(project.expectedEndDate);
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > 0 ? diffDays : 0;
  };

  // Determinar color según valor
  const getValueColor = (value: number, thresholds: [number, number, number]) => {
    const [warning, danger, critical] = thresholds;
    
    if (value >= critical) return "text-red-600 font-bold";
    if (value >= danger) return "text-amber-600 font-semibold";
    if (value >= warning) return "text-yellow-600";
    return "text-green-600";
  };
  
  const getBudgetClass = () => {
    const percentUsed = costSummary?.percentageUsed || 0;
    return getValueColor(percentUsed, [75, 90, 100]);
  };
  
  const getRiskClass = (risk: number) => {
    return getValueColor(risk, [30, 60, 75]);
  };

  const getProgressColor = (actual: number, expected: number) => {
    if (actual >= expected) return "bg-green-500";
    if (actual >= expected * 0.8) return "bg-yellow-500";
    return "bg-red-500";
  };
  
  // Renderizar indicadores de riesgo con visualización clara
  const renderRiskIndicator = (risk: number, label: string, helpTopic: string) => {
    const riskClass = getRiskClass(risk);
    
    return (
      <div className="flex flex-col items-center gap-2 p-2 rounded-lg">
        <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" 
            style={{ width: `${risk}%` }}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-lg font-semibold ${riskClass}`}>{risk}%</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help">
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground opacity-70" />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Indicador de riesgo: {label}</p>
                <p className="text-xs text-muted-foreground">
                  {risk < 30 ? "Bajo riesgo" : risk < 60 ? "Riesgo moderado" : "Alto riesgo"}
                </p>
                <Button 
                  variant="link" 
                  size="sm" 
                  className="text-xs p-0 h-auto" 
                  onClick={() => onHelpRequest(helpTopic)}
                >
                  Más información
                </Button>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    );
  };

  // Renderizar contadores de horas
  const renderHoursCounter = (hours: number, label: string, icon: React.ReactNode, className: string = "") => (
    <div className={`flex flex-col gap-1 p-2 ${className}`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-xl font-bold">{formatNumber(hours, 1)}</div>
    </div>
  );

  // Renderizar indicador de progreso
  const renderProgressBar = (
    value: number, 
    max: number, 
    label: string, 
    format: (v: number) => string = (v) => `${v}%`
  ) => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-medium">{format(value)}</span>
      </div>
      <Progress 
        value={value} 
        max={max} 
        className="h-2"
        indicatorClassName={getProgressColor(value, max * 0.8)}
      />
    </div>
  );

  // Renderizar gráficos simulados (en una implementación real serían componentes de recharts)
  const renderChartPlaceholder = (
    title: string, 
    description: string, 
    icon: React.ReactNode, 
    expandType: string,
    height: string = "h-52"
  ) => (
    <Card className="shadow-sm">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6"
            onClick={() => onExpandChart(expandType, title)}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="h-4 w-4"
            >
              <polyline points="15 3 21 3 21 9"></polyline>
              <polyline points="9 21 3 21 3 15"></polyline>
              <line x1="21" y1="3" x2="14" y2="10"></line>
              <line x1="3" y1="21" x2="10" y2="14"></line>
            </svg>
            <span className="sr-only">Expandir</span>
          </Button>
        </div>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className={`p-4 pt-0 ${height}`}>
        <div className="h-full flex items-center justify-center bg-muted/20 rounded-lg">
          <div className="text-center text-muted-foreground text-xs">
            <p>Visualización del gráfico {expandType}</p>
            <p className="text-[10px] mt-1">
              (Esta visualización se implementaría con Recharts)
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Renderizar filtro de tiempo
  const TimeFilter = () => (
    <div className="flex justify-end">
      <div className="inline-flex items-center p-1 rounded-md bg-muted text-xs">
        {["week", "month", "quarter", "all"].map((filter) => (
          <Button
            key={filter}
            variant={timeFilter === filter ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => onTimeFilterChange(filter)}
          >
            {filter === "week" && "Semana"}
            {filter === "month" && "Mes"}
            {filter === "quarter" && "Trimestre"}
            {filter === "all" && "Todo"}
          </Button>
        ))}
      </div>
    </div>
  );

  // Renderizar tarjeta de equipo
  const renderTeamCard = () => (
    <Card className="shadow-sm">
      <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Asignación de Equipo
          </CardTitle>
          <CardDescription className="text-xs">
            Distribución de horas por rol y persona
          </CardDescription>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6"
                onClick={() => onHelpRequest('teamHelp')}
              >
                <HelpCircle className="h-3.5 w-3.5" />
                <span className="sr-only">Ayuda</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Información sobre la asignación del equipo</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {timeByPersonnelData.length > 0 ? (
          <div className="space-y-3 mt-2">
            {timeByPersonnelData.slice(0, 5).map((person, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                  {person.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <div className="flex-1 truncate">
                      <span className="font-medium text-sm">{person.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{person.role}</span>
                    </div>
                    <span className="text-xs font-medium">{formatNumber(person.hours, 1)}h</span>
                  </div>
                  <Progress 
                    value={person.hours} 
                    max={Math.max(...timeByPersonnelData.map(p => p.hours))} 
                    className="h-1.5" 
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            No hay datos de asignación de equipo
          </div>
        )}
      </CardContent>
      <CardFooter className="p-3 pt-0 flex justify-center">
        {timeByPersonnelData.length > 5 && (
          <Button variant="link" size="sm" className="text-xs">
            Ver {timeByPersonnelData.length - 5} más
          </Button>
        )}
      </CardFooter>
    </Card>
  );

  // Renderizar tarjeta de entregables
  const renderDeliverablesCard = () => (
    <Card className="shadow-sm h-full">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Entregables del Proyecto
        </CardTitle>
        <CardDescription className="text-xs">
          Próximos hitos y entregables
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {deliverableData ? (
          <div className="space-y-3 mt-2">
            <div className="rounded-lg bg-primary/5 p-3">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="text-sm font-medium">{deliverableData.name}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{deliverableData.description}</p>
                </div>
                <Badge 
                  variant={deliverableData.status === 'completed' ? 'success' : 'default'}
                  className="text-[10px] h-5"
                >
                  {deliverableData.status === 'completed' ? 'Completado' : 'En progreso'}
                </Badge>
              </div>
              <div className="flex justify-between text-xs mt-3">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Fecha límite:</span>
                  <span className="font-medium">{formatDate(deliverableData.due_date)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Progreso:</span>
                  <span className="font-medium">{deliverableData.progress || 0}%</span>
                </div>
              </div>
              <Progress 
                value={deliverableData.progress || 0} 
                max={100} 
                className="h-1.5 mt-2" 
              />
            </div>
          </div>
        ) : (
          <div className="h-32 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <AlertCircle className="h-6 w-6 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">No hay entregables definidos</p>
            <Button variant="outline" size="sm" className="mt-1 h-8 text-xs">
              Definir entregable
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="w-full max-w-full overflow-x-hidden space-y-6">
      {/* Filtro de tiempo global */}
      <div className="flex justify-end">
        <TimeFilter />
      </div>
      
      {/* Navegación por pestañas */}
      <Tabs 
        defaultValue="overview" 
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid grid-cols-5 mb-6">
          <TabsTrigger value="overview" className="text-xs">
            Vista General
          </TabsTrigger>
          <TabsTrigger value="robustness" className="text-xs">
            Indicadores de Robustez
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs">
            Análisis Detallado
          </TabsTrigger>
          <TabsTrigger value="team" className="text-xs">
            Equipo y Recursos
          </TabsTrigger>
          <TabsTrigger value="deliverables" className="text-xs">
            Entregables
          </TabsTrigger>
        </TabsList>
        
        {/* Contenido: Vista General */}
        <TabsContent value="overview" className="mt-0 space-y-6">
          {/* KPIs principales */}
          <div className="grid grid-cols-3 gap-4">
            {/* Presupuesto */}
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-col h-full">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <DollarSign className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium">Presupuesto</h3>
                        <p className="text-xs text-muted-foreground">Utilización actual</p>
                      </div>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={() => onHelpRequest('costHelp')}
                          >
                            <HelpCircle className="h-3.5 w-3.5" />
                            <span className="sr-only">Ayuda</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Uso del presupuesto asignado</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-between mt-2">
                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline">
                        <span className="text-2xl font-bold">
                          {costSummary?.percentageUsed?.toFixed(1) || 0}%
                        </span>
                        <span className={`text-sm ${getBudgetClass()}`}>
                          {costSummary?.variance > 0 ? '+' : ''}
                          {costSummary?.variance?.toFixed(1) || 0}%
                        </span>
                      </div>
                      
                      <Progress 
                        value={costSummary?.percentageUsed || 0} 
                        max={100} 
                        className="h-2"
                        indicatorClassName={
                          costSummary?.percentageUsed >= 100 ? "bg-red-500" : 
                          costSummary?.percentageUsed >= 85 ? "bg-amber-500" : 
                          "bg-green-500"
                        }
                      />
                      
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div>
                          <p className="text-muted-foreground">Presupuesto</p>
                          <p className="font-medium">{formatCurrency(costSummary?.estimatedCost || 0)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Consumido</p>
                          <p className="font-medium">{formatCurrency(costSummary?.actualCost || 0)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Tiempo */}
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-col h-full">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Timer className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium">Cronograma</h3>
                        <p className="text-xs text-muted-foreground">Progreso del proyecto</p>
                      </div>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6" 
                            onClick={() => onHelpRequest('timeHelp')}
                          >
                            <HelpCircle className="h-3.5 w-3.5" />
                            <span className="sr-only">Ayuda</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Avance del cronograma</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-between mt-2">
                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline">
                        <span className="text-2xl font-bold">
                          {projectMetrics?.progressPercentage?.toFixed(1) || 0}%
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {calculateRemainingDays()} días restantes
                        </span>
                      </div>
                      
                      <Progress 
                        value={projectMetrics?.progressPercentage || 0} 
                        max={100} 
                        className="h-2"
                      />
                      
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div>
                          <p className="text-muted-foreground">Inicio</p>
                          <p className="font-medium">{formatDate(project?.startDate)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Fin estimado</p>
                          <p className="font-medium">{formatDate(project?.expectedEndDate)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Horas */}
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-col h-full">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Clock className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium">Horas Registradas</h3>
                        <p className="text-xs text-muted-foreground">Total y distribución</p>
                      </div>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6" 
                            onClick={() => onHelpRequest('hoursHelp')}
                          >
                            <HelpCircle className="h-3.5 w-3.5" />
                            <span className="sr-only">Ayuda</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Distribución de horas trabajadas</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-between mt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="text-2xl font-bold">
                            {formatNumber(projectMetrics?.actualHours || 0, 1)}h
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {formatNumber(projectMetrics?.hoursPerDay || 0, 1)}h/día
                          </span>
                        </div>
                        
                        <Progress 
                          value={projectMetrics?.actualHours || 0} 
                          max={Math.max(projectMetrics?.plannedHours || 0, projectMetrics?.actualHours || 0)} 
                          className="h-2"
                        />
                      </div>
                      
                      <div className="mt-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="w-3 h-3 rounded-full bg-primary"></div>
                          <span className="text-xs text-muted-foreground">Facturable</span>
                        </div>
                        <p className="font-medium">
                          {formatNumber(billableDistributionData.find(d => d.name === "Facturable")?.value || 0, 1)}h
                        </p>
                      </div>
                      
                      <div className="mt-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                          <span className="text-xs text-muted-foreground">No Facturable</span>
                        </div>
                        <p className="font-medium">
                          {formatNumber(billableDistributionData.find(d => d.name === "No Facturable")?.value || 0, 1)}h
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Indicadores de riesgo y equipo asignado */}
          <div className="grid grid-cols-2 gap-4">
            {/* Indicadores de riesgo */}
            <Card className="shadow-sm">
              <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    Indicadores de Riesgo
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Monitoreo de alertas y desviaciones
                  </CardDescription>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => onHelpRequest('riskHelp')}
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                        <span className="sr-only">Ayuda</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Información sobre los indicadores de riesgo</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  {renderRiskIndicator(riskIndicators.budgetRisk, "Riesgo de presupuesto", "budgetRiskHelp")}
                  {renderRiskIndicator(riskIndicators.scheduleRisk, "Riesgo de cronograma", "scheduleRiskHelp")}
                </div>
                
                <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                    <AlertCircle className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      {riskIndicators.activeAlerts} {riskIndicators.activeAlerts === 1 ? 'alerta' : 'alertas'} activa{riskIndicators.activeAlerts !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-amber-700">
                      {riskIndicators.activeAlerts > 0 
                        ? 'Se requiere atención para mitigar riesgos detectados' 
                        : 'No se detectan riesgos críticos en este momento'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Equipo asignado (versión condensada) */}
            {renderTeamCard()}
          </div>
        </TabsContent>
        
        {/* Contenido: Análisis Detallado */}
        {/* Contenido: Indicadores de Robustez */}
        <TabsContent value="robustness" className="mt-0 space-y-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Gauge className="h-5 w-5 text-primary" />
                Indicadores de Robustez
              </h2>
              <p className="text-sm text-muted-foreground">
                Métricas detalladas sobre la fortaleza del proyecto y áreas de mejora
              </p>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex items-center gap-1"
                      onClick={() => onHelpRequest('robustnessHelp')}
                    >
                      <HelpCircle className="h-4 w-4" />
                      <span>Ayuda</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Obtén más información sobre estos indicadores y cómo se calculan</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          
          {/* Puntuación de Robustez Global */}
          <Card className="shadow-sm border-2 border-primary/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Puntuación Global de Robustez
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Evaluación compuesta basada en múltiples parámetros del proyecto
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-4xl font-bold flex items-center">
                    6.01
                    <span className="text-muted-foreground text-sm ml-1">/10</span>
                  </span>
                  <Star className="h-8 w-8 text-amber-400 fill-amber-400" />
                </div>
              </div>
              
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Bajo</span>
                  <span>Moderado</span>
                  <span>Alto</span>
                  <span>Excelente</span>
                </div>
                <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-red-500 via-amber-500 to-green-500"
                    style={{ width: '60.1%' }}
                  ></div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div className="p-4 rounded-lg bg-green-50 border border-green-100">
                  <h4 className="text-sm font-medium text-green-800 flex items-center gap-1.5 mb-1">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    Puntos fuertes
                  </h4>
                  <ul className="text-xs space-y-1.5 text-green-700">
                    <li className="flex items-start gap-1.5">
                      <span className="mt-0.5">•</span>
                      <span>Calidad de documentación: 8.2/10</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="mt-0.5">•</span>
                      <span>Precisión de estimaciones: 7.5/10</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="mt-0.5">•</span>
                      <span>Satisfacción del cliente: 8.0/10</span>
                    </li>
                  </ul>
                </div>
                
                <div className="p-4 rounded-lg bg-red-50 border border-red-100">
                  <h4 className="text-sm font-medium text-red-800 flex items-center gap-1.5 mb-1">
                    <TrendingDown className="h-4 w-4 text-red-600" />
                    Áreas de mejora
                  </h4>
                  <ul className="text-xs space-y-1.5 text-red-700">
                    <li className="flex items-start gap-1.5">
                      <span className="mt-0.5">•</span>
                      <span>Control de costos: 4.2/10</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="mt-0.5">•</span>
                      <span>Adherencia al cronograma: 5.1/10</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="mt-0.5">•</span>
                      <span>Distribución de cargas de trabajo: 4.8/10</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Categorías de Robustez */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Robustez en Gestión de Horas
                </CardTitle>
                <CardDescription className="text-xs">
                  Análisis de la distribución y eficiencia de horas
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="font-semibold text-primary">5.3</span>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium">Puntuación</h4>
                        <p className="text-xs text-muted-foreground">Moderado</p>
                      </div>
                    </div>
                    <Settings className="h-5 w-5 text-muted-foreground opacity-70" />
                  </div>
                  
                  <div className="space-y-3 pt-2">
                    {[
                      { name: "Distribución por rol", score: 4.8, percentage: 48 },
                      { name: "Eficiencia de horas facturables", score: 6.2, percentage: 62 },
                      { name: "Consistencia de registro", score: 5.9, percentage: 59 },
                      { name: "Previsibilidad de carga", score: 4.5, percentage: 45 }
                    ].map((metric, index) => (
                      <div key={index} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>{metric.name}</span>
                          <span className={
                            metric.score >= 7 ? "text-green-600 font-medium" :
                            metric.score >= 5 ? "text-amber-600 font-medium" :
                            "text-red-600 font-medium"
                          }>
                            {metric.score}/10
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={
                              metric.score >= 7 ? "bg-green-500" :
                              metric.score >= 5 ? "bg-amber-500" :
                              "bg-red-500"
                            }
                            style={{ width: `${metric.percentage}%`, height: '100%' }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  Robustez Financiera
                </CardTitle>
                <CardDescription className="text-xs">
                  Análisis de la gestión financiera del proyecto
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="font-semibold text-primary">4.2</span>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium">Puntuación</h4>
                        <p className="text-xs text-muted-foreground">Bajo</p>
                      </div>
                    </div>
                    <Settings className="h-5 w-5 text-muted-foreground opacity-70" />
                  </div>
                  
                  <div className="space-y-3 pt-2">
                    {[
                      { name: "Control de costos", score: 3.5, percentage: 35 },
                      { name: "Previsibilidad financiera", score: 4.0, percentage: 40 },
                      { name: "Margen operativo", score: 5.5, percentage: 55 },
                      { name: "Variaciones presupuestarias", score: 3.8, percentage: 38 }
                    ].map((metric, index) => (
                      <div key={index} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>{metric.name}</span>
                          <span className={
                            metric.score >= 7 ? "text-green-600 font-medium" :
                            metric.score >= 5 ? "text-amber-600 font-medium" :
                            "text-red-600 font-medium"
                          }>
                            {metric.score}/10
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={
                              metric.score >= 7 ? "bg-green-500" :
                              metric.score >= 5 ? "bg-amber-500" :
                              "bg-red-500"
                            }
                            style={{ width: `${metric.percentage}%`, height: '100%' }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Timer className="h-4 w-4 text-primary" />
                  Robustez de Planificación Temporal
                </CardTitle>
                <CardDescription className="text-xs">
                  Análisis de la gestión del cronograma
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="font-semibold text-primary">5.1</span>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium">Puntuación</h4>
                        <p className="text-xs text-muted-foreground">Moderado</p>
                      </div>
                    </div>
                    <Settings className="h-5 w-5 text-muted-foreground opacity-70" />
                  </div>
                  
                  <div className="space-y-3 pt-2">
                    {[
                      { name: "Adherencia a fechas", score: 4.7, percentage: 47 },
                      { name: "Calidad de planificación", score: 5.8, percentage: 58 },
                      { name: "Velocidad de entrega", score: 5.3, percentage: 53 },
                      { name: "Cumplimiento de hitos", score: 4.6, percentage: 46 }
                    ].map((metric, index) => (
                      <div key={index} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>{metric.name}</span>
                          <span className={
                            metric.score >= 7 ? "text-green-600 font-medium" :
                            metric.score >= 5 ? "text-amber-600 font-medium" :
                            "text-red-600 font-medium"
                          }>
                            {metric.score}/10
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={
                              metric.score >= 7 ? "bg-green-500" :
                              metric.score >= 5 ? "bg-amber-500" :
                              "bg-red-500"
                            }
                            style={{ width: `${metric.percentage}%`, height: '100%' }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Robustez de Calidad
                </CardTitle>
                <CardDescription className="text-xs">
                  Análisis de la calidad de entregables
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="font-semibold text-primary">8.2</span>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium">Puntuación</h4>
                        <p className="text-xs text-muted-foreground">Excelente</p>
                      </div>
                    </div>
                    <Settings className="h-5 w-5 text-muted-foreground opacity-70" />
                  </div>
                  
                  <div className="space-y-3 pt-2">
                    {[
                      { name: "Calidad de documentación", score: 8.2, percentage: 82 },
                      { name: "Precisión de entregables", score: 7.8, percentage: 78 },
                      { name: "Satisfacción del cliente", score: 8.0, percentage: 80 },
                      { name: "Adherencia a estándares", score: 8.8, percentage: 88 }
                    ].map((metric, index) => (
                      <div key={index} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>{metric.name}</span>
                          <span className={
                            metric.score >= 7 ? "text-green-600 font-medium" :
                            metric.score >= 5 ? "text-amber-600 font-medium" :
                            "text-red-600 font-medium"
                          }>
                            {metric.score}/10
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={
                              metric.score >= 7 ? "bg-green-500" :
                              metric.score >= 5 ? "bg-amber-500" :
                              "bg-red-500"
                            }
                            style={{ width: `${metric.percentage}%`, height: '100%' }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Recomendaciones automáticas */}
          <Card className="shadow-sm border-amber-100">
            <CardHeader className="p-4 pb-2 bg-amber-50 border-b border-amber-100">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                Recomendaciones Automáticas
              </CardTitle>
              <CardDescription className="text-xs">
                Acciones sugeridas basadas en el análisis de robustez
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-red-50 border border-red-100">
                  <h4 className="text-sm font-medium text-red-800 flex items-center gap-1.5 mb-1">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    Alta Prioridad
                  </h4>
                  <ul className="text-xs space-y-1.5 text-red-700">
                    <li className="flex items-start gap-1.5">
                      <span className="mt-0.5">•</span>
                      <span>Revisar y ajustar el presupuesto para el control de costos.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="mt-0.5">•</span>
                      <span>Implementar un seguimiento diario de gastos para detectar desviaciones.</span>
                    </li>
                  </ul>
                </div>
                
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                  <h4 className="text-sm font-medium text-amber-800 flex items-center gap-1.5 mb-1">
                    <Clock className="h-4 w-4 text-amber-600" />
                    Media Prioridad
                  </h4>
                  <ul className="text-xs space-y-1.5 text-amber-700">
                    <li className="flex items-start gap-1.5">
                      <span className="mt-0.5">•</span>
                      <span>Reequilibrar las cargas de trabajo entre el equipo.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="mt-0.5">•</span>
                      <span>Revisar el cronograma y ajustar fechas críticas si es necesario.</span>
                    </li>
                  </ul>
                </div>
                
                <div className="p-3 rounded-lg bg-green-50 border border-green-100">
                  <h4 className="text-sm font-medium text-green-800 flex items-center gap-1.5 mb-1">
                    <FileText className="h-4 w-4 text-green-600" />
                    Mantener y Potenciar
                  </h4>
                  <ul className="text-xs space-y-1.5 text-green-700">
                    <li className="flex items-start gap-1.5">
                      <span className="mt-0.5">•</span>
                      <span>Continuar con los altos estándares de documentación y calidad.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="mt-0.5">•</span>
                      <span>Mantener el enfoque en la satisfacción del cliente como punto fuerte.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Contenido: Análisis Detallado */}
        <TabsContent value="analytics" className="mt-0 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {renderChartPlaceholder(
              "Costos vs. Presupuesto", 
              "Evolución de costos a lo largo del tiempo", 
              <BarChart4 className="h-4 w-4 text-primary" />, 
              "costTimeline"
            )}
            {renderChartPlaceholder(
              "Tendencia de Horas", 
              "Horas registradas por semana", 
              <LineChart className="h-4 w-4 text-primary" />, 
              "timeTrend"
            )}
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <Card className="shadow-sm col-span-2">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Análisis de Desviaciones
                </CardTitle>
                <CardDescription className="text-xs">
                  Variaciones respecto a lo planificado
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 p-3 rounded-lg bg-muted/30">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                        Desviación de Costos
                      </h4>
                      <div className="flex justify-between items-center">
                        <span className={`text-xl font-bold ${costSummary?.variance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {costSummary?.variance > 0 ? '+' : ''}
                          {costSummary?.variance?.toFixed(1) || 0}%
                        </span>
                        <div className="flex items-center gap-1 text-sm">
                          {costSummary?.variance > 0 ? (
                            <TrendingUp className="h-4 w-4 text-red-500" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-green-500" />
                          )}
                          <span className={costSummary?.variance > 0 ? 'text-red-600' : 'text-green-600'}>
                            {formatCurrency(Math.abs((costSummary?.actualCost || 0) - (costSummary?.estimatedCost || 0)))}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {costSummary?.variance > 10 
                          ? 'Desviación crítica que requiere atención inmediata' 
                          : costSummary?.variance > 5
                            ? 'Desviación moderada que debe ser monitoreada'
                            : 'Desviación dentro de márgenes aceptables'}
                      </p>
                    </div>
                    
                    <div className="space-y-2 p-3 rounded-lg bg-muted/30">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                        Desviación de Cronograma
                      </h4>
                      {projectMetrics?.progressPercentage !== undefined && (
                        <>
                          <div className="flex justify-between items-center">
                            <span className={`text-xl font-bold ${riskIndicators.scheduleRisk > 30 ? 'text-red-600' : 'text-green-600'}`}>
                              {riskIndicators.scheduleRisk > 0 ? '+' : ''}
                              {riskIndicators.scheduleRisk.toFixed(1)}%
                            </span>
                            <div className="flex items-center gap-1 text-sm">
                              {riskIndicators.scheduleRisk > 30 ? (
                                <TrendingUp className="h-4 w-4 text-red-500" />
                              ) : (
                                <TrendingDown className="h-4 w-4 text-green-500" />
                              )}
                              <span className={riskIndicators.scheduleRisk > 30 ? 'text-red-600' : 'text-green-600'}>
                                {calculateRemainingDays()} días
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {riskIndicators.scheduleRisk > 50 
                              ? 'Alto riesgo de retraso en la entrega del proyecto' 
                              : riskIndicators.scheduleRisk > 20
                                ? 'Posible retraso si no se toman medidas correctivas'
                                : 'Progreso acorde a lo planificado'}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-muted/10 border">
                    <h4 className="text-sm font-medium mb-2">Acciones Recomendadas</h4>
                    <ul className="text-xs space-y-1.5 text-muted-foreground">
                      {costSummary?.variance > 10 && (
                        <li className="flex items-start gap-2">
                          <span className="text-red-500 mt-0.5">•</span>
                          <span>Realizar revisión detallada del presupuesto y ajustar recursos asignados</span>
                        </li>
                      )}
                      {riskIndicators.scheduleRisk > 50 && (
                        <li className="flex items-start gap-2">
                          <span className="text-red-500 mt-0.5">•</span>
                          <span>Evaluar reestructuración del cronograma y priorizar entregables críticos</span>
                        </li>
                      )}
                      {riskIndicators.scheduleRisk > 20 && riskIndicators.scheduleRisk <= 50 && (
                        <li className="flex items-start gap-2">
                          <span className="text-amber-500 mt-0.5">•</span>
                          <span>Monitorear avance diario y comunicar posibles retrasos al cliente</span>
                        </li>
                      )}
                      {costSummary?.variance > 5 && costSummary?.variance <= 10 && (
                        <li className="flex items-start gap-2">
                          <span className="text-amber-500 mt-0.5">•</span>
                          <span>Optimizar asignación de recursos para prevenir aumento de costos</span>
                        </li>
                      )}
                      {costSummary?.variance <= 5 && riskIndicators.scheduleRisk <= 20 && (
                        <li className="flex items-start gap-2">
                          <span className="text-green-500 mt-0.5">•</span>
                          <span>Mantener el plan actual y continuar con los reportes periódicos</span>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-primary" />
                  Distribución de Horas
                </CardTitle>
                <CardDescription className="text-xs">
                  Facturables vs. No Facturables
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="space-y-4">
                  <div className="h-40 flex items-center justify-center bg-muted/20 rounded-lg">
                    <div className="text-center text-muted-foreground text-xs">
                      <p>Gráfico circular de distribución</p>
                      <p className="text-[10px] mt-1">(Recharts PieChart)</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-2 rounded-md bg-primary/10">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 rounded-full bg-primary"></div>
                        <span className="text-xs">Facturable</span>
                      </div>
                      <p className="text-lg font-semibold">
                        {formatNumber(billableDistributionData.find(d => d.name === "Facturable")?.value || 0, 1)}h
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(((billableDistributionData.find(d => d.name === "Facturable")?.value || 0) / 
                          (projectMetrics?.actualHours || 1)) * 100).toFixed(1)}%
                      </p>
                    </div>
                    
                    <div className="p-2 rounded-md bg-muted/20">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                        <span className="text-xs">No Facturable</span>
                      </div>
                      <p className="text-lg font-semibold">
                        {formatNumber(billableDistributionData.find(d => d.name === "No Facturable")?.value || 0, 1)}h
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(((billableDistributionData.find(d => d.name === "No Facturable")?.value || 0) / 
                          (projectMetrics?.actualHours || 1)) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Contenido: Equipo y Recursos */}
        <TabsContent value="team" className="mt-0 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              {renderChartPlaceholder(
                "Distribución de Horas por Persona", 
                "Tiempo dedicado por cada miembro del equipo", 
                <Users className="h-4 w-4 text-primary" />, 
                "personnelBar",
                "h-72"
              )}
            </div>
            
            <Card className="shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Asignación por Rol
                </CardTitle>
                <CardDescription className="text-xs">
                  Distribución de horas según rol
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                {timeByPersonnelData.length > 0 ? (
                  <div className="space-y-3 mt-2">
                    {roles.map(role => {
                      const personelInRole = timeByPersonnelData.filter(
                        p => personnel.find(per => per.id === p.id)?.roleId === role.id
                      );
                      const totalHoursInRole = personelInRole.reduce((sum, p) => sum + p.hours, 0);
                      
                      if (totalHoursInRole <= 0) return null;
                      
                      return (
                        <div key={role.id} className="p-2 rounded-md bg-muted/10">
                          <div className="flex justify-between items-baseline mb-1">
                            <span className="text-sm font-medium">{role.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {personelInRole.length} persona{personelInRole.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="flex justify-between items-baseline mb-1">
                            <span className="text-lg font-semibold">{formatNumber(totalHoursInRole, 1)}h</span>
                            <span className="text-xs">
                              {(totalHoursInRole / (projectMetrics?.actualHours || 1) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <Progress 
                            value={totalHoursInRole} 
                            max={projectMetrics?.actualHours || 0} 
                            className="h-1.5" 
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                    No hay datos disponibles
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          <Card className="shadow-sm">
            <CardHeader className="p-4 pb-2">
              <div className="flex justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Equipo del Proyecto
                </CardTitle>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-xs"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Actualizar
                </Button>
              </div>
              <CardDescription className="text-xs">
                Detalle de asignación y carga de trabajo
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              {timeByPersonnelData.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <div className="grid grid-cols-12 gap-2 p-3 bg-muted/20 text-xs font-medium">
                    <div className="col-span-3">Nombre</div>
                    <div className="col-span-2">Rol</div>
                    <div className="col-span-2">Horas</div>
                    <div className="col-span-2">% del Total</div>
                    <div className="col-span-3">Distribución</div>
                  </div>
                  
                  <div className="divide-y">
                    {timeByPersonnelData.map((person, index) => {
                      const personDetails = personnel.find(p => p.id === person.id);
                      const roleDetails = roles.find(r => r.id === personDetails?.roleId);
                      const percentOfTotal = ((person.hours / (projectMetrics?.actualHours || 1)) * 100).toFixed(1);
                      
                      return (
                        <div key={index} className="grid grid-cols-12 gap-2 p-3 text-xs items-center hover:bg-muted/10">
                          <div className="col-span-3 font-medium flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px]">
                              {person.name.substring(0, 2).toUpperCase()}
                            </div>
                            <span>{person.name}</span>
                          </div>
                          <div className="col-span-2 text-muted-foreground">
                            {roleDetails?.name || "No asignado"}
                          </div>
                          <div className="col-span-2 font-medium">
                            {formatNumber(person.hours, 1)}h
                          </div>
                          <div className="col-span-2 text-muted-foreground">
                            {percentOfTotal}%
                          </div>
                          <div className="col-span-3">
                            <Progress 
                              value={person.hours} 
                              max={Math.max(...timeByPersonnelData.map(p => p.hours))} 
                              className="h-1.5" 
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                  No hay datos de asignación de equipo
                </div>
              )}
            </CardContent>
            <CardFooter className="p-4 pt-2 flex justify-between">
              <p className="text-xs text-muted-foreground">
                Total: {timeByPersonnelData.length} persona{timeByPersonnelData.length !== 1 ? 's' : ''} • {formatNumber(projectMetrics?.actualHours || 0, 1)} horas
              </p>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <Download className="h-3.5 w-3.5 mr-1" />
                Exportar
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Contenido: Entregables */}
        <TabsContent value="deliverables" className="mt-0 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              {renderDeliverablesCard()}
            </div>
            
            <Card className="shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Resumen de Entregables
                </CardTitle>
                <CardDescription className="text-xs">
                  Estado general del proyecto
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                {deliverableData ? (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center p-4 text-center">
                      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                        <FileText className="h-8 w-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold">{deliverableData.progress || 0}%</h3>
                      <p className="text-sm text-muted-foreground">Progreso general</p>
                    </div>
                    
                    <div className="space-y-2 pt-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Última actualización:</span>
                        <span className="font-medium">
                          {deliverableData.last_updated ? formatDate(deliverableData.last_updated) : "No disponible"}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Responsable:</span>
                        <span className="font-medium">{deliverableData.responsible || "No asignado"}</span>
                      </div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Prioridad:</span>
                        <Badge variant="outline" className="text-[10px] h-5">
                          {deliverableData.priority || "Normal"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 p-4 text-center">
                    <AlertCircle className="h-10 w-10 text-muted-foreground opacity-40 mb-2" />
                    <p className="text-sm text-muted-foreground">No hay entregables definidos</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Agrega entregables para realizar un seguimiento detallado del proyecto
                    </p>
                    <Button variant="outline" size="sm" className="mt-4 h-8 text-xs">
                      Definir entregable
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {deliverableData && (
            <Card className="shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Cronograma de Entregables
                </CardTitle>
                <CardDescription className="text-xs">
                  Línea de tiempo y fechas críticas
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="h-40 flex items-center justify-center bg-muted/20 rounded-lg mb-4">
                  <div className="text-center text-muted-foreground text-xs">
                    <p>Línea de tiempo de entregables</p>
                    <p className="text-[10px] mt-1">(Visualización en Timeline)</p>
                  </div>
                </div>
                
                <div className="border rounded-lg overflow-hidden">
                  <div className="grid grid-cols-12 gap-2 p-3 bg-muted/20 text-xs font-medium">
                    <div className="col-span-4">Entregable</div>
                    <div className="col-span-2">Fecha Límite</div>
                    <div className="col-span-2">Responsable</div>
                    <div className="col-span-2">Estado</div>
                    <div className="col-span-2">Progreso</div>
                  </div>
                  
                  <div className="divide-y">
                    <div className="grid grid-cols-12 gap-2 p-3 text-xs items-center hover:bg-muted/10">
                      <div className="col-span-4 font-medium">{deliverableData.name}</div>
                      <div className="col-span-2 text-muted-foreground">{formatDate(deliverableData.due_date)}</div>
                      <div className="col-span-2">{deliverableData.responsible || "No asignado"}</div>
                      <div className="col-span-2">
                        <Badge 
                          variant={deliverableData.status === 'completed' ? 'success' : 'default'} 
                          className="text-[10px] h-5"
                        >
                          {deliverableData.status === 'completed' ? 'Completado' : 'En progreso'}
                        </Badge>
                      </div>
                      <div className="col-span-2">
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={deliverableData.progress || 0} 
                            max={100} 
                            className="h-1.5 flex-1" 
                          />
                          <span className="font-medium">{deliverableData.progress || 0}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProjectAnalytics;