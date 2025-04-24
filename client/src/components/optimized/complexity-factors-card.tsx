import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useOptimizedQuote } from "@/context/optimized-quote-context";
import { useState } from "react";

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
  
  const [isEditing, setIsEditing] = useState(false);

  // Labels para los factores de complejidad
  const getAnalysisTypeLabel = (type: string): string => {
    switch (type) {
      case 'basic': return 'Básico (0%)';
      case 'standard': return 'Estándar (+10%)';
      case 'deep': return 'Avanzado (+15%)';
      default: return 'No definido';
    }
  };

  const getMentionsVolumeLabel = (volume: string): string => {
    switch (volume) {
      case 'small': return 'Pequeño (0%)';
      case 'medium': return 'Medio (+10%)';
      case 'large': return 'Grande (+20%)';
      case 'xlarge': return 'Extra grande (+30%)';
      default: return 'No definido';
    }
  };

  const getCountriesCoveredLabel = (countries: string): string => {
    switch (countries) {
      case '1': return 'Un país (0%)';
      case '2-5': return '2-5 países (+5%)';
      case '6-10': return '6-10 países (+15%)';
      case '10+': return 'Más de 10 países (+25%)';
      default: return 'No definido';
    }
  };

  const getClientEngagementLabel = (engagement: string): string => {
    switch (engagement) {
      case 'low': return 'Baja (0%)';
      case 'medium': return 'Media (+5%)';
      case 'high': return 'Alta (+15%)';
      default: return 'No definido';
    }
  };

  // Vista en modo edición
  const renderEditMode = () => (
    <div className="space-y-6">
      {/* Tipo de análisis */}
      <div className="space-y-3 bg-blue-50 p-4 rounded-lg border border-blue-100">
        <div className="flex items-center mb-2">
          <div className="bg-blue-100 p-1 rounded-full mr-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-700">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
            </svg>
          </div>
          <Label className="font-medium text-blue-800">Tipo de Análisis *</Label>
        </div>
        <RadioGroup 
          value={analysisType} 
          onValueChange={(value) => updateAnalysisType(value)}
          className="flex flex-col space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="basic" id="analysis-edit-basic" />
            <Label htmlFor="analysis-edit-basic" className="cursor-pointer">
              <span className="font-medium">Básico</span> - Análisis general sin profundidad
              <span className="ml-2 text-xs text-blue-600">(+0%)</span>
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="standard" id="analysis-edit-standard" />
            <Label htmlFor="analysis-edit-standard" className="cursor-pointer">
              <span className="font-medium">Estándar</span> - Análisis detallado con métricas completas 
              <span className="ml-2 text-xs text-blue-600">(+10%)</span>
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="deep" id="analysis-edit-deep" />
            <Label htmlFor="analysis-edit-deep" className="cursor-pointer">
              <span className="font-medium">Avanzado</span> - Análisis profundo con metodologías especializadas
              <span className="ml-2 text-xs text-blue-600">(+15%)</span>
            </Label>
          </div>
        </RadioGroup>
      </div>
      
      {/* Volumen de menciones */}
      <div className="space-y-3 bg-indigo-50 p-4 rounded-lg border border-indigo-100">
        <div className="flex items-center mb-2">
          <div className="bg-indigo-100 p-1 rounded-full mr-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-700">
              <path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973"></path>
              <path d="m13 12-3 5h4l-3 5"></path>
            </svg>
          </div>
          <Label className="font-medium text-indigo-800">Volumen de Menciones *</Label>
        </div>
        <RadioGroup 
          value={mentionsVolume} 
          onValueChange={(value) => updateMentionsVolume(value)}
          className="flex flex-col space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="small" id="volume-edit-small" />
            <Label htmlFor="volume-edit-small" className="cursor-pointer">
              <span className="font-medium">Pequeño</span> - Menos de 1,000 menciones
              <span className="ml-2 text-xs text-indigo-600">(+0%)</span>
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="medium" id="volume-edit-medium" />
            <Label htmlFor="volume-edit-medium" className="cursor-pointer">
              <span className="font-medium">Medio</span> - Entre 1,000 y 10,000 menciones
              <span className="ml-2 text-xs text-indigo-600">(+10%)</span>
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="large" id="volume-edit-large" />
            <Label htmlFor="volume-edit-large" className="cursor-pointer">
              <span className="font-medium">Grande</span> - Entre 10,000 y 50,000 menciones
              <span className="ml-2 text-xs text-indigo-600">(+20%)</span>
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="xlarge" id="volume-edit-xlarge" />
            <Label htmlFor="volume-edit-xlarge" className="cursor-pointer">
              <span className="font-medium">Extra grande</span> - Más de 50,000 menciones
              <span className="ml-2 text-xs text-indigo-600">(+30%)</span>
            </Label>
          </div>
        </RadioGroup>
      </div>
      
      {/* Países cubiertos */}
      <div className="space-y-3 bg-green-50 p-4 rounded-lg border border-green-100">
        <div className="flex items-center mb-2">
          <div className="bg-green-100 p-1 rounded-full mr-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-700">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
          </div>
          <Label className="font-medium text-green-800">Países Cubiertos *</Label>
        </div>
        <RadioGroup 
          value={countriesCovered} 
          onValueChange={(value) => updateCountriesCovered(value)}
          className="flex flex-col space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="1" id="countries-edit-1" />
            <Label htmlFor="countries-edit-1" className="cursor-pointer">
              <span className="font-medium">1 país</span> - Cobertura de un solo país
              <span className="ml-2 text-xs text-green-600">(+0%)</span>
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="2-5" id="countries-edit-2-5" />
            <Label htmlFor="countries-edit-2-5" className="cursor-pointer">
              <span className="font-medium">2-5 países</span> - Cobertura regional limitada
              <span className="ml-2 text-xs text-green-600">(+5%)</span>
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="6-10" id="countries-edit-6-10" />
            <Label htmlFor="countries-edit-6-10" className="cursor-pointer">
              <span className="font-medium">6-10 países</span> - Cobertura regional amplia
              <span className="ml-2 text-xs text-green-600">(+15%)</span>
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="10+" id="countries-edit-10+" />
            <Label htmlFor="countries-edit-10+" className="cursor-pointer">
              <span className="font-medium">Más de 10 países</span> - Cobertura global
              <span className="ml-2 text-xs text-green-600">(+25%)</span>
            </Label>
          </div>
        </RadioGroup>
      </div>
      
      {/* Nivel de interacción con el cliente */}
      <div className="space-y-3 bg-purple-50 p-4 rounded-lg border border-purple-100">
        <div className="flex items-center mb-2">
          <div className="bg-purple-100 p-1 rounded-full mr-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-700">
              <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z"></path>
              <path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"></path>
            </svg>
          </div>
          <Label className="font-medium text-purple-800">Nivel de Interacción con el Cliente *</Label>
        </div>
        <RadioGroup 
          value={clientEngagement} 
          onValueChange={(value) => updateClientEngagement(value)}
          className="flex flex-col space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="low" id="engagement-edit-low" />
            <Label htmlFor="engagement-edit-low" className="cursor-pointer">
              <span className="font-medium">Bajo</span> - Entrega del informe final sin reuniones adicionales
              <span className="ml-2 text-xs text-purple-600">(+0%)</span>
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="medium" id="engagement-edit-medium" />
            <Label htmlFor="engagement-edit-medium" className="cursor-pointer">
              <span className="font-medium">Medio</span> - Incluye reunión inicial y presentación de resultados
              <span className="ml-2 text-xs text-purple-600">(+5%)</span>
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="high" id="engagement-edit-high" />
            <Label htmlFor="engagement-edit-high" className="cursor-pointer">
              <span className="font-medium">Alto</span> - Colaboración continua con reuniones semanales
              <span className="ml-2 text-xs text-purple-600">(+15%)</span>
            </Label>
          </div>
        </RadioGroup>
      </div>
      
      <div className="flex justify-end">
        <Button 
          size="sm" 
          variant="outline" 
          onClick={() => setIsEditing(false)}
          className="mr-2"
        >
          Cancelar
        </Button>
        <Button 
          size="sm" 
          onClick={() => setIsEditing(false)}
        >
          Guardar Cambios
        </Button>
      </div>
    </div>
  );

  // Vista en modo visualización
  const renderViewMode = () => (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <h4 className="font-medium mb-2">Tipo de Análisis</h4>
          <Badge variant="outline" className="bg-blue-50">
            {getAnalysisTypeLabel(analysisType)}
          </Badge>
        </div>
        <div>
          <h4 className="font-medium mb-2">Volumen de Menciones</h4>
          <Badge variant="outline" className="bg-green-50">
            {getMentionsVolumeLabel(mentionsVolume)}
          </Badge>
        </div>
        <div>
          <h4 className="font-medium mb-2">Países Cubiertos</h4>
          <Badge variant="outline" className="bg-amber-50">
            {getCountriesCoveredLabel(countriesCovered)}
          </Badge>
        </div>
        <div>
          <h4 className="font-medium mb-2">Interacción con Cliente</h4>
          <Badge variant="outline" className="bg-purple-50">
            {getClientEngagementLabel(clientEngagement)}
          </Badge>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button 
          size="sm" 
          variant="outline" 
          onClick={() => setIsEditing(true)}
        >
          Editar Factores
        </Button>
      </div>
    </div>
  );

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Factores de Complejidad</CardTitle>
        <CardDescription>Tus selecciones afectan el cálculo del precio final</CardDescription>
      </CardHeader>
      <CardContent>
        {isEditing ? renderEditMode() : renderViewMode()}
      </CardContent>
    </Card>
  );
}