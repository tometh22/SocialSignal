/**
 * Parser para Excel MAESTRO "Costos directos e indirectos"
 * 
 * IMPORTANTE: El Excel NO tiene fila de headers.
 * Todas las filas (incluyendo fila 0) son datos.
 * 
 * Estructura de columnas por índice:
 */

import type { CostoDirectoRow } from './sot-etl.js';

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
    
    // Parsear valores monetarios y horas
    const costoTotal = parseNumber(extendedRow[COSTO_COLUMN_LAYOUT.costoTotal]);
    const montoTotalUSD = parseNumber(extendedRow[COSTO_COLUMN_LAYOUT.montoTotalUSD]);
    const horasObjetivo = parseNumber(extendedRow[COSTO_COLUMN_LAYOUT.horasObjetivo]);
    const valorHora = parseNumber(extendedRow[COSTO_COLUMN_LAYOUT.valorHora]);
    const tipoCambio = parseNumber(extendedRow[COSTO_COLUMN_LAYOUT.tipoCambio]);
    
    // Validar que haya datos válidos para computar costos:
    // Aceptar si: (a) USD>0, (b) ARS>0, o (c) horas>0 con rate/FX válidos
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
      especificacion: String(extendedRow[COSTO_COLUMN_LAYOUT.especificacion] || '').trim(),
      clienteId: String(extendedRow[COSTO_COLUMN_LAYOUT.clienteId] || '').trim(),
      tipoProyecto: String(extendedRow[COSTO_COLUMN_LAYOUT.tipoProyecto] || '').trim(),
      proyecto: String(extendedRow[COSTO_COLUMN_LAYOUT.proyecto] || '').trim(),
      cliente: String(extendedRow[COSTO_COLUMN_LAYOUT.cliente] || '').trim(),
      horasObjetivo,  // Ya parseado arriba con validación
      horasAsana: parseNumber(extendedRow[COSTO_COLUMN_LAYOUT.horasAsana]),
      horasFact: parseNumber(extendedRow[COSTO_COLUMN_LAYOUT.horasFact]),
      valorHora,  // Ya parseado arriba con validación
      costoTotal,  // Ya parseado arriba con validación
      tipoCambio,  // Ya parseado arriba con validación
      montoTotalUSD  // Ya parseado arriba con validación
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
export function parseCostosDirectos(rawRows: any[][]): CostoDirectoRow[] {
  console.log(`📊 [Excel Parser] Parseando ${rawRows.length} filas de costos directos...`);
  
  const parsed: CostoDirectoRow[] = [];
  let skipped = 0;
  
  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const parsedRow = parseCostoRow(row, i);
    
    if (!parsedRow) {
      skipped++;
      continue;
    }
    
    // Mapear a interfaz compatible con CostoDirectoRow existente
    // Usar nombres exactos que espera el ETL (ver server/etl/sot-etl.ts:181-203)
    parsed.push({
      // Campos básicos de identificación
      'Detalle': parsedRow.persona,  // ETL espera "Detalle", no "Persona"
      'Rol': parsedRow.rol,
      'Mes': parsedRow.mes,
      'Año': parsedRow.año,
      'Tipo de Costo': parsedRow.tipoGasto,
      'Tipo de Coste': parsedRow.tipoGasto,  // Variante header
      'Tipo Costo': parsedRow.tipoGasto,  // Variante header
      'Especificación': parsedRow.especificacion,
      'Especificacion': parsedRow.especificacion,  // Variante sin tilde
      
      // Identificadores de cliente y proyecto - INCLUIR TODAS LAS VARIANTES
      'Cliente ID': parsedRow.clienteId,
      'ID Cliente': parsedRow.clienteId,  // Variante invertida
      'Cliente': parsedRow.cliente,
      'Tipo de Proyecto': parsedRow.tipoProyecto,
      'Tipo Proyecto': parsedRow.tipoProyecto,  // Variante sin "de"
      'TipoProyecto': parsedRow.tipoProyecto,  // Variante sin espacios
      'Proyecto': parsedRow.proyecto,
      
      // Horas - usar nombres exactos del ETL
      'Cantidad de horas objetivo': parsedRow.horasObjetivo,
      'Cantidad de horas reales Asana': parsedRow.horasAsana,
      'Cantidad de horas para facturación': parsedRow.horasFact,
      
      // Valores monetarios - incluir TODAS las variantes que el ETL busca
      'Valor hora ARS': parsedRow.valorHora,
      'Valor Hora': parsedRow.valorHora,  // Variante alternativa
      'Total ARS': parsedRow.costoTotal,  // Variante antigua
      'Monto Total ARS': parsedRow.costoTotal,  // Nombre real del Excel
      'Monto Original ARS': parsedRow.costoTotal,  // Columna adicional
      
      // FX y USD - incluir TODAS las variantes
      'Cotización': parsedRow.tipoCambio,
      'Tipo de cambio': parsedRow.tipoCambio,  // Variante alternativa
      'Monto Total USD': parsedRow.montoTotalUSD
    });
  }
  
  console.log(`✅ [Excel Parser] ${parsed.length} filas parseadas exitosamente, ${skipped} saltadas`);
  
  return parsed;
}
