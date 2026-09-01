import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { AlertCircle, BriefcaseBusiness, Check, CircleDollarSign, Clock3, Minus, Users } from 'lucide-react';

type QuotationWorkspaceSummaryProps = {
  currentPhase: number;
  totalSteps?: number;
  compact?: boolean;
};

export function QuotationWorkspaceSummary({ currentPhase, totalSteps = 4, compact = false }: QuotationWorkspaceSummaryProps) {
  const { quotationData, pricingResult } = useOptimizedQuote();
  const currency = quotationData.quotationCurrency === 'USD' ? 'USD' : 'ARS';
  const locale = currency === 'USD' ? 'en-US' : 'es-AR';
  const formatAmount = (amount: number) => new Intl.NumberFormat(locale, {
    style: 'currency', currency, minimumFractionDigits: currency === 'USD' ? 2 : 0, maximumFractionDigits: currency === 'USD' ? 2 : 0,
  }).format(amount || 0);
  const totalHours = quotationData.teamMembers.reduce((sum, member) => sum + Number(member.hours || 0), 0);
  const recurring = ['fee-mensual', 'always-on'].includes(quotationData.project.type);
  const total = pricingResult.display.total || 0;
  const margin = pricingResult.display.markupAmount || 0;
  const marginPercent = total > 0 ? Math.max(0, (margin / total) * 100) : 0;
  const projectTypeLabel = {
    'on-demand': 'Proyecto puntual', 'fee-mensual': 'Fee mensual', 'always-on': 'Servicio recurrente', monitoring: 'Monitoreo', demo: 'Demo', 'credit-pack': 'Bolsa de créditos',
  }[quotationData.project.type] || quotationData.project.type || 'Sin definir';
  const motionLabel = {
    new_business: 'Nuevo negocio', renewal: 'Renovación', expansion: 'Expansión', demo: 'Demo',
  }[quotationData.commercialMotion || 'new_business'] || 'Nuevo negocio';
  const hasScope = Boolean(quotationData.scopeSnapshot);
  const workloadReference = Number((quotationData.operationalPlan as any)?.workload?.totalHours || 0);
  const effortDelta = workloadReference > 0 ? ((totalHours - workloadReference) / workloadReference) * 100 : 0;

  const content = (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between text-xs text-slate-500"><span>Avance</span><span>Paso {currentPhase} de {totalSteps}</span></div>
        <Progress value={(currentPhase / totalSteps) * 100} className="mt-2 h-1.5" />
      </div>

      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        <SummaryRow icon={BriefcaseBusiness} label="Cliente" value={quotationData.client?.name || 'Pendiente'} />
        <SummaryRow icon={Clock3} label="Modalidad" value={`${motionLabel} · ${projectTypeLabel}`} />
        <SummaryRow icon={Users} label="Equipo" value={totalHours > 0 ? `${quotationData.teamMembers.length} integrantes · ${totalHours.toFixed(1)} h${recurring ? '/mes' : ''}` : 'Pendiente'} />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Estado</p>
        <Checkpoint ready={hasScope} readyText="Servicio definido" pendingText="Falta elegir el servicio" />
        <Checkpoint ready={totalHours > 0} readyText="Equipo configurado" pendingText="Falta configurar el equipo" />
        {workloadReference > 0 && Math.abs(effortDelta) > 10 && <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs leading-5 text-amber-800"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />El equipo está {Math.abs(effortDelta).toFixed(0)}% {effortDelta > 0 ? 'por encima' : 'por debajo'} de la referencia.</p>}
      </div>

      {total > 0 && (
        <div className="rounded-xl bg-slate-950 p-4 text-white">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-300"><CircleDollarSign className="h-4 w-4" /> Precio estimado</div>
          <p aria-live="polite" className="text-2xl font-semibold tabular-nums">{formatAmount(total)}</p>
          <details className="mt-2 text-xs text-slate-300"><summary className="cursor-pointer">Ver desglose interno</summary><div className="mt-2 flex items-center justify-between"><span>Costo {formatAmount(pricingResult.display.baseCost)}</span><span>Rentabilidad {marginPercent.toFixed(0)}%</span></div></details>
        </div>
      )}
    </div>
  );

  if (compact) {
    return (
      <details className="rounded-xl border border-slate-200 bg-white p-4 xl:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-slate-900"><span>Resumen de la cotización</span><Badge variant="outline">{total > 0 ? formatAmount(total) : currency}</Badge></summary>
        <div className="pt-4">{content}</div>
      </details>
    );
  }

  return (
    <aside className="sticky top-6 hidden self-start rounded-2xl border border-slate-200 bg-white p-4 xl:block" aria-label="Resumen de la cotización">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-950">Resumen</h2><Badge variant="outline" className="bg-slate-50">{currency}</Badge></div>
      {content}
    </aside>
  );
}

function Checkpoint({ ready, readyText, pendingText }: { ready: boolean; readyText: string; pendingText: string }) {
  return <div className={`flex items-center gap-2 text-xs ${ready ? 'text-slate-700' : 'text-slate-500'}`}><span className={`flex h-5 w-5 items-center justify-center rounded-full ${ready ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{ready ? <Check className="h-3 w-3" /> : <Minus className="h-3 w-3" />}</span>{ready ? readyText : pendingText}</div>;
}

function SummaryRow({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return <div className="flex items-center gap-3 px-3 py-2.5"><Icon className="h-4 w-4 shrink-0 text-slate-400" /><div className="min-w-0"><p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p><p className="truncate text-xs font-medium text-slate-800">{value}</p></div></div>;
}
