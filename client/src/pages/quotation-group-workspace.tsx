import { useMemo, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowRight, CheckCircle2, ClipboardCheck, FileCheck2, Layers3, Loader2, Mail, RefreshCw, Send, Settings2 } from 'lucide-react';
import { PageLayout } from '@/components/ui/page-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { apiRequest } from '@/lib/queryClient';
import { getApiErrorMessage } from '@/lib/api-error';
import { useToast } from '@/hooks/use-toast';

type GroupItem = {
  quotationId: number;
  quotationNumber: string;
  projectName: string;
  position: number;
  status: string;
  currency: 'ARS' | 'USD';
  totalAmount: number;
  lockVersion: number;
  lastCompletedStep: number;
  configuredAt: string | null;
  approval: { pending: number; rejected: number };
  qa: { status: string; stale: boolean; blockers: number; warnings: number };
  crm: { opportunityName: string | null; stage: string | null };
};

type GroupWorkspace = {
  group: { id: number; groupNumber: string; name: string; sharedDefaults: Record<string, any> };
  client: { id: number; name: string } | null;
  status: string;
  items: GroupItem[];
};

const statusLabels: Record<string, string> = {
  preparing: 'Preparando', in_approval: 'En aprobación', ready_to_send: 'Listo para enviar', sent: 'Enviado',
  partial_acceptance: 'Aceptación parcial', won: 'Ganado', mixed: 'Resultado mixto', lost: 'Perdido',
  draft: 'Borrador', pending: 'En aprobación', 'internally-approved': 'Aprobada internamente', viewed: 'Vista',
  approved: 'Ganada', rejected: 'Perdida', 'in-negotiation': 'En negociación', expired: 'Vencida',
};

const statusTone = (status: string) => status === 'approved' || status === 'won' ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
  : status === 'rejected' || status === 'lost' || status === 'expired' ? 'border-red-200 bg-red-50 text-red-800'
  : status === 'internally-approved' || status === 'ready_to_send' ? 'border-indigo-200 bg-indigo-50 text-indigo-800'
  : 'border-slate-200 bg-slate-50 text-slate-700';

export default function QuotationGroupWorkspacePage() {
  const [, params] = useRoute('/quotation-groups/:id');
  const groupId = Number(params?.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sendOpen, setSendOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [message, setMessage] = useState('Preparamos estas propuestas para que puedan evaluar cada alcance por separado.');
  const [sharedOpen, setSharedOpen] = useState(false);
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS');
  const [fx, setFx] = useState('');
  const [paymentTermsDays, setPaymentTermsDays] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: workspace, isLoading, isError, refetch } = useQuery<GroupWorkspace>({
    queryKey: [`/api/quotation-groups/${groupId}`], enabled: Number.isInteger(groupId), staleTime: 15_000,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: [`/api/quotation-groups/${groupId}`] });
  const runAction = useMutation({
    mutationFn: async ({ endpoint, body, headers }: { endpoint: string; body: any; headers?: Record<string, string> }) => apiRequest(endpoint, { method: 'POST', body, headers }),
    onSuccess: () => { setActionError(null); void refresh(); },
    onError: (error) => setActionError(getApiErrorMessage(error, 'No pudimos completar la acción.')),
  });

  const configuredDrafts = workspace?.items.filter((item) => item.status === 'draft' && item.configuredAt) ?? [];
  const approvedToSend = workspace?.items.filter((item) => item.status === 'internally-approved') ?? [];
  const mutableDrafts = workspace?.items.filter((item) => item.status === 'draft') ?? [];
  const pendingItem = workspace?.items.find((item) => !item.configuredAt) || workspace?.items.find((item) => item.status === 'draft');
  const subtotals = useMemo(() => Object.entries((workspace?.items || []).reduce<Record<string, number>>((totals, item) => {
    totals[item.currency] = (totals[item.currency] || 0) + Number(item.totalAmount || 0);
    return totals;
  }, {})), [workspace]);
  const formatMoney = (amount: number, itemCurrency: string) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: itemCurrency, maximumFractionDigits: itemCurrency === 'USD' ? 2 : 0 }).format(amount);

  if (isLoading) return <div className="flex min-h-[22rem] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  if (isError || !workspace) return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>No pudimos abrir el grupo</AlertTitle><AlertDescription><Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}><RefreshCw className="mr-2 h-4 w-4" />Reintentar</Button></AlertDescription></Alert>;

  return (
    <PageLayout
      title={workspace.group.name}
      description={`${workspace.group.groupNumber} · ${workspace.items.length} propuestas independientes para ${workspace.client?.name || 'el cliente'}`}
      breadcrumbs={[{ label: 'Cotizaciones', href: '/quotations' }, { label: workspace.group.groupNumber, current: true }]}
      actions={<Button variant="outline" onClick={() => setSharedOpen(true)} disabled={mutableDrafts.length === 0}><Settings2 className="mr-2 h-4 w-4" />Datos comunes</Button>}
    >
      <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-sm">
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div><div className="flex items-center gap-2"><Layers3 className="h-5 w-5 text-indigo-300" /><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Panel del grupo</p></div><h2 className="mt-3 text-2xl font-semibold">{statusLabels[workspace.status] || workspace.status}</h2><p className="mt-2 max-w-2xl text-sm text-slate-300">Configurá cada alcance por separado. Las acciones agrupadas sólo incluyen propuestas que cumplen todos sus controles.</p></div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {pendingItem && <Button onClick={() => setLocation(`/optimized-quote/${pendingItem.quotationId}?groupId=${groupId}`)}>Continuar pendientes <ArrowRight className="ml-2 h-4 w-4" /></Button>}
            <Button variant="secondary" disabled={configuredDrafts.length === 0 || runAction.isPending} onClick={() => runAction.mutate({ endpoint: `/api/quotation-groups/${groupId}/submit-approval`, body: { quotationIds: configuredDrafts.map((item) => item.quotationId) } })}><ClipboardCheck className="mr-2 h-4 w-4" />Enviar a aprobación ({configuredDrafts.length})</Button>
            <Button variant="secondary" disabled={workspace.items.length === 0 || runAction.isPending} onClick={() => runAction.mutate({ endpoint: `/api/quotation-groups/${groupId}/qa`, body: { quotationIds: workspace.items.map((item) => item.quotationId) } })}><FileCheck2 className="mr-2 h-4 w-4" />Ejecutar QA</Button>
            <Button variant="secondary" disabled={approvedToSend.length === 0} onClick={() => setSendOpen(true)}><Send className="mr-2 h-4 w-4" />Preparar envío ({approvedToSend.length})</Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 px-5 py-3 text-xs text-slate-300 sm:px-6">
          {subtotals.map(([itemCurrency, total]) => <span key={itemCurrency}>Subtotal {itemCurrency}: <strong className="text-white">{formatMoney(total, itemCurrency)}</strong></span>)}
          {subtotals.length > 1 && <span className="text-amber-300">No se suman monedas diferentes.</span>}
        </div>
      </section>

      {actionError && <Alert variant="destructive" className="mb-5"><AlertCircle className="h-4 w-4" /><AlertTitle>La acción quedó bloqueada</AlertTitle><AlertDescription>{actionError}</AlertDescription></Alert>}

      <div className="grid gap-4 xl:grid-cols-3">
        {workspace.items.map((item) => (
          <Card key={item.quotationId} className="overflow-hidden border-slate-200 shadow-sm">
            <CardContent className="p-0">
              <div className="border-b border-slate-100 p-5"><div className="flex items-start justify-between gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">{item.position}</span><Badge variant="outline" className={statusTone(item.status)}>{statusLabels[item.status] || item.status}</Badge></div><h3 className="mt-4 min-h-12 text-base font-semibold leading-6 text-slate-950">{item.projectName}</h3><p className="mt-1 text-xs text-slate-500">{item.quotationNumber} · {item.crm.opportunityName || 'Oportunidad CRM'}</p></div>
              <div className="space-y-4 p-5"><div><p className="text-2xl font-semibold tracking-tight text-slate-950">{formatMoney(item.totalAmount, item.currency)}</p><p className="mt-1 text-xs text-slate-500">Inversión de esta propuesta</p></div><div className="grid grid-cols-2 gap-2 text-xs"><Metric label="Configuración" value={item.configuredAt ? 'Completa' : `Paso ${Math.min(item.lastCompletedStep + 1, 6)} de 6`} ok={Boolean(item.configuredAt)} /><Metric label="Aprobación" value={item.approval.rejected ? 'Rechazada' : item.approval.pending ? `${item.approval.pending} pendiente(s)` : item.status === 'internally-approved' ? 'Aprobada' : 'Sin iniciar'} ok={item.status === 'internally-approved'} /><Metric label="QA" value={item.qa.stale ? 'Desactualizado' : item.qa.status === 'not_required' ? 'No requerido' : item.qa.status} ok={item.qa.status === 'passed' || item.qa.status === 'not_required'} /><Metric label="CRM" value={item.crm.stage || 'qualified'} ok={item.crm.stage === 'won'} /></div><div className="flex gap-2"><Button className="flex-1" variant={item.configuredAt ? 'outline' : 'default'} onClick={() => setLocation(`/optimized-quote/${item.quotationId}?groupId=${groupId}`)}>{item.configuredAt ? 'Revisar' : 'Continuar'} <ArrowRight className="ml-2 h-4 w-4" /></Button><Button variant="ghost" onClick={() => setLocation(`/quotations/${item.quotationId}`)}>Detalle</Button></div></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={sharedOpen} onOpenChange={setSharedOpen}><DialogContent><DialogHeader><DialogTitle>Aplicar datos a los borradores</DialogTitle><DialogDescription>Se actualizarán {mutableDrafts.length} propuestas en una sola transacción. Las aprobadas o enviadas nunca se modificarán.</DialogDescription></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2"><div><Label>Moneda</Label><Select value={currency} onValueChange={(value) => setCurrency(value as 'ARS' | 'USD')}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ARS">ARS</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></div><div><Label>Tipo de cambio USD/ARS</Label><Input className="mt-2" inputMode="decimal" value={fx} onChange={(event) => setFx(event.target.value)} placeholder="Ej. 1.450" /></div><div className="sm:col-span-2"><Label>Plazo de pago (días)</Label><Input className="mt-2" inputMode="numeric" value={paymentTermsDays} onChange={(event) => setPaymentTermsDays(event.target.value)} placeholder="Ej. 30" /></div></div><DialogFooter><Button variant="outline" onClick={() => setSharedOpen(false)}>Cancelar</Button><Button disabled={!fx || mutableDrafts.length === 0 || runAction.isPending} onClick={async () => { try { await apiRequest(`/api/quotation-groups/${groupId}/shared`, 'PATCH', { lockVersions: mutableDrafts.map((item) => ({ quotationId: item.quotationId, lockVersion: item.lockVersion })), fields: { quotationCurrency: currency, exchangeRateAtQuote: Number(fx), ...(paymentTermsDays ? { paymentTermsDays: Number(paymentTermsDays) } : {}) } }); setSharedOpen(false); setActionError(null); void refresh(); toast({ title: 'Datos comunes actualizados', description: 'Los precios se recalcularon con el motor canónico y los documentos quedaron marcados para reconciliar.' }); } catch (error) { setActionError(getApiErrorMessage(error, 'No se aplicó ningún cambio.')); setSharedOpen(false); } }}>Confirmar y recalcular</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={sendOpen} onOpenChange={setSendOpen}><DialogContent><DialogHeader><DialogTitle>Enviar un único portal</DialogTitle><DialogDescription>El email no adjunta PDFs. El cliente recibirá un enlace seguro y podrá decidir cada propuesta por separado.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div><Label>Email del cliente</Label><Input className="mt-2" type="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} placeholder="cliente@empresa.com" /></div><div><Label>Mensaje</Label><Textarea className="mt-2" value={message} onChange={(event) => setMessage(event.target.value)} rows={4} /></div><div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"><Mail className="mr-2 inline h-4 w-4" />Incluye {approvedToSend.length} propuestas aprobadas y listas.</div></div><DialogFooter><Button variant="outline" onClick={() => setSendOpen(false)}>Cancelar</Button><Button disabled={!recipientEmail || runAction.isPending} onClick={() => runAction.mutate({ endpoint: `/api/quotation-groups/${groupId}/send`, headers: { 'Idempotency-Key': `group-send-${Date.now()}-${crypto.randomUUID()}` }, body: { quotationIds: approvedToSend.map((item) => item.quotationId), recipientEmail, message } }, { onSuccess: () => { setSendOpen(false); toast({ title: 'Portal enviado', description: 'El cliente recibió un único enlace seguro.' }); } })}>{runAction.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Enviar portal</Button></DialogFooter></DialogContent></Dialog>
    </PageLayout>
  );
}

function Metric({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-1 flex items-center gap-1 font-medium ${ok ? 'text-emerald-700' : 'text-slate-700'}`}>{ok && <CheckCircle2 className="h-3.5 w-3.5" />}{value}</p></div>;
}
