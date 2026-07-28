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
};

const normalizeHeader = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const normalizeKeyPart = (value: unknown) => {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
};

const nullableMoney = (value: unknown): number | null => {
  if (value == null || String(value).trim() === "") return null;
  const parsed = parseMoneySmart(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const moneyString = (value: number | null) => value == null ? null : String(value);

const parseSheetDate = (value: unknown): Date | null => {
  if (value == null || String(value).trim() === "") return null;
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

export const parseSheetPeriod = (value: unknown): string | null => {
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
    const base = createHash("md5")
      .update(keyParts(row).map(normalizeKeyPart).join("\u001f"))
      .digest("hex");
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
    const rowPeriod = parseSheetPeriod(rawPeriod);
    if (rawPeriod && (!rowPeriod || rowPeriod !== periodKey)) {
      skipped++;
      continue;
    }

    const concepto = String(get("concepto", "detalle", "descripcion") ?? "").trim();
    const clienteNombre = String(get("cliente", "razon social") ?? "").trim();
    if (!concepto && !clienteNombre) {
      skipped++;
      continue;
    }

    const montoARS = nullableMoney(get("monto ars", "importe ars", "ars"));
    const montoUSD = nullableMoney(get("monto usd", "importe usd", "usd"));
    const cotizacion = nullableMoney(get("cotizacion", "tipo de cambio", "tc"));
    const montoTotalUSD = montoUSD ?? (
      montoARS != null && cotizacion != null && cotizacion > 0 ? montoARS / cotizacion : null
    );
    const nroFactura = String(get("factura", "nro factura", "numero factura") ?? "").trim();

    parsed.push({
      periodKey,
      concepto: concepto || null,
      clienteNombre: clienteNombre || null,
      montoARS: moneyString(montoARS),
      montoUSD: moneyString(montoUSD),
      cotizacion: moneyString(cotizacion),
      montoTotalUSD: moneyString(montoTotalUSD),
      nroFactura: nroFactura || null,
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
    const rawPeriod = get("mes", "periodo", "fecha emision");
    const rowPeriod = parseSheetPeriod(rawPeriod);
    if (rawPeriod && (!rowPeriod || rowPeriod !== periodKey)) {
      skipped++;
      continue;
    }

    const detalle = String(get("detalle", "persona", "proveedor", "nombre") ?? "").trim();
    if (!detalle) {
      skipped++;
      continue;
    }

    const montoARS = nullableMoney(get("monto ars", "importe ars", "ars"));
    const montoUSD = nullableMoney(get("monto usd", "importe usd", "usd"));
    const cotizacion = nullableMoney(get("cotizacion", "tipo de cambio", "tc"));
    const montoTotalUSD = montoUSD ?? (
      montoARS != null && cotizacion != null && cotizacion > 0 ? montoARS / cotizacion : null
    );
    const fechaEmision = parseSheetDate(get("emision", "fecha emision"));

    parsed.push({
      periodKey,
      detalle,
      subtipoCosto: String(get("subtipo", "tipo costo", "subtipo costo") ?? "").trim() || null,
      montoARS: moneyString(montoARS),
      montoUSD: moneyString(montoUSD),
      cotizacion: moneyString(cotizacion),
      montoTotalUSD: moneyString(montoTotalUSD),
      fechaEmision,
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
