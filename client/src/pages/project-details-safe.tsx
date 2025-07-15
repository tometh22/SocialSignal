import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft,
  TrendingUp,
  DollarSign,
  Target,
  Clock,
  Users,
  Filter,
  Settings,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';

interface DateFilter {
  type: string;
  startDate: Date;
  endDate: Date;
  label: string;
}

interface SafeTeamMember {
  id: number;
  name: string;
  role: string;
  hours: number;
  entries: number;
}

interface SafeCostSummary {
  markup: number;
  targetClientPrice: number;
  totalCost: number;
  budgetUtilization: number;
  filteredHours: number;
  targetHours: number;
}

export default function ProjectDetailsSafe() {
  const { id: projectId } = useParams();
  const [, setLocation] = useLocation();

  // Estado seguro con valores por defecto
  const [dateFilter, setDateFilter] = useState<DateFilter>(() => {
    const now = new Date();
    return {
      type: 'month',
      startDate: startOfMonth(now),
      endDate: endOfMonth(now),
      label: "Este mes"
    };
  });

  // Consultas con manejo de errores
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: [`/api/active-projects/${projectId}`],
    enabled: !!projectId,
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: [`/api/time-entries/project/${projectId}`],
    enabled: !!projectId,
  });

  const { data: clientData } = useQuery({
    queryKey: [`/api/clients/${project?.clientId}`],
    enabled: !!project?.clientId,
  });

  const { data: baseTeam = [] } = useQuery({
    queryKey: [`/api/projects/${projectId}/base-team`],
    enabled: !!projectId,
  });

  // Función para generar opciones de filtro de manera segura
  const getDateFilterOptions = (): DateFilter[] => {
    const now = new Date();
    try {
      return [
        {
          type: 'month',
          startDate: startOfMonth(now),
          endDate: endOfMonth(now),
          label: "Este mes"
        },
        {
          type: 'last-month',
          startDate: startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1)),
          endDate: endOfMonth(new Date(now.getFullYear(), now.getMonth() - 1)),
          label: "Mes pasado"
        },
        {
          type: 'quarter',
          startDate: startOfQuarter(now),
          endDate: endOfQuarter(now),
          label: "Este trimestre"
        },
        {
          type: 'year',
          startDate: startOfYear(now),
          endDate: endOfYear(now),
          label: "Total año"
        }
      ];
    } catch (error) {
      console.error('Error generating date filter options:', error);
      return [{
        type: 'month',
        startDate: now,
        endDate: now,
        label: "Este mes"
      }];
    }
  };

  // Cálculos seguros
  const safeTeamMembers: SafeTeamMember[] = useMemo(() => {
    if (!Array.isArray(baseTeam)) return [];
    
    return baseTeam.map((member: any) => ({
      id: typeof member?.id === 'number' ? member.id : 0,
      name: typeof member?.personnelName === 'string' ? member.personnelName : 'Usuario Desconocido',
      role: typeof member?.role === 'string' ? member.role : 'Sin rol',
      hours: typeof member?.hours === 'number' ? member.hours : 0,
      entries: 0
    }));
  }, [baseTeam]);

  const safeCostSummary: SafeCostSummary = useMemo(() => {
    try {
      const validTimeEntries = Array.isArray(timeEntries) ? timeEntries : [];
      
      const totalCost = validTimeEntries.reduce((sum: number, entry: any) => {
        const cost = typeof entry?.totalCost === 'number' ? entry.totalCost : 0;
        return sum + cost;
      }, 0);

      const totalHours = validTimeEntries.reduce((sum: number, entry: any) => {
        const hours = typeof entry?.hours === 'number' ? entry.hours : 0;
        return sum + hours;
      }, 0);

      const targetPrice = typeof project?.budget === 'number' ? project.budget : 0;
      const markup = totalCost > 0 ? targetPrice / totalCost : 0;
      const budgetUtilization = targetPrice > 0 ? (totalCost / targetPrice) * 100 : 0;

      return {
        markup: typeof markup === 'number' && !isNaN(markup) ? markup : 0,
        targetClientPrice: targetPrice,
        totalCost: totalCost,
        budgetUtilization: typeof budgetUtilization === 'number' && !isNaN(budgetUtilization) ? budgetUtilization : 0,
        filteredHours: totalHours,
        targetHours: 100 // Valor seguro por defecto
      };
    } catch (error) {
      console.error('Error calculating cost summary:', error);
      return {
        markup: 0,
        targetClientPrice: 0,
        totalCost: 0,
        budgetUtilization: 0,
        filteredHours: 0,
        targetHours: 0
      };
    }
  }, [timeEntries, project]);

  // Formateo seguro de números
  const formatNumber = (value: unknown): string => {
    if (typeof value === 'number' && !isNaN(value)) {
      return value.toLocaleString();
    }
    return '0';
  };

  const formatPercentage = (value: unknown): string => {
    if (typeof value === 'number' && !isNaN(value)) {
      return `${value.toFixed(1)}%`;
    }
    return '0.0%';
  };

  const formatMultiplier = (value: unknown): string => {
    if (typeof value === 'number' && !isNaN(value)) {
      return `${value.toFixed(2)}x`;
    }
    return '0.00x';
  };

  if (projectLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="text-slate-600">Cargando proyecto...</p>
        </div>
      </div>
    );
  }

  const projectName = typeof project?.name === 'string' ? project.name : 'Proyecto';
  const clientName = typeof clientData?.name === 'string' ? clientData.name : 'Sin cliente';
  const filterLabel = typeof dateFilter?.label === 'string' ? dateFilter.label : 'Este mes';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/active-projects')}
              className="text-slate-600 hover:text-slate-800"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{projectName}</h1>
              <p className="text-slate-600">Cliente: {clientName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Settings className="mr-2 h-4 w-4" />
              Configurar
            </Button>
          </div>
        </div>

        {/* Filtro temporal */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-600" />
            <span className="text-sm font-medium text-slate-700">Período:</span>
          </div>
          <Select
            value={filterLabel}
            onValueChange={(value) => {
              const option = getDateFilterOptions().find(opt => opt.label === value);
              if (option) {
                setDateFilter(option);
              }
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getDateFilterOptions().map((option) => (
                <SelectItem key={option.type} value={option.label}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Análisis de Rentabilidad */}
        <Card className="border-l-4 border-l-yellow-500 bg-gradient-to-r from-yellow-50 to-amber-50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-yellow-600" />
                Análisis de Rentabilidad - {filterLabel}
              </div>
              <Badge variant="outline" className="bg-white/80 border-yellow-200 text-yellow-700">
                Métricas Financieras
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Markup Calculation */}
              <div className="p-4 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg border border-yellow-200">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-5 w-5 text-yellow-600" />
                  <p className="text-sm font-semibold text-yellow-800">Markup Actual</p>
                </div>
                <p className="text-2xl font-bold text-yellow-600">
                  {formatMultiplier(safeCostSummary.markup)}
                </p>
                <p className="text-xs text-yellow-600">
                  {safeCostSummary.markup >= 2.5 ? 'Excelente rentabilidad' :
                   safeCostSummary.markup >= 1.8 ? 'Buena rentabilidad' :
                   safeCostSummary.markup >= 1.2 ? 'Rentabilidad aceptable' :
                   'Rentabilidad crítica'}
                </p>
              </div>

              {/* Precio vs Costo */}
              <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <p className="text-sm font-semibold text-green-800">Precio vs Costo</p>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-green-600">Precio:</span>
                    <span className="font-medium">${formatNumber(safeCostSummary.targetClientPrice)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-green-600">Costo:</span>
                    <span className="font-medium">${formatNumber(safeCostSummary.totalCost)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold pt-1 border-t border-green-200">
                    <span className="text-green-600">Margen:</span>
                    <span className="text-green-700">
                      ${formatNumber(safeCostSummary.targetClientPrice - safeCostSummary.totalCost)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Eficiencia Presupuestaria */}
              <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-5 w-5 text-blue-600" />
                  <p className="text-sm font-semibold text-blue-800">Eficiencia Presupuestaria</p>
                </div>
                <p className="text-2xl font-bold text-blue-600">
                  {formatPercentage(safeCostSummary.budgetUtilization)}
                </p>
                <p className="text-xs text-blue-600">
                  {safeCostSummary.budgetUtilization <= 80 ? 'Excelente control' :
                   safeCostSummary.budgetUtilization <= 100 ? 'Dentro del presupuesto' :
                   'Sobre presupuesto'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resumen del Equipo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              Equipo del Proyecto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {safeTeamMembers.length > 0 ? (
                safeTeamMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-semibold text-purple-600">
                          {member.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{member.name}</p>
                        <p className="text-xs text-slate-600">{member.role}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{formatNumber(member.hours)}h</p>
                      <p className="text-xs text-slate-600">{formatNumber(member.entries)} registros</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-600 text-center py-4">No hay miembros del equipo configurados</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Métricas Generales */}
        <Card>
          <CardHeader>
            <CardTitle>Resumen General</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">Horas Trabajadas</span>
                </div>
                <span className="font-bold">{formatNumber(safeCostSummary.filteredHours)}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Costo Total</span>
                </div>
                <span className="font-bold">${formatNumber(safeCostSummary.totalCost)}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-600" />
                  <span className="text-sm">Miembros Activos</span>
                </div>
                <span className="font-bold">{formatNumber(safeTeamMembers.length)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}