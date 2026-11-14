import {
  SetMetadata,
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
  NestInterceptor,
  CallHandler,
  Inject,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, Role, canAny } from '@ag/rbac';
import { Observable, tap } from 'rxjs';
import { JwtClaims, JwtVerifyOptions, verifyJwt } from './jwt';

export * from './jwt';

export const PERMS_KEY = 'permissions';
export const RequirePermissions = (...p: Permission[]) => SetMetadata(PERMS_KEY, p);

/** Injection token for the guard's auth options, so services can configure it. */
export const AUTH_OPTIONS = 'AG_AUTH_OPTIONS';

export interface AuthUser {
  id: string;
  roles: Role[];
  orgId?: string;
}

export interface JwtAuthOptions {
  /** HMAC secret (HS256). */
  secret?: string;
  /** RSA public key, PEM (RS256). */
  publicKey?: string;
  algorithms?: JwtVerifyOptions['algorithms'];
  issuer?: string;
  audience?: string;
  clockToleranceSec?: number;
  /** Injectable clock, mainly for tests. */
  now?: () => number;
}

export interface AuthOptions extends JwtAuthOptions {
  /**
   * Development header shim (`x-dev-user` / `x-dev-roles`). Opt-in and forced
   * off in production, so it can never authenticate a real request there.
   */
  allowDevHeaders?: boolean;
}

function header(req: any, name: string): string | undefined {
  const v = req?.headers?.[name];
  return Array.isArray(v) ? v[0] : v;
}

/** Accepts either a flat `roles` claim or a Keycloak style `realm_access.roles`. */
export function rolesFromClaims(claims: JwtClaims): Role[] {
  const raw = claims.roles ?? claims.realm_access?.roles ?? [];
  if (!Array.isArray(raw)) return [];
  return raw.filter((r): r is Role => typeof r === 'string') as Role[];
}

export function userFromClaims(claims: JwtClaims): AuthUser {
  return {
    id: String(claims.sub),
    roles: rolesFromClaims(claims),
    orgId: typeof claims.org_id === 'string' ? claims.org_id : undefined,
  };
}

/**
 * Whether the development header shim may authenticate a request. It is
 * opt-in (`allowDevHeaders` or `AG_ALLOW_DEV_HEADERS=true`) and always off in
 * production, so it can never authenticate a real request there.
 */
export function isDevShimAllowed(opts: AuthOptions, env: NodeJS.ProcessEnv = process.env): boolean {
  const optedIn = opts.allowDevHeaders === true || env.AG_ALLOW_DEV_HEADERS === 'true';
  return optedIn && env.NODE_ENV !== 'production';
}

export function readJwtOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): JwtAuthOptions {
  return {
    secret: env.JWT_SECRET,
    publicKey: env.JWT_PUBLIC_KEY,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  };
}

/**
 * Guard options built from the environment. The dev header shim is opt-in via
 * `AG_ALLOW_DEV_HEADERS=true`, and `isDevShimAllowed` still forces it off in
 * production. Provide it under `AUTH_OPTIONS` to configure the guard.
 */
export function authOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): AuthOptions {
  return {
    ...readJwtOptionsFromEnv(env),
    allowDevHeaders: env.AG_ALLOW_DEV_HEADERS === 'true',
  };
}

/**
 * Resolve the caller from the request. A `Authorization: Bearer` token is
 * verified against the identity provider. The dev header shim is only honoured
 * when explicitly enabled outside production. Returns undefined for anonymous
 * or invalid requests so the guard can answer 401.
 */
export function userFromRequest(req: any, opts: AuthOptions = {}): AuthUser | undefined {
  if (req?.user) return req.user as AuthUser;

  const auth = header(req, 'authorization');
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice('Bearer '.length).trim();
    const config = { ...readJwtOptionsFromEnv(), ...opts };
    try {
      return userFromClaims(verifyJwt(token, config));
    } catch {
      return undefined; // invalid token is treated as anonymous; the guard sends 401
    }
  }

  if (isDevShimAllowed(opts) && header(req, 'x-dev-roles')) {
    return {
      id: String(header(req, 'x-dev-user') ?? 'dev'),
      roles: String(header(req, 'x-dev-roles')).split(',') as Role[],
    };
  }
  return undefined;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional() @Inject(AUTH_OPTIONS) private readonly options: AuthOptions = {},
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const user = userFromRequest(ctx.switchToHttp().getRequest(), this.options);
    if (!user) throw new UnauthorizedException();
    if (!required.every((p) => canAny(user.roles, p))) throw new ForbiddenException('missing permission');
    return true;
  }
}

/** Writes an audit record for every mutating request. TODO(T-006): persist to audit.audit_log. */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    const started = Date.now();
    return next.handle().pipe(tap(() => {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        console.log(JSON.stringify({ audit: true, method: req.method, path: req.url, user: userFromRequest(req)?.id, ms: Date.now() - started }));
      }
    }));
  }
}
