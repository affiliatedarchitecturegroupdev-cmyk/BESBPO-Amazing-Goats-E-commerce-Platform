// Wireframe: docs/wireframes/index.html#av-dashboard
import Link from 'next/link';
import { campaignTag } from '../lib/campaign-form';
import { loadCampaigns } from '../lib/gateway';

export const dynamic = 'force-dynamic';

function rand(cents: number): string {
  if (!cents) return 'R ---';
  return `R${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function HomePage({ searchParams }: { searchParams: { created?: string } }) {
  const { data: campaigns, error } = await loadCampaigns();
  const spend = campaigns.reduce((sum, c) => sum + c.spentCents, 0);

  return (
    <section>
      <div className="row">
        <h1>Campaigns</h1>
        <Link className="btn" href="/campaigns/new">New campaign</Link>
      </div>
      <p className="p">Own campaigns only.</p>

      {searchParams.created && <p className="p">Campaign {searchParams.created} submitted for review.</p>}
      {error && <p className="p" role="alert">{error}</p>}

      <div className="kpi">
        <article className="card"><b>R ---</b>Impressions</article>
        <article className="card"><b>R ---</b>Clicks</article>
        <article className="card"><b>{rand(spend)}</b>Spend</article>
        <article className="card"><b>R ---</b>Attributed sales</article>
      </div>

      <h2>Your campaigns</h2>
      {campaigns.length === 0 && !error && <p className="p">No campaigns yet.</p>}

      <table className="tbl">
        <thead>
          <tr><th>Campaign</th><th>Goal</th><th>Status</th></tr>
        </thead>
        <tbody>
          {campaigns.map((c) => {
            const tag = campaignTag(c.status);
            return (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.goal}</td>
                <td><span className={`tag${tag.tone === 'ok' ? ' tag-ok' : tag.tone === 'watch' ? ' tag-watch' : ''}`}>{tag.label}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
