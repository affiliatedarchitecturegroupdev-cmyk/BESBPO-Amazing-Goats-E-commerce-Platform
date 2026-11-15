import { describe, it, expect } from 'vitest';
import {
  ApplicationForm,
  EMPTY_FORM,
  applicationProgress,
  creditAvailableCents,
  creditUsagePct,
  documentLabel,
  documentTag,
  documentsComplete,
  ladderHint,
  ladderPct,
  lulapayOffered,
  missingDocuments,
  monthsToNextTier,
  nextTermDays,
  nextTier,
  progressPct,
  requiresNcaReview,
  tierLabel,
  turnoverBand,
  unverifiedDocuments,
  validate,
} from './application';

function form(overrides: Partial<ApplicationForm> = {}): ApplicationForm {
  return {
    ...EMPTY_FORM,
    businessType: 'butchery',
    registrationNumber: '2019/123456/07',
    turnoverDeclaredCents: 2_000_000_000,
    weeklyVolumes: [
      { item: 'Lamb carcasses', qty: 5 },
      { item: 'Chicken (kg)', qty: 40 },
      { item: 'Egg trays', qty: 20 },
    ],
    documents: {
      company_registration: 'verified',
      vat_certificate: 'verified',
      certificate_of_acceptability: 'verified',
      bank_letter: 'verified',
    },
    requestedLimitCents: 5_000_000,
    requestedTermsDays: 14,
    consentGiven: true,
    ...overrides,
  };
}

describe('applicationProgress', () => {
  it('starts at step 1 and walks to step 5', () => {
    expect(applicationProgress(EMPTY_FORM).step).toBe(1);
    expect(applicationProgress(form()).step).toBe(5);
    expect(applicationProgress(form()).complete).toBe(true);
  });

  it('is not complete without consent', () => {
    expect(applicationProgress(form({ consentGiven: false })).complete).toBe(false);
  });

  it('reports a whole percentage for the bar', () => {
    expect(progressPct(applicationProgress(EMPTY_FORM))).toBe(20);
    expect(progressPct(applicationProgress(form()))).toBe(100);
  });
});

describe('document checks', () => {
  it('lists missing and unverified documents', () => {
    const docs = { ...form().documents, bank_letter: 'missing' as const };
    expect(missingDocuments(docs)).toEqual(['bank_letter']);
    expect(unverifiedDocuments({ ...form().documents, vat_certificate: 'uploaded' })).toEqual([
      'vat_certificate',
    ]);
  });

  it('is complete only when every document is verified', () => {
    expect(documentsComplete(form().documents)).toBe(true);
    expect(documentsComplete({ ...form().documents, bank_letter: 'uploaded' })).toBe(false);
  });

  it('labels a document and its tag', () => {
    expect(documentLabel('certificate_of_acceptability')).toBe('Certificate of Acceptability');
    expect(documentTag('verified')).toEqual({ label: 'Checked', tone: 'ok' });
    expect(documentTag('uploaded').tone).toBe('watch');
    expect(documentTag('missing').label).toBe('Not uploaded');
  });
});

describe('turnover and NCA', () => {
  it('bands turnover at the NCA and size boundaries', () => {
    expect(turnoverBand(90_000_000)).toBe('micro');
    expect(turnoverBand(100_000_000)).toBe('small');
    expect(turnoverBand(499_999_999)).toBe('small');
    expect(turnoverBand(500_000_000)).toBe('medium');
    expect(turnoverBand(2_500_000_000)).toBe('large');
  });

  it('flags NCA review below R1m', () => {
    expect(requiresNcaReview(99_999_999)).toBe(true);
    expect(requiresNcaReview(100_000_000)).toBe(false);
  });
});

describe('validate', () => {
  it('accepts a complete form', () => {
    expect(validate(form()).ok).toBe(true);
  });

  it('names each missing piece', () => {
    const { ok, problems } = validate({
      ...EMPTY_FORM,
      documents: { ...EMPTY_FORM.documents },
    });
    expect(ok).toBe(false);
    expect(problems).toEqual(
      expect.arrayContaining([
        'Choose a business type',
        'Registered name and number are required',
        'Turnover declaration is required',
        'Missing document: Company registration',
        'Credit requested must be more than zero',
        'Directors consent to a credit check is required (POPIA)',
      ]),
    );
  });
});

describe('credit ladder', () => {
  it('positions and labels the tiers', () => {
    expect(tierLabel('standard')).toBe('Standard');
    expect(nextTier('standard')).toBe('preferred');
    expect(nextTier('preferred')).toBe('preferred');
    expect(ladderPct('new')).toBe(0);
    expect(ladderPct('preferred')).toBe(100);
  });

  it('says what earns the next tier', () => {
    expect(monthsToNextTier('standard')).toBe(6);
    expect(ladderHint('standard', 3)).toBe('3 of 6 clean months to Preferred');
    expect(ladderHint('preferred', 0)).toBe('Top tier: 30 day terms');
  });

  it('offers LulaPay only when the pilot flag is on', () => {
    expect(lulapayOffered(true)).toBe(true);
    expect(lulapayOffered(false)).toBe(false);
  });

  it('suggests the next term option', () => {
    expect(nextTermDays(7)).toBe(14);
    expect(nextTermDays(30)).toBe(30);
  });
});

describe('dashboard credit', () => {
  it('computes available credit and usage', () => {
    expect(creditAvailableCents(10_000_000, 6_200_000)).toBe(3_800_000);
    expect(creditAvailableCents(10_000_000, 12_000_000)).toBe(0);
    expect(creditUsagePct(10_000_000, 6_200_000)).toBe(62);
    expect(creditUsagePct(0, 100)).toBe(0);
  });
});
