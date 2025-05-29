import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Save, Star } from "lucide-react";

interface QuarterlyNpsSurvey {
  id?: number;
  clientId: number;
  quarter: number;
  year: number;
  reportQuality?: number;
  insightsClarity?: number;
  briefObjectives?: number;
  reportPresentation?: number;
  improvementSuggestions?: string;
  strengthsFeedback?: string;
  npsScore?: number;
  npsCategory?: string;
}

const NPS_QUESTIONS = [
  {
    id: "reportQuality",
    label: "Calidad general de los Informes de Epical",
    description: "¿Qué tan satisfecho/a estás con la calidad general de los informes entregados este trimestre?",
    scale: "0-10"
  },
  {
    id: "insightsClarity", 
    label: "Claridad y relevancia de los Insights",
    description: "¿Consideras que los insights entregados fueron claros, relevantes y accionables para tus objetivos?",
    scale: "0-10"
  },
  {
    id: "briefObjectives",
    label: "Cumplimiento de objetivos del Brief",
    description: "¿En qué medida nuestros informes respondieron a los objetivos establecidos en el brief?",
    scale: "0-10"
  },
  {
    id: "reportPresentation",
    label: "Presentación y formato del Informe",
    description: "¿Qué tan satisfecho/a estás con el diseño, presentación y formato del informe?",
    scale: "0-10"
  }
];

const QUARTERS = [
  { value: 1, label: "Q1 (Enero - Marzo)" },
  { value: 2, label: "Q2 (Abril - Junio)" },
  { value: 3, label: "Q3 (Julio - Septiembre)" },
  { value: 4, label: "Q4 (Octubre - Diciembre)" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

export default function QuarterlyNpsSurvey() {
  const { clientId } = useParams<{ clientId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [formData, setFormData] = useState<QuarterlyNpsSurvey>({
    clientId: parseInt(clientId || "0"),
    quarter: Math.ceil(new Date().getMonth() / 3), // Trimestre actual
    year: CURRENT_YEAR,
    reportQuality: undefined,
    insightsClarity: undefined,
    briefObjectives: undefined,
    reportPresentation: undefined,
    improvementSuggestions: "",
    strengthsFeedback: "",
    npsScore: undefined,
  });

  // Obtener información del cliente
  const { data: client } = useQuery({
    queryKey: [`/api/clients/${clientId}`],
    enabled: !!clientId,
  });

  // Obtener encuestas existentes para este cliente
  const { data: existingSurveys } = useQuery({
    queryKey: [`/api/clients/${clientId}/nps-surveys`],
    enabled: !!clientId,
  });

  // Mutation para guardar la encuesta
  const saveSurveyMutation = useMutation({
    mutationFn: async (data: QuarterlyNpsSurvey) => {
      const npsCategory = data.npsScore !== undefined ? 
        (data.npsScore >= 9 ? 'promoter' : 
         data.npsScore >= 7 ? 'passive' : 'detractor') : undefined;

      const response = await apiRequest(`/api/clients/${clientId}/nps-surveys`, {
        method: "POST",
        body: JSON.stringify({ 
          ...data, 
          npsCategory,
          clientId: parseInt(clientId || "0") 
        }),
      });

      if (!response.ok) {
        throw new Error("Error al guardar la encuesta");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Encuesta guardada",
        description: "La encuesta NPS trimestral se ha guardado correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/nps-surveys`] });
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/modo-summary`] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo guardar la encuesta. Intenta nuevamente.",
        variant: "destructive",
      });
    },
  });

  const handleScoreChange = (field: string, value: string) => {
    const numValue = value === "" ? undefined : parseInt(value);
    setFormData(prev => ({ ...prev, [field]: numValue }));
  };

  const handleTextChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveSurveyMutation.mutate(formData);
  };

  const getNpsColor = (score?: number) => {
    if (score === undefined) return "text-gray-400";
    if (score >= 9) return "text-green-600";
    if (score >= 7) return "text-yellow-600";
    return "text-red-600";
  };

  const getNpsLabel = (score?: number) => {
    if (score === undefined) return "";
    if (score >= 9) return "Promotor";
    if (score >= 7) return "Pasivo";
    return "Detractor";
  };

  return (
    <PageContainer>
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

      <HeadingPage
        title={`Encuesta NPS Trimestral - ${client?.name || 'Cliente'}`}
        description="Carga los resultados de la encuesta de satisfacción trimestral"
      />

      <StandardCard>
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Selección de período */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quarter">Trimestre</Label>
              <Select 
                value={formData.quarter.toString()} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, quarter: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUARTERS.map((q) => (
                    <SelectItem key={q.value} value={q.value.toString()}>
                      {q.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="year">Año</Label>
              <Select 
                value={formData.year.toString()} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, year: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preguntas de calificación (0-10) */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Evaluación de Servicios</h3>
            {NPS_QUESTIONS.map((question) => (
              <div key={question.id} className="space-y-3">
                <div>
                  <Label className="text-base font-medium">{question.label}</Label>
                  <p className="text-sm text-gray-600 mt-1">{question.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">0</span>
                  <div className="flex gap-1">
                    {Array.from({ length: 11 }, (_, i) => (
                      <Button
                        key={i}
                        type="button"
                        variant={formData[question.id as keyof QuarterlyNpsSurvey] === i ? "default" : "outline"}
                        size="sm"
                        className="w-10 h-10 p-0"
                        onClick={() => handleScoreChange(question.id, i.toString())}
                      >
                        {i}
                      </Button>
                    ))}
                  </div>
                  <span className="text-sm text-gray-500">10</span>
                </div>
              </div>
            ))}
          </div>

          {/* Preguntas de texto libre */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Comentarios y Sugerencias</h3>
            
            <div className="space-y-2">
              <Label htmlFor="improvements">¿Qué cambiarías o mejorarías de nuestros informes o servicio?</Label>
              <Textarea
                id="improvements"
                placeholder="Máximo 300 caracteres"
                maxLength={300}
                value={formData.improvementSuggestions || ""}
                onChange={(e) => handleTextChange("improvementSuggestions", e.target.value)}
                className="min-h-[100px]"
              />
              <p className="text-xs text-gray-500">
                {(formData.improvementSuggestions?.length || 0)}/300 caracteres
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="strengths">¿Qué estamos haciendo bien y deberíamos seguir reforzando?</Label>
              <Textarea
                id="strengths"
                placeholder="Comparte tu feedback positivo"
                value={formData.strengthsFeedback || ""}
                onChange={(e) => handleTextChange("strengthsFeedback", e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>

          {/* Pregunta NPS */}
          <div className="space-y-4 border-t pt-6">
            <div>
              <Label className="text-base font-medium">Net Promoter Score (NPS)</Label>
              <p className="text-sm text-gray-600 mt-1">
                En una escala de 0 a 10, ¿qué tan probable es que recomiendes nuestro servicio a un colega o conocido?
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">0<br />Not likely at all</span>
              <div className="flex gap-1">
                {Array.from({ length: 11 }, (_, i) => (
                  <Button
                    key={i}
                    type="button"
                    variant={formData.npsScore === i ? "default" : "outline"}
                    size="sm"
                    className="w-10 h-10 p-0"
                    onClick={() => handleScoreChange("npsScore", i.toString())}
                  >
                    {i}
                  </Button>
                ))}
              </div>
              <span className="text-sm text-gray-500">10<br />Extremely likely</span>
            </div>

            {formData.npsScore !== undefined && (
              <div className="flex items-center gap-2">
                <Star className={`h-5 w-5 ${getNpsColor(formData.npsScore)}`} />
                <span className={`font-medium ${getNpsColor(formData.npsScore)}`}>
                  {getNpsLabel(formData.npsScore)}
                </span>
              </div>
            )}
          </div>

          {/* Botones de acción */}
          <div className="flex gap-4 pt-4 border-t">
            <Button
              type="submit"
              disabled={saveSurveyMutation.isPending}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {saveSurveyMutation.isPending ? "Guardando..." : "Guardar Encuesta"}
            </Button>
            
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/client-summary/${clientId}`)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </StandardCard>
    </PageContainer>
  );
}