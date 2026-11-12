import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => ({ default: class { messages = { create }; } }));
import { generateStatusDraft, type StatusDraftContext } from '../server/services/ai-status-draft';

const context: StatusDraftContext = {
  title: 'Proyección actualizada', currentAction: 'Pendiente de mi lado', mainRisk: null,
  nextMilestone: null, healthStatus: 'rojo', decisionNeeded: null, deadline: null, ownerName: 'Victoria',
  thread: [{ content: '¿Para cuándo la podés tener?', authorName: 'Tomás', createdAt: new Date('2026-11-02'), kind: 'comentario' }],
};
beforeEach(() => { vi.stubEnv('ANTHROPIC_API_KEY', 'test-key'); create.mockReset(); });
afterEach(() => vi.unstubAllEnvs());

describe('AI daily draft', () => {
  it('uses the status and attributed thread and returns a trimmed draft', async () => {
    create.mockResolvedValue({ content: [{ type: 'text', text: '  Vick, ¿cuándo podemos tener la proyección?  ' }], stop_reason: 'end_turn' });
    expect(await generateStatusDraft(context)).toBe('Vick, ¿cuándo podemos tener la proyección?');
    const sent = JSON.parse(create.mock.calls[0][0].messages[0].content);
    expect(sent.currentAction).toBe(context.currentAction);
    expect(sent.thread[0]).toEqual({ ...context.thread[0], createdAt: '2026-11-02T00:00:00.000Z' });
  });
  it('bounds long histories while retaining the most recent messages', async () => {
    create.mockResolvedValue({ content: [{ type: 'text', text: 'Borrador' }], stop_reason: 'end_turn' });
    await generateStatusDraft({ ...context, thread: Array.from({ length: 50 }, (_, i) => ({ ...context.thread[0], content: `${i}:` + 'a'.repeat(5000) })) });
    const sent = JSON.parse(create.mock.calls[0][0].messages[0].content);
    expect(sent.thread).toHaveLength(30);
    expect(sent.thread[0].content).toMatch(/^20:/);
    expect(sent.thread.at(-1).content).toMatch(/^49:/);
    expect(sent.thread.every((entry: { content: string }) => entry.content.length <= 2000)).toBe(true);
  });
  it.each([
    { content: [], stop_reason: 'end_turn' },
    { content: [{ type: 'text', text: '   ' }], stop_reason: 'end_turn' },
    { content: [{ type: 'text', text: 'Mensaje cortado' }], stop_reason: 'max_tokens' },
  ])('rejects empty or incomplete suggestions', async response => {
    create.mockResolvedValue(response);
    await expect(generateStatusDraft(context)).rejects.toThrow('sugerencia completa');
  });
  it('fails without calling the provider if AI is not configured', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    await expect(generateStatusDraft(context)).rejects.toThrow('IA no configurada');
    expect(create).not.toHaveBeenCalled();
  });
});
