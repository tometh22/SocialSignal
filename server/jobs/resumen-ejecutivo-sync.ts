/**
 * Resumen Ejecutivo Auto-Sync Job
 * Sincroniza Resumen Ejecutivo + CashFlow + Activo desde Google Sheets cada 2 horas.
 * Es liviano (solo lee 3 hojas puntuales) y no causa OOM como el sync completo.
 */

import cron from 'node-cron';

let isRunning = false;

export function startResumenEjecutivoSync() {
  // Every 2 hours: 0 */2 * * *
  const schedule = '0 */2 * * *';

  console.log('📊 [Resumen Ejecutivo Sync] Programado cada 2 horas');

  // Run once at startup (after 30s delay to let DB settle)
  setTimeout(() => {
    runSync().catch(err => console.error('❌ [Resumen Ejecutivo Sync] Error en sync inicial:', err?.message || err));
  }, 30_000);

  // Schedule recurring
  cron.schedule(schedule, () => {
    runSync().catch(err => console.error('❌ [Resumen Ejecutivo Sync] Error en sync programado:', err?.message || err));
  });
}

async function runSync() {
  if (isRunning) {
    console.log('⏳ [Resumen Ejecutivo Sync] Ya hay un sync en curso, saltando...');
    return;
  }

  isRunning = true;
  const start = Date.now();

  try {
    console.log('🔄 [Resumen Ejecutivo Sync] Iniciando...');

    const {
      syncResumenEjecutivoToMonthlyFinancialSummary,
      syncCashFlowMovements,
      syncActivoToMonthlyFinancialSummary,
    } = await import('../etl/sot-etl');

    // Run all 3 syncs in parallel
    const results = await Promise.allSettled([
      syncResumenEjecutivoToMonthlyFinancialSummary(),
      syncCashFlowMovements(),
      syncActivoToMonthlyFinancialSummary(),
    ]);

    const [resumen, cashflow, activo] = results;

    if (resumen.status === 'fulfilled') {
      console.log(`  ✅ Resumen Ejecutivo: ${resumen.value.recordsInserted} insertados, ${resumen.value.recordsUpdated} actualizados`);
    } else {
      console.error(`  ❌ Resumen Ejecutivo FAILED:`, resumen.reason?.message || resumen.reason);
    }

    if (cashflow.status === 'fulfilled') {
      console.log(`  ✅ CashFlow: ${cashflow.value.recordsInserted} insertados, ${cashflow.value.recordsUpdated} actualizados`);
    } else {
      console.error(`  ❌ CashFlow FAILED:`, cashflow.reason?.message || cashflow.reason);
    }

    if (activo.status === 'fulfilled') {
      console.log(`  ✅ Activo: ${activo.value.recordsInserted} insertados, ${activo.value.recordsUpdated} actualizados`);
    } else {
      console.error(`  ❌ Activo FAILED:`, activo.reason?.message || activo.reason);
    }

    const duration = Date.now() - start;
    console.log(`✅ [Resumen Ejecutivo Sync] Completado en ${duration}ms`);
  } catch (error: any) {
    console.error('❌ [Resumen Ejecutivo Sync] Error:', error?.message || error);
  } finally {
    isRunning = false;
  }
}
