import { db } from './server/db';
import { financialSot } from './shared/schema';
import { eq, and } from 'drizzle-orm';

async function fixSeptiembre() {
  console.log('🔧 Corrigiendo datos de septiembre 2025 para Warner...');
  
  // Los valores correctos del Excel:
  const fixes = [
    {
      client: 'Warner',
      project: 'Fee Marketing',
      monthKey: '2025-09',
      correctRevenue: '29230',
      correctCost: '8431.365153',
      correctFx: '1445'
    },
    {
      client: 'Warner',
      project: 'Fee Insights',
      monthKey: '2025-09',
      correctRevenue: '7580',
      correctCost: '383.908456',
      correctFx: '1445'
    }
  ];
  
  for (const fix of fixes) {
    console.log(`\n📝 Actualizando ${fix.project}...`);
    console.log(`   Revenue: ${fix.correctRevenue} USD`);
    console.log(`   Cost: ${fix.correctCost} USD`);
    console.log(`   FX: ${fix.correctFx}`);
    
    await db.update(financialSot)
      .set({
        revenueUsd: fix.correctRevenue,
        costUsd: fix.correctCost,
        quotation: fix.correctFx,
      })
      .where(
        and(
          eq(financialSot.clientName, fix.client),
          eq(financialSot.projectName, fix.project),
          eq(financialSot.monthKey, fix.monthKey)
        )
      );
    
    console.log(`   ✅ Actualizado`);
  }
  
  console.log('\n✅ Corrección completada\n');
  
  // Verificar
  const result = await db.select()
    .from(financialSot)
    .where(
      and(
        eq(financialSot.clientName, 'Warner'),
        eq(financialSot.monthKey, '2025-09')
      )
    );
  
  console.log('📊 Verificación:');
  result.forEach(r => {
    console.log(`   ${r.projectName}: Revenue=${r.revenueUsd}, Cost=${r.costUsd}, FX=${r.quotation}`);
  });
  
  process.exit(0);
}

fixSeptiembre().catch(console.error);
