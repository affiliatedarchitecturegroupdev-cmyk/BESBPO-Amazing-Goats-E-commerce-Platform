// Wireframe: docs/wireframes/index.html#ad-routes
import { toRouteRow } from '../../lib/admin-view';
import { loadRoutes } from '../../lib/gateway';

export const dynamic = 'force-dynamic';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default async function RoutesPage() {
  const { data: routes, error } = await loadRoutes();

  return (
    <section>
      <h1>Routes and slots</h1>
      <p className="p">Vehicles, capacity and delivery days.</p>
      {error && <p className="p" role="alert">{error}</p>}

      <table className="tbl">
        <thead>
          <tr><th>Route</th><th>Day</th><th>Vehicle</th><th>Capacity (boxes)</th></tr>
        </thead>
        <tbody>
          {routes.map((route) => {
            const row = toRouteRow(route);
            return (
              <tr key={route.id}>
                <td>{row.route}</td>
                <td>{DAYS[route.dayOfWeek] ?? '—'}</td>
                <td>{row.vehicle}</td>
                <td>{route.capacityBoxes ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <a className="btn btn-outline" href="#slots">Manage delivery slots</a>
    </section>
  );
}
