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
    return sessionView(user, this.claims(req), this.now());
  }

  /** The caller, or undefined. For a route that must answer differently to anonymous. */
  resolve(req: any): AuthUser | undefined {
    return userFromRequest(req, this.options);
  }

  /** The verified claims, when there is a token to read them from. */
  claims(req: any) {
    return claimsFromRequest(req, { ...readJwtOptionsFromEnv(), ...this.options });
  }

  /**
   * When the session was issued, in epoch milliseconds. The refresh endpoint
   * uses it to refuse a renewal past the window, so a session cannot be
   * extended forever by refreshing in a loop.
   */
  issuedAtMs(req: any): number | undefined {
    const iat = this.claims(req)?.iat;
    return typeof iat === 'number' ? iat * 1000 : undefined;
  }

  private requireUser(req: any): AuthUser {
    const user = this.resolve(req);
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
