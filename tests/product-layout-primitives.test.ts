import { readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { CompactPageHeader } from "@/components/ui/compact-page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { PageShell } from "@/components/ui/page-shell";
import { ToolbarPanel } from "@/components/ui/toolbar-panel";

const source = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("product layout primitives", () => {
  test("application typography has no implicit editorial spacing", () => {
    const styles = source("client/src/index.css");

    expect(styles).toMatch(/h1, \.h1 \{[\s\S]*?margin: 0;/);
    expect(styles).toMatch(/h6, \.h6 \{[\s\S]*?margin: 0;/);
    expect(styles).toMatch(/p \{\s*margin: 0;\s*max-width: none;/);
    expect(styles).toMatch(/\.prose \{\s*max-width: 70ch;/);
  });

  test("page shell keeps a bounded, responsive application canvas", () => {
    const markup = renderToStaticMarkup(
      h(
        PageShell,
        { width: "wide", spacing: "compact" },
        h("div", null, "Contenido"),
      ),
    );

    expect(markup).toContain('data-ui="page-shell"');
    expect(markup).toContain("max-w-[1680px]");
    expect(markup).toContain("min-w-0");
    expect(markup).toContain("mx-auto");
    expect(markup).not.toContain("px-");
  });

  test("compact page header exposes its heading relationship and actions", () => {
    const markup = renderToStaticMarkup(
      h(CompactPageHeader, {
        headingId: "crm-title",
        eyebrow: "Comercial",
        title: "CRM",
        description: "Seguimiento de oportunidades",
        actions: h("button", { type: "button" }, "Nueva oportunidad"),
      }),
    );

    expect(markup).toContain('aria-labelledby="crm-title"');
    expect(markup).toContain('<h1 id="crm-title"');
    expect(markup).toContain("ui-compact-page-header-actions");
  });

  test("metric cards expose semantic tones inside an auto-fit grid", () => {
    const markup = renderToStaticMarkup(
      h(
        MetricGrid,
        null,
        h(MetricCard, {
          label: "Ingresos",
          value: "$ 12.000",
          valueLabel: "Ingresos: 12 mil dólares",
          tone: "success",
        }),
        h(MetricCard, { label: "Alertas", value: "2", tone: "danger" }),
      ),
    );

    expect(markup).toContain('data-ui="metric-grid"');
    expect(markup).toContain('data-tone="success"');
    expect(markup).toContain('data-tone="danger"');
    expect(markup).toContain('aria-label="Ingresos: 12 mil dólares"');
  });

  test("toolbar and empty states include accessible labels and opt-in announcements", () => {
    const toolbar = renderToStaticMarkup(
      h(
        ToolbarPanel,
        {
          ariaLabel: "Filtros de proyectos",
          actions: h("button", { type: "button" }, "Limpiar"),
        },
        h("input", { "aria-label": "Buscar" }),
      ),
    );
    const emptyState = renderToStaticMarkup(
      h(EmptyState, {
        title: "Sin resultados",
        description: "Probá cambiando los filtros.",
        action: h("button", { type: "button" }, "Limpiar filtros"),
        announce: true,
      }),
    );

    expect(toolbar).toContain('aria-label="Filtros de proyectos"');
    expect(toolbar).toContain("ui-toolbar-controls");
    expect(emptyState).toContain('role="status"');
    expect(emptyState).toContain("text-center");
    expect(emptyState).toContain("ui-empty-state-actions");
  });

  test("shared controls reserve a 44px interaction target", () => {
    const styles = source("client/src/index.css");

    expect(styles).toContain("min-height: 2.75rem;");
    expect(styles).toContain(
      "grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));",
    );
    expect(styles).toContain(
      "grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr));",
    );
  });
});
