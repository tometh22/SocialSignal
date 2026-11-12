import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { periodSchema } from "../../shared/pipeline";
import type { PipelineBilling } from "../../shared/pipeline-finance";
import { allocateEvent } from "../services/revenue-basis";
import { requirePermission } from "../middleware/requirePermission";

export interface BillingEvent {
  id: number;
  clientName: string;
  clientId: number | null;
  amountUsd: string;
  invoicePeriod: string;
  confirmed: boolean;
  isEstimate: boolean;
  status: string;
  sourceTab: string | null;
  sourceRowId: string | null;
  periodClosed: boolean;
}
export type WarnerMapping = PipelineBilling["mapping"];
const decimal = (n: bigint) =>
  `${n < BigInt(0) ? "-" : ""}${(n < BigInt(0) ? -n : n) / BigInt(100)}.${((n < BigInt(0) ? -n : n) % BigInt(100)).toString().padStart(2, "0")}`;
const cents = (value: string) => {
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  const result = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  return negative ? -result : result;
};
/** Pure financial projection. Exact account IDs win; only explicitly mapped exact names are fallback. */
export function summarizeBilling(
  events: BillingEvent[],
  mapping: WarnerMapping,
  period: string,
  now = new Date(),
): PipelineBilling {
  periodSchema.parse(period);
  const matching = events.filter((e) => e.invoicePeriod === period);
  const actual = matching.filter(
    (e) =>
      e.confirmed === true &&
      e.isEstimate === false &&
      e.status !== "cancelled",
  );
  const eligible = actual.filter((e) =>
    /^-?\d{1,12}(\.\d{1,2})?$/.test(e.amountUsd),
  );
  const ids = new Set(mapping.map((m) => m.clientId)),
    names = new Set(mapping.map((m) => m.name));
  const warner = eligible.filter((e) =>
    e.clientId !== null ? ids.has(e.clientId) : names.has(e.clientName),
  );
  const canonicalAmount = (e: BillingEvent) =>
    allocateEvent(
      {
        id: e.id,
        clientName: e.clientName,
        amountUsd: Number(e.amountUsd),
        invoicePeriod: e.invoicePeriod,
      },
      "facturacion",
    )[0].amountUsd.toFixed(2);
  const total = eligible.reduce(
    (sum, e) => sum + cents(canonicalAmount(e)),
    BigInt(0),
  );
  const numerator = warner.reduce(
    (sum, e) => sum + cents(canonicalAmount(e)),
    BigInt(0),
  );
  const missingSource = eligible.some((e) => !e.sourceTab || !e.sourceRowId);
  const reason = !actual.length
    ? "No hay eventos reales de facturación en el período; se excluyeron las proyecciones."
    : eligible.length !== actual.length
      ? "Hay importes financieros pendientes de conciliación."
      : !mapping.length
        ? "Falta conciliar las cuentas de Warner."
        : missingSource
          ? "Falta trazabilidad de origen en los eventos financieros."
          : total <= BigInt(0)
            ? "El total facturado del período no permite calcular una participación."
            : null;
  return {
    period,
    basis: "facturacion",
    currency: "USD",
    state: reason ? "pending" : "verified",
    reason,
    totalUsd: eligible.length ? decimal(total) : null,
    warnerUsd: eligible.length && mapping.length ? decimal(numerator) : null,
    warnerSharePct: reason ? null : (Number(numerator) / Number(total)) * 100,
    eventCount: actual.length,
    warnerEventCount: warner.length,
    excludedEstimateCount: matching.filter((e) => e.isEstimate || !e.confirmed)
      .length,
    periodClosed: actual.length > 0 && actual.every((e) => e.periodClosed),
    source: "revenue_events",
    retrievedAt: now.toISOString(),
    mapping,
    events: eligible.map((e) => ({
      id: e.id,
      clientId: e.clientId,
      clientName: e.clientName,
      amountUsd: canonicalAmount(e),
      sourceTab: e.sourceTab,
      sourceRowId: e.sourceRowId,
    })),
    historicalReference: {
      percentage: 80,
      approximate: true,
      reportedOn: "2026-10-28",
      label:
        "Referencia histórica declarada; no equivale a la facturación mensual verificada.",
    },
  };
}

/** No data queries run before both the CRM and finance gates have passed. */
export function registerPipelineFinanceRoutes(
  app: Express,
  requireAuth: RequestHandler,
) {
  app.get(
    "/api/crm/pipeline/billing",
    requireAuth,
    requirePermission("crm"),
    requirePermission("finance"),
    async (req, res) => {
      const parsed = z
        .object({ period: periodSchema })
        .strict()
        .safeParse(req.query);
      if (!parsed.success)
        return res
          .status(400)
          .json({ message: "Indicá el período de facturación como YYYY-MM." });
      try {
        const { pool } = await import("../db");
        const [{ rows: raw }, { rows: mappings }] = await Promise.all([
          pool.query(
            `SELECT r.id,r.client_name,r.amount_usd,r.invoice_period,r.confirmed,r.is_estimate,r.status,r.source_tab,r.source_row_id,r.period_closed,p.client_id
      FROM revenue_events r LEFT JOIN active_projects p ON p.id=r.project_id WHERE r.invoice_period=$1 ORDER BY r.id`,
            [parsed.data.period],
          ),
          pool.query(`SELECT DISTINCT p.client_id,c.name,p.data->>'warnerBasis' AS basis FROM pipeline_opportunities p JOIN clients c ON c.id=p.client_id
      WHERE p.data->>'warner'='true' AND nullif(trim(p.data->>'warnerBasis'),'') IS NOT NULL`),
        ]);
        const events: BillingEvent[] = raw.map((r) => ({
          id: r.id,
          clientName: r.client_name,
          clientId: r.client_id ?? null,
          amountUsd: String(r.amount_usd),
          invoicePeriod: r.invoice_period,
          confirmed: r.confirmed,
          isEstimate: r.is_estimate,
          status: r.status,
          sourceTab: r.source_tab,
          sourceRowId: r.source_row_id,
          periodClosed: r.period_closed,
        }));
        res.json(
          summarizeBilling(
            events,
            mappings.map((m) => ({
              clientId: m.client_id,
              name: m.name,
              basis: m.basis,
            })),
            parsed.data.period,
          ),
        );
      } catch (error) {
        console.error("Pipeline billing read failed", error);
        res
          .status(503)
          .json({
            message:
              "No se pudo consultar la facturación. Reintentá sin usar estimaciones como facturas.",
          });
      }
    },
  );
}
