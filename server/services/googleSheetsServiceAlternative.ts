import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

interface CostoDirectoIndirecto {
  persona: string;
  mes: string;
  año: number;
  costoDirecto: number;
  costoIndirecto: number;
  costoTotal: number;
  valorHora: number;
  categoria: string;
  proyecto?: string;
}

class GoogleSheetsServiceAlternative {
  private sheets: any;
  private spreadsheetId: string;

  constructor() {
    // ID del spreadsheet desde la URL
    this.spreadsheetId = '1FZLFmTQQOSYQns2cOYlM86UGEH7EHZsJOFegyDR7quc';
    
    try {
      // Usar JWT directamente con las credenciales
      const jwtClient = new JWT({
        email: process.env.GOOGLE_CLIENT_EMAIL,
        key: this.getPrivateKey(),
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });

      this.sheets = google.sheets({ version: 'v4', auth: jwtClient });

      console.log('✅ Alternative Google Sheets service initialized');
    } catch (error) {
      console.error('⚠️ Google Sheets service not available (missing credentials):', (error as Error).message);
      this.sheets = null;
    }
  }

  /**
   * Obtener la clave privada desde las variables de entorno
   */
  private getPrivateKey(): string {
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    
    if (!privateKey) {
      throw new Error('GOOGLE_PRIVATE_KEY environment variable is not set');
    }

    // Limpiar la clave de caracteres de escape de JSON
    return privateKey.replace(/\\n/g, '\n');
  }

  /**
   * Método para probar la conexión
   */
  async testConnection(): Promise<boolean> {
    if (!this.sheets) return false;
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });
      
      console.log('✅ Spreadsheet title:', response.data.properties.title);
      console.log('✅ Available sheets:', response.data.sheets.map((sheet: any) => sheet.properties.title));
      
      return true;
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      return false;
    }
  }

  /**
   * Obtener información del spreadsheet
   */
  async getSpreadsheetInfo(): Promise<any> {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });
      
      return {
        title: response.data.properties.title,
        sheets: response.data.sheets.map((sheet: any) => ({
          title: sheet.properties.title,
          sheetId: sheet.properties.sheetId,
          index: sheet.properties.index
        }))
      };
    } catch (error) {
      console.error('❌ Error getting spreadsheet info:', error);
      throw error;
    }
  }

  /**
   * Obtener datos de costos directos e indirectos del Excel MAESTRO
   */
  async getCostosDirectosIndirectos(): Promise<CostoDirectoIndirecto[]> {
    try {
      const range = 'Costos directos e indirectos!A:Z'; // Rango amplio para capturar toda la data
      
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: range,
        valueRenderOption: 'UNFORMATTED_VALUE', // 🎯 Anti ×100 bug
        dateTimeRenderOption: 'SERIAL_NUMBER',
      });

      const rows = response.data.values;
      
      if (!rows || rows.length === 0) {
        console.log('No data found in the spreadsheet');
        return [];
      }

      // Procesar los datos
      return this.processCostosData(rows);
      
    } catch (error) {
      console.error('Error fetching data from Google Sheets:', error);
      throw new Error(`Failed to fetch costs data: ${error.message}`);
    }
  }

  /**
   * Procesar los datos del Excel y convertirlos a nuestro formato
   */
  private processCostosData(rows: any[][]): CostoDirectoIndirecto[] {
    const result: CostoDirectoIndirecto[] = [];
    
    // Asumiendo que la primera fila son headers
    const headers = rows[0];
    console.log('Headers encontrados:', headers);

    // Mapear las columnas (necesitaremos ajustar esto según la estructura real)
    const columnMap = this.createColumnMap(headers);

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      if (!row || row.length === 0) continue;

      try {
        const costoData: CostoDirectoIndirecto = {
          persona: this.getCellValue(row, columnMap.persona) || '',
          mes: this.getCellValue(row, columnMap.mes) || '',
          año: parseInt(this.getCellValue(row, columnMap.año)) || new Date().getFullYear(),
          costoDirecto: parseFloat(this.getCellValue(row, columnMap.costoDirecto)) || 0,
          costoIndirecto: parseFloat(this.getCellValue(row, columnMap.costoIndirecto)) || 0,
          costoTotal: parseFloat(this.getCellValue(row, columnMap.costoTotal)) || 0,
          valorHora: parseFloat(this.getCellValue(row, columnMap.valorHora)) || 0,
          categoria: this.getCellValue(row, columnMap.categoria) || '',
          proyecto: this.getCellValue(row, columnMap.proyecto) || undefined
        };

        // Solo agregar si tiene datos válidos
        if (costoData.persona && (costoData.costoDirecto > 0 || costoData.costoIndirecto > 0)) {
          result.push(costoData);
        }
      } catch (error) {
        console.warn(`Error processing row ${i}:`, error);
      }
    }

    return result;
  }

  /**
   * Mapear las columnas del Excel a nuestros campos
   */
  private createColumnMap(headers: string[]): Record<string, number> {
    const map: Record<string, number> = {};
    
    headers.forEach((header, index) => {
      const normalizedHeader = header?.toLowerCase().trim();
      
      // Mapear headers comunes (ajustar según el Excel real)
      if (normalizedHeader?.includes('persona') || normalizedHeader?.includes('nombre')) {
        map.persona = index;
      } else if (normalizedHeader?.includes('mes')) {
        map.mes = index;
      } else if (normalizedHeader?.includes('año') || normalizedHeader?.includes('year')) {
        map.año = index;
      } else if (normalizedHeader?.includes('costo directo') || normalizedHeader?.includes('directo')) {
        map.costoDirecto = index;
      } else if (normalizedHeader?.includes('costo indirecto') || normalizedHeader?.includes('indirecto')) {
        map.costoIndirecto = index;
      } else if (normalizedHeader?.includes('costo total') || normalizedHeader?.includes('total')) {
        map.costoTotal = index;
      } else if (normalizedHeader?.includes('valor hora') || normalizedHeader?.includes('hora')) {
        map.valorHora = index;
      } else if (normalizedHeader?.includes('categoria') || normalizedHeader?.includes('categoría')) {
        map.categoria = index;
      } else if (normalizedHeader?.includes('proyecto')) {
        map.proyecto = index;
      }
    });

    console.log('Column mapping:', map);
    return map;
  }

  /**
   * Obtener valor de celda de manera segura
   */
  private getCellValue(row: any[], columnIndex: number): string {
    if (columnIndex === undefined || columnIndex < 0 || columnIndex >= row.length) {
      return '';
    }
    return row[columnIndex]?.toString().trim() || '';
  }
}

export const googleSheetsServiceAlternative = new GoogleSheetsServiceAlternative();
export type { CostoDirectoIndirecto };