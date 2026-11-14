// Wireframe: docs/wireframes/index.html#ad-orders
import { DEMO_ORDERS, orderStatusLabel } from '../../lib/seed';
import { queueCounts } from '../../lib/admin-view';

export default function OrdersPage() {
  const counts = queueCounts(DEMO_ORDERS.map((o) => o.status));

  return (
    <section>
      <h1>Orders</h1>
      <p className="p">Queues, pick lists, route assignment.</p>

      <div className="chips">
        <span className="chip">New {counts.new}</span>
        <span className="chip">Packing {counts.packing}</span>
        <span className="chip">Out {counts.out}</span>
        <span className="chip">Delivered {counts.delivered}</span>
      </div>

      <table className="tbl">
        <thead>
          <tr><th>Order</th><th>Customer</th><th>Slot</th><th>Status</th></tr>
        </thead>
        <tbody>
          {DEMO_ORDERS.map((order) => (
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
