// Wireframe: docs/wireframes/index.html#ad-ads
import { loadAdReport } from '../../lib/gateway';

export const dynamic = 'force-dynamic';

export default async function AdsPage() {
  const { data: report, error } = await loadAdReport();

  return (
    <section>
      <h1>Ads</h1>
      <p className="p">Retail media: campaigns, creatives and review. Human review before go-live.</p>
      {error && <p className="p" role="alert">{error}</p>}

      <div className="kpis">
        <article className="card kpi"><strong>{report.impressions.toLocaleString('en-ZA')}</strong><span className="p">Impressions</span></article>
        <article className="card kpi"><strong>{report.clicks.toLocaleString('en-ZA')}</strong><span className="p">Clicks</span></article>
        <article className="card kpi"><strong>{report.clickThroughPct}%</strong><span className="p">Click-through</span></article>
      </div>

      <h2>By creative</h2>
      {report.rows && report.rows.length > 0 ? (
        <table className="tbl">
          <thead><tr><th>Creative</th><th>Impressions</th><th>Clicks</th></tr></thead>
          <tbody>
            {report.rows.map((r) => (
              <tr key={r.creativeId}>
                <td>{r.creativeId}</td>
                <td>{r.impressions.toLocaleString('en-ZA')}</td>
                <td>{r.clicks.toLocaleString('en-ZA')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="p">No creative activity yet.</p>
      )}

      <a className="btn btn-outline" href="#review">Review queue</a>
    </section>
  );
}
