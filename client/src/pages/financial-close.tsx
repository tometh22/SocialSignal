import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authFetchJson } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AlertTriangle, CheckCircle2, LockKeyhole, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";

type ClosePeriod = { id: number; periodKey: string; status: string; checklistVersion: number; snapshotVersion: number; closedAt: string | null; notes: string | null };
type CloseCheck = { id: number; code: string; severity: "info" | "warning" | "critical"; status: string; title: string; detail: string | null; actualValue: string | null; resolution: string | null };
type CloseDetail = { period: ClosePeriod | null; checks: CloseCheck[] };

export default function FinancialClosePage() {
  const now = new Date();
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.isAdmin === true || user?.role === "admin";
  const query = useQuery<CloseDetail>({ queryKey: ["financial-close", period], queryFn: () => authFetchJson(`/api/financial-native/close/${period}`) });
  const mutation = useMutation({
    mutationFn: ({ action, body }: { action: string; body?: unknown }) => authFetchJson(`/api/financial-native/close/${period}/${action}`, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["financial-close"] }); toast({ title: "Cierre actualizado" }); },
    onError: (e: Error) => toast({ title: "No se pudo avanzar", description: e.message, variant: "destructive" }),
  });
  const resolveMutation = useMutation({
    mutationFn: ({ id, status, resolution }: { id: number; status: "accepted" | "resolved"; resolution: string }) => authFetchJson(`/api/financial-native/close/${period}/checks/${id}`, { method: "PATCH", body: JSON.stringify({ status, resolution }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financial-close", period] }),
  });
  const state = query.data?.period?.status ?? "OPEN";
  const checks = query.data?.checks ?? [];
  const failedCritical = checks.filter((check) => check.severity === "critical" && check.status === "failed").length;
  const failedWarning = checks.filter((check) => check.severity === "warning" && check.status === "failed").length;
  const busy = mutation.isPending || resolveMutation.isPending;

  const resolve = (check: CloseCheck) => {
    const resolution = window.prompt(check.severity === "critical" ? "Describí cómo se resolvió el control:" : "Motivo para aceptar la observación:");
    if (resolution) resolveMutation.mutate({ id: check.id, status: check.severity === "critical" ? "resolved" : "accepted", resolution });
  };
  const reopen = () => { const reason = window.prompt("Motivo de reapertura (quedará auditado):"); if (reason) mutation.mutate({ action: "reopen", body: { reason } }); };

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><p className="text-sm font-medium text-rose-600">Finanzas · control mensual</p><h1 className="text-3xl font-semibold tracking-tight">Cierre financiero</h1><p className="text-sm text-muted-foreground">Valida la integridad, fija el snapshot y bloquea cambios retroactivos.</p></div><Input className="w-48" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} /></div>
    <div className="grid gap-4 md:grid-cols-4"><Metric title="Estado" value={state} /><Metric title="Controles" value={String(checks.length)} /><Metric title="Críticos" value={String(failedCritical)} alert={failedCritical > 0} /><Metric title="Advertencias" value={String(failedWarning)} alert={failedWarning > 0} /></div>
    <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Checklist de {period}</CardTitle><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy || state === "CLOSED"} onClick={() => mutation.mutate({ action: "pre-close" })}><RefreshCw className="mr-2 h-4 w-4" />Ejecutar pre-cierre</Button>{state === "PRE_CLOSE" && <Button disabled={busy} onClick={() => mutation.mutate({ action: "request-review", body: {} })}><ShieldCheck className="mr-2 h-4 w-4" />Enviar a revisión</Button>}{state === "IN_REVIEW" && isAdmin && <Button disabled={busy || failedCritical > 0} onClick={() => mutation.mutate({ action: "close" })}><LockKeyhole className="mr-2 h-4 w-4" />Cerrar período</Button>}{state === "CLOSED" && isAdmin && <Button variant="destructive" disabled={busy} onClick={reopen}><RotateCcw className="mr-2 h-4 w-4" />Reabrir</Button>}</div></div></CardHeader>
      <CardContent className="space-y-3">{query.isLoading && <p className="text-sm text-muted-foreground">Ejecutando controles…</p>}{!query.isLoading && checks.length === 0 && <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">Todavía no se ejecutó el pre-cierre de este período.</div>}{checks.map((check) => <div key={check.id} className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-50">{check.status === "passed" || check.status === "resolved" || check.status === "accepted" ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className={`h-5 w-5 ${check.severity === "critical" ? "text-red-600" : "text-amber-600"}`} />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{check.title}</p><Badge variant={check.severity === "critical" ? "destructive" : "secondary"}>{check.severity}</Badge><Badge variant="outline">{check.status}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{check.detail}</p>{check.resolution && <p className="mt-1 text-xs text-emerald-700">Resolución: {check.resolution}</p>}</div>{check.status === "failed" && state !== "CLOSED" && <Button size="sm" variant="outline" onClick={() => resolve(check)}>{check.severity === "critical" ? "Marcar resuelto" : "Aceptar excepción"}</Button>}</div>)}</CardContent>
    </Card>
    {state === "CLOSED" && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><LockKeyhole className="h-4 w-4" />El período está congelado. Los tableros leen el snapshot versión {query.data?.period?.snapshotVersion}.</div>}
  </div>;
}

function Metric({ title, value, alert = false }: { title: string; value: string; alert?: boolean }) { return <Card><CardContent className="pt-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p><p className={`mt-1 text-2xl font-semibold ${alert ? "text-red-600" : ""}`}>{value}</p></CardContent></Card>; }
