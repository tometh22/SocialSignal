import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Check, Loader2, FolderPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/queryClient";
import { reviewApi } from "@/lib/review-api";

interface Props {
  open: boolean;
  onClose: () => void;
  roomId: number;
}

type AvailableProject = {
  projectId: number;
  clientName: string | null;
  quotationName: string | null;
};

export default function AddProjectDialog({ open, onClose, roomId }: Props) {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { data: projects = [], isLoading } = useQuery<AvailableProject[]>({
    queryKey: ['review-available-projects', roomId, open],
    queryFn: async () => {
      // Bypass queryClient URL rewrite by using the direct path.
      const r = await authFetch(`/api/reviews/${roomId}/available-projects`);
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    enabled: open,
    staleTime: 0,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(p =>
      (p.clientName?.toLowerCase().includes(q) || p.quotationName?.toLowerCase().includes(q)),
    );
  }, [projects, query]);

  const addMut = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map(id => reviewApi.addProject(roomId, id)));
    },
    onSuccess: () => {
      toast({ title: "Proyectos agregados", description: `${selected.size} proyecto(s) agregado(s) a la sala` });
      qc.invalidateQueries({ queryKey: ['/api/status-semanal?includeHidden=true'] });
      qc.invalidateQueries({ queryKey: ['review-available-projects', roomId] });
      setSelected(new Set());
      onClose();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggle = (id: number) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-4 w-4 text-indigo-600" />
            Agregar proyectos a la sala
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar proyecto o cliente…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          <div className="max-h-72 overflow-y-auto border rounded-md divide-y">
            {isLoading && (
              <div className="text-sm text-slate-500 text-center py-6">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Cargando proyectos…
              </div>
            )}
            {!isLoading && filtered.length === 0 && (
              <div className="text-sm text-slate-500 text-center py-6">
                {projects.length === 0
                  ? "Todos los proyectos activos ya están en esta sala."
                  : "No hay proyectos que coincidan con la búsqueda."}
              </div>
            )}
            {filtered.map(p => {
              const isSelected = selected.has(p.projectId);
              const name = p.quotationName || `Proyecto ${p.projectId}`;
              return (
                <button
                  key={p.projectId}
                  type="button"
                  onClick={() => toggle(p.projectId)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50 text-left",
                    isSelected && "bg-indigo-50",
                  )}
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{name}</div>
                    <div className="text-xs text-slate-500 truncate">{p.clientName ?? 'Sin cliente'}</div>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-indigo-600 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
          <div className="text-xs text-slate-500">
            {selected.size === 0
              ? "Seleccioná uno o más proyectos para agregarlos."
              : `${selected.size} proyecto(s) seleccionado(s).`}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => addMut.mutate([...selected])}
            disabled={selected.size === 0 || addMut.isPending}
          >
            {addMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Agregar {selected.size > 0 ? `(${selected.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
