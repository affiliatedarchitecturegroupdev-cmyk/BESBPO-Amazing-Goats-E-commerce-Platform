// Wireframe: docs/wireframes/index.html#ad-partners
import { loadRoutes } from '../../lib/gateway';

export const dynamic = 'force-dynamic';

export default async function PartnersPage() {
  const { data: routes, error } = await loadRoutes();

  return (
    <section>
      <h1>Partners</h1>
      <p className="p">Farms, abattoirs and pack stations that fulfil routes.</p>
      {error && <p className="p" role="alert">{error}</p>}

      <table className="tbl">
        <thead>
          <tr><th>Route</th><th>Vehicle</th><th>Capacity (boxes)</th></tr>
        </thead>
        <tbody>
          {routes.map((route) => (
            <tr key={route.id}>
              <td>{route.name}</td>
              <td>{route.vehicleId ?? '—'}</td>
              <td>{route.capacityBoxes ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
