import {googleSheetsWorkingService} from "./server/services/googleSheetsWorking";

async function test() {
  const data = await googleSheetsWorkingService.fetchAllSheets();
  const rcData = data.rendimientoCliente || [];
  
  console.log(`\n📊 Total filas RC: ${rcData.length}\n`);
  
  // Filtrar agosto 2025
  const agosto = rcData.filter((row: any) => {
    const mes = (row.Mes || '').toString().toLowerCase();
    const año = (row.Año || '').toString();
    return (mes === 'agosto' || mes === '08' || mes === '8') && 
           (año === '2025' || año === 2025);
  });
  
  console.log(`📊 Filas de Agosto 2025: ${agosto.length}\n`);
  
  agosto.forEach((row: any, idx: number) => {
    console.log(`${idx + 1}. ${row.Cliente} | ${row.Proyecto} | ${row.Mes} | ${row.Año}`);
  });
  
  // Buscar Kimberly en TODOS los meses
  const kimberly = rcData.filter((row: any) => {
    const cliente = (row.Cliente || '').toLowerCase();
    return cliente.includes('kimberly');
  });
  
  console.log(`\n📊 Filas de Kimberly (todos los meses): ${kimberly.length}\n`);
  kimberly.forEach((row: any, idx: number) => {
    console.log(`${idx + 1}. ${row.Cliente} | ${row.Proyecto} | ${row.Mes} | ${row.Año}`);
  });
}

test().catch(console.error);
