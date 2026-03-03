import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest, authFetch } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Target, Plus, Search, TrendingUp, DollarSign, Trophy, AlertCircle,
  Bell, ChevronRight, LayoutGrid, List, Mail, Phone, RefreshCw, GripVertical, Trash2
} from "lucide-react";

type Stage = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';

const STAGES: { key: Stage; label: string; color: string; bg: string; border: string; dropActive: string }[] = [
  { key: 'new',         label: 'Nuevo',        color: 'text-slate-700',   bg: 'bg-slate-50',    border: 'border-slate-200',  dropActive: 'bg-slate-100 border-slate-400' },
  { key: 'contacted',   label: 'Contactado',   color: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200',   dropActive: 'bg-blue-100 border-blue-500' },
  { key: 'qualified',   label: 'Calificado',   color: 'text-indigo-700',  bg: 'bg-indigo-50',   border: 'border-indigo-200', dropActive: 'bg-indigo-100 border-indigo-500' },
  { key: 'proposal',    label: 'Propuesta',    color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200',  dropActive: 'bg-amber-100 border-amber-500' },
  { key: 'negotiation', label: 'Negociación',  color: 'text-orange-700',  bg: 'bg-orange-50',   border: 'border-orange-200', dropActive: 'bg-orange-100 border-orange-500' },
  { key: 'won',         label: 'Ganado',       color: 'text-green-700',   bg: 'bg-green-50',    border: 'border-green-200',  dropActive: 'bg-green-100 border-green-500' },
  { key: 'lost',        label: 'Perdido',      color: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200',    dropActive: 'bg-red-100 border-red-500' },
];

function stageMeta(stage: Stage) {
  return STAGES.find(s => s.key === stage) || STAGES[0];
}

function daysSince(dateStr: string | null) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function fmtUsd(val: number | null | undefined) {
  if (!val) return '—';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
}

interface Lead {
  id: number;
  companyName: string;
  stage: Stage;
  source: string | null;
  estimatedValueUsd: number | null;
  notes: string | null;
  updatedAt: string;
  createdAt: string;
  primaryContact: { name: string; email: string | null; phone: string | null } | null;
  lastActivity: { type: string; title: string | null; activityDate: string } | null;
  pendingReminders: number;
}

interface Stats {
  totalActive: number;
  totalPipelineUsd: number;
  wonThisMonth: number;
  overdueReminders: number;
  byStage: Record<string, number>;
}

function NewLeadModal({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    companyName: '', stage: 'new' as Stage, source: '',
    estimatedValueUsd: '', notes: '',
    contactName: '', contactEmail: '', contactPhone: '', contactPosition: '',
  });

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/crm/leads', data),
    onSuccess: () => {
      toast({ title: 'Lead creado correctamente' });
      setOpen(false);
      setForm({ companyName: '', stage: 'new', source: '', estimatedValueUsd: '', notes: '', contactName: '', contactEmail: '', contactPhone: '', contactPosition: '' });
      onSuccess();
    },
    onError: () => toast({ title: 'Error al crear el lead', variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
          <Plus className="w-4 h-4" /> Nuevo Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar Nuevo Lead</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Empresa *</Label>
              <Input placeholder="Nombre de la empresa" value={form.companyName}
                onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} />
            </div>
            <div>
              <Label>Etapa</Label>
              <Select value={form.stage} onValueChange={v => setForm(f => ({ ...f, stage: v as Stage }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGES.filter(s => s.key !== 'won' && s.key !== 'lost').map(s => (
                    <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fuente</Label>
              <Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="referido">Referido</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="web">Web / Inbound</SelectItem>
                  <SelectItem value="evento">Evento</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Valor estimado (USD)</Label>
              <Input type="number" placeholder="0" value={form.estimatedValueUsd}
                onChange={e => setForm(f => ({ ...f, estimatedValueUsd: e.target.value }))} />
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium text-slate-700 mb-3">Contacto principal (opcional)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nombre</Label>
                <Input placeholder="Nombre completo" value={form.contactName}
                  onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} />
              </div>
              <div>
                <Label>Cargo</Label>
                <Input placeholder="Ej: CEO, Marketing" value={form.contactPosition}
                  onChange={e => setForm(f => ({ ...f, contactPosition: e.target.value }))} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" placeholder="email@empresa.com" value={form.contactEmail}
                  onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input placeholder="+54 11 ..." value={form.contactPhone}
                  onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} />
              </div>
            </div>
          </div>

          <div>
            <Label>Notas</Label>
            <Textarea placeholder="Contexto inicial, próximos pasos..." value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => mutation.mutate({
                ...form,
                estimatedValueUsd: form.estimatedValueUsd ? parseFloat(form.estimatedValueUsd) : null,
                source: form.source || null,
              })}
              disabled={!form.companyName || mutation.isPending}>
              {mutation.isPending ? 'Creando...' : 'Crear Lead'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
  onDragStart: (e: React.DragEvent, leadId: number, fromStage: Stage) => void;
  onDelete: (id: number) => void;
  draggingId: number | null;
}

function LeadCard({ lead, onClick, onDragStart, onDelete, draggingId }: LeadCardProps) {
  const days = daysSince(lead.lastActivity?.activityDate || lead.updatedAt);
  const isStale = (days ?? 0) > 7;
  const isDragging = draggingId === lead.id;
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const didDrag = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    didDrag.current = false;
  };

  const handleDragStart = (e: React.DragEvent) => {
    didDrag.current = true;
    onDragStart(e, lead.id, lead.stage);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (didDrag.current) {
      e.preventDefault();
      return;
    }
    onClick();
  };

  return (
    <div
      draggable
      onMouseDown={handleMouseDown}
      onDragStart={handleDragStart}
      onClick={handleClick}
      style={{ opacity: isDragging ? 0.35 : 1, transition: 'opacity 0.15s' }}
      className="bg-white border border-slate-200 rounded-lg p-3 mb-2 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-indigo-300 transition-all group select-none"
    >
      <div className="flex items-start gap-2 mb-2">
        <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-400 mt-0.5 shrink-0 transition-colors" />
        <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800 text-sm truncate group-hover:text-indigo-700 transition-colors">
              {lead.companyName}
            </p>
            {lead.primaryContact && (
              <p className="text-xs text-slate-500 truncate mt-0.5">{lead.primaryContact.name}</p>
            )}
          </div>
          {lead.estimatedValueUsd && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">
              {fmtUsd(lead.estimatedValueUsd)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-1 pl-5">
        <div className="flex items-center gap-1.5">
          {lead.primaryContact?.email && <Mail className="w-3 h-3 text-slate-400" />}
          {lead.primaryContact?.phone && <Phone className="w-3 h-3 text-slate-400" />}
          {lead.pendingReminders > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-amber-600">
              <Bell className="w-3 h-3" />{lead.pendingReminders}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isStale ? (
            <span className="text-xs text-orange-500 bg-orange-50 px-1 rounded">{days}d sin contacto</span>
          ) : days !== null ? (
            <span className="text-xs text-slate-400">hace {days}d</span>
          ) : null}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`¿Eliminar "${lead.companyName}"?`)) {
                onDelete(lead.id);
              }
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 ml-0.5"
            title="Eliminar lead"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-indigo-400" />
        </div>
      </div>
    </div>
  );
}

interface KanbanColumnProps {
  stage: typeof STAGES[0];
  leads: Lead[];
  onLeadClick: (id: number) => void;
  onDragStart: (e: React.DragEvent, leadId: number, fromStage: Stage) => void;
  onDrop: (e: React.DragEvent, toStage: Stage) => void;
  onDelete: (id: number) => void;
  isDropTarget: boolean;
  draggingId: number | null;
  compact?: boolean;
}

function KanbanColumn({ stage, leads, onLeadClick, onDragStart, onDrop, onDelete, isDropTarget, draggingId, compact }: KanbanColumnProps) {
  const totalValue = leads.reduce((s, l) => s + (l.estimatedValueUsd || 0), 0);
  const [dragCounter, setDragCounter] = useState(0);
  const isOver = dragCounter > 0;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setDragCounter(c => c + 1);
  };

  const handleDragLeave = () => {
    setDragCounter(c => Math.max(0, c - 1));
  };

  const handleDrop = (e: React.DragEvent) => {
    setDragCounter(0);
    onDrop(e, stage.key);
  };

  const columnClass = isOver
    ? `rounded-xl border-2 ${stage.dropActive} flex flex-col transition-all duration-150 shadow-lg scale-[1.01]`
    : `rounded-xl border ${stage.border} ${stage.bg} flex flex-col transition-all duration-150`;

  const minW = compact ? 'min-w-[200px] max-w-[200px]' : 'flex-1 min-w-[220px] max-w-[270px]';

  return (
    <div
      className={`${minW} ${columnClass}`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={`px-3 py-2.5 border-b ${isOver ? stage.dropActive.split(' ')[1] : stage.border} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold uppercase tracking-wide ${stage.color}`}>{stage.label}</span>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full bg-white border ${stage.border} ${stage.color}`}>
            {leads.length}
          </span>
        </div>
        {totalValue > 0 && (
          <span className="text-xs text-slate-500 font-medium">{fmtUsd(totalValue)}</span>
        )}
      </div>
      <div className={`p-2 flex-1 overflow-y-auto ${compact ? 'max-h-[26vh]' : 'max-h-[58vh]'} ${isOver ? 'bg-white/30' : ''}`}>
        {leads.length === 0 && (
          <div className={`text-center text-slate-400 text-xs flex items-center justify-center border-2 border-dashed rounded-lg transition-colors
            ${isOver ? 'border-current py-8 opacity-70' : 'border-transparent py-6'}`}>
            {isOver ? '↓ Soltar aquí' : 'Sin leads'}
          </div>
        )}
        {leads.map(lead => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onClick={() => onLeadClick(lead.id)}
            onDragStart={onDragStart}
            onDelete={onDelete}
            draggingId={draggingId}
          />
        ))}
        {leads.length > 0 && isOver && (
          <div className="border-2 border-dashed border-current rounded-lg py-3 text-center text-xs text-slate-400 opacity-60">
            ↓ Soltar aquí
          </div>
        )}
      </div>
    </div>
  );
}

function ListView({ leads, onLeadClick }: { leads: Lead[]; onLeadClick: (id: number) => void }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">Empresa</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">Contacto</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">Etapa</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">Valor USD</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">Última actividad</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">Recordatorios</th>
          </tr>
        </thead>
        <tbody>
          {leads.map(lead => {
            const meta = stageMeta(lead.stage);
            const days = daysSince(lead.lastActivity?.activityDate || lead.updatedAt);
            return (
              <tr key={lead.id} onClick={() => onLeadClick(lead.id)}
                className="border-b border-slate-100 hover:bg-indigo-50 cursor-pointer transition-colors">
                <td className="px-4 py-3 font-medium text-slate-800">{lead.companyName}</td>
                <td className="px-4 py-3 text-slate-600">{lead.primaryContact?.name || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.bg} ${meta.color} border ${meta.border}`}>
                    {meta.label}
                  </span>
                </td>
                <td className="px-4 py-3 font-semibold text-emerald-700">{fmtUsd(lead.estimatedValueUsd)}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {days !== null ? (
                    <span className={days > 7 ? 'text-orange-500 font-medium' : ''}>
                      hace {days} día{days !== 1 ? 's' : ''}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3">
                  {lead.pendingReminders > 0 ? (
                    <span className="flex items-center gap-1 text-amber-600 text-xs">
                      <Bell className="w-3 h-3" />{lead.pendingReminders} pendiente{lead.pendingReminders > 1 ? 's' : ''}
                    </span>
                  ) : <span className="text-slate-400 text-xs">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {leads.length === 0 && (
        <div className="text-center py-12 text-slate-400">No hay leads que coincidan con los filtros</div>
      )}
    </div>
  );
}

export default function CRMPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [localLeads, setLocalLeads] = useState<Lead[]>([]);

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ['/api/crm/stats'],
    refetchInterval: 60000,
  });

  const { data: fetchedLeads = [], isLoading: leadsLoading, refetch } = useQuery<Lead[]>({
    queryKey: ['/api/crm/leads', stageFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (stageFilter !== 'all') params.set('stage', stageFilter);
      if (search) params.set('search', search);
      const res = await authFetch(`/api/crm/leads?${params}`);
      return res.json();
    },
    refetchInterval: false,
  });

  // Sync local leads whenever server refetches new data
  useEffect(() => {
    setLocalLeads(fetchedLeads);
  }, [fetchedLeads]);

  const handleDragStart = (e: React.DragEvent, leadId: number, fromStage: Stage) => {
    e.dataTransfer.setData('leadId', leadId.toString());
    e.dataTransfer.setData('fromStage', fromStage);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(leadId);
  };

  const handleDrop = (e: React.DragEvent, toStage: Stage) => {
    e.preventDefault();
    const leadId = parseInt(e.dataTransfer.getData('leadId'));
    const fromStage = e.dataTransfer.getData('fromStage') as Stage;
    setDraggingId(null);
    if (!fromStage || fromStage === toStage || !leadId) return;

    // Update local state immediately — no waiting for server
    setLocalLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: toStage } : l));

    // Fire PATCH in background — localLeads already updated, no need to refetch
    apiRequest(`/api/crm/leads/${leadId}`, 'PATCH', { stage: toStage })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/crm/stats'] });
      })
      .catch(() => {
        // Revert local state on failure
        setLocalLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: fromStage } : l));
        toast({ title: 'Error al mover el lead', variant: 'destructive' });
      });
  };

  const handleDragEnd = () => setDraggingId(null);

  const handleDeleteLead = (id: number) => {
    setLocalLeads(prev => prev.filter(l => l.id !== id));
    apiRequest(`/api/crm/leads/${id}`, 'DELETE')
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/crm/stats'] });
      })
      .catch(() => {
        toast({ title: 'Error al eliminar el lead', variant: 'destructive' });
        refetch().then(r => { if (r.data) setLocalLeads(r.data); });
      });
  };

  const handleLeadClick = (id: number) => navigate(`/crm/${id}`);
  const handleRefresh = () => {
    refetch().then(r => { if (r.data) setLocalLeads(r.data); });
    queryClient.invalidateQueries({ queryKey: ['/api/crm/stats'] });
  };

  const leads = localLeads.length > 0 ? localLeads : fetchedLeads;
  const leadsForStage = (stage: Stage) => leads.filter(l => l.stage === stage);
  const MAIN_STAGES = STAGES.filter(s => s.key !== 'won' && s.key !== 'lost');

  return (
    <div className="space-y-5" onDragEnd={handleDragEnd}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 rounded-xl shadow-sm">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">CRM Ventas</h1>
            <p className="text-sm text-slate-500">Pipeline y seguimiento de prospectos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Actualizar
          </Button>
          <NewLeadModal onSuccess={handleRefresh} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Leads Activos</p>
              <p className="text-2xl font-bold text-slate-800">{statsLoading ? '—' : (stats?.totalActive ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Pipeline Total</p>
              <p className="text-2xl font-bold text-slate-800">{statsLoading ? '—' : fmtUsd(stats?.totalPipelineUsd)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <Trophy className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Ganados este mes</p>
              <p className="text-2xl font-bold text-slate-800">{statsLoading ? '—' : (stats?.wonThisMonth ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={`border-slate-200 ${(stats?.overdueReminders ?? 0) > 0 ? 'border-orange-200 bg-orange-50/30' : ''}`}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${(stats?.overdueReminders ?? 0) > 0 ? 'bg-orange-100' : 'bg-slate-100'}`}>
              <AlertCircle className={`w-5 h-5 ${(stats?.overdueReminders ?? 0) > 0 ? 'text-orange-600' : 'text-slate-500'}`} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Follow-ups vencidos</p>
              <p className={`text-2xl font-bold ${(stats?.overdueReminders ?? 0) > 0 ? 'text-orange-600' : 'text-slate-800'}`}>
                {statsLoading ? '—' : (stats?.overdueReminders ?? 0)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Buscar empresa..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 border-slate-200" />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-44 border-slate-200">
            <SelectValue placeholder="Todas las etapas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las etapas</SelectItem>
            {STAGES.map(s => (
              <SelectItem key={s.key} value={s.key}>
                {s.label} {stats?.byStage?.[s.key] ? `(${stats.byStage[s.key]})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('kanban')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
        {draggingId && (
          <span className="text-xs text-indigo-600 font-medium animate-pulse">
            Arrastrando — soltá en una columna para mover
          </span>
        )}
      </div>

      {/* Main content */}
      {leadsLoading ? (
        <div className="text-center py-16 text-slate-400">Cargando leads...</div>
      ) : viewMode === 'kanban' ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {MAIN_STAGES.map(stage => (
            <KanbanColumn
              key={stage.key}
              stage={stage}
              leads={leadsForStage(stage.key)}
              onLeadClick={handleLeadClick}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onDelete={handleDeleteLead}
              isDropTarget={false}
              draggingId={draggingId}
            />
          ))}
          {/* Won / Lost compact columns */}
          <div className="flex flex-col gap-3 min-w-[200px] max-w-[200px]">
            {[STAGES.find(s => s.key === 'won')!, STAGES.find(s => s.key === 'lost')!].map(stage => (
              <KanbanColumn
                key={stage.key}
                stage={stage}
                leads={leadsForStage(stage.key)}
                onLeadClick={handleLeadClick}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
                onDelete={handleDeleteLead}
                isDropTarget={false}
                draggingId={draggingId}
                compact
              />
            ))}
          </div>
        </div>
      ) : (
        <ListView leads={leads} onLeadClick={handleLeadClick} />
      )}
    </div>
  );
}
