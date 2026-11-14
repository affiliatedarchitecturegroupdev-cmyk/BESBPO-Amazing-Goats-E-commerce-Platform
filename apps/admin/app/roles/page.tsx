// Wireframe: docs/wireframes/index.html#ad-roles
import { ROLES } from '@ag/rbac';
import { CAPABILITIES, roleMatrix } from '../../lib/access-view';

export default function RolesPage() {
  const rows = roleMatrix([...ROLES]);

  return (
    <section>
      <h1>Roles and access</h1>
      <p className="p">Matrix of roles and permissions. Changes need a second approver.</p>

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
      <button className="btn" type="button">Request elevation (time limited)</button>
      <p className="p">Break-glass use alerts the board.</p>
    </section>
  );
}
