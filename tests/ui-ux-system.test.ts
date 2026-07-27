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
    const styles = source("client/src/index.css");

    expect(dialog).toContain("max-h-[calc(100dvh-1.5rem)]");
    expect(dialog).toContain("overflow-y-auto");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toContain("font-size: 16px !important");
  });

  test("task controls remain discoverable on touch devices", () => {
    const tasksHome = source("client/src/pages/tasks/tasks-home.tsx");

    expect(tasksHome).toContain("opacity-100 sm:opacity-0 sm:group-hover:opacity-100");
    expect(tasksHome).toContain('aria-label={checked ? "Marcar tarea como pendiente"');
    expect(tasksHome).toContain('aria-label={date ? `Cambiar fecha:');
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
