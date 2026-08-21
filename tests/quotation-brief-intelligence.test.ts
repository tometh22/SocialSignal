import { describe, expect, it } from 'vitest';
import { SERVICE_BLUEPRINT_SEEDS } from '@shared/quotation-professional';
import { analyzeQuotationBriefHeuristically } from '../server/services/quotation-brief';

const candidates = SERVICE_BLUEPRINT_SEEDS.map((seed, index) => ({
  id: index + 1,
  slug: seed.slug,
  name: seed.name,
  description: seed.description,
  definition: seed.definition,
}));

describe('quotation brief intelligence', () => {
  it('separates the PepsiCo minute into three independently quotable proposals', () => {
    const minute = `
      PepsiCo solicitó enviar propuestas de trabajo independientes para:
      1. Un Playbook regional de TikTok Shop de 10 semanas, usando los pilotos de Brasil y México.
      2. Un estudio de la categoría de snacks y e-commerce. Este análisis de categoría funcionará como un proyecto separado del enfoque centrado en TikTok Shop.
      3. Una auditoría de inteligencia artificial para medir visibilidad y share of recommendation en ChatGPT, Gemini, Claude y Perplexity, con baseline y seguimiento.
      Los pagos podrán organizarse en hitos mensuales según compras.
    `;

    const result = analyzeQuotationBriefHeuristically(minute, candidates);

    expect(result.requiresProposalSelection).toBe(true);
    expect(result.proposals).toHaveLength(3);
    expect(result.proposals.map((proposal) => proposal.projectName)).toEqual([
      'Playbook regional de TikTok Shop',
      'Estudio digital de la categoría de snacks',
      'Auditoría de visibilidad y recomendación en IA',
    ]);
    expect(result.proposals.every((proposal) => proposal.modality === 'one_shot')).toBe(true);
    expect(result.proposals[2].sources).toEqual(['ChatGPT', 'Gemini', 'Claude', 'Perplexity']);
  });

  it('does not confuse monthly payment milestones with a recurring monthly service', () => {
    const result = analyzeQuotationBriefHeuristically(
      'Proyecto puntual de investigación de ocho semanas. La facturación se divide en pagos mensuales por hitos.',
      candidates,
    );

    expect(result.proposals).toHaveLength(1);
    expect(result.modality).toBe('one_shot');
  });
});
