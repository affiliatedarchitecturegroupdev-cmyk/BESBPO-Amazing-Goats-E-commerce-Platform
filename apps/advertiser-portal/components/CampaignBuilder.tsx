'use client';
import { useMemo, useState } from 'react';
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
  type CampaignForm,
} from '../lib/campaign-form';
import { submitCampaign } from '../app/campaigns/new/actions';

const INITIAL: CampaignForm = {
  goal: '',
  budgetCents: 0,
  pricing: 'flat',
  bidCents: 0,
  slotCode: '',
  targeting: { category: '', region: '', buyerType: 'Household' },
  headline: '',
  destinationUrl: '',
  claimsEvidenceUrl: '',
};

/** The four-step campaign builder. It previews the same rules the server applies. */
export function CampaignBuilder({ error }: { error?: string }) {
  const [form, setForm] = useState<CampaignForm>(INITIAL);
  const progress = useMemo(() => builderProgress(form), [form]);
  const problems = validate(form).problems;
  const claims = claimsIn(form.headline);

  return (
    <section>
      <h1>New campaign</h1>
      <p className="p">Step {progress.step} of {progress.of}</p>
      <meter value={progress.step} min={0} max={progress.of}>{progress.step}/{progress.of}</meter>

      {error && <p className="p" role="alert">Could not submit ({error}). Please check the form and try again.</p>}

      <form action={submitCampaign}>
        <article className="card">
          <h2>Goal and budget</h2>
          <label className="fld">Goal<input name="goal" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} /></label>
          <label className="fld">Budget (R)<input name="budgetRands" type="number" value={form.budgetCents ? form.budgetCents / 100 : ''} onChange={(e) => setForm({ ...form, budgetCents: Math.round(Number(e.target.value) * 100) })} /></label>
        </article>

        <article className="card">
          <h2>Slot and pricing</h2>
          <ul className="chips">
            {SLOTS.map((s) => (
              <li key={s.code} className={s.code === form.slotCode ? 'on' : ''}>
                <button type="button" onClick={() => setForm({ ...form, slotCode: s.code })}>{s.code} {s.label}</button>
              </li>
            ))}
          </ul>
          <input type="hidden" name="slotCode" value={form.slotCode} />
          <ul className="chips">
            {PRICING.map((p) => (
              <li key={p.value} className={p.value === form.pricing ? 'on' : ''}>
                <button type="button" onClick={() => setForm({ ...form, pricing: p.value })}>{p.label} · {p.hint}</button>
              </li>
            ))}
          </ul>
          <input type="hidden" name="pricing" value={form.pricing} />
          {form.pricing !== 'flat' && (
            <label className="fld">Bid (cents)<input name="bidCents" type="number" value={form.bidCents} onChange={(e) => setForm({ ...form, bidCents: Number(e.target.value) })} /></label>
          )}
          <p className="p">Selected: {slotLabel(form.slotCode)} ({form.slotCode || '—'})</p>
        </article>

        <article className="card">
          <h2>Targeting: category, region, buyer type</h2>
          <label className="fld">Category<input name="category" value={form.targeting.category} onChange={(e) => setForm({ ...form, targeting: { ...form.targeting, category: e.target.value } })} /></label>
          <label className="fld">Region<input name="region" value={form.targeting.region} onChange={(e) => setForm({ ...form, targeting: { ...form.targeting, region: e.target.value } })} /></label>
          <label className="fld">Buyer type
            <select name="buyerType" value={form.targeting.buyerType} onChange={(e) => setForm({ ...form, targeting: { ...form.targeting, buyerType: e.target.value } })}>
              {BUYER_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
        </article>

        <article className="card">
          <h2>Creative upload and claims evidence</h2>
          <label className="fld">Headline<input name="headline" value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} /></label>
          <label className="fld">Destination URL<input name="destinationUrl" value={form.destinationUrl} onChange={(e) => setForm({ ...form, destinationUrl: e.target.value })} /></label>
          <label className="fld">Claims evidence URL<input name="claimsEvidenceUrl" value={form.claimsEvidenceUrl} onChange={(e) => setForm({ ...form, claimsEvidenceUrl: e.target.value })} /></label>
          {claims.length > 0 && (
            <p className="p">
              Claims detected: {claims.join(', ')}.
              {hasHealthClaim(form.headline) ? ' No health or medical claims are allowed.' : ' Attach evidence before submitting.'}
            </p>
          )}
          {problems.length > 0 && (
            <>
              <p className="p">Before you can submit:</p>
              <ul>{problems.map((p) => <li key={p}>{p}</li>)}</ul>
            </>
          )}
        </article>

        <p className="p">No health claims. Human review before go-live.</p>
        <div className="row">
          <button className="btn" type="submit" disabled={!progress.complete}>Submit for review</button>
          <Link href="/">Cancel</Link>
        </div>
      </form>
    </section>
  );
}
