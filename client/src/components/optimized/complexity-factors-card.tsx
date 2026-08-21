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
    if (factor < 0.1) return { level: 'Bajo', color: 'bg-emerald-100 text-emerald-800' };
    if (factor < 0.3) return { level: 'Medio', color: 'bg-amber-100 text-amber-800' };
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
          <h3 className="text-lg font-semibold text-slate-950">Escala del alcance</h3>
          <p className="text-sm text-slate-500">El costo se ajusta únicamente por volumen y cobertura; la profundidad analítica ya está incluida en la receta.</p>
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
        <Card className="border-slate-200 shadow-none">
          <CardContent className="p-4">
            <h4 className="mb-3 font-medium text-slate-950">Equipo configurado</h4>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {quotationData.teamMembers.map((member, index) => {
                const role = availableRoles.find((r: any) => r.id === member.roleId);
                return (
                  <div key={member.id || index} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-900">{role?.name || 'Rol desconocido'}</span>
                    <span className="text-slate-500">{member.hours}h × ${member.rate}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 border-t border-slate-200 pt-3 text-sm text-slate-500">
              Los factores de complejidad se aplican de forma uniforme sobre el costo base
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Volumen de Menciones */}
        <Card className="border-slate-200 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-sm font-medium text-slate-950">
              <MessageSquare className="mr-2 h-4 w-4 text-indigo-600" />
              Volumen de menciones
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
            <div className="text-xs text-slate-500">
              Factor: +{(complexityFactors.mentionsVolumeFactor * 100).toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        {/* Países Cubiertos */}
        <Card className="border-slate-200 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-sm font-medium text-slate-950">
              <Globe className="mr-2 h-4 w-4 text-indigo-600" />
              Países cubiertos
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
            <div className="text-xs text-slate-500">
              Factor: +{(complexityFactors.countriesFactor * 100).toFixed(1)}%
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default ComplexityFactorsCard;
