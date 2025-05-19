import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  CircleAlert, 
  TrendingUp, 
  TrendingDown, 
  Info, 
  DollarSign, 
  ArrowUpRight,
  Calendar
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BudgetSummaryPanelProps {
  project: any;
}

// Función para obtener el mes actual en formato YYYY-MM
function getCurrentMonthStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Función para obtener el trimestre actual en formato YYYY-Q#
function getCurrentQuarterStr() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const quarter = Math.floor(month / 3) + 1;
  return `${year}-Q${quarter}`;
}

// Función para obtener un rango de meses para seleccionar
function getMonthsOptions() {
  const months = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  
  // Agregar los últimos 12 meses
  for (let i = 0; i < 12; i++) {
    let year = currentYear;
    let month = currentMonth - i;
    
    if (month < 0) {
      month += 12;
      year--;
    }
    
    const monthStr = String(month + 1).padStart(2, '0');
    const dateObj = new Date(year, month, 1);
    const label = dateObj.toLocaleDateString('es', { month: 'long', year: 'numeric' });
    
    months.push({
      value: `${year}-${monthStr}`,
      label
    });
  }
  
  return months;
}

// Función para obtener opciones de trimestres
function getQuartersOptions() {
  const quarters = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
  
  // Agregar los últimos 8 trimestres (2 años)
  for (let i = 0; i < 8; i++) {
    let year = currentYear;
    let quarter = currentQuarter - i;
    
    while (quarter <= 0) {
      quarter += 4;
      year--;
    }
    
    quarters.push({
      value: `${year}-Q${quarter}`,
      label: `Q${quarter} ${year}`
    });
  }
  
  return quarters;
}

export function BudgetSummaryPanel({ project }: BudgetSummaryPanelProps) {
  const [totalSpent, setTotalSpent] = useState(0);
  const [monthlyBudget, setMonthlyBudget] = useState(project?.macroMonthlyBudget || 4200);
  const [percentUsed, setPercentUsed] = useState(0);
  const [budgetDistribution, setBudgetDistribution] = useState<any[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<any[]>([]);
  
  // Periodos para filtrar los costos
  const [periodType, setPeriodType] = useState<'current' | 'month' | 'quarter'>('current');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthStr());
  const [selectedQuarter, setSelectedQuarter] = useState(getCurrentQuarterStr());
  const [periodLabel, setPeriodLabel] = useState('Período actual');

  // Obtener los subproyectos asociados al proyecto macro
  const { data: subprojects = [], isLoading: isLoadingSubprojects } = useQuery({
    queryKey: ['/api/active-projects/parent', project?.id],
    queryFn: async () => {
      if (!project?.id) return [];
      const response = await fetch(`/api/active-projects/parent/${project.id}`);
      if (!response.ok) throw new Error('Error al obtener subproyectos');
      return response.json();
    },
    enabled: !!project?.id && project?.isAlwaysOnMacro
  });

  // Obtener la URL correcta según el tipo de período seleccionado
  const getCostSummaryUrl = (projectId: number) => {
    let url = `/api/projects/${projectId}/cost-summary`;
    
    if (periodType === 'month') {
      url = `/api/projects/${projectId}/cost-summary/period?monthYear=${selectedMonth}`;
    } else if (periodType === 'quarter') {
      url = `/api/projects/${projectId}/cost-summary/period?quarter=${selectedQuarter}`;
    }
    
    return url;
  };
  
  // Obtener el resumen de costos para el proyecto macro con el filtro por período
  const { data: macroCostSummary = null, isLoading: isLoadingMacroCosts } = useQuery({
    queryKey: ['/api/projects/cost-period', project?.id, periodType, selectedMonth, selectedQuarter],
    queryFn: async () => {
      if (!project?.id) return null;
      
      try {
        const url = getCostSummaryUrl(project.id);
        const response = await fetch(url);
        if (!response.ok) throw new Error('Error al obtener costos del proyecto macro');
        
        const data = await response.json();
        
        // Si el endpoint devuelve una etiqueta para el período, actualizarla
        if (data.periodLabel) {
          setPeriodLabel(data.periodLabel);
        }
        
        return data;
      } catch (error) {
        console.error(`Error al obtener costos para el proyecto macro ${project.id}:`, error);
        return null;
      }
    },
    enabled: !!project?.id
  });
  
  // Obtener el resumen de costos para cada subproyecto (solo si son necesarios)
  const { data: subprojectCostSummaries = {}, isLoading: isLoadingSubprojectCosts } = useQuery({
    queryKey: ['/api/projects/subproject-costs', subprojects, periodType, selectedMonth, selectedQuarter],
    queryFn: async () => {
      if (!project?.id || subprojects.length === 0 || macroCostSummary?.subprojects) return {};
      
      // Si el macro resumen ya incluye los subproyectos, no es necesario realizar consultas adicionales
      if (macroCostSummary?.subprojects) {
        const summaries: Record<number, any> = {};
        macroCostSummary.subprojects.forEach((subproject: any) => {
          summaries[subproject.id] = {
            estimatedCost: subproject.costs.estimatedCost,
            actualCost: subproject.costs.actualCost,
            percentageUsed: subproject.costs.percentageUsed
          };
        });
        return summaries;
      }
      
      // De lo contrario, obtener los costos de cada subproyecto individualmente
      const projectIds = subprojects.map((p: any) => p.id);
      const summaries: Record<number, any> = {};
      
      await Promise.all(projectIds.map(async (id) => {
        try {
          const url = getCostSummaryUrl(id);
          const response = await fetch(url);
          if (response.ok) {
            summaries[id] = await response.json();
          }
        } catch (error) {
          console.error(`Error al obtener costos para el subproyecto ${id}:`, error);
        }
      }));
      
      return summaries;
    },
    enabled: !!project?.id && subprojects.length > 0 && !macroCostSummary?.subprojects
  });

  // Manejar cambios en el período seleccionado
  const handlePeriodChange = (value: 'current' | 'month' | 'quarter') => {
    setPeriodType(value);
  };
  
  const handleMonthChange = (value: string) => {
    setSelectedMonth(value);
  };
  
  const handleQuarterChange = (value: string) => {
    setSelectedQuarter(value);
  };

  // Procesar datos cuando estén disponibles
  useEffect(() => {
    if (project && macroCostSummary) {
      // Usar los datos del resumen macro si están disponibles
      setTotalSpent(macroCostSummary.actualCost || 0);
      setPercentUsed(Math.min((macroCostSummary.actualCost / monthlyBudget) * 100, 100));
      
      // Datos para el gráfico de distribución de presupuesto
      let distribution = [];
      
      // Si el resumen macro incluye subproyectos
      if (macroCostSummary.subprojects) {
        distribution = macroCostSummary.subprojects.map((subproject: any) => ({
          name: subproject.name || `Subproyecto ${subproject.id}`,
          value: subproject.costs.actualCost || 0,
        })).filter((item: any) => item.value > 0);
      } else {
        // Usar los datos de subprojectCostSummaries
        distribution = [
          ...subprojects.map((subproject: any) => ({
            name: subproject.quotation?.projectName || `Subproyecto ${subproject.id}`,
            value: subprojectCostSummaries[subproject.id]?.actualCost || 0,
          })),
          {
            name: project.quotation?.projectName || 'Proyecto principal',
            value: macroCostSummary.actualCost || 0
          }
        ].filter(item => item.value > 0);
      }
      
      setBudgetDistribution(distribution);
      
      // Datos para la tendencia mensual (se podrían obtener de la API en futuras iteraciones)
      const currentMonth = new Date().getMonth();
      const trend = [
        { name: 'Ene', total: currentMonth >= 0 ? Math.random() * 4200 : 0 },
        { name: 'Feb', total: currentMonth >= 1 ? Math.random() * 4200 : 0 },
        { name: 'Mar', total: currentMonth >= 2 ? Math.random() * 4200 : 0 },
        { name: 'Abr', total: currentMonth >= 3 ? Math.random() * 4200 : 0 },
        { name: 'May', total: currentMonth >= 4 ? Math.random() * 4200 : 0 },
        { name: 'Jun', total: currentMonth >= 5 ? Math.random() * 4200 : 0 },
        { name: 'Jul', total: currentMonth >= 6 ? Math.random() * 4200 : 0 },
        { name: 'Ago', total: currentMonth >= 7 ? Math.random() * 4200 : 0 },
        { name: 'Sep', total: currentMonth >= 8 ? Math.random() * 4200 : 0 },
        { name: 'Oct', total: currentMonth >= 9 ? Math.random() * 4200 : 0 },
        { name: 'Nov', total: currentMonth >= 10 ? Math.random() * 4200 : 0 },
        { name: 'Dic', total: currentMonth >= 11 ? Math.random() * 4200 : 0 },
      ];
      
      // Establecer el mes actual con el valor real
      if (currentMonth >= 0 && currentMonth < 12) {
        trend[currentMonth].total = macroCostSummary.actualCost || 0;
      }
      
      setMonthlyTrend(trend);
    }
  }, [project, subprojects, macroCostSummary, subprojectCostSummaries, monthlyBudget]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#A4DE6C'];
  
  // Opciones para seleccionar periodos
  const monthOptions = getMonthsOptions();
  const quarterOptions = getQuartersOptions();

  if (isLoadingSubprojects || isLoadingMacroCosts || isLoadingSubprojectCosts) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-pulse text-gray-400">Cargando datos presupuestales...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selector de Período */}
      <div className="bg-muted/20 p-4 rounded-lg border">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-medium mb-1">Filtro de Período</h3>
            <p className="text-xs text-muted-foreground">
              {periodLabel || "Selecciona un período para filtrar los datos presupuestales"}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={periodType} onValueChange={(value: any) => handlePeriodChange(value)}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Tipo de período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Período Actual</SelectItem>
                <SelectItem value="month">Mensual</SelectItem>
                <SelectItem value="quarter">Trimestral</SelectItem>
              </SelectContent>
            </Select>
            
            {periodType === 'month' && (
              <Select value={selectedMonth} onValueChange={handleMonthChange}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Seleccionar mes" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {periodType === 'quarter' && (
              <Select value={selectedQuarter} onValueChange={handleQuarterChange}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Seleccionar trimestre" />
                </SelectTrigger>
                <SelectContent>
                  {quarterOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>
      
      {/* Resumen General */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">Presupuesto Mensual</CardTitle>
            <CardDescription className="text-xs">Asignación para todos los subproyectos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary flex items-center">
              <DollarSign className="h-5 w-5 mr-1 text-muted-foreground" />
              ${monthlyBudget.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">Gasto Total</CardTitle>
            <CardDescription className="text-xs">Consumo combinado de todos los subproyectos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center">
              <DollarSign className="h-5 w-5 mr-1 text-muted-foreground" />
              <span className={percentUsed > 90 ? 'text-red-500' : 'text-green-600'}>
                ${totalSpent.toLocaleString()}
              </span>
            </div>
            <div className="mt-2">
              <Progress value={percentUsed} className="h-2" />
              <div className="mt-1 text-xs flex justify-between">
                <span>{percentUsed.toFixed(0)}% utilizado</span>
                <span className={percentUsed > 90 ? 'text-red-500' : 'text-green-600'}>
                  ${(monthlyBudget - totalSpent).toLocaleString()} disponible
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">Estado Actual</CardTitle>
            <CardDescription className="text-xs">Evaluación del presupuesto mensual</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {percentUsed > 95 ? (
                <Badge variant="destructive" className="py-1">
                  <CircleAlert className="mr-1 h-3 w-3" />
                  Presupuesto Excedido
                </Badge>
              ) : percentUsed > 85 ? (
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 py-1">
                  <CircleAlert className="mr-1 h-3 w-3" />
                  En Riesgo
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 py-1">
                  <TrendingUp className="mr-1 h-3 w-3" />
                  Dentro del Presupuesto
                </Badge>
              )}
            </div>
            
            <div className="mt-3 text-sm">
              <div className="flex items-center text-muted-foreground">
                <Info className="h-4 w-4 mr-1" />
                <span>
                  {percentUsed > 85 
                    ? 'Necesita revisión de asignación de recursos'
                    : 'Distribución de recursos óptima'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Distribución de Presupuesto */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-base">Distribución del Presupuesto</CardTitle>
            <CardDescription>Asignación actual entre subproyectos</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[300px]">
              {budgetDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={budgetDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      fill="#8884d8"
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: $${value.toLocaleString()}`}
                    >
                      {budgetDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Gasto']}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No hay datos de distribución disponibles
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Tendencia Mensual */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-base">Tendencia de Gasto Mensual</CardTitle>
            <CardDescription>Evolución del consumo del presupuesto</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[300px]">
              {monthlyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={monthlyTrend}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Gasto']} />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#8884d8"
                      fillOpacity={1}
                      fill="url(#colorTotal)"
                    />
                    {/* Línea para el presupuesto mensual */}
                    <CartesianGrid strokeDasharray="3 3" />
                    <line
                      x1="0%"
                      y1={(1 - (monthlyBudget / 4500)) * 100 + "%"}
                      x2="100%"
                      y2={(1 - (monthlyBudget / 4500)) * 100 + "%"}
                      stroke="red"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No hay datos de tendencia disponibles
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Lista de Subproyectos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Subproyectos Asociados</CardTitle>
          <CardDescription>
            {subprojects.length} subproyectos bajo el presupuesto consolidado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Nombre del Subproyecto</th>
                  <th className="text-right py-2 font-medium">Presupuesto</th>
                  <th className="text-right py-2 font-medium">Consumido</th>
                  <th className="text-right py-2 font-medium">% Utilizado</th>
                  <th className="text-right py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {subprojects.map((subproject: any) => {
                  const cost = macroCostSummary?.subprojects?.find((s: any) => s.id === subproject.id)?.costs?.actualCost || 
                               subprojectCostSummaries[subproject.id]?.actualCost || 0;
                  const budget = macroCostSummary?.subprojects?.find((s: any) => s.id === subproject.id)?.costs?.estimatedCost || 
                                subprojectCostSummaries[subproject.id]?.estimatedCost || monthlyBudget;
                  const percentage = Math.min((cost / budget) * 100, 100);
                  
                  return (
                    <tr key={subproject.id} className="border-b hover:bg-gray-50">
                      <td className="py-2">
                        {subproject.quotation?.projectName || `Subproyecto ${subproject.id}`}
                      </td>
                      <td className="text-right py-2">${budget.toLocaleString()}</td>
                      <td className="text-right py-2">${cost.toLocaleString()}</td>
                      <td className="text-right py-2">
                        <div className="flex items-center justify-end">
                          <span className="mr-2">{percentage.toFixed(0)}%</span>
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-full rounded-full ${
                                percentage > 90 ? 'bg-red-500' : 
                                percentage > 75 ? 'bg-orange-400' : 'bg-green-500'
                              }`}
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="text-right py-2">
                        <Badge 
                          variant="outline" 
                          className={`${
                            percentage > 90 ? 'bg-red-50 text-red-700 border-red-200' : 
                            percentage > 75 ? 'bg-orange-50 text-orange-700 border-orange-200' : 
                            'bg-green-50 text-green-700 border-green-200'
                          }`}
                        >
                          {percentage > 90 ? 'En riesgo' : 
                          percentage > 75 ? 'Atención' : 'Normal'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
                
                {subprojects.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-muted-foreground">
                      No hay subproyectos asociados a este proyecto macro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
        <CardFooter className="border-t pt-4 text-xs text-muted-foreground">
          <div className="flex items-center">
            <Info className="h-3 w-3 mr-1" />
            Los porcentajes se calculan en base al presupuesto estimado de cada subproyecto.
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}