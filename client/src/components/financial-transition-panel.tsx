import { useQuery } from "@tanstack/react-query";
import { authFetchJson } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Report={cutover:string|null;checks:Array<{code:string;label:string;passed:boolean;detail:string}>;stats:Record<string,number|null>;reviewRequired:string;comparisonNote:string};
const usd=(v:number|null|undefined)=>v==null ? "Sin datos" : new Intl.NumberFormat("es-AR",{style:"currency",currency:"USD"}).format(v);
export function FinancialTransitionPanel({period}:{period:string}) {
  const {data,error,isLoading,refetch}=useQuery<Report>({queryKey:["financial-transition",period],queryFn:()=>authFetchJson(`/api/financial-native/transition/${period}`)});
  return <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>Transición desde el maestro</CardTitle><Button variant="outline" onClick={()=>refetch()}>Actualizar controles</Button></div></CardHeader><CardContent className="space-y-4">
    {isLoading && <p>Cargando controles…</p>}{error && <p role="alert">No se pudo obtener la conciliación.</p>}
    {data && <><p className="text-sm text-muted-foreground">Corte: {data.cutover ?? "sin configurar"}. Estos controles muestran faltantes; Finanzas debe aprobar la conciliación antes de retirar el maestro.</p>
      <div className="grid gap-3 md:grid-cols-2">{data.checks.map(check=><div key={check.code} className="rounded-lg border p-3"><p className="font-medium">{check.passed ? "✓" : "Pendiente ·"} {check.label}</p><p className="mt-1 text-sm text-muted-foreground">{check.detail}</p></div>)}</div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Concepto · {period}</th><th className="p-2">Referencia importada</th><th className="p-2">Mind</th></tr></thead><tbody><tr><td className="p-2">Facturación sin IVA</td><td className="p-2">{usd(data.stats.legacy_revenue)}</td><td className="p-2">{usd(data.stats.native_revenue)}</td></tr><tr><td className="p-2">Presupuesto de costos</td><td className="p-2">{usd(data.stats.legacy_budget)}</td><td className="p-2">{usd(data.stats.native_budget)}</td></tr></tbody></table></div>
      <p className="text-sm text-muted-foreground">{data.comparisonNote}</p><p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">{data.reviewRequired}</p>
      <div className="flex flex-wrap gap-4 text-sm underline"><a href="/finance/cargar">Cargar ingresos y comprobantes</a><a href="/finance/cashflow">Registrar cuentas y movimientos</a><a href="/finance/presupuesto">Completar presupuesto</a><a href={`/api/financial-native/transition/${period}`} target="_blank" rel="noreferrer">Abrir informe completo</a></div>
    </>}
  </CardContent></Card>;
}
