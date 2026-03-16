import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { parseDec } from '../../shared/parse-utils';
import { buildPeriod, normalizeMonth } from '../../shared/utils/dateNormalization';
import { parseMoneySmart } from '../utils/money';

interface CostoDirectoIndirecto {
  persona: string;
  mes: string;
  año: number;
  costoDirecto: number;
  costoIndirecto: number;
  costoTotal: number;
  valorHora: number;
  categoria: string;
  tipoCosto?: string; // directo/indirecto flag
  cliente?: string; // client name for direct costs
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
  pasadoFuturo?: string; // "Real", "Estimado", "Futuro"
  propuestasEnviadas: number;
  condicionPago: string;
  ajuste: number;
  valorBase: number;
  monedaARS: number;
  monedaUSD: number;
  estado: 'confirmado' | 'estimado' | 'cancelado';
}

interface TipoCambio {
  mes: string;
  año?: number;
  tipoCambio: number;
  fuente: string;
}

interface VentaTomi {
  cliente: string;
  proyecto: string;
  mes: string;
  año: number;
  montoUSD: number;     // Cambiado de monto_usd para consistencia
  montoARS: number;     // Cambiado de monto_ars para consistencia
  tipoVenta: string;    // Cambiado de tipo_venta para consistencia
  confirmado: string;
  projectId: number;    // Nuevo: ID del proyecto resuelto por alias map
  canonicalKey: string; // Nuevo: clave cliente::proyecto normalizada
  rowHash: string;      // Nuevo: hash para deduplicación
}

interface CostoDirectoExcel {
  persona: string;
  rol?: string; // 🆕 Rol de la persona
  mes: string;
  año: number;
  tipoGasto: string;
  especificacion: string;
  proyecto: string;
  tipoProyecto: string;
  cliente: string;
  horasObjetivo?: number; // Columna K: Cantidad de horas objetivo
  horasRealesAsana: number; // Columna L: Cantidad de horas reales Asana
  horasParaFacturacion?: number; // Columna M: Cantidad de horas para facturación - NUEVO
  valorHoraPersona?: number;
  costoTotal?: number;
  tipoCambio?: number; // Columna P del Excel
  montoTotalUSD?: number; // Columna Q del Excel
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
      console.warn('⚠️ Google Sheets credentials missing or invalid. Sheets functionality will be unavailable:', (error as Error).message);
      return null;
    }
  }

  /**
   * 🛡️ GUARD ETL: Sanitizar USD corrupto antes de guardar en DB
   * Previene: astronómicos, USD=ARS cuando nativeCurrency='ARS', desviaciones FX extremas
   * 🔍 FIX: Permite USD-only rows (cuando costoARS es null o nativeCurrency='USD')
   */
  private sanitizeUSD(input: {
    nativeCurrency: 'ARS' | 'USD';
    costoARS?: number | null;
    montoUSD?: number | null;
    fx?: number | null;
  }): number | null {
    const { nativeCurrency, costoARS, montoUSD, fx } = input;
    
    if (!montoUSD || montoUSD === 0) return null;

    // 🔍 FIX: Permitir USD-only rows (cuando no hay costoARS o nativeCurrency='USD')
    // Solo aplicar guards USD==ARS y coherencia FX cuando hay costoARS válido
    const hasValidARS = costoARS && costoARS > 0;

    // 1) Prohibir USD == ARS SOLO cuando moneda nativa es ARS Y hay costoARS válido
    if (nativeCurrency === 'ARS' && hasValidARS) {
      const diff = Math.abs(montoUSD - costoARS);
      const tolerance = 0.01 * Math.max(1, costoARS);
      if (diff <= tolerance) {
        console.log(`🛡️ GUARD ETL: USD==ARS detectado (${montoUSD}), descartando USD`);
        return null;
      }
    }

    // 2) Cortar astronómicos o valores no finitos
    if (!Number.isFinite(montoUSD) || montoUSD > 1_000_000) {
      console.log(`🛡️ GUARD ETL: USD astronómico detectado (${montoUSD}), descartando`);
      return null;
    }

    // 3) Verificar coherencia FX SOLO cuando hay ARS válido
    if (hasValidARS && fx && fx > 0) {
      const impliedUSD = costoARS / fx;
      const diffPct = Math.abs(montoUSD - impliedUSD) / Math.max(1, impliedUSD) * 100;
      if (diffPct > 200) {
        console.log(`🛡️ GUARD ETL: Desviación FX extrema (${diffPct.toFixed(0)}%), descartando USD`);
        return null;
      }
    }

    return montoUSD;
  }

  /**
   * Probar conexión con Google Sheets usando archivo JSON
   */
  async testConnection(): Promise<boolean> {
    try {
      const sheets = this.createSheetsClientFromJSON();
      if (!sheets) {
        console.warn('⚠️ Google Sheets client not available');
        return false;
      }

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
      if (!sheets) {
        console.warn('⚠️ Google Sheets client not available');
        return { title: 'Unavailable', sheets: [] };
      }

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
   * Obtener datos raw 2D de cualquier hoja (para uso con índices numéricos)
   */
  async getSheetValues(
    spreadsheetId: string,
    sheetName: string,
    options?: {
      valueRenderOption?: 'FORMATTED_VALUE' | 'UNFORMATTED_VALUE' | 'FORMULA';
      dateTimeRenderOption?: 'SERIAL_NUMBER' | 'FORMATTED_STRING';
    }
  ): Promise<any[][]> {
    try {
      const sheets = this.createSheetsClientFromJSON();
      if (!sheets) {
        console.warn('⚠️ Google Sheets client not available, returning empty sheet data');
        return [];
      }
      const range = `'${sheetName}'!A:Z`;

      console.log(`🔄 Obteniendo datos raw 2D de ${sheetName}...`);
      console.log(`📊 Spreadsheet ID: ${spreadsheetId}`);
      console.log(`📋 Range: ${range}`);
      if (options) {
        console.log(`⚙️ Options: valueRenderOption=${options.valueRenderOption}, dateTimeRenderOption=${options.dateTimeRenderOption}`);
      }
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: range,
        ...(options?.valueRenderOption && { valueRenderOption: options.valueRenderOption }),
        ...(options?.dateTimeRenderOption && { dateTimeRenderOption: options.dateTimeRenderOption }),
      });

      const rows = response.data.values;
      
      if (!rows || rows.length === 0) {
        console.log('⚠️ No se encontraron datos raw en la hoja');
        return [];
      }

      console.log(`📊 Procesados ${rows.length} filas raw 2D`);
      return rows as any[][];
      
    } catch (error) {
      console.error('❌ Error obteniendo datos raw 2D:', error);
      throw error;
    }
  }

  /**
   * Obtener datos de costos directos e indirectos del Excel MAESTRO
   * NUEVO: Devuelve RawCostRecord[] directamente con nombres de columnas del Excel
   * para que el parser pueda procesarlos correctamente
   */
  async getCostosDirectosIndirectos(): Promise<any[]> {
    try {
      const sheets = this.createSheetsClientFromJSON();
      if (!sheets) {
        console.warn('⚠️ Google Sheets client not available, returning empty costos data');
        return [];
      }
      const range = 'Costos directos e indirectos!A:Z';

      console.log('🔄 Obteniendo datos RAW del Excel MAESTRO (FORMATTED_VALUE)...');
      console.log(`📊 Spreadsheet ID: ${this.spreadsheetId}`);
      console.log(`📋 Range: ${range}`);
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: range,
        valueRenderOption: 'FORMATTED_VALUE', // ✅ Fix: Prevents ARS inflation (10^14-10^16)
        dateTimeRenderOption: 'SERIAL_NUMBER',
      });

      const rows = response.data.values;
      
      if (!rows || rows.length === 0) {
        console.log('⚠️ No se encontraron datos en el spreadsheet');
        return [];
      }

      console.log(`📊 Procesando ${rows.length} filas del Excel MAESTRO`);
      
      // ✅ NUEVO: Devolver raw records con nombres de columnas exactos del Excel
      // El parser los procesará usando COLUMN_MAPPINGS
      return this.convertToRawRecords(rows);
      
    } catch (error) {
      console.error('❌ Error obteniendo datos de costos:', error);
      throw error; // No usar mock data en producción
    }
  }

  /**
   * NUEVO: Convertir filas raw del Excel a objetos RawCostRecord con nombres de columnas exactos
   * ✅ FIX: Normalizar headers para eliminar espacios trailing y caracteres Unicode no visibles
   * Esto permite que el parser use COLUMN_MAPPINGS para mapear flexiblemente
   */
  private convertToRawRecords(rows: any[][]): any[] {
    if (rows.length === 0) return [];

    // La primera fila contiene los headers (nombres exactos del Excel)
    const rawHeaders = rows[0];
    
    // 🔍 DEBUG CRÍTICO: Inspeccionar headers raw para identificar caracteres invisibles
    console.log(`🔍 DEBUG: Total headers RAW: ${rawHeaders.length}`);
    rawHeaders.forEach((h: string, idx: number) => {
      if (h && (h.includes('Tipo') || h.includes('Gasto') || h.includes('Costo'))) {
        const charCodes = Array.from(h).map(char => `${char}(${char.charCodeAt(0)})`).join(' ');
        console.log(`🔍 DEBUG Header[${idx}] RAW: "${h}"`);
        console.log(`🔍 DEBUG Header[${idx}] CHARS: ${charCodes}`);
        console.log(`🔍 DEBUG Header[${idx}] JSON: ${JSON.stringify(h)}`);
      }
    });
    
    // ✅ CRÍTICO: Normalizar headers - eliminar espacios trailing y normalizar Unicode
    // Esto previene fallos de mapeo causados por espacios/non-breaking spaces invisibles
    const headers = rawHeaders.map((h: string) => 
      h ? h.normalize('NFKC').trim() : ''
    );
    
    // 🔍 DEBUG: Verificar headers normalizados
    headers.forEach((h: string, idx: number) => {
      if (h && (h.includes('Tipo') || h.includes('Gasto') || h.includes('Costo'))) {
        console.log(`✅ Header[${idx}] NORMALIZED: "${h}"`);
      }
    });
    
    const result: any[] = [];

    console.log(`📋 Headers normalizados (primeros 15): ${headers.slice(0, 15).join(' | ')}...`);
    console.log(`🔍 Total headers encontrados: ${headers.length}`);

    // Procesar cada fila de datos (omitir la primera que son headers)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      if (!row || row.length === 0) continue;

      // Crear objeto con nombres de columnas normalizados del Excel
      const record: any = {};
      
      headers.forEach((header, index) => {
        if (header && row[index] !== undefined && row[index] !== null && row[index] !== '') {
          record[header] = row[index];
        }
      });

      // Solo agregar si tiene al menos un campo (no fila vacía)
      if (Object.keys(record).length > 0) {
        result.push(record);
      }
    }

    console.log(`✅ Convertidos ${result.length} registros raw con headers normalizados`);
    
    // Debug: mostrar headers de un registro de muestra para verificar mapeo
    if (result.length > 0) {
      const sampleKeys = Object.keys(result[0]);
      console.log(`🔍 Headers en primer registro (total ${sampleKeys.length}): ${sampleKeys.slice(0, 15).join(' | ')}...`);
    }
    
    return result;
  }

  /**
   * Normalizar registro de costo antes de devolver al parser
   * - Garantiza campos canónicos: cliente, proyecto, tipoCosto
   * - Aplica fallback de categoria→tipoCosto para datos legacy
   */
  private normalizeCostRow(row: CostoDirectoIndirecto): CostoDirectoIndirecto {
    const normalized = { ...row };
    
    // 1. Fallback categoria→tipoCosto para datos legacy sin "Tipo de Costo"
    if (!normalized.tipoCosto || normalized.tipoCosto.trim() === '') {
      const categoria = (normalized.categoria || '').toLowerCase().trim();
      
      // Mapeo determinístico: categorías directas vs indirectas
      const directCategories = ['equipo', 'honorarios', 'servicios', 'fee'];
      const indirectCategories = ['tarjeta', 'gastos generales', 'gastos varios', 'subscripciones'];
      
      if (directCategories.some(cat => categoria.includes(cat))) {
        normalized.tipoCosto = 'directo';
      } else if (indirectCategories.some(cat => categoria.includes(cat))) {
        normalized.tipoCosto = 'indirecto';
      } else {
        // Default conservador: tratar como indirecto si no sabemos
        normalized.tipoCosto = 'indirecto';
      }
    }
    
    // 2. Normalizar campos cliente/proyecto (ya están en formato correcto desde createColumnMap)
    // No se necesita transformación adicional - ya mapeamos las columnas correctas
    
    return normalized;
  }

  /**
   * Procesar los datos del Excel y convertirlos a nuestro formato
   */
  private processCostosData(rows: any[][]): CostoDirectoIndirecto[] {
    const result: CostoDirectoIndirecto[] = [];
    
    if (rows.length === 0) return result;

    // La primera fila contiene los headers
    const headers = rows[0];

    // Mapear las columnas según los headers
    const columnMap = this.createColumnMap(headers);

    // Procesar cada fila de datos (omitir la primera que son headers)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      if (!row || row.length === 0) continue;

      try {
        const tipoCosto = this.getCellValue(row, columnMap.tipoCosto).toLowerCase();
        const montoTotal = this.parseMoneyValue(this.getCellValue(row, columnMap.costoTotal)) || 0;
        const persona = this.getCellValue(row, columnMap.persona);
        
        // Solo procesar filas que tengan persona válida (no header ni vacía)
        if (!persona || persona.toLowerCase().includes('detalle')) continue;
        
        // Limpiar y parsear valor hora que viene con formato de moneda
        const valorHoraStr = this.getCellValue(row, columnMap.valorHora);
        const valorHora = this.parseMoneyValue(valorHoraStr);
        
        // Si no hay monto total pero hay valor hora, usar valor hora como referencia
        const costoEfectivo = montoTotal > 0 ? montoTotal : valorHora;

        const costoData: CostoDirectoIndirecto = {
          persona: persona,
          mes: this.getCellValue(row, columnMap.mes) || '',
          año: parseDec(this.getCellValue(row, columnMap.año)) || new Date().getFullYear(),
          costoDirecto: tipoCosto.includes('directo') && !tipoCosto.includes('indirecto') ? costoEfectivo : 0,
          costoIndirecto: tipoCosto.includes('indirecto') ? costoEfectivo : 0,
          costoTotal: costoEfectivo,
          valorHora: valorHora,
          categoria: this.getCellValue(row, columnMap.categoria) || tipoCosto,
          tipoCosto: tipoCosto,
          cliente: this.getCellValue(row, columnMap.cliente) || undefined,
          proyecto: this.getCellValue(row, columnMap.proyecto) || undefined
        };

        // Normalizar registro antes de agregar (aplica fallbacks para datos legacy)
        const normalized = this.normalizeCostRow(costoData);
        result.push(normalized);
      } catch (error) {
        console.warn(`⚠️ Error procesando fila ${i}:`, error);
      }
    }

    return result;
  }

  /**
   * Mapear las columnas EXACTAS del Excel MAESTRO a nuestros campos
   */
  private createColumnMap(headers: string[]): Record<string, number> {
    const map: Record<string, number> = {};
    
    headers.forEach((header, index) => {
      // Mapeo EXACTO basado en las columnas reales del Excel MAESTRO
      if (header === 'Detalle') {
        map.persona = index; // A: Nombre de la persona
      } else if (header === 'Rol') {
        map.rol = index; // Rol de la persona
      } else if (header === 'Mes') {
        map.mes = index; // C: Mes
      } else if (header === 'Año') {
        map.año = index; // D: Año
      } else if (header === 'Subtipo de costo') {
        map.categoria = index; // B: Categoría del gasto
      } else if (header === 'Tipo de Costo') {
        map.tipoCosto = index; // E: Directo/Indirecto
      } else if (header === 'Valor Hora') {
        map.valorHora = index; // N: Tarifa horaria
      } else if (header === 'Proyecto') {
        map.proyecto = index; // I: Nombre del proyecto
      } else if (header === 'Cliente') {
        map.cliente = index; // J: Nombre del cliente
      } else if (header === 'Monto Total USD') {
        map.costoTotal = index; // R: Costo total en USD
      } else if (header === 'Moneda Original ARS') {
        map.montoARS = index; // O: Monto en pesos
      } else if (header === 'Moneda Original USD') {
        map.montoUSD = index; // P: Monto en dólares
      } else if (header === 'Cantidad de horas objetivo') {
        map.horasObjetivo = index; // K: Horas estimadas
      } else if (header === 'Cantidad de horas reales Asana') {
        map.horasReales = index; // L: Horas reales trabajadas
      } else if (header === 'Cotización') {
        map.tipoCambio = index; // Q: Tipo de cambio USD/ARS
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
   * Parsear valores monetarios usando parseMoneySmart - robusto para US/ES locales
   * FIXED: Maneja "$29,230.00" → 29230, "29.230,00" → 29230, "$8,450" → 8450
   */
  private parseMoneyValue(value: string): number {
    return parseMoneySmart(value);
  }

  /**
   * Obtener proyectos confirmados y estimados del Excel MAESTRO
   */
  async getProyectosConfirmados(): Promise<ProyectoConfirmado[]> {
    try {
      const sheets = this.createSheetsClientFromJSON();
      if (!sheets) {
        console.warn('⚠️ Google Sheets client not available, returning empty proyectos data');
        return [];
      }
      const range = 'Proyectos confirmados y estimados!A:Z';

      console.log('🔄 Obteniendo proyectos confirmados del Excel MAESTRO...');
      console.log(`📊 Spreadsheet ID: ${this.spreadsheetId}`);
      console.log(`📋 Range: ${range}`);
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: range,
        valueRenderOption: 'FORMATTED_VALUE', // ✅ Fix: Prevents ARS inflation (10^14-10^16)
        dateTimeRenderOption: 'SERIAL_NUMBER',
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
      pasadoFuturo: headers.findIndex(h => h && h.toLowerCase().includes('pasado') && h.toLowerCase().includes('futuro')),
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
        
        // Debug TODAS las filas de Warner para análisis preciso
        if (cliente && cliente.toLowerCase().includes('warner') && proyecto && proyecto.toLowerCase().includes('fee')) {
          console.log(`🔍 Warner Fila ${i} DETALLE:`, {
            fila: i,
            mesFacturacion: this.getCellValue(row, columnMap.mesFacturacion),
            añoFacturacion: this.getCellValue(row, columnMap.añoFacturacion),
            cliente: cliente,
            proyecto: proyecto,
            detalle: this.getCellValue(row, columnMap.detalle),
            confirmado: this.getCellValue(row, columnMap.confirmado),
            pasadoFuturo: this.getCellValue(row, columnMap.pasadoFuturo), // DEBUG
            valorBase: this.getCellValue(row, columnMap.valorBase),
            monedaUSD: this.getCellValue(row, columnMap.monedaUSD),
            rawRowLength: row.length, // DEBUG
            col21Value: row[21] // DEBUG: valor directo de columna 21
          });
        }
        
        // Solo procesar filas con cliente y proyecto válidos
        if (!cliente || !proyecto) continue;
        
        const confirmadoStr = this.getCellValue(row, columnMap.confirmado).toLowerCase();
        const esConfirmado = confirmadoStr.includes('si') || confirmadoStr.includes('sí') || confirmadoStr.includes('confirmado');

        const proyectoData: ProyectoConfirmado = {
          mesFacturacion: this.getCellValue(row, columnMap.mesFacturacion) || '',
          añoFacturacion: parseDec(this.getCellValue(row, columnMap.añoFacturacion)) || new Date().getFullYear(),
          mesCobre: this.getCellValue(row, columnMap.mesCobre) || '',
          añoCobre: parseDec(this.getCellValue(row, columnMap.añoCobre)) || new Date().getFullYear(),
          cliente: cliente,
          detalle: this.getCellValue(row, columnMap.detalle) || '',
          proyecto: proyecto,
          confirmado: esConfirmado,
          pasadoFuturo: this.getCellValue(row, columnMap.pasadoFuturo) || '',
          propuestasEnviadas: parseDec(this.getCellValue(row, columnMap.propuestasEnviadas)) || 0,
          condicionPago: this.getCellValue(row, columnMap.condicionPago) || '',
          ajuste: parseDec(this.getCellValue(row, columnMap.ajuste)) || 0,
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
   * Generar ingresos mensuales automáticamente basándose en datos del Excel
   * Procesa las columnas S (facturación) y C (cobranza) para crear registros de ingresos
   */
  async generateMonthlyRevenuesFromExcel(storage: any): Promise<{ success: boolean; revenuesCreated: number; errors: string[] }> {
    console.log('🤖 Generando ingresos mensuales automáticamente desde Excel...');
    
    try {
      // Obtener proyectos confirmados del Excel
      const proyectosConfirmados = await this.getProyectosConfirmados();
      const proyectosFee = proyectosConfirmados.filter(p => 
        p.confirmado && 
        p.proyecto && 
        p.cliente &&
        (p.monedaUSD > 0 || p.monedaARS > 0)
      );
      
      console.log(`📊 Encontrados ${proyectosFee.length} proyectos fee confirmados en el Excel`);
      
      let revenuesCreated = 0;
      const errors: string[] = [];
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      
      for (const proyecto of proyectosFee) {
        try {
          // Buscar el proyecto activo correspondiente
          const activeProjects = await storage.getActiveProjects();
          const matchingProject = activeProjects.find((ap: any) => 
            ap.quotation?.projectName?.toLowerCase().includes(proyecto.proyecto.toLowerCase()) ||
            proyecto.proyecto.toLowerCase().includes(ap.quotation?.projectName?.toLowerCase())
          );
          
          if (!matchingProject) {
            errors.push(`Proyecto activo no encontrado para: ${proyecto.proyecto}`);
            continue;
          }
          
          console.log(`💰 Procesando ingresos para proyecto: ${proyecto.proyecto} (ID: ${matchingProject.id})`);
          
          // Determinar período de facturación desde el Excel
          const startYear = proyecto.añoFacturacion || 2024;
          const startMonth = this.parseMonthFromSpanish(proyecto.mesFacturacion) || 1;
          
          // Generar ingresos mensuales desde inicio hasta mes actual
          const monthlyAmount = proyecto.monedaUSD || (proyecto.monedaARS / 1000); // Convert ARS to USD approx
          
          for (let year = startYear; year <= currentYear; year++) {
            const monthStart = (year === startYear) ? startMonth : 1;
            const monthEnd = (year === currentYear) ? currentMonth : 12;
            
            for (let month = monthStart; month <= monthEnd; month++) {
              try {
                // Verificar si ya existe el ingreso para este mes
                const existingRevenues = await storage.getProjectMonthlyRevenue(matchingProject.id);
                const exists = existingRevenues.some((rev: any) => 
                  rev.year === year && rev.month === month
                );
                
                if (!exists) {
                  // Determinar estado de facturación y cobranza basado en información del Excel
                  const isInvoiced = this.shouldBeInvoiced(proyecto, year, month);
                  const isCollected = this.shouldBeCollected(proyecto, year, month);
                  
                  const revenueData = {
                    projectId: matchingProject.id,
                    year: year,
                    month: month,
                    amountUsd: monthlyAmount,
                    invoiced: isInvoiced,
                    collected: isCollected,
                    revenueSource: 'excel_automated',
                    notes: `Generado automáticamente desde Excel - ${proyecto.cliente}`,
                    createdBy: 1 // Sistema
                  };
                  
                  await storage.createProjectMonthlyRevenue(revenueData);
                  revenuesCreated++;
                  
                  console.log(`✅ Ingreso creado: ${proyecto.proyecto} - ${month}/${year} - $${monthlyAmount}`);
                }
              } catch (monthError: any) {
                console.error(`❌ Error creando ingreso para ${proyecto.proyecto} ${month}/${year}:`, monthError);
              }
            }
          }
          
        } catch (projectError: any) {
          const errorMsg = `Error procesando proyecto ${proyecto.proyecto}: ${projectError.message}`;
          errors.push(errorMsg);
          console.error('❌', errorMsg);
        }
      }
      
      console.log(`🎉 Generación automática completada: ${revenuesCreated} ingresos creados`);
      
      return {
        success: true,
        revenuesCreated,
        errors
      };
      
    } catch (error: any) {
      console.error('❌ Error en generación automática desde Excel:', error);
      return {
        success: false,
        revenuesCreated: 0,
        errors: [error.message || 'Error desconocido']
      };
    }
  }

  /**
   * Determinar si un ingreso debería estar facturado basándose en columna S del Excel
   */
  private shouldBeInvoiced(proyecto: ProyectoConfirmado, year: number, month: number): boolean {
    // Lógica basada en la información de facturación del Excel
    // Si tiene mes de facturación específico, verificar si ya pasó
    if (proyecto.mesFacturacion && proyecto.añoFacturacion) {
      const factMonth = this.parseMonthFromSpanish(proyecto.mesFacturacion);
      const factYear = proyecto.añoFacturacion;
      
      if (year > factYear || (year === factYear && month >= factMonth)) {
        return true;
      }
    }
    
    // Por defecto, considerar facturado si ya pasaron 2 meses desde el inicio
    const monthsSinceStart = (year * 12 + month) - (proyecto.añoFacturacion * 12 + this.parseMonthFromSpanish(proyecto.mesFacturacion));
    return monthsSinceStart >= 2;
  }

  /**
   * Determinar si un ingreso debería estar cobrado basándose en columna C del Excel
   */
  private shouldBeCollected(proyecto: ProyectoConfirmado, year: number, month: number): boolean {
    // Lógica basada en la información de cobranza del Excel
    if (proyecto.mesCobre && proyecto.añoCobre) {
      const cobMonth = this.parseMonthFromSpanish(proyecto.mesCobre);
      const cobYear = proyecto.añoCobre;
      
      if (year > cobYear || (year === cobYear && month >= cobMonth)) {
        return true;
      }
    }
    
    // Por defecto, considerar cobrado si ya pasaron 3 meses desde facturación
    const monthsSinceStart = (year * 12 + month) - (proyecto.añoFacturacion * 12 + this.parseMonthFromSpanish(proyecto.mesFacturacion));
    return monthsSinceStart >= 3;
  }

  /**
   * Convertir mes en español a número - FIXED: maneja formato "08 ago"
   */
  private parseMonthFromSpanish(mesSpanish: string): number {
    if (!mesSpanish) return 1;
    
    const mes = mesSpanish.toLowerCase().trim();
    
    // ARREGLO CRÍTICO: Manjar formato "08 ago", "05 may" desde Excel MAESTRO
    const numberMatch = mes.match(/\b(\d{1,2})\b/);
    if (numberMatch) {
      const monthNum = parseInt(numberMatch[1]);
      if (monthNum >= 1 && monthNum <= 12) {
        console.log(`🗓️ PARSED MONTH: "${mesSpanish}" → ${monthNum}`);
        return monthNum;
      }
    }
    
    // Fallback: diccionario tradicional
    const meses: Record<string, number> = {
      'enero': 1, 'ene': 1, '01': 1, '1': 1,
      'febrero': 2, 'feb': 2, '02': 2, '2': 2,
      'marzo': 3, 'mar': 3, '03': 3, '3': 3,
      'abril': 4, 'abr': 4, '04': 4, '4': 4,
      'mayo': 5, 'may': 5, '05': 5, '5': 5,
      'junio': 6, 'jun': 6, '06': 6, '6': 6,
      'julio': 7, 'jul': 7, '07': 7, '7': 7,
      'agosto': 8, 'ago': 8, '08': 8, '8': 8,
      'septiembre': 9, 'sep': 9, '09': 9, '9': 9,
      'octubre': 10, 'oct': 10, '10': 10,
      'noviembre': 11, 'nov': 11, '11': 11,
      'diciembre': 12, 'dic': 12, '12': 12
    };
    
    // Buscar coincidencias de palabra completa o parcial
    for (const [key, value] of Object.entries(meses)) {
      if (mes.includes(key)) {
        console.log(`🗓️ FALLBACK MONTH: "${mesSpanish}" → ${value} (matched "${key}")`);
        return value;
      }
    }
    
    console.warn(`⚠️ MONTH PARSE FAILED: "${mesSpanish}" → defaulting to 1`);
    return 1;
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

  /**
   * Datos históricos del BCRA como fallback cuando no se encuentra la pestaña específica
   */
  private getMockTiposCambioData(): TipoCambio[] {
    // Datos reales aproximados del BCRA para los últimos 12 meses
    return [
      { mes: 'dic', año: 2024, tipoCambio: 1030.0, fuente: 'BCRA' },
      { mes: 'nov', año: 2024, tipoCambio: 1000.0, fuente: 'BCRA' },
      { mes: 'oct', año: 2024, tipoCambio: 970.0, fuente: 'BCRA' },
      { mes: 'sep', año: 2024, tipoCambio: 945.0, fuente: 'BCRA' },
      { mes: 'ago', año: 2024, tipoCambio: 920.0, fuente: 'BCRA' },
      { mes: 'jul', año: 2024, tipoCambio: 895.0, fuente: 'BCRA' },
      { mes: 'jun', año: 2024, tipoCambio: 870.0, fuente: 'BCRA' },
      { mes: 'may', año: 2024, tipoCambio: 845.0, fuente: 'BCRA' },
      { mes: 'abr', año: 2024, tipoCambio: 820.0, fuente: 'BCRA' },
      { mes: 'mar', año: 2024, tipoCambio: 795.0, fuente: 'BCRA' },
      { mes: 'feb', año: 2024, tipoCambio: 770.0, fuente: 'BCRA' },
      { mes: 'ene', año: 2024, tipoCambio: 745.0, fuente: 'BCRA' },
      { mes: 'dic', año: 2023, tipoCambio: 720.0, fuente: 'BCRA' },
      { mes: 'nov', año: 2023, tipoCambio: 695.0, fuente: 'BCRA' },
      { mes: 'oct', año: 2023, tipoCambio: 670.0, fuente: 'BCRA' },
      { mes: 'sep', año: 2023, tipoCambio: 645.0, fuente: 'BCRA' }
    ];
  }

  /**
   * Obtener nombres de todas las pestañas del Excel MAESTRO
   */
  async getSheetNames(): Promise<string[]> {
    console.log('🔄 Obteniendo nombres de pestañas del Excel MAESTRO...');
    console.log(`🔑 Using credentials file: ${this.credentialsPath}`);
    
    const sheets = this.createSheetsClientFromJSON();
    if (!sheets) {
      console.warn('⚠️ Google Sheets client not available, returning empty sheet names');
      return [];
    }

    console.log(`📊 Spreadsheet ID: ${this.spreadsheetId}`);

    try {
      const response = await sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });
      
      const sheetNames = response.data.sheets?.map(sheet => sheet.properties?.title || 'Sin título') || [];
      
      console.log(`✅ ${sheetNames.length} pestañas encontradas:`, sheetNames);
      
      return sheetNames;
    } catch (error) {
      console.error('❌ Error obteniendo pestañas:', error);
      throw error;
    }
  }

  /**
   * Obtener tipos de cambio históricos desde la pestaña "Tipos de cambio"
   */
  async getTiposCambio(): Promise<TipoCambio[]> {
    console.log('🔄 Obteniendo tipos de cambio del Excel MAESTRO...');
    const sheets = this.createSheetsClientFromJSON();
    if (!sheets) {
      console.warn('⚠️ Google Sheets client not available, returning empty tipos de cambio');
      return [];
    }

    console.log(`📊 Spreadsheet ID: ${this.spreadsheetId}`);
    
    // Obtener todas las pestañas del Excel MAESTRO primero
    let sheetNames: string[] = [];
    try {
      const sheetResponse = await sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });
      sheetNames = sheetResponse.data.sheets?.map(sheet => sheet.properties?.title || '') || [];
      console.log(`📋 Pestañas encontradas: ${sheetNames.join(', ')}`);
    } catch (error) {
      console.log('⚠️ Error obteniendo nombres de pestañas:', error);
    }

    // Buscar pestañas que podrían contener tipos de cambio
    const possibleSheetNames = [
      ...sheetNames.filter(name => 
        name.toLowerCase().includes('tipo') ||
        name.toLowerCase().includes('cambio') ||
        name.toLowerCase().includes('exchange') ||
        name.toLowerCase().includes('bcra') ||
        name.toLowerCase().includes('dolar') ||
        name.toLowerCase().includes('dollar')
      ),
      'Tipos de cambio',
      'tipos de cambio', 
      'TiposDeCambio',
      'Exchange Rates',
      'BCRA',
      'Resumen Mensual',
      'Dashboard',
      'Datos',
      'Principal'
    ];
    
    let finalRange = '';
    
    console.log(`🔍 Intentando con ${possibleSheetNames.length} posibles nombres de pestañas...`);
    
    // Probar diferentes nombres de pestaña
    for (const sheetName of possibleSheetNames) {
      if (!sheetName.trim()) continue; // Skip empty names
      
      try {
        const testRange = `${sheetName}!A:Z`;
        console.log(`🔍 Probando pestaña: "${sheetName}" con range: ${testRange}`);
        
        const testResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: testRange,
        });
        
        // Si llegamos aquí, encontramos la pestaña correcta
        console.log(`✅ Pestaña encontrada: ${sheetName}`);
        console.log(`📊 Respuesta de pestaña contiene ${testResponse.data.values?.length || 0} filas`);
        
        // Ver si esta pestaña realmente contiene datos de tipos de cambio
        const firstRow = testResponse.data.values?.[0] || [];
        console.log(`📋 Primera fila de "${sheetName}":`, firstRow.slice(0, 10));
        
        // Buscar columnas que podrían indicar tipos de cambio
        const hasExchangeHeaders = firstRow.some((header: string) => 
          header && (
            header.toLowerCase().includes('tipo') ||
            header.toLowerCase().includes('cambio') ||
            header.toLowerCase().includes('cotiz') ||
            header.toLowerCase().includes('dolar') ||
            header.toLowerCase().includes('exchange')
          )
        );
        
        if (hasExchangeHeaders) {
          console.log(`🎯 Pestaña "${sheetName}" parece contener datos de tipos de cambio`);
          finalRange = testRange;
          break;
        } else {
          console.log(`⚠️ Pestaña "${sheetName}" existe pero no parece contener tipos de cambio`);
        }
        
      } catch (error) {
        // Continuar con el siguiente nombre
        console.log(`⚠️ Pestaña "${sheetName}" no encontrada o error:`, error.message);
        continue;
      }
    }
    
    if (!finalRange) {
      console.log('❌ No se encontró ninguna pestaña válida para tipos de cambio');
      console.log('🔄 Utilizando datos históricos del BCRA como fallback...');
      return this.getMockTiposCambioData();
    }
    console.log(`📋 Range: ${finalRange}`);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: finalRange,
    });
    
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('❌ No se encontraron datos en la pestaña Tipos de cambio');
      return [];
    }
    
    console.log(`📊 Procesando ${rows.length} filas de tipos de cambio`);
    
    // Buscar la sección de tipos de cambio mensuales (Link Rem)
    let startRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row && row[0] && row[0].toString().toLowerCase().includes('link rem')) {
        startRowIndex = i + 2; // +2 para saltar la fila del header
        break;
      }
    }
    
    if (startRowIndex === -1) {
      console.log('❌ No se encontró la sección "Link Rem" en tipos de cambio');
      return [];
    }
    
    const tiposCambio: TipoCambio[] = [];
    
    // Procesar desde la fila encontrada
    for (let i = startRowIndex; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 2) continue;
      
      const mes = row[0]?.toString().trim();
      const tipoCambioStr = row[1]?.toString().trim();
      
      if (!mes || !tipoCambioStr) continue;
      
      // Parar si encontramos filas de proyección - CORRECCIÓN: permitir 2025
      if (mes.includes('próx') || mes.includes('2026') || mes.includes('proyecc')) {
        break;
      }
      
      // Determinar año actual desde el mes si contiene año
      let currentYear = 2024; // Default
      if (mes.includes('2025')) {
        currentYear = 2025;
      } else if (mes.includes('2024')) {
        currentYear = 2024;
      }
      
      // Convertir el tipo de cambio a número
      const tipoCambio = parseDec(tipoCambioStr.replace(/[.,]/g, (match, offset, string) => {
        // Reemplazar la última coma/punto por punto decimal
        const lastDotIndex = string.lastIndexOf('.');
        const lastCommaIndex = string.lastIndexOf(',');
        const lastSeparatorIndex = Math.max(lastDotIndex, lastCommaIndex);
        return offset === lastSeparatorIndex ? '.' : '';
      }));
      
      if (isNaN(tipoCambio)) continue;
      
      tiposCambio.push({
        mes: mes,
        año: currentYear, // Usar año detectado dinámicamente
        tipoCambio: tipoCambio,
        fuente: 'BCRA'
      });
      
      if (tiposCambio.length <= 5) {
        console.log(`🔍 Tipo cambio debug: ${mes} = ${tipoCambio}`);
      }
    }
    
    console.log(`✅ Procesados ${tiposCambio.length} tipos de cambio`);
    return tiposCambio;
  }

  /**
   * Obtener datos de ventas desde la pestaña "Ventas Tomi" según especificaciones exactas del usuario
   * Implementa normalización de nombres, alias map, filtrado y conversión de monedas
   */
  async getVentasTomi(): Promise<VentaTomi[]> {
    try {
      const sheets = this.createSheetsClientFromJSON();
      if (!sheets) {
        console.warn('⚠️ Google Sheets client not available, returning empty ventas data');
        return [];
      }
      const range = 'Ventas Tomi!A:Z'; // Extendido para capturar todas las columnas

      console.log('🔄 Obteniendo ventas desde Ventas Tomi...');
      console.log(`📊 Spreadsheet ID: ${this.spreadsheetId}`);
      console.log(`📋 Range: ${range}`);
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: range,
        valueRenderOption: 'FORMATTED_VALUE', // ✅ Fix: Prevents ARS inflation (10^14-10^16)
        dateTimeRenderOption: 'SERIAL_NUMBER',
      });

      const rows = response.data.values;
      
      if (!rows || rows.length === 0) {
        console.log('⚠️ No se encontraron datos en Ventas Tomi');
        return [];
      }

      console.log(`📊 Procesando ${rows.length} filas de ventas con normalizacion y alias map`);
      return this.processVentasTomiWithNormalization(rows);
      
    } catch (error) {
      console.error('❌ Error obteniendo ventas de Tomi:', error);
      return [];
    }
  }

  /**
   * Función parseDec robusta según especificaciones exactas del usuario
   * Maneja ES/US, miles, moneda y paréntesis negativos
   */
  private parseDec(v: unknown): number {
    if (typeof v === 'number') return v;
    const s = String(v || '').trim()
      .replace(/\s+/g, '')
      .replace(/\$/g, '')
      .replace(/\((.*)\)/, '-$1')
      .replace(/[.](?=.*\d{3}(?:[,.]|$))/g, '') // quita miles con punto
      .replace(/,(?=\d{2}$)/, '.')              // coma decimal
      .replace(/,/g, '');                       // resto comas
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * Normalización de nombres según especificaciones del usuario
   * trim → lowercase → quitar acentos → colapsar espacios
   */
  private normalizeProjectName(s: string): string {
    if (!s) return '';
    return s.trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // quitar acentos
      .replace(/\s+/g, ' ')            // colapsar espacios
      .trim();
  }

  /**
   * Alias map para resolver desvíos de escritura según especificaciones del usuario
   * Mapea cliente::proyecto normalizado → projectId
   */
  private getProjectAliasMap(): Record<string, number> {
    return {
      "warner::fee marketing": 34,
      "warner::fee insights": 34,
      "kimberly clark::fee huggies": 39,
      "play digital s.a (modo)::fee mensual": 42,
      "play digital s.a (modo)::fee_mensual": 42,
      "play digital sa (modo)::fee mensual": 42,
      "play digital sa (modo)::fee_mensual": 42,
      "play digital::fee mensual": 42,
      "modo::fee mensual": 42,
      "coelsa::fee mensual": 43,
      "detroit::fee mensual": 44,
      "vertical media::fee mensual": 41,
      // Agregar más alias según sea necesario
    };
  }

  /**
   * Procesar datos de "Ventas Tomi" con normalización y alias map 
   * según especificaciones exactas del usuario
   */
  private processVentasTomiWithNormalization(rows: any[][]): VentaTomi[] {
    const result: VentaTomi[] = [];
    const seenHashes = new Set<string>(); // Para deduplicación
    
    if (rows.length === 0) return result;

    // La primera fila contiene los headers
    const headers = rows[0];
    console.log('📋 Headers de Ventas Tomi encontrados:', headers);

    // Mapear las columnas según los headers del Excel MAESTRO
    const columnMap = {
      cliente: headers.findIndex(h => h === 'Cliente'),
      proyecto: headers.findIndex(h => h === 'Proyecto'),
      mes: headers.findIndex(h => h === 'Mes'),
      año: headers.findIndex(h => h === 'Año' || h === 'Año '),
      monto_usd: headers.findIndex(h => h === 'Monto_USD'),
      monto_ars: headers.findIndex(h => h === 'Monto_ARS'),
      tipo_venta: headers.findIndex(h => h === 'Tipo_Venta'),
      confirmado: headers.findIndex(h => h === 'Confirmado')
    };

    console.log('🗺️ Mapeo de columnas Ventas Tomi:', columnMap);
    
    const aliasMap = this.getProjectAliasMap();
    console.log('🔑 Alias map cargado:', aliasMap);

    // Procesar cada fila de datos (saltar header)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      try {
        // Extraer datos de la fila
        const cliente = row[columnMap.cliente] || '';
        const proyecto = row[columnMap.proyecto] || '';
        const mes = row[columnMap.mes] || '';
        const año = row[columnMap.año] || '';
        const montoUSD = row[columnMap.monto_usd] || '';
        const montoARS = row[columnMap.monto_ars] || '';
        const tipoVenta = row[columnMap.tipo_venta] || '';
        const confirmado = row[columnMap.confirmado] || '';

        // 1. FILTRADO: Solo filas confirmadas según especificaciones
        const confirmadoNorm = String(confirmado).toLowerCase().trim();
        if (!['si', 'sí', 'yes'].includes(confirmadoNorm)) {
          continue; // Saltar filas no confirmadas
        }

        // 2. NORMALIZACIÓN: Crear clave canónica cliente::proyecto
        const clienteNorm = this.normalizeProjectName(cliente);
        const proyectoNorm = this.normalizeProjectName(proyecto);
        const canonicalKey = `${clienteNorm}::${proyectoNorm}`;

        // 3. ALIAS MAP: Resolver projectId usando alias map
        const projectId = aliasMap[canonicalKey];
        if (!projectId) {
          console.log(`⚠️ Sin alias para "${canonicalKey}" - fila ${i+1}`);
          continue; // Saltar si no hay mapeo
        }

        // 4. DEDUPLICACIÓN: Hash de fila para evitar duplicados
        const rowHash = `${cliente}|${proyecto}|${mes}|${año}|${montoUSD}|${montoARS}|${tipoVenta}`;
        if (seenHashes.has(rowHash)) {
          console.log(`🔄 Fila duplicada detectada: ${rowHash}`);
          continue;
        }
        seenHashes.add(rowHash);

        // 5. CONVERSIÓN DE MONEDAS: USD directo, ARS/FX del período
        let amountUSD = 0;
        const parsedUSD = this.parseDec(montoUSD);
        const parsedARS = this.parseDec(montoARS);
        
        if (parsedUSD > 0) {
          amountUSD = parsedUSD;
        } else if (parsedARS > 0) {
          // TODO: Obtener FX del período - por ahora usar 1350 como default
          const fxRate = 1350; // Esto debería venir de resolveFX(period)
          amountUSD = parsedARS / fxRate;
          console.log(`💱 Conversión ARS→USD: ${parsedARS} / ${fxRate} = ${amountUSD}`);
        }

        // 6. CREAR REGISTRO NORMALIZADO
        const ventaRecord: VentaTomi = {
          cliente: cliente,
          proyecto: proyecto,
          mes: mes,
          año: parseInt(año) || new Date().getFullYear(),
          montoUSD: amountUSD,
          montoARS: parsedARS,
          tipoVenta: tipoVenta,
          confirmado: confirmado,
          projectId: projectId,
          canonicalKey: canonicalKey,
          rowHash: rowHash
        };

        result.push(ventaRecord);
        
        if (result.length <= 5) {
          console.log(`✅ Venta procesada [${result.length}]:`, {
            canonical: canonicalKey,
            projectId: projectId,
            amountUSD: amountUSD,
            mes: mes,
            año: año
          });
        }

      } catch (error) {
        console.error(`❌ Error procesando fila ${i+1}:`, error);
        continue;
      }
    }

    console.log(`📊 Ventas Tomi procesadas: ${result.length} de ${rows.length-1} filas`);
    return result;
  }

  /**
   * Procesar los datos de ventas de la pestaña "Ventas Tomi" (método legacy)
   */
  private processVentasData(rows: any[][]): VentaTomi[] {
    const result: VentaTomi[] = [];
    
    if (rows.length === 0) return result;

    // La primera fila contiene los headers
    const headers = rows[0];
    console.log('📋 Headers de ventas encontrados:', headers);

    // Mapear las columnas según los headers EXACTOS del Excel MAESTRO
    const columnMap = {
      cliente: headers.findIndex(h => h === 'Cliente'),
      proyecto: headers.findIndex(h => h === 'Proyecto'),
      mes: headers.findIndex(h => h === 'Mes'),
      año: headers.findIndex(h => h === 'Año ' || h === 'Año'), // Incluir versión con espacio
      monto_usd: headers.findIndex(h => h === 'Monto_USD'),
      monto_ars: headers.findIndex(h => h === 'Monto_ARS'),
      tipo_venta: headers.findIndex(h => h === 'Tipo_Venta'),
      confirmado: headers.findIndex(h => h === 'Confirmado')
    };

    console.log('🗺️ Mapeo de columnas ventas:', columnMap);

    // Procesar cada fila de datos (omitir headers)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      if (!row || row.length === 0) continue;

      try {
        const cliente = this.getCellValue(row, columnMap.cliente);
        const proyecto = this.getCellValue(row, columnMap.proyecto);
        const mes = this.getCellValue(row, columnMap.mes);
        const año = this.getCellValue(row, columnMap.año);
        
        // Solo procesar filas con datos mínimos requeridos
        if (!cliente || !proyecto || !mes || !año) continue;
        
        const ventaData: VentaTomi = {
          cliente: cliente,
          proyecto: proyecto,
          mes: mes,
          año: parseDec(año) || new Date().getFullYear(),
          monto_usd: this.parseMoneyValue(this.getCellValue(row, columnMap.monto_usd)),
          monto_ars: this.parseMoneyValue(this.getCellValue(row, columnMap.monto_ars)),
          tipo_venta: this.getCellValue(row, columnMap.tipo_venta) || 'fee',
          confirmado: this.getCellValue(row, columnMap.confirmado) || 'SI'
        };

        result.push(ventaData);
        
        // Debug primeras 5 filas
        if (i <= 5) {
          console.log(`🔍 Venta ${i} debug:`, ventaData);
        }
        
      } catch (error) {
        console.warn(`⚠️ Error procesando fila de venta ${i}:`, error);
      }
    }

    console.log(`✅ Procesadas ${result.length} ventas válidas de ${rows.length - 1} filas`);
    return result;
  }

  /**
   * Importar costos directos desde "Costos directos e indirectos"
   */
  async importDirectCosts(storage: any): Promise<{ success: boolean; costsImported: number; costsUpdated: number; errors: string[] }> {
    console.log('📊 Importando costos directos desde Excel...');
    
    try {
      const sheets = this.createSheetsClientFromJSON();
      if (!sheets) {
        console.warn('⚠️ Google Sheets client not available, skipping direct costs import');
        return { success: false, costsImported: 0, costsUpdated: 0, errors: ['Google Sheets client not available'] };
      }

      // Leer datos de la pestaña "Costos directos e indirectos"
      const range = 'Costos directos e indirectos!A:R'; // Extendido a R para incluir montos USD convertidos
      console.log('📋 Range:', range);

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: range,
        valueRenderOption: 'FORMATTED_VALUE', // ✅ Fix: Prevents ARS inflation (10^14-10^16)
        dateTimeRenderOption: 'SERIAL_NUMBER',
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        return { success: false, costsImported: 0, costsUpdated: 0, errors: ['No se encontraron datos en la pestaña'] };
      }

      console.log(`📊 Procesando ${rows.length} filas de costos directos`);
      const costosDirectos = this.processDirectCostsData(rows);
      console.log(`📋 Procesados ${costosDirectos.length} registros válidos de costos`);
      
      if (costosDirectos.length === 0) {
        return { success: false, costsImported: 0, costsUpdated: 0, errors: ['No se encontraron costos válidos para procesar'] };
      }

      // Procesar e importar costos directos
      let costsImported = 0;
      let costsUpdated = 0;
      const errors: string[] = [];
      const importBatch = `batch_${Date.now()}`;

      for (const costo of costosDirectos) {
        try {
          // Obtener valor hora de la persona para el mes/año
          const valorHora = await this.getPersonnelHourlyRate(storage, costo.persona, costo.mes, costo.año);
          
          // 🔧 FIX: Separar costoTotalARS y montoTotalUSD para evitar guard "USD==ARS"
          let costoTotalARS: number | null = null;
          let montoTotalUSD: number | null = costo.montoTotalUSD || null;
          
          if (valorHora && costo.horasRealesAsana > 0) {
            // Cálculo tradicional por horas x tarifa (en ARS)
            costoTotalARS = costo.horasRealesAsana * valorHora;
            console.log(`💰 Costo calculado por horas: ${costo.persona} - ${costo.proyecto}: ${costoTotalARS} ARS`);
          } else if (montoTotalUSD && montoTotalUSD > 0) {
            // Usar monto USD directo del Excel cuando no hay tarifa horaria
            // NO calcular costoTotalARS para evitar confusión con el guard
            console.log(`💰 Usando monto USD directo para ${costo.persona} - ${costo.proyecto}: $${montoTotalUSD} USD`);
          } else {
            // No hay datos suficientes, saltar
            console.log(`⚠️ No se encontró valor hora ni monto USD para ${costo.persona} en ${costo.mes} ${costo.año}`);
            continue;
          }

          // Crear unique key para control de duplicados
          const uniqueKey = `${costo.persona}_${costo.proyecto}_${costo.cliente}_${costo.mes}_${costo.año}`.replace(/\s+/g, '_').toLowerCase();

          // Buscar referencias al sistema
          const projectId = await this.findProjectByName(storage, costo.cliente, costo.proyecto);
          const personnelId = await this.findPersonnelByName(storage, costo.persona);

          // Generar month_key (YYYY-MM) 
          const monthNumber = this.parseMonthFromSpanish(costo.mes);
          const monthKey = `${costo.año}-${String(monthNumber).padStart(2, '0')}`;
          
          // 🛡️ APLICAR GUARD ETL: Sanitizar USD solo si hay datos para comparar
          const sanitizedUSD = this.sanitizeUSD({
            nativeCurrency: costoTotalARS ? 'ARS' : 'USD', // Si no hay ARS, es USD nativo
            costoARS: costoTotalARS, // null cuando solo hay USD
            montoUSD: montoTotalUSD,
            fx: costo.tipoCambio
          });
          
          // 🛡️ PREVENIR OVERFLOW: Limitar costos a valores razonables
          const MAX_COST = 100_000_000; // 100M máximo razonable para un costo mensual
          if (costoTotalARS && (!Number.isFinite(costoTotalARS) || costoTotalARS > MAX_COST)) {
            console.log(`🛡️ GUARD OVERFLOW: Costo ARS astronómico detectado (${costoTotalARS}), saltando registro`);
            continue;
          }
          if (sanitizedUSD && (!Number.isFinite(sanitizedUSD) || sanitizedUSD > MAX_COST)) {
            console.log(`🛡️ GUARD OVERFLOW: Costo USD astronómico detectado (${sanitizedUSD}), saltando registro`);
            continue;
          }
          
          const directCostData = {
            monthKey: monthKey, // NUEVO: Clave temporal única
            persona: costo.persona,
            rol: costo.rol || null, // 🆕 Rol de la persona
            mes: costo.mes,
            año: costo.año,
            tipoGasto: costo.tipoGasto,
            especificacion: costo.especificacion,
            proyecto: costo.proyecto,
            tipoProyecto: costo.tipoProyecto,
            cliente: costo.cliente,
            horasObjetivo: costo.horasObjetivo || 0,
            horasRealesAsana: costo.horasRealesAsana,
            horasParaFacturacion: costo.horasParaFacturacion || 0, // NUEVO: Columna M
            valorHoraPersona: valorHora || 0,
            valorHoraLocalCurrency: valorHora ? valorHora.toString() : '0', // 🆕 Valor hora en moneda local (ARS)
            costoTotal: costoTotalARS || 0, // ARS calculado por horas, o 0 si solo hay USD
            tipoCambio: costo.tipoCambio,
            montoTotalUSD: sanitizedUSD, // 🛡️ USD sanitizado
            projectId: projectId,
            personnelId: personnelId,
            importBatch: importBatch,
            uniqueKey: uniqueKey
          };
          
          // 🚨 VALIDACIÓN ADICIONAL: Revisar totales  
          if (costo.montoTotalUSD && costo.montoTotalUSD > 0 && costo.horasRealesAsana > 0) {
            const costoHora = costo.montoTotalUSD / costo.horasRealesAsana;
            if (costoHora > 500) { // Más de $500/hora podría ser error
              console.log(`⚠️ ALERTA COSTO ALTO: ${costo.persona} - $${costoHora.toFixed(2)}/hora`);
            }
          }

          // Verificar si ya existe un registro
          const existingCost = await storage.getDirectCostByUniqueKey(uniqueKey);
          
          if (existingCost) {
            await storage.updateDirectCost(existingCost.id, directCostData);
            costsUpdated++;
            const displayValue = costoTotalARS || montoTotalUSD || 0;
            console.log(`🔄 Actualizado: ${costo.persona} - ${costo.proyecto} - $${displayValue.toFixed(2)}`);
          } else {
            await storage.createDirectCost(directCostData);
            costsImported++;
            const displayValue = costoTotalARS || montoTotalUSD || 0;
            console.log(`➕ Creado: ${costo.persona} - ${costo.proyecto} - $${displayValue.toFixed(2)}`);
          }

        } catch (error: any) {
          const errorMsg = `Error procesando costo de ${costo.persona}: ${error?.message || error}`;
          errors.push(errorMsg);
          console.error('❌', errorMsg);
        }
      }

      console.log(`✅ Importación completada: ${costsImported} importados, ${costsUpdated} actualizados`);
      
      return {
        success: true,
        costsImported,
        costsUpdated,
        errors
      };

    } catch (error: any) {
      console.error('❌ Error importando costos directos:', error);
      return { success: false, costsImported: 0, costsUpdated: 0, errors: [error?.message || 'Unknown error'] };
    }
  }

  /**
   * Procesar datos de costos directos del Excel
   */
  private processDirectCostsData(rows: any[][]): CostoDirectoExcel[] {
    console.log('🔥🔥🔥 PROCESS_DIRECT_COSTS_DATA CALLED - ANTI×100 FIX ACTIVE 🔥🔥🔥');
    const result: CostoDirectoExcel[] = [];
    
    if (rows.length === 0) return result;

    // Headers esperados según la nueva imagen
    const headers = rows[0];
    console.log('📋 Headers costos directos:', headers);

    // CORRECCIÓN COMPLETA: Mapeo según la estructura real del Excel
    const columnMap = {
      persona: 0, // Columna A - Detalle (nombre persona)
      rol: 1, // Columna B - Rol 🆕
      mes: 2, // Columna C - Mes  
      año: 3, // Columna D - Año
      tipoGasto: 4, // Columna E - Tipo de Costo (DIRECTO/INDIRECTO)
      especificacion: 5, // Columna F - Especificación
      proyecto: 8, // Columna I - Nombre del proyecto
      cliente: 9, // Columna J - Cliente
      horasObjetivo: 10, // Columna K - Cantidad de horas objetivo
      horasRealesAsana: 11, // Columna L - Cantidad de horas reales Asana
      horasParaFacturacion: 12, // Columna M - Cantidad de horas para facturación - NUEVO
      montoOriginalARS: 14, // Columna O - Moneda Original ARS
      montoTotalUSD: 17, // Columna R - Monto Total USD (ya convertido)
      tipoCambio: 16 // Columna Q - Tipo Cambio (para referencia)
    };

    console.log('🗺️ Mapeo de columnas costos directos:', columnMap);

    // Procesar cada fila
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      if (!row || row.length === 0) continue;

      try {
        const persona = this.getCellValue(row, columnMap.persona);
        const tipoGasto = this.getCellValue(row, columnMap.tipoGasto);
        
        // 🔧 ANTI×100: Aplicar normalización a todas las horas
        const horasObjetivoRaw = parseDec(this.getCellValue(row, columnMap.horasObjetivo));
        const horasRealesAsanaRaw = parseDec(this.getCellValue(row, columnMap.horasRealesAsana));
        const horasParaFacturacionRaw = parseDec(this.getCellValue(row, columnMap.horasParaFacturacion));
        
        // Normalizar horas (dividir por 100 si > 500)
        const horasObjetivo = horasObjetivoRaw > 500 ? horasObjetivoRaw / 100 : horasObjetivoRaw;
        const horasRealesAsana = horasRealesAsanaRaw > 500 ? horasRealesAsanaRaw / 100 : horasRealesAsanaRaw;
        const horasParaFacturacion = horasParaFacturacionRaw > 500 ? horasParaFacturacionRaw / 100 : horasParaFacturacionRaw;
        
        if (horasRealesAsanaRaw > 500 || horasParaFacturacionRaw > 500) {
          console.log(`🔧 ANTI×100_HOURS: ${persona} - Asana: ${horasRealesAsanaRaw} → ${horasRealesAsana}, Billing: ${horasParaFacturacionRaw} → ${horasParaFacturacion}`);
        }
        
        const cliente = this.getCellValue(row, columnMap.cliente);
        const proyecto = this.getCellValue(row, columnMap.proyecto);
        const montoTotalUSDRaw = this.getCellValue(row, columnMap.montoTotalUSD) || '';
        const montoUSDValue = montoTotalUSDRaw ? this.parseMoneyValue(montoTotalUSDRaw) : 0;
        
        // 🚨 VALIDACIÓN ANTI-ERRORES: Verificar parsing de moneda
        if (montoTotalUSDRaw && montoUSDValue < 10 && montoTotalUSDRaw.includes('.')) {
          console.log(`⚠️ ALERTA PARSING: ${montoTotalUSDRaw} parseado como ${montoUSDValue} - posible error de locale`);
        }

        // 🔍 LOGGING DETALLADO: Verificar por qué se filtran registros
        const debugInfo = {
          fila: i,
          persona: persona || 'VACÍO',
          tipoGasto: tipoGasto || 'VACÍO', 
          cliente: cliente || 'VACÍO',
          proyecto: proyecto || 'VACÍO',
          horasReales: horasRealesAsana,
          montoUSD: montoUSDValue
        };
        
        // 🚨 FILTRO CRÍTICO: Solo procesar costos DIRECTOS (más tolerante)
        if (!tipoGasto || tipoGasto.toLowerCase().trim() !== 'directo') {
          if (tipoGasto) console.log(`⏭️ Fila ${i}: Filtrado por tipo '${tipoGasto}' != 'directo'`);
          continue;
        }
        
        // Solo procesar filas válidas con datos esenciales (MUY flexible)
        if (!persona || persona.trim() === '') {
          console.log(`⏭️ Fila ${i}: Filtrado por persona vacía:`, debugInfo);
          continue;
        }
        
        // Solo requerir cliente O proyecto (no ambos)
        if ((!cliente || cliente.trim() === '') && (!proyecto || proyecto.trim() === '')) {
          console.log(`⏭️ Fila ${i}: Filtrado por cliente Y proyecto vacíos:`, debugInfo);
          continue;
        }
        
        // 🔍 FIX: Aceptar filas con montoUSD > 0 INCLUSO si no tienen horas (roles administrativos)
        // Solo filtrar si NO hay horas Y NO hay monto USD
        const hasHours = horasRealesAsana > 0 || horasParaFacturacion > 0 || horasObjetivo > 0;
        const hasUSDCost = montoUSDValue > 0;
        
        if (!hasHours && !hasUSDCost) {
          console.log(`⏭️ Fila ${i}: Filtrado por sin datos numéricos:`, debugInfo);
          continue;
        }
        
        // Log específico para filas con USD pero sin horas
        if (hasUSDCost && !hasHours) {
          console.log(`💰 Fila ${i}: Costo USD sin horas (admin/directivo): ${montoUSDValue} USD`);
        }
        
        // Log filas que SÍ pasan los filtros
        if (cliente?.includes('Play Digital')) {
          console.log(`✅ Fila ${i}: Play Digital procesada:`, debugInfo);
        }

        const tipoCambioRaw = this.getCellValue(row, columnMap.tipoCambio) || '';
        const montoOriginalARSRaw = this.getCellValue(row, columnMap.montoOriginalARS) || '';

        // 🔧 ANTI×100 para costos: Normalizar montos si son astronómicos
        const montoUSDRaw = montoUSDValue;
        const montoUSD = montoUSDRaw > 1000000 ? montoUSDRaw / 100 : montoUSDRaw;
        
        if (montoUSDRaw > 1000000) {
          console.log(`🔧 ANTI×100_COST: ${persona} - USD: ${montoUSDRaw} → ${montoUSD}`);
        }

        const costoData: CostoDirectoExcel = {
          persona: persona,
          rol: this.getCellValue(row, columnMap.rol) || undefined, // 🆕 Rol de la persona
          mes: this.getCellValue(row, columnMap.mes) || '',
          año: parseDec(this.getCellValue(row, columnMap.año)) || new Date().getFullYear(),
          tipoGasto: tipoGasto,
          especificacion: this.getCellValue(row, columnMap.especificacion) || '',
          proyecto: proyecto,
          tipoProyecto: '', // No usado en la nueva estructura
          cliente: cliente,
          horasObjetivo: horasObjetivo, // Columna K: Horas objetivo
          horasRealesAsana: horasRealesAsana, // Columna L: Horas reales
          horasParaFacturacion: horasParaFacturacion, // Columna M: Horas para facturación - NUEVO
          tipoCambio: tipoCambioRaw ? this.parseMoneyValue(tipoCambioRaw) : undefined,
          montoTotalUSD: montoUSD || undefined
        };

        result.push(costoData);
        
      } catch (error) {
        console.error(`❌ Error procesando fila ${i} de costos:`, error);
        continue;
      }
    }

    console.log(`✅ Procesados ${result.length} costos directos de ${rows.length - 1} filas`);
    return result;
  }

  /**
   * Obtener valor hora histórico de una persona
   */
  private async getPersonnelHourlyRate(storage: any, personName: string, month: string, year: number): Promise<number | null> {
    try {
      const personnel = await storage.getPersonnelByName(personName);
      if (!personnel) return null;

      // Buscar valor hora histórico
      const monthField = this.getMonthField(month, year);
      if (monthField && personnel[monthField]) {
        return personnel[monthField];
      }

      // Fallback al valor actual
      return personnel.hourlyRateARS || personnel.hourlyRate || null;
    } catch (error) {
      console.error(`Error obteniendo valor hora para ${personName}:`, error);
      return null;
    }
  }

  /**
   * Buscar proyecto por cliente y nombre
   */
  private async findProjectByName(storage: any, clientName: string, projectName: string): Promise<number | null> {
    try {
      console.log(`🔍 Buscando proyecto para cliente: "${clientName}", proyecto: "${projectName}"`);
      
      // 🎯 CORRECIÓN: Mapeo específico por CLIENTE + PROYECTO
      const clientProjectKey = `${clientName.toLowerCase().trim()}_${projectName.toLowerCase().trim()}`;
      
      const specificProjectMapping: Record<string, number> = {
        // Warner
        'warner_fee marketing': 34,
        'warner_fee insights': 34, // Fee Insights también va a Warner
        
        // Kimberly Clark
        'kimberly clark_fee huggies': 39,
        
        // Coca-Cola
        'coca-cola_hecho en mexico': 36,
        
        // Arcos Dorados
        'arcos dorados_dashboard': 37,
        'arcos dorados_dashboard pbi': 37, // variante
        'arcos dorados_estudio atributos': 38,
        
        // Uber
        'uber_uber taxis': 40,
        
        // Proyectos Fee mensual específicos por cliente
        'play digital s.a (modo)_fee mensual': 42,
        'play digital s.a (modo)_fee_mensual': 42, // variante con guion bajo
        'coelsa_fee mensual': 43,  // ✅ COELSA va al proyecto 43
        'detroit_fee mensual': 44, // Detroit tiene su propio proyecto
        'vertical media_fee mensual': 41, // Vertical Media tiene su propio proyecto
        
        // Proyectos adicionales sin ID asignado (por ahora van sin mapeo específico)
        // 'bid_exploratorio nicaragua': 45, // necesita ID
        // 'cami criado_olas': 46, // necesita ID
        // 'detroit_cambios web': 42, // va con Detroit
        // 'detroit_modificaciones pagina web': 45, // según BD actual
        // 'peya_categoria': 47, // necesita ID
        // 'tortugas open mall_vacaciones invierno': 46, // según BD actual 
        // 'animal studio_diego perez': 47, // según BD actual
        // 'animal studio_referentes obesidad': 48, // según BD actual
      };
      
      const projectId = specificProjectMapping[clientProjectKey];
      
      if (projectId) {
        console.log(`🔗 Proyecto encontrado vía mapeo específico: ${clientName} + ${projectName} → Proyecto ${projectId}`);
        return projectId;
      }
      
      // Fallback al mapeo por cliente solo (para compatibilidad)
      const clientOnlyMapping: Record<string, number> = {
        'warner': 34,
        'kimberly clark': 39,
        'coca-cola': 36,
        'arcos dorados': 37, // Para Dashboard (default)
        'uber': 40,
        'play digital s.a (modo)': 42,
        'coelsa': 43,  // ✅ COELSA va al proyecto 43
        'detroit': 44, // Detroit tiene su propio proyecto
        'vertical media': 41, // Vertical Media tiene su propio proyecto
      };
      
      const normalizedClientName = clientName.toLowerCase().trim();
      const fallbackProjectId = clientOnlyMapping[normalizedClientName];
      
      if (fallbackProjectId) {
        console.log(`🔗 Proyecto encontrado vía mapeo de cliente (fallback): ${clientName} → Proyecto ${fallbackProjectId}`);
        return fallbackProjectId;
      }
      
      // Fallback: buscar usando getActiveProjects
      const projects = await storage.getActiveProjects();
      console.log(`🔍 Total proyectos disponibles: ${projects.length}`);
      console.log(`🔍 Primeros 3 proyectos:`, projects.slice(0, 3).map(p => ({ id: p.id, clientName: p.clientName })));
      
      const project = projects.find(p => {
        if (!p.clientName) return false;
        
        // Normalizar nombres para comparación
        const projectClientName = p.clientName.toLowerCase().trim();
        const costClientName = clientName.toLowerCase().trim();
        
        // Verificar coincidencia exacta o contenido
        const clientMatch = projectClientName === costClientName || 
                           projectClientName.includes(costClientName) ||
                           costClientName.includes(projectClientName);
        
        if (clientMatch) {
          console.log(`🔗 Proyecto encontrado vía búsqueda: ${clientName} → Proyecto ${p.id} (${p.clientName})`);
          return true;
        }
        
        return false;
      });
      
      if (!project) {
        console.log(`⚠️ No se encontró proyecto para cliente: ${clientName}`);
      }
      
      return project?.id || null;
    } catch (error) {
      console.error(`❌ Error buscando proyecto para ${clientName}:`, error);
      return null;
    }
  }

  /**
   * Buscar personal por nombre
   */
  private async findPersonnelByName(storage: any, personName: string): Promise<number | null> {
    try {
      const personnel = await storage.getPersonnelByName(personName);
      return personnel?.id || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Obtener campo de mes histórico
   */
  private getMonthField(month: string, year: number): string | null {
    const monthMap = {
      'enero': 'jan',
      'febrero': 'feb', 
      'marzo': 'mar',
      'abril': 'apr',
      'mayo': 'may',
      'junio': 'jun',
      'julio': 'jul',
      'agosto': 'aug',
      'septiembre': 'sep',
      'octubre': 'oct',
      'noviembre': 'nov',
      'diciembre': 'dec'
    };

    const monthKey = monthMap[month.toLowerCase()];
    if (!monthKey) return null;

    return `${monthKey}${year}HourlyRateARS`;
  }

  /**
   * Obtener datos de Resumen Ejecutivo del Excel MAESTRO
   * Lee la hoja "Resumen Ejecutivo" y devuelve registros mensuales de KPIs financieros
   */
  async getResumenEjecutivo(): Promise<ResumenEjecutivoRow[]> {
    try {
      const sheets = this.createSheetsClientFromJSON();
      if (!sheets) {
        console.warn('⚠️ Google Sheets client not available, returning empty resumen ejecutivo data');
        return [];
      }
      const range = "'Resumen Ejecutivo'!A:AZ"; // Extended from A:Z to A:AZ (52 cols) to capture all KPIs

      console.log('📊 [Resumen Ejecutivo] Obteniendo datos del Excel MAESTRO...');
      console.log(`📊 Spreadsheet ID: ${this.spreadsheetId}`);
      console.log(`📋 Range: ${range}`);
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: range,
        valueRenderOption: 'FORMATTED_VALUE',
      });

      const rows = response.data.values;
      
      if (!rows || rows.length === 0) {
        console.log('⚠️ [Resumen Ejecutivo] No se encontraron datos');
        return [];
      }

      console.log(`📊 [Resumen Ejecutivo] Procesando ${rows.length} filas...`);
      
      return this.parseResumenEjecutivo(rows);
      
    } catch (error) {
      console.error('❌ [Resumen Ejecutivo] Error obteniendo datos:', error);
      throw error;
    }
  }

  /**
   * Parsear filas del Resumen Ejecutivo
   * ESTRUCTURA REAL DE LA HOJA:
   * - FILAS = Meses (ej: "01 ene", "02 feb", etc.)
   * - COLUMNAS = KPIs (Activo Líquido, Activo Total, Pasivo Total, etc.)
   * 
   * Headers: ["Mes", "Año", "Cierre", "Activo Líquido", "Activo Mediano Plazo Crypto", ...]
   * Data:    ["01 ene", "2025", "31-1-2025", "$4.125,75", "$9.200,00", ...]
   */
  private parseResumenEjecutivo(rows: any[][]): ResumenEjecutivoRow[] {
    if (rows.length < 2) return [];
    
    const result: ResumenEjecutivoRow[] = [];
    const headerRow = rows[0];
    
    console.log(`📊 [Resumen Ejecutivo] Procesando ${rows.length - 1} filas de datos...`);
    console.log(`📊 [Resumen Ejecutivo] Total columns: ${headerRow.length}`);
    console.log(`📊 [Resumen Ejecutivo] ALL Headers: ${headerRow.map((h: any, i: number) => `[${i}]${h}`).join(', ')}`);
    
    // Mapeo de nombres de columna → propiedad de ResumenEjecutivoRow
    const columnMapping: Record<string, keyof ResumenEjecutivoRow> = {
      // Balance / Activos
      'activo líquido': 'cajaTotal',
      'activo total': 'totalActivo',
      'pasivo total': 'totalPasivo',
      'balance neto (activo-pasivo)': 'balanceNeto',
      'balance neto': 'balanceNeto',
      'activo mediano plazo crypto': 'inversiones',
      'activo mediano plazo clientes a cobrar': 'cuentasCobrarUsd',
      // P&L
      'ventas del mes': 'facturacionTotal',
      'ventas': 'facturacionTotal',
      'facturación': 'facturacionTotal',
      'facturacion': 'facturacionTotal',
      'costos directos': 'costosDirectos',
      'costos indirectos': 'costosIndirectos',
      'ebit utilidad operativa': 'ebitOperativo',
      'ebit operativo': 'ebitOperativo',
      'ebit': 'ebitOperativo',
      'utilidad operativa': 'ebitOperativo',
      'beneficio neto': 'beneficioNeto',
      'markup': 'markupPromedio',
      // Cashflow
      'chasflow': 'cashflowNeto',
      'cashflow': 'cashflowNeto',
      'cashflow neto': 'cashflowNeto',
      'cashflow ingresos': 'cashflowIngresos',
      'cashflow egresos': 'cashflowEgresos',
      // Provisiones / Pasivos
      'pasivo provisión impuesto usa': 'impuestosUsa',
      'impuestos usa': 'impuestosUsa',
      'iva compras': 'ivaCompras',
      'pasivo proveedores a pagar': 'cuentasPagarUsd',
      'provisión pasivo costos facturación adelantada': 'facturacionAdelantadaUsd',
    };
    
    // Encontrar índices de columnas para cada KPI
    const columnIndices: Record<string, number> = {};
    const unmatchedHeaders: string[] = [];
    for (let col = 0; col < headerRow.length; col++) {
      const header = (headerRow[col] || '').toString().toLowerCase().trim();
      if (!header || header === 'mes' || header === 'año' || header === 'cierre') continue;
      const field = columnMapping[header];
      if (field) {
        columnIndices[field] = col;
        console.log(`  ✅ Columna "${headerRow[col]}" → ${field} (col ${col})`);
      } else {
        unmatchedHeaders.push(`"${headerRow[col]}" (col ${col})`);
      }
    }
    if (unmatchedHeaders.length > 0) {
      console.log(`  ⚠️ [Resumen Ejecutivo] Columnas NO mapeadas: ${unmatchedHeaders.join(', ')}`);
    }
    
    // Índices especiales para Mes y Año
    const mesColIdx = headerRow.findIndex((h: any) => (h || '').toString().toLowerCase() === 'mes');
    const yearColIdx = headerRow.findIndex((h: any) => (h || '').toString().toLowerCase() === 'año');
    
    console.log(`📊 [Resumen Ejecutivo] Columna Mes: ${mesColIdx}, Año: ${yearColIdx}`);
    
    // Procesar cada fila de datos (empezando desde fila 1)
    for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      if (!row || row.length === 0) continue;
      
      // Obtener mes y año
      const mesLabel = (row[mesColIdx] || '').toString().trim();
      const yearValue = parseInt((row[yearColIdx] || '').toString()) || new Date().getFullYear();
      
      // Parsear el mes desde "01 ene", "02 feb", etc.
      const monthMatch = this.parseMonthLabel(mesLabel);
      if (!monthMatch) {
        console.log(`  ⚠️ No se pudo parsear mes: "${mesLabel}"`);
        continue;
      }
      
      const periodKey = `${yearValue}-${String(monthMatch.month).padStart(2, '0')}`;
      
      const record: Partial<ResumenEjecutivoRow> = {
        periodKey,
        year: yearValue,
        monthNumber: monthMatch.month,
        monthLabel: mesLabel,
      };
      
      // Extraer valores de cada columna mapeada
      // NOTE: Google Sheets API truncates trailing empty cells, so row.length may be < headerRow.length
      for (const [field, colIdx] of Object.entries(columnIndices)) {
        if (colIdx >= row.length) {
          // Row is shorter than expected — this column is beyond the row's data
          if (yearValue >= 2025) {
            console.log(`    ⚠️ ${periodKey}: Column "${field}" at index ${colIdx} is beyond row length ${row.length} — data truncated by API`);
          }
          continue;
        }
        const value = row[colIdx];
        if (value === undefined || value === null || value === '') continue;

        const numValue = this.parseMoneyValue(value.toString());
        (record as any)[field] = numValue;
      }
      
      result.push(record as ResumenEjecutivoRow);
      const hasP = record.facturacionTotal || record.ebitOperativo;
      console.log(`  ${hasP ? '✅' : '⚠️'} ${periodKey} (${mesLabel}) - Ventas: ${record.facturacionTotal ?? 'MISSING'}, EBIT: ${record.ebitOperativo ?? 'MISSING'}, Costos D: ${record.costosDirectos ?? 'MISSING'}, Markup: ${record.markupPromedio ?? 'MISSING'}, row.length=${row.length}`);
    }
    
    console.log(`✅ [Resumen Ejecutivo] Procesados ${result.length} registros mensuales`);
    
    return result;
  }

  /**
   * Parsear etiqueta de mes del Excel - múltiples formatos soportados
   * Formatos: "10 oct", "Oct 2024", "Octubre 2024", "oct-24", "10/2024", etc.
   */
  private parseMonthLabel(label: string): { label: string; year: number; month: number } | null {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    const monthNames: Record<string, number> = {
      'ene': 1, 'enero': 1, 'jan': 1, 'january': 1,
      'feb': 2, 'febrero': 2, 'february': 2,
      'mar': 3, 'marzo': 3, 'march': 3,
      'abr': 4, 'abril': 4, 'apr': 4, 'april': 4,
      'may': 5, 'mayo': 5,
      'jun': 6, 'junio': 6, 'june': 6,
      'jul': 7, 'julio': 7, 'july': 7,
      'ago': 8, 'agosto': 8, 'aug': 8, 'august': 8,
      'sep': 9, 'sept': 9, 'septiembre': 9, 'september': 9,
      'oct': 10, 'octubre': 10, 'october': 10,
      'nov': 11, 'noviembre': 11, 'november': 11,
      'dic': 12, 'diciembre': 12, 'dec': 12, 'december': 12,
    };
    
    // Formato 1: "DD mmm" como "10 oct", "09 sep"
    let match = label.match(/^(\d{1,2})\s*([a-záéíóú]+)$/i);
    if (match) {
      const monthStr = match[2].toLowerCase();
      const month = monthNames[monthStr];
      if (month) {
        const year = month > currentMonth ? currentYear - 1 : currentYear;
        return { label, year, month };
      }
    }
    
    // Formato 2: "mmm YYYY" o "mmm YY" como "Oct 2024", "Oct 24"
    match = label.match(/^([a-záéíóú]+)\s*(\d{2,4})$/i);
    if (match) {
      const monthStr = match[1].toLowerCase();
      const month = monthNames[monthStr];
      if (month) {
        let year = parseInt(match[2]);
        if (year < 100) year += 2000; // Convertir "24" a "2024"
        return { label, year, month };
      }
    }
    
    // Formato 3: "mmm-YY" o "mmm-YYYY" como "oct-24", "oct-2024"
    match = label.match(/^([a-záéíóú]+)[/-](\d{2,4})$/i);
    if (match) {
      const monthStr = match[1].toLowerCase();
      const month = monthNames[monthStr];
      if (month) {
        let year = parseInt(match[2]);
        if (year < 100) year += 2000;
        return { label, year, month };
      }
    }
    
    // Formato 4: "MM/YYYY" o "MM-YYYY" como "10/2024"
    match = label.match(/^(\d{1,2})[/-](\d{4})$/);
    if (match) {
      const month = parseInt(match[1]);
      const year = parseInt(match[2]);
      if (month >= 1 && month <= 12) {
        return { label, year, month };
      }
    }
    
    // Formato 5: "YYYY-MM" ISO format como "2024-10"
    match = label.match(/^(\d{4})[/-](\d{1,2})$/);
    if (match) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]);
      if (month >= 1 && month <= 12) {
        return { label, year, month };
      }
    }
    
    // Formato 6: Solo nombre de mes "Octubre", "Oct" - asumir año actual
    match = label.match(/^([a-záéíóú]+)$/i);
    if (match) {
      const monthStr = match[1].toLowerCase();
      const month = monthNames[monthStr];
      if (month) {
        const year = month > currentMonth ? currentYear - 1 : currentYear;
        return { label, year, month };
      }
    }
    
    return null;
  }

  /**
   * Obtener datos de la hoja "Provisión pasivo proyectos"
   * Contiene provisiones de clientes como Pepsico, Warner, etc.
   */
  async getProvisionPasivoProyectos(): Promise<ProvisionRow[]> {
    try {
      const sheets = this.createSheetsClientFromJSON();
      if (!sheets) {
        console.warn('⚠️ Google Sheets client not available, returning empty provision data');
        return [];
      }
      const range = "'Provisión pasivo proyectos'!A:Z";

      console.log('📊 [Provisión Pasivo Proyectos] Obteniendo datos del Excel MAESTRO...');
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: range,
        valueRenderOption: 'FORMATTED_VALUE',
      });

      const rows = response.data.values;
      
      if (!rows || rows.length === 0) {
        console.log('⚠️ [Provisión Pasivo Proyectos] No se encontraron datos');
        return [];
      }

      console.log(`📊 [Provisión Pasivo Proyectos] Procesando ${rows.length} filas...`);
      
      return this.parseProvisionSheet(rows, 'provision_cliente');
      
    } catch (error) {
      console.error('❌ [Provisión Pasivo Proyectos] Error obteniendo datos:', error);
      return []; // Return empty array on error, don't break ETL
    }
  }

  /**
   * Obtener datos de la hoja "Impuestos"
   * Contiene provisiones de impuestos USA, IVA, etc.
   */
  async getImpuestos(): Promise<ProvisionRow[]> {
    try {
      const sheets = this.createSheetsClientFromJSON();
      if (!sheets) {
        console.warn('⚠️ Google Sheets client not available, returning empty impuestos data');
        return [];
      }
      const range = "'Impuestos'!A:Z";

      console.log('📊 [Impuestos] Obteniendo datos del Excel MAESTRO...');
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: range,
        valueRenderOption: 'FORMATTED_VALUE',
      });

      const rows = response.data.values;
      
      if (!rows || rows.length === 0) {
        console.log('⚠️ [Impuestos] No se encontraron datos');
        return [];
      }

      console.log(`📊 [Impuestos] Procesando ${rows.length} filas...`);
      
      return this.parseProvisionSheet(rows, 'impuestos');
      
    } catch (error) {
      console.error('❌ [Impuestos] Error obteniendo datos:', error);
      return [];
    }
  }

  /**
   * Obtener datos de la hoja "Pasivo"
   * Contiene provisiones varias y pasivos
   * ESTRUCTURA: Filas con columnas Mes, Año, Concepto/Detalle, Monto Total USD
   */
  async getPasivo(): Promise<ProvisionRow[]> {
    try {
      const sheets = this.createSheetsClientFromJSON();
      if (!sheets) {
        console.warn('⚠️ Google Sheets client not available, returning empty pasivo data');
        return [];
      }
      const range = "'Pasivo'!A:Z";

      console.log('📊 [Pasivo] Obteniendo datos del Excel MAESTRO...');
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: range,
        valueRenderOption: 'FORMATTED_VALUE',
      });

      const rows = response.data.values;
      
      if (!rows || rows.length === 0) {
        console.log('⚠️ [Pasivo] No se encontraron datos');
        return [];
      }

      console.log(`📊 [Pasivo] Procesando ${rows.length} filas...`);
      
      return this.parsePasivoSheet(rows);
      
    } catch (error) {
      console.error('❌ [Pasivo] Error obteniendo datos:', error);
      return [];
    }
  }
  
  /**
   * Parser específico para la hoja "Pasivo" que tiene estructura de filas
   * con columnas: Detalle, Subtipo, Mes, Año, ..., Concepto/Detalle, ..., Monto Total USD
   */
  private parsePasivoSheet(rows: any[][]): ProvisionRow[] {
    if (rows.length < 2) return [];
    
    const result: ProvisionRow[] = [];
    const headerRow = rows[0];
    
    console.log(`📊 [pasivo] Headers: ${headerRow.slice(0, 15).join(', ')}...`);
    
    // Encontrar índices de columnas importantes
    const findColIndex = (names: string[]): number => {
      for (let i = 0; i < headerRow.length; i++) {
        const header = (headerRow[i] || '').toString().toLowerCase().trim();
        if (names.some(n => header.includes(n.toLowerCase()))) return i;
      }
      return -1;
    };
    
    const mesColIdx = findColIndex(['mes']);
    const yearColIdx = findColIndex(['año', 'ano']);
    const conceptoColIdx = findColIndex(['concepto', 'detalle']);
    const montoUsdColIdx = findColIndex(['monto total usd', 'usd', 'total usd']);
    const detalleColIdx = 0; // Primera columna suele ser "Detalle"
    
    console.log(`📊 [pasivo] Columnas encontradas: Mes=${mesColIdx}, Año=${yearColIdx}, Concepto=${conceptoColIdx}, MontoUSD=${montoUsdColIdx}`);
    
    if (mesColIdx === -1 || yearColIdx === -1 || montoUsdColIdx === -1) {
      console.log(`⚠️ [pasivo] No se encontraron todas las columnas necesarias`);
      return [];
    }
    
    // Procesar cada fila
    for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      if (!row || row.length === 0) continue;
      
      // Obtener mes y año
      const mes = parseInt((row[mesColIdx] || '').toString().trim());
      const year = parseInt((row[yearColIdx] || '').toString().trim());
      
      if (isNaN(mes) || isNaN(year) || mes < 1 || mes > 12) continue;
      
      const periodKey = `${year}-${String(mes).padStart(2, '0')}`;
      
      // Obtener concepto (priorizar columna "Concepto/Detalle", sino usar "Detalle")
      let concept = '';
      if (conceptoColIdx >= 0 && row[conceptoColIdx]) {
        concept = row[conceptoColIdx].toString().trim();
      }
      if (!concept && row[detalleColIdx]) {
        concept = row[detalleColIdx].toString().trim();
      }
      
      if (!concept) continue;
      
      // Obtener monto USD
      const rawValue = row[montoUsdColIdx];
      let amount = this.parseProvisionAmount(rawValue);
      
      if (amount === 0) continue;
      
      // Detectar si es provisión
      const lowerConcept = concept.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const isProvision = this.isProvisionConcept(lowerConcept);
      const provisionKind = this.detectProvisionKind(lowerConcept, 'pasivo');
      
      result.push({
        periodKey,
        concept,
        source: 'pasivo',
        amountUsd: amount,
        isProvision,
        provisionKind,
        rawValue: rawValue?.toString() || ''
      });
    }
    
    console.log(`✅ [pasivo] Extraídos ${result.length} registros`);
    
    // Log summary por período
    const byPeriod = new Map<string, number>();
    for (const r of result) {
      byPeriod.set(r.periodKey, (byPeriod.get(r.periodKey) || 0) + r.amountUsd);
    }
    for (const [period, total] of byPeriod) {
      console.log(`  📊 [pasivo] ${period}: USD ${total.toFixed(2)}`);
    }
    
    return result;
  }

  /**
   * Parser genérico para hojas de provisiones
   * Detecta columnas de meses y extrae montos por período
   */
  private parseProvisionSheet(rows: any[][], source: string): ProvisionRow[] {
    if (rows.length < 2) return [];
    
    const result: ProvisionRow[] = [];
    const headerRow = rows[0];
    
    console.log(`📊 [${source}] Headers: ${headerRow.slice(0, 15).join(', ')}...`);
    
    // Encontrar columnas de meses (ej: "Oct 2024", "oct-24", "2024-10", etc.)
    const monthColumns: { index: number; periodKey: string; label: string }[] = [];
    
    for (let col = 0; col < headerRow.length; col++) {
      const header = (headerRow[col] || '').toString().trim();
      const parsed = this.parseMonthLabel(header);
      if (parsed) {
        const periodKey = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
        monthColumns.push({ index: col, periodKey, label: header });
      }
    }
    
    console.log(`📊 [${source}] Encontradas ${monthColumns.length} columnas de meses`);
    if (monthColumns.length > 0) {
      console.log(`📊 [${source}] Meses: ${monthColumns.map(m => m.periodKey).join(', ')}`);
    }
    
    // Encontrar columna de concepto/descripción (primera columna textual)
    const conceptCol = 0;
    
    // Procesar cada fila de datos
    for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      if (!row || row.length === 0) continue;
      
      const concept = (row[conceptCol] || '').toString().trim();
      if (!concept) continue;
      
      // Detectar si es una provisión conocida
      const lowerConcept = concept.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const isProvision = this.isProvisionConcept(lowerConcept);
      const provisionKind = this.detectProvisionKind(lowerConcept, source);
      
      // Extraer montos para cada mes
      for (const monthCol of monthColumns) {
        const rawValue = row[monthCol.index];
        let amount = this.parseProvisionAmount(rawValue);
        
        if (amount !== 0) {
          // PROTECCIÓN: Valores mayores a $100,000 USD por concepto son probablemente ARS
          // Usar tipo de cambio aproximado para convertir
          const MAX_REASONABLE_USD = 100000;
          const APPROX_FX = 1300; // Tipo de cambio aproximado ARS/USD
          
          if (Math.abs(amount) > MAX_REASONABLE_USD) {
            console.log(`⚠️ [${source}] Valor alto detectado: ${concept} = ${amount.toFixed(2)}, asumiendo ARS → USD ${(amount / APPROX_FX).toFixed(2)}`);
            amount = amount / APPROX_FX;
          }
          
          result.push({
            periodKey: monthCol.periodKey,
            concept,
            source,
            amountUsd: amount,
            isProvision,
            provisionKind,
            rawValue: rawValue?.toString() || ''
          });
        }
      }
    }
    
    console.log(`✅ [${source}] Extraídos ${result.length} registros de provisiones`);
    
    // Log summary por período
    const byPeriod = new Map<string, number>();
    for (const r of result) {
      byPeriod.set(r.periodKey, (byPeriod.get(r.periodKey) || 0) + r.amountUsd);
    }
    for (const [period, total] of byPeriod) {
      console.log(`  📊 ${period}: USD ${total.toFixed(2)}`);
    }
    
    return result;
  }

  /**
   * Detectar si un concepto es una provisión contable
   * NOTA: pepsico y warner son CLIENTES REALES, no categorías de provisiones
   */
  private isProvisionConcept(text: string): boolean {
    const provisionPatterns = [
      'provision', 'provisión',
      'impuesto', 'tax', 'iva',
      'pasivo', 'diferido',
      'reserva', 'contingencia',
      'percepcion',
      'devengado contable'
    ];
    
    return provisionPatterns.some(p => text.includes(p));
  }

  /**
   * Detectar el tipo específico de provisión
   * NOTA: pepsico y warner son clientes reales, usar 'cliente' para provisiones de clientes
   */
  private detectProvisionKind(text: string, source: string): string {
    if (text.includes('impuesto usa') || text.includes('tax usa') || text.includes('usa')) return 'impuestos_usa';
    if (text.includes('iva')) return 'iva';
    if (source === 'impuestos') return 'impuestos';
    if (source === 'provision_cliente') return 'cliente';
    if (text.includes('provision') || text.includes('pasivo')) return 'provision';
    return 'otros';
  }

  /**
   * Parsear monto de provisión (maneja formatos como "$1.234,56", "1234.56", "13.413", etc.)
   * IMPORTANTE: Detecta formato europeo/argentino donde el punto es separador de miles
   */
  private parseProvisionAmount(value: any): number {
    if (value === null || value === undefined || value === '') return 0;
    
    const str = value.toString().trim();
    if (!str) return 0;
    
    // Detectar si es negativo (paréntesis o signo menos)
    const isNegative = str.startsWith('-') || str.startsWith('(') || str.endsWith(')');
    
    // Remover símbolos de moneda, espacios, paréntesis
    let cleaned = str.replace(/[$€\s()]/g, '');
    // Remover el signo menos para procesamiento
    cleaned = cleaned.replace(/^-/, '');
    
    // CASO 1: Formato europeo completo con coma decimal: "1.234,56" o "13.413,00"
    const hasCommaDecimal = /^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(cleaned);
    
    // CASO 2: Formato US con punto decimal: "1,234.56"
    const hasDotDecimal = /^\d{1,3}(,\d{3})*\.\d{1,2}$/.test(cleaned);
    
    // CASO 3: Formato europeo SIN decimales: "13.413" (punto como separador de miles)
    // Detecta patrones como "X.XXX" o "XX.XXX" donde después del punto hay exactamente 3 dígitos
    const isEuropeanThousands = /^\d{1,3}(\.\d{3})+$/.test(cleaned);
    
    // CASO 4: Número simple con punto decimal: "13.41" (2 o menos dígitos después del punto)
    const isSimpleDecimal = /^\d+\.\d{1,2}$/.test(cleaned);
    
    console.log(`  🔢 parseProvisionAmount: "${str}" → cleaned="${cleaned}"`);
    console.log(`     hasCommaDecimal=${hasCommaDecimal}, hasDotDecimal=${hasDotDecimal}, isEuropeanThousands=${isEuropeanThousands}, isSimpleDecimal=${isSimpleDecimal}`);
    
    if (hasCommaDecimal) {
      // Formato europeo con decimales: 1.234,56 → 1234.56
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      console.log(`     → Formato europeo con decimales: ${cleaned}`);
    } else if (hasDotDecimal) {
      // Formato US: 1,234.56 → 1234.56
      cleaned = cleaned.replace(/,/g, '');
      console.log(`     → Formato US: ${cleaned}`);
    } else if (isEuropeanThousands) {
      // Formato europeo SIN decimales: 13.413 → 13413
      cleaned = cleaned.replace(/\./g, '');
      console.log(`     → Formato europeo miles sin decimales: ${cleaned}`);
    } else if (isSimpleDecimal) {
      // Número simple con decimales: 13.41 → 13.41 (sin cambios)
      console.log(`     → Número simple decimal: ${cleaned}`);
    } else if (cleaned.includes(',') && !cleaned.includes('.')) {
      // Coma como decimal sin miles: "13,41" → "13.41"
      cleaned = cleaned.replace(',', '.');
      console.log(`     → Coma como decimal: ${cleaned}`);
    }
    
    const num = parseFloat(cleaned);
    if (isNaN(num)) {
      console.log(`     ❌ No es un número válido`);
      return 0;
    }
    
    const result = isNegative ? -num : num;
    console.log(`     ✅ Resultado: ${result}`);
    return result;
  }

  /**
   * Listar todas las hojas disponibles en el Excel MAESTRO (para diagnóstico)
   */
  async listAvailableSheets(): Promise<string[]> {
    console.log('🔍 [DEBUG] Listando hojas disponibles en el Excel MAESTRO...');
    try {
      const sheets = this.createSheetsClientFromJSON();
      if (!sheets) {
        console.warn('⚠️ Google Sheets client not available, returning empty sheet list');
        return [];
      }
      const response = await sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
        fields: 'sheets.properties.title'
      });
      
      const sheetNames = response.data.sheets?.map(s => s.properties?.title || 'unknown') || [];
      console.log(`🔍 [DEBUG] Hojas encontradas (${sheetNames.length}):`);
      for (const name of sheetNames) {
        console.log(`   - "${name}"`);
      }
      
      // Verificar si existe "Cuentas a Cobrar"
      const cuentasSheet = sheetNames.find(n => n.toLowerCase().includes('cuentas') && n.toLowerCase().includes('cobrar'));
      if (cuentasSheet) {
        console.log(`✅ [DEBUG] Hoja de cuentas a cobrar encontrada: "${cuentasSheet}"`);
      } else {
        console.log(`❌ [DEBUG] NO se encontró hoja de "Cuentas a Cobrar" en el Excel MAESTRO`);
        console.log(`   Hojas con "cuentas": ${sheetNames.filter(n => n.toLowerCase().includes('cuentas')).join(', ') || 'ninguna'}`);
      }
      
      return sheetNames;
    } catch (error: any) {
      console.error('❌ [DEBUG] Error listando hojas:', error?.message || error);
      return [];
    }
  }

  /**
   * Obtener datos de la hoja "Cuentas a Cobrar (contable)"
   * Extrae facturas futuras que se convierten en provisiones para el período actual
   * REGLA: Factura de mes futuro = provisión de ingresos anticipados
   */
  async getCuentasACobrar(targetPeriod?: string): Promise<CuentaCobrarRow[]> {
    console.log('🔍 [getCuentasACobrar] INICIO DE FUNCIÓN');
    try {
      // Primero listar hojas disponibles para diagnóstico
      const availableSheets = await this.listAvailableSheets();
      
      // Buscar el nombre correcto de la hoja
      const cuentasSheet = availableSheets.find(n => 
        n.toLowerCase().includes('cuentas') && n.toLowerCase().includes('cobrar')
      );
      
      if (!cuentasSheet) {
        console.error('❌ [getCuentasACobrar] NO existe la hoja "Cuentas a Cobrar" en el Excel MAESTRO');
        console.log('   Las hojas disponibles son:');
        for (const sheet of availableSheets) {
          console.log(`      - "${sheet}"`);
        }
        return [];
      }
      
      const sheets = this.createSheetsClientFromJSON();
      if (!sheets) {
        console.warn('⚠️ Google Sheets client not available, returning empty cuentas data');
        return [];
      }
      const range = `'${cuentasSheet}'!A:Z`;

      console.log('📊 [Cuentas a Cobrar] Obteniendo datos del Excel MAESTRO...');
      console.log(`📊 [Cuentas a Cobrar] SpreadsheetId: ${this.spreadsheetId}`);
      console.log(`📊 [Cuentas a Cobrar] Range: ${range}`);
      console.log(`📊 [Cuentas a Cobrar] Target period: ${targetPeriod || 'current'}`);
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: range,
        valueRenderOption: 'FORMATTED_VALUE',
      });

      const rows = response.data.values;
      
      console.log(`📊 [Cuentas a Cobrar] Response received, rows: ${rows ? rows.length : 'null/undefined'}`);
      
      if (!rows || rows.length === 0) {
        console.log('⚠️ [Cuentas a Cobrar] No se encontraron datos en la hoja');
        return [];
      }

      console.log(`📊 [Cuentas a Cobrar] Procesando ${rows.length} filas...`);
      console.log(`📊 [Cuentas a Cobrar] Primera fila (headers): ${JSON.stringify(rows[0]?.slice(0, 10))}`);
      
      const result = this.parseCuentasACobrarSheet(rows, targetPeriod);
      console.log(`📊 [Cuentas a Cobrar] Parseadas ${result.length} facturas, ${result.filter(r => r.isProvision).length} son provisiones`);
      
      return result;
      
    } catch (error: any) {
      console.error('❌ [Cuentas a Cobrar] Error obteniendo datos:', error?.message || error);
      console.error('❌ [Cuentas a Cobrar] Stack:', error?.stack);
      return [];
    }
  }

  /**
   * Parser para hoja "Cuentas a Cobrar (contable)"
   * Estructura típica: Cliente, Factura, Fecha, Vencimiento, Monto USD, Monto ARS, Estado
   * REGLA: Si fecha factura > período target, es una provisión de ingresos anticipados
   */
  private parseCuentasACobrarSheet(rows: any[][], targetPeriod?: string): CuentaCobrarRow[] {
    if (rows.length < 2) return [];
    
    const result: CuentaCobrarRow[] = [];
    const headerRow = rows[0];
    
    console.log(`📊 [cuentas_cobrar] Headers: ${headerRow.slice(0, 12).join(', ')}...`);
    
    // Encontrar índices de columnas importantes
    const findColIndex = (names: string[]): number => {
      for (let i = 0; i < headerRow.length; i++) {
        const header = (headerRow[i] || '').toString().toLowerCase().trim();
        if (names.some(n => header.includes(n.toLowerCase()))) return i;
      }
      return -1;
    };
    
    const clienteColIdx = findColIndex(['cliente', 'client', 'razon social']);
    const facturaColIdx = findColIndex(['factura', 'invoice', 'nro', 'número']);
    const fechaColIdx = findColIndex(['fecha', 'date', 'emision']);
    const vencimientoColIdx = findColIndex(['vencimiento', 'vence', 'due date']);
    const montoUsdColIdx = findColIndex(['usd', 'dolar', 'dollar', 'monto usd', 'importe usd']);
    const montoArsColIdx = findColIndex(['ars', 'pesos', 'monto ars', 'importe ars']);
    const estadoColIdx = findColIndex(['estado', 'status', 'situacion']);
    
    console.log(`📊 [cuentas_cobrar] Columnas: Cliente=${clienteColIdx}, Fecha=${fechaColIdx}, MontoUSD=${montoUsdColIdx}, MontoARS=${montoArsColIdx}`);
    
    // Determinar período target (por defecto, mes actual)
    const now = new Date();
    const currentPeriod = targetPeriod || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [targetYear, targetMonth] = currentPeriod.split('-').map(n => parseInt(n));
    
    console.log(`📊 [cuentas_cobrar] Período target: ${currentPeriod}`);
    
    // Procesar cada fila
    for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      if (!row || row.length === 0) continue;
      
      // Obtener cliente
      const cliente = (row[clienteColIdx] || '').toString().trim();
      if (!cliente) continue;
      
      // Obtener fecha de factura
      const fechaRaw = fechaColIdx >= 0 ? (row[fechaColIdx] || '').toString().trim() : '';
      const fechaVencRaw = vencimientoColIdx >= 0 ? (row[vencimientoColIdx] || '').toString().trim() : '';
      
      // Parsear fecha de factura
      const fechaFactura = this.parseDate(fechaRaw);
      const fechaVencimiento = this.parseDate(fechaVencRaw);
      
      // Extraer montos
      const montoUsdRaw = montoUsdColIdx >= 0 ? row[montoUsdColIdx] : '';
      const montoArsRaw = montoArsColIdx >= 0 ? row[montoArsColIdx] : '';
      
      const montoUsd = this.parseProvisionAmount(montoUsdRaw);
      const montoArs = this.parseProvisionAmount(montoArsRaw);
      
      // Si no hay monto, saltar
      if (montoUsd === 0 && montoArs === 0) continue;
      
      // Determinar moneda primaria
      const currency: 'USD' | 'ARS' = montoUsd > 0 ? 'USD' : 'ARS';
      
      // Determinar período de la factura
      let facturaPeriod = currentPeriod;
      if (fechaFactura) {
        facturaPeriod = `${fechaFactura.getFullYear()}-${String(fechaFactura.getMonth() + 1).padStart(2, '0')}`;
      }
      
      // REGLA: Factura de mes POSTERIOR al período target = PROVISIÓN
      // Esto es porque si la factura es de diciembre y estamos en octubre,
      // es un ingreso anticipado que debe provisionarse
      let isProvision = false;
      if (fechaFactura) {
        const facturaYear = fechaFactura.getFullYear();
        const facturaMonth = fechaFactura.getMonth() + 1;
        isProvision = facturaYear > targetYear || 
                     (facturaYear === targetYear && facturaMonth > targetMonth);
      }
      
      const estado = estadoColIdx >= 0 ? (row[estadoColIdx] || '').toString().trim() : '';
      
      result.push({
        periodKey: facturaPeriod,
        cliente,
        factura: facturaColIdx >= 0 ? (row[facturaColIdx] || '').toString().trim() : undefined,
        fechaFactura,
        fechaVencimiento,
        montoUsd,
        montoArs,
        currency,
        status: estado,
        isProvision,
        rawValue: (montoUsdRaw || montoArsRaw || '').toString()
      });
      
      if (isProvision) {
        console.log(`  💰 [cuentas_cobrar] PROVISIÓN DETECTADA: ${cliente} | ${facturaPeriod} | USD ${montoUsd.toFixed(2)}`);
      }
    }
    
    // Resumen de provisiones encontradas
    const provisionesCliente = new Map<string, number>();
    for (const r of result.filter(r => r.isProvision)) {
      const key = r.cliente.toLowerCase();
      provisionesCliente.set(key, (provisionesCliente.get(key) || 0) + r.montoUsd);
    }
    
    console.log(`✅ [cuentas_cobrar] Total ${result.length} facturas, ${result.filter(r => r.isProvision).length} son provisiones`);
    for (const [cliente, total] of provisionesCliente) {
      console.log(`  📊 [cuentas_cobrar] PROVISIÓN ${cliente}: USD ${total.toFixed(2)}`);
    }
    
    return result;
  }

  /**
   * Parsear fecha en varios formatos
   */
  private parseDate(value: string): Date | undefined {
    if (!value || !value.trim()) return undefined;
    
    const str = value.trim();
    
    // Formato DD/MM/YYYY o DD-MM-YYYY
    let match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (match) {
      const day = parseInt(match[1]);
      const month = parseInt(match[2]);
      const year = parseInt(match[3]);
      return new Date(year, month - 1, day);
    }
    
    // Formato YYYY-MM-DD
    match = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (match) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]);
      const day = parseInt(match[3]);
      return new Date(year, month - 1, day);
    }
    
    // Formato MM/DD/YYYY (US)
    match = str.match(/^(\d{1,2})[\/](\d{1,2})[\/](\d{4})$/);
    if (match) {
      const potentialMonth = parseInt(match[1]);
      const potentialDay = parseInt(match[2]);
      const year = parseInt(match[3]);
      // Si el primer número es > 12, es DD/MM/YYYY
      if (potentialMonth > 12) {
        return new Date(year, potentialDay - 1, potentialMonth);
      }
      // Si el segundo número es > 12, es MM/DD/YYYY
      if (potentialDay > 12) {
        return new Date(year, potentialMonth - 1, potentialDay);
      }
      // Ambiguo, asumir DD/MM/YYYY (más común en Argentina)
      return new Date(year, potentialDay - 1, potentialMonth);
    }
    
    // Intentar parse nativo
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
    
    return undefined;
  }

  /**
   * Obtener provisiones de "Impuestos USA" desde Resumen Ejecutivo
   * Devuelve ProvisionRow[] compatible con el sistema de provisiones
   */
  async getImpuestosUsaFromResumenEjecutivo(): Promise<ProvisionRow[]> {
    try {
      const resumen = await this.getResumenEjecutivo();
      const result: ProvisionRow[] = [];
      
      for (const row of resumen) {
        if (row.impuestosUsa && row.impuestosUsa > 0) {
          result.push({
            periodKey: row.periodKey,
            concept: 'PROVISIÓN IMPUESTO USA',
            source: 'resumen_ejecutivo',
            amountUsd: row.impuestosUsa,
            isProvision: true,
            provisionKind: 'impuestos_usa',
            rawValue: row.impuestosUsa.toString()
          });
          console.log(`  ✅ [Resumen Ejecutivo] ${row.periodKey}: IMPUESTOS USA = USD ${row.impuestosUsa.toFixed(2)}`);
        }
      }
      
      console.log(`📊 [Resumen Ejecutivo] Extraídos ${result.length} registros de Impuestos USA`);
      return result;
      
    } catch (error) {
      console.error('❌ Error obteniendo Impuestos USA:', error);
      return [];
    }
  }

  /**
   * Obtener provisiones de "Facturación Adelantada" desde Resumen Ejecutivo
   * Columna: "Provisión Pasivo Costos Facturación Adelantada"
   * Devuelve ProvisionRow[] compatible con el sistema de provisiones
   */
  async getFacturacionAdelantadaFromResumenEjecutivo(): Promise<ProvisionRow[]> {
    try {
      const resumen = await this.getResumenEjecutivo();
      const result: ProvisionRow[] = [];
      
      for (const row of resumen) {
        if (row.facturacionAdelantadaUsd && row.facturacionAdelantadaUsd !== 0) {
          result.push({
            periodKey: row.periodKey,
            concept: 'PROVISIÓN FACTURACIÓN ADELANTADA',
            source: 'resumen_ejecutivo',
            amountUsd: row.facturacionAdelantadaUsd,
            isProvision: true,
            provisionKind: 'facturacion_adelantada',
            rawValue: row.facturacionAdelantadaUsd.toString()
          });
          console.log(`  ✅ [Resumen Ejecutivo] ${row.periodKey}: FACTURACIÓN ADELANTADA = USD ${row.facturacionAdelantadaUsd.toFixed(2)}`);
        }
      }
      
      console.log(`📊 [Resumen Ejecutivo] Extraídos ${result.length} registros de Facturación Adelantada`);
      return result;
      
    } catch (error) {
      console.error('❌ Error obteniendo Facturación Adelantada:', error);
      return [];
    }
  }

  /**
   * Obtener provisiones de facturas futuras (ingresos anticipados) desde la hoja "Activo"
   * Las "Cuentas a Cobrar" están en la hoja "Activo" como Tipo de Activo = "Clientes a cobrar"
   * 
   * REGLA DE PROVISIÓN:
   * - Facturas de meses FUTUROS (después del período target) = provisiones de ingresos anticipados
   * - Solo facturas NO cobradas (Cobrado = "No")
   */
  async getWarnerProvisionFromCuentasCobrar(targetPeriod: string): Promise<ProvisionRow[]> {
    console.log(`🔍 [getWarnerProvisionFromActivo] ENTRADA - período: ${targetPeriod}`);
    try {
      const sheets = this.createSheetsClientFromJSON();
      if (!sheets) {
        console.warn('⚠️ Google Sheets client not available, returning empty provision data');
        return [];
      }

      // Leer hoja "Activo"
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: "'Activo'!A:U",
        valueRenderOption: 'FORMATTED_VALUE',
      });
      
      const rows = response.data.values || [];
      if (rows.length < 2) {
        console.log('⚠️ [Activo] No hay datos en la hoja Activo');
        return [];
      }
      
      const headers = rows[0] || [];
      console.log(`📊 [Activo] Headers: ${headers.slice(0, 5).join(', ')}...`);
      
      // Encontrar índices de columnas
      const findColIdx = (patterns: string[]): number => {
        for (let i = 0; i < headers.length; i++) {
          const h = (headers[i] || '').toString().toLowerCase();
          if (patterns.some(p => h.includes(p))) return i;
        }
        return -1;
      };
      
      const tipoIdx = findColIdx(['tipo']);
      const clienteIdx = findColIdx(['cliente']);
      const mesIdx = 3; // Columna D = Mes
      const anioIdx = 4; // Columna E = Año
      const cobradoIdx = findColIdx(['cobrado']);
      const usdIdx = findColIdx(['usd']);
      
      console.log(`📊 [Activo] Columnas: tipo=${tipoIdx}, cliente=${clienteIdx}, mes=${mesIdx}, año=${anioIdx}, cobrado=${cobradoIdx}, usd=${usdIdx}`);
      
      // Parsear período target
      const [targetYear, targetMonth] = targetPeriod.split('-').map(n => parseInt(n));
      
      // Mapeo de nombres de mes a número
      const mesMap: Record<string, number> = {
        'ene': 1, 'feb': 2, 'mar': 3, 'abr': 4, 'may': 5, 'jun': 6,
        'jul': 7, 'ago': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dic': 12
      };
      
      // Procesar filas buscando facturas futuras de Warner no cobradas
      const result: ProvisionRow[] = [];
      const porCliente = new Map<string, number>();
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        
        const tipo = (row[tipoIdx] || '').toString().toLowerCase();
        const cliente = (row[clienteIdx] || '').toString().toLowerCase();
        const cobrado = (row[cobradoIdx] || '').toString().toLowerCase();
        const mesRaw = (row[mesIdx] || '').toString().toLowerCase();
        const anioRaw = (row[anioIdx] || '').toString();
        const usdRaw = (row[usdIdx] || '').toString();
        
        // Solo procesar "Clientes a cobrar" no cobrados
        if (!tipo.includes('cobrar') || cobrado !== 'no') continue;
        
        // Parsear mes y año del registro
        const mesMatch = mesRaw.match(/(\d+)\s*(\w+)/);
        let rowMonth = 0;
        let rowYear = 0;
        
        if (mesMatch) {
          const mesNum = parseInt(mesMatch[1]);
          const mesNombre = mesMatch[2].substring(0, 3);
          rowMonth = mesMap[mesNombre] || mesNum;
        }
        
        rowYear = parseInt(anioRaw) || 0;
        
        // Verificar si es factura FUTURA (después del período target)
        const isFuture = (rowYear > targetYear) || 
                         (rowYear === targetYear && rowMonth > targetMonth);
        
        if (!isFuture) continue;
        
        // Parsear monto USD (formato argentino: $29.230,00 → 29230.00)
        const usdClean = usdRaw
          .replace(/\$/g, '')
          .replace(/\./g, '')  // Quitar separador de miles
          .replace(/,/g, '.')  // Convertir coma decimal a punto
          .trim();
        const usd = parseFloat(usdClean) || 0;
        
        if (usd > 0) {
          const key = cliente.toLowerCase();
          porCliente.set(key, (porCliente.get(key) || 0) + usd);
          console.log(`  📌 [Activo] Factura futura: ${cliente} ${mesRaw} ${anioRaw} = USD ${usd.toFixed(2)} (raw: "${usdRaw}")`);
        }
      }
      
      // Convertir a ProvisionRow
      for (const [cliente, total] of porCliente) {
        if (total > 0) {
          result.push({
            periodKey: targetPeriod,
            concept: `PROVISIÓN ${cliente.toUpperCase()} (INGRESOS ANTICIPADOS)`,
            source: 'activo',
            amountUsd: total,
            isProvision: true,
            provisionKind: cliente.includes('warner') ? 'warner' : 'cliente',
            rawValue: total.toString()
          });
          console.log(`  ✅ [Activo] ${targetPeriod}: PROVISIÓN ${cliente.toUpperCase()} = USD ${total.toFixed(2)}`);
        }
      }
      
      console.log(`📊 [Activo] Extraídas ${result.length} provisiones de facturas futuras`);
      return result;
      
    } catch (error: any) {
      console.error('❌ [getWarnerProvisionFromActivo] Error:', error?.message || error);
      console.error('❌ [getWarnerProvisionFromActivo] Stack:', error?.stack);
      return [];
    }
  }

  /**
   * Obtener movimientos de Cash Flow del Excel MAESTRO
   * Lee la hoja "CashFlow" y devuelve transacciones individuales
   * 
   * COLUMNAS ESPERADAS:
   * - Fecha
   * - Banco
   * - Concepto (o Detalle Operación como fallback)
   * - Ingreso/Egreso (filtrar: solo "Ingreso" o "Egreso", ignorar "Saldo")
   * - Moneda
   * - Monto USD
   * - Monto ARS
   * - Cotización
   */
  async getCashFlowMovements(): Promise<CashFlowMovementRow[]> {
    console.log('🔄 [CashFlow ETL] Obteniendo movimientos del Excel MAESTRO...');
    
    try {
      const sheets = this.createSheetsClientFromJSON();
      if (!sheets) {
        console.warn('⚠️ Google Sheets client not available, returning empty cash flow data');
        return [];
      }

      // Intentar varios nombres posibles para la hoja
      const possibleSheetNames = [
        'CashFlow',
        'Cash Flow',
        'Cashflow',
        'Flujo de Caja',
        'Flujo Caja',
        'Movimientos Caja',
        'Caja'
      ];
      
      // Primero obtener lista de hojas disponibles
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });
      
      const availableSheets = spreadsheet.data.sheets?.map(s => s.properties?.title || '') || [];
      console.log(`📋 [CashFlow ETL] Hojas disponibles: ${availableSheets.join(', ')}`);
      
      // Buscar hoja de CashFlow
      const cashFlowSheet = possibleSheetNames.find(name => 
        availableSheets.some(sheet => 
          sheet.toLowerCase().trim() === name.toLowerCase().trim()
        )
      );
      
      if (!cashFlowSheet) {
        console.log('⚠️ [CashFlow ETL] No se encontró hoja de CashFlow');
        console.log('⚠️ [CashFlow ETL] Posibles hojas:', availableSheets.slice(0, 10).join(', '));
        return [];
      }
      
      // Encontrar el nombre exacto de la hoja
      const exactSheetName = availableSheets.find(sheet => 
        sheet.toLowerCase().trim() === cashFlowSheet.toLowerCase().trim()
      );
      
      console.log(`📊 [CashFlow ETL] Leyendo hoja: "${exactSheetName}"`);
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `'${exactSheetName}'!A:Z`,
        valueRenderOption: 'FORMATTED_VALUE',
      });
      
      const rows = response.data.values || [];
      if (rows.length < 2) {
        console.log('⚠️ [CashFlow ETL] No hay datos en la hoja');
        return [];
      }
      
      // Parsear filas con la nueva lógica
      return this.parseCashFlowRowsV2(rows);
      
    } catch (error: any) {
      console.error('❌ [CashFlow ETL] Error obteniendo datos:', error?.message || error);
      return [];
    }
  }
  
  /**
   * Parser V2 para CashFlow con columnas específicas:
   * Fecha, Banco, Concepto, Ingreso/Egreso, Moneda, Monto USD, Monto ARS, Cotización
   */
  private parseCashFlowRowsV2(rows: any[][]): CashFlowMovementRow[] {
    if (rows.length < 2) return [];
    
    const headers = rows[0] || [];
    const result: CashFlowMovementRow[] = [];
    
    // Mapeo de columnas (flexible)
    const findColIdx = (patterns: string[]): number => {
      for (let i = 0; i < headers.length; i++) {
        const h = (headers[i] || '').toString().toLowerCase().trim();
        if (patterns.some(p => h.includes(p))) return i;
      }
      return -1;
    };
    
    // Columnas según especificación del usuario
    const fechaIdx = findColIdx(['fecha', 'date']);
    const bancoIdx = findColIdx(['banco', 'bank']);
    const conceptoIdx = findColIdx(['concepto', 'concept']);
    const detalleOpIdx = findColIdx(['detalle operacion', 'detalle operación', 'detalle']);
    const ingresoEgresoIdx = findColIdx(['ingreso/egreso', 'ingreso egreso', 'tipo movimiento', 'tipo']);
    const monedaIdx = findColIdx(['moneda', 'currency']);
    const montoUsdIdx = findColIdx(['monto usd', 'usd', 'dolares']);
    const montoArsIdx = findColIdx(['monto ars', 'ars', 'pesos']);
    const cotizacionIdx = findColIdx(['cotización', 'cotizacion', 'tipo cambio', 'tc']);
    
    // V3: Use Mes and Año columns for period determination (matches admin dashboard logic)
    const mesIdx = findColIdx(['mes']);
    const anioIdx = findColIdx(['año', 'ano', 'year']);
    
    console.log(`📊 [CashFlow ETL V3] Columnas detectadas:`);
    console.log(`   Fecha=${fechaIdx}, Mes=${mesIdx}, Año=${anioIdx}`);
    console.log(`   Banco=${bancoIdx}, Concepto=${conceptoIdx}, Detalle=${detalleOpIdx}`);
    console.log(`   Ingreso/Egreso=${ingresoEgresoIdx}`);
    console.log(`   Moneda=${monedaIdx}, MontoUSD=${montoUsdIdx}, MontoARS=${montoArsIdx}, Cotiz=${cotizacionIdx}`);
    
    // Mapa para convertir "10 oct" → 10
    const monthMap: Record<string, number> = {
      'ene': 1, 'enero': 1, 'jan': 1, '01': 1, '1': 1, '1 ene': 1, '01 ene': 1,
      'feb': 2, 'febrero': 2, '02': 2, '2': 2, '2 feb': 2, '02 feb': 2,
      'mar': 3, 'marzo': 3, '03': 3, '3': 3, '3 mar': 3, '03 mar': 3,
      'abr': 4, 'abril': 4, 'apr': 4, '04': 4, '4': 4, '4 abr': 4, '04 abr': 4,
      'may': 5, 'mayo': 5, '05': 5, '5': 5, '5 may': 5, '05 may': 5,
      'jun': 6, 'junio': 6, '06': 6, '6': 6, '6 jun': 6, '06 jun': 6,
      'jul': 7, 'julio': 7, '07': 7, '7': 7, '7 jul': 7, '07 jul': 7,
      'ago': 8, 'agosto': 8, 'aug': 8, '08': 8, '8': 8, '8 ago': 8, '08 ago': 8,
      'sep': 9, 'septiembre': 9, 'sept': 9, '09': 9, '9': 9, '9 sep': 9, '09 sep': 9,
      'oct': 10, 'octubre': 10, '10': 10, '10 oct': 10,
      'nov': 11, 'noviembre': 11, '11': 11, '11 nov': 11,
      'dic': 12, 'diciembre': 12, 'dec': 12, '12': 12, '12 dic': 12,
    };
    
    // Helper to parse "Mes" column like "10 oct" or "01 ene" 
    const parseMonthFromMes = (mesRaw: string): number | null => {
      if (!mesRaw) return null;
      const lower = mesRaw.toLowerCase().trim();
      
      // Try direct lookup
      if (monthMap[lower]) return monthMap[lower];
      
      // Try extracting number from start (e.g., "10 oct" → 10)
      const match = lower.match(/^(\d{1,2})\s/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num >= 1 && num <= 12) return num;
      }
      
      // Try finding month name in string
      for (const [key, val] of Object.entries(monthMap)) {
        if (key.length >= 3 && lower.includes(key)) return val;
      }
      
      return null;
    };
    
    let processed = 0;
    let skippedSaldo = 0;
    let skippedNoAmount = 0;
    let skippedNoPeriod = 0;
    let arsConverted = 0;
    let usedMesAnio = 0;
    let usedFecha = 0;
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      
      // 1. Filtrar por Ingreso/Egreso - SOLO procesar "Ingreso" o "Egreso", ignorar "Saldo"
      const tipoRaw = ingresoEgresoIdx >= 0 ? (row[ingresoEgresoIdx] || '').toString().trim().toLowerCase() : '';
      
      if (tipoRaw !== 'ingreso' && tipoRaw !== 'egreso') {
        if (tipoRaw === 'saldo') {
          skippedSaldo++;
        }
        continue; // Skip filas que no son movimientos
      }
      
      // 2. Determine period using Mes + Año columns (PRIMARY) or Fecha (FALLBACK)
      let year: number | null = null;
      let month: number | null = null;
      let periodKey: string | null = null;
      let date: Date | null = null;
      
      // Always try to parse Fecha column for the date object
      if (fechaIdx >= 0) {
        const fechaRaw = (row[fechaIdx] || '').toString().trim();
        date = this.parseDateValue(fechaRaw);
      }
      
      // PRIMARY: Try Mes + Año columns first (matches admin dashboard behavior)
      if (mesIdx >= 0 && anioIdx >= 0) {
        const mesRaw = (row[mesIdx] || '').toString().trim();
        const anioRaw = (row[anioIdx] || '').toString().trim();
        
        const parsedMonth = parseMonthFromMes(mesRaw);
        const parsedYear = parseInt(anioRaw, 10);
        
        if (parsedMonth && parsedYear >= 2020 && parsedYear <= 2030) {
          year = parsedYear;
          month = parsedMonth;
          periodKey = `${year}-${String(month).padStart(2, '0')}`;
          usedMesAnio++;
          
          // If we don't have a date from Fecha column, construct one from Mes/Año (first day of month)
          if (!date) {
            date = new Date(parsedYear, parsedMonth - 1, 1);
          }
        }
      }
      
      // FALLBACK: If Mes/Año didn't work, try using date from Fecha column
      if (!periodKey && date) {
        year = date.getFullYear();
        month = date.getMonth() + 1;
        periodKey = `${year}-${String(month).padStart(2, '0')}`;
        usedFecha++;
      }
      
      if (!periodKey || !date) {
        skippedNoPeriod++;
        continue;
      }
      
      // 4. Extraer banco
      const bank = bancoIdx >= 0 ? (row[bancoIdx] || '').toString().trim() : undefined;
      
      // 5. Extraer moneda
      const currency = monedaIdx >= 0 ? (row[monedaIdx] || '').toString().trim().toUpperCase() : 'ARS';
      
      // 6. Extraer concepto (con fallback a Detalle Operación)
      let concept = conceptoIdx >= 0 ? (row[conceptoIdx] || '').toString().trim() : '';
      if (!concept && detalleOpIdx >= 0) {
        concept = (row[detalleOpIdx] || '').toString().trim();
      }
      if (!concept) concept = `Movimiento ${i}`;
      
      // 7. Calcular monto en USD
      let amountUsd: number | null = null;
      
      // Primero intentar Monto USD
      if (montoUsdIdx >= 0) {
        const montoUsdRaw = (row[montoUsdIdx] || '').toString().trim();
        const parsed = this.parseNumericValue(montoUsdRaw);
        if (parsed !== null && parsed !== 0) {
          amountUsd = Math.abs(parsed);
        }
      }
      
      // Si no hay USD, intentar ARS / Cotización
      if (amountUsd === null && montoArsIdx >= 0 && cotizacionIdx >= 0) {
        const montoArsRaw = (row[montoArsIdx] || '').toString().trim();
        const cotizRaw = (row[cotizacionIdx] || '').toString().trim();
        
        const montoArs = this.parseNumericValue(montoArsRaw);
        const cotiz = this.parseNumericValue(cotizRaw);
        
        if (montoArs !== null && cotiz !== null && cotiz > 0) {
          amountUsd = Math.abs(montoArs / cotiz);
          arsConverted++;
        }
      }
      
      if (amountUsd === null || amountUsd === 0) {
        skippedNoAmount++;
        console.log(`⚠️ [CashFlow ETL] Fila ${i+1} sin monto válido: concepto="${concept}"`);
        continue;
      }
      
      // 8. Determinar tipo: IN o OUT
      const type: 'IN' | 'OUT' = tipoRaw === 'ingreso' ? 'IN' : 'OUT';
      
      result.push({
        date,
        periodKey,
        bank: bank || undefined,
        currency: currency || undefined,
        concept,
        amountUsd: Math.round(amountUsd * 100) / 100,
        type,
      });
      processed++;
    }
    
    console.log(`✅ [CashFlow ETL V3] Parseados ${processed} movimientos`);
    console.log(`   💰 Ingresos (IN): ${result.filter(r => r.type === 'IN').length}`);
    console.log(`   💸 Egresos (OUT): ${result.filter(r => r.type === 'OUT').length}`);
    console.log(`   📅 Período vía Mes+Año: ${usedMesAnio}`);
    console.log(`   📆 Período vía Fecha: ${usedFecha}`);
    console.log(`   💱 Convertidos ARS→USD: ${arsConverted}`);
    console.log(`   ⏭️ Filas "Saldo" ignoradas: ${skippedSaldo}`);
    console.log(`   ⚠️ Filas sin monto válido: ${skippedNoAmount}`);
    console.log(`   ⚠️ Filas sin período válido: ${skippedNoPeriod}`);
    
    // Calculate totals by period for verification
    const totalsByPeriod = new Map<string, { in: number, out: number }>();
    for (const mov of result) {
      const existing = totalsByPeriod.get(mov.periodKey) || { in: 0, out: 0 };
      if (mov.type === 'IN') {
        existing.in += mov.amountUsd;
      } else {
        existing.out += mov.amountUsd;
      }
      totalsByPeriod.set(mov.periodKey, existing);
    }
    
    console.log(`   📊 Totales por período:`);
    Array.from(totalsByPeriod.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 5)
      .forEach(([period, totals]) => {
        console.log(`      ${period}: IN=$${totals.in.toFixed(2)}, OUT=$${totals.out.toFixed(2)}, NET=$${(totals.in - totals.out).toFixed(2)}`);
      });
    
    return result;
  }
  
  /**
   * Parsear valor numérico (formato argentino: $29.230,00 → 29230.00)
   */
  private parseNumericValue(raw: string): number | null {
    if (!raw) return null;
    
    const cleaned = raw
      .replace(/\$/g, '')
      .replace(/USD|ARS|U\$D/gi, '')
      .replace(/\./g, '')
      .replace(/,/g, '.')
      .replace(/\s/g, '')
      .trim();
    
    const val = parseFloat(cleaned);
    return isNaN(val) ? null : val;
  }

  /**
   * DEBUG FUNCTION: Analyze raw CashFlow sheet data for specific period
   * This helps identify discrepancies between sheet totals and ETL results
   */
  async debugCashFlowSheet(targetPeriod: string = '2025-10'): Promise<{
    rawAnalysis: {
      totalRows: number;
      uniqueTypes: Record<string, number>;
      totalIngresosUsd: number;
      totalEgresosUsd: number;
      netoHoja: number;
      periodRows: number;
    };
    issues: string[];
  }> {
    console.log(`\n🔍 [DEBUG_CASHFLOW_SHEET] Analyzing CashFlow sheet for ${targetPeriod}...`);
    
    const issues: string[] = [];
    
    try {
      const sheets = this.createSheetsClientFromJSON();
      if (!sheets) {
        console.warn('⚠️ Google Sheets client not available');
        return { rawAnalysis: { totalRows: 0, uniqueTypes: {}, totalIngresosUsd: 0, totalEgresosUsd: 0, netoHoja: 0, periodRows: 0 }, issues: ['Google Sheets client not available'] };
      }

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `'CashFlow'!A:Z`,
        valueRenderOption: 'FORMATTED_VALUE',
      });
      
      const rows = response.data.values || [];
      if (rows.length < 2) {
        return {
          rawAnalysis: { totalRows: 0, uniqueTypes: {}, totalIngresosUsd: 0, totalEgresosUsd: 0, netoHoja: 0, periodRows: 0 },
          issues: ['No data in CashFlow sheet']
        };
      }
      
      const headers = rows[0] || [];
      console.log(`   📋 Headers: ${headers.join(' | ')}`);
      
      // Find column indices
      const findColIdx = (patterns: string[]): number => {
        for (let i = 0; i < headers.length; i++) {
          const h = (headers[i] || '').toString().toLowerCase().trim();
          if (patterns.some(p => h.includes(p))) return i;
        }
        return -1;
      };
      
      const fechaIdx = findColIdx(['fecha', 'date']);
      const ingresoEgresoIdx = findColIdx(['ingreso/egreso', 'ingreso egreso', 'tipo movimiento', 'tipo']);
      const montoUsdIdx = findColIdx(['monto usd', 'usd', 'dolares']);
      const montoArsIdx = findColIdx(['monto ars', 'ars', 'pesos']);
      const cotizacionIdx = findColIdx(['cotización', 'cotizacion', 'tipo cambio', 'tc']);
      
      // V3: Use Mes and Año columns for period determination (matches admin dashboard logic)
      const mesIdx = findColIdx(['mes']);
      const anioIdx = findColIdx(['año', 'ano', 'year']);
      
      console.log(`   📊 Column indices: Fecha=${fechaIdx}, Mes=${mesIdx}, Año=${anioIdx}, IngresoEgreso=${ingresoEgresoIdx}, MontoUSD=${montoUsdIdx}, MontoARS=${montoArsIdx}, Cotiz=${cotizacionIdx}`);
      
      // Mapa para convertir "10 oct" → 10
      const monthMap: Record<string, number> = {
        'ene': 1, 'enero': 1, 'jan': 1, '01': 1, '1': 1, '1 ene': 1, '01 ene': 1,
        'feb': 2, 'febrero': 2, '02': 2, '2': 2, '2 feb': 2, '02 feb': 2,
        'mar': 3, 'marzo': 3, '03': 3, '3': 3, '3 mar': 3, '03 mar': 3,
        'abr': 4, 'abril': 4, 'apr': 4, '04': 4, '4': 4, '4 abr': 4, '04 abr': 4,
        'may': 5, 'mayo': 5, '05': 5, '5': 5, '5 may': 5, '05 may': 5,
        'jun': 6, 'junio': 6, '06': 6, '6': 6, '6 jun': 6, '06 jun': 6,
        'jul': 7, 'julio': 7, '07': 7, '7': 7, '7 jul': 7, '07 jul': 7,
        'ago': 8, 'agosto': 8, 'aug': 8, '08': 8, '8': 8, '8 ago': 8, '08 ago': 8,
        'sep': 9, 'septiembre': 9, 'sept': 9, '09': 9, '9': 9, '9 sep': 9, '09 sep': 9,
        'oct': 10, 'octubre': 10, '10': 10, '10 oct': 10,
        'nov': 11, 'noviembre': 11, '11': 11, '11 nov': 11,
        'dic': 12, 'diciembre': 12, 'dec': 12, '12': 12, '12 dic': 12,
      };
      
      // Helper to parse "Mes" column like "10 oct" or "01 ene" 
      const parseMonthFromMes = (mesRaw: string): number | null => {
        if (!mesRaw) return null;
        const lower = mesRaw.toLowerCase().trim();
        
        // Try direct lookup
        if (monthMap[lower]) return monthMap[lower];
        
        // Try extracting number from start (e.g., "10 oct" → 10)
        const match = lower.match(/^(\d{1,2})\s/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num >= 1 && num <= 12) return num;
        }
        
        // Try finding month name in string
        for (const [key, val] of Object.entries(monthMap)) {
          if (key.length >= 3 && lower.includes(key)) return val;
        }
        
        return null;
      };
      
      // Analyze ALL rows
      const uniqueTypes: Record<string, number> = {};
      let totalIngresosUsd = 0;
      let totalEgresosUsd = 0;
      let periodRows = 0;
      let rowsWithValidAmount = 0;
      let rowsConvertedFromArs = 0;
      let rowsViaMesAnio = 0;
      let rowsViaFecha = 0;
      
      const [targetYear, targetMonth] = targetPeriod.split('-').map(Number);
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        
        // Get raw type value exactly as it appears
        const tipoRaw = ingresoEgresoIdx >= 0 ? (row[ingresoEgresoIdx] || '').toString() : '';
        const tipoTrimmed = tipoRaw.trim();
        const tipoLower = tipoTrimmed.toLowerCase();
        
        // Track unique types (for debugging)
        if (tipoTrimmed) {
          uniqueTypes[tipoTrimmed] = (uniqueTypes[tipoTrimmed] || 0) + 1;
        }
        
        // Skip non-movement rows
        if (tipoLower !== 'ingreso' && tipoLower !== 'egreso') continue;
        
        // Determine period: PRIMARY = Mes + Año columns, FALLBACK = Fecha
        let rowYear: number | null = null;
        let rowMonth: number | null = null;
        
        // PRIMARY: Try Mes + Año columns first
        if (mesIdx >= 0 && anioIdx >= 0) {
          const mesRaw = (row[mesIdx] || '').toString().trim();
          const anioRaw = (row[anioIdx] || '').toString().trim();
          
          const parsedMonth = parseMonthFromMes(mesRaw);
          const parsedYear = parseInt(anioRaw, 10);
          
          if (parsedMonth && parsedYear >= 2020 && parsedYear <= 2030) {
            rowYear = parsedYear;
            rowMonth = parsedMonth;
            rowsViaMesAnio++;
          }
        }
        
        // FALLBACK: Try Fecha column
        if (!rowYear && fechaIdx >= 0) {
          const fechaRaw = (row[fechaIdx] || '').toString().trim();
          const date = this.parseDateValue(fechaRaw);
          if (date) {
            rowYear = date.getFullYear();
            rowMonth = date.getMonth() + 1;
            rowsViaFecha++;
          }
        }
        
        // Only analyze target period
        if (rowYear !== targetYear || rowMonth !== targetMonth) continue;
        
        periodRows++;
        
        // Calculate amount in USD
        let amountUsd: number | null = null;
        let source = '';
        
        // Try Monto USD first
        if (montoUsdIdx >= 0) {
          const montoUsdRaw = (row[montoUsdIdx] || '').toString().trim();
          const parsed = this.parseNumericValue(montoUsdRaw);
          if (parsed !== null && parsed !== 0) {
            amountUsd = parsed;
            source = 'USD';
          }
        }
        
        // Fallback to ARS / Cotización
        if (amountUsd === null && montoArsIdx >= 0 && cotizacionIdx >= 0) {
          const montoArsRaw = (row[montoArsIdx] || '').toString().trim();
          const cotizRaw = (row[cotizacionIdx] || '').toString().trim();
          
          const montoArs = this.parseNumericValue(montoArsRaw);
          const cotiz = this.parseNumericValue(cotizRaw);
          
          if (montoArs !== null && cotiz !== null && cotiz > 0) {
            amountUsd = montoArs / cotiz;
            source = 'ARS/Cotiz';
            rowsConvertedFromArs++;
          }
        }
        
        if (amountUsd === null || amountUsd === 0) {
          const conceptoRaw = (row[7] || row[6] || '').toString().trim();
          issues.push(`Row ${i+1}: No valid amount, type="${tipoTrimmed}", concepto="${conceptoRaw.substring(0, 30)}"`);
          continue;
        }
        
        rowsWithValidAmount++;
        
        // Classify and accumulate
        if (tipoLower === 'ingreso') {
          totalIngresosUsd += Math.abs(amountUsd);
        } else if (tipoLower === 'egreso') {
          totalEgresosUsd += Math.abs(amountUsd);
        } else if (tipoLower !== 'saldo') {
          // Unknown type that's not "Saldo"
          issues.push(`Row ${i+1}: Unknown type="${tipoTrimmed}" with amount=$${amountUsd.toFixed(2)}`);
        }
      }
      
      const netoHoja = totalIngresosUsd - totalEgresosUsd;
      
      console.log(`\n🔍 [DEBUG_CASHFLOW_SHEET_${targetPeriod.toUpperCase().replace('-', '')}] RESULTS:`);
      console.log(`   📊 Total rows in sheet: ${rows.length - 1}`);
      console.log(`   📊 Rows for ${targetPeriod}: ${periodRows}`);
      console.log(`   📊 Rows with valid amount: ${rowsWithValidAmount}`);
      console.log(`   📊 Rows converted from ARS: ${rowsConvertedFromArs}`);
      console.log(`   📋 Unique Ingreso/Egreso values:`);
      Object.entries(uniqueTypes).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
        console.log(`      "${type}": ${count}`);
      });
      console.log(`   💰 totalIngresosUsdHoja = $${totalIngresosUsd.toFixed(2)}`);
      console.log(`   💸 totalEgresosUsdHoja = $${totalEgresosUsd.toFixed(2)}`);
      console.log(`   📈 netoHoja = $${netoHoja.toFixed(2)}`);
      console.log(`   🎯 Target (Resumen Ejecutivo) ≈ $66,801.58`);
      console.log(`   ⚠️ Difference = $${Math.abs(netoHoja - 66801.58).toFixed(2)}`);
      
      if (issues.length > 0) {
        console.log(`   ⚠️ Issues found (first 10):`);
        issues.slice(0, 10).forEach(issue => console.log(`      - ${issue}`));
      }
      
      return {
        rawAnalysis: {
          totalRows: rows.length - 1,
          uniqueTypes,
          totalIngresosUsd: Math.round(totalIngresosUsd * 100) / 100,
          totalEgresosUsd: Math.round(totalEgresosUsd * 100) / 100,
          netoHoja: Math.round(netoHoja * 100) / 100,
          periodRows
        },
        issues
      };
      
    } catch (error: any) {
      console.error('❌ [DEBUG_CASHFLOW_SHEET] Error:', error?.message || error);
      return {
        rawAnalysis: { totalRows: 0, uniqueTypes: {}, totalIngresosUsd: 0, totalEgresosUsd: 0, netoHoja: 0, periodRows: 0 },
        issues: [error?.message || 'Unknown error']
      };
    }
  }

  /**
   * Get cash end-of-month balances by period from Resumen Ejecutivo
   * Uses the cajaTotalUsd field which represents "Caja fin de mes"
   * 
   * NOTE: CashFlow sheet only has 3 global SALDO rows (not per-month),
   * so we source end-of-month balances from Resumen Ejecutivo instead.
   */
  async getCashEndOfMonthByPeriod(): Promise<Map<string, number>> {
    console.log('🔍 [CashEndOfMonth] Fetching end-of-month cash balances from Resumen Ejecutivo...');
    
    const result = new Map<string, number>();
    
    try {
      // Get Resumen Ejecutivo data which has cajaTotalUsd per period
      const resumenData = await this.getResumenEjecutivo();
      
      for (const row of resumenData) {
        if (row.periodKey && typeof row.cajaTotalUsd === 'number' && row.cajaTotalUsd !== 0) {
          result.set(row.periodKey, Math.round(row.cajaTotalUsd * 100) / 100);
        }
      }
      
      console.log(`✅ [CashEndOfMonth] Found end-of-month balances for ${result.size} periods from Resumen Ejecutivo`);
      for (const [period, balance] of result) {
        console.log(`   ${period}: $${balance.toFixed(2)}`);
      }
      
      return result;
      
    } catch (error: any) {
      console.error('❌ [CashEndOfMonth] Error:', error?.message || error);
      return result;
    }
  }

  /**
   * Lee la hoja "Activo" del MAESTRO y calcula el balance por período.
   * Fuente de verdad para caja_total (Activo Líquido) y activos/pasivos.
   * 
   * Estructura: Concepto/Banco | Tipo de Activo | Cliente | Mes | Año |
   *             Cobrado/No Cobrado AL CIERRE | ... | Moneda original USD | Cotización | Monto Total USD
   * 
   * Tipos de activo: "Activo Líquido" (caja bancaria), "Clientes a cobrar" (cuentas por cobrar)
   */
  async getActivoLiquidoByPeriod(): Promise<Map<string, { activoLiquido: number; cuentasCobrar: number; activoTotal: number }>> {
    console.log('🏦 [Activo ETL] Leyendo hoja "Activo" del MAESTRO...');
    const result = new Map<string, { activoLiquido: number; cuentasCobrar: number; activoTotal: number }>();
    
    try {
      const sheets = this.createSheetsClientFromJSON();
      if (!sheets) {
        console.warn('⚠️ Google Sheets client not available, returning empty activo data');
        return result;
      }
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: "'Activo'!A:U",
        valueRenderOption: 'FORMATTED_VALUE',
      });
      
      const rows = response.data.values || [];
      if (rows.length < 2) {
        console.log('⚠️ [Activo ETL] No hay datos en la hoja Activo');
        return result;
      }
      
      const headers = rows[0] || [];
      // Find column indices
      const tipoIdx = headers.findIndex((h: any) => (h || '').toLowerCase().includes('tipo de activo'));
      const mesIdx = headers.findIndex((h: any) => (h || '').toLowerCase() === 'mes');
      const anioIdx = headers.findIndex((h: any) => (h || '').toLowerCase() === 'año');
      const cobradoIdx = headers.findIndex((h: any) => (h || '').toLowerCase().includes('cobrado'));
      // "Monto Total USD" is col 16 (index 16)
      const montoUsdIdx = headers.findIndex((h: any) => (h || '').toLowerCase().includes('monto total usd'));
      // "Moneda original USD" is col 14
      const usdIdx = headers.findIndex((h: any) => (h || '').toLowerCase().includes('moneda original usd') || ((h || '').toLowerCase() === 'moneda original usd'));
      
      // Use whichever USD column is found
      const amountColIdx = montoUsdIdx >= 0 ? montoUsdIdx : usdIdx;
      
      console.log(`📊 [Activo ETL] Cols: tipo=${tipoIdx}, mes=${mesIdx}, año=${anioIdx}, cobrado=${cobradoIdx}, monto=${amountColIdx}`);
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        
        const tipo = (row[tipoIdx] || '').toString().toLowerCase().trim();
        const mesLabel = (row[mesIdx] || '').toString().trim();
        const anioRaw = (row[anioIdx] || '').toString().trim();
        const cobrado = (row[cobradoIdx] || '').toString().toLowerCase().trim();
        const amountRaw = (row[amountColIdx] || '').toString().trim();
        
        if (!mesLabel || !anioRaw || !amountRaw) continue;
        
        // Parse year
        const year = parseInt(anioRaw);
        if (isNaN(year)) continue;
        
        // Parse month from "01 ene", "02 feb", etc.
        const monthParsed = this.parseMonthLabel(mesLabel);
        if (!monthParsed) continue;
        
        const periodKey = `${year}-${String(monthParsed.month).padStart(2, '0')}`;
        
        // Parse amount (European format: $52.228,91 → 52228.91)
        const amount = this.parseMoneyValue(amountRaw);
        if (isNaN(amount) || amount === 0) continue;
        
        if (!result.has(periodKey)) {
          result.set(periodKey, { activoLiquido: 0, cuentasCobrar: 0, activoTotal: 0 });
        }
        const entry = result.get(periodKey)!;
        
        // "Activo Liquido" = caja bancaria (saldos bancarios)
        if (tipo.includes('activo liquido') || tipo.includes('activo líquido')) {
          entry.activoLiquido += amount;
          entry.activoTotal += amount;
        }
        // "Mediano Plazo" = inversiones/crypto
        else if (tipo.includes('mediano plazo') || tipo.includes('mediano_plazo')) {
          entry.activoTotal += amount;
        }
        // "Clientes a cobrar" = cuentas por cobrar
        else if (tipo.includes('cobrar')) {
          entry.cuentasCobrar += amount;
          entry.activoTotal += amount;
        }
      }
      
      console.log(`✅ [Activo ETL] Calculado balance para ${result.size} períodos`);
      for (const [period, data] of [...result.entries()].sort()) {
        console.log(`   ${period}: Caja=$${data.activoLiquido.toFixed(2)}, CxC=$${data.cuentasCobrar.toFixed(2)}, Total=$${data.activoTotal.toFixed(2)}`);
      }
      
      return result;
    } catch (error: any) {
      console.error('❌ [Activo ETL] Error:', error?.message || error);
      return result;
    }
  }

  /**
   * Parsear filas de CashFlow
   * 
   * CHECKLIST 4.1 IMPLEMENTATION:
   * - Detectar moneda (ARS por defecto, convertir a USD)
   * - Clasificar inflow (monto > 0) vs outflow (monto < 0)
   * - Excluir transferencias internas entre cuentas
   * - Convertir ARS → USD usando tipo de cambio del mes
   * 
   * Estructura esperada: Fecha | Concepto | Monto | Categoría | Referencia | Moneda
   */
  private async parseCashFlowRowsWithFx(rows: any[][]): Promise<CashFlowMovementRow[]> {
    if (rows.length < 2) return [];
    
    const headers = rows[0] || [];
    const result: CashFlowMovementRow[] = [];
    
    // Mapeo de columnas (flexible)
    const findColIdx = (patterns: string[]): number => {
      for (let i = 0; i < headers.length; i++) {
        const h = (headers[i] || '').toString().toLowerCase().trim();
        if (patterns.some(p => h.includes(p))) return i;
      }
      return -1;
    };
    
    const dateIdx = findColIdx(['fecha', 'date', 'dia']);
    const conceptIdx = findColIdx(['concepto', 'descripcion', 'detalle', 'concept']);
    const amountIdx = findColIdx(['monto', 'amount', 'importe', 'valor']);
    const categoryIdx = findColIdx(['categoria', 'category', 'tipo']);
    const referenceIdx = findColIdx(['referencia', 'reference', 'factura', 'invoice']);
    const currencyIdx = findColIdx(['moneda', 'currency', 'divisa', 'usd', 'ars']);
    
    console.log(`📊 [CashFlow] Columnas: fecha=${dateIdx}, concepto=${conceptIdx}, monto=${amountIdx}, categoria=${categoryIdx}, referencia=${referenceIdx}, moneda=${currencyIdx}`);
    
    if (dateIdx < 0 || amountIdx < 0) {
      console.log('⚠️ [CashFlow] No se encontraron columnas de fecha y monto');
      return [];
    }
    
    // Patrones para detectar transferencias internas (EXCLUIR)
    const INTERNAL_TRANSFER_PATTERNS = [
      'transferencia entre cuenta',
      'transferencia interna',
      'movimiento interno',
      'traspaso',
      'pase entre cuenta',
      'compensacion',
      'ajuste interno',
    ];
    
    const isInternalTransfer = (concept: string): boolean => {
      const normalized = concept.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return INTERNAL_TRANSFER_PATTERNS.some(p => normalized.includes(p));
    };
    
    // Obtener tipos de cambio disponibles
    let fxRates = new Map<string, number>();
    try {
      const tipoCambioData = await this.getTiposCambio();
      for (const row of tipoCambioData) {
        if (row.periodKey && row.tipoCambio > 0) {
          fxRates.set(row.periodKey, row.tipoCambio);
        }
      }
      console.log(`💱 [CashFlow] Tipos de cambio cargados para ${fxRates.size} períodos`);
    } catch (e) {
      console.log('⚠️ [CashFlow] No se pudieron cargar tipos de cambio, usando 1400 por defecto');
    }
    
    // Procesar filas
    let skippedInternal = 0;
    let convertedToUsd = 0;
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      
      const dateRaw = (row[dateIdx] || '').toString().trim();
      const conceptRaw = conceptIdx >= 0 ? (row[conceptIdx] || '').toString().trim() : '';
      const amountRaw = (row[amountIdx] || '').toString().trim();
      const categoryRaw = categoryIdx >= 0 ? (row[categoryIdx] || '').toString().trim() : '';
      const referenceRaw = referenceIdx >= 0 ? (row[referenceIdx] || '').toString().trim() : '';
      const currencyRaw = currencyIdx >= 0 ? (row[currencyIdx] || '').toString().trim().toUpperCase() : '';
      
      // EXCLUIR: Transferencias internas entre cuentas
      if (isInternalTransfer(conceptRaw) || isInternalTransfer(categoryRaw)) {
        skippedInternal++;
        continue;
      }
      
      // Parsear fecha
      const date = this.parseDateValue(dateRaw);
      if (!date) continue;
      
      // Parsear monto (formato argentino: $29.230,00 → 29230.00)
      const amountClean = amountRaw
        .replace(/\$/g, '')
        .replace(/\./g, '')
        .replace(/,/g, '.')
        .replace(/\s/g, '')
        .trim();
      const amountRawNum = parseFloat(amountClean) || 0;
      
      if (amountRawNum === 0) continue;
      
      // Determinar período
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const periodKey = `${year}-${String(month).padStart(2, '0')}`;
      
      // DETERMINAR MONEDA: Si no hay columna moneda, asumir ARS
      const isUsd = currencyRaw === 'USD' || currencyRaw === 'U$D' || currencyRaw === 'DOLAR';
      
      // CONVERTIR ARS → USD si es necesario
      let amountUsd: number;
      if (isUsd) {
        amountUsd = Math.abs(amountRawNum);
      } else {
        // Asumir ARS, convertir usando FX del mes
        const fx = fxRates.get(periodKey) || 1400; // Fallback: ~1400 ARS/USD
        amountUsd = Math.abs(amountRawNum) / fx;
        convertedToUsd++;
      }
      
      // CLASIFICAR: monto > 0 → inflow, monto < 0 → outflow
      const type: 'ingreso' | 'egreso' = amountRawNum >= 0 ? 'ingreso' : 'egreso';
      
      result.push({
        date,
        periodKey,
        concept: conceptRaw || `Movimiento ${i}`,
        amountUsd: Math.round(amountUsd * 100) / 100, // 2 decimales
        type,
        category: categoryRaw || undefined,
        reference: referenceRaw || undefined,
      });
    }
    
    console.log(`✅ [CashFlow] Parseados ${result.length} movimientos`);
    console.log(`   📊 Convertidos ARS→USD: ${convertedToUsd}`);
    console.log(`   🔄 Transferencias internas excluidas: ${skippedInternal}`);
    console.log(`   💰 Ingresos: ${result.filter(r => r.type === 'ingreso').length}`);
    console.log(`   💸 Egresos: ${result.filter(r => r.type === 'egreso').length}`);
    
    return result;
  }
  
  private parseCashFlowRows(rows: any[][]): CashFlowMovementRow[] {
    // Versión síncrona simple - delega a la versión async
    // Esta se mantiene por compatibilidad pero no hace conversión FX
    console.log('⚠️ [CashFlow] Usando parser síncrono (sin conversión FX)');
    
    if (rows.length < 2) return [];
    
    const headers = rows[0] || [];
    const result: CashFlowMovementRow[] = [];
    
    const findColIdx = (patterns: string[]): number => {
      for (let i = 0; i < headers.length; i++) {
        const h = (headers[i] || '').toString().toLowerCase().trim();
        if (patterns.some(p => h.includes(p))) return i;
      }
      return -1;
    };
    
    const dateIdx = findColIdx(['fecha', 'date', 'dia']);
    const conceptIdx = findColIdx(['concepto', 'descripcion', 'detalle', 'concept']);
    const amountIdx = findColIdx(['monto', 'amount', 'importe', 'usd', 'valor']);
    const categoryIdx = findColIdx(['categoria', 'category', 'tipo']);
    const referenceIdx = findColIdx(['referencia', 'reference', 'factura', 'invoice']);
    
    if (dateIdx < 0 || amountIdx < 0) return [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      
      const dateRaw = (row[dateIdx] || '').toString().trim();
      const conceptRaw = conceptIdx >= 0 ? (row[conceptIdx] || '').toString().trim() : '';
      const amountRaw = (row[amountIdx] || '').toString().trim();
      const categoryRaw = categoryIdx >= 0 ? (row[categoryIdx] || '').toString().trim() : '';
      const referenceRaw = referenceIdx >= 0 ? (row[referenceIdx] || '').toString().trim() : '';
      
      const date = this.parseDateValue(dateRaw);
      if (!date) continue;
      
      const amountClean = amountRaw
        .replace(/\$/g, '')
        .replace(/\./g, '')
        .replace(/,/g, '.')
        .replace(/\s/g, '')
        .trim();
      const amount = parseFloat(amountClean) || 0;
      
      if (amount === 0) continue;
      
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const periodKey = `${year}-${String(month).padStart(2, '0')}`;
      
      result.push({
        date,
        periodKey,
        concept: conceptRaw || `Movimiento ${i}`,
        amountUsd: Math.abs(amount),
        type: amount >= 0 ? 'ingreso' : 'egreso',
        category: categoryRaw || undefined,
        reference: referenceRaw || undefined,
      });
    }
    
    return result;
  }

  /**
   * Parsear valor de fecha de diferentes formatos
   */
  private parseDateValue(value: string): Date | null {
    if (!value) return null;
    
    // Intentar formato ISO
    let date = new Date(value);
    if (!isNaN(date.getTime())) return date;
    
    // Intentar formato DD/MM/YYYY
    const dmyMatch = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dmyMatch) {
      const [, d, m, y] = dmyMatch;
      date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      if (!isNaN(date.getTime())) return date;
    }
    
    // Intentar formato DD-MM-YYYY
    const dmyDashMatch = value.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
    if (dmyDashMatch) {
      const [, d, m, y] = dmyDashMatch;
      date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      if (!isNaN(date.getTime())) return date;
    }
    
    return null;
  }
}

// Tipo para cuentas a cobrar (facturas futuras = provisiones)
export interface CuentaCobrarRow {
  periodKey: string;
  cliente: string;
  factura?: string;
  fechaFactura?: Date;
  fechaVencimiento?: Date;
  montoUsd: number;
  montoArs: number;
  currency: 'USD' | 'ARS';
  status: string;
  isProvision: boolean;  // True si es factura futura
  rawValue: string;
}

// Tipo para datos de provisiones
export interface ProvisionRow {
  periodKey: string;
  concept: string;
  source: string;
  amountUsd: number;
  isProvision: boolean;
  provisionKind: string;
  rawValue: string;
}

// Tipo para datos de Resumen Ejecutivo
export interface ResumenEjecutivoRow {
  periodKey: string;
  year: number;
  monthNumber: number;
  monthLabel?: string;
  cierreDate?: Date;
  totalActivo?: number;
  totalPasivo?: number;
  balanceNeto?: number;
  cajaTotal?: number;
  inversiones?: number;
  cashflowIngresos?: number;
  cashflowEgresos?: number;
  cashflowNeto?: number;
  cuentasCobrarUsd?: number;
  cuentasPagarUsd?: number;
  facturacionTotal?: number;
  costosDirectos?: number;
  costosIndirectos?: number;
  ivaCompras?: number;
  impuestosUsa?: number;
  ebitOperativo?: number;
  beneficioNeto?: number;
  markupPromedio?: number;
  facturacionAdelantadaUsd?: number;  // Provisión Pasivo Costos Facturación Adelantada
}

// Tipo para movimientos de cash flow
export interface CashFlowMovementRow {
  date: Date;
  periodKey: string;
  bank?: string;
  currency?: string;
  concept: string;
  amountUsd: number;
  type: 'IN' | 'OUT'; // 'IN' = ingreso, 'OUT' = egreso
  category?: string;
  reference?: string;
}

export const googleSheetsWorkingService = new GoogleSheetsWorkingService();
export type { CostoDirectoIndirecto, ProyectoConfirmado, TipoCambio, VentaTomi };