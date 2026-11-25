import { describe, expect, it } from 'vitest';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { InMemoryConversationStore } from './conversation.store';
import { RankingAnswerModel } from './answer-model';
import type { FactSource } from './assistant.service';

const source: FactSource = {
  catalogue: async () => [
    { sku: 'AG-LM-002', name: 'Lamb loin chops', pack: '500 g', fulfilment: 'in_stock', temperature: 'chilled', priceCents: 20900 },
  ],
  cycle: async () => ({}),
  zones: async () => [],
  content: async () => [],
};

function controller(log = new InMemoryConversationStore()) {
  return {
    controller: new AssistantController(new AssistantService(source, log, new RankingAnswerModel())),
    log,
  };
}

const req = (authorization?: string, id?: string) => ({
  headers: authorization ? { authorization } : {},
  user: id ? { id } : undefined,
});

describe('AssistantController', () => {
  it('answers a question and returns citations', async () => {
    const { controller: c } = controller();
    const answer = await c.ask({ question: 'lamb loin chops', conversationId: 'conv-12345678' }, req());
    expect(answer.refused).toBe(false);
    expect(answer.citations[0].url).toBe('/product/AG-LM-002');
  });

  it('treats a missing question as empty, and refuses', async () => {
    const { controller: c } = controller();
    const answer = await c.ask({} as never, req());
    expect(answer.refused).toBe(true);
  });

  it('replaces a malformed conversation id rather than failing the request', async () => {
    const { controller: c } = controller();
    const answer = await c.ask({ question: 'lamb loin chops', conversationId: '../etc/passwd' }, req());
    expect(answer.refused).toBe(false);
  });

  it('accepts a well-formed conversation id and keeps the turns together', async () => {
    const { controller: c, log } = controller();
    await c.ask({ question: 'lamb loin chops', conversationId: 'conv-1234abcd' }, req());
    await c.ask({ question: 'lamb loin chops', conversationId: 'conv-1234abcd' }, req());
    expect(await log.list('conv-1234abcd')).toHaveLength(2);
  });

  it('records the signed-in caller so the log names who asked', async () => {
    const { controller: c, log } = controller();
    await c.ask({ question: 'lamb loin chops', conversationId: 'conv-abcdefgh' }, req('Bearer t', 'user-7'));
    const [turn] = await log.list('conv-abcdefgh');
    expect(turn.userId).toBe('user-7');
  });

  it('exposes one conversation for an audit reviewer', async () => {
    const { controller: c } = controller();
    await c.ask({ question: 'lamb loin chops', conversationId: 'conv-audit123' }, req());
    const turns = await c.conversation('conv-audit123');
    expect(turns).toHaveLength(1);
    expect(turns[0].factIds).toContain('product:AG-LM-002');
  });
});
