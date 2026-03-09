import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, authFetch } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ClipboardList, MessageSquare, X, Send, Trash2,
  AlertTriangle, CheckCircle2, Loader2, User, Calendar
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

const HEALTH_OPTIONS = [
  { value: 'verde', label: 'Verde', bg: 'bg-emerald-500', ring: 'ring-emerald-300', light: 'bg-emerald-50 text-emerald-700', bar: 'bg-emerald-500' },
  { value: 'amarillo', label: 'Amarillo', bg: 'bg-amber-400', ring: 'ring-amber-300', light: 'bg-amber-50 text-amber-700', bar: 'bg-amber-400' },
  { value: 'rojo', label: 'Rojo', bg: 'bg-red-500', ring: 'ring-red-300', light: 'bg-red-50 text-red-700', bar: 'bg-red-500' },
];

const LEVEL_OPTIONS = [
  { value: 'alto', label: 'Alto', color: 'text-red-600 bg-red-50 border-red-200' },
  { value: 'medio', label: 'Medio', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { value: 'bajo', label: 'Bajo', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
];

const DECISION_OPTIONS = [
  { value: 'ninguna', label: 'Ninguna', color: 'text-slate-500 bg-slate-50 border-slate-200' },
  { value: 'priorizacion', label: 'Priorización', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { value: 'recursos', label: 'Recursos', color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { value: 'reprecio', label: 'Re-precio', color: 'text-orange-600 bg-orange-50 border-orange-200' },
  { value: 'salida', label: 'Salida', color: 'text-red-600 bg-red-50 border-red-200' },
];

function healthMeta(v: string | null) {
  return HEALTH_OPTIONS.find(o => o.value === v) ?? HEALTH_OPTIONS[0];
}
function levelMeta(v: string | null) {
  return LEVEL_OPTIONS.find(o => o.value === v) ?? LEVEL_OPTIONS[1];
}
function decisionMeta(v: string | null) {
  return DECISION_OPTIONS.find(o => o.value === v) ?? DECISION_OPTIONS[0];
}

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
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
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

function InlineText({
  value, placeholder, onSave, multiline = false
}: {
  value: string | null;
  placeholder: string;
  onSave: (v: string) => void;
  multiline?: boolean;
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
    const props = {
      ref,
      value: draft,
      onChange: (e: any) => setDraft(e.target.value),
      onBlur: save,
      onKeyDown: (e: any) => {
        if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false); }
        if (!multiline && e.key === 'Enter') { e.preventDefault(); save(); }
      },
      className: "w-full text-xs border border-indigo-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white resize-none",
    };
    return multiline
      ? <textarea {...props} rows={2} />
      : <input {...props} />;
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className={cn(
        "text-xs cursor-text rounded px-1 py-0.5 min-h-[22px] hover:bg-white/80 hover:shadow-sm transition-all border border-transparent hover:border-slate-200",
        value ? "text-slate-700" : "text-slate-400 italic"
      )}
      title="Click para editar"
    >
      {value || placeholder}
    </div>
  );
}

// ─── Semáforo selector ────────────────────────────────────────────────────────

function HealthPicker({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const meta = healthMeta(value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition-all hover:ring-2",
            meta.light, meta.ring
          )}
          title="Estado del proyecto"
        >
          <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", meta.bg)} />
          {meta.label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-36 p-1.5" align="start">
        {HEALTH_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => { onChange(opt.value); setOpen(false); }}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium hover:bg-slate-100 transition-colors",
              opt.value === value && "bg-slate-100"
            )}
          >
            <div className={cn("w-3 h-3 rounded-full", opt.bg)} />
            {opt.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ─── Level picker (Margen, Equipo) ───────────────────────────────────────────

function LevelPicker({ value, onChange, label }: { value: string | null; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const meta = levelMeta(value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button>
          <Badge variant="outline" className={cn("text-[10px] h-5 cursor-pointer hover:opacity-80 border font-semibold", meta.color)}>
            {meta.label}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-32 p-1.5" align="start">
        <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1 px-1">{label}</p>
        {LEVEL_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => { onChange(opt.value); setOpen(false); }}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1 rounded text-xs font-medium hover:bg-slate-100",
              opt.value === value && "bg-slate-100"
            )}
          >
            <Badge variant="outline" className={cn("text-[10px] h-4 border", opt.color)}>{opt.label}</Badge>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ─── Decision picker ──────────────────────────────────────────────────────────

function DecisionPicker({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const meta = decisionMeta(value);
  const isUrgent = value && value !== 'ninguna';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] h-5 cursor-pointer hover:opacity-80 border max-w-[90px] truncate font-semibold",
              meta.color,
              isUrgent && "ring-1 ring-offset-1",
            )}
          >
            {meta.label}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1.5" align="start">
        <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1 px-1">Decisión CEO</p>
        {DECISION_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => { onChange(opt.value); setOpen(false); }}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1 rounded text-xs font-medium hover:bg-slate-100",
              opt.value === value && "bg-slate-100"
            )}
          >
            <Badge variant="outline" className={cn("text-[10px] h-4 border", opt.color)}>{opt.label}</Badge>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ─── Notes panel ─────────────────────────────────────────────────────────────

function NotesPanel({
  projectId,
  projectName,
  onClose,
}: {
  projectId: number;
  projectName: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newNote, setNewNote] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: notes = [], isLoading } = useQuery<Note[]>({
    queryKey: ['/api/status-semanal', projectId, 'notes'],
    queryFn: async () => {
      const r = await authFetch(`/api/status-semanal/${projectId}/notes`);
      return r.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest(`/api/status-semanal/${projectId}/notes`, 'POST', { content }),
    onSuccess: () => {
      setNewNote('');
      queryClient.invalidateQueries({ queryKey: ['/api/status-semanal', projectId, 'notes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/status-semanal'] });
    },
    onError: () => toast({ title: 'Error al guardar nota', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (noteId: number) =>
      apiRequest(`/api/status-semanal/notes/${noteId}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/status-semanal', projectId, 'notes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/status-semanal'] });
    },
  });

  const handleSend = () => {
    if (!newNote.trim()) return;
    addMutation.mutate(newNote.trim());
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [notes.length]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-slate-50">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="h-4 w-4 text-indigo-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{projectName}</p>
            <p className="text-xs text-muted-foreground">{notes.length} nota{notes.length !== 1 ? 's' : ''} de reunión</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-accent rounded text-muted-foreground shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
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
              <div className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5",
                isOwn ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"
              )}>
                {initials(note.authorName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs font-semibold text-foreground">{note.authorName || 'Usuario'}</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-[10px] text-muted-foreground cursor-default">
                          {relativeTime(note.noteDate)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {new Date(note.noteDate).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' })}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="text-xs text-foreground bg-white border border-slate-100 rounded-lg px-3 py-2 leading-relaxed whitespace-pre-wrap shadow-sm">
                  {note.content}
                </div>
              </div>
              {isOwn && (
                <button
                  onClick={() => deleteMutation.mutate(note.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-400 transition-opacity shrink-0 mt-0.5"
                  title="Eliminar nota"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border shrink-0 bg-slate-50">
        <div className="flex gap-2 items-end">
          <Textarea
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Nota de reunión... (Enter para guardar)"
            className="resize-none text-sm min-h-[56px] max-h-[120px] flex-1 bg-white"
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!newNote.trim() || addMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 w-8 p-0 shrink-0"
          >
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

  const { data: rows = [], isLoading } = useQuery<StatusRow[]>({
    queryKey: ['/api/status-semanal'],
    queryFn: async () => {
      const r = await authFetch('/api/status-semanal');
      return r.json();
    },
    staleTime: 30000,
  });

  const { data: rawUsers } = useQuery<AppUser[]>({
    queryKey: ['/api/status-semanal/users'],
    queryFn: async () => {
      const r = await authFetch('/api/status-semanal/users');
      return r.json();
    },
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
      prev?.map(r => r.projectId === projectId ? { ...r, ...data } : r) ?? []
    );
    patch.mutate({ projectId, data });
  };

  const openNotesProject = rows.find(r => r.projectId === notesOpen);
  const decisionCount = rows.filter(r => r.decisionNeeded && r.decisionNeeded !== 'ninguna').length;
  const redCount = rows.filter(r => r.healthStatus === 'rojo').length;
  const weekLabel = currentWeekLabel();

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
                <h1 className="text-lg font-bold text-foreground leading-tight">Status Semanal</h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{weekLabel}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {redCount > 0 && (
                <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold px-2.5 py-1 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  {redCount} en rojo
                </div>
              )}
              {decisionCount > 0 && (
                <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {decisionCount} decisión{decisionCount !== 1 ? 'es' : ''}
                </div>
              )}
              <div className="text-xs text-muted-foreground bg-slate-100 px-2.5 py-1 rounded-full font-medium">
                {rows.length} proyecto{rows.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <CheckCircle2 className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No hay proyectos activos</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Los proyectos aparecerán aquí cuando estén activos</p>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse min-w-[1100px]">
              <thead>
                <tr className="bg-slate-50/80 border-b-2 border-border">
                  <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-4 py-2 sticky left-0 bg-slate-50/80 z-10 min-w-[200px]">
                    Cliente / Proyecto
                  </th>
                  <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 py-2 min-w-[90px]">Estado</th>
                  <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 py-2 min-w-[70px]">Margen</th>
                  <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 py-2 min-w-[70px]">Equipo</th>
                  <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 py-2 min-w-[170px]">Riesgo principal</th>
                  <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 py-2 min-w-[160px]">Acción en curso</th>
                  <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 py-2 min-w-[160px]">Próximo hito</th>
                  <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 py-2 min-w-[110px]">Owner</th>
                  <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 py-2 min-w-[100px]">Decisión</th>
                  <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 py-2 min-w-[60px]">Notas</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const isSelected = notesOpen === row.projectId;
                  const hMeta = healthMeta(row.healthStatus);
                  return (
                    <tr
                      key={row.projectId}
                      className={cn(
                        "border-b border-border/60 transition-colors group/row",
                        isSelected ? "bg-indigo-50" : idx % 2 === 0 ? "bg-white" : "bg-slate-50/40",
                        !isSelected && "hover:bg-indigo-50/30"
                      )}
                    >
                      {/* Client + Project — sticky with health color bar */}
                      <td className={cn(
                        "px-0 py-0 sticky left-0 z-10",
                        isSelected ? "bg-indigo-50" : idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                      )}>
                        <div className="flex items-stretch h-full">
                          <div className={cn("w-1 shrink-0 self-stretch", hMeta.bar)} />
                          <div className="px-3 py-2 min-w-0">
                            <div className="font-bold text-xs text-foreground leading-tight">{row.clientName || '—'}</div>
                            <div className="text-[11px] text-muted-foreground truncate max-w-[170px]" title={row.quotationName ?? ''}>
                              {row.quotationName || <span className="italic">Sin nombre</span>}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[9px] text-slate-400 uppercase tracking-wide font-medium">
                                {row.trackingFrequency === 'weekly' || row.trackingFrequency === 'monthly' || row.trackingFrequency === 'biweekly' ? 'Recurrente' : row.trackingFrequency}
                              </span>
                              {row.reviewUpdatedAt && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-[9px] text-slate-300 cursor-default">· {relativeTime(row.reviewUpdatedAt)}</span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Actualizado {new Date(row.reviewUpdatedAt).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Estado */}
                      <td className="px-3 py-2">
                        <HealthPicker
                          value={row.healthStatus}
                          onChange={v => update(row.projectId, { healthStatus: v })}
                        />
                      </td>

                      {/* Margen */}
                      <td className="px-3 py-2">
                        <LevelPicker
                          value={row.marginStatus}
                          onChange={v => update(row.projectId, { marginStatus: v })}
                          label="Margen"
                        />
                      </td>

                      {/* Equipo */}
                      <td className="px-3 py-2">
                        <LevelPicker
                          value={row.teamStrain}
                          onChange={v => update(row.projectId, { teamStrain: v })}
                          label="Desgaste equipo"
                        />
                      </td>

                      {/* Riesgo */}
                      <td className="px-3 py-2">
                        <InlineText
                          value={row.mainRisk}
                          placeholder="Escribí el riesgo..."
                          onSave={v => update(row.projectId, { mainRisk: v })}
                          multiline
                        />
                      </td>

                      {/* Acción */}
                      <td className="px-3 py-2">
                        <InlineText
                          value={row.currentAction}
                          placeholder="Acción en curso..."
                          onSave={v => update(row.projectId, { currentAction: v })}
                          multiline
                        />
                      </td>

                      {/* Próximo hito */}
                      <td className="px-3 py-2">
                        <InlineText
                          value={row.nextMilestone}
                          placeholder="Próximo hito..."
                          onSave={v => update(row.projectId, { nextMilestone: v })}
                          multiline
                        />
                        {row.nextMilestoneDate && (
                          <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Calendar className="h-2.5 w-2.5" />
                            {new Date(row.nextMilestoneDate).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                          </div>
                        )}
                      </td>

                      {/* Owner */}
                      <td className="px-3 py-2">
                        <Select
                          value={row.ownerId?.toString() ?? '__none__'}
                          onValueChange={v => update(row.projectId, { ownerId: v === '__none__' ? null : parseInt(v) })}
                        >
                          <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-white hover:border hover:border-slate-200 px-1 gap-1 focus:ring-0 w-full rounded-md transition-all">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {row.ownerName ? (
                                <>
                                  <div className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[9px] font-bold shrink-0">
                                    {initials(row.ownerName)}
                                  </div>
                                  <span className="truncate text-xs font-medium">{row.ownerName.split(' ')[0]}</span>
                                </>
                              ) : (
                                <>
                                  <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                                    <User className="h-3 w-3 text-slate-400" />
                                  </div>
                                  <span className="text-slate-400 text-xs">Asignar</span>
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
                      </td>

                      {/* Decisión */}
                      <td className="px-3 py-2">
                        <DecisionPicker
                          value={row.decisionNeeded}
                          onChange={v => update(row.projectId, { decisionNeeded: v })}
                        />
                      </td>

                      {/* Notas */}
                      <td className="px-3 py-2">
                        <button
                          onClick={() => setNotesOpen(notesOpen === row.projectId ? null : row.projectId)}
                          className={cn(
                            "flex items-center gap-1 text-xs rounded-full px-2 py-1 transition-colors font-medium",
                            isSelected
                              ? "bg-indigo-600 text-white"
                              : row.noteCount > 0
                                ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                                : "bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-700"
                          )}
                        >
                          <MessageSquare className="h-3 w-3" />
                          <span>{row.noteCount}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Notes panel — slide from right */}
      {notesOpen !== null && (
        <div className="fixed top-0 right-0 h-full w-[380px] border-l border-border bg-background shadow-2xl z-20 flex flex-col">
          {openNotesProject && (
            <NotesPanel
              projectId={notesOpen}
              projectName={openNotesProject.clientName
                ? `${openNotesProject.clientName} — ${openNotesProject.quotationName ?? ''}`
                : openNotesProject.quotationName ?? `Proyecto #${notesOpen}`}
              onClose={() => setNotesOpen(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
