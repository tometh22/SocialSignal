import React, { useState } from "react";
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
import { 
  ArrowLeft, 
  Loader2, 
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Clock,
  BadgeDollarSign,
  Calendar,
  FileText,
  PlusCircle
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

// Componente principal
const ProjectSummary: React.FC = () => {
  const [, setLocation] = useLocation();
  const params = useParams();
  const projectId = parseInt(params.projectId || "0");

  // Obtener proyecto activo
  const { data: project, isLoading: isLoadingProject } = useQuery<ActiveProject>({
    queryKey: ["/api/active-projects", projectId],
    enabled: !!projectId,
  });

  // Obtener resumen de costos
  const { data: costSummary, isLoading: isLoadingCostSummary } = useQuery<CostSummary>({
    queryKey: ["/api/projects", projectId, "cost-summary"],
    enabled: !!projectId,
  });

  // Obtener registros de tiempo
  const { data: timeEntries, isLoading: isLoadingTimeEntries } = useQuery<TimeEntry[]>({
    queryKey: ["/api/time-entries/project", projectId],
    enabled: !!projectId,
  });

  // Obtener personal
  const { data: personnel, isLoading: isLoadingPersonnel } = useQuery<Personnel[]>({
    queryKey: ["/api/personnel"],
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

  // Preparar datos para gráficos
  const prepareTimeByPersonnelData = () => {
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
  };

  const prepareBillableVsNonBillableData = () => {
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
  };

  const prepareTimeEntriesByDateData = () => {
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
  };

  const pieChartColors = ["#4f46e5", "#f97316", "#10b981", "#f43f5e"];

  const isLoading = 
    isLoadingProject || 
    isLoadingCostSummary || 
    isLoadingTimeEntries ||
    isLoadingPersonnel;

  if (!projectId) {
    return (
      <div className="container mx-auto py-6">
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
    <div className="container mx-auto py-6">
      <div className="flex items-center mb-6">
        <Button variant="ghost" onClick={() => setLocation("/active-projects")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a Proyectos
        </Button>
        <h1 className="text-3xl font-bold ml-4">Resumen del Proyecto</h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !project ? (
        <Card>
          <CardHeader>
            <CardTitle>Proyecto no encontrado</CardTitle>
            <CardDescription>
              El proyecto especificado no existe o no está disponible.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => setLocation("/active-projects")}>
              Ver todos los proyectos
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-medium">
                    Información del Proyecto
                  </CardTitle>
                  <Badge
                    className={
                      project.status === "active"
                        ? "bg-green-500"
                        : project.status === "completed"
                        ? "bg-blue-500"
                        : project.status === "on-hold"
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }
                  >
                    {project.status === "active"
                      ? "Activo"
                      : project.status === "completed"
                      ? "Completado"
                      : project.status === "on-hold"
                      ? "En Pausa"
                      : "Cancelado"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Nombre:</span>
                    <span className="font-medium">{project.quotation.projectName}</span>
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
                      <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                      <span>{formatDate(project.startDate)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Fecha fin esperada:</span>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                      <span>{formatDate(project.expectedEndDate)}</span>
                    </div>
                  </div>
                  {project.actualEndDate && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Fecha fin real:</span>
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                        <span>{formatDate(project.actualEndDate)}</span>
                      </div>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Frecuencia de seguimiento:</span>
                    <span>{project.trackingFrequency}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setLocation(`/time-entries/project/${project.id}`)}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  Ver Registro de Horas
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium">
                  Información Financiera
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">Costo estimado:</span>
                    <span className="text-xl font-bold">
                      {formatCurrency(costSummary?.estimatedCost || 0)}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">Costo actual:</span>
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
                          ? "text-red-500"
                          : (costSummary?.percentageUsed || 0) > 90
                          ? "text-yellow-500"
                          : "text-primary"
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
              <CardFooter className="pt-0">
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

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium">
                  Resumen de Horas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total horas registradas:</span>
                    <span className="font-bold">
                      {timeEntries?.reduce((acc, entry) => acc + entry.hours, 0).toFixed(1)} horas
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Horas facturables:</span>
                    <span>
                      {timeEntries?.filter(e => e.billable).reduce((acc, entry) => acc + entry.hours, 0).toFixed(1)} horas
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Horas no facturables:</span>
                    <span>
                      {timeEntries?.filter(e => !e.billable).reduce((acc, entry) => acc + entry.hours, 0).toFixed(1)} horas
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Horas aprobadas:</span>
                    <div className="flex items-center">
                      <CheckCircle2 className="h-4 w-4 mr-1 text-green-500" />
                      <span>
                        {timeEntries?.filter(e => e.approved).reduce((acc, entry) => acc + entry.hours, 0).toFixed(1)} horas
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Horas pendientes:</span>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1 text-yellow-500" />
                      <span>
                        {timeEntries?.filter(e => !e.approved).reduce((acc, entry) => acc + entry.hours, 0).toFixed(1)} horas
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Costo por hora (promedio):</span>
                    <div className="flex items-center">
                      <BadgeDollarSign className="h-4 w-4 mr-1 text-muted-foreground" />
                      <span>
                        {formatCurrency(costSummary && timeEntries && timeEntries.length > 0 
                          ? costSummary.actualCost / timeEntries.reduce((acc, entry) => acc + entry.hours, 0)
                          : 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <Button 
                  className="w-full"
                  onClick={() => setLocation(`/time-entries/project/${project.id}`)}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Registrar Horas
                </Button>
              </CardFooter>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Horas por Personal</CardTitle>
                <CardDescription>
                  Distribución de horas trabajadas por cada miembro del equipo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {prepareTimeByPersonnelData().length === 0 ? (
                    <div className="flex flex-col justify-center items-center h-full">
                      <Clock className="h-12 w-12 text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No hay datos disponibles</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={prepareTimeByPersonnelData()}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip formatter={(value) => [`${value} horas`, ""]} />
                        <Legend />
                        <Bar dataKey="hours" name="Horas" fill="#4f46e5" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Horas Facturables vs No Facturables</CardTitle>
                <CardDescription>
                  Proporción de horas facturables y no facturables
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {prepareBillableVsNonBillableData().every(item => item.value === 0) ? (
                    <div className="flex flex-col justify-center items-center h-full">
                      <Clock className="h-12 w-12 text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No hay datos disponibles</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={prepareBillableVsNonBillableData()}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => 
                            `${name}: ${(percent * 100).toFixed(0)}%`
                          }
                        >
                          {prepareBillableVsNonBillableData().map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={pieChartColors[index % pieChartColors.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${value} horas`, ""]} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Historial de Horas Registradas</CardTitle>
              <CardDescription>
                Evolución de las horas registradas en el tiempo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {prepareTimeEntriesByDateData().length === 0 ? (
                  <div className="flex flex-col justify-center items-center h-full">
                    <Clock className="h-12 w-12 text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No hay datos disponibles</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={prepareTimeEntriesByDateData()}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`${value} horas`, ""]} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="hours"
                        name="Horas"
                        stroke="#4f46e5"
                        activeDot={{ r: 8 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
            <CardFooter className="justify-end">
              <Button variant="outline" className="mr-2">
                Exportar Datos
              </Button>
              <Button onClick={() => setLocation(`/progress-report/${project.id}`)}>
                Generar Informe de Progreso
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        </>
      )}
    </div>
  );
};

export default ProjectSummary;