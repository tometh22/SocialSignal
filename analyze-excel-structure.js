import { GoogleSheetsWorkingService } from './server/services/googleSheetsWorking.js';

async function analyzeExcelStructure() {
  try {
    console.log('🔍 Analizando estructura del Excel MAESTRO...');
    
    const service = new GoogleSheetsWorkingService();
    const connected = await service.testConnection();
    
    if (!connected) {
      console.error('❌ No se pudo conectar al servicio');
      return;
    }

    // Obtener datos del sheet "Costos directos e indirectos"
    const auth = service.auth;
    const sheets = service.sheets;
    const spreadsheetId = service.spreadsheetId;
    
    const range = 'Costos directos e indirectos!A1:Z50'; // Primeras 50 filas para análisis
    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId,
      range,
    });

    const rows = response.data.values || [];
    
    if (rows.length === 0) {
      console.log('❌ No se encontraron datos');
      return;
    }

    console.log('\n📋 HEADERS (Fila 1):');
    console.log(rows[0].map((header, index) => `${index}: ${header}`).join('\n'));
    
    console.log('\n📊 MUESTRA DE DATOS (Filas 2-10):');
    for (let i = 1; i < Math.min(rows.length, 10); i++) {
      console.log(`\n--- FILA ${i} ---`);
      rows[0].forEach((header, colIndex) => {
        const value = rows[i] ? rows[i][colIndex] || '' : '';
        console.log(`${header}: "${value}"`);
      });
    }

    console.log('\n📈 ESTADÍSTICAS:');
    console.log(`Total de filas analizadas: ${rows.length}`);
    console.log(`Total de columnas: ${rows[0].length}`);
    
    // Análisis de contenido por columnas
    console.log('\n🔍 ANÁLISIS POR COLUMNAS:');
    rows[0].forEach((header, colIndex) => {
      const values = [];
      for (let i = 1; i < Math.min(rows.length, 20); i++) {
        const value = rows[i] ? rows[i][colIndex] || '' : '';
        if (value && !values.includes(value)) {
          values.push(value);
        }
      }
      console.log(`\n${header} (Col ${colIndex}):`);
      console.log(`  Valores únicos encontrados: ${values.slice(0, 10).join(', ')}`);
      if (values.length > 10) {
        console.log(`  ... y ${values.length - 10} más`);
      }
    });

  } catch (error) {
    console.error('❌ Error analizando estructura:', error.message);
  }
}

analyzeExcelStructure();