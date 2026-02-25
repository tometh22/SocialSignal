import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Building2, Mail, Phone, User, Plus, Trash2, CheckCircle2,
  Bell, FileText, MessageSquare, Calendar, Target, Edit3, Trophy, XCircle,
  Send, Clock, ChevronDown, ChevronUp, AlertCircle, Briefcase
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
interface Lead {
  id: number; companyName: string; stage: Stage; source: string | null;
  estimatedValueUsd: number | null; notes: string | null;
  createdAt: string; updatedAt: string; lostReason: string | null;
  contacts: Contact[]; activities: Activity[]; reminders: Reminder[];
}

export default function CRMLeadPage({ params }: { params: { id: string } }) {
  const leadId = parseInt(params.id);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  const [newActivity, setNewActivity] = useState({ type: 'note' as ActivityType, title: '', content: '' });
  const [activityOpen, setActivityOpen] = useState(false);

  const [newContact, setNewContact] = useState({ name: '', email: '', phone: '', position: '', isPrimary: false });
  const [contactOpen, setContactOpen] = useState(false);

  const [newReminder, setNewReminder] = useState({ description: '', dueDate: '' });
  const [reminderOpen, setReminderOpen] = useState(false);

  const [editingValue, setEditingValue] = useState(false);
  const [tempValue, setTempValue] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [tempNotes, setTempNotes] = useState('');

  const { data: lead, isLoading, refetch } = useQuery<Lead>({
    queryKey: ['/api/crm/leads', leadId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/leads/${leadId}`, { credentials: 'include' });
      return res.json();
    },
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
    onSuccess: () => { invalidate(); setActivityOpen(false); setNewActivity({ type: 'note', title: '', content: '' }); toast({ title: 'Actividad registrada' }); },
    onError: () => toast({ title: 'Error al registrar actividad', variant: 'destructive' }),
  });

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

  const sendEmail = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/crm/leads/${leadId}/send-email`, 'POST', data),
    onSuccess: () => {
      invalidate();
      setEmailOpen(false);
      setEmailTo(''); setEmailSubject(''); setEmailBody('');
      toast({ title: 'Email enviado y registrado en el timeline' });
    },
    onError: () => toast({ title: 'Error al enviar email', variant: 'destructive' }),
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
      <div className="flex items-start justify-between gap-3">
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
          <Button size="sm" className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={() => setEmailOpen(true)}>
            <Mail className="w-3.5 h-3.5" /> Enviar Email
          </Button>
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
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setActivityOpen(false)}>Cancelar</Button>
                    <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white"
                      onClick={() => addActivity.mutate(newActivity)}
                      disabled={addActivity.isPending || (!newActivity.title && !newActivity.content)}>
                      {addActivity.isPending ? 'Guardando...' : 'Registrar'}
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
              return (
                <div key={activity.id} className="flex gap-3 group">
                  <div className={`w-8 h-8 rounded-full ${m.bg} flex items-center justify-center shrink-0 mt-1`}>
                    <Icon className={`w-4 h-4 ${m.color}`} />
                  </div>
                  <div className="flex-1 bg-white border border-slate-200 rounded-xl p-3 hover:border-slate-300 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-semibold ${m.color}`}>{m.label}</span>
                          {activity.title && (
                            <span className="text-sm font-medium text-slate-800">{activity.title}</span>
                          )}
                        </div>
                        {activity.content && (
                          <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{activity.content}</p>
                        )}
                        {activity.emailMetadata && (
                          <div className="mt-1 text-xs text-slate-500 bg-slate-50 rounded p-2">
                            <span className="font-medium">Para:</span> {(activity.emailMetadata as any).to}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-slate-400">{fmtDate(activity.activityDate)}</span>
                        <button onClick={() => deleteActivity.mutate(activity.id)}
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
        </div>
      </div>

      {/* Email Composer Sheet */}
      <Sheet open={emailOpen} onOpenChange={setEmailOpen}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-600" /> Enviar Email
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <div>
              <Label>Para *</Label>
              <Input type="email" placeholder="destinatario@empresa.com" value={emailTo}
                onChange={e => setEmailTo(e.target.value)} />
              {lead.contacts.filter(c => c.email).length > 0 && (
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {lead.contacts.filter(c => c.email).map(c => (
                    <button key={c.id} onClick={() => setEmailTo(c.email!)}
                      className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full hover:bg-indigo-100 transition-colors">
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label>Asunto *</Label>
              <Input placeholder="Asunto del email" value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)} />
            </div>
            <div>
              <Label>Mensaje *</Label>
              <Textarea placeholder="Redactá tu mensaje aquí..." value={emailBody}
                onChange={e => setEmailBody(e.target.value)} rows={10} className="resize-none" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setEmailOpen(false)}>Cancelar</Button>
              <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                onClick={() => sendEmail.mutate({ to: emailTo, subject: emailSubject, body: emailBody })}
                disabled={!emailTo || !emailSubject || !emailBody || sendEmail.isPending}>
                {sendEmail.isPending ? (
                  <><Clock className="w-4 h-4 animate-spin" /> Enviando...</>
                ) : (
                  <><Send className="w-4 h-4" /> Enviar Email</>
                )}
              </Button>
            </div>
            <p className="text-xs text-slate-400 text-center">
              El email quedará registrado automáticamente en el historial del lead.
            </p>
          </div>
        </SheetContent>
      </Sheet>

      {/* Add Contact Dialog */}
      <Dialog open={false} onOpenChange={() => {}}>
        <DialogContent />
      </Dialog>
    </div>
  );
}
