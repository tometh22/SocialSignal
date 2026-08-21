import React from 'react';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Globe, MessageSquare } from 'lucide-react';

type ComplexityFactorsCardProps = {
  validationMessage?: string;
};

const ComplexityFactorsCard: React.FC<ComplexityFactorsCardProps> = ({ validationMessage }) => {
  const {
    quotationData,
    updateMentionsVolume,
    updateCountriesCovered,
    complexityFactors,
    availableRoles,
    pricingResult,
  } = useOptimizedQuote();

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
  const currency = quotationData.quotationCurrency === 'USD' ? 'USD' : 'ARS';
  const formattedImpact = new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'USD' ? 2 : 0,
  }).format(pricingResult.display.complexityAdjustment || 0);

  return (
    <div id="complexity-config" className="space-y-6" tabIndex={-1}>
      {validationMessage && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {validationMessage}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Escala del alcance</h3>
          <p className="text-sm text-gray-600">El costo se ajusta únicamente por volumen y cobertura; la profundidad analítica ya está incluida en la receta.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge className={complexityLevel.color}>
            +{(totalFactor * 100).toFixed(1)}% · {complexityLevel.level}
          </Badge>
          <span className="text-xs font-medium text-slate-600">Impacto estimado: +{formattedImpact}</span>
        </div>
      </div>

      {/* Resumen del equipo configurado */}
      {quotationData.teamMembers.length > 0 && (
        <Card className="bg-blue-50">
          <CardContent className="p-4">
            <h4 className="font-medium text-gray-900 mb-3">Equipo Configurado</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {quotationData.teamMembers.map((member, index) => {
                const role = availableRoles.find((r: any) => r.id === member.roleId);
                return (
                  <div key={member.id || index} className="flex justify-between items-center text-sm">
                    <span className="font-medium">{role?.name || 'Rol desconocido'}</span>
                    <span className="text-gray-600">{member.hours}h × ${member.rate}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t text-sm text-gray-600">
              Los factores de complejidad se aplican de forma uniforme sobre el costo base
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              <SelectTrigger aria-label="Volumen de menciones">
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
              <SelectTrigger aria-label="Países cubiertos">
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

      </div>
    </div>
  );
};

export default ComplexityFactorsCard;
