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

      // 1. Sincronizar ventas desde "Ventas Tomi"
      const salesResult = await this.syncSales();
      
      // 2. Sincronizar proyectos confirmados (si es necesario)
      // const projectsResult = await this.syncProjects();

      const duration = Date.now() - startTime;
      const message = `Sincronización completada en ${duration}ms: ${salesResult.imported} ventas importadas, ${salesResult.updated} actualizadas`;
      
      console.log(`✅ ${message}`);
      
      return {
        success: true,
        message,
        data: {
          sales: salesResult,
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
   * Sincronizar datos de ventas desde Google Sheets
   */
  private async syncSales(): Promise<{ imported: number; updated: number; errors: string[] }> {
    try {
      console.log('📈 Sincronizando ventas desde "Ventas Tomi"...');

      // Obtener datos de ventas desde Google Sheets
      const salesData = await googleSheetsWorkingService.getVentasTomi();
      
      if (salesData.length === 0) {
        console.log('⚠️ No se encontraron datos de ventas');
        return { imported: 0, updated: 0, errors: [] };
      }

      console.log(`📊 Procesando ${salesData.length} registros de ventas...`);

      // Importar usando el storage
      const result = await storage.importSalesFromGoogleSheets(salesData);
      
      console.log(`✅ Ventas sincronizadas: ${result.imported} nuevas, ${result.updated} actualizadas`);
      
      return result;

    } catch (error: any) {
      console.error('❌ Error sincronizando ventas:', error);
      return { 
        imported: 0, 
        updated: 0, 
        errors: [`Error sincronizando ventas: ${error.message}`] 
      };
    }
  }

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