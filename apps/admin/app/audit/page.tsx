// Wireframe: docs/wireframes/index.html#ad-audit
import { loadAuditLog } from '../../lib/gateway';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  const { data: records, error } = await loadAuditLog();

  return (
    <section>
      <h1>Audit log</h1>
      <p className="p">Append-only record of every mutating request.</p>
      {error && <p className="p" role="alert">{error}</p>}

      {records.length === 0 && !error && <p className="p">No audit entries yet.</p>}

      <table className="tbl">
        <thead>
          <tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Approved by</th></tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={`${r.at}-${i}`}>
              <td>{r.at}</td>
              <td>{r.actorUserId ?? '—'}</td>
              <td>{r.action}</td>
              <td>{r.entity}{r.entityId ? ` · ${r.entityId}` : ''}</td>
              <td>{r.approvedBy ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
