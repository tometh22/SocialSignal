import { describe, expect, it } from 'vitest';
import { previousFinanceMonth, validFinancePeriod } from '../client/src/hooks/use-finance-period';

describe('reference month for finance', () => {
  it('uses the last completed Argentine month, including the year boundary', () => {
    expect(previousFinanceMonth(new Date('2026-01-01T02:00:00Z'))).toBe('2025-11');
    expect(previousFinanceMonth(new Date('2026-01-01T03:00:00Z'))).toBe('2025-12');
    expect(previousFinanceMonth(new Date('2026-11-14T12:00:00Z'))).toBe('2026-10');
  });
  it('rejects incomplete, malformed and out-of-range query or stored months', () => {
    for (const value of [null, '', '2026-00', '2026-13', '2026-1', '2026-10-01', 'garbage']) expect(validFinancePeriod(value)).toBe(false);
    expect(validFinancePeriod('2026-12')).toBe(true);
  });
});
