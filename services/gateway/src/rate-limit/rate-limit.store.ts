import { TokenBucket } from './rate-limit.rules';

export const RATE_LIMIT_STORE = Symbol('RATE_LIMIT_STORE');

/**
 * Persistence boundary for rate-limit buckets. The default is in-process; a
 * Redis adapter swaps this out so every gateway replica shares one budget.
 */
export interface RateLimitStore {
  get(key: string): Promise<TokenBucket | undefined>;
  set(key: string, bucket: TokenBucket): Promise<void>;
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, TokenBucket>();

  async get(key: string): Promise<TokenBucket | undefined> {
    return this.buckets.get(key);
  }

  async set(key: string, bucket: TokenBucket): Promise<void> {
    this.buckets.set(key, bucket);
  }
}
