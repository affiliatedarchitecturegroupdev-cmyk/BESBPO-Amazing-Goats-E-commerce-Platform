// Wireframe: docs/wireframes/index.html#tp-team
import { DEMO_TEAM } from '../../lib/fixtures';

// Team and approvals have no endpoint yet; this reads the fixture until they do.
export default function TeamPage() {
  return (
    <section>
      <p className="bar">Team and approvals</p>

      <table className="tbl">
        <thead>
          <tr><th>Name</th><th>Role</th><th>Limits</th></tr>
        </thead>
        <tbody>
          {DEMO_TEAM.map((member) => (
            <tr key={member.name}>
              <td>{member.name}</td>
              <td>{member.role}</td>
              <td>{member.detail || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <button className="btn" type="button">Invite a user</button>
      <p className="p">Buyers order within their limit; accounts users see invoices only.</p>
    </section>
  );
}
