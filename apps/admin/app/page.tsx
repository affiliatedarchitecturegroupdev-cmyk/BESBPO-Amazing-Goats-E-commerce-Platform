// Wireframe: docs/wireframes/index.html#ad-dashboard
import { deriveAlerts, toBatchRow, toOrderRow, toRouteRow } from '../lib/admin-view';
import { loadBatches, loadCycles, loadOrders, loadRoutes } from '../lib/gateway';

// Live data from the gateway: render per request.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [{ data: orders, error }, { data: cycles }, { data: batches }, { data: routes }] = await Promise.all([
    loadOrders(),
    loadCycles(),
    loadBatches(),
    loadRoutes(),
  ]);

  const orderRows = orders.map(toOrderRow);
  const batchRows = batches.map(toBatchRow);
  const alerts = deriveAlerts(batchRows, orderRows);
  const kpis = [
    { value: String(orderRows.length), label: 'Orders today' },
    { value: String(cycles.length), label: 'Open cycles' },
    { value: String(batchRows.filter((b) => b.status === 'released').length), label: 'Batches released' },
    { value: 'R ---', label: 'Revenue today' },
  ];

  return (
    <section>
      <h1>Dashboard</h1>
      {error && <p className="p" role="alert">{error}</p>}

      <div className="kpis">
        {kpis.map((kpi) => (
          <article key={kpi.label} className="card kpi">
            <strong>{kpi.value}</strong>
            <span className="p">{kpi.label}</span>
          </article>
        ))}
      </div>

      <h2>Alerts</h2>
      {alerts.length === 0 && <p className="p">Nothing needs attention.</p>}
      {alerts.map((alert) => (
        <article key={alert.title} className="card row">
          <span>{alert.title}</span>
          <a className="btn btn-outline" href="#alerts">{alert.action}</a>
        </article>
      ))}

      <h2>Today routes</h2>
      <table className="tbl">
        <thead>
          <tr><th>Route</th><th>Vehicle</th><th>Stops</th></tr>
        </thead>
        <tbody>
          {routes.map((route) => {
            const row = toRouteRow(route);
            return (
              <tr key={row.route}>
                <td>{row.route}</td>
                <td>{row.vehicle}</td>
                <td>{row.stops}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
