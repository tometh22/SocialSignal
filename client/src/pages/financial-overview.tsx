import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  FileText,
  Building2,
  BarChart3,
  AlertTriangle
} from "lucide-react";

type ProjectFinancialSummary = {
  id: number;
  projectName: string;
  clientName: string;
  operationalSales: number;
  invoicedAmount: number;
  collectedAmount: number;
  pendingAmount: number;
  lastInvoiceDate?: Date;
  status: string;
};

export default function FinancialOverview() {
  const [selectedPeriod, setSelectedPeriod] = useState("current_month");

  // Obtener resumen financiero consolidado
  const { data: financialSummary, isLoading: loadingSummary } = useQuery({
    queryKey: ['/api/financial/summary', selectedPeriod],
    enabled: true,
  });

  // Obtener lista de proyectos con datos financieros
  const { data: projectsFinancial = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['/api/financial/projects', selectedPeriod],
    enabled: true,
  });

  // Cálculos consolidados (simulados por ahora)
  const mockSummary = {
    totalOperationalSales: 125000,
    totalInvoiced: 98000,
    totalCollected: 75000,
    totalPending: 23000,
    cashFlowHealth: "good", // good, warning, critical
    collectionsRatio: 0.77,
    invoicingEfficiency: 0.78
  };

  const mockProjects: ProjectFinancialSummary[] = [
    {
      id: 1,
      projectName: "Campaña Digital Q4",
      clientName: "Cliente A",
      operationalSales: 45000,
      invoicedAmount: 40000,
      collectedAmount: 35000,
      pendingAmount: 5000,
      lastInvoiceDate: new Date('2024-08-15'),
      status: "active"
    },
    {
      id: 2,
      projectName: "Social Listening",
      clientName: "Cliente B",
      operationalSales: 25000,
      invoicedAmount: 25000,
      collectedAmount: 20000,
      pendingAmount: 5000,
      lastInvoiceDate: new Date('2024-08-20'),
      status: "active"
    },
    {
      id: 3,
      projectName: "Fee Marketing",
      clientName: "Cliente C",
      operationalSales: 55000,
      invoicedAmount: 33000,
      collectedAmount: 20000,
      pendingAmount: 13000,
      lastInvoiceDate: new Date('2024-07-30'),
      status: "overdue"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800";
      case "overdue": return "bg-red-100 text-red-800";
      case "pending": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getHealthIndicator = (health: string) => {
    switch (health) {
      case "good": return { icon: TrendingUp, color: "text-green-600", bg: "bg-green-100" };
      case "warning": return { icon: AlertTriangle, color: "text-yellow-600", bg: "bg-yellow-100" };
      case "critical": return { icon: TrendingDown, color: "text-red-600", bg: "bg-red-100" };
      default: return { icon: BarChart3, color: "text-gray-600", bg: "bg-gray-100" };
    }
  };

  const healthIndicator = getHealthIndicator(mockSummary.cashFlowHealth);
  const HealthIcon = healthIndicator.icon;

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Resumen Financiero
          </h1>
          <p className="text-gray-600">
            Vista consolidada del análisis operacional y financiero
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current_month">Mes Actual</SelectItem>
              <SelectItem value="last_3_months">Últimos 3 Meses</SelectItem>
              <SelectItem value="current_quarter">Trimestre Actual</SelectItem>
              <SelectItem value="current_year">Año Actual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs Financieros */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Operacionales</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${mockSummary.totalOperationalSales.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Ingresos reconocidos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Facturado</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${mockSummary.totalInvoiced.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {(mockSummary.invoicingEfficiency * 100).toFixed(0)}% de eficiencia
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cobrado</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${mockSummary.totalCollected.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {(mockSummary.collectionsRatio * 100).toFixed(0)}% de cobranza
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estado de Cash Flow</CardTitle>
            <HealthIcon className={`h-4 w-4 ${healthIndicator.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">${mockSummary.totalPending.toLocaleString()}</div>
            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${healthIndicator.bg} ${healthIndicator.color}`}>
              {mockSummary.cashFlowHealth === 'good' ? 'Saludable' :
               mockSummary.cashFlowHealth === 'warning' ? 'Atención' : 'Crítico'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs para análisis detallado */}
      <Tabs defaultValue="projects" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="projects">Por Proyecto</TabsTrigger>
          <TabsTrigger value="clients">Por Cliente</TabsTrigger>
          <TabsTrigger value="trends">Tendencias</TabsTrigger>
        </TabsList>

        {/* Tab de Proyectos */}
        <TabsContent value="projects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Estado Financiero por Proyecto</CardTitle>
              <CardDescription>
                Comparación entre ventas operacionales y transacciones financieras reales
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proyecto</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Ventas Op.</TableHead>
                    <TableHead>Facturado</TableHead>
                    <TableHead>Cobrado</TableHead>
                    <TableHead>Pendiente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockProjects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">{project.projectName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          {project.clientName}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">${project.operationalSales.toLocaleString()}</TableCell>
                      <TableCell>${project.invoicedAmount.toLocaleString()}</TableCell>
                      <TableCell className="text-green-600">${project.collectedAmount.toLocaleString()}</TableCell>
                      <TableCell className="text-orange-600">${project.pendingAmount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(project.status)}>
                          {project.status === 'active' ? 'Activo' :
                           project.status === 'overdue' ? 'Vencido' : 'Pendiente'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.location.href = `/active-projects/${project.id}/financial-management`}
                        >
                          Ver Detalle
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab de Clientes */}
        <TabsContent value="clients" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Análisis por Cliente</CardTitle>
              <CardDescription>
                Consolidado financiero agrupado por cliente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Análisis por cliente próximamente</p>
                <p className="text-sm">Se mostrará el consolidado financiero agrupado por cliente</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab de Tendencias */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tendencias Financieras</CardTitle>
              <CardDescription>
                Evolución temporal de métricas financieras clave
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Gráficos de tendencias próximamente</p>
                <p className="text-sm">Se mostrarán gráficos de evolución temporal</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}