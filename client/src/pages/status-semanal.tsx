import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, authFetch } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ClipboardList, MessageSquare, X, Send, Trash2,
  AlertTriangle, Loader2, User, EyeOff, Eye,
  ChevronDown, ChevronRight, Zap, CheckCircle2,
  Circle, MoreHorizontal, Plus, Tag
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type StatusRow = {
  projectId: number;
  clientName: string | null;
  quotationName: string | null;
  trackingFrequency: string;
  reviewId: number | null;
  healthStatus: string | null;
  marginStatus: string | null;
  teamStrain: string | null;
  mainRisk: string | null;
  currentAction: string | null;
  nextMilestone: string | null;
  nextMilestoneDate: string | null;
  ownerId: number | null;
  ownerName: string | null;
  decisionNeeded: string | null;
  hiddenFromWeekly: boolean | null;
  reviewUpdatedAt: string | null;
  noteCount: number;
};

type CustomItem = {
  id: number;
  title: string;
  subtitle: string | null;
  healthStatus: string | null;
  marginStatus: string | null;
  teamStrain: string | null;
  mainRisk: string | null;
  currentAction: string | null;
  nextMilestone: string | null;
  ownerId: number | null;
  ownerName: string | null;
  decisionNeeded: string | null;
  hiddenFromWeekly: boolean | null;
  updatedAt: string | null;
};

type Note = {
  id: number; projectId: number; content: string; noteDate: string;
  authorId: number | null; authorName: string | null; createdAt: string;
};

type AppUser = { id: number; name: string; email: string };

// Unified item for rendering — projects and custom items share the same card components
type Item = {
  key: string;
  isCustom: boolean;
  projectId?: number;
  customId?: number;
  title: string;
  subtitle?: string | null;
  healthStatus: string | null;
  marginStatus: string | null;
  teamStrain: string | null;
  mainRisk: string | null;
  currentAction: string | null;
  nextMilestone: string | null;
  ownerId: number | null;
  ownerName: string | null;
  decisionNeeded: string | null;
  hiddenFromWeekly: boolean | null;
  noteCount: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const HEALTH: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  verde:    { label: 'Verde',    dot: 'bg-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200' },
  amarillo: { label: 'Amarillo', dot: 'bg-amber-400',   bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-300'   },
  rojo:     { label: 'Rojo',     dot: 'bg-red-500',     bg: 'bg-red-50',      text: 'text-red-700',     border: 'border-red-300'     },
};

const LEVEL: Record<string, { label: string; color: string }> = {
  alto:  { label: 'Alto',  color: 'text-red-600 bg-red-50 border-red-200' },
  medio: { label: 'Medio', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  bajo:  { label: 'Bajo',  color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
};

const DECISION: Record<string, { label: string; color: string; urgent: boolean }> = {
  ninguna:      { label: 'Ninguna',      color: 'text-slate-400 bg-slate-50 border-slate-200',     urgent: false },
  priorizacion: { label: 'Priorización', color: 'text-blue-700 bg-blue-50 border-blue-300',         urgent: true  },
  recursos:     { label: 'Recursos',     color: 'text-purple-700 bg-purple-50 border-purple-300',   urgent: true  },
  reprecio:     { label: 'Re-precio',    color: 'text-orange-700 bg-orange-50 border-orange-300',   urgent: true  },
  salida:       { label: 'Salida',       color: 'text-red-700 bg-red-50 border-red-400 font-bold',  urgent: true  },
};

const hm = (v: string | null) => HEALTH[v ?? 'verde'] ?? HEALTH.verde;
const lm = (v: string | null) => LEVEL[v ?? 'medio'] ?? LEVEL.medio;
const dm = (v: string | null) => DECISION[v ?? 'ninguna'] ?? DECISION.ninguna;

function weekLabel() {
  const now = new Date();
  const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const fri = new Date(mon); fri.setDate(mon.getDate() + 4);
  const f = (d: Date) => d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  return `${f(mon)} – ${f(fri)}`;
}

function relTime(s: string) {
  const diff = Math.floor((Date.now() - new Date(s).getTime()) / 1000);
  if (diff < 60) return 'ahora';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `hace ${Math.floor(diff / 86400)}d`;
  return new Date(s).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

function initials(name: string | null) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// ─── Inline editor ────────────────────────────────────────────────────────────

function InlineText({ value, placeholder, onSave, multiline = false, className = '' }: {
  value: string | null; placeholder: string; onSave: (v: string) => void;
  multiline?: boolean; className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const ref = useRef<any>(null);

  useEffect(() => { setDraft(value ?? ''); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const save = () => { setEditing(false); if (draft !== (value ?? '')) onSave(draft); };

  if (editing) {
    const cls = `w-full text-sm border border-indigo-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white resize-none ${className}`;
    return multiline
      ? <textarea ref={ref} value={draft} onChange={e => setDraft(e.target.value)} onBlur={save}
          onKeyDown={e => e.key === 'Escape' && (setDraft(value ?? ''), setEditing(false))}
          className={cls} rows={2} />
      : <input ref={ref} value={draft} onChange={e => setDraft(e.target.value)} onBlur={save}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(); } if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false); } }}
          className={cls} />;
  }

  return (
    <span onClick={() => setEditing(true)}
      className={cn("cursor-text rounded hover:bg-slate-100 px-1 py-0.5 transition-colors min-h-[22px] inline-block",
        value ? "text-slate-800" : "text-slate-400 italic", className)}
      title="Click para editar">
      {value || placeholder}
    </span>
  );
}

// ─── Mini pickers ─────────────────────────────────────────────────────────────

function HealthDot({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const meta = hm(value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 group" title={`Estado: ${meta.label}`}>
          <div className={cn("w-3 h-3 rounded-full transition-transform group-hover:scale-125", meta.dot)} />
          <span className={cn("text-xs font-semibold", meta.text)}>{meta.label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-36 p-1.5" align="start">
        {Object.entries(HEALTH).map(([k, m]) => (
          <button key={k} onClick={() => { onChange(k); setOpen(false); }}
            className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium hover:bg-slate-100", k === value && "bg-slate-100")}>
            <div className={cn("w-2.5 h-2.5 rounded-full", m.dot)} />{m.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function LevelBadge({ value, onChange, label }: { value: string | null; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const meta = lm(value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button title={label}>
          <Badge variant="outline" className={cn("text-[10px] h-4 cursor-pointer border font-semibold hover:opacity-80", meta.color)}>{meta.label}</Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-32 p-1.5" align="start">
        <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide mb-1 px-1">{label}</p>
        {Object.entries(LEVEL).map(([k, m]) => (
          <button key={k} onClick={() => { onChange(k); setOpen(false); }}
            className={cn("w-full flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-slate-100", k === value && "bg-slate-100")}>
            <Badge variant="outline" className={cn("text-[10px] h-4 border", m.color)}>{m.label}</Badge>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function DecisionBadge({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const meta = dm(value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button>
          <Badge variant="outline" className={cn("text-[10px] h-4 cursor-pointer border font-semibold hover:opacity-80 max-w-[80px] truncate", meta.color)}>
            {meta.label}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1.5" align="end">
        <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide mb-1 px-1">Decisión CEO/COO</p>
        {Object.entries(DECISION).map(([k, m]) => (
          <button key={k} onClick={() => { onChange(k); setOpen(false); }}
            className={cn("w-full flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-slate-100", k === value && "bg-slate-100")}>
            <Badge variant="outline" className={cn("text-[10px] h-4 border", m.color)}>{m.label}</Badge>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function OwnerSelect({ value, name, onChange, users }: {
  value: number | null; name: string | null; onChange: (v: number | null) => void; users: AppUser[];
}) {
  return (
    <Select value={value?.toString() ?? '__none__'} onValueChange={v => onChange(v === '__none__' ? null : parseInt(v))}>
      <SelectTrigger className="h-6 border-0 bg-transparent hover:bg-slate-100 px-1.5 gap-1 focus:ring-0 max-w-[120px] rounded transition-all">
        <div className="flex items-center gap-1.5 min-w-0">
          {name ? (
            <>
              <div className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[9px] font-bold shrink-0">{initials(name)}</div>
              <span className="text-xs font-medium truncate">{name.split(' ')[0]}</span>
            </>
          ) : (
            <>
              <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center shrink-0"><User className="h-3 w-3 text-slate-400" /></div>
              <span className="text-xs text-slate-400">Owner</span>
            </>
          )}
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">Sin owner</SelectItem>
        {users.map(u => <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

// ─── Alert card (Rojo / Amarillo or urgent decision) ─────────────────────────

function AlertCard({ item, users, isSelected, onOpenNotes, onUpdate, onRemove }: {
  item: Item; users: AppUser[]; isSelected: boolean;
  onOpenNotes?: () => void; onUpdate: (d: Record<string, any>) => void; onRemove: () => void;
}) {
  const meta = hm(item.healthStatus);
  const decMeta = dm(item.decisionNeeded);
  const isUrgentDec = decMeta.urgent;
  const barColor = { verde: 'bg-emerald-500', amarillo: 'bg-amber-400', rojo: 'bg-red-500' }[item.healthStatus ?? 'verde'] ?? 'bg-emerald-500';

  return (
    <div className={cn(
      "rounded-xl border-2 bg-white shadow-md transition-all overflow-hidden",
      item.healthStatus === 'rojo' ? "border-red-300" : item.healthStatus === 'amarillo' ? "border-amber-300" : "border-indigo-200",
      isSelected && "ring-2 ring-indigo-400"
    )}>
      <div className={cn("h-1.5 w-full", barColor)} />
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {item.isCustom && <Tag className="h-3.5 w-3.5 text-indigo-400 shrink-0" />}
              <p className="font-bold text-base text-foreground leading-tight">{item.title}</p>
            </div>
            {item.subtitle && <p className="text-sm text-muted-foreground mt-0.5">{item.subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <HealthDot value={item.healthStatus} onChange={v => onUpdate({ healthStatus: v })} />
            <button onClick={onRemove}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors border border-transparent hover:border-red-200"
              title={item.isCustom ? "Eliminar ítem" : "Quitar del status"}>
              <Trash2 className="h-3 w-3" />
              {item.isCustom ? "Eliminar" : "Quitar"}
            </button>
          </div>
        </div>

        {/* Decision alert */}
        {isUrgentDec && (
          <div className={cn("flex items-center gap-2 rounded-lg px-3 py-2 mb-3 border text-sm font-semibold", decMeta.color)}>
            <Zap className="h-4 w-4 shrink-0" />
            Decisión:
            <DecisionBadge value={item.decisionNeeded} onChange={v => onUpdate({ decisionNeeded: v })} />
          </div>
        )}

        {/* Metrics */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Margen</span>
            <LevelBadge value={item.marginStatus} onChange={v => onUpdate({ marginStatus: v })} label="Margen" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Equipo</span>
            <LevelBadge value={item.teamStrain} onChange={v => onUpdate({ teamStrain: v })} label="Desgaste equipo" />
          </div>
          {!isUrgentDec && <DecisionBadge value={item.decisionNeeded} onChange={v => onUpdate({ decisionNeeded: v })} />}
        </div>

        {/* Risk */}
        <div className={cn("rounded-lg p-3 mb-3", item.healthStatus === 'rojo' ? "bg-red-50 border border-red-100" : item.healthStatus === 'amarillo' ? "bg-amber-50 border border-amber-100" : "bg-indigo-50 border border-indigo-100")}>
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wide mb-1">Riesgo principal</p>
          <InlineText value={item.mainRisk} placeholder="¿Cuál es el riesgo crítico?" onSave={v => onUpdate({ mainRisk: v })} multiline className="text-sm font-medium" />
        </div>

        {/* Action + Milestone */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-1">Acción en curso</p>
            <InlineText value={item.currentAction} placeholder="¿Qué está pasando?" onSave={v => onUpdate({ currentAction: v })} multiline />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-1">Próximo hito</p>
            <InlineText value={item.nextMilestone} placeholder="¿Qué sigue?" onSave={v => onUpdate({ nextMilestone: v })} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <OwnerSelect value={item.ownerId} name={item.ownerName} onChange={v => onUpdate({ ownerId: v })} users={users} />
          {!item.isCustom && onOpenNotes && (
            <button onClick={onOpenNotes}
              className={cn("flex items-center gap-1 text-xs rounded-full px-2.5 py-1 font-semibold transition-colors",
                isSelected ? "bg-indigo-600 text-white" : item.noteCount > 0 ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200" : "bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-700")}>
              <MessageSquare className="h-3 w-3" />
              <span>{item.noteCount} nota{item.noteCount !== 1 ? 's' : ''}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Compact row (Verde) ──────────────────────────────────────────────────────

function CompactRow({ item, users, isSelected, onOpenNotes, onUpdate, onRemove }: {
  item: Item; users: AppUser[]; isSelected: boolean;
  onOpenNotes?: () => void; onUpdate: (d: Record<string, any>) => void; onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const decMeta = dm(item.decisionNeeded);

  return (
    <div className={cn("border-b border-slate-100 last:border-0 transition-colors", isSelected ? "bg-indigo-50" : "hover:bg-slate-50/80")}>
      <div className="flex items-center gap-3 px-4 py-2.5">
        <button onClick={() => setExpanded(v => !v)} className="text-slate-300 hover:text-slate-500 shrink-0 transition-colors">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <HealthDot value={item.healthStatus} onChange={v => onUpdate({ healthStatus: v })} />
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          {item.isCustom && <Tag className="h-3 w-3 text-indigo-400 shrink-0" />}
          <span className="font-semibold text-sm text-foreground">{item.title}</span>
          {item.subtitle && <span className="text-muted-foreground text-sm"> · {item.subtitle}</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <LevelBadge value={item.marginStatus} onChange={v => onUpdate({ marginStatus: v })} label="Margen" />
          <LevelBadge value={item.teamStrain} onChange={v => onUpdate({ teamStrain: v })} label="Equipo" />
        </div>
        <div className="hidden lg:block w-44 shrink-0">
          <InlineText value={item.mainRisk} placeholder="Sin riesgo registrado" onSave={v => onUpdate({ mainRisk: v })} className="text-xs truncate block" />
        </div>
        <div className="shrink-0">
          <OwnerSelect value={item.ownerId} name={item.ownerName} onChange={v => onUpdate({ ownerId: v })} users={users} />
        </div>
        {decMeta.urgent && (
          <div className="shrink-0">
            <DecisionBadge value={item.decisionNeeded} onChange={v => onUpdate({ decisionNeeded: v })} />
          </div>
        )}
        {!item.isCustom && onOpenNotes && (
          <button onClick={onOpenNotes}
            className={cn("flex items-center gap-1 text-xs rounded-full px-2 py-0.5 font-medium transition-colors shrink-0",
              isSelected ? "bg-indigo-600 text-white" : item.noteCount > 0 ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-400 hover:bg-indigo-100 hover:text-indigo-700")}>
            <MessageSquare className="h-3 w-3" />
            <span>{item.noteCount}</span>
          </button>
        )}
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <button className="p-1 rounded hover:bg-slate-100 text-slate-300 hover:text-slate-500 shrink-0">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-1" align="end">
            <button onClick={() => { onRemove(); setMenuOpen(false); }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-red-50 text-slate-600 hover:text-red-600">
              <Trash2 className="h-3.5 w-3.5" />
              {item.isCustom ? "Eliminar ítem" : "Quitar del status"}
            </button>
          </PopoverContent>
        </Popover>
      </div>

      {expanded && (
        <div className="px-10 pb-3 pt-1 bg-slate-50/60 border-t border-slate-100">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide mb-1">Riesgo principal</p>
              <InlineText value={item.mainRisk} placeholder="¿Cuál es el riesgo?" onSave={v => onUpdate({ mainRisk: v })} multiline />
            </div>
            <div>
              <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide mb-1">Acción en curso</p>
              <InlineText value={item.currentAction} placeholder="Acción en curso..." onSave={v => onUpdate({ currentAction: v })} multiline />
            </div>
            <div>
              <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide mb-1">Próximo hito</p>
              <InlineText value={item.nextMilestone} placeholder="Próximo hito..." onSave={v => onUpdate({ nextMilestone: v })} />
              <div className="mt-2">
                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide mb-1">Decisión</p>
                <DecisionBadge value={item.decisionNeeded} onChange={v => onUpdate({ decisionNeeded: v })} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add custom item dialog ───────────────────────────────────────────────────

function AddItemButton({ onAdd }: { onAdd: (title: string, subtitle: string) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');

  const submit = () => {
    if (!title.trim()) return;
    onAdd(title.trim(), subtitle.trim());
    setTitle(''); setSubtitle(''); setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50">
          <Plus className="h-3.5 w-3.5" />
          Agregar ítem
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <p className="text-sm font-semibold mb-3">Nuevo ítem de seguimiento</p>
        <div className="space-y-2">
          <div>
            <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-1 block">Título *</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="Ej: Reunión con inversores, Restructura interna..."
              className="w-full text-sm border border-input rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400" autoFocus />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-1 block">Descripción (opcional)</label>
            <input value={subtitle} onChange={e => setSubtitle(e.target.value)}
              placeholder="Contexto adicional..."
              className="w-full text-sm border border-input rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <Button size="sm" onClick={submit} disabled={!title.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white flex-1 h-7 text-xs">
            Agregar
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOpen(false)} className="h-7 text-xs">
            Cancelar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Notes panel ─────────────────────────────────────────────────────────────

function NotesPanel({ projectId, projectName, onClose }: { projectId: number; projectName: string; onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newNote, setNewNote] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: notes = [], isLoading } = useQuery<Note[]>({
    queryKey: ['/api/status-semanal', projectId, 'notes'],
    queryFn: async () => { const r = await authFetch(`/api/status-semanal/${projectId}/notes`); return r.json(); },
  });

  const addMutation = useMutation({
    mutationFn: (content: string) => apiRequest(`/api/status-semanal/${projectId}/notes`, 'POST', { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/status-semanal', projectId, 'notes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/status-semanal'] });
    },
    onError: () => toast({ title: 'Error al guardar nota', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (noteId: number) => apiRequest(`/api/status-semanal/notes/${noteId}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/status-semanal', projectId, 'notes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/status-semanal'] });
    },
    onError: () => toast({ title: 'Error al eliminar nota', variant: 'destructive' }),
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [notes.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-slate-50">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="h-4 w-4 text-indigo-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{projectName}</p>
            <p className="text-xs text-muted-foreground">{notes.length} nota{notes.length !== 1 ? 's' : ''} de reunión</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-accent rounded text-muted-foreground shrink-0"><X className="h-4 w-4" /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {isLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
        {!isLoading && notes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Sin notas todavía</p>
          </div>
        )}
        {notes.map(note => {
          const isOwn = note.authorId === (user as any)?.id;
          return (
            <div key={note.id} className="group flex gap-2.5">
              <div className={cn("h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5", isOwn ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600")}>
                {initials(note.authorName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs font-semibold">{note.authorName || 'Usuario'}</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-[10px] text-muted-foreground cursor-default">{relTime(note.noteDate)}</span>
                      </TooltipTrigger>
                      <TooltipContent>{new Date(note.noteDate).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' })}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="text-xs bg-white border border-slate-100 rounded-lg px-3 py-2 leading-relaxed whitespace-pre-wrap shadow-sm">{note.content}</div>
              </div>
              {isOwn && (
                <button onClick={() => deleteMutation.mutate(note.id)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-400 transition-opacity shrink-0 mt-0.5">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-border shrink-0 bg-slate-50">
        <div className="flex gap-2 items-end">
          <Textarea value={newNote} onChange={e => setNewNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const t = newNote.trim(); if (t) { setNewNote(''); addMutation.mutate(t); } } }}
            placeholder="Nota de reunión..." className="resize-none text-sm min-h-[52px] max-h-[120px] flex-1 bg-white" />
          <Button size="sm" onClick={() => { const t = newNote.trim(); if (t) { setNewNote(''); addMutation.mutate(t); } }}
            disabled={!newNote.trim() || addMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 w-8 p-0 shrink-0">
            {addMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">Enter para guardar · Shift+Enter nueva línea</p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StatusSemanalPage() {
  const { toast } = useToast();
  const [notesOpen, setNotesOpen] = useState<number | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: projectRows = [], isLoading: loadingProjects } = useQuery<StatusRow[]>({
    queryKey: ['/api/status-semanal'],
    queryFn: async () => { const r = await authFetch('/api/status-semanal'); return r.json(); },
    staleTime: 30000,
  });

  const { data: customRows = [], isLoading: loadingCustom } = useQuery<CustomItem[]>({
    queryKey: ['/api/status-semanal/custom'],
    queryFn: async () => { const r = await authFetch('/api/status-semanal/custom'); return r.json(); },
    staleTime: 30000,
  });

  const { data: rawUsers } = useQuery<AppUser[]>({
    queryKey: ['/api/status-semanal/users'],
    queryFn: async () => { const r = await authFetch('/api/status-semanal/users'); return r.json(); },
    staleTime: 60000,
  });
  const appUsers: AppUser[] = Array.isArray(rawUsers) ? rawUsers : [];

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const patchProject = useMutation({
    mutationFn: ({ projectId, data }: { projectId: number; data: Record<string, any> }) =>
      apiRequest(`/api/status-semanal/${projectId}`, 'PATCH', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/status-semanal'] }),
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/status-semanal'] });
      toast({ title: 'Error al guardar', variant: 'destructive' });
    },
  });

  const removeProject = useMutation({
    mutationFn: (projectId: number) => apiRequest(`/api/status-semanal/${projectId}`, 'DELETE'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/status-semanal'] }),
    onError: () => toast({ title: 'Error al quitar proyecto', variant: 'destructive' }),
  });

  const createCustom = useMutation({
    mutationFn: ({ title, subtitle }: { title: string; subtitle: string }) =>
      apiRequest('/api/status-semanal/custom', 'POST', { title, subtitle: subtitle || null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/status-semanal/custom'] }),
    onError: () => toast({ title: 'Error al crear ítem', variant: 'destructive' }),
  });

  const patchCustom = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, any> }) =>
      apiRequest(`/api/status-semanal/custom/${id}`, 'PATCH', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/status-semanal/custom'] }),
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/status-semanal/custom'] });
      toast({ title: 'Error al guardar', variant: 'destructive' });
    },
  });

  const deleteCustom = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/status-semanal/custom/${id}`, 'DELETE'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/status-semanal/custom'] }),
    onError: () => toast({ title: 'Error al eliminar', variant: 'destructive' }),
  });

  // ── Update helpers ────────────────────────────────────────────────────────────

  const updateProject = (projectId: number, data: Record<string, any>) => {
    queryClient.setQueryData<StatusRow[]>(['/api/status-semanal'], prev =>
      prev ? prev.map(r => r.projectId === projectId ? { ...r, ...data } : r) : prev
    );
    patchProject.mutate({ projectId, data });
  };

  const updateCustom = (id: number, data: Record<string, any>) => {
    queryClient.setQueryData<CustomItem[]>(['/api/status-semanal/custom'], prev =>
      prev ? prev.map(c => c.id === id ? { ...c, ...data } : c) : prev
    );
    patchCustom.mutate({ id, data });
  };

  // ── Unified item list ─────────────────────────────────────────────────────────

  const toItem = (r: StatusRow): Item => ({
    key: `p_${r.projectId}`,
    isCustom: false,
    projectId: r.projectId,
    title: r.clientName || '(Sin cliente)',
    subtitle: r.quotationName,
    healthStatus: r.healthStatus,
    marginStatus: r.marginStatus,
    teamStrain: r.teamStrain,
    mainRisk: r.mainRisk,
    currentAction: r.currentAction,
    nextMilestone: r.nextMilestone,
    ownerId: r.ownerId,
    ownerName: r.ownerName,
    decisionNeeded: r.decisionNeeded,
    hiddenFromWeekly: r.hiddenFromWeekly,
    noteCount: r.noteCount,
  });

  const toCustomItem = (c: CustomItem): Item => ({
    key: `c_${c.id}`,
    isCustom: true,
    customId: c.id,
    title: c.title,
    subtitle: c.subtitle,
    healthStatus: c.healthStatus,
    marginStatus: c.marginStatus,
    teamStrain: c.teamStrain,
    mainRisk: c.mainRisk,
    currentAction: c.currentAction,
    nextMilestone: c.nextMilestone,
    ownerId: c.ownerId,
    ownerName: c.ownerName,
    decisionNeeded: c.decisionNeeded,
    hiddenFromWeekly: c.hiddenFromWeekly,
    noteCount: 0,
  });

  const allItems: Item[] = [
    ...projectRows.map(toItem),
    ...customRows.map(toCustomItem),
  ];

  const visible = allItems.filter(i => showHidden ? true : !i.hiddenFromWeekly);
  const hiddenCount = allItems.filter(i => i.hiddenFromWeekly).length;

  const rojoItems    = visible.filter(i => i.healthStatus === 'rojo');
  const amarilloItems = visible.filter(i => i.healthStatus === 'amarillo');
  const alertItems   = [...rojoItems, ...amarilloItems];
  const decisionItems = visible.filter(i => dm(i.decisionNeeded).urgent && (i.healthStatus === 'verde' || !i.healthStatus));
  const normalItems   = visible.filter(i => (!i.healthStatus || i.healthStatus === 'verde') && !dm(i.decisionNeeded).urgent);

  const criticalCount = rojoItems.length + amarilloItems.length;
  const decisionCount = visible.filter(i => dm(i.decisionNeeded).urgent).length;

  const getItemHandlers = (item: Item) => ({
    onUpdate: (data: Record<string, any>) => {
      if (item.isCustom && item.customId) updateCustom(item.customId, data);
      else if (item.projectId) updateProject(item.projectId, data);
    },
    onRemove: () => {
      if (item.isCustom && item.customId) {
        deleteCustom.mutate(item.customId);
      } else if (item.projectId) {
        removeProject.mutate(item.projectId);
      }
    },
    onOpenNotes: item.projectId ? () => setNotesOpen(notesOpen === item.projectId ? null : item.projectId!) : undefined,
  });

  const openNotesProject = projectRows.find(r => r.projectId === notesOpen);
  const notesProjectName = openNotesProject
    ? `${openNotesProject.clientName || ''}${openNotesProject.quotationName ? ` · ${openNotesProject.quotationName}` : ''}`
    : '';

  const isLoading = loadingProjects || loadingCustom;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className={cn("flex flex-col flex-1 min-w-0 transition-all duration-200", notesOpen ? "mr-[380px]" : "")}>

        {/* ── Header ────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-border shrink-0 bg-background">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
                <ClipboardList className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">Status Semanal</h1>
                <p className="text-xs text-muted-foreground">{weekLabel()}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {criticalCount > 0 ? (
                <div className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {criticalCount} requiere{criticalCount !== 1 ? 'n' : ''} atención
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Sin alertas esta semana
                </div>
              )}
              {decisionCount > 0 && (
                <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-300 text-amber-800 text-xs font-bold px-3 py-1.5 rounded-full">
                  <Zap className="h-3.5 w-3.5" />
                  {decisionCount} decisión{decisionCount !== 1 ? 'es' : ''}
                </div>
              )}
              {hiddenCount > 0 && (
                <button onClick={() => setShowHidden(v => !v)}
                  className={cn("flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors",
                    showHidden ? "bg-slate-700 text-white border-slate-700" : "bg-white text-slate-400 border-slate-200 hover:border-slate-400")}>
                  {showHidden ? <><Eye className="h-3 w-3" /> Ocultar quitados</> : <><EyeOff className="h-3 w-3" /> {hiddenCount} quitado{hiddenCount !== 1 ? 's' : ''}</>}
                </button>
              )}
              <AddItemButton onAdd={(title, subtitle) => createCustom.mutate({ title, subtitle })} />
              <div className="text-xs text-muted-foreground bg-slate-100 px-2.5 py-1 rounded-full font-medium">
                {visible.length} ítem{visible.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>

        {/* ── Content ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">

              {/* ── Requieren atención ─────────────────────────────── */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className={cn("h-5 w-5", alertItems.length > 0 ? "text-red-500" : "text-slate-300")} />
                  <h2 className="text-base font-bold text-foreground">Requieren atención</h2>
                  <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border",
                    alertItems.length > 0 ? "bg-red-100 text-red-700 border-red-200" : "bg-slate-100 text-slate-400 border-slate-200")}>
                    {alertItems.length}
                  </span>
                </div>
                {alertItems.length === 0 ? (
                  <div className="flex items-center gap-2 py-4 px-4 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 text-emerald-600">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span className="text-sm font-medium">Sin proyectos en alerta — todo bajo control</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {alertItems.map(item => {
                      const h = getItemHandlers(item);
                      return <AlertCard key={item.key} item={item} users={appUsers}
                        isSelected={!item.isCustom && notesOpen === item.projectId}
                        onOpenNotes={h.onOpenNotes} onUpdate={h.onUpdate} onRemove={h.onRemove} />;
                    })}
                  </div>
                )}
              </div>

              {/* ── Decisiones pendientes ──────────────────────────── */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Zap className={cn("h-5 w-5", decisionItems.length > 0 ? "text-amber-500" : "text-slate-300")} />
                  <h2 className="text-base font-bold text-foreground">Decisiones pendientes</h2>
                  <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border",
                    decisionItems.length > 0 ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-slate-100 text-slate-400 border-slate-200")}>
                    {decisionItems.length}
                  </span>
                </div>
                {decisionItems.length === 0 ? (
                  <div className="flex items-center gap-2 py-4 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-slate-400">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span className="text-sm">Sin decisiones pendientes esta semana</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {decisionItems.map(item => {
                      const h = getItemHandlers(item);
                      return <AlertCard key={item.key} item={item} users={appUsers}
                        isSelected={!item.isCustom && notesOpen === item.projectId}
                        onOpenNotes={h.onOpenNotes} onUpdate={h.onUpdate} onRemove={h.onRemove} />;
                    })}
                  </div>
                )}
              </div>

              {/* ── En curso ───────────────────────────────────────── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Circle className={cn("h-4 w-4 fill-current", normalItems.length > 0 ? "text-emerald-500" : "text-slate-300")} />
                  <h2 className="text-base font-bold text-foreground">En curso</h2>
                  <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border",
                    normalItems.length > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-400 border-slate-200")}>
                    {normalItems.length}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">· Expandí para editar</span>
                </div>
                {normalItems.length === 0 ? (
                  <div className="flex items-center gap-2 py-4 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-slate-400">
                    <span className="text-sm">Sin ítems en curso</span>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 border-b border-slate-200">
                      <div className="w-3.5 shrink-0" />
                      <div className="w-20 shrink-0 text-[10px] font-bold text-slate-400 uppercase tracking-wide">Estado</div>
                      <div className="flex-1 text-[10px] font-bold text-slate-400 uppercase tracking-wide">Cliente · Proyecto</div>
                      <div className="hidden lg:flex items-center gap-8 shrink-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Margen</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Equipo</span>
                      </div>
                      <div className="hidden lg:block w-44 text-[10px] font-bold text-slate-400 uppercase tracking-wide shrink-0">Riesgo</div>
                      <div className="w-24 text-[10px] font-bold text-slate-400 uppercase tracking-wide shrink-0">Owner</div>
                      <div className="w-16" />
                    </div>
                    {normalItems.map(item => {
                      const h = getItemHandlers(item);
                      return <CompactRow key={item.key} item={item} users={appUsers}
                        isSelected={!item.isCustom && notesOpen === item.projectId}
                        onOpenNotes={h.onOpenNotes} onUpdate={h.onUpdate} onRemove={h.onRemove} />;
                    })}
                  </div>
                )}
              </div>

              {/* ── Quitados ───────────────────────────────────────── */}
              {showHidden && hiddenCount > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <EyeOff className="h-4 w-4 text-slate-300" />
                    <h2 className="text-base font-bold text-slate-400">Quitados del status</h2>
                    <span className="text-xs font-semibold bg-slate-100 text-slate-400 border-slate-200 px-2 py-0.5 rounded-full border">{hiddenCount}</span>
                  </div>
                  <div className="rounded-xl border border-dashed border-slate-200 overflow-hidden opacity-60">
                    {allItems.filter(i => i.hiddenFromWeekly).map(item => {
                      const h = getItemHandlers(item);
                      return (
                        <div key={item.key} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 last:border-0 hover:bg-slate-50">
                          <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", hm(item.healthStatus).dot)} />
                          <span className="flex-1 text-sm text-slate-500">{item.title}{item.subtitle && ` · ${item.subtitle}`}</span>
                          <button onClick={() => h.onUpdate({ hiddenFromWeekly: false })}
                            className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium">
                            <Eye className="h-3.5 w-3.5" /> Restaurar
                          </button>
                          {item.isCustom && (
                            <button onClick={h.onRemove} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 font-medium ml-2">
                              <Trash2 className="h-3.5 w-3.5" /> Eliminar
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Notes panel ─────────────────────────────────────────── */}
      {notesOpen !== null && (
        <div className="fixed top-0 right-0 h-full w-[380px] border-l border-border bg-background shadow-2xl z-20 flex flex-col">
          {openNotesProject && (
            <NotesPanel projectId={notesOpen} projectName={notesProjectName} onClose={() => setNotesOpen(null)} />
          )}
        </div>
      )}
    </div>
  );
}
