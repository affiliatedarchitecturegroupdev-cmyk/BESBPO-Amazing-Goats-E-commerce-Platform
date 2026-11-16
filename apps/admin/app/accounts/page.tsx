// Wireframe: docs/wireframes/index.html#ad-accounts
import { formatRand } from '../../lib/format';
import { loadInvoices } from '../../lib/gateway';

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const { data: invoices, error } = await loadInvoices();

  return (
    <section>
      <h1>Trade accounts</h1>
      <p className="p">Invoices and their settlement state.</p>
      {error && <p className="p" role="alert">{error}</p>}

      {invoices.length === 0 && !error && <p className="p">No invoices yet.</p>}

      <table className="tbl">
        <thead>
          <tr><th>Invoice</th><th>Org</th><th>Issued</th><th>Due</th><th>Total</th><th>Status</th></tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id}>
              <td>{inv.number}</td>
              <td>{inv.orgId}</td>
              <td>{inv.issuedOn}</td>
              <td>{inv.dueOn}</td>
              <td>{formatRand(inv.totalIncVatCents)}</td>
              <td><span className={inv.status === 'paid' ? 'tag' : 'tag tag-watch'}>{inv.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
