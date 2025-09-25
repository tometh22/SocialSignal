/**
 * 🚀 ACCESO A DATOS DESDE SALES (STAGING/DB)
 * Mapea nombres reales a campos lógicos
 */

import { parseNumberEs, isYes } from './parser';
import type { IncomeRow } from './types';
import { storage } from '../../storage';

/**
 * Lee y mapea sales desde el staging/DB para un período
 * Maneja múltiples nombres de columnas (camel/snake/español)
 */
export async function fetchSalesRawForPeriod(period: string): Promise<IncomeRow[]> {
  // Obtener todos los sales records desde Google Sheets Sales
  const rows = await storage.getGoogleSheetsSales();
  
  return rows.map((r: any) => ({
    // Mapeo flexible de nombres de columnas desde GoogleSheetsSales
    clientName:  r.clientName ?? r.Cliente ?? r.client_name ?? '',
    projectName: r.projectName ?? r.Proyecto ?? r.project_name ?? '',
    monthEs:     r.month ?? r.Mes ?? r.month_es ?? '',
    year:        Number(r.year ?? r.Año ?? r.year ?? 0),
    type:        r.type ?? r.Tipo_Venta ?? r.tipo_venta ?? '',
    amountARS:   parseNumberEs(r.amountLocal ?? r.Monto_ARS ?? r.amount_ars ?? 0),
    amountUSD:   parseNumberEs(r.amountUsd ?? r.Monto_USD ?? r.amount_usd ?? 0),
    confirmed:   isYes(r.confirmed ?? r.Confirmado ?? r.confirmado ?? 'No'),
  }));
}

/**
 * Resuelve project ID desde nombre de cliente y proyecto
 * @param clientName Nombre del cliente
 * @param projectName Nombre del proyecto  
 * @returns ID del proyecto o null si no se encuentra
 */
export async function resolveProjectId(clientName: string, projectName: string): Promise<number | null> {
  try {
    // Intentar encontrar proyecto por nombre y cliente desde Active Projects
    const projects = await storage.getActiveProjects();
    const project = projects.find((p: any) => 
      p.quotation?.projectName?.toLowerCase().trim() === projectName.toLowerCase().trim() ||
      p.quotation?.clientProjectName?.toLowerCase().trim() === projectName.toLowerCase().trim()
    );
    
    if (project) {
      // Verificar que el cliente coincida también
      const client = project.quotation?.client;
      if (client && client.name?.toLowerCase().trim() === clientName.toLowerCase().trim()) {
        return project.id;
      }
    }
    
    return null;
  } catch (error) {
    console.warn(`Error resolving project ID for ${clientName}/${projectName}:`, error);
    return null;
  }
}

/**
 * Cuenta proyectos activos totales (para summary)
 */
export async function countActiveProjects(): Promise<number> {
  try {
    const projects = await storage.getActiveProjects();
    return projects.length;
  } catch (error) {
    console.warn('Error counting active projects:', error);
    return 0;
  }
}