import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Archive, ArrowLeft, BookOpenCheck, CheckCircle2, Clock3, Copy, Layers3, Save } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ServiceBlueprint } from "@shared/schema";
import { blueprintDefinitionSchema, canonicalProjectTypeForModality, estimateBlueprintWorkload, type BlueprintDefinition } from "@shared/quotation-professional";
import { statusLabel } from "@/lib/status-labels";

type CatalogItem = ServiceBlueprint & { workload: ReturnType<typeof estimateBlueprintWorkload> };
type EffortBenchmark = {
  serviceBlueprintId: number | null;
  serviceBlueprintSlug?: string | null;
  projectType: string;
  sampleSize: number;
  averageActualHours: number;
  medianActualHours: number;
};

const numberFormat = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

export default function ServiceBlueprintsAdmin() {
  const [, navigate] = useLocation();
  const client = useQueryClient();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingDefinition, setEditingDefinition] = useState<BlueprintDefinition | null>(null);
  const { data: items = [], isLoading } = useQuery<CatalogItem[]>({ queryKey: ["/api/service-blueprints?status=all"] });
  const { data: benchmarks = [] } = useQuery<EffortBenchmark[]>({ queryKey: ["/api/quotation-effort-benchmarks"] });
  const editingItem = items.find((item) => item.id === editingId && item.status === "draft");
  const editingWorkload = useMemo(
    () => editingDefinition ? estimateBlueprintWorkload(editingDefinition) : null,
    [editingDefinition],
  );
  const groups = Object.values(items.reduce<Record<string, CatalogItem[]>>((result, item) => {
    (result[item.slug] ||= []).push(item);
    return result;
  }, {}));
  const benchmarkFor = (item: CatalogItem) => {
    const projectType = canonicalProjectTypeForModality(blueprintDefinitionSchema.parse(item.definition).modality);
    return benchmarks
      .filter((entry) => entry.serviceBlueprintSlug === item.slug
        && entry.projectType === projectType && entry.sampleSize >= 2)
      .sort((left, right) => right.sampleSize - left.sampleSize)[0];
  };

  const refreshCatalog = () => {
    client.invalidateQueries({ queryKey: ["/api/service-blueprints?status=all"] });
    client.invalidateQueries({ queryKey: ["/api/service-blueprints?status=published"] });
  };
  const createDraft = useMutation({
    mutationFn: (item: CatalogItem) => apiRequest(`/api/service-blueprints/${item.id}/draft`, "POST"),
    onSuccess: (created: CatalogItem) => {
      refreshCatalog();
      setEditingId(created.id);
      setEditingDefinition(blueprintDefinitionSchema.parse(created.definition));
      toast({ title: "Borrador creado", description: `Versión ${created.version}: ajustá las horas y guardá los cambios.` });
    },
    onError: (error) => toast({ title: "No se pudo crear el borrador", description: error instanceof Error ? error.message : String(error), variant: "destructive" }),
  });
  const saveDraft = useMutation({
    mutationFn: () => apiRequest(`/api/service-blueprints/${editingId}`, "PUT", { definition: editingDefinition }),
    onSuccess: () => {
      refreshCatalog();
      toast({ title: "Borrador guardado" });
    },
    onError: (error) => toast({ title: "No se pudo guardar", description: error instanceof Error ? error.message : String(error), variant: "destructive" }),
  });
  const transition = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "publish" | "archive" }) => apiRequest(`/api/service-blueprints/${id}/${action}`, "POST"),
    onSuccess: (_, variables) => {
      refreshCatalog();
      if (variables.action === "publish" && editingId === variables.id) {
        setEditingId(null);
        setEditingDefinition(null);
      }
      toast({ title: variables.action === "publish" ? "Receta publicada" : "Receta archivada" });
    },
    onError: (error) => toast({ title: "No se pudo cambiar el estado", description: error instanceof Error ? error.message : String(error), variant: "destructive" }),
  });

  const updateSetupRole = (roleKey: string, hours: number) => {
    setEditingDefinition((current) => current ? {
      ...current,
      setupRoleHours: { ...current.setupRoleHours, [roleKey]: hours },
    } : current);
  };
  const updateDeliverableRole = (deliverableId: string, roleKey: string, hours: number) => {
    setEditingDefinition((current) => current ? {
      ...current,
      deliverables: current.deliverables.map((deliverable) => deliverable.id === deliverableId
        ? { ...deliverable, roleHours: { ...deliverable.roleHours, [roleKey]: hours } }
        : deliverable),
    } : current);
  };
  const calibrateToHistoricalMedian = () => {
    if (!editingItem || !editingDefinition || !editingWorkload) return;
    const benchmark = benchmarkFor(editingItem);
    if (!benchmark || editingWorkload.totalHours <= 0 || benchmark.medianActualHours <= 0) return;
    const ratio = benchmark.medianActualHours / editingWorkload.totalHours;
    const scale = (hours: number) => Math.round(hours * ratio * 2) / 2;
    setEditingDefinition({
      ...editingDefinition,
      setupRoleHours: Object.fromEntries(Object.entries(editingDefinition.setupRoleHours).map(([role, hours]) => [role, scale(hours)])),
      deliverables: editingDefinition.deliverables.map((deliverable) => ({
        ...deliverable,
        roleHours: Object.fromEntries(Object.entries(deliverable.roleHours).map(([role, hours]) => [role, scale(hours)])),
      })),
    });
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/quotations")}><ArrowLeft className="h-4 w-4" /></Button>
            <div>
              <h1 className="text-2xl font-semibold text-slate-950">Catálogo de servicios</h1>
              <p className="text-sm text-slate-500">Creá una versión borrador para recalibrar horas sin modificar cotizaciones ni versiones publicadas.</p>
            </div>
          </div>
          <Badge variant="outline"><Layers3 className="mr-1 h-3.5 w-3.5" /> {items.length} versiones</Badge>
        </header>

        {isLoading ? <p className="text-sm text-slate-500">Cargando catálogo…</p> : (
          <div className="space-y-5">
            {groups.map((versions) => (
              <Card key={versions[0].slug}>
                <CardHeader><CardTitle className="text-base">{versions[0].name}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {versions.sort((left, right) => right.version - left.version).map((item) => {
                    const benchmark = benchmarkFor(item);
                    return (
                      <div key={item.id} className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 md:flex-row md:items-center">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <strong>v{item.version}</strong>
                            <Badge variant={item.status === "published" ? "default" : item.status === "draft" ? "secondary" : "outline"}>{statusLabel(item.status)}</Badge>
                            <span className="text-xs text-slate-500">Receta: {numberFormat.format(item.workload.totalHours)} h</span>
                            {benchmark && <Badge variant="outline">Mediana real: {numberFormat.format(benchmark.medianActualHours)} h · {benchmark.sampleSize} proyectos cerrados</Badge>}
                          </div>
                          <p className="mt-1 text-sm text-slate-500">{item.description}</p>
                          <p className="mt-1 text-xs text-slate-400">Origen: {item.sourceLabel || "Catálogo Epical"}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {item.status === "published" && <Button size="sm" variant="outline" disabled={createDraft.isPending} onClick={() => createDraft.mutate(item)}><Copy className="mr-1.5 h-4 w-4" /> Nueva versión</Button>}
                          {item.status === "draft" && <>
                            <Button size="sm" variant="outline" onClick={() => { setEditingId(item.id); setEditingDefinition(blueprintDefinitionSchema.parse(item.definition)); }}>
                              {editingId === item.id ? "Editando" : "Editar horas"}
                            </Button>
                            <Button size="sm" onClick={() => transition.mutate({ id: item.id, action: "publish" })} disabled={transition.isPending}><BookOpenCheck className="mr-1.5 h-4 w-4" /> Publicar</Button>
                          </>}
                          {item.status === "published" && <CheckCircle2 className="h-5 w-5 self-center text-emerald-500" />}
                          {item.status === "published" && <Button size="sm" variant="ghost" onClick={() => transition.mutate({ id: item.id, action: "archive" })} disabled={transition.isPending}><Archive className="mr-1.5 h-4 w-4" /> Archivar</Button>}
                          {item.status === "archived" && <span className="flex items-center text-xs text-slate-400"><Clock3 className="mr-1 h-3.5 w-3.5" /> Conservada para trazabilidad</span>}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {editingItem && editingDefinition && editingWorkload && (
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center justify-between gap-3">
                <span>Calibrar {editingItem.name} · borrador v{editingItem.version}</span>
                <Badge variant="outline">Estimación actualizada: {numberFormat.format(editingWorkload.totalHours)} h</Badge>
              </CardTitle>
              <p className="text-sm text-slate-500">Ajustá las horas base por rol. La estimación se recalcula con las cantidades y factores de esta receta.</p>
              {(() => {
                const benchmark = benchmarkFor(editingItem);
                return benchmark
                  ? <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-emerald-800">Referencia de proyectos cerrados comparables: mediana {numberFormat.format(benchmark.medianActualHours)} h en {benchmark.sampleSize} proyectos.</p><Button type="button" size="sm" variant="outline" onClick={calibrateToHistoricalMedian}>Proponer ajuste a mediana</Button></div>
                  : <p className="text-sm text-amber-800">Todavía no hay dos proyectos cerrados con horas registradas para esta versión. La cifra actual proviene de la receta.</p>;
              })()}
              {benchmarkFor(editingItem) && <p className="text-xs text-slate-500">El ajuste redistribuye las horas base proporcionalmente para acercar el total a la mediana. Revisalo y guardá el borrador; no publica la receta.</p>}
            </CardHeader>
            <CardContent className="space-y-5">
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-900">Setup y calibración</h2>
                <RoleHourEditor hours={editingDefinition.setupRoleHours} label="Setup" onChange={updateSetupRole} />
              </section>
              {editingDefinition.deliverables.map((deliverable) => (
                <section key={deliverable.id} className="space-y-3 border-t pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">{deliverable.name}</h2>
                    <span className="text-xs text-slate-500">{deliverable.quantity} × entregable</span>
                  </div>
                  <RoleHourEditor hours={deliverable.roleHours} label={deliverable.name} onChange={(roleKey, hours) => updateDeliverableRole(deliverable.id, roleKey, hours)} />
                </section>
              ))}
              <div className="flex justify-end gap-2 border-t pt-4">
                <Button variant="outline" onClick={() => { setEditingId(null); setEditingDefinition(null); }}>Cerrar</Button>
                <Button onClick={() => saveDraft.mutate()} disabled={saveDraft.isPending}><Save className="mr-2 h-4 w-4" /> Guardar borrador</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

function RoleHourEditor({ hours, label, onChange }: {
  hours: Record<string, number>;
  label: string;
  onChange: (roleKey: string, hours: number) => void;
}) {
  const entries = Object.entries(hours);
  if (!entries.length) return <p className="text-xs text-slate-400">Sin horas base por rol.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map(([roleKey, value]) => (
        <div key={roleKey} className="space-y-1">
          <Label htmlFor={`${label}-${roleKey}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]/g, "-")} className="text-xs capitalize">{roleKey} · horas base</Label>
          <Input
            id={`${label}-${roleKey}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]/g, "-")}
            type="number"
            min={0}
            step={0.5}
            value={value}
            onChange={(event) => onChange(roleKey, Math.max(0, Number(event.target.value) || 0))}
          />
        </div>
      ))}
    </div>
  );
}
