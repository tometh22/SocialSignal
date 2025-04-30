import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useOptimizedQuote } from "@/context/optimized-quote-context";

interface ComplexityFactorsCardProps {
  analysisType: string;
  mentionsVolume: string;
  countriesCovered: string;
  clientEngagement: string;
}

export function ComplexityFactorsCard({
  analysisType,
  mentionsVolume,
  countriesCovered,
  clientEngagement
}: ComplexityFactorsCardProps) {
  const { 
    updateAnalysisType, 
    updateMentionsVolume, 
    updateCountriesCovered, 
    updateClientEngagement 
  } = useOptimizedQuote();

  return (
    <Card className="mb-6" id="factores-complejidad">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center">
          <span className="text-primary mr-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1v3M2 7h20M5.3 17h13.4"></path>
              <path d="M8 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"></path>
              <path d="M16 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"></path>
              <path d="M8 12v7"></path>
              <path d="M16 12v7"></path>
              <path d="M7 17h10"></path>
            </svg>
          </span>
          Factores de Complejidad
        </CardTitle>
        <CardDescription>Selecciona los factores para calcular el precio final</CardDescription>
      </CardHeader>
      <CardContent className="pb-0">
        <div className="max-h-[550px] overflow-y-auto pr-2">
          {/* Tipo de análisis */}
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="font-medium text-blue-800 flex items-center">
                <span className="bg-blue-100 p-1 rounded-full mr-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-700">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                  </svg>
                </span>
                Tipo de Análisis *
              </Label>
              <RadioGroup 
                value={analysisType || 'standard'} 
                onValueChange={(value) => updateAnalysisType(value)}
                className="grid grid-cols-1 sm:grid-cols-3 gap-2"
              >
                <div className="flex items-center rounded-md border p-2 cursor-pointer hover:bg-blue-50 transition-colors">
                  <RadioGroupItem value="basic" id="analysis-basic" className="mr-2" />
                  <Label htmlFor="analysis-basic" className="cursor-pointer text-sm">
                    <div className="font-medium">Básico</div>
                    <div className="text-xs text-neutral-500">Sin profundidad</div>
                    <div className="text-xs text-blue-600 mt-1">+0%</div>
                  </Label>
                </div>
                <div className="flex items-center rounded-md border p-2 cursor-pointer hover:bg-blue-50 transition-colors">
                  <RadioGroupItem value="standard" id="analysis-standard" className="mr-2" />
                  <Label htmlFor="analysis-standard" className="cursor-pointer text-sm">
                    <div className="font-medium">Estándar</div>
                    <div className="text-xs text-neutral-500">Métricas completas</div>
                    <div className="text-xs text-blue-600 mt-1">+10%</div>
                  </Label>
                </div>
                <div className="flex items-center rounded-md border p-2 cursor-pointer hover:bg-blue-50 transition-colors">
                  <RadioGroupItem value="deep" id="analysis-deep" className="mr-2" />
                  <Label htmlFor="analysis-deep" className="cursor-pointer text-sm">
                    <div className="font-medium">Avanzado</div>
                    <div className="text-xs text-neutral-500">Metodologías especiales</div>
                    <div className="text-xs text-blue-600 mt-1">+15%</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>
            
            {/* Volumen de menciones */}
            <div className="space-y-2">
              <Label className="font-medium text-indigo-800 flex items-center">
                <span className="bg-indigo-100 p-1 rounded-full mr-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-700">
                    <path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973"></path>
                    <path d="m13 12-3 5h4l-3 5"></path>
                  </svg>
                </span>
                Volumen de Menciones *
              </Label>
              <RadioGroup 
                value={mentionsVolume || 'medium'} 
                onValueChange={(value) => updateMentionsVolume(value)}
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2"
              >
                <div className="flex items-center rounded-md border p-2 cursor-pointer hover:bg-indigo-50 transition-colors">
                  <RadioGroupItem value="small" id="volume-small" className="mr-2" />
                  <Label htmlFor="volume-small" className="cursor-pointer text-sm">
                    <div className="font-medium">Pequeño</div>
                    <div className="text-xs text-neutral-500">Menos de 1,000</div>
                    <div className="text-xs text-indigo-600 mt-1">+0%</div>
                  </Label>
                </div>
                <div className="flex items-center rounded-md border p-2 cursor-pointer hover:bg-indigo-50 transition-colors">
                  <RadioGroupItem value="medium" id="volume-medium" className="mr-2" />
                  <Label htmlFor="volume-medium" className="cursor-pointer text-sm">
                    <div className="font-medium">Medio</div>
                    <div className="text-xs text-neutral-500">1,000-10,000</div>
                    <div className="text-xs text-indigo-600 mt-1">+10%</div>
                  </Label>
                </div>
                <div className="flex items-center rounded-md border p-2 cursor-pointer hover:bg-indigo-50 transition-colors">
                  <RadioGroupItem value="large" id="volume-large" className="mr-2" />
                  <Label htmlFor="volume-large" className="cursor-pointer text-sm">
                    <div className="font-medium">Grande</div>
                    <div className="text-xs text-neutral-500">10,000-50,000</div>
                    <div className="text-xs text-indigo-600 mt-1">+20%</div>
                  </Label>
                </div>
                <div className="flex items-center rounded-md border p-2 cursor-pointer hover:bg-indigo-50 transition-colors">
                  <RadioGroupItem value="xlarge" id="volume-xlarge" className="mr-2" />
                  <Label htmlFor="volume-xlarge" className="cursor-pointer text-sm">
                    <div className="font-medium">Extra grande</div>
                    <div className="text-xs text-neutral-500">Más de 50,000</div>
                    <div className="text-xs text-indigo-600 mt-1">+30%</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>
            
            {/* Países cubiertos */}
            <div className="space-y-2">
              <Label className="font-medium text-green-800 flex items-center">
                <span className="bg-green-100 p-1 rounded-full mr-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-700">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                  </svg>
                </span>
                Países Cubiertos *
              </Label>
              <RadioGroup 
                value={countriesCovered || '1'} 
                onValueChange={(value) => updateCountriesCovered(value)}
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2"
              >
                <div className="flex items-center rounded-md border p-2 cursor-pointer hover:bg-green-50 transition-colors">
                  <RadioGroupItem value="1" id="countries-1" className="mr-2" />
                  <Label htmlFor="countries-1" className="cursor-pointer text-sm">
                    <div className="font-medium">1 país</div>
                    <div className="text-xs text-neutral-500">Un solo país</div>
                    <div className="text-xs text-green-600 mt-1">+0%</div>
                  </Label>
                </div>
                <div className="flex items-center rounded-md border p-2 cursor-pointer hover:bg-green-50 transition-colors">
                  <RadioGroupItem value="2-5" id="countries-2-5" className="mr-2" />
                  <Label htmlFor="countries-2-5" className="cursor-pointer text-sm">
                    <div className="font-medium">2-5 países</div>
                    <div className="text-xs text-neutral-500">Regional limitada</div>
                    <div className="text-xs text-green-600 mt-1">+5%</div>
                  </Label>
                </div>
                <div className="flex items-center rounded-md border p-2 cursor-pointer hover:bg-green-50 transition-colors">
                  <RadioGroupItem value="6-10" id="countries-6-10" className="mr-2" />
                  <Label htmlFor="countries-6-10" className="cursor-pointer text-sm">
                    <div className="font-medium">6-10 países</div>
                    <div className="text-xs text-neutral-500">Regional amplia</div>
                    <div className="text-xs text-green-600 mt-1">+15%</div>
                  </Label>
                </div>
                <div className="flex items-center rounded-md border p-2 cursor-pointer hover:bg-green-50 transition-colors">
                  <RadioGroupItem value="10+" id="countries-10+" className="mr-2" />
                  <Label htmlFor="countries-10+" className="cursor-pointer text-sm">
                    <div className="font-medium">Más de 10</div>
                    <div className="text-xs text-neutral-500">Cobertura global</div>
                    <div className="text-xs text-green-600 mt-1">+25%</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>
            
            {/* Nivel de interacción con el cliente */}
            <div className="space-y-2">
              <Label className="font-medium text-purple-800 flex items-center">
                <span className="bg-purple-100 p-1 rounded-full mr-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-700">
                    <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z"></path>
                    <path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"></path>
                  </svg>
                </span>
                Nivel de Interacción con el Cliente *
              </Label>
              <RadioGroup 
                value={clientEngagement || 'medium'} 
                onValueChange={(value) => updateClientEngagement(value)}
                className="grid grid-cols-1 sm:grid-cols-3 gap-2"
              >
                <div className="flex items-center rounded-md border p-2 cursor-pointer hover:bg-purple-50 transition-colors">
                  <RadioGroupItem value="low" id="engagement-low" className="mr-2" />
                  <Label htmlFor="engagement-low" className="cursor-pointer text-sm">
                    <div className="font-medium">Bajo</div>
                    <div className="text-xs text-neutral-500">Informe final</div>
                    <div className="text-xs text-purple-600 mt-1">+0%</div>
                  </Label>
                </div>
                <div className="flex items-center rounded-md border p-2 cursor-pointer hover:bg-purple-50 transition-colors">
                  <RadioGroupItem value="medium" id="engagement-medium" className="mr-2" />
                  <Label htmlFor="engagement-medium" className="cursor-pointer text-sm">
                    <div className="font-medium">Medio</div>
                    <div className="text-xs text-neutral-500">Reunión inicial y final</div>
                    <div className="text-xs text-purple-600 mt-1">+5%</div>
                  </Label>
                </div>
                <div className="flex items-center rounded-md border p-2 cursor-pointer hover:bg-purple-50 transition-colors">
                  <RadioGroupItem value="high" id="engagement-high" className="mr-2" />
                  <Label htmlFor="engagement-high" className="cursor-pointer text-sm">
                    <div className="font-medium">Alto</div>
                    <div className="text-xs text-neutral-500">Reuniones semanales</div>
                    <div className="text-xs text-purple-600 mt-1">+15%</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>
            
            <div className="py-2 text-xs text-neutral-500 flex items-center border-t mt-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1 text-neutral-400">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 16v-4"></path>
                <path d="M12 8h.01"></path>
              </svg>
              Los cambios se aplican automáticamente al precio al seleccionar una opción.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}