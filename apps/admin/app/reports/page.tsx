// Wireframe: docs/wireframes/index.html#ad-reports
import { loadAdReport, loadKpis } from '../../lib/gateway';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const [{ data: report, error }, { data: kpis, error: kpiError }] = await Promise.all([loadAdReport(), loadKpis()]);

  return (
    <section>
      <h1>Reports</h1>
      <p className="p">Warehouse-backed KPIs and retail-media totals.</p>
      {error && <p className="p" role="alert">{error}</p>}
      {kpiError && <p className="p" role="alert">{kpiError}</p>}

      <h2>Financial KPIs</h2>
      <div className="kpis">
        <article className="card kpi"><strong>{kpis.dso}</strong><span className="p">Days sales outstanding</span></article>
        <article className="card kpi"><strong>{kpis.bad_debt_pct}%</strong><span className="p">Bad-debt rate</span></article>
        <article className="card kpi"><strong>{kpis.gross_margin_pct}%</strong><span className="p">Gross margin</span></article>
      </div>

      <h2>Retail media</h2>
      <div className="kpis">
        <article className="card kpi"><strong>{report.impressions.toLocaleString('en-ZA')}</strong><span className="p">Impressions</span></article>
        <article className="card kpi"><strong>{report.clicks.toLocaleString('en-ZA')}</strong><span className="p">Clicks</span></article>
        <article className="card kpi"><strong>{report.clickThroughPct}%</strong><span className="p">Click-through</span></article>
      </div>

      <button className="btn" type="button">Export CSV</button>
    </section>
  );
}
