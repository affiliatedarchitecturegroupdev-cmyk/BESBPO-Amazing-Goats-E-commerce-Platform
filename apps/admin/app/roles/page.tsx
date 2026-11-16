// Wireframe: docs/wireframes/index.html#ad-roles
import { ROLES } from '@ag/rbac';
import { CAPABILITIES, roleMatrix } from '../../lib/access-view';
import { requestElevation } from './actions';

export default function RolesPage({ searchParams }: { searchParams: { error?: string; requested?: string } }) {
  const rows = roleMatrix([...ROLES]);

  return (
    <section>
      <h1>Roles and access</h1>
      <p className="p">Matrix of roles and permissions. Changes need a second approver.</p>

      {searchParams.error && <p className="p" role="alert">Could not request elevation ({searchParams.error}).</p>}
      {searchParams.requested && <p className="p">Elevation requested. It needs approval before it takes effect.</p>}

      <table className="tbl">
        <thead>
          <tr>
            <th>Role</th>
            {CAPABILITIES.map((cap) => (
              <th key={cap.key}>{cap.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.role}>
              <td>{row.label}</td>
              {row.cells.map((cell, i) => (
                <td key={CAPABILITIES[i].key}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="p">W write · A approve · R read only · W+A write and approve.</p>

      <form action={requestElevation} className="card">
        <h2>Request elevation (time limited)</h2>
        <label className="fld">Subject<input name="subjectId" required /></label>
        <label className="fld">Role<input name="role" required /></label>
        <label className="fld">Reason<input name="reason" required /></label>
        <label className="fld">Minutes<input name="minutes" type="number" defaultValue={30} /></label>
        <button className="btn" type="submit">Request elevation</button>
      </form>
      <p className="p">Break-glass use alerts the board.</p>
    </section>
  );
}
