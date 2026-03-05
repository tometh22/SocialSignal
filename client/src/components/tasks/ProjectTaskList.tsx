import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, authFetch } from "@/lib/queryClient";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Plus, ChevronDown, ChevronRight, CalendarIcon, Clock, Flag, Loader2, Check,
  MoreHorizontal, Pencil, Trash2, GripVertical
} from "lucide-react";
import { cn } from "@/lib/utils";
import TaskDetailPanel from "./TaskDetailPanel";
import { toast } from "@/hooks/use-toast";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, DragOverEvent,
  PointerSensor, useSensor, useSensors, closestCenter, UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  subtaskCount?: number;
};

type Personnel = { id: number; name: string };

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-gray-400",
  medium: "text-yellow-500",
  high: "text-orange-500",
  urgent: "text-red-500",
};

const PRIORITY_BADGE: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  urgent: "bg-red-50 text-red-700 border-red-200",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baja", medium: "Media", high: "Alta", urgent: "Urgente",
};

const AVATAR_COLORS = [
  "bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500",
  "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500",
];

const CLIENT_TAG_COLORS = [
  "bg-blue-100 text-blue-800 border-blue-200",
  "bg-purple-100 text-purple-800 border-purple-200",
  "bg-green-100 text-green-800 border-green-200",
  "bg-orange-100 text-orange-800 border-orange-200",
  "bg-pink-100 text-pink-800 border-pink-200",
  "bg-teal-100 text-teal-800 border-teal-200",
  "bg-indigo-100 text-indigo-800 border-indigo-200",
  "bg-amber-100 text-amber-800 border-amber-200",
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getClientTagColor(clientName: string) {
  return CLIENT_TAG_COLORS[hashString(clientName) % CLIENT_TAG_COLORS.length];
}

function getInitials(name: string) {
  return name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
}

function getAvatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

function isOverdue(task: Task) {
  return task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done";
}

function formatHours(hours: number) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

// ─── Sort helper ────────────────────────────────────────────────────────────
const PRIORITY_SORT_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

function sortTaskList(tasks: Task[], sortBy: string, allPersonnel: Personnel[]): Task[] {
  if (sortBy === 'default') return tasks;
  return [...tasks].sort((a, b) => {
    switch (sortBy) {
      case 'dueDate_asc':
        return (a.dueDate || 'z').localeCompare(b.dueDate || 'z');
      case 'dueDate_desc':
        return (b.dueDate || '').localeCompare(a.dueDate || '');
      case 'priority':
        return (PRIORITY_SORT_ORDER[a.priority] ?? 4) - (PRIORITY_SORT_ORDER[b.priority] ?? 4);
      case 'title':
        return a.title.localeCompare(b.title, 'es');
      case 'assignee': {
        const an = allPersonnel.find(p => p.id === a.assigneeId)?.name || 'zzz';
        const bn = allPersonnel.find(p => p.id === b.assigneeId)?.name || 'zzz';
        return an.localeCompare(bn, 'es');
      }
      default: return 0;
    }
  });
}

function formatDateRange(startDate?: string | null, dueDate?: string | null) {
  if (!startDate && !dueDate) return null;
  if (startDate && dueDate) {
    const s = format(new Date(startDate), "d MMM", { locale: es });
    const d = format(new Date(dueDate), "d MMM", { locale: es });
    return `${s} – ${d}`;
  }
  if (dueDate) return format(new Date(dueDate), "d MMM", { locale: es });
  if (startDate) return `${format(new Date(startDate), "d MMM", { locale: es })} →`;
  return null;
}

function CircleCheck({ checked, onClick }: { checked: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center",
        "transition-all duration-200 ease-in-out focus:outline-none",
        "hover:scale-110 active:scale-95",
        checked
          ? "bg-green-500 border-green-500"
          : "border-muted-foreground/40 hover:border-primary/60 hover:bg-primary/5",
      )}
    >
      {checked && <Check className="h-2 w-2 text-white" strokeWidth={3} />}
    </button>
  );
}

function InlineDateButton({ startDate, dueDate, taskId, onSet, overdue }: {
  startDate?: string | null;
  dueDate?: string | null;
  taskId: number;
  onSet: (taskId: number, d: Date | undefined) => void;
  overdue: boolean;
}) {
  const [open, setOpen] = useState(false);
  const label = formatDateRange(startDate, dueDate);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={e => { e.stopPropagation(); setOpen(true); }}
          className={cn(
            "flex items-center gap-1 text-xs rounded px-1 py-0.5 transition-all whitespace-nowrap",
            label
              ? overdue
                ? "text-red-500 font-medium hover:bg-red-50"
                : "text-muted-foreground hover:bg-accent"
              : "text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-primary"
          )}
        >
          {label || <CalendarIcon className="h-3 w-3" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 shadow-lg" onClick={e => e.stopPropagation()}>
        <Calendar
          mode="single"
          selected={dueDate ? new Date(dueDate) : undefined}
          onSelect={d => { onSet(taskId, d); setOpen(false); }}
          locale={es}
          initialFocus
        />
        {dueDate && (
          <div className="p-2 border-t">
            <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground"
              onClick={() => { onSet(taskId, undefined); setOpen(false); }}>
              Quitar fecha
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface NewTaskRowProps {
  projectId: number;
  sectionName: string;
  onCreated: () => void;
  onCancel: () => void;
  allPersonnel: Personnel[];
  projectMembers?: { personnelId: number; name: string; role: string }[];
  defaultStatus?: string;
}

function NewTaskRow({ projectId, sectionName, onCreated, onCancel, allPersonnel, projectMembers = [], defaultStatus = "todo" }: NewTaskRowProps) {
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("none");
  const [dueDate, setDueDate] = useState<Date | undefined>();

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/tasks", "POST", data),
    onSuccess: () => { onCreated(); },
  });

  const handleCreate = () => {
    if (!title.trim()) return;
    createMutation.mutate({
      title: title.trim(),
      projectId,
      sectionName,
      assigneeId: assigneeId !== "none" ? parseInt(assigneeId) : null,
      dueDate: dueDate?.toISOString() || null,
      status: defaultStatus,
      priority: "medium",
    });
  };

  const memberIds = projectMembers.map(m => m.personnelId);
  const memberPersonnel = allPersonnel.filter(p => memberIds.includes(p.id));
  const otherPersonnel = allPersonnel.filter(p => !memberIds.includes(p.id));

  return (
    <div className="flex items-center border-b border-border hover:bg-accent/20 transition-colors">
      <div className="w-8 flex-shrink-0" />
      <div className="w-5 flex-shrink-0 flex items-center justify-center py-2">
        <div className="w-3.5 h-3.5 rounded border border-dashed border-muted-foreground/40" />
      </div>
      <div className="flex-1 px-2 py-1.5">
        <Input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") onCancel(); }}
          placeholder="Nombre de la tarea..."
          className="h-7 text-sm border-none bg-transparent focus-visible:ring-0 shadow-none px-0"
        />
      </div>
      <div className="w-28 px-2 flex-shrink-0">
        <Select value={assigneeId} onValueChange={setAssigneeId}>
          <SelectTrigger className="h-7 text-xs border-none bg-transparent shadow-none">
            <SelectValue placeholder="Asignar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin asignar</SelectItem>
            {memberPersonnel.length > 0 && (
              <>
                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Miembros del proyecto</div>
                {memberPersonnel.map(p => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
                {otherPersonnel.length > 0 && <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide border-t mt-1">Equipo</div>}
              </>
            )}
            {otherPersonnel.map(p => (
              <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-32 px-2 flex-shrink-0">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-full text-xs justify-start font-normal">
              {dueDate ? format(dueDate, "d MMM", { locale: es }) : <CalendarIcon className="h-3 w-3 text-muted-foreground" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={dueDate} onSelect={setDueDate} locale={es} />
          </PopoverContent>
        </Popover>
      </div>
      <div className="w-28 px-2 flex-shrink-0" />
      <div className="w-24 px-2 flex-shrink-0 flex items-center gap-1">
        <Button size="sm" className="h-6 text-xs px-2" onClick={handleCreate} disabled={createMutation.isPending || !title.trim()}>
          {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "OK"}
        </Button>
        <Button size="sm" variant="ghost" className="h-6 text-xs px-1" onClick={onCancel}>✕</Button>
      </div>
    </div>
  );
}

interface TaskRowProps {
  task: Task;
  allPersonnel: Personnel[];
  onOpen: (id: number, focusTime?: boolean) => void;
  onToggle: (task: Task) => void;
  onDateSet: (taskId: number, d: Date | undefined) => void;
  onAssignee: (taskId: number, assigneeId: number | null) => void;
  isSubtask?: boolean;
  clientName?: string | null;
  subtaskMap?: Record<number, Task[]>;
  expandedSubtasks?: Set<number>;
  onToggleSubtasks?: (taskId: number) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
}

function TaskRow({ task, allPersonnel, onOpen, onToggle, onDateSet, onAssignee, isSubtask = false, clientName, subtaskMap, expandedSubtasks, onToggleSubtasks, dragHandleProps, isDragging }: TaskRowProps) {
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const assignee = allPersonnel.find(p => p.id === task.assigneeId);
  const collaborators = allPersonnel.filter(p => (task.collaboratorIds || []).includes(p.id));
  const overdue = !!isOverdue(task);
  const isDone = task.status === "done";
  const loggedH = task.loggedHours || 0;
  const subtaskCount = task.subtaskCount || 0;
  const hasSubtasks = subtaskCount > 0;
  const isExpanded = expandedSubtasks?.has(task.id) || false;

  return (
    <TooltipProvider>
      <div
        className={cn(
          "flex items-center border-b border-border hover:bg-accent/30 transition-all duration-150 group cursor-pointer",
          isDone && "opacity-60",
          isSubtask && "bg-muted/5",
          isDragging && "opacity-40 bg-accent/20"
        )}
        onClick={() => onOpen(task.id)}
      >
        {/* Drag handle */}
        {!isSubtask && (
          <div
            {...dragHandleProps}
            className="w-5 flex-shrink-0 flex items-center justify-center py-3 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
            onClick={e => e.stopPropagation()}
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60" />
          </div>
        )}
        {/* indent / subtask indicator */}
        <div className={cn("flex-shrink-0 flex items-center", isSubtask ? "w-12 pl-6" : "w-3")}>
          {isSubtask && <span className="text-muted-foreground/50 text-xs mr-1">↳</span>}
        </div>

        {/* Circle Checkbox */}
        <div className="w-5 flex-shrink-0 flex items-center justify-center py-3">
          <CircleCheck
            checked={isDone}
            onClick={e => { e.stopPropagation(); onToggle(task); }}
          />
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0 px-2 py-3 flex items-center gap-1.5">
          <Flag className={cn("h-2.5 w-2.5 flex-shrink-0", PRIORITY_COLORS[task.priority] || "text-gray-300")} />
          <span className={cn("text-sm truncate transition-all duration-150", isDone && "line-through text-muted-foreground")}>
            {task.title}
          </span>
          {hasSubtasks && !isSubtask && (
            <button
              onClick={e => { e.stopPropagation(); onToggleSubtasks?.(task.id); }}
              className={cn(
                "flex-shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors",
                isExpanded
                  ? "bg-primary/10 text-primary border-primary/20"
                  : "bg-muted text-muted-foreground border-border hover:bg-accent hover:text-foreground"
              )}
            >
              {subtaskCount}
              <ChevronDown className={cn("h-2.5 w-2.5 transition-transform", isExpanded && "rotate-180")} />
            </button>
          )}
        </div>

        {/* Responsable — inline editable */}
        <div className="w-28 px-2 flex-shrink-0 flex items-center">
          <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
            <PopoverTrigger asChild>
              <button
                onClick={e => { e.stopPropagation(); setAssigneeOpen(true); }}
                className="rounded-full hover:ring-2 hover:ring-primary/30 transition-all"
              >
                {assignee ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className={cn("text-[9px] text-white", getAvatarColor(assignee.id))}>
                          {getInitials(assignee.name)}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>{assignee.name}</p></TooltipContent>
                  </Tooltip>
                ) : (
                  <div className="w-6 h-6 rounded-full border border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-primary/60 transition-colors">
                    <Plus className="h-2.5 w-2.5 text-muted-foreground/40" />
                  </div>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1 shadow-lg" align="start" onClick={e => e.stopPropagation()}>
              <div className="space-y-0.5">
                <button
                  className="w-full text-left text-xs px-2 py-1.5 hover:bg-accent rounded-md flex items-center gap-2 transition-colors"
                  onClick={() => { onAssignee(task.id, null); setAssigneeOpen(false); }}
                >
                  <div className="w-5 h-5 rounded-full border border-dashed border-muted-foreground/40 flex-shrink-0" />
                  <span className="text-muted-foreground">Sin asignar</span>
                </button>
                {allPersonnel.map(p => (
                  <button
                    key={p.id}
                    className={cn(
                      "w-full text-left text-xs px-2 py-1.5 hover:bg-accent rounded-md flex items-center gap-2 transition-colors",
                      task.assigneeId === p.id && "bg-primary/10 text-primary font-medium"
                    )}
                    onClick={() => { onAssignee(task.id, p.id); setAssigneeOpen(false); }}
                  >
                    <Avatar className="h-5 w-5 flex-shrink-0">
                      <AvatarFallback className={cn("text-[8px] text-white", getAvatarColor(p.id))}>
                        {getInitials(p.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{p.name}</span>
                    {task.assigneeId === p.id && <Check className="h-3 w-3 ml-auto flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Colaboradores */}
        <div className="w-24 px-2 flex-shrink-0 flex items-center gap-0.5">
          {collaborators.slice(0, 3).map(c => (
            <Tooltip key={c.id}>
              <TooltipTrigger asChild>
                <Avatar className="h-5 w-5 -ml-1 first:ml-0 ring-1 ring-background">
                  <AvatarFallback className={cn("text-[8px] text-white", getAvatarColor(c.id))}>
                    {getInitials(c.name)}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="top"><p>{c.name}</p></TooltipContent>
            </Tooltip>
          ))}
          {collaborators.length > 3 && (
            <span className="text-[9px] text-muted-foreground ml-0.5">+{collaborators.length - 3}</span>
          )}
        </div>

        {/* Fecha entrega / rango */}
        <div className="w-32 px-1 flex-shrink-0 text-xs flex items-center">
          <InlineDateButton
            startDate={task.startDate}
            dueDate={task.dueDate}
            taskId={task.id}
            onSet={onDateSet}
            overdue={overdue}
          />
        </div>

        {/* Tiempo real */}
        <div className="w-24 px-2 flex-shrink-0 text-xs flex items-center gap-1">
          {loggedH > 0 ? (
            <>
              <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className={cn(
                "font-medium",
                task.estimatedHours && loggedH > task.estimatedHours ? "text-red-500" : "text-foreground"
              )}>
                {formatHours(loggedH)}
              </span>
              {task.estimatedHours && (
                <span className="text-muted-foreground">/{task.estimatedHours}h</span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity">
              <Clock className="h-3 w-3" />
            </span>
          )}
          <button
            className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={e => { e.stopPropagation(); onOpen(task.id, true); }}
            title="Registrar horas"
          >
            <Clock className="h-3 w-3 text-primary" />
          </button>
        </div>

        {/* Cliente tag */}
        <div className="w-28 px-2 flex-shrink-0">
          {clientName && (
            <span className={cn(
              "inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded border truncate max-w-full",
              getClientTagColor(clientName)
            )}>
              {clientName}
            </span>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

interface SectionBlockProps {
  sectionName: string;
  tasks: Task[];
  projectId: number;
  allPersonnel: Personnel[];
  projectMembers?: { personnelId: number; name: string; role: string }[];
  onOpenTask: (id: number, focusTime?: boolean) => void;
  onToggleTask: (task: Task) => void;
  onDateSet: (taskId: number, d: Date | undefined) => void;
  onAssignee: (taskId: number, assigneeId: number | null) => void;
  onRefresh: () => void;
  clientName?: string | null;
  autoOpenAdd?: number;
  forceExpand?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
  sortBy?: string;
  allPersonnelForSort?: Personnel[];
  isFirst?: boolean;
  taskOrderOverride?: number[];
}

function SectionBlock({ sectionName, tasks, projectId, allPersonnel, projectMembers = [], onOpenTask, onToggleTask, onDateSet, onAssignee, onRefresh, clientName, autoOpenAdd = 0, forceExpand = false, dragHandleProps, isDragging, sortBy = 'default', allPersonnelForSort = [], isFirst = false, taskOrderOverride }: SectionBlockProps) {
  const [collapsed, setCollapsed] = useState(false);
  const effectiveCollapsed = forceExpand ? false : collapsed;
  const [showAdd, setShowAdd] = useState(false);
  const [renamingSection, setRenamingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState(sectionName);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [expandedSubtasks, setExpandedSubtasks] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (autoOpenAdd > 0) setShowAdd(true);
  }, [autoOpenAdd]);

  const rootTasks = tasks.filter(t => !t.parentTaskId);
  const subtaskMap: Record<number, Task[]> = {};
  tasks.filter(t => t.parentTaskId).forEach(sub => {
    if (!subtaskMap[sub.parentTaskId!]) subtaskMap[sub.parentTaskId!] = [];
    subtaskMap[sub.parentTaskId!].push(sub);
  });

  const done = rootTasks.filter(t => t.status === "done").length;
  const totalLogged = tasks.reduce((acc, t) => acc + (t.loggedHours || 0), 0);

  const renameMutation = useMutation({
    mutationFn: (newName: string) => apiRequest("/api/tasks/section/rename", "PUT", { projectId, oldName: sectionName, newName }),
    onSuccess: () => { onRefresh(); setRenamingSection(false); toast({ title: "Sección renombrada" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("/api/tasks/section", "DELETE", { projectId, sectionName }),
    onSuccess: () => { onRefresh(); toast({ title: "Sección eliminada", description: "Las tareas se movieron a General" }); },
  });

  const handleRenameBlur = () => {
    const trimmed = newSectionName.trim();
    if (trimmed && trimmed !== sectionName) {
      renameMutation.mutate(trimmed);
    } else {
      setRenamingSection(false);
      setNewSectionName(sectionName);
    }
  };

  const toggleSubtasks = (taskId: number) => {
    setExpandedSubtasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const rawRootTasks = tasks.filter(t => !t.parentTaskId);
  const orderedRootTasks = taskOrderOverride
    ? taskOrderOverride.map(id => rawRootTasks.find(t => t.id === id)).filter(Boolean) as Task[]
    : rawRootTasks;
  const sortedRootTasks = sortTaskList(orderedRootTasks, sortBy, allPersonnelForSort);

  return (
    <div className={cn(isDragging && "opacity-50 bg-accent/10")}>
      {/* Separator between sections — thick top border for non-first sections */}
      {!isFirst && <div className="h-px bg-border/60" />}
      {/* Section header row */}
      <div
        className="flex items-center border-b border-border bg-muted/50 hover:bg-muted/70 cursor-pointer transition-colors group"
        onClick={() => !renamingSection && setCollapsed(!collapsed)}
      >
        {/* Drag handle for section */}
        <div
          {...dragHandleProps}
          className="w-5 flex-shrink-0 flex items-center justify-center py-3 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
          onClick={e => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60" />
        </div>
        <div className="w-3 flex-shrink-0 flex items-center justify-center py-3">
          {effectiveCollapsed
            ? <ChevronRight className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
          }
        </div>
        <div className="w-5 flex-shrink-0" />
        <div className="flex-1 px-2 py-3 flex items-center gap-2">
          {renamingSection ? (
            <Input
              autoFocus
              value={newSectionName}
              onChange={e => setNewSectionName(e.target.value)}
              onBlur={handleRenameBlur}
              onKeyDown={e => {
                e.stopPropagation();
                if (e.key === "Enter") handleRenameBlur();
                if (e.key === "Escape") { setRenamingSection(false); setNewSectionName(sectionName); }
              }}
              onClick={e => e.stopPropagation()}
              className="h-6 text-sm font-bold border-primary bg-background w-48 px-1.5"
            />
          ) : (
            <span className="font-bold text-sm text-foreground tracking-tight">{sectionName}</span>
          )}
          <span className="text-xs text-muted-foreground font-medium">{done}/{rootTasks.length}</span>
          {!effectiveCollapsed && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 ml-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={e => { e.stopPropagation(); setShowAdd(true); }}
              >
                <Plus className="h-3 w-3" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={e => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                  <DropdownMenuItem onClick={e => { e.stopPropagation(); setRenamingSection(true); setNewSectionName(sectionName); }}>
                    <Pencil className="h-3.5 w-3.5 mr-2" />
                    Renombrar sección
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600"
                    onClick={e => { e.stopPropagation(); setShowDeleteConfirm(true); }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Eliminar sección
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
        <div className="w-28 px-2 flex-shrink-0" />
        <div className="w-24 px-2 flex-shrink-0" />
        <div className="w-32 px-2 flex-shrink-0" />
        <div className="w-24 px-2 flex-shrink-0 text-xs text-muted-foreground font-medium">
          {totalLogged > 0 && <span>SUMA {formatHours(totalLogged)}</span>}
        </div>
        <div className="w-28 px-2 flex-shrink-0" />
      </div>

      {!effectiveCollapsed && (
        <>
          <SortableContext items={sortedRootTasks.map(t => `task:${t.id}`)} strategy={verticalListSortingStrategy}>
          {sortedRootTasks.map(task => (
            <SortableTaskRow
              key={task.id}
              taskId={task.id}
              task={task}
              allPersonnel={allPersonnel}
              onOpenTask={onOpenTask}
              onToggleTask={onToggleTask}
              onDateSet={onDateSet}
              onAssignee={onAssignee}
              clientName={clientName}
              subtaskMap={subtaskMap}
              expandedSubtasks={expandedSubtasks}
              onToggleSubtasks={toggleSubtasks}
            />
          ))}
          </SortableContext>

          {showAdd ? (
            <NewTaskRow
              projectId={projectId}
              sectionName={sectionName}
              onCreated={() => { setShowAdd(false); onRefresh(); }}
              onCancel={() => setShowAdd(false)}
              allPersonnel={allPersonnel}
              projectMembers={projectMembers}
            />
          ) : (
            <div className="flex items-center border-b border-border">
              <div className="w-8 flex-shrink-0" />
              <button
                className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                onClick={() => setShowAdd(true)}
              >
                <Plus className="h-3 w-3" />Agregar tarea
              </button>
            </div>
          )}
        </>
      )}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar sección "{sectionName}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Las tareas de esta sección se moverán a "General". Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteMutation.mutate()}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Sortable wrappers ──────────────────────────────────────────────────────

function SortableTaskRow({ taskId, task, allPersonnel, onOpenTask, onToggleTask, onDateSet, onAssignee, clientName, subtaskMap, expandedSubtasks, onToggleSubtasks }: {
  taskId: number;
  task: Task;
  allPersonnel: Personnel[];
  onOpenTask: (id: number, ft?: boolean) => void;
  onToggleTask: (task: Task) => void;
  onDateSet: (taskId: number, d: Date | undefined) => void;
  onAssignee: (taskId: number, assigneeId: number | null) => void;
  clientName?: string | null;
  subtaskMap?: Record<number, Task[]>;
  expandedSubtasks?: Set<number>;
  onToggleSubtasks?: (taskId: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `task:${taskId}`,
    data: { type: 'task', taskId, task },
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style}>
      <TaskRow
        task={task}
        allPersonnel={allPersonnel}
        onOpen={onOpenTask}
        onToggle={onToggleTask}
        onDateSet={onDateSet}
        onAssignee={onAssignee}
        clientName={clientName}
        subtaskMap={subtaskMap}
        expandedSubtasks={expandedSubtasks}
        onToggleSubtasks={onToggleSubtasks}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
      {expandedSubtasks?.has(taskId) && (subtaskMap?.[taskId] || []).map(sub => (
        <TaskRow
          key={sub.id}
          task={sub}
          allPersonnel={allPersonnel}
          onOpen={onOpenTask}
          onToggle={onToggleTask}
          onDateSet={onDateSet}
          onAssignee={onAssignee}
          isSubtask
        />
      ))}
    </div>
  );
}

function SortableSectionBlock(props: SectionBlockProps & { sectionName: string; sortBy?: string; allPersonnelForSort?: Personnel[]; isFirst?: boolean; taskOrderOverride?: number[] }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `section:${props.sectionName}`,
    data: { type: 'section', sectionName: props.sectionName },
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style}>
      <SectionBlock
        {...props}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  );
}

// ─── Board / Kanban view ────────────────────────────────────────────────────

const BOARD_COLUMNS = [
  { status: "todo",        label: "Por hacer",   dot: "bg-gray-400",  ring: "border-t-gray-300",  empty: "Acá aparecerán las tareas nuevas" },
  { status: "in_progress", label: "En progreso",  dot: "bg-blue-500",  ring: "border-t-blue-400",  empty: "Mové una tarea aquí para comenzar" },
  { status: "done",        label: "Completado",   dot: "bg-green-500", ring: "border-t-green-400", empty: "Las tareas finalizadas aparecen aquí" },
];

interface BoardColumnProps {
  label: string;
  dot: string;
  ring: string;
  empty: string;
  status: string;
  tasks: Task[];
  allPersonnel: Personnel[];
  projectId: number;
  projectMembers: { personnelId: number; name: string; role: string }[];
  onOpen: (id: number) => void;
  onRefresh: () => void;
}

const PRIORITY_LEFT_BORDER: Record<string, string> = {
  low: "border-l-gray-300",
  medium: "border-l-transparent",
  high: "border-l-orange-400",
  urgent: "border-l-red-500",
};

function BoardColumn({ label, dot, ring, empty, status, tasks, allPersonnel, projectId, projectMembers, onOpen, onRefresh }: BoardColumnProps) {
  const [showAdd, setShowAdd] = useState(false);

  const toggleMutation = useMutation({
    mutationFn: (task: Task) =>
      apiRequest(`/api/tasks/${task.id}`, "PUT", {
        status: task.status === "done" ? "todo" : "done",
      }),
    onSuccess: () => onRefresh(),
  });

  return (
    <div className={cn("flex-1 min-w-0 flex flex-col rounded-xl border-t-2 border border-border bg-muted/5", ring)}>
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/60">
        <div className="flex items-center gap-2">
          <span className={cn("w-2 h-2 rounded-full flex-shrink-0", dot)} />
          <span className="font-semibold text-xs text-foreground">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {(() => {
            const estH = tasks.reduce((s, t) => s + (t.estimatedHours || 0), 0);
            const logH = tasks.reduce((s, t) => s + (t.loggedHours || 0), 0);
            if (estH > 0 || logH > 0) {
              return (
                <span className="text-[10px] text-muted-foreground">
                  {logH > 0 ? `${formatHours(logH)} / ` : ""}{estH > 0 ? `${formatHours(estH)} est.` : ""}
                </span>
              );
            }
            return null;
          })()}
          <span className="text-[11px] font-medium text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
            {tasks.length}
          </span>
        </div>
      </div>

      <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px] max-h-[calc(100vh-280px)]">
        {tasks.length === 0 && !showAdd && (
          <div className="flex flex-col items-center justify-center py-8 text-center px-2">
            <span className={cn("w-8 h-8 rounded-full mb-2 flex items-center justify-center opacity-20", dot.replace("bg-", "bg-").concat(" bg-opacity-20"))}>
              <span className={cn("w-3 h-3 rounded-full", dot)} />
            </span>
            <p className="text-[11px] text-muted-foreground/60 leading-tight">{empty}</p>
          </div>
        )}

        {tasks.map(task => {
          const assignee = allPersonnel.find(p => p.id === task.assigneeId);
          const overdue = isOverdue(task);
          const isDone = task.status === "done";
          const leftBorder = PRIORITY_LEFT_BORDER[task.priority] || "border-l-transparent";
          return (
            <div
              key={task.id}
              className={cn(
                "bg-card rounded-lg border border-border border-l-2 p-2.5 cursor-pointer",
                "hover:shadow-md hover:border-primary/20 hover:-translate-y-px transition-all duration-150",
                isDone && "opacity-50",
                leftBorder
              )}
              onClick={() => onOpen(task.id)}
            >
              <div className="flex items-start gap-2 mb-2">
                <div className="mt-0.5 flex-shrink-0">
                  <CircleCheck
                    checked={isDone}
                    onClick={e => { e.stopPropagation(); toggleMutation.mutate(task); }}
                  />
                </div>
                <p className={cn("text-sm font-medium leading-snug flex-1 min-w-0", isDone && "line-through text-muted-foreground")}>
                  {task.title}
                </p>
              </div>
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {task.priority && task.priority !== "medium" && (
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium", PRIORITY_BADGE[task.priority])}>
                      {PRIORITY_LABELS[task.priority]}
                    </span>
                  )}
                  {task.dueDate && (
                    <span className={cn(
                      "text-[10px] flex items-center gap-0.5",
                      overdue ? "text-red-500 font-semibold" : "text-muted-foreground"
                    )}>
                      <CalendarIcon className="h-2.5 w-2.5" />
                      {format(new Date(task.dueDate), "d MMM", { locale: es })}
                    </span>
                  )}
                </div>
                {assignee && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Avatar className="h-5 w-5 flex-shrink-0 ring-1 ring-border">
                          <AvatarFallback className={cn("text-[8px] text-white", getAvatarColor(assignee.id))}>
                            {getInitials(assignee.name)}
                          </AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>{assignee.name}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          );
        })}

        {showAdd ? (
          <div className="bg-card rounded-lg border border-primary/30 p-2">
            <NewTaskRow
              projectId={projectId}
              sectionName="General"
              defaultStatus={status}
              onCreated={() => { setShowAdd(false); onRefresh(); }}
              onCancel={() => setShowAdd(false)}
              allPersonnel={allPersonnel}
              projectMembers={projectMembers}
            />
          </div>
        ) : (
          <button
            className="w-full flex items-center gap-1.5 px-2 py-2 text-xs text-muted-foreground hover:text-primary transition-colors rounded-lg hover:bg-accent/50 group"
            onClick={() => setShowAdd(true)}
          >
            <Plus className="h-3 w-3 group-hover:scale-110 transition-transform" />
            Agregar tarea
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

interface Props {
  projectId: number;
  projectMembers?: { personnelId: number; name: string; role: string }[];
  view?: "list" | "board";
  clientName?: string | null;
  onQuickAddTrigger?: number;
  filterText?: string;
  sortBy?: string;
  groupBy?: string;
}

export default function ProjectTaskList({ projectId, projectMembers = [], view = "list", clientName, onQuickAddTrigger = 0, filterText = "", sortBy = 'default', groupBy = 'section' }: Props) {
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [focusTime, setFocusTime] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [firstSectionAutoAdd, setFirstSectionAutoAdd] = useState(0);
  const [sectionOrder, setSectionOrder] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(`sectionOrder:${projectId}`) || '[]'); } catch { return []; }
  });
  const [taskOrderMap, setTaskOrderMap] = useState<Record<string, number[]>>({});
  useEffect(() => { setTaskOrderMap({}); }, [projectId]);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [activeDragData, setActiveDragData] = useState<any>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    if (onQuickAddTrigger > 0) {
      setFirstSectionAutoAdd(v => v + 1);
    }
  }, [onQuickAddTrigger]);

  const { data, isLoading, refetch } = useQuery<{ tasks: Task[]; sections: Record<string, Task[]> }>({
    queryKey: ["/api/tasks/project", projectId],
    queryFn: () => authFetch(`/api/tasks/project/${projectId}`).then(r => r.json()),
    staleTime: 30 * 1000,
  });


  const { data: allPersonnel = [] } = useQuery<Personnel[]>({
    queryKey: ["/api/tasks-personnel"],
    queryFn: () => authFetch("/api/tasks-personnel").then(r => r.json()),
  });

  const toggleMutation = useMutation({
    mutationFn: (task: Task) => apiRequest(`/api/tasks/${task.id}`, "PUT", {
      status: task.status === "done" ? "todo" : "done",
    }),
    onSuccess: () => refetch(),
  });

  const dateMutation = useMutation({
    mutationFn: ({ taskId, date }: { taskId: number; date: Date | undefined }) =>
      apiRequest(`/api/tasks/${taskId}`, "PUT", { dueDate: date ? date.toISOString() : null }),
    onSuccess: () => refetch(),
  });

  const handleDateSet = (taskId: number, d: Date | undefined) => {
    dateMutation.mutate({ taskId, date: d });
  };

  const inlineUpdateMutation = useMutation({
    mutationFn: ({ taskId, updates }: { taskId: number; updates: any }) =>
      apiRequest(`/api/tasks/${taskId}`, "PUT", updates),
    onSuccess: () => refetch(),
  });

  const handleAssignee = (taskId: number, assigneeId: number | null) => {
    inlineUpdateMutation.mutate({ taskId, updates: { assigneeId } });
  };

  const createSectionTask = useMutation({
    mutationFn: (data: any) => apiRequest("/api/tasks", "POST", data),
    onSuccess: () => { refetch(); setShowAddSection(false); setNewSectionName(""); },
  });

  const allTasksRaw = data?.tasks || [];
  const sectionsRaw = data?.sections || {};

  // Apply filter
  const allTasks = filterText.trim()
    ? allTasksRaw.filter(t => t.title.toLowerCase().includes(filterText.toLowerCase()))
    : allTasksRaw;

  // When filtering, rebuild sections from filtered tasks
  const baseSections: Record<string, Task[]> = filterText.trim()
    ? allTasks.reduce((acc: Record<string, Task[]>, t) => {
        const sec = t.sectionName || "General";
        if (!acc[sec]) acc[sec] = [];
        acc[sec].push(t);
        return acc;
      }, {})
    : sectionsRaw;

  // Apply groupBy override
  const sections: Record<string, Task[]> = groupBy === 'section'
    ? baseSections
    : allTasks.reduce((acc: Record<string, Task[]>, t) => {
        let key = 'Sin asignar';
        if (groupBy === 'assignee') {
          const p = allPersonnel.find(p => p.id === t.assigneeId);
          key = p?.name || 'Sin asignar';
        } else if (groupBy === 'priority') {
          key = PRIORITY_LABELS[t.priority] || 'Sin prioridad';
        }
        if (!acc[key]) acc[key] = [];
        acc[key].push(t);
        return acc;
      }, {});

  // Apply sectionOrder (only for section grouping)
  const rawSectionNames = Object.keys(sections);
  const orderedSectionNames: string[] = groupBy !== 'section' ? rawSectionNames : (() => {
    const saved = sectionOrder.filter(s => rawSectionNames.includes(s));
    const newOnes = rawSectionNames.filter(s => !saved.includes(s));
    return [...saved, ...newOnes];
  })();

  const totalTasks = allTasks.filter(t => !t.parentTaskId).length;
  const doneTasks = allTasks.filter(t => t.status === "done" && !t.parentTaskId).length;

  const handleOpen = (id: number, ft = false) => {
    setFocusTime(ft);
    setSelectedTaskId(id);
  };

  // ─── DnD handlers ──────────────────────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
    setActiveDragData(event.active.data.current);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveDragData(null);
    console.log('[DnD] end — active:', active.id, 'over:', over?.id ?? 'null');
    if (!over || active.id === over.id) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (activeData?.type === 'section') {
      const activeSection = activeData.sectionName as string;
      let overSection: string;
      if (overData?.type === 'section') {
        overSection = overData.sectionName;
      } else {
        return;
      }
      const oldIndex = orderedSectionNames.indexOf(activeSection);
      const newIndex = orderedSectionNames.indexOf(overSection);
      if (oldIndex === -1 || newIndex === -1) return;
      const newOrder = arrayMove(orderedSectionNames, oldIndex, newIndex);
      setSectionOrder(newOrder);
      localStorage.setItem(`sectionOrder:${projectId}`, JSON.stringify(newOrder));
    } else if (activeData?.type === 'task') {
      const taskId = activeData.taskId as number;
      const activeTask = activeData.task as Task;
      const fromSection = activeTask.sectionName || 'General';
      let targetSection: string;

      if (overData?.type === 'task') {
        targetSection = (overData.task as Task).sectionName || 'General';
      } else if (overData?.type === 'section') {
        targetSection = overData.sectionName;
      } else {
        return;
      }

      // Get current ordered IDs for each section (from override or from sections data)
      const getOrderedIds = (sec: string) =>
        taskOrderMap[sec] ?? (sections[sec] || []).filter(t => !t.parentTaskId).map(t => t.id);

      const fromIds = getOrderedIds(fromSection);
      const toIds = fromSection === targetSection ? fromIds : getOrderedIds(targetSection);

      if (fromSection === targetSection) {
        // Same-section reorder
        const fromIdx = fromIds.indexOf(taskId);
        const toTask = overData?.type === 'task' ? (overData.task as Task) : null;
        const toIdx = toTask ? toIds.indexOf(toTask.id) : toIds.length - 1;
        if (fromIdx === -1) return;
        const newIds = arrayMove(fromIds, fromIdx, toIdx >= 0 ? toIdx : toIds.length - 1);
        setTaskOrderMap(prev => ({ ...prev, [fromSection]: newIds }));

        const posMap = new Map(newIds.map((id, i) => [id, i]));
        const applySameSectionOrder = () => {
          queryClient.setQueryData(["/api/tasks/project", projectId], (old: any) => {
            if (!old) return old;
            const reorderedSection = [...(old.sections[fromSection] || [])].sort((a: Task, b: Task) => {
              if (!a.parentTaskId && !b.parentTaskId) return (posMap.get(a.id) ?? 9999) - (posMap.get(b.id) ?? 9999);
              return 0;
            });
            const otherTasks = old.tasks.filter((t: Task) => (t.sectionName || 'General') !== fromSection);
            return { tasks: [...otherTasks, ...reorderedSection], sections: { ...old.sections, [fromSection]: reorderedSection } };
          });
        };

        applySameSectionOrder();

        apiRequest("/api/tasks/reorder", "POST", { taskIds: newIds })
          .then(() => applySameSectionOrder())
          .catch((e: any) => console.error('[DnD] reorder failed:', e?.message));
      } else {
        // Cross-section move
        const newFromIds = fromIds.filter(id => id !== taskId);
        const toTask = overData?.type === 'task' ? (overData.task as Task) : null;
        const insertIdx = toTask ? toIds.indexOf(toTask.id) : toIds.length;
        const newToIds = [...toIds];
        newToIds.splice(insertIdx >= 0 ? insertIdx : newToIds.length, 0, taskId);
        setTaskOrderMap(prev => ({ ...prev, [fromSection]: newFromIds, [targetSection]: newToIds }));

        const fromPosMap = new Map(newFromIds.map((id, i) => [id, i]));
        const toPosMap = new Map(newToIds.map((id, i) => [id, i]));
        const applyCrossSectionOrder = () => {
          queryClient.setQueryData(["/api/tasks/project", projectId], (old: any) => {
            if (!old) return old;
            const movedTask = old.tasks.find((t: Task) => t.id === taskId);
            if (!movedTask) return old;
            const updatedMovedTask = { ...movedTask, sectionName: targetSection };
            const updatedTasks = old.tasks.map((t: Task) => t.id === taskId ? updatedMovedTask : t);
            const newFromSection = [...(old.sections[fromSection] || []).filter((t: Task) => t.id !== taskId)].sort((a: Task, b: Task) => {
              if (!a.parentTaskId && !b.parentTaskId) return (fromPosMap.get(a.id) ?? 9999) - (fromPosMap.get(b.id) ?? 9999);
              return 0;
            });
            const toSectionBase = (old.sections[targetSection] || []).filter((t: Task) => t.id !== taskId);
            const newToSection = [...toSectionBase, updatedMovedTask].sort((a: Task, b: Task) => {
              if (!a.parentTaskId && !b.parentTaskId) return (toPosMap.get(a.id) ?? 9999) - (toPosMap.get(b.id) ?? 9999);
              return 0;
            });
            return { tasks: updatedTasks, sections: { ...old.sections, [fromSection]: newFromSection, [targetSection]: newToSection } };
          });
        };

        applyCrossSectionOrder();

        const p1 = newFromIds.length > 0 ? apiRequest("/api/tasks/reorder", "POST", { taskIds: newFromIds }) : Promise.resolve();
        const p2 = newToIds.length > 0 ? apiRequest("/api/tasks/reorder", "POST", { taskIds: newToIds, sectionName: targetSection }) : Promise.resolve();
        Promise.all([p1, p2]).then(() => applyCrossSectionOrder()).catch(() => {});
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      {filterText.trim() && (
        <div className="mb-2 text-xs text-muted-foreground px-1">
          {allTasks.length} resultado{allTasks.length !== 1 ? "s" : ""} para "{filterText}"
        </div>
      )}

      {view === "board" ? (
        // ─── Board view ───────────────────────────────────────────────
        <div>
          <div className="flex items-center gap-2 pb-3 mb-1">
            <span className="text-sm font-medium text-foreground">{totalTasks} tareas</span>
            <span className="text-xs text-muted-foreground">· {doneTasks} completadas</span>
          </div>
          <div className="flex gap-3">
            {BOARD_COLUMNS.map(col => (
              <BoardColumn
                key={col.status}
                label={col.label}
                dot={col.dot}
                ring={col.ring}
                empty={col.empty}
                status={col.status}
                tasks={allTasks.filter(t => t.status === col.status && !t.parentTaskId)}
                allPersonnel={allPersonnel}
                projectId={projectId}
                projectMembers={projectMembers}
                onOpen={id => handleOpen(id)}
                onRefresh={refetch}
              />
            ))}
          </div>
        </div>
      ) : (
        // ─── List view ────────────────────────────────────────────────
        <div>
          <div className="flex items-center justify-end pb-2 mb-1">
            <Button size="sm" className="h-7 text-xs" onClick={() => setShowAddSection(true)}>
              <Plus className="h-3 w-3 mr-1" />Nueva sección
            </Button>
          </div>

          {orderedSectionNames.length === 0 ? (
            <div className="text-center py-12 rounded-xl border border-dashed border-border">
              <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center mx-auto mb-3">
                <Plus className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground mb-3">Todavía no hay secciones ni tareas en este proyecto</p>
              <Button size="sm" onClick={() => setShowAddSection(true)}>Crear primera sección</Button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="rounded-xl border border-border overflow-hidden">
                {/* Column headers */}
                <div className="flex items-center bg-muted/30 border-b border-border text-xs font-semibold text-muted-foreground">
                  <div className="w-8 flex-shrink-0" />
                  <div className="w-5 flex-shrink-0" />
                  <div className="flex-1 px-2 py-2.5">Nombre de tarea</div>
                  <div className="w-28 px-2 flex-shrink-0 py-2.5">Responsable</div>
                  <div className="w-24 px-2 flex-shrink-0 py-2.5">Colaboradores</div>
                  <div className="w-32 px-2 flex-shrink-0 py-2.5">Fechas</div>
                  <div className="w-24 px-2 flex-shrink-0 py-2.5">Tiempo real</div>
                  <div className="w-28 px-2 flex-shrink-0 py-2.5">Cliente</div>
                </div>

                <SortableContext
                  items={orderedSectionNames.map(s => `section:${s}`)}
                  strategy={verticalListSortingStrategy}
                >
                  {orderedSectionNames.map((section, idx) => (
                    <SortableSectionBlock
                      key={section}
                      sectionName={section}
                      tasks={sections[section] || []}
                      projectId={projectId}
                      allPersonnel={allPersonnel}
                      projectMembers={projectMembers}
                      onOpenTask={handleOpen}
                      onToggleTask={(task) => toggleMutation.mutate(task)}
                      onDateSet={handleDateSet}
                      onAssignee={handleAssignee}
                      onRefresh={refetch}
                      clientName={clientName}
                      autoOpenAdd={idx === 0 ? firstSectionAutoAdd : 0}
                      forceExpand={!!filterText.trim()}
                      sortBy={sortBy}
                      allPersonnelForSort={allPersonnel}
                      isFirst={idx === 0}
                      taskOrderOverride={taskOrderMap[section]}
                    />
                  ))}
                </SortableContext>
              </div>
            </DndContext>
          )}

          {showAddSection && (
            <div className="flex items-center gap-2 p-3 mt-3 border rounded-lg bg-accent/20">
              <Input
                autoFocus
                value={newSectionName}
                onChange={e => setNewSectionName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && newSectionName.trim()) {
                    createSectionTask.mutate({ title: "Nueva tarea", projectId, sectionName: newSectionName.trim(), status: "todo", priority: "medium" });
                  }
                  if (e.key === "Escape") { setShowAddSection(false); setNewSectionName(""); }
                }}
                placeholder="Nombre de la sección..."
                className="h-8 text-sm"
              />
              <Button
                size="sm"
                onClick={() => {
                  if (newSectionName.trim()) {
                    createSectionTask.mutate({ title: "Nueva tarea", projectId, sectionName: newSectionName.trim(), status: "todo", priority: "medium" });
                  }
                }}
                disabled={!newSectionName.trim() || createSectionTask.isPending}
              >
                Crear
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowAddSection(false); setNewSectionName(""); }}>Cancelar</Button>
            </div>
          )}
        </div>
      )}

      <TaskDetailPanel
        taskId={selectedTaskId}
        open={!!selectedTaskId}
        onClose={() => { setSelectedTaskId(null); setFocusTime(false); }}
        onUpdate={refetch}
        initialFocusTime={focusTime}
        onNavigateToTask={(id) => setSelectedTaskId(id)}
      />
    </div>
  );
}
