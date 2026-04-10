import { useState } from "react";
import { useOptimizedQuote } from "@/context/optimized-quote-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Building2, Users, DollarSign, Calendar, FileText, Briefcase } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";

const PROJECT_TYPE_LABELS: Record<string, string> = {
  'always-on': 'Monitoreo Continuo',
  'one-shot': 'Proyecto Puntual',
  'monitoring': 'Monitoreo',
  'comprehensive': 'Comprehensive',
  'executive': 'Executive',
  'demo': 'Demo',
};

const ANALYSIS_LABELS: Record<string, string> = {
  basic: 'Básico',
  standard: 'Estándar',
  deep: 'Profundo',
};

export function ExecutiveSummary() {
  const { quotationData, baseCost, totalAmount, markupAmount } = useOptimizedQuote();
  const { formatCurrency } = useCurrency();
  const [copied, setCopied] = useState(false);

  const client = quotationData.client;
  const project = quotationData.project;
  const team = quotationData.teamMembers || [];
  const currency = quotationData.quotationCurrency || 'ARS';

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 30);
  const expiryStr = expiryDate.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

  const totalHours = team.reduce((s: number, m: any) => s + (m.hours || 0), 0);
  const marginPercent = baseCost > 0 ? (((totalAmount - baseCost) / totalAmount) * 100).toFixed(0) : '0';
  const projectTypeLabel = PROJECT_TYPE_LABELS[project?.type] || project?.type || '';
  const analysisLabel = ANALYSIS_LABELS[quotationData.analysisType] || quotationData.analysisType || '';

  const fmt = (n: number) => formatCurrency(n);

  // Email template
  const emailTemplate = `Estimado/a ${client?.contactName || 'cliente'},

Es un placer presentarle nuestra propuesta para el proyecto "${project?.name}".

RESUMEN DE LA PROPUESTA
━━━━━━━━━━━━━━━━━━━━━
• Cliente: ${client?.name || '—'}
• Proyecto: ${project?.name || '—'}
• Tipo: ${projectTypeLabel} — Análisis ${analysisLabel}
• Equipo asignado: ${team.length} rol${team.length !== 1 ? 'es' : ''} (${totalHours} hs${project?.type === 'always-on' ? '/mes' : ' totales'})

PRECIO${project?.type === 'always-on' ? ' MENSUAL' : ' TOTAL'}
━━━━━━━━━━━━━━━━━━━━━
${currency} ${fmt(totalAmount)}

CONDICIONES
━━━━━━━━━━━━━━━━━━━━━
• Esta propuesta tiene validez hasta el ${expiryStr}.
• Los precios están expresados en ${currency}.
${quotationData.proposalLink ? `• Propuesta completa: ${quotationData.proposalLink}` : ''}

Quedamos a disposición para cualquier consulta.

Saludos cordiales`;

  const handleCopy = () => {
    navigator.clipboard.writeText(emailTemplate);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Resumen ejecutivo</h2>
          <p className="text-sm text-slate-500 mt-0.5">Revisá todo antes de enviar al cliente</p>
        </div>
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
          <Calendar className="h-3 w-3 mr-1" />
          Vence {expiryStr}
        </Badge>
      </div>

      {/* Key info cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">
            <Building2 className="h-3.5 w-3.5" /> Cliente & Proyecto
          </div>
          <div>
            <p className="font-semibold text-slate-900">{client?.name || '—'}</p>
            <p className="text-sm text-slate-600">{project?.name || '—'}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="text-xs bg-slate-50">{projectTypeLabel}</Badge>
            <Badge variant="outline" className="text-xs bg-slate-50">Análisis {analysisLabel}</Badge>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">
            <DollarSign className="h-3.5 w-3.5" /> Precio{project?.type === 'always-on' ? ' mensual' : ' total'}
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{fmt(totalAmount)}</p>
            <p className="text-xs text-slate-400 mt-0.5">{currency}</p>
          </div>
          <div className="space-y-1 pt-1 border-t border-slate-100">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Costo base</span><span>{fmt(baseCost)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Margen</span><span>{marginPercent}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Team */}
      {team.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            <Users className="h-3.5 w-3.5" /> Equipo ({totalHours} hs{project?.type === 'always-on' ? '/mes' : ''})
          </div>
          <div className="space-y-2">
            {team.map((m: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{m.roleName || `Rol ${m.roleId}`}{m.personnelName ? ` · ${m.personnelName}` : ''}</span>
                <span className="text-slate-500 tabular-nums">{m.hours} hs</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Email preview */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <FileText className="h-3.5 w-3.5" /> Email listo para enviar
          </div>
          <Button size="sm" variant="outline" onClick={handleCopy} className="h-7 text-xs gap-1.5">
            {copied ? <><Check className="h-3 w-3 text-emerald-500" /> Copiado</> : <><Copy className="h-3 w-3" /> Copiar</>}
          </Button>
        </div>
        <pre className="p-4 text-xs text-slate-600 whitespace-pre-wrap font-mono leading-relaxed bg-slate-50/30 max-h-72 overflow-y-auto">
          {emailTemplate}
        </pre>
      </div>

      {quotationData.proposalLink && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 flex items-center gap-3">
          <Briefcase className="h-4 w-4 text-indigo-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-indigo-700">Propuesta adjunta</p>
            <a href={quotationData.proposalLink} target="_blank" rel="noopener noreferrer"
              className="text-xs text-indigo-500 hover:text-indigo-700 truncate block">{quotationData.proposalLink}</a>
          </div>
        </div>
      )}
    </div>
  );
}
