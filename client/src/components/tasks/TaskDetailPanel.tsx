import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, authFetch } from "@/lib/queryClient";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CalendarIcon, Clock, Plus, Trash2, ChevronDown, ChevronRight, User, Users, Tag, Flag
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
  { value: "todo", label: "Pendiente", color: "bg-gray-100 text-gray-700" },
  { value: "in_progress", label: "En curso", color: "bg-blue-100 text-blue-700" },
  { value: "done", label: "Completada", color: "bg-green-100 text-green-700" },
  { value: "cancelled", label: "Cancelada", color: "bg-red-100 text-red-700" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Baja", color: "text-gray-500" },
  { value: "medium", label: "Media", color: "text-yellow-600" },
  { value: "high", label: "Alta", color: "text-orange-600" },
  { value: "urgent", label: "Urgente", color: "text-red-600" },
];

function getInitials(name: string) {
  return name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
}

function ProjectColorDot({ projectId }: { projectId?: number | null }) {
  const colors = ["bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500", "bg-pink-500", "bg-teal-500"];
  if (!projectId) return null;
  const color = colors[projectId % colors.length];
  return <span className={cn("inline-block w-2.5 h-2.5 rounded-full mr-1.5", color)} />;
}

interface Props {
  taskId: number | null;
  open: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function TaskDetailPanel({ taskId, open, onClose, onUpdate }: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [logHours, setLogHours] = useState("");
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [logDesc, setLogDesc] = useState("");
  const [showTimeLog, setShowTimeLog] = useState(false);

  const { data: task, isLoading } = useQuery<Task>({
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
    mutationFn: (updates: Partial<Task>) => apiRequest(`/api/tasks/${taskId}`, "PUT", updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      onUpdate?.();
    },
  });

  const addSubtaskMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/tasks", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId] });
      setSubtaskTitle("");
      setShowAddSubtask(false);
    },
  });

  const logTimeMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/tasks/${taskId}/time`, "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/hours-summary"] });
      setLogHours("");
      setLogDesc("");
      setShowTimeLog(false);
      toast({ title: "Horas registradas", description: "Las horas se registraron correctamente." });
    },
  });

  const deleteTimeMutation = useMutation({
    mutationFn: (entryId: number) => apiRequest(`/api/tasks/${taskId}/time/${entryId}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest(`/api/tasks/${taskId}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      onUpdate?.();
      onClose();
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
    if (!logHours || parseFloat(logHours) <= 0) {
      toast({ variant: "destructive", title: "Error", description: "Ingresá las horas a registrar." });
      return;
    }
    logTimeMutation.mutate({
      personnelId: task?.assigneeId,
      date: logDate,
      hours: parseFloat(logHours),
      description: logDesc,
    });
  };

  if (!task && !isLoading) return null;

  const statusInfo = STATUS_OPTIONS.find(s => s.value === task?.status);
  const priorityInfo = PRIORITY_OPTIONS.find(p => p.value === task?.priority);
  const assignee = allPersonnel.find(p => p.id === task?.assigneeId);
  const project = allProjects.find(p => p.id === task?.projectId);
  const collaborators = allPersonnel.filter(p => (task?.collaboratorIds || []).includes(p.id));

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0" side="right">
        {isLoading || !task ? (
          <div className="p-8 text-center text-muted-foreground">Cargando tarea...</div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b">
              {/* Project tag */}
              {project && (
                <div className="flex items-center mb-3">
                  <ProjectColorDot projectId={task.projectId} />
                  <span className="text-xs text-muted-foreground">{project.client_name} · {project.name}</span>
                  {task.sectionName && <span className="ml-2 text-xs text-muted-foreground">· {task.sectionName}</span>}
                </div>
              )}
              {/* Title */}
              {editingTitle ? (
                <Input
                  autoFocus
                  value={titleValue}
                  onChange={e => setTitleValue(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={e => { if (e.key === "Enter") handleTitleSave(); if (e.key === "Escape") setEditingTitle(false); }}
                  className="text-xl font-bold border-none shadow-none px-0 focus-visible:ring-0"
                />
              ) : (
                <h2
                  className="text-xl font-bold cursor-pointer hover:text-primary transition-colors"
                  onClick={() => { setTitleValue(task.title); setEditingTitle(true); }}
                >
                  {task.title}
                </h2>
              )}
              {/* Status + Priority */}
              <div className="flex items-center gap-2 mt-3">
                <Select value={task.status} onValueChange={v => updateMutation.mutate({ status: v })}>
                  <SelectTrigger className={cn("h-7 w-auto text-xs border-none px-2 font-medium", statusInfo?.color)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s.value} value={s.value}>
                        <span className={cn("font-medium", s.color.replace("bg-", "text-").split(" ")[0])}>{s.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={task.priority} onValueChange={v => updateMutation.mutate({ priority: v })}>
                  <SelectTrigger className="h-7 w-auto text-xs border-none px-2">
                    <Flag className={cn("h-3 w-3 mr-1", priorityInfo?.color)} />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {/* Key fields */}
              <div className="grid grid-cols-2 gap-4">
                {/* Assignee */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1"><User className="h-3 w-3" />Responsable</p>
                  <Select value={task.assigneeId?.toString() || "none"} onValueChange={v => updateMutation.mutate({ assigneeId: v === "none" ? null : parseInt(v) })}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Sin asignar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {allPersonnel.map(p => (
                        <SelectItem key={p.id} value={p.id.toString()}>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-4 w-4">
                              <AvatarFallback className="text-[8px]">{getInitials(p.name)}</AvatarFallback>
                            </Avatar>
                            {p.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Project */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1"><Tag className="h-3 w-3" />Proyecto</p>
                  <Select value={task.projectId?.toString() || "none"} onValueChange={v => updateMutation.mutate({ projectId: v === "none" ? null : parseInt(v) })}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Sin proyecto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin proyecto</SelectItem>
                      {allProjects.map(p => (
                        <SelectItem key={p.id} value={p.id.toString()}>
                          <div className="flex items-center">
                            <ProjectColorDot projectId={p.id} />
                            <span>{p.client_name} · {p.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Dates */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1"><CalendarIcon className="h-3 w-3" />Fecha de inicio</p>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 w-full text-xs justify-start font-normal">
                        {task.startDate ? format(new Date(task.startDate), "dd/MM/yyyy", { locale: es }) : "Sin fecha"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={task.startDate ? new Date(task.startDate) : undefined}
                        onSelect={d => updateMutation.mutate({ startDate: d?.toISOString() || null })}
                        locale={es}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1"><CalendarIcon className="h-3 w-3" />Fecha límite</p>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("h-8 w-full text-xs justify-start font-normal", task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done" ? "border-red-300 text-red-600" : "")}>
                        {task.dueDate ? format(new Date(task.dueDate), "dd/MM/yyyy", { locale: es }) : "Sin fecha"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={task.dueDate ? new Date(task.dueDate) : undefined}
                        onSelect={d => updateMutation.mutate({ dueDate: d?.toISOString() || null })}
                        locale={es}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Hours */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1"><Clock className="h-3 w-3" />Horas estimadas</p>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    defaultValue={task.estimatedHours?.toString() || ""}
                    onBlur={e => updateMutation.mutate({ estimatedHours: e.target.value ? parseFloat(e.target.value) : null })}
                    className="h-8 text-xs"
                    placeholder="0"
                  />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1"><Clock className="h-3 w-3" />Horas registradas</p>
                  <div className="h-8 flex items-center text-sm font-medium">
                    <span className={cn(task.estimatedHours && (task.loggedHours || 0) > task.estimatedHours ? "text-red-600" : "text-foreground")}>
                      {(task.loggedHours || 0).toFixed(1)}h
                    </span>
                    {task.estimatedHours && <span className="text-muted-foreground ml-1">/ {task.estimatedHours}h est.</span>}
                  </div>
                </div>
              </div>

              {/* Sección + Descripción */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Sección</p>
                <Input
                  defaultValue={task.sectionName || "General"}
                  onBlur={e => updateMutation.mutate({ sectionName: e.target.value || "General" })}
                  className="h-8 text-xs"
                  placeholder="General"
                />
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Descripción</p>
                <Textarea
                  defaultValue={task.description || ""}
                  onBlur={e => updateMutation.mutate({ description: e.target.value || null })}
                  className="min-h-[80px] text-sm resize-none"
                  placeholder="Agregar descripción..."
                />
              </div>

              <Separator />

              {/* Subtareas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                    Subtareas
                    {(task.subtasks?.length || 0) > 0 && <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{task.subtasks?.filter(s => s.status === "done").length}/{task.subtasks?.length}</Badge>}
                  </p>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowAddSubtask(true)}>
                    <Plus className="h-3 w-3 mr-1" />Agregar
                  </Button>
                </div>

                <div className="space-y-1">
                  {(task.subtasks || []).map(sub => (
                    <div key={sub.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-accent group">
                      <Checkbox
                        checked={sub.status === "done"}
                        onCheckedChange={checked => {
                          apiRequest(`/api/tasks/${sub.id}`, "PUT", { status: checked ? "done" : "todo" }).then(() => {
                            queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId] });
                          });
                        }}
                        className="h-3.5 w-3.5"
                      />
                      <span className={cn("text-sm flex-1", sub.status === "done" ? "line-through text-muted-foreground" : "")}>{sub.title}</span>
                    </div>
                  ))}

                  {showAddSubtask && (
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        autoFocus
                        value={subtaskTitle}
                        onChange={e => setSubtaskTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && subtaskTitle.trim()) {
                            addSubtaskMutation.mutate({ title: subtaskTitle.trim(), parentTaskId: taskId, projectId: task.projectId, sectionName: task.sectionName });
                          }
                          if (e.key === "Escape") { setShowAddSubtask(false); setSubtaskTitle(""); }
                        }}
                        placeholder="Nombre de la subtarea..."
                        className="h-7 text-xs flex-1"
                      />
                      <Button size="sm" className="h-7 text-xs" onClick={() => {
                        if (subtaskTitle.trim()) addSubtaskMutation.mutate({ title: subtaskTitle.trim(), parentTaskId: taskId, projectId: task.projectId, sectionName: task.sectionName });
                      }}>OK</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setShowAddSubtask(false); setSubtaskTitle(""); }}>✕</Button>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Registro de horas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />Horas registradas
                    {(task.timeEntries?.length || 0) > 0 && (
                      <span className="text-muted-foreground font-normal ml-1">
                        ({(task.loggedHours || 0).toFixed(1)}h total)
                      </span>
                    )}
                  </p>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowTimeLog(!showTimeLog)}>
                    <Plus className="h-3 w-3 mr-1" />Registrar
                  </Button>
                </div>

                {showTimeLog && (
                  <div className="bg-accent/40 rounded-lg p-3 mb-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Horas</p>
                        <Input type="number" min="0.5" step="0.5" value={logHours} onChange={e => setLogHours(e.target.value)} className="h-7 text-xs" placeholder="0" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Fecha</p>
                        <Input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} className="h-7 text-xs" />
                      </div>
                    </div>
                    <Input value={logDesc} onChange={e => setLogDesc(e.target.value)} className="h-7 text-xs" placeholder="Descripción (opcional)..." />
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 text-xs" onClick={handleLogTime} disabled={logTimeMutation.isPending}>
                        {logTimeMutation.isPending ? "Guardando..." : "Guardar"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowTimeLog(false)}>Cancelar</Button>
                    </div>
                  </div>
                )}

                {(task.timeEntries || []).length > 0 ? (
                  <div className="space-y-1">
                    {task.timeEntries!.map(entry => (
                      <div key={entry.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-accent group text-xs">
                        <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium">{entry.hours}h</span>
                        <span className="text-muted-foreground">{format(new Date(entry.date), "dd/MM/yy")}</span>
                        {entry.description && <span className="text-muted-foreground flex-1 truncate">— {entry.description}</span>}
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-red-500" onClick={() => deleteTimeMutation.mutate(entry.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Sin horas registradas aún</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t px-6 py-3 flex justify-between items-center">
              <p className="text-xs text-muted-foreground">
                Creada {task.createdAt ? format(new Date(task.createdAt), "dd/MM/yyyy", { locale: es }) : ""}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 text-xs"
                onClick={() => { if (confirm("¿Eliminar esta tarea?")) deleteMutation.mutate(); }}
              >
                <Trash2 className="h-3 w-3 mr-1" />Eliminar tarea
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
