import * as React from "react";

import { cn } from "@/lib/utils";

export type MetricTone =
  | "neutral"
  | "primary"
  | "info"
  | "success"
  | "warning"
  | "danger";

const toneClasses: Record<
  MetricTone,
  { icon: string; accent: string; detail: string }
> = {
  neutral: {
    icon: "border-border bg-muted text-muted-foreground",
    accent: "bg-slate-400",
    detail: "text-muted-foreground",
  },
  primary: {
    icon: "border-primary/15 bg-primary/[0.08] text-primary",
    accent: "bg-primary",
    detail: "text-primary",
  },
  info: {
    icon: "border-sky-200 bg-sky-50 text-sky-700",
    accent: "bg-sky-500",
    detail: "text-sky-700",
  },
  success: {
    icon: "border-emerald-200 bg-emerald-50 text-emerald-700",
    accent: "bg-emerald-500",
    detail: "text-emerald-700",
  },
  warning: {
    icon: "border-amber-200 bg-amber-50 text-amber-700",
    accent: "bg-amber-500",
    detail: "text-amber-700",
  },
  danger: {
    icon: "border-red-200 bg-red-50 text-red-700",
    accent: "bg-red-500",
    detail: "text-red-700",
  },
};

export interface MetricGridProps extends React.HTMLAttributes<HTMLDivElement> {}

const MetricGrid = React.forwardRef<HTMLDivElement, MetricGridProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-ui="metric-grid"
      className={cn("ui-metric-grid", className)}
      {...props}
    />
  ),
);
MetricGrid.displayName = "MetricGrid";

export interface MetricCardProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ReactNode;
  detail?: React.ReactNode;
  footer?: React.ReactNode;
  tone?: MetricTone;
  valueLabel?: string;
}

const MetricCard = React.forwardRef<HTMLElement, MetricCardProps>(
  (
    {
      label,
      value,
      icon,
      detail,
      footer,
      tone = "neutral",
      valueLabel,
      className,
      ...props
    },
    ref,
  ) => {
    const styles = toneClasses[tone];

    return (
      <section
        ref={ref}
        data-ui="metric-card"
        data-tone={tone}
        className={cn(
          "relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border/75 bg-card p-4 shadow-[0_10px_30px_-28px_rgba(15,23,42,0.45)] sm:p-5",
          className,
        )}
        {...props}
      >
        <span
          aria-hidden="true"
          className={cn("absolute inset-x-0 top-0 h-0.5", styles.accent)}
        />

        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-5 text-muted-foreground">
              {label}
            </p>
            <div
              aria-label={valueLabel}
              className="mt-2 min-w-0 break-words text-2xl font-bold tabular-nums leading-none tracking-[-0.035em] text-foreground sm:text-[1.75rem]"
            >
              {value}
            </div>
          </div>

          {icon ? (
            <div
              aria-hidden="true"
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-xl border",
                styles.icon,
              )}
            >
              {icon}
            </div>
          ) : null}
        </div>

        {detail ? (
          <div
            className={cn(
              "mt-3 text-sm font-medium leading-5",
              styles.detail,
            )}
          >
            {detail}
          </div>
        ) : null}

        {footer ? (
          <div className="mt-auto border-t border-border/60 pt-3 text-sm text-muted-foreground">
            {footer}
          </div>
        ) : null}
      </section>
    );
  },
);
MetricCard.displayName = "MetricCard";

export { MetricCard, MetricGrid };
