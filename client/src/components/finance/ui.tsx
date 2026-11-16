import { useCallback, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Database } from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** Placeholder shown when an amount could not be read. Never render a missing amount as zero. */
export const MISSING = "Sin datos";

const usd0 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
/** Whole-dollar amount with the same "USD 1.234" notation used by the financial summary. */
export const formatUsd = (value: number | null | undefined, missing = MISSING) => value == null || !Number.isFinite(value) ? missing : `${value < 0 ? "−" : ""}USD ${usd0.format(Math.abs(value))}`;
export const amountTone = (value: number | null | undefined) => value == null ? "text-muted-foreground" : value < 0 ? "text-red-600" : "text-foreground";
export const formatDate = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export function periodLabel(period: string) {
  const [year, month] = period.split("-").map(Number);
  const name = MONTHS[(month || 1) - 1] ?? period;
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}

/** Page heading used by every Finance view, flat so it sits under the shared Finance bar. */
export function FinanceHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      <h1 className="text-balance text-2xl font-bold leading-tight tracking-[-0.03em] text-foreground">{title}</h1>
      {description && <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
  </header>;
}

/** Card that hosts a table with consistent title, filters, loading, error and empty states. */
export function FinanceTableCard({ title, description, toolbar, subheader, loading, error, empty, emptyMessage, onRetry, footer, children, className, dimmed }: {
  title: ReactNode; description?: ReactNode; toolbar?: ReactNode; subheader?: ReactNode; loading?: boolean; error?: boolean; empty?: boolean;
  emptyMessage?: ReactNode; onRetry?: () => unknown; footer?: ReactNode; children?: ReactNode; className?: string; dimmed?: boolean;
}) {
  return <Card className={cn("overflow-hidden", className)}>
    <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="min-w-0"><h2 className="text-base font-semibold">{title}</h2>{description && <p className="text-xs leading-5 text-muted-foreground">{description}</p>}</div>
      {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
    </div>
    {subheader}
    {loading ? <div className="space-y-2 p-4 sm:p-5" aria-label="Cargando registros">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-9 w-full" />)}</div>
      : error ? <div className="flex min-h-40 flex-col items-center justify-center gap-3 px-6 text-center"><p className="text-sm font-medium">No se puede confirmar si hay registros hasta recuperar la conexión.</p>{onRetry && <Button variant="outline" size="sm" onClick={() => void onRetry()}>Reintentar</Button>}</div>
      : empty ? <div className="flex min-h-40 items-center justify-center px-6 text-center text-sm text-muted-foreground">{emptyMessage}</div>
      : <div className={cn("overflow-x-auto transition-opacity", dimmed && "opacity-60")}>{children}</div>}
    {footer && !loading && !error && !empty && <div className="border-t px-4 py-3 text-sm sm:px-5">{footer}</div>}
  </Card>;
}

const statusStyles = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-800",
  info: "border-sky-200 bg-sky-50 text-sky-800",
  neutral: "border-border bg-muted text-muted-foreground",
} as const;
export type StatusTone = keyof typeof statusStyles;
export function StatusPill({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium", statusStyles[tone])}>{children}</span>;
}

type ReasonRequest = { title: string; description?: string; confirmLabel?: string; destructive?: boolean; minLength?: number };
/**
 * In-app replacement for window.prompt: asks for an audited reason and resolves
 * with the trimmed text, or null when the person cancels.
 */
export function useReasonDialog() {
  const [request, setRequest] = useState<ReasonRequest | null>(null);
  const [value, setValue] = useState("");
  const resolver = useRef<((reason: string | null) => void) | null>(null);
  const ask = useCallback((next: ReasonRequest) => new Promise<string | null>(resolve => {
    resolver.current?.(null);
    resolver.current = resolve;
    setValue("");
    setRequest(next);
  }), []);
  const finish = (reason: string | null) => { resolver.current?.(reason); resolver.current = null; setRequest(null); };
  const minLength = request?.minLength ?? 5;
  const valid = value.trim().length >= minLength;
  const dialog = <Dialog open={!!request} onOpenChange={open => { if (!open) finish(null); }}>
    <DialogContent className="sm:max-w-md">
      <form onSubmit={event => { event.preventDefault(); if (valid) finish(value.trim()); }} className="space-y-4">
        <DialogHeader><DialogTitle>{request?.title}</DialogTitle>{request?.description && <DialogDescription>{request.description}</DialogDescription>}</DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="finance-reason">Motivo</Label>
          <Textarea id="finance-reason" autoFocus rows={3} value={value} onChange={event => setValue(event.target.value)} placeholder="Queda registrado en la auditoría" />
          <p className="text-xs text-muted-foreground">Mínimo {minLength} caracteres.</p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => finish(null)}>Cancelar</Button>
          <Button type="submit" variant={request?.destructive ? "destructive" : "default"} disabled={!valid}>{request?.confirmLabel ?? "Confirmar"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
  return { ask, dialog };
}

export function FinancePagination({ page, total, totalPages, busy, onPage }: { page: number; total: number; totalPages: number; busy?: boolean; onPage: (page: number) => void }) {
  const last = Math.max(1, totalPages);
  return <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <span className="text-muted-foreground">{total} {total === 1 ? "registro" : "registros"} · Página {page} de {last}</span>
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1 || busy}><ChevronLeft className="mr-1 h-4 w-4" /> Anterior</Button>
      <Button variant="outline" size="sm" onClick={() => onPage(page + 1)} disabled={page >= last || busy}>Siguiente <ChevronRight className="ml-1 h-4 w-4" /></Button>
    </div>
  </div>;
}

/** Placeholder layout while a Finance view loads: metric row plus a content block. */
export function FinanceLoading({ label = "Cargando datos financieros" }: { label?: string }) {
  return <div role="status" aria-label={label} className="space-y-4">
    <div className="ui-metric-grid">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[7.5rem] rounded-2xl" />)}</div>
    <Skeleton className="h-72 rounded-2xl" />
    <span className="sr-only">{label}…</span>
  </div>;
}

export type PeriodSource = { period: string; source: "master" | "mind"; otherSourceRecords: { activo: number; pasivo: number; cashflow: number; provisions: number } };

/** Whether the month is reported from the Master or from Mind (same rule as the Resumen). */
export function usePeriodSource(period: string) {
  return useQuery<PeriodSource>({ queryKey: [`/api/finance/period-source?period=${period}`], staleTime: 60_000 });
}

/** States where the month's figures come from and which records are not counted. */
export function PeriodSourceNotice({ source, otherRecords, noun }: { source?: PeriodSource; otherRecords?: number; noun: string }) {
  if (!source) return null;
  const master = source.source === "master";
  return <div data-testid="period-source" className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-3 text-sm text-sky-950">
    <Database className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" aria-hidden="true" />
    <div className="space-y-0.5">
      <p className="font-medium">{master ? "Este mes se informa desde el Máster" : "Este mes se registra en Mind"}</p>
      <p className="text-xs leading-5 text-sky-900/80">
        {master ? `Mind sincroniza ${noun} del Máster cada 30 minutos. Para corregir un registro, cambialo en la planilla.` : `Se muestran ${noun} cargados en Mind. El Máster ya no actualiza este mes.`}
        {otherRecords ? ` ${otherRecords} ${otherRecords === 1 ? "registro" : "registros"} de ${master ? "Mind" : "la importación del Máster"} no se suman para no duplicar importes.` : ""}
      </p>
    </div>
  </div>;
}
