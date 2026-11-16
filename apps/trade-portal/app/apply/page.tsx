// Wireframe: docs/wireframes/index.html#tp-apply
import {
  BUSINESS_TYPES,
  REQUIRED_DOCUMENTS,
  applicationProgress,
  documentLabel,
  documentTag,
  progressPct,
  requiresNcaReview,
  turnoverBand,
  validate,
} from '../../lib/application';
import { DEMO_APPLICATION } from '../../lib/fixtures';
import { formatRand } from '../../lib/format';
import { submitApplication } from './actions';

export const dynamic = 'force-dynamic';

export default function ApplyPage({ searchParams }: { searchParams: { submitted?: string; error?: string } }) {
  const form = DEMO_APPLICATION;
  const progress = applicationProgress(form);
  const { problems } = validate(form);
  const ncaReview = requiresNcaReview(form.turnoverDeclaredCents);
  const pct = progressPct(progress);

  return (
    <section>
      <p className="bar">Trade account <span>Step {progress.step} of {progress.of}</span></p>
      <meter value={pct} min={0} max={100}>{pct}%</meter>

      {searchParams.submitted && <p className="p" role="status">Application submitted. We will review it shortly.</p>}
      {searchParams.error && <p className="p" role="alert">{searchParams.error}</p>}

      <h2>Business</h2>
      <ul className="chips">
        {BUSINESS_TYPES.map((b) => (
          <li key={b.value} className={b.value === form.businessType ? 'on' : ''}>{b.label}</li>
        ))}
      </ul>
      <div className="fld">Registered name · registration no. · VAT no. — {form.registrationNumber || 'not set'}</div>

      <h2>Turnover and assets</h2>
      <div className="fld">Turnover declaration — {formatRand(form.turnoverDeclaredCents)} ({turnoverBand(form.turnoverDeclaredCents)})</div>
      {ncaReview && <p className="p">Turnover is below R1m, so this application needs a National Credit Act review.</p>}

      <h2>Estimated weekly volumes</h2>
      {form.weeklyVolumes.map((v) => (
        <div key={v.item} className="row"><span>{v.item}</span><span>{v.qty}</span></div>
      ))}

      <h2>Documents</h2>
      <table className="tbl">
        <thead>
          <tr><th>Document</th><th>Status</th></tr>
        </thead>
        <tbody>
          {REQUIRED_DOCUMENTS.map((d) => {
            const tag = documentTag(form.documents[d.kind]);
            return (
              <tr key={d.kind}>
                <td>{documentLabel(d.kind)}</td>
                <td><span className={tag.tone === 'ok' ? 'tag' : 'tag tag-watch'}>{tag.label}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2>Credit requested and terms</h2>
      <div className="fld">Credit requested — {formatRand(form.requestedLimitCents)} · terms {form.requestedTermsDays} days</div>
      <p className="p">Directors consent to a credit check (POPIA).</p>

      {problems.length > 0 && (
        <ul className="p">
          {problems.map((problem) => <li key={problem}>{problem}</li>)}
        </ul>
      )}

      <form action={submitApplication}>
        <button className="btn" type="submit" disabled={!progress.complete}>Submit application</button>
      </form>
    </section>
  );
}
