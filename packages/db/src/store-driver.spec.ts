import { describe, it, expect } from 'vitest';
import { selectStore, storeDriver } from './store-driver';

describe('storeDriver', () => {
  it('defaults to memory so tests and local runs need no database', () => {
    expect(storeDriver({})).toBe('memory');
  });

  it('accepts sql', () => {
    expect(storeDriver({ STORE_DRIVER: 'sql' })).toBe('sql');
  });

  it('rejects an unknown driver rather than silently using memory', () => {
    expect(() => storeDriver({ STORE_DRIVER: 'postgres' })).toThrow(/STORE_DRIVER/);
  });
});

describe('selectStore', () => {
  it('returns the in-memory store by default and never calls the SQL builder', () => {
    let built = false;
    const store = selectStore({ kind: 'memory' }, () => {
      built = true;
      return { kind: 'sql' };
    }, {});
    expect(store.kind).toBe('memory');
    expect(built).toBe(false);
  });

  it('returns the SQL store when the driver is sql', () => {
    const store = selectStore({ kind: 'memory' }, () => ({ kind: 'sql' }), { STORE_DRIVER: 'sql' });
    expect(store.kind).toBe('sql');
  });
});
