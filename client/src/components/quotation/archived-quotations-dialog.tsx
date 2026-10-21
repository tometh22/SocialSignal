import { ArchiveGroupButton } from "./archive-group-button";
import { invalidateQuotationPortfolio } from "@/lib/quotation-cache";
import { formatQuotationAmount } from "@shared/utils/quotation-display";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest, authFetchJson } from "@/lib/queryClient";
import { getApiErrorMessage } from "@/lib/api-error";
import { useToast } from "@/hooks/use-toast";
import { statusLabel } from "@/lib/status-labels";

type ArchivedQuotation = {
  id: number;
  projectName: string;
  clientName: string | null;
  status: string;
  totalAmount: number | null;
  quotationCurrency: string;
  archivedAt: string;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));



/**
 * Lista + restaurar, sin el envoltorio de diálogo. Ninguna otra pantalla
 * mostraba qué cotizaciones estaban archivadas: la app ya podía archivarlas
 * desde el tacho de Gestión de Cotizaciones (preexistente) y desde la
 * Limpieza de Admin, pero recuperar una exigía conocer su id de memoria.
 */
function ArchivedQuotationsBody() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: archived = [], isLoading, isError, error, refetch } = useQuery<ArchivedQuotation[]>({
    queryKey: ["/api/quotations/archived"],
    queryFn: () => authFetchJson<ArchivedQuotation[]>("/api/quotations/archived"),
    staleTime: 0,
  });

  const { data: groups = [], isError: groupsError, isLoading: groupsLoading } = useQuery<Array<{ id: number; name: string; groupNumber: string; activeProjects: string[] }>>({
    queryKey: ["/api/quotation-groups/archived"], staleTime: 0,
  });
  const restoreGroupMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/quotation-groups/${id}/archive`, "POST", { archived: false }),
    onSuccess: async () => { await invalidateQuotationPortfolio(queryClient); toast({ title: "Grupo restaurado", description: "Se recuperaron las propuestas archivadas con el grupo." }); },
    onError: error => toast({ title: "No se pudo restaurar el grupo", description: getApiErrorMessage(error), variant: "destructive" }),
  });
  const restoreMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/quotations/${id}/restore`, "POST"),
    onSuccess: (_result, id) => {
      void refetch();
      void invalidateQuotationPortfolio(queryClient);
      const name = archived.find((item) => item.id === id)?.projectName;
      toast({ title: "Cotización restaurada", description: name ? `"${name}" volvió a Gestión de Cotizaciones.` : undefined });
    },
    onError: (mutationError) => toast({
      title: "No se pudo restaurar",
      description: getApiErrorMessage(mutationError, "Intentá de nuevo."),
      variant: "destructive",
    }),
  });

  if (isLoading || groupsLoading) {
    return <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando…</div>;
  }
  if (isError || groupsError) {
    return <p className="p-2 text-sm text-red-700">{getApiErrorMessage(error, "No pudimos cargar el listado.")}</p>;
  }
  if (archived.length === 0 && groups.length === 0) {
    return <p className="p-2 text-sm text-muted-foreground">No hay cotizaciones archivadas.</p>;
  }
  return (
    <div className="space-y-1">
      {groups.map(group => <div key={group.id} className="mb-3 flex items-center gap-3 rounded-md border border-indigo-200 bg-indigo-50 p-3 text-sm">
        <span className="min-w-0 flex-1"><strong>{group.name}</strong><span className="block text-xs text-muted-foreground">{group.groupNumber} · Grupo de propuestas</span></span>
        {group.activeProjects.length > 0 && <div><p className="text-xs text-amber-800">{group.activeProjects.length} propuestas todavía activas</p><ArchiveGroupButton groupId={group.id} name={group.name} projects={group.activeProjects} /></div>}
        <Button size="sm" variant="outline" disabled={restoreGroupMutation.isPending || restoreMutation.isPending} onClick={() => restoreGroupMutation.mutate(group.id)}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Restaurar grupo</Button>
      </div>)}
      {archived.map((quote) => (
        <div key={quote.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-slate-200 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate font-medium">{quote.projectName}</span>
          <span className="hidden truncate text-xs text-muted-foreground sm:inline">{quote.clientName || "Sin cliente"}</span>
          <Badge variant="outline" className="shrink-0 text-[10px]">{statusLabel(quote.status)}</Badge>
          <span className="shrink-0 text-xs text-muted-foreground">{formatQuotationAmount(quote.totalAmount, quote.quotationCurrency)}</span>
          <span className="shrink-0 text-xs text-muted-foreground">archivada {formatDate(quote.archivedAt)}</span>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            disabled={restoreMutation.isPending || restoreGroupMutation.isPending}
            onClick={() => restoreMutation.mutate(quote.id)}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />Restaurar
          </Button>
        </div>
      ))}
    </div>
  );
}

/**
 * Card standalone para embeber en la pestaña Limpieza de Admin, junto al
 * mismo listado para proyectos anulados.
 */
export function ArchivedQuotationsList() {
  return (
    <Card className="standard-card">
      <CardHeader>
        <CardTitle className="text-sm">Cotizaciones archivadas</CardTitle>
        <CardDescription>
          Conservan revisiones, aprobaciones y proyectos vinculados. Restaurar las devuelve a Gestión de Cotizaciones.
        </CardDescription>
      </CardHeader>
      <CardContent><ArchivedQuotationsBody /></CardContent>
    </Card>
  );
}

/** Botón + diálogo, para embeber en la cabecera de Gestión de Cotizaciones. */
export function ArchivedQuotationsDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Archive className="h-4 w-4" />Ver archivadas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cotizaciones archivadas</DialogTitle>
          <DialogDescription>
            Se archivan pero nunca se borran: conservan revisiones, aprobaciones y proyectos vinculados.
          </DialogDescription>
        </DialogHeader>
        <ArchivedQuotationsBody />
      </DialogContent>
    </Dialog>
  );
}
