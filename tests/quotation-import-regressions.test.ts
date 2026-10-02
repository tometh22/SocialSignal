import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatEstimatedHours, formatQuotationAmount, quotationPersonnelName, quotationPriceLabel, quotationProjectTypeLabel } from '../shared/utils/quotation-display';
import { projectQuotationSummary } from '../shared/utils/project-quotation-summary';
import { calculateMarginDrift } from '../shared/utils/quotation-margin-drift';
import { quotationProfitability, quotedOperationalCost } from '../shared/utils/quotation-profitability';

describe('imported quotation regressions', () => {
  it('renders missing or legacy negative estimates as unknown, retaining explicit zero', () => {
    for (const hours of [undefined, null, -1, NaN]) expect(formatEstimatedHours(hours)).toBe('—');
    expect(formatEstimatedHours(0)).toBe('0.00 h');
    expect(formatEstimatedHours(297)).toBe('297.00 h');
  });

  it('keeps native contract amounts and service metadata in project summaries', () => {
    const quote = { id: 346, projectName: 'BID', baseCost: 5018, totalAmount: 12000,
      quotationCurrency: 'USD', quotationType: 'one-time', projectType: 'one-shot' };
    expect(projectQuotationSummary(quote, 0)).toEqual({ ...quote, totalAmountNative: 12000, estimatedHours: null });
    expect(projectQuotationSummary(quote, -1)?.estimatedHours).toBeNull();
    expect(projectQuotationSummary(quote, 15)?.estimatedHours).toBe(15);
    expect(projectQuotationSummary(null, 15)).toBeNull();
  });

  it('recognizes fees and historical types without treating every unknown type as One-Shot', () => {
    expect(quotationProjectTypeLabel('fee-mensual')).toBe('Fee mensual');
    expect(quotationProjectTypeLabel('one-shot')).toBe('One-Shot');
    expect(quotationProjectTypeLabel('on-demand')).toBe('One-Shot');
    expect(quotationProjectTypeLabel(null, 'recurring')).toBe('Recurrente');
    expect(quotationProjectTypeLabel('custom-contract')).toBe('custom-contract');
    expect(quotationPriceLabel('fee-mensual')).toBe('Precio mensual');
    expect(quotationPriceLabel('one-shot')).toBe('Precio total');
  });

  it('displays native currency and cents for archived and active contracts', () => {
    expect(formatQuotationAmount(13450.25, 'USD')).toContain('USD');
    expect(formatQuotationAmount(13450.25, 'USD')).toContain('13.450,25');
    expect(formatQuotationAmount(13450.25, 'ARS')).toContain('ARS');
    expect(formatQuotationAmount(null, 'USD')).toBe('—');
  });

  it('uses the quoted member name even if that person is no longer selectable', () => {
    expect(quotationPersonnelName({ personnelId: 46, personnelName: 'Matías Gonzalez' }, [])).toBe('Matías Gonzalez');
    expect(quotationPersonnelName({ personnelId: 46 }, [{ id: 46, name: 'Matías Gonzalez' }])).toBe('Matías Gonzalez');
    expect(quotationPersonnelName({ personnelId: null }, [])).toBe('Sin persona asignada');
  });

  it('compares current estimated cost with the contractual cost of Kimberly', () => {
    const drift = calculateMarginDrift({ lockedTotal: 5300, quotedCost: 2767,
      team: [{ personnelId: 1, hours: 1, originalRate: 2850.87, currentRate: 3141.05 }] });
    expect(drift.originalCost).toBe(2767);
    expect(drift.currentCost).toBe(3141.05);
    expect(drift.originalMarginPercentage).toBe(47.79);
    expect(drift.currentMarginPercentage).toBe(40.73);
    expect(drift.marginErosionPoints).toBe(7.06);
  });

  it('retains other quoted operating costs while repricing the team only', () => {
    const drift = calculateMarginDrift({ lockedTotal: 4000, quotedCost: 2200,
      team: [{ personnelId: 1, hours: 100, originalRate: 20, currentRate: 24 }] });
    expect(drift.originalCost).toBe(2200);
    expect(drift.currentCost).toBe(2600);
    expect(quotedOperationalCost({ baseCost: 2000, complexityAdjustment: 100, toolsCost: 100 })).toBe(2200);
  });

  const input = { quotedCost: 9979, quotedHours: 1094, revenue: 29230, currency: 'USD', exchangeRate: 1410 };
  it('does not report 100% realized margin without actual cost entries', () => {
    const result = quotationProfitability({ ...input, entries: [] });
    expect(result.realHours).toBe(0);
    expect(result.hasActualCosts).toBe(false);
    expect(result.actualGrossMargin).toBeNull();
    expect(result.marginDelta).toBeNull();
  });

  it('aggregates the entries of both operational projects without duplicating the contract price', () => {
    const result = quotationProfitability({ ...input, entries: [
      { hours: 10, totalCost: 141000 }, { hours: 20, totalCost: 282000 },
    ] });
    expect(result.realHours).toBe(30);
    expect(result.realCost).toBe(300);
    expect(result.revenue).toBe(29230);
  });

  it('does not convert USD actuals at an invented rate of 1', () => {
    expect(quotationProfitability({ ...input, exchangeRate: 0,
      entries: [{ hours: 2, totalCost: 10000 }] }).actualGrossMargin).toBeNull();
    expect(quotationProfitability({ ...input, currency: 'ARS', exchangeRate: 0,
      entries: [{ hours: 2, totalCost: 10000 }] }).realCost).toBe(10000);
  });

  it('does not count hours with unpriced costs as evidence of actual margin', () => {
    const result = quotationProfitability({ ...input, entries: [{ hours: 2, totalCost: null }] });
    expect(result.realHours).toBe(2);
    expect(result.actualGrossMargin).toBeNull();
  });

  it('guards the route contracts for archives and multi-project profitability', () => {
    const source = readFileSync(new URL('../server/routes.ts', import.meta.url), 'utf8');
    const summary = source.slice(source.indexOf('app.get("/api/quotations/margin-drift-summary"'), source.indexOf('app.get("/api/quotations/archived"'));
    expect(summary).toContain('isNull(quotations.archivedAt)');
    const profitability = source.slice(source.indexOf('app.get("/api/quotations/:id/profitability"'), source.indexOf('// ─── Quotation Templates CRUD'));
    expect(profitability).toContain('notInArray(activeProjects.status, ["voided", "cancelled"])');
    expect(profitability).toContain('inArray(timeEntries.projectId, projects.map(project => project.id))');
    expect(profitability).toContain('getQuotationTeamMembersByVariant');
  });
});
