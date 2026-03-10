import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, authFetch } from "@/lib/queryClient";
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
  Circle, MoreHorizontal, Plus, Tag,
  Sparkles, Brain, TrendingUp, TrendingDown,
  Shield, Target, RefreshCw, Lightbulb, ArrowRight,
  Calendar, Clock
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
  deadline: string | null;
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
  deadline: string | null;
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

// AI Summary types
type AISummary = {
  executiveSummary: string;
  highlights: { type: 'risk' | 'win' | 'action' | 'decision'; text: string }[];
  projectInsights: {
    projectId: number;
    clientName: string;
    insight: string;
    suggestedRisk?: string;
    suggestedAction?: string;
  }[];
  weeklyScore: number;
};

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
  deadline: string | null;
  ownerId: number | null;
  ownerName: string | null;
  decisionNeeded: string | null;
  hiddenFromWeekly: boolean | null;
  noteCount: number;
  isOverdue: boolean;
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

// Direct fetch helper for mutations – avoids apiRequest's JSON parse layer
// and gives explicit control over error handling so failures surface clearly.
async function mutationFetch(url: string, method: string, body?: any) {
  const res = await authFetch(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let msg: string;
    try { msg = JSON.parse(text)?.message || text; } catch { msg = text; }
    throw new Error(msg || `Error ${res.status}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
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

// ─── Deadline picker ─────────────────────────────────────────────────────────

function deadlineLabel(d: string | null): string {
  if (!d) return '';
  const date = new Date(d);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const fmt = date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  if (diff < 0) return `${fmt} (${Math.abs(diff)}d atrás)`;
  if (diff === 0) return `${fmt} (hoy)`;
  if (diff <= 7) return `${fmt} (${diff}d)`;
  return fmt;
}

function DeadlinePicker({ value, isOverdue, onChange }: {
  value: string | null; isOverdue: boolean; onChange: (v: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const toDateStr = (d: string | null) => {
    if (!d) return '';
    return new Date(d).toISOString().split('T')[0];
  };

  if (!value) {
    return (
      <button onClick={() => inputRef.current?.showPicker()}
        className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-600 transition-colors relative">
        <Calendar className="h-3 w-3" />
        <span>Deadline</span>
        <input ref={inputRef} type="date"
          className="absolute inset-0 opacity-0 cursor-pointer w-full"
          onChange={e => e.target.value && onChange(new Date(e.target.value).toISOString())} />
      </button>
    );
  }

  return (
    <div className={cn("flex items-center gap-1 text-[11px] font-medium rounded-md px-1.5 py-0.5 relative group",
      isOverdue ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600")}>
      {isOverdue ? <Clock className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
      <span>{deadlineLabel(value)}</span>
      <button onClick={e => { e.stopPropagation(); onChange(null); }}
        className="hidden group-hover:inline-flex ml-0.5 text-slate-400 hover:text-red-500">
        <X className="h-2.5 w-2.5" />
      </button>
      <input type="date" value={toDateStr(value)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full"
        onChange={e => e.target.value ? onChange(new Date(e.target.value).toISOString()) : onChange(null)} />
    </div>
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
  const barColor = item.isOverdue ? 'bg-red-500' : ({ verde: 'bg-emerald-500', amarillo: 'bg-amber-400', rojo: 'bg-red-500' }[item.healthStatus ?? 'verde'] ?? 'bg-emerald-500');

  return (
    <div className={cn(
      "rounded-xl border bg-white shadow-sm transition-all overflow-hidden",
      item.isOverdue ? "border-red-300" : item.healthStatus === 'rojo' ? "border-red-200" : item.healthStatus === 'amarillo' ? "border-amber-200" : "border-indigo-200",
      isSelected && "ring-2 ring-indigo-400"
    )}>
      <div className={cn("h-1 w-full", barColor)} />
      <div className="px-4 py-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1 flex items-center gap-1.5">
            {item.isCustom && <Tag className="h-3 w-3 text-indigo-400 shrink-0" />}
            <p className="font-semibold text-sm text-foreground leading-tight truncate">{item.title}</p>
            {item.subtitle && <span className="text-xs text-muted-foreground truncate hidden sm:inline">· {item.subtitle}</span>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <HealthDot value={item.healthStatus} onChange={v => onUpdate({ healthStatus: v })} />
            <button onClick={onRemove}
              className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              title={item.isCustom ? "Eliminar ítem" : "Quitar del status"}>
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Decision alert */}
        {isUrgentDec && (
          <div className={cn("flex items-center gap-1.5 rounded-md px-2 py-1.5 mb-2 border text-xs font-semibold", decMeta.color)}>
            <Zap className="h-3 w-3 shrink-0" />
            Decisión:
            <DecisionBadge value={item.decisionNeeded} onChange={v => onUpdate({ decisionNeeded: v })} />
          </div>
        )}

        {/* Overdue alert */}
        {item.isOverdue && (
          <div className="flex items-center gap-1.5 rounded-md px-2 py-1.5 mb-2 bg-red-100 border border-red-200 text-red-700 text-xs font-semibold">
            <Clock className="h-3 w-3 shrink-0" />
            Demorado — {deadlineLabel(item.deadline)}
          </div>
        )}

        {/* Metrics row */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <LevelBadge value={item.marginStatus} onChange={v => onUpdate({ marginStatus: v })} label="Margen" />
          <LevelBadge value={item.teamStrain} onChange={v => onUpdate({ teamStrain: v })} label="Equipo" />
          {!isUrgentDec && <DecisionBadge value={item.decisionNeeded} onChange={v => onUpdate({ decisionNeeded: v })} />}
        </div>

        {/* Risk */}
        <div className={cn("rounded-md px-2.5 py-2 mb-2", item.healthStatus === 'rojo' ? "bg-red-50" : item.healthStatus === 'amarillo' ? "bg-amber-50" : "bg-slate-50")}>
          <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide mb-0.5">Riesgo</p>
          <InlineText value={item.mainRisk} placeholder="¿Cuál es el riesgo?" onSave={v => onUpdate({ mainRisk: v })} multiline className="text-xs" />
        </div>

        {/* Action + Milestone */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide mb-0.5">Acción</p>
            <InlineText value={item.currentAction} placeholder="¿Qué pasa?" onSave={v => onUpdate({ currentAction: v })} multiline className="text-xs" />
          </div>
          <div>
            <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide mb-0.5">Próximo hito</p>
            <InlineText value={item.nextMilestone} placeholder="¿Qué sigue?" onSave={v => onUpdate({ nextMilestone: v })} className="text-xs" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <OwnerSelect value={item.ownerId} name={item.ownerName} onChange={v => onUpdate({ ownerId: v })} users={users} />
            <DeadlinePicker value={item.deadline} isOverdue={item.isOverdue} onChange={v => onUpdate({ deadline: v })} />
          </div>
          {!item.isCustom && onOpenNotes && (
            <button onClick={onOpenNotes}
              className={cn("flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 font-medium transition-colors",
                isSelected ? "bg-indigo-600 text-white" : item.noteCount > 0 ? "bg-indigo-100 text-indigo-600" : "text-slate-400 hover:text-indigo-600")}>
              <MessageSquare className="h-2.5 w-2.5" />
              {item.noteCount}
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
        <div className="w-20 shrink-0">
          <HealthDot value={item.healthStatus} onChange={v => onUpdate({ healthStatus: v })} />
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          {item.isCustom && <Tag className="h-3 w-3 text-indigo-400 shrink-0" />}
          <span className="font-semibold text-sm text-foreground truncate">{item.title}</span>
          {item.subtitle && <span className="text-muted-foreground text-sm truncate shrink-0"> · {item.subtitle}</span>}
        </div>
        <div className="hidden lg:block w-[88px] shrink-0">
          <LevelBadge value={item.marginStatus} onChange={v => onUpdate({ marginStatus: v })} label="Margen" />
        </div>
        <div className="hidden lg:block w-[88px] shrink-0">
          <LevelBadge value={item.teamStrain} onChange={v => onUpdate({ teamStrain: v })} label="Equipo" />
        </div>
        <div className="hidden lg:block w-40 shrink-0">
          <InlineText value={item.mainRisk} placeholder="Sin riesgo registrado" onSave={v => onUpdate({ mainRisk: v })} className="text-xs truncate block" />
        </div>
        <div className="w-24 shrink-0">
          <OwnerSelect value={item.ownerId} name={item.ownerName} onChange={v => onUpdate({ ownerId: v })} users={users} />
        </div>
        <div className="w-20 shrink-0">
          <DeadlinePicker value={item.deadline} isOverdue={item.isOverdue} onChange={v => onUpdate({ deadline: v })} />
        </div>
        <div className="w-16 shrink-0 flex items-center justify-end gap-1">
          {decMeta.urgent && (
            <DecisionBadge value={item.decisionNeeded} onChange={v => onUpdate({ decisionNeeded: v })} />
          )}
          {!item.isCustom && onOpenNotes && (
            <button onClick={onOpenNotes}
              className={cn("flex items-center gap-1 text-xs rounded-full px-2 py-0.5 font-medium transition-colors",
                isSelected ? "bg-indigo-600 text-white" : item.noteCount > 0 ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-400 hover:bg-indigo-100 hover:text-indigo-700")}>
              <MessageSquare className="h-3 w-3" />
              <span>{item.noteCount}</span>
            </button>
          )}
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <button className="p-1 rounded hover:bg-slate-100 text-slate-300 hover:text-slate-500">
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
            <div className="space-y-2">
              <div>
                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide mb-1">Próximo hito</p>
                <InlineText value={item.nextMilestone} placeholder="Próximo hito..." onSave={v => onUpdate({ nextMilestone: v })} />
              </div>
              <div>
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

function AddItemButton({ onAdd, variant = 'header' }: { onAdd: (title: string, subtitle: string) => void; variant?: 'header' | 'inline' }) {
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
        {variant === 'inline' ? (
          <button className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 font-medium transition-colors ml-1">
            <Plus className="h-3.5 w-3.5" />
          </button>
        ) : (
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50">
            <Plus className="h-3.5 w-3.5" />
            Agregar ítem
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align={variant === 'inline' ? 'start' : 'end'}>
        <p className="text-sm font-semibold mb-3">Nuevo ítem de seguimiento</p>
        <div className="space-y-2">
          <div>
            <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-1 block">Título *</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="Ej: Reunión con inversores..."
              className="w-full text-sm border border-input rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400" autoFocus />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-1 block">Descripción (opcional)</label>
            <input value={subtitle} onChange={e => setSubtitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
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

// ─── Health Score Ring ────────────────────────────────────────────────────────

function HealthScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor"
          className="text-slate-100" strokeWidth={6} />
        <motion.circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color}
          strokeWidth={6} strokeLinecap="round" strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span className="text-xl font-black" style={{ color }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          {score}
        </motion.span>
        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Score</span>
      </div>
    </div>
  );
}

// ─── AI Highlight Chip ───────────────────────────────────────────────────────

const highlightConfig = {
  risk: { icon: Shield, bg: 'bg-red-50 border-red-200', text: 'text-red-700', iconColor: 'text-red-500' },
  win: { icon: TrendingUp, bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', iconColor: 'text-emerald-500' },
  action: { icon: Target, bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', iconColor: 'text-blue-500' },
  decision: { icon: Zap, bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', iconColor: 'text-amber-500' },
};

function HighlightChip({ type, text }: { type: 'risk' | 'win' | 'action' | 'decision'; text: string }) {
  const cfg = highlightConfig[type];
  const Icon = cfg.icon;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold", cfg.bg, cfg.text)}>
      <Icon className={cn("h-3 w-3 shrink-0", cfg.iconColor)} />
      <span>{text}</span>
    </motion.div>
  );
}

// ─── AI Summary Panel ────────────────────────────────────────────────────────

function AISummaryPanel({ summary, isLoading, onGenerate, itemCount }: {
  summary: AISummary | null;
  isLoading: boolean;
  onGenerate: () => void;
  itemCount: number;
}) {
  const [expanded, setExpanded] = useState(true);

  if (!summary && !isLoading) {
    return (
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-indigo-200/50 bg-indigo-50/40">
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-4 w-4 text-indigo-400" />
          <span className="text-xs text-slate-500">Generá un resumen IA de los {itemCount} proyectos</span>
        </div>
        <Button onClick={onGenerate} size="sm" variant="ghost"
          className="h-7 text-xs text-indigo-600 hover:bg-indigo-100 gap-1.5 font-semibold">
          <Sparkles className="h-3 w-3" />
          Generar resumen
        </Button>
      </motion.div>
    );
  }

  if (isLoading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="relative overflow-hidden rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/50 shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-100/30 via-transparent to-transparent" />
        <div className="relative flex items-center gap-4 px-6 py-8 justify-center">
          <div className="relative">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
            <Sparkles className="h-3.5 w-3.5 text-violet-500 absolute -top-1 -right-1 animate-pulse" />
          </div>
          <div>
            <p className="text-sm font-semibold text-indigo-700">Analizando {itemCount} proyectos...</p>
            <p className="text-xs text-indigo-400 mt-0.5">Claude está generando el resumen ejecutivo</p>
          </div>
        </div>
      </motion.div>
    );
  }

  if (!summary) return null;

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/50 shadow-sm">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-100/30 via-transparent to-transparent" />

      {/* Header */}
      <div className="relative flex items-center justify-between px-6 py-4 border-b border-indigo-100/60">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-3 group">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-200/50">
            <Brain className="h-4 w-4 text-white" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800">Análisis IA</h3>
              <Badge variant="outline" className="text-[9px] h-4 bg-indigo-100 text-indigo-700 border-indigo-200 font-bold">
                Claude
              </Badge>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">{expanded ? 'Click para colapsar' : 'Click para expandir'}</p>
          </div>
          <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform ml-1", !expanded && "-rotate-90")} />
        </button>

        <div className="flex items-center gap-3">
          <HealthScoreRing score={summary.weeklyScore} size={56} />
          <Button onClick={onGenerate} variant="ghost" size="sm"
            className="h-8 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100 gap-1.5">
            <RefreshCw className="h-3 w-3" />
            Regenerar
          </Button>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden">
            <div className="relative px-6 py-4 space-y-4">
              {/* Executive Summary */}
              <div className="bg-white/70 rounded-xl border border-slate-100 p-4">
                <p className="text-sm text-slate-700 leading-relaxed">{summary.executiveSummary}</p>
              </div>

              {/* Highlights */}
              {summary.highlights.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {summary.highlights.map((h, i) => (
                    <HighlightChip key={i} type={h.type} text={h.text} />
                  ))}
                </div>
              )}

              {/* Project Insights */}
              {summary.projectInsights.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Lightbulb className="h-3 w-3" />
                    Insights por proyecto
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {summary.projectInsights.map((pi, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-start gap-2 bg-white/60 rounded-lg border border-slate-100 px-3 py-2">
                        <ArrowRight className="h-3 w-3 text-indigo-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-indigo-600">{pi.clientName}</p>
                          <p className="text-xs text-slate-600 leading-snug">{pi.insight}</p>
                          {pi.suggestedRisk && (
                            <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                              <Shield className="h-2.5 w-2.5" /> Riesgo sugerido: {pi.suggestedRisk}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Notes panel ─────────────────────────────────────────────────────────────

function NotesPanel({ projectId, projectName, onClose }: { projectId: number; projectName: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [newNote, setNewNote] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: notes = [], isLoading } = useQuery<Note[]>({
    queryKey: ['/api/status-semanal', projectId, 'notes'],
    queryFn: async () => { const r = await authFetch(`/api/status-semanal/${projectId}/notes`); return r.json(); },
  });

  const addMutation = useMutation({
    mutationFn: (content: string) => mutationFetch(`/api/status-semanal/${projectId}/notes`, 'POST', { content }),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['/api/status-semanal', projectId, 'notes'] });
      queryClient.refetchQueries({ queryKey: ['/api/status-semanal'] });
    },
    onError: (err: Error) => toast({ title: 'Error al guardar nota', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (noteId: number) => mutationFetch(`/api/status-semanal/notes/${noteId}`, 'DELETE'),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['/api/status-semanal', projectId, 'notes'] });
      queryClient.refetchQueries({ queryKey: ['/api/status-semanal'] });
    },
    onError: (err: Error) => toast({ title: 'Error al eliminar nota', description: err.message, variant: 'destructive' }),
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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [notesOpen, setNotesOpen] = useState<number | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);

  // ── AI Summary mutation ─────────────────────────────────────────────────────

  const aiMutation = useMutation({
    mutationFn: () => mutationFetch('/api/status-semanal/ai-summary', 'POST'),
    onSuccess: (data: AISummary) => {
      setAiSummary(data);
      toast({ title: 'Resumen generado', description: `Score del portafolio: ${data.weeklyScore}/100` });
    },
    onError: (err: Error) => {
      toast({ title: 'Error al generar resumen IA', description: err.message, variant: 'destructive' });
    },
  });

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: projectRows = [], isLoading: loadingProjects } = useQuery<StatusRow[]>({
    queryKey: ['/api/status-semanal'],
    staleTime: 0,
  });

  const { data: customRows = [], isLoading: loadingCustom } = useQuery<CustomItem[]>({
    queryKey: ['/api/status-semanal/custom'],
    staleTime: 0,
  });

  const { data: rawUsers } = useQuery<AppUser[]>({
    queryKey: ['/api/status-semanal/users'],
    staleTime: 60000,
  });
  const appUsers: AppUser[] = Array.isArray(rawUsers) ? rawUsers : [];

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const patchProject = useMutation({
    mutationFn: ({ projectId, data }: { projectId: number; data: Record<string, any> }) =>
      mutationFetch(`/api/status-semanal/${projectId}`, 'PATCH', data),
    onMutate: async ({ projectId, data }) => {
      await queryClient.cancelQueries({ queryKey: ['/api/status-semanal'] });
      const previous = queryClient.getQueryData<StatusRow[]>(['/api/status-semanal']);
      queryClient.setQueryData<StatusRow[]>(['/api/status-semanal'], prev =>
        prev ? prev.map(r => r.projectId === projectId ? { ...r, ...data } : r) : prev
      );
      return { previous };
    },
    onError: (err: Error, _vars, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(['/api/status-semanal'], ctx.previous);
      toast({ title: 'Error al guardar', description: err.message, variant: 'destructive' });
    },
    onSettled: () => {
      queryClient.refetchQueries({ queryKey: ['/api/status-semanal'], exact: true });
    },
  });

  const removeProject = useMutation({
    mutationFn: (projectId: number) =>
      mutationFetch(`/api/status-semanal/${projectId}`, 'DELETE'),
    onMutate: async (projectId) => {
      await queryClient.cancelQueries({ queryKey: ['/api/status-semanal'] });
      const previous = queryClient.getQueryData<StatusRow[]>(['/api/status-semanal']);
      queryClient.setQueryData<StatusRow[]>(['/api/status-semanal'], prev =>
        prev ? prev.map(r => r.projectId === projectId ? { ...r, hiddenFromWeekly: true } : r) : prev
      );
      return { previous };
    },
    onError: (err: Error, _vars, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(['/api/status-semanal'], ctx.previous);
      toast({ title: 'Error al quitar proyecto', description: err.message, variant: 'destructive' });
    },
    onSettled: () => {
      queryClient.refetchQueries({ queryKey: ['/api/status-semanal'], exact: true });
    },
  });

  const createCustom = useMutation({
    mutationFn: ({ title, subtitle }: { title: string; subtitle: string }) =>
      mutationFetch('/api/status-semanal/custom', 'POST', { title, subtitle: subtitle || null }),
    onError: (err: Error) => toast({ title: 'Error al crear ítem', description: err.message, variant: 'destructive' }),
    onSettled: () => {
      queryClient.refetchQueries({ queryKey: ['/api/status-semanal/custom'], exact: true });
    },
  });

  const patchCustom = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, any> }) =>
      mutationFetch(`/api/status-semanal/custom/${id}`, 'PATCH', data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['/api/status-semanal/custom'] });
      const previous = queryClient.getQueryData<CustomItem[]>(['/api/status-semanal/custom']);
      queryClient.setQueryData<CustomItem[]>(['/api/status-semanal/custom'], prev =>
        prev ? prev.map(c => c.id === id ? { ...c, ...data } : c) : prev
      );
      return { previous };
    },
    onError: (err: Error, _vars, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(['/api/status-semanal/custom'], ctx.previous);
      toast({ title: 'Error al guardar', description: err.message, variant: 'destructive' });
    },
    onSettled: () => {
      queryClient.refetchQueries({ queryKey: ['/api/status-semanal/custom'], exact: true });
    },
  });

  const deleteCustom = useMutation({
    mutationFn: (id: number) =>
      mutationFetch(`/api/status-semanal/custom/${id}`, 'DELETE'),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['/api/status-semanal/custom'] });
      const previous = queryClient.getQueryData<CustomItem[]>(['/api/status-semanal/custom']);
      queryClient.setQueryData<CustomItem[]>(['/api/status-semanal/custom'], prev =>
        prev ? prev.filter(c => c.id !== id) : prev
      );
      return { previous };
    },
    onError: (err: Error, _vars, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(['/api/status-semanal/custom'], ctx.previous);
      toast({ title: 'Error al eliminar', description: err.message, variant: 'destructive' });
    },
    onSettled: () => {
      queryClient.refetchQueries({ queryKey: ['/api/status-semanal/custom'], exact: true });
    },
  });

  // ── Update helpers ────────────────────────────────────────────────────────────

  const updateProject = (projectId: number, data: Record<string, any>) => {
    patchProject.mutate({ projectId, data });
  };

  const updateCustom = (id: number, data: Record<string, any>) => {
    patchCustom.mutate({ id, data });
  };

  // ── Unified item list ─────────────────────────────────────────────────────────

  const isOverdue = (d: string | null) => {
    if (!d) return false;
    const dl = new Date(d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dl < today;
  };

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
    deadline: r.deadline,
    ownerId: r.ownerId,
    ownerName: r.ownerName,
    decisionNeeded: r.decisionNeeded,
    hiddenFromWeekly: r.hiddenFromWeekly,
    noteCount: r.noteCount,
    isOverdue: isOverdue(r.deadline),
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
    deadline: c.deadline,
    ownerId: c.ownerId,
    ownerName: c.ownerName,
    decisionNeeded: c.decisionNeeded,
    hiddenFromWeekly: c.hiddenFromWeekly,
    noteCount: 0,
    isOverdue: isOverdue(c.deadline),
  });

  const allItems: Item[] = [
    ...projectRows.map(toItem),
    ...customRows.map(toCustomItem),
  ];

  const visible = allItems.filter(i => showHidden ? true : !i.hiddenFromWeekly);
  const hiddenCount = allItems.filter(i => i.hiddenFromWeekly).length;

  const rojoItems     = visible.filter(i => i.healthStatus === 'rojo');
  const amarilloItems = visible.filter(i => i.healthStatus === 'amarillo' && !i.isOverdue);
  const overdueItems  = visible.filter(i => i.isOverdue && i.healthStatus !== 'rojo');
  const alertItems    = [...rojoItems, ...overdueItems, ...amarilloItems];
  const alertKeys     = new Set(alertItems.map(i => i.key));
  const decisionItems = visible.filter(i => dm(i.decisionNeeded).urgent && !alertKeys.has(i.key));
  const decisionKeys  = new Set(decisionItems.map(i => i.key));
  const normalItems   = visible.filter(i => !alertKeys.has(i.key) && !decisionKeys.has(i.key));

  const criticalCount = alertItems.length;
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
        <div className="relative overflow-hidden border-b border-border shrink-0">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
          <div className="relative px-6 py-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/20">
                  <ClipboardList className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold leading-tight text-white tracking-tight">Status Semanal</h1>
                  <p className="text-[10px] text-indigo-200 font-medium">{weekLabel()}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {criticalCount > 0 ? (
                  <div className="flex items-center gap-1.5 bg-red-500/90 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg border border-red-400/30">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {criticalCount} requiere{criticalCount !== 1 ? 'n' : ''} atención
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 bg-emerald-500/20 backdrop-blur-sm border border-emerald-300/30 text-emerald-100 text-xs font-semibold px-3 py-1.5 rounded-full">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Sin alertas esta semana
                  </div>
                )}
                {decisionCount > 0 && (
                  <div className="flex items-center gap-1.5 bg-amber-400/20 backdrop-blur-sm border border-amber-300/30 text-amber-100 text-xs font-bold px-3 py-1.5 rounded-full">
                    <Zap className="h-3.5 w-3.5" />
                    {decisionCount} decisión{decisionCount !== 1 ? 'es' : ''}
                  </div>
                )}
                {hiddenCount > 0 && (
                  <button onClick={() => setShowHidden(v => !v)}
                    className={cn("flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors backdrop-blur-sm",
                      showHidden ? "bg-white/25 text-white border-white/30" : "bg-white/10 text-indigo-200 border-white/15 hover:bg-white/20 hover:text-white")}>
                    {showHidden ? <><Eye className="h-3 w-3" /> Ocultar quitados</> : <><EyeOff className="h-3 w-3" /> {hiddenCount} quitado{hiddenCount !== 1 ? 's' : ''}</>}
                  </button>
                )}
                <AddItemButton onAdd={(title, subtitle) => createCustom.mutate({ title, subtitle })} />
                <div className="text-xs text-indigo-200 bg-white/10 backdrop-blur-sm px-2.5 py-1 rounded-full font-medium border border-white/10">
                  {visible.length} ítem{visible.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Content ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="max-w-5xl mx-auto px-6 py-5 space-y-6">

              {/* ── AI Summary Panel ──────────────────────────────── */}
              <AISummaryPanel
                summary={aiSummary}
                isLoading={aiMutation.isPending}
                onGenerate={() => aiMutation.mutate()}
                itemCount={visible.length}
              />

              {/* ── Requieren atención ─────────────────────────────── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className={cn("h-4 w-4", alertItems.length > 0 ? "text-red-500" : "text-slate-300")} />
                  <h2 className="text-sm font-bold text-foreground">Requieren atención</h2>
                  <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full border",
                    alertItems.length > 0 ? "bg-red-100 text-red-700 border-red-200" : "bg-slate-100 text-slate-400 border-slate-200")}>
                    {alertItems.length}
                  </span>
                  <AddItemButton variant="inline" onAdd={(title, subtitle) => createCustom.mutate({ title, subtitle })} />
                </div>
                {alertItems.length === 0 ? (
                  <div className="flex items-center gap-2 py-2.5 px-3 rounded-lg border border-dashed border-emerald-200 bg-emerald-50/50 text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-xs">Sin alertas — todo bajo control</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AnimatePresence initial={false}>
                      {alertItems.map(item => {
                        const h = getItemHandlers(item);
                        return (
                          <motion.div key={item.key} layout
                            initial={{ opacity: 0, scale: 0.97, y: -6 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.97, y: -6 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}>
                            <AlertCard item={item} users={appUsers}
                              isSelected={!item.isCustom && notesOpen === item.projectId}
                              onOpenNotes={h.onOpenNotes} onUpdate={h.onUpdate} onRemove={h.onRemove} />
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* ── Decisiones pendientes ──────────────────────────── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className={cn("h-4 w-4", decisionItems.length > 0 ? "text-amber-500" : "text-slate-300")} />
                  <h2 className="text-sm font-bold text-foreground">Decisiones pendientes</h2>
                  <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full border",
                    decisionItems.length > 0 ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-slate-100 text-slate-400 border-slate-200")}>
                    {decisionItems.length}
                  </span>
                </div>
                {decisionItems.length === 0 ? (
                  <div className="flex items-center gap-2 py-2.5 px-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 text-slate-400">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-xs">Sin decisiones pendientes</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AnimatePresence initial={false}>
                      {decisionItems.map(item => {
                        const h = getItemHandlers(item);
                        return (
                          <motion.div key={item.key} layout
                            initial={{ opacity: 0, scale: 0.97, y: -6 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.97, y: -6 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}>
                            <AlertCard item={item} users={appUsers}
                              isSelected={!item.isCustom && notesOpen === item.projectId}
                              onOpenNotes={h.onOpenNotes} onUpdate={h.onUpdate} onRemove={h.onRemove} />
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* ── En curso ───────────────────────────────────────── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Circle className={cn("h-3.5 w-3.5 fill-current", normalItems.length > 0 ? "text-emerald-500" : "text-slate-300")} />
                  <h2 className="text-sm font-bold text-foreground">En curso</h2>
                  <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full border",
                    normalItems.length > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-400 border-slate-200")}>
                    {normalItems.length}
                  </span>
                  <AddItemButton variant="inline" onAdd={(title, subtitle) => createCustom.mutate({ title, subtitle })} />
                  {normalItems.length > 0 && <span className="text-[10px] text-muted-foreground ml-auto">Click en fila para editar</span>}
                </div>
                {normalItems.length === 0 ? (
                  <div className="flex items-center gap-2 py-2.5 px-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 text-slate-400">
                    <span className="text-xs">Sin ítems en curso</span>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 border-b border-slate-200">
                      <div className="w-3.5 shrink-0" />
                      <div className="w-20 shrink-0 text-[10px] font-bold text-slate-400 uppercase tracking-wide">Estado</div>
                      <div className="flex-1 text-[10px] font-bold text-slate-400 uppercase tracking-wide">Cliente · Proyecto</div>
                      <div className="hidden lg:block w-[88px] text-[10px] font-bold text-slate-400 uppercase tracking-wide shrink-0">Margen</div>
                      <div className="hidden lg:block w-[88px] text-[10px] font-bold text-slate-400 uppercase tracking-wide shrink-0">Equipo</div>
                      <div className="hidden lg:block w-40 text-[10px] font-bold text-slate-400 uppercase tracking-wide shrink-0">Riesgo</div>
                      <div className="w-24 text-[10px] font-bold text-slate-400 uppercase tracking-wide shrink-0">Owner</div>
                      <div className="w-20 text-[10px] font-bold text-slate-400 uppercase tracking-wide shrink-0">Deadline</div>
                      <div className="w-16" />
                    </div>
                    <AnimatePresence initial={false}>
                      {normalItems.map(item => {
                        const h = getItemHandlers(item);
                        return (
                          <motion.div key={item.key} layout
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -8 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}>
                            <CompactRow item={item} users={appUsers}
                              isSelected={!item.isCustom && notesOpen === item.projectId}
                              onOpenNotes={h.onOpenNotes} onUpdate={h.onUpdate} onRemove={h.onRemove} />
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
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
                    <AnimatePresence initial={false}>
                      {allItems.filter(i => i.hiddenFromWeekly).map(item => {
                        const h = getItemHandlers(item);
                        return (
                          <motion.div key={item.key} layout
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                            className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 overflow-hidden">
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
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
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
