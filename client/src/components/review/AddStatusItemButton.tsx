import { useEffect, useId, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type NewItemInput = { title: string; subtitle: string; ownerId: number | null; healthStatus: string; deadline: string | null; firstUpdate: string };

const healthOptions = [
  { value: 'verde', label: 'Verde', dot: 'bg-emerald-500' },
  { value: 'amarillo', label: 'Amarillo', dot: 'bg-amber-400' },
  { value: 'rojo', label: 'Rojo', dot: 'bg-red-500' },
];

export default function AddStatusItemButton({ onAdd, variant = 'header', users = [], currentUserId = null }: {
  onAdd: (data: NewItemInput) => void;
  variant?: 'header' | 'inline' | 'daily';
  users?: { id: number; name: string }[];
  currentUserId?: number | null;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [firstUpdate, setFirstUpdate] = useState('');
  const [ownerId, setOwnerId] = useState<number | null>(currentUserId);
  const [health, setHealth] = useState('verde');
  const [deadline, setDeadline] = useState('');
  useEffect(() => { if (open) setOwnerId(prev => prev ?? currentUserId); }, [open, currentUserId]);

  const reset = () => { setTitle(''); setFirstUpdate(''); setOwnerId(currentUserId); setHealth('verde'); setDeadline(''); };
  const submit = () => {
    if (!title.trim()) return;
    onAdd({ title: title.trim(), subtitle: '', ownerId, healthStatus: health, deadline: deadline ? new Date(`${deadline}T12:00:00`).toISOString() : null, firstUpdate: firstUpdate.trim() });
    reset(); setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={value => { setOpen(value); if (!value) reset(); }}>
      <DialogTrigger asChild>
        {variant === 'inline' ? (
          <button aria-label="Agregar ítem" className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 font-medium transition-colors ml-1"><Plus className="h-3.5 w-3.5" /></button>
        ) : variant === 'daily' ? (
          <button className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 px-2 py-1.5"><Plus className="h-3.5 w-3.5" /> Agregar ítem</button>
        ) : (
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50"><Plus className="h-3.5 w-3.5" /> Agregar ítem</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl gap-0 p-0 sm:p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-5 sm:px-7 pt-6 pb-4 pr-14 shrink-0 text-left">
          <DialogTitle>Nuevo ítem</DialogTitle>
          <DialogDescription>Sumá el tema y su contexto para el próximo status.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col min-h-0" onSubmit={e => { e.preventDefault(); submit(); }}>
          <div className="overflow-y-auto min-h-0 px-5 sm:px-7 pb-5 space-y-5">
            <div className="space-y-2">
              <label htmlFor={`${id}-title`} className="text-sm font-medium">Título</label>
              <input id={`${id}-title`} value={title} onChange={e => setTitle(e.target.value)} autoFocus
                placeholder="Qué es (ej: Propuesta Café Martínez)"
                className="w-full text-sm border border-input rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400/30" />
            </div>
            <div className="space-y-2">
              <label htmlFor={`${id}-update`} className="text-sm font-medium">Qué está pasando</label>
              <Textarea id={`${id}-update`} value={firstUpdate} onChange={e => setFirstUpdate(e.target.value)} rows={10}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }}
                placeholder="Qué está pasando (queda como primer update)"
                className="min-h-[240px] max-h-[50dvh] resize-y text-sm leading-relaxed" />
              <p className="text-xs text-slate-500">Podés pegar texto con párrafos y viñetas. Enter agrega una línea; Ctrl/⌘ + Enter guarda el ítem.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor={`${id}-owner`} className="text-sm font-medium">Responsable</label>
                <select id={`${id}-owner`} aria-label="Responsable del ítem" value={ownerId?.toString() ?? ''} onChange={e => setOwnerId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full min-w-0 text-sm border border-input rounded-lg px-3 py-2.5 bg-white">
                  <option value="">Sin owner</option>
                  {users.map(user => <option key={user.id} value={user.id}>{user.name}{user.id === currentUserId ? ' (yo)' : ''}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor={`${id}-deadline`} className="text-sm font-medium">Fecha límite <span className="text-slate-400 font-normal">(opcional)</span></label>
                <input id={`${id}-deadline`} type="date" aria-label="Fecha límite opcional" value={deadline} onChange={e => setDeadline(e.target.value)} className="w-full min-w-0 text-sm border border-input rounded-lg px-3 py-2.5" />
              </div>
            </div>
            <fieldset>
              <legend className="text-sm font-medium mb-2">Semáforo inicial</legend>
              <div className="flex flex-wrap gap-2">
                {healthOptions.map(option => <button key={option.value} type="button" aria-pressed={health === option.value} onClick={() => setHealth(option.value)}
                  className={cn("inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm", health === option.value ? "border-indigo-400 bg-indigo-50" : "border-slate-200")}>
                  <span className={cn("h-2.5 w-2.5 rounded-full", option.dot)} />{option.label}
                </button>)}
              </div>
            </fieldset>
          </div>
          <div className="flex justify-end gap-2 border-t bg-slate-50 px-5 sm:px-7 py-4 shrink-0">
            <Button type="button" variant="outline" onClick={() => { setOpen(false); reset(); }}>Cancelar</Button>
            <Button type="submit" disabled={!title.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white">Agregar ítem</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
