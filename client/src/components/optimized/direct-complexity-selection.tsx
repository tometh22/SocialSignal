import React from "react";
import { useOptimizedQuote } from "@/context/optimized-quote-context";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
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

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-6 text-center">
          Configuración de Complejidad para Presupuesto Personalizado
        </h2>
        
        <p className="text-center mb-6 text-gray-600">
          Configura los factores para calcular el precio final de tu proyecto. 
          Cada selección afecta al multiplicador de precio.
        </p>

        <Accordion type="single" collapsible defaultValue="analysis-type" className="space-y-2">
          {/* Tipo de Análisis */}
          <AccordionItem value="analysis-type" className="border rounded-lg overflow-hidden mb-6">
            <AccordionTrigger className="bg-blue-50 px-4 py-3 hover:bg-blue-100 hover:no-underline">
              <div className="flex items-center">
                <span className="bg-blue-100 p-1 rounded-full mr-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-700">
                    <path d="m21 8-2-2m-9 6 3-3 3 3"></path>
                    <path d="M7 21h10"></path>
                    <path d="M15 21V8"></path>
                    <path d="M7 12h2"></path>
                    <path d="M7 16h2"></path>
                  </svg>
                </span>
                <span className="font-medium">Tipo de Análisis</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pt-4 pb-2">
              <RadioGroup 
                value={quotationData.analysisType || 'standard'} 
                onValueChange={updateAnalysisType}
                className="grid grid-cols-1 md:grid-cols-3 gap-3"
              >
                <div className="flex items-center p-3 border rounded-md hover:bg-blue-50 transition-colors">
                  <RadioGroupItem value="basic" id="analysis-basic" className="mr-2" />
                  <Label htmlFor="analysis-basic" className="cursor-pointer">
                    <div className="font-medium">Básico</div>
                    <div className="text-xs text-neutral-500">Sin profundidad</div>
                    <div className="text-xs text-blue-600 mt-1">+0%</div>
                  </Label>
                </div>
                <div className="flex items-center p-3 border rounded-md hover:bg-blue-50 transition-colors">
                  <RadioGroupItem value="standard" id="analysis-standard" className="mr-2" />
                  <Label htmlFor="analysis-standard" className="cursor-pointer">
                    <div className="font-medium">Estándar</div>
                    <div className="text-xs text-neutral-500">Métricas completas</div>
                    <div className="text-xs text-blue-600 mt-1">+10%</div>
                  </Label>
                </div>
                <div className="flex items-center p-3 border rounded-md hover:bg-blue-50 transition-colors">
                  <RadioGroupItem value="advanced" id="analysis-advanced" className="mr-2" />
                  <Label htmlFor="analysis-advanced" className="cursor-pointer">
                    <div className="font-medium">Avanzado</div>
                    <div className="text-xs text-neutral-500">Metodologías especiales</div>
                    <div className="text-xs text-blue-600 mt-1">+15%</div>
                  </Label>
                </div>
              </RadioGroup>
            </AccordionContent>
          </AccordionItem>

          {/* Volumen de Menciones */}
          <AccordionItem value="mentions-volume" className="border rounded-lg overflow-hidden mb-6">
            <AccordionTrigger className="bg-amber-50 px-4 py-3 hover:bg-amber-100 hover:no-underline">
              <div className="flex items-center">
                <span className="bg-amber-100 p-1 rounded-full mr-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-700">
                    <path d="M7 8a5 5 0 1 1 10 0c0 3.44-3.8 6-5 8"></path>
                    <line x1="12" y1="20" x2="12" y2="20"></line>
                  </svg>
                </span>
                <span className="font-medium">Volumen de Menciones</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pt-4 pb-2">
              <RadioGroup 
                value={quotationData.mentionsVolume || 'medium'} 
                onValueChange={updateMentionsVolume}
                className="grid grid-cols-1 md:grid-cols-4 gap-3"
              >
                <div className="flex items-center p-3 border rounded-md hover:bg-amber-50 transition-colors">
                  <RadioGroupItem value="small" id="volume-small" className="mr-2" />
                  <Label htmlFor="volume-small" className="cursor-pointer">
                    <div className="font-medium">Pequeño</div>
                    <div className="text-xs text-neutral-500">Menos de 1,000</div>
                    <div className="text-xs text-amber-600 mt-1">+0%</div>
                  </Label>
                </div>
                <div className="flex items-center p-3 border rounded-md hover:bg-amber-50 transition-colors">
                  <RadioGroupItem value="medium" id="volume-medium" className="mr-2" />
                  <Label htmlFor="volume-medium" className="cursor-pointer">
                    <div className="font-medium">Medio</div>
                    <div className="text-xs text-neutral-500">1,000-10,000</div>
                    <div className="text-xs text-amber-600 mt-1">+10%</div>
                  </Label>
                </div>
                <div className="flex items-center p-3 border rounded-md hover:bg-amber-50 transition-colors">
                  <RadioGroupItem value="large" id="volume-large" className="mr-2" />
                  <Label htmlFor="volume-large" className="cursor-pointer">
                    <div className="font-medium">Grande</div>
                    <div className="text-xs text-neutral-500">10,000-50,000</div>
                    <div className="text-xs text-amber-600 mt-1">+20%</div>
                  </Label>
                </div>
                <div className="flex items-center p-3 border rounded-md hover:bg-amber-50 transition-colors">
                  <RadioGroupItem value="xlarge" id="volume-xlarge" className="mr-2" />
                  <Label htmlFor="volume-xlarge" className="cursor-pointer">
                    <div className="font-medium">Extra grande</div>
                    <div className="text-xs text-neutral-500">Más de 50,000</div>
                    <div className="text-xs text-amber-600 mt-1">+30%</div>
                  </Label>
                </div>
              </RadioGroup>
            </AccordionContent>
          </AccordionItem>

          {/* Países Cubiertos */}
          <AccordionItem value="countries-covered" className="border rounded-lg overflow-hidden mb-6">
            <AccordionTrigger className="bg-green-50 px-4 py-3 hover:bg-green-100 hover:no-underline">
              <div className="flex items-center">
                <span className="bg-green-100 p-1 rounded-full mr-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-700">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                  </svg>
                </span>
                <span className="font-medium">Países Cubiertos</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pt-4 pb-2">
              <RadioGroup 
                value={quotationData.countriesCovered || '1'} 
                onValueChange={updateCountriesCovered}
                className="grid grid-cols-1 md:grid-cols-2 gap-3"
              >
                <div className="flex items-center p-3 border rounded-md hover:bg-green-50 transition-colors">
                  <RadioGroupItem value="1" id="countries-1" className="mr-2" />
                  <Label htmlFor="countries-1" className="cursor-pointer">
                    <div className="font-medium">1 país</div>
                    <div className="text-xs text-neutral-500">Un solo país</div>
                    <div className="text-xs text-green-600 mt-1">+0%</div>
                  </Label>
                </div>
                <div className="flex items-center p-3 border rounded-md hover:bg-green-50 transition-colors">
                  <RadioGroupItem value="2-5" id="countries-2-5" className="mr-2" />
                  <Label htmlFor="countries-2-5" className="cursor-pointer">
                    <div className="font-medium">2-5 países</div>
                    <div className="text-xs text-neutral-500">Regional limitada</div>
                    <div className="text-xs text-green-600 mt-1">+5%</div>
                  </Label>
                </div>
                <div className="flex items-center p-3 border rounded-md hover:bg-green-50 transition-colors">
                  <RadioGroupItem value="6-10" id="countries-6-10" className="mr-2" />
                  <Label htmlFor="countries-6-10" className="cursor-pointer">
                    <div className="font-medium">6-10 países</div>
                    <div className="text-xs text-neutral-500">Regional amplia</div>
                    <div className="text-xs text-green-600 mt-1">+15%</div>
                  </Label>
                </div>
                <div className="flex items-center p-3 border rounded-md hover:bg-green-50 transition-colors">
                  <RadioGroupItem value="10+" id="countries-10+" className="mr-2" />
                  <Label htmlFor="countries-10+" className="cursor-pointer">
                    <div className="font-medium">Más de 10</div>
                    <div className="text-xs text-neutral-500">Cobertura global</div>
                    <div className="text-xs text-green-600 mt-1">+25%</div>
                  </Label>
                </div>
              </RadioGroup>
            </AccordionContent>
          </AccordionItem>

          {/* Nivel de Interacción con el Cliente */}
          <AccordionItem value="client-engagement" className="border rounded-lg overflow-hidden mb-6">
            <AccordionTrigger className="bg-purple-50 px-4 py-3 hover:bg-purple-100 hover:no-underline">
              <div className="flex items-center">
                <span className="bg-purple-100 p-1 rounded-full mr-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-700">
                    <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z"></path>
                    <path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"></path>
                  </svg>
                </span>
                <span className="font-medium">Nivel de Interacción con el Cliente</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pt-4 pb-2">
              <RadioGroup 
                value={quotationData.clientEngagement || 'medium'} 
                onValueChange={updateClientEngagement}
                className="grid grid-cols-1 md:grid-cols-3 gap-3"
              >
                <div className="flex items-center p-3 border rounded-md hover:bg-purple-50 transition-colors">
                  <RadioGroupItem value="low" id="engagement-low" className="mr-2" />
                  <Label htmlFor="engagement-low" className="cursor-pointer">
                    <div className="font-medium">Bajo</div>
                    <div className="text-xs text-neutral-500">Informe final</div>
                    <div className="text-xs text-purple-600 mt-1">+0%</div>
                  </Label>
                </div>
                <div className="flex items-center p-3 border rounded-md hover:bg-purple-50 transition-colors">
                  <RadioGroupItem value="medium" id="engagement-medium" className="mr-2" />
                  <Label htmlFor="engagement-medium" className="cursor-pointer">
                    <div className="font-medium">Medio</div>
                    <div className="text-xs text-neutral-500">Reunión inicial y final</div>
                    <div className="text-xs text-purple-600 mt-1">+5%</div>
                  </Label>
                </div>
                <div className="flex items-center p-3 border rounded-md hover:bg-purple-50 transition-colors">
                  <RadioGroupItem value="high" id="engagement-high" className="mr-2" />
                  <Label htmlFor="engagement-high" className="cursor-pointer">
                    <div className="font-medium">Alto</div>
                    <div className="text-xs text-neutral-500">Reuniones semanales</div>
                    <div className="text-xs text-purple-600 mt-1">+15%</div>
                  </Label>
                </div>
              </RadioGroup>
            </AccordionContent>
          </AccordionItem>

          {/* Nivel de Complejidad del Proyecto */}
          <AccordionItem value="complexity" className="border rounded-lg overflow-hidden">
            <AccordionTrigger className="bg-indigo-50 px-4 py-3 hover:bg-indigo-100 hover:no-underline">
              <div className="flex items-center">
                <span className="bg-indigo-100 p-1 rounded-full mr-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-700">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="9" y1="3" x2="9" y2="21"></line>
                  </svg>
                </span>
                <span className="font-medium">Nivel de Complejidad del Proyecto</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pt-4 pb-2">
              <RadioGroup 
                value={quotationData.complexity || 'medium'} 
                onValueChange={updateComplexity}
                className="grid grid-cols-1 md:grid-cols-3 gap-3"
              >
                <div className="flex items-center p-3 border rounded-md hover:bg-indigo-50 transition-colors">
                  <RadioGroupItem value="low" id="complexity-low" className="mr-2" />
                  <Label htmlFor="complexity-low" className="cursor-pointer">
                    <div className="font-medium">Baja</div>
                    <div className="text-xs text-neutral-500">Proyecto simple con requisitos estándar</div>
                    <div className="text-xs text-indigo-600 mt-1">+0%</div>
                  </Label>
                </div>
                <div className="flex items-center p-3 border rounded-md hover:bg-indigo-50 transition-colors">
                  <RadioGroupItem value="medium" id="complexity-medium" className="mr-2" />
                  <Label htmlFor="complexity-medium" className="cursor-pointer">
                    <div className="font-medium">Media</div>
                    <div className="text-xs text-neutral-500">Proyecto complejo con algunos requisitos específicos</div>
                    <div className="text-xs text-indigo-600 mt-1">+10%</div>
                  </Label>
                </div>
                <div className="flex items-center p-3 border rounded-md hover:bg-indigo-50 transition-colors">
                  <RadioGroupItem value="high" id="complexity-high" className="mr-2" />
                  <Label htmlFor="complexity-high" className="cursor-pointer">
                    <div className="font-medium">Alta</div>
                    <div className="text-xs text-neutral-500">Proyecto muy complejo con requisitos específicos</div>
                    <div className="text-xs text-indigo-600 mt-1">+20%</div>
                  </Label>
                </div>
              </RadioGroup>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>
    </div>
  );
};
