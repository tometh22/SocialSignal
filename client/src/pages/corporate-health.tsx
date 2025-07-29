import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  DollarSign, Users, TrendingUp, TrendingDown, Activity, 
  UserCheck, Clock, Calculator, AlertTriangle, CheckCircle 
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';

interface PersonnelWithCosts {
  id: number;
  name: string;
  contractType: 'full-time' | 'part-time' | 'freelance';
  monthlyFixedSalary?: number;
  hourlyRate: number;
  hoursWorked: number;
  revenue: number;
  realCost: number;
  efficiency: number;
}

export function CorporateHealth() {
  const [selectedPeriod, setSelectedPeriod] = useState('current-month');
  
  // Get date range based on selected period
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (selectedPeriod) {
      case 'current-month':
        return {
          start: startOfMonth(now),
          end: endOfMonth(now)
        };
      case 'last-month':
        return {
          start: startOfMonth(subMonths(now, 1)),
          end: endOfMonth(subMonths(now, 1))
        };
      case 'last-3-months':
        return {
          start: startOfMonth(subMonths(now, 2)),
          end: endOfMonth(now)
        };
      case 'last-6-months':
        return {
          start: startOfMonth(subMonths(now, 5)),
          end: endOfMonth(now)
        };
      default:
        return {
          start: startOfMonth(now),
          end: endOfMonth(now)
        };
    }
  }, [selectedPeriod]);

  // Fetch personnel data with contract types
  const { data: personnel = [] } = useQuery({
    queryKey: ['/api/personnel']
  });

  // Fetch time entries for the period
  const { data: timeEntries = [] } = useQuery({
    queryKey: ['/api/time-entries', dateRange.start, dateRange.end],
    queryFn: () => apiRequest(
      `/api/time-entries?startDate=${dateRange.start.toISOString()}&endDate=${dateRange.end.toISOString()}`
    )
  });

  // Fetch active projects for revenue calculation
  const { data: projects = [] } = useQuery({
    queryKey: ['/api/active-projects']
  });

  // Calculate personnel costs and revenue
  const personnelAnalysis = useMemo(() => {
    return personnel.map((person: any) => {
      // Get hours worked by this person in the period
      const personHours = timeEntries
        .filter((entry: any) => entry.personnelId === person.id)
        .reduce((sum: number, entry: any) => sum + (entry.hours || 0), 0);

      // Calculate revenue generated (sum of hourly rate × hours on billable projects)
      const revenue = timeEntries
        .filter((entry: any) => entry.personnelId === person.id && entry.billable)
        .reduce((sum: number, entry: any) => {
          const project = projects.find((p: any) => p.id === entry.projectId);
          const markup = project?.markup || 2.5; // Default markup
          return sum + (entry.hours * person.hourlyRate * markup);
        }, 0);

      // Calculate real cost based on contract type
      let realCost = 0;
      if (person.contractType === 'full-time' && person.monthlyFixedSalary) {
        // Full-time: Fixed monthly salary
        realCost = person.monthlyFixedSalary;
      } else {
        // Part-time/Freelance: Hours worked × hourly rate
        realCost = personHours * person.hourlyRate;
      }

      // Calculate efficiency
      const efficiency = realCost > 0 ? (revenue / realCost) * 100 : 0;

      return {
        id: person.id,
        name: person.name,
        contractType: person.contractType || 'full-time',
        monthlyFixedSalary: person.monthlyFixedSalary,
        hourlyRate: person.hourlyRate,
        hoursWorked: personHours,
        revenue,
        realCost,
        efficiency
      } as PersonnelWithCosts;
    });
  }, [personnel, timeEntries, projects]);

  // Calculate totals
  const totals = useMemo(() => {
    const fixedCosts = personnelAnalysis
      .filter(p => p.contractType === 'full-time')
      .reduce((sum, p) => sum + p.realCost, 0);

    const variableCosts = personnelAnalysis
      .filter(p => p.contractType !== 'full-time')
      .reduce((sum, p) => sum + p.realCost, 0);

    const totalRevenue = personnelAnalysis
      .reduce((sum, p) => sum + p.revenue, 0);

    const totalCosts = fixedCosts + variableCosts;
    const netProfit = totalRevenue - totalCosts;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      fixedCosts,
      variableCosts,
      totalCosts,
      totalRevenue,
      netProfit,
      profitMargin
    };
  }, [personnelAnalysis]);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="breadcrumb-nav mb-6">
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-4">
          <span>Dashboard</span>
          <span>/</span>
          <span>Analytics</span>
          <span>/</span>
          <span className="text-foreground font-medium">Salud Corporativa</span>
        </nav>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="heading-page">Salud Corporativa</h1>
            <p className="text-lg text-muted-foreground mt-2">
              Análisis integral de costos reales vs ingresos generados por el equipo
            </p>
          </div>
          
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Seleccionar período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current-month">Este mes</SelectItem>
              <SelectItem value="last-month">Mes pasado</SelectItem>
              <SelectItem value="last-3-months">Últimos 3 meses</SelectItem>
              <SelectItem value="last-6-months">Últimos 6 meses</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium text-blue-900">Costos Fijos</CardTitle>
            <CardDescription className="text-blue-700">Sueldos Full-time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">
              ${totals.fixedCosts.toLocaleString('es-AR')}
            </div>
            <p className="text-xs text-blue-700 mt-1">Mensual fijo</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium text-purple-900">Costos Variables</CardTitle>
            <CardDescription className="text-purple-700">Part-time & Freelance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900">
              ${totals.variableCosts.toLocaleString('es-AR')}
            </div>
            <p className="text-xs text-purple-700 mt-1">Por horas trabajadas</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium text-green-900">Ingresos</CardTitle>
            <CardDescription className="text-green-700">Facturación total</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900">
              ${totals.totalRevenue.toLocaleString('es-AR')}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-green-600" />
              <p className="text-xs text-green-700">Del período</p>
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${totals.netProfit >= 0 ? 'from-emerald-50 to-emerald-100 border-emerald-200' : 'from-red-50 to-red-100 border-red-200'}`}>
          <CardHeader className="pb-3">
            <CardTitle className={`text-lg font-medium ${totals.netProfit >= 0 ? 'text-emerald-900' : 'text-red-900'}`}>
              Resultado Neto
            </CardTitle>
            <CardDescription className={totals.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}>
              Ingresos - Costos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totals.netProfit >= 0 ? 'text-emerald-900' : 'text-red-900'}`}>
              ${Math.abs(totals.netProfit).toLocaleString('es-AR')}
            </div>
            <div className="flex items-center gap-1 mt-1">
              {totals.netProfit >= 0 ? (
                <TrendingUp className="w-3 h-3 text-emerald-600" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-600" />
              )}
              <p className={`text-xs ${totals.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {totals.profitMargin.toFixed(1)}% margen
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium text-orange-900">Eficiencia</CardTitle>
            <CardDescription className="text-orange-700">ROI del equipo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900">
              {((totals.totalRevenue / (totals.totalCosts || 1)) * 100).toFixed(0)}%
            </div>
            <p className="text-xs text-orange-700 mt-1">Retorno sobre costos</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for detailed analysis */}
      <Tabs defaultValue="by-person" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="by-person">Por Persona</TabsTrigger>
          <TabsTrigger value="by-contract">Por Tipo de Contrato</TabsTrigger>
          <TabsTrigger value="efficiency">Análisis de Eficiencia</TabsTrigger>
        </TabsList>

        <TabsContent value="by-person" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Análisis Individual del Equipo</CardTitle>
              <CardDescription>
                Comparación de costos reales vs ingresos generados por cada miembro
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {personnelAnalysis.map((person) => (
                  <div key={person.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-lg">{person.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={person.contractType === 'full-time' ? 'default' : 'secondary'}>
                            {person.contractType === 'full-time' ? 'Full-time' : 
                             person.contractType === 'part-time' ? 'Part-time' : 'Freelance'}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {person.hoursWorked}h trabajadas
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-xl font-bold ${person.efficiency >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                          {person.efficiency.toFixed(0)}%
                        </div>
                        <p className="text-xs text-muted-foreground">Eficiencia</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Costo Real</p>
                        <p className="font-medium text-red-600">
                          ${person.realCost.toLocaleString('es-AR')}
                        </p>
                        {person.contractType === 'full-time' && (
                          <p className="text-xs text-muted-foreground">Sueldo fijo</p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Ingresos Generados</p>
                        <p className="font-medium text-green-600">
                          ${person.revenue.toLocaleString('es-AR')}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Balance</p>
                        <p className={`font-medium ${person.revenue - person.realCost >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${(person.revenue - person.realCost).toLocaleString('es-AR')}
                        </p>
                      </div>
                    </div>

                    <Progress 
                      value={Math.min(person.efficiency, 200)} 
                      className="h-2"
                      indicatorClassName={person.efficiency >= 100 ? 'bg-green-500' : 'bg-orange-500'}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-contract" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Full-time Analysis */}
            <Card className="border-blue-200">
              <CardHeader className="bg-blue-50">
                <CardTitle className="text-blue-900">Empleados Full-time</CardTitle>
                <CardDescription className="text-blue-700">
                  Sueldo fijo mensual
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Empleados</p>
                    <p className="text-2xl font-bold">
                      {personnelAnalysis.filter(p => p.contractType === 'full-time').length}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Costo Fijo Total</p>
                    <p className="text-xl font-bold text-red-600">
                      ${totals.fixedCosts.toLocaleString('es-AR')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ingresos Generados</p>
                    <p className="text-xl font-bold text-green-600">
                      ${personnelAnalysis
                        .filter(p => p.contractType === 'full-time')
                        .reduce((sum, p) => sum + p.revenue, 0)
                        .toLocaleString('es-AR')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Eficiencia Promedio</p>
                    <p className="text-xl font-bold">
                      {(() => {
                        const fullTimePersonnel = personnelAnalysis.filter(p => p.contractType === 'full-time');
                        const avgEfficiency = fullTimePersonnel.length > 0
                          ? fullTimePersonnel.reduce((sum, p) => sum + p.efficiency, 0) / fullTimePersonnel.length
                          : 0;
                        return avgEfficiency.toFixed(0);
                      })()}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Part-time Analysis */}
            <Card className="border-purple-200">
              <CardHeader className="bg-purple-50">
                <CardTitle className="text-purple-900">Empleados Part-time</CardTitle>
                <CardDescription className="text-purple-700">
                  Pago por horas trabajadas
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Empleados</p>
                    <p className="text-2xl font-bold">
                      {personnelAnalysis.filter(p => p.contractType === 'part-time').length}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Costo Variable</p>
                    <p className="text-xl font-bold text-red-600">
                      ${personnelAnalysis
                        .filter(p => p.contractType === 'part-time')
                        .reduce((sum, p) => sum + p.realCost, 0)
                        .toLocaleString('es-AR')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Horas Totales</p>
                    <p className="text-xl font-bold">
                      {personnelAnalysis
                        .filter(p => p.contractType === 'part-time')
                        .reduce((sum, p) => sum + p.hoursWorked, 0)}h
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Costo Promedio/Hora</p>
                    <p className="text-xl font-bold">
                      ${(() => {
                        const partTime = personnelAnalysis.filter(p => p.contractType === 'part-time');
                        const totalHours = partTime.reduce((sum, p) => sum + p.hoursWorked, 0);
                        const totalCost = partTime.reduce((sum, p) => sum + p.realCost, 0);
                        return totalHours > 0 ? (totalCost / totalHours).toFixed(1) : '0';
                      })()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Freelance Analysis */}
            <Card className="border-orange-200">
              <CardHeader className="bg-orange-50">
                <CardTitle className="text-orange-900">Freelancers</CardTitle>
                <CardDescription className="text-orange-700">
                  Colaboradores externos
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Freelancers</p>
                    <p className="text-2xl font-bold">
                      {personnelAnalysis.filter(p => p.contractType === 'freelance').length}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Costo Variable</p>
                    <p className="text-xl font-bold text-red-600">
                      ${personnelAnalysis
                        .filter(p => p.contractType === 'freelance')
                        .reduce((sum, p) => sum + p.realCost, 0)
                        .toLocaleString('es-AR')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Horas Totales</p>
                    <p className="text-xl font-bold">
                      {personnelAnalysis
                        .filter(p => p.contractType === 'freelance')
                        .reduce((sum, p) => sum + p.hoursWorked, 0)}h
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">ROI Promedio</p>
                    <p className="text-xl font-bold text-green-600">
                      {(() => {
                        const freelancers = personnelAnalysis.filter(p => p.contractType === 'freelance');
                        const avgEfficiency = freelancers.length > 0
                          ? freelancers.reduce((sum, p) => sum + p.efficiency, 0) / freelancers.length
                          : 0;
                        return avgEfficiency.toFixed(0);
                      })()}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="efficiency" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Matriz de Eficiencia del Equipo</CardTitle>
              <CardDescription>
                Identificación de oportunidades de mejora y optimización de recursos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* High Performers */}
                <div>
                  <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    Alto Rendimiento (≥ 120% eficiencia)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {personnelAnalysis
                      .filter(p => p.efficiency >= 120)
                      .map(person => (
                        <div key={person.id} className="border border-green-200 rounded-lg p-3 bg-green-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{person.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {person.contractType === 'full-time' ? 'Full-time' : 
                                 person.contractType === 'part-time' ? 'Part-time' : 'Freelance'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-green-600">{person.efficiency.toFixed(0)}%</p>
                              <p className="text-xs text-green-700">
                                +${(person.revenue - person.realCost).toLocaleString('es-AR')}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Average Performers */}
                <div>
                  <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-orange-600" />
                    Rendimiento Normal (80-120% eficiencia)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {personnelAnalysis
                      .filter(p => p.efficiency >= 80 && p.efficiency < 120)
                      .map(person => (
                        <div key={person.id} className="border border-orange-200 rounded-lg p-3 bg-orange-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{person.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {person.hoursWorked}h trabajadas
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-orange-600">{person.efficiency.toFixed(0)}%</p>
                              <p className="text-xs text-orange-700">
                                ${(person.revenue - person.realCost).toLocaleString('es-AR')}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Low Performers */}
                <div>
                  <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    Requiere Atención (< 80% eficiencia)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {personnelAnalysis
                      .filter(p => p.efficiency < 80)
                      .map(person => (
                        <div key={person.id} className="border border-red-200 rounded-lg p-3 bg-red-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{person.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {person.contractType === 'full-time' ? 'Costo fijo: $' + person.monthlyFixedSalary?.toLocaleString('es-AR') : 
                                 `${person.hoursWorked}h × $${person.hourlyRate}`}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-red-600">{person.efficiency.toFixed(0)}%</p>
                              <p className="text-xs text-red-700">
                                -${Math.abs(person.revenue - person.realCost).toLocaleString('es-AR')}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}