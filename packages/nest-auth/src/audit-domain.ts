/**
 * Audit domain: what gets recorded for a mutating request, and the rule that
 * the log is append-only. Pure functions here; persistence lives in the store.
 */

/** The HTTP methods that change state, and so must be audited. */
export const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type MutatingMethod = (typeof MUTATING_METHODS)[number];

/** One row of `audit.audit_log`, field names kept close to the schema. */
export interface AuditRecord {
  at: string;
  actorUserId?: string;
  actorRoles?: string[];
  action: string;
  entity: string;
  entityId?: string;
  ip?: string;
  requestId?: string;
  approvedBy?: string;
}

export interface AuditActor {
  id: string;
  roles: string[];
}

/** Whether a request method must be audited. */
export function isMutating(method: string | undefined): method is MutatingMethod {
  return !!method && (MUTATING_METHODS as readonly string[]).includes(method.toUpperCase());
}

/**
 * Build the audit record for a request. `entity` is the route path (or the URL
 * when the route is unknown) and `entityId` the `:id` route parameter.
 */
export function auditRecordFromRequest(
  req: { method?: string; url?: string; route?: { path?: string }; params?: Record<string, string>; ip?: string; headers?: Record<string, unknown> },
  actor: AuditActor | undefined,
  at: Date,
): AuditRecord {
  const requestId = req.headers?.['x-request-id'];
  return {
    at: at.toISOString(),
    actorUserId: actor?.id,
    actorRoles: actor?.roles,
    action: (req.method ?? 'UNKNOWN').toUpperCase(),
    entity: req.route?.path ?? req.url ?? '',
    entityId: req.params?.id,
    ip: req.ip,
    requestId: typeof requestId === 'string' ? requestId : undefined,
  };
}

/** The audit tables are append-only: updates and deletes are refused. */
export function assertAppendOnly(operation: 'update' | 'delete'): never {
  throw new Error(`audit log is append-only: ${operation} is not allowed`);
}
