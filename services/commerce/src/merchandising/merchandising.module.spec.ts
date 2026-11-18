import { describe, it, expect, afterEach } from 'vitest';
import { PERMS_KEY } from '@ag/nest-auth';
import { merchandisingStore } from './merchandising.module';
import { InMemoryMerchandisingStore } from './merchandising.store';
import { PgMerchandisingStore } from './merchandising.sql-store';
import { MerchandisingController } from './merchandising.controller';

describe('merchandisingStore', () => {
  const original = process.env.STORE_DRIVER;
  afterEach(() => {
    if (original === undefined) delete process.env.STORE_DRIVER;
    else process.env.STORE_DRIVER = original;
  });

  it('is in-memory by default, so existing tests and local runs need no database', () => {
    delete process.env.STORE_DRIVER;
    expect(merchandisingStore()).toBeInstanceOf(InMemoryMerchandisingStore);
  });

  it('is the SQL adapter when STORE_DRIVER=sql', () => {
    process.env.STORE_DRIVER = 'sql';
    expect(merchandisingStore({} as never)).toBeInstanceOf(PgMerchandisingStore);
  });
});

describe('MerchandisingController route gating', () => {
  const permsFor = (method: keyof MerchandisingController): unknown =>
    Reflect.getMetadata(PERMS_KEY, MerchandisingController.prototype[method]);

  it('gates the management routes behind merch:manage', () => {
    expect(permsFor('list')).toEqual(['merch:manage']);
    expect(permsFor('get')).toEqual(['merch:manage']);
    expect(permsFor('resolved')).toEqual(['merch:manage']);
    expect(permsFor('upsert')).toEqual(['merch:manage']);
    expect(permsFor('setItems')).toEqual(['merch:manage']);
  });

  it('leaves the resolved page read public, so the storefront BFF can call it', () => {
    expect(permsFor('forPage')).toBeUndefined();
  });
});
