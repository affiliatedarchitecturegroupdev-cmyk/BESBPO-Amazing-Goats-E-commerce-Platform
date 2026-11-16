import { describe, it, expect } from 'vitest';
import {
  EMPTY_FORM,
  builderProgress,
  budgetRemainingCents,
  campaignTag,
  claimsIn,
  hasHealthClaim,
  requiresClaimsEvidence,
  reviewTag,
  slotLabel,
  spendPct,
  validate,
} from './campaign-form';

const form = (over: Partial<typeof EMPTY_FORM> = {}) => ({
  ...EMPTY_FORM,
  goal: 'Awareness',
  budgetCents: 500_000,
  slotCode: 'A4' as const,
  headline: 'Fresh lamb for the braai',
  ...over,
});

describe('claims', () => {
  it('finds claim keywords and flags health claims', () => {
    expect(claimsIn('Halaal and organic lamb')).toEqual(['halaal', 'organic']);
    expect(hasHealthClaim('Cures arthritis')).toBe(true);
    expect(hasHealthClaim('Great for the braai')).toBe(false);
    expect(requiresClaimsEvidence('Free-range lamb')).toBe(true);
    expect(requiresClaimsEvidence('Lamb for the braai')).toBe(false);
  });
});

describe('validate', () => {
  it('accepts a complete campaign', () => {
    expect(validate(form())).toEqual({ ok: true, problems: [] });
  });

  it('needs a bid for CPC but not for flat', () => {
    expect(validate(form({ pricing: 'cpc' })).problems).toContain('A CPC campaign needs a bid');
    expect(validate(form({ pricing: 'flat' })).ok).toBe(true);
  });

  it('requires evidence for a claim and bans health claims', () => {
    expect(validate(form({ headline: 'Organic lamb' })).problems[0]).toMatch(/Claims evidence is required/);
    expect(validate(form({ headline: 'Cures arthritis', claimsEvidenceUrl: 'https://x' })).problems)
      .toContain('No health or medical claims are allowed (R146)');
  });
});

describe('builder progress', () => {
  it('walks the four steps and completes when a claim has evidence', () => {
    expect(builderProgress(EMPTY_FORM)).toEqual({ step: 1, of: 4, complete: false });
    expect(builderProgress(form()).complete).toBe(true);
    expect(builderProgress(form({ headline: 'Organic lamb' })).complete).toBe(false);
    expect(builderProgress(form({ headline: 'Organic lamb', claimsEvidenceUrl: 'https://x' })).complete).toBe(true);
  });
});

describe('labels and tags', () => {
  it('names a slot', () => {
    expect(slotLabel('A1')).toBe('Home hero');
    expect(slotLabel('')).toBe('No slot');
  });

  it('tags review and campaign states', () => {
    expect(reviewTag('approved').tone).toBe('ok');
    expect(reviewTag('pending').label).toBe('In review');
    expect(campaignTag('live').label).toBe('Live');
    expect(campaignTag('draft').tone).toBe('info');
  });
});

describe('budget maths', () => {
  it('never goes negative and caps the percentage', () => {
    expect(budgetRemainingCents(500_000, 200_000)).toBe(300_000);
    expect(budgetRemainingCents(500_000, 900_000)).toBe(0);
    expect(spendPct(500_000, 250_000)).toBe(50);
    expect(spendPct(500_000, 900_000)).toBe(100);
    expect(spendPct(0, 100)).toBe(0);
  });
});
