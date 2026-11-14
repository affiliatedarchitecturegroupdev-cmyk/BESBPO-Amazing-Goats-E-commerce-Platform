import type { Address, FulfilmentType, OrderStatus, Temperature } from '@ag/shared-types';
import type { CycleRecord } from '../cycles/cycle-engine';

/** Standard VAT rate for South Africa. The authoritative rate belongs to T-009 pricing. */
export const STANDARD_VAT_RATE = 0.15;

export interface CartLine {
  sku: string;
  qty: number;
  unitPriceExVatCents: number;
  fulfilment: FulfilmentType;
  temperature: Temperature;
}

export interface Cart {
  lines: CartLine[];
  deliveryFeeCents?: number;
  paymentMethod?: string;
  deliveryAddress?: Address;
}

export interface OrderLine {
  sku: string;
  qty: number;
  unitPriceExVatCents: number;
  fulfilment: FulfilmentType;
  temperature: Temperature;
}

export interface Order {
  id: string;
  cycleId: string | null;
  status: OrderStatus;
  lines: OrderLine[];
  subtotalExVatCents: number;
  deliveryFeeCents: number;
  vatCents: number;
  totalIncVatCents: number;
  paymentMethod?: string;
  deliveryAddress?: Address;
  createdAt: string;
}
