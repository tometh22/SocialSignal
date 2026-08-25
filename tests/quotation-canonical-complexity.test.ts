import { describe, expect, it } from "vitest";
import {
  calculateCanonicalComplexityFactor,
  getCountriesFactor,
  getMentionsVolumeFactor,
} from "../shared/utils/quotation-complexity";

// Replica EXACTA de la suma que hace el cliente en optimized-quote-context.tsx
// (useMemo `complexityFactors`): analysisTypeFactor y clientEngagementFactor
// siempre 0; mentions/countries sólo si NO hay receta. El servidor debe usar
// calculateCanonicalComplexityFactor y dar el mismo número, o rechaza el precio.
function clientComplexityFactor(mentionsVolume: string, countriesCovered: string, hasBlueprintScope: boolean): number {
  const factors = {
    analysisTypeFactor: 0,
    mentionsVolumeFactor: hasBlueprintScope ? 0 : getMentionsVolumeFactor(mentionsVolume),
    countriesFactor: hasBlueprintScope ? 0 : getCountriesFactor(countriesCovered),
    clientEngagementFactor: 0,
  };
  return Object.values(factors).reduce((sum, f) => sum + (f || 0), 0);
}

describe("calculateCanonicalComplexityFactor", () => {
  it("es 0 cuando hay receta (scopeSnapshot), sin importar volumen/países", () => {
    expect(calculateCanonicalComplexityFactor({ mentionsVolume: "xlarge", countriesCovered: "10+", hasBlueprintScope: true })).toBe(0);
  });

  it("sin receta usa sólo volumen de menciones + países", () => {
    // large = 0.15, "4-6" = 0.18 → 0.33
    expect(calculateCanonicalComplexityFactor({ mentionsVolume: "large", countriesCovered: "4-6", hasBlueprintScope: false })).toBeCloseTo(0.33, 5);
  });

  it("coincide con la fórmula del cliente en todos los casos", () => {
    const volumes = ["low", "medium", "high", "large", "xlarge"];
    const countries = ["1", "2-3", "4-6", "7+"];
    for (const v of volumes) {
      for (const c of countries) {
        for (const hasBlueprintScope of [true, false]) {
          expect(calculateCanonicalComplexityFactor({ mentionsVolume: v, countriesCovered: c, hasBlueprintScope }))
            .toBeCloseTo(clientComplexityFactor(v, c, hasBlueprintScope), 10);
        }
      }
    }
  });
});
