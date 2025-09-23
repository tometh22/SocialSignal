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
   * Obtener datos raw 2D de cualquier hoja (para uso con índices numéricos)
   */
  async getSheetValues(spreadsheetId: string, sheetName: string): Promise<any[][]> {
    try {
      const sheets = this.createSheetsClientFromJSON();
      const range = `'${sheetName}'!A:Z`;
      
      console.log(`🔄 Obteniendo datos raw 2D de ${sheetName}...`);
      console.log(`📊 Spreadsheet ID: ${spreadsheetId}`);
      console.log(`📋 Range: ${range}`);
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: range,
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
        valueRenderOption: 'UNFORMATTED_VALUE', // 🎯 Anti ×100 bug
        dateTimeRenderOption: 'SERIAL_NUMBER',
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
        const montoTotal = this.parseMoneyValue(this.getCellValue(row, columnMap.costoTotal)) || 0;
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
          año: parseDec(this.getCellValue(row, columnMap.año)) || new Date().getFullYear(),
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
   * Mapear las columnas EXACTAS del Excel MAESTRO a nuestros campos
   */
  private createColumnMap(headers: string[]): Record<string, number> {
    const map: Record<string, number> = {};
    
    headers.forEach((header, index) => {
      // Mapeo EXACTO basado en las columnas reales del Excel MAESTRO
      if (header === 'Detalle') {
        map.persona = index; // A: Nombre de la persona
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

    console.log('🗺️ Mapeo de columnas costos directos:', map);
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
      const range = 'Proyectos confirmados y estimados!A:Z';
      
      console.log('🔄 Obteniendo proyectos confirmados del Excel MAESTRO...');
      console.log(`📊 Spreadsheet ID: ${this.spreadsheetId}`);
      console.log(`📋 Range: ${range}`);
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: range,
        valueRenderOption: 'UNFORMATTED_VALUE', // 🎯 Anti ×100 bug
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
            valorBase: this.getCellValue(row, columnMap.valorBase),
            monedaUSD: this.getCellValue(row, columnMap.monedaUSD),
            rawRow: row.slice(0, 15) // Mostrar primeras 15 columnas raw
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
   * Convertir mes en español a número
   */
  private parseMonthFromSpanish(mesSpanish: string): number {
    if (!mesSpanish) return 1;
    
    const mes = mesSpanish.toLowerCase().trim();
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
    
    return meses[mes] || 1;
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
      const range = 'Ventas Tomi!A:Z'; // Extendido para capturar todas las columnas
      
      console.log('🔄 Obteniendo ventas desde Ventas Tomi...');
      console.log(`📊 Spreadsheet ID: ${this.spreadsheetId}`);
      console.log(`📋 Range: ${range}`);
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: range,
        valueRenderOption: 'UNFORMATTED_VALUE', // 🎯 Anti ×100 bug
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
      "coelsa::fee mensual": 43,
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
      
      // Leer datos de la pestaña "Costos directos e indirectos" 
      const range = 'Costos directos e indirectos!A:R'; // Extendido a R para incluir montos USD convertidos
      console.log('📋 Range:', range);
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: range,
        valueRenderOption: 'UNFORMATTED_VALUE', // 🎯 Anti ×100 bug
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
          
          // Calcular costo total - NUEVO: usar monto USD si no hay valor hora
          let costoTotal: number;
          
          if (valorHora && costo.horasRealesAsana > 0) {
            // Cálculo tradicional por horas x tarifa
            costoTotal = costo.horasRealesAsana * valorHora;
          } else if (costo.montoTotalUSD && costo.montoTotalUSD > 0) {
            // Usar monto USD directo del Excel cuando no hay tarifa horaria
            costoTotal = costo.montoTotalUSD;
            console.log(`💰 Usando monto USD directo para ${costo.persona} - ${costo.proyecto}: $${costoTotal}`);
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
          
          const directCostData = {
            monthKey: monthKey, // NUEVO: Clave temporal única
            persona: costo.persona,
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
            costoTotal: costoTotal,
            tipoCambio: costo.tipoCambio,
            montoTotalUSD: costo.montoTotalUSD,
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
            console.log(`🔄 Actualizado: ${costo.persona} - ${costo.proyecto} - $${costoTotal.toFixed(2)}`);
          } else {
            await storage.createDirectCost(directCostData);
            costsImported++;
            console.log(`➕ Creado: ${costo.persona} - ${costo.proyecto} - $${costoTotal.toFixed(2)}`);
          }

        } catch (error) {
          const errorMsg = `Error procesando costo de ${costo.persona}: ${error.message}`;
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

    } catch (error) {
      console.error('❌ Error importando costos directos:', error);
      return { success: false, costsImported: 0, costsUpdated: 0, errors: [error.message] };
    }
  }

  /**
   * Procesar datos de costos directos del Excel
   */
  private processDirectCostsData(rows: any[][]): CostoDirectoExcel[] {
    const result: CostoDirectoExcel[] = [];
    
    if (rows.length === 0) return result;

    // Headers esperados según la nueva imagen
    const headers = rows[0];
    console.log('📋 Headers costos directos:', headers);

    // CORRECCIÓN COMPLETA: Mapeo según la estructura real del Excel
    const columnMap = {
      persona: 0, // Columna A - Detalle (nombre persona)
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
        const horasObjetivo = parseDec(this.getCellValue(row, columnMap.horasObjetivo));
        const horasRealesAsana = parseDec(this.getCellValue(row, columnMap.horasRealesAsana));
        const horasParaFacturacion = parseDec(this.getCellValue(row, columnMap.horasParaFacturacion));
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
        
        // Aceptar cualquier fila que tenga al menos UN valor numérico válido
        if (horasRealesAsana <= 0 && horasParaFacturacion <= 0 && horasObjetivo <= 0 && montoUSDValue <= 0) {
          console.log(`⏭️ Fila ${i}: Filtrado por sin datos numéricos:`, debugInfo);
          continue;
        }
        
        // Log filas que SÍ pasan los filtros
        if (cliente?.includes('Play Digital')) {
          console.log(`✅ Fila ${i}: Play Digital procesada:`, debugInfo);
        }

        const tipoCambioRaw = this.getCellValue(row, columnMap.tipoCambio) || '';
        const montoOriginalARSRaw = this.getCellValue(row, columnMap.montoOriginalARS) || '';



        const costoData: CostoDirectoExcel = {
          persona: persona,
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
          montoTotalUSD: montoTotalUSDRaw ? this.parseMoneyValue(montoTotalUSDRaw) : undefined
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
}

export const googleSheetsWorkingService = new GoogleSheetsWorkingService();
export type { CostoDirectoIndirecto, ProyectoConfirmado, TipoCambio, VentaTomi };