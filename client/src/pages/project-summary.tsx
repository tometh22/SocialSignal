import React, { useState, useMemo } from "react";
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
import { 
  ArrowLeft, 
  Loader2, 
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  Clock,
  BadgeDollarSign,
  Calendar,
  FileText,
  PlusCircle,
  BarChart3,
  PieChart as PieChartIcon
} from "lucide-react";
import { format } from "date-fns";
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
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
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

// Componente principal
const ProjectSummary: React.FC = () => {
  const [, setLocation] = useLocation();
  const params = useParams();
  const projectId = parseInt(params.projectId || "0");

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

  // Obtener registros de tiempo - URL corregida
  const { data: timeEntries, isLoading: isLoadingTimeEntries } = useQuery<TimeEntry[]>({
    queryKey: [`/api/time-entries/project/${projectId}`],
    enabled: !!projectId,
  });

  // Obtener personal
  const { data: personnel, isLoading: isLoadingPersonnel } = useQuery<Personnel[]>({
    queryKey: ['/api/personnel'],
  });

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
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Preparar datos para gráficos usando useMemo para evitar cálculos repetidos
  const timeByPersonnelData = useMemo(() => {
    if (!timeEntries || !personnel) return [];

    const hoursByPersonnel: Record<number, number> = {};
    
    timeEntries.forEach(entry => {
      if (!hoursByPersonnel[entry.personnelId]) {
        hoursByPersonnel[entry.personnelId] = 0;
      }
      hoursByPersonnel[entry.personnelId] += entry.hours;
    });

    return Object.keys(hoursByPersonnel).map(personnelId => {
      const id = parseInt(personnelId);
      const person = personnel.find(p => p.id === id);
      return {
        name: person?.name || "Desconocido",
        hours: hoursByPersonnel[id],
        cost: hoursByPersonnel[id] * (person?.hourlyRate || 0)
      };
    }).sort((a, b) => b.hours - a.hours);
  }, [timeEntries, personnel]);

  const billableVsNonBillableData = useMemo(() => {
    if (!timeEntries) return [];

    let billableHours = 0;
    let nonBillableHours = 0;

    timeEntries.forEach(entry => {
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
  }, [timeEntries]);

  const timeEntriesByDateData = useMemo(() => {
    if (!timeEntries) return [];

    const entriesByDate: Record<string, { date: string; hours: number }> = {};
    
    timeEntries.forEach(entry => {
      const dateStr = format(new Date(entry.date), "yyyy-MM-dd");
      if (!entriesByDate[dateStr]) {
        entriesByDate[dateStr] = { 
          date: format(new Date(entry.date), "dd MMM"), 
          hours: 0 
        };
      }
      entriesByDate[dateStr].hours += entry.hours;
    });

    return Object.values(entriesByDate).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [timeEntries]);

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

  const pieChartColors = ["#4f46e5", "#f97316", "#10b981", "#f43f5e"];

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
    <ScrollArea className="flex-1 h-[calc(100vh-4rem)]"> {/* Contenedor principal con scroll */}
      <div className="container mx-auto py-8 px-6 pb-24"> {/* Aumentamos padding y añadimos espacio inferior */}
        <div className="flex items-center mb-8">
          <Button variant="outline" onClick={() => setLocation("/active-projects")} className="shadow-sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Proyectos
          </Button>
          <h1 className="text-3xl font-bold ml-6">Resumen del Proyecto</h1>
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
            {/* Header/Top Cards Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8"> {/* Aumentamos gap y margin */}
              <Card className="shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-medium flex items-center">
                      <div className="mr-3 p-2 rounded-full bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      Información del Proyecto
                    </CardTitle>
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

              <Card className="shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3 bg-muted/30">
                  <CardTitle className="text-lg font-medium flex items-center">
                    <div className="mr-3 p-2 rounded-full bg-primary/10">
                      <BadgeDollarSign className="h-5 w-5 text-primary" />
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

              <Card className="shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3 bg-muted/30">
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
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"> {/* Aumentamos gap y margin */}
              <Card className="shadow-md">
                <CardHeader className="bg-muted/30">
                  <CardTitle className="text-lg font-medium flex items-center">
                    <BarChart3 className="h-5 w-5 mr-2 text-primary" />
                    Distribución de Horas por Personal
                  </CardTitle>
                  <CardDescription>
                    Desglose del tiempo registrado por cada persona
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="h-[300px]"> {/* Altura fija para el gráfico */}
                    {timeByPersonnelData.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <Clock className="h-10 w-10 mb-2" />
                        <p>No hay datos disponibles</p>
                      </div>
                    ) : (
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
                          <Tooltip 
                            formatter={(value, name) => [
                              name === "hours" ? `${value} horas` : formatCurrency(value as number),
                              name === "hours" ? "Horas" : "Costo"
                            ]}
                            contentStyle={{ 
                              borderRadius: '8px',
                              border: '1px solid rgba(0, 0, 0, 0.1)',
                              boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)'
                            }}
                          />
                          <Legend iconType="circle" />
                          <Bar 
                            dataKey="hours" 
                            fill="#4f46e5" 
                            name="Horas"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-md">
                <CardHeader className="bg-muted/30">
                  <CardTitle className="text-lg font-medium flex items-center">
                    <PieChartIcon className="h-5 w-5 mr-2 text-primary" />
                    Facturable vs No Facturable
                  </CardTitle>
                  <CardDescription>
                    Proporción de horas facturables y no facturables
                  </CardDescription>
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
                          >
                            {billableVsNonBillableData.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={index === 0 ? "#4f46e5" : "#f97316"} 
                              />
                            ))}
                          </Pie>
                          <Tooltip 
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
            </div>

            {/* Time Trend Chart */}
            <Card className="shadow-md mb-12"> {/* Espacio extra al final */}
              <CardHeader className="bg-muted/30">
                <CardTitle className="text-lg font-medium flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2 text-primary" />
                  Tendencia de Registro de Horas
                </CardTitle>
                <CardDescription>
                  Evolución de las horas registradas a lo largo del tiempo
                </CardDescription>
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
                        />
                        <Tooltip 
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
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </ScrollArea>
  );
};

export default ProjectSummary;