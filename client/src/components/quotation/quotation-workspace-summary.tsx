import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { cn } from '@/lib/utils';
import { BriefcaseBusiness, CircleDollarSign, Clock3, ShieldCheck, Users } from 'lucide-react';

type QuotationWorkspaceSummaryProps = {
  currentPhase: number;
  compact?: boolean;
};

export function QuotationWorkspaceSummary({ currentPhase, compact = false }: QuotationWorkspaceSummaryProps) {
  const { quotationData, pricingResult } = useOptimizedQuote();
  const currency = quotationData.quotationCurrency === 'USD' ? 'USD' : 'ARS';
  const locale = currency === 'USD' ? 'en-US' : 'es-AR';
  const formatAmount = (amount: number) => new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'USD' ? 2 : 0,
    maximumFractionDigits: currency === 'USD' ? 2 : 0,
  }).format(amount || 0);
  const totalHours = quotationData.teamMembers.reduce((sum, member) => sum + Number(member.hours || 0), 0);
  const total = pricingResult.display.total || 0;
  const margin = pricingResult.display.markupAmount || 0;
  const marginPercent = total > 0 ? Math.max(0, (margin / total) * 100) : 0;
  const projectTypeLabel = {
    'on-demand': 'Proyecto puntual',
    'fee-mensual': 'Fee mensual',
    'always-on': 'Servicio recurrente',
  }[quotationData.project.type] || quotationData.project.type || 'Sin definir';

  const content = (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Avance</span>
          <span className="font-medium text-slate-700">Fase {currentPhase} de 4</span>
        </div>
        <Progress value={(currentPhase / 4) * 100} className="h-1.5" />
      </div>

      <div className="space-y-3">
        <SummaryRow icon={BriefcaseBusiness} label="Cliente" value={quotationData.client?.name || 'Sin seleccionar'} />
        <SummaryRow icon={Users} label="Equipo" value={`${quotationData.teamMembers.length} integrantes · ${totalHours.toFixed(1)} h`} />
        <SummaryRow icon={Clock3} label="Modalidad" value={projectTypeLabel} />
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
          <CircleDollarSign className="h-4 w-4" /> Precio estimado
        </div>
        <p aria-live="polite" className="text-2xl font-bold tabular-nums text-emerald-950">{formatAmount(total)}</p>
        <div className="mt-2 flex items-center justify-between text-xs text-emerald-800">
          <span>Costo {formatAmount(pricingResult.display.baseCost)}</span>
          <span>Margen {marginPercent.toFixed(0)}%</span>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        <span>Resumen interno. La vista para el cliente se prepara en la última fase.</span>
      </div>
    </div>
  );

  if (compact) {
    return (
      <details className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-slate-900">
          <span>Resumen · {formatAmount(total)}</span>
          <Badge variant="outline">{currency}</Badge>
        </summary>
        <div className="pt-4">{content}</div>
      </details>
    );
  }

  return (
    <aside className="sticky top-6 hidden self-start rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:block" aria-label="Resumen de la cotización">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-slate-950">Resumen en vivo</h2>
        <Badge variant="outline" className="bg-slate-50">{currency}</Badge>
      </div>
      {content}
    </aside>
  );
}

function SummaryRow({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className={cn('mt-0.5 rounded-lg bg-slate-100 p-1.5 text-slate-600')}><Icon className="h-3.5 w-3.5" /></span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
        <p className="truncate text-sm font-medium text-slate-800">{value}</p>
      </div>
    </div>
  );
}
