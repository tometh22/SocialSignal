import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authFetchJson } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FinancialCostPlan, FinancialCostPlanInput } from "@shared/financial-cost-plan";
import { getBuenosAiresPeriod } from "@shared/utils/fx-periods";

export default function FinancialCostPlansPage() {
  const {year,month}=getBuenosAiresPeriod();
  const period=`${year}-${String(month).padStart(2,"0")}`;
  const empty: FinancialCostPlanInput={concept:"",category:"",costType:"indirect",currency:"ARS",monthlyAmount:0,startPeriod:period,endPeriod:period,notes:"",active:true};
  const [draft,setDraft]=useState(empty);
  const [editingId,setEditingId]=useState<number | undefined>();
  const {toast}=useToast();const qc=useQueryClient();
  const query=useQuery<FinancialCostPlan[]>({queryKey:["financial-cost-plans"],queryFn:()=>authFetchJson("/api/financial-native/cost-plans")});
  const save=useMutation({
    mutationFn:()=>authFetchJson(`/api/financial-native/cost-plans${editingId ? `/${editingId}` : ""}`,{method:editingId ? "PUT" : "POST",body:JSON.stringify(draft)}),
    onSuccess:()=>{qc.invalidateQueries();setDraft(empty);setEditingId(undefined);toast({title:"Presupuesto guardado"});},
    onError:(e:Error)=>toast({title:"No se pudo guardar",description:e.message,variant:"destructive"}),
  });
  const field=<K extends keyof FinancialCostPlanInput>(key:K,value:FinancialCostPlanInput[K])=>setDraft(prev=>({...prev,[key]:value}));
  return <div className="space-y-6">
    <div><h1 className="text-3xl font-semibold">Presupuesto de costos</h1><p className="mt-2 text-muted-foreground">Definí el importe mensual y su vigencia. Alimenta la proyección; los costos reales se registran desde Operaciones y Pasivo.</p></div>
    <Card><CardHeader><CardTitle>{editingId ? "Editar presupuesto" : "Agregar presupuesto"}</CardTitle></CardHeader><CardContent>
      <form onSubmit={e=>{e.preventDefault();save.mutate();}} className="grid gap-4 md:grid-cols-2">
        <div><Label htmlFor="cost-concept">Concepto</Label><Input id="cost-concept" required maxLength={200} value={draft.concept} onChange={e=>field("concept",e.target.value)} placeholder="Alquiler, equipo, software…" /></div>
        <div><Label htmlFor="cost-category">Categoría</Label><Input id="cost-category" required maxLength={100} value={draft.category} onChange={e=>field("category",e.target.value)} placeholder="Estructura, equipo…" /></div>
        <div><Label htmlFor="cost-type">Tratamiento</Label><select id="cost-type" className="h-10 w-full rounded-md border bg-background px-3" value={draft.costType} onChange={e=>field("costType",e.target.value as "direct"|"indirect")}><option value="direct">Directo</option><option value="indirect">Indirecto</option></select></div>
        <div><Label htmlFor="cost-currency">Moneda</Label><select id="cost-currency" className="h-10 w-full rounded-md border bg-background px-3" value={draft.currency} onChange={e=>field("currency",e.target.value as "ARS"|"USD")}><option>ARS</option><option>USD</option></select></div>
        <div><Label htmlFor="cost-amount">Importe mensual</Label><Input id="cost-amount" type="number" required min="0.0001" step="0.0001" value={draft.monthlyAmount || ""} onChange={e=>field("monthlyAmount",Number(e.target.value))} /></div>
        <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="cost-from">Desde</Label><Input id="cost-from" type="month" required value={draft.startPeriod} onChange={e=>field("startPeriod",e.target.value)} /></div><div><Label htmlFor="cost-to">Hasta inclusive</Label><Input id="cost-to" type="month" required min={draft.startPeriod} value={draft.endPeriod} onChange={e=>field("endPeriod",e.target.value)} /></div></div>
        <div className="md:col-span-2"><Label htmlFor="cost-notes">Motivo / referencia</Label><Input id="cost-notes" maxLength={2000} value={draft.notes ?? ""} onChange={e=>field("notes",e.target.value)} /></div>
        {editingId && <label className="flex items-center gap-2"><input type="checkbox" checked={draft.active} onChange={e=>field("active",e.target.checked)} />Incluir en la proyección</label>}
        <div className="flex gap-2 md:col-span-2"><Button disabled={save.isPending} type="submit">{save.isPending ? "Guardando…" : "Guardar presupuesto"}</Button>{editingId && <Button type="button" variant="outline" onClick={()=>{setDraft(empty);setEditingId(undefined);}}>Cancelar edición</Button>}</div>
      </form>
      <p className="mt-4 text-sm text-muted-foreground">La conversión ARS/USD usa la cotización del mes cargada en Mind. Si falta, la proyección queda pendiente. Un presupuesto que alcanza un mes cerrado requiere reapertura antes de modificarse.</p>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Presupuestos registrados</CardTitle></CardHeader><CardContent>
      {query.isLoading && <p>Cargando…</p>}{query.error && <p role="alert">No se pudieron cargar los presupuestos. <Button variant="link" onClick={()=>query.refetch()}>Reintentar</Button></p>}
      {query.data?.length===0 && <p className="text-muted-foreground">Todavía no hay presupuestos nativos. Cargá los conceptos y períodos acordados con Finanzas.</p>}
      <div className="space-y-3">{query.data?.map(plan=><div key={plan.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"><div><p className="font-medium">{plan.concept} {!plan.active && "· Inactivo"}</p><p className="text-sm text-muted-foreground">{plan.category} · {plan.currency} {plan.monthlyAmount.toLocaleString("es-AR")} por mes · {plan.startPeriod} a {plan.endPeriod}</p></div><Button variant="outline" onClick={()=>{setEditingId(plan.id);setDraft(plan);window.scrollTo({top:0,behavior:"smooth"});}}>Editar</Button></div>)}</div>
    </CardContent></Card>
  </div>;
}
