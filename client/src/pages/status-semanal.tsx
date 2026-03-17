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
  ChevronDown, ChevronRight, ChevronLeft, Zap, CheckCircle2,
  Circle, MoreHorizontal, Plus, Tag,
  Sparkles, Brain, TrendingUp, TrendingDown,
  Shield, Target, RefreshCw, Lightbulb, ArrowRight,
  Calendar, Clock, Search, Filter
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
  noteCount?: number;
};

type Note = {
  id: number; projectId?: number; weeklyStatusItemId?: number; content: string; noteDate: string;
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
  updatedAt: string | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const HEALTH: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  verde:    { label: 'Verde',    dot: 'bg-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200' },
  amarillo: { label: 'Amarillo', dot: 'bg-amber-400',   bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-300'   },
  rojo:     { label: 'Rojo',     dot: 'bg-red-500',     bg: 'bg-red-50',      text: 'text-red-700',     border: 'border-red-300'     },
};

const MARGIN_LEVEL: Record<string, { label: string; color: string }> = {
  alto:  { label: 'Alto',  color: 'text-red-600 bg-red-50 border-red-200' },
  medio: { label: 'Medio', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  bajo:  { label: 'Bajo',  color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
};

const TEAM_LEVEL: Record<string, { label: string; color: string }> = {
  alto:  { label: 'Alto',  color: 'text-red-600 bg-red-50 border-red-200' },
  medio: { label: 'Medio', color: 'text-blue-600 bg-blue-50 border-blue-200' },
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
const mlm = (v: string | null) => MARGIN_LEVEL[v ?? 'medio'] ?? MARGIN_LEVEL.medio;
const tlm = (v: string | null) => TEAM_LEVEL[v ?? 'medio'] ?? TEAM_LEVEL.medio;
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

function isThisWeek(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  mon.setHours(0, 0, 0, 0);
  return d >= mon;
}

function isStale(dateStr: string | null): boolean {
  if (!dateStr) return true;
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff > 5 * 86400 * 1000; // >5 days
}

function FreshnessIndicator({ updatedAt }: { updatedAt: string | null }) {
  if (!updatedAt) return <span className="text-[9px] text-red-400 font-semibold bg-red-50 px-1.5 py-0.5 rounded">Sin actualizar</span>;
  const fresh = isThisWeek(updatedAt);
  const stale = isStale(updatedAt);
  if (stale) {
    return (
      <span className="text-[9px] font-semibold text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
        {relTime(updatedAt)}
      </span>
    );
  }
  return (
    <span className={cn("text-[9px] font-medium", fresh ? "text-emerald-500" : "text-amber-500")}>
      {fresh ? "Actualizado" : relTime(updatedAt)}
    </span>
  );
}

// Direct fetch helper for mutations – avoids apiRequest's JSON parse layer
// and gives explicit control over error handling so failures surface clearly.
async function mutationFetch(url: string, method: string, body?: any) {
  const res = await authFetch(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const ct = res.headers.get('content-type') || '';
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let msg: string;
    if (ct.includes('application/json')) {
      try { msg = JSON.parse(text)?.message || text; } catch { msg = text; }
    } else {
      msg = `Error ${res.status}`;
    }
    throw new Error(msg || `Error ${res.status}`);
  }
  if (!ct.includes('application/json')) {
    // Server returned non-JSON (e.g. HTML fallback) — treat as error
    throw new Error('El servidor no respondió correctamente. Intentá de nuevo.');
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

function HealthDot({ value, onChange, compact = false }: { value: string | null; onChange: (v: string) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const meta = hm(value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 group" title={`Estado: ${meta.label}`}>
          <div className={cn("rounded-full transition-transform group-hover:scale-125", meta.dot, compact ? "w-2.5 h-2.5" : "w-3 h-3")} />
          {!compact && <span className={cn("text-xs font-semibold", meta.text)}>{meta.label}</span>}
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

function MiniLevelDot({ value, type }: { value: string | null; type: 'margin' | 'team' }) {
  const resolver = type === 'margin' ? mlm : tlm;
  const meta = resolver(value);
  const label = type === 'margin' ? 'Impacto $' : 'Esfuerzo equipo';
  const dotColor = value === 'alto' ? 'bg-red-400' : value === 'bajo' ? 'bg-emerald-400' : 'bg-amber-400';
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-slate-400" title={`${label}: ${meta.label}`}>
      <span className={cn("w-1.5 h-1.5 rounded-full", dotColor)} />
      <span className="font-medium">{type === 'margin' ? '$' : '~'}</span>
    </span>
  );
}

function LevelBadge({ value, onChange, label, type, showLabel = false }: { value: string | null; onChange: (v: string) => void; label: string; type: 'margin' | 'team'; showLabel?: boolean }) {
  const [open, setOpen] = useState(false);
  const levels = type === 'margin' ? MARGIN_LEVEL : TEAM_LEVEL;
  const resolver = type === 'margin' ? mlm : tlm;
  const meta = resolver(value);
  const icon = type === 'margin' ? '$' : '👤';
  const tooltipLabel = type === 'margin' ? `Impacto $: ${meta.label}` : `Esfuerzo equipo: ${meta.label}`;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button title={tooltipLabel}>
          <Badge variant="outline" className={cn("text-[10px] h-4 cursor-pointer border font-semibold hover:opacity-80", meta.color)}>
            <span className="opacity-60 mr-0.5">{type === 'margin' ? '$' : 'Eq.'}</span>{meta.label}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-32 p-1.5" align="start">
        <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide mb-1 px-1">{label}</p>
        {Object.entries(levels).map(([k, m]) => (
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
          <Badge variant="outline" className={cn("text-[10px] h-4 cursor-pointer border font-semibold hover:opacity-80 max-w-[100px] truncate", meta.color)}>
            <span className="opacity-60 mr-0.5">Dec.</span>{meta.label}
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
    <div className={cn("inline-flex items-center gap-1 text-[11px] font-medium rounded-md px-1.5 py-0.5 relative group whitespace-nowrap",
      isOverdue ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600")}>
      {isOverdue ? <Clock className="h-3 w-3 shrink-0" /> : <Calendar className="h-3 w-3 shrink-0" />}
      <span className="whitespace-nowrap">{deadlineLabel(value)}</span>
      <button onClick={e => { e.stopPropagation(); onChange(null); }}
        className="hidden group-hover:inline-flex ml-0.5 text-slate-400 hover:text-red-500 shrink-0">
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
  const [expanded, setExpanded] = useState(true);
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
        {/* Header — click to expand */}
        <button className="w-full flex items-center justify-between gap-2 mb-2 text-left" onClick={() => setExpanded(v => !v)}>
          <div className="min-w-0 flex-1 flex items-center gap-1.5">
            {item.isCustom && <Tag className="h-3 w-3 text-indigo-400 shrink-0" />}
            <p className="font-semibold text-sm text-foreground leading-tight truncate">{item.title}</p>
            {item.subtitle && <span className="text-xs text-muted-foreground truncate hidden sm:inline">· {item.subtitle}</span>}
            <span className="shrink-0 hidden sm:inline"><FreshnessIndicator updatedAt={item.updatedAt} /></span>
            <ChevronDown className={cn("h-3 w-3 text-slate-300 shrink-0 transition-transform ml-0.5", !expanded && "-rotate-90")} />
          </div>
          <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
            <HealthDot value={item.healthStatus} onChange={v => onUpdate({ healthStatus: v })} />
            <button onClick={onRemove}
              className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              title={item.isCustom ? "Eliminar ítem" : "Quitar del status"}>
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </button>

        {/* Compact always-visible summary */}
        <div className="flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
          <LevelBadge value={item.marginStatus} onChange={v => onUpdate({ marginStatus: v })} label="Rentabilidad" type="margin" showLabel />
          <LevelBadge value={item.teamStrain} onChange={v => onUpdate({ teamStrain: v })} label="Carga equipo" type="team" showLabel />
          {!isUrgentDec && <DecisionBadge value={item.decisionNeeded} onChange={v => onUpdate({ decisionNeeded: v })} />}
          {onOpenNotes && (
            <button onClick={onOpenNotes}
              className={cn("flex items-center gap-0.5 rounded-full px-1.5 py-0.5 transition-colors ml-auto",
                isSelected ? "text-indigo-600" : item.noteCount > 0 ? "text-indigo-500" : "text-slate-300 hover:text-slate-500")}>
              <MessageSquare className="h-3 w-3" />
              {item.noteCount > 0 && <span className="text-[10px] font-semibold">{item.noteCount}</span>}
            </button>
          )}
        </div>

        {/* Expandable detail */}
        {expanded && (
          <div className="mt-3 space-y-2" onClick={e => e.stopPropagation()}>
            {/* Decision alert */}
            {isUrgentDec && (
              <div className={cn("flex items-center gap-1.5 rounded-md px-2 py-1.5 border text-xs font-semibold", decMeta.color)}>
                <Zap className="h-3 w-3 shrink-0" />
                Decisión:
                <DecisionBadge value={item.decisionNeeded} onChange={v => onUpdate({ decisionNeeded: v })} />
              </div>
            )}

            {/* Overdue alert */}
            {item.isOverdue && (
              <div className="flex items-center gap-1.5 rounded-md px-2 py-1.5 bg-red-100 border border-red-200 text-red-700 text-xs font-semibold">
                <Clock className="h-3 w-3 shrink-0" />
                Demorado — {deadlineLabel(item.deadline)}
              </div>
            )}

            {/* Riesgo principal — only shown if there's actual risk text */}
            {item.mainRisk && (
              <div className="flex items-start gap-1.5 rounded-md px-2.5 py-1.5 bg-orange-50 border border-orange-100">
                <Shield className="h-3 w-3 text-orange-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] text-orange-500 uppercase font-bold tracking-wide mb-0.5">Riesgo principal</p>
                  <InlineText value={item.mainRisk} placeholder="¿Cuál es el riesgo principal?" onSave={v => onUpdate({ mainRisk: v })} className="text-xs" />
                </div>
              </div>
            )}

            {/* Update + Próximo paso */}
            <div className="grid grid-cols-2 gap-2">
              <div className={cn("rounded-md px-2.5 py-2", item.healthStatus === 'rojo' ? "bg-red-50" : item.healthStatus === 'amarillo' ? "bg-amber-50" : "bg-slate-50")}>
                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide mb-0.5">Update</p>
                <InlineText value={item.currentAction} placeholder="Resumen en 1 línea del estado actual" onSave={v => onUpdate({ currentAction: v })} multiline className="text-xs" />
              </div>
              <div className={cn("rounded-md px-2.5 py-2", "bg-slate-50")}>
                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide mb-0.5">Próximo paso</p>
                <InlineText value={item.nextMilestone} placeholder="Acción concreta esta semana" onSave={v => onUpdate({ nextMilestone: v })} multiline className="text-xs" />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <OwnerSelect value={item.ownerId} name={item.ownerName} onChange={v => onUpdate({ ownerId: v })} users={users} />
                <DeadlinePicker value={item.deadline} isOverdue={item.isOverdue} onChange={v => onUpdate({ deadline: v })} />
              </div>
              {onOpenNotes && (
                <button onClick={onOpenNotes}
                  className={cn("flex items-center gap-1 text-xs rounded-md px-2 py-1 transition-colors",
                    isSelected ? "text-indigo-600 bg-indigo-50" : item.noteCount > 0 ? "text-indigo-500 hover:bg-indigo-50" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100")}>
                  <MessageSquare className="h-3 w-3" />
                  {item.noteCount > 0 && <span className="text-[10px] font-semibold">{item.noteCount}</span>}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Compact row (Verde) ──────────────────────────────────────────────────────

function CompactRow({ item, users, isSelected, onOpenNotes, onUpdate, onRemove, expanded, onToggle, onNext, onPrev, hasNext, hasPrev }: {
  item: Item; users: AppUser[]; isSelected: boolean;
  onOpenNotes?: () => void; onUpdate: (d: Record<string, any>) => void; onRemove: () => void;
  expanded: boolean; onToggle: () => void; onNext?: () => void; onPrev?: () => void; hasNext?: boolean; hasPrev?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const decMeta = dm(item.decisionNeeded);

  return (
    <div className={cn(
      "border-b border-slate-100 last:border-0 transition-all",
      isSelected ? "bg-indigo-50/70" : "hover:bg-slate-50/60",
      expanded && "bg-slate-50/40"
    )}>
      {/* Main row — minimal: dot + name + owner + deadline */}
      <div className="flex items-center gap-2.5 px-4 py-2 cursor-pointer" onClick={onToggle}>
        <div className="shrink-0" onClick={e => e.stopPropagation()}>
          <HealthDot value={item.healthStatus} onChange={v => onUpdate({ healthStatus: v })} compact />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {item.isCustom && <Tag className="h-3 w-3 text-indigo-400 shrink-0" />}
            <span className="font-medium text-[13px] text-slate-800 truncate">{item.title}</span>
            {item.subtitle && <span className="text-slate-400 text-xs truncate hidden sm:inline"> · {item.subtitle}</span>}
            <span className="hidden lg:inline text-xs text-slate-400 truncate max-w-[300px] ml-1">
              {item.currentAction && `— ${item.currentAction}`}
            </span>
          </div>
          {decMeta.urgent && (item.mainRisk || item.currentAction) && !expanded && (
            <p className="text-[11px] text-slate-400 truncate mt-0.5 ml-0.5">
              {item.mainRisk || item.currentAction}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          {decMeta.urgent && (
            <Badge variant="outline" className={cn("text-[9px] h-4 border font-semibold", decMeta.color)}>
              <span className="opacity-60 mr-0.5">Dec.</span>{decMeta.label}
            </Badge>
          )}
          <OwnerSelect value={item.ownerId} name={item.ownerName} onChange={v => onUpdate({ ownerId: v })} users={users} />
          <DeadlinePicker value={item.deadline} isOverdue={item.isOverdue} onChange={v => onUpdate({ deadline: v })} />
          {onOpenNotes && item.noteCount > 0 && (
            <button onClick={onOpenNotes}
              className={cn("flex items-center gap-0.5 p-1 rounded transition-colors",
                isSelected ? "text-indigo-600" : "text-slate-400 hover:text-slate-600")}>
              <MessageSquare className="h-3 w-3" />
              <span className="text-[10px] font-medium">{item.noteCount}</span>
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

      {/* Expanded detail panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden">
            <div className="px-4 pb-3 pt-1 ml-5 border-l-2 border-slate-200/80">
              {item.mainRisk && (
                <div className="mb-2">
                  <p className="text-[10px] text-slate-400 font-semibold mb-0.5">Riesgo</p>
                  <InlineText value={item.mainRisk} placeholder="Riesgo principal" onSave={v => onUpdate({ mainRisk: v })} className="text-xs" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold mb-0.5">Update</p>
                  <InlineText value={item.currentAction} placeholder="Estado actual" onSave={v => onUpdate({ currentAction: v })} multiline className="text-xs" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold mb-0.5">Próximo paso</p>
                  <InlineText value={item.nextMilestone} placeholder="Acción esta semana" onSave={v => onUpdate({ nextMilestone: v })} multiline className="text-xs" />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <LevelBadge value={item.marginStatus} onChange={v => onUpdate({ marginStatus: v })} label="Rentabilidad" type="margin" />
                <LevelBadge value={item.teamStrain} onChange={v => onUpdate({ teamStrain: v })} label="Carga equipo" type="team" />
                <DecisionBadge value={item.decisionNeeded} onChange={v => onUpdate({ decisionNeeded: v })} />
                <div className="flex-1" />
                {onOpenNotes && (
                  <button onClick={onOpenNotes}
                    className={cn("text-xs text-slate-400 hover:text-indigo-600 transition-colors")}>
                    <MessageSquare className="h-3 w-3" />
                  </button>
                )}
                {(hasPrev || hasNext) && (
                  <div className="flex items-center gap-0.5">
                    <button onClick={onPrev} disabled={!hasPrev}
                      className={cn("p-0.5 rounded", hasPrev ? "text-slate-400 hover:bg-slate-100" : "text-slate-200")}>
                      <ChevronLeft className="h-3 w-3" />
                    </button>
                    <button onClick={onNext} disabled={!hasNext}
                      className={cn("p-0.5 rounded", hasNext ? "text-slate-400 hover:bg-slate-100" : "text-slate-200")}>
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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

function AISummaryPanel({ summary, isLoading, onGenerate, itemCount, cooldown = false }: {
  summary: AISummary | null;
  isLoading: boolean;
  onGenerate: () => void;
  itemCount: number;
  cooldown?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!summary && !isLoading) {
    return (
      <div className="flex items-center justify-between px-3 py-1.5 rounded-lg border border-indigo-100 bg-indigo-50/30">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
          <span className="text-[11px] text-slate-400">Resumen IA disponible</span>
        </div>
        <Button onClick={onGenerate} size="sm" variant="ghost"
          className="h-6 text-[11px] text-indigo-600 hover:bg-indigo-100 gap-1 font-semibold px-2">
          <Sparkles className="h-3 w-3" />
          Generar
        </Button>
      </div>
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
          <Button onClick={onGenerate} variant="ghost" size="sm" disabled={cooldown}
            className={cn("h-8 text-xs gap-1.5", cooldown ? "text-slate-400 cursor-not-allowed" : "text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100")}>
            <RefreshCw className={cn("h-3 w-3", cooldown && "animate-spin")} />
            {cooldown ? 'Esperá...' : 'Regenerar'}
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

function NotesPanel({ projectId, customItemId, projectName, onClose }: { projectId?: number; customItemId?: number; projectName: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [newNote, setNewNote] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const notesUrl = projectId
    ? `/api/status-semanal/${projectId}/notes`
    : `/api/status-semanal/custom/${customItemId}/notes`;
  const cacheKey = projectId
    ? ['/api/status-semanal', projectId, 'notes']
    : ['/api/status-semanal/custom', customItemId, 'notes'];

  const { data: notes = [], isLoading } = useQuery<Note[]>({
    queryKey: cacheKey,
    queryFn: async () => { const r = await authFetch(notesUrl); return r.json(); },
  });

  const addMutation = useMutation({
    mutationFn: (content: string) => mutationFetch(notesUrl, 'POST', { content }),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: cacheKey });
      queryClient.refetchQueries({ queryKey: ['/api/status-semanal'] });
      if (customItemId) queryClient.refetchQueries({ queryKey: ['/api/status-semanal/custom'] });
    },
    onError: (err: Error) => toast({ title: 'Error al guardar comentario', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (noteId: number) => mutationFetch(`/api/status-semanal/notes/${noteId}`, 'DELETE'),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: cacheKey });
      queryClient.refetchQueries({ queryKey: ['/api/status-semanal'] });
      if (customItemId) queryClient.refetchQueries({ queryKey: ['/api/status-semanal/custom'] });
    },
    onError: (err: Error) => toast({ title: 'Error al eliminar comentario', description: err.message, variant: 'destructive' }),
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [notes.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0 bg-slate-50/80">
        <div className="flex items-center gap-1.5 min-w-0">
          <MessageSquare className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
          <p className="text-xs font-semibold truncate">{projectName}</p>
          <span className="text-[10px] text-muted-foreground shrink-0">({notes.length})</span>
        </div>
        <button onClick={onClose} className="p-0.5 hover:bg-accent rounded text-muted-foreground shrink-0"><X className="h-3.5 w-3.5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2.5">
        {isLoading && <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}
        {!isLoading && notes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageSquare className="h-6 w-6 text-muted-foreground/20 mb-1.5" />
            <p className="text-xs text-muted-foreground">Sin comentarios todavía</p>
          </div>
        )}
        {notes.map(note => {
          const isOwn = note.authorId === (user as any)?.id;
          return (
            <div key={note.id} className="group flex gap-2">
              <div className={cn("h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5", isOwn ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600")}>
                {initials(note.authorName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-[11px] font-medium">{note.authorName || 'Usuario'}</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-[10px] text-muted-foreground cursor-default">{relTime(note.noteDate)}</span>
                      </TooltipTrigger>
                      <TooltipContent>{new Date(note.noteDate).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' })}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="text-[11px] bg-white border border-slate-100 rounded-md px-2.5 py-1.5 leading-relaxed whitespace-pre-wrap">{note.content}</div>
              </div>
              {isOwn && (
                <button onClick={() => deleteMutation.mutate(note.id)} className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-300 hover:text-red-400 transition-opacity shrink-0 mt-0.5">
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 py-2 border-t border-border shrink-0 bg-slate-50/80">
        <div className="flex gap-1.5 items-end">
          <Textarea value={newNote} onChange={e => setNewNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const t = newNote.trim(); if (t) { setNewNote(''); addMutation.mutate(t); } } }}
            placeholder="Escribí un comentario..." className="resize-none text-[11px] min-h-[40px] max-h-[80px] flex-1 bg-white px-2.5 py-1.5" />
          <Button size="sm" onClick={() => { const t = newNote.trim(); if (t) { setNewNote(''); addMutation.mutate(t); } }}
            disabled={!newNote.trim() || addMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white h-7 w-7 p-0 shrink-0">
            {addMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          </Button>
        </div>
        <p className="text-[9px] text-muted-foreground mt-0.5">Enter para enviar · Shift+Enter nueva línea</p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StatusSemanalPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [notesOpen, setNotesOpen] = useState<{ type: 'project' | 'custom'; id: number } | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [alertCollapsed, setAlertCollapsed] = useState<boolean | null>(null);
  const [decisionCollapsed, setDecisionCollapsed] = useState<boolean | null>(null);
  const [aiSummary, setAiSummary] = useState<AISummary | null>(() => {
    try { const s = localStorage.getItem('status-semanal-ai-summary'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null);
  const [expandedAlertKey, setExpandedAlertKey] = useState<string | null>(null);
  const [expandedDecisionKey, setExpandedDecisionKey] = useState<string | null>(null);
  const [aiPopoverOpen, setAiPopoverOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterHealth, setFilterHealth] = useState<string | null>(null);
  const [filterOwner, setFilterOwner] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Item | null>(null);
  const [aiCooldown, setAiCooldown] = useState(false);

  // ── AI Summary mutation ─────────────────────────────────────────────────────

  // Close notes panel with Esc key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmDelete) { setConfirmDelete(null); return; }
        if (notesOpen) { setNotesOpen(null); return; }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [notesOpen, confirmDelete]);

  const aiMutation = useMutation({
    mutationFn: () => mutationFetch('/api/status-semanal/ai-summary', 'POST'),
    onSuccess: (data: AISummary) => {
      setAiSummary(data);
      try { localStorage.setItem('status-semanal-ai-summary', JSON.stringify(data)); } catch {}
      toast({ title: 'Resumen generado', description: `Score del portafolio: ${data.weeklyScore}/100` });
      // Cooldown 30s to prevent excessive API calls
      setAiCooldown(true);
      setTimeout(() => setAiCooldown(false), 30000);
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
    updatedAt: r.reviewUpdatedAt,
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
    noteCount: c.noteCount ?? 0,
    isOverdue: isOverdue(c.deadline),
    updatedAt: c.updatedAt,
  });

  const allItems: Item[] = [
    ...projectRows.map(toItem),
    ...customRows.map(toCustomItem),
  ];

  const hiddenCount = allItems.filter(i => i.hiddenFromWeekly).length;
  const visible = allItems.filter(i => {
    if (!showHidden && i.hiddenFromWeekly) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matches = (i.title?.toLowerCase().includes(q)) ||
        (i.subtitle?.toLowerCase().includes(q)) ||
        (i.ownerName?.toLowerCase().includes(q)) ||
        (i.currentAction?.toLowerCase().includes(q)) ||
        (i.mainRisk?.toLowerCase().includes(q));
      if (!matches) return false;
    }
    if (filterHealth && i.healthStatus !== filterHealth) return false;
    if (filterOwner !== null && i.ownerId !== filterOwner) return false;
    return true;
  });

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

  // Auto-collapse empty sections unless user has manually toggled
  const isAlertCollapsed = alertCollapsed ?? (alertItems.length === 0);
  const isDecisionCollapsed = decisionCollapsed ?? (decisionItems.length === 0);

  const getItemHandlers = (item: Item) => ({
    onUpdate: (data: Record<string, any>) => {
      if (item.isCustom && item.customId) updateCustom(item.customId, data);
      else if (item.projectId) updateProject(item.projectId, data);
    },
    onRemove: () => {
      setConfirmDelete(item);
    },
    onOpenNotes: (() => {
      if (item.projectId) {
        const isSame = notesOpen?.type === 'project' && notesOpen.id === item.projectId;
        setNotesOpen(isSame ? null : { type: 'project', id: item.projectId });
      } else if (item.isCustom && item.customId) {
        const isSame = notesOpen?.type === 'custom' && notesOpen.id === item.customId;
        setNotesOpen(isSame ? null : { type: 'custom', id: item.customId });
      }
    }),
  });

  const openNotesProject = notesOpen?.type === 'project' ? projectRows.find(r => r.projectId === notesOpen.id) : undefined;
  const openNotesCustom = notesOpen?.type === 'custom' ? customRows.find(r => r.id === notesOpen.id) : undefined;
  const notesItemName = openNotesProject
    ? `${openNotesProject.clientName || ''}${openNotesProject.quotationName ? ` · ${openNotesProject.quotationName}` : ''}`
    : openNotesCustom ? openNotesCustom.title : '';

  const isLoading = loadingProjects || loadingCustom;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className={cn("flex flex-col flex-1 min-w-0 transition-all duration-200", notesOpen !== null ? "mr-[320px]" : "")}>

        {/* ── Header ────────────────────────────────────────────── */}
        {/* ── Header (compact with integrated search) ──────────── */}
        <div className="relative overflow-hidden border-b border-border shrink-0">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
          <div className="relative px-6 py-2.5">
            <div className="flex items-center justify-between gap-4">
              {/* Left: title */}
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="h-8 w-8 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/20">
                  <ClipboardList className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h1 className="text-base font-bold leading-tight text-white tracking-tight">Status Semanal</h1>
                  <p className="text-[9px] text-indigo-200 font-medium">{weekLabel()}</p>
                </div>
              </div>

              {/* Center: search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-indigo-300" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar proyecto, owner..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-white/20 rounded-lg bg-white/10 backdrop-blur-sm text-white placeholder:text-indigo-300 focus:outline-none focus:ring-1 focus:ring-white/30 focus:bg-white/15"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-300 hover:text-white">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Right: badges & actions */}
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[11px] text-indigo-200 font-medium mr-1">{visible.length} ítems</span>
                <button onClick={() => setShowFilters(v => !v)}
                  className={cn("p-1.5 rounded-full border transition-colors backdrop-blur-sm",
                    showFilters || filterHealth || filterOwner !== null
                      ? "bg-white/25 text-white border-white/30"
                      : "bg-white/10 text-indigo-200 border-white/15 hover:bg-white/20 hover:text-white")}>
                  <Filter className="h-3 w-3" />
                </button>
                {hiddenCount > 0 && (
                  <button onClick={() => setShowHidden(v => !v)}
                    className={cn("p-1.5 rounded-full border transition-colors backdrop-blur-sm",
                      showHidden ? "bg-white/25 text-white border-white/30" : "bg-white/10 text-indigo-200 border-white/15 hover:bg-white/20 hover:text-white")}>
                    {showHidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  </button>
                )}
                <Popover open={aiPopoverOpen} onOpenChange={setAiPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      className={cn("flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full border transition-colors backdrop-blur-sm",
                        aiSummary ? "bg-violet-500/30 text-white border-violet-300/40" : "bg-white/10 text-indigo-200 border-white/15 hover:bg-white/20 hover:text-white")}
                      title="Resumen IA">
                      {aiMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      {aiSummary && <span className="text-[9px] font-bold">{aiSummary.weeklyScore}</span>}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[420px] p-0 max-h-[500px] overflow-y-auto" align="end">
                    {!aiSummary && !aiMutation.isPending && (
                      <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-xs text-slate-500">Generá un resumen IA de los {visible.length} proyectos</span>
                        <Button onClick={() => { if (!aiCooldown) aiMutation.mutate(); }} size="sm" variant="ghost"
                          className="h-7 text-xs text-indigo-600 hover:bg-indigo-100 gap-1 font-semibold">
                          <Sparkles className="h-3 w-3" /> Generar
                        </Button>
                      </div>
                    )}
                    {aiMutation.isPending && (
                      <div className="flex items-center gap-3 px-4 py-6 justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
                        <span className="text-sm text-indigo-600 font-medium">Analizando {visible.length} proyectos...</span>
                      </div>
                    )}
                    {aiSummary && !aiMutation.isPending && (
                      <div className="space-y-3 p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Brain className="h-4 w-4 text-indigo-500" />
                            <span className="text-sm font-bold text-slate-800">Análisis IA</span>
                            <Badge variant="outline" className="text-[9px] h-4 bg-indigo-100 text-indigo-700 border-indigo-200 font-bold">Score: {aiSummary.weeklyScore}</Badge>
                          </div>
                          <Button onClick={() => { if (!aiCooldown) aiMutation.mutate(); }} variant="ghost" size="sm"
                            className="h-6 text-[11px] text-indigo-600 hover:bg-indigo-100 gap-1">
                            <RefreshCw className={cn("h-3 w-3", aiCooldown && "animate-spin")} />
                            {aiCooldown ? 'Esperá...' : 'Regenerar'}
                          </Button>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 rounded-lg p-3">{aiSummary.executiveSummary}</p>
                        {aiSummary.highlights.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {aiSummary.highlights.map((h, i) => <HighlightChip key={i} type={h.type} text={h.text} />)}
                          </div>
                        )}
                        {aiSummary.projectInsights.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                              <Lightbulb className="h-3 w-3" /> Insights
                            </p>
                            <div className="space-y-1.5">
                              {aiSummary.projectInsights.map((pi, i) => (
                                <div key={i} className="flex items-start gap-2 bg-slate-50 rounded-lg px-3 py-2">
                                  <ArrowRight className="h-3 w-3 text-indigo-400 shrink-0 mt-0.5" />
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-bold text-indigo-600">{pi.clientName}</p>
                                    <p className="text-xs text-slate-600 leading-snug">{pi.insight}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
                <AddItemButton onAdd={(title, subtitle) => createCustom.mutate({ title, subtitle })} />
              </div>
            </div>

            {/* Filters row (expandable, inside header) */}
            {showFilters && (
              <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/10">
                <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wide">Salud:</span>
                <div className="flex items-center gap-1">
                  {[null, 'verde', 'amarillo', 'rojo'].map(h => (
                    <button key={h ?? 'all'} onClick={() => setFilterHealth(h)}
                      className={cn("text-[11px] px-2 py-0.5 rounded-md border font-medium transition-colors",
                        filterHealth === h ? "bg-white/25 border-white/30 text-white" : "bg-white/5 border-white/10 text-indigo-200 hover:bg-white/15")}>
                      {h === null ? 'Todos' : <span className="flex items-center gap-1"><span className={cn("w-2 h-2 rounded-full", HEALTH[h].dot)} />{HEALTH[h].label}</span>}
                    </button>
                  ))}
                </div>
                <span className="text-white/20">|</span>
                <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wide">Owner:</span>
                <select value={filterOwner?.toString() ?? ''} onChange={e => setFilterOwner(e.target.value ? parseInt(e.target.value) : null)}
                  className="text-[11px] px-2 py-0.5 rounded-md border border-white/20 bg-white/10 text-white focus:outline-none focus:ring-1 focus:ring-white/30">
                  <option value="" className="text-slate-800">Todos</option>
                  {appUsers.map(u => <option key={u.id} value={u.id} className="text-slate-800">{u.name}</option>)}
                </select>
                {(filterHealth || filterOwner !== null || searchQuery) && (
                  <button onClick={() => { setSearchQuery(''); setFilterHealth(null); setFilterOwner(null); }}
                    className="text-[11px] text-indigo-300 hover:text-white font-medium ml-1">
                    Limpiar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Confirm Delete Dialog ──────────────────────────────── */}
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}>
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-5 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="h-4 w-4 text-red-600" />
                </div>
                <h3 className="font-semibold text-sm">
                  {confirmDelete.isCustom ? 'Eliminar ítem' : 'Quitar del status'}
                </h3>
              </div>
              <p className="text-xs text-slate-600 mb-1">
                {confirmDelete.isCustom
                  ? <>Vas a eliminar permanentemente <strong>{confirmDelete.title}</strong>. Esta acción no se puede deshacer.</>
                  : <>Vas a quitar <strong>{confirmDelete.title}</strong> del status semanal. Podés restaurarlo después.</>}
              </p>
              <div className="flex gap-2 mt-4">
                <Button size="sm" variant="outline" onClick={() => setConfirmDelete(null)} className="flex-1 h-8 text-xs">
                  Cancelar
                </Button>
                <Button size="sm" onClick={() => {
                  const item = confirmDelete;
                  if (item.isCustom && item.customId) deleteCustom.mutate(item.customId);
                  else if (item.projectId) removeProject.mutate(item.projectId);
                  setConfirmDelete(null);
                }} className="flex-1 h-8 text-xs bg-red-600 hover:bg-red-700 text-white">
                  {confirmDelete.isCustom ? 'Eliminar' : 'Quitar'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Content ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="max-w-6xl mx-auto px-6 py-3 space-y-3">

              {/* ── Requieren atención (hidden when empty) ──────────── */}
              {alertItems.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                  <h2 className="text-sm font-bold text-foreground">Requieren atención</h2>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-red-100 text-red-700 border-red-200">
                    {alertItems.length}
                  </span>
                  <AddItemButton variant="inline" onAdd={(title, subtitle) => createCustom.mutate({ title, subtitle })} />
                </div>
                <div className="rounded-xl border border-red-200/60 bg-white shadow-sm overflow-hidden">
                  <AnimatePresence initial={false}>
                    {alertItems.map((item, idx) => {
                      const h = getItemHandlers(item);
                      return (
                        <motion.div key={item.key} layout
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -8 }}
                          transition={{ duration: 0.15, ease: 'easeOut' }}
                          className={cn("border-l-[3px]",
                            item.isOverdue ? "border-l-red-500" : item.healthStatus === 'rojo' ? "border-l-red-500" : "border-l-amber-400")}>
                          <CompactRow item={item} users={appUsers}
                            isSelected={notesOpen !== null && ((notesOpen.type === 'project' && item.projectId === notesOpen.id) || (notesOpen.type === 'custom' && item.customId === notesOpen.id))}
                            onOpenNotes={h.onOpenNotes} onUpdate={h.onUpdate} onRemove={h.onRemove}
                            expanded={expandedAlertKey === item.key}
                            onToggle={() => setExpandedAlertKey(expandedAlertKey === item.key ? null : item.key)}
                            hasPrev={idx > 0}
                            hasNext={idx < alertItems.length - 1}
                            onPrev={() => { if (idx > 0) setExpandedAlertKey(alertItems[idx - 1].key); }}
                            onNext={() => { if (idx < alertItems.length - 1) setExpandedAlertKey(alertItems[idx + 1].key); }} />
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
              )}

              {/* ── Decisiones pendientes (hidden when empty) ─────── */}
              {decisionItems.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Zap className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <h2 className="text-sm font-bold text-foreground">Decisiones pendientes</h2>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-amber-100 text-amber-700 border-amber-200">
                    {decisionItems.length}
                  </span>
                </div>
                <div className="rounded-xl border border-amber-200/60 bg-white shadow-sm overflow-hidden">
                  <AnimatePresence initial={false}>
                    {decisionItems.map((item, idx) => {
                      const h = getItemHandlers(item);
                      return (
                        <motion.div key={item.key} layout
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -8 }}
                          transition={{ duration: 0.15, ease: 'easeOut' }}
                          className="border-l-[3px] border-l-amber-400">
                          <CompactRow item={item} users={appUsers}
                            isSelected={notesOpen !== null && ((notesOpen.type === 'project' && item.projectId === notesOpen.id) || (notesOpen.type === 'custom' && item.customId === notesOpen.id))}
                            onOpenNotes={h.onOpenNotes} onUpdate={h.onUpdate} onRemove={h.onRemove}
                            expanded={expandedDecisionKey === item.key}
                            onToggle={() => setExpandedDecisionKey(expandedDecisionKey === item.key ? null : item.key)}
                            hasPrev={idx > 0}
                            hasNext={idx < decisionItems.length - 1}
                            onPrev={() => { if (idx > 0) setExpandedDecisionKey(decisionItems[idx - 1].key); }}
                            onNext={() => { if (idx < decisionItems.length - 1) setExpandedDecisionKey(decisionItems[idx + 1].key); }} />
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
              )}

              {/* ── En curso ───────────────────────────────────────── */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Circle className={cn("h-3.5 w-3.5 fill-current", normalItems.length > 0 ? "text-emerald-500" : "text-slate-300")} />
                  <h2 className="text-sm font-bold text-foreground">En curso</h2>
                  <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full border",
                    normalItems.length > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-400 border-slate-200")}>
                    {normalItems.length}
                  </span>
                  <AddItemButton variant="inline" onAdd={(title, subtitle) => createCustom.mutate({ title, subtitle })} />
                </div>
                {normalItems.length === 0 ? (
                  <div className="flex items-center gap-2 py-2.5 px-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 text-slate-400">
                    <span className="text-xs">Sin ítems en curso</span>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <AnimatePresence initial={false}>
                      {normalItems.map((item, idx) => {
                        const h = getItemHandlers(item);
                        return (
                          <motion.div key={item.key} layout
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -8 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}>
                            <CompactRow item={item} users={appUsers}
                              isSelected={notesOpen !== null && ((notesOpen.type === 'project' && item.projectId === notesOpen.id) || (notesOpen.type === 'custom' && item.customId === notesOpen.id))}
                              onOpenNotes={h.onOpenNotes} onUpdate={h.onUpdate} onRemove={h.onRemove}
                              expanded={expandedRowKey === item.key}
                              onToggle={() => setExpandedRowKey(expandedRowKey === item.key ? null : item.key)}
                              hasPrev={idx > 0}
                              hasNext={idx < normalItems.length - 1}
                              onPrev={() => { if (idx > 0) setExpandedRowKey(normalItems[idx - 1].key); }}
                              onNext={() => { if (idx < normalItems.length - 1) setExpandedRowKey(normalItems[idx + 1].key); }} />
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
        <div className="fixed top-0 right-0 h-full w-[320px] border-l border-border bg-background shadow-xl z-20 flex flex-col">
          {(openNotesProject || openNotesCustom) && (
            <NotesPanel
              projectId={notesOpen.type === 'project' ? notesOpen.id : undefined}
              customItemId={notesOpen.type === 'custom' ? notesOpen.id : undefined}
              projectName={notesItemName}
              onClose={() => setNotesOpen(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
