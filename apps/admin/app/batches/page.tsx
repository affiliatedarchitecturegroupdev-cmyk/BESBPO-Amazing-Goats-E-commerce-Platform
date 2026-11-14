// Wireframe: docs/wireframes/index.html#ad-batches
import { DEMO_BATCHES } from '../../lib/seed';
import { batchTag, temperatureLabel } from '../../lib/admin-view';

export default function BatchesPage() {
  return (
    <section>
      <h1>Stock and batches</h1>
      <p className="p">Traceability record per batch.</p>

      <table className="tbl">
        <thead>
          <tr><th>Batch</th><th>Product</th><th>Slaughter</th><th>Use by</th><th>Temp</th><th>Status</th></tr>
        </thead>
        <tbody>
          {DEMO_BATCHES.map((batch) => {
            const tag = batchTag(batch);
            return (
              <tr key={batch.id}>
                <td>{batch.batchCode}</td>
                <td>{batch.product}</td>
                <td>{batch.slaughteredOn ?? ''}</td>
                <td>{batch.useBy ?? ''}</td>
                <td>{temperatureLabel(batch.temperatureStatus)}</td>
                <td><span className={tag.tone === 'watch' ? 'tag tag-watch' : 'tag'}>{tag.label}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="fld">Source farm · abattoir · weight · grade · halaal</div>
      <button className="btn" type="button">Add batch</button>
    </section>
  );
}
