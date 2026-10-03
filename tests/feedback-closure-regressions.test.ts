import { describe, expect, it } from 'vitest';
import { blueprintDefinitionSchema, blueprintEffortFactorBreakdown, estimateBlueprintWorkload, resolveScopePresentation, SERVICE_BLUEPRINT_SEEDS } from '../shared/quotation-professional';
import { mergeQuotationActualEntries, type QuotationActualEntry } from '../shared/utils/quotation-actual-entries';
import { quotationProfitability } from '../shared/utils/quotation-profitability';
import { quotationPortfolioTotals } from '../shared/utils/quotation-portfolio-totals';
import { selectPreviewVariant } from '../shared/utils/quotation-variant-preview';
import { analyzeQuotationBriefHeuristically } from '../server/services/quotation-brief';

const scope = () => blueprintDefinitionSchema.parse(structuredClone(SERVICE_BLUEPRINT_SEEDS[1].definition));
describe('Independent output and branding, compatible with existing quotations', () => {
  it.each([['standard', 1], ['branded', 1.1], ['executive', 1.18]] as const)('preserves the %s historical multiplier', (designLevel, expected) => {
    const definition = scope();
    definition.coverage.designLevel = designLevel;
    const factors = blueprintEffortFactorBreakdown(definition);
    const presentation = factors.filter(f => ['Nivel de salida', 'Identidad visual'].includes(f.label));
    expect(presentation.reduce((product, f) => product * f.value, 1)).toBeCloseTo(expected);
    const normalized = blueprintDefinitionSchema.parse({ ...definition, coverage: { ...definition.coverage, ...resolveScopePresentation(definition.coverage) } });
    expect(estimateBlueprintWorkload(normalized)).toEqual(estimateBlueprintWorkload(definition));
  });
  it('allows executive synthesis and branded identity independently, retaining both in snapshots', () => {
    const definition = scope();
    const plainHours = estimateBlueprintWorkload({ ...definition, coverage: { ...definition.coverage, outputLevel: 'standard', visualIdentity: 'standard' } }).totalHours;
    definition.coverage.outputLevel = 'executive'; definition.coverage.visualIdentity = 'branded';
    const normalized = blueprintDefinitionSchema.parse(JSON.parse(JSON.stringify(definition)));
    expect(resolveScopePresentation(normalized.coverage)).toEqual({ outputLevel: 'executive', visualIdentity: 'branded' });
    expect(estimateBlueprintWorkload(normalized).totalHours).toBeGreaterThan(plainHours);
  });
  it('explains the exact uniform question threshold and each multiplicative rule', () => {
    const definition = scope(); definition.coverage.analysisModules = ['brand', 'campaign', 'crisis'];
    expect(blueprintEffortFactorBreakdown(definition).find(f => f.label === 'Módulos adicionales')?.value).toBe(1);
    definition.coverage.analysisModules.push('trends');
    expect(blueprintEffortFactorBreakdown(definition).find(f => f.label === 'Módulos adicionales')?.value).toBe(1.05);
    expect(blueprintEffortFactorBreakdown(definition).every(f => f.rule.length > 20)).toBe(true);
  });
  it('changing volume affects deliverable effort while preserving setup hours', () => {
    const definition = scope(); definition.coverage.mentionVolume = 'small';
    const small = estimateBlueprintWorkload(definition); definition.coverage.mentionVolume = 'xlarge';
    const large = estimateBlueprintWorkload(definition);
    expect(large.totalHours).toBeGreaterThan(small.totalHours);
    expect(large.lines.filter(l => l.sourceId === 'setup')).toEqual(small.lines.filter(l => l.sourceId === 'setup'));
  });
  it('brief intake separates executive purpose from visual identity', () => {
    const candidates = SERVICE_BLUEPRINT_SEEDS.map((seed, i) => ({ ...seed, id: i + 1 }));
    const result = analyzeQuotationBriefHeuristically('Informe ejecutivo para el board con identidad de marca.', candidates);
    expect(result.outputLevel).toBe('executive'); expect(result.visualIdentity).toBe('branded');
  });
});

const entry = (overrides: Partial<QuotationActualEntry> = {}): QuotationActualEntry => ({ projectId: 85, personnelId: 42, entryDate: '2026-10-02', hours: 2, description: 'Análisis', totalCost: 2000, ...overrides });
describe('Actual quotation profitability includes task hours without mirrored duplicates', () => {
  it('combines weekly/monthly projects, normalizes descriptions and converts ARS actuals once', () => {
    const entries = mergeQuotationActualEntries([entry()], [entry({ description: '  ANÁLISIS ' }), entry({ projectId: 86, hours: 3, totalCost: 3000 })]);
    expect(entries).toHaveLength(2);
    const result = quotationProfitability({ entries, quotedHours: 7, quotedCost: 7, revenue: 20, currency: 'USD', exchangeRate: 1000 });
    expect(result.realHours).toBe(5); expect(result.realCost).toBe(5); expect(result.actualGrossMargin).toBe(75);
  });
  it('preserves genuine repeat entries in both ledgers using one-to-one mirror matching', () => {
    expect(mergeQuotationActualEntries([entry()], [entry(), entry()])).toHaveLength(2);
    expect(mergeQuotationActualEntries([entry(), entry()], [entry()])).toHaveLength(2);
    expect(mergeQuotationActualEntries([], [entry(), entry()])).toHaveLength(2);
    expect(mergeQuotationActualEntries([entry()], [entry({ personnelId: 66 }), entry({ entryDate: '2026-10-03' })])).toHaveLength(3);
  });
  it('retains unknown cost for freelancers with no tariff and avoids fictitious 100% margin', () => {
    const entries = mergeQuotationActualEntries([entry()], [entry({ personnelId: 66, totalCost: null })]);
    const result = quotationProfitability({ entries, quotedHours: 7, quotedCost: 7, revenue: 20, currency: 'USD', exchangeRate: 1000 });
    expect(result.realHours).toBe(4); expect(result.hasActualCosts).toBe(false); expect(result.realCost).toBeNull(); expect(result.actualGrossMargin).toBeNull();
  });
});
describe('Portfolio totals in both currencies', () => {
  it('converts each quote at its own snapshot before summing', () => {
    expect(quotationPortfolioTotals([
      { totalAmount: 10, quotationCurrency: 'USD', exchangeRateAtQuote: 1000 },
      { totalAmount: 20, quotationCurrency: 'USD', exchangeRateAtQuote: 2000 },
      { totalAmount: 6000, quotationCurrency: 'ARS', exchangeRateAtQuote: 1500 },
    ], 9999)).toEqual({ ars: 56000, usd: 34, missingFx: 0 });
  });
  it('uses the legacy snapshot then current FX, without accepting nonpositive snapshots', () => {
    expect(quotationPortfolioTotals([{ totalAmount: 10, quotationCurrency: 'USD', exchangeRateAtQuote: -1, usdExchangeRate: 1500 }], 2000).ars).toBe(15000);
    expect(quotationPortfolioTotals([{ totalAmount: 2000, quotationCurrency: 'ARS' }], 2000).usd).toBe(1);
  });
  it('marks conversions unavailable rather than inventing totals', () => {
    expect(quotationPortfolioTotals([{ totalAmount: 10, quotationCurrency: 'USD' }, { totalAmount: 1000, quotationCurrency: 'ARS' }], 0)).toEqual({ ars: 1000, usd: 10, missingFx: 2 });
  });
});
describe('One explicit scenario drives the workspace summary', () => {
  const variants = [{ id: 1 }, { id: 2, isRecommended: true }, { id: 3 }];
  it('defaults to the selected recommendation, then selected alternative', () => {
    expect(selectPreviewVariant(variants, [1, 2, 3], null)?.id).toBe(2);
    expect(selectPreviewVariant(variants, [1, 3], null)?.id).toBe(1);
  });
  it('allows previewing edited hours in another scenario or returning to the base quote', () => {
    expect(selectPreviewVariant(variants, [2], 3)?.id).toBe(3);
    expect(selectPreviewVariant(variants, [2], 0)).toBeNull();
  });
  it('falls back safely after deletion or deselection', () => {
    expect(selectPreviewVariant(variants, [2], 99)?.id).toBe(2);
    expect(selectPreviewVariant(variants, [], null)).toBeNull();
  });
});

describe('Variant workload uses the same canonical roles as Scope', () => {
  it('retains all hours when PM and analysis resolve to the same available operations role', async () => {
    const { quotationTeamForScope } = await import('../shared/utils/quotation-scope-team');
    const definition = scope();
    definition.setupRoleHours = { pm: 10, analyst: 12 };
    definition.deliverables = [];
    const roles = [{ id: 42, name: '3 Senior · A · Operaciones', roleLevel: '3 Senior', area: 'Operaciones', isActive: true }];
    const team = quotationTeamForScope(definition, [{ roleId: 42, hours: 22, rate: 100 }], roles);
    expect(team[0].hours).toBe(22); expect(team[0].cost).toBe(2200);
  });
  it('distributes half-hour targets across people without adding rounding hours', async () => {
    const { quotationTeamForScope } = await import('../shared/utils/quotation-scope-team');
    const definition = scope(); definition.setupRoleHours = { analyst: 1.5 }; definition.deliverables = [];
    const roles = [{ id: 42, name: '3 Senior · A · Operaciones', roleLevel: '3 Senior', area: 'Operaciones' }];
    const team = quotationTeamForScope(definition, [{ roleId: 42, hours: 1, rate: 100 }, { roleId: 42, hours: 1, rate: 100 }], roles);
    expect(team.reduce((sum, member) => sum + member.hours, 0)).toBe(1.5);
  });
});
