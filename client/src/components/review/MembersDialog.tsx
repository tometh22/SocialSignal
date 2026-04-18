import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, UserMinus, Crown, Loader2, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/queryClient";
import { reviewApi, reviewKeys, type ReviewRoomDetail } from "@/lib/review-api";
import { initials } from "./utils";

interface Props {
  open: boolean;
  onClose: () => void;
  room: ReviewRoomDetail;
  myRole: 'owner' | 'editor';
}

type AppUser = { id: number; name: string; email: string };

export default function MembersDialog({ open, onClose, room, myRole }: Props) {
  const qc = useQueryClient();
  const isOwner = myRole === 'owner';
  const [toAdd, setToAdd] = useState<number | null>(null);

  const { data: allUsers = [] } = useQuery<AppUser[]>({
    queryKey: ['members-dialog-users'],
    queryFn: async () => {
      const r = await authFetch('/api/status-semanal/users');
      if (!r.ok) return [];
      return r.json();
    },
    enabled: open && isOwner,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: reviewKeys.detail(room.id) });

  const addMut = useMutation({
    mutationFn: (userId: number) => reviewApi.addMember(room.id, userId, 'editor'),
    onSuccess: () => { invalidate(); setToAdd(null); toast({ title: "Miembro agregado" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const removeMut = useMutation({
    mutationFn: (userId: number) => reviewApi.removeMember(room.id, userId),
    onSuccess: () => { invalidate(); toast({ title: "Miembro removido" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const promoteMut = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: 'owner' | 'editor' }) =>
      reviewApi.updateMember(room.id, userId, role),
    onSuccess: () => { invalidate(); toast({ title: "Rol actualizado" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const currentIds = useMemo(() => new Set(room.members.map(m => m.userId)), [room.members]);
  const candidateUsers = useMemo(
    () => allUsers.filter(u => !currentIds.has(u.id)).sort((a, b) => a.name.localeCompare(b.name)),
    [allUsers, currentIds],
  );

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Miembros de {room.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="max-h-64 overflow-y-auto divide-y border rounded-md">
            {room.members.map(m => (
              <div key={m.userId} className="flex items-center gap-3 px-3 py-2 text-sm">
                <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-700">
                  {initials(`${m.firstName ?? ''} ${m.lastName ?? ''}`.trim())}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{`${m.firstName ?? ''} ${m.lastName ?? ''}`.trim()}</div>
                  <div className="text-xs text-slate-500 truncate">{m.email}</div>
                </div>
                <Badge variant={m.role === 'owner' ? 'default' : 'outline'} className="text-xs">
                  {m.role === 'owner' && <Crown className="h-3 w-3 mr-1" />}
                  {m.role === 'owner' ? 'Owner' : 'Editor'}
                </Badge>
                {isOwner && (
                  <div className="flex items-center gap-1">
                    {m.role === 'editor' ? (
                      <Button size="sm" variant="ghost" onClick={() => promoteMut.mutate({ userId: m.userId, role: 'owner' })} title="Promover a owner">
                        <Crown className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => promoteMut.mutate({ userId: m.userId, role: 'editor' })} title="Degradar a editor">
                        <Crown className="h-4 w-4 text-amber-400" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => removeMut.mutate(m.userId)} title="Quitar">
                      <Trash2 className="h-4 w-4 text-rose-500" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {isOwner && (
            <div>
              <label className="text-xs text-slate-500">Agregar miembro</label>
              <div className="flex gap-2 mt-1">
                <select
                  className="flex-1 border rounded-md px-2 py-1.5 text-sm"
                  value={toAdd ?? ''}
                  onChange={e => setToAdd(e.target.value ? parseInt(e.target.value, 10) : null)}
                >
                  <option value="">Elegir usuario…</option>
                  {candidateUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name} — {u.email}</option>
                  ))}
                </select>
                <Button size="sm" disabled={toAdd == null || addMut.isPending} onClick={() => toAdd && addMut.mutate(toAdd)}>
                  {addMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
