import { DEMO_CYCLES } from '../../lib/seed';
import { cycleCapacityPct, shouldEarlyClose } from '../../lib/admin-view';

export default function CyclesPage() {
  const earlyCloseRule = true;

  return (
    <section>
      <h1>Cut-off cycles</h1>
      <p className="p">Cycle manager: capacity, cut-off, top-up, early close.</p>

      <table className="tbl">
        <thead>
          <tr><th>Cycle</th><th>Cut-off</th><th>Trade lock</th><th>Top-up</th><th>Capacity</th><th>Status</th></tr>
        </thead>
        <tbody>
          {DEMO_CYCLES.map((cycle) => {
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
