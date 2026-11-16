// Wireframe: docs/wireframes/index.html#av-wallet
import { formatRand } from '../../lib/format';
import { loadWallet } from '../../lib/gateway';

export const dynamic = 'force-dynamic';

export default async function WalletPage() {
  const { data: wallet, error } = await loadWallet();

  return (
    <section>
      <h1>Wallet</h1>
      <p className="p">Prepaid wallet through the payment aggregators.</p>
      {error && <p className="p" role="alert">{error}</p>}

      <article className="card row">
        <strong>Balance</strong>
        <span>{formatRand(wallet?.balanceCents ?? 0)}</span>
      </article>

      <div className="row">
        <button className="btn" type="button">Top up</button>
      </div>

      <table className="tbl">
        <thead>
          <tr><th>Date</th><th>Item</th><th>Amount</th></tr>
        </thead>
        <tbody>
          {(wallet?.ledger ?? []).map((e) => (
            <tr key={e.id}>
              <td>{e.at.slice(0, 10)}</td>
              <td>{e.kind}</td>
              <td>{formatRand(e.amountCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
