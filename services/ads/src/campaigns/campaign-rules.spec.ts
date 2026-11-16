import { describe, it, expect } from 'vitest';
import {
  AdRuleError,
  Campaign,
  Creative,
  approveCampaign,
  canGoLive,
  claimsIn,
  draftCampaign,
  draftCreative,
  endCampaign,
  goLive,
  hasHealthClaim,
  pauseCampaign,
  rejectCampaign,
  requiresClaimsEvidence,
  reviewCreative,
  submitForReview,
  validateCampaign,
  validateCreative,
} from './campaign-rules';

const at = '2026-11-14T10:00:00.000Z';

const campaignInput = {
  advertiserOrgId: 'org-1',
  name: 'Braai season',
  goal: 'Awareness',
  budgetCents: 500_000,
  pricing: 'flat' as const,
  startsAt: '2026-11-20T00:00:00.000Z',
  endsAt: '2026-12-20T00:00:00.000Z',
};

const creativeInput = {
  campaignId: 'c1',
  slotCode: 'A4' as const,
  assetUrl: 'https://cdn/asset.png',
  headline: 'Charcoal for the braai',
};

function approvedCampaign(): Campaign {
  return approveCampaign(submitForReview(draftCampaign('c1', campaignInput), 1, at), 'reviewer-1', at);
}

function approvedCreative(): Creative {
  return reviewCreative(draftCreative('cr1', creativeInput), 'reviewer-1', 'approved', at);
}

describe('claim detection', () => {
  it('finds claim keywords in a headline', () => {
    expect(claimsIn('Halaal lamb, free-range and organic')).toEqual(['halaal', 'organic', 'free-range']);
    expect(claimsIn('Fresh lamb for the braai')).toEqual([]);
    expect(claimsIn(undefined)).toEqual([]);
  });

  it('flags health claims, which may never be approved', () => {
    expect(hasHealthClaim('This lamb cures arthritis')).toBe(true);
    expect(hasHealthClaim('Boosts immunity')).toBe(true);
    expect(hasHealthClaim('Great for the braai')).toBe(false);
  });

  it('needs evidence for any claim', () => {
    expect(requiresClaimsEvidence({ headline: 'Halaal certified' })).toBe(true);
    expect(requiresClaimsEvidence({ headline: 'Fresh today' })).toBe(false);
  });
});

describe('validateCampaign', () => {
  it('accepts a complete campaign', () => {
    expect(validateCampaign(campaignInput)).toEqual({ ok: true, problems: [] });
  });

  it('needs a bid for CPC and CPM, not for flat', () => {
    expect(validateCampaign({ ...campaignInput, pricing: 'cpc' }).problems).toContain('A CPC campaign needs a bid');
    expect(validateCampaign({ ...campaignInput, pricing: 'cpm', bidCents: 100 }).ok).toBe(true);
    expect(validateCampaign({ ...campaignInput, pricing: 'flat' }).ok).toBe(true);
  });

  it('rejects a zero budget and an inverted date range', () => {
    const r = validateCampaign({ ...campaignInput, budgetCents: 0, startsAt: at, endsAt: '2020-01-01T00:00:00.000Z' });
    expect(r.problems).toContain('Budget must be more than zero');
    expect(r.problems).toContain('The end date must be after the start date');
  });
});

describe('validateCreative', () => {
  it('requires claims evidence when a claim is present', () => {
    const r = validateCreative({ ...creativeInput, headline: 'Organic free-range lamb' });
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toMatch(/Claims evidence is required/);
  });

  it('bans health claims outright', () => {
    const r = validateCreative({ ...creativeInput, headline: 'Cures all ills', claimsEvidenceUrl: 'https://x' });
    expect(r.problems).toContain('No health or medical claims are allowed (R146)');
  });

  it('accepts a claim once evidence is attached', () => {
    const r = validateCreative({ ...creativeInput, headline: 'Halaal lamb', claimsEvidenceUrl: 'https://proof' });
    expect(r.ok).toBe(true);
  });

  it('rejects an unknown slot', () => {
    expect(validateCreative({ ...creativeInput, slotCode: 'A99' as never }).ok).toBe(false);
  });
});

describe('campaign lifecycle', () => {
  it('starts a valid campaign as a draft', () => {
    const c = draftCampaign('c1', campaignInput);
    expect(c.status).toBe('draft');
    expect(c.spentCents).toBe(0);
  });

  it('refuses to submit an invalid campaign', () => {
    expect(() => draftCampaign('c1', { ...campaignInput, name: '' })).toThrow(AdRuleError);
  });

  it('needs at least one creative before review', () => {
    const draft = draftCampaign('c1', campaignInput);
    expect(() => submitForReview(draft, 0, at)).toThrow(/at least one creative/);
    expect(submitForReview(draft, 1, at).status).toBe('pending_review');
  });

  it('requires a named reviewer to approve', () => {
    const pending = submitForReview(draftCampaign('c1', campaignInput), 1, at);
    expect(() => approveCampaign(pending, '', at)).toThrow(/reviewer must be named/);
    expect(approveCampaign(pending, 'reviewer-1', at).status).toBe('approved');
  });

  it('refuses to approve a campaign that is not in review', () => {
    expect(() => approveCampaign(draftCampaign('c1', campaignInput), 'reviewer-1', at)).toThrow(/only a campaign in review/);
  });

  it('needs a reason to reject', () => {
    const pending = submitForReview(draftCampaign('c1', campaignInput), 1, at);
    expect(() => rejectCampaign(pending, 'reviewer-1', '  ', at)).toThrow(/reason/);
    expect(rejectCampaign(pending, 'reviewer-1', 'Off-brand imagery', at).status).toBe('rejected');
  });
});

describe('creative review', () => {
  it('approves a clean creative', () => {
    const c = reviewCreative(draftCreative('cr1', creativeInput), 'reviewer-1', 'approved', at);
    expect(c.reviewStatus).toBe('approved');
    expect(c.reviewedBy).toBe('reviewer-1');
  });

  it('refuses to approve a health claim even with evidence', () => {
    // The draft already refuses it; the review guard is the second layer for a
    // creative that reached the store some other way.
    expect(() => draftCreative('cr1', { ...creativeInput, headline: 'Cures arthritis', claimsEvidenceUrl: 'https://x' })).toThrow(/health or medical claims/);
    const raw: Creative = {
      id: 'cr1', campaignId: 'c1', slotCode: 'A4', assetUrl: 'https://cdn/a.png',
      headline: 'Cures arthritis', claimsEvidenceUrl: 'https://x', reviewStatus: 'pending',
    };
    expect(() => reviewCreative(raw, 'reviewer-1', 'approved', at)).toThrow(/health or medical claim/);
  });

  it('refuses to approve a claim with no evidence on file', () => {
    const creative = { ...draftCreative('cr1', { ...creativeInput, headline: 'Fresh lamb' }), headline: 'Organic lamb' };
    expect(() => reviewCreative(creative, 'reviewer-1', 'approved', at)).toThrow(/needs evidence/);
  });

  it('needs a reason to reject and only decides a pending creative', () => {
    const creative = draftCreative('cr1', creativeInput);
    expect(() => reviewCreative(creative, 'reviewer-1', 'rejected', at)).toThrow(/reason/);
    const decided = reviewCreative(creative, 'reviewer-1', 'approved', at);
    expect(() => reviewCreative(decided, 'reviewer-2', 'rejected', at, 'changed mind')).toThrow(/pending review/);
  });
});

describe('go-live gate', () => {
  it('runs only when approved with an approved creative and budget left', () => {
    expect(canGoLive(approvedCampaign(), [approvedCreative()]).ok).toBe(true);
    expect(goLive(approvedCampaign(), [approvedCreative()], at).status).toBe('live');
  });

  it('blocks a campaign whose creative is still pending', () => {
    const check = canGoLive(approvedCampaign(), [draftCreative('cr1', creativeInput)]);
    expect(check.ok).toBe(false);
    expect(check.problems[0]).toMatch(/is pending/);
  });

  it('blocks an exhausted budget', () => {
    const spent = { ...approvedCampaign(), spentCents: 500_000 };
    expect(canGoLive(spent, [approvedCreative()]).problems).toContain('campaign budget is exhausted');
  });

  it('refuses to go live before approval', () => {
    expect(() => goLive(draftCampaign('c1', campaignInput), [approvedCreative()], at)).toThrow(/must be approved/);
  });
});

describe('pause and end', () => {
  it('pauses a live campaign and resumes it', () => {
    const live = goLive(approvedCampaign(), [approvedCreative()], at);
    const paused = pauseCampaign(live);
    expect(paused.status).toBe('paused');
    expect(canGoLive(paused, [approvedCreative()]).ok).toBe(true);
  });

  it('ends a live or paused campaign only', () => {
    const live = goLive(approvedCampaign(), [approvedCreative()], at);
    expect(endCampaign(live, at).status).toBe('ended');
    expect(() => endCampaign(draftCampaign('c1', campaignInput), at)).toThrow(/live or paused/);
  });
});
