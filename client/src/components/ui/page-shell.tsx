import * as React from "react";

import { cn } from "@/lib/utils";

const widthClasses = {
  narrow: "max-w-5xl",
  default: "max-w-[1440px]",
  wide: "max-w-[1680px]",
  full: "max-w-none",
} as const;

const spacingClasses = {
  compact: "space-y-4 sm:space-y-5",
  default: "space-y-5 sm:space-y-6 lg:space-y-8",
  relaxed: "space-y-6 sm:space-y-8 lg:space-y-10",
} as const;

export interface PageShellProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Controls the readable application canvas without forcing individual pages
   * to duplicate max-width and horizontal padding rules.
   */
  width?: keyof typeof widthClasses;
  spacing?: keyof typeof spacingClasses;
}

const PageShell = React.forwardRef<HTMLDivElement, PageShellProps>(
  (
    {
      className,
      width = "default",
      spacing = "default",
      children,
      ...props
    },
    ref,
  ) => (
    <div
      ref={ref}
      data-ui="page-shell"
      className={cn(
        "mx-auto w-full min-w-0",
        widthClasses[width],
        spacingClasses[spacing],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);
PageShell.displayName = "PageShell";

export { PageShell };
