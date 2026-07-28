import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import { getFirstAllowedRouteForUser } from "@/lib/first-allowed-route";

const source = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("navigation and high-traffic page migrations", () => {
  test("post-login routing is centralized for internal and provider users", () => {
    expect(getFirstAllowedRouteForUser(null)).toBe("/auth");
    expect(getFirstAllowedRouteForUser({ role: "external_provider" })).toBe("/provider/dashboard");
    expect(getFirstAllowedRouteForUser({ isAdmin: true })).toBe("/");
    expect(getFirstAllowedRouteForUser({ permissions: ["finance"] })).toBe("/");
    expect(getFirstAllowedRouteForUser({ permissions: [] })).toBe("/unauthorized");

    const authHook = source("client/src/hooks/use-auth.tsx");
    const authPage = source("client/src/pages/auth-page.tsx");
    expect(authHook).toContain("getFirstAllowedRouteForUser(userData");
    expect(authPage).toContain("getFirstAllowedRouteForUser(user");
    expect(authHook).not.toContain('return \'/statistics\'');
  });

  test("sidebar follows the product information architecture", () => {
    const sidebar = source("client/src/components/layout/sidebar-fixed.tsx");
    const labels = [
      'title: "Comercial"',
      'title: "Proyectos"',
      'title: "Operaciones"',
      'title: "Finanzas"',
      'title: "Administración"',
    ];
    const positions = labels.map((label) => sidebar.indexOf(label));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(sidebar).toContain('href: "/review", title: "Status"');
    expect(sidebar).not.toContain("reviewsExpanded");
    expect(sidebar).not.toContain("taskProjects");
  });

  test("financial summary uses compact chrome and accessible controls", () => {
    const dashboard = source("client/src/pages/executive-dashboard-v2.tsx");

    expect(dashboard).toContain("<PageShell");
    expect(dashboard).toContain("<CompactPageHeader");
    expect(dashboard).toContain("<ToolbarPanel");
    expect(dashboard).toContain("<MetricGrid");
    expect(dashboard).toContain('aria-label="Actualizar resumen financiero"');
    expect(dashboard).toContain("aria-pressed={viewMode === mode}");
    expect(dashboard).not.toContain("Period key:");
    expect(dashboard).toContain("toFixed(2)}×");
  });

  test("CRM uses shared metrics and provides keyboard and toggle semantics", () => {
    const crm = source("client/src/pages/crm.tsx");

    expect(crm).toContain("<CompactPageHeader");
    expect(crm).toContain("<MetricGrid");
    expect(crm).toContain("<ToolbarPanel");
    expect(crm).toContain("KeyboardSensor");
    expect(crm).toContain("sortableKeyboardCoordinates");
    expect(crm).toContain('aria-label="Ver pipeline como tablero"');
    expect(crm).toContain("aria-pressed={viewMode === 'kanban'}");
  });

  test("hours panel has labeled 44px filters and a recoverable empty state", () => {
    const hours = source("client/src/pages/hours-dashboard.tsx");

    expect(hours).toContain("<CompactPageHeader");
    expect(hours).toContain("<ToolbarPanel");
    expect(hours).toContain("<MetricGrid");
    expect(hours).toContain("<EmptyState");
    expect(hours).toContain('aria-pressed={quickFilter === f.value}');
    expect(hours).toContain('htmlFor="hours-date-from"');
    expect(hours).toContain('href="/tasks"');
    expect(hours).not.toContain('className="h-7 text-xs"');
  });
});
