import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, Optional } from '@nestjs/common';
import { AuthOptions, AUTH_OPTIONS, userFromRequest } from '@ag/nest-auth';
import { clientIpFromHeaders, isIpAllowed, isStaff, parseAllowlist } from '@ag/rbac';
import { clientIp } from '../rate-limit/rate-limit.guard';

export const STAFF_ALLOWLIST = 'AG_STAFF_IP_ALLOWLIST';

/**
 * The staff IP allow-list, enforced server-side (T-058, `docs/02-access-control.md`).
 *
 * The admin portal has the same rule in its Next.js middleware. Both exist
 * because they stop different things: the middleware stops a browser loading a
 * staff page, and this stops a staff *token* being replayed against the gateway
 * from anywhere on the internet. A token can leak without a browser.
 *
 * Only staff callers are filtered. An external trade or partner user reaching
 * their own org's routes from a phone in the field must not be blocked by a rule
 * meant to protect the office.
 */
@Injectable()
export class StaffAllowlistGuard implements CanActivate {
  constructor(
    @Optional() @Inject(STAFF_ALLOWLIST) private readonly csv?: string,
    @Optional() @Inject(AUTH_OPTIONS) private readonly options: AuthOptions = {},
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const ranges = parseAllowlist(this.csv);
    if (ranges.length === 0) return true;

    const req = ctx.switchToHttp().getRequest();
    const user = userFromRequest(req, this.options);
    if (!user || !isStaff(user.roles)) return true;

    const ip = clientIp(req) ?? clientIpFromHeaders(new Headers(req?.headers ?? {}));
    if (!isIpAllowed(ip, ranges)) {
      throw new ForbiddenException('staff routes are restricted to approved networks');
    }
    return true;
  }
}
