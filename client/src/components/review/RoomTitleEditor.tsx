import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, Loader2, Lock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { reviewApi, reviewKeys } from "@/lib/review-api";

type Props = {
  roomId: number;
  name: string;
  privacy: 'members' | 'private' | string;
  myRole: 'owner' | 'editor';
};

export default function RoomTitleEditor({ roomId, name, privacy, myRole }: Props) {
  const isOwner = myRole === 'owner';
  const isPrivate = privacy === 'private';
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  useEffect(() => { setValue(name); }, [name]);

  const renameMut = useMutation({
    mutationFn: (newName: string) => reviewApi.updateRoom(roomId, { name: newName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reviewKeys.detail(roomId) });
      qc.invalidateQueries({ queryKey: reviewKeys.list() });
      toast({ title: "Nombre actualizado" });
      setOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "No se pudo renombrar", description: err.message, variant: "destructive" });
    },
  });

  const trimmed = value.trim();
  const canSave = trimmed.length > 0 && trimmed !== name && !renameMut.isPending;

  const submit = () => {
    if (!canSave) return;
    renameMut.mutate(trimmed);
  };

  const roleLabel = isPrivate ? 'Personal' : (isOwner ? 'Owner' : 'Editor');

  if (!isOwner) {
    return (
      <div className="flex items-center gap-2">
        <h1 className="text-base font-bold leading-tight text-white tracking-tight">{name}</h1>
        <span className="text-[9px] font-semibold bg-white/20 text-white px-1.5 py-0.5 rounded inline-flex items-center gap-1">
          {isPrivate && <Lock className="h-2.5 w-2.5" />}
          {roleLabel}
        </span>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) setTimeout(() => inputRef.current?.select(), 0); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 group rounded px-1 -mx-1 hover:bg-white/10 transition-colors"
          title="Renombrar sala"
        >
          <h1 className="text-base font-bold leading-tight text-white tracking-tight">{name}</h1>
          <Pencil className="h-3 w-3 text-white/50 group-hover:text-white transition-colors" />
          <span className="text-[9px] font-semibold bg-white/20 text-white px-1.5 py-0.5 rounded inline-flex items-center gap-1">
            {isPrivate && <Lock className="h-2.5 w-2.5" />}
            {roleLabel}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-700">Nombre de la sala</label>
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, 120))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); submit(); }
              if (e.key === 'Escape') { setOpen(false); setValue(name); }
            }}
            placeholder="Ej: Status con COO"
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setValue(name); }}>
              Cancelar
            </Button>
            <Button size="sm" onClick={submit} disabled={!canSave}>
              {renameMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Guardar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
