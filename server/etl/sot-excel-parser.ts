/**
 * Parser para Excel MAESTRO "Costos directos e indirectos"
 *
 * Soporta dos layouts detectados automáticamente:
 *
 * OLD (pre-"Año Facturación"):
 *   col 3 = año, col 4 = tipoGasto, col 5 = especificacion, col 6 = clienteId
 *
 * NEW (con columna extra "Año Facturación" en col 3):
 *   col 3 = añoFacturacion (ignorar), col 4 = año, col 5 = tipoGasto, col 6 = especificacion
 *   cols 7-17 idénticos en ambos layouts
 */

import type { CostoDirectoRow } from './sot-etl.js';

export const COSTO_COLUMN_LAYOUT = {
  persona: 0,
  rol: 1,
  mes: 2,
  // cols 3-6 varían por layout — ver detectColumnOffset()
  tipoProyecto: 7,
  proyecto: 8,
  cliente: 9,
  horasObjetivo: 10,
  horasAsana: 11,
  horasFact: 12,
  valorHora: 13,
  costoTotal: 14,
  _reserved: 15,
  tipoCambio: 16,
  montoTotalUSD: 17,
} as const;

export interface CostoDirectoRowParsed {
  persona: string;
  rol: string;
  mes: string;
  año: number;
  tipoGasto: string;
  especificacion: string;
  clienteId: string;
  tipoProyecto: string;
  proyecto: string;
  cliente: string;
  horasObjetivo: number;
  horasAsana: number;
  horasFact: number;
  valorHora: number;
  costoTotal: number;
  tipoCambio: number;
  montoTotalUSD: number;
}

/**
 * Detects whether the sheet has the extra "Año Facturación" column inserted at col 3.
 *
 * OLD layout: col 3 = year number, col 4 = tipo string  → offset 0
 * NEW layout: col 4 = year number, col 5 = tipo string  → offset 1
 */
function detectColumnOffset(rawRows: any[][]): number {
  const TIPO_KEYWORDS = ['directo', 'indirecto', 'costo'];
  const isYear = (v: any) => typeof v === 'number' && v >= 2020 && v <= 2035;
  const isTipo = (v: any) => {
    const s = String(v ?? '').toLowerCase().trim();
    return TIPO_KEYWORDS.some((k) => s.includes(k));
  };

  for (const row of rawRows.slice(0, 20)) {
    if (!row || row.length < 6) continue;
    // NEW: col4 = year AND col5 = tipo
    if (isYear(row[4]) && isTipo(row[5])) return 1;
    // OLD: col3 = year AND col4 = tipo
    if (isYear(row[3]) && isTipo(row[4])) return 0;
  }
  return 0;
}

/**
 * Parses a single Excel row into a typed object.
 * @param offset 0 for old layout, 1 for new layout (extra "Año Facturación" col)
 */
export function parseCostoRow(
  row: any[],
  rowIndex: number,
  offset = 0,
): CostoDirectoRowParsed | null {
  try {
    const minLength = 14 + offset;
    if (row.length < minLength) {
      console.warn(`⚠️ Fila ${rowIndex}: Longitud insuficiente (${row.length} < ${minLength}). Saltando.`);
      return null;
    }

    const extendedRow = [...row];
    while (extendedRow.length < 18 + offset) extendedRow.push('');

    const persona = String(extendedRow[0] || '').trim();
    const año = parseInt(String(extendedRow[3 + offset] || 0));
    const tipoGasto = String(extendedRow[4 + offset] || '').trim();

    if (!persona || !tipoGasto || !año) {
      console.warn(
        `⚠️ Fila ${rowIndex}: Campos obligatorios vacíos (persona="${persona}", tipoGasto="${tipoGasto}", año=${año}). Saltando.`,
      );
      return null;
    }

    const parseNumber = (val: any): number => {
      const num = parseFloat(String(val || 0));
      return isNaN(num) ? 0 : num;
    };

    const costoTotal = parseNumber(extendedRow[COSTO_COLUMN_LAYOUT.costoTotal]);
    const montoTotalUSD = parseNumber(extendedRow[COSTO_COLUMN_LAYOUT.montoTotalUSD]);
    const horasObjetivo = parseNumber(extendedRow[COSTO_COLUMN_LAYOUT.horasObjetivo]);
    const valorHora = parseNumber(extendedRow[COSTO_COLUMN_LAYOUT.valorHora]);
    const tipoCambio = parseNumber(extendedRow[COSTO_COLUMN_LAYOUT.tipoCambio]);

    const hasValidMonetary = costoTotal > 0 || montoTotalUSD > 0;
    const hasValidHourly = horasObjetivo > 0 && (valorHora > 0 || tipoCambio > 0);

    if (!hasValidMonetary && !hasValidHourly) {
      console.warn(`⚠️ Fila ${rowIndex}: Sin datos válidos para computar costos. Saltando.`);
      return null;
    }

    return {
      persona,
      rol: String(extendedRow[COSTO_COLUMN_LAYOUT.rol] || '').trim(),
      mes: String(extendedRow[COSTO_COLUMN_LAYOUT.mes] || '').trim(),
      año,
      tipoGasto,
      especificacion: String(extendedRow[5 + offset] || '').trim(),
      // clienteId existed in old layout at col 6; in new layout col 6 = especificacion
      clienteId: offset === 0 ? String(extendedRow[6] || '').trim() : '',
      tipoProyecto: String(extendedRow[COSTO_COLUMN_LAYOUT.tipoProyecto] || '').trim(),
      proyecto: String(extendedRow[COSTO_COLUMN_LAYOUT.proyecto] || '').trim(),
      cliente: String(extendedRow[COSTO_COLUMN_LAYOUT.cliente] || '').trim(),
      horasObjetivo,
      horasAsana: parseNumber(extendedRow[COSTO_COLUMN_LAYOUT.horasAsana]),
      horasFact: parseNumber(extendedRow[COSTO_COLUMN_LAYOUT.horasFact]),
      valorHora,
      costoTotal,
      tipoCambio,
      montoTotalUSD,
    };
  } catch (error) {
    console.error(`❌ Error parseando fila ${rowIndex}:`, error);
    return null;
  }
}

/**
 * Converts a 2D array of raw Google Sheets rows into typed CostoDirectoRow objects.
 * Auto-detects OLD vs NEW column layout.
 */
export function parseCostosDirectos(rawRows: any[][]): CostoDirectoRow[] {
  const offset = detectColumnOffset(rawRows);
  console.log(
    `📊 [Excel Parser] Parseando ${rawRows.length} filas — layout ${offset === 1 ? 'NEW (+1 offset, col "Año Facturación" detectada)' : 'OLD (sin offset)'}`,
  );

  const parsed: CostoDirectoRow[] = [];
  let skipped = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const parsedRow = parseCostoRow(row, i, offset);

    if (!parsedRow) {
      skipped++;
      continue;
    }

    parsed.push({
      'Detalle': parsedRow.persona,
      'Rol': parsedRow.rol,
      'Mes': parsedRow.mes,
      'Año': parsedRow.año,
      'Tipo de Costo': parsedRow.tipoGasto,
      'Tipo de Coste': parsedRow.tipoGasto,
      'Tipo Costo': parsedRow.tipoGasto,
      'Especificación': parsedRow.especificacion,
      'Especificacion': parsedRow.especificacion,
      'Cliente ID': parsedRow.clienteId,
      'ID Cliente': parsedRow.clienteId,
      'Cliente': parsedRow.cliente,
      'Tipo de Proyecto': parsedRow.tipoProyecto,
      'Tipo Proyecto': parsedRow.tipoProyecto,
      'TipoProyecto': parsedRow.tipoProyecto,
      'Proyecto': parsedRow.proyecto,
      'Cantidad de horas objetivo': parsedRow.horasObjetivo,
      'Cantidad de horas reales Asana': parsedRow.horasAsana,
      'Cantidad de horas para facturación': parsedRow.horasFact,
      'Valor hora ARS': parsedRow.valorHora,
      'Valor Hora': parsedRow.valorHora,
      'Total ARS': parsedRow.costoTotal,
      'Monto Total ARS': parsedRow.costoTotal,
      'Monto Original ARS': parsedRow.costoTotal,
      'Cotización': parsedRow.tipoCambio,
      'Tipo de cambio': parsedRow.tipoCambio,
      'Monto Total USD': parsedRow.montoTotalUSD,
    } as CostoDirectoRow);
  }

  console.log(`✅ [Excel Parser] ${parsed.length} filas parseadas exitosamente, ${skipped} saltadas`);
  return parsed;
}
