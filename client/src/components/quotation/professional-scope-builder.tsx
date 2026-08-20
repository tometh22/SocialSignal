import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Calculator, CheckCircle2, Layers3, RefreshCw } from "lucide-react";
import { useOptimizedQuote } from "@/context/optimized-quote-context";
import type { ServiceBlueprint } from "@shared/schema";
import {
  blueprintDefinitionSchema,
  estimateBlueprintWorkload,
  type BlueprintDefinition,
} from "@shared/quotation-professional";

type BlueprintWithWorkload = ServiceBlueprint & { workload: ReturnType<typeof estimateBlueprintWorkload> };
type WeeklyCapacity = { personnel: Array<{ personnelId: number; name: string; maxCapacity: number; actualHours: number; estimatedTaskHours: number; isOverloaded: boolean }> };

const MODULES = [
  ["brand", "Marca"], ["campaign", "Campaña"], ["influencers", "Influencers"],
  ["competition", "Competencia"], ["experience", "Experiencia"], ["crisis", "Crisis"],
  ["culture", "Cultura"], ["trends", "Tendencias"], ["category", "Categoría"], ["multisource", "Multifuente"],
] as const;

export function ProfessionalScopeBuilder() {
  const { quotationData, updateQuotationData, updateTeamMembers, availableRoles } = useOptimizedQuote();
  const { data: blueprints = [], isLoading } = useQuery<BlueprintWithWorkload[]>({ queryKey: ["/api/service-blueprints?status=published"] });
  const { data: capacity } = useQuery<WeeklyCapacity>({ queryKey: ["/api/capacity/weekly"] });
  const [unmappedRoles, setUnmappedRoles] = useState<string[]>([]);
  const selected = useMemo(() => blueprints.find((item) => item.id === quotationData.serviceBlueprintId), [blueprints, quotationData.serviceBlueprintId]);
  const scope = quotationData.scopeSnapshot ? blueprintDefinitionSchema.parse(quotationData.scopeSnapshot) : null;
  const estimate = useMemo(() => scope ? estimateBlueprintWorkload(scope) : null, [scope]);
  const currentHours = quotationData.teamMembers.reduce((sum, member) => sum + Number(member.hours || 0), 0);
  const deviation = estimate?.totalHours ? ((currentHours - estimate.totalHours) / estimate.totalHours) * 100 : 0;
  const capacityWarnings = useMemo(() => {
    if (!scope || !capacity) return [];
    const projectWeeks = Math.max(1, scope.durationMonths * 4.33);
    return quotationData.teamMembers.flatMap((member) => {
      if (!member.personnelId) return [];
      const person = capacity.personnel.find((item) => item.personnelId === member.personnelId);
      if (!person) return [];
      const quoteWeeklyHours = Number(member.hours || 0) / projectWeeks;
      const projected = person.actualHours + person.estimatedTaskHours + quoteWeeklyHours;
      return projected > person.maxCapacity
        ? [`${person.name}: ${projected.toFixed(1)} h proyectadas sobre ${person.maxCapacity.toFixed(1)} h disponibles esta semana`]
        : [];
    });
  }, [capacity, quotationData.teamMembers, scope]);

  const applyBlueprint = (blueprint: BlueprintWithWorkload) => {
    const definition = blueprintDefinitionSchema.parse(structuredClone(blueprint.definition));
    applyDefinition(definition, blueprint);
  };

  const applyDefinition = (definition: BlueprintDefinition, blueprint = selected) => {
    const workload = estimateBlueprintWorkload(definition);
    const missing: string[] = [];
    const nextMembers = Object.entries(workload.byRole).flatMap(([roleKey, hours]) => {
      const role = resolveRole(roleKey, availableRoles);
      if (!role) {
        missing.push(roleKey);
        return [];
      }
      const existing = quotationData.teamMembers.find((member) => member.roleId === role.id);
      const rate = existing?.rate || (quotationData.quotationCurrency === "USD" ? Number(role.defaultRateUsd || role.defaultRate || 0) : Number(role.defaultRate || 0));
      return [{
        id: existing?.id || crypto.randomUUID(),
        roleId: role.id,
        personnelId: existing?.personnelId ?? null,
        hours,
        rate,
        cost: hours * rate,
      }];
    });
    setUnmappedRoles(missing);
    updateTeamMembers(nextMembers);
    updateQuotationData({
      serviceBlueprintId: blueprint?.id ?? quotationData.serviceBlueprintId ?? null,
      serviceBlueprintVersion: blueprint?.version ?? quotationData.serviceBlueprintVersion ?? null,
      commercialMotion: definition.commercialMotion,
      scopeSnapshot: definition,
      project: {
        ...quotationData.project,
        type: projectTypeFor(definition.modality),
        duration: `${definition.durationMonths} meses`,
      },
      quotationType: definition.modality === "one_shot" || definition.modality === "event_pack" || definition.modality === "demo" ? "one-time" : "fee",
      mentionsVolume: definition.coverage.mentionVolume,
      countriesCovered: countryBucket(definition.coverage.markets.length),
      analysisType: definition.coverage.analysisModules.length >= 5 ? "deep" : "standard",
      clientEngagement: definition.coverage.slaLevel === "standard" ? "medium" : "high",
      deliverables: definition.deliverables.map((deliverable) => ({
        id: deliverable.id,
        type: deliverable.type,
        frequency: deliverable.cadence,
        description: deliverable.description,
        budget: deliverable.optionalPrice || 0,
        quantity: deliverable.quantity,
        format: deliverable.format,
        acceptanceCriteria: deliverable.acceptanceCriteria,
        dueRule: deliverable.dueRule,
        included: deliverable.included,
      })),
      paymentTermsDays: definition.paymentTermsDays,
      inclusions: definition.inclusions.map((item) => `• ${item}`).join("\n"),
      exclusions: definition.exclusions.map((item) => `• ${item}`).join("\n"),
      operationalPlan: {
        milestones: definition.milestones,
        monitoringWindow: definition.monitoringWindow,
        alertChannels: definition.alertChannels,
        workload,
      },
      effortOverrideReason: null,
    });
  };

  const updateCoverageList = (field: "markets" | "brands" | "competitors" | "sources", value: string) => {
    if (!scope) return;
    const values = value.split(",").map((item) => item.trim()).filter(Boolean);
    updateScope({ ...scope, coverage: { ...scope.coverage, [field]: values } });
  };

  const updateScope = (definition: BlueprintDefinition) => {
    updateQuotationData({
      scopeSnapshot: definition,
      deliverables: definition.deliverables.map((deliverable) => ({
        id: deliverable.id, type: deliverable.type, frequency: deliverable.cadence,
        description: deliverable.description, budget: deliverable.optionalPrice || 0,
        quantity: deliverable.quantity, format: deliverable.format,
        acceptanceCriteria: deliverable.acceptanceCriteria, dueRule: deliverable.dueRule, included: deliverable.included,
      })),
      operationalPlan: { ...(quotationData.operationalPlan || {}), milestones: definition.milestones, monitoringWindow: definition.monitoringWindow, alertChannels: definition.alertChannels, workload: estimateBlueprintWorkload(definition) },
    });
  };

  if (isLoading) return <div className="rounded-xl border border-slate-200 p-6 text-sm text-slate-500">Cargando recetas profesionales…</div>;

  return (
    <div className="space-y-5" id="professional-scope">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {blueprints.map((blueprint) => {
          const active = quotationData.serviceBlueprintId === blueprint.id;
          return (
            <button key={blueprint.id} type="button" onClick={() => applyBlueprint(blueprint)} className={`rounded-xl border p-4 text-left transition ${active ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100" : "border-slate-200 bg-white hover:border-indigo-300"}`}>
              <span className="flex items-start justify-between gap-2"><strong className="text-sm text-slate-950">{blueprint.name}</strong>{active && <CheckCircle2 className="h-4 w-4 text-indigo-600" />}</span>
              <span className="mt-2 block text-xs leading-5 text-slate-500">{blueprint.description}</span>
              <span className="mt-3 flex flex-wrap gap-1.5"><Badge variant="outline">v{blueprint.version}</Badge><Badge variant="outline">{blueprint.workload.totalHours} h</Badge><Badge variant="outline">{blueprint.definition.deliverables.length} entregables</Badge></span>
            </button>
          );
        })}
      </div>

      {scope && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Contexto de decisión</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2"><Label>Contexto y desafío del cliente</Label><Textarea rows={3} value={String(quotationData.decisionContext?.context || "")} onChange={(event) => updateQuotationData({ decisionContext: { ...(quotationData.decisionContext || {}), context: event.target.value } })} placeholder="¿Qué cambió, qué tensión existe y por qué importa ahora?" /></div>
              <div className="space-y-2"><Label>Decisión que debe habilitar</Label><Textarea rows={3} value={String(quotationData.decisionContext?.decision || "")} onChange={(event) => updateQuotationData({ decisionContext: { ...(quotationData.decisionContext || {}), decision: event.target.value } })} placeholder="¿Qué podrá decidir el cliente con este servicio?" /></div>
              <div className="space-y-2"><Label>Objetivos · uno por línea</Label><Textarea rows={3} value={Array.isArray(quotationData.decisionContext?.objectives) ? (quotationData.decisionContext.objectives as string[]).join("\n") : ""} onChange={(event) => updateQuotationData({ decisionContext: { ...(quotationData.decisionContext || {}), objectives: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) } })} /></div>
              {["renewal", "expansion"].includes(quotationData.commercialMotion || "new_business") && <><div className="space-y-2"><Label>Situación actual</Label><Textarea rows={3} value={String(quotationData.decisionContext?.currentSituation || "")} onChange={(event) => updateQuotationData({ decisionContext: { ...(quotationData.decisionContext || {}), currentSituation: event.target.value } })} placeholder="Servicio, mercados, entregables y costo actual" /></div><div className="space-y-2"><Label>Cambios y valor esperado</Label><Textarea rows={3} value={String(quotationData.decisionContext?.changes || "")} onChange={(event) => updateQuotationData({ decisionContext: { ...(quotationData.decisionContext || {}), changes: event.target.value } })} placeholder="Ahorros, ampliaciones, eficiencia o nuevas capacidades" /></div></>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Layers3 className="h-4 w-4 text-indigo-600" /> Cobertura y módulos</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <ListField label="Mercados" value={scope.coverage.markets.join(", ")} onChange={(value) => updateCoverageList("markets", value)} />
                <ListField label="Marcas" value={scope.coverage.brands.join(", ")} onChange={(value) => updateCoverageList("brands", value)} />
                <ListField label="Competidores" value={scope.coverage.competitors.join(", ")} onChange={(value) => updateCoverageList("competitors", value)} />
                <ListField label="Fuentes" value={scope.coverage.sources.join(", ")} onChange={(value) => updateCoverageList("sources", value)} />
              </div>
              <div>
                <Label className="mb-2 block">Módulos analíticos</Label>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {MODULES.map(([value, label]) => <label key={value} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"><Checkbox checked={scope.coverage.analysisModules.includes(value)} onCheckedChange={(checked) => updateScope({ ...scope, coverage: { ...scope.coverage, analysisModules: checked ? [...scope.coverage.analysisModules, value] : scope.coverage.analysisModules.filter((item) => item !== value) } })} />{label}</label>)}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2"><Label>SLA</Label><Select value={scope.coverage.slaLevel} onValueChange={(value: any) => updateScope({ ...scope, coverage: { ...scope.coverage, slaLevel: value } })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="standard">Estándar</SelectItem><SelectItem value="priority">Prioritario</SelectItem><SelectItem value="real_time">Tiempo real</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Diseño</Label><Select value={scope.coverage.designLevel} onValueChange={(value: any) => updateScope({ ...scope, coverage: { ...scope.coverage, designLevel: value } })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="standard">Estándar</SelectItem><SelectItem value="branded">Branded</SelectItem><SelectItem value="executive">Ejecutivo</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Idiomas</Label><Select value={scope.coverage.languages.join("+")} onValueChange={(value) => updateScope({ ...scope, coverage: { ...scope.coverage, languages: value === "es+en" ? ["es", "en"] : [value as "es" | "en"] } })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="es">Español</SelectItem><SelectItem value="en">Inglés</SelectItem><SelectItem value="es+en">Español + inglés</SelectItem></SelectContent></Select></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Entregables y frecuencia</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {scope.deliverables.map((deliverable) => (
                <div key={deliverable.id} className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[minmax(0,1fr)_7rem_7rem] md:items-center">
                  <label className="flex items-start gap-3"><Checkbox className="mt-1" checked={deliverable.included} onCheckedChange={(checked) => updateScope({ ...scope, deliverables: scope.deliverables.map((item) => item.id === deliverable.id ? { ...item, included: checked === true } : item) })} /><span><strong className="block text-sm">{deliverable.name}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{deliverable.description}</span></span></label>
                  <div className="space-y-1"><Label className="text-xs">Cantidad</Label><Input type="number" min={1} value={deliverable.quantity} onChange={(event) => updateScope({ ...scope, deliverables: scope.deliverables.map((item) => item.id === deliverable.id ? { ...item, quantity: Math.max(1, Number(event.target.value) || 1) } : item) })} /></div>
                  <div><span className="text-xs text-slate-500">Cadencia</span><Badge variant="outline" className="mt-1 block w-fit">{deliverable.cadence}</Badge></div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Calculator className="h-4 w-4 text-indigo-600" /> Explicación del esfuerzo</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3"><Metric label="Horas estándar" value={`${estimate?.totalHours || 0} h`} /><Metric label="Horas configuradas" value={`${currentHours.toFixed(1)} h`} /><Metric label="Desviación" value={`${deviation >= 0 ? "+" : ""}${deviation.toFixed(1)}%`} /></div>
              <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-3 py-2">Trabajo</th><th className="px-3 py-2">Rol</th><th className="px-3 py-2 text-right">Horas</th></tr></thead><tbody>{estimate?.lines.map((line, index) => <tr key={`${line.sourceId}-${line.roleKey}-${index}`} className="border-t"><td className="px-3 py-2">{line.sourceName}</td><td className="px-3 py-2 capitalize">{line.roleKey}</td><td className="px-3 py-2 text-right tabular-nums">{line.estimatedHours}</td></tr>)}</tbody></table></div>
              <Button type="button" variant="outline" onClick={() => applyDefinition(scope)}><RefreshCw className="mr-2 h-4 w-4" /> Recalcular equipo desde el alcance</Button>
              {Math.abs(deviation) > 10 && <div className="space-y-2"><Label htmlFor="effort-override-reason">Motivo del desvío de horas</Label><Textarea id="effort-override-reason" value={quotationData.effortOverrideReason || ""} onChange={(event) => updateQuotationData({ effortOverrideReason: event.target.value })} placeholder="Explicá por qué el equipo se aparta del estándar…" /></div>}
              {unmappedRoles.length > 0 && <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />No encontramos roles equivalentes para: {unmappedRoles.join(", ")}. Crealos o asigná el equipo manualmente.</div>}
              {capacityWarnings.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><div className="flex items-center gap-2 font-medium"><AlertCircle className="h-4 w-4" /> Advertencia de capacidad</div><ul className="mt-2 list-disc space-y-1 pl-5">{capacityWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function ListField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div className="space-y-2"><Label>{label}</Label><Input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Separá valores con comas" /></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-50 p-3"><span className="block text-xs text-slate-500">{label}</span><strong className="mt-1 block text-lg tabular-nums">{value}</strong></div>;
}

function resolveRole(roleKey: string, roles: Array<{ id: number; name: string; defaultRate: number; defaultRateUsd?: number | null }>) {
  const aliases: Record<string, string[]> = {
    director: ["director", "cuentas"], pm: ["project manager", "pm", "proyecto"], analyst: ["analista", "analyst"],
    data: ["data", "datos"], tech: ["tech", "tecnología", "tecnologia"], design: ["diseñ", "design"],
  };
  return roles.find((role) => (aliases[roleKey] || [roleKey]).some((alias) => role.name.toLocaleLowerCase("es").includes(alias)));
}

function projectTypeFor(modality: BlueprintDefinition["modality"]) {
  return ({ demo: "demo", one_shot: "on-demand", event_pack: "monitoring", monthly_fee: "fee-mensual", annual_program: "always-on", renewal: "fee-mensual" } as const)[modality];
}

function countryBucket(count: number) {
  if (count <= 1) return "1";
  if (count <= 5) return "2-5";
  if (count <= 10) return "6-10";
  return "10+";
}
