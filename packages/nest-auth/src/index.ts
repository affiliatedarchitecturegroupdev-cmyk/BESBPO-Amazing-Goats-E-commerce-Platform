import { SetMetadata, CanActivate, ExecutionContext, Injectable, ForbiddenException, UnauthorizedException, NestInterceptor, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, Role, canAny } from '@ag/rbac';
import { Observable, tap } from 'rxjs';

export const PERMS_KEY = 'permissions';
export const RequirePermissions = (...p: Permission[]) => SetMetadata(PERMS_KEY, p);

export interface AuthUser { id: string; roles: Role[]; orgId?: string }

/** Development shim: reads x-dev-user and x-dev-roles headers. NEVER enabled in production. TODO(T-005): verify JWTs from the identity provider. */
export function userFromRequest(req: any): AuthUser | undefined {
  if (req.user) return req.user as AuthUser;
  if (process.env.NODE_ENV !== 'production' && req.headers?.['x-dev-roles']) {
    return { id: String(req.headers['x-dev-user'] ?? 'dev'), roles: String(req.headers['x-dev-roles']).split(',') as Role[] };
  }
  return undefined;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMS_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required || required.length === 0) return true;
    const user = userFromRequest(ctx.switchToHttp().getRequest());
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
