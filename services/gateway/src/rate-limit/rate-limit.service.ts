import { Inject, Injectable, Optional } from '@nestjs/common';
import { RATE_LIMIT_STORE, RateLimitStore, InMemoryRateLimitStore } from './rate-limit.store';
import {
  DEFAULT_RULE,
  RateLimitDecision,
  RateLimitRule,
  RateLimitRules,
  ROUTE_RULES,
  rateLimitDecision,
  rateLimitKey,
  routeKey,
  ruleFor,
} from './rate-limit.rules';

/** Injection token for the clock, so tests can freeze time. */
export const RATE_LIMIT_CLOCK = 'AG_RATE_LIMIT_CLOCK';
/** Injection token for the per-route rule table, so it can be tuned or replaced. */
export const RATE_LIMIT_RULES = 'AG_RATE_LIMIT_RULES';

@Injectable()
export class RateLimitService {
  constructor(
    @Optional() @Inject(RATE_LIMIT_STORE) private readonly store: RateLimitStore = new InMemoryRateLimitStore(),
    @Optional() @Inject(RATE_LIMIT_RULES) private readonly rules: RateLimitRules = ROUTE_RULES,
    @Optional() @Inject(RATE_LIMIT_CLOCK) private readonly now: () => Date = () => new Date(),
  ) {}

  /** The rule that applies to a route, for the settings view and for tests. */
  ruleFor(method: string, path: string): RateLimitRule {
    return ruleFor(this.rules, routeKey(method, path));
  }

  /**
   * Spend one token for this caller on this route and return the decision. A
   * signed-in caller is keyed by user, an anonymous one by client IP. The
   * caller turns a refusal into a 429; nothing is thrown here so an
   * interceptor or guard can set `Retry-After` first.
   */
  async check(
    method: string,
    path: string,
    userId: string | undefined,
    ip: string | undefined,
  ): Promise<RateLimitDecision> {
    const key = rateLimitKey(userId, ip);
    const rule = ruleFor(this.rules, routeKey(method, path));
    const bucket = await this.store.get(key);
    const decision = rateLimitDecision(bucket, this.now().getTime(), rule);
    await this.store.set(key, decision.bucket);
    return decision;
  }

  /** The rule table, for the read-only settings view. */
  limits(): { default: RateLimitRule; routes: RateLimitRules } {
    return { default: DEFAULT_RULE, routes: this.rules };
  }
}

