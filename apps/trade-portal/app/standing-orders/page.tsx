// Wireframe: docs/wireframes/index.html#tp-standing
import { DEMO_STANDING_ORDERS } from '../../lib/fixtures';

// Standing orders have no endpoint yet; this reads the fixture until they do.
export default function StandingOrdersPage() {
  return (
    <section>
      <p className="bar">Standing orders</p>

      <table className="tbl">
        <thead>
          <tr><th>Day</th><th>Items</th><th /></tr>
        </thead>
        <tbody>
          {DEMO_STANDING_ORDERS.map((order) => (
            <tr key={order.day}>
              <td>{order.day}</td>
              <td>{order.items}</td>
              <td><button className="btn" type="button">Edit</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="chips">
        <li>Pause a week</li>
        <li>Skip a delivery</li>
      </ul>
      <p className="p">Standing orders lock at the cut-off. At 14 days past due the account is held and standing orders pause.</p>
    </section>
  );
}
