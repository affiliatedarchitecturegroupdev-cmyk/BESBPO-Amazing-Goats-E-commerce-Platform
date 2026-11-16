// Wireframe: docs/wireframes/index.html#ad-recalls
import { loadRecalls } from '../../lib/gateway';

export const dynamic = 'force-dynamic';

export default async function RecallsPage() {
  const { data: recalls, error } = await loadRecalls();

  return (
    <section>
      <h1>Recalls</h1>
      <p className="p">Traceability and withdrawal. Every recall is opened against a batch.</p>
      {error && <p className="p" role="alert">{error}</p>}

      {recalls.length === 0 && !error && <p className="p">No open recalls.</p>}

      <table className="tbl">
        <thead>
          <tr><th>Recall</th><th>Batch</th><th>Reason</th><th>Opened</th><th>Affected orders</th><th>Status</th></tr>
        </thead>
        <tbody>
          {recalls.map((recall) => (
            <tr key={recall.id}>
              <td>{recall.id}</td>
              <td>{recall.batchId}</td>
              <td>{recall.reason}</td>
              <td>{recall.openedAt}</td>
              <td>{recall.affectedOrderIds.length}</td>
              <td><span className={recall.closedAt ? 'tag' : 'tag tag-watch'}>{recall.closedAt ? 'Closed' : 'Open'}</span></td>
            </tr>
          ))}
        </tbody>
      </table>

      <button className="btn" type="button">Open recall</button>
    </section>
  );
}
