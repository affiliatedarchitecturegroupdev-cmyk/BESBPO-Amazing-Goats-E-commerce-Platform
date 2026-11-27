import { describe, it, expect } from 'vitest';
import { AUTHENTICATED_KEY, PERMS_KEY } from '@ag/nest-auth';
import { BffController } from './bff.controller';
import { BffService } from './bff.service';
import { FetchLike, Upstreams } from './upstream';

const COMMERCE_ONLY: Upstreams = { commerce: 'http://commerce' };
const CATALOGUE = { items: [{ sku: 'AG-EG-001', name: 'Eggs, large', channel: 'both', fulfilment: 'in_stock', temperature: 'ambient', phase: 1 }] };

function stubFetch(): FetchLike {
  return async () => ({ ok: true, status: 200, json: async () => CATALOGUE });
}

const controller = () => new BffController(new BffService(COMMERCE_ONLY, stubFetch()));

/** The guard reads these keys; absent means "no permission and no sign-in needed". */
function gateOf(method: keyof BffController) {
  const fn = BffController.prototype[method] as unknown as object;
  const perms = Reflect.getMetadata(PERMS_KEY, fn) as string[] | undefined;
  const authenticated = Reflect.getMetadata(AUTHENTICATED_KEY, fn) as boolean | undefined;
  return { perms: perms ?? [], authenticated: authenticated ?? false };
}

describe('BffController public catalogue routes', () => {
  it('leaves home, catalogue and merchandising open to an anonymous visitor', () => {
    // The shop is browsed before it is joined (T-082).
    for (const route of ['home', 'catalogue', 'merchandising'] as const) {
      expect(gateOf(route)).toEqual({ perms: [], authenticated: false });
    }
  });

  it('still gates the OpenAPI document on catalog:read', () => {
    expect(gateOf('openapi')).toEqual({ perms: ['catalog:read'], authenticated: false });
  });

  it('answers an anonymous catalogue request with the public view', async () => {
    const res = await controller().catalogue({ headers: {} } as never);
    expect(res.view).toBe('public');
    expect(res.items.map((i) => i.sku)).toEqual(['AG-EG-001']);
  });

  it('gives a trade caller the trade view without a guard rejecting them', async () => {
    const req = { headers: {}, user: { id: 'u1', roles: ['trade_owner'] } };
    const res = await controller().catalogue(req as never);
    expect(res.view).toBe('trade');
  });
});
