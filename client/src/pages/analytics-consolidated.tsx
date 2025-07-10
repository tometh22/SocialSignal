import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageLayout } from "@/components/ui/page-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, TrendingUp, Users, DollarSign, Clock, Building2, Target, Calendar } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Tipos para datos de analytics
interface AnalyticsData {
  projects: any[];
  clients: any[];
  timeEntries: any[];
  quotations: any[];
  deliverables: any[];
}

export default function AnalyticsConsolidated() {
  const [selectedPeriod, setSelectedPeriod] = useState("current-month");
  const [selectedClient, setSelectedClient] = useState("all");

  // Cargar todos los datos necesarios
  const { data: projects = [] } = useQuery({ queryKey: ['/api/active-projects'] });
  const { data: clients = [] } = useQuery({ queryKey: ['/api/clients'] });
  const { data: timeEntries = [] } = useQuery({ queryKey: ['/api/time-entries'] });
  const { data: quotations = [] } = useQuery({ queryKey: ['/api/quotations'] });
  const { data: deliverables = [] } = useQuery({ queryKey: ['/api/deliverables'] });

  // Calcular métricas consolidadas
  const analytics = useMemo(() => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    // Filtrar Always-On vs Únicos
    const alwaysOnProjects = projects.filter(p => 
      p.isAlwaysOnMacro || 
      p.quotation?.projectName?.toLowerCase().includes('always-on') ||
      p.quotation?.projectName?.toLowerCase().includes('modo') ||
      p.macroMonthlyBudget
    );

    const uniqueProjects = projects.filter(p => !alwaysOnProjects.includes(p));

    // Calcular ingresos mensuales vs totales
    const monthlyRevenue = alwaysOnProjects.reduce((sum, p) => sum + (p.macroMonthlyBudget || 0), 0);
    const totalRevenue = uniqueProjects.reduce((sum, p) => sum + (p.quotation?.totalAmount || 0), 0);

    // Filtrar time entries por período para Always-On
    const currentMonthEntries = timeEntries.filter((entry: any) => {
      const entryDate = new Date(entry.date);
      const project = projects.find(p => p.id === entry.projectId);
      const isAlwaysOn = alwaysOnProjects.includes(project);
      
      if (isAlwaysOn) {
        return entryDate.getFullYear() === currentYear && entryDate.getMonth() === currentMonth;
      }
      return true; // Para proyectos únicos, incluir todas las entradas
    });

    const totalHours = currentMonthEntries.reduce((sum: number, entry: any) => sum + (entry.hours || 0), 0);

    return {
      alwaysOnProjects: alwaysOnProjects.length,
      uniqueProjects: uniqueProjects.length,
      totalProjects: projects.length,
      activeClients: clients.length,
      monthlyRevenue,
      totalRevenue,
      totalHours,
      avgHourlyRate: totalHours > 0 ? (monthlyRevenue + totalRevenue) / totalHours : 0,
      completedDeliverables: deliverables.filter((d: any) => d.status === 'completed').length,
      pendingQuotations: quotations.filter((q: any) => q.status === 'pending').length
    };
  }, [projects, clients, timeEntries, quotations, deliverables]);

  return (
    <PageLayout
      title="Analytics & Reportes"
      description="Análisis consolidado de rendimiento, profitabilidad y métricas operacionales"
      breadcrumbs={[
        { label: "Analytics & Reportes", current: true }
      ]}
    >
      <div className="space-y-6">
        {/* Filtros de período */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Configuración de Análisis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Período de Análisis</label>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current-month">Mes Actual (Always-On)</SelectItem>
                    <SelectItem value="last-month">Mes Anterior</SelectItem>
                    <SelectItem value="quarter">Trimestre Actual</SelectItem>
                    <SelectItem value="year">Año Actual</SelectItem>
                    <SelectItem value="all-time">Todo el Tiempo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Cliente</label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Clientes</SelectItem>
                    {clients.map((client: any) => (
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

        {/* KPIs principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Proyectos Always-On</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.alwaysOnProjects}</div>
              <p className="text-xs text-muted-foreground">
                Contratos mensuales activos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos Mensuales</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${analytics.monthlyRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {format(new Date(), "MMMM yyyy", { locale: es })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Horas Trabajadas</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalHours.toFixed(1)}h</div>
              <p className="text-xs text-muted-foreground">
                Filtrado por período
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clientes Activos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.activeClients}</div>
              <p className="text-xs text-muted-foreground">
                Total en sistema
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs de análisis detallado */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Resumen General</TabsTrigger>
            <TabsTrigger value="projects">Análisis de Proyectos</TabsTrigger>
            <TabsTrigger value="clients">Análisis de Clientes</TabsTrigger>
            <TabsTrigger value="performance">Rendimiento</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Distribución de Proyectos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        Contratos Always-On
                      </span>
                      <Badge variant="secondary">{analytics.alwaysOnProjects}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        Proyectos Únicos
                      </span>
                      <Badge variant="secondary">{analytics.uniqueProjects}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Estructura de Ingresos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>Ingresos Mensuales (Always-On)</span>
                      <span className="font-semibold">${analytics.monthlyRevenue.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Ingresos Únicos</span>
                      <span className="font-semibold">${analytics.totalRevenue.toLocaleString()}</span>
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex items-center justify-between font-bold">
                        <span>Total Combinado</span>
                        <span>${(analytics.monthlyRevenue + analytics.totalRevenue).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="projects" className="space-y-4">
            <div className="grid gap-4">
              {projects.map((project: any) => (
                <Card key={project.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {project.quotation?.projectName || `Proyecto ${project.id}`}
                      </CardTitle>
                      <div className="flex gap-2">
                        <Badge variant={project.isAlwaysOnMacro ? "default" : "secondary"}>
                          {project.isAlwaysOnMacro ? "Always-On" : "Único"}
                        </Badge>
                        <Badge variant="outline">{project.status}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Presupuesto</span>
                        <p className="font-semibold">
                          ${(project.macroMonthlyBudget || project.quotation?.totalAmount || 0).toLocaleString()}
                          {project.macroMonthlyBudget && "/mes"}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Cliente</span>
                        <p className="font-semibold">
                          {clients.find((c: any) => c.id === project.quotation?.clientId)?.name || "Sin asignar"}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Inicio</span>
                        <p className="font-semibold">
                          {project.startDate ? format(new Date(project.startDate), "dd/MM/yyyy") : "N/A"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/active-projects/${project.id}`}>
                          <Button size="sm" variant="outline">Ver Detalles</Button>
                        </Link>
                        <Link href={`/project-analytics/${project.id}`}>
                          <Button size="sm" variant="outline">Analytics</Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="clients" className="space-y-4">
            <div className="grid gap-4">
              {clients.map((client: any) => {
                const clientProjects = projects.filter((p: any) => p.quotation?.clientId === client.id);
                const clientRevenue = clientProjects.reduce((sum, p) => 
                  sum + (p.macroMonthlyBudget || p.quotation?.totalAmount || 0), 0
                );

                return (
                  <Card key={client.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{client.name}</CardTitle>
                        <Badge>{clientProjects.length} proyecto{clientProjects.length !== 1 ? 's' : ''}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Ingresos Totales</span>
                          <p className="font-semibold">${clientRevenue.toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Proyectos Activos</span>
                          <p className="font-semibold">{clientProjects.filter(p => p.status === 'active').length}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Contacto</span>
                          <p className="font-semibold">{client.email || "No especificado"}</p>
                        </div>
                        <div>
                          <Link href={`/client-summary/${client.id}`}>
                            <Button size="sm" variant="outline">Ver Resumen</Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Métricas de Eficiencia</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>Tarifa Promedio por Hora</span>
                      <span className="font-semibold">${analytics.avgHourlyRate.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Entregables Completados</span>
                      <span className="font-semibold">{analytics.completedDeliverables}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Cotizaciones Pendientes</span>
                      <span className="font-semibold">{analytics.pendingQuotations}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tendencias</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <p className="text-muted-foreground mb-4">
                      Gráficos de tendencias próximamente
                    </p>
                    <TrendingUp className="h-16 w-16 text-muted-foreground mx-auto" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}