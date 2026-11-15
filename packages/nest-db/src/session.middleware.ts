import { Injectable, NestMiddleware } from '@nestjs/common';
import { runWithSession } from '@ag/db';
import { userFromRequest } from '@ag/nest-auth';
import { isStaff } from '@ag/rbac';

/**
 * Establishes the row-level-security session for each request from the caller
 * the auth guard resolved. Store adapters read it via `currentSession()`, so the
 * RLS settings follow the request without every store taking a context argument.
 * An unauthenticated request gets an empty (default-deny) session, so the
 * middleware fails safe even on a route the guard does not cover (a provider
 * webhook, say).
 */
@Injectable()
export class SessionMiddleware implements NestMiddleware {
  use(req: unknown, _res: unknown, next: () => void): void {
    const user = userFromRequest(req);
    runWithSession(
      { orgId: user?.orgId, userId: user?.id, staff: user ? isStaff(user.roles) : false },
      next,
    );
  }
}
