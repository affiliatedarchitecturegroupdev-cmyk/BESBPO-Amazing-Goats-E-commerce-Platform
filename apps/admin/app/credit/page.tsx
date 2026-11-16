// Wireframe: docs/wireframes/index.html#ad-credit
import { loadCollections, loadInvoices } from '../../lib/gateway';

export const dynamic = 'force-dynamic';

export default async function CreditPage() {
  const [{ data: collections, error }, { data: invoices }] = await Promise.all([loadCollections(), loadInvoices()]);
  const open = invoices.filter((i) => i.status === 'open');

  return (
    <section>
      <h1>Credit control</h1>
      <p className="p">Dunning steps and the open book.</p>
      {error && <p className="p" role="alert">{error}</p>}

      <div className="kpis">
        <article className="card kpi"><strong>{open.length}</strong><span className="p">Open invoices</span></article>
        <article className="card kpi"><strong>{collections.length}</strong><span className="p">Dunning steps</span></article>
      </div>

      <h2>Collections</h2>
      {collections.length === 0 && !error && <p className="p">No collection actions scheduled.</p>}
      <table className="tbl">
        <thead>
          <tr><th>Invoice</th><th>Step</th><th>Scheduled</th><th>Done</th></tr>
        </thead>
        <tbody>
          {collections.map((c) => (
            <tr key={c.id}>
              <td>{c.invoiceId}</td>
              <td>{c.step}</td>
              <td>{c.scheduledAt}</td>
              <td>{c.doneAt ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
