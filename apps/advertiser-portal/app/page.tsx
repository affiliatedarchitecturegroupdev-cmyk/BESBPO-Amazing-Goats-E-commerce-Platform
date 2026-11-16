// Wireframe: docs/wireframes/index.html#av-dashboard
import Link from 'next/link';
import { campaignTag } from '../lib/campaign-form';
import { DEMO_CAMPAIGNS } from '../lib/seed';

function rand(cents: number): string {
  if (!cents) return 'R ---';
  return `R${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function HomePage() {
  const impressions = DEMO_CAMPAIGNS.reduce((sum, c) => sum + c.impressions, 0);
  const clicks = DEMO_CAMPAIGNS.reduce((sum, c) => sum + c.clicks, 0);
  const spend = DEMO_CAMPAIGNS.reduce((sum, c) => sum + c.spentCents, 0);

  return (
    <section>
      <div className="row">
        <h1>Campaigns</h1>
        <Link className="btn" href="/campaigns/new">New campaign</Link>
      </div>
      <p className="p">Own campaigns only.</p>

      <div className="kpi">
        <article className="card"><b>{impressions.toLocaleString('en-ZA')}</b>Impressions</article>
        <article className="card"><b>{clicks.toLocaleString('en-ZA')}</b>Clicks</article>
        <article className="card"><b>{rand(spend)}</b>Spend</article>
        <article className="card"><b>R ---</b>Attributed sales</article>
      </div>

      <h2>Your campaigns</h2>
      <table className="tbl">
        <thead>
          <tr><th>Campaign</th><th>Slot</th><th>Status</th></tr>
        </thead>
        <tbody>
          {DEMO_CAMPAIGNS.map((c) => {
            const tag = campaignTag(c.status);
            return (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.slot}</td>
                <td><span className={`tag${tag.tone === 'ok' ? ' tag-ok' : tag.tone === 'watch' ? ' tag-watch' : ''}`}>{tag.label}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
