import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest, authFetch } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Building2, Mail, Phone, User, Plus, Trash2, CheckCircle2,
  Bell, FileText, MessageSquare, Calendar, Target, Edit3, Trophy, XCircle,
  Clock, ChevronDown, ChevronUp, AlertCircle, Briefcase, Paperclip, Download, X
} from "lucide-react";

type Stage = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';
type ActivityType = 'note' | 'call' | 'email' | 'meeting' | 'proposal' | 'followup';

const STAGES: { key: Stage; label: string; color: string; bg: string; border: string }[] = [
  { key: 'new',         label: 'Nuevo',        color: 'text-slate-700',   bg: 'bg-slate-100',   border: 'border-slate-300' },
  { key: 'contacted',   label: 'Contactado',   color: 'text-blue-700',    bg: 'bg-blue-100',    border: 'border-blue-300' },
  { key: 'qualified',   label: 'Calificado',   color: 'text-indigo-700',  bg: 'bg-indigo-100',  border: 'border-indigo-300' },
  { key: 'proposal',    label: 'Propuesta',    color: 'text-amber-700',   bg: 'bg-amber-100',   border: 'border-amber-300' },
  { key: 'negotiation', label: 'Negociación',  color: 'text-orange-700',  bg: 'bg-orange-100',  border: 'border-orange-300' },
  { key: 'won',         label: 'Ganado',       color: 'text-green-700',   bg: 'bg-green-100',   border: 'border-green-300' },
  { key: 'lost',        label: 'Perdido',      color: 'text-red-700',     bg: 'bg-red-100',     border: 'border-red-300' },
];

const ACTIVITY_ICONS: Record<ActivityType, { icon: any; color: string; bg: string; label: string }> = {
  note:     { icon: MessageSquare, color: 'text-slate-600', bg: 'bg-slate-100',  label: 'Nota' },
  call:     { icon: Phone,         color: 'text-blue-600',  bg: 'bg-blue-100',   label: 'Llamada' },
  email:    { icon: Mail,          color: 'text-indigo-600',bg: 'bg-indigo-100', label: 'Email' },
  meeting:  { icon: Calendar,      color: 'text-purple-600',bg: 'bg-purple-100', label: 'Reunión' },
  proposal: { icon: FileText,      color: 'text-amber-600', bg: 'bg-amber-100',  label: 'Propuesta' },
  followup: { icon: Bell,          color: 'text-orange-600',bg: 'bg-orange-100', label: 'Follow-up' },
};

function stageMeta(stage: Stage) { return STAGES.find(s => s.key === stage) || STAGES[0]; }
function fmtUsd(val: number | null | undefined) {
  if (!val) return '—';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
}
function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtDateShort(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}
function daysSince(d: string | null) {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
}
function isOverdue(d: string) { return new Date(d) < new Date(); }

interface Contact { id: number; name: string; email: string | null; phone: string | null; position: string | null; isPrimary: boolean; }
interface Activity { id: number; type: ActivityType; title: string | null; content: string | null; activityDate: string; emailMetadata: any; }
interface Reminder { id: number; description: string; dueDate: string; completed: boolean; }
interface LinkedQuotation {
  id: number; projectName: string; totalAmount: number;
  quotationCurrency: string; status: string; createdAt: string;
}
interface Lead {
  id: number; companyName: string; stage: Stage; source: string | null;
  estimatedValueUsd: number | null; notes: string | null; clientId: number | null;
  createdAt: string; updatedAt: string; lostReason: string | null;
  contacts: Contact[]; activities: Activity[]; reminders: Reminder[];
  quotations: LinkedQuotation[];
}

export default function CRMLeadPage({ params }: { params: { id: string } }) {
  const leadId = parseInt(params.id);
  const [, navigate] = useLocation();
  const { toast } = useToast();



  const [newActivity, setNewActivity] = useState({ type: 'note' as ActivityType, title: '', content: '' });
  const [activityOpen, setActivityOpen] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const [newContact, setNewContact] = useState({ name: '', email: '', phone: '', position: '', isPrimary: false });
  const [contactOpen, setContactOpen] = useState(false);

  const [newReminder, setNewReminder] = useState({ description: '', dueDate: '' });
  const [reminderOpen, setReminderOpen] = useState(false);

  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  const [editingValue, setEditingValue] = useState(false);
  const [tempValue, setTempValue] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [tempNotes, setTempNotes] = useState('');

  const { data: lead, isLoading, refetch } = useQuery<Lead>({
    queryKey: ['/api/crm/leads', leadId],
    queryFn: async () => {
      const res = await authFetch(`/api/crm/leads/${leadId}`);
      return res.json();
    },
  });

  const { data: clients = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['/api/clients'],
  });

  const invalidate = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['/api/crm/leads'] });
  };

  const updateLead = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/crm/leads/${leadId}`, 'PATCH', data),
    onSuccess: () => { invalidate(); queryClient.invalidateQueries({ queryKey: ['/api/crm/leads'] }); },
  });

  const addActivity = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/crm/leads/${leadId}/activities`, 'POST', data),
    onSuccess: () => {
      invalidate();
      setActivityOpen(false);
      setNewActivity({ type: 'note', title: '', content: '' });
      setAttachmentFile(null);
      toast({ title: 'Actividad registrada' });
    },
    onError: () => toast({ title: 'Error al registrar actividad', variant: 'destructive' }),
  });

  const handleSubmitActivity = async () => {
    let emailMetadata: any = undefined;
    if (newActivity.type === 'proposal' && attachmentFile) {
      setUploadingAttachment(true);
      try {
        const formData = new FormData();
        formData.append('file', attachmentFile);
        const res = await fetch('/api/crm/attachments', { method: 'POST', body: formData, credentials: 'include' });
        if (!res.ok) throw new Error('Error al subir archivo');
        const data = await res.json();
        emailMetadata = { attachment: { name: data.name, url: data.url, size: data.size, mimeType: data.mimeType } };
      } catch {
        toast({ title: 'Error al subir el archivo adjunto', variant: 'destructive' });
        setUploadingAttachment(false);
        return;
      }
      setUploadingAttachment(false);
    }
    addActivity.mutate({ ...newActivity, emailMetadata });
  };

  const deleteActivity = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/crm/activities/${id}`, 'DELETE'),
    onSuccess: () => { invalidate(); toast({ title: 'Actividad eliminada' }); },
  });

  const addContact = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/crm/leads/${leadId}/contacts`, 'POST', data),
    onSuccess: () => { invalidate(); setContactOpen(false); setNewContact({ name: '', email: '', phone: '', position: '', isPrimary: false }); toast({ title: 'Contacto agregado' }); },
    onError: () => toast({ title: 'Error al agregar contacto', variant: 'destructive' }),
  });

  const deleteContact = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/crm/contacts/${id}`, 'DELETE'),
    onSuccess: () => { invalidate(); toast({ title: 'Contacto eliminado' }); },
  });

  const addReminder = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/crm/leads/${leadId}/reminders`, 'POST', data),
    onSuccess: () => { invalidate(); setReminderOpen(false); setNewReminder({ description: '', dueDate: '' }); toast({ title: 'Recordatorio creado' }); },
    onError: () => toast({ title: 'Error al crear recordatorio', variant: 'destructive' }),
  });

  const toggleReminder = useMutation({
    mutationFn: ({ id, completed }: { id: number; completed: boolean }) =>
      apiRequest(`/api/crm/reminders/${id}`, 'PATCH', { completed }),
    onSuccess: () => invalidate(),
  });

  const deleteReminder = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/crm/reminders/${id}`, 'DELETE'),
    onSuccess: () => invalidate(),
  });


  const handleStageChange = (stage: string) => {
    updateLead.mutate({ stage });
  };

  const handleValueSave = () => {
    const val = parseFloat(tempValue);
    updateLead.mutate({ estimatedValueUsd: isNaN(val) ? null : val });
    setEditingValue(false);
  };

  const openEmailWith = (contact: Contact) => {
    setEmailTo(contact.email || '');
    setEmailOpen(true);
  };

  if (isLoading) return <div className="text-center py-16 text-slate-400">Cargando lead...</div>;
  if (!lead) return <div className="text-center py-16 text-slate-400">Lead no encontrado</div>;

  const meta = stageMeta(lead.stage);
  const daysSinceUpdate = daysSince(lead.updatedAt);
  const pendingReminders = lead.reminders.filter(r => !r.completed);
  const completedReminders = lead.reminders.filter(r => r.completed);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/crm')} className="gap-1.5 text-slate-500">
            <ArrowLeft className="w-4 h-4" /> CRM
          </Button>
          <div className="w-px h-5 bg-slate-200" />
          <div>
            <div className="flex items-center gap-3">
              {!editingName ? (
                <div className="flex items-center gap-2 group/name">
                  <h1 className="text-xl font-bold text-slate-900">{lead.companyName}</h1>
                  <button onClick={() => { setTempName(lead.companyName); setEditingName(true); }}
                    className="opacity-0 group-hover/name:opacity-100 text-slate-400 hover:text-indigo-600 transition-all">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input value={tempName} onChange={e => setTempName(e.target.value)}
                    className="h-8 text-lg font-bold w-64"
                    onKeyDown={e => {
                      if (e.key === 'Enter') { updateLead.mutate({ companyName: tempName }); setEditingName(false); }
                      if (e.key === 'Escape') setEditingName(false);
                    }}
                    autoFocus />
                  <Button size="sm" className="h-8 px-2 bg-indigo-600 text-white"
                    onClick={() => { updateLead.mutate({ companyName: tempName }); setEditingName(false); }}>✓</Button>
                  <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setEditingName(false)}>✕</Button>
                </div>
              )}
              {!editingName && (
                <Select value={lead.stage} onValueChange={handleStageChange}>
                  <SelectTrigger className={`w-36 h-7 text-xs font-semibold border ${meta.border} ${meta.bg} ${meta.color}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map(s => (
                      <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Creado el {fmtDate(lead.createdAt)} · Actualizado hace {daysSinceUpdate ?? 0} día{daysSinceUpdate !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lead.stage !== 'won' && (
            <Button size="sm" variant="outline"
              className="gap-1.5 border-green-300 text-green-700 hover:bg-green-50"
              onClick={() => updateLead.mutate({ stage: 'won' })}>
              <Trophy className="w-3.5 h-3.5" /> Ganado
            </Button>
          )}
          {lead.stage !== 'lost' && (
            <Button size="sm" variant="outline"
              className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50"
              onClick={() => updateLead.mutate({ stage: 'lost' })}>
              <XCircle className="w-3.5 h-3.5" /> Perdido
            </Button>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* LEFT: Timeline */}
        <div className="lg:col-span-2 space-y-4">
          {/* Add activity bar */}
          <Card className="border-slate-200">
            <CardContent className="p-3">
              {!activityOpen ? (
                <div className="flex gap-2">
                  {(['note', 'call', 'meeting', 'proposal', 'followup'] as ActivityType[]).map(type => {
                    const m = ACTIVITY_ICONS[type];
                    const Icon = m.icon;
                    return (
                      <button key={type} onClick={() => { setNewActivity(a => ({ ...a, type })); setActivityOpen(true); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:shadow-sm transition-all ${m.bg} ${m.color} border-transparent`}>
                        <Icon className="w-3.5 h-3.5" />{m.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {(['note', 'call', 'meeting', 'proposal', 'followup'] as ActivityType[]).map(type => {
                      const m = ACTIVITY_ICONS[type];
                      const Icon = m.icon;
                      return (
                        <button key={type} onClick={() => setNewActivity(a => ({ ...a, type }))}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${newActivity.type === type ? `${m.bg} ${m.color} border-current` : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                          <Icon className="w-3 h-3" />{m.label}
                        </button>
                      );
                    })}
                  </div>
                  <Input placeholder="Título (opcional)" value={newActivity.title}
                    onChange={e => setNewActivity(a => ({ ...a, title: e.target.value }))} />
                  <Textarea placeholder="Descripción, detalles de la conversación..." value={newActivity.content}
                    onChange={e => setNewActivity(a => ({ ...a, content: e.target.value }))} rows={3} />
                  {newActivity.type === 'proposal' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                        <Paperclip className="w-3.5 h-3.5" /> Adjuntar propuesta (PDF, Word, Excel)
                      </label>
                      {!attachmentFile ? (
                        <label className="flex items-center gap-2 px-3 py-2 border-2 border-dashed border-amber-300 rounded-lg cursor-pointer hover:border-amber-400 hover:bg-amber-50 transition-all text-xs text-amber-700">
                          <Paperclip className="w-4 h-4" />
                          <span>Seleccionar archivo...</span>
                          <input type="file" className="hidden"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg"
                            onChange={e => setAttachmentFile(e.target.files?.[0] || null)} />
                        </label>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                          <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                          <span className="text-xs text-amber-800 flex-1 truncate">{attachmentFile.name}</span>
                          <span className="text-xs text-amber-500">({(attachmentFile.size / 1024).toFixed(0)} KB)</span>
                          <button onClick={() => setAttachmentFile(null)} className="text-amber-400 hover:text-red-500 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setActivityOpen(false); setAttachmentFile(null); }}>Cancelar</Button>
                    <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white"
                      onClick={handleSubmitActivity}
                      disabled={addActivity.isPending || uploadingAttachment || (!newActivity.title && !newActivity.content)}>
                      {uploadingAttachment ? 'Subiendo...' : addActivity.isPending ? 'Guardando...' : 'Registrar'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity timeline */}
          <div className="space-y-2">
            {lead.activities.length === 0 && (
              <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                No hay actividades registradas aún. ¡Registrá tu primer interacción!
              </div>
            )}
            {lead.activities.map(activity => {
              const m = ACTIVITY_ICONS[activity.type] || ACTIVITY_ICONS.note;
              const Icon = m.icon;
              const hasMore = (activity.content && activity.content.length > 80) || activity.emailMetadata?.attachment || activity.emailMetadata?.to;
              return (
                <div key={activity.id} className="flex gap-3 group">
                  <div className={`w-8 h-8 rounded-full ${m.bg} flex items-center justify-center shrink-0 mt-1`}>
                    <Icon className={`w-4 h-4 ${m.color}`} />
                  </div>
                  <div
                    className="flex-1 bg-white border border-slate-200 rounded-xl p-3 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer"
                    onClick={() => setSelectedActivity(activity)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-semibold ${m.color}`}>{m.label}</span>
                          {activity.title && (
                            <span className="text-sm font-medium text-slate-800">{activity.title}</span>
                          )}
                        </div>
                        {activity.content && (
                          <p className="text-sm text-slate-500 mt-1 line-clamp-2">{activity.content}</p>
                        )}
                        {activity.emailMetadata?.attachment && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-700">
                            <Paperclip className="w-3 h-3" />
                            <span className="truncate max-w-[160px]">{(activity.emailMetadata.attachment as any).name}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-slate-400">{fmtDate(activity.activityDate)}</span>
                        <button onClick={e => { e.stopPropagation(); deleteActivity.mutate(activity.id); }}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Info sidebar */}
        <div className="space-y-4">
          {/* Lead info */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Información del Lead
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div>
                <p className="text-xs text-slate-500">Fuente</p>
                <p className="text-sm font-medium text-slate-800 capitalize">{lead.source || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Valor estimado</p>
                {!editingValue ? (
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-emerald-700">{fmtUsd(lead.estimatedValueUsd)}</p>
                    <button onClick={() => { setTempValue(lead.estimatedValueUsd?.toString() || ''); setEditingValue(true); }}
                      className="text-slate-400 hover:text-indigo-600 transition-colors">
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <Input type="number" value={tempValue} onChange={e => setTempValue(e.target.value)}
                      className="h-7 text-sm" placeholder="USD" />
                    <Button size="sm" className="h-7 px-2 bg-indigo-600 text-white" onClick={handleValueSave}>✓</Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingValue(false)}>✕</Button>
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-slate-500">Notas</p>
                  {!editingNotes && (
                    <button onClick={() => { setTempNotes(lead.notes || ''); setEditingNotes(true); }}
                      className="text-slate-400 hover:text-indigo-600 transition-colors">
                      <Edit3 className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {!editingNotes ? (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{lead.notes || '—'}</p>
                ) : (
                  <div className="space-y-2">
                    <Textarea value={tempNotes} onChange={e => setTempNotes(e.target.value)}
                      rows={3} className="text-sm" placeholder="Notas sobre el lead..." />
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingNotes(false)}>Cancelar</Button>
                      <Button size="sm" className="h-7 px-3 bg-indigo-600 text-white"
                        onClick={() => { updateLead.mutate({ notes: tempNotes }); setEditingNotes(false); }}>
                        Guardar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-slate-500">Cliente vinculado</p>
                </div>
                <Select
                  value={lead.clientId?.toString() ?? 'none'}
                  onValueChange={val => {
                    const newClientId = val === 'none' ? null : parseInt(val);
                    updateLead.mutate({ clientId: newClientId });
                  }}
                >
                  <SelectTrigger className="h-8 text-sm border-slate-200 bg-slate-50 hover:bg-white transition-colors">
                    <SelectValue placeholder="Sin cliente vinculado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-slate-400">Sin cliente vinculado</span>
                    </SelectItem>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {lead.clientId && (
                  <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    Cliente vinculado — podés crear cotizaciones desde este lead
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contacts */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <User className="w-4 h-4" /> Contactos ({lead.contacts.length})
                </CardTitle>
                <button onClick={() => setContactOpen(true)}
                  className="text-indigo-600 hover:text-indigo-800 transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {lead.contacts.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-2">Sin contactos. Agregá el primero.</p>
              )}
              {lead.contacts.map(contact => (
                <div key={contact.id} className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-slate-800 truncate">{contact.name}</p>
                      {contact.isPrimary && (
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 rounded">Principal</span>
                      )}
                    </div>
                    {contact.position && <p className="text-xs text-slate-500">{contact.position}</p>}
                    {contact.email && (
                      <button onClick={() => openEmailWith(contact)}
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 mt-0.5">
                        <Mail className="w-3 h-3" /> {contact.email}
                      </button>
                    )}
                    {contact.phone && (
                      <p className="flex items-center gap-1 text-xs text-slate-500">
                        <Phone className="w-3 h-3" /> {contact.phone}
                      </p>
                    )}
                  </div>
                  <button onClick={() => deleteContact.mutate(contact.id)}
                    className="text-slate-300 hover:text-red-500 transition-colors shrink-0 mt-0.5">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {contactOpen && (
                <div className="border border-indigo-200 rounded-lg p-3 bg-indigo-50 space-y-2">
                  <Input placeholder="Nombre *" value={newContact.name}
                    onChange={e => setNewContact(c => ({ ...c, name: e.target.value }))} className="bg-white" />
                  <Input placeholder="Cargo" value={newContact.position}
                    onChange={e => setNewContact(c => ({ ...c, position: e.target.value }))} className="bg-white" />
                  <Input type="email" placeholder="Email" value={newContact.email}
                    onChange={e => setNewContact(c => ({ ...c, email: e.target.value }))} className="bg-white" />
                  <Input placeholder="Teléfono" value={newContact.phone}
                    onChange={e => setNewContact(c => ({ ...c, phone: e.target.value }))} className="bg-white" />
                  <div className="flex items-center gap-2">
                    <Checkbox id="isPrimary" checked={newContact.isPrimary}
                      onCheckedChange={v => setNewContact(c => ({ ...c, isPrimary: !!v }))} />
                    <Label htmlFor="isPrimary" className="text-xs">Contacto principal</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setContactOpen(false)}>Cancelar</Button>
                    <Button size="sm" className="flex-1 bg-indigo-600 text-white"
                      onClick={() => addContact.mutate(newContact)}
                      disabled={!newContact.name || addContact.isPending}>
                      Agregar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reminders */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Bell className="w-4 h-4" /> Recordatorios
                  {pendingReminders.length > 0 && (
                    <span className="bg-amber-500 text-white text-xs px-1.5 rounded-full">{pendingReminders.length}</span>
                  )}
                </CardTitle>
                <button onClick={() => setReminderOpen(true)}
                  className="text-indigo-600 hover:text-indigo-800 transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {lead.reminders.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-2">Sin recordatorios</p>
              )}
              {pendingReminders.map(reminder => (
                <div key={reminder.id}
                  className={`flex items-start gap-2 p-2 rounded-lg border ${isOverdue(reminder.dueDate) ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
                  <Checkbox checked={false}
                    onCheckedChange={() => toggleReminder.mutate({ id: reminder.id, completed: true })}
                    className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-700">{reminder.description}</p>
                    <p className={`text-xs mt-0.5 flex items-center gap-1 ${isOverdue(reminder.dueDate) ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
                      <Clock className="w-3 h-3" />
                      {isOverdue(reminder.dueDate) ? 'Vencido · ' : ''}
                      {fmtDateShort(reminder.dueDate)}
                    </p>
                  </div>
                  <button onClick={() => deleteReminder.mutate(reminder.id)}
                    className="text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {completedReminders.length > 0 && (
                <details className="mt-1">
                  <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">
                    {completedReminders.length} completado{completedReminders.length > 1 ? 's' : ''}
                  </summary>
                  {completedReminders.map(r => (
                    <div key={r.id} className="flex items-center gap-2 py-1 opacity-50">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      <span className="text-xs text-slate-500 line-through">{r.description}</span>
                    </div>
                  ))}
                </details>
              )}

              {reminderOpen && (
                <div className="border border-amber-200 rounded-lg p-3 bg-amber-50 space-y-2">
                  <Textarea placeholder="¿Qué tenés que hacer?" value={newReminder.description}
                    onChange={e => setNewReminder(r => ({ ...r, description: e.target.value }))}
                    rows={2} className="bg-white" />
                  <div>
                    <Label className="text-xs text-slate-600">Fecha límite</Label>
                    <Input type="datetime-local" value={newReminder.dueDate}
                      onChange={e => setNewReminder(r => ({ ...r, dueDate: e.target.value }))} className="bg-white" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setReminderOpen(false)}>Cancelar</Button>
                    <Button size="sm" className="flex-1 bg-amber-600 text-white"
                      onClick={() => addReminder.mutate({ ...newReminder, dueDate: new Date(newReminder.dueDate).toISOString() })}
                      disabled={!newReminder.description || !newReminder.dueDate || addReminder.isPending}>
                      Crear
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cotizaciones vinculadas */}
          <Card className="border border-slate-200">
            <CardHeader className="pb-2 px-4 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-500" />
                  Cotizaciones
                  {lead?.quotations?.length ? (
                    <span className="ml-1 bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                      {lead.quotations.length}
                    </span>
                  ) : null}
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={() => {
                    if (!lead?.clientId) {
                      toast({ title: "Vinculá un cliente", description: "Primero asociá este lead a un cliente antes de crear una cotización.", variant: "destructive" });
                      return;
                    }
                    const leadName = encodeURIComponent(lead?.companyName || '');
                    window.location.href = `/optimized-quote?leadId=${leadId}&leadName=${leadName}&clientId=${lead.clientId}`;
                  }}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Nueva Cotización
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {!lead?.quotations?.length ? (
                <p className="text-xs text-slate-400 py-2 text-center">Sin cotizaciones vinculadas</p>
              ) : lead.quotations.map(q => {
                const statusMap: Record<string, { label: string; cls: string }> = {
                  draft:          { label: 'Borrador',      cls: 'bg-gray-100 text-gray-600' },
                  pending:        { label: 'Pendiente',     cls: 'bg-blue-100 text-blue-700' },
                  'in-negotiation': { label: 'Negociación', cls: 'bg-amber-100 text-amber-700' },
                  approved:       { label: 'Aprobada',      cls: 'bg-green-100 text-green-700' },
                  rejected:       { label: 'Rechazada',     cls: 'bg-red-100 text-red-700' },
                };
                const s = statusMap[q.status] || { label: q.status, cls: 'bg-gray-100 text-gray-600' };
                const amount = q.totalAmount
                  ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: q.quotationCurrency || 'ARS', maximumFractionDigits: 0 }).format(q.totalAmount)
                  : '—';
                return (
                  <div key={q.id} className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate">{q.projectName}</p>
                      <p className="text-xs text-slate-500">{amount}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
                      <a href={`/manage-quotes`} className="text-[10px] text-indigo-500 hover:underline">Ver</a>
                    </div>
                  </div>
                );
              })}
              {lead?.quotations?.some(q => q.status === 'approved') && lead?.stage !== 'won' && (
                <Button
                  size="sm"
                  className="w-full mt-2 bg-green-600 hover:bg-green-700 text-white text-xs h-8"
                  onClick={() => {
                    updateLead.mutate({ stage: 'won' });
                    toast({ title: "¡Ganado!", description: "El lead fue marcado como Ganado." });
                  }}
                >
                  <Trophy className="w-3 h-3 mr-1" />
                  Marcar como Ganado
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>


      {/* Activity Detail Modal */}
      {selectedActivity && (() => {
        const m = ACTIVITY_ICONS[selectedActivity.type] || ACTIVITY_ICONS.note;
        const Icon = m.icon;
        return (
          <Dialog open={!!selectedActivity} onOpenChange={open => { if (!open) setSelectedActivity(null); }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className={`w-7 h-7 rounded-full ${m.bg} flex items-center justify-center`}>
                    <Icon className={`w-3.5 h-3.5 ${m.color}`} />
                  </span>
                  <span className={`text-sm font-semibold ${m.color}`}>{m.label}</span>
                  {selectedActivity.title && (
                    <span className="text-slate-800 font-medium">— {selectedActivity.title}</span>
                  )}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{fmtDate(selectedActivity.activityDate)}</span>
                </div>
                {selectedActivity.content ? (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{selectedActivity.content}</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">Sin descripción.</p>
                )}
                {selectedActivity.emailMetadata?.to && (
                  <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
                    <Mail className="w-4 h-4 text-indigo-500 shrink-0" />
                    <div>
                      <span className="font-medium">Para:</span> {(selectedActivity.emailMetadata as any).to}
                      {(selectedActivity.emailMetadata as any).subject && (
                        <p className="text-xs text-slate-500 mt-0.5">Asunto: {(selectedActivity.emailMetadata as any).subject}</p>
                      )}
                    </div>
                  </div>
                )}
                {selectedActivity.emailMetadata?.attachment && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Adjunto</p>
                    <a
                      href={(selectedActivity.emailMetadata.attachment as any).url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={(selectedActivity.emailMetadata.attachment as any).name}
                      className="flex items-center gap-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                    >
                      <FileText className="w-5 h-5 text-amber-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-amber-900 font-medium truncate">
                          {(selectedActivity.emailMetadata.attachment as any).name}
                        </p>
                        {(selectedActivity.emailMetadata.attachment as any).size && (
                          <p className="text-xs text-amber-600">
                            {((selectedActivity.emailMetadata.attachment as any).size / 1024).toFixed(0)} KB
                          </p>
                        )}
                      </div>
                      <Download className="w-4 h-4 text-amber-500 shrink-0" />
                    </a>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
