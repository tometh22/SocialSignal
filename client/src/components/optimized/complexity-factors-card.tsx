import React, { useEffect, useState } from 'react';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Users, Globe, MessageSquare } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { CostMultiplier } from '@shared/schema';

const ComplexityFactorsCard: React.FC = () => {
  const {
    quotationData,
    updateAnalysisType,
    updateMentionsVolume,
    updateCountriesCovered,
    updateClientEngagement,
    complexityFactors,
    availableRoles
  } = useOptimizedQuote();

  // Cargar multiplicadores desde la API
  const { data: allMultipliers = [] } = useQuery<CostMultiplier[]>({
    queryKey: ["/api/cost-multipliers"],
  });

  // Organizar multiplicadores por categoría
  const getMultipliersByCategory = (category: string) => {
    return allMultipliers
      .filter(m => m.category === category && m.isActive)
      .map(m => ({
        value: m.subcategory,
        label: m.label,
        factor: m.multiplier
      }));
  };

  const analysisTypes = getMultipliersByCategory('complexity');
  const mentionsVolumeOptions = getMultipliersByCategory('mentions_volume');
  const countriesOptions = getMultipliersByCategory('countries');
  const urgencyOptions = getMultipliersByCategory('urgency');

  const getTotalComplexityFactor = (): number => {
    if (!complexityFactors) return 0;
    return Object.values(complexityFactors).reduce((sum: number, factor: any) => sum + (factor || 0), 0);
  };

  const getComplexityLevel = (factor: number) => {
    if (factor < 10) return { level: 'Bajo', color: 'bg-green-100 text-green-800' };
    if (factor < 30) return { level: 'Medio', color: 'bg-yellow-100 text-yellow-800' };
    if (factor < 50) return { level: 'Alto', color: 'bg-orange-100 text-orange-800' };
    return { level: 'Muy Alto', color: 'bg-red-100 text-red-800' };
  };

  const totalFactor = getTotalComplexityFactor();
  const complexityLevel = getComplexityLevel(totalFactor);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Factores de Complejidad</h3>
          <p className="text-sm text-gray-600">Define las características que ajustarán las horas del equipo configurado</p>
        </div>
        <Badge className={complexityLevel.color}>
          Factor Total: {totalFactor.toFixed(1)}% - {complexityLevel.level}
        </Badge>
      </div>

      {/* Resumen del equipo configurado */}
      {quotationData.teamMembers.length > 0 && (
        <Card className="bg-blue-50">
          <CardContent className="p-4">
            <h4 className="font-medium text-gray-900 mb-3">Equipo Configurado</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {quotationData.teamMembers.map((member, index) => {
                const role = availableRoles?.find((r: any) => r.id === member.roleId);
                return (
                  <div key={member.id || index} className="flex justify-between items-center text-sm">
                    <span className="font-medium">{role?.name || 'Rol desconocido'}</span>
                    <span className="text-gray-600">{member.hoursPerWeek}h × ${member.totalCost}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t text-sm text-gray-600">
              Los factores de complejidad se aplicarán a las horas según el tipo de rol
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Metodología/Complejidad */}
        {analysisTypes.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center">
                <TrendingUp className="h-4 w-4 mr-2 text-blue-600" />
                Metodología
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={quotationData.analysisType} onValueChange={updateAnalysisType}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar metodología" />
                </SelectTrigger>
                <SelectContent>
                  {analysisTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-gray-500">
                Factor: +{(complexityFactors?.analysisTypeFactor || 0).toFixed(1)}%
              </div>
            </CardContent>
          </Card>
        )}

        {/* Volumen de Menciones */}
        {mentionsVolumeOptions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center">
                <MessageSquare className="h-4 w-4 mr-2 text-green-600" />
                Volumen de Menciones
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={quotationData.mentionsVolume} onValueChange={updateMentionsVolume}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar volumen" />
                </SelectTrigger>
                <SelectContent>
                  {mentionsVolumeOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-gray-500">
                Factor: +{(complexityFactors?.mentionsVolumeFactor || 0).toFixed(1)}%
              </div>
            </CardContent>
          </Card>
        )}

        {/* Países Cubiertos */}
        {countriesOptions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center">
                <Globe className="h-4 w-4 mr-2 text-purple-600" />
                Países Cubiertos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={quotationData.countriesCovered} onValueChange={updateCountriesCovered}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar países" />
                </SelectTrigger>
                <SelectContent>
                  {countriesOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-gray-500">
                Factor: +{(complexityFactors?.countriesFactor || 0).toFixed(1)}%
              </div>
            </CardContent>
          </Card>
        )}

        {/* Urgencia/Interacción - Solo mostrar si existen opciones */}
        {urgencyOptions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center">
                <Users className="h-4 w-4 mr-2 text-orange-600" />
                Urgencia/Interacción
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={quotationData.clientEngagement} onValueChange={updateClientEngagement}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar nivel" />
                </SelectTrigger>
                <SelectContent>
                  {urgencyOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-gray-500">
                Factor: +{(complexityFactors?.clientEngagementFactor || 0).toFixed(1)}%
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Impacto por Tipo de Rol */}
      {complexityFactors && (
        <Card className="bg-gray-50">
          <CardContent className="p-4">
            <h4 className="font-medium text-gray-900 mb-3">Impacto por Tipo de Rol</h4>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                <div>
                  <span className="font-medium text-blue-900">Roles de Análisis</span>
                  <div className="text-xs text-blue-700">Analistas, Especialistas, Tech Leads</div>
                </div>
                <div className="text-blue-900 font-mono">
                  +{totalFactor.toFixed(1)}%
                </div>
              </div>
              
              <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                <div>
                  <span className="font-medium text-green-900">Roles de Gestión</span>
                  <div className="text-xs text-green-700">Managers, Directores, Account</div>
                </div>
                <div className="text-green-900 font-mono">
                  +{(totalFactor * 0.5).toFixed(1)}%
                </div>
              </div>
              
              <div className="flex items-center justify-between p-2 bg-purple-50 rounded">
                <div>
                  <span className="font-medium text-purple-900">Otros Roles</span>
                  <div className="text-xs text-purple-700">Soporte, Admin, QA</div>
                </div>
                <div className="text-purple-900 font-mono">
                  +{(totalFactor * 0.25).toFixed(1)}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ComplexityFactorsCard;