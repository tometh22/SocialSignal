import { useRef, useState } from "react";
import { ArrowRight, FileText, Layers3, Loader2, Sparkles, Upload, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { getApiErrorMessage } from "@/lib/api-error";

export type BriefProposalCandidate = {
  id: string;
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
  recommendedBlueprint: { id: number; slug: string; name: string; workloadHours: number } | null;
};

export type BriefIntakeAnalysis = Omit<BriefProposalCandidate, "id"> & {
  source: "ai" | "heuristic";
  model: string | null;
  proposals: BriefProposalCandidate[];
  requiresProposalSelection: boolean;
};

type Props = { onApply: (proposal: BriefProposalCandidate, analysis: BriefIntakeAnalysis) => void };

const modalityLabel: Record<string, string> = {
  demo: "Demo",
  one_shot: "Proyecto puntual",
  event_pack: "Pack de evento",
  monthly_fee: "Fee mensual",
  annual_program: "Programa anual",
  renewal: "Renovación",
};

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
      setError("Podés cargar minutas .txt, .md, .csv o .json, o pegar el texto directamente.");
      return;
    }
    setFileName(file.name);
    setBrief(await file.text());
    setAnalysis(null);
  };

  const analyze = async () => {
    if (brief.trim().length < 20) {
      setError("Incluí al menos el desafío, el cliente o la decisión que hay que habilitar.");
      return;
    }
    setError(null);
    setIsAnalyzing(true);
    try {
      const result = await apiRequest("/api/quotation-intake/analyze", "POST", { brief: brief.trim() });
      setAnalysis(result);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "No pudimos analizar la minuta. Podés continuar completando los datos manualmente."));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setAnalysis(null);
    setError(null);
  };

  if (analysis) {
    const proposals = analysis.proposals?.length ? analysis.proposals : [{ id: "proposal-1", ...analysis }];
    const multiple = proposals.length > 1;
    return (
      <Card className="overflow-hidden border-slate-200 shadow-none">
        <CardContent className="p-0">
          <div className="border-b border-slate-200 bg-slate-950 px-5 py-5 text-white sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10"><Layers3 className="h-4 w-4" /></span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Análisis completado</p>
                  <h3 className="mt-1 text-lg font-semibold">{multiple ? `Detectamos ${proposals.length} propuestas diferentes` : "Detectamos una propuesta cotizable"}</h3>
                  <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-300">{multiple ? "Cada alcance tiene un objetivo y una decisión propios. Elegí cuál querés cotizar primero; no mezclaremos sus horas ni entregables." : analysis.summary}</p>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={reset} className="w-fit border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">Editar minuta</Button>
            </div>
          </div>

          <div className="space-y-3 bg-slate-50/60 p-4 sm:p-6">
            {proposals.map((proposal, index) => (
              <article key={proposal.id || `${proposal.projectName}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">{index + 1}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-base font-semibold text-slate-950">{proposal.projectName}</h4>
                        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">{proposal.modality ? modalityLabel[proposal.modality] : "Por definir"}{proposal.durationMonths ? ` · ${proposal.durationMonths} meses` : ""}</Badge>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{proposal.summary}</p>
                      {proposal.decision && <p className="mt-2 text-xs leading-5 text-slate-500"><span className="font-semibold text-slate-700">Decisión que habilita:</span> {proposal.decision}</p>}
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        {proposal.recommendedBlueprint && <span><strong className="text-slate-700">Receta:</strong> {proposal.recommendedBlueprint.name}</span>}
                        {proposal.markets.length > 0 && <span><strong className="text-slate-700">Mercados:</strong> {proposal.markets.join(", ")}</span>}
                        <span><strong className="text-slate-700">Confianza:</strong> {Math.round(proposal.confidence * 100)}%</span>
                      </div>
                      {proposal.missingQuestions.length > 0 && (
                        <details className="mt-3 text-xs text-slate-600">
                          <summary className="cursor-pointer font-medium text-slate-700">{proposal.missingQuestions.length} {proposal.missingQuestions.length === 1 ? "dato pendiente" : "datos pendientes"}</summary>
                          <ul className="mt-2 list-disc space-y-1 pl-5">{proposal.missingQuestions.map((question) => <li key={question}>{question}</li>)}</ul>
                        </details>
                      )}
                    </div>
                  </div>
                  <Button type="button" className="shrink-0 lg:min-w-44" onClick={() => onApply(proposal, analysis)}>Cotizar esta propuesta <ArrowRight className="ml-2 h-4 w-4" /></Button>
                </div>
              </article>
            ))}
            <details className="rounded-lg px-1 text-xs text-slate-500">
              <summary className="cursor-pointer font-medium text-slate-600">Ver minuta analizada</summary>
              <p className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 leading-5">{brief}</p>
            </details>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 shadow-none">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white"><Sparkles className="h-4 w-4" /></span>
          <div>
            <h3 className="text-base font-semibold text-slate-950">Partí de un brief o una minuta</h3>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-500">El asistente separa oportunidades, identifica el alcance y recomienda una receta. Vos confirmás qué propuesta querés cotizar.</p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <Textarea value={brief} onChange={(event) => { setBrief(event.target.value); setAnalysis(null); }} rows={6} placeholder="Pegá acá el brief, la minuta o las notas de la reunión…" aria-label="Brief o minuta de reunión" className="resize-y border-slate-200 bg-slate-50/50 text-sm leading-6" />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <input ref={fileRef} type="file" accept=".txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); event.currentTarget.value = ""; }} />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> Cargar archivo</Button>
              {fileName && <span className="flex min-w-0 items-center gap-1 truncate text-xs text-slate-500"><FileText className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{fileName}</span><button type="button" className="ml-1 rounded p-0.5 hover:bg-slate-200" aria-label="Quitar archivo" onClick={() => { setFileName(null); setBrief(""); }}><X className="h-3 w-3" /></button></span>}
            </div>
            <Button type="button" onClick={() => void analyze()} disabled={isAnalyzing || brief.trim().length < 20} className="sm:min-w-48">
              {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {isAnalyzing ? "Analizando…" : "Analizar oportunidades"}
            </Button>
          </div>
        </div>
        {error && <Alert variant="destructive" className="mt-4"><AlertTitle>No pudimos procesarlo</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      </CardContent>
    </Card>
  );
}
