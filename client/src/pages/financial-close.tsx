import { QueryError } from "@/components/query-error";
import { useFinancePeriod } from "@/hooks/use-finance-period";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authFetchJson } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { PageShell } from "@/components/ui/page-shell";
import { FinanceHeader, periodLabel, useReasonDialog } from "@/components/finance/ui";
import { AlertTriangle, CheckCircle2, LockKeyhole, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import { statusLabel } from "@/lib/status-labels";

type ClosePeriod = { id: number; periodKey: string; status: string; checklistVersion: number; snapshotVersion: number; closedAt: string | null; notes: string | null };
type CloseCheck = { id: number; code: string; severity: "info" | "warning" | "critical"; status: string; title: string; detail: string | null; actualValue: string | null; resolution: string | null };
type CloseDetail = { period: ClosePeriod | null; checks: CloseCheck[] };

export default function FinancialClosePage() {
  const now = new Date();
  const { period, setPeriod } = useFinancePeriod();
  const { toast } = useToast();
  const reason = useReasonDialog();
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
  const busy = query.isLoading || query.isError || mutation.isPending || resolveMutation.isPending;

  const resolve = async (check: CloseCheck) => {
    const resolution = await reason.ask({ title: "Aceptar excepción", description: `${check.title}. Explicá por qué se puede cerrar el mes con esta observación.`, confirmLabel: "Aceptar excepción", minLength: 1 });
    if (resolution) resolveMutation.mutate({ id: check.id, status: "accepted", resolution });
  };
  const reopen = async () => {
    const text = await reason.ask({ title: `Reabrir ${periodLabel(period)}`, description: "Las cifras dejan de estar protegidas hasta volver a cerrar. El motivo queda auditado.", confirmLabel: "Reabrir período", destructive: true, minLength: 1 });
    if (text) mutation.mutate({ action: "reopen", body: { reason: text } });
  };

  if (query.isError) return <QueryError message="No se pudo consultar el estado del cierre. Reintentá antes de avanzar." retry={query.refetch} />;
  if (query.isLoading) return <p className="text-sm text-muted-foreground" role="status">Consultando estado y pendientes del cierre…</p>;
  const stepIndex = Math.max(0, STEPS.findIndex(step => step.status === state));
  return <PageShell width="wide" spacing="compact">
    <FinanceHeader title="Cierre financiero" description={`Revisá los pendientes y aprobá el cierre de ${periodLabel(period)}. Una vez cerrado, sus cifras quedan guardadas y protegidas.`} />
    <ol aria-label="Etapas del cierre" className="grid gap-2 rounded-2xl border border-border/75 bg-card p-3 sm:grid-cols-4 sm:p-4">
      {STEPS.map((step, index) => {
        const done = index < stepIndex || state === "CLOSED", current = index === stepIndex && state !== "CLOSED";
        return <li key={step.status} aria-current={current ? "step" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${current ? "bg-primary/[0.07]" : ""}`}>
          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold ${done ? "border-emerald-500 bg-emerald-500 text-white" : current ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>{done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}</span>
          <span className="min-w-0"><span className={`block text-sm font-medium ${current || done ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</span><span className="block text-xs text-muted-foreground">{step.hint}</span></span>
        </li>;
      })}
    </ol>
    <MetricGrid>
      <MetricCard label="Estado" value={statusLabel(state)} icon={<LockKeyhole />} tone={state === "CLOSED" ? "success" : "info"} valueSize="compact" />
      <MetricCard label="Controles ejecutados" value={String(checks.length)} icon={<ShieldCheck />} />
      <MetricCard label="Críticos sin resolver" value={String(failedCritical)} icon={<AlertTriangle />} tone={failedCritical > 0 ? "danger" : "neutral"} detail={failedCritical > 0 ? "Bloquean el cierre" : undefined} />
      <MetricCard label="Advertencias" value={String(failedWarning)} icon={<AlertTriangle />} tone={failedWarning > 0 ? "warning" : "neutral"} detail={failedWarning > 0 ? "Resolvelas o aceptalas con motivo" : undefined} />
    </MetricGrid>
    <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="text-base">Controles de {periodLabel(period)}</CardTitle><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy || state === "CLOSED"} onClick={() => mutation.mutate({ action: "pre-close" })}><RefreshCw className="mr-2 h-4 w-4" />Revisar pendientes</Button>{state === "PRE_CLOSE" && <Button disabled={busy} onClick={() => mutation.mutate({ action: "request-review", body: {} })}><ShieldCheck className="mr-2 h-4 w-4" />Enviar a revisión</Button>}{state === "IN_REVIEW" && isAdmin && <Button disabled={busy || failedCritical > 0} onClick={() => mutation.mutate({ action: "close" })}><LockKeyhole className="mr-2 h-4 w-4" />Cerrar período</Button>}{state === "CLOSED" && isAdmin && <Button variant="destructive" disabled={busy} onClick={() => void reopen()}><RotateCcw className="mr-2 h-4 w-4" />Reabrir</Button>}</div></div></CardHeader>
      <CardContent className="space-y-3">{query.isLoading && <p className="text-sm text-muted-foreground">Ejecutando controles…</p>}{!query.isLoading && checks.length === 0 && <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">Todavía no se ejecutó el pre-cierre de este período.</div>}{checks.map((check) => <div key={check.id} className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-50">{check.status === "passed" || check.status === "resolved" || check.status === "accepted" ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className={`h-5 w-5 ${check.severity === "critical" ? "text-red-600" : "text-amber-600"}`} />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{check.title}</p><Badge variant={check.severity === "critical" ? "destructive" : "secondary"}>{statusLabel(check.severity)}</Badge><Badge variant="outline">{statusLabel(check.status)}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{check.detail}</p>{check.resolution && <p className="mt-1 text-xs text-emerald-700">Resolución: {check.resolution}</p>}{check.severity === "critical" && check.status === "failed" && <p className="mt-1 text-xs text-red-700">Corregí el origen y volvé a ejecutar el pre-cierre.</p>}</div>{check.status === "failed" && check.severity !== "critical" && state !== "CLOSED" && <Button size="sm" variant="outline" onClick={() => void resolve(check)}>Aceptar excepción</Button>}</div>)}</CardContent>
    </Card>
    {state === "CLOSED" && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><LockKeyhole className="h-4 w-4" />El período está congelado. Los tableros leen el snapshot versión {query.data?.period?.snapshotVersion}.</div>}
    {reason.dialog}
  </PageShell>;
}

const STEPS = [
  { status: "OPEN", label: "Abierto", hint: "Carga de datos del mes" },
  { status: "PRE_CLOSE", label: "Pre-cierre", hint: "Controles ejecutados" },
  { status: "IN_REVIEW", label: "En revisión", hint: "Aprobación de un admin" },
  { status: "CLOSED", label: "Cerrado", hint: "Cifras protegidas" },
];
