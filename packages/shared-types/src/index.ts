export type FulfilmentType = 'in_stock' | 'pre_order_cycle' | 'reservation' | 'quote' | 'seasonal_pre_order';
export type Channel = 'both' | 'public_only' | 'trade_only';
export type Temperature = 'live' | 'chilled' | 'frozen' | 'ambient';
export type Phase = 1 | 2 | 3;
export type CreditTier = 'new' | 'probation' | 'standard' | 'preferred';
export type OrderStatus = 'pending_payment' | 'confirmed' | 'in_cycle' | 'packing' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'refunded';
export type CycleStatus = 'scheduled' | 'open' | 'locked' | 'closed' | 'fulfilled';
export type PaymentMethod = 'pay_by_bank' | 'card' | 'wallet' | 'bnpl' | 'recurring_debit' | 'escrow' | 'trade_bnpl' | 'pos' | 'account';
export type Money = number; // integer cents, ZAR, excluding VAT unless the field name says incVat

export interface Variant {
  id: string; sku: string; productId: string; name: string; pack: string; unit: string;
  fulfilment: FulfilmentType; temperature: Temperature; channel: Channel; phase: Phase; priceCents?: Money;
}
export interface Address { line1: string; suburb: string; city: string; postalCode: string; zoneId?: string }
