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
import { Observable, concatMap } from 'rxjs';
import { JwtClaims, JwtVerifyOptions, verifyJwt } from './jwt';
import { auditRecordFromRequest, isMutating } from './audit-domain';
import { AUDIT_STORE, AuditStore, InMemoryAuditStore } from './audit-store';

export * from './jwt';
export * from './audit-domain';
export * from './audit-store';

export const PERMS_KEY = 'permissions';
export const RequirePermissions = (...p: Permission[]) => SetMetadata(PERMS_KEY, p);

/**
 * Marks a route as requiring a signed-in caller but no particular permission.
 * For self-service endpoints (a session view, a profile) that every
 * authenticated role may reach. `@RequirePermissions()` stays the norm for
 * everything else.
 */
export const AUTHENTICATED_KEY = 'authenticated';
export const RequireAuthenticated = () => SetMetadata(AUTHENTICATED_KEY, true);

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
    const authenticatedOnly = this.reflector.getAllAndOverride<boolean>(AUTHENTICATED_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if ((!required || required.length === 0) && !authenticatedOnly) return true;
    const user = userFromRequest(ctx.switchToHttp().getRequest(), this.options);
    if (!user) throw new UnauthorizedException();
    if (required && required.length > 0 && !required.every((p) => canAny(user.roles, p))) {
      throw new ForbiddenException('missing permission');
    }
    return true;
  }
}

/**
 * Writes an audit record for every mutating request. Records are written
 * after the handler succeeds, and the store is append-only, so history is
 * never rewritten. Persisting to `audit.audit_log` swaps the store, not the
 * interceptor. Provide an `AUDIT_STORE` to share a log across services.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    @Optional() @Inject(AUDIT_STORE) private readonly store: AuditStore = new InMemoryAuditStore(),
    @Optional() @Inject(AUTH_OPTIONS) private readonly options: AuthOptions = {},
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    if (!isMutating(req?.method)) return next.handle();
    const actor = userFromRequest(req, this.options);
    return next.handle().pipe(
      concatMap(async (value) => {
        await this.store.append(auditRecordFromRequest(req, actor, new Date()));
        return value;
      }),
    );
  }
}
