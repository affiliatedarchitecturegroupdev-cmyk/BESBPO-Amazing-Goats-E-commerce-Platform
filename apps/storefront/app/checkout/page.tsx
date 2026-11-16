// Wireframe: docs/wireframes/index.html#sf-checkout
import { cartTotals, hasReservation, toOrderLines } from '../../lib/cart';
import { cartSession } from '../../lib/cart-session';
import { paymentOptions, totalWithDiscount, TRADE_NOTE } from '../../lib/payments';
import { formatRand } from '../../lib/format';
import { placeOrder } from './actions';

// The checkout reads the cart cookie and posts through a server action.
export const dynamic = 'force-dynamic';

export default async function CheckoutPage({ searchParams }: { searchParams: { error?: string } }) {
  const cart = cartSession();
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
      <div className="fld">Summary · VAT invoice · terms and privacy consent</div>
      <div className="row"><span>Total</span><strong>{formatRand(totals.totalIncVatCents)}</strong></div>

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
