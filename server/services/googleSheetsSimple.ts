import { google } from 'googleapis';

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

class GoogleSheetsSimpleService {
  private spreadsheetId: string;

  constructor() {
    this.spreadsheetId = '1FZLFmTQQOSYQns2cOYlM86UGEH7EHZsJOFegyDR7quc';
  }

  /**
   * Crear cliente de Google Sheets usando variables de entorno
   */
  private createSheetsClient() {
    try {
      // Crear las credenciales desde las variables de entorno
      const credentials = {
        type: 'service_account',
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY,
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID,
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.GOOGLE_CLIENT_EMAIL || '')}`,
        universe_domain: 'googleapis.com'
      };

      // Usar google.auth.fromJSON para evitar problemas con el parsing de la clave
      const auth = google.auth.fromJSON(credentials);
      auth.scopes = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

      return google.sheets({ version: 'v4', auth });
    } catch (error) {
      console.error('❌ Error creating Google Sheets client:', error);
      throw error;
    }
  }

  /**
   * Probar conexión con Google Sheets
   */
  async testConnection(): Promise<boolean> {
    try {
      const sheets = this.createSheetsClient();
      
      const response = await sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });
      
      console.log('✅ Conexión exitosa. Spreadsheet:', response.data.properties?.title);
      console.log('✅ Hojas disponibles:', response.data.sheets?.map(sheet => sheet.properties?.title));
      
      return true;
    } catch (error) {
      console.error('❌ Error probando conexión:', error);
      return false;
    }
  }

  /**
   * Obtener información del spreadsheet
   */
  async getSpreadsheetInfo(): Promise<any> {
    try {
      const sheets = this.createSheetsClient();
      
      const response = await sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });
      
      return {
        title: response.data.properties?.title,
        sheets: response.data.sheets?.map(sheet => ({
          title: sheet.properties?.title,
          sheetId: sheet.properties?.sheetId,
          index: sheet.properties?.index
        })) || []
      };
    } catch (error) {
      console.error('❌ Error obteniendo info del spreadsheet:', error);
      throw error;
    }
  }

  /**
   * Obtener datos de costos directos e indirectos del Excel MAESTRO
   */
  async getCostosDirectosIndirectos(): Promise<CostoDirectoIndirecto[]> {
    try {
      const sheets = this.createSheetsClient();
      const range = 'Costos directos e indirectos!A:Z';
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: range,
      });

      const rows = response.data.values;
      
      if (!rows || rows.length === 0) {
        console.log('⚠️ No se encontraron datos en el spreadsheet');
        return [];
      }

      console.log(`📊 Procesando ${rows.length} filas del Excel MAESTRO`);
      return this.processCostosData(rows);
      
    } catch (error) {
      console.error('❌ Error obteniendo datos de costos:', error);
      throw new Error(`Failed to fetch costs data: ${error.message}`);
    }
  }

  /**
   * Procesar los datos del Excel y convertirlos a nuestro formato
   */
  private processCostosData(rows: any[][]): CostoDirectoIndirecto[] {
    const result: CostoDirectoIndirecto[] = [];
    
    if (rows.length === 0) return result;

    // La primera fila contiene los headers
    const headers = rows[0];
    console.log('📋 Headers encontrados:', headers);

    // Mapear las columnas según los headers
    const columnMap = this.createColumnMap(headers);
    console.log('🗺️ Mapeo de columnas:', columnMap);

    // Procesar cada fila de datos (omitir la primera que son headers)
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

        // Solo agregar registros que tengan datos válidos
        if (costoData.persona && (costoData.costoDirecto > 0 || costoData.costoIndirecto > 0)) {
          result.push(costoData);
        }
      } catch (error) {
        console.warn(`⚠️ Error procesando fila ${i}:`, error);
      }
    }

    console.log(`✅ Procesados ${result.length} registros válidos de ${rows.length - 1} filas`);
    return result;
  }

  /**
   * Mapear las columnas del Excel a nuestros campos
   */
  private createColumnMap(headers: string[]): Record<string, number> {
    const map: Record<string, number> = {};
    
    headers.forEach((header, index) => {
      const normalizedHeader = header?.toLowerCase().trim();
      
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

export const googleSheetsSimpleService = new GoogleSheetsSimpleService();
export type { CostoDirectoIndirecto };