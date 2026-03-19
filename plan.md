# Plan: Fix Executive Dashboard Data Issues

## Root Cause Analysis

After auditing the complete data flow (Google Sheets → ETL → monthly_financial_summary → executive-unified.ts → frontend), I identified **5 root causes**:

---

### BUG 1: "Impuestos" is reverse-engineered and shows absurd values
**File:** `server/services/executive-unified.ts:247`
**Code:** `const impuestos = ebitOperativo - beneficioNeto`

This computes taxes as the difference between EBIT and Beneficio Neto. For Dic 2025:
- EBIT = -$1,220.55, Beneficio Neto = -$27,817.63
- Impuestos = -1220.55 - (-27817.63) = **$26,597.08**

This means "taxes" of $26,597 on a negative EBIT of -$1,220 — nonsensical. The real issue is that **Beneficio Neto from the Sheet already includes provisions and other deductions beyond just taxes** (e.g., facturacion adelantada, IVA, provisions). The code incorrectly treats the entire gap as "Impuestos."

**Fix:** Use the actual `impuestos_usa` column from MFS (which IS synced from the Sheet). If a separate "Impuestos" column exists in the Sheet, map it. Otherwise, show the real tax line (impuestos_usa) and add a separate "Otras Provisiones" line for the remaining gap.

---

### BUG 2: Cashflow is always $0.00 — data never reaches MFS
**File:** `server/etl/sot-etl.ts` (syncCashFlowMovements)

The cashflow sync inserts individual movements into `cash_movements` table, but **never aggregates them back into `monthly_financial_summary.cashflow_neto/ingresos/egresos`**. The only path for cashflow into MFS is via `syncResumenEjecutivoToMonthlyFinancialSummary()` which reads the "Cashflow" column from the "Resumen Ejecutivo" sheet. If that column is empty or named differently, cashflow = 0.

Additionally, `syncCashFlowMovements` reads from a "CashFlow" sheet with individual transactions, but there's NO code that sums IN/OUT movements per period and writes the totals to MFS.

**Fix:** After `syncCashFlowMovements` runs, aggregate `cash_movements` by period and update `monthly_financial_summary` with the computed `cashflow_ingresos`, `cashflow_egresos`, and `cashflow_neto`.

---

### BUG 3: Ene 2026 P&L = $0 but Balance has data (different sync sources)
**Files:** `server/etl/sot-etl.ts` and `server/jobs/resumen-ejecutivo-sync.ts`

Three separate syncs run in parallel:
1. `syncResumenEjecutivoToMonthlyFinancialSummary()` → P&L data (ventas, costos, EBIT, beneficio)
2. `syncCashFlowMovements()` → individual cash movements
3. `syncActivoToMonthlyFinancialSummary()` → balance/activos data

For Jan 2026, the "Activo" sheet has data (balance entries exist), but the "Resumen Ejecutivo" sheet doesn't have a row for Jan 2026 yet. The sync correctly creates a MFS record with balance data but null P&L.

The fallback logic in `executive-unified.ts:170-233` tries alternative tables (`income_sot`, `google_sheets_sales`, `fact_cost_month`, `direct_costs`) but they're also empty for Jan 2026.

**Fix:** This is expected behavior for future/incomplete months. The dashboard should clearly indicate "Mes no cerrado - datos parciales" when P&L = 0 but Balance exists. Consider not showing Ene 2026 in the period selector until it has at least ventas data.

---

### BUG 4: P&L Waterfall strips negative signs — EBIT and Beneficio Neto appear positive
**File:** `client/src/pages/executive-dashboard-unified.tsx:192`
**Code:** `{fmtFull(Math.abs(row.value))}`

ALL values in the waterfall use absolute values. For subtotals (EBIT) and totals (Beneficio Neto), the sign is only communicated via color (green/red). But:
- "EBIT Operativo" is type "subtotal" which always uses `text-gray-900` — so a negative EBIT shows in neutral gray without a minus sign
- The percentage next to it shows -3.06% but the dollar amount shows $1,220.55 (positive) — contradictory

**Fix:** For "subtotal" and "total" type rows, explicitly show the sign when negative. Change `fmtFull(Math.abs(row.value))` to `fmtFull(row.value)` for these types, or prefix with "-" when value < 0.

---

### BUG 5: Activo sync overwrites Resumen Ejecutivo balance data without merging
**File:** `server/etl/sot-etl.ts:1817-1823`

`syncActivoToMonthlyFinancialSummary` always overwrites `caja_total`, `cuentas_cobrar_usd`, `total_activo` — even if the "Resumen Ejecutivo" sync already wrote these values. Since both syncs run in parallel, there's a race condition. The Activo sync does NOT populate `total_pasivo` or `balance_neto`, so those may be null after the race.

**Fix:** Make the Activo sync selective (like Resumen sync already is) — only update fields when the Activo source has a non-zero value AND the existing MFS value is null or zero. Or better: run them sequentially with Resumen first.

---

## Implementation Plan

### Step 1: Fix Cashflow aggregation (BUG 2) — HIGHEST IMPACT
Add a new function `aggregateCashflowToMFS()` in `server/etl/sot-etl.ts` that:
1. Queries `cash_movements` grouped by `period_key`
2. SUMs `amount_usd` WHERE type='IN' → cashflow_ingresos
3. SUMs `amount_usd` WHERE type='OUT' → cashflow_egresos
4. Computes cashflow_neto = ingresos - egresos
5. Updates `monthly_financial_summary` for each period
6. Call this at the end of `syncCashFlowMovements()`

### Step 2: Fix Impuestos calculation (BUG 1)
In `server/services/executive-unified.ts`:
1. Use `impuestos_usa` from MFS as the tax line (it's already read)
2. Compute "Otras Deducciones" = EBIT - beneficioNeto - impuestosUsa (only show if > 0)
3. Update the P&L cascade to show the real tax breakdown
4. Update the frontend WaterfallPnL to show the additional line

### Step 3: Fix P&L Waterfall sign display (BUG 4)
In `client/src/pages/executive-dashboard-unified.tsx`:
1. For "subtotal" rows, show the actual signed value (not absolute)
2. For "total" rows, show the actual signed value
3. Keep "cost" rows as absolute (they already have the "−" prefix in the label)

### Step 4: Add "incomplete month" indicator (BUG 3)
In `client/src/pages/executive-dashboard-unified.tsx`:
1. Add a banner/indicator when ventasMes === 0 but totalActivo > 0
2. Show "Datos parciales — mes no cerrado" message
3. Optionally hide the Estado de Resultados section when empty

### Step 5: Fix sync race condition (BUG 5)
In `server/jobs/resumen-ejecutivo-sync.ts`:
1. Run syncs sequentially: Resumen → Activo → CashFlow
2. Make Activo sync use selective merge (skip if Resumen already populated)
