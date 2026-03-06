import { useState } from "react";
import { Timer, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { authFetch, queryClient } from "@/lib/queryClient";
import { useActiveTimer, formatElapsed } from "@/hooks/useActiveTimer";

export default function GlobalTimerWidget() {
  const { isRunning, elapsedSeconds, timerData, stopTimer, cancelTimer } = useActiveTimer();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingHours, setPendingHours] = useState("");
  const [pendingDesc, setPendingDesc] = useState("");
  const [pendingTaskId, setPendingTaskId] = useState<number | null>(null);
  const [pendingPersonnelId, setPendingPersonnelId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isRunning || !timerData) return null;

  const handleStop = () => {
    const result = stopTimer();
    if (!result) return;
    setPendingHours(String(result.hours));
    setPendingDesc("");
    setPendingTaskId(result.taskId);
    setPendingPersonnelId(result.personnelId);
    setConfirmOpen(true);
  };

  const handleCancel = () => {
    cancelTimer();
  };

  const handleSave = async () => {
    if (!pendingTaskId) return;
    const hours = parseFloat(pendingHours);
    if (!hours || hours <= 0) {
      toast({ title: "Horas inválidas", description: "Ingresá un valor mayor a 0", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const res = await authFetch(`/api/tasks/${pendingTaskId}/time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personnelId: pendingPersonnelId,
          date: new Date().toISOString(),
          hours,
          description: pendingDesc.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Error al registrar");
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", pendingTaskId] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/hours-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/my-tasks"] });
      toast({ title: `${hours}h registradas`, description: "Tiempo guardado correctamente" });
      setConfirmOpen(false);
    } catch {
      toast({ title: "Error al guardar", description: "No se pudo registrar el tiempo", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const taskLabel = timerData.taskTitle.length > 28
    ? timerData.taskTitle.slice(0, 28) + "…"
    : timerData.taskTitle;

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-gray-900 text-white rounded-full px-4 py-2.5 shadow-2xl border border-gray-700">
        <Timer className="h-4 w-4 text-orange-400 animate-pulse flex-shrink-0" />
        <div className="flex flex-col leading-tight min-w-0">
          <span className="text-[11px] text-gray-400 truncate max-w-[160px]">{taskLabel}</span>
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
      </div>

      <Dialog open={confirmOpen} onOpenChange={open => { if (!open && !isSaving) setConfirmOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Timer className="h-4 w-4 text-orange-500" />
              Registrar tiempo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground truncate">{timerData.taskTitle}</p>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Horas</label>
              <Input
                autoFocus
                type="number"
                step="0.01"
                min="0.01"
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
            <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white">
              {isSaving ? "Guardando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
