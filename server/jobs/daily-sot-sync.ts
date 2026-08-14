/**
 * SoT Full Pipeline Sync Job
 *
 * Runs every 6 hours (Argentina time). Covers the full pipeline:
 *   1. Costos directos e indirectos + Rendimiento Cliente → fact_labor_month, fact_rc_month, agg_project_month
 *   2. FX rates → exchange_rates (UPSERT)
 *   3. Hourly rates → personnel_historical_costs
 *   4. Incomes → income_sot
 *   5. Costos estimados → fact_estimated_cost_month
 *
 * Guard: skips a run if a previous run is still in progress.
 */

import cron from 'node-cron';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';

let isRunning = false;

const SPREADSHEET_ID = '1FZLFmTQQOSYQns2cOYlM86UGEH7EHZsJOFegyDR7quc';

function lastNMonths(n: number): string[] {
  const periods: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push(d.toISOString().substring(0, 7));
  }
  return periods;
}

async function getSystemUserId(): Promise<number | null> {
  const { users } = await import('../../shared/schema');
  const row = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.isAdmin, true))
    .orderBy(users.id)
    .limit(1)
    .then(r => r[0]);
  return row?.id ?? null;
}

async function runFullPipeline() {
  if (isRunning) {
    console.log('⏳ [SoT Sync] Run ya en curso — saltando');
    return;
  }
  isRunning = true;
  const start = Date.now();
  console.log('🌟 [SoT Sync] Iniciando pipeline completo...');

  try {
    const { googleSheetsWorkingService } = await import('../services/googleSheetsWorking');
    const { executeSoTETL } = await import('../etl/sot-etl');

    // 1. Read raw sheet data
    const [costosRaw, rcRaw] = await Promise.all([
      googleSheetsWorkingService.getSheetValues(SPREADSHEET_ID, 'Costos directos e indirectos'),
      googleSheetsWorkingService.getSheetValues(SPREADSHEET_ID, 'Rendimiento Cliente'),
    ]);

    const costosHeaders = costosRaw[0] || [];
    const rcHeaders = rcRaw[0] || [];

    const costosRows = costosRaw.slice(1).map((row: any[], idx: number) => {
      const obj: any = { __rowId: `costos_${idx}` };
      costosHeaders.forEach((h: string, i: number) => { obj[h] = row[i]; });
      return obj;
    });

    const rcRows = rcRaw.slice(1).map((row: any[], idx: number) => {
      const obj: any = { __rowId: `rc_${idx}` };
      rcHeaders.forEach((h: string, i: number) => { obj[h] = row[i]; });
      return obj;
    });

    // 2. Execute core ETL (last 6 months)
    const periods = lastNMonths(6);
    console.log(`📅 [SoT Sync] Períodos: ${periods.join(', ')}`);

    const result = await executeSoTETL(costosRows, rcRows, {
      scopes: { periods },
      recomputeAgg: true,
    });

    if (result.success) {
      console.log(`✅ [SoT Sync] Core ETL — ${result.laborRowsProcessed} labor + ${result.rcRowsProcessed} RC → ${result.aggregatesComputed} agg`);
    } else {
      console.error('❌ [SoT Sync] Core ETL errors:', result.errors);
    }

    const systemUserId = await getSystemUserId();

    // 3. FX rates UPSERT
    try {
      const rates = await googleSheetsWorkingService.getTiposCambio();
      const { exchangeRates } = await import('../../shared/schema');
      const MONTH_NUM: Record<string, number> = {
        ene:1,feb:2,mar:3,abr:4,may:5,jun:6,jul:7,ago:8,sep:9,oct:10,nov:11,dic:12,
      };
      let fxSynced = 0;
      for (const r of rates as any[]) {
        const month = MONTH_NUM[r.mes?.toLowerCase()?.substring(0, 3) ?? ''];
        if (!month || !r.año || !r.tipoCambio) continue;
        const existing = await db
          .select({ id: exchangeRates.id })
          .from(exchangeRates)
          .where(and(eq(exchangeRates.year, r.año), eq(exchangeRates.month, month), eq(exchangeRates.isActive, true)))
          .limit(1);
        if (existing.length > 0) {
          await db.update(exchangeRates)
            .set({ rate: r.tipoCambio.toString(), source: 'auto_sync_maestro', updatedAt: new Date() })
            .where(eq(exchangeRates.id, existing[0].id));
        } else if (systemUserId) {
          await db.insert(exchangeRates).values({
            year: r.año, month, rate: r.tipoCambio.toString(),
            source: 'auto_sync_maestro', isActive: true, createdBy: systemUserId,
          });
        }
        fxSynced++;
      }
      console.log(`✅ [SoT Sync] FX: ${fxSynced} tipos de cambio sincronizados`);
    } catch (e: any) {
      console.warn('⚠️ [SoT Sync] FX sync falló:', e?.message);
    }

    // 4. Hourly rates (personnel_historical_costs)
    try {
      const { fetchValorHoraForYear } = await import('../services/personnelSheetsSync');
      const { applyCanonicalPersonnelRateRows } = await import('../services/personnel-cost-sync');
      const { sheetPersonnelAliases, personnel } = await import('../../shared/schema');
      const [aliasRows, allPersonnel] = await Promise.all([
        db.select().from(sheetPersonnelAliases),
        db.select().from(personnel),
      ]);
      const aliasBySheetName = new Map<string, number | null>(aliasRows.map((a: any) => [a.sheetName, a.personnelId]));
      const personnelByName  = new Map<string, number>(allPersonnel.map((p: any) => [p.name.trim().toLowerCase(), p.id]));
      const cy = new Date().getFullYear();
      for (const yr of [cy - 1, cy]) {
        try {
          const rows2 = await fetchValorHoraForYear(yr);
          const result = await applyCanonicalPersonnelRateRows(
            rows2,
            null,
            yr,
            aliasBySheetName,
            personnelByName,
            allPersonnel,
            'google-master-daily-job',
          );
          console.log(`✅ [SoT Sync] Rates ${yr}: ${result.cellsUpdated} celdas, ${result.warnings.length} advertencias`);
        } catch (e: any) {
          console.warn(`⚠️ [SoT Sync] Rates ${yr} falló:`, e?.message);
        }
      }
    } catch (e: any) {
      console.warn('⚠️ [SoT Sync] Hourly rates sync falló:', e?.message);
    }

    // 5. Incomes (income_sot)
    try {
      const { googleSheetsWorkingService: gws } = await import('../services/googleSheetsWorking');
      const proyectos = await gws.getProyectosConfirmados();
      const { importIncomesFromConfirmed } = await import('../etl/import-incomes-confirmed');
      const incomeRows = (proyectos as any[]).map((p: any) => ({
        'Mes Facturación': p.mesFacturacion,
        'Año Facturación': p.añoFacturacion,
        'Cliente': p.cliente,
        'Detalle': p.detalle || p.proyecto,
        'Tipo de proyecto': (p.proyecto || '').toLowerCase().includes('fee') ? 'Fee' : 'Puntual',
        'Confirmado': p.confirmado ? 'Sí' : 'No',
        'Pasado/Futuro': p.pasadoFuturo || '',
        'Cotización': '',
        'Moneda Original ARS': p.monedaARS ? String(p.monedaARS) : '',
        'Moneda Original USD': p.monedaUSD ? String(p.monedaUSD) : '',
        'Monto Total USD': String(p.monedaUSD || ''),
      }));
      const ir = await importIncomesFromConfirmed(incomeRows);
      console.log(`✅ [SoT Sync] Ingresos: ${ir.inserted} insertados, ${ir.updated} actualizados`);
    } catch (e: any) {
      console.warn('⚠️ [SoT Sync] Income sync falló:', e?.message);
    }

    // 6. Costos estimados
    try {
      const { googleSheetsWorkingService: gws } = await import('../services/googleSheetsWorking');
      const rawCE = await gws.getSheetValues(
        SPREADSHEET_ID, 'Costos estimados', { valueRenderOption: 'UNFORMATTED_VALUE' }
      );
      const { parseEstimatedCosts, runEstimatedCostsETL } = await import('../etl/costos-estimados-etl.js');
      const parsed = parseEstimatedCosts(rawCE);
      const ce = await runEstimatedCostsETL(parsed);
      console.log(`✅ [SoT Sync] Costos estimados: ${ce.inserted}/${ce.parsed} filas insertadas`);
    } catch (e: any) {
      console.warn('⚠️ [SoT Sync] Costos estimados falló:', e?.message);
    }

    const elapsed = Math.round((Date.now() - start) / 1000);
    console.log(`🏁 [SoT Sync] Pipeline completo en ${elapsed}s`);

  } catch (error: any) {
    console.error('❌ [SoT Sync] Error fatal:', error?.message || error);
  } finally {
    isRunning = false;
  }
}

// ── scheduler ──────────────────────────────────────────────────────────────

export function startDailySoTSync() {
  // Every 6 hours: 0 */6 * * *
  // Fires at 02:00 / 08:00 / 14:00 / 20:00 Argentina time
  const schedule = '0 */6 * * *';

  console.log('📅 [SoT Sync] Programado cada 6 horas (02/08/14/20 hs AR)');

  // Run once at startup after 60s (let DB and server settle)
  setTimeout(() => {
    runFullPipeline().catch(err =>
      console.error('❌ [SoT Sync] Error en sync inicial:', err?.message || err)
    );
  }, 60_000);

  const job = cron.schedule(schedule, () => {
    runFullPipeline().catch(err =>
      console.error('❌ [SoT Sync] Error en sync programado:', err?.message || err)
    );
  }, { timezone: 'America/Argentina/Buenos_Aires' } as any);

  job.start();
  return job;
}

export async function triggerManualSync() {
  return runFullPipeline();
}
