/**
 * Script de prueba para verificar datos de Kimberly en Rendimiento Cliente
 */

import { googleSheetsWorkingService } from './server/services/googleSheetsWorking';

async function testKimberlyRC() {
  try {
    console.log('📊 Leyendo hoja Rendimiento Cliente...');
    
    const rcRaw = await googleSheetsWorkingService.getSheetValues(
      '1FZLFmTQQOSYQns2cOYlM86UGEH7EHZsJOFegyDR7quc',
      'Rendimiento Cliente'
    );
    
    console.log(`\n✅ Total de filas: ${rcRaw.length}`);
    
    const headers = rcRaw[0] || [];
    console.log('\n📋 Headers:', headers.slice(0, 15).join(' | '));
    
    // Buscar filas de Kimberly
    const kimberlyRows = rcRaw.slice(1).filter((row, idx) => {
      const cliente = String(row[0] || '').toLowerCase();
      const proyecto = String(row[1] || '').toLowerCase();
      
      return cliente.includes('kimberly') || proyecto.includes('kimberly') || proyecto.includes('huggies');
    });
    
    console.log(`\n🔍 Filas de Kimberly encontradas: ${kimberlyRows.length}`);
    
    if (kimberlyRows.length > 0) {
      console.log('\n📊 DATOS DE KIMBERLY:');
      console.log('='.repeat(120));
      
      const clienteIdx = headers.findIndex(h => h.toLowerCase().includes('cliente'));
      const proyectoIdx = headers.findIndex(h => h.toLowerCase().includes('proyecto'));
      const mesIdx = headers.findIndex(h => h.toLowerCase() === 'mes');
      const añoIdx = headers.findIndex(h => h.toLowerCase() === 'año' || h.toLowerCase() === 'ano');
      const factARSIdx = headers.findIndex(h => h.toLowerCase().includes('facturación') && h.includes('ARS'));
      const factUSDIdx = headers.findIndex(h => h.toLowerCase().includes('facturación') && h.includes('USD'));
      const costARSIdx = headers.findIndex(h => h.toLowerCase().includes('costos') && h.includes('ARS'));
      const costUSDIdx = headers.findIndex(h => h.toLowerCase().includes('costos') && h.includes('USD'));
      
      console.log(`Índices: Cliente=${clienteIdx}, Proyecto=${proyectoIdx}, Mes=${mesIdx}, Año=${añoIdx}`);
      console.log(`         FactARS=${factARSIdx}, FactUSD=${factUSDIdx}, CostARS=${costARSIdx}, CostUSD=${costUSDIdx}`);
      console.log('');
      
      kimberlyRows.slice(0, 10).forEach((row, i) => {
        const mes = row[mesIdx];
        const año = row[añoIdx];
        const factARS = row[factARSIdx];
        const factUSD = row[factUSDIdx];
        const costARS = row[costARSIdx];
        const costUSD = row[costUSDIdx];
        
        console.log(`${i+1}. ${row[clienteIdx]} | ${row[proyectoIdx]} | ${mes}-${año}`);
        console.log(`   Fact: $${factARS} ARS / $${factUSD} USD | Cost: $${costARS} ARS / $${costUSD} USD`);
      });
    } else {
      console.log('\n❌ NO se encontraron filas de Kimberly');
      console.log('\n🔍 Primeras 5 filas (para debug):');
      rcRaw.slice(1, 6).forEach((row, i) => {
        console.log(`${i+1}. ${row[0]} | ${row[1]} | ${row[2]}-${row[3]}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testKimberlyRC();
