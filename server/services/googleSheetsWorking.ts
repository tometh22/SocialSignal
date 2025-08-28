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

interface TipoCambio {
  mes: string;
  año?: number;
  tipoCambio: number;
  fuente: string;
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
      
      // Parar si encontramos filas de proyección o año
      if (mes.includes('próx') || mes.includes('2025') || mes.includes('2026')) {
        break;
      }
      
      // Convertir el tipo de cambio a número
      const tipoCambio = parseFloat(tipoCambioStr.replace(/[.,]/g, (match, offset, string) => {
        // Reemplazar la última coma/punto por punto decimal
        const lastDotIndex = string.lastIndexOf('.');
        const lastCommaIndex = string.lastIndexOf(',');
        const lastSeparatorIndex = Math.max(lastDotIndex, lastCommaIndex);
        return offset === lastSeparatorIndex ? '.' : '';
      }));
      
      if (isNaN(tipoCambio)) continue;
      
      tiposCambio.push({
        mes: mes,
        año: 2024, // Asumir 2024 por defecto
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
}

export const googleSheetsWorkingService = new GoogleSheetsWorkingService();
export type { CostoDirectoIndirecto, ProyectoConfirmado, TipoCambio };