import React, { useEffect } from "react";
import { useOptimizedQuote } from "@/context/optimized-quote-context";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <div className="pb-16">
      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Tipo de Análisis</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup 
            value={quotationData.analysisType || 'standard'} 
            onValueChange={updateAnalysisType}
            className="grid grid-cols-3 gap-2"
          >
            <div className="border rounded-md p-2 flex space-x-2">
              <RadioGroupItem value="basic" id="analysis-basic" />
              <Label htmlFor="analysis-basic" className="cursor-pointer">
                <div className="font-medium">Básico</div>
                <div className="text-xs text-muted-foreground">+0%</div>
              </Label>
            </div>
            <div className="border rounded-md p-2 flex space-x-2">
              <RadioGroupItem value="standard" id="analysis-standard" />
              <Label htmlFor="analysis-standard" className="cursor-pointer">
                <div className="font-medium">Estándar</div>
                <div className="text-xs text-muted-foreground">+10%</div>
              </Label>
            </div>
            <div className="border rounded-md p-2 flex space-x-2">
              <RadioGroupItem value="advanced" id="analysis-advanced" />
              <Label htmlFor="analysis-advanced" className="cursor-pointer">
                <div className="font-medium">Avanzado</div>
                <div className="text-xs text-muted-foreground">+15%</div>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Volumen de Menciones</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup 
            value={quotationData.mentionsVolume || 'medium'} 
            onValueChange={updateMentionsVolume}
            className="grid grid-cols-2 gap-2"
          >
            <div className="border rounded-md p-2 flex space-x-2">
              <RadioGroupItem value="small" id="volume-small" />
              <Label htmlFor="volume-small" className="cursor-pointer">
                <div className="font-medium">Pequeño</div>
                <div className="text-xs text-muted-foreground">Menos de 1,000</div>
              </Label>
            </div>
            <div className="border rounded-md p-2 flex space-x-2">
              <RadioGroupItem value="medium" id="volume-medium" />
              <Label htmlFor="volume-medium" className="cursor-pointer">
                <div className="font-medium">Medio</div>
                <div className="text-xs text-muted-foreground">1,000-10,000</div>
              </Label>
            </div>
            <div className="border rounded-md p-2 flex space-x-2">
              <RadioGroupItem value="large" id="volume-large" />
              <Label htmlFor="volume-large" className="cursor-pointer">
                <div className="font-medium">Grande</div>
                <div className="text-xs text-muted-foreground">10,000-50,000</div>
              </Label>
            </div>
            <div className="border rounded-md p-2 flex space-x-2">
              <RadioGroupItem value="xlarge" id="volume-xlarge" />
              <Label htmlFor="volume-xlarge" className="cursor-pointer">
                <div className="font-medium">Extra grande</div>
                <div className="text-xs text-muted-foreground">Más de 50,000</div>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Países Cubiertos</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup 
            value={quotationData.countriesCovered || '1'} 
            onValueChange={updateCountriesCovered}
            className="grid grid-cols-2 gap-2"
          >
            <div className="border rounded-md p-2 flex space-x-2">
              <RadioGroupItem value="1" id="countries-1" />
              <Label htmlFor="countries-1" className="cursor-pointer">
                <div className="font-medium">1 país</div>
                <div className="text-xs text-muted-foreground">+0%</div>
              </Label>
            </div>
            <div className="border rounded-md p-2 flex space-x-2">
              <RadioGroupItem value="2-5" id="countries-2-5" />
              <Label htmlFor="countries-2-5" className="cursor-pointer">
                <div className="font-medium">2-5 países</div>
                <div className="text-xs text-muted-foreground">+5%</div>
              </Label>
            </div>
            <div className="border rounded-md p-2 flex space-x-2">
              <RadioGroupItem value="6-10" id="countries-6-10" />
              <Label htmlFor="countries-6-10" className="cursor-pointer">
                <div className="font-medium">6-10 países</div>
                <div className="text-xs text-muted-foreground">+15%</div>
              </Label>
            </div>
            <div className="border rounded-md p-2 flex space-x-2">
              <RadioGroupItem value="10+" id="countries-10+" />
              <Label htmlFor="countries-10+" className="cursor-pointer">
                <div className="font-medium">Más de 10</div>
                <div className="text-xs text-muted-foreground">+25%</div>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Interacción con Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup 
            value={quotationData.clientEngagement || 'medium'} 
            onValueChange={updateClientEngagement}
            className="grid grid-cols-3 gap-2"
          >
            <div className="border rounded-md p-2 flex space-x-2">
              <RadioGroupItem value="low" id="engagement-low" />
              <Label htmlFor="engagement-low" className="cursor-pointer">
                <div className="font-medium">Bajo</div>
                <div className="text-xs text-muted-foreground">+0%</div>
              </Label>
            </div>
            <div className="border rounded-md p-2 flex space-x-2">
              <RadioGroupItem value="medium" id="engagement-medium" />
              <Label htmlFor="engagement-medium" className="cursor-pointer">
                <div className="font-medium">Medio</div>
                <div className="text-xs text-muted-foreground">+5%</div>
              </Label>
            </div>
            <div className="border rounded-md p-2 flex space-x-2">
              <RadioGroupItem value="high" id="engagement-high" />
              <Label htmlFor="engagement-high" className="cursor-pointer">
                <div className="font-medium">Alto</div>
                <div className="text-xs text-muted-foreground">+15%</div>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Complejidad del Proyecto</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup 
            value={quotationData.complexity || 'medium'} 
            onValueChange={updateComplexity}
            className="grid grid-cols-3 gap-2"
          >
            <div className="border rounded-md p-2 flex space-x-2">
              <RadioGroupItem value="low" id="complexity-low" />
              <Label htmlFor="complexity-low" className="cursor-pointer">
                <div className="font-medium">Baja</div>
                <div className="text-xs text-muted-foreground">+0%</div>
              </Label>
            </div>
            <div className="border rounded-md p-2 flex space-x-2">
              <RadioGroupItem value="medium" id="complexity-medium" />
              <Label htmlFor="complexity-medium" className="cursor-pointer">
                <div className="font-medium">Media</div>
                <div className="text-xs text-muted-foreground">+10%</div>
              </Label>
            </div>
            <div className="border rounded-md p-2 flex space-x-2">
              <RadioGroupItem value="high" id="complexity-high" />
              <Label htmlFor="complexity-high" className="cursor-pointer">
                <div className="font-medium">Alta</div>
                <div className="text-xs text-muted-foreground">+20%</div>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>
    </div>
  );
};
