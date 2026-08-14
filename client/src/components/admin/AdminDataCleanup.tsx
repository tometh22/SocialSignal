import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, CheckSquare, FileText, FolderKanban, ListTodo, Loader2, RefreshCw, Search, ShieldAlert, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/loader";

type Resource = "projects" | "tasks" | "quotations" | "statuses";
type ViewMode = "inactive" | "all";

type ProjectRow = {
  id: number;
  name: string;
  status: string | null;
  isFinished: boolean;
  clientName?: string | null;
  taskCount: number;
  statusCount: number;
};
type TaskRow = {
  id: number;
  title: string;
  status: string | null;
  projectId: number;
  projectName: string;
  projectInactive: boolean;
  createdAt?: string;
};
type QuotationRow = {
  id: number;
  projectName: string;
  status: string | null;
  clientName?: string | null;
  createdAt?: string;
  projectCount: number;
};
type StatusRow = {
  id: number;
  title: string;
  subtitle?: string | null;
  roomId: number;
  roomName?: string | null;
  healthStatus?: string | null;
  marginStatus?: string | null;
  teamStrain?: string | null;
  hiddenFromWeekly?: boolean;
  createdAt?: string;
};
type Inventory = {
  projects: ProjectRow[];
  tasks: TaskRow[];
  quotations: QuotationRow[];
  statuses: StatusRow[];
};

const resources: { value: Resource; label: string; icon: typeof FolderKanban }[] = [
  { value: "projects", label: "Proyectos", icon: FolderKanban },
  { value: "tasks", label: "Tareas", icon: ListTodo },
  { value: "quotations", label: "Cotizaciones", icon: FileText },
  { value: "statuses", label: "Status personalizados", icon: Activity },
];

const emptySelection = (): Record<Resource, number[]> => ({ projects: [], tasks: [], quotations: [], statuses: [] });

function normalized(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function isInactive(resource: Resource, row: ProjectRow | TaskRow | QuotationRow | StatusRow): boolean {
  if (resource === "projects") {
    const project = row as ProjectRow;
    return project.isFinished || ![
      "active", "activo", "en curso", "on-hold", "en pausa", "delivered", "entregado", "invoiced", "facturado",
    ].includes(normalized(project.status));
  }
  if (resource === "tasks") {
    const task = row as TaskRow;
    return task.projectInactive || ["done", "completed", "completada", "cancelled", "cancelada"].includes(normalized(task.status));
  }
  if (resource === "quotations") {
    return ![
      "approved", "aprobada", "aprobado", "pending", "pendiente", "in-negotiation", "en negociacion", "en negociación",
    ].includes(normalized((row as QuotationRow).status));
  }
  return Boolean((row as StatusRow).hiddenFromWeekly);
}

function statusLabel(status?: string | null): string {
  return status || "Sin estado";
}

function formatDate(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("es-AR");
}

export function AdminDataCleanup() {
  const { toast } = useToast();
  const [resource, setResource] = useState<Resource>("projects");
  const [viewMode, setViewMode] = useState<ViewMode>("inactive");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<Resource, number[]>>(emptySelection);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  const inventoryQuery = useQuery<Inventory>({
    queryKey: ["/api/admin/data-cleanup"],
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("/api/admin/data-cleanup", {
      method: "DELETE",
      body: { ...selected, confirmation: "ELIMINAR_DEFINITIVAMENTE" },
    }),
    onSuccess: async (result: any) => {
      setSelected(emptySelection());
      setConfirmation("");
      setConfirmOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/data-cleanup"] });
      await queryClient.invalidateQueries();
      const deleted = result?.deleted ?? {};
      toast({
        title: "Datos eliminados definitivamente",
        description: `Proyectos: ${deleted.projects ?? 0} · Tareas: ${deleted.tasks ?? 0} · Cotizaciones: ${deleted.quotations ?? 0} · Status: ${deleted.statuses ?? 0}`,
      });
    },
    onError: (error: Error) => toast({ title: "No se pudieron eliminar los datos", description: error.message, variant: "destructive" }),
  });

  const rows = (inventoryQuery.data?.[resource] ?? []) as Array<ProjectRow | TaskRow | QuotationRow | StatusRow>;
  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (resource !== "statuses" && viewMode === "inactive" && !isInactive(resource, row)) return false;
      if (resource === "statuses" && viewMode === "inactive" && !isInactive(resource, row)) return false;
      if (!term) return true;
      const candidate = resource === "projects"
        ? `${(row as ProjectRow).name} ${(row as ProjectRow).clientName ?? ""} ${(row as ProjectRow).status ?? ""}`
        : resource === "tasks"
          ? `${(row as TaskRow).title} ${(row as TaskRow).projectName} ${(row as TaskRow).status ?? ""}`
          : resource === "quotations"
            ? `${(row as QuotationRow).projectName} ${(row as QuotationRow).clientName ?? ""} ${(row as QuotationRow).status ?? ""}`
            : `${(row as StatusRow).title} ${(row as StatusRow).roomName ?? ""} ${(row as StatusRow).healthStatus ?? ""}`;
      return candidate.toLowerCase().includes(term);
    });
  }, [resource, rows, search, viewMode]);

  const selectedIds = selected[resource];
  const visibleIds = visibleRows.map((row) => row.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const totalSelected = Object.values(selected).reduce((total, ids) => total + ids.length, 0);

  const toggleId = (id: number) => {
    setSelected((current) => ({
      ...current,
      [resource]: current[resource].includes(id)
        ? current[resource].filter((selectedId) => selectedId !== id)
        : [...current[resource], id],
    }));
  };

  const toggleVisible = () => {
    setSelected((current) => ({
      ...current,
      [resource]: allVisibleSelected
        ? current[resource].filter((id) => !visibleIds.includes(id))
        : [...new Set([...current[resource], ...visibleIds])],
    }));
  };

  const clearCurrentResource = () => setSelected((current) => ({ ...current, [resource]: [] }));

  const renderRow = (row: ProjectRow | TaskRow | QuotationRow | StatusRow) => {
    const selectedRow = selectedIds.includes(row.id);
    if (resource === "projects") {
      const project = row as ProjectRow;
      return { title: project.name, subtitle: `${project.clientName || "Sin cliente"} · ${project.taskCount} tareas · ${project.statusCount} status`, status: project.status, date: project.isFinished ? "Marcado como terminado" : undefined };
    }
    if (resource === "tasks") {
      const task = row as TaskRow;
      return { title: task.title, subtitle: `${task.projectName} · Proyecto #${task.projectId}`, status: task.status, date: formatDate(task.createdAt) };
    }
    if (resource === "quotations") {
      const quote = row as QuotationRow;
      return { title: quote.projectName, subtitle: `${quote.clientName || "Sin cliente"} · ${quote.projectCount} proyectos asociados`, status: quote.status, date: formatDate(quote.createdAt) };
    }
    const status = row as StatusRow;
    return { title: status.title, subtitle: `${status.roomName || `Sala #${status.roomId}`} · Salud: ${status.healthStatus || "—"}`, status: status.hiddenFromWeekly ? "Oculto" : "Visible", date: formatDate(status.createdAt) };
  };

  return (
    <Card className="standard-card mt-6 border-red-200 shadow-sm">
      <CardHeader className="border-b border-red-100 bg-red-50/50">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-red-900"><ShieldAlert className="h-5 w-5" /> Borrado permanente de datos</CardTitle>
            <CardDescription className="mt-1 max-w-3xl text-red-800/80">
              Herramienta exclusiva para administradores. Podés seleccionar registros individuales, varios o todos los resultados visibles. La eliminación es definitiva y también limpia los datos relacionados.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => inventoryQuery.refetch()} disabled={inventoryQuery.isFetching}>
            <RefreshCw className={cn("h-4 w-4", inventoryQuery.isFetching && "animate-spin")} /> Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-2 sm:grid-cols-4">
          {resources.map(({ value, label, icon: Icon }) => (
            <Button key={value} variant={resource === value ? "secondary" : "outline"} className="justify-start" onClick={() => { setResource(value); setSearch(""); }}>
              <Icon className="h-4 w-4" /> {label}
              <span className="ml-auto text-xs text-muted-foreground">{inventoryQuery.data?.[value]?.length ?? 0}</span>
            </Button>
          ))}
        </div>

        <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-3 md:flex-row md:items-center">
          <div className="flex gap-2">
            <Button size="sm" variant={viewMode === "inactive" ? "default" : "outline"} onClick={() => setViewMode("inactive")}>Inactivos</Button>
            <Button size="sm" variant={viewMode === "all" ? "default" : "outline"} onClick={() => setViewMode("all")}>Todos</Button>
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por nombre, estado o cliente…" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
        </div>

        {viewMode === "all" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Estás viendo todos los registros, incluidos los activos. Revisá cuidadosamente la selección antes de confirmar.
          </div>
        )}
        {resource === "statuses" && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
            Los status ligados a proyectos se eliminan junto con el proyecto. Esta pestaña administra status personalizados de las salas.
          </div>
        )}

        <div className="flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Checkbox checked={allVisibleSelected} onCheckedChange={toggleVisible} aria-label="Seleccionar todos los visibles" />
            <span className="text-sm text-muted-foreground">{visibleRows.length} visibles · {selectedIds.length} seleccionados</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={toggleVisible} disabled={!visibleRows.length}>
              <CheckSquare className="h-4 w-4" /> {allVisibleSelected ? "Quitar visibles" : "Seleccionar visibles"}
            </Button>
            <Button size="sm" variant="ghost" onClick={clearCurrentResource} disabled={!selectedIds.length}>Limpiar selección</Button>
          </div>
        </div>

        {inventoryQuery.isLoading ? (
          <Loader variant="dots" text="Cargando registros…" className="py-8" />
        ) : inventoryQuery.isError ? (
          <div className="py-8 text-center text-sm text-red-600">No se pudo cargar el inventario. Actualizá e intentá nuevamente.</div>
        ) : visibleRows.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No hay registros para este filtro.</div>
        ) : (
          <div className="max-h-[28rem] overflow-auto rounded-xl border">
            {visibleRows.map((row) => {
              const rendered = renderRow(row);
              return (
                <label key={row.id} className={cn("flex cursor-pointer items-center gap-3 border-b p-3 last:border-b-0 hover:bg-muted/30", selectedIds.includes(row.id) && "bg-red-50/60")}>
                  <Checkbox checked={selectedIds.includes(row.id)} onCheckedChange={() => toggleId(row.id)} aria-label={`Seleccionar ${rendered.title}`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{rendered.title}</div>
                    <div className="truncate text-xs text-muted-foreground">#{row.id} · {rendered.subtitle}</div>
                  </div>
                  <div className="hidden items-end gap-1 sm:flex sm:flex-col">
                    <Badge variant={isInactive(resource, row) ? "destructive" : "secondary"}>{statusLabel(rendered.status)}</Badge>
                    {rendered.date && <span className="text-[11px] text-muted-foreground">{rendered.date}</span>}
                  </div>
                </label>
              );
            })}
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50/50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-red-900"><strong>{totalSelected}</strong> registros seleccionados en total.</div>
          <Button variant="destructive" onClick={() => setConfirmOpen(true)} disabled={totalSelected === 0 || deleteMutation.isPending}>
            <Trash2 className="h-4 w-4" /> Borrar definitivamente
          </Button>
        </div>
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => { if (!deleteMutation.isPending) setConfirmOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700"><ShieldAlert className="h-5 w-5" /> Confirmar borrado definitivo</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán permanentemente <strong>{totalSelected} registros</strong> y sus datos relacionados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Para confirmar, escribí exactamente:</p>
            <code className="block rounded bg-muted px-3 py-2 text-sm font-bold">ELIMINAR_DEFINITIVAMENTE</code>
            <Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Escribí la confirmación" autoFocus />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={confirmation !== "ELIMINAR_DEFINITIVAMENTE" || deleteMutation.isPending}
              onClick={(event) => { event.preventDefault(); deleteMutation.mutate(); }}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Sí, eliminar definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
