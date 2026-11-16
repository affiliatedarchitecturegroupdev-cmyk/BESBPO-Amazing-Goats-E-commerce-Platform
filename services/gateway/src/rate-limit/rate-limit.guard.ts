import { CanActivate, ExecutionContext, HttpException, HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import { AuthOptions, AUTH_OPTIONS, userFromRequest } from '@ag/nest-auth';
import { RateLimitService } from './rate-limit.service';

/** The caller's client IP, honouring the first hop of `X-Forwarded-For`. */
export function clientIp(req: any): string | undefined {
  const forwarded = req?.headers?.['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (typeof first === 'string' && first.length > 0) return first.split(',')[0].trim();
  return req?.ip ?? req?.socket?.remoteAddress;
}

/**
 * Token-bucket rate limiting for every route. Registered after the permission
 * guard, so a signed-in caller is already resolved and can be keyed by user;
 * anonymous traffic falls back to the client IP. A limited call answers 429
 * with `Retry-After`, the seconds until the next token.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    @Optional() private readonly limiter?: RateLimitService,
    @Optional() @Inject(AUTH_OPTIONS) private readonly options: AuthOptions = {},
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (!this.limiter) return true;
    const http = ctx.switchToHttp();
    const req = http.getRequest();
    const user = userFromRequest(req, this.options);
    const decision = await this.limiter.check(req?.method, req?.path ?? req?.url, user?.id, clientIp(req));
    if (decision.allowed) return true;
    const res = http.getResponse();
    if (typeof res?.setHeader === 'function') res.setHeader('Retry-After', String(decision.retryAfterSec));
    throw new HttpException(
      { statusCode: HttpStatus.TOO_MANY_REQUESTS, message: 'rate limit exceeded' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
