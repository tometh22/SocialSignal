import { createHash } from "node:crypto";
import { parseMoneySmart } from "../utils/money";

export type LedgerSnapshotResult<T> = {
  rows: T[];
  read: number;
  skipped: number;
};

type ActivoSnapshotRow = {
  periodKey: string;
  sourceRowKey: string;
  concepto: string | null;
  clienteNombre: string | null;
  montoARS: string | null;
  montoUSD: string | null;
  cotizacion: string | null;
  montoTotalUSD: string | null;
  nroFactura: string | null;
  tipoActivo: string | null;
  fechaFacturacion: Date | null;
  fechaPago: Date | null;
  fechaVencimiento: Date | null;
  vencido: boolean;
  cobradoAlCierre: boolean;
  razonSocial: string | null;
};

type PasivoSnapshotRow = {
  periodKey: string;
  sourceRowKey: string;
  detalle: string;
  subtipoCosto: string | null;
  montoARS: string | null;
  montoUSD: string | null;
  cotizacion: string | null;
  montoTotalUSD: string | null;
  fechaEmision: Date | null;
  fechaPago: Date | null;
  fechaVencimiento: Date | null;
  vencido: boolean;
  pagadoAlCierre: boolean;
  concepto: string | null;
  descripcion: string | null;
};

const normalizeHeader = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const normalizeKeyPart = (value: unknown) => {
  if (value instanceof Date) return value.toISOString();
  const normalized = String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  if (/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    const numeric = Number(normalized);
    if (Number.isFinite(numeric)) return String(numeric);
  }
  return normalized;
};

const nullableMoney = (value: unknown): number | null => {
  if (value == null || String(value).trim() === "") return null;
  const parsed = parseMoneySmart(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const moneyString = (value: number | null) => value == null ? null : String(value);

const sheetBoolean = (value: unknown, positiveWord: string) => {
  if (typeof value === "boolean") return value;
  const normalized = normalizeHeader(value);
  if (
    normalized === "no"
    || normalized === "false"
    || normalized === "0"
    || normalized.includes(`no ${positiveWord}`)
  ) {
    return false;
  }
  return normalized === "si"
    || normalized === "true"
    || normalized === "1"
    || normalized.includes(positiveWord);
};

const sheetOverdue = (value: unknown) =>
  sheetBoolean(value, "vencido") && !normalizeHeader(value).includes("termino");

const hashKeyParts = (parts: unknown[]) =>
  createHash("md5")
    .update(parts.map(normalizeKeyPart).join("\u001f"))
    .digest("hex");

export const activoBusinessKey = (row: {
  concepto?: unknown;
  clienteNombre?: unknown;
  montoARS?: unknown;
  montoUSD?: unknown;
  cotizacion?: unknown;
  nroFactura?: unknown;
}) => hashKeyParts([
  row.concepto,
  row.clienteNombre,
  row.montoARS,
  row.montoUSD,
  row.cotizacion,
  row.nroFactura,
]);

export const pasivoBusinessKey = (row: {
  detalle?: unknown;
  subtipoCosto?: unknown;
  montoARS?: unknown;
  montoUSD?: unknown;
  cotizacion?: unknown;
  fechaEmision?: unknown;
}) => hashKeyParts([
  row.detalle,
  row.subtipoCosto,
  row.montoARS,
  row.montoUSD,
  row.cotizacion,
  row.fechaEmision,
]);

const parseSheetDate = (value: unknown): Date | null => {
  if (value == null || String(value).trim() === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    // Google Sheets returns spreadsheet dates as serial days when using
    // UNFORMATTED_VALUE. 1899-12-30 matches the Sheets/Excel epoch.
    const parsed = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const raw = String(value).trim();
  const latin = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (latin) {
    const parsed = new Date(Number(latin[3]), Number(latin[2]) - 1, Number(latin[1]));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const iso = raw.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
  if (iso) {
    const parsed = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3] ?? 1));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const spanishMonths: Record<string, number> = {
  ene: 1,
  enero: 1,
  feb: 2,
  febrero: 2,
  mar: 3,
  marzo: 3,
  abr: 4,
  abril: 4,
  may: 5,
  mayo: 5,
  jun: 6,
  junio: 6,
  jul: 7,
  julio: 7,
  ago: 8,
  agosto: 8,
  sep: 9,
  sept: 9,
  septiembre: 9,
  oct: 10,
  octubre: 10,
  nov: 11,
  noviembre: 11,
  dic: 12,
  diciembre: 12,
};

export const parseSheetPeriod = (value: unknown, explicitYear?: unknown): string | null => {
  const year = Number(String(explicitYear ?? "").trim());
  const normalized = normalizeHeader(value);
  if (Number.isInteger(year) && year >= 2000 && year <= 2200 && normalized) {
    const monthToken = normalized
      .split(/[\s./_-]+/)
      .find((token) => spanishMonths[token] != null);
    const numericMonth = normalized.match(/^(?:\d{1,2}[\s./_-]+)?(0?[1-9]|1[0-2])$/);
    const month = monthToken ? spanishMonths[monthToken] : Number(numericMonth?.[1] ?? 0);
    if (month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, "0")}`;
    }
  }
  const parsed = parseSheetDate(value);
  return parsed
    ? `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`
    : null;
};

const createGetter = (headers: unknown[], row: unknown[]) => {
  const normalizedHeaders = headers.map(normalizeHeader);
  return (...names: string[]) => {
    const accepted = names.map(normalizeHeader);
    const index = normalizedHeaders.findIndex((header) => accepted.includes(header));
    return index >= 0 ? row[index] : "";
  };
};

const assignStableKeys = <T extends Record<string, unknown>>(
  rows: Omit<T, "sourceRowKey">[],
  keyParts: (row: Omit<T, "sourceRowKey">) => unknown[],
): T[] => {
  const occurrences = new Map<string, number>();
  return rows.map((row) => {
    const base = hashKeyParts(keyParts(row));
    const occurrence = (occurrences.get(base) ?? 0) + 1;
    occurrences.set(base, occurrence);
    return { ...row, sourceRowKey: `${base}:${occurrence}` } as unknown as T;
  });
};

export function parseActivoSnapshot(values: unknown[][], periodKey: string): LedgerSnapshotResult<ActivoSnapshotRow> {
  if (values.length < 2) return { rows: [], read: 0, skipped: 0 };
  const headers = values[0];
  const parsed: Omit<ActivoSnapshotRow, "sourceRowKey">[] = [];
  let skipped = 0;

  for (const row of values.slice(1)) {
    if (!row?.length) continue;
    const get = createGetter(headers, row);
    const rawPeriod = get("mes", "periodo", "fecha");
    const rawYear = get("año", "anio", "year");
    const rowPeriod = parseSheetPeriod(rawPeriod, rawYear);
    if ((rawPeriod || rawYear) && (!rowPeriod || rowPeriod !== periodKey)) {
      skipped++;
      continue;
    }

    const concepto = String(get("concepto/banco", "concepto", "detalle", "descripcion") ?? "").trim();
    const clienteNombre = String(get("cliente", "razon social") ?? "").trim();
    if (!concepto && !clienteNombre) {
      skipped++;
      continue;
    }

    const montoARS = nullableMoney(get("moneda original ars", "monto ars", "importe ars", "ars"));
    const montoUSD = nullableMoney(get("moneda original usd", "monto usd", "importe usd", "usd"));
    const cotizacion = nullableMoney(get("cotizacion", "tipo de cambio", "tc"));
    const montoTotalUSDFromSheet = nullableMoney(get("monto total usd", "total usd"));
    const montoTotalUSD = montoTotalUSDFromSheet ?? montoUSD ?? (
      montoARS != null && cotizacion != null && cotizacion > 0 ? montoARS / cotizacion : null
    );
    const nroFactura = String(get(
      "nro de factura/comprobante",
      "factura",
      "nro factura",
      "numero factura",
    ) ?? "").trim();

    parsed.push({
      periodKey,
      concepto: concepto || null,
      clienteNombre: clienteNombre || null,
      montoARS: moneyString(montoARS),
      montoUSD: moneyString(montoUSD),
      cotizacion: moneyString(cotizacion),
      montoTotalUSD: moneyString(montoTotalUSD),
      nroFactura: nroFactura || null,
      tipoActivo: String(get("tipo de activo", "tipo activo") ?? "").trim() || null,
      fechaFacturacion: parseSheetDate(get("fecha facturación", "fecha facturacion")),
      fechaPago: parseSheetDate(get("fecha de pago/nota de credito", "fecha de pago", "fecha pago")),
      fechaVencimiento: parseSheetDate(get("fecha de vencimiento", "fecha vencimiento")),
      vencido: sheetOverdue(get("vencido")),
      cobradoAlCierre: sheetBoolean(
        get("cobrado/no cobrado al cierre", "cobrado al cierre"),
        "cobrado",
      ),
      razonSocial: String(get("razón social/cliente", "razon social/cliente", "razon social") ?? "").trim() || null,
    });
  }

  return {
    rows: assignStableKeys<ActivoSnapshotRow>(parsed, (row) => [
      row.concepto,
      row.clienteNombre,
      row.montoARS,
      row.montoUSD,
      row.cotizacion,
      row.nroFactura,
    ]),
    read: values.length - 1,
    skipped,
  };
}

export function parsePasivoSnapshot(values: unknown[][], periodKey: string): LedgerSnapshotResult<PasivoSnapshotRow> {
  if (values.length < 2) return { rows: [], read: 0, skipped: 0 };
  const headers = values[0];
  const parsed: Omit<PasivoSnapshotRow, "sourceRowKey">[] = [];
  let skipped = 0;

  for (const row of values.slice(1)) {
    if (!row?.length) continue;
    const get = createGetter(headers, row);
    const rawPeriod = get("mes", "periodo", "fecha emisión", "fecha emision");
    const rawYear = get("año", "anio", "year");
    const rowPeriod = parseSheetPeriod(rawPeriod, rawYear);
    if ((rawPeriod || rawYear) && (!rowPeriod || rowPeriod !== periodKey)) {
      skipped++;
      continue;
    }

    const detalle = String(get("detalle", "persona", "proveedor", "nombre") ?? "").trim();
    if (!detalle) {
      skipped++;
      continue;
    }

    const montoARS = nullableMoney(get("moneda original ars", "monto ars", "importe ars", "ars"));
    const montoUSD = nullableMoney(get("moneda original usd", "monto usd", "importe usd", "usd"));
    const cotizacion = nullableMoney(get("cotizacion", "tipo de cambio", "tc"));
    const montoTotalUSDFromSheet = nullableMoney(get("monto total usd", "total usd"));
    const montoTotalUSD = montoTotalUSDFromSheet ?? montoUSD ?? (
      montoARS != null && cotizacion != null && cotizacion > 0 ? montoARS / cotizacion : null
    );
    const fechaEmision = parseSheetDate(get("fecha emisión", "fecha emision", "emision"));

    parsed.push({
      periodKey,
      detalle,
      subtipoCosto: String(get(
        "subtipo de costo",
        "subtipo",
        "tipo costo",
        "subtipo costo",
      ) ?? "").trim() || null,
      montoARS: moneyString(montoARS),
      montoUSD: moneyString(montoUSD),
      cotizacion: moneyString(cotizacion),
      montoTotalUSD: moneyString(montoTotalUSD),
      fechaEmision,
      fechaPago: parseSheetDate(get("fecha de pago", "fecha pago")),
      fechaVencimiento: parseSheetDate(get("fecha de vencimiento", "fecha vencimiento")),
      vencido: sheetOverdue(get("vencido")),
      pagadoAlCierre: sheetBoolean(
        get("pagado/no pagado al cierre", "pagado al cierre"),
        "pagado",
      ),
      concepto: String(get("concepto/detalle", "concepto") ?? "").trim() || null,
      descripcion: String(get("descripción/factura", "descripcion/factura", "descripcion") ?? "").trim() || null,
    });
  }

  return {
    rows: assignStableKeys<PasivoSnapshotRow>(parsed, (row) => [
      row.detalle,
      row.subtipoCosto,
      row.montoARS,
      row.montoUSD,
      row.cotizacion,
      row.fechaEmision,
    ]),
    read: values.length - 1,
    skipped,
  };
}
