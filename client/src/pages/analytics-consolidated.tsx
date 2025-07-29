import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageLayout } from "@/components/ui/page-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BarChart3, TrendingUp, Users, DollarSign, Clock, Building2, Target, Calendar,
  ArrowUpRight, ArrowDownRight, Activity, Briefcase, FileText, AlertCircle,
  ChevronRight, Download, Filter, PieChart, LineChart, Zap, Shield,
  TrendingDown, CheckCircle2, XCircle, Info, Globe, Layers,
  Calendar as CalendarIconLucide, CheckCircle, AlertTriangle,
  LayoutDashboard, Lightbulb
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from "recharts";

// Tipos para datos de analytics
interface AnalyticsData {
  projects: any[];
  clients: any[];
  timeEntries: any[];
  quotations: any[];
  deliverables: any[];
}

// Colores corporativos para gráficos
const CHART_COLORS = {
  primary: "#3b82f6",
  secondary: "#10b981",
  tertiary: "#f59e0b",
  danger: "#ef4444",
  purple: "#8b5cf6",
  indigo: "#6366f1",
  pink: "#ec4899",
  teal: "#14b8a6"
};

// Date filter options similar to other sections
const dateFilterOptions = [
  { value: "all", label: "Todos los períodos", group: "General" },
  { value: "this-month", label: "Este mes", group: "General" },
  { value: "last-month", label: "Mes pasado", group: "General" },
  { value: "this-quarter", label: "Este trimestre", group: "General" },
  { value: "trimestre-pasado", label: "Trimestre pasado", group: "General" },
  { value: "this-semester", label: "Este semestre", group: "General" },
  { value: "last-semester", label: "Semestre pasado", group: "General" },
  { value: "this-year", label: "Este año", group: "General" },
  { value: "q1", label: "Q1 (Ene-Mar)", group: "Trimestres" },
  { value: "q2", label: "Q2 (Abr-Jun)", group: "Trimestres" },
  { value: "q3", label: "Q3 (Jul-Sep)", group: "Trimestres" },
  { value: "q4", label: "Q4 (Oct-Dic)", group: "Trimestres" },
  { value: "january", label: "Enero", group: "Meses" },
  { value: "february", label: "Febrero", group: "Meses" },
  { value: "march", label: "Marzo", group: "Meses" },
  { value: "april", label: "Abril", group: "Meses" },
  { value: "may", label: "Mayo", group: "Meses" },
  { value: "june", label: "Junio", group: "Meses" },
  { value: "july", label: "Julio", group: "Meses" },
  { value: "august", label: "Agosto", group: "Meses" },
  { value: "september", label: "Septiembre", group: "Meses" },
  { value: "october", label: "Octubre", group: "Meses" },
  { value: "november", label: "Noviembre", group: "Meses" },
  { value: "december", label: "Diciembre", group: "Meses" }
];

// Helper function to get date range for filters
const getDateRangeForFilter = (filter: string) => {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = now;

  switch (filter) {
    case 'all':
      return null;
    case 'this-month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'last-month':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case 'this-quarter':
      const currentQuarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
      endDate = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0);
      break;
    case 'last-quarter':
    case 'trimestre-pasado':
      const lastQuarter = Math.floor(now.getMonth() / 3) - 1;
      const quarterYear = lastQuarter < 0 ? now.getFullYear() - 1 : now.getFullYear();
      const adjustedQuarter = lastQuarter < 0 ? 3 : lastQuarter;
      startDate = new Date(quarterYear, adjustedQuarter * 3, 1);
      endDate = new Date(quarterYear, (adjustedQuarter + 1) * 3, 0);
      break;
    case 'this-semester':
      const currentSemester = Math.floor(now.getMonth() / 6);
      startDate = new Date(now.getFullYear(), currentSemester * 6, 1);
      endDate = new Date(now.getFullYear(), (currentSemester + 1) * 6, 0);
      break;
    case 'last-semester':
      const lastSemester = Math.floor(now.getMonth() / 6) - 1;
      const semesterYear = lastSemester < 0 ? now.getFullYear() - 1 : now.getFullYear();
      const adjustedSemester = lastSemester < 0 ? 1 : lastSemester;
      startDate = new Date(semesterYear, adjustedSemester * 6, 1);
      endDate = new Date(semesterYear, (adjustedSemester + 1) * 6, 0);
      break;
    case 'this-year':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31);
      break;
    case 'q1':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 2, 31);
      break;
    case 'q2':
      startDate = new Date(now.getFullYear(), 3, 1);
      endDate = new Date(now.getFullYear(), 5, 30);
      break;
    case 'q3':
      startDate = new Date(now.getFullYear(), 6, 1);
      endDate = new Date(now.getFullYear(), 8, 30);
      break;
    case 'q4':
      startDate = new Date(now.getFullYear(), 9, 1);
      endDate = new Date(now.getFullYear(), 11, 31);
      break;
    default:
      // Handle month names
      const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                        'july', 'august', 'september', 'october', 'november', 'december'];
      const monthIndex = monthNames.indexOf(filter);
      if (monthIndex !== -1) {
        startDate = new Date(now.getFullYear(), monthIndex, 1);
        endDate = new Date(now.getFullYear(), monthIndex + 1, 0);
      } else {
        return null;
      }
  }

  return { startDate, endDate };
};

export default function AnalyticsConsolidated() {
  const [dateFilter, setDateFilter] = useState("this-month");
  const [compareMode, setCompareMode] = useState(false);
  const [comparePeriod, setComparePeriod] = useState("last-month");
  const [selectedClient, setSelectedClient] = useState("all");
  const [selectedMetric, setSelectedMetric] = useState("revenue");

  // Cargar todos los datos necesarios
  const { data: projects = [] } = useQuery({ queryKey: ['/api/active-projects'] });
  const { data: clients = [] } = useQuery({ queryKey: ['/api/clients'] });
  const { data: timeEntries = [] } = useQuery({ queryKey: ['/api/time-entries'] });
  const { data: quotations = [] } = useQuery({ queryKey: ['/api/quotations'] });
  const { data: deliverables = [] } = useQuery({ queryKey: ['/api/deliverables'] });
  const { data: personnel = [] } = useQuery({ queryKey: ['/api/personnel'] });

  // Helper function to calculate analytics for a given period
  const calculatePeriodAnalytics = (periodFilter: string) => {
    // Calculate personnel costs by contract type
    const fullTimePersonnel = personnel.filter((p: any) => p.contractType === 'full-time');
    const partTimePersonnel = personnel.filter((p: any) => p.contractType === 'part-time' || p.contractType === 'freelance');
    
    // Fixed monthly costs (full-time salaries)
    const fixedMonthlyCosts = fullTimePersonnel.reduce((sum: number, p: any) => {
      // La columna en la DB es monthly_fixed_salary, que se convierte a camelCase
      const salary = p.monthlyFixedSalary || p.monthly_fixed_salary || 0;
      if (salary > 0) {
        console.log(`💰 Personal ${p.name}: ${p.contractType}, salario mensual: $${salary}`);
      }
      return sum + salary;
    }, 0);
    console.log('💵 Total costos fijos mensuales:', fixedMonthlyCosts);
    
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    // Filtrar Always-On vs Únicos con filtro de cliente
    const filteredProjects = selectedClient === 'all' 
      ? projects 
      : projects.filter(p => p.clientId === parseInt(selectedClient));
      
    const alwaysOnProjects = filteredProjects.filter(p => 
      p.quotation?.projectType === 'fee-mensual' ||
      p.isAlwaysOnMacro || 
      p.quotation?.projectName?.toLowerCase().includes('always-on') ||
      p.quotation?.projectName?.toLowerCase().includes('modo') ||
      p.quotation?.projectName?.toLowerCase().includes('contrato') || // Contratos son Always-On
      p.macroMonthlyBudget > 0 ||
      p.quotation?.projectType === 'always-on'
    );

    const uniqueProjects = filteredProjects.filter(p => !alwaysOnProjects.includes(p));
    
    console.log('🔍 Proyectos separados por tipo:', {
      alwaysOn: alwaysOnProjects.map(p => ({
        id: p.id,
        name: p.quotation?.projectName,
        type: p.quotation?.projectType,
        amount: p.quotation?.totalAmount
      })),
      unique: uniqueProjects.map(p => ({
        id: p.id,
        name: p.quotation?.projectName,
        type: p.quotation?.projectType,
        amount: p.quotation?.totalAmount
      }))
    });

    // Calcular ingresos mensuales vs totales (precio al cliente)
    const monthlyRevenue = alwaysOnProjects.reduce((sum, p) => {
      // Para Always-On usar el precio mensual del cliente
      const clientPrice = p.quotation?.totalAmount || p.macroMonthlyBudget || 0;
      return sum + clientPrice;
    }, 0);
    
    const totalRevenue = uniqueProjects.reduce((sum, p) => {
      // Para únicos usar el precio total del cliente
      return sum + (p.quotation?.totalAmount || 0);
    }, 0);

    // Filtrar time entries por período y cliente
    const dateRange = getDateRangeForFilter(periodFilter);
    console.log('📅 Date range para filtro', periodFilter, ':', dateRange);
    
    // Debug: verificar todos los time entries
    const mayEntries = timeEntries.filter((e: any) => new Date(e.date).getMonth() === 4);
    const juneEntries = timeEntries.filter((e: any) => new Date(e.date).getMonth() === 5);
    console.log('📊 Time entries por mes:', {
      mayo: mayEntries.length,
      junio: juneEntries.length,
      total: timeEntries.length
    });
    
    const periodEntries = dateRange 
      ? timeEntries.filter((entry: any) => {
          const entryDate = new Date(entry.date);
          const dateMatch = entryDate >= dateRange.startDate && entryDate <= dateRange.endDate;
          
          if (selectedClient === 'all') return dateMatch;
          
          // Filtrar por cliente si hay uno seleccionado
          const project = projects.find(p => p.id === entry.projectId);
          return dateMatch && project && project.clientId === parseInt(selectedClient);
        })
      : timeEntries.filter((entry: any) => {
          if (selectedClient === 'all') return true;
          const project = projects.find(p => p.id === entry.projectId);
          return project && project.clientId === parseInt(selectedClient);
        });
    
    console.log('📊 Entries filtradas por período:', periodEntries.length);

    // Métricas de tiempo y costos
    const totalHours = periodEntries.reduce((sum: number, entry: any) => sum + (entry.hours || 0), 0);
    const totalCost = periodEntries.reduce((sum: number, entry: any) => sum + (entry.totalCost || 0), 0);

    // Análisis por proyecto
    const projectMetrics = filteredProjects.map(project => {
      const projectEntries = periodEntries.filter((e: any) => e.projectId === project.id);
      const hours = projectEntries.reduce((sum: number, e: any) => sum + (e.hours || 0), 0);
      const cost = projectEntries.reduce((sum: number, e: any) => sum + (e.totalCost || 0), 0);
      
      // Determinar si es Always-On
      const isAlwaysOn = alwaysOnProjects.includes(project);
      
      // Para Always-On, el budget es mensual. Para únicos, es el total
      let budget = 0;
      let periodBudget = 0;
      
      if (isAlwaysOn) {
        // Para Always-On, usar presupuesto mensual
        const monthlyBudget = project.macroMonthlyBudget || project.quotation?.totalAmount || 0;
        
        // Calcular cuántos meses abarca el período seleccionado
        if (dateFilter === 'this-month' || dateFilter === 'last-month' || 
            ['january', 'february', 'march', 'april', 'may', 'june', 
             'july', 'august', 'september', 'october', 'november', 'december'].includes(dateFilter)) {
          periodBudget = monthlyBudget;
        } else if (dateFilter === 'this-quarter' || dateFilter === 'last-quarter' ||
                   dateFilter === 'q1' || dateFilter === 'q2' || dateFilter === 'q3' || dateFilter === 'q4') {
          periodBudget = monthlyBudget * 3;
        } else if (dateFilter === 'this-semester' || dateFilter === 'last-semester') {
          periodBudget = monthlyBudget * 6;
        } else if (dateFilter === 'this-year') {
          periodBudget = monthlyBudget * 12;
        } else {
          // Para histórico completo, usar el total de meses con datos
          const uniqueMonths = new Set(
            projectEntries.map((e: any) => {
              const date = new Date(e.date);
              return `${date.getFullYear()}-${date.getMonth()}`;
            })
          );
          periodBudget = monthlyBudget * (uniqueMonths.size || 1);
        }
        budget = periodBudget;
      } else {
        // Para proyectos únicos, usar el presupuesto total
        budget = project.quotation?.totalAmount || 0;
        periodBudget = budget;
      }
      
      // Calcular eficiencia: qué porcentaje del presupuesto del período se ha usado
      const efficiency = periodBudget > 0 && cost > 0 ? (cost / periodBudget) * 100 : 0;
      
      // Calcular rentabilidad: margen de ganancia sobre el costo
      const revenue = periodBudget; // Lo que se cobra al cliente en el período
      const profitMargin = cost > 0 ? ((revenue - cost) / cost) * 100 : 0;
      
      return {
        id: project.id,
        name: project.quotation?.projectName || `Proyecto ${project.id}`,
        hours,
        cost,
        budget,
        efficiency: Math.min(100, efficiency), // Limitar a 100% máximo
        profitMargin: profitMargin,
        type: alwaysOnProjects.includes(project) ? 'always-on' : 'unique'
      };
    });

    // Tendencias mensuales (últimos 6 meses)
    const monthlyTrends = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const month = date.getMonth();
      const year = date.getFullYear();
      
      const monthEntries = timeEntries.filter((entry: any) => {
        const entryDate = new Date(entry.date);
        return entryDate.getFullYear() === year && entryDate.getMonth() === month;
      });
      
      const hours = monthEntries.reduce((sum: number, e: any) => sum + (e.hours || 0), 0);
      const cost = monthEntries.reduce((sum: number, e: any) => sum + (e.totalCost || 0), 0);
      
      // Calcular revenue del mes (facturación)
      let monthRevenue = 0;
      
      // Para proyectos Always-On, sumar el precio mensual si tienen actividad en el mes
      alwaysOnProjects.forEach(project => {
        const hasActivity = monthEntries.some((entry: any) => entry.projectId === project.id);
        if (hasActivity) {
          monthRevenue += project.quotation?.totalAmount || project.macroMonthlyBudget || 0;
        }
      });
      
      // Para proyectos únicos, prorratearlo si tienen actividad en el mes
      uniqueProjects.forEach(project => {
        const projectEntries = monthEntries.filter((entry: any) => entry.projectId === project.id);
        if (projectEntries.length > 0) {
          // Si el proyecto tiene actividad, incluir parte proporcional del revenue
          const totalProjectHours = timeEntries.filter((e: any) => e.projectId === project.id)
            .reduce((sum: number, e: any) => sum + (e.hours || 0), 0);
          const monthProjectHours = projectEntries.reduce((sum: number, e: any) => sum + (e.hours || 0), 0);
          
          if (totalProjectHours > 0) {
            const proportion = monthProjectHours / totalProjectHours;
            monthRevenue += (project.quotation?.totalAmount || 0) * proportion;
          }
        }
      });
      
      monthlyTrends.push({
        month: format(date, 'MMM', { locale: es }),
        hours,
        cost,
        revenue: monthRevenue,
        costs: cost,
        margin: monthRevenue > 0 ? ((monthRevenue - cost) / monthRevenue * 100) : 0,
        efficiency: hours > 0 ? 95 + (Math.random() * 10) : 0 // Simulated efficiency for demo
      });
    }

    // Calculate filtered revenue based on the selected period
    let filteredRevenue = 0;
    console.log('💸 Iniciando cálculo de revenue filtrado para período:', dateFilter);
    console.log('💸 Rango de fechas:', dateRange);
    
    if (dateRange) {
      // For Always-On projects, calculate based on months with activity in the period
      alwaysOnProjects.forEach(project => {
        const projectEntries = periodEntries.filter((e: any) => e.projectId === project.id);
        if (projectEntries.length > 0) {
          const monthlyRate = project.quotation?.totalAmount || project.macroMonthlyBudget || 0;
          
          // Count unique months with activity in the filtered period
          const monthsWithActivity = new Set();
          projectEntries.forEach((entry: any) => {
            const date = new Date(entry.date);
            monthsWithActivity.add(`${date.getFullYear()}-${date.getMonth()}`);
          });
          
          // Para el período seleccionado, calcular correctamente los meses
          let actualMonths = monthsWithActivity.size;
          
          // Si estamos en Q2 2025 (trimestre pasado) y tenemos datos en mayo y junio
          if (dateFilter === 'trimestre-pasado' || dateFilter === 'q2') {
            // Para Q2, contar solo los meses con datos reales
            actualMonths = monthsWithActivity.size;
          }
          
          const projectRevenue = monthlyRate * actualMonths;
          console.log(`💰 Always-On ${project.quotation?.projectName || project.id}: ID=${project.id}, $${monthlyRate}/mes × ${actualMonths} meses = $${projectRevenue}`);
          console.log('   Meses con actividad:', Array.from(monthsWithActivity));
          console.log('   Entradas encontradas:', projectEntries.length);
          filteredRevenue += projectRevenue;
        }
      });
      
      // For unique projects, include proportional revenue if they have activity in the period
      uniqueProjects.forEach(project => {
        const projectEntries = periodEntries.filter((e: any) => e.projectId === project.id);
        if (projectEntries.length > 0) {
          const totalProjectHours = timeEntries.filter((e: any) => e.projectId === project.id)
            .reduce((sum: number, e: any) => sum + (e.hours || 0), 0);
          const periodProjectHours = projectEntries.reduce((sum: number, e: any) => sum + (e.hours || 0), 0);
          
          if (totalProjectHours > 0) {
            const proportion = periodProjectHours / totalProjectHours;
            const projectUniqueRevenue = (project.quotation?.totalAmount || 0) * proportion;
            console.log(`💼 Unique Project ${project.quotation?.projectName || project.id}: ID=${project.id}, $${project.quotation?.totalAmount} × ${(proportion * 100).toFixed(1)}% = $${projectUniqueRevenue.toFixed(2)}`);
            filteredRevenue += projectUniqueRevenue;
          }
        }
      });
    } else {
      // For "all" filter, calculate full potential revenue
      const totalMonthsWithData = new Set();
      timeEntries.forEach((entry: any) => {
        const date = new Date(entry.date);
        totalMonthsWithData.add(`${date.getFullYear()}-${date.getMonth()}`);
      });
      
      filteredRevenue = monthlyRevenue * totalMonthsWithData.size + totalRevenue;
    }

    // Calculate variable costs for the period
    const variableCosts = periodEntries.reduce((sum: number, entry: any) => {
      const person = personnel.find((p: any) => p.id === entry.personnelId);
      if (person && (person.contractType === 'part-time' || person.contractType === 'freelance')) {
        return sum + (entry.totalCost || 0);
      }
      return sum;
    }, 0);

    console.log('💸 Revenue final calculado:', {
      monthlyRevenue,
      totalRevenue,
      filteredRevenue,
      combinedRevenue: filteredRevenue,
      formula: `filteredRevenue = ${filteredRevenue.toFixed(2)}`
    });
    
    return {
      // Métricas básicas
      alwaysOnProjects: alwaysOnProjects.length,
      uniqueProjects: uniqueProjects.length,
      totalProjects: filteredProjects.length,
      activeClients: selectedClient === 'all' ? clients.length : 1,
      monthlyRevenue,
      totalRevenue,
      combinedRevenue: filteredRevenue,
      
      // Métricas de tiempo y costos
      totalHours,
      totalCost,
      avgHourlyRate: totalHours > 0 ? totalCost / totalHours : 0,
      revenuePerHour: totalHours > 0 ? (monthlyRevenue + totalRevenue) / totalHours : 0,
      
      // Personnel costs by type
      fixedMonthlyCosts,
      variableCosts,
      fullTimeCount: fullTimePersonnel.length,
      partTimeCount: partTimePersonnel.length,
      
      // Métricas de eficiencia
      avgEfficiency: projectMetrics.length > 0 
        ? projectMetrics.reduce((sum, p) => sum + p.efficiency, 0) / projectMetrics.length 
        : 0,
      avgProfitMargin: projectMetrics.length > 0 
        ? projectMetrics.reduce((sum, p) => sum + p.profitMargin, 0) / projectMetrics.length 
        : 0,
      
      // Estados
      completedDeliverables: deliverables.filter((d: any) => {
        if (selectedClient === 'all') return d.status === 'completed';
        const project = projects.find(p => p.id === d.projectId);
        return d.status === 'completed' && project && project.clientId === parseInt(selectedClient);
      }).length,
      pendingQuotations: quotations.filter((q: any) => {
        const statusMatch = q.status === 'pending';
        if (selectedClient === 'all') return statusMatch;
        return statusMatch && q.clientId === parseInt(selectedClient);
      }).length,
      approvedQuotations: quotations.filter((q: any) => {
        const statusMatch = q.status === 'approved';
        if (selectedClient === 'all') return statusMatch;
        return statusMatch && q.clientId === parseInt(selectedClient);
      }).length,
      
      // Datos para gráficos
      projectMetrics,
      monthlyTrends,
      
      // Comparaciones período anterior
      previousPeriodRevenue: 0, // Implementar según lógica de período
      revenueGrowth: 15.5, // Ejemplo, calcular real
      hoursGrowth: -5.2, // Ejemplo, calcular real
      costReduction: 8.3 // Ejemplo, calcular real
    };
  };

  // Calcular métricas consolidadas avanzadas
  const analytics = useMemo(() => {
    console.log('🔄 Recalculando analytics con filtro:', dateFilter, 'y cliente:', selectedClient);
    const result = calculatePeriodAnalytics(dateFilter);
    console.log('📊 Analytics recalculadas:', {
      totalProjects: result.totalProjects,
      totalHours: result.totalHours,
      totalCost: result.totalCost,
      combinedRevenue: result.combinedRevenue,
      fixedMonthlyCosts: result.fixedMonthlyCosts,
      variableCosts: result.variableCosts,
      monthlyRevenue: result.monthlyRevenue,
      totalRevenue: result.totalRevenue
    });
    return result;
  }, [projects, clients, timeEntries, quotations, deliverables, personnel, dateFilter, selectedClient]);

  // Calcular métricas del período de comparación
  const comparisonAnalytics = useMemo(() => {
    if (!compareMode) return null;
    return calculatePeriodAnalytics(comparePeriod);
  }, [projects, clients, timeEntries, quotations, deliverables, personnel, comparePeriod, compareMode, selectedClient]);

  return (
    <PageLayout
      title="Salud Corporativa"
      description="Dashboard ejecutivo con análisis integral del negocio"
      breadcrumbs={[
        { label: "Salud Corporativa", current: true }
      ]}
    >
      <TooltipProvider>
        <div className="space-y-6">
          {/* Control Panel for temporal comparison */}
          <Card className="mb-6">
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Modo comparación:</label>
                  <Button
                    variant={compareMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCompareMode(!compareMode)}
                    className="gap-2"
                  >
                    <Calendar className="h-4 w-4" />
                    {compareMode ? "Desactivar" : "Activar"} Comparación
                  </Button>
                </div>
                {compareMode && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Comparar con:</label>
                    <Select value={comparePeriod} onValueChange={setComparePeriod}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {dateFilterOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Header con métricas clave */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Card className="relative overflow-hidden cursor-help">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-600/10" />
                  <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Cash Flow Operativo</CardTitle>
                    <DollarSign className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="text-2xl font-bold">
                      ${(() => {
                        console.log('💵 Cash Flow Operativo:', analytics.combinedRevenue);
                        return analytics.combinedRevenue.toLocaleString();
                      })()}
                    </div>
                    {compareMode && comparisonAnalytics && (
                      <div className="flex items-center gap-1 mt-1">
                        {analytics.combinedRevenue > comparisonAnalytics.combinedRevenue ? (
                          <ArrowUpRight className="h-3 w-3 text-green-600" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3 text-red-600" />
                        )}
                        <span className={cn(
                          "text-xs font-medium",
                          analytics.combinedRevenue > comparisonAnalytics.combinedRevenue ? "text-green-600" : "text-red-600"
                        )}>
                          {((analytics.combinedRevenue / comparisonAnalytics.combinedRevenue - 1) * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      Liquidez: ${(analytics.combinedRevenue - (analytics.fixedMonthlyCosts + analytics.variableCosts)).toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-semibold mb-1">Cash Flow Operativo</p>
                <p className="text-sm">Es el dinero real que entra menos el que sale en el período. La liquidez muestra tu capacidad de pagar obligaciones inmediatas.</p>
                <p className="text-sm mt-1">
                  <span className="font-medium">Bueno:</span> Positivo y creciente<br/>
                  <span className="font-medium">Alerta:</span> Cercano a cero o negativo
                </p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Card className="relative overflow-hidden cursor-help">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-emerald-600/10" />
                  <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">EBITDA</CardTitle>
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="text-2xl font-bold">
                      ${(analytics.combinedRevenue - (analytics.fixedMonthlyCosts + analytics.variableCosts)).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Margen EBITDA: {analytics.combinedRevenue > 0 ? ((analytics.combinedRevenue - (analytics.fixedMonthlyCosts + analytics.variableCosts)) / analytics.combinedRevenue * 100).toFixed(1) : '0'}%
                      <span className="text-xs ml-1">(Costos reales)</span>
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-semibold mb-1">EBITDA (Ganancia Operativa)</p>
                <p className="text-sm">Ganancia antes de impuestos, intereses y amortizaciones. Muestra la rentabilidad real de tu operación.</p>
                <p className="text-sm mt-1">
                  <span className="font-medium">Excelente:</span> Margen &gt;40%<br/>
                  <span className="font-medium">Bueno:</span> Margen 20-40%<br/>
                  <span className="font-medium">Alerta:</span> Margen &lt;20%
                </p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Card className="relative overflow-hidden cursor-help">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-green-600/10" />
                  <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Burn Rate</CardTitle>
                    <Activity className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="text-2xl font-bold">
                      ${(() => {
                        // Para burn rate, usar el costo real del período (totalCost de los time entries)
                        const totalCosts = analytics.totalCost;
                        
                        // Para burn rate, contar meses reales con datos en el período
                        if (dateFilter === 'all') {
                          // Para histórico completo, contar todos los meses únicos
                          const allMonths = new Set();
                          timeEntries.forEach((entry: any) => {
                            const entryDate = new Date(entry.date);
                            allMonths.add(`${entryDate.getFullYear()}-${entryDate.getMonth()}`);
                          });
                          const totalMonths = Math.max(1, allMonths.size);
                          return (totalCosts / totalMonths).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                        }
                        
                        // Contar meses únicos con datos en el período filtrado
                        const uniqueMonths = new Set();
                        const dateRange = getDateRangeForFilter(dateFilter);
                        
                        timeEntries.forEach((entry: any) => {
                          const entryDate = new Date(entry.date);
                          if (dateRange && entryDate >= dateRange.startDate && entryDate <= dateRange.endDate) {
                            uniqueMonths.add(`${entryDate.getFullYear()}-${entryDate.getMonth()}`);
                          }
                        });
                        
                        let monthsWithData = Math.max(1, uniqueMonths.size);
                        const monthsList = Array.from(uniqueMonths).sort();
                        console.log(`📅 Meses únicos con datos en el período ${dateFilter}: ${monthsList.join(', ')}`);
                        console.log(`💵 Total costs del período: $${totalCosts.toFixed(2)}`);
                        
                        const burnRate = totalCosts / monthsWithData;
                        console.log(`💰 Burn Rate: $${totalCosts.toFixed(2)} / ${monthsWithData} meses = $${burnRate.toFixed(2)}`);
                        return burnRate.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                      })()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Gasto mensual promedio real
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-semibold mb-1">Burn Rate (Velocidad de Gasto)</p>
                <p className="text-sm">Es cuánto dinero gastas por mes en promedio. Indica cuánto tiempo puedes operar con tus recursos actuales.</p>
                <p className="text-sm mt-1">
                  <span className="font-medium">Óptimo:</span> &lt;$15,000/mes<br/>
                  <span className="font-medium">Controlado:</span> $15-25,000/mes<br/>
                  <span className="font-medium">Alto:</span> &gt;$25,000/mes
                </p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Card className="relative overflow-hidden cursor-help">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-purple-600/10" />
                  <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
                    <TrendingUp className="h-4 w-4 text-purple-600" />
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="text-2xl font-bold">
                      ${(analytics.pendingQuotations * 30000).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {analytics.pendingQuotations} cotizaciones activas
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-semibold mb-1">Pipeline Value (Valor de Oportunidades)</p>
                <p className="text-sm">Valor total estimado de las cotizaciones pendientes. Indica el potencial de ingresos futuros si cierras todas las ventas.</p>
                <p className="text-sm mt-1">
                  <span className="font-medium">Excelente:</span> 5+ cotizaciones<br/>
                  <span className="font-medium">Bueno:</span> 3-5 cotizaciones<br/>
                  <span className="font-medium">Bajo:</span> &lt;3 cotizaciones
                </p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Card className="relative overflow-hidden cursor-help">
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-amber-600/10" />
                  <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Utilización</CardTitle>
                    <Clock className="h-4 w-4 text-amber-600" />
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="text-2xl font-bold">
                      {(() => {
                        if (analytics.totalProjects === 0) return '0';
                        
                        // Calcular utilización basada en capacidad teórica del equipo
                        const dateRange = getDateRangeForFilter(dateFilter);
                        if (!dateRange) return ((analytics.totalHours / (160 * personnel.length)) * 100).toFixed(0);
                        
                        const monthsInPeriod = Math.max(1,
                          Math.ceil((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
                        );
                        
                        // Capacidad teórica = personas × 160h/mes × meses
                        const theoreticalCapacity = personnel.length * 160 * monthsInPeriod;
                        const utilization = (analytics.totalHours / theoreticalCapacity) * 100;
                        console.log('📊 Utilización:', {
                          totalHours: analytics.totalHours,
                          personnel: personnel.length,
                          monthsInPeriod,
                          theoreticalCapacity,
                          utilization: utilization.toFixed(1) + '%'
                        });
                        return utilization.toFixed(0);
                      })()}%
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {analytics.totalHours.toFixed(0)}h de capacidad utilizada
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-semibold mb-1">Utilización del Equipo</p>
                <p className="text-sm">Porcentaje de horas trabajadas vs capacidad total disponible. Muestra qué tan ocupado está tu equipo.</p>
                <p className="text-sm mt-1">
                  <span className="font-medium">Óptimo:</span> 70-85%<br/>
                  <span className="font-medium">Aceptable:</span> 50-70%<br/>
                  <span className="font-medium">Bajo:</span> &lt;50% (capacidad ociosa)
                </p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Filtro temporal único */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-64 h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <CalendarIconLucide className="mr-2 h-4 w-4 text-gray-400" />
                    <SelectValue placeholder="Seleccionar período" />
                  </SelectTrigger>
                <SelectContent>
                  {/* Agrupar opciones por categoría */}
                  {["General", "Trimestres", "Meses"].map(group => (
                    <div key={group}>
                      <div className="px-2 py-1.5 text-xs font-medium text-gray-500 bg-gray-50">
                        {group}
                      </div>
                      {dateFilterOptions
                        .filter(option => option.group === group)
                        .map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                    </div>
                  ))}
                </SelectContent>
                </Select>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-semibold mb-1">Filtro de Período</p>
                    <p className="text-sm">Filtra todas las métricas del dashboard por el período seleccionado. Los datos se ajustan automáticamente para mostrar información relevante del tiempo elegido.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="w-48">
                  <Building2 className="mr-2 h-4 w-4 text-gray-400" />
                  <SelectValue placeholder="Todos los clientes" />
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
            
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar Reporte
            </Button>
          </div>



        {/* Tabs de análisis reorganizadas */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Vista General
            </TabsTrigger>
            <TabsTrigger value="projects" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Análisis de Proyectos
            </TabsTrigger>
            <TabsTrigger value="financial" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Salud Financiera
            </TabsTrigger>
            <TabsTrigger value="insights" className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Insights y Recomendaciones
            </TabsTrigger>
          </TabsList>

          {/* PESTAÑA 1: VISTA GENERAL */}
          <TabsContent value="overview" className="space-y-6">
            {/* Resumen Ejecutivo Mejorado */}
            <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Target className="h-6 w-6 text-blue-600" />
                  Resumen Ejecutivo - {dateFilterOptions.find(opt => opt.value === dateFilter)?.label || 'Período'}
                </CardTitle>
                <CardDescription>
                  Análisis integral del rendimiento empresarial con métricas accionables
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Salud Financiera */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      Salud Financiera
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Facturación</span>
                        <span className="font-semibold text-green-600">
                          ${analytics.combinedRevenue.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Costos Operativos</span>
                        <span className="font-semibold text-orange-600">
                          ${analytics.totalCost.toLocaleString()}
                        </span>
                      </div>
                      <div className="pt-2 border-t">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Utilidad Neta</span>
                          <span className={cn(
                            "font-bold text-lg",
                            analytics.combinedRevenue > analytics.totalCost ? "text-green-600" : "text-red-600"
                          )}>
                            ${(analytics.combinedRevenue - analytics.totalCost).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-xs text-muted-foreground">Margen</span>
                          <span className="text-sm font-medium">
                            {analytics.combinedRevenue > 0 
                              ? `${((analytics.combinedRevenue - analytics.totalCost) / analytics.combinedRevenue * 100).toFixed(1)}%`
                              : '0%'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Eficiencia Operacional */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Activity className="h-5 w-5 text-orange-600" />
                      Eficiencia Operacional
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Proyectos Activos</span>
                        <span className="font-semibold">{analytics.activeProjects}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Horas Facturables</span>
                        <span className="font-semibold">{analytics.totalHours.toFixed(0)}h</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Productividad</span>
                        <span className="font-semibold text-blue-600">
                          ${analytics.totalHours > 0 
                            ? (analytics.combinedRevenue / analytics.totalHours).toFixed(0)
                            : '0'}/hora
                        </span>
                      </div>
                      <div className="pt-2 border-t">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Burn Rate Mensual</span>
                          <span className="font-bold text-lg text-orange-600">
                            ${(() => {
                              const totalCosts = analytics.totalCost;
                              const uniqueMonths = new Set();
                              const dateRange = getDateRangeForFilter(dateFilter);
                              
                              timeEntries.forEach((entry: any) => {
                                const entryDate = new Date(entry.date);
                                if (dateRange && entryDate >= dateRange.startDate && entryDate <= dateRange.endDate) {
                                  uniqueMonths.add(`${entryDate.getFullYear()}-${entryDate.getMonth()}`);
                                }
                              });
                              
                              const monthsWithData = Math.max(1, uniqueMonths.size);
                              return (totalCosts / monthsWithData).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pipeline y Crecimiento */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-purple-600" />
                      Pipeline Comercial
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Oportunidades</span>
                        <span className="font-semibold">{analytics.pendingQuotations}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Valor Pipeline</span>
                        <span className="font-semibold text-purple-600">
                          ${(analytics.pendingQuotations * 30000).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Tasa Conversión</span>
                        <span className="font-semibold">
                          {analytics.approvedQuotations + analytics.pendingQuotations > 0
                            ? `${(analytics.approvedQuotations / (analytics.approvedQuotations + analytics.pendingQuotations) * 100).toFixed(0)}%`
                            : '0%'}
                        </span>
                      </div>
                      <div className="pt-2 border-t">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Proyección Q3</span>
                          <span className="font-bold text-lg text-purple-600">
                            ${((analytics.pendingQuotations * 30000 * 0.4) + analytics.monthlyRevenue * 3).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Métricas de Rendimiento Visual */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Portfolio Breakdown con valores monetarios */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-blue-600" />
                    Composición del Portfolio por Valor
                  </CardTitle>
                  <CardDescription>
                    Distribución de ingresos por tipo de contrato
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={[
                            { 
                              name: 'Contratos Recurrentes', 
                              value: analytics.monthlyRevenue || 0,
                              count: alwaysOnProjects.length,
                              percentage: analytics.monthlyRevenue + analytics.totalRevenue > 0 
                                ? (analytics.monthlyRevenue / (analytics.monthlyRevenue + analytics.totalRevenue) * 100).toFixed(1)
                                : 0
                            },
                            { 
                              name: 'Proyectos Únicos', 
                              value: analytics.totalRevenue || 0,
                              count: uniqueProjects.length,
                              percentage: analytics.monthlyRevenue + analytics.totalRevenue > 0 
                                ? (analytics.totalRevenue / (analytics.monthlyRevenue + analytics.totalRevenue) * 100).toFixed(1)
                                : 0
                            }
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ percentage }) => `${percentage}%`}
                        >
                          <Cell fill="#3B82F6" />
                          <Cell fill="#10B981" />
                        </Pie>
                        <RechartsTooltip 
                          formatter={(value: any, name: any, props: any) => [
                            `$${value.toLocaleString()}`,
                            `${name} (${props.payload.count} proyectos)`
                          ]}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full" />
                        <span className="text-sm font-medium">Recurrentes</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">${analytics.monthlyRevenue.toLocaleString()}/mes</p>
                        <p className="text-xs text-muted-foreground">{alwaysOnProjects.length} contratos activos</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full" />
                        <span className="text-sm font-medium">Únicos</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">${analytics.totalRevenue.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{uniqueProjects.length} proyectos en curso</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tendencia Financiera Simplificada */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-green-600" />
                    Tendencia Financiera
                  </CardTitle>
                  <CardDescription>
                    Evolución mensual de ingresos vs costos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.monthlyTrends}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <RechartsTooltip 
                          formatter={(value: any, name: any) => [
                            `$${value.toLocaleString()}`,
                            name
                          ]}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="revenue" 
                          stackId="1"
                          stroke="#3B82F6" 
                          fill="#3B82F6" 
                          fillOpacity={0.6}
                          name="Ingresos" 
                        />
                        <Area 
                          type="monotone" 
                          dataKey="costs" 
                          stackId="1"
                          stroke="#EF4444" 
                          fill="#EF4444" 
                          fillOpacity={0.6}
                          name="Costos" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                    <div className="p-2 bg-blue-50 rounded">
                      <p className="text-xs text-muted-foreground">Promedio Ingresos</p>
                      <p className="text-sm font-bold text-blue-600">
                        ${analytics.monthlyTrends.length > 0 
                          ? (analytics.monthlyTrends.reduce((sum, m) => sum + m.revenue, 0) / analytics.monthlyTrends.length).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                          : '0'}
                      </p>
                    </div>
                    <div className="p-2 bg-green-50 rounded">
                      <p className="text-xs text-muted-foreground">Margen Promedio</p>
                      <p className="text-sm font-bold text-green-600">
                        {analytics.combinedRevenue > 0 
                          ? ((analytics.combinedRevenue - analytics.totalCost) / analytics.combinedRevenue * 100).toFixed(1)
                          : '0'}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Indicadores de Acción Inmediata */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                  Panel de Control Ejecutivo
                </CardTitle>
                <CardDescription>
                  Indicadores clave que requieren atención inmediata
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Estado de Salud General */}
                  <div className={cn(
                    "p-4 rounded-lg border-2 text-center",
                    analytics.combinedRevenue > analytics.totalCost * 1.3
                      ? "border-green-200 bg-green-50"
                      : analytics.combinedRevenue > analytics.totalCost
                      ? "border-yellow-200 bg-yellow-50"
                      : "border-red-200 bg-red-50"
                  )}>
                    <Shield className={cn(
                      "h-8 w-8 mx-auto mb-2",
                      analytics.combinedRevenue > analytics.totalCost * 1.3
                        ? "text-green-600"
                        : analytics.combinedRevenue > analytics.totalCost
                        ? "text-yellow-600"
                        : "text-red-600"
                    )} />
                    <p className="text-sm font-medium">Estado General</p>
                    <p className="text-lg font-bold">
                      {analytics.combinedRevenue > analytics.totalCost * 1.3
                        ? "Saludable"
                        : analytics.combinedRevenue > analytics.totalCost
                        ? "Estable"
                        : "Crítico"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      ROI: {analytics.totalCost > 0 
                        ? `${((analytics.combinedRevenue / analytics.totalCost - 1) * 100).toFixed(0)}%`
                        : '0%'}
                    </p>
                  </div>

                  {/* Proyectos en Riesgo */}
                  <div className={cn(
                    "p-4 rounded-lg border-2 text-center",
                    analytics.projectMetrics.filter((p: any) => p.efficiency < 80).length === 0
                      ? "border-green-200 bg-green-50"
                      : analytics.projectMetrics.filter((p: any) => p.efficiency < 80).length <= 2
                      ? "border-yellow-200 bg-yellow-50"
                      : "border-red-200 bg-red-50"
                  )}>
                    <AlertTriangle className={cn(
                      "h-8 w-8 mx-auto mb-2",
                      analytics.projectMetrics.filter((p: any) => p.efficiency < 80).length === 0
                        ? "text-green-600"
                        : analytics.projectMetrics.filter((p: any) => p.efficiency < 80).length <= 2
                        ? "text-yellow-600"
                        : "text-red-600"
                    )} />
                    <p className="text-sm font-medium">Proyectos en Riesgo</p>
                    <p className="text-2xl font-bold">
                      {analytics.projectMetrics.filter((p: any) => p.efficiency < 80).length}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      de {analytics.projectMetrics.length} totales
                    </p>
                  </div>

                  {/* Control de Gastos */}
                  <div className={cn(
                    "p-4 rounded-lg border-2 text-center",
                    analytics.totalCost / Math.max(1, new Set(timeEntries.map((e: any) => `${new Date(e.date).getFullYear()}-${new Date(e.date).getMonth()}`)).size) < 10000
                      ? "border-green-200 bg-green-50"
                      : analytics.totalCost / Math.max(1, new Set(timeEntries.map((e: any) => `${new Date(e.date).getFullYear()}-${new Date(e.date).getMonth()}`)).size) < 15000
                      ? "border-yellow-200 bg-yellow-50"
                      : "border-red-200 bg-red-50"
                  )}>
                    <Wallet className={cn(
                      "h-8 w-8 mx-auto mb-2",
                      analytics.totalCost / Math.max(1, new Set(timeEntries.map((e: any) => `${new Date(e.date).getFullYear()}-${new Date(e.date).getMonth()}`)).size) < 10000
                        ? "text-green-600"
                        : analytics.totalCost / Math.max(1, new Set(timeEntries.map((e: any) => `${new Date(e.date).getFullYear()}-${new Date(e.date).getMonth()}`)).size) < 15000
                        ? "text-yellow-600"
                        : "text-red-600"
                    )} />
                    <p className="text-sm font-medium">Burn Rate</p>
                    <p className="text-lg font-bold">
                      ${(analytics.totalCost / Math.max(1, new Set(timeEntries.map((e: any) => `${new Date(e.date).getFullYear()}-${new Date(e.date).getMonth()}`)).size)).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      gasto mensual
                    </p>
                  </div>

                  {/* Capacidad del Equipo */}
                  <div className={cn(
                    "p-4 rounded-lg border-2 text-center",
                    analytics.activeProjects > 0 && (analytics.totalHours / (analytics.activeProjects * 160)) < 0.7
                      ? "border-blue-200 bg-blue-50"
                      : analytics.activeProjects > 0 && (analytics.totalHours / (analytics.activeProjects * 160)) < 0.9
                      ? "border-green-200 bg-green-50"
                      : "border-orange-200 bg-orange-50"
                  )}>
                    <Users className={cn(
                      "h-8 w-8 mx-auto mb-2",
                      analytics.activeProjects > 0 && (analytics.totalHours / (analytics.activeProjects * 160)) < 0.7
                        ? "text-blue-600"
                        : analytics.activeProjects > 0 && (analytics.totalHours / (analytics.activeProjects * 160)) < 0.9
                        ? "text-green-600"
                        : "text-orange-600"
                    )} />
                    <p className="text-sm font-medium">Capacidad Utilizada</p>
                    <p className="text-2xl font-bold">
                      {analytics.activeProjects > 0 
                        ? `${((analytics.totalHours / (analytics.activeProjects * 160)) * 100).toFixed(0)}%`
                        : '0%'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {analytics.totalHours.toFixed(0)}h de {analytics.activeProjects * 160}h
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PESTAÑA 2: ANÁLISIS DE PROYECTOS */}
          <TabsContent value="projects" className="space-y-6">
            {/* Tabla de eficiencia por proyecto */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Análisis de Eficiencia por Proyecto
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="font-semibold mb-1">Análisis de Eficiencia</p>
                          <p className="text-sm">Compara el presupuesto cotizado vs el costo real ejecutado de cada proyecto en el período seleccionado.</p>
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                    <CardDescription>
                      Comparación de presupuesto vs costo real para proyectos activos
                    </CardDescription>
                  </div>
                  <Activity className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Proyecto</th>
                        <th className="text-center p-2">Tipo</th>
                        <th className="text-center p-2">Presupuesto</th>
                        <th className="text-center p-2">Costo Real</th>
                        <th className="text-center p-2">Eficiencia</th>
                        <th className="text-center p-2">Margen</th>
                        <th className="text-center p-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.projectMetrics.map((project) => (
                        <tr key={project.id} className="border-b hover:bg-muted/50">
                          <td className="p-2">
                            <Link href={`/active-projects/${project.id}`} className="font-medium hover:underline">
                              {project.name}
                            </Link>
                          </td>
                          <td className="p-2 text-center">
                            <Badge variant={project.type === 'always-on' ? 'default' : 'secondary'}>
                              {project.type === 'always-on' ? 'Always-On' : 'Único'}
                            </Badge>
                          </td>
                          <td className="p-2 text-center">${project.budget.toLocaleString()}</td>
                          <td className="p-2 text-center">${project.cost.toLocaleString()}</td>
                          <td className="p-2 text-center">
                            <span className={cn(
                              "font-medium",
                              project.efficiency > 100 ? "text-green-600" : 
                              project.efficiency > 80 ? "text-blue-600" : "text-red-600"
                            )}>
                              {project.efficiency.toFixed(0)}%
                            </span>
                          </td>
                          <td className="p-2 text-center">
                            <span className={cn(
                              "text-sm font-medium",
                              project.profitMargin > 50 ? "text-green-600" : 
                              project.profitMargin > 20 ? "text-blue-600" : "text-red-600"
                            )}>
                              {project.profitMargin.toFixed(0)}%
                            </span>
                          </td>
                          <td className="p-2 text-center">
                            {project.efficiency > 80 && project.profitMargin > 50 ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                            ) : project.efficiency < 50 || project.profitMargin < 20 ? (
                              <XCircle className="h-4 w-4 text-red-600 mx-auto" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-amber-600 mx-auto" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top 5 proyectos por rentabilidad */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Top 5 Proyectos por Rentabilidad</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analytics.projectMetrics
                      .sort((a, b) => b.profitMargin - a.profitMargin)
                      .slice(0, 5)
                      .map((project, index) => (
                        <div key={project.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {index + 1}. {project.name}
                              </span>
                              <Badge variant={project.type === 'always-on' ? 'default' : 'secondary'} className="text-xs">
                                {project.type === 'always-on' ? 'Always-On' : 'Único'}
                              </Badge>
                            </div>
                            <span className={cn(
                              "text-sm font-bold",
                              project.profitMargin > 50 ? "text-green-600" : 
                              project.profitMargin > 20 ? "text-blue-600" : "text-amber-600"
                            )}>
                              {project.profitMargin.toFixed(1)}%
                            </span>
                          </div>
                          <Progress 
                            value={Math.max(0, Math.min(100, project.profitMargin))} 
                            className="h-2"
                          />
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              {/* Distribución de horas por tipo */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Distribución de Horas por Tipo</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <RechartsPieChart>
                      <Pie
                        data={[
                          { 
                            name: 'Always-On', 
                            value: analytics.projectMetrics
                              .filter(p => p.type === 'always-on')
                              .reduce((sum, p) => sum + p.hours, 0)
                          },
                          { 
                            name: 'Únicos', 
                            value: analytics.projectMetrics
                              .filter(p => p.type === 'unique')
                              .reduce((sum, p) => sum + p.hours, 0)
                          }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                      >
                        <Cell fill={CHART_COLORS.indigo} />
                        <Cell fill={CHART_COLORS.teal} />
                      </Pie>
                      <RechartsTooltip 
                        formatter={(value: any) => `${Number(value).toFixed(0)}h`}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-6 mt-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS.indigo }}></div>
                      <span className="text-sm">Always-On</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS.teal }}></div>
                      <span className="text-sm">Únicos</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Análisis de tendencias por proyecto */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="h-5 w-5 text-purple-600" />
                  Análisis de Tendencias por Proyecto
                </CardTitle>
                <CardDescription>
                  Evolución de eficiencia y rentabilidad en el tiempo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.projectMetrics}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      interval={0}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis />
                    <RechartsTooltip 
                      formatter={(value: any, name: any) => {
                        if (name === 'Presupuesto' || name === 'Costo') {
                          return `$${Number(value).toLocaleString()}`;
                        }
                        return `${Number(value).toFixed(1)}%`;
                      }}
                    />
                    <Legend />
                    <Bar dataKey="budget" fill={CHART_COLORS.primary} name="Presupuesto" />
                    <Bar dataKey="cost" fill={CHART_COLORS.tertiary} name="Costo" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Client Concentration Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-orange-600" />
                    Análisis de Concentración de Clientes
                  </CardTitle>
                  <CardDescription>
                    Distribución de ingresos por cliente
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
                      <Pie
                        data={Object.entries(
                          analytics.projectMetrics.reduce((acc: any, project) => {
                            const clientName = project.clientName || 'Sin cliente';
                            if (!acc[clientName]) {
                              acc[clientName] = { name: clientName, value: 0, projects: 0 };
                            }
                            acc[clientName].value += project.revenue;
                            acc[clientName].projects += 1;
                            return acc;
                          }, {})
                        ).map(([_, data]: any) => data)
                          .sort((a, b) => b.value - a.value)
                          .slice(0, 5)}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {[CHART_COLORS.primary, CHART_COLORS.secondary, CHART_COLORS.tertiary, CHART_COLORS.purple, CHART_COLORS.pink].map((color, index) => (
                          <Cell key={`cell-${index}`} fill={color} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        formatter={(value: any, name: any, props: any) => [
                          `$${Number(value).toLocaleString()}`,
                          `${props.payload.projects} proyectos`
                        ]}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                  {analytics.projectMetrics.length > 0 && (
                    <div className="mt-4 p-3 bg-amber-50 rounded-lg">
                      <p className="text-sm text-amber-800">
                        <strong>Riesgo de concentración:</strong> 
                        {(() => {
                          const topClient = Object.values(
                            analytics.projectMetrics.reduce((acc: any, p) => {
                              const client = p.clientName || 'Sin cliente';
                              acc[client] = (acc[client] || 0) + p.revenue;
                              return acc;
                            }, {})
                          ).sort((a: any, b: any) => b - a)[0] as number;
                          const percentage = (topClient / analytics.combinedRevenue) * 100;
                          return percentage > 40 ? ' Alto - Mayor cliente representa > 40% de ingresos' : ' Bajo - Buena diversificación';
                        })()}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ROI by Service Type */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-600" />
                    ROI por Tipo de Servicio
                  </CardTitle>
                  <CardDescription>
                    Rentabilidad por categoría de proyecto
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {['Always-On', 'Único', 'Consultoría', 'Desarrollo'].map((type, index) => {
                      const typeProjects = analytics.projectMetrics.filter(p => 
                        type === 'Always-On' ? p.type === 'always-on' : 
                        type === 'Único' ? p.type === 'unique' :
                        p.name.toLowerCase().includes(type.toLowerCase())
                      );
                      const avgROI = typeProjects.length > 0 
                        ? typeProjects.reduce((sum, p) => sum + p.profitMargin, 0) / typeProjects.length
                        : 0;
                      const totalRevenue = typeProjects.reduce((sum, p) => sum + p.revenue, 0);
                      
                      return (
                        <div key={type} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{type}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant={avgROI > 50 ? "default" : avgROI > 20 ? "secondary" : "destructive"}>
                                {avgROI.toFixed(0)}% ROI
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                ${totalRevenue.toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <Progress 
                            value={Math.max(0, Math.min(100, avgROI))} 
                            className="h-2"
                          />
                          <p className="text-xs text-muted-foreground">
                            {typeProjects.length} proyectos
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>



          {/* PESTAÑA 3: SALUD FINANCIERA */}
          <TabsContent value="financial" className="space-y-6">
            {/* Personnel Cost Analysis Section */}
            <Card className="border-indigo-200 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-indigo-900">
                      Análisis de Costos de Personal
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-indigo-600 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md">
                          <p className="font-semibold mb-1">Sistema Dual de Análisis</p>
                          <p className="text-sm mb-2">Este análisis considera los diferentes tipos de contratos:</p>
                          <ul className="text-sm space-y-1">
                            <li>• <strong>Full-time:</strong> Costo fijo mensual (sueldo) independiente de horas trabajadas</li>
                            <li>• <strong>Part-time/Freelance:</strong> Costo variable basado en horas reales trabajadas</li>
                          </ul>
                          <p className="text-sm mt-2">Esto permite analizar la salud corporativa real vs la rentabilidad por proyecto.</p>
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                    <CardDescription className="text-indigo-700">
                      Comparación entre costos fijos vs variables del equipo
                    </CardDescription>
                  </div>
                  <Users className="h-5 w-5 text-indigo-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <Card className="border-blue-200 bg-blue-50/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-blue-900">Costos Fijos Mensuales</CardTitle>
                      <CardDescription className="text-xs text-blue-700">Empleados Full-time</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-900">
                        ${analytics.fixedMonthlyCosts.toLocaleString()}
                      </div>
                      <p className="text-xs text-blue-700 mt-1">{analytics.fullTimeCount} empleados</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-purple-200 bg-purple-50/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-purple-900">Costos Variables</CardTitle>
                      <CardDescription className="text-xs text-purple-700">Part-time & Freelance</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-purple-900">
                        ${analytics.variableCosts.toLocaleString()}
                      </div>
                      <p className="text-xs text-purple-700 mt-1">{analytics.partTimeCount} personas</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-emerald-200 bg-emerald-50/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-emerald-900">Eficiencia Global</CardTitle>
                      <CardDescription className="text-xs text-emerald-700">ROI del equipo</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-emerald-900">
                        {analytics.combinedRevenue > 0 && (analytics.fixedMonthlyCosts + analytics.variableCosts) > 0 
                          ? ((analytics.combinedRevenue / (analytics.fixedMonthlyCosts + analytics.variableCosts)) * 100).toFixed(0) 
                          : '0'}%
                      </div>
                      <p className="text-xs text-emerald-700 mt-1">Retorno sobre costos reales</p>
                    </CardContent>
                  </Card>
                </div>
                
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium mb-1">Análisis del Período</p>
                    <p className="text-sm text-muted-foreground">
                      El análisis dual permite ver la salud corporativa real considerando todos los costos operativos.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Costo Total Real</p>
                      <p className="text-lg font-semibold">${(analytics.fixedMonthlyCosts + analytics.variableCosts).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Margen Operativo</p>
                      <p className="text-lg font-semibold">
                        {analytics.combinedRevenue > 0 
                          ? `${(((analytics.combinedRevenue - (analytics.fixedMonthlyCosts + analytics.variableCosts)) / analytics.combinedRevenue) * 100).toFixed(1)}%`
                          : '0%'}
                      </p>
                    </div>
                  </div>
                  
                  <p className="text-xs text-muted-foreground italic">
                    Configure los tipos de contrato en el panel de administración para una análisis más preciso.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Health Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className={cn(
                    "border-l-4 cursor-help",
                    analytics.combinedRevenue > analytics.totalCost * 2 ? "border-l-green-500" : 
                    analytics.combinedRevenue > analytics.totalCost * 1.5 ? "border-l-yellow-500" : "border-l-red-500"
                  )}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Salud Financiera</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {analytics.combinedRevenue > analytics.totalCost * 2 ? "Excelente" : 
                         analytics.combinedRevenue > analytics.totalCost * 1.5 ? "Buena" : "Atención"}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ratio ingresos/costos: {(analytics.combinedRevenue / analytics.totalCost).toFixed(1)}x
                      </p>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-semibold mb-1">Salud Financiera</p>
                  <p className="text-sm">Evalúa qué tan sólida es tu situación financiera comparando ingresos vs costos.</p>
                  <p className="text-sm mt-1">
                    <span className="font-medium">Excelente:</span> Ingresos &gt; 2x costos<br/>
                    <span className="font-medium">Buena:</span> Ingresos &gt; 1.5x costos<br/>
                    <span className="font-medium">Atención:</span> Ingresos &lt; 1.5x costos
                  </p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className={cn(
                    "border-l-4 cursor-help",
                    (() => {
                      const uniqueMonths = new Set();
                      const dateRange = getDateRangeForFilter(dateFilter);
                      if (dateRange) {
                        timeEntries.forEach((entry: any) => {
                          const entryDate = new Date(entry.date);
                          if (entryDate >= dateRange.startDate && entryDate <= dateRange.endDate) {
                            uniqueMonths.add(`${entryDate.getFullYear()}-${entryDate.getMonth()}`);
                          }
                        });
                      }
                      const monthsWithData = Math.max(1, uniqueMonths.size);
                      const monthlyBurnRate = analytics.totalCost / monthsWithData;
                      return monthlyBurnRate < 15000 ? "border-l-green-500" : 
                             monthlyBurnRate < 25000 ? "border-l-yellow-500" : "border-l-red-500";
                    })()
                  )}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Control de Gastos</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {(() => {
                          const uniqueMonths = new Set();
                          const dateRange = getDateRangeForFilter(dateFilter);
                          if (dateRange) {
                            timeEntries.forEach((entry: any) => {
                              const entryDate = new Date(entry.date);
                              if (entryDate >= dateRange.startDate && entryDate <= dateRange.endDate) {
                                uniqueMonths.add(`${entryDate.getFullYear()}-${entryDate.getMonth()}`);
                              }
                            });
                          }
                          const monthsWithData = Math.max(1, uniqueMonths.size);
                          const monthlyBurnRate = analytics.totalCost / monthsWithData;
                          return monthlyBurnRate < 15000 ? "Óptimo" : 
                                 monthlyBurnRate < 25000 ? "Moderado" : "Alto";
                        })()}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Burn rate mensual controlado
                      </p>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-semibold mb-1">Control de Gastos</p>
                  <p className="text-sm">Mide qué tan bien controlas el gasto mensual de la empresa (burn rate).</p>
                  <p className="text-sm mt-1">
                    <span className="font-medium">Óptimo:</span> &lt; $15,000/mes<br/>
                    <span className="font-medium">Moderado:</span> $15-25,000/mes<br/>
                    <span className="font-medium">Alto:</span> &gt; $25,000/mes
                  </p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className={cn(
                    "border-l-4 cursor-help",
                    analytics.pendingQuotations > 5 ? "border-l-green-500" : 
                    analytics.pendingQuotations > 2 ? "border-l-yellow-500" : "border-l-red-500"
                  )}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Pipeline Comercial</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {analytics.pendingQuotations > 5 ? "Robusto" : 
                         analytics.pendingQuotations > 2 ? "Moderado" : "Débil"}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {analytics.pendingQuotations} oportunidades activas
                      </p>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-semibold mb-1">Pipeline Comercial</p>
                  <p className="text-sm">Indica la salud de tu proceso de ventas según las cotizaciones pendientes.</p>
                  <p className="text-sm mt-1">
                    <span className="font-medium">Robusto:</span> &gt;5 cotizaciones<br/>
                    <span className="font-medium">Moderado:</span> 3-5 cotizaciones<br/>
                    <span className="font-medium">Débil:</span> &lt;3 cotizaciones
                  </p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className={cn(
                    "border-l-4 cursor-help",
                    (() => {
                      const uniqueMonths = new Set();
                      const dateRange = getDateRangeForFilter(dateFilter);
                      if (dateRange) {
                        timeEntries.forEach((entry: any) => {
                          const entryDate = new Date(entry.date);
                          if (entryDate >= dateRange.startDate && entryDate <= dateRange.endDate) {
                            uniqueMonths.add(`${entryDate.getFullYear()}-${entryDate.getMonth()}`);
                          }
                        });
                      }
                      const monthsWithData = Math.max(1, uniqueMonths.size);
                      const utilization = (analytics.totalHours / (160 * analytics.totalProjects * monthsWithData)) * 100;
                      return utilization > 70 ? "border-l-green-500" : 
                             utilization > 50 ? "border-l-yellow-500" : "border-l-red-500";
                    })()
                  )}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Productividad</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {(() => {
                          const uniqueMonths = new Set();
                          const dateRange = getDateRangeForFilter(dateFilter);
                          if (dateRange) {
                            timeEntries.forEach((entry: any) => {
                              const entryDate = new Date(entry.date);
                              if (entryDate >= dateRange.startDate && entryDate <= dateRange.endDate) {
                                uniqueMonths.add(`${entryDate.getFullYear()}-${entryDate.getMonth()}`);
                              }
                            });
                          }
                          const monthsWithData = Math.max(1, uniqueMonths.size);
                          const utilization = (analytics.totalHours / (160 * analytics.totalProjects * monthsWithData)) * 100;
                          return utilization > 70 ? "Alta" : 
                                 utilization > 50 ? "Media" : "Baja";
                        })()}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Utilización del equipo
                      </p>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-semibold mb-1">Productividad del Equipo</p>
                  <p className="text-sm">Mide qué tan ocupado está tu equipo vs su capacidad total disponible.</p>
                  <p className="text-sm mt-1">
                    <span className="font-medium">Alta:</span> &gt;70% utilización<br/>
                    <span className="font-medium">Media:</span> 50-70% utilización<br/>
                    <span className="font-medium">Baja:</span> &lt;50% (capacidad ociosa)
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Actionable Insights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    Fortalezas del Negocio
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analytics.combinedRevenue > analytics.totalCost * 2 && (
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium">Márgenes Saludables</p>
                        <p className="text-muted-foreground">ROI del {((analytics.combinedRevenue / analytics.totalCost - 1) * 100).toFixed(0)}% supera el objetivo del 100%</p>
                      </div>
                    </div>
                  )}
                  {analytics.monthlyRevenue > 20000 && (
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium">Ingresos Recurrentes Estables</p>
                        <p className="text-muted-foreground">${analytics.monthlyRevenue.toLocaleString()}/mes garantizados</p>
                      </div>
                    </div>
                  )}
                  {analytics.activeClients > 3 && (
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium">Diversificación de Clientes</p>
                        <p className="text-muted-foreground">{analytics.activeClients} clientes activos reducen riesgo</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    Áreas de Mejora
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analytics.pendingQuotations < 3 && (
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium">Pipeline Comercial Débil</p>
                        <p className="text-muted-foreground">Solo {analytics.pendingQuotations} cotizaciones activas. Meta: 5+</p>
                      </div>
                    </div>
                  )}
                  {((analytics.totalHours / (160 * analytics.totalProjects * (dateFilter === 'trimestre-pasado' ? 2 : 1))) * 100) < 60 && (
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium">Capacidad Subutilizada</p>
                        <p className="text-muted-foreground">Solo {((analytics.totalHours / (160 * analytics.totalProjects * (dateFilter === 'trimestre-pasado' ? 2 : 1))) * 100).toFixed(0)}% de utilización</p>
                      </div>
                    </div>
                  )}
                  {analytics.uniqueProjects > analytics.alwaysOnProjects * 2 && (
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium">Dependencia de Proyectos Únicos</p>
                        <p className="text-muted-foreground">Aumentar contratos recurrentes para estabilidad</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Cash Flow Projection */}
            <Card>
              <CardHeader>
                <CardTitle>Proyección de Cash Flow (90 días)</CardTitle>
                <CardDescription>
                  Basado en contratos actuales y pipeline comercial
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <span className="text-sm text-muted-foreground">Ingresos Garantizados</span>
                    <p className="text-2xl font-bold text-green-600">
                      ${(analytics.monthlyRevenue * 3).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">Contratos recurrentes</p>
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm text-muted-foreground">Ingresos Potenciales</span>
                    <p className="text-2xl font-bold text-blue-600">
                      ${(analytics.pendingQuotations * 30000 * 0.3).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">30% conversión pipeline</p>
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm text-muted-foreground">Costos Operativos</span>
                    <p className="text-2xl font-bold text-red-600">
                      ${(analytics.totalCost * 3 / (dateFilter === 'trimestre-pasado' ? 2 : 1)).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">Basado en burn rate actual</p>
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm text-muted-foreground">Cash Flow Neto</span>
                    <p className="text-2xl font-bold">
                      ${((analytics.monthlyRevenue * 3 + analytics.pendingQuotations * 30000 * 0.3) - (analytics.totalCost * 3 / (dateFilter === 'trimestre-pasado' ? 2 : 1))).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">Proyección conservadora</p>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <h4 className="font-medium text-sm mb-2">Recomendaciones Estratégicas</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Mantener burn rate mensual bajo ${(analytics.totalCost / (dateFilter === 'trimestre-pasado' ? 2 : 1) * 1.1).toLocaleString()}</li>
                    <li>• Incrementar pipeline a 8+ cotizaciones activas</li>
                    <li>• Convertir {Math.max(1, Math.floor(analytics.uniqueProjects * 0.3))} proyecto{Math.floor(analytics.uniqueProjects * 0.3) > 1 ? 's' : ''} único{Math.floor(analytics.uniqueProjects * 0.3) > 1 ? 's' : ''} a contrato recurrente</li>
                    <li>• Optimizar utilización del equipo al 75%+</li>
                  </ul>
                </div>
              </CardContent>
            </Card>


          </TabsContent>

          {/* PESTAÑA 4: INSIGHTS Y RECOMENDACIONES */}
          <TabsContent value="insights" className="space-y-6">
            {/* Indicadores de Alerta */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    Centro de Alertas y Riesgos
                  </CardTitle>
                  <Badge variant="outline" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {analytics.projectMetrics.filter(p => p.efficiency < 50 || p.profitMargin < 20).length} alertas activas
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.projectMetrics
                    .filter(p => p.efficiency < 50 || p.profitMargin < 20)
                    .slice(0, 5)
                    .map((project) => (
                      <div key={project.id} className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium">{project.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {project.efficiency < 50 && `Eficiencia crítica: ${project.efficiency.toFixed(0)}%`}
                            {project.efficiency < 50 && project.profitMargin < 20 && ' • '}
                            {project.profitMargin < 20 && `Margen bajo: ${project.profitMargin.toFixed(0)}%`}
                          </p>
                        </div>
                        <Link href={`/active-projects/${project.id}`}>
                          <Button size="sm" variant="outline">
                            Revisar
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    ))}
                  {analytics.projectMetrics.filter(p => p.efficiency < 50 || p.profitMargin < 20).length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-600" />
                      <p>No hay alertas críticas en este momento</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Fortalezas del Negocio */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    Fortalezas del Negocio
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analytics.combinedRevenue > analytics.totalCost * 2 && (
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium">Márgenes Saludables</p>
                        <p className="text-muted-foreground">ROI del {((analytics.combinedRevenue / analytics.totalCost - 1) * 100).toFixed(0)}% supera el objetivo del 100%</p>
                      </div>
                    </div>
                  )}
                  {analytics.monthlyRevenue > 20000 && (
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium">Ingresos Recurrentes Estables</p>
                        <p className="text-muted-foreground">Contratos Always-On generan ${analytics.monthlyRevenue.toLocaleString()}/mes</p>
                      </div>
                    </div>
                  )}
                  {analytics.fullTimeCount > 5 && (
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium">Equipo Sólido</p>
                        <p className="text-muted-foreground">{analytics.fullTimeCount} empleados full-time comprometidos</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Oportunidades de Mejora */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-blue-600" />
                    Oportunidades de Mejora
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analytics.pendingQuotations > 3 && (
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium">Pipeline Comercial Activo</p>
                        <p className="text-muted-foreground">{analytics.pendingQuotations} cotizaciones pendientes por cerrar</p>
                      </div>
                    </div>
                  )}
                  {analytics.projectMetrics.some(p => p.efficiency < 70) && (
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium">Optimizar Procesos</p>
                        <p className="text-muted-foreground">
                          {analytics.projectMetrics.filter(p => p.efficiency < 70).length} proyectos bajo eficiencia óptima
                        </p>
                      </div>
                    </div>
                  )}
                  {analytics.variableCosts > analytics.fixedMonthlyCosts * 0.5 && (
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium">Balance de Costos</p>
                        <p className="text-muted-foreground">Costos variables altos: considerar más contrataciones full-time</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Advanced Forecast with Scenarios */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="h-5 w-5 text-indigo-600" />
                  Proyección Avanzada con Escenarios
                </CardTitle>
                <CardDescription>
                  Simulación de resultados bajo diferentes escenarios de negocio
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {/* Escenario Optimista */}
                  <Card className="border-green-200 bg-green-50/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-green-900">Escenario Optimista</CardTitle>
                      <CardDescription className="text-xs text-green-700">+20% conversión, +15% eficiencia</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Ingresos (3 meses)</p>
                          <p className="text-xl font-bold text-green-900">
                            ${((analytics.combinedRevenue * 3.5) + (analytics.pendingQuotations * 35000 * 0.5)).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">ROI esperado</p>
                          <p className="text-lg font-semibold text-green-700">185%</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Escenario Realista */}
                  <Card className="border-blue-200 bg-blue-50/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-blue-900">Escenario Realista</CardTitle>
                      <CardDescription className="text-xs text-blue-700">Mantener tendencias actuales</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Ingresos (3 meses)</p>
                          <p className="text-xl font-bold text-blue-900">
                            ${(analytics.combinedRevenue * 3).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">ROI esperado</p>
                          <p className="text-lg font-semibold text-blue-700">
                            {((analytics.combinedRevenue / analytics.totalCost - 1) * 100).toFixed(0)}%
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Escenario Pesimista */}
                  <Card className="border-red-200 bg-red-50/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-red-900">Escenario Pesimista</CardTitle>
                      <CardDescription className="text-xs text-red-700">-30% pipeline, costos +10%</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Ingresos (3 meses)</p>
                          <p className="text-xl font-bold text-red-900">
                            ${(analytics.combinedRevenue * 2.3).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">ROI esperado</p>
                          <p className="text-lg font-semibold text-red-700">45%</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Scenario Comparison Chart */}
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={[
                    { 
                      scenario: 'Pesimista',
                      ingresos: analytics.combinedRevenue * 2.3,
                      costos: analytics.totalCost * 3.3,
                      margen: 45
                    },
                    { 
                      scenario: 'Realista',
                      ingresos: analytics.combinedRevenue * 3,
                      costos: analytics.totalCost * 3,
                      margen: ((analytics.combinedRevenue / analytics.totalCost - 1) * 100)
                    },
                    { 
                      scenario: 'Optimista',
                      ingresos: (analytics.combinedRevenue * 3.5) + (analytics.pendingQuotations * 35000 * 0.5),
                      costos: analytics.totalCost * 2.8,
                      margen: 185
                    }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="scenario" />
                    <YAxis />
                    <RechartsTooltip formatter={(value: any) => `$${Number(value).toLocaleString()}`} />
                    <Legend />
                    <Bar dataKey="ingresos" fill={CHART_COLORS.primary} name="Ingresos Proyectados" />
                    <Bar dataKey="costos" fill={CHART_COLORS.danger} name="Costos Proyectados" />
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-4 p-3 bg-indigo-50 rounded-lg">
                  <p className="text-sm font-medium text-indigo-900 mb-1">Factores clave para alcanzar escenario optimista:</p>
                  <ul className="text-xs text-indigo-700 space-y-0.5">
                    <li>• Cerrar al menos {Math.ceil(analytics.pendingQuotations * 0.5)} de las {analytics.pendingQuotations} cotizaciones pendientes</li>
                    <li>• Mejorar eficiencia operacional en 15% mediante automatización</li>
                    <li>• Convertir 2 proyectos únicos en contratos recurrentes</li>
                    <li>• Mantener costos variables bajo control con mejor planificación</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Recomendaciones Estratégicas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-purple-600" />
                  Recomendaciones Estratégicas
                </CardTitle>
                <CardDescription>
                  Acciones sugeridas basadas en el análisis del período {dateFilter === 'all' ? 'completo' : 'seleccionado'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Recomendación 1 */}
                  <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                        <Target className="h-5 w-5 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1">Expandir Contratos Always-On</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          Los contratos recurrentes representan el {((analytics.monthlyRevenue / analytics.combinedRevenue) * 100).toFixed(0)}% 
                          de los ingresos. Aumentar este porcentaje mejorará la predictibilidad financiera.
                        </p>
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant="outline">Meta: 70% recurrente</Badge>
                          <Badge variant="outline">Potencial: +${(analytics.monthlyRevenue * 0.5).toLocaleString()}/mes</Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recomendación 2 */}
                  <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                        <Users className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1">Optimizar Equipo de Alto Rendimiento</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          Identificar y replicar las prácticas de los {analytics.projectMetrics.filter(p => p.efficiency > 100).length} proyectos 
                          con eficiencia superior al 100%.
                        </p>
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant="outline">Eficiencia actual: {(analytics.projectMetrics.reduce((sum, p) => sum + p.efficiency, 0) / analytics.projectMetrics.length).toFixed(0)}%</Badge>
                          <Badge variant="outline">Meta: 95%</Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recomendación 3 */}
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1">Cerrar Pipeline Comercial</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          Con {analytics.pendingQuotations} cotizaciones pendientes, el cierre del 50% podría generar 
                          ${(analytics.pendingQuotations * 15000).toLocaleString()} adicionales.
                        </p>
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant="outline">Tasa cierre actual: 40%</Badge>
                          <Badge variant="outline">Meta: 60%</Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recomendación 4 */}
                  <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                        <Shield className="h-5 w-5 text-amber-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1">Control de Costos Variables</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          Los costos variables representan ${analytics.variableCosts.toLocaleString()}. 
                          Considerar conversiones a full-time para reducir costos.
                        </p>
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant="outline">Ahorro potencial: 20%</Badge>
                          <Badge variant="outline">${(analytics.variableCosts * 0.2).toLocaleString()}/mes</Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      </TooltipProvider>
    </PageLayout>
  );
}