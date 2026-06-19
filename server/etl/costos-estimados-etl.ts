/**
 * ETL - "Costos estimados" sheet
 *
 * Sheet columns (0-indexed):
 *   0  Mes              e.g. "06 jun"
 *   1  Año              e.g. "2025.0"
 *   2  Año Facturación  e.g. "2025"
 *   3  Detalle          person / supplier name
 *   4  Subtipo de costo e.g. "Equipo", "Monotributo", "Equipo - Bono"
 *   5  Puesto           role when subtipo is Equipo or Board
 *   6  Cantidad de horas/Unidades
 *   7  Ajuste proveedor (usually null)
 *   8  Valor Hora
 *   9  Moneda Original ARS
 *  10  Moneda Original USD
 *  11  Cotización       FX rate ARS/USD
 *  12  Monto Total USD
 *  13  Pasado/Futuro
 */

export interface EstimatedCostRow {
  /** "YYYY-MM" */
  monthKey: string;
  /** numeric year */
  year: number;
  /** numeric year for billing (may differ from year) */
  billingYear: number;
  /** person or supplier name */
  detalle: string;
  /** cost sub-type, e.g. "Equipo", "Monotributo", "Equipo - Bono" */
  subtipoCosto: string;
  /** role (only for Equipo / Board rows) */
  puesto: string | null;
  /** hours or units */
  horasUnidades: number | null;
  /** supplier adjustment */
  ajusteProveedor: number | null;
  /** hourly rate in ARS */
  valorHora: number | null;
  /** amount in ARS */
  monedaOriginalArs: number | null;
  /** amount in USD */
  monedaOriginalUsd: number | null;
  /** FX rate ARS/USD used */
  cotizacion: number | null;
  /** total amount in USD */
  montoTotalUsd: number | null;
  /** whether the row is historical or a projection */
  pasadoFuturo: 'Pasado' | 'Futuro' | null;
}

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Parse month from strings like "06 jun", "12 dic", "01 ene".
 * Returns the numeric month (1-12) or null if unparseable.
 */
function parseMonth(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.toString().trim();
  // Try leading numeric part first: "06 jun" → 6
  const numericMatch = trimmed.match(/^(\d{1,2})/);
  if (numericMatch) {
    const n = parseInt(numericMatch[1], 10);
    if (n >= 1 && n <= 12) return n;
  }
  // Fallback: Spanish month name
  const spanishMonths: Record<string, number> = {
    ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
    jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
  };
  const nameMatch = trimmed.toLowerCase().match(/([a-z]{3})/);
  if (nameMatch && spanishMonths[nameMatch[1]]) return spanishMonths[nameMatch[1]];
  return null;
}

function parseNum(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
}

// ─── core parse ─────────────────────────────────────────────────────────────

/**
 * Parse raw 2-D array from Google Sheets into typed EstimatedCostRow objects.
 *
 * @param rawRows  The full 2-D array returned by getSheetValues, including the
 *                 header row as the first element.
 */
export function parseEstimatedCosts(rawRows: any[][]): EstimatedCostRow[] {
  if (!rawRows || rawRows.length === 0) return [];

  // Skip header row (index 0)
  const dataRows = rawRows.slice(1);
  const results: EstimatedCostRow[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row || row.length === 0) continue;

    const mesRaw = row[0];
    const añoRaw = row[1];
    const añoFacturacionRaw = row[2];
    const detalle = row[3] != null ? String(row[3]).trim() : null;
    const subtipoCosto = row[4] != null ? String(row[4]).trim() : null;

    // Skip rows without a detalle (person/supplier)
    if (!detalle) continue;

    const month = parseMonth(mesRaw);
    const year = parseNum(añoRaw);
    if (!month || !year) continue;

    const billingYear = parseNum(añoFacturacionRaw) ?? year;

    const monthKey = `${Math.trunc(year)}-${String(month).padStart(2, '0')}`;

    const pf = row[13] != null ? String(row[13]).trim() : null;

    results.push({
      monthKey,
      year: Math.trunc(year),
      billingYear: Math.trunc(billingYear),
      detalle,
      subtipoCosto: subtipoCosto ?? '',
      puesto: row[5] != null ? String(row[5]).trim() : null,
      horasUnidades: parseNum(row[6]),
      ajusteProveedor: parseNum(row[7]),
      valorHora: parseNum(row[8]),
      monedaOriginalArs: parseNum(row[9]),
      monedaOriginalUsd: parseNum(row[10]),
      cotizacion: parseNum(row[11]),
      montoTotalUsd: parseNum(row[12]),
      pasadoFuturo: pf === 'Pasado' || pf === 'Futuro' ? (pf as 'Pasado' | 'Futuro') : null,
    });
  }

  return results;
}

// ─── ETL write ───────────────────────────────────────────────────────────────

import { db } from '../db.js';
import { factEstimatedCostMonth } from '../../shared/schema.js';
import { inArray } from 'drizzle-orm';

export interface EstimatedCostsETLResult {
  parsed: number;
  inserted: number;
  errors: string[];
}

/**
 * Writes parsed EstimatedCostRow[] to fact_estimated_cost_month.
 * Delete-then-insert per distinct monthKey for idempotency.
 */
export async function runEstimatedCostsETL(
  rows: EstimatedCostRow[]
): Promise<EstimatedCostsETLResult> {
  const errors: string[] = [];

  if (rows.length === 0) return { parsed: 0, inserted: 0, errors };

  const monthKeys = [...new Set(rows.map(r => r.monthKey))];

  try {
    await db.delete(factEstimatedCostMonth)
      .where(inArray(factEstimatedCostMonth.monthKey, monthKeys));

    await db.insert(factEstimatedCostMonth).values(
      rows.map(r => ({
        monthKey: r.monthKey,
        year: r.year,
        billingYear: r.billingYear ?? r.year,
        detalle: r.detalle,
        subtipoCosto: r.subtipoCosto,
        puesto: r.puesto,
        horasUnidades: r.horasUnidades?.toString() ?? null,
        valorHora: r.valorHora?.toString() ?? null,
        monedaOriginalArs: r.monedaOriginalArs?.toString() ?? null,
        monedaOriginalUsd: r.monedaOriginalUsd?.toString() ?? null,
        cotizacion: r.cotizacion?.toString() ?? null,
        montoTotalUsd: r.montoTotalUsd?.toString() ?? null,
        pasadoFuturo: r.pasadoFuturo,
      }))
    );
  } catch (err) {
    errors.push(String(err));
    return { parsed: rows.length, inserted: 0, errors };
  }

  return { parsed: rows.length, inserted: rows.length, errors };
}
