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
import {
  Plus, ChevronDown, ChevronRight, CalendarIcon, Clock, User, Flag, GripVertical, Loader2
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

const STATUS_COLORS: Record<string, string> = {
  todo: "bg-gray-200",
  in_progress: "bg-blue-400",
  done: "bg-green-400",
  cancelled: "bg-red-300",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-gray-400",
  medium: "text-yellow-500",
  high: "text-orange-500",
  urgent: "text-red-500",
};

function getInitials(name: string) {
  return name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
}

function isOverdue(task: Task) {
  return task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done";
}

interface NewTaskRowProps {
  projectId: number;
  sectionName: string;
  onCreated: () => void;
  onCancel: () => void;
  allPersonnel: Personnel[];
}

function NewTaskRow({ projectId, sectionName, onCreated, onCancel, allPersonnel }: NewTaskRowProps) {
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

  return (
    <div className="flex items-center gap-2 py-1.5 pl-8 pr-2 bg-accent/30 rounded">
      <Input
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") onCancel(); }}
        placeholder="Nombre de la tarea..."
        className="h-7 text-sm flex-1 border-none bg-transparent focus-visible:ring-0 shadow-none"
      />
      <Select value={assigneeId} onValueChange={setAssigneeId}>
        <SelectTrigger className="h-7 w-28 text-xs">
          <SelectValue placeholder="Asignar" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Sin asignar</SelectItem>
          {allPersonnel.map(p => (
            <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 text-xs">
            {dueDate ? format(dueDate, "dd/MM") : <CalendarIcon className="h-3 w-3" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar mode="single" selected={dueDate} onSelect={setDueDate} locale={es} />
        </PopoverContent>
      </Popover>
      <Button size="sm" className="h-7 text-xs" onClick={handleCreate} disabled={createMutation.isPending || !title.trim()}>
        {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Agregar"}
      </Button>
      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel}>✕</Button>
    </div>
  );
}

interface TaskRowProps {
  task: Task;
  allPersonnel: Personnel[];
  onOpen: (id: number) => void;
  onToggle: (task: Task) => void;
}

function TaskRow({ task, allPersonnel, onOpen, onToggle }: TaskRowProps) {
  const assignee = allPersonnel.find(p => p.id === task.assigneeId);
  const overdue = isOverdue(task);

  return (
    <div
      className="flex items-center gap-2 py-1.5 pl-6 pr-2 rounded hover:bg-accent/50 group cursor-pointer transition-colors"
      onClick={() => onOpen(task.id)}
    >
      <div onClick={e => { e.stopPropagation(); onToggle(task); }}>
        <Checkbox
          checked={task.status === "done"}
          className="h-4 w-4"
        />
      </div>

      <span className={cn(
        "flex-1 text-sm truncate",
        task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"
      )}>
        {task.title}
      </span>

      <Flag className={cn("h-3 w-3 flex-shrink-0", PRIORITY_COLORS[task.priority] || "text-gray-400")} />

      {task.estimatedHours && (
        <div className="flex items-center gap-0.5 text-xs text-muted-foreground flex-shrink-0">
          <Clock className="h-3 w-3" />
          <span>{(task.loggedHours || 0).toFixed(1)}/{task.estimatedHours}h</span>
        </div>
      )}

      {task.dueDate && (
        <span className={cn(
          "text-xs flex-shrink-0",
          overdue ? "text-red-500 font-medium" : "text-muted-foreground"
        )}>
          {format(new Date(task.dueDate), "dd MMM", { locale: es })}
        </span>
      )}

      {assignee ? (
        <Avatar className="h-5 w-5 flex-shrink-0">
          <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{getInitials(assignee.name)}</AvatarFallback>
        </Avatar>
      ) : (
        <div className="h-5 w-5 rounded-full border border-dashed border-muted-foreground/30 flex-shrink-0" />
      )}

      <div className={cn("w-2 h-2 rounded-full flex-shrink-0", STATUS_COLORS[task.status] || "bg-gray-200")} />
    </div>
  );
}

interface SectionBlockProps {
  sectionName: string;
  tasks: Task[];
  projectId: number;
  allPersonnel: Personnel[];
  onOpenTask: (id: number) => void;
  onToggleTask: (task: Task) => void;
  onRefresh: () => void;
}

function SectionBlock({ sectionName, tasks, projectId, allPersonnel, onOpenTask, onToggleTask, onRefresh }: SectionBlockProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const done = tasks.filter(t => t.status === "done").length;

  return (
    <div className="mb-4">
      {/* Section header */}
      <div className="flex items-center gap-2 py-1 px-2 group hover:bg-accent/30 rounded cursor-pointer" onClick={() => setCollapsed(!collapsed)}>
        {collapsed
          ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        }
        <span className="font-semibold text-sm text-foreground">{sectionName}</span>
        <span className="text-xs text-muted-foreground ml-1">{done}/{tasks.length}</span>
        {!collapsed && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 ml-auto opacity-0 group-hover:opacity-100"
            onClick={e => { e.stopPropagation(); setShowAdd(true); }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        )}
      </div>

      {!collapsed && (
        <div className="ml-2 border-l border-border pl-1 space-y-0.5">
          {tasks.filter(t => !t.parentTaskId).map(task => (
            <TaskRow
              key={task.id}
              task={task}
              allPersonnel={allPersonnel}
              onOpen={onOpenTask}
              onToggle={onToggleTask}
            />
          ))}

          {showAdd ? (
            <NewTaskRow
              projectId={projectId}
              sectionName={sectionName}
              onCreated={() => { setShowAdd(false); onRefresh(); }}
              onCancel={() => setShowAdd(false)}
              allPersonnel={allPersonnel}
            />
          ) : (
            <button
              className="flex items-center gap-1.5 pl-6 py-1 text-xs text-muted-foreground hover:text-primary transition-colors w-full"
              onClick={() => setShowAdd(true)}
            >
              <Plus className="h-3 w-3" />Agregar tarea
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  projectId: number;
}

export default function ProjectTaskList({ projectId }: Props) {
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
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

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between pb-2 border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {data?.tasks?.length || 0} tareas
          </span>
          {data?.tasks && (
            <span className="text-xs text-muted-foreground">
              · {data.tasks.filter(t => t.status === "done").length} completadas
            </span>
          )}
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
        <div className="text-center py-12">
          <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center mx-auto mb-3">
            <Plus className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mb-3">Todavía no hay tareas en este proyecto</p>
          <Button size="sm" onClick={() => setShowAddSection(true)}>Crear primera sección</Button>
        </div>
      ) : (
        <div>
          {/* Column headers */}
          <div className="flex items-center gap-2 pl-8 pr-2 py-1 text-xs text-muted-foreground border-b mb-1">
            <span className="flex-1">Nombre</span>
            <span className="w-4" />
            <span className="w-16 text-center">Horas</span>
            <span className="w-12 text-center">Vence</span>
            <span className="w-5 text-center">Resp.</span>
            <span className="w-2" />
          </div>

          {sectionNames.map(section => (
            <SectionBlock
              key={section}
              sectionName={section}
              tasks={sections[section]}
              projectId={projectId}
              allPersonnel={allPersonnel}
              onOpenTask={setSelectedTaskId}
              onToggleTask={(task) => toggleMutation.mutate(task)}
              onRefresh={refetch}
            />
          ))}
        </div>
      )}

      {showAddSection && (
        <div className="flex items-center gap-2 p-3 border rounded-lg bg-accent/20">
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
        onClose={() => setSelectedTaskId(null)}
        onUpdate={refetch}
      />
    </div>
  );
}
