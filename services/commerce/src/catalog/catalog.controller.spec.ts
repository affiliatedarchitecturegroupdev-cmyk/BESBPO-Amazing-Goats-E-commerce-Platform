import { describe, it, expect } from 'vitest';
import { currentSession, runWithSession } from '@ag/db';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { InMemoryCatalogueStore } from './catalog.store';
import type { CatalogueItem } from './catalog.types';

const item = (over: Partial<CatalogueItem> & { sku: string }): CatalogueItem => ({
  id: over.sku,
  productId: over.sku,
  name: over.sku,
  pack: '',
  unit: 'each',
  fulfilment: 'in_stock',
  temperature: 'ambient',
  channel: 'both',
  phase: 1,
  lineCode: 'AG-TS',
  lineName: 'Test line',
  categorySlug: null,
  halaalAvailable: false,
  active: true,
  ...over,
});

const controller = () =>
  new CatalogController(
    new CatalogService(new InMemoryCatalogueStore([item({ sku: 'AG-LIVE' }), item({ sku: 'AG-RETIRED', active: false })])),
  );

describe('CatalogController anonymous read', () => {
  it('serves the catalogue with no session at all', async () => {
    // A storefront visitor has no user, no org and no token (T-082). Which rows
    // are visible is the RLS policy's job (db/tests/rls.sql); here the point is
    // that the route answers instead of demanding a sign-in.
    const items = await controller().list({});
    expect(items.map((i) => i.sku)).toContain('AG-LIVE');
  });

  it('serves a single active sku to an anonymous caller', async () => {
    const found = await controller().get('AG-LIVE');
    expect(found.sku).toBe('AG-LIVE');
  });

  it('searches the catalogue with no session', async () => {
    const result = await controller().search({ q: 'AG-LIVE' });
    expect(result.items.map((i) => i.sku)).toContain('AG-LIVE');
  });

  it('runs the read under an explicit anonymous session', async () => {
    // The session is named at the call site, not left to the middleware default.
    let seen: unknown;
    const spy = { all: async () => { seen = currentSession(); return [item({ sku: 'AG-LIVE' })]; } };
    await new CatalogController({ list: () => spy.all() } as unknown as CatalogService).list({});
    expect(seen).toEqual({ staff: false });
  });

  it('keeps a staff session, so staff still see inactive rows', async () => {
    let seen: unknown;
    const spy = { all: async () => { seen = currentSession(); return [item({ sku: 'AG-LIVE' })]; } };
    await runWithSession({ staff: true }, async () => {
      await new CatalogController({ list: () => spy.all() } as unknown as CatalogService).list({});
    });
    expect(seen).toEqual({ staff: true });
  });

  it('keeps a customer session, so the caller is not treated as anonymous', async () => {
    await runWithSession({ userId: 'user_c' }, async () => {
      expect(currentSession().userId).toBe('user_c');
      const items = await controller().list({});
      expect(items.map((i) => i.sku)).toContain('AG-LIVE');
    });
  });
});
