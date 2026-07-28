import * as React from "react";

import { cn } from "@/lib/utils";

export interface CompactPageHeaderProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  icon?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  headingId?: string;
}

const CompactPageHeader = React.forwardRef<
  HTMLElement,
  CompactPageHeaderProps
>(
  (
    {
      title,
      description,
      eyebrow,
      icon,
      meta,
      actions,
      headingId,
      className,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const titleId = headingId ?? `page-title-${generatedId}`;

    return (
      <header
        ref={ref}
        data-ui="compact-page-header"
        aria-labelledby={titleId}
        className={cn(
          "ui-compact-page-header rounded-2xl border border-border/70 bg-card/95 p-4 shadow-[0_14px_34px_-30px_rgba(15,23,42,0.42)] sm:p-5 lg:p-6",
          className,
        )}
        {...props}
      >
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          {icon ? (
            <div
              aria-hidden="true"
              className="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/10 bg-primary/[0.07] text-primary"
            >
              {icon}
            </div>
          ) : null}

          <div className="min-w-0 flex-1">
            {eyebrow ? (
              <div className="mb-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-primary">
                {eyebrow}
              </div>
            ) : null}

            <h1
              id={titleId}
              className="text-balance text-2xl font-bold leading-tight tracking-[-0.035em] text-foreground sm:text-[1.75rem]"
            >
              {title}
            </h1>

            {description ? (
              <div className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-[0.9375rem]">
                {description}
              </div>
            ) : null}

            {meta ? (
              <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {meta}
              </div>
            ) : null}
          </div>
        </div>

        {actions ? (
          <div className="ui-compact-page-header-actions flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
            {actions}
          </div>
        ) : null}
      </header>
    );
  },
);
CompactPageHeader.displayName = "CompactPageHeader";

export { CompactPageHeader };
