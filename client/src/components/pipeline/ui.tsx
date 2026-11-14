import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Piezas visuales compartidas por la página del Pipeline comercial y la ficha.
 * Mantienen una sola escala tipográfica, un solo color por etapa y el mismo
 * tratamiento de los datos pendientes en todo el módulo.
 */
export const stageColors: Record<string, string> = {
  Prospección: "bg-slate-400",
  "Reunión / demo": "bg-sky-500",
  Propuesta: "bg-indigo-500",
  Negociación: "bg-amber-500",
  Confirmada: "bg-emerald-500",
  "Sin etapa verificada": "bg-slate-300",
};
export const tableHead =
  "bg-slate-50/80 text-xs font-medium uppercase tracking-wider text-slate-500";
export const cardBase =
  "rounded-2xl border border-slate-200/80 bg-card shadow-sm";
/** Gris de los datos faltantes: atenuado pero legible (contraste AA sobre blanco). */
export const pendingText = "text-slate-500";

export const isPending = (value: unknown) =>
  value === null || value === undefined;
export const money = (value: unknown) =>
  isPending(value)
    ? "Pendiente"
    : new Intl.NumberFormat("es-AR", {
        maximumFractionDigits: 2,
        minimumFractionDigits: Number(value) % 1 ? 2 : 0,
      }).format(Number(value));
export const pct = (value: unknown) =>
  isPending(value)
    ? "Pendiente"
    : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(Number(value))}%`;
export const civilDate = (value?: string | null) =>
  value
    ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Pendiente";
export const dateTime = (value: string) =>
  new Date(value).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
export const initials = (name?: string | null) =>
  name
    ? name
        .split(" ")
        .map((s) => s[0])
        .slice(0, 2)
        .join("")
    : "—";

/** Muestra un importe o un "Pendiente" atenuado, para que el dato faltante no compita con los reales. */
export function Amount({
  value,
  format = money,
  className,
}: {
  value: unknown;
  format?: (v: unknown) => string;
  className?: string;
}) {
  return isPending(value) ? (
    <span className={cn("font-normal", pendingText)}>Pendiente</span>
  ) : (
    <span className={cn("tabular-nums", className)}>{format(value)}</span>
  );
}
/** Versión grande para indicadores: conserva la altura de la cifra aunque falte el dato. */
export function BigValue({
  value,
  unit,
  size = "lg",
}: {
  value: ReactNode;
  unit?: string;
  size?: "lg" | "md";
}) {
  const pending = isPending(value) || value === "Pendiente";
  return (
    <span
      className={cn(
        "flex items-baseline gap-1.5",
        size === "lg" ? "h-9" : "h-8",
      )}
    >
      {pending ? (
        <span
          className={cn(
            "font-medium",
            pendingText,
            size === "lg" ? "text-xl" : "text-lg",
          )}
        >
          Pendiente
        </span>
      ) : (
        <>
          <span
            className={cn(
              "font-semibold tracking-tight tabular-nums",
              size === "lg" ? "text-3xl" : "text-2xl",
            )}
          >
            {value}
          </span>
          {unit && (
            <span className="text-sm font-medium text-muted-foreground">
              {unit}
            </span>
          )}
        </>
      )}
    </span>
  );
}
export function StageBadge({ stage }: { stage: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium leading-5 text-slate-700">
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          stageColors[stage] ?? "bg-slate-400",
        )}
      />
      {stage}
    </span>
  );
}

/**
 * Ícono de ayuda con explicación. Se abre al pasar el mouse, con el teclado o
 * tocándolo (en celular no hay hover). Queda por encima de las tarjetas clickeables.
 */
export function InfoTip({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Qué mide ${label}`}
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            className={cn(
              "relative z-10 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              className,
            )}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          className="max-w-xs text-xs font-normal leading-relaxed"
        >
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
