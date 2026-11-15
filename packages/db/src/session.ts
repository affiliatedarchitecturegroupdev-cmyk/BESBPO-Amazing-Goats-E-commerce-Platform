/**
 * Row-level-security session settings. The gateway sets these per request after
 * RBAC; `db/README.md` and `db/migrations/0010_row_level_security.sql` explain
 * why every read and write goes through them (default deny, org/user scoping,
 * staff bypass).
 */
export interface SessionContext {
  orgId?: string;
  userId?: string;
  staff?: boolean;
}

/** The `(name, value)` pairs to set for a session. Empty strings read as "not set". */
export function sessionSettings(context: SessionContext): Array<[string, string]> {
  return [
    ['app.org_id', context.orgId ?? ''],
    ['app.user_id', context.userId ?? ''],
    ['app.staff', context.staff ? 'on' : 'off'],
  ];
}

/**
 * The statement that applies a session. `set_config(name, value, true)` is a
 * parameterised `SET LOCAL`: the settings reset when the transaction ends, and
 * the values cannot be injected through the settings themselves.
 */
export function sessionStatement(context: SessionContext): { text: string; values: string[] } {
  const settings = sessionSettings(context);
  const text =
    'SELECT ' +
    settings.map((_, index) => `set_config($${index * 2 + 1}, $${index * 2 + 2}, true)`).join(', ');
  return { text, values: settings.flat() };
}
