/**
 * Parser para Excel MAESTRO "Costos directos e indirectos"
 * 
 * IMPORTANTE: El Excel NO tiene fila de headers.
 * Todas las filas (incluyendo fila 0) son datos.
 * 
 * Estructura de columnas por índice:
 */

export const COSTO_COLUMN_LAYOUT = {
  persona: 0,           // "Lola Camara"
  rol: 1,               // "Equipo", "Coordinación", etc.
  mes: 2,               // "09 sep"
  año: 3,               // 2025
  tipoGasto: 4,         // "Directo", "Indirecto", "Costos directos e indirectos"
  especificacion: 5,    // Detalles adicionales (a menudo vacío)
  clienteId: 6,         // "PRO-00003250" (ID interno)
  tipoProyecto: 7,      // "Fee", "Proyecto", etc.
  proyecto: 8,          // "Fee Marketing"
  cliente: 9,           // "Warner"
  horasObjetivo: 10,    // Horas target del mes
  horasAsana: 11,       // Horas reales trabajadas
  horasFact: 12,        // Horas billables
  valorHora: 13,        // Valor/hora en moneda local
  costoTotal: 14,       // Costo total en ARS
  _reserved: 15,        // Columna vacía (ignorar)
  tipoCambio: 16,       // FX rate USD/ARS
  montoTotalUSD: 17     // Monto total en USD (columna R)
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
 * Parser que mapea una fila del Excel (array de valores) a un objeto tipado
 * 
 * @param row Array de valores de la fila
 * @param rowIndex Índice de la fila (para logging)
 * @returns Objeto CostoDirectoRowParsed o null si la fila es inválida
 */
export function parseCostoRow(row: any[], rowIndex: number): CostoDirectoRowParsed | null {
  try {
    // Validar longitud mínima (14 columnas para campos esenciales)
    // Columnas 14-17 son opcionales (costoTotal, _reserved, tipoCambio, montoTotalUSD)
    const minLength = 14; // Necesitamos al menos hasta valorHora (índice 13)
    if (row.length < minLength) {
      console.warn(`⚠️ Fila ${rowIndex}: Longitud insuficiente (${row.length} < ${minLength}). Saltando.`);
      return null;
    }
    
    // Extender fila con valores por defecto si es más corta que 18
    const extendedRow = [...row];
    while (extendedRow.length < 18) {
      extendedRow.push(''); // Agregar valores vacíos para columnas faltantes
    }
    
    // Extraer valores usando el layout (usar extendedRow que siempre tiene 18 columnas)
    const persona = String(extendedRow[COSTO_COLUMN_LAYOUT.persona] || '').trim();
    const tipoGasto = String(extendedRow[COSTO_COLUMN_LAYOUT.tipoGasto] || '').trim();
    const año = parseInt(String(extendedRow[COSTO_COLUMN_LAYOUT.año] || 0));
    
    // Validar campos obligatorios
    if (!persona || !tipoGasto || !año) {
      console.warn(`⚠️ Fila ${rowIndex}: Campos obligatorios vacíos (persona="${persona}", tipoGasto="${tipoGasto}", año=${año}). Saltando.`);
      return null;
    }
    
    // Parse valores numéricos con fallback a 0
    const parseNumber = (val: any): number => {
      const num = parseFloat(String(val || 0));
      return isNaN(num) ? 0 : num;
    };
    
    return {
      persona,
      rol: String(extendedRow[COSTO_COLUMN_LAYOUT.rol] || '').trim(),
      mes: String(extendedRow[COSTO_COLUMN_LAYOUT.mes] || '').trim(),
      año,
      tipoGasto,
      especificacion: String(extendedRow[COSTO_COLUMN_LAYOUT.especificacion] || '').trim(),
      clienteId: String(extendedRow[COSTO_COLUMN_LAYOUT.clienteId] || '').trim(),
      tipoProyecto: String(extendedRow[COSTO_COLUMN_LAYOUT.tipoProyecto] || '').trim(),
      proyecto: String(extendedRow[COSTO_COLUMN_LAYOUT.proyecto] || '').trim(),
      cliente: String(extendedRow[COSTO_COLUMN_LAYOUT.cliente] || '').trim(),
      horasObjetivo: parseNumber(extendedRow[COSTO_COLUMN_LAYOUT.horasObjetivo]),
      horasAsana: parseNumber(extendedRow[COSTO_COLUMN_LAYOUT.horasAsana]),
      horasFact: parseNumber(extendedRow[COSTO_COLUMN_LAYOUT.horasFact]),
      valorHora: parseNumber(extendedRow[COSTO_COLUMN_LAYOUT.valorHora]),
      costoTotal: parseNumber(extendedRow[COSTO_COLUMN_LAYOUT.costoTotal]),
      tipoCambio: parseNumber(extendedRow[COSTO_COLUMN_LAYOUT.tipoCambio]),
      montoTotalUSD: parseNumber(extendedRow[COSTO_COLUMN_LAYOUT.montoTotalUSD])
    };
    
  } catch (error) {
    console.error(`❌ Error parseando fila ${rowIndex}:`, error);
    return null;
  }
}

/**
 * Convierte un array de filas del Excel a objetos parseados con nombres estándar
 * Compatible con la interfaz existente `CostoDirectoRow` de sot-etl.ts
 */
export function parseCostosDirectos(rawRows: any[][]): Record<string, any>[] {
  console.log(`📊 [Excel Parser] Parseando ${rawRows.length} filas de costos directos...`);
  
  const parsed: Record<string, any>[] = [];
  let skipped = 0;
  
  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const parsedRow = parseCostoRow(row, i);
    
    if (!parsedRow) {
      skipped++;
      continue;
    }
    
    // Mapear a interfaz compatible con CostoDirectoRow existente
    // Usar nombres de columna que coincidan con lo que espera el ETL
    parsed.push({
      'Persona': parsedRow.persona,
      'Rol': parsedRow.rol,
      'Mes': parsedRow.mes,
      'Año': parsedRow.año,
      'Tipo de Costo': parsedRow.tipoGasto,  // ← CLAVE: Debe ser "Tipo de Costo" para el ETL
      'Especificación': parsedRow.especificacion,
      'Cliente ID': parsedRow.clienteId,
      'Tipo de Proyecto': parsedRow.tipoProyecto,
      'Proyecto': parsedRow.proyecto,
      'Cliente': parsedRow.cliente,
      'Horas Objetivo': parsedRow.horasObjetivo,
      'Horas Reales Asana': parsedRow.horasAsana,
      'Horas para Facturación': parsedRow.horasFact,
      'Valor Hora': parsedRow.valorHora,
      'Costo Total ARS': parsedRow.costoTotal,
      'Tipo de Cambio': parsedRow.tipoCambio,
      'Monto Total USD': parsedRow.montoTotalUSD
    });
  }
  
  console.log(`✅ [Excel Parser] ${parsed.length} filas parseadas exitosamente, ${skipped} saltadas`);
  
  return parsed;
}
