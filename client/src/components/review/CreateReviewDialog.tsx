import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Check, Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/queryClient";
import { reviewApi, reviewKeys, ROOM_PALETTE } from "@/lib/review-api";
import { setLastReviewRoomId } from "@/hooks/use-review-room";

interface Props {
  open: boolean;
  onClose: () => void;
}

type AppUser = { id: number; name: string; email: string };

export default function CreateReviewDialog({ open, onClose }: Props) {
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [colorIndex, setColorIndex] = useState(1);
  const [emoji, setEmoji] = useState("");
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setColorIndex(1);
    setEmoji("");
    setMemberIds([]);
    setIsPrivate(false);
  }, [open]);

  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ['create-review-users'],
    queryFn: async () => {
      const r = await authFetch('/api/status-semanal/users');
      if (!r.ok) return [];
      return r.json();
    },
    enabled: open,
  });

  const createMut = useMutation({
    mutationFn: () => reviewApi.createRoom({
      name: name.trim(),
      description: description.trim() || null,
      colorIndex,
      emoji: emoji.trim() || null,
      memberIds: isPrivate ? [] : memberIds,
      privacy: isPrivate ? 'private' : 'members',
    }),
    onSuccess: (room: any) => {
      qc.invalidateQueries({ queryKey: reviewKeys.all });
      toast({ title: "Sala creada", description: `"${room.name}" lista para usar` });
      setLastReviewRoomId(room.id);
      onClose();
      navigate(`/review/${room.id}`);
    },
    onError: (err: Error) => {
      console.error('[CreateReview] Failed:', err);
      toast({ title: "Error al crear sala", description: err.message || "Error desconocido. Revisá la conexión.", variant: "destructive" });
    },
  });

  const canSubmit = name.trim().length > 0 && !createMut.isPending;

  const sortedUsers = useMemo(() => users.slice().sort((a, b) => a.name.localeCompare(b.name)), [users]);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear sala de status</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="rname">Nombre</Label>
            <Input id="rname" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Status con COO" autoFocus />
          </div>

          <div>
            <Label htmlFor="rdesc">Descripción (opcional)</Label>
            <Textarea id="rdesc" value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Ej: Status semanal con el equipo de liderazgo" />
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div>
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {ROOM_PALETTE.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setColorIndex(i)}
                    className={cn(
                      "h-7 w-7 rounded-full transition-all",
                      c.chip,
                      colorIndex === i && `ring-2 ring-offset-2 ${c.ring}`,
                    )}
                    aria-label={c.name}
                  >
                    {colorIndex === i && <Check className="h-4 w-4 text-white mx-auto" />}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="remoji">Emoji</Label>
              <Input
                id="remoji"
                value={emoji}
                onChange={e => setEmoji(e.target.value.slice(0, 4))}
                placeholder="📋"
                className="w-20 text-center text-lg"
              />
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-3">
            <Lock className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="rprivate" className="text-sm font-medium text-slate-800 cursor-pointer">
                  Solo para mí
                </Label>
                <Switch id="rprivate" checked={isPrivate} onCheckedChange={setIsPrivate} />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Tu vista personal. Nadie más la ve. Podés invitar gente después.
              </p>
            </div>
          </div>

          {!isPrivate && (
            <div>
              <Label>Participantes ({memberIds.length})</Label>
              <p className="text-xs text-slate-500 mb-2">Podrán ver y editar el board. Vos quedás como <strong>owner</strong>.</p>
              <div className="max-h-52 overflow-y-auto border rounded-md divide-y">
                {sortedUsers.map(u => {
                  const checked = memberIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50",
                        checked && "bg-indigo-50",
                      )}
                      onClick={() => setMemberIds(prev => prev.includes(u.id) ? prev.filter(x => x !== u.id) : [...prev, u.id])}
                    >
                      <span>
                        <span className="font-medium">{u.name}</span>
                        <span className="text-slate-500 ml-2 text-xs">{u.email}</span>
                      </span>
                      {checked && <Check className="h-4 w-4 text-indigo-600" />}
                    </button>
                  );
                })}
                {sortedUsers.length === 0 && (
                  <div className="text-sm text-slate-500 text-center py-4">Cargando usuarios…</div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => createMut.mutate()} disabled={!canSubmit}>
            {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Crear sala
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
