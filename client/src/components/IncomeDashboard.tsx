
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DollarSign, FileSpreadsheet, Filter, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

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
  salesType?: string;
  status?: string;
}

interface IncomeDashboardProps {
  projectId?: number;
  timeFilter?: string;
  viewMode?: 'executive' | 'detailed' | 'compact';
}

export default function IncomeDashboard({ 
  projectId, 
  timeFilter, 
  viewMode = 'executive' 
}: IncomeDashboardProps) {
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
      const salesType = record.salesType || record.sales_type;
      const status = record.status;
      
      if (filters.clientName && clientName !== filters.clientName) return false;
      // Only apply project filter if we're NOT in project context
      if (!projectId && filters.projectName && projectName !== filters.projectName) return false;
      
      // Project-specific filters
      if (filters.salesType && salesType !== filters.salesType) return false;
      if (filters.status && status !== filters.status) return false;
      
      return true;
    });
  }, [incomeData, filters, projectId]);

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
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header con filtros */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-bold text-gray-900">
              {projectId ? 'Ingresos del Proyecto' : 'Análisis Financiero - Ingresos'}
            </h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-blue-600 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-md">
                <p className="font-semibold mb-1">Numerador Limpio de Ingresos</p>
                <p className="text-sm mb-2">Este dashboard muestra los ingresos confirmados que forman el numerador para el cálculo de márgenes.</p>
                <ul className="text-sm space-y-1">
                  <li>• <strong>Confirmados:</strong> Solo ingresos marcados como "Si" en el Excel</li>
                  <li>• <strong>Por proyecto:</strong> Filtrable por cliente y proyecto específico</li>
                  <li>• <strong>Tipos:</strong> Fee, One Shot, Bonus según el Excel MAESTRO</li>
                </ul>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Filtros contextuales compactos */}
          {!projectId ? (
            // Vista global - filtros horizontales compactos
            <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-2 min-w-0">
                <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Cliente:</label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <select 
                      className="border border-gray-300 rounded px-2 py-1 text-sm min-w-32 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      value={filters.clientName || ""}
                      onChange={(e) => setFilters(prev => ({ ...prev, clientName: e.target.value || undefined }))}
                    >
                      <option value="">Todos</option>
                      {uniqueClients.map((client) => (
                        <option key={client as string} value={client as string}>{client as string}</option>
                      ))}
                    </select>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Filtra los ingresos por cliente específico</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="flex items-center gap-2 min-w-0">
                <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Proyecto:</label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <select 
                      className="border border-gray-300 rounded px-2 py-1 text-sm min-w-32 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      value={filters.projectName || ""}
                      onChange={(e) => setFilters(prev => ({ ...prev, projectName: e.target.value || undefined }))}
                    >
                      <option value="">Todos</option>
                      {uniqueProjects.map((project) => (
                        <option key={project as string} value={project as string}>{project as string}</option>
                      ))}
                    </select>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Filtra los ingresos por proyecto específico</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={clearFilters}
                    className="ml-auto flex items-center gap-1 h-7 px-2 text-xs"
                  >
                    <Filter className="w-3 h-3" />
                    Limpiar
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Elimina todos los filtros aplicados</p>
                </TooltipContent>
              </Tooltip>
            </div>
          ) : (
            // Vista de proyecto específico - filtros compactos horizontales
            <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 min-w-0">
                <label className="text-xs font-medium text-blue-700 whitespace-nowrap">Tipo:</label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <select 
                      className="border border-blue-300 rounded px-2 py-1 text-sm min-w-24 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      value={filters.salesType || ""}
                      onChange={(e) => setFilters(prev => ({ ...prev, salesType: e.target.value || undefined }))}
                    >
                      <option value="">Todos</option>
                      <option value="Fee">Fee</option>
                      <option value="One Shot">One Shot</option>
                      <option value="Bonus">Bonus</option>
                    </select>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Filtra por tipo de ingreso: Fee (recurrente), One Shot (único), Bonus (adicional)</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="flex items-center gap-2 min-w-0">
                <label className="text-xs font-medium text-blue-700 whitespace-nowrap">Estado:</label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <select 
                      className="border border-blue-300 rounded px-2 py-1 text-sm min-w-24 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      value={filters.status || ""}
                      onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value || undefined }))}
                    >
                      <option value="">Todos</option>
                      <option value="completada">Completada</option>
                      <option value="activa">Activa</option>
                      <option value="proyectada">Proyectada</option>
                    </select>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Filtra por estado del proyecto: Completada (facturado), Activa (en curso), Proyectada (estimado)</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={clearFilters}
                    className="ml-auto flex items-center gap-1 h-7 px-2 text-xs border-blue-300 text-blue-700 hover:bg-blue-100"
                  >
                    <Filter className="w-3 h-3" />
                    Limpiar
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Elimina todos los filtros aplicados</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Total Income Card - Compacto */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4 text-white shadow-sm cursor-help">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm font-medium">Ingresos Confirmados</span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">
                      ${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-xs opacity-90">USD</div>
                  </div>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-semibold">Total de Ingresos Confirmados</p>
              <p className="text-sm">Suma de todos los ingresos marcados como "Si" en la columna Confirmado del Excel MAESTRO</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Tabla de Ingresos - Diseño Corporativo Compacto */}
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-gray-600" />
              <h3 className="font-medium text-gray-900">Detalle de Ingresos</h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded cursor-help">
                    {filteredData.length} registros
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Número de registros de ingresos que coinciden con los filtros aplicados</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 cursor-help">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-gray-600">Completada</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Proyectos completados y facturados</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 cursor-help">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-600">Activa</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Proyectos en desarrollo activo</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 cursor-help">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <span className="text-gray-600">Proyectada</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Ingresos estimados o proyectados</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-25">
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">Proyecto</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Nombre del proyecto según Excel MAESTRO</p>
                      </TooltipContent>
                    </Tooltip>
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">Cliente</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Cliente asociado al proyecto</p>
                      </TooltipContent>
                    </Tooltip>
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">Mes</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Mes en formato YYYY-MM del ingreso</p>
                      </TooltipContent>
                    </Tooltip>
                  </th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">Tipo</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Tipo de venta: Fee (recurrente), One Shot (único), Bonus (adicional)</p>
                      </TooltipContent>
                    </Tooltip>
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">Ingresos USD</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Monto en dólares estadounidenses del ingreso confirmado</p>
                      </TooltipContent>
                    </Tooltip>
                  </th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">Estado</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Estado del proyecto: Completada, Activa, o Proyectada</p>
                      </TooltipContent>
                    </Tooltip>
                  </th>
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
                      <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2 text-sm text-gray-900 font-medium">{projectName}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{clientName}</td>
                        <td className="px-4 py-2 text-sm text-gray-700 font-mono">{monthKey}</td>
                        <td className="px-4 py-2 text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant={
                                salesType.toLowerCase() === 'fee' ? 'default' : 
                                salesType.toLowerCase() === 'tm' ? 'secondary' : 'outline'
                              } className="text-xs cursor-help">
                                {salesType}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {salesType.toLowerCase() === 'fee' ? 'Ingreso recurrente mensual' :
                                 salesType.toLowerCase() === 'one shot' ? 'Ingreso único por proyecto' :
                                 salesType.toLowerCase() === 'bonus' ? 'Ingreso adicional o bonificación' :
                                 'Tipo de ingreso'}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                        <td className="px-4 py-2 text-sm text-right font-mono font-medium text-green-600">
                          ${amountUsd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge 
                                variant="outline"
                                className={`text-xs cursor-help ${
                                  status === 'proyectada' ? 'bg-orange-100 text-orange-700 border-orange-300' :
                                  status === 'activa' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                                  status === 'completada' ? 'bg-green-100 text-green-700 border-green-300' :
                                  'bg-gray-100 text-gray-700 border-gray-300'
                                }`}
                              >
                                {status === 'proyectada' ? 'Proyectada' :
                                 status === 'activa' ? 'Activa' :
                                 status === 'completada' ? 'Completada' :
                                 status}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {status === 'proyectada' ? 'Ingreso estimado o planificado' :
                                 status === 'activa' ? 'Proyecto en desarrollo, ingreso en proceso' :
                                 status === 'completada' ? 'Proyecto finalizado, ingreso confirmado' :
                                 'Estado del proyecto'}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
