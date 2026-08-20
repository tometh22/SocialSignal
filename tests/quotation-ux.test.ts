import { describe, expect, it } from 'vitest';
import {
  QUOTATION_PHASES,
  getFirstIncompleteQuotationPhase,
  validateQuotationPhase,
} from '../client/src/utils/quotation-ux';

const validQuotation = () => ({
  client: { id: 1, name: 'Cliente' },
  project: { name: 'Proyecto', type: 'on-demand', duration: '1-month' },
  analysisType: 'standard',
  mentionsVolume: 'medium',
  countriesCovered: '1',
  clientEngagement: 'medium',
  template: null,
  complexity: 'medium',
  teamMembers: [{ id: 'member-1', roleId: 1, personnelId: null, hours: 20, rate: 100, cost: 2_000 }],
  deliverables: [],
  additionalDeliverableCost: 0,
  financials: {
    platformCost: 0,
    deviationPercentage: 0,
    discount: 0,
    discountPercentage: 0,
    marginFactor: 2,
    toolsCost: 0,
    priceMode: 'auto',
  },
  quotationCurrency: 'ARS',
  exchangeRateSnapshot: 1_200,
  inflation: {
    applyInflationAdjustment: false,
    inflationMethod: 'manual',
    manualInflationRate: 25,
    projectStartDate: '',
    rateProjectionMode: 'current',
  },
  expiresAt: '2099-12-31',
  commercialTerms: 'Propuesta sujeta a los términos comerciales vigentes.',
  salaryMonth: null,
} as any);

describe('quotation UX workflow', () => {
  it('presents four business-oriented phases', () => {
    expect(QUOTATION_PHASES.map((phase) => phase.title)).toEqual([
      'Proyecto',
      'Alcance',
      'Precio',
      'Propuesta',
    ]);
  });

  it('blocks the project phase with actionable field targets', () => {
    const quotation = validQuotation();
    quotation.client = null;
    quotation.project.name = '';
    quotation.exchangeRateSnapshot = 0;
    expect(validateQuotationPhase(1, quotation).map((issue) => issue.field)).toEqual([
      'client',
      'project-name',
      'quotation-exchange-rate',
      'professional-scope',
    ]);
    expect(getFirstIncompleteQuotationPhase(quotation)).toBe(1);
  });

  it('validates team rates and recurring deliverables as scope', () => {
    const quotation = validQuotation();
    quotation.project.type = 'always-on';
    quotation.project.duration = '';
    quotation.teamMembers[0].rate = 0;
    expect(validateQuotationPhase(2, quotation).map((issue) => issue.field)).toEqual([
      'team-config',
      'deliverables-config',
    ]);
  });

  it('requires a valid target price and inflation date in advanced pricing', () => {
    const quotation = validQuotation();
    quotation.financials.priceMode = 'manual';
    quotation.financials.manualPrice = 0;
    quotation.adjustmentReason = 'Precio acordado con dirección comercial';
    quotation.inflation.applyInflationAdjustment = true;
    expect(validateQuotationPhase(3, quotation).map((issue) => issue.field)).toEqual([
      'manual-price',
      'inflation-start-date',
    ]);
  });
});
