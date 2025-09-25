/**
 * 🚀 ACCESO A DATOS DESDE SALES (STAGING/DB)
 * Mapea nombres reales a campos lógicos
 */

import { parseNumberEs, parseUSDWithDeflation, parseARSWithDeflation, isYes } from './parser';
import type { IncomeRow } from './types';
import { db } from './db-adapter';

/**
 * Lee y mapea sales desde el staging/DB para un período
 * Maneja múltiples nombres de columnas (camel/snake/español)
 */
export async function fetchSalesRawForPeriod(period: string): Promise<IncomeRow[]> {
  const rows = await db.sales.getRowsForPeriod(period); // o getAll + filtro por periodo
  return rows.map((r: any) => ({
    clientName:  r.clientName ?? r.Cliente ?? '',
    projectName: r.projectName ?? r.Proyecto ?? '',
    monthEs:     r.month ?? r.Mes ?? '',
    year:        Number(r.year ?? r.Año ?? 0),
    type:        r.type ?? r.Tipo_Venta ?? '',
    amountARS:   parseARSWithDeflation(r.amountLocal ?? r.Monto_ARS),
    amountUSD:   parseUSDWithDeflation(r.amountUsd ?? r.Monto_USD),
    confirmed:   isYes(r.confirmed ?? r.Confirmado),
  }));
}

/**
 * Resuelve project ID desde nombre de cliente y proyecto
 * @param clientName Nombre del cliente
 * @param projectName Nombre del proyecto  
 * @returns ID del proyecto o null si no se encuentra
 */
export async function resolveProjectId(clientName: string, projectName: string): Promise<number | null> {
  const row = await db.projects.findByClientAndName(clientName, projectName);
  return row?.id ?? null;
}

/**
 * Cuenta proyectos activos totales (para summary)
 */
export async function countActiveProjects(): Promise<number> {
  try {
    // Para este método mantenemos la lógica existente usando storage directamente
    const { storage } = await import('../../storage');
    const projects = await storage.getActiveProjects();
    return projects.length;
  } catch (error) {
    console.warn('Error counting active projects:', error);
    return 0;
  }
}