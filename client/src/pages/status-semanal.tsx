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
  AlertTriangle, Loader2, User, Eye, EyeOff,
  MoreHorizontal, CheckCircle2, Calendar
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

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

type Note = {
  id: number;
  projectId: number;
  content: string;
  noteDate: string;
  authorId: number | null;
  authorName: string | null;
  createdAt: string;
};

type AppUser = { id: number; name: string; email: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const HEALTH = {
  verde: { label: 'Verde', dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200', bar: 'bg-emerald-500', section: 'text-emerald-700', sectionBg: 'bg-emerald-50 border-emerald-200' },
  amarillo: { label: 'Amarillo', dot: 'bg-amber-400', pill: 'bg-amber-50 text-amber-700 ring-amber-200', bar: 'bg-amber-400', section: 'text-amber-700', sectionBg: 'bg-amber-50 border-amber-200' },
  rojo: { label: 'Rojo', dot: 'bg-red-500', pill: 'bg-red-50 text-red-700 ring-red-200', bar: 'bg-red-500', section: 'text-red-700', sectionBg: 'bg-red-50 border-red-200' },
} as Record<string, { label: string; dot: string; pill: string; bar: string; section: string; sectionBg: string }>;

const LEVEL: Record<string, { label: string; color: string }> = {
  alto: { label: 'Alto', color: 'text-red-600 bg-red-50 border-red-200' },
  medio: { label: 'Medio', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  bajo: { label: 'Bajo', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
};

const DECISION: Record<string, { label: string; color: string }> = {
  ninguna: { label: 'Ninguna', color: 'text-slate-400 bg-slate-50 border-slate-200' },
  priorizacion: { label: 'Priorización', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  recursos: { label: 'Recursos', color: 'text-purple-600 bg-purple-50 border-purple-200' },
  reprecio: { label: 'Re-precio', color: 'text-orange-600 bg-orange-50 border-orange-200' },
  salida: { label: 'Salida', color: 'text-red-600 bg-red-50 border-red-200' },
};

function h(v: string | null) { return HEALTH[v ?? 'verde'] ?? HEALTH.verde; }
function lv(v: string | null) { return LEVEL[v ?? 'medio'] ?? LEVEL.medio; }
function dec(v: string | null) { return DECISION[v ?? 'ninguna'] ?? DECISION.ninguna; }

function currentWeekLabel() {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const fmt = (d: Date) => d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  return `Semana ${fmt(monday)} – ${fmt(friday)}`;
}

function relativeTime(dateStr: string) {
  const d = new Date(dateStr);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'Ahora';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `hace ${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

function initials(name: string | null) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// ─── Inline text editor ───────────────────────────────────────────────────────

function InlineText({ value, placeholder, onSave, multiline = false }: {
  value: string | null; placeholder: string; onSave: (v: string) => void; multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(value ?? ''); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const save = () => {
    setEditing(false);
    if (draft !== (value ?? '')) onSave(draft);
  };

  if (editing) {
    const base = "w-full text-xs border border-indigo-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white resize-none";
    return multiline
      ? <textarea ref={ref as any} value={draft} onChange={e => setDraft(e.target.value)}
          onBlur={save} onKeyDown={e => e.key === 'Escape' && (setDraft(value ?? ''), setEditing(false))}
          className={base} rows={2} />
      : <input ref={ref as any} value={draft} onChange={e => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={e => { if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false); } if (e.key === 'Enter') { e.preventDefault(); save(); } }}
          className={base} />;
  }

  return (
    <div onClick={() => setEditing(true)}
      className={cn("text-xs cursor-text rounded px-1.5 py-1 min-h-[22px] hover:bg-slate-100 transition-colors leading-snug",
        value ? "text-slate-700" : "text-slate-400 italic")}
      title="Click para editar">
      {value || placeholder}
    </div>
  );
}

// ─── Small picker components ──────────────────────────────────────────────────

function HealthPicker({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const meta = h(value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={cn("flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 transition-all hover:opacity-80", meta.pill, meta.pill.includes('ring') ? '' : 'ring-transparent')}>
          <div className={cn("w-2 h-2 rounded-full shrink-0", meta.dot)} />
          {meta.label}
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

function LevelPicker({ value, onChange, label }: { value: string | null; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const meta = lv(value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button><Badge variant="outline" className={cn("text-[10px] h-5 cursor-pointer hover:opacity-80 border font-semibold", meta.color)}>{meta.label}</Badge></button>
      </PopoverTrigger>
      <PopoverContent className="w-32 p-1.5" align="start">
        <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1 px-1">{label}</p>
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

function DecisionPicker({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const meta = dec(value);
  const urgent = value && value !== 'ninguna';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button><Badge variant="outline" className={cn("text-[10px] h-5 cursor-pointer hover:opacity-80 border font-semibold truncate max-w-[80px]", meta.color, urgent && "ring-1 ring-offset-1")}>{meta.label}</Badge></button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1.5" align="start">
        <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1 px-1">Decisión CEO</p>
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

// ─── Project Card ─────────────────────────────────────────────────────────────

function ProjectCard({
  row, appUsers, isSelected, onOpenNotes, onUpdate,
}: {
  row: StatusRow;
  appUsers: AppUser[];
  isSelected: boolean;
  onOpenNotes: () => void;
  onUpdate: (data: Record<string, any>) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const meta = h(row.healthStatus);
  const decMeta = dec(row.decisionNeeded);
  const isUrgentDecision = row.decisionNeeded && row.decisionNeeded !== 'ninguna';

  return (
    <div className={cn(
      "relative rounded-xl border bg-white shadow-sm transition-all duration-150 overflow-hidden flex",
      isSelected ? "ring-2 ring-indigo-400 shadow-md" : "hover:shadow-md hover:border-slate-300",
      isUrgentDecision && !isSelected && "border-amber-300"
    )}>
      {/* Left color bar */}
      <div className={cn("w-1.5 shrink-0", meta.bar)} />

      {/* Card content */}
      <div className="flex-1 min-w-0 p-3.5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="font-bold text-sm text-foreground leading-tight truncate">{row.clientName || '—'}</p>
            {row.quotationName && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{row.quotationName}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <HealthPicker value={row.healthStatus} onChange={v => onUpdate({ healthStatus: v })} />
            {/* Menu */}
            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger asChild>
                <button className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="end">
                <button
                  onClick={() => { onUpdate({ hiddenFromWeekly: !row.hiddenFromWeekly }); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-slate-100 text-slate-600"
                >
                  {row.hiddenFromWeekly ? (
                    <><Eye className="h-3.5 w-3.5 text-indigo-500" /> Mostrar en vista</>
                  ) : (
                    <><EyeOff className="h-3.5 w-3.5" /> Ocultar de esta vista</>
                  )}
                </button>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-slate-400 uppercase font-semibold tracking-wide">Margen</span>
            <LevelPicker value={row.marginStatus} onChange={v => onUpdate({ marginStatus: v })} label="Margen" />
          </div>
          <span className="text-slate-200">·</span>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-slate-400 uppercase font-semibold tracking-wide">Equipo</span>
            <LevelPicker value={row.teamStrain} onChange={v => onUpdate({ teamStrain: v })} label="Desgaste equipo" />
          </div>
          {isUrgentDecision && (
            <>
              <span className="text-slate-200">·</span>
              <DecisionPicker value={row.decisionNeeded} onChange={v => onUpdate({ decisionNeeded: v })} />
            </>
          )}
        </div>

        {/* Risk & Action */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-3">
          <div>
            <p className="text-[9px] text-slate-400 uppercase font-semibold tracking-wide mb-0.5">Riesgo</p>
            <InlineText value={row.mainRisk} placeholder="¿Cuál es el riesgo?" onSave={v => onUpdate({ mainRisk: v })} multiline />
          </div>
          <div>
            <p className="text-[9px] text-slate-400 uppercase font-semibold tracking-wide mb-0.5">Acción</p>
            <InlineText value={row.currentAction} placeholder="Acción en curso..." onSave={v => onUpdate({ currentAction: v })} multiline />
          </div>
        </div>

        {/* Próximo hito */}
        <div className="mb-3">
          <p className="text-[9px] text-slate-400 uppercase font-semibold tracking-wide mb-0.5">Próximo hito</p>
          <InlineText value={row.nextMilestone} placeholder="Próximo hito..." onSave={v => onUpdate({ nextMilestone: v })} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
          {/* Owner select */}
          <Select
            value={row.ownerId?.toString() ?? '__none__'}
            onValueChange={v => onUpdate({ ownerId: v === '__none__' ? null : parseInt(v) })}
          >
            <SelectTrigger className="h-7 border-0 bg-transparent hover:bg-slate-100 px-1.5 gap-1.5 focus:ring-0 max-w-[140px] rounded-md transition-all">
              <div className="flex items-center gap-1.5 min-w-0">
                {row.ownerName ? (
                  <>
                    <div className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[9px] font-bold shrink-0">
                      {initials(row.ownerName)}
                    </div>
                    <span className="text-xs font-medium truncate">{row.ownerName.split(' ')[0]}</span>
                  </>
                ) : (
                  <>
                    <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <User className="h-3 w-3 text-slate-400" />
                    </div>
                    <span className="text-xs text-slate-400">Sin owner</span>
                  </>
                )}
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sin owner</SelectItem>
              {appUsers.map(u => (
                <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            {/* Decision (if none selected, show subtle picker) */}
            {!isUrgentDecision && (
              <DecisionPicker value={row.decisionNeeded} onChange={v => onUpdate({ decisionNeeded: v })} />
            )}

            {/* Notes button */}
            <button
              onClick={onOpenNotes}
              className={cn(
                "flex items-center gap-1 text-xs rounded-full px-2 py-1 font-medium transition-colors",
                isSelected ? "bg-indigo-600 text-white" :
                  row.noteCount > 0 ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200" :
                    "bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-700"
              )}
              title="Ver notas"
            >
              <MessageSquare className="h-3 w-3" />
              <span>{row.noteCount}</span>
            </button>
          </div>
        </div>

        {/* Last updated */}
        {row.reviewUpdatedAt && (
          <p className="text-[9px] text-slate-300 mt-1.5 text-right">
            actualizado {relativeTime(row.reviewUpdatedAt)}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ healthKey, count }: { healthKey: string; count: number }) {
  const meta = HEALTH[healthKey] ?? HEALTH.verde;
  const emoji: Record<string, string> = { rojo: '🔴', amarillo: '🟡', verde: '🟢' };
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-base leading-none">{emoji[healthKey]}</span>
      <h2 className={cn("text-sm font-bold", meta.section)}>{meta.label}</h2>
      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full border", meta.sectionBg)}>
        {count} proyecto{count !== 1 ? 's' : ''}
      </span>
    </div>
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
      setNewNote('');
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
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [notes.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-slate-50">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="h-4 w-4 text-indigo-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{projectName}</p>
            <p className="text-xs text-muted-foreground">{notes.length} nota{notes.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-accent rounded text-muted-foreground shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {isLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
        {!isLoading && notes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Sin notas todavía</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">Escribí la primera nota de esta semana</p>
          </div>
        )}
        {notes.map(note => {
          const isOwn = note.authorId === (user as any)?.id;
          return (
            <div key={note.id} className="group flex gap-2.5">
              <div className={cn("h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5",
                isOwn ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600")}>
                {initials(note.authorName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs font-semibold">{note.authorName || 'Usuario'}</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-[10px] text-muted-foreground cursor-default">{relativeTime(note.noteDate)}</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {new Date(note.noteDate).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' })}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="text-xs bg-white border border-slate-100 rounded-lg px-3 py-2 leading-relaxed whitespace-pre-wrap shadow-sm">
                  {note.content}
                </div>
              </div>
              {isOwn && (
                <button onClick={() => deleteMutation.mutate(note.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-400 transition-opacity shrink-0 mt-0.5">
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
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (newNote.trim()) addMutation.mutate(newNote.trim()); } }}
            placeholder="Nota de reunión... (Enter para guardar)"
            className="resize-none text-sm min-h-[56px] max-h-[120px] flex-1 bg-white" />
          <Button size="sm" onClick={() => { if (newNote.trim()) addMutation.mutate(newNote.trim()); }}
            disabled={!newNote.trim() || addMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 w-8 p-0 shrink-0">
            {addMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">Shift+Enter para nueva línea</p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StatusSemanalPage() {
  const { toast } = useToast();
  const [notesOpen, setNotesOpen] = useState<number | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  const { data: rows = [], isLoading } = useQuery<StatusRow[]>({
    queryKey: ['/api/status-semanal'],
    queryFn: async () => { const r = await authFetch('/api/status-semanal'); return r.json(); },
    staleTime: 30000,
  });

  const { data: rawUsers } = useQuery<AppUser[]>({
    queryKey: ['/api/status-semanal/users'],
    queryFn: async () => { const r = await authFetch('/api/status-semanal/users'); return r.json(); },
    staleTime: 60000,
  });
  const appUsers: AppUser[] = Array.isArray(rawUsers) ? rawUsers : [];

  const patch = useMutation({
    mutationFn: ({ projectId, data }: { projectId: number; data: Record<string, any> }) =>
      apiRequest(`/api/status-semanal/${projectId}`, 'PATCH', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/status-semanal'] }),
    onError: () => toast({ title: 'Error al guardar cambio', variant: 'destructive' }),
  });

  const update = (projectId: number, data: Record<string, any>) => {
    queryClient.setQueryData<StatusRow[]>(['/api/status-semanal'], prev =>
      prev?.map(r => r.projectId === projectId ? { ...r, ...data } : r) ?? []);
    patch.mutate({ projectId, data });
  };

  const visibleRows = rows.filter(r => showHidden ? true : !r.hiddenFromWeekly);
  const hiddenCount = rows.filter(r => r.hiddenFromWeekly).length;

  const rojoRows = visibleRows.filter(r => r.healthStatus === 'rojo');
  const amarilloRows = visibleRows.filter(r => r.healthStatus === 'amarillo');
  const verdeRows = visibleRows.filter(r => !r.healthStatus || r.healthStatus === 'verde');

  const decisionCount = visibleRows.filter(r => r.decisionNeeded && r.decisionNeeded !== 'ninguna').length;
  const openNotesProject = rows.find(r => r.projectId === notesOpen);

  const renderSection = (healthKey: string, sectionRows: StatusRow[]) => {
    if (sectionRows.length === 0 && healthKey !== 'verde') return null;
    return (
      <div key={healthKey} className="mb-8">
        <SectionHeader healthKey={healthKey} count={sectionRows.length} />
        {sectionRows.length === 0 ? (
          <div className="flex items-center gap-2 py-4 px-4 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 text-emerald-600">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">Todo verde — sin alertas esta semana</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {sectionRows.map(row => (
              <ProjectCard
                key={row.projectId}
                row={row}
                appUsers={appUsers}
                isSelected={notesOpen === row.projectId}
                onOpenNotes={() => setNotesOpen(notesOpen === row.projectId ? null : row.projectId)}
                onUpdate={data => update(row.projectId, data)}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Main content */}
      <div className={cn("flex flex-col flex-1 min-w-0 transition-all duration-200", notesOpen ? "mr-[380px]" : "")}>
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-border shrink-0 bg-background">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
                <ClipboardList className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">Status Semanal</h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{currentWeekLabel()}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {rojoRows.length > 0 && (
                <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold px-2.5 py-1 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  {rojoRows.length} en rojo
                </div>
              )}
              {decisionCount > 0 && (
                <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {decisionCount} decisión{decisionCount !== 1 ? 'es' : ''}
                </div>
              )}
              {hiddenCount > 0 && (
                <button
                  onClick={() => setShowHidden(v => !v)}
                  className={cn(
                    "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors",
                    showHidden ? "bg-slate-700 text-white border-slate-700" : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                  )}
                >
                  {showHidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  {showHidden ? `Ocultar (${hiddenCount})` : `${hiddenCount} oculto${hiddenCount !== 1 ? 's' : ''}`}
                </button>
              )}
              <div className="text-xs text-muted-foreground bg-slate-100 px-2.5 py-1 rounded-full font-medium">
                {visibleRows.length} proyecto{visibleRows.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {renderSection('rojo', rojoRows)}
              {renderSection('amarillo', amarilloRows)}
              {renderSection('verde', verdeRows)}
            </>
          )}
        </div>
      </div>

      {/* Notes panel */}
      {notesOpen !== null && (
        <div className="fixed top-0 right-0 h-full w-[380px] border-l border-border bg-background shadow-2xl z-20 flex flex-col">
          {openNotesProject && (
            <NotesPanel
              projectId={notesOpen}
              projectName={openNotesProject.clientName
                ? `${openNotesProject.clientName}${openNotesProject.quotationName ? ` — ${openNotesProject.quotationName}` : ''}`
                : openNotesProject.quotationName ?? `Proyecto #${notesOpen}`}
              onClose={() => setNotesOpen(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
