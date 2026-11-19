// Wireframe: docs/wireframes/index.html#sf-checkout
import Link from 'next/link';
import { cartTotals, hasReservation, toOrderLines } from '../../lib/cart';
import { cartSession } from '../../lib/cart-session';
import { paymentOptions, totalWithDiscount, TRADE_NOTE } from '../../lib/payments';
import { formatRand } from '../../lib/format';
import { placeOrder } from './actions';
import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata({
  title: 'Checkout',
  description: 'Check out your Amazing Goats order.',
  path: '/checkout',
  noindex: true,
});

// The checkout reads the cart cookie and posts through a server action.
export const dynamic = 'force-dynamic';

export default async function CheckoutPage({ searchParams }: { searchParams: { error?: string } }) {
  const cart = cartSession();
  if (cart.lines.length === 0) {
    return (
      <section>
        <h1>Checkout</h1>
        <p className="p">Your cart is empty, so there is nothing to check out.</p>
        <Link className="btn" href="/shop/lamb">Shop the range</Link>
      </section>
    );
  }
  const totals = cartTotals(cart);
  const options = paymentOptions(totals.totalIncVatCents, { hasReservation: hasReservation(cart.lines) });
  const lines = JSON.stringify(toOrderLines(cart.lines));

  return (
    <section>
      <h1>Checkout</h1>

      {searchParams.error && <p className="p" role="alert">{searchParams.error}</p>}

      <h2>1 Contact</h2>
      <div className="fld">Guest or sign in · phone · email</div>

      <h2>2 Delivery</h2>
      <div className="fld">Address · zone check · slot</div>

      <h2>3 Payment</h2>
      {options.map((o) => {
        const due = totalWithDiscount(totals.totalIncVatCents, o);
        return (
          <article key={o.method} className="card row">
            <span>
              <strong>{o.label}</strong>
              {o.recommended && <span className="tag"> Recommended</span>}
              <br />
              <small>{o.detail}</small>
            </span>
            <span>
              {formatRand(due)}
              {o.discountCents ? <small> (save {formatRand(o.discountCents)})</small> : null}
            </span>
          </article>
        );
      })}

      <h2>4 Review</h2>
      <div className="row"><span>Total</span><strong>{formatRand(totals.totalIncVatCents)}</strong></div>

      {/* The CPA requires the terms to be available before payment, so the
          consent sits with the button rather than on a page a shopper may never
          visit. `required` makes the browser refuse a submit without it. */}
      <p className="p">
        <label>
          <input type="checkbox" name="acceptTerms" value="yes" required /> I accept the{' '}
          <a href="/terms" target="_blank" rel="noopener">terms of sale</a> and have read the{' '}
          <a href="/privacy" target="_blank" rel="noopener">privacy notice</a>.
        </label>
      </p>
      <p className="p">
        Perishable items cannot be cancelled after the cut-off, because they are bought and
        slaughtered to your order. You can change or cancel free of charge until then — see the{' '}
        <a href="/returns" target="_blank" rel="noopener">returns policy</a>.
      </p>

      <form action={placeOrder}>
        <input type="hidden" name="lines" value={lines} />
        <input type="hidden" name="deliveryFeeCents" value={String(totals.deliveryFeeCents)} />
        <input type="hidden" name="zoneId" value={String(cart.zoneId ?? '')} />
        <button className="btn" type="submit">Place order</button>
      </form>

      <p className="p">{TRADE_NOTE}</p>
    </section>
  );
}
