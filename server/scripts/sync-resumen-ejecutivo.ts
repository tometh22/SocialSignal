import { syncResumenEjecutivoToMonthlyFinancialSummary } from '../etl/sot-etl.js';

async function main() {
  console.log('🔄 Running Resumen Ejecutivo ETL sync...');
  const result = await syncResumenEjecutivoToMonthlyFinancialSummary();
  console.log('✅ Result:', JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
