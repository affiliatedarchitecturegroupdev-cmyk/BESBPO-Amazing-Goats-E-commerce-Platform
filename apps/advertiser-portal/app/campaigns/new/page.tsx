// Wireframe: docs/wireframes/index.html#av-builder
import Link from 'next/link';
import {
  BUYER_TYPES,
  PRICING,
  SLOTS,
  builderProgress,
  claimsIn,
  hasHealthClaim,
  slotLabel,
  validate,
} from '../../../lib/campaign-form';
import { DEMO_FORM } from '../../../lib/seed';

export default function CampaignsNewPage() {
  const form = DEMO_FORM;
  const progress = builderProgress(form);
  const problems = validate(form).problems;
  const claims = claimsIn(form.headline);

  return (
    <section>
      <h1>New campaign</h1>
      <p className="p">Step {progress.step} of {progress.of}</p>
      <meter value={progress.step} min={0} max={progress.of}>{progress.step}/{progress.of}</meter>

      <article className="card">
        <h2>Goal and budget</h2>
        <div className="fld">{form.goal}</div>
        <div className="fld">Budget: R {(form.budgetCents / 100).toFixed(2)}</div>
      </article>

      <article className="card">
        <h2>Slot and pricing</h2>
        <ul className="chips">
          {SLOTS.map((s) => (
            <li key={s.code} className={s.code === form.slotCode ? 'on' : ''}>{s.code} {s.label}</li>
          ))}
        </ul>
        <ul className="chips">
          {PRICING.map((p) => (
            <li key={p.value} className={p.value === form.pricing ? 'on' : ''}>{p.label} · {p.hint}</li>
          ))}
        </ul>
        <p className="p">Selected: {slotLabel(form.slotCode)} ({form.slotCode})</p>
      </article>

      <article className="card">
        <h2>Targeting: category, region, buyer type</h2>
        <div className="fld">Category: {form.targeting.category || 'Any'}</div>
        <div className="fld">Region: {form.targeting.region || 'Any'}</div>
        <div className="fld">Buyer type: {form.targeting.buyerType} ({BUYER_TYPES.join(', ')})</div>
      </article>

      <article className="card">
        <h2>Creative upload and claims evidence</h2>
        <div className="fld">{form.headline}</div>
        {claims.length > 0 && (
          <p className="p">
            Claims detected: {claims.join(', ')}.
            {hasHealthClaim(form.headline)
              ? ' No health or medical claims are allowed.'
              : ' Attach evidence before submitting.'}
          </p>
        )}
        {problems.length > 0 && (
          <>
            <p className="p">Before you can submit:</p>
            <ul>
              {problems.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </>
        )}
      </article>

      <p className="p">No health claims. Human review before go-live.</p>
      <div className="row">
        <button className="btn" type="button" disabled={!progress.complete}>Submit for review</button>
        <Link href="/">Cancel</Link>
      </div>
    </section>
  );
}
