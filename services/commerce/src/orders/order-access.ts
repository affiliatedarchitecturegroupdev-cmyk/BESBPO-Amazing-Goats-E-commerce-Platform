import type { Order } from './orders.types';

/**
 * Whether a caller may see an order (T-077 `sf-track`).
 *
 * Tracking is reachable by order id, and an order id that is guessable would let
 * one customer read another's address and order. The rule is therefore explicit
 * and lives here rather than as a side effect of a query: a staff member with
 * `orders:read` sees any order; a customer sees only their own. Anything else is
 * denied.
 *
 * The comparison is by owner id, which the SQL adapter takes from the request
 * session (`sales.orders.customer_user_id`), not from anything the caller sends.
 */

export interface Caller {
  userId?: string;
  /** True when the caller holds `orders:read`, i.e. staff. */
  staff: boolean;
}

/** An order carries its owner for the comparison; the public view drops it. */
export type OwnedOrder = Order & { customerUserId?: string | null };

export function canViewOrder(order: OwnedOrder, caller: Caller): boolean {
  if (caller.staff) return true;
  if (!caller.userId) return false;
  // An order with no owner is a guest order. No customer may read it by id: the
  // only safe owner of an unowned order is staff, and they are handled above.
  if (!order.customerUserId) return false;
  return order.customerUserId === caller.userId;
}

/**
 * The customer's view of an order: the fields a shopper needs, with the internal
 * owner id removed. Keeping the projection here means a new field on `Order`
 * cannot leak to the storefront by default.
 */
export interface PublicOrder {
  id: string;
  status: Order['status'];
  cycleId: string | null;
  lines: Order['lines'];
  subtotalExVatCents: number;
  deliveryFeeCents: number;
  vatCents: number;
  totalIncVatCents: number;
  deliveryAddress?: Order['deliveryAddress'];
  createdAt: string;
}

export function toPublicOrder(order: OwnedOrder): PublicOrder {
  return {
    id: order.id,
    status: order.status,
    cycleId: order.cycleId,
    lines: order.lines,
    subtotalExVatCents: order.subtotalExVatCents,
    deliveryFeeCents: order.deliveryFeeCents,
    vatCents: order.vatCents,
    totalIncVatCents: order.totalIncVatCents,
    ...(order.deliveryAddress ? { deliveryAddress: order.deliveryAddress } : {}),
    createdAt: order.createdAt,
  };
}
