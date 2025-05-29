import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Save, Star } from "lucide-react";

interface QuarterlyNpsSurvey {
  id?: number;
  clientId: number;
  quarter: number;
  year: number;
  reportQuality?: number | null;
  insightsClarity?: number | null;
  briefObjectives?: number | null;
  reportPresentation?: number | null;
  improvementSuggestions?: string | null;
  strengthsFeedback?: string | null;
  npsScore?: number | null;
  npsCategory?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: number | null;
}

export default function QuarterlyNpsSurvey() {
  const { clientId } = useParams<{ clientId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [formData, setFormData] = useState<QuarterlyNpsSurvey>({
    clientId: parseInt(clientId!),
    quarter: new Date().getMonth() < 3 ? 1 : new Date().getMonth() < 6 ? 2 : new Date().getMonth() < 9 ? 3 : 4,
    year: new Date().getFullYear(),
    reportQuality: undefined,
    insightsClarity: undefined,
    briefObjectives: undefined,
    reportPresentation: undefined,
    improvementSuggestions: "",
    strengthsFeedback: "",
    npsScore: undefined,
    npsCategory: "",
  });

  // Obtener datos del cliente
  const { data: client } = useQuery({
    queryKey: [`/api/clients/${clientId}`],
    enabled: !!clientId,
  });

  // Mutación para guardar la encuesta
  const mutation = useMutation({
    mutationFn: async (data: QuarterlyNpsSurvey) => {
      const response = await fetch('/api/nps-surveys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to save survey');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Encuesta guardada",
        description: "Los datos de la encuesta NPS se han guardado correctamente.",
      });
      navigate(`/client-summary/${clientId}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo guardar la encuesta. Intenta nuevamente.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Calcular categoría NPS automáticamente
    if (formData.npsScore !== undefined) {
      let category = "";
      if (formData.npsScore >= 9) category = "Promotor";
      else if (formData.npsScore >= 7) category = "Pasivo";
      else category = "Detractor";
      
      setFormData(prev => ({ ...prev, npsCategory: category }));
      mutation.mutate({ ...formData, npsCategory: category });
    } else {
      mutation.mutate(formData);
    }
  };

  const handleInputChange = (field: keyof QuarterlyNpsSurvey, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const renderStarRating = (field: keyof QuarterlyNpsSurvey, label: string) => {
    const currentValue = formData[field] as number;
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{label}</Label>
        <div className="flex items-center space-x-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => handleInputChange(field, star)}
              className={`p-1 rounded ${
                star <= currentValue
                  ? "text-yellow-500"
                  : "text-gray-300 hover:text-yellow-400"
              }`}
            >
              <Star className="h-6 w-6 fill-current" />
            </button>
          ))}
          <span className="ml-2 text-sm text-gray-600">
            {currentValue ? `${currentValue}/5` : "No calificado"}
          </span>
        </div>
      </div>
    );
  };

  const renderNpsScore = () => {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Puntuación NPS (0-10): ¿Qué tan probable es que recomiende nuestros servicios?
        </Label>
        <div className="flex items-center space-x-2">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
            <button
              key={score}
              type="button"
              onClick={() => handleInputChange("npsScore", score)}
              className={`w-10 h-10 rounded border text-sm font-medium ${
                formData.npsScore === score
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {score}
            </button>
          ))}
        </div>
        <div className="text-xs text-gray-500 flex justify-between">
          <span>0: Muy improbable</span>
          <span>10: Extremadamente probable</span>
        </div>
        {formData.npsScore !== undefined && (
          <div className="text-sm">
            <span className="font-medium">Categoría: </span>
            <span className={
              formData.npsScore >= 9 ? "text-green-600" :
              formData.npsScore >= 7 ? "text-yellow-600" : "text-red-600"
            }>
              {formData.npsScore >= 9 ? "Promotor" : formData.npsScore >= 7 ? "Pasivo" : "Detractor"}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/client-summary/${clientId}`)}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">{`Encuesta NPS Trimestral - ${client?.name || 'Cliente'}`}</h1>
        <p className="text-gray-600">Carga los resultados de la encuesta de satisfacción trimestral</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos de la Encuesta</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Selección de período */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="quarter">Trimestre</Label>
                <Select
                  value={formData.quarter.toString()}
                  onValueChange={(value) => handleInputChange("quarter", parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona trimestre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Q1 (Enero - Marzo)</SelectItem>
                    <SelectItem value="2">Q2 (Abril - Junio)</SelectItem>
                    <SelectItem value="3">Q3 (Julio - Septiembre)</SelectItem>
                    <SelectItem value="4">Q4 (Octubre - Diciembre)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="year">Año</Label>
                <Input
                  id="year"
                  type="number"
                  value={formData.year}
                  onChange={(e) => handleInputChange("year", parseInt(e.target.value))}
                  min="2020"
                  max="2030"
                />
              </div>
            </div>

            {/* Puntuaciones de calidad (1-5 estrellas) */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Evaluación de Calidad (1-5 estrellas)</h3>
              
              {renderStarRating("reportQuality", "1. Calidad general del reporte")}
              {renderStarRating("insightsClarity", "2. Claridad de insights y conclusiones")}
              {renderStarRating("briefObjectives", "3. Cumplimiento de objetivos del brief")}
              {renderStarRating("reportPresentation", "4. Presentación y formato del reporte")}
            </div>

            {/* Comentarios cualitativos */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Retroalimentación Cualitativa</h3>
              
              <div>
                <Label htmlFor="improvementSuggestions">
                  5. Sugerencias de mejora para futuros reportes
                </Label>
                <Textarea
                  id="improvementSuggestions"
                  value={formData.improvementSuggestions}
                  onChange={(e) => handleInputChange("improvementSuggestions", e.target.value)}
                  placeholder="Describa las áreas donde podríamos mejorar..."
                  className="h-24"
                />
              </div>

              <div>
                <Label htmlFor="strengthsFeedback">
                  6. Fortalezas destacadas del servicio
                </Label>
                <Textarea
                  id="strengthsFeedback"
                  value={formData.strengthsFeedback}
                  onChange={(e) => handleInputChange("strengthsFeedback", e.target.value)}
                  placeholder="Mencione los aspectos más valorados del servicio..."
                  className="h-24"
                />
              </div>
            </div>

            {/* Puntuación NPS */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Net Promoter Score (NPS)</h3>
              {renderNpsScore()}
            </div>

            {/* Botones de acción */}
            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/client-summary/${clientId}`)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending} className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                {mutation.isPending ? "Guardando..." : "Guardar Encuesta"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}