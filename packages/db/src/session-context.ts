import { AsyncLocalStorage } from 'node:async_hooks';
import { SessionContext } from './session';

/**
 * The session context for the current request. A request handler (the gateway,
 * or a service's own middleware) wraps its work in `runWithSession`; store
 * adapters read `currentSession()` and pass it to `Db.withSession`, so the
 * row-level-security settings follow the caller without threading the context
 * through every store signature.
 */
const storage = new AsyncLocalStorage<SessionContext>();

/** Runs `fn` with `context` as the ambient session for everything it awaits. */
export function runWithSession<T>(context: SessionContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** The ambient session, or an empty one. Empty is default-deny under RLS. */
export function currentSession(): SessionContext {
  return storage.getStore() ?? {};
}
