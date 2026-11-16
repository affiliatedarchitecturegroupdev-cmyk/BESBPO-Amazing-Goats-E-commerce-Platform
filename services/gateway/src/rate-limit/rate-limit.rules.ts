/** A token bucket: `tokens` at `updatedAt`, refilling at `refillPerSec`. */
export interface TokenBucket {
  /** Fractional tokens left, so a slow trickle of calls is not lost. */
  tokens: number;
  /** Last time the bucket was refilled, epoch milliseconds. */
  updatedAt: number;
}

/** The outcome of one rate-limit check. */
export interface RateLimitDecision {
  allowed: boolean;
  /** Tokens left after this call (allowed) or the shortfall (limited). */
  tokens: number;
  /** Whole seconds the caller should wait before retrying; 0 when allowed. */
  retryAfterSec: number;
  /** The bucket after the call; persist it so the next call refills from here. */
  bucket: TokenBucket;
}

export interface RateLimitRule {
  /** Requests allowed per second. */
  refillPerSec: number;
  /** Bucket capacity; the most a caller can burst after an idle spell. */
  burst: number;
}

/** A keyed rule table, so per-route limits are declared in one place. */
export type RateLimitRules = Record<string, RateLimitRule>;

/** Every route falls back to this rule when it has no entry of its own. */
export const DEFAULT_RULE: RateLimitRule = { refillPerSec: 5, burst: 20 };

/**
 * Per-route limits. Routes not listed here use `DEFAULT_RULE`. Keys are
 * `METHOD path` with the controller prefix included, so a route is addressed
 * the same way the request arrives.
 */
export const ROUTE_RULES: RateLimitRules = {
  'GET /gateway/auth/me': { refillPerSec: 2, burst: 10 },
  'GET /gateway/auth/session': { refillPerSec: 2, burst: 10 },
  'GET /gateway/bff/home': { refillPerSec: 10, burst: 40 },
  'GET /gateway/bff/catalogue': { refillPerSec: 10, burst: 40 },
  'GET /gateway/bff/openapi': { refillPerSec: 1, burst: 5 },
};

export function ruleFor(rules: RateLimitRules, routeKey: string): RateLimitRule {
  return rules[routeKey] ?? DEFAULT_RULE;
}

/** A fresh, full bucket for a caller we have not seen before. */
export function newBucket(burst: number, nowMs: number): TokenBucket {
  return { tokens: burst, updatedAt: nowMs };
}

/**
 * Refill a bucket for the time that has passed, capped at the burst size. The
 * refill is fractional so a caller recovering from a burst is not forced to
 * wait a whole second for the next token.
 */
export function refill(bucket: TokenBucket, nowMs: number, rule: RateLimitRule): TokenBucket {
  const elapsedSec = Math.max(0, (nowMs - bucket.updatedAt) / 1000);
  const tokens = Math.min(rule.burst, bucket.tokens + elapsedSec * rule.refillPerSec);
  return { tokens, updatedAt: nowMs };
}

/** `Retry-After` in whole seconds: how long until at least one token is back. */
export function retryAfterSeconds(tokensNeeded: number, rule: RateLimitRule): number {
  if (rule.refillPerSec <= 0) return 60;
  return Math.max(1, Math.ceil(tokensNeeded / rule.refillPerSec));
}

/**
 * Decide one call against a caller's bucket. A call needs one token; when none
 * is free it is refused and `retryAfterSec` says when to come back. The
 * returned bucket is the state to persist, refilled to `now`.
 */
export function rateLimitDecision(
  bucket: TokenBucket | undefined,
  nowMs: number,
  rule: RateLimitRule,
): RateLimitDecision {
  const current = bucket ? refill(bucket, nowMs, rule) : newBucket(rule.burst, nowMs);
  if (current.tokens >= 1) {
    return { allowed: true, tokens: current.tokens - 1, retryAfterSec: 0, bucket: { tokens: current.tokens - 1, updatedAt: nowMs } };
  }
  return {
    allowed: false,
    tokens: 0,
    retryAfterSec: retryAfterSeconds(1 - current.tokens, rule),
    bucket: current,
  };
}

/**
 * The bucket key: a signed-in caller is limited per user, so one noisy session
 * cannot spend another's budget; anonymous traffic is limited per client IP.
 */
export function rateLimitKey(userId: string | undefined, ip: string | undefined): string {
  if (userId) return `u:${userId}`;
  return `ip:${ip || 'unknown'}`;
}

/** `METHOD path` key for the rule table, query string stripped. */
export function routeKey(method: string | undefined, path: string | undefined): string {
  const m = (method ?? 'GET').toUpperCase();
  const p = (path ?? '/').split('?')[0].replace(/\/+$/, '') || '/';
  return `${m} ${p}`;
}
