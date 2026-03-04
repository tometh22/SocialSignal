import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, authFetch } from "@/lib/queryClient";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import {
  Sheet, SheetContent
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CalendarIcon, Clock, Plus, Trash2, User, Users, Check, X, ChevronRight, Loader2, Flag
} from "lucide-react";
import { cn } from "@/lib/utils";

type Task = {
  id: number;
  title: string;
  description?: string | null;
  projectId?: number | null;
  sectionName?: string | null;
  assigneeId?: number | null;
  collaboratorIds?: number[];
  startDate?: string | null;
  dueDate?: string | null;
  estimatedHours?: number | null;
  loggedHours?: number;
  status: string;
  priority: string;
  parentTaskId?: number | null;
  completedAt?: string | null;
  timeEntries?: any[];
  subtasks?: any[];
};

type Personnel = { id: number; name: string; email?: string | null };
type Project = { id: number; name: string; client_name: string };

const STATUS_OPTIONS = [
  { value: "todo",        label: "Pendiente",  bg: "bg-gray-100 hover:bg-gray-200 text-gray-700",   active: "bg-gray-600 text-white" },
  { value: "in_progress", label: "En curso",   bg: "bg-blue-50 hover:bg-blue-100 text-blue-700",   active: "bg-blue-600 text-white" },
  { value: "done",        label: "Completada", bg: "bg-green-50 hover:bg-green-100 text-green-700", active: "bg-green-600 text-white" },
  { value: "cancelled",   label: "Cancelada",  bg: "bg-red-50 hover:bg-red-100 text-red-700",       active: "bg-red-600 text-white" },
];

const PRIORITY_OPTIONS = [
  { value: "low",    label: "Baja",    bg: "bg-gray-100 hover:bg-gray-200 text-gray-600",     active: "bg-gray-500 text-white",   icon: "text-gray-400" },
  { value: "medium", label: "Media",   bg: "bg-yellow-50 hover:bg-yellow-100 text-yellow-700", active: "bg-yellow-500 text-white", icon: "text-yellow-500" },
  { value: "high",   label: "Alta",    bg: "bg-orange-50 hover:bg-orange-100 text-orange-700", active: "bg-orange-500 text-white", icon: "text-orange-500" },
  { value: "urgent", label: "Urgente", bg: "bg-red-50 hover:bg-red-100 text-red-700",           active: "bg-red-500 text-white",   icon: "text-red-500" },
];

const AVATAR_COLORS = [
  "bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500",
  "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-amber-500",
];

function getInitials(name: string) {
  return name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
}
function getAvatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

function ProjectColorDot({ projectId }: { projectId?: number | null }) {
  const colors = ["bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500", "bg-pink-500", "bg-teal-500"];
  if (!projectId) return null;
  return <span className={cn("inline-block w-2.5 h-2.5 rounded-full mr-1.5 flex-shrink-0", colors[projectId % colors.length])} />;
}

function parseHoursInput(value: string): number | null {
  value = value.trim().toLowerCase();
  if (!value) return null;
  const hm1 = value.match(/^(\d+)h(\d+)m?$/);
  if (hm1) return parseInt(hm1[1]) + parseInt(hm1[2]) / 60;
  const hOnly = value.match(/^(\d+(?:\.\d+)?)h$/);
  if (hOnly) return parseFloat(hOnly[1]);
  const colon = value.match(/^(\d+):(\d+)$/);
  if (colon) return parseInt(colon[1]) + parseInt(colon[2]) / 60;
  const minOnly = value.match(/^(\d+)m(?:in)?$/);
  if (minOnly) return parseInt(minOnly[1]) / 60;
  const num = parseFloat(value);
  if (!isNaN(num)) return num;
  return null;
}

function formatHours(hours: number) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function CircleCheckSmall({ checked, onClick }: { checked: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all",
        checked ? "bg-green-500 border-green-500" : "border-muted-foreground/40 hover:border-primary/60"
      )}
    >
      {checked && <Check className="h-2 w-2 text-white" strokeWidth={3} />}
    </button>
  );
}

interface Props {
  taskId: number | null;
  open: boolean;
  onClose: () => void;
  onUpdate?: () => void;
  initialFocusTime?: boolean;
  onNavigateToTask?: (taskId: number) => void;
}

export default function TaskDetailPanel({ taskId, open, onClose, onUpdate, initialFocusTime = false, onNavigateToTask }: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [logHours, setLogHours] = useState("");
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [logDesc, setLogDesc] = useState("");
  const [showTimeLog, setShowTimeLog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const descTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open && initialFocusTime) setShowTimeLog(true);
    if (!open) {
      setShowTimeLog(false);
      setEditingTitle(false);
      setShowAddSubtask(false);
      setStartDateOpen(false);
      setDueDateOpen(false);
      // Cancel any pending description save to avoid race condition
      if (descTimerRef.current) clearTimeout(descTimerRef.current);
    }
    return () => {
      if (descTimerRef.current) clearTimeout(descTimerRef.current);
    };
  }, [open, initialFocusTime]);

  const { data: task, isLoading, refetch: refetchTask } = useQuery<Task>({
    queryKey: ["/api/tasks", taskId],
    queryFn: () => authFetch(`/api/tasks/${taskId}`).then(r => r.json()),
    enabled: !!taskId,
  });

  const { data: allPersonnel = [] } = useQuery<Personnel[]>({
    queryKey: ["/api/tasks-personnel"],
    queryFn: () => authFetch("/api/tasks-personnel").then(r => r.json()),
  });

  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/tasks-projects"],
    queryFn: () => authFetch("/api/tasks-projects").then(r => r.json()),
  });

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<Task>) => {
      return apiRequest(`/api/tasks/${taskId}`, "PUT", updates);
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ["/api/tasks", taskId] });
      const previous = queryClient.getQueryData(["/api/tasks", taskId]);
      queryClient.setQueryData(["/api/tasks", taskId], (old: any) => ({
        ...(old ?? {}),
        ...updates,
      }));
      return { previous };
    },
    onSuccess: (updated: any) => {
      queryClient.setQueryData(["/api/tasks", taskId], (old: any) => ({
        ...(old ?? {}),
        ...updated,
        timeEntries: old?.timeEntries ?? [],
        subtasks: old?.subtasks ?? [],
      }));
      refetchTask();
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/project"] });
    },
    onError: (_err, _updates, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/tasks", taskId], context.previous);
      }
      toast({ variant: "destructive", title: "Error al guardar", description: "No se pudo guardar el cambio. Intenta de nuevo." });
    },
  });

  const addSubtaskMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/tasks", "POST", data),
    onSuccess: () => {
      refetchTask();
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/project"] });
      setSubtaskTitle("");
      setShowAddSubtask(false);
    },
  });

  const logTimeMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/tasks/${taskId}/time`, "POST", data),
    onSuccess: () => {
      refetchTask();
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/hours-summary"] });
      setLogHours(""); setLogDesc(""); setShowTimeLog(false);
      toast({ title: "Horas registradas" });
    },
  });

  const deleteTimeMutation = useMutation({
    mutationFn: (entryId: number) => apiRequest(`/api/tasks/${taskId}/time/${entryId}`, "DELETE"),
    onSuccess: () => refetchTask(),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest(`/api/tasks/${taskId}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      onUpdate?.(); onClose();
      toast({ title: "Tarea eliminada" });
    },
  });

  const handleTitleSave = () => {
    if (titleValue.trim() && titleValue !== task?.title) {
      updateMutation.mutate({ title: titleValue.trim() });
    }
    setEditingTitle(false);
  };

  const handleLogTime = () => {
    const hours = parseHoursInput(logHours);
    if (!hours || hours <= 0) {
      toast({ variant: "destructive", title: "Error", description: "Ingresá un valor válido: ej. 1.5, 1h30" });
      return;
    }
    logTimeMutation.mutate({ personnelId: task?.assigneeId, date: logDate, hours: Math.round(hours * 100) / 100, description: logDesc });
  };

  const handleDescBlur = (value: string) => {
    if (descTimerRef.current) clearTimeout(descTimerRef.current);
    // Direct call — no deferred timeout to avoid race conditions on panel close
    updateMutation.mutate({ description: value || null });
  };

  if (!task && !isLoading) return null;

  const assignee = allPersonnel.find(p => p.id === task?.assigneeId);
  const project = allProjects.find(p => p.id === task?.projectId);
  const collaborators = allPersonnel.filter(p => (task?.collaboratorIds || []).includes(p.id));
  const loggedH = task?.loggedHours || 0;

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0 flex flex-col" side="right">
          {isLoading || !task ? (
            <div className="flex items-center justify-center flex-1 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />Cargando...
            </div>
          ) : (
            <TooltipProvider>
              <div className="flex flex-col h-full">
                {/* ── Header ── */}
                <div className="px-5 pt-4 pb-3 border-b flex-shrink-0">
                  {/* Back to parent task button */}
                  {task.parentTaskId && onNavigateToTask && (
                    <button
                      onClick={() => onNavigateToTask(task.parentTaskId!)}
                      className="flex items-center gap-1 text-[11px] text-primary/80 hover:text-primary mb-2 transition-colors"
                    >
                      <ChevronRight className="h-2.5 w-2.5 rotate-180" />
                      Volver a tarea padre
                    </button>
                  )}

                  {/* Breadcrumb */}
                  <nav className="flex items-center gap-1 text-[11px] text-muted-foreground mb-2.5 flex-wrap">
                    {project && (
                      <>
                        <ProjectColorDot projectId={task.projectId} />
                        <span>{project.client_name || project.name}</span>
                        <ChevronRight className="h-2.5 w-2.5" />
                        <span>{project.name}</span>
                        {task.sectionName && (
                          <>
                            <ChevronRight className="h-2.5 w-2.5" />
                            <span>{task.sectionName}</span>
                          </>
                        )}
                      </>
                    )}
                  </nav>

                  {/* Title */}
                  {editingTitle ? (
                    <Input
                      autoFocus
                      value={titleValue}
                      onChange={e => setTitleValue(e.target.value)}
                      onBlur={handleTitleSave}
                      onKeyDown={e => { if (e.key === "Enter") handleTitleSave(); if (e.key === "Escape") setEditingTitle(false); }}
                      className="text-xl font-bold border-none shadow-none px-0 focus-visible:ring-0 h-auto py-0.5"
                    />
                  ) : (
                    <h2
                      className="text-xl font-bold cursor-pointer hover:text-primary transition-colors leading-snug"
                      onClick={() => { setTitleValue(task.title); setEditingTitle(true); }}
                    >
                      {task.title}
                    </h2>
                  )}

                  {/* Status pills */}
                  <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide mr-1">Estado</span>
                    {STATUS_OPTIONS.map(s => (
                      <button
                        key={s.value}
                        onClick={() => updateMutation.mutate({ status: s.value })}
                        className={cn(
                          "px-2.5 py-0.5 rounded-full text-xs font-medium transition-all",
                          task.status === s.value ? s.active : s.bg
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Scrollable body ── */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

                  {/* Responsable */}
                  <div className="flex items-center gap-3">
                    <div className="w-28 flex-shrink-0">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" />Responsable</p>
                    </div>
                    <Select
                      value={task.assigneeId?.toString() || "none"}
                      onValueChange={v => updateMutation.mutate({ assigneeId: v === "none" ? null : parseInt(v) })}
                    >
                      <SelectTrigger className="h-8 text-sm flex-1 border-dashed hover:bg-accent px-2">
                        <div className="flex items-center gap-2">
                          {assignee ? (
                            <>
                              <Avatar className="h-5 w-5">
                                <AvatarFallback className={cn("text-[8px] text-white", getAvatarColor(assignee.id))}>
                                  {getInitials(assignee.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span>{assignee.name}</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">Sin asignar</span>
                          )}
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin asignar</SelectItem>
                        {allPersonnel.map(p => (
                          <SelectItem key={p.id} value={p.id.toString()}>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-4 w-4">
                                <AvatarFallback className={cn("text-[7px] text-white", getAvatarColor(p.id))}>
                                  {getInitials(p.name)}
                                </AvatarFallback>
                              </Avatar>
                              {p.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Colaboradores */}
                  <div className="flex items-start gap-3">
                    <div className="w-28 flex-shrink-0 pt-1">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />Colaboradores</p>
                    </div>
                    <div className="flex-1 flex items-center gap-1.5 flex-wrap">
                      {collaborators.map(c => (
                        <div key={c.id} className="flex items-center gap-1 bg-primary/10 border border-primary/20 rounded-full pl-0.5 pr-2 py-0.5 text-xs">
                          <Avatar className="h-5 w-5 flex-shrink-0">
                            <AvatarFallback className={cn("text-[8px] text-white", getAvatarColor(c.id))}>
                              {getInitials(c.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-foreground font-medium">{c.name}</span>
                          <button
                            className="ml-0.5 text-muted-foreground hover:text-red-500 transition-colors"
                            onClick={() => {
                              const current = task.collaboratorIds || [];
                              updateMutation.mutate({ collaboratorIds: current.filter(id => id !== c.id) });
                            }}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      <Select onValueChange={v => {
                        const current = task.collaboratorIds || [];
                        if (!current.includes(parseInt(v))) {
                          updateMutation.mutate({ collaboratorIds: [...current, parseInt(v)] });
                        }
                      }}>
                        <SelectTrigger className="h-7 w-auto border-dashed text-xs px-2 text-muted-foreground hover:bg-accent">
                          <Plus className="h-3 w-3 mr-1" />Agregar
                        </SelectTrigger>
                        <SelectContent>
                          {allPersonnel.filter(p => !(task.collaboratorIds || []).includes(p.id) && p.id !== task.assigneeId).map(p => (
                            <SelectItem key={p.id} value={p.id.toString()}>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-4 w-4">
                                  <AvatarFallback className={cn("text-[7px] text-white", getAvatarColor(p.id))}>
                                    {getInitials(p.name)}
                                  </AvatarFallback>
                                </Avatar>
                                {p.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Fechas */}
                  <div className="flex items-center gap-3">
                    <div className="w-28 flex-shrink-0">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1"><CalendarIcon className="h-3 w-3" />Fechas</p>
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      {/* Fecha inicio */}
                      <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs justify-start font-normal border-dashed min-w-[70px]"
                            onClick={() => setStartDateOpen(true)}
                          >
                            {task.startDate ? format(new Date(task.startDate), "d MMM", { locale: es }) : "Inicio"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" side="bottom" align="start">
                          <Calendar
                            mode="single"
                            selected={task.startDate ? new Date(task.startDate) : undefined}
                            onSelect={d => {
                              updateMutation.mutate({ startDate: d ? d.toISOString() : null });
                              setStartDateOpen(false);
                            }}
                            locale={es}
                            initialFocus
                          />
                          {task.startDate && (
                            <div className="p-2 border-t">
                              <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground"
                                onClick={() => { updateMutation.mutate({ startDate: null }); setStartDateOpen(false); }}>
                                Quitar fecha inicio
                              </Button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>

                      <span className="text-muted-foreground text-sm">→</span>

                      {/* Fecha fin */}
                      <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "h-7 text-xs justify-start font-normal border-dashed min-w-[70px]",
                              task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done"
                                ? "border-red-300 text-red-600"
                                : ""
                            )}
                            onClick={() => setDueDateOpen(true)}
                          >
                            {task.dueDate ? format(new Date(task.dueDate), "d MMM", { locale: es }) : "Fin"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" side="bottom" align="start">
                          <Calendar
                            mode="single"
                            selected={task.dueDate ? new Date(task.dueDate) : undefined}
                            onSelect={d => {
                              updateMutation.mutate({ dueDate: d ? d.toISOString() : null });
                              setDueDateOpen(false);
                            }}
                            locale={es}
                            initialFocus
                          />
                          {task.dueDate && (
                            <div className="p-2 border-t">
                              <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground"
                                onClick={() => { updateMutation.mutate({ dueDate: null }); setDueDateOpen(false); }}>
                                Quitar fecha fin
                              </Button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Prioridad */}
                  <div className="flex items-center gap-3">
                    <div className="w-28 flex-shrink-0">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Flag className="h-3 w-3" />Prioridad</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {PRIORITY_OPTIONS.map(p => (
                        <button
                          key={p.value}
                          onClick={() => updateMutation.mutate({ priority: p.value })}
                          className={cn(
                            "px-2 py-0.5 rounded-full text-xs font-medium transition-all flex items-center gap-1",
                            task.priority === p.value ? p.active : p.bg
                          )}
                        >
                          <Flag className={cn("h-2.5 w-2.5", task.priority === p.value ? "text-white" : p.icon)} />
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Horas estimadas */}
                  <div className="flex items-center gap-3">
                    <div className="w-28 flex-shrink-0">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Horas est.</p>
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        key={`est-${taskId}-${task.estimatedHours}`}
                        type="number"
                        min="0"
                        step="0.5"
                        defaultValue={task.estimatedHours?.toString() || ""}
                        onBlur={e => updateMutation.mutate({ estimatedHours: e.target.value ? parseFloat(e.target.value) : null })}
                        className="h-7 text-xs w-20 border-dashed"
                        placeholder="0"
                      />
                      <span className="text-xs text-muted-foreground">horas</span>
                      {loggedH > 0 && (
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full font-medium",
                          task.estimatedHours && loggedH > task.estimatedHours
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                        )}>
                          {formatHours(loggedH)} registradas
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Sección */}
                  <div className="flex items-center gap-3">
                    <div className="w-28 flex-shrink-0">
                      <p className="text-[11px] text-muted-foreground">Sección</p>
                    </div>
                    <Input
                      key={`sec-${taskId}-${task.sectionName}`}
                      defaultValue={task.sectionName || "General"}
                      onBlur={e => updateMutation.mutate({ sectionName: e.target.value || "General" })}
                      className="h-7 text-xs flex-1 border-dashed"
                      placeholder="General"
                    />
                  </div>

                  {/* Descripción */}
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1.5">Descripción</p>
                    <Textarea
                      key={`desc-${taskId}`}
                      defaultValue={task.description || ""}
                      onBlur={e => handleDescBlur(e.target.value)}
                      className="min-h-[72px] text-sm resize-none"
                      placeholder="Agregar descripción..."
                    />
                  </div>

                  {/* ── Subtareas ── */}
                  <div className="border border-border rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/20 border-b border-border">
                      <p className="text-xs font-semibold text-foreground">
                        Subtareas
                        {(task.subtasks?.length || 0) > 0 && (
                          <span className="ml-1.5 text-muted-foreground font-normal">
                            {task.subtasks?.filter(s => s.status === "done").length}/{task.subtasks?.length}
                          </span>
                        )}
                      </p>
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowAddSubtask(true)}>
                        <Plus className="h-3 w-3 mr-1" />Agregar
                      </Button>
                    </div>
                    <div className="divide-y divide-border">
                      {(task.subtasks || []).map(sub => (
                        <div key={sub.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-accent/20 group">
                          <CircleCheckSmall
                            checked={sub.status === "done"}
                            onClick={e => {
                              e.stopPropagation();
                              apiRequest(`/api/tasks/${sub.id}`, "PUT", { status: sub.status === "done" ? "todo" : "done" })
                                .then(() => refetchTask());
                            }}
                          />
                          <span
                            className={cn(
                              "text-sm flex-1 cursor-pointer hover:text-primary transition-colors",
                              sub.status === "done" ? "line-through text-muted-foreground" : ""
                            )}
                            onClick={() => onNavigateToTask?.(sub.id)}
                          >
                            {sub.title}
                          </span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 flex-shrink-0" />
                        </div>
                      ))}
                      {(task.subtasks || []).length === 0 && !showAddSubtask && (
                        <p className="text-xs text-muted-foreground italic px-3 py-2">Sin subtareas todavía</p>
                      )}
                      {showAddSubtask && (
                        <div className="flex items-center gap-2 px-3 py-2">
                          <div className="w-4 h-4 rounded-full border-2 border-dashed border-muted-foreground/30 flex-shrink-0" />
                          <Input
                            autoFocus
                            value={subtaskTitle}
                            onChange={e => setSubtaskTitle(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter" && subtaskTitle.trim()) {
                                addSubtaskMutation.mutate({ title: subtaskTitle.trim(), parentTaskId: taskId, projectId: task.projectId, sectionName: task.sectionName, status: "todo", priority: "medium" });
                              }
                              if (e.key === "Escape") { setShowAddSubtask(false); setSubtaskTitle(""); }
                            }}
                            placeholder="Nombre de la subtarea..."
                            className="h-7 text-xs flex-1 border-none shadow-none px-0 focus-visible:ring-0"
                          />
                          <Button size="sm" className="h-6 text-xs px-2" onClick={() => {
                            if (subtaskTitle.trim()) addSubtaskMutation.mutate({ title: subtaskTitle.trim(), parentTaskId: taskId, projectId: task.projectId, sectionName: task.sectionName, status: "todo", priority: "medium" });
                          }}>OK</Button>
                          <Button size="sm" variant="ghost" className="h-6 text-xs px-1" onClick={() => { setShowAddSubtask(false); setSubtaskTitle(""); }}>✕</Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Tiempo registrado ── */}
                  <div className="border border-border rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/20 border-b border-border">
                      <p className="text-xs font-semibold text-foreground">
                        Tiempo registrado
                        {loggedH > 0 && <span className="ml-1.5 text-muted-foreground font-normal">{formatHours(loggedH)}</span>}
                      </p>
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowTimeLog(v => !v)}>
                        {showTimeLog ? <X className="h-3 w-3" /> : <><Plus className="h-3 w-3 mr-1" />Registrar</>}
                      </Button>
                    </div>

                    {showTimeLog && (
                      <div className="px-3 py-3 border-b border-border bg-accent/10 space-y-2.5">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-1">Horas *</p>
                            <Input
                              autoFocus
                              value={logHours}
                              onChange={e => setLogHours(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") handleLogTime(); }}
                              className="h-8 text-sm"
                              placeholder="ej: 1.5 · 1h30"
                            />
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-1">Fecha</p>
                            <Input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} className="h-8 text-sm" />
                          </div>
                        </div>
                        <div>
                          <Input
                            value={logDesc}
                            onChange={e => setLogDesc(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") handleLogTime(); }}
                            className="h-8 text-sm"
                            placeholder="¿En qué trabajaste? (opcional)"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={handleLogTime} disabled={logTimeMutation.isPending || !logHours.trim()}>
                            {logTimeMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Registrar"}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowTimeLog(false)}>Cancelar</Button>
                        </div>
                      </div>
                    )}

                    <div className="divide-y divide-border">
                      {(task.timeEntries || []).length === 0 && !showTimeLog && (
                        <p className="text-xs text-muted-foreground italic px-3 py-2">Sin horas registradas</p>
                      )}
                      {(task.timeEntries || []).map(entry => (
                        <div key={entry.id} className="flex items-center gap-2 px-3 py-2 hover:bg-accent/20 group text-xs">
                          <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="font-semibold text-primary w-10 flex-shrink-0">{formatHours(entry.hours)}</span>
                          <span className="text-muted-foreground flex-shrink-0">{format(new Date(entry.date), "dd/MM/yy")}</span>
                          {entry.description && <span className="text-muted-foreground flex-1 truncate">— {entry.description}</span>}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-red-500 ml-auto flex-shrink-0"
                            onClick={() => deleteTimeMutation.mutate(entry.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── Footer: eliminar tarea ── */}
                  <div className="pt-2 pb-6">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 gap-1.5"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Eliminar tarea
                    </Button>
                  </div>
                </div>
              </div>
            </TooltipProvider>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tarea?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La tarea y su historial de horas serán eliminados permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
