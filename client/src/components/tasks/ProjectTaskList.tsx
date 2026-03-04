import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, authFetch } from "@/lib/queryClient";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Plus, ChevronDown, ChevronRight, CalendarIcon, Clock, Flag, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import TaskDetailPanel from "./TaskDetailPanel";

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
};

type Personnel = { id: number; name: string };

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-gray-400",
  medium: "text-yellow-500",
  high: "text-orange-500",
  urgent: "text-red-500",
};

const AVATAR_COLORS = [
  "bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500",
  "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500",
];

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
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

interface NewTaskRowProps {
  projectId: number;
  sectionName: string;
  onCreated: () => void;
  onCancel: () => void;
  allPersonnel: Personnel[];
  projectMembers?: { personnelId: number; name: string; role: string }[];
}

function NewTaskRow({ projectId, sectionName, onCreated, onCancel, allPersonnel, projectMembers = [] }: NewTaskRowProps) {
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
      status: "todo",
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
      <div className="w-32 px-2 flex-shrink-0">
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
      <div className="w-20 px-2 flex-shrink-0">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-full text-xs justify-start font-normal">
              {dueDate ? format(dueDate, "dd/MM") : <CalendarIcon className="h-3 w-3 text-muted-foreground" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={dueDate} onSelect={setDueDate} locale={es} />
          </PopoverContent>
        </Popover>
      </div>
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
  isSubtask?: boolean;
}

function TaskRow({ task, allPersonnel, onOpen, onToggle, isSubtask = false }: TaskRowProps) {
  const assignee = allPersonnel.find(p => p.id === task.assigneeId);
  const collaborators = allPersonnel.filter(p => (task.collaboratorIds || []).includes(p.id));
  const overdue = isOverdue(task);
  const isDone = task.status === "done";
  const loggedH = task.loggedHours || 0;

  return (
    <TooltipProvider>
      <div
        className={cn(
          "flex items-center border-b border-border hover:bg-accent/30 transition-colors group cursor-pointer",
          isDone && "opacity-60",
          isSubtask && "bg-muted/10"
        )}
        onClick={() => onOpen(task.id)}
      >
        {/* indent / subtask indicator */}
        <div className={cn("flex-shrink-0 flex items-center", isSubtask ? "w-12 pl-6" : "w-8")}>
          {isSubtask && <span className="text-muted-foreground/50 text-xs mr-1">↳</span>}
        </div>

        {/* Checkbox */}
        <div className="w-5 flex-shrink-0 flex items-center justify-center py-2.5" onClick={e => { e.stopPropagation(); onToggle(task); }}>
          <Checkbox checked={isDone} className="h-3.5 w-3.5" />
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0 px-2 py-2 flex items-center gap-1.5">
          <Flag className={cn("h-2.5 w-2.5 flex-shrink-0", PRIORITY_COLORS[task.priority] || "text-gray-300")} />
          <span className={cn("text-sm truncate", isDone && "line-through text-muted-foreground")}>
            {task.title}
          </span>
        </div>

        {/* Responsable */}
        <div className="w-28 px-2 flex-shrink-0 flex items-center">
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
            <div className="w-6 h-6 rounded-full border border-dashed border-muted-foreground/30 flex items-center justify-center">
              <span className="text-[8px] text-muted-foreground/40">—</span>
            </div>
          )}
        </div>

        {/* Colaboradores */}
        <div className="w-28 px-2 flex-shrink-0 flex items-center gap-0.5">
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

        {/* Fecha entrega */}
        <div className="w-24 px-2 flex-shrink-0 text-xs">
          {task.dueDate ? (
            <span className={cn(overdue ? "text-red-500 font-medium" : "text-muted-foreground")}>
              {format(new Date(task.dueDate), "dd MMM", { locale: es })}
            </span>
          ) : (
            <span className="text-muted-foreground/30">—</span>
          )}
        </div>

        {/* Tiempo real */}
        <div className="w-28 px-2 flex-shrink-0 text-xs flex items-center gap-1">
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
            <span className="text-muted-foreground/30">—</span>
          )}
          {/* Quick log hours button on hover */}
          <button
            className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={e => { e.stopPropagation(); onOpen(task.id, true); }}
            title="Registrar horas"
          >
            <Clock className="h-3 w-3 text-primary" />
          </button>
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
  onRefresh: () => void;
}

function SectionBlock({ sectionName, tasks, projectId, allPersonnel, projectMembers = [], onOpenTask, onToggleTask, onRefresh }: SectionBlockProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const rootTasks = tasks.filter(t => !t.parentTaskId);
  const subtaskMap: Record<number, Task[]> = {};
  tasks.filter(t => t.parentTaskId).forEach(sub => {
    if (!subtaskMap[sub.parentTaskId!]) subtaskMap[sub.parentTaskId!] = [];
    subtaskMap[sub.parentTaskId!].push(sub);
  });

  const done = rootTasks.filter(t => t.status === "done").length;
  const totalLogged = tasks.reduce((acc, t) => acc + (t.loggedHours || 0), 0);

  return (
    <div>
      {/* Section header row */}
      <div
        className="flex items-center border-b border-border bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors group"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="w-8 flex-shrink-0 flex items-center justify-center py-2">
          {collapsed
            ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          }
        </div>
        <div className="w-5 flex-shrink-0" />
        <div className="flex-1 px-2 py-2 flex items-center gap-2">
          <span className="font-semibold text-sm text-foreground">{sectionName}</span>
          <span className="text-xs text-muted-foreground">{done}/{rootTasks.length}</span>
          {!collapsed && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 ml-1"
              onClick={e => { e.stopPropagation(); setShowAdd(true); }}
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
        </div>
        <div className="w-28 px-2 flex-shrink-0" />
        <div className="w-28 px-2 flex-shrink-0" />
        <div className="w-24 px-2 flex-shrink-0" />
        {/* SUMA */}
        <div className="w-28 px-2 flex-shrink-0 text-xs text-muted-foreground font-medium">
          {totalLogged > 0 && <span>SUMA {formatHours(totalLogged)}</span>}
        </div>
      </div>

      {!collapsed && (
        <>
          {rootTasks.map(task => (
            <div key={task.id}>
              <TaskRow
                task={task}
                allPersonnel={allPersonnel}
                onOpen={onOpenTask}
                onToggle={onToggleTask}
              />
              {(subtaskMap[task.id] || []).map(sub => (
                <TaskRow
                  key={sub.id}
                  task={sub}
                  allPersonnel={allPersonnel}
                  onOpen={onOpenTask}
                  onToggle={onToggleTask}
                  isSubtask
                />
              ))}
            </div>
          ))}

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
    </div>
  );
}

interface Props {
  projectId: number;
  projectMembers?: { personnelId: number; name: string; role: string }[];
}

export default function ProjectTaskList({ projectId, projectMembers = [] }: Props) {
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [focusTime, setFocusTime] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");

  const { data, isLoading, refetch } = useQuery<{ tasks: Task[]; sections: Record<string, Task[]> }>({
    queryKey: ["/api/tasks/project", projectId],
    queryFn: () => authFetch(`/api/tasks/project/${projectId}`).then(r => r.json()),
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

  const createSectionTask = useMutation({
    mutationFn: (data: any) => apiRequest("/api/tasks", "POST", data),
    onSuccess: () => { refetch(); setShowAddSection(false); setNewSectionName(""); },
  });

  const sections = data?.sections || {};
  const sectionNames = Object.keys(sections);
  const totalTasks = data?.tasks?.length || 0;
  const doneTasks = data?.tasks?.filter(t => t.status === "done").length || 0;

  const handleOpen = (id: number, ft = false) => {
    setFocusTime(ft);
    setSelectedTaskId(id);
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between pb-3 mb-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{totalTasks} tareas</span>
          <span className="text-xs text-muted-foreground">· {doneTasks} completadas</span>
        </div>
        <Button size="sm" className="h-7 text-xs" onClick={() => setShowAddSection(true)}>
          <Plus className="h-3 w-3 mr-1" />Nueva sección
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : sectionNames.length === 0 ? (
        <div className="text-center py-12 rounded-xl border border-dashed border-border">
          <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center mx-auto mb-3">
            <Plus className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mb-3">Todavía no hay secciones ni tareas en este proyecto</p>
          <Button size="sm" onClick={() => setShowAddSection(true)}>Crear primera sección</Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {/* Column headers */}
          <div className="flex items-center bg-muted/30 border-b border-border text-xs font-semibold text-muted-foreground">
            <div className="w-8 flex-shrink-0" />
            <div className="w-5 flex-shrink-0" />
            <div className="flex-1 px-2 py-2.5">Nombre de tarea</div>
            <div className="w-28 px-2 flex-shrink-0 py-2.5">Responsable</div>
            <div className="w-28 px-2 flex-shrink-0 py-2.5">Colaboradores</div>
            <div className="w-24 px-2 flex-shrink-0 py-2.5">Fecha entrega</div>
            <div className="w-28 px-2 flex-shrink-0 py-2.5">Tiempo real</div>
          </div>

          {sectionNames.map(section => (
            <SectionBlock
              key={section}
              sectionName={section}
              tasks={sections[section]}
              projectId={projectId}
              allPersonnel={allPersonnel}
              projectMembers={projectMembers}
              onOpenTask={handleOpen}
              onToggleTask={(task) => toggleMutation.mutate(task)}
              onRefresh={refetch}
            />
          ))}
        </div>
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

      <TaskDetailPanel
        taskId={selectedTaskId}
        open={!!selectedTaskId}
        onClose={() => { setSelectedTaskId(null); setFocusTime(false); }}
        onUpdate={refetch}
        initialFocusTime={focusTime}
      />
    </div>
  );
}
