import { describe, it, expect } from 'vitest';
import { AllProvidersFailedError, withFallback } from './provider-fallback';

describe('withFallback', () => {
  it('returns the first provider that succeeds', async () => {
    const outcome = await withFallback(['peach', 'payfast'], async (p) => {
      if (p === 'peach') throw new Error('peach is down');
      return `${p}-ok`;
    });
    expect(outcome.provider).toBe('payfast');
    expect(outcome.result).toBe('payfast-ok');
    expect(outcome.attempts).toEqual([
      { provider: 'peach', ok: false, error: 'peach is down' },
      { provider: 'payfast', ok: true },
    ]);
  });

  it('does not try a fallback when the primary succeeds', async () => {
    const tried: string[] = [];
    const outcome = await withFallback(['peach', 'payfast'], async (p) => {
      tried.push(p);
      return 'ok';
    });
    expect(outcome.provider).toBe('peach');
    expect(tried).toEqual(['peach']);
  });

  it('throws the collected attempts when every provider fails', async () => {
    await expect(
      withFallback(['peach', 'payfast'], async () => {
        throw new Error('nope');
      }),
    ).rejects.toBeInstanceOf(AllProvidersFailedError);
  });

  it('records a non-Error throw as an unknown error, not the raw value', async () => {
    let caught: unknown;
    try {
      await withFallback(['peach'], async () => {
        throw { secret: 'leak' };
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AllProvidersFailedError);
    expect((caught as AllProvidersFailedError).attempts[0].error).toBe('unknown error');
  });

  it('rejects an empty provider list', async () => {
    await expect(withFallback([], async () => 'ok')).rejects.toBeInstanceOf(
      AllProvidersFailedError,
    );
  });
});
