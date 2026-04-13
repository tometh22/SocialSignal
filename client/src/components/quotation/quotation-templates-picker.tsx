import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useOptimizedQuote } from "@/context/optimized-quote-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BookTemplate, Plus, Trash2, Loader2, Download, Save } from "lucide-react";
import { cn } from "@/lib/utils";

const PROJECT_TYPE_LABELS: Record<string, string> = {
  'always-on': 'Always-On',
  'one-shot': 'One-Shot',
  'monitoring': 'Monitoreo',
  'comprehensive': 'Comprehensive',
  'executive': 'Executive',
  'demo': 'Demo',
};

interface Template {
  id: number;
  name: string;
  description: string | null;
  projectType: string;
  analysisType: string;
  mentionsVolume: string;
  countriesCovered: string;
  clientEngagement: string;
  teamConfig: string;
  complexityConfig: string | null;
  createdAt: string;
}

export function QuotationTemplatesPicker() {
  const { loadFromTemplate, saveAsTemplate, quotationData } = useOptimizedQuote();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["/api/quotation-templates"],
    staleTime: 30000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/quotation-templates/${id}`, 'DELETE'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/quotation-templates"] }),
  });

  const handleLoad = (tmpl: Template) => {
    loadFromTemplate(tmpl);
    setOpen(false);
    toast({ title: "Template cargado", description: `"${tmpl.name}" aplicado al proyecto actual` });
  };

  const handleSave = async () => {
    if (!templateName.trim()) return;
    setSaving(true);
    try {
      await saveAsTemplate(templateName.trim(), templateDesc.trim() || undefined);
      await queryClient.invalidateQueries({ queryKey: ["/api/quotation-templates"] });
      toast({ title: "Template guardado", description: `"${templateName}" disponible para futuros proyectos` });
      setTemplateName("");
      setTemplateDesc("");
      setSaveOpen(false);
    } catch {
      toast({ title: "Error", description: "No se pudo guardar el template", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const hasTeam = quotationData.teamMembers?.length > 0;

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="h-8 text-xs gap-1.5 border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          <BookTemplate className="h-3.5 w-3.5" />
          Cargar template
        </Button>
        {hasTeam && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSaveOpen(true)}
            className="h-8 text-xs gap-1.5 border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <Save className="h-3.5 w-3.5" />
            Guardar como template
          </Button>
        )}
      </div>

      {/* Load template dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <BookTemplate className="h-4 w-4 text-slate-500" />
              Templates de cotización
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              Aún no hay templates guardados.<br />
              <span className="text-xs">Configurá un equipo y guardalo como template.</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {templates.map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:border-slate-300 hover:bg-slate-50/50 transition-all group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-slate-800">{tmpl.name}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-50">
                        {PROJECT_TYPE_LABELS[tmpl.projectType] || tmpl.projectType}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-50">
                        {tmpl.analysisType}
                      </Badge>
                    </div>
                    {tmpl.description && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{tmpl.description}</p>
                    )}
                    <p className="text-[10px] text-slate-300 mt-1">
                      {(() => { try { return `${JSON.parse(tmpl.teamConfig).length} roles`; } catch { return ''; } })()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleLoad(tmpl)}
                      className="h-7 text-xs px-3"
                    >
                      <Download className="h-3 w-3 mr-1" /> Usar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(tmpl.id)}
                      disabled={deleteMutation.isPending}
                      className="h-7 w-7 p-0 text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="text-xs">Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save as template dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Guardar como template</DialogTitle>
            <p className="text-xs text-slate-500 mt-1">
              Guarda el equipo actual ({quotationData.teamMembers?.length} roles) y la configuración de scope para reutilizarlos.
            </p>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Nombre del template *"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="text-sm"
              autoFocus
            />
            <Textarea
              placeholder="Descripción opcional..."
              value={templateDesc}
              onChange={(e) => setTemplateDesc(e.target.value)}
              className="text-sm h-16 resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!templateName.trim() || saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
