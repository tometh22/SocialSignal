import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const LOSS_REASONS = [
  { value: "precio", label: "Precio muy alto", icon: "💰" },
  { value: "timing", label: "Timing / no era el momento", icon: "⏱️" },
  { value: "competidor", label: "Eligieron a un competidor", icon: "🏆" },
  { value: "scope", label: "Scope no alineado", icon: "📐" },
  { value: "budget_frozen", label: "Presupuesto congelado", icon: "🧊" },
  { value: "otro", label: "Otro motivo", icon: "💬" },
];

interface LossReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotationName: string;
  onConfirm: (reason: string) => void;
  isLoading?: boolean;
}

export function LossReasonDialog({ open, onOpenChange, quotationName, onConfirm, isLoading }: LossReasonDialogProps) {
  const [selected, setSelected] = useState<string>("");
  const [notes, setNotes] = useState("");

  const handleConfirm = () => {
    if (!selected) return;
    const full = notes.trim() ? `${selected} — ${notes.trim()}` : selected;
    onConfirm(full);
  };

  const handleClose = () => {
    setSelected("");
    setNotes("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Marcar cotización como perdida</DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            <span className="font-medium text-slate-700">"{quotationName}"</span>
            {" "}— ¿Cuál fue el motivo principal?
          </p>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 mt-2">
          {LOSS_REASONS.map((r) => (
            <button
              key={r.value}
              onClick={() => setSelected(r.value)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm text-left transition-all",
                selected === r.value
                  ? "border-red-300 bg-red-50 text-red-700 font-medium"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              <span className="text-base">{r.icon}</span>
              <span className="leading-tight">{r.label}</span>
            </button>
          ))}
        </div>

        <Textarea
          placeholder="Notas adicionales (opcional)..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-2 text-sm h-20 resize-none"
        />

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>Cancelar</Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!selected || isLoading}
          >
            {isLoading ? "Guardando..." : "Marcar como perdida"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
