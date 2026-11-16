import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { MasterControlCheck, MasterControlReport } from "@shared/master-control";
import { Card } from "@/components/ui/card";
import { QueryError } from "@/components/query-error";
import { StatusPill, formatUsd, periodLabel } from "@/components/finance/ui";

function CheckRow({ check }: { check: MasterControlCheck }) {
  return <li className="grid gap-1 border-b py-2.5 last:border-0 sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] sm:items-center sm:gap-3">
    <div className="flex items-start gap-2">
      {check.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />}
      <div className="min-w-0"><p className="text-sm font-medium">{check.label}</p>{!check.ok && <p className="text-xs leading-5 text-muted-foreground">{check.hint}</p>}</div>
    </div>
    <p className="text-xs text-muted-foreground sm:text-right"><span className="sm:hidden">{check.expectedLabel}: </span><span className="font-medium tabular-nums text-foreground">{formatUsd(check.expectedUsd)}</span><span className="hidden sm:block">{check.expectedLabel}</span></p>
    <p className="text-xs text-muted-foreground sm:text-right"><span className="sm:hidden">{check.actualLabel}: </span><span className="font-medium tabular-nums text-foreground">{formatUsd(check.actualUsd)}</span><span className="hidden sm:block">{check.actualLabel}</span></p>
    <p className={`text-sm font-semibold tabular-nums sm:text-right ${check.ok ? "text-emerald-700" : "text-amber-700"}`}>{check.ok ? "Coincide" : `Diferencia ${formatUsd(check.differenceUsd)}`}</p>
  </li>;
}

/** Monthly control between the Máster and Mind, shown in the Resumen for finance users. */
export function MasterControlCard({ period }: { period: string }) {
  const query = useQuery<MasterControlReport>({ queryKey: [`/api/finance/master-control?period=${period}`], staleTime: 60_000 });
  if (query.isLoading) return <Card className="p-4 text-sm text-muted-foreground sm:px-5">Comparando la planilla Máster con Mind…</Card>;
  if (query.error) return <QueryError message="No se pudo comparar la planilla Máster con Mind." retry={query.refetch} />;
  const report = query.data;
  if (!report || report.source === "mind") return null;
  const sync = report.checks.filter(check => check.kind === "sync");
  const master = report.checks.filter(check => check.kind === "master");
  const syncIssues = sync.filter(check => !check.ok).length;
  const masterIssues = master.filter(check => !check.ok).length;
  return <Card data-testid="master-control" className="p-4 text-sm sm:px-5">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h2 className="font-semibold">Control mensual Máster–Mind · {periodLabel(period)}</h2>
      <StatusPill tone={syncIssues ? "danger" : "success"}>{syncIssues ? `Mind difiere de la planilla en ${syncIssues} ${syncIssues === 1 ? "dato" : "datos"}` : "Mind coincide con la planilla"}</StatusPill>
      <StatusPill tone={masterIssues ? "warning" : "success"}>{masterIssues ? `${masterIssues} ${masterIssues === 1 ? "diferencia" : "diferencias"} dentro de la planilla` : "La planilla es consistente"}</StatusPill>
    </div>
    <details className="mt-2" open={syncIssues > 0}>
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Ver el detalle del control</summary>
      <div className="mt-3 space-y-4">
        <section aria-label="Mind contra la planilla">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mind contra la planilla</h3>
          <ul className="mt-1">{sync.map(check => <CheckRow key={check.id} check={check} />)}</ul>
        </section>
        <section aria-label="Dentro de la planilla">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dentro de la planilla</h3>
          <p className="text-xs text-muted-foreground">El Resumen Ejecutivo comparado con el detalle de las otras pestañas. Estas diferencias se corrigen en la planilla.</p>
          <ul className="mt-1">{master.map(check => <CheckRow key={check.id} check={check} />)}</ul>
        </section>
        {report.pending.length > 0 && <section aria-label="Datos pendientes" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
          <h3 className="text-xs font-semibold">Datos pendientes en la planilla</h3>
          <ul className="mt-1 space-y-0.5 text-xs">{report.pending.map(item => <li key={item}>{item}</li>)}</ul>
        </section>}
      </div>
    </details>
  </Card>;
}
