// Wireframe: docs/wireframes/index.html#sf-cart
import Link from 'next/link';
import { ProductCard } from '../../components/ProductCard';
import { SponsoredSlot } from '../../components/FulfilmentTag';
import { cartTotals } from '../../lib/cart';
import { groupByFulfilment, deliveryLine } from '../../lib/cart-groups';
import { cartSession } from '../../lib/cart-session';
import { updateCartQty, removeFromCart } from '../../lib/cart-actions';
import { formatRand } from '../../lib/format';
import { loadCatalogue } from '../../lib/gateway';

// The cart cookie and cross-sell catalogue are read per request.
export const dynamic = 'force-dynamic';

const MESSAGES: Record<string, string> = {
  added: 'Added to your cart.',
  unavailable: 'That item is not available to order right now.',
  error: 'We could not add that item. Please try again.',
};

export default async function CartPage({ searchParams }: { searchParams: { cart?: string } }) {
  const cart = cartSession();
  const groups = groupByFulfilment(cart.lines);
  const totals = cartTotals(cart);
  const delivery = deliveryLine(cart.zoneId, totals.deliveryFeeCents);
  const notice = searchParams.cart ? MESSAGES[searchParams.cart] : undefined;

  if (cart.lines.length === 0) {
    return (
      <section>
        <h1>Cart</h1>
        {notice && <p className="p" role="status">{notice}</p>}
        <p className="p">Your cart is empty.</p>
        <Link className="btn" href="/shop/lamb">Shop the range</Link>
      </section>
    );
  }

  const { data: items } = await loadCatalogue({ category: 'produce' });
  const crossSell = items[0];

  return (
    <section>
      <h1>Cart</h1>
      {notice && <p className="p" role="status">{notice}</p>}

      {groups.map((g) => (
        <div key={g.temperature}>
          <h2>{g.heading}</h2>
          {g.note && <p className="p">{g.note}</p>}
          {g.lines.map((l) => (
            <article key={l.sku} className="card row">
              <span>{l.name}</span>
              <span className="row">
                <form action={updateCartQty} className="row">
                  <input type="hidden" name="sku" value={l.sku} />
                  <input
                    className="qty"
                    type="number"
                    name="qty"
                    min={0}
                    defaultValue={l.qty}
                    aria-label={`Quantity for ${l.name}`}
                  />
                  <button className="btn o" type="submit">Update</button>
                </form>
                <form action={removeFromCart}>
                  <input type="hidden" name="sku" value={l.sku} />
                  <button className="btn o" type="submit">Remove</button>
                </form>
                <strong>{formatRand(l.unitPriceExVatCents * l.qty)}</strong>
              </span>
            </article>
          ))}
        </div>
      ))}

      <SponsoredSlot slot="A7">Cross-sell: add charcoal</SponsoredSlot>

      <div className="row"><span>Subtotal</span><span>{formatRand(totals.subtotalExVatCents)}</span></div>
      <div className="row"><span>{delivery.label}</span><span>{formatRand(delivery.feeCents)}</span></div>
      <div className="row"><span>VAT (15%)</span><span>{formatRand(totals.vatCents)}</span></div>
      <div className="row"><strong>Total</strong><strong>{formatRand(totals.totalIncVatCents)}</strong></div>

      <div className="row"><span>Gift card or promo code</span><span>Apply</span></div>
      <Link className="btn" href="/checkout">Checkout</Link>

      {crossSell && (
        <div>
          <h2>You might need</h2>
          <ProductCard v={crossSell} sponsored redirectTo="/cart" />
        </div>
      )}
    </section>
  );
}
