import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileDown, GitBranch, History, Mail, Send, ShieldCheck, XCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { getApiErrorMessage } from "@/lib/api-error";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CommercialHistory = {
  revisions: Array<{ id: number; revisionNumber: number; status: string; reason?: string; documentHash: string; createdAt: string }>;
  approvals: Array<{ id: number; revisionId: number; ruleLabel: string; status: string; requestedBy?: number; decisionReason?: string }>;
  deliveries: Array<{ id: number; recipientEmail: string; status: string; sentAt?: string; errorMessage?: string }>;
  events: Array<{ id: number; eventType: string; createdAt: string }>;
};

type Props = {
  quotationId: number;
  status: string;
  recipientEmail?: string | null;
  quotationNumber?: string | null;
  onChanged?: () => void;
};

export function CommercialWorkflowCard({ quotationId, status, recipientEmail, quotationNumber, onChanged }: Props) {
  const { toast } = useToast();
  const { isOperations } = usePermissions();
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<{ approvalId: number; value: 'approved' | 'rejected' } | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [sendOpen, setSendOpen] = useState(false);
  const [sendEmail, setSendEmail] = useState(recipientEmail || '');
  const [sendMessage, setSendMessage] = useState('Adjuntamos nuestra propuesta comercial. Puede revisarla y responder desde el enlace seguro.');
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionReason, setRevisionReason] = useState('');
  const [busy, setBusy] = useState(false);
  const { data } = useQuery<CommercialHistory>({ queryKey: [`/api/quotations/${quotationId}/commercial-history`] });
  const currentRevision = data?.revisions[0];
  const pendingApprovals = (data?.approvals || []).filter((approval) => approval.revisionId === currentRevision?.id && approval.status === 'pending');
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [`/api/quotations/${quotationId}/commercial-history`] }),
      queryClient.invalidateQueries({ queryKey: [`/api/quotations/${quotationId}`] }),
      queryClient.invalidateQueries({ queryKey: ['/api/quotations'] }),
      queryClient.invalidateQueries({ queryKey: ['/api/quotation-analytics/funnel'] }),
    ]);
    onChanged?.();
  };
  const decide = async () => {
    if (!decision || decisionReason.trim().length < 3) return;
    setBusy(true);
    try {
      await apiRequest(`/api/quotations/${quotationId}/approvals/${decision.approvalId}/decision`, 'POST', { decision: decision.value, reason: decisionReason });
      toast({ title: decision.value === 'approved' ? 'Aprobación registrada' : 'Devuelta a borrador' });
      setDecision(null); setDecisionReason(''); await refresh();
    } catch (error) {
      toast({ title: 'No se pudo registrar la decisión', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally { setBusy(false); }
  };
  const send = async () => {
    setBusy(true);
    try {
      await apiRequest(`/api/quotations/${quotationId}/send`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: { recipientEmail: sendEmail, message: sendMessage },
      });
      toast({ title: 'Propuesta enviada', description: 'El email, PDF y enlace de aceptación quedaron registrados.' });
      setSendOpen(false); await refresh();
    } catch (error) {
      toast({ title: 'No se pudo enviar', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally { setBusy(false); }
  };
  const revise = async () => {
    if (revisionReason.trim().length < 3) return;
    setBusy(true);
    try {
      await apiRequest(`/api/quotations/${quotationId}/revisions`, 'POST', { reason: revisionReason });
      toast({ title: 'Nueva revisión creada', description: 'La cotización volvió a borrador sin alterar los snapshots anteriores.' });
      setRevisionOpen(false); setRevisionReason(''); await refresh();
    } catch (error) {
      toast({ title: 'No se pudo crear la revisión', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <Card className="overflow-hidden border-indigo-100">
      <CardHeader className="border-b border-indigo-100 bg-indigo-50/40">
        <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
          <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-indigo-600" /> Gobierno comercial</span>
          <span className="flex items-center gap-2 text-xs font-normal text-slate-500">
            {quotationNumber || `#${quotationId}`} · Revisión {currentRevision?.revisionNumber || '—'}
            <Badge variant="outline">{status}</Badge>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => window.open(`/api/quotations/${quotationId}/document.pdf`, '_blank')}><FileDown className="mr-1.5 h-3.5 w-3.5" /> PDF verificable</Button>
          {status === 'internally-approved' && <Button type="button" size="sm" onClick={() => setSendOpen(true)}><Send className="mr-1.5 h-3.5 w-3.5" /> Enviar al cliente</Button>}
          {['internally-approved', 'sent', 'viewed', 'in-negotiation', 'approved', 'rejected', 'expired', 'cancelled', 'superseded'].includes(status) && <Button type="button" variant="outline" size="sm" onClick={() => setRevisionOpen(true)}><GitBranch className="mr-1.5 h-3.5 w-3.5" /> Nueva revisión</Button>}
        </div>
        {status === 'pending' && (
          <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-900"><ShieldCheck className="h-4 w-4" /> Aprobaciones pendientes ({pendingApprovals.length})</div>
            {pendingApprovals.map((approval) => (
              <div key={approval.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm">
                <span>{approval.ruleLabel}</span>
                {isOperations ? <span className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setDecision({ approvalId: approval.id, value: 'rejected' })}><XCircle className="mr-1 h-3.5 w-3.5 text-red-500" /> Rechazar</Button><Button size="sm" onClick={() => setDecision({ approvalId: approval.id, value: 'approved' })}><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Aprobar</Button></span> : <Badge variant="outline">Requiere Operaciones</Badge>}
              </div>
            ))}
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-3"><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-slate-500"><History className="h-3.5 w-3.5" /> Últimos eventos</div>{(data?.events || []).slice(0, 5).map((event) => <div key={event.id} className="flex justify-between py-1 text-xs text-slate-600"><span>{event.eventType}</span><span>{new Date(event.createdAt).toLocaleString('es-AR')}</span></div>)}</div>
          <div className="rounded-xl border border-slate-200 p-3"><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-slate-500"><Mail className="h-3.5 w-3.5" /> Entregas</div>{data?.deliveries.length ? data.deliveries.slice(0, 5).map((delivery) => <div key={delivery.id} className="flex justify-between py-1 text-xs text-slate-600"><span className="truncate">{delivery.recipientEmail}</span><Badge variant="outline" className="text-[10px]">{delivery.status}</Badge></div>) : <p className="text-xs text-slate-400">Todavía no fue enviada.</p>}</div>
        </div>
      </CardContent>

      <Dialog open={Boolean(decision)} onOpenChange={(open) => !open && setDecision(null)}><DialogContent><DialogHeader><DialogTitle>{decision?.value === 'approved' ? 'Aprobar regla comercial' : 'Rechazar y devolver a borrador'}</DialogTitle><DialogDescription>La decisión queda asociada a tu usuario y a esta revisión.</DialogDescription></DialogHeader><div className="space-y-2"><Label htmlFor="approval-reason">Fundamento</Label><Textarea id="approval-reason" value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} /></div><DialogFooter><Button variant="outline" onClick={() => setDecision(null)}>Cancelar</Button><Button disabled={busy || decisionReason.trim().length < 3} onClick={decide}>Confirmar</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={sendOpen} onOpenChange={setSendOpen}><DialogContent><DialogHeader><DialogTitle>Enviar propuesta aprobada</DialogTitle><DialogDescription>Se adjuntará el PDF de la revisión y un enlace seguro para aceptar, rechazar o negociar.</DialogDescription></DialogHeader><div className="space-y-3"><div className="space-y-2"><Label htmlFor="send-recipient">Destinatario</Label><Input id="send-recipient" type="email" value={sendEmail} onChange={(event) => setSendEmail(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="send-message">Mensaje</Label><Textarea id="send-message" rows={5} value={sendMessage} onChange={(event) => setSendMessage(event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => setSendOpen(false)}>Cancelar</Button><Button disabled={busy || !sendEmail.includes('@')} onClick={send}><Send className="mr-1.5 h-4 w-4" /> Enviar</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={revisionOpen} onOpenChange={setRevisionOpen}><DialogContent><DialogHeader><DialogTitle>Crear nueva revisión</DialogTitle><DialogDescription>La versión enviada o aceptada permanece inmutable y verificable por su hash.</DialogDescription></DialogHeader><div className="space-y-2"><Label htmlFor="revision-reason">Motivo del cambio</Label><Textarea id="revision-reason" value={revisionReason} onChange={(event) => setRevisionReason(event.target.value)} /></div><DialogFooter><Button variant="outline" onClick={() => setRevisionOpen(false)}>Cancelar</Button><Button disabled={busy || revisionReason.trim().length < 3} onClick={revise}><GitBranch className="mr-1.5 h-4 w-4" /> Crear revisión</Button></DialogFooter></DialogContent></Dialog>
    </Card>
  );
}
