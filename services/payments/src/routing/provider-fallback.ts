import type { Provider } from './route-payment';

export interface Attempt<T> {
  provider: Provider;
  ok: boolean;
  /** The error message when the attempt failed; never the raw error object. */
  error?: string;
}

export interface FallbackOutcome<T> {
  provider: Provider;
  result: T;
  attempts: Attempt<T>[];
}

export class AllProvidersFailedError extends Error {
  constructor(readonly attempts: Attempt<never>[]) {
    super(`every provider failed: ${attempts.map((a) => a.provider).join(', ')}`);
    this.name = 'AllProvidersFailedError';
  }
}

/**
 * Tries each provider in order and returns the first success. The list comes from
 * `routePayment`, so the first entry is primary and the rest are automatic
 * fallbacks. A provider that throws is recorded with its message and the next is
 * tried; if every provider fails, the collected attempts are thrown.
 *
 * Only a provider that failed *before returning* is retried, so a failure cannot
 * double charge: a `createPayment` that throws produced no provider reference.
 */
export async function withFallback<T>(
  providers: readonly Provider[],
  attempt: (provider: Provider) => Promise<T>,
): Promise<FallbackOutcome<T>> {
  const attempts: Attempt<T>[] = [];
  for (const provider of providers) {
    try {
      const result = await attempt(provider);
      attempts.push({ provider, ok: true });
      return { provider, result, attempts };
    } catch (error) {
      attempts.push({
        provider,
        ok: false,
        error: error instanceof Error ? error.message : 'unknown error',
      });
    }
  }
  throw new AllProvidersFailedError(attempts);
}
