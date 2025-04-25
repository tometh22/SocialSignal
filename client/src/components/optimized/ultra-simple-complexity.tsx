import React, { useEffect } from "react";
import { useOptimizedQuote } from "@/context/optimized-quote-context";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

export const DirectComplexitySelection: React.FC = () => {
  const { 
    quotationData, 
    updateAnalysisType,
    updateMentionsVolume,
    updateCountriesCovered,
    updateClientEngagement,
    updateComplexity,
    updateTemplate
  } = useOptimizedQuote();

  // Establecer plantilla nula y valores predeterminados al cargar
  useEffect(() => {
    updateTemplate(null);
    updateAnalysisType(quotationData.analysisType || 'standard');
    updateMentionsVolume(quotationData.mentionsVolume || 'medium');
    updateCountriesCovered(quotationData.countriesCovered || '1');
    updateClientEngagement(quotationData.clientEngagement || 'medium');
    updateComplexity(quotationData.complexity || 'medium');
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24">
      <Card className="border mb-4">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">Tipo de Análisis</h3>
          <RadioGroup 
            value={quotationData.analysisType || 'standard'} 
            onValueChange={updateAnalysisType}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <div className="border rounded-md p-4 flex items-start space-x-2">
              <RadioGroupItem value="basic" id="analysis-basic" className="mt-1" />
              <Label htmlFor="analysis-basic" className="cursor-pointer">
                <div className="font-medium">Básico</div>
                <div className="text-sm text-neutral-500">Sin profundidad</div>
                <div className="text-sm text-blue-600 mt-1">+0%</div>
              </Label>
            </div>
            <div className="border rounded-md p-4 flex items-start space-x-2">
              <RadioGroupItem value="standard" id="analysis-standard" className="mt-1" />
              <Label htmlFor="analysis-standard" className="cursor-pointer">
                <div className="font-medium">Estándar</div>
                <div className="text-sm text-neutral-500">Métricas completas</div>
                <div className="text-sm text-blue-600 mt-1">+10%</div>
              </Label>
            </div>
            <div className="border rounded-md p-4 flex items-start space-x-2">
              <RadioGroupItem value="advanced" id="analysis-advanced" className="mt-1" />
              <Label htmlFor="analysis-advanced" className="cursor-pointer">
                <div className="font-medium">Avanzado</div>
                <div className="text-sm text-neutral-500">Metodologías especiales</div>
                <div className="text-sm text-blue-600 mt-1">+15%</div>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card className="border mb-4">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">Volumen de Menciones</h3>
          <RadioGroup 
            value={quotationData.mentionsVolume || 'medium'} 
            onValueChange={updateMentionsVolume}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div className="border rounded-md p-4 flex items-start space-x-2">
              <RadioGroupItem value="small" id="volume-small" className="mt-1" />
              <Label htmlFor="volume-small" className="cursor-pointer">
                <div className="font-medium">Pequeño</div>
                <div className="text-sm text-neutral-500">Menos de 1,000</div>
                <div className="text-sm text-amber-600 mt-1">+0%</div>
              </Label>
            </div>
            <div className="border rounded-md p-4 flex items-start space-x-2">
              <RadioGroupItem value="medium" id="volume-medium" className="mt-1" />
              <Label htmlFor="volume-medium" className="cursor-pointer">
                <div className="font-medium">Medio</div>
                <div className="text-sm text-neutral-500">1,000-10,000</div>
                <div className="text-sm text-amber-600 mt-1">+10%</div>
              </Label>
            </div>
            <div className="border rounded-md p-4 flex items-start space-x-2">
              <RadioGroupItem value="large" id="volume-large" className="mt-1" />
              <Label htmlFor="volume-large" className="cursor-pointer">
                <div className="font-medium">Grande</div>
                <div className="text-sm text-neutral-500">10,000-50,000</div>
                <div className="text-sm text-amber-600 mt-1">+20%</div>
              </Label>
            </div>
            <div className="border rounded-md p-4 flex items-start space-x-2">
              <RadioGroupItem value="xlarge" id="volume-xlarge" className="mt-1" />
              <Label htmlFor="volume-xlarge" className="cursor-pointer">
                <div className="font-medium">Extra grande</div>
                <div className="text-sm text-neutral-500">Más de 50,000</div>
                <div className="text-sm text-amber-600 mt-1">+30%</div>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card className="border mb-4">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">Países Cubiertos</h3>
          <RadioGroup 
            value={quotationData.countriesCovered || '1'} 
            onValueChange={updateCountriesCovered}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div className="border rounded-md p-4 flex items-start space-x-2">
              <RadioGroupItem value="1" id="countries-1" className="mt-1" />
              <Label htmlFor="countries-1" className="cursor-pointer">
                <div className="font-medium">1 país</div>
                <div className="text-sm text-neutral-500">Un solo país</div>
                <div className="text-sm text-green-600 mt-1">+0%</div>
              </Label>
            </div>
            <div className="border rounded-md p-4 flex items-start space-x-2">
              <RadioGroupItem value="2-5" id="countries-2-5" className="mt-1" />
              <Label htmlFor="countries-2-5" className="cursor-pointer">
                <div className="font-medium">2-5 países</div>
                <div className="text-sm text-neutral-500">Regional limitada</div>
                <div className="text-sm text-green-600 mt-1">+5%</div>
              </Label>
            </div>
            <div className="border rounded-md p-4 flex items-start space-x-2">
              <RadioGroupItem value="6-10" id="countries-6-10" className="mt-1" />
              <Label htmlFor="countries-6-10" className="cursor-pointer">
                <div className="font-medium">6-10 países</div>
                <div className="text-sm text-neutral-500">Regional amplia</div>
                <div className="text-sm text-green-600 mt-1">+15%</div>
              </Label>
            </div>
            <div className="border rounded-md p-4 flex items-start space-x-2">
              <RadioGroupItem value="10+" id="countries-10+" className="mt-1" />
              <Label htmlFor="countries-10+" className="cursor-pointer">
                <div className="font-medium">Más de 10</div>
                <div className="text-sm text-neutral-500">Cobertura global</div>
                <div className="text-sm text-green-600 mt-1">+25%</div>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card className="border mb-4">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">Nivel de Interacción con el Cliente</h3>
          <RadioGroup 
            value={quotationData.clientEngagement || 'medium'} 
            onValueChange={updateClientEngagement}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <div className="border rounded-md p-4 flex items-start space-x-2">
              <RadioGroupItem value="low" id="engagement-low" className="mt-1" />
              <Label htmlFor="engagement-low" className="cursor-pointer">
                <div className="font-medium">Bajo</div>
                <div className="text-sm text-neutral-500">Informe final</div>
                <div className="text-sm text-purple-600 mt-1">+0%</div>
              </Label>
            </div>
            <div className="border rounded-md p-4 flex items-start space-x-2">
              <RadioGroupItem value="medium" id="engagement-medium" className="mt-1" />
              <Label htmlFor="engagement-medium" className="cursor-pointer">
                <div className="font-medium">Medio</div>
                <div className="text-sm text-neutral-500">Reunión inicial y final</div>
                <div className="text-sm text-purple-600 mt-1">+5%</div>
              </Label>
            </div>
            <div className="border rounded-md p-4 flex items-start space-x-2">
              <RadioGroupItem value="high" id="engagement-high" className="mt-1" />
              <Label htmlFor="engagement-high" className="cursor-pointer">
                <div className="font-medium">Alto</div>
                <div className="text-sm text-neutral-500">Reuniones semanales</div>
                <div className="text-sm text-purple-600 mt-1">+15%</div>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card className="border mb-4">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">Nivel de Complejidad del Proyecto</h3>
          <RadioGroup 
            value={quotationData.complexity || 'medium'} 
            onValueChange={updateComplexity}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <div className="border rounded-md p-4 flex items-start space-x-2">
              <RadioGroupItem value="low" id="complexity-low" className="mt-1" />
              <Label htmlFor="complexity-low" className="cursor-pointer">
                <div className="font-medium">Baja</div>
                <div className="text-sm text-neutral-500">Proyecto simple con requisitos estándar</div>
                <div className="text-sm text-indigo-600 mt-1">+0%</div>
              </Label>
            </div>
            <div className="border rounded-md p-4 flex items-start space-x-2">
              <RadioGroupItem value="medium" id="complexity-medium" className="mt-1" />
              <Label htmlFor="complexity-medium" className="cursor-pointer">
                <div className="font-medium">Media</div>
                <div className="text-sm text-neutral-500">Proyecto complejo con algunos requisitos específicos</div>
                <div className="text-sm text-indigo-600 mt-1">+10%</div>
              </Label>
            </div>
            <div className="border rounded-md p-4 flex items-start space-x-2">
              <RadioGroupItem value="high" id="complexity-high" className="mt-1" />
              <Label htmlFor="complexity-high" className="cursor-pointer">
                <div className="font-medium">Alta</div>
                <div className="text-sm text-neutral-500">Proyecto muy complejo con requisitos específicos</div>
                <div className="text-sm text-indigo-600 mt-1">+20%</div>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>
    </div>
  );
};
