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
import type { DateRange } from "react-day-picker";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Plus, ChevronDown, ChevronRight, CalendarIcon, Clock, Flag, Loader2, Check,
  MoreHorizontal, Pencil, Trash2, GripVertical, CheckCircle2, ListTodo
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskStatusBadge } from "@/components/ui/status-badge";
import { TASK_STATUS_CONFIG, BOARD_STATUS_COLUMNS } from "@/constants/task-statuses";
import TaskDetailPanel from "./TaskDetailPanel";
import QuickTaskHours from "./QuickTaskHours";
import { ErrorBoundary } from "@/components/error-boundary";
import { toast } from "@/hooks/use-toast";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, DragOverEvent,
  PointerSensor, useSensor, useSensors, closestCenter, UniqueIdentifier,
  useDroppable, useDraggable,
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
  estimatedHoursTotal?: number;
  estimatedHoursForWeek?: number;
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

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-gray-300",
  medium: "bg-yellow-400",
  high: "bg-orange-500",
  urgent: "bg-red-500",
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

function parseCivilTaskDate(value?: string | null) {
  if (!value) return undefined;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return undefined;
  return new Date(year, month - 1, day);
}

function isOverdue(task: Task) {
  const dueDate = parseCivilTaskDate(task.dueDate);
  return dueDate && dueDate < new Date() && task.status !== "done";
}

function isDueSoon(task: Task) {
  if (!task.dueDate || task.status === "done" || isOverdue(task)) return false;
  const diff = parseCivilTaskDate(task.dueDate)!.getTime() - new Date().getTime();
  return diff >= 0 && diff < 2 * 24 * 60 * 60 * 1000;
}

function isDueThisWeek(task: Task) {
  if (!task.dueDate || task.status === "done" || isOverdue(task) || isDueSoon(task)) return false;
  const diff = parseCivilTaskDate(task.dueDate)!.getTime() - new Date().getTime();
  return diff >= 0 && diff < 7 * 24 * 60 * 60 * 1000;
}

function formatHours(hours: number) {
  return `${(Math.round(hours * 100) / 100).toFixed(2)} h`;
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
    const s = format(parseCivilTaskDate(startDate)!, "d MMM", { locale: es });
    const d = format(parseCivilTaskDate(dueDate)!, "d MMM", { locale: es });
    return `${s} – ${d}`;
  }
  if (dueDate) return format(parseCivilTaskDate(dueDate)!, "d MMM", { locale: es });
  if (startDate) return `${format(parseCivilTaskDate(startDate)!, "d MMM", { locale: es })} →`;
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

function InlineDateButton({ startDate, dueDate, taskId, onSet, overdue, dueSoon, dueThisWeek }: {
  startDate?: string | null;
  dueDate?: string | null;
  taskId: number;
  onSet: (taskId: number, range: DateRange | undefined) => void;
  overdue: boolean;
  dueSoon?: boolean;
  dueThisWeek?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const label = formatDateRange(startDate, dueDate);
  const dateColorClass = label
    ? overdue
      ? "text-red-500 font-medium hover:bg-red-50"
      : dueSoon
        ? "text-amber-500 font-medium hover:bg-amber-50"
        : dueThisWeek
          ? "text-blue-500 hover:bg-blue-50"
          : "text-muted-foreground hover:bg-accent"
    : "text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-primary";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={e => { e.stopPropagation(); setOpen(true); }}
          className={cn("flex items-center gap-1 text-xs rounded px-1 py-0.5 transition-all whitespace-nowrap", dateColorClass)}
        >
          {(overdue || dueSoon) && label && (
            <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", overdue ? "bg-red-500" : "bg-amber-500")} />
          )}
          {label || <CalendarIcon className="h-3 w-3" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 shadow-lg" onClick={e => e.stopPropagation()}>
        <Calendar
          mode="range"
          selected={{ from: parseCivilTaskDate(startDate), to: parseCivilTaskDate(dueDate) }}
          onSelect={(range) => { onSet(taskId, range); if (range?.from && range?.to) setOpen(false); }}
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
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [dateRangeOpen, setDateRangeOpen] = useState(false);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/tasks", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/team-calendar"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/projects"] });
      onCreated();
    },
  });

  const handleCreate = () => {
    if (!title.trim()) return;
    createMutation.mutate({
      title: title.trim(),
      projectId,
      sectionName,
      assigneeId: assigneeId !== "none" ? parseInt(assigneeId) : null,
      startDate: startDate ? format(startDate, "yyyy-MM-dd") : null,
      dueDate: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
      status: defaultStatus,
      priority: "medium",
    });
  };

  const memberIds = projectMembers.map(m => m.personnelId);
  const memberPersonnel = allPersonnel.filter(p => memberIds.includes(p.id));

  return (
    <div className="flex items-center border-b border-border hover:bg-accent/20 transition-colors">
      <div className="hidden w-8 flex-shrink-0 sm:block" />
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
      <div className="hidden w-28 px-2 flex-shrink-0 sm:block">
        <Select value={assigneeId} onValueChange={setAssigneeId}>
          <SelectTrigger className="h-7 text-xs border-none bg-transparent shadow-none">
            <SelectValue placeholder="Asignar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin asignar</SelectItem>
            {memberPersonnel.map(p => (
              <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
            ))}
            {memberPersonnel.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">Agregá miembros al proyecto primero</div>
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="hidden w-40 px-1 flex-shrink-0 md:block">
        <Popover open={dateRangeOpen} onOpenChange={setDateRangeOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-full px-1 text-[10px] font-normal">
              {startDate && dueDate
                ? `${format(startDate, "d MMM", { locale: es })} – ${format(dueDate, "d MMM", { locale: es })}`
                : "Definir rango"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="range"
              selected={{ from: startDate, to: dueDate }}
              onSelect={(range) => {
                setStartDate(range?.from);
                setDueDate(range?.to);
                if (range?.from && range?.to) setDateRangeOpen(false);
              }}
              locale={es}
            />
            {(startDate || dueDate) && <div className="border-t p-2">
              <Button variant="ghost" size="sm" className="h-7 w-full text-xs text-muted-foreground"
                onClick={() => { setStartDate(undefined); setDueDate(undefined); }}>
                Quitar rango
              </Button>
            </div>}
          </PopoverContent>
        </Popover>
      </div>
      <div className="hidden w-28 px-2 flex-shrink-0 xl:block" />
      <div className="w-20 px-1 flex-shrink-0 flex items-center justify-end gap-1 sm:w-24 sm:px-2">
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
  projectMembers?: { personnelId: number; name: string; role: string }[];
  onOpen: (id: number, focusTime?: boolean) => void;
  onToggle: (task: Task) => void;
  onDateSet: (taskId: number, range: DateRange | undefined) => void;
  onAssignee: (taskId: number, assigneeId: number | null) => void;
  onRename?: (taskId: number, newTitle: string) => void;
  onStatusChange?: (taskId: number, status: string) => void;
  onDuplicate?: (task: Task) => void;
  isSubtask?: boolean;
  clientName?: string | null;
  subtaskMap?: Record<number, Task[]>;
  expandedSubtasks?: Set<number>;
  onToggleSubtasks?: (taskId: number) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
}

function TaskRow({ task, allPersonnel, projectMembers = [], onOpen, onToggle, onDateSet, onAssignee, onRename, onStatusChange, onDuplicate, isSubtask = false, clientName, subtaskMap, expandedSubtasks, onToggleSubtasks, dragHandleProps, isDragging }: TaskRowProps) {
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [inlinePriority, setInlinePriority] = useState(task.priority);
  useEffect(() => setInlinePriority(task.priority), [task.priority]);
  const priorityMutation = useMutation({
    mutationFn: (priority: string) => apiRequest(`/api/tasks/${task.id}`, "PUT", { priority }),
    onMutate: (priority) => {
      const previous = inlinePriority;
      setInlinePriority(priority);
      return { previous };
    },
    onError: (_error, _priority, context) => {
      setInlinePriority(context?.previous ?? task.priority);
      toast({ title: "No se pudo cambiar la prioridad", variant: "destructive" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/project", task.projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/my-tasks"] });
    },
  });
  const assignee = allPersonnel.find(p => p.id === task.assigneeId);
  const collaborators = allPersonnel.filter(p => (task.collaboratorIds || []).includes(p.id));
  // La asignación es una propiedad del equipo del proyecto, nunca del directorio global.
  const memberIds = projectMembers.map(m => m.personnelId);
  const assignableList = allPersonnel.filter(p => memberIds.includes(p.id));
  const overdue = !!isOverdue(task);
  const dueSoon = isDueSoon(task);
  const dueThisWeek = isDueThisWeek(task);
  const isDone = task.status === "done";
  const loggedH = task.loggedHours || 0;
  const plannedH = task.estimatedHoursTotal ?? 0;
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
            className="hidden w-5 flex-shrink-0 items-center justify-center py-3 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity sm:flex"
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
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Prioridad: ${PRIORITY_LABELS[inlinePriority] || inlinePriority}`}
                className="grid h-6 w-6 flex-shrink-0 place-items-center rounded hover:bg-muted"
                onClick={(event) => event.stopPropagation()}
              >
                <span className={cn("h-2.5 w-2.5 rounded-full", PRIORITY_DOT[inlinePriority] || "bg-gray-200")} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-36 p-1" align="start" onClick={(event) => event.stopPropagation()}>
              {(["low", "medium", "high", "urgent"] as const).map((priority) => (
                <button
                  key={priority}
                  type="button"
                  className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent", inlinePriority === priority && "bg-primary/10 font-medium")}
                  onClick={() => priorityMutation.mutate(priority)}
                >
                  <span className={cn("h-2 w-2 rounded-full", PRIORITY_DOT[priority])} />
                  {PRIORITY_LABELS[priority]}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          {!isDone && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  onClick={e => e.stopPropagation()}
                  className="flex-shrink-0"
                >
                  {task.status === "todo"
                    ? <span className="text-[9px] text-muted-foreground/50 hover:text-muted-foreground border border-dashed border-muted-foreground/30 hover:border-muted-foreground/60 rounded px-1 py-0.5 transition-colors">estado</span>
                    : <TaskStatusBadge status={task.status} size="xs" />}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-36 p-1 shadow-lg" align="start" onClick={e => e.stopPropagation()}>
                {(["todo","in_progress","blocked"] as const).map(s => (
                  <button
                    key={s}
                    className={cn(
                      "w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent flex items-center gap-2 transition-colors",
                      task.status === s && "bg-primary/10 font-medium"
                    )}
                    onClick={() => onStatusChange?.(task.id, s)}
                  >
                    <span className={cn("w-2 h-2 rounded-full flex-shrink-0", TASK_STATUS_CONFIG[s].dot)} />
                    {TASK_STATUS_CONFIG[s].label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          )}
          {renaming ? (
            <Input
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              className="h-6 text-sm border-primary/40 focus-visible:ring-1 px-1 py-0"
              autoFocus
              onClick={e => e.stopPropagation()}
              onKeyDown={e => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  const trimmed = renameValue.trim();
                  if (trimmed && trimmed !== task.title) onRename?.(task.id, trimmed);
                  setRenaming(false);
                }
                if (e.key === "Escape") setRenaming(false);
              }}
              onBlur={() => {
                const trimmed = renameValue.trim();
                if (trimmed && trimmed !== task.title) onRename?.(task.id, trimmed);
                setRenaming(false);
              }}
            />
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn("text-sm truncate transition-all duration-150 cursor-text rounded px-0.5 hover:bg-accent/60", isDone && "line-through text-muted-foreground")}
                  onClick={e => { e.stopPropagation(); setRenameValue(task.title); setRenaming(true); }}
                >
                  {task.title}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">Click para renombrar · {task.title}</TooltipContent>
            </Tooltip>
          )}
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
        <div className="w-12 px-1 flex-shrink-0 flex items-center justify-center sm:w-28 sm:justify-start sm:px-2">
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
                {assignableList.map(p => (
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

        {/* Fecha entrega / rango */}
        <div className="hidden w-32 px-1 flex-shrink-0 text-xs items-center md:flex">
          <InlineDateButton
            startDate={task.startDate}
            dueDate={task.dueDate}
            taskId={task.id}
            onSet={onDateSet}
            overdue={overdue}
            dueSoon={dueSoon}
            dueThisWeek={dueThisWeek}
          />
        </div>

        {/* Tiempo real */}
        <div className="hidden w-24 px-2 flex-shrink-0 text-xs items-center gap-1 lg:flex">
          {loggedH > 0 || plannedH > 0 ? (
            <>
              <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className={cn(
                "font-medium",
                plannedH > 0 && loggedH > plannedH ? "text-red-500" : "text-foreground"
              )}>
                {formatHours(loggedH)}
              </span>
              {plannedH > 0 && (
                <span className="text-muted-foreground">/{plannedH}h</span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity">
              <Clock className="h-3 w-3" />
            </span>
          )}
          <QuickTaskHours taskId={task.id} className="ml-auto" />
        </div>

        {/* Cliente tag */}
        <div className="hidden w-28 px-2 flex-shrink-0 xl:block">
          {clientName && (
            <span className={cn(
              "inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded border truncate max-w-full",
              getClientTagColor(clientName)
            )}>
              {clientName}
            </span>
          )}
        </div>

        {/* Acciones contextuales */}
        {(onStatusChange || onDuplicate) && (
          <div className="w-8 flex-shrink-0 flex items-center justify-center opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-1 rounded hover:bg-accent transition-colors"
                  onClick={e => e.stopPropagation()}
                  title="Acciones"
                >
                  <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44" onClick={e => e.stopPropagation()}>
                {onDuplicate && (
                  <>
                    <DropdownMenuItem onClick={() => { setRenaming(true); setRenameValue(task.title); }}>
                      <Pencil className="h-3.5 w-3.5 mr-2" />Renombrar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDuplicate(task)}>
                      <ListTodo className="h-3.5 w-3.5 mr-2" />Duplicar
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
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
  onDateSet: (taskId: number, range: DateRange | undefined) => void;
  onAssignee: (taskId: number, assigneeId: number | null) => void;
  onRename?: (taskId: number, newTitle: string) => void;
  onStatusChange?: (taskId: number, status: string) => void;
  onDuplicate?: (task: Task) => void;
  onDuplicateSection?: (sectionName: string) => void;
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

function SectionBlock({ sectionName, tasks, projectId, allPersonnel, projectMembers = [], onOpenTask, onToggleTask, onDateSet, onAssignee, onRename, onStatusChange, onDuplicate, onDuplicateSection, onRefresh, clientName, autoOpenAdd = 0, forceExpand = false, dragHandleProps, isDragging, sortBy = 'default', allPersonnelForSort = [], isFirst = false, taskOrderOverride }: SectionBlockProps) {
  const [collapsed, setCollapsed] = useState(false);
  const effectiveCollapsed = forceExpand ? false : collapsed;
  const [showAdd, setShowAdd] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
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
    onError: (err: any) => {
      setRenamingSection(false);
      setNewSectionName(sectionName);
      toast({ title: "No se pudo renombrar", description: err?.message || "Nombre en conflicto", variant: "destructive" });
    },
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
    ? [
        ...taskOrderOverride.map(id => rawRootTasks.find(t => t.id === id)).filter(Boolean) as Task[],
        ...rawRootTasks.filter(t => !taskOrderOverride.includes(t.id))
      ]
    : rawRootTasks;
  const sortedRootTasks = sortTaskList(orderedRootTasks, sortBy, allPersonnelForSort);
  const pendingTasks = sortedRootTasks.filter(t => t.status !== "done");
  const completedTasks = sortedRootTasks.filter(t => t.status === "done");

  return (
    <div className={cn(isDragging && "opacity-50 bg-accent/10")}>
      {/* Separator between sections — thick top border for non-first sections */}
      {!isFirst && <div className="h-px bg-border/60" />}
      {/* Section header row */}
      <div
        className="flex items-center border-b border-border bg-muted/60 hover:bg-muted/80 cursor-pointer transition-colors group border-l-2 border-l-primary/40"
        onClick={() => !renamingSection && setCollapsed(!collapsed)}
      >
        {/* Drag handle for section */}
        <div
          {...dragHandleProps}
          className="hidden w-5 flex-shrink-0 items-center justify-center py-3 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity sm:flex"
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
            <span
              className="font-semibold text-xs text-foreground uppercase tracking-wider cursor-text rounded px-0.5 hover:bg-accent/60"
              onClick={e => { e.stopPropagation(); setNewSectionName(sectionName); setRenamingSection(true); }}
            >
              {sectionName}
            </span>
          )}
          {rootTasks.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium">{done}/{rootTasks.length}</span>
              <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/50 transition-all duration-500"
                  style={{ width: `${Math.round((done / rootTasks.length) * 100)}%` }}
                />
              </div>
            </div>
          )}
          {!effectiveCollapsed && (
            <div className="flex items-center gap-0.5 opacity-100 ml-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
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
                  {onDuplicateSection && (
                    <DropdownMenuItem onClick={e => { e.stopPropagation(); onDuplicateSection(sectionName); }}>
                      <ListTodo className="h-3.5 w-3.5 mr-2" />
                      Duplicar sección
                    </DropdownMenuItem>
                  )}
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
        <div className="w-12 px-1 flex-shrink-0 sm:w-28 sm:px-2" />
        <div className="hidden w-32 px-2 flex-shrink-0 md:block" />
        <div className="hidden w-24 px-2 flex-shrink-0 text-xs text-muted-foreground font-medium lg:block">
          {totalLogged > 0 && <span>SUMA {formatHours(totalLogged)}</span>}
        </div>
        <div className="hidden w-28 px-2 flex-shrink-0 xl:block" />
        <div className="w-8 flex-shrink-0" />
      </div>

      {!effectiveCollapsed && (
        <>
          <SortableContext items={pendingTasks.map(t => `task:${t.id}`)} strategy={verticalListSortingStrategy}>
          {pendingTasks.map(task => (
            <SortableTaskRow
              key={task.id}
              taskId={task.id}
              task={task}
              allPersonnel={allPersonnel}
              projectMembers={projectMembers}
              onOpenTask={onOpenTask}
              onToggleTask={onToggleTask}
              onDateSet={onDateSet}
              onAssignee={onAssignee}
              onRename={onRename}
              onStatusChange={onStatusChange}
              onDuplicate={onDuplicate}
              clientName={clientName}
              subtaskMap={subtaskMap}
              expandedSubtasks={expandedSubtasks}
              onToggleSubtasks={toggleSubtasks}
            />
          ))}
          </SortableContext>

          {completedTasks.length > 0 && (
            <>
              <div
                className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground border-b border-border cursor-pointer hover:bg-accent/20 transition-colors select-none"
                onClick={() => setShowCompleted(v => !v)}
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500/70" />
                <span>{completedTasks.length} completada{completedTasks.length !== 1 ? "s" : ""}</span>
                <ChevronDown className={cn("h-3 w-3 ml-auto transition-transform", showCompleted && "rotate-180")} />
              </div>
              {showCompleted && completedTasks.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  allPersonnel={allPersonnel}
                  projectMembers={projectMembers}
                  onOpen={onOpenTask}
                  onToggle={onToggleTask}
                  onDateSet={onDateSet}
                  onAssignee={onAssignee}
                  onRename={onRename}
                  onStatusChange={onStatusChange}
                  onDuplicate={onDuplicate}
                  clientName={clientName}
                  subtaskMap={subtaskMap}
                  expandedSubtasks={expandedSubtasks}
                  onToggleSubtasks={toggleSubtasks}
                />
              ))}
            </>
          )}

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

function SortableTaskRow({ taskId, task, allPersonnel, projectMembers, onOpenTask, onToggleTask, onDateSet, onAssignee, onRename, onStatusChange, onDuplicate, clientName, subtaskMap, expandedSubtasks, onToggleSubtasks }: {
  taskId: number;
  task: Task;
  allPersonnel: Personnel[];
  projectMembers?: { personnelId: number; name: string; role: string }[];
  onOpenTask: (id: number, ft?: boolean) => void;
  onToggleTask: (task: Task) => void;
  onDateSet: (taskId: number, range: DateRange | undefined) => void;
  onAssignee: (taskId: number, assigneeId: number | null) => void;
  onRename?: (taskId: number, newTitle: string) => void;
  onStatusChange?: (taskId: number, status: string) => void;
  onDuplicate?: (task: Task) => void;
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
        projectMembers={projectMembers}
        onOpen={onOpenTask}
        onToggle={onToggleTask}
        onDateSet={onDateSet}
        onAssignee={onAssignee}
        onRename={onRename}
        onStatusChange={onStatusChange}
        onDuplicate={onDuplicate}
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
          projectMembers={projectMembers}
          onOpen={onOpenTask}
          onToggle={onToggleTask}
          onDateSet={onDateSet}
          onAssignee={onAssignee}
          onRename={onRename}
          onStatusChange={onStatusChange}
          onDuplicate={onDuplicate}
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
  { status: "todo",        label: "Por hacer",   dot: "bg-gray-400",    ring: "border-t-gray-300",    empty: "Acá aparecerán las tareas nuevas" },
  { status: "in_progress", label: "En curso",    dot: "bg-blue-500",    ring: "border-t-blue-400",    empty: "Mové una tarea aquí para comenzar" },
  { status: "blocked",     label: "Bloqueado",   dot: "bg-orange-500",  ring: "border-t-orange-400",  empty: "Tareas que necesitan desbloquearse" },
  { status: "done",        label: "Completado",  dot: "bg-green-500",   ring: "border-t-green-400",   empty: "Las tareas finalizadas aparecen aquí" },
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
  onStatusChange: (taskId: number, status: string) => void;
}

const PRIORITY_LEFT_BORDER: Record<string, string> = {
  low: "border-l-gray-300",
  medium: "border-l-transparent",
  high: "border-l-orange-400",
  urgent: "border-l-red-500",
};

function BoardCard({ task, allPersonnel, onOpen }: { task: Task; allPersonnel: Personnel[]; onOpen: (id: number) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `board-card:${task.id}`,
    data: { taskId: task.id, fromStatus: task.status },
    disabled: task.status === "done",
  });
  const assignee = allPersonnel.find(p => p.id === task.assigneeId);
  const overdue = isOverdue(task);
  const isDone = task.status === "done";
  const leftBorder = PRIORITY_LEFT_BORDER[task.priority] || "border-l-transparent";
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "bg-card rounded-lg border border-border border-l-2 p-2.5 cursor-grab active:cursor-grabbing",
        "hover:shadow-md hover:border-primary/20 transition-all duration-150",
        isDone && "opacity-50",
        isDragging && "opacity-40 ring-2 ring-primary/40 shadow-lg",
        leftBorder
      )}
      onClick={() => !isDragging && onOpen(task.id)}
    >
      <div className="flex items-start gap-2 mb-2">
        <p className={cn("text-sm font-medium leading-snug flex-1 min-w-0", isDone && "line-through text-muted-foreground")} title={task.title}>
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
              {format(parseCivilTaskDate(task.dueDate)!, "d MMM", { locale: es })}
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
}

function BoardColumn({ label, dot, ring, empty, status, tasks, allPersonnel, projectId, projectMembers, onOpen, onRefresh, onStatusChange }: BoardColumnProps) {
  const [showAdd, setShowAdd] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: `board-col:${status}`, disabled: status === "done" });

  return (
    <div className={cn("flex-1 min-w-0 flex flex-col rounded-xl border-t-2 border border-border bg-muted/5 transition-colors", ring, isOver && "bg-primary/5 ring-2 ring-primary/20")}>
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/60">
        <div className="flex items-center gap-2">
          <span className={cn("w-2 h-2 rounded-full flex-shrink-0", dot)} />
          <span className="font-semibold text-xs text-foreground">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {(() => {
            const estH = tasks.reduce((sum, task) => sum + Number(task.estimatedHoursTotal ?? 0), 0);
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

      <div ref={setNodeRef} className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px] max-h-[calc(100vh-280px)]">
        {tasks.length === 0 && !showAdd && (
          <div className="flex flex-col items-center justify-center py-8 text-center px-2">
            <span className={cn("w-8 h-8 rounded-full mb-2 flex items-center justify-center opacity-20", dot.replace("bg-", "bg-").concat(" bg-opacity-20"))}>
              <span className={cn("w-3 h-3 rounded-full", dot)} />
            </span>
            <p className="text-[11px] text-muted-foreground/60 leading-tight">{empty}</p>
          </div>
        )}

        {tasks.map(task => (
          <div key={task.id} className="group">
            <BoardCard task={task} allPersonnel={allPersonnel} onOpen={onOpen} />
          </div>
        ))}

        {status !== "done" && (showAdd ? (
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
        ))}
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
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [firstSectionAutoAdd, setFirstSectionAutoAdd] = useState(0);
  const [sectionOrder, setSectionOrder] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(`sectionOrder:${projectId}`) || '[]'); } catch { return []; }
  });
  const [taskOrderMap, setTaskOrderMap] = useState<Record<string, number[]>>(() => {
    try { return JSON.parse(localStorage.getItem(`taskOrder:${projectId}`) || '{}'); } catch { return {}; }
  });

  const persistTaskOrder = (projectId: number, map: Record<string, number[]>) => {
    try { localStorage.setItem(`taskOrder:${projectId}`, JSON.stringify(map)); } catch {}
  };

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`taskOrder:${projectId}`) || '{}');
      setTaskOrderMap(saved);
    } catch {
      setTaskOrderMap({});
    }
  }, [projectId]);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [activeDragData, setActiveDragData] = useState<any>(null);
  const [boardStatusOverrides, setBoardStatusOverrides] = useState<Record<number, string>>({});

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

  const invalidateRelated = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/tasks/my-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tasks/projects"] });
  };

  const toggleMutation = useMutation({
    mutationFn: (task: Task) => apiRequest(`/api/tasks/${task.id}/completion`, "POST", {
      completed: task.status !== "done",
    }),
    onSuccess: () => { refetch(); invalidateRelated(); },
  });

  const dateMutation = useMutation({
    mutationFn: ({ taskId, range }: { taskId: number; range: DateRange | undefined }) =>
      apiRequest(`/api/tasks/${taskId}`, "PUT", {
        startDate: range?.from ? format(range.from, "yyyy-MM-dd") : null,
        dueDate: range?.to ? format(range.to, "yyyy-MM-dd") : null,
      }),
    onSuccess: () => { refetch(); invalidateRelated(); },
  });

  const handleDateSet = (taskId: number, range: DateRange | undefined) => {
    dateMutation.mutate({ taskId, range });
  };

  const inlineUpdateMutation = useMutation({
    mutationFn: ({ taskId, updates }: { taskId: number; updates: any }) =>
      apiRequest(`/api/tasks/${taskId}`, "PUT", updates),
    onSuccess: () => { refetch(); invalidateRelated(); },
  });

  const handleAssignee = (taskId: number, assigneeId: number | null) => {
    inlineUpdateMutation.mutate({ taskId, updates: { assigneeId } });
  };

  const handleRenameTask = (taskId: number, newTitle: string) => {
    inlineUpdateMutation.mutate({ taskId, updates: { title: newTitle } });
  };

  const handleBoardStatusChange = (taskId: number, status: string) => {
    setBoardStatusOverrides(prev => ({ ...prev, [taskId]: status }));
    inlineUpdateMutation.mutate(
      { taskId, updates: { status } },
      { onError: () => setBoardStatusOverrides(prev => { const n = { ...prev }; delete n[taskId]; return n; }) }
    );
  };

  const boardDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const taskId = active.data.current?.taskId as number;
    const fromStatus = active.data.current?.fromStatus as string;
    const toStatus = over.id.toString().replace("board-col:", "");
    if (!taskId || fromStatus === toStatus || fromStatus === "done" || toStatus === "done") return;
    handleBoardStatusChange(taskId, toStatus);
  };

  const duplicateTaskMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/tasks", "POST", data),
    onSuccess: () => { refetch(); invalidateRelated(); },
  });

  const copyWeeklyEstimates = async (sourceTaskId: number, targetTaskId: number) => {
    const estimates = await apiRequest(`/api/tasks/${sourceTaskId}/weekly-estimates`, "GET");
    for (const estimate of estimates || []) {
      await apiRequest(`/api/tasks/${targetTaskId}/weekly-estimates`, "POST", {
        weekStart: estimate.weekStart,
        estimatedHours: estimate.estimatedHours,
      });
    }
  };

  const handleDuplicateTask = async (task: Task) => {
    const allRaw = data?.tasks || [];
    const newTask = await apiRequest("/api/tasks", "POST", {
      title: `${task.title} (copia)`,
      projectId: task.projectId,
      sectionName: task.sectionName,
      assigneeId: task.assigneeId,
      priority: task.priority,
      status: "todo",
      dueDate: task.dueDate,
      startDate: task.startDate,
      parentTaskId: task.parentTaskId,
    });
    await copyWeeklyEstimates(task.id, newTask.id);
    if (!task.parentTaskId) {
      const subtasks = allRaw.filter((t: Task) => t.parentTaskId === task.id);
      for (const sub of subtasks) {
        const newSubtask = await apiRequest("/api/tasks", "POST", {
          title: sub.title,
          projectId: sub.projectId,
          sectionName: sub.sectionName,
          assigneeId: sub.assigneeId,
          priority: sub.priority,
          status: "todo",
          parentTaskId: newTask.id,
        });
        await copyWeeklyEstimates(sub.id, newSubtask.id);
      }
    }
    refetch();
    invalidateRelated();
    toast({ title: `Tarea duplicada: "${task.title} (copia)"` });
  };

  const handleDuplicateSection = async (sectionName: string) => {
    const allRaw = data?.tasks || [];
    const sectionTasks = allRaw.filter((t: Task) => t.sectionName === sectionName && !t.parentTaskId);
    for (const task of sectionTasks) {
      const newTask = await apiRequest("/api/tasks", "POST", {
        title: task.title,
        projectId: task.projectId,
        sectionName: `${sectionName} (copia)`,
        assigneeId: task.assigneeId,
        priority: task.priority,
        status: "todo",
        dueDate: task.dueDate,
        startDate: task.startDate,
      });
      await copyWeeklyEstimates(task.id, newTask.id);
      const subtasks = allRaw.filter((t: Task) => t.parentTaskId === task.id);
      for (const sub of subtasks) {
        const newSubtask = await apiRequest("/api/tasks", "POST", {
          title: sub.title,
          projectId: sub.projectId,
          sectionName: `${sectionName} (copia)`,
          assigneeId: sub.assigneeId,
          priority: sub.priority,
          status: "todo",
          parentTaskId: newTask.id,
        });
        await copyWeeklyEstimates(sub.id, newSubtask.id);
      }
    }
    refetch();
    invalidateRelated();
    toast({ title: `Sección "${sectionName}" duplicada` });
  };

  const createSectionTask = useMutation({
    mutationFn: (data: any) => apiRequest("/api/tasks", "POST", data),
    onSuccess: () => { refetch(); invalidateRelated(); setShowAddSection(false); setNewSectionName(""); },
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

  // Section filter: aislar una sección/entregable puntual (solo agrupación por sección)
  const visibleSectionNames = (groupBy === 'section' && sectionFilter !== 'all')
    ? orderedSectionNames.filter(s => s === sectionFilter)
    : orderedSectionNames;

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
        const newMap = { ...taskOrderMap, [fromSection]: newIds };
        setTaskOrderMap(newMap);
        persistTaskOrder(projectId, newMap);

        apiRequest("/api/tasks/reorder", "POST", { taskIds: newIds })
          .then(() => {
            console.log('[DnD] Reorder saved successfully');
            queryClient.invalidateQueries({ queryKey: ["/api/tasks/project", projectId] });
          })
          .catch((e: any) => console.error('[DnD] reorder failed:', e?.message));
      } else {
        // Cross-section move
        const newFromIds = fromIds.filter(id => id !== taskId);
        const toTask = overData?.type === 'task' ? (overData.task as Task) : null;
        const insertIdx = toTask ? toIds.indexOf(toTask.id) : toIds.length;
        const newToIds = [...toIds];
        newToIds.splice(insertIdx >= 0 ? insertIdx : newToIds.length, 0, taskId);
        const newMap = { ...taskOrderMap, [fromSection]: newFromIds, [targetSection]: newToIds };
        setTaskOrderMap(newMap);
        persistTaskOrder(projectId, newMap);

        const p1 = newFromIds.length > 0 ? apiRequest("/api/tasks/reorder", "POST", { taskIds: newFromIds }) : Promise.resolve();
        const p2 = newToIds.length > 0 ? apiRequest("/api/tasks/reorder", "POST", { taskIds: newToIds, sectionName: targetSection }) : Promise.resolve();
        Promise.all([p1, p2])
          .then(() => {
            console.log('[DnD] Cross-section reorder saved successfully');
            queryClient.invalidateQueries({ queryKey: ["/api/tasks/project", projectId] });
          })
          .catch((e: any) => console.error('[DnD] cross-section reorder failed:', e?.message));
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
        <DndContext sensors={sensors} onDragEnd={boardDragEnd}>
          <div>
            <div className="flex items-center gap-2 pb-3 mb-1">
              <span className="text-sm font-medium text-foreground">{totalTasks} tareas</span>
              <span className="text-xs text-muted-foreground">· {doneTasks} completadas</span>
              {orderedSectionNames.length > 0 && (
                <Select value={sectionFilter} onValueChange={setSectionFilter}>
                  <SelectTrigger className="h-7 text-xs w-52 ml-auto">
                    <SelectValue placeholder="Todas las secciones" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las secciones</SelectItem>
                    {orderedSectionNames.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {BOARD_COLUMNS.map(col => {
                const colTasks = allTasks
                  .filter(t => !t.parentTaskId)
                  .filter(t => sectionFilter === 'all' || (t.sectionName || 'General') === sectionFilter)
                  .map(t => boardStatusOverrides[t.id] ? { ...t, status: boardStatusOverrides[t.id] } : t)
                  .filter(t => t.status === col.status);
                return (
                  <BoardColumn
                    key={col.status}
                    label={col.label}
                    dot={col.dot}
                    ring={col.ring}
                    empty={col.empty}
                    status={col.status}
                    tasks={colTasks}
                    allPersonnel={allPersonnel}
                    projectId={projectId}
                    projectMembers={projectMembers}
                    onOpen={id => handleOpen(id)}
                    onRefresh={refetch}
                    onStatusChange={handleBoardStatusChange}
                  />
                );
              })}
            </div>
          </div>
        </DndContext>
      ) : (
        // ─── List view ────────────────────────────────────────────────
        <div>
          <div className="flex items-center justify-between gap-2 pb-2 mb-1">
            {groupBy === 'section' && orderedSectionNames.length > 0 ? (
              <Select value={sectionFilter} onValueChange={setSectionFilter}>
                <SelectTrigger className="h-7 text-xs w-56">
                  <SelectValue placeholder="Todas las secciones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las secciones</SelectItem>
                  {orderedSectionNames.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : <div />}
            <Button size="sm" className="h-7 text-xs" onClick={() => setShowAddSection(true)}>
              <Plus className="h-3 w-3 mr-1" />Nueva sección
            </Button>
          </div>

          {orderedSectionNames.length === 0 ? (
            <div className="text-center py-16 rounded-xl border border-dashed border-border/60 bg-muted/20">
              <ListTodo className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-base font-medium text-foreground mb-1">Este proyecto no tiene tareas aún</p>
              <p className="text-sm text-muted-foreground mb-5">Creá una sección para empezar a organizar el trabajo</p>
              <div className="flex items-center justify-center gap-2">
                <Button size="sm" onClick={() => setShowAddSection(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Nueva sección
                </Button>
                <Button size="sm" variant="outline" onClick={() => setFirstSectionAutoAdd(v => v + 1)}>
                  Agregar tarea directamente
                </Button>
              </div>
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
                  <div className="hidden w-8 flex-shrink-0 sm:block" />
                  <div className="w-5 flex-shrink-0" />
                  <div className="flex-1 px-2 py-2.5">Nombre de tarea</div>
                  <div className="w-12 px-1 flex-shrink-0 py-2.5 text-center sm:w-28 sm:px-2 sm:text-left"><span className="sr-only sm:not-sr-only">Responsable</span></div>
                  <div className="hidden w-32 px-2 flex-shrink-0 py-2.5 md:block">Fechas</div>
                  <div className="hidden w-24 px-2 flex-shrink-0 py-2.5 lg:block">Tiempo real</div>
                  <div className="hidden w-28 px-2 flex-shrink-0 py-2.5 xl:block">Cliente</div>
                  <div className="w-8 flex-shrink-0" />
                </div>

                <SortableContext
                  items={visibleSectionNames.map(s => `section:${s}`)}
                  strategy={verticalListSortingStrategy}
                >
                  {visibleSectionNames.map((section, idx) => (
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
                      onRename={handleRenameTask}
                      onStatusChange={(taskId, status) => inlineUpdateMutation.mutate({ taskId, updates: { status } })}
                      onDuplicate={handleDuplicateTask}
                      onDuplicateSection={handleDuplicateSection}
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

      <ErrorBoundary
        key={selectedTaskId ?? 'closed'}
        fallback={
          <div className="fixed inset-y-0 right-0 w-full sm:max-w-xl bg-background border-l border-border p-6 flex flex-col items-center justify-center gap-4 z-50">
            <p className="text-sm text-muted-foreground text-center">No se pudo cargar el detalle de la tarea.</p>
            <button
              className="text-xs text-primary underline"
              onClick={() => setSelectedTaskId(null)}
            >
              Cerrar
            </button>
          </div>
        }
      >
        <TaskDetailPanel
          taskId={selectedTaskId}
          open={!!selectedTaskId}
          onClose={() => { setSelectedTaskId(null); setFocusTime(false); }}
          onUpdate={refetch}
          initialFocusTime={focusTime}
          onNavigateToTask={(id) => setSelectedTaskId(id)}
        />
      </ErrorBoundary>
    </div>
  );
}
