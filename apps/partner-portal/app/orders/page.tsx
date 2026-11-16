// Wireframe: docs/wireframes/index.html#pt-orders
import { orderStatusLabel } from '../../lib/portal-view';
import { loadPurchaseOrders } from '../../lib/gateway';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const { data: orders, error } = await loadPurchaseOrders();

  return (
    <section>
      <h1>Purchase orders</h1>
      <p className="p">Farm sees purchase orders and grades.</p>
      {error && <p className="p" role="alert">{error}</p>}

      {orders.length === 0 && !error && <p className="p">No purchase orders yet.</p>}

      {orders.map((order) => (
        <article key={order.id} className="card row">
          <div>
            <b>{order.code}</b>
            <br />
            <small>{order.description} · {order.date}{order.grades ? ` · grades: ${order.grades}` : ''}</small>
          </div>
          <span className="tag">{orderStatusLabel(order.status)}</span>
        </article>
      ))}

      <button className="btn" type="button">Upload grading sheet</button>
    </section>
  );
}
