import { db } from './server/db';
import { executeSoTETL } from './server/etl/sot-etl';
import { googleSheetsWorkingService } from './server/services/googleSheetsWorking';

async function runETL() {
  try {
    console.log('🚀 Starting SoT ETL for August 2025...');
    
    // Read Excel MAESTRO data
    const costosRaw = await googleSheetsWorkingService.getSheetValues(
      '1FZLFmTQQOSYQns2cOYlM86UGEH7EHZsJOFegyDR7quc',
      'Costos directos e indirectos',
      {
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'SERIAL_NUMBER'
      }
    );
    
    const rcRaw = await googleSheetsWorkingService.getSheetValues(
      '1FZLFmTQQOSYQns2cOYlM86UGEH7EHZsJOFegyDR7quc',
      'Rendimiento Cliente',
      {
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'SERIAL_NUMBER'
      }
    );
    
    console.log(`📋 Read ${costosRaw.length} rows from Costos, ${rcRaw.length} rows from RC`);
    
    // Parse headers
    const costosHeaders = costosRaw[0] || [];
    const rcHeaders = rcRaw[0] || [];
    
    const costosRows = costosRaw.slice(1).map((row: any, idx: number) => {
      const obj: any = { __rowId: `costos_${idx}` };
      costosHeaders.forEach((header: any, i: number) => {
        obj[header] = row[i];
      });
      return obj;
    });
    
    const rcRows = rcRaw.slice(1).map((row: any, idx: number) => {
      const obj: any = { __rowId: `rc_${idx}` };
      rcHeaders.forEach((header: any, i: number) => {
        obj[header] = row[i];
      });
      return obj;
    });
    
    console.log(`📦 Parsed ${costosRows.length} costo objects, ${rcRows.length} RC objects`);
    
    // Execute ETL for August 2025 only
    const result = await executeSoTETL(costosRows, rcRows, {
      scopes: {
        periods: ['2025-08']
      },
      dryRun: false,
      recomputeAgg: true
    });
    
    console.log('✅ ETL Result:', JSON.stringify(result, null, 2));
    await db.$client.end(); // Close DB connection
    process.exit(0);
    
  } catch (error) {
    console.error('❌ ETL Error:', error);
    process.exit(1);
  }
}

runETL();
