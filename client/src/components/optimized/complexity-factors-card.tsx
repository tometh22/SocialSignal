import React from 'react';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Users, Globe, MessageSquare } from 'lucide-react';

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

  const analysisTypes = [
    { value: 'basic', label: 'Análisis Básico' },
    { value: 'standard', label: 'Análisis Estándar' },
    { value: 'deep', label: 'Análisis Avanzado' }
  ];

  const mentionsVolumeOptions = [
    { value: 'small', label: 'Pequeño (< 1K menciones)' },
    { value: 'medium', label: 'Medio (1K - 10K menciones)' },
    { value: 'large', label: 'Grande (10K - 100K menciones)' },
    { value: 'xlarge', label: 'Extra Grande (> 100K menciones)' }
  ];

  const countriesOptions = [
    { value: '1', label: '1 país' },
    { value: '2-5', label: '2-5 países' },
    { value: '6-10', label: '6-10 países' },
    { value: '10+', label: 'Más de 10 países' }
  ];

  const engagementOptions = [
    { value: 'low', label: 'Bajo' },
    { value: 'medium', label: 'Medio' },
    { value: 'high', label: 'Alto' }
  ];

  const getTotalComplexityFactor = (): number => {
    if (!complexityFactors) return 0;
    return Object.values(complexityFactors).reduce((sum: number, factor: any) => sum + (factor || 0), 0);
  };

  const getComplexityLevel = (factor: number) => {
    if (factor < 0.1) return { level: 'Bajo', color: 'bg-green-100 text-green-800' };
    if (factor < 0.3) return { level: 'Medio', color: 'bg-yellow-100 text-yellow-800' };
    if (factor < 0.5) return { level: 'Alto', color: 'bg-orange-100 text-orange-800' };
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
          Factor Total: {(totalFactor * 100).toFixed(1)}% - {complexityLevel.level}
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
        {/* Tipo de Análisis */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <TrendingUp className="h-4 w-4 mr-2 text-blue-600" />
              Tipo de Análisis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={quotationData.analysisType} onValueChange={updateAnalysisType}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo de análisis" />
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
              Factor: +{((complexityFactors?.analysisTypeFactor || 0) * 100).toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        {/* Volumen de Menciones */}
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
              Factor: +{((complexityFactors?.mentionsVolumeFactor || 0) * 100).toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        {/* Países Cubiertos */}
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
              Factor: +{((complexityFactors?.countriesFactor || 0) * 100).toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        {/* Compromiso del Cliente */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <Users className="h-4 w-4 mr-2 text-orange-600" />
              Compromiso del Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={quotationData.clientEngagement} onValueChange={updateClientEngagement}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar nivel" />
              </SelectTrigger>
              <SelectContent>
                {engagementOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-gray-500">
              Factor: +{((complexityFactors?.clientEngagementFactor || 0) * 100).toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Impacto por Tipo de Rol */}
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
                +{((complexityFactors.analysisTypeFactor + complexityFactors.mentionsVolumeFactor + complexityFactors.countriesFactor) * 100).toFixed(1)}%
              </div>
            </div>
            
            <div className="flex items-center justify-between p-2 bg-green-50 rounded">
              <div>
                <span className="font-medium text-green-900">Roles de Gestión</span>
                <div className="text-xs text-green-700">Managers, Directores, Account</div>
              </div>
              <div className="text-green-900 font-mono">
                +{((complexityFactors.clientEngagementFactor + complexityFactors.analysisTypeFactor * 0.5) * 100).toFixed(1)}%
              </div>
            </div>
            
            <div className="flex items-center justify-between p-2 bg-purple-50 rounded">
              <div>
                <span className="font-medium text-purple-900">Otros Roles</span>
                <div className="text-xs text-purple-700">Diseñadores, etc.</div>
              </div>
              <div className="text-purple-900 font-mono">
                +{(complexityFactors.analysisTypeFactor * 0.3 * 100).toFixed(1)}%
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">Factor Promedio Ponderado</span>
              <span className="text-xl font-bold text-primary">+{(totalFactor * 100).toFixed(1)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ComplexityFactorsCard;