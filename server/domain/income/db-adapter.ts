/**
 * 🚀 ADAPTER DB PARA COINCIDIR CON ESPECIFICACIÓN
 * Mapea métodos existentes a la interfaz db esperada
 */

import { storage } from '../../storage';

/**
 * Interfaz db.sales que mapea a métodos existentes
 */
const sales = {
  async getRowsForPeriod(period: string): Promise<any[]> {
    // Usar método existente de GoogleSheetsSales
    return await storage.getGoogleSheetsSales();
  }
};

/**
 * Interfaz db.fx que mapea a métodos existentes  
 */
const fx = {
  async get(period: string): Promise<number | null> {
    // Parsear período "YYYY-MM" a year/month
    const [year, month] = period.split('-').map(Number);
    
    const exchangeRate = await storage.getExchangeRateByMonth(year, month);
    if (exchangeRate?.rate) {
      console.log(`💱 USING BD FX RATE: ${period} = ${exchangeRate.rate}`);
      return Number(exchangeRate.rate);
    }
    
    console.warn(`⚠️ FX RATE NOT FOUND: ${period}`);
    return null;
  }
};

/**
 * Interfaz db.projects que mapea a métodos existentes
 */
const projects = {
  async findByClientAndName(clientName: string, projectName: string): Promise<{id: number} | null> {
    try {
      const projects = await storage.getActiveProjects();
      const project = projects.find((p: any) => 
        p.quotation?.projectName?.toLowerCase().trim() === projectName.toLowerCase().trim() ||
        p.quotation?.clientProjectName?.toLowerCase().trim() === projectName.toLowerCase().trim()
      );
      
      if (project) {
        const client = project.quotation?.client;
        if (client && client.name?.toLowerCase().trim() === clientName.toLowerCase().trim()) {
          return { id: project.id };
        }
      }
      
      return null;
    } catch (error) {
      console.warn(`Error finding project by client/name: ${clientName}/${projectName}:`, error);
      return null;
    }
  }
};

/**
 * Objeto db que coincide con especificación del documento
 */
export const db = {
  sales,
  fx,
  projects
};