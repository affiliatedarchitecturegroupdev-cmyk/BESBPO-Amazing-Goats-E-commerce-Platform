import { Injectable, NestMiddleware } from '@nestjs/common';
import { AuthOptions, AUTH_OPTIONS, userFromRequest } from '@ag/nest-auth';
import { Inject, Optional } from '@nestjs/common';
import { SESSION_COOKIE, cookieFromRequest } from './session-cookie';

/**
 * Lifts the httpOnly session cookie onto the request as a bearer token (T-058).
 *
 * The guard resolves callers from `Authorization: Bearer` (and the dev shim).
 * Rather than teach it about cookies — which would put a browser concern into a
 * package the other services also use — the gateway rewrites the cookie into the
 * header it already understands, once, before any guard runs. A caller that
 * already sent a bearer header keeps it, so server-to-server calls are unaffected.
 */
@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(@Optional() @Inject(AUTH_OPTIONS) private readonly options: AuthOptions = {}) {}

  use(req: any, _res: any, next: () => void): void {
    if (!req.headers.authorization) {
      const token = cookieFromRequest(req, SESSION_COOKIE);
      if (token) req.headers.authorization = `Bearer ${token}`;
    }
    next();
  }
}
