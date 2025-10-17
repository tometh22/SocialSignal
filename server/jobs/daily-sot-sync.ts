/**
 * Daily SoT ETL Synchronization Job
 * Ejecuta automáticamente a las 02:00 AR (GMT-3) para mantener datos actualizados
 */

import cron from 'node-cron';
import { db } from '../db';

export function startDailySoTSync() {
  // Cron expression: 0 2 * * * = Todos los días a las 02:00 AM
  // Ajustado para timezone Argentina (GMT-3)
  const schedule = '0 5 * * *'; // 05:00 UTC = 02:00 AR
  
  console.log('🕐 Programando sincronización diaria SoT ETL a las 02:00 AR...');
  
  const job = cron.schedule(schedule, async () => {
    try {
      console.log('🌟 [Daily SoT Sync] Iniciando sincronización automática...');
      
      // Import dependencies
      const { googleSheetsWorkingService } = await import('../services/googleSheetsWorking');
      const { executeSoTETL } = await import('../etl/sot-etl');
      
      // 1. Read Excel MAESTRO data
      const costosRaw = await googleSheetsWorkingService.getSheetValues(
        '1FZLFmTQQOSYQns2cOYlM86UGEH7EHZsJOFegyDR7quc',
        'Costos directos e indirectos'
      );
      
      const rcRaw = await googleSheetsWorkingService.getSheetValues(
        '1FZLFmTQQOSYQns2cOYlM86UGEH7EHZsJOFegyDR7quc',
        'Rendimiento Cliente'
      );
      
      // 2. Parse to objects
      const costosHeaders = costosRaw[0] || [];
      const rcHeaders = rcRaw[0] || [];
      
      const costosRows = costosRaw.slice(1).map((row, idx) => {
        const obj: any = { __rowId: `costos_${idx}` };
        costosHeaders.forEach((header, i) => {
          obj[header] = row[i];
        });
        return obj;
      });
      
      const rcRows = rcRaw.slice(1).map((row, idx) => {
        const obj: any = { __rowId: `rc_${idx}` };
        rcHeaders.forEach((header, i) => {
          obj[header] = row[i];
        });
        return obj;
      });
      
      // 3. Execute ETL for current month only (incremental)
      const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
      
      const result = await executeSoTETL(costosRows, rcRows, {
        scopes: {
          periods: [currentMonth]
        },
        recomputeAgg: true
      });
      
      if (result.success) {
        console.log(`✅ [Daily SoT Sync] Completado exitosamente: ${result.laborRowsProcessed} labor + ${result.rcRowsProcessed} RC → ${result.aggregatesComputed} agregados`);
      } else {
        console.error(`❌ [Daily SoT Sync] Falló:`, result.errors);
      }
      
    } catch (error) {
      console.error('❌ [Daily SoT Sync] Error:', error);
    }
  }, {
    scheduled: true,
    timezone: "America/Argentina/Buenos_Aires"
  });
  
  job.start();
  console.log(`✅ Job diario SoT programado: ${schedule} (02:00 AR)`);
  
  return job;
}

// Manual trigger function for testing
export async function triggerManualSync() {
  console.log('🔧 [Manual SoT Sync] Ejecutando sincronización manual...');
  
  try {
    const { googleSheetsWorkingService } = await import('../services/googleSheetsWorking');
    const { executeSoTETL } = await import('../etl/sot-etl');
    
    const costosRaw = await googleSheetsWorkingService.getSheetValues(
      '1FZLFmTQQOSYQns2cOYlM86UGEH7EHZsJOFegyDR7quc',
      'Costos directos e indirectos'
    );
    
    const rcRaw = await googleSheetsWorkingService.getSheetValues(
      '1FZLFmTQQOSYQns2cOYlM86UGEH7EHZsJOFegyDR7quc',
      'Rendimiento Cliente'
    );
    
    const costosHeaders = costosRaw[0] || [];
    const rcHeaders = rcRaw[0] || [];
    
    const costosRows = costosRaw.slice(1).map((row, idx) => {
      const obj: any = { __rowId: `costos_${idx}` };
      costosHeaders.forEach((header, i) => {
        obj[header] = row[i];
      });
      return obj;
    });
    
    const rcRows = rcRaw.slice(1).map((row, idx) => {
      const obj: any = { __rowId: `rc_${idx}` };
      rcHeaders.forEach((header, i) => {
        obj[header] = row[i];
      });
      return obj;
    });
    
    const currentMonth = new Date().toISOString().substring(0, 7);
    
    const result = await executeSoTETL(costosRows, rcRows, {
      scopes: {
        periods: [currentMonth]
      },
      recomputeAgg: true
    });
    
    return result;
    
  } catch (error) {
    console.error('❌ [Manual SoT Sync] Error:', error);
    throw error;
  }
}
