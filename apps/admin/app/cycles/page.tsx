import { cycleCapacityPct, shouldEarlyClose, toCycleRow } from '../../lib/admin-view';
import { loadCycles, loadOrders } from '../../lib/gateway';

export const dynamic = 'force-dynamic';

export default async function CyclesPage() {
  const [{ data: cycles, error }, { data: orders }] = await Promise.all([loadCycles(), loadOrders()]);
  const earlyCloseRule = true;
  // How full each cycle is, counted from the orders the gateway returned.
  const filledByCycle = orders.reduce<Record<string, number>>((acc, o) => {
    if (o.cycleId) acc[o.cycleId] = (acc[o.cycleId] ?? 0) + 1;
    return acc;
  }, {});
  const capacity = 1000;
  const rows = cycles.map((c) => toCycleRow(c, filledByCycle[c.id] ?? 0, capacity));

  return (
    <section>
      <h1>Cut-off cycles</h1>
      <p className="p">Cycle manager: capacity, cut-off, top-up, early close.</p>
      {error && <p className="p" role="alert">{error}</p>}

      <table className="tbl">
        <thead>
          <tr><th>Cycle</th><th>Cut-off</th><th>Trade lock</th><th>Top-up</th><th>Capacity</th><th>Status</th></tr>
        </thead>
        <tbody>
          {rows.map((cycle) => {
            const pct = cycleCapacityPct(cycle.filled, cycle.capacity);
            const full = shouldEarlyClose(cycle.status, cycle.filled, cycle.capacity, earlyCloseRule);
            return (
              <tr key={cycle.id}>
                <td>{cycle.label}</td>
                <td>{cycle.cutoffAt}</td>
                <td>{cycle.tradeLockAt ?? ''}</td>
                <td>{cycle.topUpUntil ?? ''}</td>
                <td>{pct}%</td>
                <td>
                  <span className={full ? 'tag tag-watch' : 'tag'}>{full ? 'Closing' : cycle.statusLabel}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="row">
        <span>Early close when full</span>
        <span className="tag">On</span>
      </div>

      <button className="btn" type="button">Close cycle now</button>
      <a className="btn btn-outline" href="#po">Create purchase orders and pick lists</a>
    </section>
  );
}
