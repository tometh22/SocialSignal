import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest, authFetchJson } from "@/lib/queryClient";
import { getApiErrorMessage } from "@/lib/api-error";
import { useToast } from "@/hooks/use-toast";

type ProjectCandidate = {
  id: number;
  name: string;
  client_name: string | null;
  status: string;
  created_at: string | null;
  logged_hours: number;
};

type QuotationCandidate = {
  id: number;
  name: string;
  client_name: string | null;
  status: string;
  total_amount: number | null;
  created_at: string | null;
  expires_at: string | null;
  reason: string;
};

type Candidates = { projects: ProjectCandidate[]; quotations: QuotationCandidate[] };

const REASON_STYLE: Record<string, string> = {
  prueba: "bg-amber-100 text-amber-800",
  vencida: "bg-slate-100 text-slate-700",
  "sin cerrar": "bg-blue-100 text-blue-800",
};

const formatDate = (value: string | null) =>
  value ? new Intl.DateTimeFormat("es-AR", { dateStyle: "short" }).format(new Date(value)) : "—";

export function TestDataCleanup() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProjects, setSelectedProjects] = useState<Set<number>>(new Set());
  const [selectedQuotations, setSelectedQuotations] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<Candidates>({
    queryKey: ["/api/admin/cleanup/candidates"],
    queryFn: () => authFetchJson<Candidates>("/api/admin/cleanup/candidates"),
    staleTime: 0,
  });

  const projects = data?.projects ?? [];
  const quotations = data?.quotations ?? [];
  const totalSelected = selectedProjects.size + selectedQuotations.size;

  const archiveMutation = useMutation({
    mutationFn: () => apiRequest("/api/admin/cleanup/archive", "POST", {
      projectIds: [...selectedProjects],
      quotationIds: [...selectedQuotations],
    }),
    onSuccess: (result: { archivedQuotations: unknown[]; voidedProjects: unknown[] }) => {
      setConfirmOpen(false);
      setSelectedProjects(new Set());
      setSelectedQuotations(new Set());
      void refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/active-projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/projects"] });
      toast({
        title: "Limpieza aplicada",
        description: `${result.archivedQuotations.length} cotizaciones archivadas y ${result.voidedProjects.length} proyectos anulados. Se puede revertir.`,
      });
    },
    onError: (mutationError) => {
      setConfirmOpen(false);
      toast({
        title: "No se pudo completar la limpieza",
        description: getApiErrorMessage(mutationError, "Intentá de nuevo."),
        variant: "destructive",
      });
    },
  });

  const toggle = (set: Set<number>, update: (next: Set<number>) => void, id: number) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    update(next);
  };

  const allSelected = useMemo(
    () => projects.length + quotations.length > 0
      && selectedProjects.size === projects.length
      && selectedQuotations.size === quotations.length,
    [projects.length, quotations.length, selectedProjects.size, selectedQuotations.size],
  );

  const toggleAll = () => {
    if (allSelected) {
      setSelectedProjects(new Set());
      setSelectedQuotations(new Set());
      return;
    }
    setSelectedProjects(new Set(projects.map((item) => item.id)));
    setSelectedQuotations(new Set(quotations.map((item) => item.id)));
  };

  if (isError) {
    return (
      <Card className="standard-card mt-6">
        <CardContent className="flex items-start gap-3 p-6 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">No pudimos cargar los candidatos.</p>
            <p className="mt-1 text-red-700">{getApiErrorMessage(error, "Esta sección requiere permisos de administrador.")}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <Card className="standard-card">
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <CardTitle className="heading-card">Limpiar datos de prueba</CardTitle>
              <CardDescription>
                Saca de la vista las cotizaciones y proyectos de prueba para poder probar el ciclo completo con datos reales.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <strong>Nada se borra.</strong> Las cotizaciones se archivan y los proyectos quedan como anulados: dejan de
            aparecer en los listados, pero conservan su historial y se pueden restaurar.
          </div>
          {isLoading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />Buscando candidatos…
            </div>
          ) : projects.length + quotations.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No hay nada para limpiar: no encontramos proyectos ni cotizaciones de prueba, vencidas o sin cerrar.
            </p>
          ) : (
            <>
              <div className="mt-4 flex items-center justify-between border-b pb-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Seleccionar todo" />
                  Seleccionar todo
                </label>
                <span className="text-xs text-muted-foreground">{totalSelected} seleccionados</span>
              </div>

              {projects.length > 0 && (
                <section className="mt-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Proyectos ({projects.length})
                  </h3>
                  <div className="space-y-1">
                    {projects.map((project) => (
                      <label key={project.id} className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-accent/30">
                        <Checkbox
                          checked={selectedProjects.has(project.id)}
                          onCheckedChange={() => toggle(selectedProjects, setSelectedProjects, project.id)}
                          aria-label={`Seleccionar ${project.name}`}
                        />
                        <span className="min-w-0 flex-1 truncate font-medium">{project.name}</span>
                        <span className="hidden truncate text-xs text-muted-foreground sm:inline">{project.client_name || "Sin cliente"}</span>
                        {project.logged_hours > 0 && (
                          <Badge variant="outline" className="shrink-0 border-amber-200 bg-amber-50 text-[10px] text-amber-800">
                            {project.logged_hours.toFixed(1)} h cargadas
                          </Badge>
                        )}
                        <span className="shrink-0 text-xs text-muted-foreground">{formatDate(project.created_at)}</span>
                      </label>
                    ))}
                  </div>
                </section>
              )}

              {quotations.length > 0 && (
                <section className="mt-5">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Cotizaciones ({quotations.length})
                  </h3>
                  <div className="space-y-1">
                    {quotations.map((quote) => (
                      <label key={quote.id} className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-accent/30">
                        <Checkbox
                          checked={selectedQuotations.has(quote.id)}
                          onCheckedChange={() => toggle(selectedQuotations, setSelectedQuotations, quote.id)}
                          aria-label={`Seleccionar ${quote.name}`}
                        />
                        <span className="min-w-0 flex-1 truncate font-medium">{quote.name}</span>
                        <span className="hidden truncate text-xs text-muted-foreground sm:inline">{quote.client_name || "Sin cliente"}</span>
                        <Badge variant="outline" className={`shrink-0 border-transparent text-[10px] ${REASON_STYLE[quote.reason] || ""}`}>
                          {quote.reason}
                        </Badge>
                        <span className="shrink-0 text-xs text-muted-foreground">{formatDate(quote.created_at)}</span>
                      </label>
                    ))}
                  </div>
                </section>
              )}

              <div className="mt-5 flex justify-end">
                <Button disabled={totalSelected === 0 || archiveMutation.isPending} onClick={() => setConfirmOpen(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Archivar {totalSelected > 0 ? `(${totalSelected})` : ""}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar {totalSelected} elemento{totalSelected === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se archivarán {selectedQuotations.size} cotizaciones y se anularán {selectedProjects.size} proyectos.
              Dejan de aparecer en los listados pero conservan su historial, así que se puede revertir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => { event.preventDefault(); archiveMutation.mutate(); }}
              disabled={archiveMutation.isPending}
            >
              {archiveMutation.isPending ? "Archivando…" : "Archivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
