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
  monthKey?: string;
}

export default function IncomeDashboard({ projectId }: { projectId?: number }) {
  const [filters, setFilters] = useState<IncomeFilters>({});

  // Fetch income data
  const { data: incomeData = [], isLoading } = useQuery({
    queryKey: ['/api/income-dashboard', filters, projectId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (projectId) params.append('projectId', projectId.toString());
      if (filters.clientName) params.append('clientName', filters.clientName);
      if (filters.projectName) params.append('projectName', filters.projectName);
      if (filters.monthKey) params.append('monthKey', filters.monthKey);
      
      const response = await fetch(`/api/income-dashboard?${params}`);
      if (!response.ok) throw new Error('Failed to fetch income data');
      return response.json();
    },
  });

  // Get unique values for filters
  const uniqueClients = useMemo(() => {
    const clientSet = new Set(incomeData.map((record: IncomeRecord) => record.clientName));
    return Array.from(clientSet).sort();
  }, [incomeData]);

  const uniqueProjects = useMemo(() => {
    const projectSet = new Set(incomeData.map((record: IncomeRecord) => record.projectName));
    return Array.from(projectSet).sort();
  }, [incomeData]);

  const uniqueMonths = useMemo(() => {
    const monthSet = new Set(incomeData.map((record: IncomeRecord) => record.monthKey));
    return Array.from(monthSet).sort().reverse();
  }, [incomeData]);

  // Calculate total income
  const totalIncome = useMemo(() => 
    incomeData
      .filter((record: IncomeRecord) => record.confirmed === 'SI')
      .reduce((sum: number, record: IncomeRecord) => sum + (record.amountUsd || 0), 0),
    [incomeData]
  );

  // Filter data based on current filters
  const filteredData = useMemo(() => {
    return incomeData.filter((record: IncomeRecord) => {
      if (filters.clientName && record.clientName !== filters.clientName) return false;
      if (filters.projectName && record.projectName !== filters.projectName) return false;
      if (filters.monthKey && record.monthKey !== filters.monthKey) return false;
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
          <h2 className="text-lg font-bold text-gray-900">Ingresos - Numerador Limpio</h2>
          <Badge variant="outline" className="text-xs">
            Solo ingresos confirmados para cálculos financieros
          </Badge>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <Select 
            value={filters.clientName || ''} 
            onValueChange={(value) => setFilters(prev => ({ ...prev, clientName: value || undefined }))}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Todos los clientes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos los clientes</SelectItem>
              {uniqueClients.map(client => (
                <SelectItem key={client} value={client}>{client}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select 
            value={filters.projectName || ''} 
            onValueChange={(value) => setFilters(prev => ({ ...prev, projectName: value || undefined }))}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Todos los proyectos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos los proyectos</SelectItem>
              {uniqueProjects.map(project => (
                <SelectItem key={project} value={project}>{project}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select 
            value={filters.monthKey || ''} 
            onValueChange={(value) => setFilters(prev => ({ ...prev, monthKey: value || undefined }))}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Todos los meses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos los meses</SelectItem>
              {uniqueMonths.map(month => (
                <SelectItem key={month} value={month}>{month}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={clearFilters}
            className="flex items-center gap-1"
          >
            <Filter className="w-4 h-4" />
            Limpiar
          </Button>
        </div>

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
          <p className="text-sm text-gray-500">{filteredData.length} registros • Granularidad proyecto-mes</p>
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
                  filteredData.map((record: IncomeRecord) => (
                    <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-3 text-sm text-gray-900 font-medium">{record.projectName}</td>
                      <td className="p-3 text-sm text-gray-700">{record.clientName}</td>
                      <td className="p-3 text-sm text-gray-700 font-mono">{record.monthKey}</td>
                      <td className="p-3 text-sm">
                        <Badge variant={
                          record.revenueType === 'fee' ? 'default' : 
                          record.revenueType === 'tm' ? 'secondary' : 'outline'
                        } className="text-xs">
                          {record.revenueType.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="p-3 text-sm text-right font-mono font-medium text-green-600">
                        ${(record.amountUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-sm">
                        <Badge 
                          variant={record.confirmed === 'SI' ? 'default' : 'outline'}
                          className={`text-xs ${record.confirmed === 'SI' ? 'bg-green-100 text-green-700' : ''}`}
                        >
                          {record.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-sm text-gray-600 max-w-xs truncate">
                        {record.notes || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}