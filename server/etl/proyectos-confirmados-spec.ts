/**
 * Contrato de lectura de la solapa "Proyectos confirmados y estimados".
 *
 * Se mantiene aparte del cliente de Google Sheets para que el ETL y los tests
 * puedan importarlo sin arrastrar googleapis.
 */

/**
 * Resuelve las columnas de importe de "Proyectos confirmados y estimados".
 *
 * La solapa tiene TRES headers que contienen "USD":
 *   "Moneda Original USD"     -> vacío en las filas facturadas en pesos
 *   "Monto Total USD"         -> total convertido, presente en TODAS las filas
 *   "Monto Total USD CON IVA" -> bruto
 *
 * Un `findIndex(h => h.includes('usd'))` devuelve la primera, y usarla como
 * importe dejó 66 de 109 filas de income_sot en revenue_usd = 0.
 */
export function resolveIncomeAmountColumns(headers: string[]): {
  monedaUSD: number;
  montoTotalUSD: number;
  cotizacion: number;
} {
  return {
    monedaUSD: headers.findIndex(h => h && /moneda\s+original\s+usd/i.test(h)),
    montoTotalUSD: headers.findIndex(
      h => h && /monto\s+total\s+usd/i.test(h) && !/con\s+iva/i.test(h),
    ),
    cotizacion: headers.findIndex(h => h && h.toLowerCase().includes('cotiza')),
  };
}

/**
 * Clasifica la columna "Pasado/Futuro". Cualquier valor que no sea exactamente
 * "Real" (incluidos los #NUM! de fórmulas rotas) se trata como proyección: es el
 * supuesto conservador, no suma a lo ejecutado.
 */
export function isProjectionRow(pasadoFuturo: string | undefined | null): boolean {
  const normalized = (pasadoFuturo || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  return normalized !== 'real';
}
