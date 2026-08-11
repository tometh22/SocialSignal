import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

const source = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("Mind product UI system", () => {
  test("topbar uses real CRM reminders and does not ship demo alerts", () => {
    const topbar = source("client/src/components/layout/topbar.tsx");

    expect(topbar).toContain('/api/crm/reminders/due');
    expect(topbar).toContain('event.key.toLowerCase() === "k"');
    expect(topbar).not.toContain("Warner Bros. - 80% del presupuesto consumido");
    expect(topbar).not.toContain("uberchil");
    expect(topbar).not.toContain('href="/notifications"');
  });

  test("shared overlays and motion respect small screens and accessibility preferences", () => {
    const dialog = source("client/src/components/ui/dialog.tsx");
    const alertDialog = source("client/src/components/ui/alert-dialog.tsx");
    const search = source("client/src/components/features/global-search.tsx");
    const styles = source("client/src/index.css");

    expect(dialog).toContain("max-h-[calc(100dvh-1.5rem)]");
    expect(dialog).toContain("overflow-y-auto");
    expect(dialog).toContain("bg-slate-950/[0.55]");
    expect(alertDialog).toContain("max-h-[calc(100dvh-1.5rem)]");
    expect(search).toContain('event.key === "Escape"');
    expect(search).toContain('aria-modal="true"');
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toContain("font-size: 16px !important");
  });

  test("navigation and topbar keep readable, isolated color surfaces", () => {
    const app = source("client/src/App.tsx");
    const sidebar = source("client/src/components/layout/sidebar-fixed.tsx");
    const styles = source("client/src/index.css");

    expect(app).toContain("document.body.classList.remove('sidebar-dark')");
    expect(styles).not.toContain("body.sidebar-dark .topbar");
    expect(sidebar).toContain("text-white/[0.68]");
    expect(sidebar).not.toContain("text-white/58");
    expect(sidebar).not.toContain("text-white/28");
  });

  test("page chrome avoids overlays at intermediate widths", () => {
    const heading = source("client/src/components/layout/page-heading.tsx");
    const styles = source("client/src/index.css");
    const quotations = source("client/src/pages/manage-quotes.tsx");
    const projectHero = source("client/src/components/project-detail/project-hero.tsx");

    expect(styles).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(styles).toContain("@media (min-width: 1536px)");
    expect(heading).toContain("hidden 2xl:block");
    expect(quotations).not.toContain("lg:absolute lg:right-3 lg:top-3");
    expect(projectHero).toContain("sticky top-0 z-20 h-0");
    expect(projectHero).not.toContain("fixed top-0 left-0 right-0");
  });

  test("portfolio insights only render when project data exists", () => {
    const home = source("client/src/pages/home-dashboard.tsx");

    expect(home).toContain("projectsForAlerts.length > 0 && insights.length > 0");
  });

  test("task controls remain discoverable on touch devices", () => {
    const tasksHome = source("client/src/pages/tasks/tasks-home.tsx");

    expect(tasksHome).not.toContain("sm:opacity-0 sm:group-hover:opacity-100");
    expect(tasksHome).toContain('aria-label={checked ? "Marcar tarea como pendiente"');
    expect(tasksHome).toContain('aria-label={rangeLabel ? `Cambiar período:');
    expect(tasksHome).toContain('mode="range"');
  });

  test("core pages share the same product heading and brand", () => {
    const sidebar = source("client/src/components/layout/sidebar-fixed.tsx");
    const pageLayout = source("client/src/components/ui/page-layout.tsx");
    const projects = source("client/src/pages/active-projects-next.tsx");
    const tasks = source("client/src/pages/tasks/tasks-home.tsx");

    expect(sidebar).toContain("<BrandMark");
    expect(pageLayout).toContain("<PageHeader");
    expect(projects).toContain("<PageHeading");
    expect(tasks).toContain("<PageHeading");
  });

  test("secondary routes are lazy-loaded behind a stable visual fallback", () => {
    const app = source("client/src/App.tsx");

    expect(app).toContain("lazy(() => import(");
    expect(app).toContain("<Suspense fallback={<AppRouteFallback />}>");
    expect(app).toContain('role="status"');
  });
});
