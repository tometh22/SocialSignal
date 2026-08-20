import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Building2, CalendarDays, CheckCircle2, Download, FileCheck2, MessageCircle, ShieldCheck, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

type Proposal = {
  quotation: {
    id: number; quotationNumber: string; revisionNumber: number; projectName: string; projectType: string;
    quotationCurrency: 'ARS' | 'USD'; expiresAt: string; status: string; taxLabel: string; taxRate: number;
    netAmount: number; taxAmount: number; grandTotal: number; paymentTermsDays?: number; paymentSchedule: Array<{ label: string; percentage: number; dueDays?: number }>;
    commercialTerms?: string; inclusions?: string; exclusions?: string; termsVersion: string; deliverables: unknown[];
  };
  client?: { name: string; contactName?: string } | null;
  billingEntity?: { razonSocial: string; country?: string; taxId?: string } | null;
  team: Array<{ roleName?: string; hours: number }>;
  variants: Array<{ id: number; variantName: string; variantDescription?: string; totalAmount: number; netAmount: number; taxAmount: number; grandTotal: number }>;
  proposalDocument?: { locale: 'es' | 'en'; content: { theme: { primaryColor: string; accentColor: string; clientLogoUrl?: string | null }; assets: Array<{ id: string; type: string; url: string; altText: string }>; blocks: Array<{ id: string; type: string; title: string; body?: string; bullets: string[]; visible: boolean; internalOnly: boolean }> } } | null;
  documentHash?: string;
};

export default function PublicProposal() {
  const [, params] = useRoute<{ token: string }>("/proposal/:token");
  const token = params?.token || '';
  const [decision, setDecision] = useState<'accept' | 'reject' | 'negotiate'>('accept');
  const [variantId, setVariantId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery<Proposal>({
    queryKey: ['/api/public/quotations', token],
    queryFn: async () => {
      const response = await fetch(`/api/public/quotations/${encodeURIComponent(token)}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'No se pudo abrir la propuesta');
      return payload;
    },
    enabled: Boolean(token),
    retry: false,
  });
  const format = (amount: number) => new Intl.NumberFormat(data?.quotation.quotationCurrency === 'USD' ? 'en-US' : 'es-AR', {
    style: 'currency', currency: data?.quotation.quotationCurrency || 'ARS', minimumFractionDigits: data?.quotation.quotationCurrency === 'USD' ? 2 : 0,
  }).format(amount);
  const selectedVariant = data?.variants.find((variant) => variant.id === variantId);
  const displayedPrice = selectedVariant || data?.quotation;
  const submit = async () => {
    if (!data || !consent || name.trim().length < 2 || !email.includes('@') || (decision !== 'accept' && reason.trim().length < 3) || (decision === 'accept' && data.variants.length > 0 && !variantId)) return;
    setSubmitting(true); setSubmitError(null);
    try {
      const response = await fetch(`/api/public/quotations/${encodeURIComponent(token)}/decision`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, variantId: variantId || undefined, name, email, reason: reason || undefined, consent: true }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'No se pudo registrar la decisión');
      setCompleted(payload.status);
    } catch (submitFailure) {
      setSubmitError(submitFailure instanceof Error ? submitFailure.message : 'No se pudo registrar la decisión');
    } finally { setSubmitting(false); }
  };

  if (isLoading) return <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">Abriendo propuesta segura…</main>;
  if (error || !data) return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><Card className="max-w-lg"><CardContent className="p-8 text-center"><XCircle className="mx-auto mb-3 h-10 w-10 text-red-500" /><h1 className="text-lg font-semibold">Propuesta no disponible</h1><p className="mt-2 text-sm text-slate-500">{error instanceof Error ? error.message : 'El enlace no es válido o está vencido.'}</p></CardContent></Card></main>;
  if (completed) return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><Card className="max-w-lg"><CardContent className="p-8 text-center"><CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-500" /><h1 className="text-xl font-semibold">Respuesta registrada</h1><p className="mt-2 text-sm text-slate-500">Guardamos tu decisión con la revisión, los términos y la evidencia de aceptación. El equipo comercial fue notificado.</p></CardContent></Card></main>;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:py-12">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col justify-between gap-4 rounded-2xl bg-slate-950 p-6 text-white sm:flex-row sm:items-center">
          <div>{data.proposalDocument?.content.theme.clientLogoUrl && <img src={data.proposalDocument.content.theme.clientLogoUrl} alt="Logo del cliente" className="mb-4 h-9 max-w-40 object-contain object-left brightness-0 invert" />}<div className="mb-2 flex items-center gap-2 text-xs text-slate-300"><ShieldCheck className="h-4 w-4" /> Propuesta segura y verificable</div><h1 className="text-2xl font-semibold">{data.quotation.projectName}</h1><p className="mt-1 text-sm text-slate-300">{data.quotation.quotationNumber} · Revisión {data.quotation.revisionNumber}</p></div>
          <div className="text-left sm:text-right"><Badge className="bg-white/10 text-white">Válida hasta {new Date(data.quotation.expiresAt).toLocaleDateString('es-AR')}</Badge><p className="mt-3 text-3xl font-bold">{format(displayedPrice?.grandTotal || 0)}</p>{selectedVariant && <p className="mt-1 text-xs text-slate-300">Alternativa {selectedVariant.variantName}</p>}</div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            {data.proposalDocument?.content.blocks
              .filter((block) => block.visible && !block.internalOnly && block.type !== 'cover' && block.type !== 'closing')
              .map((block) => (
                <Card key={block.id}>
                  <CardHeader><CardTitle className="text-lg">{block.title}</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm text-slate-600">
                    {block.body && <p className="whitespace-pre-wrap leading-6">{block.body}</p>}
                    {block.bullets.length > 0 && <ul className="space-y-2">{block.bullets.map((bullet, index) => <li key={`${block.id}-${index}`} className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" /><span>{bullet}</span></li>)}</ul>}
                  </CardContent>
                </Card>
              ))}
            <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4 text-indigo-600" /> Cliente y alcance</CardTitle></CardHeader><CardContent className="space-y-4 text-sm"><div><p className="font-medium">{data.billingEntity?.razonSocial || data.client?.name}</p>{data.billingEntity?.taxId && <p className="text-slate-500">{data.billingEntity.taxId} · {data.billingEntity.country}</p>}</div>{data.quotation.inclusions && <section><h2 className="mb-1 font-medium">Incluye</h2><p className="whitespace-pre-wrap text-slate-600">{data.quotation.inclusions}</p></section>}{data.quotation.exclusions && <section><h2 className="mb-1 font-medium">No incluye</h2><p className="whitespace-pre-wrap text-slate-600">{data.quotation.exclusions}</p></section>}</CardContent></Card>
            {data.variants.length > 0 && <Card><CardHeader><CardTitle className="text-base">Alternativas disponibles</CardTitle></CardHeader><CardContent><RadioGroup value={variantId ? String(variantId) : ''} onValueChange={(value) => setVariantId(Number(value))} className="space-y-3">{data.variants.map((variant) => <label key={variant.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${variantId === variant.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}><RadioGroupItem value={String(variant.id)} className="mt-1" /><span className="flex-1"><span className="flex justify-between gap-3"><strong>{variant.variantName}</strong><strong>{format(variant.grandTotal)}</strong></span>{variant.variantDescription && <span className="mt-1 block text-xs text-slate-500">{variant.variantDescription}</span>}</span></label>)}</RadioGroup></CardContent></Card>}
            <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4 text-indigo-600" /> Condiciones económicas</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><div className="flex justify-between"><span>Neto</span><span>{format(displayedPrice?.netAmount || 0)}</span></div><div className="flex justify-between"><span>{data.quotation.taxLabel} ({data.quotation.taxRate}%)</span><span>{format(displayedPrice?.taxAmount || 0)}</span></div><div className="flex justify-between border-t pt-2 text-base font-semibold"><span>Total</span><span>{format(displayedPrice?.grandTotal || 0)}</span></div><p className="pt-2 text-xs text-slate-500">Pago a {data.quotation.paymentTermsDays ?? 0} días. Términos versión {data.quotation.termsVersion}.</p>{data.quotation.commercialTerms && <p className="whitespace-pre-wrap pt-3 text-slate-600">{data.quotation.commercialTerms}</p>}<Button variant="outline" className="mt-3" onClick={() => window.open(`/api/public/quotations/${encodeURIComponent(token)}/document.pdf`, '_blank')}><Download className="mr-2 h-4 w-4" /> Descargar PDF</Button></CardContent></Card>
          </div>

          <Card className="h-fit lg:sticky lg:top-6"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileCheck2 className="h-4 w-4 text-indigo-600" /> Responder propuesta</CardTitle></CardHeader><CardContent className="space-y-4"><RadioGroup value={decision} onValueChange={(value) => setDecision(value as typeof decision)}><label className="flex items-center gap-2"><RadioGroupItem value="accept" /> Aceptar propuesta</label><label className="flex items-center gap-2"><RadioGroupItem value="negotiate" /> Solicitar negociación</label><label className="flex items-center gap-2"><RadioGroupItem value="reject" /> Rechazar propuesta</label></RadioGroup><div className="space-y-2"><Label htmlFor="decision-name">Nombre y apellido</Label><Input id="decision-name" value={name} onChange={(event) => setName(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="decision-email">Email corporativo</Label><Input id="decision-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div>{decision !== 'accept' && <div className="space-y-2"><Label htmlFor="decision-reason">Comentario</Label><Textarea id="decision-reason" rows={4} value={reason} onChange={(event) => setReason(event.target.value)} /></div>}<label className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600"><Checkbox checked={consent} onCheckedChange={(checked) => setConsent(checked === true)} className="mt-0.5" /><span>Confirmo que tengo autorización para responder y acepto los términos comerciales versión {data.quotation.termsVersion} de esta revisión.</span></label>{submitError && <p role="alert" className="text-sm text-red-600">{submitError}</p>}<Button className="w-full" disabled={submitting || !consent || name.trim().length < 2 || !email.includes('@') || (decision !== 'accept' && reason.trim().length < 3) || (decision === 'accept' && data.variants.length > 0 && !variantId)} onClick={submit}>{decision === 'accept' ? <CheckCircle2 className="mr-2 h-4 w-4" /> : decision === 'negotiate' ? <MessageCircle className="mr-2 h-4 w-4" /> : <XCircle className="mr-2 h-4 w-4" />}{submitting ? 'Registrando…' : decision === 'accept' ? 'Aceptar y confirmar' : decision === 'negotiate' ? 'Solicitar negociación' : 'Rechazar propuesta'}</Button><p className="break-all text-[10px] text-slate-400">Hash: {data.documentHash}</p></CardContent></Card>
        </div>
      </div>
    </main>
  );
}
