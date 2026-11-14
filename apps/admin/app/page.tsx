// Wireframe: docs/wireframes/index.html#ad-dashboard
import { DEMO_KPIS, DEMO_ALERTS, DEMO_ROUTES } from '../lib/seed';

export default function HomePage() {
  return (
    <section>
      <h1>Dashboard</h1>

      <div className="kpis">
        {DEMO_KPIS.map((kpi) => (
          <article key={kpi.label} className="card kpi">
            <strong>{kpi.value}</strong>
            <span className="p">{kpi.label}</span>
          </article>
        ))}
      </div>

      <h2>Alerts</h2>
      {DEMO_ALERTS.map((alert) => (
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
          {DEMO_ROUTES.map((route) => (
            <tr key={route.route}>
              <td>{route.route}</td>
              <td>{route.vehicle}</td>
              <td>{route.stops}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
