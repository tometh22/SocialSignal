import * as React from "react";

import { cn } from "@/lib/utils";

export interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  /**
   * Announces a newly-rendered result state without turning every decorative
   * placeholder into a live region.
   */
  announce?: boolean;
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    {
      title,
      description,
      icon,
      action,
      secondaryAction,
      announce = false,
      className,
      ...props
    },
    ref,
  ) => (
    <div
      ref={ref}
      data-ui="empty-state"
      role={announce ? "status" : undefined}
      className={cn(
        "ui-empty-state flex min-h-48 w-full min-w-0 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-4 py-8 text-center sm:min-h-56 sm:px-8",
        className,
      )}
      {...props}
    >
      {icon ? (
        <div
          aria-hidden="true"
          className="grid size-12 place-items-center rounded-2xl border border-border/75 bg-background text-muted-foreground shadow-sm"
        >
          {icon}
        </div>
      ) : null}

      <h2 className={cn("text-base font-semibold leading-6 text-foreground", icon && "mt-4")}>
        {title}
      </h2>

      {description ? (
        <div className="mt-1.5 max-w-md text-pretty text-sm leading-6 text-muted-foreground">
          {description}
        </div>
      ) : null}

      {action || secondaryAction ? (
        <div className="ui-empty-state-actions mt-5 flex w-full min-w-0 flex-col items-stretch justify-center gap-2 sm:w-auto sm:flex-row sm:items-center">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  ),
);
EmptyState.displayName = "EmptyState";

export { EmptyState };
