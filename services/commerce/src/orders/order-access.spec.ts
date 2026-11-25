import { describe, it, expect } from 'vitest';
import { canViewOrder, toPublicOrder, type OwnedOrder } from './order-access';
import type { Order } from './orders.types';

function order(overrides: Partial<OwnedOrder> = {}): OwnedOrder {
  return {
    id: 'ord_1',
    cycleId: null,
    status: 'confirmed',
    lines: [],
    subtotalExVatCents: 100,
    deliveryFeeCents: 0,
    vatCents: 15,
    totalIncVatCents: 115,
    createdAt: '2026-11-11T10:00:00.000Z',
    customerUserId: 'user-a',
    ...overrides,
  } as OwnedOrder;
}

describe('canViewOrder', () => {
  it('lets the owner see their own order', () => {
    expect(canViewOrder(order(), { userId: 'user-a', staff: false })).toBe(true);
  });

  it('refuses another customer', () => {
    expect(canViewOrder(order(), { userId: 'user-b', staff: false })).toBe(false);
  });

  it('refuses an anonymous caller', () => {
    expect(canViewOrder(order(), { staff: false })).toBe(false);
  });

  it('lets staff see any order, because they hold orders:read', () => {
    expect(canViewOrder(order(), { userId: 'staff-1', staff: true })).toBe(true);
  });

  it('refuses a customer the guest order that has no owner', () => {
    expect(canViewOrder(order({ customerUserId: null }), { userId: 'user-a', staff: false })).toBe(false);
  });

  it('treats a missing owner id as a guest order, not a wildcard', () => {
    expect(canViewOrder(order({ customerUserId: undefined }), { userId: 'user-a', staff: false })).toBe(false);
  });
});

describe('toPublicOrder', () => {
  it('drops the owner id so it cannot leak to the storefront', () => {
    const view = toPublicOrder(order());
    expect(view).not.toHaveProperty('customerUserId');
    expect(view.id).toBe('ord_1');
    expect(view.totalIncVatCents).toBe(115);
  });

  it('keeps a delivery address when there is one, and omits the key otherwise', () => {
    const withAddress = toPublicOrder(order({
      deliveryAddress: { line1: '1 Main Rd', suburb: 'Umhlanga', city: 'Durban', postalCode: '4319' },
    }));
    expect(withAddress.deliveryAddress?.suburb).toBe('Umhlanga');
    expect(toPublicOrder(order())).not.toHaveProperty('deliveryAddress');
  });
});
