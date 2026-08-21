import { useRef, useState } from "react";
import { FileText, Lightbulb, Loader2, Sparkles, Upload, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { getApiErrorMessage } from "@/lib/api-error";

export type BriefIntakeAnalysis = {
  summary: string;
  projectName: string;
  objective: string;
  decision: string;
  modality: "demo" | "one_shot" | "event_pack" | "monthly_fee" | "annual_program" | "renewal" | null;
  durationMonths: number | null;
  markets: string[];
  brands: string[];
  competitors: string[];
  sources: string[];
  languages: Array<"es" | "en">;
  modules: string[];
  mentionVolume: string;
  slaLevel: string;
  designLevel: string;
  recommendationSlug: string | null;
  recommendationReason: string;
  confidence: number;
  missingQuestions: string[];
  source: "ai" | "heuristic";
  model: string | null;
  recommendedBlueprint: { id: number; slug: string; name: string; workloadHours: number } | null;
};

type Props = { onApply: (analysis: BriefIntakeAnalysis) => void };

export function QuotationBriefIntake({ onApply }: Props) {
  const [brief, setBrief] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<BriefIntakeAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const readFile = async (file: File) => {
    setError(null);
    if (file.size > 500_000) {
      setError("La minuta es demasiado grande. Pegá un resumen de hasta 500 KB para mantener el análisis ágil.");
      return;
    }
    if (!/text\/(plain|markdown|csv)|application\/json/.test(file.type) && !/\.(txt|md|csv|json)$/i.test(file.name)) {
      setError("Por ahora podés cargar minutas .txt, .md, .csv o .json. También podés pegar el texto directamente.");
      return;
    }
    setFileName(file.name);
    setBrief(await file.text());
    setAnalysis(null);
  };

  const analyze = async () => {
    if (brief.trim().length < 20) {
      setError("Contanos al menos el desafío, el cliente o la decisión que hay que habilitar (20 caracteres mínimo).");
      return;
    }
    setError(null);
    setIsAnalyzing(true);
    try {
      const result = await apiRequest("/api/quotation-intake/analyze", "POST", { brief: brief.trim() });
      setAnalysis(result);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "No pudimos analizar la minuta. Podés continuar con el brief manual."));
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Card className="overflow-hidden border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-white shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base text-slate-950"><Sparkles className="h-4 w-4 text-indigo-600" /> Empezá con un brief o una minuta</CardTitle>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-600">Pegá las notas de una reunión o cargá un archivo de texto. El asistente detecta el desafío, las preguntas y la receta más adecuada. Nada comercial se aplica sin tu confirmación.</p>
          </div>
          <Badge variant="outline" className="w-fit border-indigo-200 bg-white text-indigo-700"><Lightbulb className="mr-1 h-3.5 w-3.5" /> Recomendación explicada</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea value={brief} onChange={(event) => { setBrief(event.target.value); setAnalysis(null); }} rows={5} placeholder="Ej.: En la reunión con Uber definimos monitorear la conversación del Mundial en Argentina, Brasil y México, con alertas y un reporte ejecutivo semanal para marketing y asuntos públicos…" aria-label="Brief o minuta de reunión" />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept=".txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); event.currentTarget.value = ""; }} />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> Cargar minuta</Button>
            {fileName && <span className="flex max-w-[220px] items-center gap-1 truncate text-xs text-slate-500"><FileText className="h-3.5 w-3.5 shrink-0" /> {fileName}<button type="button" className="ml-1 rounded p-0.5 hover:bg-slate-200" aria-label="Quitar archivo" onClick={() => { setFileName(null); setBrief(""); setAnalysis(null); }}><X className="h-3 w-3" /></button></span>}
          </div>
          <Button type="button" onClick={() => void analyze()} disabled={isAnalyzing || brief.trim().length < 20} className="sm:min-w-44"><>{isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}</> {isAnalyzing ? "Analizando…" : "Analizar y recomendar"}</Button>
        </div>
        {error && <Alert variant="destructive"><AlertTitle>No pudimos procesarlo</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        {analysis && <div className="rounded-xl border border-indigo-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Lectura inicial {analysis.source === "ai" ? "asistida por IA" : "rápida"}</p><p className="mt-1 text-sm leading-5 text-slate-700">{analysis.summary}</p></div><Badge variant="outline">Confianza {Math.round(analysis.confidence * 100)}%</Badge></div>
          {analysis.recommendedBlueprint && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Receta sugerida</p><p className="mt-1 font-semibold text-emerald-950">{analysis.recommendedBlueprint.name}</p><p className="mt-1 text-sm leading-5 text-emerald-900">{analysis.recommendationReason}</p><p className="mt-1 text-xs text-emerald-700">Referencia inicial: {analysis.recommendedBlueprint.workloadHours} h · Podés modificar cobertura y entregables después.</p></div>}
          {analysis.missingQuestions.length > 0 && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Para afinar la propuesta</p><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-900">{analysis.missingQuestions.map((question) => <li key={question}>{question}</li>)}</ul></div>}
          <Button type="button" className="mt-4 w-full sm:w-auto" onClick={() => onApply(analysis)}>Usar este diagnóstico en el cotizador</Button>
        </div>}
      </CardContent>
    </Card>
  );
}
