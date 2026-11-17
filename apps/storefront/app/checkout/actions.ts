'use server';

import { redirect } from 'next/navigation';
import { ApiError, type CartLineInput } from '@ag/api-client';
import { gatewayClient } from '../../lib/gateway';

/**
 * Place the cart as an order through the gateway. The order is created on the
 * server, so the caller's bearer token never reaches the browser; on success we
 * send the shopper to the tracking screen, and on a failure we send them back
 * to checkout with a plain message.
 */
export async function placeOrder(formData: FormData): Promise<void> {
  const lines = JSON.parse(String(formData.get('lines') ?? '[]')) as CartLineInput[];
  if (lines.length === 0) redirect('/cart');
  const deliveryFeeCents = Number(formData.get('deliveryFeeCents') ?? 0) || undefined;
  const zoneId = String(formData.get('zoneId') ?? '') || undefined;

  let orderId: string;
  try {
    const order = await gatewayClient().createOrder({ lines, deliveryFeeCents, zoneId });
    orderId = order.id;
  } catch (err) {
    const reason = err instanceof ApiError && err.status === 401 ? 'signin' : 'failed';
    redirect(`/checkout?error=${reason}`);
  }
  redirect(`/track/${encodeURIComponent(orderId)}`);
}
