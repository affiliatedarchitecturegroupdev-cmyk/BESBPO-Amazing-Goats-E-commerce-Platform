import { Pool } from 'pg';
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { SessionContext, sessionStatement } from './session';

/**
 * The query surface a store adapter needs. Narrower than `pg.Pool` so a test can
 * pass a fake and the adapter never reaches for a method outside this contract.
 */
export interface Db {
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<R>>;
  /**
   * Runs `fn` in one transaction with the row-level-security settings applied
   * for the duration, then commits (or rolls back on a throw). The application
   * connects as a NOSUPERUSER, NOBYPASSRLS role, so these settings are what
   * make rows visible; see `db/README.md`.
   */
  withSession<T>(context: SessionContext, fn: (tx: Db) => Promise<T>): Promise<T>;
  end(): Promise<void>;
}

/** Wraps one `pg` client so `fn` runs against it inside the open transaction. */
function clientDb(client: PoolClient): Db {
  return {
    query: (text, values) => client.query(text, values as unknown[]),
    withSession: (context, fn) => runInSession(client, context, fn),
    end: async () => {},
  };
}

async function runInSession<T>(
  client: PoolClient,
  context: SessionContext,
  fn: (tx: Db) => Promise<T>,
): Promise<T> {
  const statement = sessionStatement(context);
  await client.query(statement.text, statement.values);
  return fn(clientDb(client));
}

/** A `Db` backed by a connection pool. One pool per process. */
export class PgDb implements Db {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 10 });
  }

  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<R>> {
    return this.pool.query<R>(text, values as unknown[]);
  }

  async withSession<T>(context: SessionContext, fn: (tx: Db) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await runInSession(client, context, fn);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  end(): Promise<void> {
    return this.pool.end();
  }
}

/**
 * Builds the process database handle. Throws when `DATABASE_URL` is missing so a
 * service fails at boot rather than at the first query; the store factories in
 * each service only call this when the SQL adapter is selected.
 */
export function createDb(env: NodeJS.ProcessEnv = process.env): Db {
  const connectionString = env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to use the SQL store adapters');
  }
  return new PgDb(connectionString);
}
