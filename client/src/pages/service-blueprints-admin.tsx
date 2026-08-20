import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Archive, ArrowLeft, BookOpenCheck, CheckCircle2, Clock3, Layers3 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ServiceBlueprint } from "@shared/schema";
import type { estimateBlueprintWorkload } from "@shared/quotation-professional";

type CatalogItem = ServiceBlueprint & { workload: ReturnType<typeof estimateBlueprintWorkload> };

export default function ServiceBlueprintsAdmin() {
  const [, navigate] = useLocation();
  const client = useQueryClient();
  const { toast } = useToast();
  const { data: items = [], isLoading } = useQuery<CatalogItem[]>({ queryKey: ["/api/service-blueprints?status=all"] });
  const transition = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "publish" | "archive" }) => apiRequest(`/api/service-blueprints/${id}/${action}`, "POST"),
    onSuccess: (_, variables) => { client.invalidateQueries({ queryKey: ["/api/service-blueprints?status=all"] }); client.invalidateQueries({ queryKey: ["/api/service-blueprints?status=published"] }); toast({ title: variables.action === "publish" ? "Receta publicada" : "Receta archivada" }); },
  });
  const groups = Object.values(items.reduce<Record<string, CatalogItem[]>>((result, item) => { (result[item.slug] ||= []).push(item); return result; }, {}));
  return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-6xl space-y-6"><header className="flex items-center justify-between"><div className="flex items-center gap-3"><Button variant="ghost" size="icon" onClick={() => navigate("/quotations")}><ArrowLeft className="h-4 w-4" /></Button><div><h1 className="text-2xl font-semibold">Catálogo de servicios</h1><p className="text-sm text-slate-500">Gobernanza de recetas versionadas. Las versiones publicadas no se editan.</p></div></div><Badge variant="outline"><Layers3 className="mr-1 h-3.5 w-3.5" /> {items.length} versiones</Badge></header>{isLoading ? <p className="text-sm text-slate-500">Cargando catálogo…</p> : <div className="space-y-5">{groups.map((versions) => <Card key={versions[0].slug}><CardHeader><CardTitle className="text-base">{versions[0].name}</CardTitle></CardHeader><CardContent className="space-y-3">{versions.sort((a,b) => b.version-a.version).map((item) => <div key={item.id} className="flex flex-col justify-between gap-3 rounded-xl border p-4 md:flex-row md:items-center"><div><div className="flex flex-wrap items-center gap-2"><strong>v{item.version}</strong><Badge variant={item.status === "published" ? "default" : item.status === "draft" ? "secondary" : "outline"}>{item.status}</Badge><span className="text-xs text-slate-500">{item.workload.totalHours} h · {item.definition.deliverables.length} entregables</span></div><p className="mt-1 text-sm text-slate-500">{item.description}</p><p className="mt-1 text-xs text-slate-400">Origen: {item.sourceLabel || "Catálogo Epical"}</p></div><div className="flex gap-2">{item.status === "draft" && <Button size="sm" onClick={() => transition.mutate({ id: item.id, action: "publish" })}><BookOpenCheck className="mr-1.5 h-4 w-4" /> Publicar</Button>}{item.status === "published" && <Button size="sm" variant="outline" onClick={() => transition.mutate({ id: item.id, action: "archive" })}><Archive className="mr-1.5 h-4 w-4" /> Archivar</Button>}{item.status === "archived" && <span className="flex items-center text-xs text-slate-400"><Clock3 className="mr-1 h-3.5 w-3.5" /> Conservada para trazabilidad</span>}{item.status === "published" && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}</div></div>)}</CardContent></Card>)}</div>}</div></main>;
}
