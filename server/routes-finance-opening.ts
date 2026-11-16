import { Router } from "express";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { activoEntries, financialAccounts, financialAuditEvents, financialClosePeriods, pasivoEntries, provisionEntries, provisionMovements } from "@shared/schema";
import { addMonths, FINANCE_NATIVE_START_KEY, isPeriodKey } from "@shared/finance-native";
import { db, pool } from "./db";
import { requirePermission } from "./middleware/requirePermission";
import { masterOpeningItems, type OpeningMoney } from "./domain/opening-balances";
import { parseProvisionMatrix } from "./domain/ledger-snapshot";
import { getNativeStartPeriod } from "./services/finance-period-source";

const SPREADSHEET_ID = "1FZLFmTQQOSYQns2cOYlM86UGEH7EHZsJOFegyDR7quc";
const httpError = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });

/**
 * Saldos iniciales for the switchover to Mind. Opening rows are stored with
 * source 'opening' in the switchover month: they are balances carried from the
 * Máster, never sales or expenses (payables are balance_only, provisions use an
 * 'opening' movement and investments are valuations).
 */
export function createFinanceOpeningRouter(requireAuth: any) {
  const router = Router();
  const finance = [requireAuth, requirePermission("finance")];

  const requireEditableStart = async () => {
    const start = await getNativeStartPeriod();
    if (!start) throw httpError("Primero definí desde qué mes Finanzas se registra en Mind.", 409);
    const [close] = await db.select({ status: financialClosePeriods.status }).from(financialClosePeriods).where(eq(financialClosePeriods.periodKey, start)).limit(1);
    if (close && ["IN_REVIEW", "CLOSED"].includes(close.status)) throw httpError(`${start} está ${close.status === "CLOSED" ? "cerrado" : "en revisión"}: reabrilo para cambiar los saldos iniciales.`, 409);
    return start;
  };
  const moneyColumns = (value: OpeningMoney) => ({
    currency: value.currency,
    montoARS: value.currency === "ARS" ? String(value.amount) : null,
    montoUSD: value.currency === "USD" ? String(value.amount) : null,
    cotizacion: value.rate == null ? null : String(value.rate),
    montoTotalUSD: String(value.amountUsd),
    originalAmount: String(value.amount), grossAmount: String(value.amount), netAmount: String(value.amount), outstandingAmount: String(value.amount),
  });
  const send = (res: any, error: any) => res.status(error.statusCode ?? 500).json({ message: error.message });

  router.get("/finance/opening", ...finance, async (_req, res) => {
    try {
      const start = await getNativeStartPeriod();
      const [accounts, receivables, payables, investments, provisions, close] = await Promise.all([
        db.select().from(financialAccounts).where(eq(financialAccounts.isActive, true)),
        start ? db.select().from(activoEntries).where(and(eq(activoEntries.source, "opening"), eq(activoEntries.periodKey, start), sql`${activoEntries.voidedAt} IS NULL`, sql`COALESCE(${activoEntries.tipoActivo},'') <> 'Mediano Plazo'`)) : [],
        start ? db.select().from(pasivoEntries).where(and(eq(pasivoEntries.source, "opening"), eq(pasivoEntries.periodKey, start), sql`${pasivoEntries.voidedAt} IS NULL`)) : [],
        start ? db.select().from(activoEntries).where(and(eq(activoEntries.source, "opening"), eq(activoEntries.periodKey, start), sql`${activoEntries.voidedAt} IS NULL`, eq(activoEntries.tipoActivo, "Mediano Plazo"))) : [],
        start ? pool.query(`SELECT p.*, m.amount::float8 opening_amount FROM provision_entries p JOIN provision_movements m ON m.provision_id=p.id AND m.movement_type='opening' WHERE m.period_key=$1`, [start]).then(r => r.rows) : [],
        start ? db.select({ status: financialClosePeriods.status }).from(financialClosePeriods).where(eq(financialClosePeriods.periodKey, start)).limit(1) : [],
      ]);
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ startPeriod: start, asOf: start ? addMonths(start, -1) : null, locked: ["IN_REVIEW", "CLOSED"].includes((close as any[])[0]?.status ?? ""), accounts, receivables, payables, investments, provisions });
    } catch (error: any) { send(res, error); }
  });

  router.put("/finance/opening/start", requireAuth, requirePermission("admin"), async (req, res) => {
    try {
      const period = String(req.body?.period ?? "");
      if (!isPeriodKey(period)) return res.status(400).json({ message: "El mes debe tener el formato AAAA-MM." });
      const { rows: closed } = await pool.query(`SELECT 1 FROM financial_close_periods WHERE period_key >= $1 AND status IN ('IN_REVIEW','CLOSED') LIMIT 1`, [period]);
      if (closed.length) return res.status(409).json({ message: "Hay meses cerrados o en revisión desde esa fecha; no se puede mover el cambio." });
      const previous = await getNativeStartPeriod();
      await pool.query(`DELETE FROM system_config WHERE config_key=$1`, [FINANCE_NATIVE_START_KEY]);
      await pool.query(`INSERT INTO system_config(config_key, config_value, description, updated_by) VALUES ($1, 0, $2, $3)`, [FINANCE_NATIVE_START_KEY, period, req.user!.id]);
      await db.insert(financialAuditEvents).values({ periodKey: period, entityType: "finance_native_start", entityId: 0, action: "switchover_set", beforeData: { period: previous }, afterData: { period }, actorUserId: req.user!.id });
      res.json({ startPeriod: period });
    } catch (error: any) { send(res, error); }
  });

  /** Replaces every opening row with the Máster detail of the month before the switchover. */
  router.post("/finance/opening/import-master", ...finance, async (req, res) => {
    try {
      const start = await requireEditableStart();
      const asOf = addMonths(start, -1);
      const { createSheetsClient } = await import("./services/direct-sheets-dashboard");
      const { getMasterScenarioSnapshot } = await import("./services/financial-master-scenario");
      const { buildMasterDashboard } = await import("./services/financial-master-dashboard");
      const response = await createSheetsClient().spreadsheets.values.batchGet({ spreadsheetId: SPREADSHEET_ID, ranges: ["'Activo'!A:Q", "'Pasivo'!A:O", "'Provisión pasivo'!A:Z"], valueRenderOption: "UNFORMATTED_VALUE" }, { timeout: 30_000 });
      const [activo, pasivo, provisionValues] = (response.data.valueRanges ?? []).map(range => (range.values ?? []) as unknown[][]);
      const items = masterOpeningItems({ activo: activo ?? [], pasivo: pasivo ?? [] }, asOf);
      if (!items.banks.length && !items.receivables.length && !items.payables.length) throw httpError(`El Máster no tiene datos de ${asOf} para tomar como saldo inicial.`, 409);
      const resumen = buildMasterDashboard(await getMasterScenarioSnapshot(), [asOf])[0];
      const year = Number(asOf.slice(0, 4));
      const matrix = provisionValues?.length ? parseProvisionMatrix(provisionValues, new Map([[asOf, resumen?.pasivoFacturacionAdelantada ?? null]]), { candidateYears: [year - 2, year - 1, year] }) : null;
      const provisions = matrix?.ok ? matrix.rows.get(asOf) ?? [] : [];
      const openingDate = new Date(`${start}-01T12:00:00Z`);
      const result = await db.transaction(async tx => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"finance-opening"}))`);
        await tx.delete(activoEntries).where(and(eq(activoEntries.source, "opening"), eq(activoEntries.periodKey, start)));
        await tx.delete(pasivoEntries).where(and(eq(pasivoEntries.source, "opening"), eq(pasivoEntries.periodKey, start)));
        await tx.execute(sql`DELETE FROM provision_entries WHERE id IN (SELECT provision_id FROM provision_movements WHERE movement_type='opening' AND period_key=${start})`);
        for (const bank of items.banks) {
          const [existing] = await tx.select().from(financialAccounts).where(sql`lower(${financialAccounts.name}) = lower(${bank.name})`).limit(1);
          const values = { name: bank.name, bankName: bank.name, currency: bank.currency, openingBalance: String(bank.amount), openingBalanceDate: openingDate, accountType: "bank", isActive: true };
          if (existing) await tx.update(financialAccounts).set({ openingBalance: values.openingBalance, openingBalanceDate: openingDate, currency: bank.currency, isActive: true }).where(eq(financialAccounts.id, existing.id));
          else await tx.insert(financialAccounts).values(values as any);
        }
        if (items.receivables.length) await tx.insert(activoEntries).values(items.receivables.map((item, index) => ({
          periodKey: start, tipoActivo: "Clientes a cobrar", concepto: "Saldo inicial", detalle: item.detail, clienteNombre: item.clientName, razonSocial: item.clientName,
          nroFactura: item.invoiceNumber, fechaVencimiento: item.dueDate ? new Date(`${item.dueDate}T12:00:00Z`) : null, documentType: "opening_balance",
          status: "PENDING", source: "opening", externalId: `opening:${start}:activo:${index + 1}`, overrideManual: true, createdBy: req.user!.id, ...moneyColumns(item),
        })) as any);
        if (items.investments.length) await tx.insert(activoEntries).values(items.investments.map((item, index) => ({
          periodKey: start, tipoActivo: "Mediano Plazo", concepto: item.name, documentType: "investment_valuation", status: "PENDING", source: "opening",
          externalId: `opening:${start}:inversion:${index + 1}`, overrideManual: true, createdBy: req.user!.id,
          ...moneyColumns({ currency: "USD", amount: item.amountUsd, rate: null, amountUsd: item.amountUsd }),
        })) as any);
        if (items.payables.length) await tx.insert(pasivoEntries).values(items.payables.map((item, index) => ({
          periodKey: start, detalle: item.detail, vendorName: item.detail, subtipoCosto: item.subtype, descripcion: item.document,
          fechaVencimiento: item.dueDate ? new Date(`${item.dueDate}T12:00:00Z`) : null, costTreatment: "balance_only", status: "PENDING",
          source: "opening", externalId: `opening:${start}:pasivo:${index + 1}`, overrideManual: true, createdBy: req.user!.id, ...moneyColumns(item),
        })) as any);
        for (const provision of provisions) {
          const [created] = await tx.insert(provisionEntries).values({ periodKey: start, clienteNombre: provision.clienteNombre, criterio: provision.criterio, tipo: "NUEVA_PROVISION",
            montoProvision: String(provision.balanceUsd), remainingAmount: String(provision.balanceUsd), currency: "USD", status: "ACTIVE", mesAplicacion: start, createdBy: req.user!.id }).returning();
          await tx.insert(provisionMovements).values({ provisionId: created.id, periodKey: start, movementType: "opening", amount: String(provision.balanceUsd), currency: "USD", note: `Saldo inicial al cierre de ${asOf}`, createdBy: req.user!.id });
        }
        const summary = { asOf, banks: items.banks.length, receivables: items.receivables.length, payables: items.payables.length, investments: items.investments.length, provisions: provisions.length,
          totals: { banksUsd: items.banks.reduce((s, b) => s + b.amountUsd, 0), receivablesUsd: items.receivables.reduce((s, r) => s + r.amountUsd, 0), payablesUsd: items.payables.reduce((s, p) => s + p.amountUsd, 0),
            investmentsUsd: items.investments.reduce((s, i) => s + i.amountUsd, 0), provisionsUsd: provisions.reduce((s, p) => s + p.balanceUsd, 0) },
          resumen: resumen ? { activoLiquido: resumen.activoLiquido, clientesACobrar: resumen.clientesACobrar, pasivoProveedores: resumen.pasivoProveedores, pasivoImpuestosUSA: resumen.pasivoImpuestosUSA, provisiones: resumen.pasivoFacturacionAdelantada, crypto: resumen.activoMedPlazo } : null,
          provisionWarning: matrix && !matrix.ok ? matrix.reason : matrix?.ok && matrix.mismatched.length ? `La matriz de provisiones no concilia con el Resumen de ${asOf}.` : null };
        await tx.insert(financialAuditEvents).values({ periodKey: start, entityType: "finance_opening", entityId: 0, action: "imported_from_master", afterData: summary, actorUserId: req.user!.id });
        return summary;
      });
      res.json(result);
    } catch (error: any) { send(res, error); }
  });

  const moneyInput = z.object({ currency: z.enum(["USD", "ARS"]).default("USD"), amount: z.coerce.number().refine(value => value !== 0, "El importe no puede ser cero."), rate: z.coerce.number().positive().nullable().optional() })
    .refine(value => value.currency === "USD" || (value.rate ?? 0) > 0, { message: "Indicá la cotización para importes en pesos.", path: ["rate"] });
  const itemInput = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("receivable"), clientName: z.string().trim().min(1), invoiceNumber: z.string().trim().optional().nullable(), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(), detail: z.string().trim().optional().nullable(), money: moneyInput }),
    z.object({ kind: z.literal("payable"), detail: z.string().trim().min(1), subtype: z.string().trim().optional().nullable(), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(), money: moneyInput }),
    z.object({ kind: z.literal("provision"), name: z.string().trim().min(1), criterio: z.string().trim().optional().nullable(), amountUsd: z.coerce.number().refine(value => value !== 0) }),
    z.object({ kind: z.literal("investment"), name: z.string().trim().min(1), amountUsd: z.coerce.number().refine(value => value !== 0) }),
  ]);

  router.post("/finance/opening/items", ...finance, async (req, res) => {
    try {
      const parsed = itemInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.issues.map(issue => issue.message).join(" ") });
      const start = await requireEditableStart();
      const input = parsed.data;
      const toMoney = (value: z.infer<typeof moneyInput>): OpeningMoney => ({ currency: value.currency, amount: value.amount, rate: value.rate ?? null, amountUsd: value.currency === "ARS" ? value.amount / (value.rate ?? 1) : value.amount });
      const externalId = `opening:${start}:${input.kind}:manual:${Date.now()}`;
      const created = await db.transaction(async tx => {
        if (input.kind === "receivable") return (await tx.insert(activoEntries).values({ periodKey: start, tipoActivo: "Clientes a cobrar", concepto: "Saldo inicial", detalle: input.detail, clienteNombre: input.clientName, razonSocial: input.clientName,
          nroFactura: input.invoiceNumber, fechaVencimiento: input.dueDate ? new Date(`${input.dueDate}T12:00:00Z`) : null, documentType: "opening_balance", status: "PENDING", source: "opening", externalId, overrideManual: true, createdBy: req.user!.id, ...moneyColumns(toMoney(input.money)) } as any).returning())[0];
        if (input.kind === "payable") return (await tx.insert(pasivoEntries).values({ periodKey: start, detalle: input.detail, vendorName: input.detail, subtipoCosto: input.subtype, fechaVencimiento: input.dueDate ? new Date(`${input.dueDate}T12:00:00Z`) : null,
          costTreatment: "balance_only", status: "PENDING", source: "opening", externalId, overrideManual: true, createdBy: req.user!.id, ...moneyColumns(toMoney(input.money)) } as any).returning())[0];
        if (input.kind === "investment") return (await tx.insert(activoEntries).values({ periodKey: start, tipoActivo: "Mediano Plazo", concepto: input.name, documentType: "investment_valuation", status: "PENDING", source: "opening", externalId, overrideManual: true, createdBy: req.user!.id,
          ...moneyColumns({ currency: "USD", amount: input.amountUsd, rate: null, amountUsd: input.amountUsd }) } as any).returning())[0];
        const [provision] = await tx.insert(provisionEntries).values({ periodKey: start, clienteNombre: input.name, criterio: input.criterio, tipo: "NUEVA_PROVISION", montoProvision: String(input.amountUsd), remainingAmount: String(input.amountUsd), currency: "USD", status: "ACTIVE", mesAplicacion: start, createdBy: req.user!.id }).returning();
        await tx.insert(provisionMovements).values({ provisionId: provision.id, periodKey: start, movementType: "opening", amount: String(input.amountUsd), currency: "USD", note: "Saldo inicial", createdBy: req.user!.id });
        return provision;
      });
      await db.insert(financialAuditEvents).values({ periodKey: start, entityType: "finance_opening", entityId: (created as any).id, action: `opening_${input.kind}_created`, afterData: created, actorUserId: req.user!.id });
      res.status(201).json(created);
    } catch (error: any) { send(res, error); }
  });

  router.delete("/finance/opening/items/:kind/:id", ...finance, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ message: "Identificador inválido." });
      const start = await requireEditableStart();
      const kind = req.params.kind;
      const deleted = kind === "receivable" || kind === "investment"
        ? await db.delete(activoEntries).where(and(eq(activoEntries.id, id), eq(activoEntries.source, "opening"), eq(activoEntries.periodKey, start))).returning()
        : kind === "payable" ? await db.delete(pasivoEntries).where(and(eq(pasivoEntries.id, id), eq(pasivoEntries.source, "opening"), eq(pasivoEntries.periodKey, start))).returning()
        : kind === "provision" ? await db.delete(provisionEntries).where(and(eq(provisionEntries.id, id), sql`EXISTS (SELECT 1 FROM provision_movements m WHERE m.provision_id=${provisionEntries.id} AND m.movement_type='opening')`)).returning()
        : null;
      if (!deleted?.length) return res.status(404).json({ message: "No se encontró ese saldo inicial." });
      await db.insert(financialAuditEvents).values({ periodKey: start, entityType: "finance_opening", entityId: id, action: `opening_${kind}_deleted`, beforeData: deleted[0], actorUserId: req.user!.id });
      res.json({ ok: true });
    } catch (error: any) { send(res, error); }
  });

  /** Investments (crypto) as of a month: latest valuation of each one. Mind months only accept new valuations. */
  router.get("/finance/investments", ...finance, async (req, res) => {
    try {
      const period = String(req.query.period ?? "");
      if (!isPeriodKey(period)) return res.status(400).json({ message: "period debe usar el formato AAAA-MM" });
      const { getPeriodSource } = await import("./services/finance-period-source");
      const source = await getPeriodSource(period);
      const { rows } = await pool.query(`SELECT DISTINCT ON (lower(COALESCE(concepto,''))) id, period_key, concepto, monto_total_usd::float8 amount_usd, source
        FROM activo_entries WHERE period_key <= $1 AND voided_at IS NULL AND lower(translate(COALESCE(tipo_activo,''),'íÍ','iI'))='mediano plazo'
          AND ${source === "master" ? "source = 'excel' AND period_key = $1" : "COALESCE(source,'') <> 'excel'"}
        ORDER BY lower(COALESCE(concepto,'')), period_key DESC, id DESC`, [period]);
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ period, source, items: rows, totalUsd: rows.reduce((sum: number, row: any) => sum + Number(row.amount_usd || 0), 0) });
    } catch (error: any) { send(res, error); }
  });

  router.post("/finance/investments", ...finance, async (req, res) => {
    try {
      const parsed = z.object({ periodKey: z.string().refine(isPeriodKey), name: z.string().trim().min(1), amountUsd: z.coerce.number().min(0) }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Indicá el mes, el nombre y la valuación en USD." });
      const { getPeriodSource } = await import("./services/finance-period-source");
      if (await getPeriodSource(parsed.data.periodKey) === "master") return res.status(409).json({ message: "Este mes se informa desde el Máster: la valuación se carga en la pestaña Activo." });
      const [close] = await db.select({ status: financialClosePeriods.status }).from(financialClosePeriods).where(eq(financialClosePeriods.periodKey, parsed.data.periodKey)).limit(1);
      if (close && ["IN_REVIEW", "CLOSED"].includes(close.status)) return res.status(409).json({ message: "El mes está cerrado o en revisión." });
      const [created] = await db.insert(activoEntries).values({ periodKey: parsed.data.periodKey, tipoActivo: "Mediano Plazo", concepto: parsed.data.name, documentType: "investment_valuation", status: "PENDING", source: "mind_manual",
        externalId: `investment:${parsed.data.periodKey}:${Date.now()}`, overrideManual: true, createdBy: req.user!.id,
        ...moneyColumns({ currency: "USD", amount: parsed.data.amountUsd || 0.0001, rate: null, amountUsd: parsed.data.amountUsd }) } as any).returning();
      await db.insert(financialAuditEvents).values({ periodKey: parsed.data.periodKey, entityType: "activo_entry", entityId: created.id, action: "investment_valued", afterData: created, actorUserId: req.user!.id });
      res.status(201).json(created);
    } catch (error: any) { send(res, error); }
  });

  return router;
}
