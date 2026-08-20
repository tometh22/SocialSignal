import { useMemo, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowLeft, ArrowUp, Bot, BookOpenCheck, Check, Download, Eye, EyeOff, FileCheck2, Loader2, Palette, RefreshCw, Save, Sparkles, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { ProposalDocumentContent, ProposalQaIssue } from "@shared/quotation-professional";

type StudioDocument = {
  id: number;
  quotationId: number;
  locale: "es" | "en";
  content: ProposalDocumentContent;
  status: string;
  qaStatus: string;
  qaIssues: ProposalQaIssue[];
  warningOverrideReason?: string | null;
  isStale: boolean;
};

type AgentProposal = { run: { id: number }; patch: { summary: string; operations: unknown[] } };
const PROTECTED_BLOCK_TYPES = new Set(["scope", "deliverables", "timeline", "team", "scenarios", "terms"]);
const BLOCK_LABELS: Record<string, string> = {
  cover: "Portada", context: "Contexto", objectives: "Objetivos", architecture: "Arquitectura",
  scope: "Alcance", deliverables: "Entregables", timeline: "Cronograma", team: "Equipo",
  scenarios: "Escenarios", terms: "Condiciones", closing: "Cierre",
};
type StudioMode = "narrative" | "design" | "qa" | "export";

export default function ProposalStudio() {
  const [, params] = useRoute<{ id: string }>("/quotations/:id/studio");
  const quotationId = Number(params?.id);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [locale, setLocale] = useState<"es" | "en">("es");
  const [draft, setDraft] = useState<ProposalDocumentContent | null>(null);
  const [instruction, setInstruction] = useState("");
  const [agentProposal, setAgentProposal] = useState<AgentProposal | null>(null);
  const [recipeName, setRecipeName] = useState("");
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const [studioMode, setStudioMode] = useState<StudioMode>("narrative");
  const canEditBlocks = studioMode === "narrative";

  const queryKey = ["proposal-document", quotationId, locale];
  const { data: document, isLoading } = useQuery<StudioDocument>({
    queryKey,
    queryFn: async () => apiRequest(`/api/quotations/${quotationId}/proposal-documents/${locale}`, "GET"),
    enabled: Number.isInteger(quotationId),
  });
  const content = draft ?? document?.content ?? null;

  const replaceDocument = (next: StudioDocument) => {
    queryClient.setQueryData(queryKey, next);
    setDraft(null);
  };

  const save = useMutation({
    mutationFn: async () => apiRequest(`/api/quotations/${quotationId}/proposal-documents/${document!.id}`, "PUT", { content }),
    onSuccess: (next) => { replaceDocument(next); toast({ title: "Propuesta guardada" }); },
  });
  const qa = useMutation({
    mutationFn: async () => apiRequest(`/api/quotations/${quotationId}/proposal-documents/${document!.id}/qa`, "POST"),
    onSuccess: (result) => { replaceDocument(result.document); toast({ title: result.blockers.length ? "QA con bloqueos" : result.warnings.length ? "QA con advertencias" : "QA aprobado" }); },
  });
  const reconcile = useMutation({
    mutationFn: async () => apiRequest(`/api/quotations/${quotationId}/proposal-documents/${document!.id}/reconcile`, "POST"),
    onSuccess: (next) => { replaceDocument(next); setAgentProposal(null); toast({ title: "Documento reconciliado", description: "Se regeneró el contenido comercial con la última revisión." }); },
  });
  const propose = useMutation({
    mutationFn: async () => apiRequest(`/api/quotations/${quotationId}/proposal-documents/${document!.id}/agent/propose`, "POST", { instruction }),
    onSuccess: (result: AgentProposal) => { setAgentProposal(result); toast({ title: "El agente preparó una propuesta", description: "Revisala antes de aplicarla." }); },
  });
  const decide = useMutation({
    mutationFn: async (decision: "accept" | "reject") => apiRequest(`/api/quotations/${quotationId}/proposal-agent-runs/${agentProposal!.run.id}/decision`, "POST", { decision }),
    onSuccess: (result, decision) => {
      if (decision === "accept" && result.document) replaceDocument(result.document);
      setAgentProposal(null);
      toast({ title: decision === "accept" ? "Cambios editoriales aplicados" : "Propuesta descartada" });
    },
  });
  const proposeRecipe = useMutation({
    mutationFn: async () => apiRequest(`/api/service-blueprints/from-quotation/${quotationId}`, "POST", {
      name: recipeName,
      slug: recipeName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      description: "Receta propuesta desde una cotización personalizada.",
    }),
    onSuccess: () => { setRecipeName(""); toast({ title: "Receta propuesta", description: "Operaciones debe revisarla y publicarla antes de que aparezca en el catálogo." }); },
  });

  const issues = document?.qaIssues ?? [];
  const blockerCount = useMemo(() => issues.filter((issue) => issue.severity === "blocker").length, [issues]);
  const updateBlock = (id: string, patch: Record<string, unknown>) => {
    if (!content) return;
    setDraft({ ...content, blocks: content.blocks.map((block) => block.id === id ? { ...block, ...patch } : block) });
  };
  const moveBlock = (index: number, direction: -1 | 1) => {
    if (!content) return;
    const target = index + direction;
    if (target < 0 || target >= content.blocks.length) return;
    const blocks = [...content.blocks];
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    setDraft({ ...content, blocks });
  };
  const uploadAsset = async (file: File, assetType: "client_logo" | "brand_image") => {
    setUploadingAsset(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("documentId", String(document!.id));
      form.append("assetType", assetType);
      form.append("altText", file.name);
      const response = await fetch(`/api/quotations/${quotationId}/proposal-assets/upload`, { method: "POST", body: form, credentials: "include" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "No se pudo subir la imagen");
      replaceDocument(payload.document);
      toast({ title: "Imagen incorporada" });
    } catch (error) {
      toast({ title: "No se pudo subir la imagen", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally { setUploadingAsset(false); }
  };

  if (isLoading || !content || !document) return <main className="flex min-h-[70vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-indigo-500" /></main>;

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-20 border-b bg-white/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/quotations/${quotationId}`)}><ArrowLeft className="h-4 w-4" /></Button>
            <div><h1 className="font-semibold text-slate-900">Estudio de Propuesta</h1><p className="text-xs text-slate-500">Documento canónico · portal, PDF y PPTX</p></div>
            <Badge variant={document.isStale ? "destructive" : document.qaStatus === "passed" ? "default" : "secondary"}>{document.isStale ? "Desactualizada" : `QA: ${document.qaStatus}`}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={studioMode} onValueChange={(value) => setStudioMode(value as StudioMode)}><TabsList><TabsTrigger value="narrative">Narrativa</TabsTrigger><TabsTrigger value="design">Diseño</TabsTrigger><TabsTrigger value="qa">QA</TabsTrigger><TabsTrigger value="export">Exportar</TabsTrigger></TabsList></Tabs>
            <Tabs value={locale} onValueChange={(value) => { setDraft(null); setLocale(value as "es" | "en"); }}><TabsList><TabsTrigger value="es">ES</TabsTrigger><TabsTrigger value="en">EN</TabsTrigger></TabsList></Tabs>
            <Button variant="outline" onClick={() => reconcile.mutate()} disabled={reconcile.isPending}><RefreshCw className="mr-2 h-4 w-4" /> Reconciliar</Button>
            <Button variant="ghost" onClick={() => navigate("/operations/service-blueprints")}><BookOpenCheck className="mr-2 h-4 w-4" /> Catálogo</Button>
            <Button variant="outline" onClick={() => qa.mutate()} disabled={qa.isPending || Boolean(draft)}><FileCheck2 className="mr-2 h-4 w-4" /> Ejecutar QA</Button>
            <Button onClick={() => save.mutate()} disabled={!draft || save.isPending}><Save className="mr-2 h-4 w-4" /> Guardar</Button>
          </div>
        </div>
      </header>

      {document.isStale && <div className="mx-auto max-w-[1680px] px-5 pt-5"><Alert variant="destructive"><RefreshCw className="h-4 w-4" /><AlertTitle>La revisión comercial cambió</AlertTitle><AlertDescription>Reconciliá el documento antes de ejecutar QA, exportar o enviar. La reconciliación conserva el tema visual y actualiza precio, alcance, escenarios y términos.</AlertDescription></Alert></div>}

      <div className="mx-auto grid max-w-[1440px] gap-5 p-5 xl:grid-cols-[240px_minmax(0,1fr)_300px]">
        <aside className="space-y-4">
          {studioMode === "narrative" ? <>
            <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4 text-indigo-600" /> Asistente de narrativa</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-xs text-slate-500">Puede mejorar la historia y el tono. Los bloques comerciales protegidos no se modifican sin confirmación.</p><Textarea rows={6} value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Ej.: resumí el contexto y hacé más ejecutivo el cierre para un CMO." /><Button className="w-full" variant="secondary" disabled={instruction.trim().length < 5 || propose.isPending || document.isStale} onClick={() => propose.mutate()}><Sparkles className="mr-2 h-4 w-4" /> Proponer cambios</Button>{agentProposal && <Alert><AlertTitle>{agentProposal.patch.summary}</AlertTitle><AlertDescription className="mt-2 space-y-3"><p>{agentProposal.patch.operations.length} operaciones editoriales tipadas.</p><div className="flex gap-2"><Button size="sm" onClick={() => decide.mutate("accept")}><Check className="mr-1 h-3.5 w-3.5" /> Aplicar</Button><Button size="sm" variant="outline" onClick={() => decide.mutate("reject")}><X className="mr-1 h-3.5 w-3.5" /> Descartar</Button></div></AlertDescription></Alert>}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">Proponer como receta</CardTitle></CardHeader><CardContent className="space-y-2"><Input value={recipeName} onChange={(event) => setRecipeName(event.target.value)} placeholder="Nombre de la nueva receta" /><Button className="w-full" variant="outline" disabled={recipeName.trim().length < 2 || proposeRecipe.isPending} onClick={() => proposeRecipe.mutate()}><BookOpenCheck className="mr-2 h-4 w-4" /> Enviar a Operaciones</Button><p className="text-xs text-slate-500">Se crea un borrador versionado; no modifica esta cotización ni el catálogo publicado.</p></CardContent></Card>
          </> : <Card><CardHeader><CardTitle className="text-sm">Estructura del documento</CardTitle></CardHeader><CardContent><ol className="space-y-2 text-xs text-slate-600">{content.blocks.map((block, index) => <li key={block.id} className={`flex gap-2 ${block.visible ? "" : "text-slate-400 line-through"}`}><span className="text-slate-400">{index + 1}.</span><span>{BLOCK_LABELS[block.type] || block.type}</span></li>)}</ol></CardContent></Card>}
          <Card><CardHeader><CardTitle className="text-sm">Protecciones comerciales</CardTitle></CardHeader><CardContent className="text-xs leading-5 text-slate-500">Los cambios de alcance, precio, horas, SLA y términos vuelven al cotizador. El agente sólo opera el documento editorial sanitizado.</CardContent></Card>
        </aside>

        <section className="space-y-4">
          {content.blocks.map((block, index) => (
            <Card key={block.id} className={`${block.visible ? "" : "opacity-60"} overflow-hidden`}>
              <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-2"><div className="flex items-center gap-2"><Badge variant="outline">{BLOCK_LABELS[block.type] || block.type}</Badge>{block.internalOnly && <Badge variant="destructive">Interno</Badge>}{PROTECTED_BLOCK_TYPES.has(block.type) && <Badge variant="secondary">Sincronizado</Badge>}</div><div className="flex gap-1"><Button variant="ghost" size="icon" aria-label="Subir bloque" onClick={() => moveBlock(index, -1)} disabled={!canEditBlocks || index === 0}><ArrowUp className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label="Bajar bloque" onClick={() => moveBlock(index, 1)} disabled={!canEditBlocks || index === content.blocks.length - 1}><ArrowDown className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label={block.visible ? "Ocultar bloque" : "Mostrar bloque"} disabled={!canEditBlocks || PROTECTED_BLOCK_TYPES.has(block.type)} onClick={() => updateBlock(block.id, { visible: !block.visible })}>{block.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</Button></div></div>
              <CardContent className="space-y-3 p-6"><Input disabled={!canEditBlocks || PROTECTED_BLOCK_TYPES.has(block.type)} className="border-0 px-0 text-xl font-semibold shadow-none focus-visible:ring-0 disabled:opacity-100" value={block.title} onChange={(event) => updateBlock(block.id, { title: event.target.value })} /><Textarea disabled={!canEditBlocks || PROTECTED_BLOCK_TYPES.has(block.type)} className="min-h-24 resize-y border-slate-200 leading-6 disabled:opacity-100" value={block.body ?? ""} onChange={(event) => updateBlock(block.id, { body: event.target.value })} placeholder="Narrativa del bloque" /><div><Label className="text-xs text-slate-500">Bullets · uno por línea</Label><Textarea disabled={!canEditBlocks || PROTECTED_BLOCK_TYPES.has(block.type)} className="mt-1 min-h-24 disabled:opacity-100" value={block.bullets.join("\n")} onChange={(event) => updateBlock(block.id, { bullets: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })} /></div></CardContent>
            </Card>
          ))}
        </section>

        <aside className="space-y-4">
          {studioMode === "design" && <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Palette className="h-4 w-4 text-indigo-600" /> Identidad visual</CardTitle></CardHeader><CardContent className="space-y-3">{([['primaryColor','Color principal'],['accentColor','Acento'],['backgroundColor','Fondo']] as const).map(([key,label]) => <div key={key}><Label className="text-xs">{label}</Label><div className="mt-1 flex gap-2"><Input type="color" className="h-9 w-12 p-1" value={content.theme[key]} onChange={(event) => setDraft({ ...content, theme: { ...content.theme, [key]: event.target.value } })} /><Input value={content.theme[key]} onChange={(event) => setDraft({ ...content, theme: { ...content.theme, [key]: event.target.value } })} /></div></div>)}<div><Label className="text-xs">Tipografía</Label><Input className="mt-1" value={content.theme.fontFamily} onChange={(event) => setDraft({ ...content, theme: { ...content.theme, fontFamily: event.target.value } })} /></div><div className="grid grid-cols-2 gap-2"><Label className="cursor-pointer rounded-md border px-3 py-2 text-center text-xs hover:bg-slate-50">Logo cliente<Input className="hidden" type="file" accept="image/png,image/jpeg" disabled={uploadingAsset} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAsset(file, "client_logo"); }} /></Label><Label className="cursor-pointer rounded-md border px-3 py-2 text-center text-xs hover:bg-slate-50">Imagen de marca<Input className="hidden" type="file" accept="image/png,image/jpeg" disabled={uploadingAsset} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAsset(file, "brand_image"); }} /></Label></div><p className="text-xs text-slate-500">{content.assets.length} recursos vinculados al documento.</p></CardContent></Card>}
          {studioMode === "qa" && <Card><CardHeader><CardTitle className="text-base">Control de calidad</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex gap-2"><Badge variant={blockerCount ? "destructive" : "secondary"}>{blockerCount} bloqueos</Badge><Badge variant="outline">{issues.length - blockerCount} advertencias</Badge></div>{issues.length === 0 ? <p className="text-xs text-slate-500">Guardá el documento y ejecutá QA.</p> : <ul className="space-y-2">{issues.map((issue, index) => <li key={`${issue.code}-${index}`} className="rounded-lg border p-2 text-xs"><strong>{issue.code}</strong><p className="mt-1 text-slate-500">{issue.message}</p></li>)}</ul>}</CardContent></Card>}
          {studioMode === "export" && <><Card><CardHeader><CardTitle className="text-base">Vista previa</CardTitle></CardHeader><CardContent className="space-y-3"><div className="rounded-lg border bg-white p-3 shadow-inner"><p className="text-[10px] uppercase tracking-wide text-slate-400">{locale.toUpperCase()} · documento canónico</p>{content.blocks.filter((block) => block.visible).slice(0, 4).map((block) => <div key={block.id} className="mt-3 border-b pb-2 last:border-0"><p className="text-xs font-semibold text-slate-900">{block.title || BLOCK_LABELS[block.type] || block.type}</p><p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">{block.body || block.bullets.join(" · ") || "Sin contenido editorial"}</p></div>)}</div><p className="text-xs text-slate-500">La versión final se renderiza en PDF y PPTX con la identidad elegida.</p></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Exportar propuesta</CardTitle></CardHeader><CardContent className="grid gap-2"><p className="text-xs text-slate-500">Los archivos se generan desde el mismo documento canónico.</p><Button variant="outline" disabled={document.isStale || document.status === "draft"} onClick={() => window.open(`/api/quotations/${quotationId}/proposal-documents/${document.id}/export.pdf`, "_blank")}><Download className="mr-2 h-4 w-4" /> PDF modular</Button><Button variant="outline" disabled={document.isStale || document.status === "draft"} onClick={() => window.open(`/api/quotations/${quotationId}/proposal-documents/${document.id}/export.pptx`, "_blank")}><Download className="mr-2 h-4 w-4" /> PPTX editable</Button></CardContent></Card></>}
          {studioMode === "narrative" && <Card><CardHeader><CardTitle className="text-base">Próximo paso</CardTitle></CardHeader><CardContent className="text-xs leading-5 text-slate-500">Cuando termines la narrativa, pasá a Diseño, luego ejecutá QA y finalmente exportá.</CardContent></Card>}
        </aside>
      </div>
    </main>
  );
}
