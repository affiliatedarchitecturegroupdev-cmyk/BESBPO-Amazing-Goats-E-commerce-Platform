import { Inject, Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import {
  AuthOptions,
  AuthUser,
  AUTH_OPTIONS,
  readJwtOptionsFromEnv,
  userFromRequest,
} from '@ag/nest-auth';
import { MeView, SessionView, claimsFromRequest, meView, sessionView } from './session';

/** Injection token for the clock, so tests can freeze time. */
export const AUTH_CLOCK = 'AG_AUTH_CLOCK';

/**
 * Session view over the caller the guard already resolved. The guard decides
 * access; this only reports who is calling and how long the session lasts.
 */
@Injectable()
export class AuthService {
  constructor(
    @Optional() @Inject(AUTH_OPTIONS) private readonly options: AuthOptions = {},
    @Optional() @Inject(AUTH_CLOCK) private readonly now: () => Date = () => new Date(),
  ) {}

  /** The resolved caller. The guard has already rejected anonymous requests. */
  me(req: any): MeView {
    const user = this.requireUser(req);
    return meView(user);
  }

  /** The resolved caller plus session timing, read from the bearer token. */
  session(req: any): SessionView {
    const user = this.requireUser(req);
    const claims = claimsFromRequest(req, { ...readJwtOptionsFromEnv(), ...this.options });
    return sessionView(user, claims, this.now());
  }

  private requireUser(req: any): AuthUser {
    const user = userFromRequest(req, this.options);
    if (!user) throw new UnauthorizedException();
    return user;
  }
}

