// Wireframe: docs/wireframes/index.html#av-wallet
import { DEMO_WALLET } from '../../lib/seed';

function rand(cents: number): string {
  if (!cents) return 'R ---';
  return `R${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function WalletPage() {
  const balance = DEMO_WALLET.reduce((sum, e) => sum + e.amountCents, 0);
  return (
    <section>
      <h1>Wallet</h1>
      <p className="p">Prepaid wallet through the payment aggregators.</p>

      <article className="card row">
        <strong>Balance</strong>
        <span>{rand(balance)}</span>
      </article>

      <div className="row">
        <button className="btn" type="button">Top up</button>
      </div>

      <table className="tbl">
        <thead>
          <tr><th>Date</th><th>Item</th><th>Amount</th></tr>
        </thead>
        <tbody>
          {DEMO_WALLET.map((e) => (
            <tr key={`${e.date}-${e.item}`}>
              <td>{e.date}</td>
              <td>{e.item}</td>
              <td>{rand(e.amountCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
