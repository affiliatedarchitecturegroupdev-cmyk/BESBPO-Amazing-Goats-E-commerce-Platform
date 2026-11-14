// Wireframe: docs/wireframes/index.html#sf-cart
import Link from 'next/link';
import { ProductCard } from '../../components/ProductCard';
import { SponsoredSlot } from '../../components/FulfilmentTag';
import { cartTotals } from '../../lib/cart';
import { groupByFulfilment, deliveryLine } from '../../lib/cart-groups';
import { seedCart } from '../../lib/cart-seed';
import { getBySlug } from '../../lib/catalog';
import { formatRand } from '../../lib/format';

export default function CartPage() {
  const cart = seedCart();
  const groups = groupByFulfilment(cart.lines);
  const totals = cartTotals(cart);
  const delivery = deliveryLine(cart.zoneId, totals.deliveryFeeCents);
  const crossSell = getBySlug('v-spinach-bunch');

  return (
    <section>
      <h1>Cart</h1>

      {groups.map((g) => (
        <div key={g.temperature}>
          <h2>{g.heading}</h2>
          {g.note && <p className="p">{g.note}</p>}
          {g.lines.map((l) => (
            <article key={l.sku} className="card row">
              <span>{l.name}</span>
              <span>Qty {l.qty}</span>
              <strong>{formatRand(l.unitPriceExVatCents * l.qty)}</strong>
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
          <ProductCard v={crossSell} sponsored />
        </div>
      )}
    </section>
  );
}
