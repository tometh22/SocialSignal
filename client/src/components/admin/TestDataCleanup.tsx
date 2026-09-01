import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
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
  last_activity_at: string | null;
  reason: string;
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

type VoidedProject = {
  id: number;
  name: string;
  client_name: string | null;
  closed_at: string | null;
};

type Candidates = {
  projects: ProjectCandidate[];
  quotations: QuotationCandidate[];
  recentlyVoided: VoidedProject[];
};

const REASON_STYLE: Record<string, string> = {
  prueba: "bg-amber-100 text-amber-800",
  vencida: "bg-slate-100 text-slate-700",
  "sin cerrar": "bg-blue-100 text-blue-800",
  "sin horas cargadas": "bg-amber-100 text-amber-800",
  "sin actividad hace más de 6 meses": "bg-slate-100 text-slate-700",
  "con actividad reciente": "bg-emerald-100 text-emerald-800",
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
  const recentlyVoided = data?.recentlyVoided ?? [];
  const totalSelected = selectedProjects.size + selectedQuotations.size;

  const invalidateDownstream = () => {
    void refetch();
    queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
    queryClient.invalidateQueries({ queryKey: ["/api/active-projects"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tasks/projects"] });
  };

  const archiveMutation = useMutation({
    mutationFn: () => apiRequest("/api/admin/cleanup/archive", "POST", {
      projectIds: [...selectedProjects],
      quotationIds: [...selectedQuotations],
    }),
    onSuccess: (result: { archivedQuotations: unknown[]; voidedProjects: unknown[] }) => {
      setConfirmOpen(false);
      setSelectedProjects(new Set());
      setSelectedQuotations(new Set());
      invalidateDownstream();
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

  const restoreMutation = useMutation({
    mutationFn: (projectId: number) => apiRequest("/api/admin/cleanup/restore-project", "POST", { projectId }),
    onSuccess: (_result, projectId) => {
      invalidateDownstream();
      const name = recentlyVoided.find((item) => item.id === projectId)?.name;
      toast({ title: "Proyecto restaurado", description: name ? `"${name}" volvió a estar activo.` : undefined });
    },
    onError: (mutationError) => toast({
      title: "No se pudo restaurar",
      description: getApiErrorMessage(mutationError, "Intentá de nuevo."),
      variant: "destructive",
    }),
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
                Saca de la vista las cotizaciones y proyectos que ya no necesitás ver, para poder trabajar sólo con lo vigente.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <strong>Nada se borra ni cambia ningún número.</strong> Las cotizaciones se archivan y los proyectos quedan
            anulados: dejan de aparecer en los listados y de aceptar cargas nuevas, pero conservan intacto su historial de
            horas y facturación — y se pueden restaurar en cualquier momento.
          </div>
          {isLoading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />Buscando candidatos…
            </div>
          ) : projects.length + quotations.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No hay proyectos ni cotizaciones activos para limpiar.
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
                    Proyectos ({projects.length}) · ordenados de más a menos candidato
                  </h3>
                  <div className="space-y-1">
                    {projects.map((project) => (
                      <label key={project.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-accent/30">
                        <Checkbox
                          checked={selectedProjects.has(project.id)}
                          onCheckedChange={() => toggle(selectedProjects, setSelectedProjects, project.id)}
                          aria-label={`Seleccionar ${project.name}`}
                        />
                        <span className="min-w-0 flex-1 truncate font-medium">{project.name}</span>
                        <span className="hidden truncate text-xs text-muted-foreground sm:inline">{project.client_name || "Sin cliente"}</span>
                        <Badge variant="outline" className={`shrink-0 border-transparent text-[10px] ${REASON_STYLE[project.reason] || ""}`}>
                          {project.reason}
                        </Badge>
                        {project.logged_hours > 0 && (
                          <Badge variant="outline" className="shrink-0 border-amber-200 bg-amber-50 text-[10px] text-amber-800">
                            {project.logged_hours.toFixed(1)} h cargadas
                          </Badge>
                        )}
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {project.last_activity_at ? `última carga ${formatDate(project.last_activity_at)}` : `creado ${formatDate(project.created_at)}`}
                        </span>
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

      {recentlyVoided.length > 0 && (
        <Card className="standard-card">
          <CardHeader>
            <CardTitle className="text-sm">Anulados recientemente</CardTitle>
            <CardDescription>Si archivaste algo por error, restauralo desde acá.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {recentlyVoided.map((project) => (
                <div key={project.id} className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium">{project.name}</span>
                  <span className="hidden truncate text-xs text-muted-foreground sm:inline">{project.client_name || "Sin cliente"}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDate(project.closed_at)}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    disabled={restoreMutation.isPending}
                    onClick={() => restoreMutation.mutate(project.id)}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />Restaurar
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar {totalSelected} elemento{totalSelected === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se archivarán {selectedQuotations.size} cotizaciones y se anularán {selectedProjects.size} proyectos.
              Dejan de aparecer en los listados y de aceptar cargas nuevas, pero conservan su historial y se pueden
              restaurar desde "Anulados recientemente".
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
