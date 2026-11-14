// Wireframe: docs/wireframes/index.html#pt-orders
import { DEMO_ORDERS, orderStatusLabel } from '../../lib/portal-view';

export default function OrdersPage() {
  return (
    <section>
      <h1>Purchase orders</h1>
      <p className="p">Farm sees purchase orders and grades.</p>

      {DEMO_ORDERS.map((order) => (
        <article key={order.id} className="card row">
          <div>
            <b>{order.code}</b>
            <br />
            <small>{order.description} · {order.date}</small>
          </div>
          <span className="tag">{orderStatusLabel(order.status)}</span>
        </article>
      ))}

      <button className="btn" type="button">Upload grading sheet</button>
    </section>
  );
}
