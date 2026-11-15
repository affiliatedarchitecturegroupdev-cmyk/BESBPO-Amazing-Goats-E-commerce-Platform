/**
 * Chooses the store implementation at boot. The default is in-memory, so tests
 * and local runs need no database; setting `STORE_DRIVER=sql` selects the SQL
 * adapters, which requires `DATABASE_URL`. One switch for the whole service, so
 * a deployment cannot end up with half its stores persisted.
 */
export type StoreDriver = 'memory' | 'sql';

export function storeDriver(env: NodeJS.ProcessEnv = process.env): StoreDriver {
  const value = env.STORE_DRIVER ?? 'memory';
  if (value !== 'memory' && value !== 'sql') {
    throw new Error(`STORE_DRIVER must be 'memory' or 'sql', got '${value}'`);
  }
  return value;
}

/**
 * Picks between the in-memory store and the SQL store. `buildSql` is lazy so the
 * pool (and the `DATABASE_URL` check) only runs when the SQL driver is selected.
 */
export function selectStore<T>(inMemory: T, buildSql: () => T, env: NodeJS.ProcessEnv = process.env): T {
  return storeDriver(env) === 'sql' ? buildSql() : inMemory;
}
