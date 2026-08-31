import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Check, Clock, Loader2, Pencil, Play, Square, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiRequest, authFetchJson, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { usePermissions } from "@/hooks/use-permissions";
import { formatHours, parseHoursInput, roundToMinute } from "@/lib/task-hours";

type TimeEntrySummary = {
  id: number;
  hours: number;
  date: string;
  personnelId?: number | null;
  personnelName?: string | null;
  description?: string | null;
};

type TaskHoursSummary = {
  projectId?: number | null;
  assigneeId?: number | null;
  loggedHours?: number;
  timeEntries?: TimeEntrySummary[];
};

type PersonnelOption = { id: number; name: string };

export default function QuickTaskHours({ taskId, className }: { taskId: number; className?: string }) {
  const { toast } = useToast();
  const { isOperations } = usePermissions();
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState("");
  const [personnelId, setPersonnelId] = useState("");
  const [timerStartedAt, setTimerStartedAt] = useState<number | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [editingHours, setEditingHours] = useState("");

  const { data: taskSummary } = useQuery<TaskHoursSummary>({
    queryKey: ["/api/tasks", taskId],
    queryFn: () => authFetchJson<TaskHoursSummary>(`/api/tasks/${taskId}`),
    enabled: open,
    staleTime: 15_000,
  });

  const { data: personnel = [] } = useQuery<PersonnelOption[]>({
    queryKey: ["/api/personnel"],
    enabled: open && isOperations,
  });

  // El servidor sólo deja corregir o borrar la carga propia, salvo Operaciones.
  // Sin esto la fila ofrecía lápiz y papelera sobre la carga de un compañero y
  // el click terminaba en un 403.
  const { data: myIdentity } = useQuery<{ personnelId: number | null }>({
    queryKey: ["/api/tasks/my-hours"],
    queryFn: () => authFetchJson("/api/tasks/my-hours"),
    enabled: open,
  });
  const canModify = (entry: TimeEntrySummary) =>
    isOperations || (myIdentity?.personnelId != null && entry.personnelId === myIdentity.personnelId);

  // Lo que rige es el dueño de la tarea, no quien la carga: si Operaciones abre
  // el reloj de una tarea ajena, la atribución arranca apuntando al responsable
  // en vez de obligar a elegirlo en un paso extra.
  useEffect(() => {
    if (!open || !isOperations || personnelId) return;
    if (taskSummary?.assigneeId) setPersonnelId(String(taskSummary.assigneeId));
  }, [open, isOperations, personnelId, taskSummary?.assigneeId]);

  useEffect(() => {
    if (!open) {
      setPersonnelId("");
      setEditingEntryId(null);
    }
  }, [open]);

  const projectId = taskSummary?.projectId ?? null;

  /** La fila de la tarea lee `/api/tasks/project`: sin invalidarla, las horas
   *  recién cargadas no aparecían hasta refrescar la página a mano. */
  const invalidateHoursConsumers = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId] });
    queryClient.invalidateQueries({ queryKey: ["/api/tasks/my-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tasks/hours-summary"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tasks/my-hours"] });
    queryClient.invalidateQueries({ queryKey: ["/api/monthly-closings/real-hours"] });
    queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    if (projectId) {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "complete-data"] });
    }
  };

  const describeError = (fallback: string) => (error: unknown) => toast({
    title: fallback,
    description: getApiErrorMessage(error, "Revisá tu vínculo con Personal y volvé a intentar."),
    variant: "destructive",
  });

  const logMutation = useMutation({
    mutationFn: (hours: number) => apiRequest(`/api/tasks/${taskId}/time`, "POST", {
      date: format(new Date(), "yyyy-MM-dd"),
      hours,
      description: "Carga rápida",
      ...(isOperations && personnelId ? { personnelId: Number(personnelId) } : {}),
    }),
    onSuccess: () => {
      invalidateHoursConsumers();
      setManual("");
    },
    onError: describeError("No se pudieron registrar las horas"),
  });

  const editMutation = useMutation({
    mutationFn: ({ entryId, hours }: { entryId: number; hours: number }) =>
      apiRequest(`/api/tasks/${taskId}/time/${entryId}`, "PATCH", { hours }),
    onSuccess: () => {
      invalidateHoursConsumers();
      setEditingEntryId(null);
      toast({ title: "Carga corregida" });
    },
    onError: describeError("No se pudo corregir la carga"),
  });

  const deleteMutation = useMutation({
    mutationFn: (entryId: number) => apiRequest(`/api/tasks/${taskId}/time/${entryId}`, "DELETE"),
    onSuccess: () => {
      invalidateHoursConsumers();
      setEditingEntryId(null);
      toast({ title: "Carga eliminada" });
    },
    onError: describeError("No se pudo eliminar la carga"),
  });

  useEffect(() => {
    if (!timerStartedAt) return;
    const interval = window.setInterval(
      () => setTimerSeconds(Math.floor((Date.now() - timerStartedAt) / 1000)),
      1000,
    );
    return () => window.clearInterval(interval);
  }, [timerStartedAt]);

  const saveManual = () => {
    const hours = parseHoursInput(manual);
    if (hours == null || hours <= 0) {
      toast({
        title: "No entendimos esa duración",
        description: "Podés escribir 45m, 1h30, 1:30 o 2,5.",
        variant: "destructive",
      });
      return;
    }
    logMutation.mutate(roundToMinute(hours));
  };

  const commitEdit = (entryId: number) => {
    const hours = parseHoursInput(editingHours);
    if (hours == null || hours <= 0) {
      toast({
        title: "No entendimos esa duración",
        description: "Podés escribir 45m, 1h30, 1:30 o 2,5.",
        variant: "destructive",
      });
      return;
    }
    editMutation.mutate({ entryId, hours: roundToMinute(hours) });
  };

  const stopTimer = () => {
    const hours = roundToMinute(Math.max(1 / 60, timerSeconds / 3600));
    setTimerStartedAt(null);
    setTimerSeconds(0);
    logMutation.mutate(hours);
  };

  const entries = taskSummary?.timeEntries ?? [];
  const total = taskSummary?.loggedHours ?? entries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
  const busy = editMutation.isPending || deleteMutation.isPending;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn("rounded p-1 text-primary opacity-70 transition-all hover:bg-primary/10 hover:opacity-100", className)}
          onClick={(event) => event.stopPropagation()}
          title="Cargar y revisar horas"
          aria-label="Cargar y revisar horas"
        >
          <Clock className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" onClick={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold">Cargar horas</p>
            <p className="text-[10px] text-muted-foreground">Resumen de horas</p>
          </div>
          <span className="text-xs font-medium text-primary">{formatHours(total)} total</span>
        </div>
        <div className="mb-2 grid grid-cols-4 gap-1">
          {[0.25, 0.5, 0.75, 1].map((hours) => (
            <Button key={hours} size="sm" variant="outline" className="h-8 px-1 text-[10px]" onClick={() => logMutation.mutate(hours)} disabled={logMutation.isPending}>
              {hours * 60}m
            </Button>
          ))}
        </div>
        {isOperations && (
          <label className="mb-2 block text-[10px] text-muted-foreground">
            Cargar para
            <select
              value={personnelId}
              onChange={(event) => setPersonnelId(event.target.value)}
              className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
            >
              <option value="">Yo / persona vinculada</option>
              {personnel.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}{person.id === taskSummary?.assigneeId ? " · responsable" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="mb-2 flex gap-1">
          <Input
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            placeholder="45m · 1h30 · 2,5"
            aria-label="Duración a registrar"
            className="h-8 text-xs"
            onKeyDown={(event) => event.key === "Enter" && saveManual()}
          />
          <Button size="sm" className="h-8 text-xs" onClick={saveManual} disabled={logMutation.isPending || !manual.trim()}>
            {logMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}
          </Button>
        </div>
        {timerStartedAt ? (
          <Button size="sm" variant="destructive" className="h-8 w-full text-xs" onClick={stopTimer}>
            <Square className="mr-1 h-3 w-3" />Detener ({Math.floor(timerSeconds / 60)}m)
          </Button>
        ) : (
          <Button size="sm" variant="secondary" className="h-8 w-full text-xs" onClick={() => setTimerStartedAt(Date.now())}>
            <Play className="mr-1 h-3 w-3" />Iniciar temporizador
          </Button>
        )}

        <div className="mt-3 border-t pt-2">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Últimas cargas</p>
          {entries.length === 0 ? (
            <p className="py-1 text-xs text-muted-foreground">Todavía no hay horas registradas.</p>
          ) : entries.slice(0, 4).map((entry) => (
            <div key={entry.id} className="flex items-center gap-1.5 border-b border-border/50 py-1.5 text-xs last:border-0">
              {editingEntryId === entry.id && canModify(entry) ? (
                <>
                  <Input
                    autoFocus
                    value={editingHours}
                    onChange={(event) => setEditingHours(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") commitEdit(entry.id);
                      if (event.key === "Escape") setEditingEntryId(null);
                    }}
                    aria-label="Corregir duración"
                    className="h-7 flex-1 text-xs"
                  />
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={busy} onClick={() => commitEdit(entry.id)} aria-label="Guardar corrección">
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingEntryId(null)} aria-label="Cancelar">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="w-14 font-medium">{formatHours(Number(entry.hours))}</span>
                  <span className="text-muted-foreground">{format(new Date(`${entry.date.slice(0, 10)}T00:00:00`), "d MMM", { locale: es })}</span>
                  <span className="min-w-0 flex-1 truncate text-right text-muted-foreground">{entry.personnelName || entry.description || "Carga"}</span>
                  {canModify(entry) && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 p-0"
                        disabled={busy}
                        aria-label={`Corregir la carga de ${formatHours(Number(entry.hours))}`}
                        onClick={() => { setEditingEntryId(entry.id); setEditingHours(String(Math.round(Number(entry.hours) * 100) / 100)); }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 p-0 text-destructive hover:text-destructive"
                        disabled={busy}
                        aria-label={`Eliminar la carga de ${formatHours(Number(entry.hours))}`}
                        onClick={() => deleteMutation.mutate(entry.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
