import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import {
  exchangeRates,
  financialAuditEvents,
  financialCloseChecks,
  financialClosePeriods,
  monthlyFinancialSummary,
  revenueEvents,
} from "@shared/schema";
import { rebuildNativeFinancialFacts } from "./financial-native-builders";
import { buildFactLaborFromTimeEntries, getCutoverDate } from "../etl/time-entries-to-fact-labor";

export type CloseCheckDefinition = {
  code: string;
  severity: "info" | "warning" | "critical";
  status: "passed" | "failed";
  title: string;
  detail: string;
  actualValue?: number;
  expectedValue?: number;
  evidence?: Record<string, unknown>;
};

function closeError(message: string, statusCode = 400): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}

export function assertPeriodKey(periodKey: string): void {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey)) {
    throw closeError("El período debe usar el formato YYYY-MM.");
  }
}

function rowsOf<T = Record<string, unknown>>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: T[] })?.rows ?? []);
}

function numeric(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function collectCloseChecks(periodKey: string, runner: any = db): Promise<{ checks: CloseCheckDefinition[]; officialFxRateId: number | null }> {
  assertPeriodKey(periodKey);
  const [year, month] = periodKey.split("-").map(Number);
  const [officialFx] = await runner.select({ id: exchangeRates.id, rate: exchangeRates.rate })
    .from(exchangeRates)
    .where(and(eq(exchangeRates.year, year), eq(exchangeRates.month, month), eq(exchangeRates.isActive, true), sql`${exchangeRates.rateType} <> 'estimated'`))
    .orderBy(sql`CASE WHEN ${exchangeRates.rateType} = 'end_of_month' THEN 0 WHEN ${exchangeRates.rateType} = 'average' THEN 1 ELSE 2 END`, desc(exchangeRates.updatedAt), desc(exchangeRates.id))
    .limit(1);

  const statsResult = await runner.execute(sql`
    SELECT
      (SELECT count(*) FROM financial_intake_items
        WHERE status IN ('received','processing','needs_review','approved','failed')
          AND COALESCE(extracted_data->>'periodKey', left(original_text, 7)) = ${periodKey})::int AS pending_intake,
      (SELECT count(*) FROM activo_entries
        WHERE period_key = ${periodKey} AND voided_at IS NULL
          AND COALESCE(monto_total_usd, monto_usd, monto_ars / NULLIF(cotizacion, 0)) IS NULL)::int AS invalid_activo,
      (SELECT count(*) FROM pasivo_entries
        WHERE period_key = ${periodKey} AND voided_at IS NULL
          AND COALESCE(monto_total_usd, monto_usd, monto_ars / NULLIF(cotizacion, 0)) IS NULL)::int AS invalid_pasivo,
      (SELECT count(*) FROM cashflow_transactions
        WHERE period_key = ${periodKey} AND voided_at IS NULL
          AND COALESCE(monto_usd, monto_ars / NULLIF(cotizacion, 0)) IS NULL)::int AS invalid_cashflow,
      (SELECT count(*) FROM cashflow_transactions
        WHERE period_key = ${periodKey} AND voided_at IS NULL
          AND reconciliation_status = 'unmatched')::int AS unmatched_cashflow,
      (SELECT count(*) FROM provision_entries
        WHERE period_key = ${periodKey} AND status = 'PROPOSED')::int AS proposed_provisions,
      (SELECT count(DISTINCT fl.person_id)
        FROM fact_labor_month fl
        JOIN personnel p ON p.id=fl.person_id
        WHERE fl.period_key=${periodKey} AND COALESCE(fl.asana_hours,0)>0
          AND COALESCE(p.contract_type,'full-time')<>'freelance'
          AND EXISTS (SELECT 1 FROM system_config sc WHERE sc.config_key='app_mode_cutover_date' AND sc.description<=${periodKey}))::int AS fixed_invoice_expected,
      (SELECT count(DISTINCT fl.person_id)
        FROM fact_labor_month fl
        JOIN personnel p ON p.id=fl.person_id
        WHERE fl.period_key=${periodKey} AND COALESCE(fl.asana_hours,0)>0
          AND COALESCE(p.contract_type,'full-time')<>'freelance'
          AND EXISTS (SELECT 1 FROM system_config sc WHERE sc.config_key='app_mode_cutover_date' AND sc.description<=${periodKey})
          AND EXISTS (
            SELECT 1 FROM personal_monthly_invoices i
            WHERE i.personnel_id=fl.person_id AND i.period=${periodKey} AND i.approval_status='approved'
              AND COALESCE(i.financial_cost_mode,CASE WHEN COALESCE(i.contract_type_snapshot,p.contract_type,'full-time')='freelance' THEN 'hourly' ELSE 'invoice_actual' END)='invoice_actual'
              AND COALESCE(i.financial_cost_usd,i.declared_invoice_usd,i.financial_cost_ars,i.declared_invoice_ars,0)>0
              AND EXISTS (
                SELECT 1 FROM personal_invoice_project_allocations allocation
                WHERE allocation.invoice_id=i.id
                HAVING abs(sum(allocation.allocation_percent)-100)<=0.01
              )
          ))::int AS fixed_invoice_approved,
      (SELECT count(*) FROM (
        SELECT transfer_group_id
        FROM cashflow_transactions
        WHERE period_key = ${periodKey} AND voided_at IS NULL AND transfer_group_id IS NOT NULL
        GROUP BY transfer_group_id
        HAVING count(*) <> 2 OR abs(sum(CASE WHEN tipo_movimiento='Ingreso' THEN COALESCE(monto_usd, monto_ars/NULLIF(cotizacion,0),0) ELSE -COALESCE(monto_usd, monto_ars/NULLIF(cotizacion,0),0) END)) > 0.01
      ) unbalanced)::int AS unbalanced_transfers
  `);
  const stats = rowsOf<Record<string, unknown>>(statsResult)[0] ?? {};
  const pendingIntake = numeric(stats.pending_intake);
  const invalidAmounts = numeric(stats.invalid_activo) + numeric(stats.invalid_pasivo) + numeric(stats.invalid_cashflow);
  const unmatchedCashflow = numeric(stats.unmatched_cashflow);
  const proposedProvisions = numeric(stats.proposed_provisions);
  const fixedInvoiceExpected = numeric(stats.fixed_invoice_expected);
  const fixedInvoiceApproved = numeric(stats.fixed_invoice_approved);
  const fixedInvoiceMissing = Math.max(0, fixedInvoiceExpected - fixedInvoiceApproved);
  const unbalancedTransfers = numeric(stats.unbalanced_transfers);

  const checks: CloseCheckDefinition[] = [
    {
      code: "internal_transfers_balanced",
      severity: "critical",
      status: unbalancedTransfers === 0 ? "passed" : "failed",
      title: "Transferencias internas balanceadas",
      detail: unbalancedTransfers === 0
        ? "Las transferencias entre cuentas propias tienen ambas contrapartidas."
        : `Hay ${unbalancedTransfers} transferencia(s) interna(s) sin contrapartida o con diferencia.`,
      expectedValue: 0,
      actualValue: unbalancedTransfers,
    },
    {
      code: "official_fx",
      severity: "critical",
      status: officialFx ? "passed" : "failed",
      title: "Cotización oficial del período",
      detail: officialFx
        ? `Cotización activa confirmada: ${officialFx.rate} ARS/USD.`
        : "Falta una cotización activa para convertir y congelar el período.",
      expectedValue: 1,
      actualValue: officialFx ? 1 : 0,
      evidence: officialFx ? { exchangeRateId: officialFx.id, rate: officialFx.rate } : {},
    },
    {
      code: "intake_queue_empty",
      severity: "critical",
      status: pendingIntake === 0 ? "passed" : "failed",
      title: "Bandeja del período procesada",
      detail: pendingIntake === 0
        ? "No quedan cargas pendientes para este período."
        : `Hay ${pendingIntake} carga(s) sin publicar o rechazar.`,
      expectedValue: 0,
      actualValue: pendingIntake,
    },
    {
      code: "fixed_team_invoices_approved",
      severity: "critical",
      status: fixedInvoiceMissing === 0 ? "passed" : "failed",
      title: "Facturas del equipo fijo aprobadas",
      detail: fixedInvoiceMissing === 0
        ? `Las ${fixedInvoiceApproved} factura(s) requeridas del equipo fijo están aprobadas.`
        : `Faltan aprobar ${fixedInvoiceMissing} de ${fixedInvoiceExpected} factura(s) del equipo fijo. Sin ellas el costo financiero seguiría siendo estimado.`,
      expectedValue: fixedInvoiceExpected,
      actualValue: fixedInvoiceApproved,
      evidence: { expected: fixedInvoiceExpected, approved: fixedInvoiceApproved },
    },
    {
      code: "normalized_amounts",
      severity: "critical",
      status: invalidAmounts === 0 ? "passed" : "failed",
      title: "Importes convertibles a USD",
      detail: invalidAmounts === 0
        ? "Todos los movimientos poseen importe normalizado o cotización."
        : `Hay ${invalidAmounts} registro(s) sin importe USD calculable.`,
      expectedValue: 0,
      actualValue: invalidAmounts,
      evidence: {
        activo: numeric(stats.invalid_activo),
        pasivo: numeric(stats.invalid_pasivo),
        cashflow: numeric(stats.invalid_cashflow),
      },
    },
    {
      code: "cashflow_reconciled",
      severity: "warning",
      status: unmatchedCashflow === 0 ? "passed" : "failed",
      title: "Movimientos bancarios conciliados",
      detail: unmatchedCashflow === 0
        ? "Todos los movimientos están conciliados."
        : `Quedan ${unmatchedCashflow} movimiento(s) sin conciliar.`,
      expectedValue: 0,
      actualValue: unmatchedCashflow,
    },
    {
      code: "provisions_approved",
      severity: "warning",
      status: proposedProvisions === 0 ? "passed" : "failed",
      title: "Provisiones revisadas",
      detail: proposedProvisions === 0
        ? "No quedan provisiones propuestas."
        : `Quedan ${proposedProvisions} provisión(es) propuestas sin aprobar.`,
      expectedValue: 0,
      actualValue: proposedProvisions,
    },
  ];
  return { checks, officialFxRateId: officialFx?.id ?? null };
}

export async function runFinancialPreClose(periodKey: string, actorUserId: number) {
  assertPeriodKey(periodKey);
  const cutoverDate = await getCutoverDate();
  if (cutoverDate && periodKey >= cutoverDate) await buildFactLaborFromTimeEntries(periodKey);
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'financial-period:' + periodKey}))`);
    const { checks, officialFxRateId } = await collectCloseChecks(periodKey, tx);
    const [existing] = await tx.select().from(financialClosePeriods)
      .where(eq(financialClosePeriods.periodKey, periodKey)).limit(1);
    if (existing?.status === "CLOSED") throw closeError("El período ya está cerrado.", 409);
    const [period] = existing
      ? await tx.update(financialClosePeriods).set({
          status: "PRE_CLOSE",
          officialFxRateId,
          checklistVersion: existing.checklistVersion + 1,
          updatedAt: new Date(),
        }).where(eq(financialClosePeriods.id, existing.id)).returning()
      : await tx.insert(financialClosePeriods).values({ periodKey, status: "PRE_CLOSE", officialFxRateId }).returning();

    await rebuildNativeFinancialFacts(periodKey, tx);

    for (const check of checks) {
      const [old] = await tx.select().from(financialCloseChecks).where(and(
        eq(financialCloseChecks.closePeriodId, period.id),
        eq(financialCloseChecks.code, check.code),
      )).limit(1);
      const keepHumanResolution = old && check.severity !== "critical" && ["accepted", "resolved"].includes(old.status) && check.status === "failed";
      const payload = {
        severity: check.severity,
        status: keepHumanResolution ? old.status : check.status,
        title: check.title,
        detail: check.detail,
        expectedValue: check.expectedValue == null ? null : String(check.expectedValue),
        actualValue: check.actualValue == null ? null : String(check.actualValue),
        delta: check.expectedValue == null || check.actualValue == null ? null : String(check.actualValue - check.expectedValue),
        evidence: check.evidence ?? {},
        resolution: keepHumanResolution ? old.resolution : null,
        resolvedBy: keepHumanResolution ? old.resolvedBy : null,
        resolvedAt: keepHumanResolution ? old.resolvedAt : null,
        updatedAt: new Date(),
      };
      if (old) await tx.update(financialCloseChecks).set(payload).where(eq(financialCloseChecks.id, old.id));
      else await tx.insert(financialCloseChecks).values({ closePeriodId: period.id, code: check.code, ...payload });
    }
    await tx.insert(financialAuditEvents).values({ periodKey, entityType: "financial_close_period", entityId: period.id, action: "pre_close_run", actorUserId, afterData: { checks: checks.length } });
    return period;
  });
}

type Snapshot = {
  totalActivo: number;
  totalPasivo: number;
  cajaTotal: number;
  cashflowIngresos: number;
  cashflowEgresos: number;
  cuentasCobrarUsd: number;
  cuentasPagarUsd: number;
  facturacionTotal: number;
  costosDirectos: number;
  costosDirectosOperativos: number;
  costosIndirectos: number;
  ivaCompras: number;
  impuestosUsa: number;
  provisiones: number;
  provisionExpense: number;
};

async function calculateSnapshot(tx: any, periodKey: string, officialRate: number): Promise<Snapshot> {
  const result = await tx.execute(sql`
    SELECT
      COALESCE((SELECT sum(CASE WHEN tipo_movimiento='Ingreso' THEN COALESCE(monto_usd, monto_ars/NULLIF(cotizacion,0)) ELSE 0 END) FROM cashflow_transactions WHERE period_key=${periodKey} AND voided_at IS NULL AND transfer_group_id IS NULL),0) AS ingresos,
      COALESCE((SELECT sum(CASE WHEN tipo_movimiento='Egreso' THEN COALESCE(monto_usd, monto_ars/NULLIF(cotizacion,0)) ELSE 0 END) FROM cashflow_transactions WHERE period_key=${periodKey} AND voided_at IS NULL AND transfer_group_id IS NULL),0) AS egresos,
      COALESCE((SELECT sum(CASE WHEN currency='ARS' THEN opening_balance/${officialRate} ELSE opening_balance END) FROM financial_accounts WHERE is_active=true AND (opening_balance_date IS NULL OR opening_balance_date < (${periodKey} || '-01')::date + interval '1 month')),0) AS opening_cash,
      COALESCE((SELECT sum(CASE WHEN tipo_movimiento='Ingreso' AND transfer_group_id IS NULL THEN COALESCE(monto_usd,monto_ars/NULLIF(cotizacion,0),0) WHEN tipo_movimiento='Egreso' AND transfer_group_id IS NULL THEN -COALESCE(monto_usd,monto_ars/NULLIF(cotizacion,0),0) ELSE 0 END) FROM cashflow_transactions WHERE period_key<=${periodKey} AND source<>'excel' AND voided_at IS NULL),0) AS cumulative_cashflow,
      COALESCE((SELECT sum(CASE WHEN COALESCE(currency, CASE WHEN monto_usd IS NOT NULL THEN 'USD' ELSE 'ARS' END)='ARS' THEN COALESCE(outstanding_amount,0)/NULLIF(cotizacion,0) ELSE COALESCE(outstanding_amount,0) END) FROM activo_entries WHERE period_key<=${periodKey} AND voided_at IS NULL),0) AS cobrar,
      COALESCE((SELECT sum(CASE WHEN COALESCE(currency, CASE WHEN monto_usd IS NOT NULL THEN 'USD' ELSE 'ARS' END)='ARS' THEN COALESCE(outstanding_amount,0)/NULLIF(cotizacion,0) ELSE COALESCE(outstanding_amount,0) END) FROM pasivo_entries WHERE period_key<=${periodKey} AND voided_at IS NULL),0) AS pagar,
      COALESCE((SELECT sum(amount_usd) FROM revenue_events WHERE invoice_period=${periodKey} AND status <> 'cancelled'),0) AS facturacion,
      COALESCE((SELECT direct_usd FROM fact_cost_month WHERE period_key=${periodKey}),0) AS costos_directos,
      COALESCE((SELECT sum(cost_usd) FROM fact_labor_month WHERE period_key=${periodKey}),0) AS costos_directos_operativos,
      COALESCE((SELECT indirect_usd FROM fact_cost_month WHERE period_key=${periodKey}),0) AS costos_indirectos,
      COALESCE((SELECT sum(COALESCE(tax_amount,0)/CASE WHEN currency='ARS' THEN NULLIF(cotizacion,0) ELSE 1 END) FROM pasivo_entries WHERE period_key=${periodKey} AND voided_at IS NULL),0) AS iva_compras,
      COALESCE((SELECT sum(amount_usd) FROM pl_adjustments WHERE period_key=${periodKey} AND type='impuesto'),0) AS impuestos,
      COALESCE((SELECT sum(CASE WHEN currency='ARS' THEN COALESCE(remaining_amount,monto_provision,0)/${officialRate} ELSE COALESCE(remaining_amount,monto_provision,0) END) FROM provision_entries WHERE period_key<=${periodKey} AND status IN ('APPROVED','ACTIVE')),0) AS provisiones,
      COALESCE((SELECT provisions_usd FROM fact_cost_month WHERE period_key=${periodKey}),0) AS provision_expense
  `);
  const row = rowsOf<Record<string, unknown>>(result)[0] ?? {};
  const ingresos = numeric(row.ingresos);
  const egresos = numeric(row.egresos);
  const cajaTotal = numeric(row.opening_cash) + numeric(row.cumulative_cashflow);
  const cuentasCobrarUsd = numeric(row.cobrar);
  const cuentasPagarUsd = numeric(row.pagar);
  const provisiones = numeric(row.provisiones);
  return {
    totalActivo: cajaTotal + cuentasCobrarUsd, totalPasivo: cuentasPagarUsd + provisiones,
    cajaTotal,
    cashflowIngresos: ingresos, cashflowEgresos: egresos,
    cuentasCobrarUsd, cuentasPagarUsd,
    facturacionTotal: numeric(row.facturacion), costosDirectos: numeric(row.costos_directos),
    costosDirectosOperativos: numeric(row.costos_directos_operativos),
    costosIndirectos: numeric(row.costos_indirectos), ivaCompras: numeric(row.iva_compras),
    impuestosUsa: numeric(row.impuestos), provisiones, provisionExpense: numeric(row.provision_expense),
  };
}

export async function requestFinancialCloseReview(periodKey: string, actorUserId: number, notes?: string | null) {
  assertPeriodKey(periodKey);
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'financial-period:' + periodKey}))`);
    const [period] = await tx.select().from(financialClosePeriods).where(eq(financialClosePeriods.periodKey, periodKey)).limit(1);
    if (!period) throw closeError("Ejecutá el pre-cierre antes de enviar a revisión.", 409);
    if (period.status === "CLOSED") throw closeError("El período ya está cerrado.", 409);
    if (period.status !== "PRE_CLOSE") throw closeError("Ejecutá nuevamente el pre-cierre antes de enviar a revisión.", 409);
    const [updated] = await tx.update(financialClosePeriods).set({ status: "IN_REVIEW", requestedBy: actorUserId, requestedAt: new Date(), notes: notes ?? period.notes, updatedAt: new Date() }).where(eq(financialClosePeriods.id, period.id)).returning();
    await tx.insert(financialAuditEvents).values({ periodKey, entityType: "financial_close_period", entityId: period.id, action: "review_requested", actorUserId, afterData: { notes: notes ?? null } });
    return updated;
  });
}

export async function closeFinancialPeriod(periodKey: string, actorUserId: number) {
  assertPeriodKey(periodKey);
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'financial-period:' + periodKey}))`);
    const [period] = await tx.select().from(financialClosePeriods).where(eq(financialClosePeriods.periodKey, periodKey)).limit(1);
    if (!period) throw closeError("Ejecutá el pre-cierre antes de cerrar.", 409);
    if (period.status === "CLOSED") return period;
    if (period.status !== "IN_REVIEW") throw closeError("El período debe estar en revisión antes del cierre.", 409);
    const blocking = await tx.select().from(financialCloseChecks).where(and(
      eq(financialCloseChecks.closePeriodId, period.id),
      eq(financialCloseChecks.severity, "critical"),
      eq(financialCloseChecks.status, "failed"),
    ));
    if (blocking.length) throw closeError(`Hay ${blocking.length} control(es) crítico(s) sin resolver.`, 409);
    if (!period.officialFxRateId) throw closeError("Falta fijar la cotización oficial.", 409);
    const [fx] = await tx.select({ rate: exchangeRates.rate }).from(exchangeRates).where(eq(exchangeRates.id, period.officialFxRateId)).limit(1);
    if (!fx) throw closeError("La cotización oficial seleccionada ya no existe.", 409);
    const snapshot = await calculateSnapshot(tx, periodKey, numeric(fx.rate));
    const [year, monthNumber] = periodKey.split("-").map(Number);
    const balanceNeto = snapshot.totalActivo - snapshot.totalPasivo;
    const cashflowNeto = snapshot.cashflowIngresos - snapshot.cashflowEgresos;
    const ebit = snapshot.facturacionTotal - snapshot.costosDirectos - snapshot.costosIndirectos - snapshot.impuestosUsa;
    const beneficio = ebit - snapshot.provisionExpense;
    const payload = {
      year, monthNumber, monthLabel: periodKey, cierreDate: new Date(),
      totalActivo: String(snapshot.totalActivo), totalPasivo: String(snapshot.totalPasivo), balanceNeto: String(balanceNeto),
      cajaTotal: String(snapshot.cajaTotal), cashflowIngresos: String(snapshot.cashflowIngresos), cashflowEgresos: String(snapshot.cashflowEgresos), cashflowNeto: String(cashflowNeto),
      cuentasCobrarUsd: String(snapshot.cuentasCobrarUsd), cuentasPagarUsd: String(snapshot.cuentasPagarUsd), facturacionTotal: String(snapshot.facturacionTotal),
      costosDirectos: String(snapshot.costosDirectos), costosIndirectos: String(snapshot.costosIndirectos), ivaCompras: String(snapshot.ivaCompras), impuestosUsa: String(snapshot.impuestosUsa),
      pasivoFacturacionAdelantada: String(snapshot.provisiones), ebitOperativo: String(ebit), beneficioNeto: String(beneficio),
      // Markup is an operational efficiency metric, so it stays on hours ×
      // historical rate even though P&L uses the approved real invoice cost.
      markupPromedio: snapshot.costosDirectosOperativos ? String(snapshot.facturacionTotal / snapshot.costosDirectosOperativos) : null,
      margenOperativo: snapshot.facturacionTotal ? String((ebit / snapshot.facturacionTotal) * 100) : null,
      margenNeto: snapshot.facturacionTotal ? String((beneficio / snapshot.facturacionTotal) * 100) : null,
      updatedAt: new Date(),
    };
    await tx.insert(monthlyFinancialSummary).values({ periodKey, ...payload }).onConflictDoUpdate({ target: monthlyFinancialSummary.periodKey, set: payload });
    await tx.update(revenueEvents).set({ periodClosed: true, updatedAt: new Date() }).where(eq(revenueEvents.invoicePeriod, periodKey));
    const [closed] = await tx.update(financialClosePeriods).set({ status: "CLOSED", closedBy: actorUserId, closedAt: new Date(), snapshotVersion: period.snapshotVersion + 1, updatedAt: new Date() }).where(eq(financialClosePeriods.id, period.id)).returning();
    await tx.insert(financialAuditEvents).values({ periodKey, entityType: "financial_close_period", entityId: period.id, action: "closed", actorUserId, afterData: { snapshotVersion: closed.snapshotVersion, snapshot } });
    return closed;
  });
}

export async function reopenFinancialPeriod(periodKey: string, actorUserId: number, reason: string) {
  assertPeriodKey(periodKey);
  if (reason.trim().length < 5) throw closeError("Indicá el motivo de reapertura (mínimo 5 caracteres).");
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'financial-period:' + periodKey}))`);
    const [period] = await tx.select().from(financialClosePeriods).where(eq(financialClosePeriods.periodKey, periodKey)).limit(1);
    if (!period) throw closeError("El período no existe.", 404);
    if (period.status !== "CLOSED") throw closeError("Sólo se puede reabrir un período cerrado.", 409);
    const [updated] = await tx.update(financialClosePeriods).set({ status: "REOPENED", reopenedBy: actorUserId, reopenedAt: new Date(), reopenReason: reason.trim(), updatedAt: new Date() }).where(eq(financialClosePeriods.id, period.id)).returning();
    await tx.update(revenueEvents).set({ periodClosed: false, updatedAt: new Date() }).where(eq(revenueEvents.invoicePeriod, periodKey));
    await tx.insert(financialAuditEvents).values({ periodKey, entityType: "financial_close_period", entityId: period.id, action: "reopened", actorUserId, reason: reason.trim() });
    return updated;
  });
}
