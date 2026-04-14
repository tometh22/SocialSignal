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
  ClipboardList, MessageSquare, X, Send, Trash2, Pencil,
  AlertTriangle, Loader2, User, EyeOff, Eye,
  ChevronDown, ChevronRight, ChevronLeft, ChevronUp, Zap, CheckCircle2,
  Circle, MoreHorizontal, Plus, Tag,
  Sparkles, Brain, TrendingUp, TrendingDown,
  Shield, Target, RefreshCw, Lightbulb, ArrowRight,
  Calendar, Clock, Search, Filter, GripVertical,
  Printer, List, LayoutList, HelpCircle, CheckSquare, Square
} from "lucide-react";
import {
  DndContext, closestCenter, DragOverlay,
  type DragStartEvent, type DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  reviewUpdatedBy: number | null;
  reviewUpdatedByName: string | null;
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
  updatedBy: number | null;
  updatedByName: string | null;
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
  updatedById: number | null;
  updatedByName: string | null;
};

type ActivityEntry =
  | { type: 'note'; id: number; content: string; authorId: number | null; authorName: string | null; createdAt: string }
  | { type: 'change'; id: number; userId: number | null; userName: string | null; fieldName: string; oldValue: string | null; newValue: string | null; createdAt: string };

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

function shortDateTime(s: string) {
  const d = new Date(s);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const time = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (diffMs < 86400000 && d.getDate() === now.getDate()) return time; // today: "14:35"
  if (diffMs < 86400000 * 7) {
    const day = d.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '');
    return `${day} ${time}`; // "Lun 14:35"
  }
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', ''); // "10 mar"
}

function fullDateTime(s: string) {
  return new Date(s).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' });
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

function FreshnessIndicator({ updatedAt, updatedByName, updatedById, currentUserId }: {
  updatedAt: string | null; updatedByName?: string | null; updatedById?: number | null; currentUserId?: number | null;
}) {
  if (!updatedAt) return null;
  const stale = isStale(updatedAt);
  const isOther = updatedById != null && currentUserId != null && updatedById !== currentUserId;
  const firstName = updatedByName?.split(' ')[0];
  const timeStr = shortDateTime(updatedAt);
  const tooltip = `${updatedByName || 'Usuario'} · ${fullDateTime(updatedAt)}`;

  return (
    <TooltipProvider><Tooltip><TooltipTrigger asChild>
      <span className={cn("text-[10px]",
        isOther ? "text-indigo-400 font-medium" : stale ? "text-amber-400" : "text-slate-400")}>
        {isOther && firstName ? `${firstName} · ` : ''}{timeStr}
      </span>
    </TooltipTrigger><TooltipContent className="text-xs">{tooltip}</TooltipContent></Tooltip></TooltipProvider>
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

// ─── MentionInput ────────────────────────────────────────────────────────────

function MentionInput({ value, onChange, onKeyDown, placeholder, className, users = [] }: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  users?: AppUser[];
}) {
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);
  const [menuIdx, setMenuIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = users.filter(u =>
    !mentionFilter || u.name.toLowerCase().startsWith(mentionFilter.toLowerCase())
  ).slice(0, 6);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
    const pos = e.target.selectionStart ?? v.length;
    const lastAt = v.lastIndexOf('@', pos - 1);
    if (lastAt >= 0) {
      const fragment = v.slice(lastAt + 1, pos);
      if (!fragment.includes(' ')) {
        setMentionStart(lastAt);
        setMentionFilter(fragment);
        setShowMentions(true);
        setMenuIdx(0);
        return;
      }
    }
    setShowMentions(false);
  };

  const selectUser = (user: AppUser) => {
    const before = value.slice(0, mentionStart);
    const after = value.slice(mentionStart + 1 + mentionFilter.length);
    const firstName = user.name.split(' ')[0];
    onChange(`${before}@${firstName} ${after}`);
    setShowMentions(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showMentions && filtered.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMenuIdx(i => Math.min(i + 1, filtered.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMenuIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); selectUser(filtered[menuIdx]); return; }
      if (e.key === 'Escape') { setShowMentions(false); return; }
    }
    onKeyDown?.(e);
  };

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setShowMentions(false), 150)}
        placeholder={placeholder}
        className={className}
      />
      {showMentions && filtered.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[140px] py-1 overflow-hidden">
          {filtered.map((u, i) => (
            <button key={u.id} onMouseDown={() => selectUser(u)}
              className={cn("w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-indigo-50 text-left",
                i === menuIdx && "bg-indigo-50")}>
              <div className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[9px] font-bold shrink-0">
                {initials(u.name)}
              </div>
              {u.name.split(' ')[0]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
    const cls = `w-full text-sm border border-indigo-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400/25 bg-white shadow-sm resize-none ${className}`;
    return multiline
      ? (
        <>
          <textarea ref={ref} value={draft} onChange={e => setDraft(e.target.value)} onBlur={save}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
              if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false); }
            }}
            className={cls} rows={2} />
          <p className="text-[9px] text-slate-400 mt-0.5">Ctrl+Enter para guardar · Esc para cancelar</p>
        </>
      )
      : <input ref={ref} value={draft} onChange={e => setDraft(e.target.value)} onBlur={save}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(); } if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false); } }}
          className={cls} />;
  }

  return (
    <span onClick={() => setEditing(true)}
      className={cn(
        "group cursor-text rounded-md px-1.5 py-1 transition-all min-h-[26px] inline-flex items-center gap-1 w-full",
        "hover:bg-slate-100/80",
        value ? "text-slate-800" : "text-slate-400/70 italic",
        className
      )}>
      <span className="flex-1 leading-snug">{value || placeholder}</span>
      <Pencil className="h-2.5 w-2.5 text-slate-400 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
    </span>
  );
}

// ─── Update Timeline (accumulating update entries) ───────────────────────────

type UpdateEntry = { id: number; content: string; authorId: number | null; authorName: string | null; createdAt: string };

function UpdateTimeline({ projectId, customId, currentAction, currentUserId, onActionUpdated, users = [] }: {
  projectId?: number; customId?: number; currentAction: string | null; currentUserId?: number | null;
  onActionUpdated?: () => void; users?: AppUser[];
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [draft, setDraft] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  const updatesUrl = projectId
    ? `/api/status-semanal/${projectId}/updates`
    : `/api/status-semanal/custom/${customId}/updates`;
  const cacheKey = projectId
    ? ['/api/status-semanal', projectId, 'updates']
    : ['/api/status-semanal/custom', customId, 'updates'];

  const { data: entries = [] } = useQuery<UpdateEntry[]>({
    queryKey: cacheKey,
    queryFn: async () => { const r = await authFetch(updatesUrl); return r.json(); },
  });

  const addMutation = useMutation({
    mutationFn: (content: string) => mutationFetch(updatesUrl, 'POST', { content }),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: cacheKey });
      queryClient.refetchQueries({ queryKey: ['/api/status-semanal'] });
      if (customId) queryClient.refetchQueries({ queryKey: ['/api/status-semanal/custom'] });
      onActionUpdated?.();
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const editMutation = useMutation({
    mutationFn: ({ entryId, content }: { entryId: number; content: string }) =>
      mutationFetch(`/api/status-semanal/updates/${entryId}`, 'PATCH', { content }),
    onSuccess: () => {
      setEditingId(null);
      queryClient.refetchQueries({ queryKey: cacheKey });
      queryClient.refetchQueries({ queryKey: ['/api/status-semanal'] });
      if (customId) queryClient.refetchQueries({ queryKey: ['/api/status-semanal/custom'] });
      onActionUpdated?.();
    },
    onError: (err: Error) => toast({ title: 'Error al editar', description: err.message, variant: 'destructive' }),
  });

  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    setDraft('');
    addMutation.mutate(t);
  };

  const visibleEntries = showAll ? entries : entries.slice(0, 3);
  const hasMore = entries.length > 3;

  return (
    <div>
      <p className="text-[10px] text-slate-400 font-semibold mb-1">Update</p>
      {/* Add new update input */}
      <div className="flex gap-1.5 mb-1.5">
        <MentionInput
          value={draft}
          onChange={setDraft}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
          placeholder="Escribir update..."
          className="flex-1 text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
          users={users}
        />
        <button onClick={submit} disabled={!draft.trim() || addMutation.isPending}
          className={cn("px-2 py-1 rounded text-xs font-medium transition-colors",
            draft.trim() ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-slate-100 text-slate-300")}>
          {addMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
        </button>
      </div>
      {/* Entries list */}
      {visibleEntries.length > 0 ? (
        <div className="space-y-1">
          {visibleEntries.map(entry => {
            const isOwn = entry.authorId != null && entry.authorId === currentUserId;
            const firstName = entry.authorName?.split(' ')[0] || 'Usuario';
            return (
              <div key={entry.id} className={cn("group rounded px-2 py-1 text-xs", isOwn ? "bg-slate-50" : "bg-indigo-50/60")}>
                <div className="flex items-center gap-1 mb-0.5">
                  <span className={cn("font-medium text-[10px]", isOwn ? "text-slate-500" : "text-indigo-600")}>{firstName}</span>
                  <span className="text-[9px] text-slate-400">{shortDateTime(entry.createdAt)}</span>
                  {isOwn && editingId !== entry.id && (
                    <button onClick={() => { setEditingId(entry.id); setEditText(entry.content); }}
                      className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-slate-300 hover:text-indigo-400">
                      <Pencil className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
                {editingId === entry.id ? (
                  <div className="space-y-1">
                    <input
                      value={editText}
                      autoFocus
                      onChange={e => setEditText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); if (editText.trim()) editMutation.mutate({ entryId: entry.id, content: editText }); }
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="w-full text-xs border border-indigo-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                    />
                    <div className="flex gap-1">
                      <button onClick={() => { if (editText.trim()) editMutation.mutate({ entryId: entry.id, content: editText }); }}
                        disabled={!editText.trim() || editMutation.isPending}
                        className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] hover:bg-indigo-700 disabled:opacity-40">
                        {editMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Guardar'}
                      </button>
                      <button onClick={() => setEditingId(null)} className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] hover:bg-slate-200">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-700 leading-snug whitespace-pre-wrap">{entry.content}</p>
                )}
              </div>
            );
          })}
          {hasMore && !showAll && (
            <button onClick={() => setShowAll(true)} className="text-[10px] text-indigo-500 hover:text-indigo-700 font-medium">
              Ver {entries.length - 3} más...
            </button>
          )}
          {showAll && hasMore && (
            <button onClick={() => setShowAll(false)} className="text-[10px] text-slate-400 hover:text-slate-600 font-medium">
              Ver menos
            </button>
          )}
        </div>
      ) : currentAction ? (
        <p className="text-xs text-slate-500 italic px-1">{currentAction}</p>
      ) : (
        <p className="text-xs text-slate-400 italic px-1">Sin updates todavía</p>
      )}
    </div>
  );
}

// ─── Inline Chat (last messages + quick reply) ───────────────────────────────

function InlineChat({ projectId, customId, currentUserId, onOpenFullChat, users = [] }: {
  projectId?: number; customId?: number; currentUserId?: number | null; onOpenFullChat?: () => void; users?: AppUser[];
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState(false);

  const notesUrl = projectId
    ? `/api/status-semanal/${projectId}/notes`
    : `/api/status-semanal/custom/${customId}/notes`;
  const notesCacheKey = projectId
    ? ['/api/status-semanal', projectId, 'notes']
    : ['/api/status-semanal/custom', customId, 'notes'];
  const activityCacheKey = projectId
    ? ['/api/status-semanal', projectId, 'activity']
    : ['/api/status-semanal/custom', customId, 'activity'];

  const { data: allNotes = [] } = useQuery<Note[]>({
    queryKey: notesCacheKey,
    queryFn: async () => { const r = await authFetch(notesUrl); return r.json(); },
  });

  const recentNotes = allNotes.slice(-3); // last 3 messages

  const addMutation = useMutation({
    mutationFn: (content: string) => mutationFetch(notesUrl, 'POST', { content }),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: notesCacheKey });
      queryClient.refetchQueries({ queryKey: activityCacheKey });
      queryClient.refetchQueries({ queryKey: ['/api/status-semanal'] });
      if (customId) queryClient.refetchQueries({ queryKey: ['/api/status-semanal/custom'] });
      setSent(true);
      setTimeout(() => setSent(false), 2000);
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const submit = () => {
    const t = msg.trim();
    if (!t) return;
    setMsg('');
    addMutation.mutate(t);
  };

  return (
    <div className="pt-2 border-t border-slate-100">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
          <MessageSquare className="h-3 w-3" /> Chat
        </p>
        {onOpenFullChat && (
          <button onClick={onOpenFullChat} className="text-[10px] text-indigo-500 hover:text-indigo-700 font-medium flex items-center gap-0.5">
            Ver todo <ArrowRight className="h-2.5 w-2.5" />
          </button>
        )}
      </div>
      {/* Recent messages */}
      {recentNotes.length > 0 ? (
        <div className="space-y-1 mb-1.5">
          {recentNotes.map(note => {
            const isOwn = note.authorId != null && note.authorId === currentUserId;
            const firstName = note.authorName?.split(' ')[0] || 'Usuario';
            return (
              <div key={note.id} className={cn("rounded px-2 py-1 text-[11px]", isOwn ? "bg-slate-50" : "bg-teal-50/60")}>
                <span className={cn("font-medium", isOwn ? "text-slate-500" : "text-teal-600")}>{firstName}</span>
                <span className="text-slate-400 ml-1 text-[9px]">{shortDateTime(note.createdAt)}</span>
                <p className="text-slate-700 leading-snug mt-0.5">{note.content}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[11px] text-slate-300 italic mb-1.5">Sin mensajes</p>
      )}
      {/* Quick reply */}
      <div className="flex gap-1">
        <MentionInput
          value={msg}
          onChange={setMsg}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
          placeholder="Escribir mensaje..."
          className="flex-1 text-[11px] border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
          users={users}
        />
        <button onClick={submit} disabled={!msg.trim() || addMutation.isPending}
          className={cn("p-1 rounded transition-colors",
            msg.trim() ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-slate-100 text-slate-300")}>
          {addMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> :
           sent ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Send className="h-3 w-3" />}
        </button>
      </div>
      {sent && <p className="text-[9px] text-emerald-500 mt-0.5 font-medium">Enviado</p>}
    </div>
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
          <div className={cn("rounded-full transition-transform group-hover:scale-125", meta.dot, compact ? "w-3 h-3" : "w-3.5 h-3.5")} />
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
          <Badge variant="outline" className={cn("text-[10px] h-5 cursor-pointer border font-semibold hover:opacity-80 px-1.5", meta.color)}>
            <span className="opacity-70 mr-1">{type === 'margin' ? 'Margen' : 'Equipo'}</span>{meta.label}
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
        <button className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 hover:bg-amber-100 transition-colors whitespace-nowrap max-w-[90px] truncate">
          {meta.label}
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
            <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center shrink-0" title="Asignar owner">
              <User className="h-3 w-3 text-slate-400" />
            </div>
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
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
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
        className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-600 transition-colors relative"
        title="Agregar fecha límite">
        <Calendar className="h-3 w-3" />
        <input ref={inputRef} type="date"
          className="absolute inset-0 opacity-0 cursor-pointer w-full"
          onChange={e => e.target.value && onChange(new Date(e.target.value).toISOString())} />
      </button>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-1 text-[10px] font-medium relative group/dl whitespace-nowrap cursor-pointer",
      isOverdue ? "text-red-500" : "text-slate-400")}>
      {isOverdue && <Clock className="h-3 w-3 shrink-0" />}
      <span>{deadlineLabel(value)}</span>
      <button onClick={e => { e.stopPropagation(); onChange(null); }}
        className="inline-flex opacity-0 group-hover/dl:opacity-100 text-slate-400 hover:text-red-500 shrink-0 transition-opacity">
        <X className="h-2.5 w-2.5" />
      </button>
      <input type="date" value={toDateStr(value)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full"
        onChange={e => e.target.value ? onChange(new Date(e.target.value).toISOString()) : onChange(null)} />
    </div>
  );
}

// ─── Alert card (Rojo / Amarillo or urgent decision) ─────────────────────────

function AlertCard({ item, users, isSelected, onOpenNotes, onUpdate, onRemove, currentUserId }: {
  item: Item; users: AppUser[]; isSelected: boolean; currentUserId?: number | null;
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
            <span className="shrink-0 hidden sm:inline"><FreshnessIndicator updatedAt={item.updatedAt} updatedByName={item.updatedByName} updatedById={item.updatedById} currentUserId={currentUserId} /></span>
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

function CompactRow({ item, users, isSelected, onOpenNotes, onUpdate, onRemove, expanded, onToggle, onNext, onPrev, hasNext, hasPrev, currentUserId, kbFocused, dragHandleProps, bulkMode, checked, onCheck, accent, hideSubtitle }: {
  item: Item; users: AppUser[]; isSelected: boolean; currentUserId?: number | null;
  onOpenNotes?: () => void; onUpdate: (d: Record<string, any>) => void; onRemove: () => void;
  expanded: boolean; onToggle: () => void; onNext?: () => void; onPrev?: () => void; hasNext?: boolean; hasPrev?: boolean;
  kbFocused?: boolean; dragHandleProps?: Record<string, any>; bulkMode?: boolean; checked?: boolean; onCheck?: (v: boolean) => void;
  accent?: 'red' | 'amber' | 'none'; hideSubtitle?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const decMeta = dm(item.decisionNeeded);

  const accentBorder = accent === 'red' ? 'border-l-red-500' : accent === 'amber' ? 'border-l-amber-400' : 'border-l-transparent';

  return (
    <div className={cn(
      "border-l-[3px] transition-colors duration-100 group",
      accentBorder,
      isSelected ? "bg-indigo-50/40" : "hover:bg-slate-50/60",
      expanded && "bg-slate-50/40",
      kbFocused && "outline outline-2 outline-indigo-300 outline-offset-[-2px]"
    )}>
      {/* Main row */}
      <div className={cn("flex items-center gap-3 pl-4 pr-5 cursor-pointer", hideSubtitle ? "py-2.5" : "py-3.5")} onClick={onToggle}>
        {dragHandleProps && (
          <div {...dragHandleProps} className="shrink-0 cursor-grab text-slate-200 hover:text-slate-400 touch-none opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
            <GripVertical className="h-3.5 w-3.5" />
          </div>
        )}
        {bulkMode && (
          <div className="shrink-0" onClick={e => { e.stopPropagation(); onCheck?.(!checked); }}>
            {checked ? <CheckSquare className="h-4 w-4 text-indigo-500" /> : <Square className="h-4 w-4 text-slate-300" />}
          </div>
        )}
        <div className="shrink-0" onClick={e => e.stopPropagation()}>
          <HealthDot value={item.healthStatus} onChange={v => onUpdate({ healthStatus: v })} compact />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 min-w-0">
            {item.isCustom && <Tag className="h-3 w-3 text-slate-300 shrink-0 self-center" />}
            <span className="font-medium text-[14px] tracking-tight text-slate-900 truncate" title={item.title}>{item.title}</span>
            {item.subtitle && <span className="text-slate-400 text-[12px] truncate hidden md:block shrink-0" title={item.subtitle}>{item.subtitle}</span>}
            <span className="shrink-0 self-center"><FreshnessIndicator updatedAt={item.updatedAt} updatedByName={item.updatedByName} updatedById={item.updatedById} currentUserId={currentUserId} /></span>
          </div>
          {!expanded && !hideSubtitle && item.currentAction && (
            <p
              className="text-[12px] truncate mt-0.5 leading-snug text-slate-400"
              onClick={e => { e.stopPropagation(); onToggle(); }}
            >
              {item.currentAction}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2" onClick={e => e.stopPropagation()}>
          {/* At rest: compact essentials — deadline + notes + owner avatar */}
          <div className="flex items-center gap-2 group-hover:hidden">
            {item.deadline && (
              <span className={cn("text-[10px]", item.isOverdue ? "text-red-500 font-medium" : "text-slate-400")}>
                {deadlineLabel(item.deadline)}
              </span>
            )}
            {item.noteCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                <MessageSquare className="h-2.5 w-2.5" />{item.noteCount}
              </span>
            )}
            {item.ownerName && (
              <div className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[8px] font-bold shrink-0" title={item.ownerName}>
                {initials(item.ownerName)}
              </div>
            )}
          </div>
          {/* On hover: full interactive controls */}
          <div className="hidden group-hover:flex items-center gap-1.5">
            {decMeta.urgent && (
              <DecisionBadge value={item.decisionNeeded} onChange={v => onUpdate({ decisionNeeded: v })} />
            )}
            <OwnerSelect value={item.ownerId} name={item.ownerName} onChange={v => onUpdate({ ownerId: v })} users={users} />
            <DeadlinePicker value={item.deadline} isOverdue={item.isOverdue} onChange={v => onUpdate({ deadline: v })} />
            {onOpenNotes && item.noteCount > 0 && (
              <button onClick={onOpenNotes}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <MessageSquare className="h-3 w-3" /><span className="text-[10px] font-medium">{item.noteCount}</span>
              </button>
            )}
            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger asChild>
                <button className="p-1 rounded hover:bg-slate-100 text-slate-300 hover:text-slate-500 transition-colors">
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
      </div>

      {/* Expanded panel — focused, no activity inline */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden">
            <div className="pl-4 pr-5 pb-4">
              <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                {/* Two-column: Estado actual | Próximo paso */}
                <div className="grid grid-cols-2 divide-x divide-slate-100">
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-semibold text-slate-400 tracking-wide uppercase mb-1.5 flex items-center gap-1.5">
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0 inline-block",
                        item.healthStatus === 'rojo' ? "bg-red-500" :
                        item.healthStatus === 'amarillo' ? "bg-amber-400" : "bg-emerald-400")} />
                      Estado actual
                    </p>
                    <InlineText value={item.currentAction} placeholder="¿Qué está pasando ahora?" onSave={v => onUpdate({ currentAction: v })} multiline className="text-[13px] leading-relaxed text-slate-700" />
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-semibold text-slate-400 tracking-wide uppercase mb-1.5">Próximo paso</p>
                    <InlineText value={item.nextMilestone} placeholder="Acción concreta esta semana" onSave={v => onUpdate({ nextMilestone: v })} multiline className="text-[13px] leading-relaxed text-slate-700" />
                  </div>
                </div>

                {/* Custom: editable title + subtitle */}
                {item.isCustom && (
                  <div className="flex items-center gap-3 px-5 py-2 border-t border-slate-100 bg-slate-50/30">
                    <Tag className="h-3 w-3 text-slate-300 shrink-0" />
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <InlineText value={item.title} placeholder="Título" onSave={v => onUpdate({ title: v })} className="text-[12px] font-medium text-slate-600 truncate" />
                      {item.subtitle !== null && item.subtitle !== undefined && (
                        <><span className="text-slate-200 shrink-0">·</span>
                        <InlineText value={item.subtitle} placeholder="Descripción opcional..." onSave={v => onUpdate({ subtitle: v })} className="text-[12px] text-slate-400 truncate flex-1" /></>
                      )}
                    </div>
                  </div>
                )}

                {/* Footer: metadata + nav + open full panel */}
                <div className="flex items-center gap-1.5 px-5 py-2.5 border-t border-slate-100 bg-slate-50/60 flex-wrap">
                  <OwnerSelect value={item.ownerId} name={item.ownerName} onChange={v => onUpdate({ ownerId: v })} users={users} />
                  <DeadlinePicker value={item.deadline} isOverdue={item.isOverdue} onChange={v => onUpdate({ deadline: v })} />
                  <div className="h-3 w-px bg-slate-200 mx-0.5 shrink-0" />
                  <LevelBadge value={item.marginStatus} onChange={v => onUpdate({ marginStatus: v })} label="Rentabilidad" type="margin" />
                  <LevelBadge value={item.teamStrain} onChange={v => onUpdate({ teamStrain: v })} label="Carga equipo" type="team" />
                  <DecisionBadge value={item.decisionNeeded} onChange={v => onUpdate({ decisionNeeded: v })} />
                  {item.mainRisk && (
                    <div className="flex items-center gap-1 text-[10px] text-orange-600 bg-orange-50 border border-orange-100 rounded-md px-1.5 py-0.5">
                      <Shield className="h-2.5 w-2.5" /><span className="truncate max-w-[120px]">{item.mainRisk}</span>
                    </div>
                  )}
                  <div className="flex-1" />
                  {(hasPrev || hasNext) && (
                    <div className="flex items-center gap-0.5 ml-2">
                      <button onClick={onPrev} disabled={!hasPrev} className={cn("p-0.5 rounded", hasPrev ? "text-slate-400 hover:bg-slate-100" : "text-slate-200")}><ChevronLeft className="h-3 w-3" /></button>
                      <button onClick={onNext} disabled={!hasNext} className={cn("p-0.5 rounded", hasNext ? "text-slate-400 hover:bg-slate-100" : "text-slate-200")}><ChevronRight className="h-3 w-3" /></button>
                    </div>
                  )}
                </div>

                {/* Quick activity — last update + input */}
                <div className="border-t border-slate-100">
                  <div className="flex items-center gap-2 px-5 pt-3 pb-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Actividad</span>
                    {onOpenNotes && (
                      <button onClick={onOpenNotes}
                        className="ml-auto flex items-center gap-1 text-[11px] font-medium text-indigo-500 hover:text-indigo-700 transition-colors">
                        Ver historial{item.noteCount > 0 && ` · ${item.noteCount}`}
                        <ArrowRight className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                  <div className="px-5 pb-4">
                    <ItemThread
                      projectId={item.projectId}
                      customId={item.customId}
                      currentUserId={currentUserId}
                      users={users}
                      onOpenFull={onOpenNotes}
                      compact
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Unified activity thread (updates + notes merged) ────────────────────────

type ThreadEntry = {
  kind: 'update' | 'note';
  id: number;
  content: string;
  authorId: number | null;
  authorName: string | null;
  createdAt: string;
};

function ItemThread({ projectId, customId, currentUserId, users = [], onOpenFull, compact = false }: {
  projectId?: number; customId?: number; currentUserId?: number | null;
  users?: AppUser[]; onOpenFull?: () => void; compact?: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [draft, setDraft] = useState('');
  const [postAs, setPostAs] = useState<'note' | 'update'>('note');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const updatesUrl = projectId
    ? `/api/status-semanal/${projectId}/updates`
    : `/api/status-semanal/custom/${customId}/updates`;
  const updatesCacheKey = projectId
    ? ['/api/status-semanal', projectId, 'updates']
    : ['/api/status-semanal/custom', customId, 'updates'];

  const notesUrl = projectId
    ? `/api/status-semanal/${projectId}/notes`
    : `/api/status-semanal/custom/${customId}/notes`;
  const notesCacheKey = projectId
    ? ['/api/status-semanal', projectId, 'notes']
    : ['/api/status-semanal/custom', customId, 'notes'];

  const { data: updateEntries = [] } = useQuery<UpdateEntry[]>({
    queryKey: updatesCacheKey,
    queryFn: async () => { const r = await authFetch(updatesUrl); return r.json(); },
  });

  const { data: notes = [] } = useQuery<Note[]>({
    queryKey: notesCacheKey,
    queryFn: async () => { const r = await authFetch(notesUrl); return r.json(); },
  });

  const thread: ThreadEntry[] = [
    ...updateEntries.map(e => ({ kind: 'update' as const, ...e })),
    ...notes.map(n => ({ kind: 'note' as const, id: n.id, content: n.content, authorId: n.authorId, authorName: n.authorName, createdAt: n.createdAt })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const addNoteMutation = useMutation({
    mutationFn: (content: string) => mutationFetch(notesUrl, 'POST', { content }),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: notesCacheKey });
      queryClient.refetchQueries({ queryKey: ['/api/status-semanal'] });
      if (customId) queryClient.refetchQueries({ queryKey: ['/api/status-semanal/custom'] });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const addUpdateMutation = useMutation({
    mutationFn: (content: string) => mutationFetch(updatesUrl, 'POST', { content }),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: updatesCacheKey });
      queryClient.refetchQueries({ queryKey: ['/api/status-semanal'] });
      if (customId) queryClient.refetchQueries({ queryKey: ['/api/status-semanal/custom'] });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const editUpdateMutation = useMutation({
    mutationFn: ({ entryId, content }: { entryId: number; content: string }) =>
      mutationFetch(`/api/status-semanal/updates/${entryId}`, 'PATCH', { content }),
    onSuccess: () => {
      setEditingId(null);
      queryClient.refetchQueries({ queryKey: updatesCacheKey });
    },
    onError: (err: Error) => toast({ title: 'Error al editar', description: err.message, variant: 'destructive' }),
  });

  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    setDraft('');
    if (postAs === 'note') addNoteMutation.mutate(t);
    else addUpdateMutation.mutate(t);
  };

  const SHOW_RECENT = compact ? 1 : 5;
  const visibleThread = thread.slice(-SHOW_RECENT);
  const hiddenCount = thread.length - SHOW_RECENT;

  return (
    <div>
      {/* Thread entries */}
      <div className={cn("mb-2.5", compact ? "space-y-1.5" : "space-y-2.5")}>
        {hiddenCount > 0 && (
          <button onClick={onOpenFull}
            className="flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-700 font-medium">
            <ChevronUp className="h-3 w-3" />
            {compact ? `Ver ${thread.length} entradas` : `Ver ${hiddenCount} entradas anteriores`}
          </button>
        )}
        {thread.length === 0 && (
          <p className="text-[11px] text-slate-400 italic py-0.5">{compact ? 'Sin actividad aún' : 'Sin actividad — agregá un update o dejá un comentario'}</p>
        )}
        {visibleThread.map(entry => {
          const isOwn = entry.authorId != null && entry.authorId === currentUserId;
          const edKey = `${entry.kind}-${entry.id}`;
          const canEdit = isOwn && entry.kind === 'update';
          return (
            <div key={edKey} className="flex items-start gap-2 group">
              <div className={cn("h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5",
                isOwn ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600")}>
                {initials(entry.authorName ?? '?')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[10px] font-semibold text-slate-700">{entry.authorName?.split(' ')[0] ?? 'Usuario'}</span>
                  <span className="text-[9px] text-slate-400">{shortDateTime(entry.createdAt)}</span>
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                    entry.kind === 'update' ? "bg-emerald-400" : "bg-indigo-300")}
                    title={entry.kind === 'update' ? 'Update de estado' : 'Nota'} />
                  {canEdit && editingId !== edKey && (
                    <button onClick={() => { setEditingId(edKey); setEditText(entry.content); }}
                      className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-slate-300 hover:text-indigo-400">
                      <Pencil className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
                {editingId === edKey ? (
                  <div className="space-y-1">
                    <input value={editText} autoFocus
                      onChange={e => setEditText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); if (editText.trim()) editUpdateMutation.mutate({ entryId: entry.id, content: editText }); }
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="w-full text-xs border border-indigo-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                    />
                    <div className="flex gap-1">
                      <button onClick={() => { if (editText.trim()) editUpdateMutation.mutate({ entryId: entry.id, content: editText }); }}
                        disabled={!editText.trim() || editUpdateMutation.isPending}
                        className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] hover:bg-indigo-700 disabled:opacity-40">
                        {editUpdateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Guardar'}
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] hover:bg-slate-200">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{entry.content}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Compose input */}
      <div className="mt-1">
        <div className="flex gap-1 mb-1.5">
          <button onClick={() => setPostAs('note')}
            className={cn("text-[10px] px-2.5 py-1 rounded-full font-medium transition-all",
              postAs === 'note'
                ? "bg-indigo-100 text-indigo-700"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-100")}>
            💬 Nota
          </button>
          <button onClick={() => setPostAs('update')}
            className={cn("text-[10px] px-2.5 py-1 rounded-full font-medium transition-all",
              postAs === 'update'
                ? "bg-emerald-100 text-emerald-700"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-100")}>
            ↑ Update
          </button>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-3 py-2 shadow-sm focus-within:border-indigo-300 focus-within:shadow-indigo-50 transition-all">
          <MentionInput
            value={draft}
            onChange={setDraft}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder={postAs === 'note' ? "Escribir comentario o pregunta..." : "¿Qué avanzó este ítem?"}
            className="flex-1 text-sm bg-transparent focus:outline-none min-w-0"
            users={users}
          />
          <button onClick={submit}
            disabled={!draft.trim() || addNoteMutation.isPending || addUpdateMutation.isPending}
            className={cn("shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all",
              draft.trim()
                ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                : "bg-slate-100 text-slate-300")}>
            {(addNoteMutation.isPending || addUpdateMutation.isPending)
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <ArrowRight className="h-3 w-3" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add custom item dialog ───────────────────────────────────────────────────

const ITEM_TEMPLATES = [
  { label: 'Reunión de cierre', subtitle: 'Seguimiento comercial' },
  { label: 'Propuesta comercial', subtitle: '' },
  { label: 'Demo de producto', subtitle: '' },
  { label: 'Negociación contrato', subtitle: '' },
  { label: 'Seguimiento cliente', subtitle: '' },
];

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
        <p className="text-sm font-semibold mb-2">Nuevo ítem de seguimiento</p>
        {/* Templates */}
        <div className="mb-3">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-1.5">Plantillas</p>
          <div className="flex flex-wrap gap-1">
            {ITEM_TEMPLATES.map(t => (
              <button key={t.label} onClick={() => { setTitle(t.label); setSubtitle(t.subtitle); }}
                className="text-[11px] px-2 py-1 rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors font-medium">
                {t.label}
              </button>
            ))}
          </div>
        </div>
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

// ─── SortableCompactRow wrapper for DnD ──────────────────────────────────────

function SortableCompactRow(props: React.ComponentProps<typeof CompactRow>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.item.key });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 1 : 0,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <CompactRow {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

// ─── FocusBlock — CEO command center ─────────────────────────────────────────

function FocusBlock({ items, onFocusItem }: {
  items: Item[];
  onFocusItem: (item: Item) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-2.5 border-b border-slate-100">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest flex-1">Para resolver hoy</span>
        <span className="flex items-center gap-1 text-[11px] font-semibold text-red-500">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
          {items.length} pendiente{items.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="divide-y divide-slate-50">
        {items.map((item, i) => {
          const isUrgent = item.isOverdue || item.healthStatus === 'rojo';
          const decMeta = dm(item.decisionNeeded);
          return (
            <button key={item.key} onClick={() => onFocusItem(item)}
              className="w-full flex items-center gap-3 text-left hover:bg-slate-50 px-5 py-2.5 transition-colors">
              <span className="text-[11px] text-slate-300 w-3 shrink-0">{i + 1}</span>
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                isUrgent ? "bg-red-500" : "bg-amber-400")} />
              <span className="flex-1 text-[13px] font-medium text-slate-800 truncate">{item.title}</span>
              {item.ownerName && (
                <span className="text-[11px] text-slate-400 shrink-0">{item.ownerName.split(' ')[0]}</span>
              )}
              <span className={cn("shrink-0 text-[10px] font-medium",
                isUrgent ? "text-red-500" : "text-amber-500")}>
                {isUrgent ? (item.isOverdue ? 'Vencido' : 'Crítico') : decMeta.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── DecisionRow — decision-first display ────────────────────────────────────

function DecisionRow({ item, users, onUpdate, onRemove, onOpenNotes, expanded, onToggle, hasPrev, hasNext, onPrev, onNext, isSelected, currentUserId, kbFocused, bulkMode, checked, onCheck, compact }: {
  item: Item; users: AppUser[]; currentUserId?: number | null;
  onUpdate: (d: Record<string, any>) => void; onRemove: () => void;
  onOpenNotes?: () => void; expanded: boolean; onToggle: () => void;
  hasPrev?: boolean; hasNext?: boolean; onPrev?: () => void; onNext?: () => void;
  isSelected?: boolean; kbFocused?: boolean;
  bulkMode?: boolean; checked?: boolean; onCheck?: (v: boolean) => void;
  compact?: boolean;
}) {
  const decMeta = dm(item.decisionNeeded);
  const [menuOpen, setMenuOpen] = useState(false);
  const daysSince = item.updatedAt
    ? Math.floor((Date.now() - new Date(item.updatedAt).getTime()) / 86400000)
    : null;

  return (
    <div className={cn(
      "border-l-[3px] border-l-amber-400 transition-colors duration-100 group",
      isSelected ? "bg-indigo-50/40" : "hover:bg-amber-50/20",
      expanded && "bg-amber-50/20",
      kbFocused && "outline outline-2 outline-indigo-300 outline-offset-[-2px]"
    )}>
      <div className={cn("flex items-center gap-3 pl-4 pr-5 cursor-pointer", compact ? "py-2.5" : "py-3.5")} onClick={onToggle}>
        {bulkMode && (
          <div className="shrink-0" onClick={e => { e.stopPropagation(); onCheck?.(!checked); }}>
            {checked ? <CheckSquare className="h-4 w-4 text-indigo-500" /> : <Square className="h-4 w-4 text-slate-300" />}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-medium text-[14px] tracking-tight text-slate-900 truncate">{item.title}</span>
          </div>
          {!expanded && (
            <p className={cn("text-[12px] truncate mt-0.5 leading-snug",
              item.currentAction ? "text-slate-400" : "text-slate-300 italic")}>
              {item.currentAction || "Agregar estado actual..."}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
          {/* At rest: compact */}
          <div className="flex items-center gap-2 group-hover:hidden">
            <span className="text-[10px] font-medium text-amber-600">{decMeta.label}</span>
            {daysSince !== null && daysSince > 1 && (
              <span className="text-[10px] text-slate-400">{daysSince}d</span>
            )}
            {item.deadline && (
              <span className={cn("text-[10px]", item.isOverdue ? "text-red-500 font-medium" : "text-slate-400")}>
                {deadlineLabel(item.deadline)}
              </span>
            )}
            {item.ownerName && (
              <div className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[8px] font-bold shrink-0" title={item.ownerName}>
                {initials(item.ownerName)}
              </div>
            )}
          </div>
          {/* On hover: full controls */}
          <div className="hidden group-hover:flex items-center gap-1.5">
            <OwnerSelect value={item.ownerId} name={item.ownerName} onChange={v => onUpdate({ ownerId: v })} users={users} />
            <DeadlinePicker value={item.deadline} isOverdue={item.isOverdue} onChange={v => onUpdate({ deadline: v })} />
            {onOpenNotes && item.noteCount > 0 && (
              <button onClick={onOpenNotes}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <MessageSquare className="h-3 w-3" /><span className="text-[10px] font-medium">{item.noteCount}</span>
              </button>
            )}
            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger asChild>
                <button className="p-1 rounded hover:bg-slate-100 text-slate-300 hover:text-slate-500 transition-colors">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-1" align="end">
                <button onClick={() => { onRemove(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-red-50 text-slate-600 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />{item.isCustom ? "Eliminar ítem" : "Quitar del status"}
                </button>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Expanded panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden">
            <div className="pl-4 pr-5 pb-4">
              <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                <div className={compact ? "flex flex-col divide-y divide-slate-100" : "grid grid-cols-2 divide-x divide-slate-100"}>
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-semibold text-slate-400 tracking-wide uppercase mb-1.5">Estado actual</p>
                    <InlineText value={item.currentAction} placeholder="¿Qué está pasando ahora?" onSave={v => onUpdate({ currentAction: v })} multiline className="text-[13px] leading-relaxed text-slate-700" />
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-semibold text-slate-400 tracking-wide uppercase mb-1.5">Próximo paso</p>
                    <InlineText value={item.nextMilestone} placeholder="Acción concreta esta semana" onSave={v => onUpdate({ nextMilestone: v })} multiline className="text-[13px] leading-relaxed text-slate-700" />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-5 py-2.5 border-t border-slate-100 bg-slate-50/60 flex-wrap">
                  <OwnerSelect value={item.ownerId} name={item.ownerName} onChange={v => onUpdate({ ownerId: v })} users={users} />
                  <DeadlinePicker value={item.deadline} isOverdue={item.isOverdue} onChange={v => onUpdate({ deadline: v })} />
                  <div className="h-3 w-px bg-slate-200 mx-0.5 shrink-0" />
                  <DecisionBadge value={item.decisionNeeded} onChange={v => onUpdate({ decisionNeeded: v })} />
                  <LevelBadge value={item.marginStatus} onChange={v => onUpdate({ marginStatus: v })} label="Rentabilidad" type="margin" />
                  <LevelBadge value={item.teamStrain} onChange={v => onUpdate({ teamStrain: v })} label="Carga equipo" type="team" />
                  <div className="flex-1" />
                  {onOpenNotes && (
                    <button onClick={onOpenNotes}
                      className="flex items-center gap-1 text-[11px] font-medium text-indigo-500 hover:text-indigo-700">
                      <MessageSquare className="h-3 w-3" />Ver actividad{item.noteCount > 0 && ` · ${item.noteCount}`}<ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                  {(hasPrev || hasNext) && (
                    <div className="flex items-center gap-0.5 ml-2">
                      <button onClick={onPrev} disabled={!hasPrev} className={cn("p-0.5 rounded", hasPrev ? "text-slate-400 hover:bg-slate-100" : "text-slate-200")}><ChevronLeft className="h-3 w-3" /></button>
                      <button onClick={onNext} disabled={!hasNext} className={cn("p-0.5 rounded", hasNext ? "text-slate-400 hover:bg-slate-100" : "text-slate-200")}><ChevronRight className="h-3 w-3" /></button>
                    </div>
                  )}
                </div>

                {/* Quick activity */}
                <div className="border-t border-slate-100">
                  <div className="flex items-center gap-2 px-5 pt-3 pb-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Actividad</span>
                    {onOpenNotes && (
                      <button onClick={onOpenNotes}
                        className="ml-auto flex items-center gap-1 text-[11px] font-medium text-indigo-500 hover:text-indigo-700 transition-colors">
                        Ver historial{item.noteCount > 0 && ` · ${item.noteCount}`}
                        <ArrowRight className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                  <div className="px-5 pb-4">
                    <ItemThread
                      projectId={item.projectId}
                      customId={item.customId}
                      currentUserId={currentUserId}
                      users={users}
                      onOpenFull={onOpenNotes}
                      compact
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── AlertSidebarCard — scannable card for CEO/COO attention sidebar ─────────
// Collapsed: full title + context + owner/deadline always visible, no hover-hide.
// Expanded: single-column Estado actual + Próximo paso panel.
function AlertSidebarCard({ item, accent, currentUserId, onUpdate, onToggle, expanded }: {
  item: Item; accent: 'red' | 'amber'; currentUserId?: number | null;
  onUpdate: (d: Record<string, any>) => void; onToggle: () => void; expanded: boolean;
}) {
  const accentBorder = accent === 'red' ? 'border-l-red-500' : 'border-l-amber-400';
  return (
    <div className={cn("border-l-[3px] transition-colors", accentBorder, expanded ? "bg-slate-50/50" : "hover:bg-slate-50/60")}>
      {/* Collapsed header — always readable */}
      <div className="px-3 py-3 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start gap-2.5">
          <div className="shrink-0 mt-0.5" onClick={e => e.stopPropagation()}>
            <HealthDot value={item.healthStatus} onChange={v => onUpdate({ healthStatus: v })} compact />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[13px] leading-snug text-slate-900 break-words">{item.title}</p>
            {item.currentAction && !expanded && (
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-2">{item.currentAction}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {item.ownerName && (
                <div className="flex items-center gap-1">
                  <div className="h-4 w-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[8px] font-bold shrink-0">
                    {initials(item.ownerName)}
                  </div>
                  <span className="text-[10px] text-slate-400">{item.ownerName.split(' ')[0]}</span>
                </div>
              )}
              {item.deadline && (
                <span className={cn("text-[10px] font-medium", item.isOverdue ? "text-red-500" : "text-slate-400")}>
                  {deadlineLabel(item.deadline)}
                </span>
              )}
              <FreshnessIndicator updatedAt={item.updatedAt} updatedByName={item.updatedByName} updatedById={item.updatedById} currentUserId={currentUserId} />
            </div>
          </div>
        </div>
      </div>
      {/* Expanded detail — single column, no cramping */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden">
            <div className="px-3 pb-3">
              <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden shadow-sm">
                <div className="divide-y divide-slate-100">
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Estado actual</p>
                    <InlineText value={item.currentAction} placeholder="¿Qué está pasando?" onSave={v => onUpdate({ currentAction: v })} multiline className="text-[12px] leading-relaxed text-slate-700" />
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Próximo paso</p>
                    <InlineText value={item.nextMilestone} placeholder="Acción concreta esta semana" onSave={v => onUpdate({ nextMilestone: v })} multiline className="text-[12px] leading-relaxed text-slate-700" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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

// ─── Field labels for change log ─────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  healthStatus: 'Estado',
  marginStatus: 'Rentabilidad',
  teamStrain: 'Carga equipo',
  mainRisk: 'Riesgo principal',
  currentAction: 'Update',
  nextMilestone: 'Próximo paso',
  deadline: 'Deadline',
  ownerId: 'Owner',
  decisionNeeded: 'Decisión',
};

function formatChangeValue(fieldName: string, value: string | null): string {
  if (value == null) return '(vacío)';
  if (fieldName === 'deadline') {
    try { return new Date(value).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }); } catch { return value; }
  }
  if (value.length > 60) return value.slice(0, 57) + '...';
  return value;
}

// ─── Activity panel (unified timeline: notes + changes) ─────────────────────

function ActivityPanel({ projectId, customItemId, projectName, onClose }: { projectId?: number; customItemId?: number; projectName: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [newNote, setNewNote] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const currentUserId = (user as any)?.id;

  const notesUrl = projectId
    ? `/api/status-semanal/${projectId}/notes`
    : `/api/status-semanal/custom/${customItemId}/notes`;
  const notesCacheKey = projectId
    ? ['/api/status-semanal', projectId, 'notes']
    : ['/api/status-semanal/custom', customItemId, 'notes'];
  const activityUrl = projectId
    ? `/api/status-semanal/${projectId}/activity`
    : `/api/status-semanal/custom/${customItemId}/activity`;
  const activityCacheKey = projectId
    ? ['/api/status-semanal', projectId, 'activity']
    : ['/api/status-semanal/custom', customItemId, 'activity'];

  const { data: timeline = [], isLoading } = useQuery<ActivityEntry[]>({
    queryKey: activityCacheKey,
    queryFn: async () => { const r = await authFetch(activityUrl); return r.json(); },
  });

  const addMutation = useMutation({
    mutationFn: (content: string) => mutationFetch(notesUrl, 'POST', { content }),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: activityCacheKey });
      queryClient.refetchQueries({ queryKey: notesCacheKey });
      queryClient.refetchQueries({ queryKey: ['/api/status-semanal'] });
      if (customItemId) queryClient.refetchQueries({ queryKey: ['/api/status-semanal/custom'] });
    },
    onError: (err: Error) => toast({ title: 'Error al guardar comentario', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (noteId: number) => mutationFetch(`/api/status-semanal/notes/${noteId}`, 'DELETE'),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: activityCacheKey });
      queryClient.refetchQueries({ queryKey: notesCacheKey });
      queryClient.refetchQueries({ queryKey: ['/api/status-semanal'] });
      if (customItemId) queryClient.refetchQueries({ queryKey: ['/api/status-semanal/custom'] });
    },
    onError: (err: Error) => toast({ title: 'Error al eliminar comentario', description: err.message, variant: 'destructive' }),
  });

  const editMutation = useMutation({
    mutationFn: ({ noteId, content }: { noteId: number; content: string }) =>
      mutationFetch(`/api/status-semanal/notes/${noteId}`, 'PATCH', { content }),
    onSuccess: () => {
      setEditingId(null);
      queryClient.refetchQueries({ queryKey: activityCacheKey });
      queryClient.refetchQueries({ queryKey: notesCacheKey });
    },
    onError: (err: Error) => toast({ title: 'Error al editar comentario', description: err.message, variant: 'destructive' }),
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [timeline.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0 bg-slate-50/80">
        <div className="flex items-center gap-1.5 min-w-0">
          <ClipboardList className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
          <p className="text-xs font-semibold truncate">{projectName}</p>
          <span className="text-[10px] text-muted-foreground shrink-0">Actividad</span>
        </div>
        <button onClick={onClose} className="p-0.5 hover:bg-accent rounded text-muted-foreground shrink-0"><X className="h-3.5 w-3.5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {isLoading && <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}
        {!isLoading && timeline.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ClipboardList className="h-6 w-6 text-muted-foreground/20 mb-1.5" />
            <p className="text-xs text-muted-foreground">Sin actividad todavía</p>
          </div>
        )}
        {timeline.map((entry, idx) => {
          if (entry.type === 'note') {
            const isOwn = entry.authorId === currentUserId;
            return (
              <div key={`n_${entry.id}`} className="group flex gap-2 py-1">
                <div className={cn("h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5", isOwn ? "bg-indigo-100 text-indigo-700" : "bg-teal-100 text-teal-700")}>
                  {initials(entry.authorName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className={cn("text-[11px] font-medium", isOwn ? "text-slate-700" : "text-teal-700")}>{entry.authorName || 'Usuario'}</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-[10px] text-muted-foreground cursor-default">{relTime(entry.createdAt)}</span>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">{fullDateTime(entry.createdAt)}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  {editingId === entry.id ? (
                    <div className="space-y-1">
                      <Textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (editText.trim()) editMutation.mutate({ noteId: entry.id, content: editText });
                          } else if (e.key === 'Escape') {
                            setEditingId(null);
                          }
                        }}
                        className="resize-none text-[11px] min-h-[40px] max-h-[120px] bg-white px-2.5 py-1.5"
                      />
                      <div className="flex gap-1">
                        <Button size="sm" className="h-6 px-2 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white"
                          disabled={!editText.trim() || editMutation.isPending}
                          onClick={() => editMutation.mutate({ noteId: entry.id, content: editText })}>
                          {editMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Guardar'}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]"
                          onClick={() => setEditingId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] bg-white border border-slate-100 rounded-md px-2.5 py-1.5 leading-relaxed whitespace-pre-wrap">{entry.content}</div>
                  )}
                </div>
                {isOwn && editingId !== entry.id && (
                  <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                    <button onClick={() => { setEditingId(entry.id); setEditText(entry.content); }} className="p-0.5 text-slate-300 hover:text-indigo-400">
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button onClick={() => deleteMutation.mutate(entry.id)} className="p-0.5 text-slate-300 hover:text-red-400">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          }
          // type === 'change'
          const isOwn = entry.userId === currentUserId;
          const label = FIELD_LABELS[entry.fieldName] || entry.fieldName;
          const newVal = formatChangeValue(entry.fieldName, entry.newValue);
          return (
            <div key={`c_${entry.id}`} className={cn("flex items-start gap-2 py-1 px-2 rounded-md", isOwn ? "bg-slate-50" : "bg-indigo-50/60")}>
              <div className={cn("h-4 w-4 rounded-full flex items-center justify-center text-[7px] font-bold shrink-0 mt-0.5", isOwn ? "bg-slate-200 text-slate-500" : "bg-indigo-200 text-indigo-600")}>
                {initials(entry.userName)}
              </div>
              <div className="flex-1 min-w-0">
                <span className={cn("text-[10px]", isOwn ? "text-slate-500" : "text-indigo-600")}>
                  <span className="font-medium">{entry.userName?.split(' ')[0] || 'Usuario'}</span>
                  {' cambió '}
                  <span className="font-semibold">{label}</span>
                  {' → '}
                  <span className="font-medium">{newVal}</span>
                </span>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-[9px] text-muted-foreground shrink-0 cursor-default">{relTime(entry.createdAt)}</span>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">{fullDateTime(entry.createdAt)}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
  const { user } = useAuth();
  const currentUserId = (user as any)?.id ?? null;
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

  // ── New feature state ───────────────────────────────────────────────────────
  const [kbFocusKey, setKbFocusKey] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [normalOrder, setNormalOrder] = useState<string[]>([]);
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  const [showExport, setShowExport] = useState(false);
  const [showKbHelp, setShowKbHelp] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── AI Summary mutation ─────────────────────────────────────────────────────

  // Keyboard shortcuts + Esc handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement as HTMLElement)?.isContentEditable;

      if (e.key === 'Escape') {
        if (confirmDelete) { setConfirmDelete(null); return; }
        if (showExport) { setShowExport(false); return; }
        if (kbFocusKey) {
          // If a row is expanded, collapse it first
          setExpandedRowKey(null);
          setExpandedAlertKey(null);
          setExpandedDecisionKey(null);
          setKbFocusKey(null);
          return;
        }
        if (notesOpen) { setNotesOpen(null); return; }
        return;
      }

      if (isInput) return;

      // Navigation shortcuts
      if (e.key === '/' || e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === '?') {
        e.preventDefault();
        setShowKbHelp(v => !v);
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [notesOpen, confirmDelete, kbFocusKey, showExport]);

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
    updatedById: r.reviewUpdatedBy,
    updatedByName: r.reviewUpdatedByName,
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
    updatedById: c.updatedBy,
    updatedByName: c.updatedByName,
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

  // Flat list for keyboard navigation (alert + decision + normal)
  const flatNavItems = [...alertItems, ...decisionItems, ...normalItems];

  // Sync normalOrder when normalItems changes (keep existing order, add new items at end)
  useEffect(() => {
    const currentKeys = normalItems.map(i => i.key);
    setNormalOrder(prev => {
      const existing = prev.filter(k => currentKeys.includes(k));
      const added = currentKeys.filter(k => !prev.includes(k));
      return [...existing, ...added];
    });
  }, [normalItems.map(i => i.key).join(',')]);

  // Keyboard navigation effect (depends on flatNavItems, so inside render)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement as HTMLElement)?.isContentEditable;
      if (isInput) return;

      const navKeys = ['j', 'k', 'J', 'K', 'ArrowDown', 'ArrowUp', 'e', 'E'];
      if (!navKeys.includes(e.key)) return;

      e.preventDefault();
      const currentIdx = kbFocusKey ? flatNavItems.findIndex(i => i.key === kbFocusKey) : -1;

      if (e.key === 'j' || e.key === 'J' || e.key === 'ArrowDown') {
        const next = flatNavItems[currentIdx + 1];
        if (next) setKbFocusKey(next.key);
        else if (flatNavItems.length > 0) setKbFocusKey(flatNavItems[0].key);
      } else if (e.key === 'k' || e.key === 'K' || e.key === 'ArrowUp') {
        const prev = flatNavItems[currentIdx - 1];
        if (prev) setKbFocusKey(prev.key);
        else if (flatNavItems.length > 0) setKbFocusKey(flatNavItems[flatNavItems.length - 1].key);
      } else if (e.key === 'e' || e.key === 'E') {
        if (!kbFocusKey) return;
        const item = flatNavItems.find(i => i.key === kbFocusKey);
        if (!item) return;
        if (alertKeys.has(kbFocusKey)) {
          setExpandedAlertKey(expandedAlertKey === kbFocusKey ? null : kbFocusKey);
        } else if (decisionKeys.has(kbFocusKey)) {
          setExpandedDecisionKey(expandedDecisionKey === kbFocusKey ? null : kbFocusKey);
        } else {
          setExpandedRowKey(expandedRowKey === kbFocusKey ? null : kbFocusKey);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [kbFocusKey, flatNavItems, alertKeys, decisionKeys, expandedAlertKey, expandedDecisionKey, expandedRowKey]);

  // Sorted normal items with drag-and-drop order
  const sortedNormalItems = normalOrder.length > 0
    ? [...normalOrder.map(k => normalItems.find(i => i.key === k)).filter(Boolean) as Item[],
       ...normalItems.filter(i => !normalOrder.includes(i.key))]
    : normalItems;

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
                  ref={searchInputRef}
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
                {/* View toggle */}
                <button onClick={() => setViewMode(v => v === 'list' ? 'timeline' : 'list')}
                  title={viewMode === 'list' ? 'Ver timeline' : 'Ver lista'}
                  className={cn("p-1.5 rounded-full border transition-colors backdrop-blur-sm",
                    viewMode === 'timeline'
                      ? "bg-white/25 text-white border-white/30"
                      : "bg-white/10 text-indigo-200 border-white/15 hover:bg-white/20 hover:text-white")}>
                  {viewMode === 'list' ? <LayoutList className="h-3 w-3" /> : <List className="h-3 w-3" />}
                </button>
                {/* Export */}
                <button onClick={() => setShowExport(true)} title="Exportar semana"
                  className="p-1.5 rounded-full border transition-colors backdrop-blur-sm bg-white/10 text-indigo-200 border-white/15 hover:bg-white/20 hover:text-white">
                  <Printer className="h-3 w-3" />
                </button>
                {/* Bulk select */}
                <button onClick={() => { setBulkMode(v => !v); setSelectedKeys(new Set()); }}
                  title="Selección masiva"
                  className={cn("p-1.5 rounded-full border transition-colors backdrop-blur-sm",
                    bulkMode ? "bg-white/25 text-white border-white/30" : "bg-white/10 text-indigo-200 border-white/15 hover:bg-white/20 hover:text-white")}>
                  <CheckSquare className="h-3 w-3" />
                </button>
                {/* Keyboard help */}
                <button onClick={() => setShowKbHelp(v => !v)} title="Atajos de teclado (?)"
                  className="p-1.5 rounded-full border transition-colors backdrop-blur-sm bg-white/10 text-indigo-200 border-white/15 hover:bg-white/20 hover:text-white">
                  <HelpCircle className="h-3 w-3" />
                </button>
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
        <div className="flex-1 overflow-hidden flex min-h-0">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
          ) : viewMode === 'timeline' ? (
            /* ── Timeline View ── */
            (() => {
              const now = new Date();
              now.setHours(0, 0, 0, 0);
              const monday = new Date(now);
              monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
              // Build 8 week buckets
              const weeks: { label: string; start: Date; end: Date; items: Item[] }[] = [];
              for (let w = 0; w < 8; w++) {
                const start = new Date(monday);
                start.setDate(monday.getDate() + w * 7);
                const end = new Date(start);
                end.setDate(start.getDate() + 6);
                const label = start.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
                weeks.push({ label, start, end, items: [] });
              }
              const noDateItems: Item[] = [];
              visible.forEach(item => {
                if (!item.deadline) { noDateItems.push(item); return; }
                const d = new Date(item.deadline);
                const bucket = weeks.find(w => d >= w.start && d <= w.end);
                if (bucket) bucket.items.push(item);
                else if (d > weeks[weeks.length - 1].end) weeks[weeks.length - 1].items.push(item);
                else noDateItems.push(item);
              });
              const allBuckets = [...weeks.filter(w => w.items.length > 0), ...(noDateItems.length > 0 ? [{ label: 'Sin fecha', start: new Date(0), end: new Date(0), items: noDateItems }] : [])];
              return (
                <div className="flex-1 overflow-auto">
                <div className="max-w-6xl mx-auto px-6 py-4">
                  <div className="flex gap-3 overflow-x-auto pb-4">
                    {allBuckets.map((bucket, bi) => (
                      <div key={bi} className="min-w-[180px] flex-shrink-0">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2 px-1">{bucket.label}</div>
                        <div className="space-y-2">
                          {bucket.items.map(item => {
                            const dot = hm(item.healthStatus).dot;
                            return (
                              <div key={item.key} className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm hover:border-indigo-300 transition-colors cursor-pointer"
                                onClick={() => setExpandedRowKey(expandedRowKey === item.key ? null : item.key)}>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <div className={cn("w-2 h-2 rounded-full shrink-0", dot)} />
                                  <span className="text-xs font-medium text-slate-800 truncate flex-1">{item.title}</span>
                                </div>
                                {item.ownerName && (
                                  <div className="flex items-center gap-1">
                                    <div className="h-4 w-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[8px] font-bold shrink-0">
                                      {initials(item.ownerName)}
                                    </div>
                                    <span className="text-[10px] text-slate-400">{item.ownerName.split(' ')[0]}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {allBuckets.length === 0 && (
                      <p className="text-sm text-slate-400 italic">Sin ítems para mostrar</p>
                    )}
                  </div>
                </div>
                </div>
              );
            })()
          ) : (
            <>

              {/* ── Left panel: urgency items ─────────────────────────── */}
              {(alertItems.length > 0 || decisionItems.length > 0) && (
              <div className="w-[360px] shrink-0 border-r border-slate-100 overflow-y-auto bg-slate-50/40 flex flex-col">
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex-1">Para atender</span>
                <span className="text-[10px] font-bold text-slate-400">{alertItems.length + decisionItems.length}</span>
              </div>
              <div className="p-4 space-y-4 flex-1">

              {/* ── Requieren atención (hidden when empty) ──────────── */}
              {alertItems.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex-1">Requieren atención</span>
                  <span className="text-[10px] font-bold text-red-400">{alertItems.length}</span>
                  <AddItemButton variant="inline" onAdd={(title, subtitle) => createCustom.mutate({ title, subtitle })} />
                </div>
                <div className="rounded-xl border border-slate-200/60 bg-white overflow-hidden">
                  <div className="overflow-y-auto max-h-[220px]">
                  <AnimatePresence initial={false}>
                    {alertItems.map((item, idx) => {
                      const h = getItemHandlers(item);
                      const rowAccent: 'red' | 'amber' = (item.isOverdue || item.healthStatus === 'rojo') ? 'red' : 'amber';
                      return (
                        <motion.div key={item.key} id={`row-${item.key}`} layout
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
                          className="border-b border-slate-100/80 last:border-b-0">
                          <AlertSidebarCard item={item} accent={rowAccent} currentUserId={currentUserId}
                            expanded={expandedAlertKey === item.key}
                            onUpdate={h.onUpdate}
                            onToggle={() => setExpandedAlertKey(expandedAlertKey === item.key ? null : item.key)} />
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  </div>
                </div>
              </div>
              )}

              {/* ── Decisiones pendientes (hidden when empty) ─────── */}
              {decisionItems.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex-1">Decisiones pendientes</span>
                  <span className="text-[10px] font-bold text-amber-400">{decisionItems.length}</span>
                </div>
                <div className="rounded-xl border border-slate-200/60 bg-white overflow-hidden">
                  <div className="overflow-y-auto max-h-[220px]">
                  <AnimatePresence initial={false}>
                    {decisionItems.map((item, idx) => {
                      const h = getItemHandlers(item);
                      return (
                        <motion.div key={item.key} id={`row-${item.key}`} layout
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
                          className="border-b border-slate-100/80 last:border-b-0">
                          <DecisionRow item={item} users={appUsers} currentUserId={currentUserId} compact
                            isSelected={notesOpen !== null && ((notesOpen.type === 'project' && item.projectId === notesOpen.id) || (notesOpen.type === 'custom' && item.customId === notesOpen.id))}
                            onOpenNotes={h.onOpenNotes} onUpdate={h.onUpdate} onRemove={h.onRemove}
                            expanded={expandedDecisionKey === item.key}
                            onToggle={() => setExpandedDecisionKey(expandedDecisionKey === item.key ? null : item.key)}
                            hasPrev={idx > 0}
                            hasNext={idx < decisionItems.length - 1}
                            onPrev={() => { if (idx > 0) setExpandedDecisionKey(decisionItems[idx - 1].key); }}
                            onNext={() => { if (idx < decisionItems.length - 1) setExpandedDecisionKey(decisionItems[idx + 1].key); }}
                            kbFocused={kbFocusKey === item.key}
                            bulkMode={bulkMode}
                            checked={selectedKeys.has(item.key)}
                            onCheck={v => setSelectedKeys(prev => { const n = new Set(prev); v ? n.add(item.key) : n.delete(item.key); return n; })} />
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  </div>
                </div>
              </div>
              )}

              </div>
              </div>
              )}

              {/* ── Right panel: En curso ─────────────────────────────── */}
              <div className="flex-1 overflow-y-auto min-w-0">
              <div className="px-5 py-4 space-y-4">

              {/* ── En curso ───────────────────────────────────────── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-slate-700">En curso</span>
                  <span className="text-sm font-bold text-slate-400">{normalItems.length}</span>
                  {(() => { const sc = normalItems.filter(i => isStale(i.updatedAt)).length; return sc > 0 ? (
                    <span className="text-xs font-medium text-amber-500 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5">{sc} sin update</span>
                  ) : null; })()}
                  <div className="flex-1" />
                  <AddItemButton variant="inline" onAdd={(title, subtitle) => createCustom.mutate({ title, subtitle })} />
                  {expandedRowKey && (
                    <button onClick={() => setExpandedRowKey(null)} className="text-[10px] text-slate-400 hover:text-slate-600 font-medium">colapsar</button>
                  )}
                </div>
                {normalItems.length === 0 ? (
                  <div className="flex items-center gap-2 py-2.5 px-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 text-slate-400">
                    <span className="text-xs">Sin ítems en curso</span>
                  </div>
                ) : (
                  <DndContext
                    collisionDetection={closestCenter}
                    onDragStart={(event: DragStartEvent) => setDragActiveId(event.active.id as string)}
                    onDragEnd={(event: DragEndEvent) => {
                      setDragActiveId(null);
                      const { active, over } = event;
                      if (over && active.id !== over.id) {
                        setNormalOrder(() => {
                          const keys = sortedNormalItems.map(i => i.key);
                          const oldIdx = keys.indexOf(active.id as string);
                          const newIdx = keys.indexOf(over.id as string);
                          if (oldIdx < 0 || newIdx < 0) return keys;
                          return arrayMove(keys, oldIdx, newIdx);
                        });
                      }
                    }}
                  >
                    {(() => {
                      const staleItems = sortedNormalItems.filter(i => isStale(i.updatedAt));
                      const freshItems = sortedNormalItems.filter(i => !isStale(i.updatedAt));
                      const renderRow = (item: Item, isStaleGroup: boolean) => {
                        const h = getItemHandlers(item);
                        const globalIdx = sortedNormalItems.indexOf(item);
                        return (
                          <SortableCompactRow key={item.key} item={item} users={appUsers} currentUserId={currentUserId}
                            isSelected={notesOpen !== null && ((notesOpen.type === 'project' && item.projectId === notesOpen.id) || (notesOpen.type === 'custom' && item.customId === notesOpen.id))}
                            onOpenNotes={h.onOpenNotes} onUpdate={h.onUpdate} onRemove={h.onRemove}
                            expanded={expandedRowKey === item.key}
                            onToggle={() => setExpandedRowKey(expandedRowKey === item.key ? null : item.key)}
                            hasPrev={globalIdx > 0}
                            hasNext={globalIdx < sortedNormalItems.length - 1}
                            onPrev={() => { if (globalIdx > 0) setExpandedRowKey(sortedNormalItems[globalIdx - 1].key); }}
                            onNext={() => { if (globalIdx < sortedNormalItems.length - 1) setExpandedRowKey(sortedNormalItems[globalIdx + 1].key); }}
                            kbFocused={kbFocusKey === item.key}
                            bulkMode={bulkMode}
                            checked={selectedKeys.has(item.key)}
                            onCheck={v => setSelectedKeys(prev => { const n = new Set(prev); v ? n.add(item.key) : n.delete(item.key); return n; })}
                            accent={isStaleGroup ? 'amber' : 'none'}
                            hideSubtitle={!isStaleGroup} />
                        );
                      };
                      return (
                        <SortableContext items={sortedNormalItems.map(i => i.key)} strategy={verticalListSortingStrategy}>
                          <div className="rounded-xl border border-slate-200/60 bg-white overflow-hidden">
                            {staleItems.length > 0 && (
                              <>
                                <div className="flex items-center gap-2 px-5 py-1.5 border-b border-slate-100/80 bg-amber-50/40">
                                  <span className="text-[10px] font-semibold text-amber-500 tracking-wide">Sin update · {staleItems.length}</span>
                                </div>
                                {staleItems.map((item) => (
                                  <div key={item.key} className="border-b border-slate-100/80 last:border-b-0">
                                    {renderRow(item, true)}
                                  </div>
                                ))}
                              </>
                            )}
                            {staleItems.length > 0 && freshItems.length > 0 && (
                              <div className="flex items-center gap-2 px-5 py-1.5 border-b border-slate-100/80 border-t border-t-slate-100 bg-emerald-50/30">
                                <span className="text-[10px] font-semibold text-emerald-600 tracking-wide">Al día · {freshItems.length}</span>
                              </div>
                            )}
                            {freshItems.map((item) => (
                              <div key={item.key} className="border-b border-slate-100/80 last:border-b-0">
                                {renderRow(item, false)}
                              </div>
                            ))}
                          </div>
                        </SortableContext>
                      );
                    })()}
                    <DragOverlay>
                      {dragActiveId && (() => {
                        const item = sortedNormalItems.find(i => i.key === dragActiveId);
                        if (!item) return null;
                        return (
                          <div className="bg-white border border-indigo-300 shadow-lg rounded-lg px-4 py-2 opacity-90">
                            <span className="text-sm font-medium text-slate-700">{item.title}</span>
                          </div>
                        );
                      })()}
                    </DragOverlay>
                  </DndContext>
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
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Bulk Action Bar ───────────────────────────────────────── */}
      {bulkMode && selectedKeys.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-2xl shadow-2xl px-4 py-2.5 flex items-center gap-3 min-w-[340px]">
          <span className="text-sm font-semibold">{selectedKeys.size} seleccionados</span>
          <div className="w-px h-4 bg-slate-600" />
          {/* Change health for selected */}
          <div className="flex items-center gap-1">
            {Object.entries(HEALTH).map(([k, m]) => (
              <button key={k} title={`Cambiar a ${m.label}`}
                onClick={() => {
                  selectedKeys.forEach(key => {
                    const item = visible.find(i => i.key === key);
                    if (!item) return;
                    const h = getItemHandlers(item);
                    h.onUpdate({ healthStatus: k });
                  });
                }}
                className={cn("w-4 h-4 rounded-full border-2 border-white/30 hover:scale-110 transition-transform", m.dot)} />
            ))}
          </div>
          {/* Change owner for selected */}
          <select className="text-xs bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white focus:outline-none"
            defaultValue=""
            onChange={e => {
              const ownerId = e.target.value ? parseInt(e.target.value) : null;
              const ownerName = ownerId ? appUsers.find(u => u.id === ownerId)?.name ?? null : null;
              selectedKeys.forEach(key => {
                const item = visible.find(i => i.key === key);
                if (!item) return;
                const h = getItemHandlers(item);
                h.onUpdate({ ownerId, ownerName });
              });
              e.target.value = '';
            }}>
            <option value="" disabled>Asignar owner...</option>
            {appUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          {/* Hide selected */}
          <button onClick={() => {
            selectedKeys.forEach(key => {
              const item = visible.find(i => i.key === key);
              if (!item) return;
              const h = getItemHandlers(item);
              h.onUpdate({ hiddenFromWeekly: true });
            });
            setSelectedKeys(new Set());
          }} className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 transition-colors flex items-center gap-1">
            <EyeOff className="h-3 w-3" /> Ocultar
          </button>
          <button onClick={() => { setBulkMode(false); setSelectedKeys(new Set()); }}
            className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 transition-colors ml-1">
            Cancelar
          </button>
        </div>
      )}

      {/* ── Export Modal ──────────────────────────────────────────── */}
      {showExport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowExport(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="font-bold text-lg">Exportar Status Semanal</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
                  <Printer className="h-4 w-4" /> Imprimir
                </button>
                <button onClick={() => setShowExport(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="px-6 py-4 space-y-4 print:px-0">
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold text-slate-800">Status Semanal</h3>
                <p className="text-sm text-slate-500">{weekLabel()}</p>
              </div>
              {alertItems.length > 0 && (
                <div>
                  <h4 className="font-bold text-sm text-red-700 mb-2 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Requieren atención ({alertItems.length})</h4>
                  <div className="space-y-1">
                    {alertItems.map(item => (
                      <div key={item.key} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
                        <div className={cn("w-2.5 h-2.5 rounded-full mt-1 shrink-0", hm(item.healthStatus).dot)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{item.title}</span>
                            {item.subtitle && <span className="text-xs text-slate-400">· {item.subtitle}</span>}
                            {item.ownerName && <span className="text-xs text-indigo-600 font-medium">{item.ownerName.split(' ')[0]}</span>}
                            {item.deadline && <span className="text-xs text-slate-500">{deadlineLabel(item.deadline)}</span>}
                          </div>
                          {item.currentAction && <p className="text-xs text-slate-600 mt-0.5">{item.currentAction}</p>}
                          {item.nextMilestone && <p className="text-xs text-slate-500 mt-0.5">→ {item.nextMilestone}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {decisionItems.length > 0 && (
                <div>
                  <h4 className="font-bold text-sm text-amber-700 mb-2 flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /> Decisiones pendientes ({decisionItems.length})</h4>
                  <div className="space-y-1">
                    {decisionItems.map(item => (
                      <div key={item.key} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
                        <div className={cn("w-2.5 h-2.5 rounded-full mt-1 shrink-0", hm(item.healthStatus).dot)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{item.title}</span>
                            {item.ownerName && <span className="text-xs text-indigo-600 font-medium">{item.ownerName.split(' ')[0]}</span>}
                            {item.deadline && <span className="text-xs text-slate-500">{deadlineLabel(item.deadline)}</span>}
                          </div>
                          {item.currentAction && <p className="text-xs text-slate-600 mt-0.5">{item.currentAction}</p>}
                          {item.nextMilestone && <p className="text-xs text-slate-500 mt-0.5">→ {item.nextMilestone}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {normalItems.length > 0 && (
                <div>
                  <h4 className="font-bold text-sm text-emerald-700 mb-2 flex items-center gap-1.5"><Circle className="h-3.5 w-3.5 fill-current" /> En curso ({normalItems.length})</h4>
                  <div className="space-y-1">
                    {sortedNormalItems.map(item => (
                      <div key={item.key} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
                        <div className={cn("w-2.5 h-2.5 rounded-full mt-1 shrink-0", hm(item.healthStatus).dot)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{item.title}</span>
                            {item.subtitle && <span className="text-xs text-slate-400">· {item.subtitle}</span>}
                            {item.ownerName && <span className="text-xs text-indigo-600 font-medium">{item.ownerName.split(' ')[0]}</span>}
                            {item.deadline && <span className="text-xs text-slate-500">{deadlineLabel(item.deadline)}</span>}
                          </div>
                          {item.currentAction && <p className="text-xs text-slate-600 mt-0.5">{item.currentAction}</p>}
                          {item.nextMilestone && <p className="text-xs text-slate-500 mt-0.5">→ {item.nextMilestone}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Keyboard Shortcuts Help ───────────────────────────────── */}
      {showKbHelp && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowKbHelp(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-5 max-w-xs w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm">Atajos de teclado</h3>
              <button onClick={() => setShowKbHelp(false)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-1.5 text-xs">
              {[
                ['J / ↓', 'Siguiente ítem'],
                ['K / ↑', 'Ítem anterior'],
                ['E', 'Expandir / colapsar'],
                ['/', 'Enfocar búsqueda'],
                ['Esc', 'Colapsar / cerrar'],
                ['?', 'Mostrar esta ayuda'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between">
                  <kbd className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[11px] font-semibold">{key}</kbd>
                  <span className="text-slate-600">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Activity panel (notes + change log) ─────────────────── */}
      {notesOpen !== null && (
        <div className="fixed top-0 right-0 h-full w-[320px] border-l border-border bg-background shadow-xl z-20 flex flex-col">
          {(openNotesProject || openNotesCustom) && (
            <ActivityPanel
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
