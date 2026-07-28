import * as React from "react";

import { cn } from "@/lib/utils";

export interface ToolbarPanelProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /**
   * An explicit label keeps filter-only toolbars understandable to assistive
   * technology even when no visible title is required.
   */
  ariaLabel?: string;
}

const ToolbarPanel = React.forwardRef<HTMLElement, ToolbarPanelProps>(
  (
    {
      title,
      description,
      actions,
      ariaLabel = "Filtros y herramientas",
      className,
      children,
      ...props
    },
    ref,
  ) => (
    <section
      ref={ref}
      data-ui="toolbar-panel"
      aria-label={ariaLabel}
      className={cn(
        "ui-toolbar-panel rounded-2xl border border-border/75 bg-card p-3 shadow-[0_10px_28px_-30px_rgba(15,23,42,0.5)] sm:p-4",
        className,
      )}
      {...props}
    >
      {title || description ? (
        <div className="ui-toolbar-intro min-w-0">
          {title ? (
            <h2 className="text-sm font-semibold leading-5 text-foreground">
              {title}
            </h2>
          ) : null}
          {description ? (
            <div className="mt-0.5 text-xs leading-5 text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="ui-toolbar-controls min-w-0">{children}</div>

      {actions ? (
        <div className="ui-toolbar-actions flex min-w-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </section>
  ),
);
ToolbarPanel.displayName = "ToolbarPanel";

export { ToolbarPanel };
