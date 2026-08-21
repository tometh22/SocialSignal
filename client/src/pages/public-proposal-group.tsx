import { useState } from 'react';
import { useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Download, Files, Loader2, MessageCircle, ShieldCheck, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';

type PublicGroupItem = {
  quotationId: number; quotationNumber: string; projectName: string; status: string; currency: 'ARS' | 'USD';
  totalAmount: number; netAmount: number; taxAmount: number; taxLabel: string; taxRate: number; termsVersion: string;
  variants: Array<{ id: number; name: string; description?: string; totalAmount: number }>;
};
type PublicGroup = { group: { groupNumber: string; name: string; expiresAt: string | null }; client: { name: string } | null; status: string; items: PublicGroupItem[] };
type DecisionState = { decision: 'accept' | 'reject' | 'negotiate'; variantId: number | null; reason: string; consent: boolean; submitting: boolean; completed: string | null; error: string | null };
const initialDecision = (): DecisionState => ({ decision: 'accept', variantId: null, reason: '', consent: false, submitting: false, completed: null, error: null });

export default function PublicProposalGroupPage() {
  const [, params] = useRoute<{ token: string }>('/proposal-group/:token');
  const token = params?.token || '';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [decisions, setDecisions] = useState<Record<number, DecisionState>>({});
  const { data, isLoading, error, refetch } = useQuery<PublicGroup>({
    queryKey: ['/api/public/quotation-groups', token],
    queryFn: async () => {
      const response = await fetch(`/api/public/quotation-groups/${encodeURIComponent(token)}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'No se pudo abrir el portal');
      return payload;
    },
    enabled: Boolean(token), retry: false,
  });
  const stateFor = (id: number) => decisions[id] || initialDecision();
  const update = (id: number, patch: Partial<DecisionState>) => setDecisions((current) => ({ ...current, [id]: { ...(current[id] || initialDecision()), ...patch } }));
  const formatMoney = (amount: number, currency: string) => new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'es-AR', { style: 'currency', currency, maximumFractionDigits: currency === 'USD' ? 2 : 0 }).format(amount);
  const submit = async (item: PublicGroupItem) => {
    const state = stateFor(item.quotationId);
    update(item.quotationId, { submitting: true, error: null });
    try {
      const response = await fetch(`/api/public/quotation-groups/${encodeURIComponent(token)}/quotations/${item.quotationId}/decision`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          decision: state.decision, variantId: state.variantId || undefined, name, email,
          reason: state.reason || undefined, consent: true,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'No se pudo registrar la decisión');
      update(item.quotationId, { submitting: false, completed: payload.status });
      void refetch();
    } catch (submitError) {
      update(item.quotationId, { submitting: false, error: submitError instanceof Error ? submitError.message : 'No se pudo registrar la decisión' });
    }
  };

  if (isLoading) return <main className="flex min-h-screen items-center justify-center bg-slate-50"><Loader2 className="h-7 w-7 animate-spin text-slate-400" /><span className="ml-3 text-sm text-slate-500">Abriendo portal seguro…</span></main>;
  if (error || !data) return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><Card className="max-w-lg"><CardContent className="p-8 text-center"><XCircle className="mx-auto h-10 w-10 text-red-500" /><h1 className="mt-4 text-xl font-semibold">Portal no disponible</h1><p className="mt-2 text-sm text-slate-500">{error instanceof Error ? error.message : 'El enlace no es válido o está vencido.'}</p></CardContent></Card></main>;

  return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:py-12"><div className="mx-auto max-w-6xl space-y-6">
    <header className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl"><div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end"><div><div className="flex items-center gap-2 text-xs font-medium text-indigo-200"><ShieldCheck className="h-4 w-4" />Portal seguro · decisiones independientes</div><h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">{data.group.name}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Preparamos {data.items.length} propuestas para {data.client?.name}. Podés aceptar, rechazar o solicitar cambios en cada alcance por separado.</p></div><div className="flex flex-col gap-3 lg:items-end"><Badge className="w-fit bg-white/10 text-white">{data.group.groupNumber}</Badge>{data.group.expiresAt && <p className="text-xs text-slate-300">Válidas hasta {new Date(data.group.expiresAt).toLocaleDateString('es-AR')}</p>}<Button variant="secondary" onClick={() => window.open(`/api/public/quotation-groups/${encodeURIComponent(token)}/documents.zip`, '_blank')}><Files className="mr-2 h-4 w-4" />Descargar todos</Button></div></div></header>

    <Card className="border-slate-200"><CardContent className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6"><div><Label htmlFor="group-decision-name">Nombre y apellido</Label><Input id="group-decision-name" className="mt-2" value={name} onChange={(event) => setName(event.target.value)} placeholder="Tu nombre" /></div><div><Label htmlFor="group-decision-email">Email corporativo</Label><Input id="group-decision-email" type="email" className="mt-2" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nombre@empresa.com" /></div><p className="text-xs text-slate-500 sm:col-span-2">Estos datos se solicitan una sola vez y se usan como evidencia en las respuestas que confirmes.</p></CardContent></Card>

    <div className="grid items-start gap-5 lg:grid-cols-3">{data.items.map((item, index) => {
      const state = stateFor(item.quotationId);
      const decided = state.completed || ['approved', 'rejected'].includes(item.status);
      const selectedVariant = item.variants.find((variant) => variant.id === state.variantId);
      const amount = selectedVariant?.totalAmount ?? item.totalAmount;
      const canSubmit = name.trim().length >= 2 && email.includes('@') && state.consent && (state.decision === 'accept' ? item.variants.length === 0 || Boolean(state.variantId) : state.reason.trim().length >= 3);
      return <Card key={item.quotationId} className="overflow-hidden border-slate-200 shadow-sm"><CardContent className="p-0"><div className="border-b border-slate-100 p-5"><div className="flex items-center justify-between"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">{index + 1}</span>{decided && <Badge className="bg-emerald-50 text-emerald-700"><CheckCircle2 className="mr-1 h-3 w-3" />Respondida</Badge>}</div><h2 className="mt-4 min-h-[4.5rem] text-lg font-semibold leading-6 text-slate-950">{item.projectName}</h2><p className="mt-2 text-xs text-slate-500">{item.quotationNumber}</p><p className="mt-4 text-2xl font-semibold tracking-tight">{formatMoney(amount, item.currency)}</p><Button variant="outline" size="sm" className="mt-4" onClick={() => window.open(`/api/public/quotation-groups/${encodeURIComponent(token)}/quotations/${item.quotationId}/document.pdf`, '_blank')}><Download className="mr-2 h-4 w-4" />Ver PDF</Button></div>
        <div className="space-y-4 p-5">{decided ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="mb-2 h-5 w-5" /><strong>Respuesta registrada.</strong><p className="mt-1 text-xs">Las demás propuestas siguen disponibles.</p></div> : <><RadioGroup value={state.decision} onValueChange={(value) => update(item.quotationId, { decision: value as DecisionState['decision'] })} className="space-y-2 text-sm"><label className="flex items-center gap-2"><RadioGroupItem value="accept" />Aceptar</label><label className="flex items-center gap-2"><RadioGroupItem value="negotiate" />Solicitar cambios</label><label className="flex items-center gap-2"><RadioGroupItem value="reject" />Rechazar</label></RadioGroup>{state.decision === 'accept' && item.variants.length > 0 && <RadioGroup value={state.variantId ? String(state.variantId) : ''} onValueChange={(value) => update(item.quotationId, { variantId: Number(value) })} className="space-y-2">{item.variants.map((variant) => <label key={variant.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-3 text-xs"><RadioGroupItem value={String(variant.id)} /><span className="flex-1"><strong>{variant.name}</strong><span className="mt-1 block text-slate-500">{formatMoney(variant.totalAmount, item.currency)}</span></span></label>)}</RadioGroup>}{state.decision !== 'accept' && <div><Label className="text-xs">Comentario</Label><Textarea className="mt-2" rows={3} value={state.reason} onChange={(event) => update(item.quotationId, { reason: event.target.value })} /></div>}<label className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600"><Checkbox checked={state.consent} onCheckedChange={(checked) => update(item.quotationId, { consent: checked === true })} /><span>Confirmo que puedo responder esta propuesta y acepto sus términos versión {item.termsVersion}.</span></label>{state.error && <p role="alert" className="text-xs text-red-600">{state.error}</p>}<Button className="w-full" disabled={!canSubmit || state.submitting} onClick={() => void submit(item)}>{state.submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : state.decision === 'accept' ? <CheckCircle2 className="mr-2 h-4 w-4" /> : state.decision === 'negotiate' ? <MessageCircle className="mr-2 h-4 w-4" /> : <XCircle className="mr-2 h-4 w-4" />}{state.decision === 'accept' ? 'Aceptar propuesta' : state.decision === 'negotiate' ? 'Solicitar cambios' : 'Rechazar propuesta'}</Button></>}</div>
      </CardContent></Card>;
    })}</div>
  </div></main>;
}
