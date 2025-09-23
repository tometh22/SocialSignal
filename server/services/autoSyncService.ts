import { storage } from '../storage';
import { googleSheetsWorkingService } from './googleSheetsWorking';

export class AutoSyncService {
  private isRunning = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos

  constructor() {
    console.log('🔄 AutoSyncService inicializado');
  }

  /**
   * Iniciar sincronización automática
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ AutoSync ya está ejecutándose');
      return;
    }

    console.log('🚀 Iniciando sincronización automática cada 30 minutos...');
    this.isRunning = true;

    // Ejecutar sincronización inmediata
    this.performSync();

    // Programar sincronizaciones periódicas
    this.syncInterval = setInterval(() => {
      this.performSync();
    }, this.SYNC_INTERVAL_MS);
  }

  /**
   * Detener sincronización automática
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 Sincronización automática detenida');
  }

  /**
   * Ejecutar sincronización manual
   */
  async manualSync(): Promise<{ success: boolean; message: string; data?: any }> {
    console.log('🔄 Ejecutando sincronización manual...');
    return await this.performSync();
  }

  /**
   * Realizar sincronización completa
   */
  private async performSync(): Promise<{ success: boolean; message: string; data?: any }> {
    const startTime = Date.now();
    
    try {
      console.log('📊 Iniciando sincronización con Excel MAESTRO...');

      // 1. UNIFICADO: Sincronizar TODO desde Excel MAESTRO (ventas + costos)
      const unifiedResult = await this.syncUnifiedExcelData();
      
      // 2. Vincular con proyectos activos (ahora trabajando con datos unificados)
      const projectSyncResult = await this.syncSalesWithProjects();

      const duration = Date.now() - startTime;
      const message = `Sincronización completada en ${duration}ms: ${unifiedResult.salesImported} ventas importadas, ${unifiedResult.salesUpdated} actualizadas, ${projectSyncResult.linked} vinculadas con proyectos, ${unifiedResult.costsImported} costos directos importados, ${unifiedResult.costsUpdated} costos actualizados`;
      
      console.log(`✅ ${message}`);
      
      return {
        success: true,
        message,
        data: {
          unified: unifiedResult,
          projectSync: projectSyncResult,
          duration
        }
      };

    } catch (error: any) {
      const errorMessage = `Error en sincronización: ${error.message}`;
      console.error('❌', errorMessage, error);
      
      return {
        success: false,
        message: errorMessage
      };
    }
  }

  /**
   * NUEVA FUNCIÓN UNIFICADA: Sincronizar ventas + costos desde Excel MAESTRO
   * Ahora incluye detección automática de formato "líneas generales"
   */
  private async syncUnifiedExcelData(): Promise<{ 
    salesImported: number; 
    salesUpdated: number; 
    costsImported: number; 
    costsUpdated: number; 
    errors: string[];
    lineasGeneralesProcessed?: number; 
  }> {
    try {
      console.log('📊 UNIFICADO: Sincronizando ventas + costos desde Excel MAESTRO...');

      // 1. Obtener datos de ventas desde Excel MAESTRO "Ventas Tomi"
      const salesData = await googleSheetsWorkingService.getVentasTomi();
      let salesResult = { imported: 0, updated: 0, errors: [] };
      let lineasGeneralesResult = { processed: 0, errors: [] };
      
      if (salesData.length > 0) {
        console.log(`📈 Procesando ${salesData.length} registros de ventas...`);
        
        // AUTO-DETECCIÓN DE FORMATO
        console.log('🔍 AUTO-SYNC: Detectando formato de datos...');
        const { detectFormat } = await import('../utils/format-detector');
        const detection = detectFormat(salesData);
        
        console.log(`🔍 AUTO-SYNC FORMAT DETECTED: ${detection.format} (confidence: ${detection.confidence})`);
        
        // Si es formato "líneas generales", usar el ETL especializado
        if (detection.format === 'lineas_generales' && detection.confidence > 0.7) {
          console.log('🚀 AUTO-SYNC: Usando ETL de líneas generales...');
          
          try {
            const { processLineasGenerales } = await import('../etl/lineas-generales-etl');
            const result = await processLineasGenerales(salesData, 'auto');
            
            lineasGeneralesResult = {
              processed: result.processed,
              errors: result.errors
            };
            
            console.log(`✅ Líneas Generales sincronizadas: ${result.processed} procesados, ${result.ventasInserted} ventas, ${result.costosInserted} costos`);
          } catch (error: any) {
            const errorMsg = `Error procesando líneas generales: ${error.message}`;
            console.error('❌', errorMsg);
            lineasGeneralesResult.errors.push(errorMsg);
          }
        } 
        // Si es formato "ventas tomi", usar el proceso existente
        else if (detection.format === 'ventas_tomi' || detection.confidence <= 0.7) {
          console.log('🚀 AUTO-SYNC: Usando ETL de Ventas Tomi (formato estándar)...');
          salesResult = await storage.importSalesFromGoogleSheets(salesData);
          console.log(`✅ Ventas Tomi sincronizadas: ${salesResult.imported} nuevas, ${salesResult.updated} actualizadas`);
        }
        else {
          const errorMsg = `Formato desconocido detectado: ${detection.format}`;
          console.warn(`⚠️ AUTO-SYNC: ${errorMsg}`);
          salesResult.errors.push(errorMsg);
        }
      } else {
        console.log('⚠️ No se encontraron datos de ventas en Excel MAESTRO');
      }

      // 2. Obtener costos directos desde Excel MAESTRO "Costos directos e indirectos"
      const costsResult = await googleSheetsWorkingService.importDirectCosts(storage);
      
      if (costsResult.success) {
        console.log(`💰 Costos sincronizados: ${costsResult.costsImported} importados, ${costsResult.costsUpdated} actualizados`);
      } else {
        console.log('⚠️ Error sincronizando costos:', costsResult.errors);
      }

      // 3. Combinar resultados
      const combinedErrors = [
        ...salesResult.errors,
        ...lineasGeneralesResult.errors,
        ...(costsResult.success ? [] : costsResult.errors)
      ];

      return {
        salesImported: salesResult.imported,
        salesUpdated: salesResult.updated,
        costsImported: costsResult.success ? costsResult.costsImported : 0,
        costsUpdated: costsResult.success ? costsResult.costsUpdated : 0,
        errors: combinedErrors,
        lineasGeneralesProcessed: lineasGeneralesResult.processed
      };

    } catch (error: any) {
      console.error('❌ Error en sincronización unificada:', error);
      return { 
        salesImported: 0, 
        salesUpdated: 0,
        costsImported: 0,
        costsUpdated: 0,
        errors: [`Error en sincronización unificada: ${error.message}`] 
      };
    }
  }

  /**
   * Sincronizar ventas del Excel con proyectos activos
   */
  private async syncSalesWithProjects(): Promise<{ linked: number; created: number; errors: string[] }> {
    try {
      console.log('🔗 Sincronizando ventas con proyectos activos...');

      // Obtener todas las ventas del Excel
      const salesData = await storage.getGoogleSheetsSales();
      
      // Obtener proyectos activos con sus cotizaciones
      const activeProjects = await storage.getActiveProjects();
      const quotations = await storage.getQuotations();
      const clients = await storage.getClients();
      
      // Crear mapas para búsqueda rápida
      const quotationMap = new Map(quotations.map(q => [q.id, q]));
      const clientMap = new Map(clients.map(c => [c.id, c]));
      
      let linked = 0;
      let created = 0;
      const errors: string[] = [];

      console.log(`📊 Procesando ${salesData.length} ventas para vincular con ${activeProjects.length} proyectos activos`);

      // Procesar cada venta
      for (const sale of salesData) {
        try {
          // 🎯 USAR EL MAPEO ESPECÍFICO que funciona para costos
          const projectId = await this.findProjectBySpecificMapping(sale.clientName || '', sale.projectName || '');
          
          if (projectId) {
            // Actualizar la venta con el ID del proyecto correcto, preservando montos ya calculados
            await storage.updateGoogleSheetsSales(sale.id, {
              projectId: projectId,
              lastUpdated: new Date(),
              // Preservar campos de montos que ya fueron calculados durante importSalesFromGoogleSheets
              amountLocal: sale.amountLocal,
              amountUsd: sale.amountUsd,
              currency: sale.currency,
              fxApplied: sale.fxApplied,
              fxSource: sale.fxSource,
              fxAt: sale.fxAt
            });

            // Crear o actualizar ingreso mensual del proyecto (simplificado)
            const matchingProject = activeProjects.find(p => p.id === projectId);
            if (matchingProject) {
              created += await this.createOrUpdateProjectRevenue(sale, matchingProject);
            }
            
            linked++;
            
            if (linked <= 10) { // Log primeros 10 para debug
              console.log(`🔗 Vinculado: ${sale.clientName} - ${sale.projectName} → Proyecto ${projectId}`);
            }
          } else {
            console.log(`⚠️ Sin mapeo para: ${sale.clientName} - ${sale.projectName}`);
          }

        } catch (error: any) {
          const errorMsg = `Error vinculando venta ${sale.id}: ${error.message}`;
          errors.push(errorMsg);
          console.error('❌', errorMsg);
        }
      }

      console.log(`✅ Sincronización de proyectos completada: ${linked} ventas vinculadas, ${created} ingresos creados`);
      
      return { linked, created, errors };

    } catch (error: any) {
      console.error('❌ Error sincronizando ventas con proyectos:', error);
      return { 
        linked: 0, 
        created: 0, 
        errors: [`Error sincronizando con proyectos: ${error.message}`] 
      };
    }
  }

  /**
   * 🎯 MAPEO ESPECÍFICO para ventas (misma lógica que funciona para costos)
   */
  private async findProjectBySpecificMapping(clientName: string, projectName: string): Promise<number | null> {
    try {
      console.log(`🔍 Buscando mapeo para venta: "${clientName}", proyecto: "${projectName}"`);
      
      // 🎯 MISMO MAPEO que funciona para costos
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
      };
      
      const projectId = specificProjectMapping[clientProjectKey];
      
      if (projectId) {
        console.log(`🔗 Mapeo encontrado para venta: ${clientName} + ${projectName} → Proyecto ${projectId}`);
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
        console.log(`🔗 Mapeo fallback para venta: ${clientName} → Proyecto ${fallbackProjectId}`);
        return fallbackProjectId;
      }
      
      console.log(`⚠️ Sin mapeo para venta: ${clientName} - ${projectName}`);
      return null;
      
    } catch (error) {
      console.error(`❌ Error buscando mapeo para venta ${clientName}:`, error);
      return null;
    }
  }

  /**
   * Normalizar nombres para comparación
   */
  private normalizeName(name: string): string {
    return name.toLowerCase()
               .trim()
               .replace(/[^a-z0-9\s]/g, '') // Solo letras, números y espacios
               .replace(/\s+/g, ' ') // Normalizar espacios
               .trim();
  }

  /**
   * Crear o actualizar ingreso mensual del proyecto (simplificado)
   */
  private async createOrUpdateProjectRevenue(sale: any, project: any): Promise<number> {
    try {
      // Por ahora, solo registrar la vinculación sin crear ingresos mensuales
      // para evitar errores de funciones faltantes
      console.log(`💰 Venta vinculada: ${sale.clientName} - ${sale.projectName} ($${sale.amountUsd || sale.amountArs})`);
      console.log(`🔗 Vinculado: ${sale.clientName} - ${sale.projectName} → Proyecto ${project.id}`);
      return 0; // No crear ingresos por ahora

    } catch (error: any) {
      console.error(`❌ Error procesando ingreso para proyecto ${project.id}:`, error);
      return 0;
    }
  }

  /**
   * Convertir mes en español a número
   */
  private getMonthNumber(month: string): number {
    const monthMap: Record<string, number> = {
      'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
      'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
      'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
    };
    
    return monthMap[month.toLowerCase()] || 1;
  }

  // FUNCIÓN ELIMINADA: syncDirectCosts - Ahora se maneja en syncUnifiedExcelData

  /**
   * Obtener estado de la sincronización
   */
  getStatus(): { isRunning: boolean; nextSync?: Date } {
    return {
      isRunning: this.isRunning,
      nextSync: this.isRunning && this.syncInterval ? 
        new Date(Date.now() + this.SYNC_INTERVAL_MS) : undefined
    };
  }
}

// Exportar instancia única
export const autoSyncService = new AutoSyncService();