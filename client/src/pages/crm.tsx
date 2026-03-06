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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Target, Plus, Search, TrendingUp, DollarSign, Trophy, AlertCircle,
  Bell, ChevronRight, LayoutGrid, List, Mail, Phone, RefreshCw,
  GripVertical, Trash2, Settings, Pencil, Check, X, MoreHorizontal
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Stage = string;

interface CrmStage {
  id: number;
  key: string;
  label: string;
  color: string;
  position: number;
  isActive: boolean;
}

const COLOR_MAP: Record<string, { color: string; bg: string; border: string; dropActive: string; hex: string }> = {
  slate:  { color: 'text-slate-700',  bg: 'bg-slate-50',   border: 'border-slate-200',  dropActive: 'bg-slate-100 border-slate-400',  hex: '#64748b' },
  blue:   { color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200',   dropActive: 'bg-blue-100 border-blue-500',    hex: '#3b82f6' },
  indigo: { color: 'text-indigo-700', bg: 'bg-indigo-50',  border: 'border-indigo-200', dropActive: 'bg-indigo-100 border-indigo-500', hex: '#6366f1' },
  violet: { color: 'text-violet-700', bg: 'bg-violet-50',  border: 'border-violet-200', dropActive: 'bg-violet-100 border-violet-500', hex: '#7c3aed' },
  purple: { color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-200', dropActive: 'bg-purple-100 border-purple-500', hex: '#9333ea' },
  pink:   { color: 'text-pink-700',   bg: 'bg-pink-50',    border: 'border-pink-200',   dropActive: 'bg-pink-100 border-pink-500',    hex: '#ec4899' },
  red:    { color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200',    dropActive: 'bg-red-100 border-red-500',      hex: '#ef4444' },
  orange: { color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200', dropActive: 'bg-orange-100 border-orange-500', hex: '#f97316' },
  amber:  { color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200',  dropActive: 'bg-amber-100 border-amber-500',  hex: '#f59e0b' },
  yellow: { color: 'text-yellow-700', bg: 'bg-yellow-50',  border: 'border-yellow-200', dropActive: 'bg-yellow-100 border-yellow-500', hex: '#eab308' },
  green:  { color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200',  dropActive: 'bg-green-100 border-green-500',  hex: '#22c55e' },
  teal:   { color: 'text-teal-700',   bg: 'bg-teal-50',    border: 'border-teal-200',   dropActive: 'bg-teal-100 border-teal-500',   hex: '#14b8a6' },
  cyan:   { color: 'text-cyan-700',   bg: 'bg-cyan-50',    border: 'border-cyan-200',   dropActive: 'bg-cyan-100 border-cyan-500',   hex: '#06b6d4' },
};

const COLOR_OPTIONS = Object.entries(COLOR_MAP).map(([key, val]) => ({ key, hex: val.hex }));

function colorMeta(colorName: string) {
  return COLOR_MAP[colorName] ?? COLOR_MAP['slate'];
}

function stageStyle(stage: CrmStage) {
  const meta = colorMeta(stage.color);
  return { key: stage.key, label: stage.label, ...meta };
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

function NewLeadModal({ onSuccess, stages, open: externalOpen, onOpenChange: externalOnOpenChange, initialStage }: {
  onSuccess: () => void;
  stages: CrmStage[];
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  initialStage?: string;
}) {
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen! : internalOpen;
  const setOpen = (v: boolean) => { isControlled ? externalOnOpenChange?.(v) : setInternalOpen(v); };

  const defaultStage = stages.find(s => s.key !== 'won' && s.key !== 'lost')?.key ?? 'new';
  const emptyForm = { companyName: '', stage: defaultStage, source: '', estimatedValueUsd: '', notes: '', contactName: '', contactEmail: '', contactPhone: '', contactPosition: '' };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (open) {
      setForm({ ...emptyForm, stage: initialStage ?? defaultStage });
    }
  }, [open, initialStage]);

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/crm/leads', 'POST', data),
    onSuccess: () => {
      toast({ title: 'Lead creado correctamente' });
      setOpen(false);
      onSuccess();
    },
    onError: () => toast({ title: 'Error al crear el lead', variant: 'destructive' }),
  });

  const mainStages = stages.filter(s => s.key !== 'won' && s.key !== 'lost');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
            <Plus className="w-4 h-4" /> Nuevo Lead
          </Button>
        </DialogTrigger>
      )}
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
              <Select value={form.stage} onValueChange={v => setForm(f => ({ ...f, stage: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {mainStages.map(s => (
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

interface SortableStageRowProps {
  stage: CrmStage;
  onSave: (id: number, label: string, color: string) => void;
  onDelete: (id: number) => void;
}

function SortableStageRow({ stage, onSave, onDelete }: SortableStageRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id });
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(stage.label);
  const [color, setColor] = useState(stage.color);
  const meta = colorMeta(stage.color);

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  const handleSave = () => {
    if (!label.trim()) return;
    onSave(stage.id, label.trim(), color);
    setEditing(false);
  };

  const handleCancel = () => {
    setLabel(stage.label);
    setColor(stage.color);
    setEditing(false);
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 py-2 px-1 rounded-lg hover:bg-slate-50 group">
      <button
        {...attributes}
        {...listeners}
        className="p-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none"
        title="Arrastrar para reordenar"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {editing ? (
        <>
          <div className="flex items-center gap-1 flex-wrap">
            {COLOR_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setColor(opt.key)}
                className={`w-5 h-5 rounded-full border-2 transition-all ${color === opt.key ? 'border-slate-700 scale-110' : 'border-transparent hover:scale-105'}`}
                style={{ backgroundColor: opt.hex }}
                title={opt.key}
              />
            ))}
          </div>
          <Input
            className="flex-1 h-7 text-sm"
            value={label}
            onChange={e => setLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
            autoFocus
          />
          <button onClick={handleSave} className="p-1 text-green-600 hover:text-green-700"><Check className="w-4 h-4" /></button>
          <button onClick={handleCancel} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </>
      ) : (
        <>
          <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: meta.hex }} />
          <span className={`flex-1 text-sm font-medium ${meta.color}`}>{stage.label}</span>
          <button
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 transition-opacity"
            title="Editar"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(stage.id)}
            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-opacity"
            title="Eliminar"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

function StageManagerDialog({ stages, onRefresh }: { stages: CrmStage[]; onRefresh: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [localStages, setLocalStages] = useState<CrmStage[]>(stages);
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('blue');
  const [stageToDelete, setStageToDelete] = useState<CrmStage | null>(null);

  useEffect(() => { setLocalStages(stages); }, [stages]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = localStages.findIndex(s => s.id === active.id);
    const newIdx = localStages.findIndex(s => s.id === over.id);
    const reordered = arrayMove(localStages, oldIdx, newIdx).map((s, i) => ({ ...s, position: i }));
    setLocalStages(reordered);
    queryClient.setQueryData(['/api/crm/stages'], reordered);
    apiRequest('/api/crm/stages/reorder', 'PATCH', { order: reordered.map(s => s.id) })
      .catch(() => {
        setLocalStages(localStages);
        queryClient.setQueryData(['/api/crm/stages'], localStages);
        toast({ title: 'Error al reordenar', variant: 'destructive' });
      });
  };

  const handleSave = (id: number, label: string, color: string) => {
    setLocalStages(prev => prev.map(s => s.id === id ? { ...s, label, color } : s));
    const current = queryClient.getQueryData<CrmStage[]>(['/api/crm/stages']) ?? [];
    queryClient.setQueryData(['/api/crm/stages'], current.map(s => s.id === id ? { ...s, label, color } : s));
    apiRequest(`/api/crm/stages/${id}`, 'PATCH', { label, color })
      .then(() => toast({ title: 'Etapa actualizada' }))
      .catch(() => {
        queryClient.setQueryData(['/api/crm/stages'], current);
        toast({ title: 'Error al actualizar', variant: 'destructive' });
      });
  };

  const handleDelete = (id: number) => {
    const stage = localStages.find(s => s.id === id);
    if (stage) setStageToDelete(stage);
  };

  const confirmDelete = () => {
    if (!stageToDelete) return;
    const id = stageToDelete.id;
    const current = queryClient.getQueryData<CrmStage[]>(['/api/crm/stages']) ?? [];
    setStageToDelete(null);
    queryClient.setQueryData(['/api/crm/stages'], current.filter(s => s.id !== id));
    setOpen(false);
    apiRequest(`/api/crm/stages/${id}`, 'DELETE')
      .then(() => toast({ title: 'Etapa eliminada' }))
      .catch(() => {
        queryClient.setQueryData(['/api/crm/stages'], current);
        toast({ title: 'No se puede eliminar: la etapa tiene leads asignados', variant: 'destructive' });
      });
  };

  const handleCreate = () => {
    if (!newLabel.trim()) return;
    apiRequest('/api/crm/stages', 'POST', { label: newLabel.trim(), color: newColor })
      .then((stage) => {
        const current = queryClient.getQueryData<CrmStage[]>(['/api/crm/stages']) ?? [];
        queryClient.setQueryData(['/api/crm/stages'], [...current, stage]);
        setNewLabel('');
        setNewColor('blue');
        setOpen(false);
        toast({ title: 'Etapa creada' });
      })
      .catch(() => toast({ title: 'Error al crear etapa', variant: 'destructive' }));
  };

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Settings className="w-3.5 h-3.5" /> Etapas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gestionar Etapas</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 max-h-80 overflow-y-auto">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={localStages.map(s => s.id)} strategy={verticalListSortingStrategy}>
              {localStages.map(stage => (
                <SortableStageRow
                  key={stage.id}
                  stage={stage}
                  onSave={handleSave}
                  onDelete={handleDelete}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        <div className="border-t pt-4 space-y-3">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Nueva etapa</p>
          <div className="flex items-center gap-2 flex-wrap">
            {COLOR_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setNewColor(opt.key)}
                className={`w-5 h-5 rounded-full border-2 transition-all ${newColor === opt.key ? 'border-slate-700 scale-110' : 'border-transparent hover:scale-105'}`}
                style={{ backgroundColor: opt.hex }}
                title={opt.key}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Nombre de la etapa"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              className="flex-1"
            />
            <Button onClick={handleCreate} disabled={!newLabel.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1">
              <Plus className="w-3.5 h-3.5" /> Agregar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <AlertDialog open={!!stageToDelete} onOpenChange={(open) => { if (!open) setStageToDelete(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar etapa?</AlertDialogTitle>
          <AlertDialogDescription>
            Se eliminará la etapa <strong>"{stageToDelete?.label}"</strong>. Solo es posible si no tiene leads asignados. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white">
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
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
  const didDrag = useRef(false);

  const handleDragStart = (e: React.DragEvent) => {
    didDrag.current = true;
    onDragStart(e, lead.id, lead.stage);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (didDrag.current) { e.preventDefault(); return; }
    onClick();
  };

  return (
    <div
      draggable
      onMouseDown={() => { didDrag.current = false; }}
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
              onDelete(lead.id);
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
  stage: CrmStage;
  leads: Lead[];
  onLeadClick: (id: number) => void;
  onDragStart: (e: React.DragEvent, leadId: number, fromStage: Stage) => void;
  onDrop: (e: React.DragEvent, toStage: Stage) => void;
  onDelete: (id: number) => void;
  onAddLead?: (stageKey: string) => void;
  onEditStage?: (id: number, label: string, color: string) => void;
  onDeleteStage?: (stage: CrmStage) => void;
  draggingId: number | null;
  compact?: boolean;
  dragHandleProps?: Record<string, any>;
}

function KanbanColumn({ stage, leads, onLeadClick, onDragStart, onDrop, onDelete, onAddLead, onEditStage, onDeleteStage, draggingId, compact, dragHandleProps }: KanbanColumnProps) {
  const meta = colorMeta(stage.color);
  const totalValue = leads.reduce((s, l) => s + (l.estimatedValueUsd || 0), 0);
  const [dragCounter, setDragCounter] = useState(0);
  const isOver = dragCounter > 0;
  const [editingLabel, setEditingLabel] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); setDragCounter(c => c + 1); };
  const handleDragLeave = () => { setDragCounter(c => Math.max(0, c - 1)); };
  const handleDrop = (e: React.DragEvent) => { setDragCounter(0); onDrop(e, stage.key); };

  const columnClass = isOver
    ? `rounded-xl border-2 ${meta.dropActive} flex flex-col transition-all duration-150 shadow-lg scale-[1.01]`
    : `rounded-xl border ${meta.border} ${meta.bg} flex flex-col transition-all duration-150`;

  const minW = compact ? 'min-w-[200px] max-w-[200px]' : 'flex-1 min-w-[220px] max-w-[270px]';

  return (
    <div
      className={`${minW} ${columnClass}`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={`px-3 py-2.5 border-b ${isOver ? meta.dropActive.split(' ')[1] : meta.border} flex items-center justify-between group/header`}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {dragHandleProps && (
            <button
              {...dragHandleProps}
              className="p-0.5 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none shrink-0"
              title="Arrastrar columna"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </button>
          )}
          {editingLabel !== null ? (
            <input
              autoFocus
              value={editingLabel}
              onChange={e => setEditingLabel(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && editingLabel.trim()) {
                  onEditStage?.(stage.id, editingLabel.trim(), stage.color);
                  setEditingLabel(null);
                } else if (e.key === 'Escape') {
                  setEditingLabel(null);
                }
              }}
              onBlur={() => {
                if (editingLabel.trim()) onEditStage?.(stage.id, editingLabel.trim(), stage.color);
                setEditingLabel(null);
              }}
              className={`text-xs font-semibold uppercase tracking-wide ${meta.color} bg-transparent border-b border-current outline-none w-full min-w-0`}
            />
          ) : (
            <span className={`text-xs font-semibold uppercase tracking-wide ${meta.color} truncate`}>{stage.label}</span>
          )}
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full bg-white border ${meta.border} ${meta.color} shrink-0`}>
            {leads.length}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {totalValue > 0 && (
            <span className="text-xs text-slate-500 font-medium">{fmtUsd(totalValue)}</span>
          )}
          {(onEditStage || onDeleteStage) && !compact && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="opacity-0 group-hover/header:opacity-100 p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-white/70 transition-all">
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                {onEditStage && (
                  <DropdownMenuItem onClick={() => setEditingLabel(stage.label)} className="gap-2 text-xs">
                    <Pencil className="w-3.5 h-3.5" /> Renombrar
                  </DropdownMenuItem>
                )}
                {onEditStage && onDeleteStage && <DropdownMenuSeparator />}
                {onDeleteStage && (
                  <DropdownMenuItem onClick={() => onDeleteStage(stage)} className="gap-2 text-xs text-red-600 focus:text-red-600 focus:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" /> Eliminar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
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
      {!compact && onAddLead && (
        <div className="px-2 pb-2 pt-1">
          <button
            onClick={() => onAddLead(stage.key)}
            className={`w-full py-1.5 text-xs text-slate-400 hover:text-indigo-600 hover:bg-white/80 rounded-lg border border-dashed ${meta.border} hover:border-indigo-300 transition-all flex items-center justify-center gap-1 group/add`}
          >
            <Plus className="w-3 h-3 group-hover/add:scale-110 transition-transform" />
            Agregar lead
          </button>
        </div>
      )}
    </div>
  );
}

function SortableKanbanColumn(props: KanbanColumnProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.stage.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined, opacity: isDragging ? 0.6 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex-1 min-w-[220px] max-w-[270px] flex">
      <KanbanColumn
        {...props}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function ListView({ leads, stages, onLeadClick }: { leads: Lead[]; stages: CrmStage[]; onLeadClick: (id: number) => void }) {
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
            const stage = stages.find(s => s.key === lead.stage);
            const meta = stage ? colorMeta(stage.color) : colorMeta('slate');
            const label = stage?.label ?? lead.stage;
            const days = daysSince(lead.lastActivity?.activityDate || lead.updatedAt);
            return (
              <tr key={lead.id} onClick={() => onLeadClick(lead.id)}
                className="border-b border-slate-100 hover:bg-indigo-50 cursor-pointer transition-colors">
                <td className="px-4 py-3 font-medium text-slate-800">{lead.companyName}</td>
                <td className="px-4 py-3 text-slate-600">{lead.primaryContact?.name || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.bg} ${meta.color} border ${meta.border}`}>
                    {label}
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
  const [localLeads, setLocalLeads] = useState<Lead[] | null>(null);
  const [quickAddStage, setQuickAddStage] = useState<string | null>(null);
  const [stageToDelete, setStageToDelete] = useState<CrmStage | null>(null);
  const { data: stages = [] } = useQuery<CrmStage[]>({
    queryKey: ['/api/crm/stages'],
  });

  const orderedStages = stages;

  const mainStages = orderedStages.filter(s => s.key !== 'won' && s.key !== 'lost');
  const wonStage = orderedStages.find(s => s.key === 'won');
  const lostStage = orderedStages.find(s => s.key === 'lost');
  const compactStages = [wonStage, lostStage].filter(Boolean) as CrmStage[];

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
    refetchOnWindowFocus: false,
  });

  useEffect(() => { setLocalLeads(null); }, [stageFilter, search]);
  useEffect(() => {
    if (localLeads === null && !leadsLoading) setLocalLeads(fetchedLeads);
  }, [fetchedLeads, localLeads, leadsLoading]);

  const columnSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = stages.findIndex(s => s.id === active.id);
    const newIdx = stages.findIndex(s => s.id === over.id);
    const reordered = arrayMove([...stages], oldIdx, newIdx);
    queryClient.setQueryData(['/api/crm/stages'], reordered);
    apiRequest('/api/crm/stages/reorder', 'PATCH', { order: reordered.map(s => s.id) })
      .catch(() => {
        queryClient.setQueryData(['/api/crm/stages'], stages);
        toast({ title: 'Error al reordenar columnas', variant: 'destructive' });
      });
  };

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
    setLocalLeads(prev => (prev ?? []).map(l => l.id === leadId ? { ...l, stage: toStage } : l));
    apiRequest(`/api/crm/leads/${leadId}`, 'PATCH', { stage: toStage })
      .then(() => queryClient.invalidateQueries({ queryKey: ['/api/crm/stats'] }))
      .catch(() => {
        setLocalLeads(prev => (prev ?? []).map(l => l.id === leadId ? { ...l, stage: fromStage } : l));
        toast({ title: 'Error al mover el lead', variant: 'destructive' });
      });
  };

  const handleDragEnd = () => setDraggingId(null);

  const handleDeleteLead = (id: number) => {
    setLocalLeads(prev => (prev ?? []).filter(l => l.id !== id));
    apiRequest(`/api/crm/leads/${id}`, 'DELETE')
      .then(() => queryClient.invalidateQueries({ queryKey: ['/api/crm/stats'] }))
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
  const handleEditStage = (id: number, label: string, color: string) => {
    const prev = queryClient.getQueryData<CrmStage[]>(['/api/crm/stages']) ?? [];
    queryClient.setQueryData(['/api/crm/stages'], prev.map(s => s.id === id ? { ...s, label, color } : s));
    apiRequest(`/api/crm/stages/${id}`, 'PATCH', { label, color })
      .catch(() => {
        queryClient.setQueryData(['/api/crm/stages'], prev);
        toast({ title: 'Error al actualizar etapa', variant: 'destructive' });
      });
  };

  const handleConfirmDeleteStage = () => {
    if (!stageToDelete) return;
    const id = stageToDelete.id;
    const prev = queryClient.getQueryData<CrmStage[]>(['/api/crm/stages']) ?? [];
    setStageToDelete(null);
    queryClient.setQueryData(['/api/crm/stages'], prev.filter(s => s.id !== id));
    apiRequest(`/api/crm/stages/${id}`, 'DELETE')
      .catch(() => {
        queryClient.setQueryData(['/api/crm/stages'], prev);
        toast({ title: 'No se puede eliminar: la etapa tiene leads asignados', variant: 'destructive' });
      });
  };

  const leads = localLeads ?? fetchedLeads;
  const leadsForStage = (stage: Stage) => leads.filter(l => l.stage === stage);

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
          <StageManagerDialog stages={orderedStages} onRefresh={() => {}} />
          <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Actualizar
          </Button>
          <NewLeadModal onSuccess={handleRefresh} stages={stages} />
          <NewLeadModal
            onSuccess={handleRefresh}
            stages={stages}
            open={!!quickAddStage}
            onOpenChange={(v) => { if (!v) setQuickAddStage(null); }}
            initialStage={quickAddStage ?? undefined}
          />
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
            {orderedStages.map(s => (
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
          <DndContext sensors={columnSensors} collisionDetection={closestCenter} onDragEnd={handleColumnDragEnd}>
            <SortableContext items={mainStages.map(s => s.id)} strategy={horizontalListSortingStrategy}>
              {mainStages.map(stage => (
                <SortableKanbanColumn
                  key={stage.id}
                  stage={stage}
                  leads={leadsForStage(stage.key)}
                  onLeadClick={handleLeadClick}
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                  onDelete={handleDeleteLead}
                  onAddLead={setQuickAddStage}
                  onEditStage={handleEditStage}
                  onDeleteStage={setStageToDelete}
                  draggingId={draggingId}
                />
              ))}
            </SortableContext>
          </DndContext>
          {/* Won / Lost compact columns */}
          {compactStages.length > 0 && (
            <div className="flex flex-col gap-3 min-w-[200px] max-w-[200px]">
              {compactStages.map(stage => (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  leads={leadsForStage(stage.key)}
                  onLeadClick={handleLeadClick}
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                  onDelete={handleDeleteLead}
                  draggingId={draggingId}
                  compact
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <ListView leads={leads} stages={orderedStages} onLeadClick={handleLeadClick} />
      )}

      <AlertDialog open={!!stageToDelete} onOpenChange={(open) => { if (!open) setStageToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar etapa?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la etapa <strong>"{stageToDelete?.label}"</strong>. Solo es posible si no tiene leads asignados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteStage} className="bg-red-600 hover:bg-red-700 text-white">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
