import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DollarSign, FileSpreadsheet, Filter, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface IncomeRecord {
  id: number;
  projectName: string;
  clientName: string;
  monthKey: string; // YYYY-MM
  revenueType: string; // 'fee', 'tm', 'one-shot'
  amountUsd: number;
  status: string;
  confirmed: string;
  notes?: string;
}

interface IncomeFilters {
  clientName?: string;
  projectName?: string;
}

export default function IncomeDashboard({ projectId, timeFilter }: { projectId?: number; timeFilter?: string }) {
  const [filters, setFilters] = useState<IncomeFilters>({});

  // Fetch income data with global time filter
  const { data: incomeData = [], isLoading } = useQuery({
    queryKey: ['/api/income-dashboard', filters, projectId, timeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (projectId) params.append('projectId', projectId.toString());
      if (filters.clientName) params.append('clientName', filters.clientName);
      // Only include project filter if we're NOT in a specific project context
      if (!projectId && filters.projectName) params.append('projectName', filters.projectName);
      // Use global time filter instead of local month filter
      if (timeFilter && timeFilter !== 'all_time') params.append('timeFilter', timeFilter);
      
      console.log('🔍 IncomeDashboard - Fetching with params:', params.toString());
      console.log('🔍 IncomeDashboard - Project context:', projectId ? `Project ${projectId}` : 'All projects');
      console.log('🔍 IncomeDashboard - Global timeFilter:', timeFilter);
      const response = await fetch(`/api/income-dashboard?${params}`);
      if (!response.ok) {
        console.error('❌ IncomeDashboard - API error:', response.status, response.statusText);
        throw new Error('Failed to fetch income data');
      }
      const data = await response.json();
      console.log('📊 IncomeDashboard - Received data:', data);
      return data;
    },
  });

  // Get unique values for filters with robust handling
  const uniqueClients = useMemo(() => {
    const clientSet = new Set();
    // Ensure incomeData is an array before using forEach
    if (Array.isArray(incomeData)) {
      incomeData.forEach((record: any) => {
        const client = record.clientName || record.client_name;
        if (client && client !== "N/A" && typeof client === 'string' && client.trim()) {
          clientSet.add(client.trim());
        }
      });
    }
    return Array.from(clientSet).sort();
  }, [incomeData]);

  const uniqueProjects = useMemo(() => {
    // Only calculate unique projects if we're NOT in project context
    if (projectId) return [];
    
    const projectSet = new Set();
    // Ensure incomeData is an array before using forEach
    if (Array.isArray(incomeData)) {
      incomeData.forEach((record: any) => {
        const project = record.projectName || record.project_name;
        if (project && project !== "N/A" && typeof project === 'string' && project.trim()) {
          projectSet.add(project.trim());
        }
      });
    }
    return Array.from(projectSet).sort();
  }, [incomeData, projectId]);

  // Removed uniqueMonths since we're using global time filter

  // Calculate total income with fallbacks for different column names
  const totalIncome = useMemo(() => {
    if (!Array.isArray(incomeData)) return 0;
    return incomeData
      .filter((record: any) => record.confirmed === 'SI' || record.confirmed === 'Si')
      .reduce((sum: number, record: any) => {
        const amount = parseFloat(record.amountUsd || record.amount_usd || "0");
        return sum + amount;
      }, 0);
  }, [incomeData]);

  // Filter data based on current filters with fallbacks
  const filteredData = useMemo(() => {
    if (!Array.isArray(incomeData)) return [];
    return incomeData.filter((record: any) => {
      const clientName = record.clientName || record.client_name;
      const projectName = record.projectName || record.project_name;
      const monthKey = record.monthKey || record.month_key;
      
      if (filters.clientName && clientName !== filters.clientName) return false;
      // Only apply project filter if we're NOT in project context
      if (!projectId && filters.projectName && projectName !== filters.projectName) return false;
      return true;
    });
  }, [incomeData, filters]);

  const clearFilters = () => {
    setFilters({});
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-bold text-gray-900">Ingresos Totales</h2>
          </div>
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-32"></div>
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
            {projectId ? 'Ingresos del Proyecto' : 'Ingresos - Numerador Limpio'}
          </h2>
          <Badge variant="outline" className="text-xs">
            {projectId ? 'Solo ingresos confirmados de este proyecto' : 'Solo ingresos confirmados para cálculos financieros'}
          </Badge>
        </div>

        {/* Filtros contextuales - adapta según si estamos en proyecto específico o vista global */}
        {!projectId ? (
          // Vista global - mostrar todos los filtros
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Cliente</label>
              <select 
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={filters.clientName || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, clientName: e.target.value || undefined }))}
              >
                <option value="">Todos los clientes</option>
                {uniqueClients.map((client) => (
                  <option key={client as string} value={client as string}>{client as string}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Proyecto</label>
              <select 
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={filters.projectName || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, projectName: e.target.value || undefined }))}
              >
                <option value="">Todos los proyectos</option>
                {uniqueProjects.map((project) => (
                  <option key={project as string} value={project as string}>{project as string}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Acciones</label>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearFilters}
                className="flex items-center gap-2 h-[38px]"
              >
                <Filter className="w-4 h-4" />
                Limpiar
              </Button>
            </div>
          </div>
        ) : (
          // Vista de proyecto específico - sin filtros (ya está filtrado por proyecto)
          <div className="mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-blue-700">
                <span className="text-sm font-medium">
                  📊 Mostrando datos filtrados automáticamente para este proyecto
                </span>
              </div>
              <p className="text-xs text-blue-600 mt-1">
                Los ingresos se filtran automáticamente usando el filtro de tiempo global
              </p>
            </div>
          </div>
        )}

        {/* Total Income Card */}
        <Card className="border-l-4 border-l-green-600 bg-gradient-to-br from-green-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-green-700">Ingresos Totales Confirmados</span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">
                  ${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-green-600">USD</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Ingresos por Proyecto */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
            Ingresos por Proyecto
          </CardTitle>
          <div className="space-y-2">
            <p className="text-sm text-gray-500">{filteredData.length} registros • Granularidad proyecto-mes</p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 bg-gray-50 p-2 rounded-md">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-orange-200 rounded-full"></span>
                <span>🔮 Proyectada: Ingresos futuros estimados</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-blue-200 rounded-full"></span>
                <span>⚡ Activa: Ingresos del período actual</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-200 rounded-full"></span>
                <span>✅ Completada: Ingresos confirmados del pasado</span>
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left p-3 text-sm font-medium text-gray-700">Proyecto</th>
                  <th className="text-left p-3 text-sm font-medium text-gray-700">Cliente</th>
                  <th className="text-left p-3 text-sm font-medium text-gray-700">Mes</th>
                  <th className="text-left p-3 text-sm font-medium text-gray-700">Tipo</th>
                  <th className="text-right p-3 text-sm font-medium text-gray-700">Ingresos USD</th>
                  <th className="text-left p-3 text-sm font-medium text-gray-700">Estado</th>
                  <th className="text-left p-3 text-sm font-medium text-gray-700">Notas</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <FileSpreadsheet className="w-8 h-8 text-gray-400" />
                        <span>No se encontraron registros de ingresos</span>
                        <span className="text-xs">Verifica los filtros aplicados</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((record: any) => {
                    const projectName = record.projectName || record.project_name || "N/A";
                    const clientName = record.clientName || record.client_name || "N/A";
                    const monthKey = record.monthKey || record.month_key || "N/A";
                    const salesType = record.salesType || record.sales_type || record.revenueType || "N/A";
                    const amountUsd = parseFloat(record.amountUsd || record.amount_usd || "0");
                    const status = record.status || "N/A";
                    const confirmed = record.confirmed || "NO";
                    const notes = record.notes || "—";
                    
                    return (
                      <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-3 text-sm text-gray-900 font-medium">{projectName}</td>
                        <td className="p-3 text-sm text-gray-700">{clientName}</td>
                        <td className="p-3 text-sm text-gray-700 font-mono">{monthKey}</td>
                        <td className="p-3 text-sm">
                          <Badge variant={
                            salesType.toLowerCase() === 'fee' ? 'default' : 
                            salesType.toLowerCase() === 'tm' ? 'secondary' : 'outline'
                          } className="text-xs">
                            {salesType.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="p-3 text-sm text-right font-mono font-medium text-green-600">
                          ${amountUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-sm">
                          <Badge 
                            variant="outline"
                            className={`text-xs ${
                              status === 'proyectada' ? 'bg-orange-100 text-orange-700 border-orange-300' :
                              status === 'activa' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                              status === 'completada' ? 'bg-green-100 text-green-700 border-green-300' :
                              'bg-gray-100 text-gray-700 border-gray-300'
                            }`}
                          >
                            {status === 'proyectada' ? '🔮 Proyectada' :
                             status === 'activa' ? '⚡ Activa' :
                             status === 'completada' ? '✅ Completada' :
                             status}
                          </Badge>
                        </td>
                        <td className="p-3 text-sm text-gray-600 max-w-xs truncate">
                          {notes}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}