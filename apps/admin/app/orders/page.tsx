// Wireframe: docs/wireframes/index.html#ad-orders
import { queueCounts, toOrderRow } from '../../lib/admin-view';
import { loadOrders } from '../../lib/gateway';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const { data: orders, error } = await loadOrders();
  const rows = orders.map(toOrderRow);
  const counts = queueCounts(rows.map((o) => o.status));

  return (
    <section>
      <h1>Orders</h1>
      <p className="p">Queues, pick lists, route assignment.</p>
      {error && <p className="p" role="alert">{error}</p>}

      <div className="chips">
        <span className="chip">New {counts.new}</span>
        <span className="chip">Packing {counts.packing}</span>
        <span className="chip">Out {counts.out}</span>
        <span className="chip">Delivered {counts.delivered}</span>
      </div>

      {rows.length === 0 && !error && <p className="p">No orders yet.</p>}

      <table className="tbl">
        <thead>
          <tr><th>Order</th><th>Customer</th><th>Slot</th><th>Status</th></tr>
        </thead>
        <tbody>
          {rows.map((order) => (
            <tr key={order.id}>
              <td>{order.id}</td>
              <td>{order.customer}</td>
              <td>{order.slot}</td>
              <td><span className="tag">{order.statusLabel}</span></td>
            </tr>
          ))}
        </tbody>
      </table>

      <button className="btn" type="button">Print pick lists</button>
      <a className="btn btn-outline" href="#route">Assign to route</a>
    </section>
  );
}
