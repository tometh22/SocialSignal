import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  calculateGrossMarginPercentage,
  calculateTaxBreakdown,
  stableQuotationSnapshot,
  validatePaymentSchedule,
} from '../shared/utils/quotation-commercial';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('professional quotation workflow', () => {
  it('calculates taxes consistently for net and tax-inclusive pricing', () => {
    expect(calculateTaxBreakdown(1_000, 21, false)).toEqual({
      netAmount: 1_000,
      taxAmount: 210,
      grandTotal: 1_210,
    });
    expect(calculateTaxBreakdown(1_210, 21, true)).toEqual({
      netAmount: 1_000,
      taxAmount: 210,
      grandTotal: 1_210,
    });
  });

  it('validates payment schedules and gross margin using revenue as denominator', () => {
    expect(() => validatePaymentSchedule([
      { label: 'Anticipo', percentage: 50 },
      { label: 'Entrega', percentage: 50 },
    ])).not.toThrow();
    expect(() => validatePaymentSchedule([{ label: 'Anticipo', percentage: 70 }])).toThrow('100%');
    expect(calculateGrossMarginPercentage(1_000, 600)).toBe(40);
  });

  it('serializes immutable snapshots deterministically', () => {
    const first = stableQuotationSnapshot({ b: 2, a: { d: 4, c: 3 } });
    const second = stableQuotationSnapshot({ a: { c: 3, d: 4 }, b: 2 });
    expect(first).toBe(second);
  });

  it('ships production DDL, client decisions, audit and CRM funnel integration', () => {
    const migration = source('migrations/0044_professional_quotation_workflow.sql');
    const routes = source('server/routes.ts');
    const startup = source('server/index.ts');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS quotation_revisions');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS quotation_approvals');
    expect(migration).toContain('quotation_deliveries_one_active_revision_idx');
    expect(startup).toContain('quotationProfessionalWorkflowMigrationSql');
    expect(routes).toContain('/api/public/quotations/:token/decision');
    expect(routes).toContain('/api/quotation-analytics/funnel');
    expect(routes).toContain('syncQuotationToCrm');
  });
});
