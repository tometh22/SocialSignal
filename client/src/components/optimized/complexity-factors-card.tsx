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
    complexityFactors
  } = useOptimizedQuote();

  const analysisTypes = [
    { value: 'basic', label: 'Análisis Básico' },
    { value: 'standard', label: 'Análisis Estándar' },
    { value: 'advanced', label: 'Análisis Avanzado' },
    { value: 'premium', label: 'Análisis Premium' }
  ];

  const mentionsVolumeOptions = [
    { value: 'low', label: 'Bajo (< 1K menciones)' },
    { value: 'medium', label: 'Medio (1K - 10K menciones)' },
    { value: 'high', label: 'Alto (10K - 100K menciones)' },
    { value: 'very-high', label: 'Muy Alto (> 100K menciones)' }
  ];

  const countriesOptions = [
    { value: '1', label: '1 país' },
    { value: '2-3', label: '2-3 países' },
    { value: '4-6', label: '4-6 países' },
    { value: '7+', label: '7+ países' }
  ];

  const engagementOptions = [
    { value: 'low', label: 'Bajo' },
    { value: 'medium', label: 'Medio' },
    { value: 'high', label: 'Alto' },
    { value: 'very-high', label: 'Muy Alto' }
  ];

  const getTotalComplexityFactor = () => {
    return Object.values(complexityFactors).reduce((sum, factor) => sum + (factor || 0), 0);
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
          <p className="text-sm text-gray-600">Define las características del proyecto para calcular la complejidad</p>
        </div>
        <Badge className={complexityLevel.color}>
          Factor Total: {(totalFactor * 100).toFixed(1)}% - {complexityLevel.level}
        </Badge>
      </div>

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
              Factor: +{(complexityFactors.analysisTypeFactor * 100).toFixed(1)}%
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
              Factor: +{(complexityFactors.mentionsVolumeFactor * 100).toFixed(1)}%
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
              Factor: +{(complexityFactors.countriesFactor * 100).toFixed(1)}%
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
              Factor: +{(complexityFactors.clientEngagementFactor * 100).toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumen de Complejidad */}
      <Card className="bg-gray-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Resumen de Complejidad</h4>
              <p className="text-sm text-gray-600">
                Los factores seleccionados afectarán las horas del equipo según sus roles
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">
                +{(totalFactor * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500">Factor total</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ComplexityFactorsCard;