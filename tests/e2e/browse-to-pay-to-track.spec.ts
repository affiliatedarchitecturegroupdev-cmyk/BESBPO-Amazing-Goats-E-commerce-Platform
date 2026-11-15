// T-035 core journey 1: browse -> pay -> track.
//
// This walks the whole public path against the real service code: the seeded
// catalogue answers a search, checkout offers pay by bank first, the cart becomes
// an order assigned to the open cycle, the order is paid through the Stitch
// adapter, the provider webhook confirms it, and the delivery then tracks to
// delivered. Each step calls the same functions the services call; only the
// network (Stitch's `fetch`) is stubbed.
import { describe, it, expect } from 'vitest';
import {
  CatalogService,
  seedCatalogueStore,
} from '../../services/commerce/src/catalog/catalog.service';
import { buildOrder } from '../../services/commerce/src/orders/order-builder';
import { generateCycle } from '../../services/commerce/src/cycles/cycle-engine';
import type { Cart } from '../../services/commerce/src/orders/orders.types';
import { paymentOptions } from '../../apps/storefront/lib/payments';
import { DriverSyncService } from '../../services/logistics/src/driver-sync/driver-sync.service';
import { InMemorySyncEventStore } from '../../services/logistics/src/driver-sync/driver-sync.store';
import { paymentsHarness } from './harness';

const PLACED_AT = new Date('2026-11-16T08:00:00Z'); // Monday 10:00 SAST, before Sunday's cut-off

describe('journey: browse to pay to track', () => {
  it('searches, checks out pay-by-bank first, pays, and tracks to delivered', async () => {
    // 1. Browse: a typo'd search still finds the flagship lamb box.
    const catalogue = new CatalogService(seedCatalogueStore());
    const search = await catalogue.search('lamb boxs');
    expect(search.items.length).toBeGreaterThan(0);
    const lamb = search.items.find((i) => i.sku.startsWith('AG-LB'))!;
    expect(lamb).toBeDefined();
    expect(lamb.fulfilment).toBe('pre_order_cycle');

    // 2. Checkout: pay by bank is offered first and carries the discount.
    const [firstOption] = paymentOptions(310_500);
    expect(firstOption.method).toBe('pay_by_bank');
    expect(firstOption.recommended).toBe(true);
    expect(firstOption.discountCents).toBeGreaterThan(0);

    // 3. Cart -> order, assigned to the open cycle and totalled with VAT.
    const cart: Cart = {
      lines: [
        {
          sku: lamb.sku,
          qty: 1,
          unitPriceExVatCents: 270_000,
          fulfilment: lamb.fulfilment,
          temperature: lamb.temperature,
        },
      ],
      deliveryFeeCents: 0,
      paymentMethod: 'pay_by_bank',
    };
    const order = buildOrder(cart, {
      id: 'ord_e2e_1',
      placedAt: PLACED_AT,
      cycles: [generateCycle(PLACED_AT)],
    });
    expect(order.status).toBe('pending_payment');
    expect(order.cycleId).not.toBeNull();
    expect(order.totalIncVatCents).toBe(270_000 + 40_500); // 15% VAT on goods, no fee

    // 4. Pay: the Stitch adapter is routed first for pay by bank and returns a
    //    hosted redirect; the intent holds the provider reference.
    const payments = paymentsHarness();
    const intent = await payments.intents.create({
      idempotencyKey: 'idem-e2e-1',
      method: 'pay_by_bank',
      amountIncVatCents: order.totalIncVatCents,
      orderId: order.id,
      reference: order.id,
    });
    expect(intent.provider).toBe('stitch');
    expect(intent.providerRef).toBe(payments.createdRef);
    expect(intent.status).toBe('pending');

    // 5. The customer pays; Stitch confirms through a signed webhook.
    const body = JSON.stringify({
      type: 'payment-initiation-request',
      data: {
        status: 'PaymentInitiationRequestCompleted',
        externalReference: payments.createdRef,
        amount: { quantity: '3105.00' },
      },
    });
    const result = await payments.webhooks.receive('stitch', {
      headers: payments.sign(body),
      rawBody: body,
    });
    expect(result.received).toBe(true);
    expect(result.duplicate).toBe(false);
    expect((await payments.intents.get(intent.id)).status).toBe('succeeded');

    // A retried delivery of the same event is a no-op.
    const replay = await payments.webhooks.receive('stitch', {
      headers: payments.sign(body),
      rawBody: body,
    });
    expect(replay.duplicate).toBe(true);
    expect(await payments.intents.list()).toHaveLength(1);

    // 6. Track: the driver marks the stop delivered and the order tracks through.
    const logistics = new DriverSyncService(new InMemorySyncEventStore());
    await logistics.receive([
      {
        id: 'ev-1',
        deviceId: 'dev-1',
        type: 'arrived',
        stopId: order.id,
        occurredAt: '2026-11-18T06:00:00Z',
        payload: {},
      },
      {
        id: 'ev-2',
        deviceId: 'dev-1',
        type: 'delivered',
        stopId: order.id,
        occurredAt: '2026-11-18T06:10:00Z',
        payload: {},
      },
    ]);
    expect(await logistics.deliveryStatus(order.id)).toBe('delivered');
  });

  it('does not open checkout for a cycle order once the cut-off has passed', () => {
    const closedCycle = {
      id: 'chilled_meat:closed',
      productClass: 'chilled_meat' as const,
      cutoffAt: '2026-11-15T15:00:00.000Z', // Sunday 17:00 SAST, already past
      deliveryFrom: '2026-11-18T04:00:00.000Z',
      deliveryTo: '2026-11-20T16:00:00.000Z',
      status: 'open' as const,
    };
    const cart: Cart = {
      lines: [
        {
          sku: 'AG-LB-001',
          qty: 1,
          unitPriceExVatCents: 270_000,
          fulfilment: 'pre_order_cycle',
          temperature: 'chilled',
        },
      ],
    };
    expect(() =>
      buildOrder(cart, { id: 'ord_late', placedAt: PLACED_AT, cycles: [closedCycle] }),
    ).toThrow(/no open cycle/);
  });
});
