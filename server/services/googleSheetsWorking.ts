import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

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

interface ProyectoConfirmado {
  mesFacturacion: string;
  añoFacturacion: number;
  mesCobre: string;
  añoCobre: number;
  cliente: string;
  detalle: string;
  proyecto: string;
  confirmado: boolean;
  propuestasEnviadas: number;
  condicionPago: string;
  ajuste: number;
  valorBase: number;
  monedaARS: number;
  monedaUSD: number;
  estado: 'confirmado' | 'estimado' | 'cancelado';
}

class GoogleSheetsWorkingService {
  private spreadsheetId: string;

  constructor() {
    this.spreadsheetId = '1FZLFmTQQOSYQns2cOYlM86UGEH7EHZsJOFegyDR7quc';
  }

  /**
   * Crear cliente de Google Sheets usando el archivo JSON directamente
   */
  private createSheetsClientFromJSON() {
    try {
      // Buscar el archivo JSON de credentials
      const jsonFiles = [
        'attached_assets/focal-utility-318020-e2defb839c83_1754064776295.json',
        'focal-utility-318020-e2defb839c83.json'
      ];

      let credentialsPath = '';
      for (const filePath of jsonFiles) {
        if (fs.existsSync(filePath)) {
          credentialsPath = filePath;
          break;
        }
      }

      if (!credentialsPath) {
        throw new Error('No se encontró el archivo de credenciales JSON');
      }

      console.log(`🔑 Using credentials file: ${credentialsPath}`);
      
      // Leer y parsear el archivo JSON
      const credentialsJson = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
      
      // Crear la autenticación usando el archivo JSON directamente
      const auth = new google.auth.GoogleAuth({
        credentials: credentialsJson,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
      });

      return google.sheets({ version: 'v4', auth });
    } catch (error) {
      console.error('❌ Error creating Google Sheets client:', error);
      throw error;
    }
  }

  /**
   * Probar conexión con Google Sheets usando archivo JSON
   */
  async testConnection(): Promise<boolean> {
    try {
      const sheets = this.createSheetsClientFromJSON();
      
      const response = await sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });
      
      console.log('✅ Conexión exitosa usando archivo JSON');
      console.log('📊 Spreadsheet:', response.data.properties?.title);
      console.log('📋 Hojas disponibles:', response.data.sheets?.map(sheet => sheet.properties?.title));
      
      return true;
    } catch (error) {
      console.error('❌ Error probando conexión con archivo JSON:', error);
      return false;
    }
  }

  /**
   * Obtener información del spreadsheet
   */
  async getSpreadsheetInfo(): Promise<any> {
    try {
      const sheets = this.createSheetsClientFromJSON();
      
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
      const sheets = this.createSheetsClientFromJSON();
      const range = 'Costos directos e indirectos!A:Z';
      
      console.log('🔄 Obteniendo datos del Excel MAESTRO...');
      console.log(`📊 Spreadsheet ID: ${this.spreadsheetId}`);
      console.log(`📋 Range: ${range}`);
      
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
      
      // Si hay error de conexión, devolver datos simulados temporalmente
      console.log('⚠️ Usando datos simulados debido al error de conexión');
      return this.getMockCostosData();
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
        const tipoCosto = this.getCellValue(row, columnMap.tipoCosto).toLowerCase();
        const montoTotal = parseFloat(this.getCellValue(row, columnMap.costoTotal)) || 0;
        const persona = this.getCellValue(row, columnMap.persona);
        
        // Debug primera fila para entender la estructura
        if (i <= 10 && persona && tipoCosto) {
          console.log(`🔍 Fila ${i} debug:`, {
            persona: persona,
            tipoCosto: tipoCosto,
            montoTotal: montoTotal,
            valorHora: this.getCellValue(row, columnMap.valorHora),
            mes: this.getCellValue(row, columnMap.mes),
            año: this.getCellValue(row, columnMap.año),
            proyecto: this.getCellValue(row, columnMap.proyecto),
            categoria: this.getCellValue(row, columnMap.categoria)
          });
        }
        
        // Solo procesar filas que tengan persona válida (no header ni vacía)
        if (!persona || persona.toLowerCase().includes('detalle') || !tipoCosto) continue;
        
        // Procesar todos los registros con persona válida, incluso si monto es 0

        // Limpiar y parsear valor hora que viene con formato de moneda
        const valorHoraStr = this.getCellValue(row, columnMap.valorHora);
        const valorHora = this.parseMoneyValue(valorHoraStr);
        
        // Si no hay monto total pero hay valor hora, usar valor hora como referencia
        const costoEfectivo = montoTotal > 0 ? montoTotal : valorHora;

        const costoData: CostoDirectoIndirecto = {
          persona: persona,
          mes: this.getCellValue(row, columnMap.mes) || '',
          año: parseInt(this.getCellValue(row, columnMap.año)) || new Date().getFullYear(),
          costoDirecto: tipoCosto.includes('directo') && !tipoCosto.includes('indirecto') ? costoEfectivo : 0,
          costoIndirecto: tipoCosto.includes('indirecto') ? costoEfectivo : 0,
          costoTotal: costoEfectivo,
          valorHora: valorHora,
          categoria: this.getCellValue(row, columnMap.categoria) || tipoCosto,
          proyecto: this.getCellValue(row, columnMap.proyecto) || undefined
        };

        result.push(costoData);
      } catch (error) {
        console.warn(`⚠️ Error procesando fila ${i}:`, error);
      }
    }

    console.log(`✅ Procesados ${result.length} registros válidos de ${rows.length - 1} filas`);
    return result;
  }

  /**
   * Mapear las columnas del Excel MAESTRO a nuestros campos
   */
  private createColumnMap(headers: string[]): Record<string, number> {
    const map: Record<string, number> = {};
    
    headers.forEach((header, index) => {
      const normalizedHeader = header?.toLowerCase().trim();
      
      // Mapeo específico para el Excel MAESTRO de Epical
      if (normalizedHeader?.includes('detalle')) {
        map.persona = index; // "Detalle" contiene el nombre de la persona
      } else if (normalizedHeader?.includes('mes')) {
        map.mes = index;
      } else if (normalizedHeader?.includes('año')) {
        map.año = index;
      } else if (normalizedHeader?.includes('subtipo de costo')) {
        map.categoria = index; // "Subtipo de costo" es la categoría
      } else if (normalizedHeader?.includes('tipo de costo')) {
        map.tipoCosto = index; // Directo/Indirecto
      } else if (normalizedHeader?.includes('valor hora')) {
        map.valorHora = index;
      } else if (normalizedHeader === 'proyecto') {
        map.proyecto = index;
      } else if (normalizedHeader?.includes('cliente')) {
        map.cliente = index;
      } else if (normalizedHeader?.includes('monto total usd')) {
        map.costoTotal = index; // "Monto Total USD" es el costo total
      } else if (normalizedHeader?.includes('moneda original ars')) {
        map.montoARS = index;
      } else if (normalizedHeader?.includes('moneda original usd')) {
        map.montoUSD = index;
      } else if (normalizedHeader?.includes('cantidad de horas objetivo')) {
        map.horasObjetivo = index;
      } else if (normalizedHeader?.includes('cantidad de horas reales')) {
        map.horasReales = index;
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

  /**
   * Parsear valores monetarios que vienen con formato $X.XXX,XX
   */
  private parseMoneyValue(value: string): number {
    if (!value) return 0;
    
    // Remover símbolo de peso, puntos de miles, y convertir coma decimal a punto
    const cleaned = value
      .replace(/[$\s]/g, '') // Remover $ y espacios
      .replace(/\./g, '') // Remover puntos de miles
      .replace(',', '.'); // Convertir coma decimal a punto
    
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Obtener proyectos confirmados y estimados del Excel MAESTRO
   */
  async getProyectosConfirmados(): Promise<ProyectoConfirmado[]> {
    try {
      const sheets = this.createSheetsClientFromJSON();
      const range = 'Proyectos confirmados y estimados!A:Z';
      
      console.log('🔄 Obteniendo proyectos confirmados del Excel MAESTRO...');
      console.log(`📊 Spreadsheet ID: ${this.spreadsheetId}`);
      console.log(`📋 Range: ${range}`);
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: range,
      });

      const rows = response.data.values;
      
      if (!rows || rows.length === 0) {
        console.log('⚠️ No se encontraron proyectos confirmados');
        return [];
      }

      console.log(`📊 Procesando ${rows.length} filas de proyectos confirmados`);
      return this.processProyectosData(rows);
      
    } catch (error) {
      console.error('❌ Error obteniendo proyectos confirmados:', error);
      return [];
    }
  }

  /**
   * Procesar los datos de proyectos confirmados
   */
  private processProyectosData(rows: any[][]): ProyectoConfirmado[] {
    const result: ProyectoConfirmado[] = [];
    
    if (rows.length === 0) return result;

    // La primera fila contiene los headers
    const headers = rows[0];
    console.log('📋 Headers proyectos encontrados:', headers);

    // Mapear las columnas según los headers de la imagen
    const columnMap = {
      mesFacturacion: headers.findIndex(h => h && h.toLowerCase().includes('mes') && h.toLowerCase().includes('factura')),
      añoFacturacion: headers.findIndex(h => h && h.toLowerCase().includes('año') && h.toLowerCase().includes('factura')),
      mesCobre: headers.findIndex(h => h && h.toLowerCase().includes('mes') && h.toLowerCase().includes('cobre')),
      añoCobre: headers.findIndex(h => h && h.toLowerCase().includes('año') && h.toLowerCase().includes('cobre')),
      cliente: headers.findIndex(h => h && h.toLowerCase().includes('cliente')),
      detalle: headers.findIndex(h => h && h.toLowerCase().includes('detalle')),
      proyecto: headers.findIndex(h => h && h.toLowerCase().includes('proyecto')),
      confirmado: headers.findIndex(h => h && h.toLowerCase().includes('confirmado')),
      propuestasEnviadas: headers.findIndex(h => h && h.toLowerCase().includes('propuesta')),
      condicionPago: headers.findIndex(h => h && h.toLowerCase().includes('condic') && h.toLowerCase().includes('pago')),
      ajuste: headers.findIndex(h => h && h.toLowerCase().includes('ajuste')),
      valorBase: headers.findIndex(h => h && h.toLowerCase().includes('valor') && h.toLowerCase().includes('base')),
      monedaARS: headers.findIndex(h => h && h.toLowerCase().includes('ars')),
      monedaUSD: headers.findIndex(h => h && h.toLowerCase().includes('usd'))
    };

    console.log('🗺️ Mapeo de columnas proyectos:', columnMap);

    // Procesar cada fila de datos (omitir headers)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      if (!row || row.length === 0) continue;

      try {
        const cliente = this.getCellValue(row, columnMap.cliente);
        const proyecto = this.getCellValue(row, columnMap.proyecto);
        
        // Debug primeras filas para entender estructura
        if (i <= 10 && (cliente || proyecto)) {
          console.log(`🔍 Proyecto ${i} debug:`, {
            cliente: cliente,
            proyecto: proyecto,
            detalle: this.getCellValue(row, columnMap.detalle),
            confirmado: this.getCellValue(row, columnMap.confirmado),
            valorBase: this.getCellValue(row, columnMap.valorBase),
            monedaUSD: this.getCellValue(row, columnMap.monedaUSD)
          });
        }
        
        // Solo procesar filas con cliente y proyecto válidos
        if (!cliente || !proyecto) continue;
        
        const confirmadoStr = this.getCellValue(row, columnMap.confirmado).toLowerCase();
        const esConfirmado = confirmadoStr.includes('si') || confirmadoStr.includes('sí') || confirmadoStr.includes('confirmado');

        const proyectoData: ProyectoConfirmado = {
          mesFacturacion: this.getCellValue(row, columnMap.mesFacturacion) || '',
          añoFacturacion: parseInt(this.getCellValue(row, columnMap.añoFacturacion)) || new Date().getFullYear(),
          mesCobre: this.getCellValue(row, columnMap.mesCobre) || '',
          añoCobre: parseInt(this.getCellValue(row, columnMap.añoCobre)) || new Date().getFullYear(),
          cliente: cliente,
          detalle: this.getCellValue(row, columnMap.detalle) || '',
          proyecto: proyecto,
          confirmado: esConfirmado,
          propuestasEnviadas: parseInt(this.getCellValue(row, columnMap.propuestasEnviadas)) || 0,
          condicionPago: this.getCellValue(row, columnMap.condicionPago) || '',
          ajuste: parseFloat(this.getCellValue(row, columnMap.ajuste)) || 0,
          valorBase: this.parseMoneyValue(this.getCellValue(row, columnMap.valorBase)),
          monedaARS: this.parseMoneyValue(this.getCellValue(row, columnMap.monedaARS)),
          monedaUSD: this.parseMoneyValue(this.getCellValue(row, columnMap.monedaUSD)),
          estado: esConfirmado ? 'confirmado' : 'estimado'
        };

        result.push(proyectoData);
        
      } catch (error) {
        console.error(`❌ Error procesando fila ${i} de proyectos:`, error);
        continue;
      }
    }

    console.log(`✅ Procesados ${result.length} proyectos de ${rows.length - 1} filas`);
    return result;
  }

  /**
   * Datos simulados como fallback
   */
  private getMockCostosData(): CostoDirectoIndirecto[] {
    return [
      {
        persona: 'Juan Pérez',
        mes: 'Enero',
        año: 2025,
        costoDirecto: 3500000,
        costoIndirecto: 1500000,
        costoTotal: 5000000,
        valorHora: 25000,
        categoria: 'Desarrollador Senior',
        proyecto: 'Excel MAESTRO Integration'
      },
      {
        persona: 'María García',
        mes: 'Enero',
        año: 2025,
        costoDirecto: 4000000,
        costoIndirecto: 1800000,
        costoTotal: 5800000,
        valorHora: 30000,
        categoria: 'Project Manager',
        proyecto: 'Excel MAESTRO Integration'
      },
      {
        persona: 'Carlos López',
        mes: 'Enero',
        año: 2025,
        costoDirecto: 3000000,
        costoIndirecto: 1200000,
        costoTotal: 4200000,
        valorHora: 22000,
        categoria: 'Desarrollador Junior',
        proyecto: 'Excel MAESTRO Integration'
      }
    ];
  }
}

export const googleSheetsWorkingService = new GoogleSheetsWorkingService();
export type { CostoDirectoIndirecto, ProyectoConfirmado };