// services/sheets.ts - Adapters para Google Sheets DRY

import { googleSheetsWorkingService } from './googleSheetsWorking';

/**
 * Lee filas de una sheet específica
 * Un solo lugar para TODA la lógica de lectura de sheets
 */
export async function readRows(sheetId: string, tab: string, range?: string): Promise<any[]> {
  try {
    const fullRange = range ? `${tab}!${range}` : tab;
    const data = await googleSheetsWorkingService.getSheetValues(sheetId, tab);
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      return [];
    }
    
    // First row is headers, rest is data
    const [headers, ...rows] = data;
    
    // Convert to objects with headers as keys
    return rows.map(row => {
      const obj: any = {};
      headers.forEach((header: string, index: number) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });
    
  } catch (error) {
    console.error(`❌ Error reading sheet ${sheetId}/${tab}:`, error);
    return [];
  }
}