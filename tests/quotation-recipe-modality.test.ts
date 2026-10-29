import { describe, expect, it } from 'vitest';
import { isCanonicalBlueprintCompatible, resolveBlueprintProjectType } from '../shared/quotation-professional';
import { validateQuotationStep } from '../client/src/utils/quotation-ux';

describe('applying a recipe assigns the service selected after Brief', () => {
  it.each([
    ['one_shot','on-demand'], ['monthly_fee','fee-mensual'], ['event_pack','monitoring'], ['demo','demo'],
  ])('assigns %s instead of preserving an empty browsing filter', (modality, expected) => {
    expect(isCanonicalBlueprintCompatible('', modality)).toBe(true);
    expect(resolveBlueprintProjectType('', modality)).toBe(expected);
    expect(resolveBlueprintProjectType(undefined, modality)).toBe(expected);
    expect(resolveBlueprintProjectType(null, modality)).toBe(expected);
    expect(resolveBlueprintProjectType('on-demand', modality)).toBe(expected);
  });
  it('preserves a compatible historical project type and switches incompatible types', () => {
    expect(resolveBlueprintProjectType('always-on','monthly_fee')).toBe('always-on');
    expect(resolveBlueprintProjectType('one-shot','one_shot')).toBe('one-shot');
    expect(resolveBlueprintProjectType('fee-mensual','one_shot')).toBe('on-demand');
  });
  it('asks to reselect the recipe when an old local draft has scope without a service type', () => {
    const draft = { project: { type: '' }, scopeSnapshot: { modality: 'monthly_fee' } } as any;
    for (const step of [2,3] as const) expect(validateQuotationStep(step, draft)[0]?.field).toBe('professional-scope');
    expect(validateQuotationStep(2, { ...draft, project: { type: resolveBlueprintProjectType('', 'monthly_fee') } })).toEqual([]);
  });
});
