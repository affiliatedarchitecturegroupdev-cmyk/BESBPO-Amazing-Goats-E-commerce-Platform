'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { addLine, CART_PATH, removeLine, safeBack, setLineQty, toCartLine } from './cart';
import { cartSession, writeCart } from './cart-session';
import { loadItem } from './gateway';

/**
 * Add a catalogue item to the cart. The price is read from the catalogue on the
 * server, so a tampered form cannot set the price of a line; the shopper's cart
 * cookie is then rewritten. A failure sends the shopper back with a reason.
 */
export async function addToCart(formData: FormData): Promise<void> {
  const sku = String(formData.get('sku') ?? '').trim();
  const qty = Number(formData.get('qty') ?? 1) || 1;
  const back = safeBack(String(formData.get('redirectTo') ?? CART_PATH));

  if (!sku) redirect(`${back}?cart=error`);

  const { data: item } = await loadItem(sku);
  const line = item ? toCartLine(item, qty) : null;
  if (!line) redirect(`${back}?cart=unavailable`);

  const cart = cartSession();
  writeCart({ ...cart, lines: addLine(cart.lines, line) });
  revalidatePath(CART_PATH);
  redirect(`${back}?cart=added`);
}

/** Change a line's quantity; zero or less removes it. */
export async function updateCartQty(formData: FormData): Promise<void> {
  const sku = String(formData.get('sku') ?? '').trim();
  const qty = Number(formData.get('qty') ?? 0);
  const cart = cartSession();
  writeCart({ ...cart, lines: setLineQty(cart.lines, sku, qty) });
  revalidatePath(CART_PATH);
  redirect(CART_PATH);
}

/** Remove a line. */
export async function removeFromCart(formData: FormData): Promise<void> {
  const sku = String(formData.get('sku') ?? '').trim();
  const cart = cartSession();
  writeCart({ ...cart, lines: removeLine(cart.lines, sku) });
  revalidatePath(CART_PATH);
  redirect(CART_PATH);
}
