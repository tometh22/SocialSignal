// Script de prueba para acceder directamente al Excel MAESTRO y ver todas las pestañas
import { GoogleSheetsWorkingService } from './server/services/googleSheetsWorking.js';

async function testGoogleSheetsDirect() {
  try {
    console.log('🔄 Inicializando servicio de Google Sheets...');
    
    const service = new GoogleSheetsWorkingService();
    
    console.log('📋 Obteniendo nombres de pestañas...');
    const sheetNames = await service.getSheetNames();
    
    console.log(`✅ ${sheetNames.length} pestañas encontradas:`);
    sheetNames.forEach((name, index) => {
      console.log(`  ${index + 1}. "${name}"`);
    });
    
    // Buscar pestañas que podrían contener tipos de cambio
    const potentialExchangeSheets = sheetNames.filter(name => 
      name.toLowerCase().includes('tipo') ||
      name.toLowerCase().includes('cambio') ||
      name.toLowerCase().includes('exchange') ||
      name.toLowerCase().includes('bcra') ||
      name.toLowerCase().includes('dolar') ||
      name.toLowerCase().includes('cotiz') ||
      name.toLowerCase().includes('resumen') ||
      name.toLowerCase().includes('datos')
    );
    
    console.log(`\n🎯 Pestañas potenciales para tipos de cambio (${potentialExchangeSheets.length}):`);
    potentialExchangeSheets.forEach((name, index) => {
      console.log(`  ${index + 1}. "${name}"`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejecutar test
testGoogleSheetsDirect();