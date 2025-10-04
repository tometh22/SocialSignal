import { processCosts } from './server/etl/costs';

async function fixETL() {
  console.log('🔄 Re-running ETL with cleaned data...');
  const result = await processCosts();
  console.log('✅ ETL Complete:', result);
  process.exit(0);
}

fixETL().catch(console.error);
