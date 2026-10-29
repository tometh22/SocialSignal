import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { validateQuotationStep } from '../client/src/utils/quotation-ux';

vi.mock('@/context/optimized-quote-context', () => ({ useOptimizedQuote: () => ({
  quotationData: { client: null, project: { name: 'Proyecto QA' }, teamMembers: [], quotationCurrency: 'USD', exchangeRateSnapshot: 1450, inflation: {} },
  updateClient: vi.fn(), updateProjectName: vi.fn(), updateQuotationCurrency: vi.fn(), updateQuotationData: vi.fn(),
}) }));
vi.mock('@/hooks/use-currency', () => ({ useCurrency: () => ({ exchangeRate: 1450, exchangeRateReady: true, exchangeRateSource: 'QA', exchangeRateUpdatedAt: null }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@tanstack/react-query', async importOriginal => ({
  ...await importOriginal<typeof import('@tanstack/react-query')>(),
  useQuery: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
}));
import OptimizedBasicInfo from '../client/src/components/optimized/basic-info';

describe('currency before quotation workload', () => {
  it.each(['project', 'group'] as const)('renders the currency and one accessible FX input in the initial %s form', mode => {
    const html = renderToStaticMarkup(React.createElement(OptimizedBasicInfo, { mode }));
    expect(html).toContain('Seleccionar cliente');
    expect(html).toContain('Moneda de cotización');
    expect(html.match(/id="quotation-exchange-rate"/g)).toHaveLength(1);
    expect(html).toContain('for="quotation-exchange-rate"');
    expect(html).toContain('for="quotation-currency"');
    expect(html).toContain('value="1450"');
  });
  it('does not let a quotation leave Brief with missing, invalid or unconfirmed FX', () => {
    const quotation = { client: { id: 1 }, project: { name: 'QA' }, commercialMotion: 'new_business', exchangeRateSnapshot: 1450 } as any;
    expect(validateQuotationStep(1, quotation)).toEqual([]);
    for (const rate of [undefined, 0, -1, Number.NaN]) {
      expect(validateQuotationStep(1, { ...quotation, exchangeRateSnapshot: rate }).map(issue => issue.field)).toContain('quotation-exchange-rate');
    }
    expect(validateQuotationStep(1, { ...quotation, requiresExchangeRateConfirmation: true }).map(issue => issue.field)).toContain('quotation-exchange-rate');
  });
});
