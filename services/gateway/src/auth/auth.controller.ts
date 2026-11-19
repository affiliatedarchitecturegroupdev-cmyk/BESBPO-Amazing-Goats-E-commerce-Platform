import {
  Controller,
  Get,
  Inject,
  Optional,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { RequireAuthenticated } from '@ag/nest-auth';
import { AuthService } from './auth.service';
import { OidcService } from './oidc.service';
import { safeReturnPath } from './oidc';
import {
  REFRESH_COOKIE,
  SESSION_COOKIE,
  STATE_COOKIE,
  clearCookie,
  cookieFromRequest,
  issueSession,
  refreshCookie,
  refreshExpired,
  sessionConfigFromEnv,
  sessionCookie,
  stateCookie,
  type SessionConfig,
} from './session-cookie';

/**
 * The sign-in front door (T-058, `docs/02-access-control.md`).
 *
 * `login` sends the browser to the identity provider; `callback` completes the
 * exchange and sets an httpOnly session cookie. `me` and `session` then report
 * the caller the guard already resolved — unchanged, because the session is a
 * bearer token the guard already understands and `SessionMiddleware` lifts it
 * off the cookie onto `req.user`.
 *
 * The token never reaches the browser's JavaScript: it lives in an httpOnly
 * cookie, and each portal reads through the gateway server-side.
 */
@Controller('gateway/auth')
export class AuthController {
  private readonly config: SessionConfig;

  constructor(
    private readonly service: AuthService,
    @Optional() @Inject(OidcService) private readonly oidc?: OidcService,
  ) {
    this.config = sessionConfigFromEnv();
  }

  /** Starts a login. Answers 503 when no identity provider is configured. */
  @Get('login')
  login(@Query('returnTo') returnTo: string, @Res() res: any): void {
    if (!this.oidc?.configured) {
      throw new ServiceUnavailableException('sign-in is not configured');
    }
    const { url, state } = this.oidc.begin(safeReturnPath(returnTo));
    res.setHeader('Set-Cookie', stateCookie(state, this.config));
    res.redirect(302, url);
  }

  /**
   * Completes a login. Every failure is the same 401 with the same message:
   * which check failed is not the caller's business, and saying would help
   * someone probing the flow.
   */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Req() req: any,
    @Res() res: any,
  ): Promise<void> {
    if (error) throw new UnauthorizedException('sign-in failed');

    const sealed = cookieFromRequest(req, STATE_COOKIE);
    const result = await this.oidc?.complete(sealed, code);
    if (!result) throw new UnauthorizedException('sign-in failed');

    const session = issueSession(
      {
        sub: result.claims.sub,
        roles: result.claims.roles,
        org_id: result.claims.orgId,
        email: result.claims.email,
      },
      this.config,
    );

    // The state cookie is single-use, so it is cleared in the same response
    // that sets the session: revisiting the callback URL must not replay it.
    res.setHeader('Set-Cookie', [
      sessionCookie(session, this.config),
      refreshCookie(result.refreshSeed, this.config),
      clearCookie(STATE_COOKIE, this.config),
    ]);
    res.redirect(302, safeReturnPath(result.returnTo));
  }

  /** Clears the session and the refresh. Idempotent, so a stale tab can call it. */
  @Post('logout')
  logout(@Res() res: any): void {
    res.setHeader('Set-Cookie', [
      clearCookie(SESSION_COOKIE, this.config),
      clearCookie(REFRESH_COOKIE, this.config),
    ]);
    res.status(204).end();
  }

  /**
   * Renews the session from the refresh cookie without re-prompting. Refuses
   * once the refresh window has passed, so a session cannot be extended
   * indefinitely by refreshing in a loop.
   */
  @Post('refresh')
  refresh(@Req() req: any, @Res() res: any): void {
    const refresh = cookieFromRequest(req, REFRESH_COOKIE);
    const user = this.service.resolve(req);
    if (!refresh || !user) throw new UnauthorizedException('no session');

    const issuedAtMs = this.service.issuedAtMs(req);
    if (issuedAtMs !== undefined && refreshExpired(issuedAtMs, this.config)) {
      throw new UnauthorizedException('refresh expired');
    }

    const session = issueSession(
      { sub: user.id, roles: user.roles, org_id: user.orgId },
      this.config,
    );
    res.setHeader('Set-Cookie', [
      sessionCookie(session, this.config),
      refreshCookie(refresh, this.config),
    ]);
    res.status(204).end();
  }

  @Get('me')
  @RequireAuthenticated()
  me(@Req() req: any) {
    return this.service.me(req);
  }

  @Get('session')
  @RequireAuthenticated()
  session(@Req() req: any) {
    return this.service.session(req);
  }
}
