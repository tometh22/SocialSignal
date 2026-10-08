import { invalidateTaskQueries } from "@/lib/task-cache";
import { civilDateInBuenosAires } from "@shared/utils/buenos-aires-week";
import { useState } from "react";
import { Timer, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { parseHoursInput, roundToMinute } from "@/lib/task-hours";
import { useActiveTimer, formatElapsed } from "@/hooks/useActiveTimer";

export default function GlobalTimerWidget() {
  const { isRunning, elapsedSeconds, timerData, stopTimer, cancelTimer } = useActiveTimer();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDate, setPendingDate] = useState(civilDateInBuenosAires(new Date()));
  const [pendingHours, setPendingHours] = useState("");
  const [pendingDesc, setPendingDesc] = useState("");
  const [pendingTaskId, setPendingTaskId] = useState<number | null>(null);
  const [pendingPersonnelId, setPendingPersonnelId] = useState<number | null>(null);
  const [pendingTaskTitle, setPendingTaskTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Keep mounted while dialog is open even if timer stopped
  if (!isRunning && !confirmOpen) return null;

  const handleStop = () => {
    const snapshotTitle = timerData?.taskTitle ?? "";
    const result = stopTimer();
    if (!result) return;
    setPendingHours(`${Math.round(result.hours * 60)}m`);
    setPendingDesc("");
    setPendingDate(civilDateInBuenosAires(new Date()));
    setPendingTaskId(result.taskId);
    setPendingPersonnelId(result.personnelId);
    setPendingTaskTitle(snapshotTitle);
    setConfirmOpen(true);
  };

  const handleCancel = () => {
    cancelTimer();
  };

  const handleSave = async () => {
    if (!pendingTaskId) return;
    const parsed = parseHoursInput(pendingHours);
    const hours = parsed == null ? 0 : roundToMinute(parsed);
    if (!hours || hours < 1 / 60) {
      toast({ title: "Horas inválidas", description: "Ingresá al menos un minuto (1m)", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const created = await apiRequest(`/api/tasks/${pendingTaskId}/time`, "POST", {
        personnelId: pendingPersonnelId, date: pendingDate, hours, description: pendingDesc.trim() || null,
      });
      toast({ title: `${hours.toFixed(2)}h registradas`, description: created.costingWarning || created.warning || "Tiempo guardado correctamente" });
      void invalidateTaskQueries();
      setConfirmOpen(false);
    } catch {
      toast({ title: "Error al guardar", description: "No se pudo registrar el tiempo", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const displayTitle = (isRunning && timerData ? timerData.taskTitle : pendingTaskTitle) ?? "";
  const taskLabel = displayTitle.length > 28 ? displayTitle.slice(0, 28) + "…" : displayTitle;

  return (
    <>
      {isRunning && <div className="relative order-last w-full sm:order-none sm:w-auto shrink-0 flex items-center gap-2 bg-gray-900 text-white rounded-full px-4 py-2.5 shadow-2xl border border-gray-700">
        <Timer className="h-4 w-4 text-orange-400 animate-pulse flex-shrink-0" />
        <div className="flex flex-1 sm:flex-none flex-col leading-tight min-w-0">
          <span className="block text-[10px] text-gray-400 truncate max-w-[120px]">{taskLabel}</span>
          <span className="text-sm font-mono font-semibold tabular-nums">{formatElapsed(elapsedSeconds)}</span>
        </div>
        <Button
          size="sm"
          className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white rounded-full px-3 flex-shrink-0 ml-1"
          onClick={handleStop}
        >
          <Square className="h-3 w-3 mr-1 fill-current" />
          Detener
        </Button>
        <button
          className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0 ml-1"
          onClick={handleCancel}
          title="Cancelar sin guardar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>}

      <Dialog open={confirmOpen} onOpenChange={open => { if (!open && !isSaving) setConfirmOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Timer className="h-4 w-4 text-orange-500" />
              Registrar tiempo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground truncate">{displayTitle}</p>
            <div><label className="text-xs text-muted-foreground mb-1 block">Fecha</label><Input type="date" value={pendingDate} onChange={e => setPendingDate(e.target.value)} aria-label="Fecha de las horas" /></div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Horas</label>
              <Input
                autoFocus
                type="text"
                placeholder="1m, 1:30 o 1.5"
                value={pendingHours}
                onChange={e => setPendingHours(e.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">¿En qué trabajaste? (opcional)</label>
              <Input
                value={pendingDesc}
                onChange={e => setPendingDesc(e.target.value)}
                placeholder="Descripción..."
                className="h-9"
                onKeyDown={e => { if (e.key === "Enter") handleSave(); }}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving || !pendingDate} className="bg-green-600 hover:bg-green-700 text-white">
              {isSaving ? "Guardando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
