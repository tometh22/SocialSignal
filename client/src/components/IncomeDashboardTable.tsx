import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, TrendingUp, FileSpreadsheet, Filter, Users, Calculator } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface IncomeDashboardTableProps {
  projectId?: number;
  timeFilter?: string;
}

interface IncomeRecord {
  id: number;
  client_name: string;
  project_name: string;
  amount_usd: number;
  month_key: string;
  revenue_type: 'fee' | 'project' | 'bonus';
  status: 'completada' | 'pendiente' | 'proyectada';
  confirmed: string;
}

interface IncomeFilters {
  clientName?: string;
  revenueType?: string;
  status?: string;
}

export const IncomeDashboardTable: React.FC<IncomeDashboardTableProps> = ({ projectId, timeFilter }) => {
  const [filters, setFilters] = useState<IncomeFilters>({});

  const { data: incomeData = [], isLoading, error, refetch } = useQuery({
    queryKey: ['/api/income-dashboard-rows', { projectId, timeFilter, ...filters }],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (projectId) params.append('projectId', projectId.toString());
      if (timeFilter) params.append('timeFilter', timeFilter);
      if (filters.clientName) params.append('clientName', filters.clientName);
      if (filters.revenueType) params.append('revenueType', filters.revenueType);
      if (filters.status) params.append('status', filters.status);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      // Forward React Query's signal to our controller
      let abortListener: (() => void) | null = null;
      if (signal) {
        abortListener = () => controller.abort();
        signal.addEventListener('abort', abortListener);
      }
      
      try {
        const response = await fetch(`/api/income-dashboard-rows?${params}`, {
          signal: controller.signal,
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        clearTimeout(timeoutId);
        if (signal && abortListener) {
          signal.removeEventListener('abort', abortListener);
        }
        
        if (!response.ok) {
          const error = new Error(`Error ${response.status}: ${response.statusText}`) as any;
          error.status = response.status;
          
          if (response.status === 408 || response.status >= 500) {
            error.message = 'El servidor está experimentando problemas. Inténtalo de nuevo.';
          }
          throw error;
        }
        return response.json();
      } catch (error: any) {
        if (error.name === 'AbortError') {
          const abortError = new Error('La consulta tardó demasiado tiempo. Verifica tu conexión.') as any;
          abortError.status = 408;
          throw abortError;
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
        if (signal && abortListener) {
          signal.removeEventListener('abort', abortListener);
        }
      }
    },
    retry: (failureCount, error: any) => {
      // No retry for client errors (4xx) or if already tried 2 times
      if (failureCount >= 2) return false;
      if (error?.status >= 400 && error?.status < 500 && error?.status !== 429) return false;
      return true;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 60000, // 1 minute cache
    gcTime: 300000, // 5 minutes in cache
  });

  // Calcular métricas principales
  const totalIncome = useMemo(() => {
    return incomeData.reduce((sum: number, record: IncomeRecord) => sum + record.amount_usd, 0);
  }, [incomeData]);

  const totalProjects = useMemo(() => {
    const uniqueProjects = new Set(incomeData.map((record: IncomeRecord) => record.project_name));
    return uniqueProjects.size;
  }, [incomeData]);

  const avgProjectValue = useMemo(() => {
    if (totalProjects === 0) return 0;
    return totalIncome / totalProjects;
  }, [totalIncome, totalProjects]);

  // Obtener valores únicos para filtros
  const uniqueClients = useMemo(() => {
    return Array.from(new Set(incomeData.map((record: IncomeRecord) => record.client_name)));
  }, [incomeData]);

  const clearFilters = () => {
    setFilters({});
  };

  // Filtrar datos del frontend
  const filteredData = useMemo(() => {
    return incomeData.filter((record: IncomeRecord) => {
      if (filters.clientName && record.client_name !== filters.clientName) return false;
      if (filters.revenueType && record.revenue_type !== filters.revenueType) return false;
      if (filters.status && record.status !== filters.status) return false;
      return true;
    });
  }, [incomeData, filters]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-bold text-gray-900">Ingresos del Proyecto</h2>
          </div>
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-32 mb-2"></div>
            <div className="text-sm text-gray-500">
              Cargando datos de ingresos...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-bold text-red-900">Error al Cargar Ingresos</h2>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-red-700">
              {error.message || 'Ocurrió un problema al obtener los datos de ingresos.'}
            </p>
            <Button 
              onClick={() => refetch()} 
              variant="outline" 
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              Intentar de Nuevo
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con filtros */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-green-600" />
          <h2 className="text-lg font-bold text-gray-900">
            {projectId ? 'Ingresos del Proyecto' : 'Ingresos - Análisis Detallado'}
          </h2>
        </div>

        {/* Filtros contextuales compactos */}
        {!projectId ? (
          // Vista global - filtros horizontales compactos
          <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg border">
            <div className="flex items-center gap-2 min-w-0">
              <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Cliente:</label>
              <select 
                className="border border-gray-300 rounded px-2 py-1 text-sm min-w-32 focus:ring-1 focus:ring-green-500 focus:border-green-500"
                value={filters.clientName || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, clientName: e.target.value || undefined }))}
              >
                <option value="">Todos</option>
                {uniqueClients.map((client) => (
                  <option key={client as string} value={client as string}>{client as string}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Tipo:</label>
              <select 
                className="border border-gray-300 rounded px-2 py-1 text-sm min-w-24 focus:ring-1 focus:ring-green-500 focus:border-green-500"
                value={filters.revenueType || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, revenueType: e.target.value || undefined }))}
              >
                <option value="">Todos</option>
                <option value="fee">Fee Mensual</option>
                <option value="project">Proyecto</option>
                <option value="bonus">Bonus</option>
              </select>
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Estado:</label>
              <select 
                className="border border-gray-300 rounded px-2 py-1 text-sm min-w-24 focus:ring-1 focus:ring-green-500 focus:border-green-500"
                value={filters.status || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value || undefined }))}
              >
                <option value="">Todos</option>
                <option value="completada">Completada</option>
                <option value="pendiente">Pendiente</option>
                <option value="proyectada">Proyectada</option>
              </select>
            </div>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearFilters}
              className="ml-auto flex items-center gap-1 h-7 px-2 text-xs"
            >
              <Filter className="w-3 h-3" />
              Limpiar
            </Button>
          </div>
        ) : (
          // Vista de proyecto específico - filtros compactos horizontales
          <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 min-w-0">
              <label className="text-xs font-medium text-green-700 whitespace-nowrap">Cliente:</label>
              <select 
                className="border border-green-300 rounded px-2 py-1 text-sm min-w-28 bg-white focus:ring-1 focus:ring-green-500 focus:border-green-500"
                value={filters.clientName || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, clientName: e.target.value || undefined }))}
              >
                <option value="">Todos</option>
                {uniqueClients.map((client) => (
                  <option key={client as string} value={client as string}>{client as string}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <label className="text-xs font-medium text-green-700 whitespace-nowrap">Tipo:</label>
              <select 
                className="border border-green-300 rounded px-2 py-1 text-sm min-w-24 bg-white focus:ring-1 focus:ring-green-500 focus:border-green-500"
                value={filters.revenueType || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, revenueType: e.target.value || undefined }))}
              >
                <option value="">Todos</option>
                <option value="fee">Fee Mensual</option>
                <option value="project">Proyecto</option>
                <option value="bonus">Bonus</option>
              </select>
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <label className="text-xs font-medium text-green-700 whitespace-nowrap">Estado:</label>
              <select 
                className="border border-green-300 rounded px-2 py-1 text-sm min-w-24 bg-white focus:ring-1 focus:ring-green-500 focus:border-green-500"
                value={filters.status || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value || undefined }))}
              >
                <option value="">Todos</option>
                <option value="completada">Completada</option>
                <option value="pendiente">Pendiente</option>
                <option value="proyectada">Proyectada</option>
              </select>
            </div>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearFilters}
              className="ml-auto flex items-center gap-1 h-7 px-2 text-xs border-green-300 text-green-700 hover:bg-green-100"
            >
              <Filter className="w-3 h-3" />
              Limpiar
            </Button>
          </div>
        )}

        {/* Métricas principales - Compactas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Total de Ingresos */}
          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4 text-white shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-medium">Ingresos Totales</span>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">
                  ${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
                <div className="text-xs opacity-90">USD</div>
              </div>
            </div>
          </div>

          {/* Total de Proyectos */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 text-white shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">Proyectos</span>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">
                  {totalProjects}
                </div>
                <div className="text-xs opacity-90">Total</div>
              </div>
            </div>
          </div>

          {/* Valor Promedio por Proyecto */}
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-4 text-white shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                <span className="text-sm font-medium">Valor Promedio</span>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">
                  ${avgProjectValue.toFixed(0)}
                </div>
                <div className="text-xs opacity-90">/proyecto</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Ingresos - Diseño Corporativo Compacto */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-gray-600" />
            <h3 className="font-medium text-gray-900">Detalle de Ingresos</h3>
            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
              {filteredData.length} registros
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-gray-600">Fee Mensual</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-gray-600">Proyecto</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span className="text-gray-600">Bonus</span>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-25">
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">Cliente</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">Proyecto</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">Mes</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">Monto USD</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">Tipo</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <FileSpreadsheet className="w-6 h-6 text-gray-400" />
                      <span className="text-sm">No se encontraron registros</span>
                      <span className="text-xs">Verifica los filtros aplicados</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((record: IncomeRecord) => (
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2 text-sm text-gray-900 font-medium">{record.client_name}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{record.project_name}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 font-mono">{record.month_key}</td>
                    <td className="px-4 py-2 text-sm text-right font-mono font-medium text-green-600">
                      ${record.amount_usd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <Badge 
                        variant="outline"
                        className={`text-xs ${
                          record.revenue_type === 'fee' ? 'bg-green-100 text-green-700 border-green-300' :
                          record.revenue_type === 'project' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                          'bg-purple-100 text-purple-700 border-purple-300'
                        }`}
                      >
                        {record.revenue_type === 'fee' ? 'Fee Mensual' :
                         record.revenue_type === 'project' ? 'Proyecto' : 'Bonus'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <Badge 
                        variant="outline"
                        className={`text-xs ${
                          record.status === 'completada' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' :
                          record.status === 'pendiente' ? 'bg-amber-100 text-amber-700 border-amber-300' :
                          'bg-slate-100 text-slate-700 border-slate-300'
                        }`}
                      >
                        {record.status === 'completada' ? 'Completada' :
                         record.status === 'pendiente' ? 'Pendiente' : 'Proyectada'}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};