import { storage } from '../server/storage';
import { googleSheetsWorkingService } from '../server/services/googleSheetsWorking';

async function testSync() {
  console.log('🔄 Probando sincronización de ventas...');
  
  try {
    // 1. Verificar que el servicio de Google Sheets esté funcionando
    console.log('📊 Obteniendo datos de "Ventas Tomi"...');
    const salesData = await googleSheetsWorkingService.getVentasTomi();
    
    console.log(`✅ Datos obtenidos: ${salesData.length} registros`);
    
    if (salesData.length > 0) {
      // Mostrar algunos ejemplos
      console.log('📋 Primeros 3 registros:');
      salesData.slice(0, 3).forEach((sale, index) => {
        console.log(`  ${index + 1}. ${sale.proyecto} - $${sale.monto_ars} ARS / $${sale.monto_usd} USD`);
      });
      
      // 2. Importar a la base de datos
      console.log('💾 Importando a base de datos...');
      const result = await storage.importSalesFromGoogleSheets(salesData);
      
      console.log('✅ Importación completada:');
      console.log(`   - ${result.imported} registros nuevos`);
      console.log(`   - ${result.updated} registros actualizados`);
      
      if (result.errors.length > 0) {
        console.log('⚠️ Errores encontrados:');
        result.errors.forEach((error, index) => {
          console.log(`   ${index + 1}. ${error}`);
        });
      }
      
      // 3. Verificar datos en la base
      console.log('🔍 Verificando datos en base de datos...');
      const dbSales = await storage.getGoogleSheetsSales();
      console.log(`📊 Total de ventas en BD: ${dbSales.length}`);
      
    } else {
      console.log('⚠️ No se encontraron datos en Google Sheets');
    }
    
  } catch (error: any) {
    console.error('❌ Error en sincronización:', error);
    console.error('Stack:', error.stack);
  }
}

testSync().then(() => {
  console.log('🏁 Script completado');
  process.exit(0);
});