/**
 * Feature flags read from the environment. A pilot that is not ready for every
 * customer is gated here, not in the adapter, so routing and the adapter stay
 * the same whether the pilot is on or off (docs/05-payments.md).
 */
export function featureEnabled(name: string, env: NodeJS.ProcessEnv = process.env): boolean {
  return env[name] === 'true';
}

/** LulaPay longer terms are a Phase 2 pilot, off until the flag is set. */
export function lulapayEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return featureEnabled('LULAPAY_ENABLED', env);
}
