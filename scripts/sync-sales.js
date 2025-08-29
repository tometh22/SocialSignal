/**
 * Script para ejecutar sincronización de ventas desde Google Sheets
 */

import { autoSyncService } from '../server/services/autoSyncService.js';

async function main() {
  console.log('🔄 Iniciando sincronización manual de ventas...');
  
  try {
    const result = await autoSyncService.manualSync();
    
    console.log('✅ Resultado de sincronización:');
    console.log('   Success:', result.success);
    console.log('   Message:', result.message);
    
    if (result.data) {
      console.log('   Datos:', JSON.stringify(result.data, null, 2));
    }
    
    // Obtener estado
    const status = autoSyncService.getStatus();
    console.log('🔍 Estado del servicio:');
    console.log('   Running:', status.isRunning);
    if (status.nextSync) {
      console.log('   Next sync:', status.nextSync.toISOString());
    }
    
  } catch (error) {
    console.error('❌ Error en sincronización:', error);
  }
  
  process.exit(0);
}

main();