import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { getApiErrorMessage } from "@/lib/api-error";
import { invalidateQuotationPortfolio } from "@/lib/quotation-cache";
import { useToast } from "@/hooks/use-toast";

export function ArchiveGroupButton({ groupId, name, projects }: { groupId: number; name: string; projects: string[] }) {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const { toast } = useToast();
  const mutation = useMutation({
    mutationFn: () => apiRequest(`/api/quotation-groups/${groupId}/archive`, "POST", { archived: true }),
    onSuccess: async () => {
      await invalidateQuotationPortfolio(client);
      setOpen(false);
      toast({ title: "Grupo archivado", description: "Podés recuperarlo desde Ver archivadas. Se conservó el historial de todas sus propuestas." });
    },
    onError: error => toast({ title: "No se pudo archivar", description: getApiErrorMessage(error), variant: "destructive" }),
  });
  return <>
    <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label={`Archivar grupo ${name}`}><Archive className="mr-1.5 h-4 w-4" />Archivar grupo</Button>
    <Dialog open={open} onOpenChange={value => !mutation.isPending && setOpen(value)}><DialogContent>
      <DialogHeader><DialogTitle>Archivar {name}</DialogTitle><DialogDescription>Se ocultarán el grupo y sus {projects.length} propuestas de las listas y métricas activas. Los enlaces públicos dejarán de estar disponibles mientras estén archivadas. Los proyectos vinculados y el historial se conservan.</DialogDescription></DialogHeader>
      <ul className="list-disc space-y-1 pl-5 text-sm">{projects.map((project, index) => <li key={index}>{project}</li>)}</ul>
      <p className="text-sm text-muted-foreground">Podés restaurar el conjunto desde Ver archivadas. Las propuestas archivadas previamente por separado conservarán su estado.</p>
      <DialogFooter><Button variant="outline" disabled={mutation.isPending} onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? "Archivando…" : "Archivar grupo y propuestas"}</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}
