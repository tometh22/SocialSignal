const XLSX = require('xlsx');

// Leer el archivo Excel
const workbook = XLSX.readFile('attached_assets/Economico Para Tablero_1761081004798.xlsx');

console.log('📋 Hojas disponibles:', workbook.SheetNames);

// Leer la hoja "Rendimiento Cliente" - EXACTO
const sheetName = workbook.SheetNames.find(name => 
  name === 'Rendimiento Cliente'
);

if (!sheetName) {
  console.log('❌ No se encontró hoja "Rendimiento Cliente"');
  process.exit(1);
}

console.log(`\n✅ Leyendo hoja: "${sheetName}"\n`);

const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet);

console.log(`📊 Total de filas: ${data.length}`);

// Filtrar filas de Warner en 2025
const warnerRows = data.filter(row => {
  const cliente = (row.Cliente || '').toString().toLowerCase();
  const año = parseInt(row.Año || row['Año'] || 0);
  return cliente.includes('warner') && año === 2025;
});

console.log(`\n🎯 Filas de Warner en 2025: ${warnerRows.length}`);

if (warnerRows.length === 0) {
  console.log('\n❌ NO HAY FILAS DE WARNER EN 2025');
  console.log('\nPrimeras 5 filas del archivo:');
  console.log(JSON.stringify(data.slice(0, 5), null, 2));
  process.exit(0);
}

// Agrupar por mes
const porMes = {};
warnerRows.forEach(row => {
  const mes = parseInt(row.Mes || 0);
  const año = parseInt(row.Año || row['Año'] || 0);
  const key = `${año}-${String(mes).padStart(2, '0')}`;
  
  if (!porMes[key]) {
    porMes[key] = [];
  }
  
  porMes[key].push({
    cliente: row.Cliente,
    proyecto: row.Proyecto,
    mes: mes,
    año: año,
    facturacion: row['Facturación [USD]'] || row.Facturación,
    costos: row['Costos [USD]'] || row.Costos,
    cotizacion: row.Cotización || row.Cotizacion,
    pasadoFuturo: row['Pasado/Futuro'] || '(sin valor)',
    raw: row
  });
});

// Mostrar resumen por mes (ene-sep 2025)
console.log('\n📅 RESUMEN MENSUAL WARNER 2025:\n');
for (let mes = 1; mes <= 9; mes++) {
  const key = `2025-${String(mes).padStart(2, '0')}`;
  const meses = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep'];
  
  if (porMes[key]) {
    console.log(`✅ ${meses[mes]} 2025 (${key}): ${porMes[key].length} fila(s)`);
    porMes[key].forEach(r => {
      console.log(`   - ${r.proyecto}: Facturación=${r.facturacion}, Costos=${r.costos}, FX=${r.cotizacion}, Status="${r.pasadoFuturo}"`);
    });
  } else {
    console.log(`❌ ${meses[mes]} 2025 (${key}): NO HAY DATOS`);
  }
}

// Mostrar columnas disponibles
console.log('\n📋 COLUMNAS DISPONIBLES EN LA HOJA:');
if (warnerRows[0]) {
  console.log(Object.keys(warnerRows[0]).join(', '));
}
