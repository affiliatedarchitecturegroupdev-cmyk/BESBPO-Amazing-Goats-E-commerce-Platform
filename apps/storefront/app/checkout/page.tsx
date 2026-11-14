// Wireframe: docs/wireframes/index.html#sf-checkout
import { cartTotals, hasReservation } from '../../lib/cart';
import { seedCart } from '../../lib/cart-seed';
import { paymentOptions, totalWithDiscount, TRADE_NOTE } from '../../lib/payments';
import { formatRand } from '../../lib/format';

export default function CheckoutPage() {
  const cart = seedCart();
  const totals = cartTotals(cart);
  const options = paymentOptions(totals.totalIncVatCents, { hasReservation: hasReservation(cart.lines) });

  return (
    <section>
      <h1>Checkout</h1>

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

      <button className="btn" type="button">Place order</button>

      <p className="p">{TRADE_NOTE}</p>
    </section>
  );
}
