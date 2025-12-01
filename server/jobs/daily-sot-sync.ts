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
      
      // 3. Execute ETL for current month and last 3 months (for historical data)
      const now = new Date();
      const periods: string[] = [];
      
      // Generate last 4 months including current month
      for (let i = 0; i < 4; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const periodKey = date.toISOString().substring(0, 7); // YYYY-MM
        periods.push(periodKey);
      }
      
      console.log(`📅 [Daily SoT Sync] Procesando períodos: ${periods.join(', ')}`);
      
      const result = await executeSoTETL(costosRows, rcRows, {
        scopes: {
          periods: periods
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
  console.log('🔧 [Manual SoT Sync] Ejecutando sincronización manual con RAW DATA (incluye INDIRECTOS)...');
  
  try {
    const { googleSheetsWorkingService } = await import('../services/googleSheetsWorking');
    const { executeSoTETL } = await import('../etl/sot-etl');
    
    // ✅ FIXED: Read RAW sheet data to include BOTH Directo AND Indirecto rows
    // The parser only returns direct costs, but ETL needs indirect costs for fact_cost_month
    console.log('📊 [Manual SoT Sync] Fetching RAW costs data (ALL types: directo + indirecto)...');
    const costosRaw = await googleSheetsWorkingService.getSheetValues(
      '1FZLFmTQQOSYQns2cOYlM86UGEH7EHZsJOFegyDR7quc',
      'Costos directos e indirectos'
    );
    
    // Parse raw sheet data to objects (same as daily cron job)
    const costosHeaders = costosRaw[0] || [];
    const costosRows = costosRaw.slice(1).map((row, idx) => {
      const obj: any = { __rowId: `costos_${idx}` };
      costosHeaders.forEach((header, i) => {
        obj[header] = row[i];
      });
      return obj;
    });
    
    // Count by type for logging
    const directCount = costosRows.filter(row => {
      const tipo = (row['Tipo de Costo'] || row['Tipo de Coste'] || '').toLowerCase().trim();
      return tipo === 'directo' || tipo.includes('directos e indirectos');
    }).length;
    const indirectCount = costosRows.filter(row => {
      const tipo = (row['Tipo de Costo'] || row['Tipo de Coste'] || '').toLowerCase().trim();
      return tipo === 'indirecto';
    }).length;
    
    console.log(`✅ [Manual SoT Sync] Retrieved ${costosRows.length} RAW cost records (${directCount} direct, ${indirectCount} indirect)`);
    
    // Get RC data (unchanged)
    const rcRaw = await googleSheetsWorkingService.getSheetValues(
      '1FZLFmTQQOSYQns2cOYlM86UGEH7EHZsJOFegyDR7quc',
      'Rendimiento Cliente'
    );
    
    const rcHeaders = rcRaw[0] || [];
    const rcRows = rcRaw.slice(1).map((row, idx) => {
      const obj: any = { __rowId: `rc_${idx}` };
      rcHeaders.forEach((header, i) => {
        obj[header] = row[i];
      });
      return obj;
    });
    
    // Generate last 4 months including current month
    const now = new Date();
    const periods: string[] = [];
    
    for (let i = 0; i < 4; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const periodKey = date.toISOString().substring(0, 7); // YYYY-MM
      periods.push(periodKey);
    }
    
    console.log(`📅 [Manual SoT Sync] Procesando períodos: ${periods.join(', ')}`);
    
    const result = await executeSoTETL(costosRows, rcRows, {
      scopes: {
        periods: periods
      },
      recomputeAgg: true
    });
    
    return result;
    
  } catch (error) {
    console.error('❌ [Manual SoT Sync] Error:', error);
    throw error;
  }
}
