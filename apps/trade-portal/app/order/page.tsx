// Wireframe: docs/wireframes/index.html#tp-order
import { formatRand } from '../../lib/format';

const CATALOGUE = [
  { code: 'AG-LB-001', name: 'Lamb carcass', qty: 2, priceCents: 0 },
  { code: 'AG-EG-003', name: 'Eggs XL tray', qty: 20, priceCents: 0 },
];

export default function OrderPage() {
  const totalExVatCents = CATALOGUE.reduce((sum, line) => sum + line.qty * line.priceCents, 0);
  return (
    <section>
      <p className="bar">Trade order <span className="tag">Cut-off Sun</span></p>

      <ul className="chips">
        <li className="on">By code</li>
        <li>Upload CSV</li>
        <li>Lamb</li>
        <li>Eggs</li>
        <li>Dairy</li>
      </ul>

      {CATALOGUE.map((line) => (
        <div key={line.code} className="row">
          <span>{line.code} {line.name}</span>
          <span>{line.qty}</span>
        </div>
      ))}

      <div className="row"><strong>Order total (ex VAT)</strong><strong>{formatRand(totalExVatCents)}</strong></div>

      <button className="btn" type="button">Place order on account</button>
      <button className="btn" type="button">Save as standing order</button>
    </section>
  );
}
