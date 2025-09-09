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
   */
  private async syncUnifiedExcelData(): Promise<{ 
    salesImported: number; 
    salesUpdated: number; 
    costsImported: number; 
    costsUpdated: number; 
    errors: string[] 
  }> {
    try {
      console.log('📊 UNIFICADO: Sincronizando ventas + costos desde Excel MAESTRO...');

      // 1. Obtener datos de ventas desde Excel MAESTRO "Ventas Tomi"
      const salesData = await googleSheetsWorkingService.getVentasTomi();
      let salesResult = { imported: 0, updated: 0, errors: [] as string[] };
      
      if (salesData.length > 0) {
        console.log(`📈 Procesando ${salesData.length} registros de ventas...`);
        salesResult = await storage.importSalesFromGoogleSheets(salesData);
        console.log(`✅ Ventas sincronizadas: ${salesResult.imported} nuevas, ${salesResult.updated} actualizadas`);
      } else {
        console.log('⚠️ No se encontraron datos de ventas en Excel MAESTRO');
      }

      // 2. Obtener costos directos desde Excel MAESTRO "Ventas Tomi" (misma fuente)
      const costsResult = await googleSheetsWorkingService.importDirectCosts(storage);
      
      if (costsResult.success) {
        console.log(`💰 Costos sincronizados: ${costsResult.costsImported} importados, ${costsResult.costsUpdated} actualizados`);
      } else {
        console.log('⚠️ Error sincronizando costos:', costsResult.errors);
      }

      // 3. Combinar resultados
      const combinedErrors = [
        ...salesResult.errors,
        ...(costsResult.success ? [] : costsResult.errors)
      ];

      return {
        salesImported: salesResult.imported,
        salesUpdated: salesResult.updated,
        costsImported: costsResult.success ? costsResult.costsImported : 0,
        costsUpdated: costsResult.success ? costsResult.costsUpdated : 0,
        errors: combinedErrors
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
          // Buscar proyecto que coincida con cliente y nombre del proyecto
          const matchingProject = activeProjects.find(project => {
            const quotation = quotationMap.get(project.quotationId);
            if (!quotation) return false;
            
            const client = clientMap.get(quotation.clientId);
            if (!client) return false;

            // Normalizar nombres para comparación
            const saleClientName = this.normalizeName(sale.clientName || '');
            const saleProjectName = this.normalizeName(sale.projectName || '');
            const projectClientName = this.normalizeName(client.name || '');
            const projectName = this.normalizeName(quotation.projectName || '');

            // Verificar coincidencias
            const clientMatch = saleClientName === projectClientName || 
                               saleClientName.includes(projectClientName) ||
                               projectClientName.includes(saleClientName);
            
            const projectMatch = saleProjectName === projectName ||
                                saleProjectName.includes(projectName) ||
                                projectName.includes(saleProjectName);

            return clientMatch && projectMatch;
          });

          if (matchingProject) {
            // Actualizar la venta con el ID del proyecto
            await storage.updateGoogleSheetsSales(sale.id, {
              projectId: matchingProject.id
            });

            // Crear o actualizar ingreso mensual del proyecto (simplificado)
            created += await this.createOrUpdateProjectRevenue(sale, matchingProject);
            
            linked++;
            
            if (linked <= 5) { // Log primeros 5 para debug
              console.log(`🔗 Vinculado: ${sale.clientName} - ${sale.projectName} → Proyecto ${matchingProject.id}`);
            }
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
      console.log(`💰 Venta vinculada: ${sale.clientName} - ${sale.projectName} ($${sale.amountUsd || sale.amountLocal})`);
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