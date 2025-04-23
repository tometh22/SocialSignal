import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Factores de Complejidad</CardTitle>
        <CardDescription>Tus selecciones afectan el cálculo del precio final</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-medium mb-2">Tipo de Análisis</h4>
            <Badge variant="outline" className="bg-blue-50">
              {analysisType === 'basic' && 'Básico (0%)'}
              {analysisType === 'standard' && 'Estándar (+10%)'}
              {analysisType === 'deep' && 'Avanzado (+15%)'}
            </Badge>
          </div>
          <div>
            <h4 className="font-medium mb-2">Volumen de Menciones</h4>
            <Badge variant="outline" className="bg-green-50">
              {mentionsVolume === 'small' && 'Pequeño (0%)'}
              {mentionsVolume === 'medium' && 'Medio (+10%)'}
              {mentionsVolume === 'large' && 'Grande (+20%)'}
              {mentionsVolume === 'xlarge' && 'Extra grande (+30%)'}
            </Badge>
          </div>
          <div>
            <h4 className="font-medium mb-2">Países Cubiertos</h4>
            <Badge variant="outline" className="bg-amber-50">
              {countriesCovered === '1' && 'Un país (0%)'}
              {countriesCovered === '2-5' && '2-5 países (+5%)'}
              {countriesCovered === '6-10' && '6-10 países (+15%)'}
              {countriesCovered === '10+' && 'Más de 10 países (+25%)'}
            </Badge>
          </div>
          <div>
            <h4 className="font-medium mb-2">Interacción con Cliente</h4>
            <Badge variant="outline" className="bg-purple-50">
              {clientEngagement === 'low' && 'Baja (0%)'}
              {clientEngagement === 'medium' && 'Media (+5%)'}
              {clientEngagement === 'high' && 'Alta (+15%)'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}