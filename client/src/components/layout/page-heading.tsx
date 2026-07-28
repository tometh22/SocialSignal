import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeadingProps = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  className?: string;
};

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
  aside,
  className,
}: PageHeadingProps) {
  return (
    <section className={cn("mind-page-heading", className)}>
      <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center">
        {eyebrow && (
          <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.10)]" />
            {eyebrow}
          </div>
        )}
        <div className="mind-page-heading-main">
          <div className="min-w-0">
            <h1 className="mind-page-title">{title}</h1>
            {description && <p className="mind-page-description">{description}</p>}
          </div>
          {actions && <div className="mind-page-heading-actions">{actions}</div>}
        </div>
      </div>
      {aside && <div className="mind-page-heading-aside relative z-10 hidden 2xl:block">{aside}</div>}
      <div className="pointer-events-none absolute -right-20 -top-28 h-64 w-64 rounded-full bg-primary/[0.055] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 right-36 h-52 w-52 rounded-full bg-indigo-500/[0.045] blur-3xl" />
    </section>
  );
}

type SectionHeadingProps = {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function SectionHeading({
  icon,
  title,
  description,
  action,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn("flex flex-col items-stretch gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-primary/10 bg-primary/[0.07] text-primary">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="mind-section-title">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0 self-start">{action}</div>}
    </div>
  );
}
