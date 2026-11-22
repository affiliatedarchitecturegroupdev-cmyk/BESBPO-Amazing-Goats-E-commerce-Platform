import { describe, expect, it } from 'vitest';
import {
  CannedAnswerModel,
  HostedAnswerModel,
  RankingAnswerModel,
  hostedModelFromEnv,
  parseSelectedIds,
  selectionPrompt,
  type ModelFetch,
} from './answer-model';
import type { Fact } from './assistant.rules';

const fact = (id: string): Fact => ({
  kind: 'product',
  id,
  text: `row for ${id}`,
  url: `/product/${id}`,
  title: id,
});

const facts = [fact('product:AG-LM-002'), fact('product:AG-LM-003')];

describe('RankingAnswerModel', () => {
  it('selects the top-ranked facts retrieval already ordered', async () => {
    await expect(new RankingAnswerModel().choose('lamb', facts)).resolves.toEqual([
      'product:AG-LM-002',
      'product:AG-LM-003',
    ]);
  });

  it('respects its limit', async () => {
    await expect(new RankingAnswerModel(1).choose('lamb', facts)).resolves.toEqual(['product:AG-LM-002']);
  });

  it('selects nothing when there is nothing to select', async () => {
    await expect(new RankingAnswerModel().choose('lamb', [])).resolves.toEqual([]);
  });
});

describe('CannedAnswerModel', () => {
  it('returns its fixed picks, so a spec can drive the composition path', async () => {
    await expect(new CannedAnswerModel(['product:AG-LM-003']).choose()).resolves.toEqual(['product:AG-LM-003']);
  });
});

describe('selectionPrompt', () => {
  it('lists only offered facts, with ids the model may return', () => {
    const prompt = selectionPrompt('what lamb is there', facts);
    expect(prompt).toContain('product:AG-LM-002');
    expect(prompt).toContain('what lamb is there');
  });
});

describe('parseSelectedIds', () => {
  it('reads a JSON array of ids', () => {
    expect(parseSelectedIds('["product:AG-LM-002"]', facts)).toEqual(['product:AG-LM-002']);
  });

  it('reads an array wrapped in prose', () => {
    expect(parseSelectedIds('Sure: ["product:AG-LM-003"] hope that helps', facts)).toEqual(['product:AG-LM-003']);
  });

  it('drops an id that was never offered, so a model cannot smuggle a fact in', () => {
    expect(parseSelectedIds('["product:MADE-UP", "product:AG-LM-002"]', facts)).toEqual([
      'product:AG-LM-002',
    ]);
  });

  it('falls back to scanning for offered ids when the reply is not JSON', () => {
    expect(parseSelectedIds('I think product:AG-LM-003 answers that', facts)).toEqual(['product:AG-LM-003']);
  });

  it('returns nothing for an empty selection', () => {
    expect(parseSelectedIds('[]', facts)).toEqual([]);
  });

  it('returns nothing when the reply names no offered fact', () => {
    expect(parseSelectedIds('I cannot help with that', facts)).toEqual([]);
  });
});

describe('HostedAnswerModel', () => {
  const ok = (content: string): ModelFetch => async () => ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] }),
  });

  it('sends the selection prompt and returns the chosen ids', async () => {
    let sent = '';
    const fetchImpl: ModelFetch = async (_url, init) => {
      sent = init.body;
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '["product:AG-LM-002"]' } }] }) };
    };
    const model = new HostedAnswerModel({ apiUrl: 'https://model.test/v1', apiKey: 'k', model: 'm', fetchImpl });
    await expect(model.choose('lamb', facts)).resolves.toEqual(['product:AG-LM-002']);
    expect(sent).toContain('product:AG-LM-002');
    expect(sent).toContain('system');
  });

  it('makes no call when there is nothing to select', async () => {
    let called = false;
    const fetchImpl: ModelFetch = async () => {
      called = true;
      return { ok: true, status: 200, json: async () => ({}) };
    };
    const model = new HostedAnswerModel({ apiUrl: 'https://model.test', apiKey: 'k', model: 'm', fetchImpl });
    await expect(model.choose('lamb', [])).resolves.toEqual([]);
    expect(called).toBe(false);
  });

  it('declines rather than throwing when the provider errors', async () => {
    const model = new HostedAnswerModel({
      apiUrl: 'https://model.test',
      apiKey: 'k',
      model: 'm',
      fetchImpl: async () => {
        throw new Error('network down');
      },
    });
    await expect(model.choose('lamb', facts)).resolves.toEqual([]);
  });

  it('declines when the provider answers non-200', async () => {
    const model = new HostedAnswerModel({
      apiUrl: 'https://model.test',
      apiKey: 'k',
      model: 'm',
      fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }),
    });
    await expect(model.choose('lamb', facts)).resolves.toEqual([]);
  });

  it('drops an id the model invented', async () => {
    const model = new HostedAnswerModel({
      apiUrl: 'https://model.test',
      apiKey: 'k',
      model: 'm',
      fetchImpl: ok('["product:INVENTED", "product:AG-LM-002"]'),
    });
    await expect(model.choose('lamb', facts)).resolves.toEqual(['product:AG-LM-002']);
  });
});

describe('hostedModelFromEnv', () => {
  const fetchImpl: ModelFetch = async () => ({ ok: true, status: 200, json: async () => ({}) });

  it('is not enabled without a key, so the default makes no outbound call', () => {
    expect(hostedModelFromEnv({}, fetchImpl)).toBeUndefined();
    expect(hostedModelFromEnv({ ASSISTANT_MODEL_URL: 'https://m', ASSISTANT_MODEL_NAME: 'm' }, fetchImpl)).toBeUndefined();
  });

  it('is enabled when key, url and model are all set', () => {
    const model = hostedModelFromEnv(
      { ASSISTANT_MODEL_API_KEY: 'k', ASSISTANT_MODEL_URL: 'https://m', ASSISTANT_MODEL_NAME: 'm' },
      fetchImpl,
    );
    expect(model?.name).toBe('hosted:m');
  });
});
