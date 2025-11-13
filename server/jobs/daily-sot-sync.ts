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
  console.log('🔧 [Manual SoT Sync] Ejecutando sincronización manual con PARSER SANITIZADO...');
  
  try {
    const { googleSheetsWorkingService } = await import('../services/googleSheetsWorking');
    const { executeSoTETL } = await import('../etl/sot-etl');
    const { getCostData } = await import('../domain/costs/data-access');
    
    // ✅ NEW: Use sanitized parser data instead of raw Google Sheets
    console.log('📊 [Manual SoT Sync] Fetching PARSED costs data (directo only, FORMATTED_VALUE)...');
    const parsedCosts = await getCostData('sheets');
    
    console.log(`✅ [Manual SoT Sync] Retrieved ${parsedCosts.length} PARSED direct cost records`);
    
    // Convert ParsedCostRecord[] to legacy format expected by ETL
    const costosRows = parsedCosts.map((cost, idx) => {
      // Extract month/year from period (format: YYYY-MM)
      const [year, month] = cost.period.split('-');
      const monthNameMap: Record<string, string> = {
        '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
        '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
        '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre'
      };
      
      // Extract additional fields from rawRecord
      const personName = cost.rawRecord.persona || '';
      const asanaHours = parseFloat(cost.rawRecord['cantidad_de_horas_asana'] as string || '0') || 0;
      const fx = parseFloat(cost.rawRecord['tipo_cambio'] as string || '0') || 0;
      
      return {
        __rowId: `cost_${idx}`,
        'Cliente': cost.clientName,
        'Proyecto': cost.projectName,
        'Mes': monthNameMap[month] || month,
        'Año': parseInt(year),
        'Detalle': personName,
        'Tipo de Costo': 'Directo', // Already filtered by parser
        'Cantidad de horas objetivo': 0, // Not available in ParsedCostRecord
        'Cantidad de horas reales Asana': asanaHours,
        'Cantidad de horas para facturación': asanaHours, // Use same value
        'Monto Total ARS': cost.arsAmount || 0,
        'Monto Total USD': cost.usdAmount || 0,
        'Cotización': fx
      };
    });
    
    console.log(`🔄 [Manual SoT Sync] Converted to ${costosRows.length} ETL-compatible rows`);
    
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
