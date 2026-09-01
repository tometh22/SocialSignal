import { describe, expect, it } from 'vitest';
import { calculateCreditProgramTotals, createDefaultCreditProgram } from '../shared/utils/credit-program';
import { calculateQuotationPricing } from '../shared/utils/quotation-pricing';
import { insertQuotationSchema } from '../shared/schema';

describe('credit program quotation', () => {
  it('creates an annual default and caps carry-over at the contracted percentage', () => {
    const program = createDefaultCreditProgram(new Date('2026-09-01T12:00:00Z'));
    expect(program.validityStart).toBe('2026-09-01');
    expect(program.validityEnd).toBe('2027-08-31');
    expect(calculateCreditProgramTotals({ ...program, carryoverPercentage: 20 })).toMatchObject({
      totalCredits: 47,
      carryoverCredits: 9,
      graceMonths: 4,
      packagePriceUSD: 23_500,
    });
  });

  it('accepts a credit program as a persisted quotation field', () => {
    const program = createDefaultCreditProgram(new Date('2026-09-01T12:00:00Z'));
    const parsed = insertQuotationSchema.shape.creditProgram.parse({ ...program, enabled: true });
    expect(parsed.totalCredits).toBe(47);
    expect(parsed.executiveCreditValueUSD).toBe(500);
  });

  it('routes the prepaid package through the canonical currency conversion', () => {
    const pricing = calculateQuotationPricing({
      quotationCurrency: 'ARS',
      exchangeRate: 1_200,
      team: [],
      priceMode: 'manual',
      manualPrice: 23_500,
      manualPriceCurrency: 'USD',
    });
    expect(pricing.display.total).toBe(28_200_000);
  });
});
