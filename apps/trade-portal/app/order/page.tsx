// Wireframe: docs/wireframes/index.html#tp-order
import { formatRand } from '../../lib/format';
import { loadCatalogue } from '../../lib/gateway';

export const dynamic = 'force-dynamic';

export default async function OrderPage() {
  const { data: items, error } = await loadCatalogue();
  const totalExVatCents = items.reduce((sum, line) => sum + (line.priceCents ?? 0), 0);

  return (
    <section>
      <p className="bar">Trade order <span className="tag">Cut-off Sun</span></p>
      {error && <p className="p" role="alert">{error}</p>}

      <ul className="chips">
        <li className="on">By code</li>
        <li>Upload CSV</li>
        <li>Lamb</li>
        <li>Eggs</li>
        <li>Dairy</li>
      </ul>

      {items.map((line) => (
        <div key={line.sku} className="row">
          <span>{line.sku} {line.name}</span>
          <span>{line.priceCents != null ? formatRand(line.priceCents) : 'R ---'}</span>
        </div>
      ))}

      <div className="row"><strong>Order total (ex VAT)</strong><strong>{formatRand(totalExVatCents)}</strong></div>

      <button className="btn" type="button">Place order on account</button>
      <button className="btn" type="button">Save as standing order</button>
    </section>
  );
}
