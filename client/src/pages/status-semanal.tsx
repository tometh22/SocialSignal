import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, authFetch } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useMaybeReviewRoom } from "@/hooks/use-review-room";
import MemberAvatarsStack from "@/components/review/MemberAvatarsStack";
import MembersDialog from "@/components/review/MembersDialog";
import AddProjectDialog from "@/components/review/AddProjectDialog";
import RoomTitleEditor from "@/components/review/RoomTitleEditor";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  ClipboardList, MessageSquare, X, Send, Trash2, Pencil,
  AlertTriangle, Loader2, User, EyeOff, Eye,
  ChevronDown, ChevronRight, ChevronLeft, ChevronUp, Zap, CheckCircle2,
  Circle, MoreHorizontal, Plus, Tag,
  Sparkles, Brain, TrendingUp, TrendingDown,
  Shield, Target, RefreshCw, Lightbulb, ArrowRight,
  Calendar, Clock, Search, Filter, GripVertical,
  Printer, List, LayoutList, HelpCircle, CheckSquare, Square,
  PanelLeftOpen, PanelLeftClose,
  Paperclip, FileText, Link2, XCircle, Film, FileCheck2,
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
  lastNoteContent: string | null;
  lastNoteAt: string | null;
  lastNoteAuthorId: number | null;
  lastNoteAuthorName: string | null;
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
  lastNoteContent?: string | null;
  lastNoteAt?: string | null;
  lastNoteAuthorId?: number | null;
  lastNoteAuthorName?: string | null;
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
  unreadCount: number;
  isOverdue: boolean;
  updatedAt: string | null;
  updatedById: number | null;
  updatedByName: string | null;
  pendingProposalVersion?: number | null;
  lastNoteContent: string | null;
  lastNoteAt: string | null;
  lastNoteAuthorId: number | null;
  lastNoteAuthorName: string | null;
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

// Grows a textarea to fit its content, capped at maxPx; scrolls beyond that.
function useAutoResize(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
  enabled: boolean = true,
  maxPx: number = 320,
) {
  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, maxPx);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxPx ? 'auto' : 'hidden';
  }, [ref, value, enabled, maxPx]);
}

function InlineText({ value, placeholder, onSave, multiline = false, className = '', required = false }: {
  value: string | null; placeholder: string; onSave: (v: string) => void;
  multiline?: boolean; className?: string; required?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const ref = useRef<any>(null);

  useEffect(() => { setDraft(value ?? ''); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  useAutoResize(ref, draft, editing && multiline);

  const save = () => {
    setEditing(false);
    // Required fields never commit an empty value — revert to previous instead.
    if (required && !draft.trim()) { setDraft(value ?? ''); return; }
    if (draft !== (value ?? '')) onSave(draft);
  };

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
            className={cls} rows={1} />
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
        "group cursor-text rounded-md px-1.5 py-1 transition-all min-h-[26px] gap-1 w-full",
        multiline ? "flex items-start" : "inline-flex items-center",
        "hover:bg-slate-100/80",
        value ? "text-slate-800" : "text-slate-400/70 italic",
        className
      )}>
      <span className={cn("flex-1 leading-snug", multiline && "whitespace-pre-wrap break-words")}>{value || placeholder}</span>
      <Pencil className={cn("h-2.5 w-2.5 text-slate-400 opacity-0 group-hover:opacity-50 transition-opacity shrink-0", multiline && "mt-1")} />
    </span>
  );
}

// ─── Proposal types + helpers ───────────────────────────────────────────────

type ProposalAttachment = {
  id: number;
  proposalId: number;
  kind: 'file' | 'link';
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  linkUrl: string | null;
  createdAt: string;
};

type Proposal = {
  id: number;
  version: number;
  content: string;
  status: 'pending' | 'approved' | 'rejected' | 'superseded';
  submittedById: number | null;
  submittedByName: string | null;
  submittedAt: string;
  decidedById: number | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  attachments: ProposalAttachment[];
};

const PROPOSAL_STATUS: Record<Proposal['status'], { label: string; cls: string; dot: string }> = {
  pending:    { label: 'Pendiente',   cls: 'bg-violet-50 text-violet-700 border-violet-200',     dot: 'bg-violet-500' },
  approved:   { label: 'Aprobada',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  rejected:   { label: 'Rechazada',   cls: 'bg-red-50 text-red-700 border-red-200',             dot: 'bg-red-500' },
  superseded: { label: 'Reemplazada', cls: 'bg-slate-100 text-slate-500 border-slate-200',      dot: 'bg-slate-400' },
};

function formatBytes(n: number | null | undefined): string {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Proposal section ───────────────────────────────────────────────────────

function ProposalSection({ projectId, customId, currentUserId }: {
  projectId?: number; customId?: number; currentUserId?: number | null;
}) {
  const room = useMaybeReviewRoom();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const target = projectId != null ? `project/${projectId}` : `custom/${customId}`;
  const baseUrl = room ? `/api/reviews/${room.roomId}/items/${target}/proposals` : '';
  const queryKey = ['proposals', room?.roomId, target] as const;

  const { data: proposals = [] } = useQuery<Proposal[]>({
    queryKey,
    queryFn: async () => {
      if (!room) return [];
      const r = await authFetch(baseUrl);
      return r.ok ? r.json() : [];
    },
    enabled: !!room,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
    if (room) queryClient.invalidateQueries({ queryKey: ['proposals-pending', room.roomId] });
    const activityKey = projectId
      ? ['/api/status-semanal', projectId, 'activity']
      : ['/api/status-semanal/custom', customId, 'activity'];
    queryClient.invalidateQueries({ queryKey: activityKey });
  };

  const createMutation = useMutation({
    mutationFn: (content: string) => mutationFetch(baseUrl, 'POST', { content }),
    onError: (err: Error) => toast({ title: 'No se pudo crear la propuesta', description: err.message, variant: 'destructive' }),
    onSuccess: () => { invalidate(); setShowForm(false); },
  });

  if (!room) return null;

  const latest = proposals[0];
  const history = proposals.slice(1);
  const hasAnyPending = proposals.some(p => p.status === 'pending');

  return (
    <div className="border-t border-slate-100">
      <div className="px-5 py-3">
        <div className="flex items-center gap-2 mb-2">
          <FileCheck2 className="h-3.5 w-3.5 text-violet-500" />
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Propuesta a aprobar</span>
          {!hasAnyPending && (
            <button onClick={() => setShowForm(s => !s)}
              className="ml-auto flex items-center gap-1 text-[11px] font-medium text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-md px-2 py-0.5 transition-colors">
              <Plus className="h-3 w-3" />
              {proposals.length === 0 ? 'Compartir propuesta' : 'Nueva versión'}
            </button>
          )}
        </div>

        {showForm && (
          <NewProposalForm
            disabled={createMutation.isPending}
            onCancel={() => setShowForm(false)}
            onSubmit={async (content) => { await createMutation.mutateAsync(content); }}
          />
        )}

        {!showForm && proposals.length === 0 && (
          <p className="text-[11px] text-slate-400 italic">Aún no hay nada para aprobar. Cuando compartas un texto o archivo aparecerá acá.</p>
        )}

        {latest && (
          <ProposalCard
            proposal={latest}
            currentUserId={currentUserId ?? null}
            isOwner={room.isOwner}
            roomId={room.roomId}
            invalidate={invalidate}
            isLatest
          />
        )}

        {history.length > 0 && (
          <div className="mt-2">
            <button onClick={() => setShowHistory(s => !s)}
              className="flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-slate-600 transition-colors">
              {showHistory ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Historial · {history.length} {history.length === 1 ? 'versión anterior' : 'versiones anteriores'}
            </button>
            {showHistory && (
              <div className="mt-2 space-y-2">
                {history.map(p => (
                  <ProposalCard key={p.id}
                    proposal={p}
                    currentUserId={currentUserId ?? null}
                    isOwner={room.isOwner}
                    roomId={room.roomId}
                    invalidate={invalidate}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function NewProposalForm({ onCancel, onSubmit, disabled }: {
  onCancel: () => void; onSubmit: (content: string) => Promise<void>; disabled: boolean;
}) {
  const [content, setContent] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  useAutoResize(ref, content);
  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-2.5 mb-2">
      <textarea ref={ref} value={content} onChange={e => setContent(e.target.value)} autoFocus
        placeholder="Pegá el texto del posteo, descripción de la propuesta, link, etc."
        className="w-full text-[13px] leading-relaxed bg-white border border-violet-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-300/40 resize-none min-h-[64px]" />
      <p className="text-[10px] text-slate-400 mt-1">Después de crear la propuesta podrás adjuntar imágenes, video, PDF o links.</p>
      <div className="flex items-center gap-1.5 mt-1.5">
        <Button size="sm" disabled={!content.trim() || disabled}
          onClick={async () => { const t = content.trim(); if (!t) return; await onSubmit(t); setContent(''); }}
          className="h-7 px-2.5 text-[11px] bg-violet-600 hover:bg-violet-700 text-white">
          {disabled ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Crear propuesta'}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

function ProposalCard({ proposal, currentUserId, isOwner, roomId, invalidate, isLatest = false }: {
  proposal: Proposal; currentUserId: number | null; isOwner: boolean; roomId: number;
  invalidate: () => void; isLatest?: boolean;
}) {
  const meta = PROPOSAL_STATUS[proposal.status];
  const { toast } = useToast();
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [lightbox, setLightbox] = useState<{ open: boolean; index: number }>({ open: false, index: 0 });
  const isAuthor = currentUserId != null && proposal.submittedById === currentUserId;
  const canDecide = isOwner && !isAuthor && proposal.status === 'pending';
  const canEditAttachments = proposal.status === 'pending' && (isAuthor || isOwner);

  const imageAttachments = useMemo<LightboxImage[]>(
    () => proposal.attachments
      .filter(a => a.kind === 'file' && !!a.mimeType?.startsWith('image/') && !!a.fileUrl)
      .map(a => ({ id: a.id, src: a.fileUrl!, fileName: a.fileName || undefined, fileSize: a.fileSize })),
    [proposal.attachments],
  );

  const decisionMutation = useMutation({
    mutationFn: (body: { status: 'approved' | 'rejected'; reason?: string }) =>
      mutationFetch(`/api/reviews/${roomId}/proposals/${proposal.id}/decision`, 'PATCH', body),
    onError: (err: Error) => toast({ title: 'No se pudo decidir la propuesta', description: err.message, variant: 'destructive' }),
    onSuccess: () => { invalidate(); setRejecting(false); setRejectReason(''); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => mutationFetch(`/api/reviews/${roomId}/proposals/${proposal.id}`, 'DELETE'),
    onError: (err: Error) => toast({ title: 'No se pudo eliminar', description: err.message, variant: 'destructive' }),
    onSuccess: invalidate,
  });

  const linkAttachMutation = useMutation({
    mutationFn: (linkUrl: string) =>
      mutationFetch(`/api/reviews/${roomId}/proposals/${proposal.id}/attachments`, 'POST', { linkUrl }),
    onError: (err: Error) => toast({ title: 'No se pudo agregar el link', description: err.message, variant: 'destructive' }),
    onSuccess: invalidate,
  });

  const fileAttachMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const res = await authFetch(`/api/reviews/${roomId}/proposals/${proposal.id}/attachments`, { method: 'POST', body: fd });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        let msg = t;
        try { msg = JSON.parse(t)?.message || t; } catch {}
        throw new Error(msg || `Error ${res.status}`);
      }
      return res.json();
    },
    onError: (err: Error) => toast({ title: 'No se pudo adjuntar', description: err.message, variant: 'destructive' }),
    onSuccess: invalidate,
  });

  const detachMutation = useMutation({
    mutationFn: (attachmentId: number) =>
      mutationFetch(`/api/reviews/${roomId}/proposals/${proposal.id}/attachments/${attachmentId}`, 'DELETE'),
    onError: (err: Error) => toast({ title: 'No se pudo eliminar el adjunto', description: err.message, variant: 'destructive' }),
    onSuccess: invalidate,
  });

  return (
    <div className={cn(
      "rounded-lg border bg-white",
      isLatest && proposal.status === 'pending' ? "border-violet-300 shadow-sm" : "border-slate-200",
    )}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
        <span className="text-[11px] font-semibold text-slate-700">v{proposal.version}</span>
        <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border", meta.cls)}>
          <span className={cn("w-1.5 h-1.5 rounded-full", meta.dot)} />
          {meta.label}
        </span>
        <span className="text-[10px] text-slate-400 truncate">
          {proposal.submittedByName || 'Usuario'} · {relTime(proposal.submittedAt)}
        </span>
        {isAuthor && proposal.status === 'pending' && (
          <button onClick={() => deleteMutation.mutate()}
            className="ml-auto p-0.5 text-slate-300 hover:text-red-500 transition-colors" title="Eliminar propuesta">
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="px-3 py-2.5">
        <p className="text-[13px] leading-relaxed text-slate-700 whitespace-pre-wrap break-words">{proposal.content}</p>
      </div>

      {proposal.attachments.length > 0 && (
        <div className="px-3 pb-2.5 grid grid-cols-2 md:grid-cols-3 gap-2">
          {proposal.attachments.map(a => {
            const isImage = a.kind === 'file' && !!a.mimeType?.startsWith('image/') && !!a.fileUrl;
            const galleryIndex = isImage
              ? proposal.attachments.filter(x => x.kind === 'file' && x.mimeType?.startsWith('image/') && x.fileUrl).findIndex(x => x.id === a.id)
              : -1;
            return (
              <AttachmentTile key={a.id} a={a}
                onRemove={canEditAttachments ? () => detachMutation.mutate(a.id) : undefined}
                onOpenImage={isImage ? () => setLightbox({ open: true, index: galleryIndex }) : undefined} />
            );
          })}
        </div>
      )}

      <ImageLightbox
        images={imageAttachments}
        initialIndex={lightbox.index}
        open={lightbox.open}
        onOpenChange={(open) => setLightbox(s => ({ ...s, open }))}
        onUploadReply={canEditAttachments ? (f) => fileAttachMutation.mutate(f) : undefined}
        replyUploading={fileAttachMutation.isPending}
      />

      {canEditAttachments && (
        <AttachmentBar
          onPickFile={(f) => fileAttachMutation.mutate(f)}
          onAddLink={(u) => linkAttachMutation.mutate(u)}
          uploading={fileAttachMutation.isPending}
        />
      )}

      {(proposal.decidedById || proposal.decisionReason) && proposal.status !== 'pending' && (
        <div className={cn(
          "px-3 py-2 border-t text-[11px]",
          proposal.status === 'approved' ? "border-emerald-100 bg-emerald-50/40 text-emerald-700"
          : proposal.status === 'rejected' ? "border-red-100 bg-red-50/40 text-red-700"
          : "border-slate-100 bg-slate-50 text-slate-500",
        )}>
          <div className="flex items-center gap-1.5">
            {proposal.status === 'approved' ? <CheckCircle2 className="h-3 w-3" />
              : proposal.status === 'rejected' ? <XCircle className="h-3 w-3" />
              : <Circle className="h-3 w-3" />}
            <span className="font-medium">
              {proposal.status === 'approved' ? 'Aprobada' : proposal.status === 'rejected' ? 'Rechazada' : 'Reemplazada'}
              {proposal.decidedByName ? ` por ${proposal.decidedByName}` : ''}
              {proposal.decidedAt ? ` · ${relTime(proposal.decidedAt)}` : ''}
            </span>
          </div>
          {proposal.decisionReason && (
            <p className="mt-1 text-[11px] whitespace-pre-wrap break-words">{proposal.decisionReason}</p>
          )}
        </div>
      )}

      {canDecide && (
        <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/40">
          {!rejecting ? (
            <div className="flex gap-1.5">
              <Button size="sm"
                onClick={() => decisionMutation.mutate({ status: 'approved' })}
                disabled={decisionMutation.isPending}
                className="h-7 px-2.5 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Aprobar
              </Button>
              <Button size="sm" variant="outline"
                onClick={() => setRejecting(true)}
                disabled={decisionMutation.isPending}
                className="h-7 px-2.5 text-[11px] border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center gap-1">
                <XCircle className="h-3 w-3" /> Rechazar
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} autoFocus rows={2}
                placeholder="Motivo del rechazo (qué cambiar para v+1)"
                className="w-full text-[12px] bg-white border border-red-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-300/40 resize-none" />
              <div className="flex gap-1.5">
                <Button size="sm"
                  disabled={!rejectReason.trim() || decisionMutation.isPending}
                  onClick={() => decisionMutation.mutate({ status: 'rejected', reason: rejectReason.trim() })}
                  className="h-7 px-2.5 text-[11px] bg-red-600 hover:bg-red-700 text-white">
                  Confirmar rechazo
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]"
                  onClick={() => { setRejecting(false); setRejectReason(''); }}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
          {isAuthor && (
            <p className="text-[10px] text-slate-400 mt-1.5">No podés aprobar tu propia propuesta — esperá a un owner del room.</p>
          )}
        </div>
      )}
      {proposal.status === 'pending' && !canDecide && isAuthor && (
        <div className="px-3 py-2 border-t border-slate-100 text-[10px] text-slate-400">
          Esperando aprobación del owner del room.
        </div>
      )}
    </div>
  );
}

type LightboxImage = { id: number | string; src: string; fileName?: string; fileSize?: number | null };

function ImageLightbox({ images, initialIndex, open, onOpenChange, onUploadReply, replyUploading }: {
  images: LightboxImage[];
  initialIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadReply?: (file: File) => void;
  replyUploading?: boolean;
}) {
  const [index, setIndex] = useState(initialIndex);
  const replyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) setIndex(initialIndex); }, [open, initialIndex]);

  const total = images.length;
  const safeIndex = total === 0 ? 0 : Math.min(Math.max(index, 0), total - 1);
  const current = images[safeIndex];

  const go = useCallback((delta: number) => {
    if (total <= 1) return;
    setIndex(i => (i + delta + total) % total);
  }, [total]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, go]);

  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[96vw] sm:max-w-[96vw] w-[96vw] h-[92vh] max-h-[92vh] p-0 bg-black/95 border-0 overflow-hidden flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center gap-2 px-3 py-2 text-white/90 text-[12px] bg-black/40">
          <div className="min-w-0 flex-1 truncate">
            <span className="font-medium">{current.fileName || 'Imagen'}</span>
            {current.fileSize ? <span className="text-white/50 ml-1.5">· {formatBytes(current.fileSize)}</span> : null}
          </div>
          {total > 1 && (
            <span className="shrink-0 tabular-nums text-white/70">{safeIndex + 1} / {total}</span>
          )}
          <a href={current.src} target="_blank" rel="noreferrer"
            className="shrink-0 px-2 py-0.5 rounded-md text-[11px] text-white/80 hover:text-white hover:bg-white/10 transition-colors">
            Abrir original
          </a>
          {onUploadReply && (
            <>
              <input ref={replyInputRef} type="file" hidden accept="image/*"
                onChange={e => { const f = e.target.files?.[0]; if (f) { onUploadReply(f); e.target.value = ''; } }} />
              <Button size="sm" variant="ghost" disabled={replyUploading}
                onClick={() => replyInputRef.current?.click()}
                className="h-6 px-2 text-[11px] gap-1 text-white/85 hover:text-white hover:bg-white/10">
                {replyUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
                Responder con imagen
              </Button>
            </>
          )}
          <button onClick={() => onOpenChange(false)} aria-label="Cerrar"
            className="shrink-0 p-1 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative flex-1 min-h-0 flex items-center justify-center">
          <img src={current.src} alt={current.fileName || 'Imagen'}
            className="block max-w-full max-h-full w-auto h-auto object-contain select-none" />
          {total > 1 && (
            <>
              <button onClick={() => go(-1)} aria-label="Anterior"
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white/80 hover:bg-black/70 hover:text-white transition-colors">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button onClick={() => go(1)} aria-label="Siguiente"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white/80 hover:bg-black/70 hover:text-white transition-colors">
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
        {total > 1 && (
          <div className="px-3 py-2 bg-black/40 flex items-center gap-1.5 overflow-x-auto">
            {images.map((img, i) => (
              <button key={img.id} onClick={() => setIndex(i)} title={img.fileName}
                className={cn(
                  "shrink-0 w-12 h-12 rounded-md overflow-hidden border-2 transition-all",
                  i === safeIndex ? "border-white" : "border-transparent opacity-60 hover:opacity-100",
                )}>
                <img src={img.src} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Server-driven unread tracking. The Item carries unreadCount from the API
// (notes after this user's last_seen_at, excluding own). markAsRead posts to
// /seen and optimistically zeros the count until the refetch lands.
function useUnreadComments(item: Item, roomId: number | undefined) {
  const queryClient = useQueryClient();
  const [markedRead, setMarkedRead] = useState(false);

  // If a fresh comment came in (server count went up), drop the optimistic flag
  // so the new unread shows up.
  useEffect(() => { setMarkedRead(false); }, [item.unreadCount]);

  const hasUnread = item.unreadCount > 0 && !markedRead;
  const unreadCount = markedRead ? 0 : item.unreadCount;

  const markAsRead = useCallback(() => {
    if (!roomId || item.unreadCount === 0) return;
    const kind = item.isCustom ? 'custom' : 'project';
    const targetId = item.isCustom ? item.customId : item.projectId;
    if (!targetId) return;
    setMarkedRead(true);
    mutationFetch(`/api/reviews/${roomId}/items/${kind}/${targetId}/seen`, 'POST')
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/status-semanal?includeHidden=true'] });
        queryClient.invalidateQueries({ queryKey: ['/api/status-semanal/custom?includeHidden=true'] });
        queryClient.invalidateQueries({ queryKey: ['reviews'] });
      })
      .catch(() => { setMarkedRead(false); });
  }, [roomId, item.isCustom, item.customId, item.projectId, item.unreadCount, queryClient]);

  return { hasUnread, unreadCount, markAsRead };
}

function AttachmentTile({ a, onRemove, onOpenImage }: { a: ProposalAttachment; onRemove?: () => void; onOpenImage?: () => void }) {
  const isImage = a.kind === 'file' && a.mimeType?.startsWith('image/');
  const isVideo = a.kind === 'file' && a.mimeType?.startsWith('video/');
  const fileLabel = a.fileName || (a.fileUrl ?? '').split('/').pop() || 'Archivo';
  const linkLabel = a.fileName || a.linkUrl || 'Enlace';
  const [imgError, setImgError] = useState(false);

  return (
    <div className="relative group rounded-md border border-slate-200 bg-slate-50/40 overflow-hidden">
      {onRemove && (
        <button onClick={onRemove}
          className="absolute top-1 right-1 z-10 p-0.5 rounded-full bg-white/90 text-slate-500 hover:text-red-600 hover:bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
          <X className="h-3 w-3" />
        </button>
      )}
      {isImage && a.fileUrl && (
        <button type="button" onClick={() => onOpenImage?.()} className="block w-full text-left cursor-zoom-in">
          {imgError ? (
            <div className="w-full h-28 flex flex-col items-center justify-center gap-1 bg-slate-100 text-slate-400">
              <FileText className="h-5 w-5" />
              <span className="text-[10px]">No se pudo cargar la miniatura</span>
            </div>
          ) : (
            <img src={a.fileUrl} alt={fileLabel} loading="lazy" onError={() => setImgError(true)}
              className="w-full h-28 object-cover bg-slate-100" />
          )}
          <div className="px-2 py-1 text-[10px] text-slate-500 truncate">{fileLabel} · {formatBytes(a.fileSize)}</div>
        </button>
      )}
      {isVideo && a.fileUrl && (
        <div>
          <video src={a.fileUrl} controls className="w-full h-28 object-cover bg-black" />
          <div className="px-2 py-1 text-[10px] text-slate-500 truncate flex items-center gap-1">
            <Film className="h-3 w-3" />{fileLabel} · {formatBytes(a.fileSize)}
          </div>
        </div>
      )}
      {a.kind === 'file' && !isImage && !isVideo && a.fileUrl && (
        <a href={a.fileUrl} target="_blank" rel="noreferrer"
          className="flex items-center gap-2 px-2 py-2.5 text-[11px] text-slate-600 hover:text-violet-700">
          <FileText className="h-4 w-4 text-slate-400 shrink-0" />
          <div className="min-w-0">
            <div className="truncate font-medium">{fileLabel}</div>
            <div className="text-[10px] text-slate-400">{formatBytes(a.fileSize)}</div>
          </div>
        </a>
      )}
      {a.kind === 'link' && a.linkUrl && (
        <a href={a.linkUrl} target="_blank" rel="noreferrer"
          className="flex items-center gap-2 px-2 py-2.5 text-[11px] text-violet-700 hover:text-violet-900">
          <Link2 className="h-4 w-4 shrink-0" />
          <span className="truncate underline-offset-2 hover:underline">{linkLabel}</span>
        </a>
      )}
    </div>
  );
}

function AttachmentBar({ onPickFile, onAddLink, uploading }: {
  onPickFile: (f: File) => void; onAddLink: (url: string) => void; uploading: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState('');
  return (
    <div className="px-3 pb-2 flex items-center gap-1.5">
      <input ref={fileRef} type="file" hidden
        accept="image/*,application/pdf,video/mp4,video/quicktime,video/webm"
        onChange={e => { const f = e.target.files?.[0]; if (f) { onPickFile(f); e.target.value = ''; } }} />
      <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}
        className="h-6 px-2 text-[10px] gap-1">
        {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
        Adjuntar
      </Button>
      {!linkOpen ? (
        <Button size="sm" variant="ghost" onClick={() => setLinkOpen(true)} className="h-6 px-2 text-[10px] gap-1 text-slate-500">
          <Link2 className="h-3 w-3" /> Link
        </Button>
      ) : (
        <div className="flex items-center gap-1.5 flex-1">
          <input value={link} onChange={e => setLink(e.target.value)} autoFocus
            placeholder="https://..."
            className="flex-1 text-[11px] border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-300/40" />
          <Button size="sm" disabled={!/^https?:\/\//i.test(link.trim())}
            onClick={() => { onAddLink(link.trim()); setLink(''); setLinkOpen(false); }}
            className="h-6 px-2 text-[10px] bg-violet-600 hover:bg-violet-700 text-white">Agregar</Button>
          <button onClick={() => { setLink(''); setLinkOpen(false); }} className="text-slate-400 hover:text-slate-600">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Types for activity thread ──────────────────────────────────────────────

type UpdateEntry = { id: number; content: string; authorId: number | null; authorName: string | null; createdAt: string };

// (UpdateTimeline + InlineChat removed — superseded by ItemThread)

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

// ─── Compact row (Verde) ──────────────────────────────────────────────────────

function CompactRow({ item, users, isSelected, onOpenNotes, onUpdate, onRemove, onResolve, expanded, onToggle, onNext, onPrev, hasNext, hasPrev, currentUserId, roomId, kbFocused, dragHandleProps, bulkMode, checked, onCheck, accent, hideSubtitle }: {
  item: Item; users: AppUser[]; isSelected: boolean; currentUserId?: number | null; roomId?: number;
  onOpenNotes?: () => void; onUpdate: (d: Record<string, any>) => void; onRemove: () => void; onResolve: () => void;
  expanded: boolean; onToggle: () => void; onNext?: () => void; onPrev?: () => void; hasNext?: boolean; hasPrev?: boolean;
  kbFocused?: boolean; dragHandleProps?: Record<string, any>; bulkMode?: boolean; checked?: boolean; onCheck?: (v: boolean) => void;
  accent?: 'red' | 'amber' | 'none'; hideSubtitle?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const decMeta = dm(item.decisionNeeded);
  const { hasUnread, markAsRead } = useUnreadComments(item, roomId);
  useEffect(() => { if (expanded && hasUnread) markAsRead(); }, [expanded, hasUnread, markAsRead]);
  const handleOpenNotes = onOpenNotes ? () => { markAsRead(); onOpenNotes(); } : undefined;

  const accentBorder = accent === 'red' ? 'border-l-red-500' : accent === 'amber' ? 'border-l-amber-400' : 'border-l-transparent';
  const unreadBorder = hasUnread && accent !== 'red' && accent !== 'amber';

  return (
    <div className={cn(
      "border-l-[3px] transition-colors duration-100 group",
      unreadBorder ? "border-l-indigo-500" : accentBorder,
      isSelected
        ? "bg-indigo-50/40"
        : hasUnread
          ? "bg-indigo-50/40 hover:bg-indigo-50/70"
          : "hover:bg-slate-50/60",
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
            {item.subtitle && <span className="text-slate-400 text-[12px] truncate hidden md:block min-w-0" title={item.subtitle}>{item.subtitle}</span>}
            {item.pendingProposalVersion != null && (
              <span className="shrink-0 self-center inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border bg-violet-50 text-violet-700 border-violet-200" title="Hay una propuesta pendiente de aprobación">
                <FileCheck2 className="h-2.5 w-2.5" />
                Propuesta v{item.pendingProposalVersion}
              </span>
            )}
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
          {!expanded && hasUnread && item.lastNoteContent && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); handleOpenNotes?.(); }}
              className="mt-1.5 flex items-center gap-1.5 w-full text-left rounded-md px-2 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors"
              title="Ver comentarios"
            >
              <MessageSquare className="h-3 w-3 text-indigo-600 shrink-0" />
              <span className="text-[11px] font-semibold text-indigo-700 shrink-0">
                {item.lastNoteAuthorName?.split(' ')[0] ?? 'Comentario'}:
              </span>
              <span className="text-[12px] text-indigo-900/80 italic truncate flex-1 min-w-0">
                {item.lastNoteContent}
              </span>
              {item.lastNoteAt && (
                <span className="text-[10px] text-indigo-400 shrink-0">{relTime(item.lastNoteAt)}</span>
              )}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2" onClick={e => e.stopPropagation()}>
          {/* Always-visible controls — accessible on touch devices */}
          {decMeta.urgent && (
            <DecisionBadge value={item.decisionNeeded} onChange={v => onUpdate({ decisionNeeded: v })} />
          )}
          <OwnerSelect value={item.ownerId} name={item.ownerName} onChange={v => onUpdate({ ownerId: v })} users={users} />
          <DeadlinePicker value={item.deadline} isOverdue={item.isOverdue} onChange={v => onUpdate({ deadline: v })} />
          {handleOpenNotes && item.noteCount > 0 && (
            <button onClick={handleOpenNotes}
              className={cn(
                "relative flex items-center gap-1 rounded-md transition-colors",
                hasUnread
                  ? "px-2 py-1 bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm font-medium"
                  : "px-1.5 py-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              )}
              title={hasUnread ? "Comentarios sin leer" : "Ver historial de comentarios"}>
              <MessageSquare className={cn(hasUnread ? "h-3.5 w-3.5" : "h-3 w-3")} />
              <span className={cn("font-medium", hasUnread ? "text-[11px]" : "text-[10px]")}>
                {hasUnread ? `Nuevo · ${item.noteCount}` : item.noteCount}
              </span>
              {hasUnread && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white animate-pulse" />}
            </button>
          )}
          <TooltipProvider><Tooltip><TooltipTrigger asChild>
            <button onClick={onResolve}
              className="p-1 rounded text-emerald-300 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
              <CheckCircle2 className="h-4 w-4" />
            </button>
          </TooltipTrigger><TooltipContent className="text-xs">Resolver y quitar</TooltipContent></Tooltip></TooltipProvider>
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <button className="p-1 rounded hover:bg-slate-100 text-slate-300 hover:text-slate-500 transition-colors opacity-0 group-hover:opacity-100">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-1" align="end">
              <button onClick={() => { onResolve(); setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-emerald-50 text-slate-600 hover:text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Resolver tema
              </button>
              <button onClick={() => { onRemove(); setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-red-50 text-slate-600 hover:text-red-600">
                <Trash2 className="h-3.5 w-3.5" />
                {item.isCustom ? "Eliminar ítem" : "Quitar del status"}
              </button>
            </PopoverContent>
          </Popover>
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

                {/* Comentario al equipo — composer + última actividad */}
                <div className="px-4 py-3 border-t border-slate-100 bg-indigo-50/20">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="h-3 w-3 text-indigo-500" />
                    <span className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wide">Comentario al equipo</span>
                    {handleOpenNotes && (
                      <button onClick={handleOpenNotes}
                        className="ml-auto flex items-center gap-1 text-[10px] font-medium text-indigo-500 hover:text-indigo-700 transition-colors">
                        Ver historial{item.noteCount > 0 && ` · ${item.noteCount}`}
                        <ArrowRight className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                  <ItemThread
                    projectId={item.projectId}
                    customId={item.customId}
                    currentUserId={currentUserId}
                    users={users}
                    onOpenFull={handleOpenNotes}
                    compact
                  />
                </div>

                {/* Custom: editable title + subtitle */}
                {item.isCustom && (
                  <div className="flex items-center gap-3 px-5 py-2 border-t border-slate-100 bg-slate-50/30">
                    <Tag className="h-3 w-3 text-slate-300 shrink-0" />
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <InlineText value={item.title} placeholder="Título" onSave={v => onUpdate({ title: v })} required className="text-[12px] font-medium text-slate-600 truncate" />
                      {item.subtitle !== null && item.subtitle !== undefined && (
                        <><span className="text-slate-200 shrink-0">·</span>
                        <InlineText value={item.subtitle} placeholder="Descripción opcional..." onSave={v => onUpdate({ subtitle: v })} className="text-[12px] text-slate-400 truncate flex-1" /></>
                      )}
                    </div>
                  </div>
                )}

                {/* Propuesta a aprobar (texto + adjuntos, versionado) */}
                <ProposalSection projectId={item.projectId} customId={item.customId} currentUserId={currentUserId} />

                {/* Footer: decision + secondary indicators + nav */}
                <div className="flex items-center gap-1.5 px-5 py-2.5 border-t border-slate-100 bg-slate-50/60 flex-wrap">
                  <DecisionBadge value={item.decisionNeeded} onChange={v => onUpdate({ decisionNeeded: v })} />
                  {item.mainRisk && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 border border-slate-200 rounded-md px-1.5 py-0.5">
                      <Shield className="h-2.5 w-2.5" /><span className="truncate max-w-[120px]">{item.mainRisk}</span>
                    </div>
                  )}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="text-[10px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 px-1.5 py-0.5 rounded transition-colors flex items-center gap-1">
                        <MoreHorizontal className="h-3 w-3" />
                        <span>Indicadores</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-3 space-y-2.5" align="start">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Indicadores secundarios</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Rentabilidad</span>
                        <LevelBadge value={item.marginStatus} onChange={v => onUpdate({ marginStatus: v })} label="Rentabilidad" type="margin" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Carga equipo</span>
                        <LevelBadge value={item.teamStrain} onChange={v => onUpdate({ teamStrain: v })} label="Carga equipo" type="team" />
                      </div>
                      <div className="pt-1.5 border-t border-slate-100">
                        <p className="text-[10px] text-slate-400 mb-1">Riesgo principal</p>
                        <InlineText value={item.mainRisk} placeholder="Describir riesgo..." onSave={v => onUpdate({ mainRisk: v })} className="text-[11px]" />
                      </div>
                    </PopoverContent>
                  </Popover>
                  <div className="flex-1" />
                  <button onClick={onResolve}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-2.5 py-1 transition-colors">
                    <CheckCircle2 className="h-3 w-3" />
                    Resolver tema
                  </button>
                  {(hasPrev || hasNext) && (
                    <div className="flex items-center gap-0.5 ml-1">
                      <button onClick={onPrev} disabled={!hasPrev} className={cn("p-0.5 rounded", hasPrev ? "text-slate-400 hover:bg-slate-100" : "text-slate-200")}><ChevronLeft className="h-3 w-3" /></button>
                      <button onClick={onNext} disabled={!hasNext} className={cn("p-0.5 rounded", hasNext ? "text-slate-400 hover:bg-slate-100" : "text-slate-200")}><ChevronRight className="h-3 w-3" /></button>
                    </div>
                  )}
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
      queryClient.refetchQueries({ queryKey: ['/api/status-semanal?includeHidden=true'] });
      if (customId) queryClient.refetchQueries({ queryKey: ['/api/status-semanal/custom?includeHidden=true'] });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const addUpdateMutation = useMutation({
    mutationFn: (content: string) => mutationFetch(updatesUrl, 'POST', { content }),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: updatesCacheKey });
      queryClient.refetchQueries({ queryKey: ['/api/status-semanal?includeHidden=true'] });
      if (customId) queryClient.refetchQueries({ queryKey: ['/api/status-semanal/custom?includeHidden=true'] });
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
    addNoteMutation.mutate(t);
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
          <p className="text-[11px] text-slate-400 italic py-0.5">{compact ? 'Sin actividad aún' : 'Sin actividad — dejá un comentario'}</p>
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
        <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-3 py-2 shadow-sm focus-within:border-indigo-300 focus-within:shadow-indigo-50 transition-all">
          <MentionInput
            value={draft}
            onChange={setDraft}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder="Escribir comentario..."
            className="flex-1 text-sm bg-transparent focus:outline-none min-w-0"
            users={users}
          />
          <button onClick={submit}
            disabled={!draft.trim() || addNoteMutation.isPending}
            className={cn("shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all",
              draft.trim()
                ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                : "bg-slate-100 text-slate-300")}>
            {addNoteMutation.isPending
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

// ─── AlertSidebarCard — expandable card for CEO/COO sidebar ─────────────────
function AlertSidebarCard({ item, accent, currentUserId, roomId, onUpdate, expanded, onToggle, users, onOpenNotes, onRemove, onResolve }: {
  item: Item; accent: 'red' | 'amber'; currentUserId?: number | null; roomId?: number;
  onUpdate: (d: Record<string, any>) => void;
  expanded?: boolean; onToggle?: () => void; onResolve?: () => void;
  users?: AppUser[]; onOpenNotes?: () => void; onRemove?: () => void;
}) {
  const accentBorder = accent === 'red' ? 'border-l-red-500' : 'border-l-amber-400';
  const accentBg = accent === 'red' ? 'bg-red-50/40' : 'bg-amber-50/40';
  const { hasUnread, markAsRead } = useUnreadComments(item, roomId);
  useEffect(() => { if (expanded && hasUnread) markAsRead(); }, [expanded, hasUnread, markAsRead]);
  const handleOpenNotes = onOpenNotes ? () => { markAsRead(); onOpenNotes(); } : undefined;
  return (
    <div className={cn(
      "border-l-[3px] transition-colors",
      accentBorder,
      expanded ? accentBg : hasUnread ? "bg-indigo-50/30 hover:bg-indigo-50/60" : "hover:bg-slate-50/60"
    )}>
      {/* Clickable header */}
      <div className={cn("px-3 py-2.5 cursor-pointer")} onClick={onToggle}>
        <div className="flex items-start gap-2">
          <div className="shrink-0 mt-0.5" onClick={e => e.stopPropagation()}>
            <HealthDot value={item.healthStatus} onChange={v => onUpdate({ healthStatus: v })} compact />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {item.isCustom && <Tag className="h-3 w-3 text-indigo-400 shrink-0" />}
              <p className="font-semibold text-[13px] leading-snug text-slate-900 break-words flex-1">{item.title}</p>
              {onResolve && (
                <button onClick={e => { e.stopPropagation(); onResolve(); }}
                  className="p-0.5 rounded text-emerald-300 hover:text-emerald-600 hover:bg-emerald-50 transition-colors shrink-0"
                  title="Resolver">
                  <CheckCircle2 className="h-4 w-4" />
                </button>
              )}
              <ChevronDown className={cn("h-3 w-3 text-slate-300 shrink-0 transition-transform", !expanded && "-rotate-90")} />
            </div>
            {!expanded && item.currentAction && (
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
              {item.noteCount > 0 && (
                <span className={cn(
                  "relative inline-flex items-center gap-1 font-medium rounded",
                  hasUnread
                    ? "text-white bg-indigo-600 px-1.5 py-0.5 text-[10px] shadow-sm"
                    : "text-slate-400 px-1 py-0.5 text-[10px]"
                )}>
                  <MessageSquare className="h-3 w-3" />
                  {hasUnread ? `Nuevo · ${item.noteCount}` : item.noteCount}
                  {hasUnread && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white animate-pulse" />}
                </span>
              )}
            </div>
            {!expanded && hasUnread && item.lastNoteContent && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); handleOpenNotes?.(); }}
                className="mt-1.5 flex items-center gap-1.5 w-full text-left rounded-md px-2 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                title="Ver comentarios"
              >
                <MessageSquare className="h-3 w-3 text-indigo-600 shrink-0" />
                <span className="text-[10px] font-semibold text-indigo-700 shrink-0">
                  {item.lastNoteAuthorName?.split(' ')[0] ?? 'Comentario'}:
                </span>
                <span className="text-[11px] text-indigo-900/80 italic truncate flex-1 min-w-0">
                  {item.lastNoteContent}
                </span>
                {item.lastNoteAt && (
                  <span className="text-[10px] text-indigo-400 shrink-0">{relTime(item.lastNoteAt)}</span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded detail panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden">
            <div className="px-3 pb-3 space-y-2" onClick={e => e.stopPropagation()}>
              {/* Risk (only the most important secondary signal — overdue is already
                   communicated by the red border + header deadline in red) */}
              {item.mainRisk && (
                <div className="flex items-start gap-1.5 rounded-md px-2 py-1.5 bg-slate-50 border border-slate-100">
                  <Shield className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide mb-0.5">Riesgo</p>
                    <InlineText value={item.mainRisk} placeholder="Riesgo principal" onSave={v => onUpdate({ mainRisk: v })} className="text-[11px]" />
                  </div>
                </div>
              )}

              {/* Current action */}
              <div className="rounded-md px-2.5 py-2 bg-white border border-slate-100">
                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide mb-0.5">Estado actual</p>
                <InlineText value={item.currentAction} placeholder="¿Qué está pasando?" onSave={v => onUpdate({ currentAction: v })} multiline className="text-[11px]" />
              </div>

              {/* Next step */}
              <div className="rounded-md px-2.5 py-2 bg-white border border-slate-100">
                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide mb-0.5">Próximo paso</p>
                <InlineText value={item.nextMilestone} placeholder="Acción concreta" onSave={v => onUpdate({ nextMilestone: v })} multiline className="text-[11px]" />
              </div>

              {/* Inline comment composer + last activity */}
              <div className="rounded-md px-2.5 py-2 bg-indigo-50/30 border border-indigo-100/70">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <MessageSquare className="h-2.5 w-2.5 text-indigo-500" />
                  <span className="text-[9px] font-bold text-indigo-700 uppercase tracking-wide">Comentario al equipo</span>
                  {handleOpenNotes && item.noteCount > 0 && (
                    <button onClick={handleOpenNotes}
                      className="ml-auto flex items-center gap-0.5 text-[9px] font-medium text-indigo-500 hover:text-indigo-700 transition-colors">
                      Ver historial · {item.noteCount}
                      <ArrowRight className="h-2 w-2" />
                    </button>
                  )}
                </div>
                <ItemThread
                  projectId={item.projectId}
                  customId={item.customId}
                  currentUserId={currentUserId}
                  users={users}
                  onOpenFull={handleOpenNotes}
                  compact
                />
              </div>

              {/* Proposal + attachments (images, videos, files, links) */}
              <div className="rounded-md bg-white border border-slate-100 overflow-hidden">
                <ProposalSection projectId={item.projectId} customId={item.customId} currentUserId={currentUserId} />
              </div>

              {/* Actions footer */}
              <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-100 flex-wrap">
                {users && <OwnerSelect value={item.ownerId} name={item.ownerName} onChange={v => onUpdate({ ownerId: v })} users={users} />}
                <DeadlinePicker value={item.deadline} isOverdue={item.isOverdue} onChange={v => onUpdate({ deadline: v })} />
                <DecisionBadge value={item.decisionNeeded} onChange={v => onUpdate({ decisionNeeded: v })} />
                <div className="flex-1" />
                {onResolve && (
                  <button onClick={onResolve}
                    className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md px-2 py-0.5 transition-colors">
                    <CheckCircle2 className="h-3 w-3" />
                    Resolver
                  </button>
                )}
                {handleOpenNotes && (
                  <button onClick={handleOpenNotes}
                    className={cn(
                      "relative flex items-center gap-1 text-[10px] font-medium transition-colors",
                      hasUnread
                        ? "text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md px-2 py-0.5"
                        : "text-indigo-500 hover:text-indigo-700"
                    )}>
                    <MessageSquare className="h-3 w-3" />
                    {item.noteCount > 0 && item.noteCount}
                    {hasUnread && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-red-500 ring-1 ring-white" />}
                  </button>
                )}
                {onRemove && (
                  <button onClick={onRemove}
                    className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title={item.isCustom ? "Eliminar" : "Quitar"}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── DecisionSidebarCard — expandable card for decisions sidebar ─────────────
function DecisionSidebarCard({ item, currentUserId, roomId, expanded, onToggle, users, onUpdate, onOpenNotes, onRemove, onResolve }: {
  item: Item; currentUserId?: number | null; roomId?: number;
  expanded?: boolean; onToggle?: () => void;
  users?: AppUser[]; onUpdate?: (d: Record<string, any>) => void;
  onOpenNotes?: () => void; onRemove?: () => void; onResolve?: () => void;
}) {
  const decMeta = dm(item.decisionNeeded);
  const daysSince = item.updatedAt
    ? Math.floor((Date.now() - new Date(item.updatedAt).getTime()) / 86400000)
    : null;
  const { hasUnread, markAsRead } = useUnreadComments(item, roomId);
  useEffect(() => { if (expanded && hasUnread) markAsRead(); }, [expanded, hasUnread, markAsRead]);
  const handleOpenNotes = onOpenNotes ? () => { markAsRead(); onOpenNotes(); } : undefined;
  return (
    <div className={cn(
      "border-l-[3px] border-l-amber-400 transition-colors",
      expanded ? "bg-amber-50/30" : hasUnread ? "bg-indigo-50/30 hover:bg-indigo-50/60" : "hover:bg-amber-50/20"
    )}>
      {/* Clickable header */}
      <div className="px-3 py-2.5 cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-1.5">
          <p className="font-semibold text-[13px] leading-snug text-slate-900 break-words flex-1">{item.title}</p>
          {onResolve && (
            <button onClick={e => { e.stopPropagation(); onResolve(); }}
              className="p-0.5 rounded text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 transition-colors shrink-0"
              title="Resolver">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown className={cn("h-3 w-3 text-slate-300 shrink-0 transition-transform", !expanded && "-rotate-90")} />
        </div>
        {!expanded && item.currentAction && (
          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-2">{item.currentAction}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 leading-none">{decMeta.label}</span>
          {daysSince !== null && daysSince > 1 && (
            <span className="text-[10px] text-slate-400">{daysSince}d sin resolución</span>
          )}
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
          {item.noteCount > 0 && (
            <span className={cn(
              "relative inline-flex items-center gap-1 font-medium rounded",
              hasUnread
                ? "text-white bg-indigo-600 px-1.5 py-0.5 text-[10px] shadow-sm"
                : "text-slate-400 px-1 py-0.5 text-[10px]"
            )}>
              <MessageSquare className="h-3 w-3" />
              {hasUnread ? `Nuevo · ${item.noteCount}` : item.noteCount}
              {hasUnread && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white animate-pulse" />}
            </span>
          )}
        </div>
        {!expanded && hasUnread && item.lastNoteContent && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); handleOpenNotes?.(); }}
            className="mt-1.5 flex items-center gap-1.5 w-full text-left rounded-md px-2 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors"
            title="Ver comentarios"
          >
            <MessageSquare className="h-3 w-3 text-indigo-600 shrink-0" />
            <span className="text-[10px] font-semibold text-indigo-700 shrink-0">
              {item.lastNoteAuthorName?.split(' ')[0] ?? 'Comentario'}:
            </span>
            <span className="text-[11px] text-indigo-900/80 italic truncate flex-1 min-w-0">
              {item.lastNoteContent}
            </span>
            {item.lastNoteAt && (
              <span className="text-[10px] text-indigo-400 shrink-0">{relTime(item.lastNoteAt)}</span>
            )}
          </button>
        )}
      </div>

      {/* Expanded detail panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden">
            <div className="px-3 pb-3 space-y-2" onClick={e => e.stopPropagation()}>
              {/* Decision alert */}
              <div className={cn("flex items-center gap-1.5 rounded-md px-2 py-1.5 border text-[11px] font-semibold", decMeta.color)}>
                <Zap className="h-3 w-3 shrink-0" />
                Decisión requerida:
                {onUpdate && <DecisionBadge value={item.decisionNeeded} onChange={v => onUpdate({ decisionNeeded: v })} />}
              </div>

              {/* Current action */}
              <div className="rounded-md px-2.5 py-2 bg-white border border-slate-100">
                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide mb-0.5">Estado actual</p>
                {onUpdate ? (
                  <InlineText value={item.currentAction} placeholder="¿Qué está pasando?" onSave={v => onUpdate({ currentAction: v })} multiline className="text-[11px]" />
                ) : (
                  <p className="text-[11px] text-slate-600">{item.currentAction || 'Sin update'}</p>
                )}
              </div>

              {/* Next step */}
              <div className="rounded-md px-2.5 py-2 bg-white border border-slate-100">
                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide mb-0.5">Próximo paso</p>
                {onUpdate ? (
                  <InlineText value={item.nextMilestone} placeholder="Acción concreta" onSave={v => onUpdate({ nextMilestone: v })} multiline className="text-[11px]" />
                ) : (
                  <p className="text-[11px] text-slate-600">{item.nextMilestone || 'Sin definir'}</p>
                )}
              </div>

              {/* Inline comment composer + last activity */}
              <div className="rounded-md px-2.5 py-2 bg-indigo-50/30 border border-indigo-100/70">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <MessageSquare className="h-2.5 w-2.5 text-indigo-500" />
                  <span className="text-[9px] font-bold text-indigo-700 uppercase tracking-wide">Comentario al equipo</span>
                  {handleOpenNotes && item.noteCount > 0 && (
                    <button onClick={handleOpenNotes}
                      className="ml-auto flex items-center gap-0.5 text-[9px] font-medium text-indigo-500 hover:text-indigo-700 transition-colors">
                      Ver historial · {item.noteCount}
                      <ArrowRight className="h-2 w-2" />
                    </button>
                  )}
                </div>
                <ItemThread
                  projectId={item.projectId}
                  customId={item.customId}
                  currentUserId={currentUserId}
                  users={users}
                  onOpenFull={handleOpenNotes}
                  compact
                />
              </div>

              {/* Proposal + attachments (images, videos, files, links) */}
              <div className="rounded-md bg-white border border-slate-100 overflow-hidden">
                <ProposalSection projectId={item.projectId} customId={item.customId} currentUserId={currentUserId} />
              </div>

              {/* Actions footer */}
              <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-100 flex-wrap">
                {onUpdate && users && <OwnerSelect value={item.ownerId} name={item.ownerName} onChange={v => onUpdate({ ownerId: v })} users={users} />}
                {onUpdate && <DeadlinePicker value={item.deadline} isOverdue={item.isOverdue} onChange={v => onUpdate({ deadline: v })} />}
                {onUpdate && <HealthDot value={item.healthStatus} onChange={v => onUpdate({ healthStatus: v })} />}
                <div className="flex-1" />
                {onResolve && (
                  <button onClick={onResolve}
                    className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md px-2 py-0.5 transition-colors">
                    <CheckCircle2 className="h-3 w-3" />
                    Resolver
                  </button>
                )}
                {handleOpenNotes && (
                  <button onClick={handleOpenNotes}
                    className={cn(
                      "relative flex items-center gap-1 text-[10px] font-medium transition-colors",
                      hasUnread
                        ? "text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md px-2 py-0.5"
                        : "text-indigo-500 hover:text-indigo-700"
                    )}>
                    <MessageSquare className="h-3 w-3" />
                    {item.noteCount > 0 && item.noteCount}
                    {hasUnread && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-red-500 ring-1 ring-white" />}
                  </button>
                )}
                {onRemove && (
                  <button onClick={onRemove}
                    className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title={item.isCustom ? "Eliminar" : "Quitar"}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
  proposal: 'Propuesta',
};

function formatChangeValue(fieldName: string, value: string | null): string {
  if (value == null) return '(vacío)';
  if (fieldName === 'deadline') {
    try { return new Date(value).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }); } catch { return value; }
  }
  if (fieldName === 'proposal') {
    const m = value.match(/^(submitted|approved|rejected)_v(\d+)$/);
    if (m) {
      const labels: Record<string, string> = { submitted: 'enviada', approved: 'aprobada', rejected: 'rechazada' };
      return `v${m[2]} ${labels[m[1]]}`;
    }
    return value;
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
  const newNoteRef = useRef<HTMLTextAreaElement>(null);
  const editNoteRef = useRef<HTMLTextAreaElement>(null);
  useAutoResize(newNoteRef, newNote);
  useAutoResize(editNoteRef, editText, editingId !== null);
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
      queryClient.refetchQueries({ queryKey: ['/api/status-semanal?includeHidden=true'] });
      if (customItemId) queryClient.refetchQueries({ queryKey: ['/api/status-semanal/custom?includeHidden=true'] });
    },
    onError: (err: Error) => toast({ title: 'Error al guardar comentario', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (noteId: number) => mutationFetch(`/api/status-semanal/notes/${noteId}`, 'DELETE'),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: activityCacheKey });
      queryClient.refetchQueries({ queryKey: notesCacheKey });
      queryClient.refetchQueries({ queryKey: ['/api/status-semanal?includeHidden=true'] });
      if (customItemId) queryClient.refetchQueries({ queryKey: ['/api/status-semanal/custom?includeHidden=true'] });
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
                        ref={editNoteRef}
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        autoFocus
                        rows={1}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (editText.trim()) editMutation.mutate({ noteId: entry.id, content: editText });
                          } else if (e.key === 'Escape') {
                            setEditingId(null);
                          }
                        }}
                        className="resize-none text-[11px] min-h-[32px] bg-white px-2.5 py-1.5 leading-relaxed"
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
          <Textarea ref={newNoteRef} value={newNote} onChange={e => setNewNote(e.target.value)}
            rows={1}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const t = newNote.trim(); if (t) { setNewNote(''); addMutation.mutate(t); } } }}
            placeholder="Escribí un comentario..." className="resize-none text-[11px] min-h-[32px] flex-1 bg-white px-2.5 py-1.5 leading-relaxed" />
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
  const roomCtx = useMaybeReviewRoom();
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [addProjectDialogOpen, setAddProjectDialogOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState<{ type: 'project' | 'custom'; id: number } | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [aiSummary, setAiSummary] = useState<AISummary | null>(() => {
    try { const s = localStorage.getItem('status-semanal-ai-summary'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  // Unified expanded state — one item expanded at a time across all sections
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
          setExpandedKey(null);
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

  // Poll + refetch on focus so that changes made by another member of the same
  // review room (e.g. archiving a project) appear without a manual reload.
  const { data: projectRows = [], isLoading: loadingProjects } = useQuery<StatusRow[]>({
    queryKey: ['/api/status-semanal?includeHidden=true'],
    staleTime: 0,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const { data: customRows = [], isLoading: loadingCustom } = useQuery<CustomItem[]>({
    queryKey: ['/api/status-semanal/custom?includeHidden=true'],
    staleTime: 0,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const { data: rawUsers } = useQuery<AppUser[]>({
    queryKey: ['/api/status-semanal/users'],
    staleTime: 60000,
  });
  const appUsers: AppUser[] = Array.isArray(rawUsers) ? rawUsers : [];

  type PendingProposalRow = { projectId: number | null; weeklyStatusItemId: number | null; version: number; proposalId: number; submittedAt: string };
  const { data: pendingProposals = [] } = useQuery<PendingProposalRow[]>({
    queryKey: ['proposals-pending', roomCtx?.roomId],
    queryFn: async () => {
      if (!roomCtx) return [];
      const r = await authFetch(`/api/reviews/${roomCtx.roomId}/proposals/pending`);
      return r.ok ? r.json() : [];
    },
    enabled: !!roomCtx,
    refetchInterval: 30_000,
  });
  const pendingByItem = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pendingProposals) {
      const key = p.projectId != null ? `p_${p.projectId}` : `c_${p.weeklyStatusItemId}`;
      m.set(key, p.version);
    }
    return m;
  }, [pendingProposals]);

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const patchProject = useMutation({
    mutationFn: ({ projectId, data }: { projectId: number; data: Record<string, any> }) =>
      mutationFetch(`/api/status-semanal/${projectId}`, 'PATCH', data),
    onMutate: async ({ projectId, data }) => {
      await queryClient.cancelQueries({ queryKey: ['/api/status-semanal?includeHidden=true'] });
      const previous = queryClient.getQueryData<StatusRow[]>(['/api/status-semanal?includeHidden=true']);
      queryClient.setQueryData<StatusRow[]>(['/api/status-semanal?includeHidden=true'], prev =>
        prev ? prev.map(r => r.projectId === projectId ? { ...r, ...data } : r) : prev
      );
      return { previous };
    },
    onError: (err: Error, _vars, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(['/api/status-semanal?includeHidden=true'], ctx.previous);
      toast({ title: 'Error al guardar', description: err.message, variant: 'destructive' });
    },
    onSettled: () => {
      queryClient.refetchQueries({ queryKey: ['/api/status-semanal?includeHidden=true'], exact: true });
    },
  });

  const removeProject = useMutation({
    mutationFn: (projectId: number) =>
      mutationFetch(`/api/status-semanal/${projectId}`, 'DELETE'),
    onMutate: async (projectId) => {
      await queryClient.cancelQueries({ queryKey: ['/api/status-semanal?includeHidden=true'] });
      const previous = queryClient.getQueryData<StatusRow[]>(['/api/status-semanal?includeHidden=true']);
      queryClient.setQueryData<StatusRow[]>(['/api/status-semanal?includeHidden=true'], prev =>
        prev ? prev.map(r => r.projectId === projectId ? { ...r, hiddenFromWeekly: true } : r) : prev
      );
      return { previous };
    },
    onError: (err: Error, _vars, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(['/api/status-semanal?includeHidden=true'], ctx.previous);
      toast({ title: 'Error al quitar proyecto', description: err.message, variant: 'destructive' });
    },
    onSettled: () => {
      queryClient.refetchQueries({ queryKey: ['/api/status-semanal?includeHidden=true'], exact: true });
    },
  });

  const createCustom = useMutation({
    mutationFn: ({ title, subtitle }: { title: string; subtitle: string }) =>
      mutationFetch('/api/status-semanal/custom', 'POST', { title, subtitle: subtitle || null }),
    onError: (err: Error) => toast({ title: 'Error al crear ítem', description: err.message, variant: 'destructive' }),
    onSettled: () => {
      queryClient.refetchQueries({ queryKey: ['/api/status-semanal/custom?includeHidden=true'], exact: true });
    },
  });

  const patchCustom = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, any> }) =>
      mutationFetch(`/api/status-semanal/custom/${id}`, 'PATCH', data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['/api/status-semanal/custom?includeHidden=true'] });
      const previous = queryClient.getQueryData<CustomItem[]>(['/api/status-semanal/custom?includeHidden=true']);
      queryClient.setQueryData<CustomItem[]>(['/api/status-semanal/custom?includeHidden=true'], prev =>
        prev ? prev.map(c => c.id === id ? { ...c, ...data } : c) : prev
      );
      return { previous };
    },
    onError: (err: Error, _vars, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(['/api/status-semanal/custom?includeHidden=true'], ctx.previous);
      toast({ title: 'Error al guardar', description: err.message, variant: 'destructive' });
    },
    onSettled: () => {
      queryClient.refetchQueries({ queryKey: ['/api/status-semanal/custom?includeHidden=true'], exact: true });
    },
  });

  const deleteCustom = useMutation({
    mutationFn: (id: number) =>
      mutationFetch(`/api/status-semanal/custom/${id}`, 'DELETE'),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['/api/status-semanal/custom?includeHidden=true'] });
      const previous = queryClient.getQueryData<CustomItem[]>(['/api/status-semanal/custom?includeHidden=true']);
      queryClient.setQueryData<CustomItem[]>(['/api/status-semanal/custom?includeHidden=true'], prev =>
        prev ? prev.filter(c => c.id !== id) : prev
      );
      return { previous };
    },
    onError: (err: Error, _vars, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(['/api/status-semanal/custom?includeHidden=true'], ctx.previous);
      toast({ title: 'Error al eliminar', description: err.message, variant: 'destructive' });
    },
    onSettled: () => {
      queryClient.refetchQueries({ queryKey: ['/api/status-semanal/custom?includeHidden=true'], exact: true });
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
    unreadCount: (r as any).unreadCount ?? 0,
    isOverdue: isOverdue(r.deadline),
    updatedAt: r.reviewUpdatedAt,
    updatedById: r.reviewUpdatedBy,
    updatedByName: r.reviewUpdatedByName,
    lastNoteContent: r.lastNoteContent ?? null,
    lastNoteAt: r.lastNoteAt ?? null,
    lastNoteAuthorId: r.lastNoteAuthorId ?? null,
    lastNoteAuthorName: r.lastNoteAuthorName ?? null,
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
    unreadCount: (c as any).unreadCount ?? 0,
    isOverdue: isOverdue(c.deadline),
    updatedAt: c.updatedAt,
    updatedById: c.updatedBy,
    updatedByName: c.updatedByName,
    lastNoteContent: c.lastNoteContent ?? null,
    lastNoteAt: c.lastNoteAt ?? null,
    lastNoteAuthorId: c.lastNoteAuthorId ?? null,
    lastNoteAuthorName: c.lastNoteAuthorName ?? null,
  });

  const allItems = useMemo<Item[]>(() => [
    ...projectRows.map(toItem),
    ...customRows.map(toCustomItem),
  ].map(it => ({ ...it, pendingProposalVersion: pendingByItem.get(it.key) ?? null })),
  [projectRows, customRows, pendingByItem]);

  const hiddenCount = useMemo(() => allItems.filter(i => i.hiddenFromWeekly).length, [allItems]);

  const visible = useMemo(() => allItems.filter(i => {
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
  }), [allItems, showHidden, searchQuery, filterHealth, filterOwner]);

  const { alertItems, decisionItems, normalItems, alertKeys, decisionKeys, flatNavItems } = useMemo(() => {
    const rojoItems     = visible.filter(i => i.healthStatus === 'rojo');
    const amarilloItems = visible.filter(i => i.healthStatus === 'amarillo' && !i.isOverdue);
    const overdueItems  = visible.filter(i => i.isOverdue && i.healthStatus !== 'rojo');
    const alertItems    = [...rojoItems, ...overdueItems, ...amarilloItems];
    const alertKeys     = new Set(alertItems.map(i => i.key));
    const decisionItems = visible.filter(i => dm(i.decisionNeeded).urgent && !alertKeys.has(i.key));
    const decisionKeys  = new Set(decisionItems.map(i => i.key));
    const normalItems   = visible.filter(i => !alertKeys.has(i.key) && !decisionKeys.has(i.key));
    const flatNavItems  = [...alertItems, ...decisionItems, ...normalItems];
    return { alertItems, decisionItems, normalItems, alertKeys, decisionKeys, flatNavItems };
  }, [visible]);

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
        setExpandedKey(expandedKey === kbFocusKey ? null : kbFocusKey);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [kbFocusKey, flatNavItems, expandedKey]);

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
    onResolve: () => {
      if (item.isCustom && item.customId) {
        updateCustom(item.customId, { hiddenFromWeekly: true });
      } else if (item.projectId) {
        updateProject(item.projectId, { hiddenFromWeekly: true });
      }
      toast({ title: 'Tema resuelto', description: `"${item.title}" se quitó del review.` });
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
        <div className="relative overflow-hidden border-b border-border shrink-0">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
          <div className="relative px-6 py-2.5">
            <div className="flex items-center justify-between gap-4">
              {/* Left: title (room-aware) */}
              <div className="flex items-center gap-2.5 shrink-0">
                {roomCtx ? (
                  <>
                    <a href="/review" className="p-1 rounded-full hover:bg-white/20 text-white/70 hover:text-white transition-colors shrink-0" title="Volver a Status">
                      <ChevronLeft className="h-4 w-4" />
                    </a>
                    <div className="h-8 w-8 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/20 text-sm">
                      {roomCtx.room?.emoji || roomCtx.room?.name?.charAt(0) || 'S'}
                    </div>
                    <div>
                      <RoomTitleEditor
                        roomId={roomCtx.roomId}
                        name={roomCtx.room?.name || 'Status'}
                        privacy={roomCtx.room?.privacy || 'members'}
                        myRole={roomCtx.myRole}
                      />
                      <p className="text-[9px] text-indigo-200 font-medium">{weekLabel()}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="h-8 w-8 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/20">
                      <ClipboardList className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h1 className="text-base font-bold leading-tight text-white tracking-tight">Status</h1>
                      <p className="text-[9px] text-indigo-200 font-medium">{weekLabel()}</p>
                    </div>
                  </>
                )}
              </div>

              {/* Sidebar toggle (visible when sidebar has items) */}
              {(alertItems.length > 0 || decisionItems.length > 0) && viewMode === 'list' && (
                <button
                  onClick={() => setSidebarOpen(v => !v)}
                  title={sidebarOpen ? "Ocultar panel lateral" : "Mostrar panel lateral"}
                  className={cn("p-1.5 rounded-full border transition-colors backdrop-blur-sm shrink-0",
                    sidebarOpen ? "bg-white/25 text-white border-white/30" : "bg-white/10 text-indigo-200 border-white/15 hover:bg-white/20 hover:text-white")}>
                  {sidebarOpen ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeftOpen className="h-3.5 w-3.5" />}
                </button>
              )}

              {/* Center: search */}
              <div className="relative flex-1 max-w-md max-md:hidden">
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

              {/* Right: actions */}
              <div className="flex items-center gap-1 shrink-0">
                {roomCtx?.room?.members && roomCtx.room.members.length > 0 && (
                  <MemberAvatarsStack
                    members={roomCtx.room.members}
                    max={4}
                    onClick={() => setMembersDialogOpen(true)}
                    showPlus={roomCtx.isOwner}
                    className="mr-1.5"
                  />
                )}
                {roomCtx?.isOwner && (
                  <button onClick={() => setAddProjectDialogOpen(true)}
                    className="text-[11px] font-medium text-indigo-200 hover:text-white bg-white/10 hover:bg-white/20 border border-white/15 rounded-lg px-2 py-1 transition-colors mr-1 max-md:hidden">
                    + Proyecto
                  </button>
                )}
                <span className="text-[11px] text-indigo-200 font-medium mr-1 max-md:hidden">{visible.length} ítems</span>
                {/* Filter */}
                <button onClick={() => setShowFilters(v => !v)}
                  title="Filtros"
                  className={cn("p-1.5 rounded-full border transition-colors backdrop-blur-sm",
                    showFilters || filterHealth || filterOwner !== null
                      ? "bg-white/25 text-white border-white/30"
                      : "bg-white/10 text-indigo-200 border-white/15 hover:bg-white/20 hover:text-white")}>
                  <Filter className="h-3 w-3" />
                </button>
                {/* Hidden toggle */}
                {hiddenCount > 0 && (
                  <button onClick={() => setShowHidden(v => !v)}
                    title={showHidden ? `Ocultar ${hiddenCount} ocultos` : `Mostrar ${hiddenCount} ocultos`}
                    className={cn("p-1.5 rounded-full border transition-colors backdrop-blur-sm",
                      showHidden ? "bg-white/25 text-white border-white/30" : "bg-white/10 text-indigo-200 border-white/15 hover:bg-white/20 hover:text-white")}>
                    {showHidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  </button>
                )}
                {/* More actions menu */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button title="Más acciones"
                      className="p-1.5 rounded-full border transition-colors backdrop-blur-sm bg-white/10 text-indigo-200 border-white/15 hover:bg-white/20 hover:text-white">
                      <MoreHorizontal className="h-3 w-3" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-1" align="end">
                    <button onClick={() => setViewMode(v => v === 'list' ? 'timeline' : 'list')}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-slate-700 hover:bg-slate-100">
                      {viewMode === 'list' ? <LayoutList className="h-3.5 w-3.5 text-slate-400" /> : <List className="h-3.5 w-3.5 text-slate-400" />}
                      {viewMode === 'list' ? 'Ver timeline' : 'Ver lista'}
                    </button>
                    <button onClick={() => setShowExport(true)}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-slate-700 hover:bg-slate-100">
                      <Printer className="h-3.5 w-3.5 text-slate-400" /> Exportar semana
                    </button>
                    <button onClick={() => { setBulkMode(v => !v); setSelectedKeys(new Set()); }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-slate-700 hover:bg-slate-100">
                      <CheckSquare className="h-3.5 w-3.5 text-slate-400" /> {bulkMode ? 'Salir de selección' : 'Selección masiva'}
                    </button>
                    <button onClick={() => setShowKbHelp(v => !v)}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-slate-700 hover:bg-slate-100">
                      <HelpCircle className="h-3.5 w-3.5 text-slate-400" /> Atajos de teclado
                    </button>
                  </PopoverContent>
                </Popover>
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
                  : <>Vas a quitar <strong>{confirmDelete.title}</strong> del review. Podés restaurarlo después.</>}
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
                                onClick={() => setExpandedKey(expandedKey === item.key ? null : item.key)}>
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

              {/* ── Mobile backdrop for sidebar overlay ─────────────── */}
              {sidebarOpen && (alertItems.length > 0 || decisionItems.length > 0) && (
                <div className="hidden max-md:block fixed inset-0 z-20 bg-black/40 backdrop-blur-[2px]"
                  onClick={() => setSidebarOpen(false)} />
              )}

              {/* ── Left panel: urgency items ─────────────────────────── */}
              {(alertItems.length > 0 || decisionItems.length > 0) && (
              <div className={cn(
                "shrink-0 border-r border-slate-200 overflow-y-auto bg-slate-50/40 flex flex-col transition-all duration-200",
                sidebarOpen ? "w-[420px] max-lg:w-[340px] max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-30 max-md:w-[85vw] max-md:max-w-[420px] max-md:shadow-2xl max-md:border-r-0" : "w-0 overflow-hidden"
              )}>
              <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2 shrink-0 bg-white/60">
                <AlertTriangle className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs font-bold text-slate-600 flex-1">Para atender</span>
                <span className="text-xs font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{alertItems.length + decisionItems.length}</span>
              </div>
              <div className="p-3 space-y-3 flex-1 overflow-y-auto">

              {/* ── Requieren atención (hidden when empty) ──────────── */}
              {alertItems.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2 px-1">
                  <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest flex-1">Requieren atención</span>
                  <span className="text-[10px] font-bold text-red-400 bg-red-50 rounded-full px-1.5 py-0.5">{alertItems.length}</span>
                  <AddItemButton variant="inline" onAdd={(title, subtitle) => createCustom.mutate({ title, subtitle })} />
                </div>
                <div className="rounded-xl border border-slate-200/60 bg-white overflow-hidden">
                  <AnimatePresence initial={false}>
                    {alertItems.map((item) => {
                      const h = getItemHandlers(item);
                      const rowAccent: 'red' | 'amber' = (item.isOverdue || item.healthStatus === 'rojo') ? 'red' : 'amber';
                      return (
                        <motion.div key={item.key} id={`row-${item.key}`} layout
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
                          className="border-b border-slate-100/80 last:border-b-0">
                          <AlertSidebarCard item={item} accent={rowAccent} currentUserId={currentUserId} roomId={roomCtx?.roomId}
                            onUpdate={h.onUpdate}
                            expanded={expandedKey === item.key}
                            onToggle={() => setExpandedKey(expandedKey === item.key ? null : item.key)}
                            users={appUsers}
                            onOpenNotes={h.onOpenNotes}
                            onRemove={h.onRemove}
                            onResolve={h.onResolve} />
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
                <div className="flex items-center gap-1.5 mb-2 px-1">
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest flex-1">Decisiones pendientes</span>
                  <span className="text-[10px] font-bold text-amber-500 bg-amber-50 rounded-full px-1.5 py-0.5">{decisionItems.length}</span>
                </div>
                <div className="rounded-xl border border-slate-200/60 bg-white overflow-hidden">
                  <AnimatePresence initial={false}>
                    {decisionItems.map((item) => {
                      const h = getItemHandlers(item);
                      return (
                        <motion.div key={item.key} id={`row-${item.key}`} layout
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
                          className="border-b border-slate-100/80 last:border-b-0">
                          <DecisionSidebarCard item={item} currentUserId={currentUserId} roomId={roomCtx?.roomId}
                            expanded={expandedKey === item.key}
                            onToggle={() => setExpandedKey(expandedKey === item.key ? null : item.key)}
                            users={appUsers}
                            onUpdate={h.onUpdate}
                            onOpenNotes={h.onOpenNotes}
                            onRemove={h.onRemove}
                            onResolve={h.onResolve} />
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
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
                  {expandedKey && (
                    <button onClick={() => setExpandedKey(null)} className="text-[10px] text-slate-400 hover:text-slate-600 font-medium">colapsar</button>
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
                          <SortableCompactRow key={item.key} item={item} users={appUsers} currentUserId={currentUserId} roomId={roomCtx?.roomId}
                            isSelected={notesOpen !== null && ((notesOpen.type === 'project' && item.projectId === notesOpen.id) || (notesOpen.type === 'custom' && item.customId === notesOpen.id))}
                            onOpenNotes={h.onOpenNotes} onUpdate={h.onUpdate} onRemove={h.onRemove} onResolve={h.onResolve}
                            expanded={expandedKey === item.key}
                            onToggle={() => setExpandedKey(expandedKey === item.key ? null : item.key)}
                            hasPrev={globalIdx > 0}
                            hasNext={globalIdx < sortedNormalItems.length - 1}
                            onPrev={() => { if (globalIdx > 0) setExpandedKey(sortedNormalItems[globalIdx - 1].key); }}
                            onNext={() => { if (globalIdx < sortedNormalItems.length - 1) setExpandedKey(sortedNormalItems[globalIdx + 1].key); }}
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
              <h2 className="font-bold text-lg">Exportar Review Semanal</h2>
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
                <h3 className="text-xl font-bold text-slate-800">Review Semanal</h3>
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

      {/* ── Room dialogs (only when inside a review room) ──────── */}
      {roomCtx && (
        <>
          {roomCtx.room && <MembersDialog open={membersDialogOpen} onClose={() => setMembersDialogOpen(false)} room={roomCtx.room} myRole={roomCtx.myRole} />}
          <AddProjectDialog open={addProjectDialogOpen} onClose={() => setAddProjectDialogOpen(false)} roomId={roomCtx.roomId} />
        </>
      )}
    </div>
  );
}
