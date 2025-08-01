// Test directo de Google Sheets API sin servidor Express
import { googleSheetsFixedService } from './server/services/googleSheetsFixed.js';

async function testDirectly() {
  console.log('🧪 Testeo directo de Google Sheets Service...');
  
  try {
    // Test de credenciales
    console.log('\n1. Verificando credenciales...');
    const credentialsResult = googleSheetsFixedService.verifyCredentials();
    console.log('📋 Resultado de credenciales:', JSON.stringify(credentialsResult, null, 2));
    
    // Test de archivo JSON
    console.log('\n2. Probando archivo JSON...');
    const jsonResult = await googleSheetsFixedService.testWithJSONFile();
    console.log('📄 Resultado de JSON:', JSON.stringify(jsonResult, null, 2));
    
    // Test de datos simulados
    console.log('\n3. Obteniendo datos simulados...');
    const costosData = await googleSheetsFixedService.getCostosDirectosIndirectos();
    console.log('💰 Datos de costos:', JSON.stringify(costosData, null, 2));
    
    console.log('\n✅ Test completado exitosamente');
    
  } catch (error) {
    console.error('❌ Error en test directo:', error);
  }
}

testDirectly();