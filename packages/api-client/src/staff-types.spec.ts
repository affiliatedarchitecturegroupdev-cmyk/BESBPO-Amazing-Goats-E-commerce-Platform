import { describe, expect, it } from 'vitest';
import { createClient, type FetchLike } from './index';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function stubFetch(...responses: Response[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error(`unexpected call to ${url}`);
    return next;
  };
  return { impl, calls };
}

describe('api-client staff and partner surface', () => {
  it('lists staff orders and cycles from the gateway', async () => {
    const { impl, calls } = stubFetch(jsonResponse([{ id: 'o1', status: 'confirmed' }]), jsonResponse([]));
    const client = createClient('https://gw.example', () => ({}), impl);
    await client.orders();
    await client.cycles();
    expect(calls.map((c) => c.url)).toEqual([
      'https://gw.example/commerce/orders',
      'https://gw.example/commerce/cycles',
    ]);
  });

  it('posts a driver event batch with a JSON body', async () => {
    const { impl, calls } = stubFetch(jsonResponse({ accepted: 1, duplicates: 0 }));
    await createClient('https://gw.example', () => ({}), impl).syncDriverEvents([
      { id: 'e1', deviceId: 'd1', type: 'delivered', stopId: 's1', occurredAt: 't', payload: {} },
    ]);
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({ events: [{ id: 'e1' }] });
  });

  it('carries the orgId query on partner reads and confirms a slot', async () => {
    const { impl, calls } = stubFetch(jsonResponse([]), jsonResponse({ id: 'slot-1', confirmed: true }));
    const client = createClient('https://gw.example', () => ({}), impl);
    await client.partnerSlots('org-7');
    await client.confirmPartnerSlot('slot/1', 'org-7');
    expect(calls[0].url).toBe('https://gw.example/partners/slots?orgId=org-7');
    expect(calls[1].url).toBe('https://gw.example/partners/slots/slot%2F1/confirm?orgId=org-7');
    expect(calls[1].init?.method).toBe('POST');
  });

  it('drafts a campaign and tops up the wallet', async () => {
    const { impl, calls } = stubFetch(jsonResponse({ id: 'c1' }), jsonResponse({ balanceCents: 5000 }));
    const client = createClient('https://gw.example', () => ({}), impl);
    await client.createCampaign({ advertiserOrgId: 'org-1', name: 'Braai', goal: 'g', budgetCents: 1000, pricing: 'flat' });
    await client.topUpWallet({ advertiserOrgId: 'org-1', amountCents: 5000 });
    expect(calls[0].url).toBe('https://gw.example/ads/campaigns');
    expect(calls[1].url).toBe('https://gw.example/ads/billing/top-up');
  });

  it('reads warehouse KPIs with a day window', async () => {
    const { impl, calls } = stubFetch(jsonResponse({ dso: 0, bad_debt_pct: 0, gross_margin_pct: 0 }));
    await createClient('https://gw.example', () => ({}), impl).kpis({ days: 30 });
    expect(calls[0].url).toBe('https://gw.example/analytics/kpis?days=30');
  });
});
