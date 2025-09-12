import React, { useState, useMemo } from 'react';
import { DollarSign, TrendingDown, FileSpreadsheet, Filter, Clock, Calculator } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCompleteProjectData } from '@/hooks/useCompleteProjectData';

interface CostDashboardProps {
  projectId?: number;
  timeFilter?: string;
}

interface CostRecord {
  id: number;
  persona: string;
  mes: string;
  año: number;
  horasRealesAsana: number;
  costoTotal: number;
  valorHoraPersona: number;
  proyecto: string;
  cliente: string;
}

interface CostFilters {
  memberName?: string;
}

export const CostDashboard: React.FC<CostDashboardProps> = ({ projectId, timeFilter = 'all' }) => {
  const [filters, setFilters] = useState<CostFilters>({});

  // Usar el hook correcto que ya existe
  const { data: projectData, isLoading } = useCompleteProjectData(projectId!, timeFilter);
  
  // 💰 MULTI-CURRENCY: Usar nuevos campos de análisis de moneda
  const costData: CostRecord[] = projectData?.directCosts || [];
  const costsDisplay = projectData?.costsDisplay || [];  // Costos con ambas monedas
  const currencyAnalysis = projectData?.analysis;        // Análisis de moneda automático

  // 💰 UTILITY: Función para formatear monedas con símbolos claros
  const formatCurrency = (amount: number, currency: 'USD' | 'ARS' = 'USD'): string => {
    const formattedAmount = new Intl.NumberFormat('en-US', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    }).format(amount);
    
    const symbol = currency === 'USD' ? 'US$' : 'AR$';
    return `${symbol}${formattedAmount}`;
  };

  // 💰 MULTI-CURRENCY: Calcular métricas principales usando análisis de moneda
  const { totalCosts, totalHours, avgHourlyRate, currencySymbol, analysisMetrics, analysisCurrency } = useMemo(() => {
    // Usar análisis de moneda si está disponible
    if (currencyAnalysis) {
      const currency = currencyAnalysis.currency as 'USD' | 'ARS';
      const symbol = currency === 'USD' ? 'US$' : 'AR$';
      return {
        totalCosts: currencyAnalysis.totals.costs,
        totalHours: costData.reduce((sum: number, record: CostRecord) => sum + (record.horasRealesAsana || 0), 0),
        avgHourlyRate: costData.reduce((sum: number, record: CostRecord) => sum + (record.horasRealesAsana || 0), 0) > 0 
          ? currencyAnalysis.totals.costs / costData.reduce((sum: number, record: CostRecord) => sum + (record.horasRealesAsana || 0), 0) 
          : 0,
        currencySymbol: symbol,
        analysisMetrics: currencyAnalysis.totals,
        analysisCurrency: currency
      };
    } else {
      // Fallback a cálculo tradicional en ARS
      const totalCosts = costData.reduce((sum: number, record: CostRecord) => sum + record.costoTotal, 0);
      const totalHours = costData.reduce((sum: number, record: CostRecord) => sum + (record.horasRealesAsana || 0), 0);
      return {
        totalCosts,
        totalHours,
        avgHourlyRate: totalHours > 0 ? totalCosts / totalHours : 0,
        currencySymbol: 'AR$', // Fallback to ARS
        analysisMetrics: null,
        analysisCurrency: 'ARS' as const
      };
    }
  }, [costData, currencyAnalysis]);

  // Obtener valores únicos para filtros
  const uniqueMembers = useMemo(() => {
    return Array.from(new Set(costData.map((record: CostRecord) => record.persona)));
  }, [costData]);

  const clearFilters = () => {
    setFilters({});
  };

  // 💰 MULTI-CURRENCY: Filtrar datos usando costsDisplay cuando esté disponible
  const filteredData = useMemo(() => {
    const dataToFilter = costsDisplay.length > 0 ? costsDisplay : costData;
    return dataToFilter.filter((record: any) => {
      if (filters.memberName && record.persona !== filters.memberName) return false;
      return true;
    });
  }, [costData, costsDisplay, filters]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-bold text-gray-900">Costos del Proyecto</h2>
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-bold text-gray-900">
              {projectId ? 'Costos del Proyecto' : 'Costos - Análisis Detallado'}
            </h2>
          </div>
          
          {/* 💰 MULTI-CURRENCY: Badge de moneda detectada automáticamente */}
          {currencyAnalysis && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-sm font-medium bg-blue-50 text-blue-700 border-blue-200">
                {currencyAnalysis.currency === 'USD' ? '🇺🇸 USD' : '🇦🇷 ARS'} Analysis
              </Badge>
              {currencyAnalysis.metadata.hasMixedCurrencies && (
                <Badge variant="outline" className="text-xs bg-orange-50 text-orange-600 border-orange-200">
                  Mixed Currencies
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Filtros contextuales compactos */}
        {!projectId ? (
          // Vista global - filtros horizontales compactos
          <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg border">
            <div className="flex items-center gap-2 min-w-0">
              <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Miembro:</label>
              <select 
                className="border border-gray-300 rounded px-2 py-1 text-sm min-w-32 focus:ring-1 focus:ring-red-500 focus:border-red-500"
                value={filters.memberName || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, memberName: e.target.value || undefined }))}
              >
                <option value="">Todos</option>
                {uniqueMembers.map((member) => (
                  <option key={member as string} value={member as string}>{member as string}</option>
                ))}
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
          <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center gap-2 min-w-0">
              <label className="text-xs font-medium text-red-700 whitespace-nowrap">Miembro:</label>
              <select 
                className="border border-red-300 rounded px-2 py-1 text-sm min-w-28 bg-white focus:ring-1 focus:ring-red-500 focus:border-red-500"
                value={filters.memberName || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, memberName: e.target.value || undefined }))}
              >
                <option value="">Todos</option>
                {uniqueMembers.map((member) => (
                  <option key={member as string} value={member as string}>{member as string}</option>
                ))}
              </select>
            </div>


            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearFilters}
              className="ml-auto flex items-center gap-1 h-7 px-2 text-xs border-red-300 text-red-700 hover:bg-red-100"
            >
              <Filter className="w-3 h-3" />
              Limpiar
            </Button>
          </div>
        )}

        {/* 💰 MULTI-CURRENCY: Métricas principales con moneda del análisis */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Total de Costos */}
          <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-lg p-4 text-white shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                <span className="text-sm font-medium">Costo Total</span>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">
                  {formatCurrency(totalCosts, analysisCurrency)}
                </div>
                <div className="text-xs opacity-90">
                  {currencyAnalysis ? currencyAnalysis.currency : 'ARS'}
                  {currencyAnalysis?.metadata.hasMixedCurrencies && ' (Normalized)'}
                </div>
              </div>
            </div>
          </div>

          {/* Total de Horas */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 text-white shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">Horas Trabajadas</span>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">
                  {totalHours.toFixed(1)}h
                </div>
                <div className="text-xs opacity-90">Total</div>
              </div>
            </div>
          </div>

          {/* Tarifa Promedio + Métricas del análisis */}
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-4 text-white shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                <span className="text-sm font-medium">Tarifa Promedio</span>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">
                  {formatCurrency(avgHourlyRate, analysisCurrency)}
                </div>
                <div className="text-xs opacity-90">
                  {currencyAnalysis ? currencyAnalysis.currency : 'ARS'}/hora
                  {analysisMetrics && (
                    <div className="text-xs mt-1">
                      ROI: {analysisMetrics.roi.toFixed(1)}% • 
                      Markup: {analysisMetrics.markup.toFixed(1)}x
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Costos - Diseño Corporativo Compacto */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-gray-600" />
            <h3 className="font-medium text-gray-900">Detalle de Costos</h3>
            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
              {filteredData.length} registros
            </span>
          </div>
          {/* 💰 MULTI-CURRENCY: Indicadores de moneda */}
          <div className="flex items-center gap-3 text-xs">
            {costsDisplay.length > 0 ? (
              // Si tenemos costsDisplay, mostrar ambas monedas
              <>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-600">ARS Original</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-gray-600">USD Converted</span>
                </div>
                {currencyAnalysis && (
                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200">
                    Analysis: {currencyAnalysis.currency}
                  </Badge>
                )}
              </>
            ) : (
              // Fallback a mostrar solo ARS
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-gray-600">Moneda Original (ARS)</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-25">
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">Miembro</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">Mes</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">Horas</th>
                {costsDisplay.length > 0 ? (
                  // 💰 MULTI-CURRENCY: Mostrar ambas monedas cuando costsDisplay está disponible
                  <>
                    <th className="text-right px-4 py-2 text-xs font-medium text-blue-600 uppercase tracking-wider">
                      Costo ARS
                      <div className="w-2 h-2 bg-blue-500 rounded-full inline-block ml-1"></div>
                    </th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-green-600 uppercase tracking-wider">
                      Costo USD
                      <div className="w-2 h-2 bg-green-500 rounded-full inline-block ml-1"></div>
                    </th>
                    <th className="text-center px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">Origen</th>
                  </>
                ) : (
                  // Fallback a columnas tradicionales
                  <>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">Tarifa/h</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">Costo Total</th>
                    <th className="text-center px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">Moneda</th>
                  </>
                )}
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
                filteredData.map((record: any) => (
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2 text-sm text-gray-900 font-medium">{record.persona}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 font-mono">{record.mes}</td>
                    <td className="px-4 py-2 text-sm text-right font-mono">{(record.horasRealesAsana || 0).toFixed(1)}h</td>
                    
                    {costsDisplay.length > 0 && record.costoTotalARS ? (
                      // 💰 MULTI-CURRENCY: Mostrar ambas monedas
                      <>
                        <td className="px-4 py-2 text-sm text-right font-mono font-medium text-blue-600">
                          {formatCurrency(record.costoTotalARS, 'ARS')}
                        </td>
                        <td className="px-4 py-2 text-sm text-right font-mono font-medium text-green-600">
                          {formatCurrency(record.costoTotalUSD, 'USD')}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <Badge 
                            variant="outline"
                            className={`text-xs ${record.hasUsdValue 
                              ? 'bg-green-100 text-green-700 border-green-300' 
                              : 'bg-orange-100 text-orange-700 border-orange-300'}`}
                          >
                            {record.hasUsdValue ? 'Original' : 'Converted'}
                          </Badge>
                        </td>
                      </>
                    ) : (
                      // Fallback a mostrar datos tradicionales
                      <>
                        <td className="px-4 py-2 text-sm text-right font-mono text-blue-600">
                          {formatCurrency(record.valorHoraPersona || 0, 'ARS')}
                        </td>
                        <td className="px-4 py-2 text-sm text-right font-mono font-medium text-red-600">
                          {formatCurrency(record.costoTotal || 0, 'ARS')}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <Badge 
                            variant="outline"
                            className="text-xs bg-green-100 text-green-700 border-green-300"
                          >
                            ARS
                          </Badge>
                        </td>
                      </>
                    )}
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