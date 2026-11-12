import type { PipelineBilling } from "./pipeline-finance";

export interface WarnerExposureInput {
  open: number;
  valueCoverage: number;
  gross: string | null;
  warner: {
    open: number;
    valueCoverage: number;
    gross: string | null;
    valuePct: number | null;
  };
}
export interface ExposureMetric {
  basis:
    | "historical-billing"
    | "monthly-billing"
    | "pipeline-value"
    | "opportunity-count";
  label: string;
  value: string;
  caption: string;
  state: "reference" | "verified" | "pending" | "neutral";
}
const percentage = (value: number) =>
  `${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
const usd = (value: string | null) =>
  value === null
    ? "Pendiente"
    : `USD ${Number(value).toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;

/**
 * Keep four different denominators explicit. A low count share never means
 * low revenue dependency. Historical reported billing never becomes a current
 * verified percentage, and a live financial query never rewrites a saved cut.
 */
export function describeWarnerExposure(
  input: WarnerExposureInput,
  options: {
    canSeeFinance: boolean;
    billing?: PipelineBilling | null;
    snapshot?: boolean;
  },
): {
  headline: ExposureMetric;
  historical: ExposureMetric | null;
  monthly: ExposureMetric | null;
  count: ExposureMetric;
  value: ExposureMetric;
} {
  const count: ExposureMetric = {
    basis: "opportunity-count",
    label: "Warner / oportunidades abiertas",
    value: input.open ? `${input.warner.open} de ${input.open}` : "Pendiente",
    caption: `${Math.max(0, input.open - input.warner.open)} oportunidades fuera de Warner. La cantidad no mide la dependencia de facturación.`,
    state: input.open ? "neutral" : "pending",
  };
  const value: ExposureMetric = {
    basis: "pipeline-value",
    label: "Warner / bruto conocido",
    value:
      input.warner.valuePct === null
        ? "Pendiente"
        : percentage(input.warner.valuePct),
    caption: `Warner: ${usd(input.warner.gross)} · cartera: ${usd(input.gross)}. Cobertura ${input.valueCoverage}/${input.open}; Warner ${input.warner.valueCoverage}/${input.warner.open}.${input.valueCoverage < input.open ? " La participación total sigue pendiente." : ""}`,
    state: input.warner.valuePct === null ? "pending" : "neutral",
  };
  if (!options.canSeeFinance)
    return { headline: value, historical: null, monthly: null, count, value };
  const historical: ExposureMetric = {
    basis: "historical-billing",
    label: "Facturación histórica informada",
    value: "≈80%",
    caption:
      "Referencia del 28/10/2026 · validación contable pendiente. No equivale a la facturación mensual actual.",
    state: "reference",
  };
  const billing = options.billing;
  const verified =
    billing?.state === "verified" && billing.warnerSharePct !== null;
  const monthly: ExposureMetric = {
    basis: "monthly-billing",
    label: `Facturación mensual verificada${billing?.period ? ` · ${billing.period}` : ""}`,
    value: verified ? percentage(billing.warnerSharePct!) : "Pendiente",
    caption: `${billing?.reason ?? (verified ? `Warner ${usd(billing.warnerUsd)} / total ${usd(billing.totalUsd)}. ${billing.eventCount} hechos reales.` : "Falta conciliar ingresos reales del mismo período y moneda.")}${options.snapshot ? " Consulta financiera actual; no forma parte del corte guardado." : ""}`,
    state: verified ? "verified" : "pending",
  };
  return {
    headline: verified && !options.snapshot ? monthly : historical,
    historical,
    monthly,
    count,
    value,
  };
}

/** Append only for a finance-authorized reader; never claim a live financial query was frozen. */
export function warnerFinancialSummaryText(options: {
  canSeeFinance: boolean;
  billing?: PipelineBilling | null;
  snapshot?: boolean;
}): string | null {
  if (!options.canSeeFinance) return null;
  const reference =
    "Warner · referencia de facturación histórica: ≈80%, informada el 28/10/2026; validación contable pendiente.";
  if (options.snapshot) {
    return `${reference}\nFacturación mensual verificada al corte: Pendiente. La cantidad de oportunidades abiertas no mide dependencia de facturación.`;
  }
  const b = options.billing;
  const verified = b?.state === "verified" && b.warnerSharePct !== null;
  const monthly = verified
    ? `Facturación mensual verificada · ${b.period}: Warner ${usd(b.warnerUsd)} / total ${usd(b.totalUsd)} (${percentage(b.warnerSharePct!)}); ${b.eventCount} hechos reales, base facturación, fuente revenue_events.`
    : `Facturación mensual verificada${b?.period ? ` · ${b.period}` : ""}: Pendiente.${b?.reason ? ` ${b.reason}` : ""}`;
  return `${reference}\n${monthly}\nLa cantidad de oportunidades abiertas no mide dependencia de facturación.`;
}
