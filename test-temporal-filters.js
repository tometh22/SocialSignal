const fetch = require('node-fetch');

// Configuración
const BASE_URL = 'http://localhost:5000';
const PROJECT_ID = 26; // Proyecto Warner

// Filtros temporales a probar
const FILTERS = [
  { filter: 'all', label: 'Todos los tiempos' },
  { filter: 'current_month', label: 'Este mes' },
  { filter: 'last_month', label: 'Mes pasado' },
  { filter: 'may_2025', label: 'Mayo 2025' },
  { filter: 'june_2025', label: 'Junio 2025' },
  { filter: 'july_2025', label: 'Julio 2025' },
  { filter: 'current_quarter', label: 'Este trimestre' },
  { filter: 'last_quarter', label: 'Trimestre pasado' },
  { filter: 'q2_2025', label: 'Q2 2025' },
  { filter: 'current_semester', label: 'Este semestre' },
  { filter: 'last_semester', label: 'Semestre pasado' },
  { filter: 'current_year', label: 'Este año' }
];

// Función para probar un filtro
async function testFilter(filter, label) {
  try {
    const response = await fetch(`${BASE_URL}/api/projects/${PROJECT_ID}/complete-data?timeFilter=${filter}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Nota: En producción, necesitarías incluir cookies de autenticación
      }
    });

    if (!response.ok) {
      console.log(`❌ ${label}: Error ${response.status}`);
      return;
    }

    const data = await response.json();
    
    console.log(`\n📊 ${label} (${filter}):`);
    console.log(`   - Horas estimadas: ${data.quotation?.estimatedHours || 0}h`);
    console.log(`   - Horas trabajadas: ${data.actuals?.totalWorkedHours || 0}h`);
    console.log(`   - Costo estimado: $${(data.quotation?.baseCost || 0).toFixed(2)}`);
    console.log(`   - Costo real: $${(data.actuals?.totalWorkedCost || 0).toFixed(2)}`);
    console.log(`   - Precio cliente: $${(data.quotation?.totalAmount || 0).toFixed(2)}`);
    console.log(`   - Markup: ${(data.metrics?.markup || 0).toFixed(2)}x`);
    console.log(`   - Eficiencia: ${(data.metrics?.efficiency || 0).toFixed(1)}%`);
    console.log(`   - Miembros del equipo: ${data.actuals?.teamBreakdown?.length || 0}`);

  } catch (error) {
    console.log(`❌ ${label}: ${error.message}`);
  }
}

// Función principal
async function testAllFilters() {
  console.log('=== PRUEBA DE COHERENCIA DE FILTROS TEMPORALES ===');
  console.log(`Proyecto: ${PROJECT_ID} (Warner - Contrato 2025)`);
  console.log(`URL base: ${BASE_URL}`);
  console.log('');
  console.log('NOTA: Esta prueba requiere autenticación. Asegúrate de estar logueado.');
  console.log('');
  
  for (const { filter, label } of FILTERS) {
    await testFilter(filter, label);
    // Pequeña pausa entre requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n=== VERIFICACIÓN DE COHERENCIA ===');
  console.log('✓ Todos los filtros deben mostrar el mismo markup base');
  console.log('✓ Las horas/costos deben variar según el período filtrado');
  console.log('✓ Los filtros mensuales deben mostrar ~1/3 de los trimestrales');
  console.log('✓ Los filtros trimestrales deben mostrar ~1/2 de los semestrales');
}

// Ejecutar pruebas
testAllFilters().catch(console.error);