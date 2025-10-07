/**
 * 🚀 ACCESO A DATOS DESDE SALES (STAGING/DB)
 * Mapea nombres reales a campos lógicos
 */

import { parseNumberEs, parseUSDWithDeflation, parseARSWithDeflation, isYes } from './parser';
import type { IncomeRow } from './types';
import { db } from './db-adapter';

/**
 * Convierte número de mes (1-12) a nombre en español
 */
function monthNumberToSpanish(month: number): string {
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return months[month - 1] || '';
}

/**
 * Lee y mapea sales desde el staging/DB para un período
 * Maneja múltiples nombres de columnas (camel/snake/español)
 */
export async function fetchSalesRawForPeriod(period: string): Promise<IncomeRow[]> {
  const rows = await db.sales.getRowsForPeriod(period); // o getAll + filtro por periodo
  
  console.log(`📊 DATA ACCESS DEBUG: Retrieved ${rows.length} rows`);
  if (rows.length > 0) {
    console.log(`📊 DATA ACCESS DEBUG: First row keys:`, Object.keys(rows[0]));
    console.log(`📊 DATA ACCESS DEBUG: First row sample:`, rows[0]);
  }
  
  return rows.map((r: any) => {
    // Extract month and year from monthKey (YYYY-MM format)
    let monthEs = r.month ?? r.Mes ?? '';
    let year = Number(r.year ?? r.Año ?? 0);
    
    // If we have monthKey (income_sot format), extract month and year from it
    const monthKey = r.monthKey ?? r.month_key;
    if (monthKey) {
      console.log(`📊 DATA ACCESS DEBUG: monthKey found = "${monthKey}"`);
      const [yearStr, monthStr] = monthKey.split('-');
      year = parseInt(yearStr);
      const monthNum = parseInt(monthStr);
      monthEs = monthNumberToSpanish(monthNum);
      console.log(`📊 DATA ACCESS DEBUG: Converted to monthEs="${monthEs}", year=${year}`);
    } else {
      console.log(`📊 DATA ACCESS DEBUG: No monthKey found, monthEs="${monthEs}", year=${year}`);
    }
    
    return {
      clientName:  r.clientName ?? r.client_name ?? r.Cliente ?? '',
      projectName: r.projectName ?? r.project_name ?? r.Proyecto ?? '',
      monthEs,
      year,
      type:        r.type ?? r.projectType ?? r.project_type ?? r.Tipo_Venta ?? '',
      amountARS:   parseARSWithDeflation(r.amountLocalArs ?? r.amount_local_ars ?? r.amountLocal ?? r.Monto_ARS),
      amountUSD:   parseUSDWithDeflation(r.amountLocalUsd ?? r.amount_local_usd ?? r.amountUsd ?? r.Monto_USD),
      confirmed:   r.confirmed !== undefined ? Boolean(r.confirmed) : isYes(r.Confirmado),
    };
  });
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